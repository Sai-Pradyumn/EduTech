# Asta — ML Service (LoRA / PEFT Fine-Tuning)

The **ml-service** is the offline / GPU side of Asta. While the NestJS `ai` and
`agents` modules talk to an `IAIProvider` (Mock / OpenAI / Gemini) at request
time, this service produces the **domain-adapted weights** those providers can
later load: parameter-efficient **LoRA adapters** fine-tuned on Asta tutoring
data so the model speaks in Asta's voice (mode-aware tutoring, doubt-solving,
roadmap reasoning, mentor feedback).

It is intentionally decoupled from the server:

- The server stays provider-agnostic behind `IAIProvider` and the
  `ENABLE_FINE_TUNING` flag.
- This service is where training/eval/merge happens — on a GPU box or a managed
  training job — and the resulting merged model or adapter is what an
  OpenAI-compatible / local serving runtime would expose back to the server.

```
ml-service/
  README.md
  requirements.txt
  configs/
    lora_config.yaml          # PEFT/LoRA hyperparameters (r, alpha, dropout, targets)
    training_config.yaml      # base model, epochs, lr, batch size, paths
  datasets/
    sample_education_dataset.jsonl   # instruction/response Asta tutoring rows
  training/
    prepare_dataset.py        # jsonl -> chat-templated, tokenized HF Dataset
    train_lora.py             # LoraConfig + SFT Trainer -> saves adapter
    merge_adapter.py          # adapter + base -> merged standalone model
    evaluate_adapter.py       # loss / perplexity + qualitative generations
  outputs/                    # (created at runtime) adapters, merged models, eval reports
```

## Dev / mock note

You do **not** need a GPU (or even these deps) for normal Asta development. The
server defaults to `MockAIProvider` and `ENABLE_FINE_TUNING=false`; nothing here
runs in the request path. This directory is the *real, runnable training rig*
you point at a GPU when you actually want a fine-tuned Asta model. The scripts
degrade gracefully (CPU + a tiny base model) so they can be smoke-tested
locally, but meaningful training requires a CUDA GPU.

## Setup

```bash
cd ml-service
python -m venv .venv && source .venv/bin/activate   # Python 3.10+
pip install -r requirements.txt
```

For real training, install a CUDA build of PyTorch matching your driver
(see https://pytorch.org/get-started/locally/) instead of the default wheel,
e.g.:

```bash
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

## How to run (later, on a GPU)

The four scripts form a pipeline. Each reads the YAML configs and takes
argparse overrides, so the configs are the source of truth and flags are for
one-off experiments.

```bash
# 0) Set the base model once in configs/training_config.yaml (base_model: ...)

# 1) Build the tokenized dataset from the instruction/response jsonl
python training/prepare_dataset.py \
  --data datasets/sample_education_dataset.jsonl \
  --config configs/training_config.yaml \
  --out outputs/dataset

# 2) Fine-tune a LoRA adapter (uses lora_config.yaml + training_config.yaml)
python training/train_lora.py \
  --lora-config configs/lora_config.yaml \
  --train-config configs/training_config.yaml \
  --dataset outputs/dataset \
  --out outputs/asta-lora

# 3) (Optional) Merge the adapter into the base model -> standalone weights
python training/merge_adapter.py \
  --base meta-llama/Meta-Llama-3.1-8B-Instruct \
  --adapter outputs/asta-lora \
  --out outputs/asta-merged

# 4) Evaluate the adapter: held-out loss/perplexity + sample generations
python training/evaluate_adapter.py \
  --base meta-llama/Meta-Llama-3.1-8B-Instruct \
  --adapter outputs/asta-lora \
  --data datasets/sample_education_dataset.jsonl \
  --train-config configs/training_config.yaml \
  --report outputs/eval_report.json
```

### Quick local smoke test (no GPU)

Override the base model with a tiny one so the pipeline runs end-to-end on CPU
to validate wiring (output quality will be meaningless):

```bash
python training/prepare_dataset.py --data datasets/sample_education_dataset.jsonl \
  --config configs/training_config.yaml --out outputs/dataset \
  --base-model sshleifer/tiny-gpt2

python training/train_lora.py --lora-config configs/lora_config.yaml \
  --train-config configs/training_config.yaml --dataset outputs/dataset \
  --out outputs/asta-lora --base-model sshleifer/tiny-gpt2 --max-steps 5
```

## Serving the result

Out of scope for this directory, but the intended handoff: merge the adapter
(`merge_adapter.py`) and serve the merged model behind an OpenAI-compatible
runtime (vLLM / TGI). The server then points `AI_PROVIDER=openai` at that
endpoint's base URL — the `IAIProvider` contract is unchanged, so the rest of
Asta is none the wiser that it is now talking to a fine-tuned model.
