#!/usr/bin/env python
"""Asta ml-service — merge a LoRA adapter into its base model.

Produces a standalone set of weights (base + adapter folded in) that can be
served by any vanilla runtime (vLLM / TGI / transformers) with no PEFT
dependency at inference time. This is the handoff artifact for serving a
fine-tuned Asta model behind an OpenAI-compatible endpoint.

Example
-------
    python training/merge_adapter.py \
        --base meta-llama/Meta-Llama-3.1-8B-Instruct \
        --adapter outputs/asta-lora \
        --out outputs/asta-merged
"""
from __future__ import annotations

import argparse
import os

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer


def main() -> None:
    ap = argparse.ArgumentParser(description="Merge LoRA adapter into base weights")
    ap.add_argument("--base", required=True, help="Base model id/path the adapter was trained on")
    ap.add_argument("--adapter", required=True, help="Path to the trained adapter (from train_lora.py)")
    ap.add_argument("--out", required=True, help="Output dir for the merged standalone model")
    ap.add_argument("--dtype", default="bfloat16",
                    choices=["bfloat16", "float16", "float32"],
                    help="Precision to load/save the merged model in")
    args = ap.parse_args()

    dtype = {
        "bfloat16": torch.bfloat16,
        "float16": torch.float16,
        "float32": torch.float32,
    }[args.dtype]

    print(f"[merge] loading base model: {args.base} ({args.dtype})")
    base = AutoModelForCausalLM.from_pretrained(
        args.base, torch_dtype=dtype, trust_remote_code=True
    )

    print(f"[merge] applying adapter: {args.adapter}")
    model = PeftModel.from_pretrained(base, args.adapter)

    # Fold the low-rank deltas into the base weights and drop the PEFT wrappers.
    print("[merge] merging adapter weights into base...")
    model = model.merge_and_unload()

    os.makedirs(args.out, exist_ok=True)
    model.save_pretrained(args.out, safe_serialization=True)

    # Prefer the tokenizer saved with the adapter (it may have chat-template /
    # pad-token tweaks); fall back to the base model's tokenizer.
    tok_src = args.adapter if os.path.exists(
        os.path.join(args.adapter, "tokenizer_config.json")
    ) else args.base
    tokenizer = AutoTokenizer.from_pretrained(tok_src, trust_remote_code=True)
    tokenizer.save_pretrained(args.out)

    print(f"[merge] merged model saved to {args.out}")
    print("[merge] serve it, e.g.:  python -m vllm.entrypoints.openai.api_server "
          f"--model {args.out}")


if __name__ == "__main__":
    main()
