#!/usr/bin/env python
"""Asta ml-service — LoRA / PEFT fine-tuning.

Loads the base model, wraps it with a PEFT `LoraConfig`, and runs the
HuggingFace `Trainer` over the tokenized dataset produced by
`prepare_dataset.py`. Saves only the adapter weights (small, MBs) to `--out`.

Example
-------
    python training/train_lora.py \
        --lora-config configs/lora_config.yaml \
        --train-config configs/training_config.yaml \
        --dataset outputs/dataset \
        --out outputs/asta-lora

No-GPU smoke test:
    python training/train_lora.py ... --base-model sshleifer/tiny-gpt2 --max-steps 5
"""
from __future__ import annotations

import argparse
import os
from typing import Any, Dict

import torch
import yaml
from datasets import load_from_disk
from peft import LoraConfig, get_peft_model
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments,
)


def load_yaml(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def build_lora_config(lora_cfg: Dict[str, Any]) -> LoraConfig:
    """Map our YAML onto peft.LoraConfig."""
    return LoraConfig(
        r=int(lora_cfg.get("r", 16)),
        lora_alpha=int(lora_cfg.get("lora_alpha", 32)),
        lora_dropout=float(lora_cfg.get("lora_dropout", 0.05)),
        bias=lora_cfg.get("bias", "none"),
        task_type=lora_cfg.get("task_type", "CAUSAL_LM"),
        target_modules=lora_cfg.get("target_modules"),
        modules_to_save=lora_cfg.get("modules_to_save") or None,
    )


def maybe_qlora_kwargs(use_qlora: bool) -> Dict[str, Any]:
    """4-bit load config for QLoRA (CUDA + bitsandbytes only)."""
    if not use_qlora:
        return {}
    try:
        from transformers import BitsAndBytesConfig
    except Exception as exc:  # pragma: no cover - optional dep
        raise RuntimeError(
            "use_qlora=true requires bitsandbytes + a recent transformers build"
        ) from exc
    return {
        "quantization_config": BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
            bnb_4bit_use_double_quant=True,
        )
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Fine-tune a LoRA adapter for Asta")
    ap.add_argument("--lora-config", required=True, help="configs/lora_config.yaml")
    ap.add_argument("--train-config", required=True, help="configs/training_config.yaml")
    ap.add_argument("--dataset", required=True, help="Tokenized DatasetDict dir")
    ap.add_argument("--out", default=None, help="Output dir for the adapter")
    ap.add_argument("--base-model", default=None, help="Override base_model")
    ap.add_argument("--max-steps", type=int, default=-1,
                    help="Cap training steps (useful for smoke tests)")
    args = ap.parse_args()

    lora_cfg = load_yaml(args.lora_config)
    train_cfg = load_yaml(args.train_config)

    base_model = args.base_model or train_cfg["base_model"]
    out_dir = args.out or train_cfg.get("output_dir", "outputs/asta-lora")
    use_qlora = bool(lora_cfg.get("use_qlora", False))

    # Precision: honor config but fall back to fp32 on CPU.
    cuda = torch.cuda.is_available()
    bf16 = bool(train_cfg.get("bf16", True)) and cuda
    fp16 = bool(train_cfg.get("fp16", False)) and cuda and not bf16
    dtype = torch.bfloat16 if bf16 else (torch.float16 if fp16 else torch.float32)

    print(f"[train] base_model={base_model} cuda={cuda} dtype={dtype}")

    # --- Tokenizer (prefer the one cached by prepare_dataset.py) ---
    tok_dir = os.path.join(args.dataset, "tokenizer")
    tok_src = tok_dir if os.path.isdir(tok_dir) else base_model
    tokenizer = AutoTokenizer.from_pretrained(tok_src, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # --- Base model ---
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=dtype,
        trust_remote_code=True,
        **maybe_qlora_kwargs(use_qlora),
    )
    if use_qlora:
        from peft import prepare_model_for_kbit_training
        model = prepare_model_for_kbit_training(
            model, use_gradient_checkpointing=train_cfg.get("gradient_checkpointing", True)
        )
    if train_cfg.get("gradient_checkpointing", True):
        model.gradient_checkpointing_enable()
        model.config.use_cache = False  # incompatible with grad checkpointing

    # --- Attach LoRA adapters ---
    peft_model = get_peft_model(model, build_lora_config(lora_cfg))
    peft_model.print_trainable_parameters()

    # --- Data ---
    dsd = load_from_disk(args.dataset)
    train_ds = dsd["train"]
    eval_ds = dsd.get("eval")
    # mlm=False => standard causal LM loss; collator handles dynamic padding.
    collator = DataCollatorForLanguageModeling(tokenizer, mlm=False)

    targs = TrainingArguments(
        output_dir=out_dir,
        num_train_epochs=float(train_cfg.get("num_train_epochs", 3)),
        max_steps=args.max_steps,
        per_device_train_batch_size=int(train_cfg.get("per_device_train_batch_size", 4)),
        per_device_eval_batch_size=int(train_cfg.get("per_device_eval_batch_size", 4)),
        gradient_accumulation_steps=int(train_cfg.get("gradient_accumulation_steps", 4)),
        learning_rate=float(train_cfg.get("learning_rate", 2e-4)),
        lr_scheduler_type=train_cfg.get("lr_scheduler_type", "cosine"),
        warmup_ratio=float(train_cfg.get("warmup_ratio", 0.03)),
        weight_decay=float(train_cfg.get("weight_decay", 0.0)),
        max_grad_norm=float(train_cfg.get("max_grad_norm", 1.0)),
        bf16=bf16,
        fp16=fp16,
        logging_steps=int(train_cfg.get("logging_steps", 5)),
        save_steps=int(train_cfg.get("save_steps", 50)),
        save_total_limit=int(train_cfg.get("save_total_limit", 2)),
        eval_strategy="steps" if eval_ds is not None else "no",
        eval_steps=int(train_cfg.get("eval_steps", 50)),
        seed=int(train_cfg.get("seed", 42)),
        report_to=[],  # no W&B by default; set to ["wandb"] to enable
    )

    trainer = Trainer(
        model=peft_model,
        args=targs,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        data_collator=collator,
    )

    print(f"[train] starting training -> {out_dir}")
    trainer.train()

    # Save ONLY the adapter (+ tokenizer) — small and portable.
    peft_model.save_pretrained(out_dir)
    tokenizer.save_pretrained(out_dir)
    print(f"[train] adapter saved to {out_dir}")


if __name__ == "__main__":
    main()
