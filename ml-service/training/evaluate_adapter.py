#!/usr/bin/env python
"""Asta ml-service — evaluate a trained LoRA adapter.

Two complementary signals:
  1. Quantitative: held-out loss + perplexity on a re-derived eval split.
  2. Qualitative: sample generations on a few Asta-style prompts so a human can
     eyeball whether the adapter sounds like Asta.

Writes a JSON report (and prints a summary) so eval can be diffed across runs.

Example
-------
    python training/evaluate_adapter.py \
        --base meta-llama/Meta-Llama-3.1-8B-Instruct \
        --adapter outputs/asta-lora \
        --data datasets/sample_education_dataset.jsonl \
        --train-config configs/training_config.yaml \
        --report outputs/eval_report.json
"""
from __future__ import annotations

import argparse
import json
import math
import os
from typing import Any, Dict, List

import torch
import yaml
from datasets import Dataset
from peft import PeftModel
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments,
)

# Reuse the exact formatting logic from prepare_dataset so eval matches training.
from prepare_dataset import build_messages, read_jsonl, FALLBACK_CHAT_TEMPLATE


def load_yaml(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


# A small fixed set of probe prompts for qualitative inspection.
PROBE_PROMPTS: List[Dict[str, str]] = [
    {"agent": "tutor", "mode": "explain",
     "instruction": "Explain what a hash table is and why lookups are fast.", "input": ""},
    {"agent": "tutor", "mode": "socratic",
     "instruction": "Help me understand recursion without giving the answer.", "input": ""},
    {"agent": "doubt_solver", "mode": "explain",
     "instruction": "Why does my for-loop in JavaScript print the same value each time with var?",
     "input": "for (var i=0;i<3;i++) setTimeout(()=>console.log(i));"},
]


def main() -> None:
    ap = argparse.ArgumentParser(description="Evaluate an Asta LoRA adapter")
    ap.add_argument("--base", required=True, help="Base model id/path")
    ap.add_argument("--adapter", required=True, help="Trained adapter dir")
    ap.add_argument("--data", required=True, help="JSONL used to derive the held-out eval split")
    ap.add_argument("--train-config", required=True, help="configs/training_config.yaml")
    ap.add_argument("--report", default="outputs/eval_report.json", help="Output JSON report path")
    ap.add_argument("--max-new-tokens", type=int, default=256, help="Generation length for probes")
    args = ap.parse_args()

    cfg = load_yaml(args.train_config)
    max_len = int(cfg.get("max_seq_length", 1024))
    eval_split = float(cfg.get("eval_split", 0.1))
    seed = int(cfg.get("seed", 42))

    cuda = torch.cuda.is_available()
    dtype = torch.bfloat16 if cuda else torch.float32
    print(f"[eval] base={args.base} adapter={args.adapter} cuda={cuda}")

    # --- Load base + adapter for inference (no merge needed to evaluate) ---
    tok_src = args.adapter if os.path.exists(
        os.path.join(args.adapter, "tokenizer_config.json")
    ) else args.base
    tokenizer = AutoTokenizer.from_pretrained(tok_src, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    if tokenizer.chat_template is None:
        tokenizer.chat_template = FALLBACK_CHAT_TEMPLATE

    base = AutoModelForCausalLM.from_pretrained(
        args.base, torch_dtype=dtype, trust_remote_code=True
    )
    model = PeftModel.from_pretrained(base, args.adapter)
    model.eval()
    if cuda:
        model = model.to("cuda")

    # ---------- 1) Quantitative: loss + perplexity on held-out rows ----------
    rows = read_jsonl(args.data)
    full = Dataset.from_list(rows)
    if len(full) >= 4 and eval_split > 0:
        eval_rows = full.train_test_split(test_size=eval_split, seed=seed)["test"]
    else:
        eval_rows = full  # tiny dataset: evaluate on everything

    def tokenize(row: Dict[str, Any]) -> Dict[str, Any]:
        text = tokenizer.apply_chat_template(
            build_messages(row), tokenize=False, add_generation_prompt=False
        )
        enc = tokenizer(text, truncation=True, max_length=max_len)
        enc["labels"] = enc["input_ids"].copy()
        return enc

    tokenized = eval_rows.map(tokenize, remove_columns=eval_rows.column_names)
    collator = DataCollatorForLanguageModeling(tokenizer, mlm=False)

    # Use Trainer purely as an evaluation loop (no optimizer steps).
    trainer = Trainer(
        model=model,
        args=TrainingArguments(
            output_dir="outputs/_eval_tmp",
            per_device_eval_batch_size=int(cfg.get("per_device_eval_batch_size", 4)),
            bf16=cuda,
            report_to=[],
        ),
        eval_dataset=tokenized,
        data_collator=collator,
    )
    metrics = trainer.evaluate()
    eval_loss = float(metrics.get("eval_loss", float("nan")))
    perplexity = float(math.exp(eval_loss)) if eval_loss == eval_loss else float("nan")
    print(f"[eval] held-out loss={eval_loss:.4f} perplexity={perplexity:.2f} "
          f"(n={len(tokenized)})")

    # ---------- 2) Qualitative: sample generations on probe prompts ----------
    samples: List[Dict[str, str]] = []
    for probe in PROBE_PROMPTS:
        prompt_messages = build_messages({**probe, "response": ""})[:-1]  # drop empty assistant
        prompt_text = tokenizer.apply_chat_template(
            prompt_messages, tokenize=False, add_generation_prompt=True
        )
        inputs = tokenizer(prompt_text, return_tensors="pt")
        if cuda:
            inputs = {k: v.to("cuda") for k, v in inputs.items()}
        with torch.no_grad():
            out = model.generate(
                **inputs,
                max_new_tokens=args.max_new_tokens,
                do_sample=False,
                pad_token_id=tokenizer.pad_token_id,
            )
        gen = tokenizer.decode(
            out[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True
        )
        samples.append({
            "agent": probe["agent"],
            "mode": probe["mode"],
            "prompt": probe["instruction"],
            "generation": gen.strip(),
        })
        print(f"\n[eval] === {probe['agent']}/{probe['mode']} ===\n{gen.strip()[:400]}")

    report = {
        "base_model": args.base,
        "adapter": args.adapter,
        "eval_loss": eval_loss,
        "perplexity": perplexity,
        "n_eval": len(tokenized),
        "samples": samples,
    }
    os.makedirs(os.path.dirname(args.report) or ".", exist_ok=True)
    with open(args.report, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
    print(f"\n[eval] wrote report to {args.report}")


if __name__ == "__main__":
    main()
