#!/usr/bin/env python
"""Asta ml-service — dataset preparation.

Reads the instruction/response JSONL, formats each row into the base model's
chat template, tokenizes it, and saves a HuggingFace `DatasetDict` (train/eval)
to disk for `train_lora.py` to consume.

Why a separate step: tokenization + chat-templating is deterministic and
sometimes slow, so we do it once and cache the result. It also keeps the
training script focused on optimization.

Example
-------
    python training/prepare_dataset.py \
        --data datasets/sample_education_dataset.jsonl \
        --config configs/training_config.yaml \
        --out outputs/dataset
"""
from __future__ import annotations

import argparse
import json
import os
from typing import Any, Dict, List

import yaml
from datasets import Dataset, DatasetDict
from transformers import AutoTokenizer


# Fallback chat template used only if the tokenizer ships without one
# (some base — non-instruct — models do). Mirrors a simple ChatML-ish format.
FALLBACK_CHAT_TEMPLATE = (
    "{% for m in messages %}"
    "{% if m['role'] == 'system' %}<|system|>\n{{ m['content'] }}\n"
    "{% elif m['role'] == 'user' %}<|user|>\n{{ m['content'] }}\n"
    "{% else %}<|assistant|>\n{{ m['content'] }}\n{% endif %}"
    "{% endfor %}"
    "{% if add_generation_prompt %}<|assistant|>\n{% endif %}"
)

# System prompt that frames the model as the Asta mentor. The per-row `mode`
# and `agent` fields are folded in so the adapter learns mode-aware behavior.
ASTA_SYSTEM = (
    "You are Asta, an AI skill mentor. You teach precisely and kindly, adapt to "
    "the learner's level, and stay in the requested teaching mode. "
    "Agent: {agent}. Mode: {mode}."
)


def load_yaml(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def read_jsonl(path: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as fh:
        for i, line in enumerate(fh, 1):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise ValueError(f"Bad JSON on line {i} of {path}: {exc}") from exc
    if not rows:
        raise ValueError(f"No rows found in {path}")
    return rows


def build_messages(row: Dict[str, Any]) -> List[Dict[str, str]]:
    """Turn one dataset row into a chat-style message list."""
    system = ASTA_SYSTEM.format(
        agent=row.get("agent", "tutor"),
        mode=row.get("mode", "explain"),
    )
    user = row["instruction"]
    # Optional `input` provides extra context (e.g. the student's code/question).
    if row.get("input"):
        user = f"{user}\n\n{row['input']}"
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
        {"role": "assistant", "content": row["response"]},
    ]


def main() -> None:
    ap = argparse.ArgumentParser(description="Prepare + tokenize Asta SFT dataset")
    ap.add_argument("--data", required=True, help="Path to instruction/response .jsonl")
    ap.add_argument("--config", required=True, help="training_config.yaml")
    ap.add_argument("--out", required=True, help="Output dir for the tokenized DatasetDict")
    ap.add_argument("--base-model", default=None, help="Override base_model from config")
    ap.add_argument("--max-seq-length", type=int, default=None, help="Override max_seq_length")
    args = ap.parse_args()

    cfg = load_yaml(args.config)
    base_model = args.base_model or cfg["base_model"]
    max_len = args.max_seq_length or cfg.get("max_seq_length", 1024)
    eval_split = float(cfg.get("eval_split", 0.1))
    seed = int(cfg.get("seed", 42))

    print(f"[prepare] base_model={base_model} max_seq_length={max_len}")

    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    # Causal LMs typically lack a pad token; reuse EOS so batching works.
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    if tokenizer.chat_template is None:
        print("[prepare] tokenizer has no chat_template; using fallback ChatML template")
        tokenizer.chat_template = FALLBACK_CHAT_TEMPLATE

    raw_rows = read_jsonl(args.data)
    print(f"[prepare] loaded {len(raw_rows)} rows from {args.data}")

    def to_text(row: Dict[str, Any]) -> Dict[str, str]:
        messages = build_messages(row)
        # add_generation_prompt=False because the assistant turn is already present
        # (we are training on the full prompt+response sequence).
        text = tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=False
        )
        return {"text": text}

    def tokenize(batch: Dict[str, List[str]]) -> Dict[str, Any]:
        out = tokenizer(
            batch["text"],
            truncation=True,
            max_length=max_len,
            padding=False,  # dynamic padding happens in the collator at train time
        )
        # Causal LM: labels == input_ids; the collator/Trainer shifts internally.
        out["labels"] = [ids.copy() for ids in out["input_ids"]]
        return out

    ds = Dataset.from_list(raw_rows)
    ds = ds.map(to_text, desc="format chat template")
    ds = ds.map(
        tokenize,
        batched=True,
        remove_columns=ds.column_names,
        desc="tokenize",
    )

    # Train/eval split (guard against tiny datasets where a split would be empty).
    if len(ds) >= 4 and eval_split > 0:
        split = ds.train_test_split(test_size=eval_split, seed=seed)
        dsd = DatasetDict(train=split["train"], eval=split["test"])
    else:
        print("[prepare] dataset too small for eval split; using all rows for train")
        dsd = DatasetDict(train=ds, eval=ds)

    os.makedirs(args.out, exist_ok=True)
    dsd.save_to_disk(args.out)
    # Persist the tokenizer alongside so downstream scripts stay consistent.
    tokenizer.save_pretrained(os.path.join(args.out, "tokenizer"))

    print(
        f"[prepare] saved DatasetDict to {args.out} "
        f"(train={len(dsd['train'])}, eval={len(dsd['eval'])})"
    )


if __name__ == "__main__":
    main()
