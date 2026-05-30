"""
inference_server.py — Asta ml-service inference API (FastAPI + transformers + PEFT).

Serves generations from the fine-tuned Asta LoRA adapters. Per
docs/FINE_TUNING_LORA_ARCHITECTURE.md §1, this process keeps **one base model
resident on the GPU** and **hot-swaps lightweight LoRA adapters** per request, so
many fine-tunes share a single loaded base. The active adapter for each purpose is
resolved through `adapter_registry.py` (the Python mirror of Nest `model_adapters`).

This is real, runnable code — not a stub. It actually:
  - loads a HF base model + tokenizer (optionally 4-bit/QLoRA via bitsandbytes),
  - attaches the registered LoRA adapter(s) with `peft.PeftModel.load_adapter`,
  - generates text and switches adapters with `model.set_adapter(...)`.

================================  REQUIREMENTS  ================================
* A CUDA **GPU** is strongly recommended. On CPU it will run but be very slow,
  and 4-bit quantization (bitsandbytes) is GPU-only — set INFERENCE_LOAD_4BIT=0
  to fall back to fp16/fp32 on CPU.
* The **registered adapter must exist on disk** at the `path` recorded in the
  registry (a PEFT folder with adapter_config.json + adapter_model.safetensors).
  Train it first with `ml-service/training/train_lora.py`, then register it via
  `adapter_registry.register(..., activate=True)`. Without a registered adapter
  the server still starts and serves the BASE model (adapter=None).
* Install deps:  pip install fastapi uvicorn "transformers>=4.44" "peft>=0.12" \
                     accelerate torch bitsandbytes pydantic
* Run:           uvicorn inference_server:app --host 0.0.0.0 --port 8001
                 (or:  python inference_server.py)
===============================================================================

Endpoints
---------
GET  /health    → process + device + base-model load state
GET  /adapters  → list registry entries (optionally ?purpose=&status=)
POST /generate  → run inference; body picks adapter by id or by active purpose
"""

from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from adapter_registry import AdapterRecord, registry

# ----------------------------------------------------------------------------
# Configuration (env-driven so the same image runs on different GPU hosts).
# ----------------------------------------------------------------------------
BASE_MODEL = os.environ.get("INFERENCE_BASE_MODEL", "meta-llama/Llama-3.1-8B-Instruct")
LOAD_4BIT = os.environ.get("INFERENCE_LOAD_4BIT", "1") == "1"   # QLoRA-style load
DEFAULT_PURPOSE = os.environ.get("INFERENCE_DEFAULT_PURPOSE", "tutor")
MAX_NEW_TOKENS_CAP = int(os.environ.get("INFERENCE_MAX_NEW_TOKENS", "1024"))

# Heavy ML libs are imported lazily inside the loader so this module can be
# imported (e.g. for /health or tests) on a machine without torch installed.
_engine: "InferenceEngine | None" = None


class InferenceEngine:
    """Owns the resident base model + the set of attached LoRA adapters.

    Adapters are loaded once and then selected per-request with `set_adapter`,
    which is the cheap hot-swap the architecture doc relies on.
    """

    def __init__(self, base_model: str, load_4bit: bool):
        self.base_model_id = base_model
        self.load_4bit = load_4bit
        self.device = "cpu"
        self.dtype = None
        self.tokenizer = None
        self.model = None                       # PeftModel once an adapter is attached
        self._loaded_adapters: Dict[str, str] = {}  # adapter_id -> peft adapter name
        self.base_ready = False

    def load_base(self) -> None:
        """Load tokenizer + base model onto the best available device."""
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.dtype = torch.float16 if self.device == "cuda" else torch.float32

        quant_config = None
        if self.load_4bit and self.device == "cuda":
            # QLoRA-style 4-bit (nf4) load — matches training_config.yaml quantization.
            from transformers import BitsAndBytesConfig
            quant_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True,
            )

        self.tokenizer = AutoTokenizer.from_pretrained(self.base_model_id)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        self.model = AutoModelForCausalLM.from_pretrained(
            self.base_model_id,
            quantization_config=quant_config,
            torch_dtype=self.dtype,
            device_map="auto" if self.device == "cuda" else None,
        )
        if self.device == "cpu":
            self.model.to("cpu")
        self.model.eval()
        self.base_ready = True

    def ensure_adapter(self, rec: AdapterRecord) -> str:
        """Attach a registered LoRA adapter if not already loaded; return its
        internal PEFT adapter name. Validates base-model compatibility."""
        if rec.is_mock:
            raise HTTPException(
                status_code=409,
                detail=f"adapter '{rec.adapter_id}' is a mock record with no real weights",
            )
        if rec.base_model != self.base_model_id:
            raise HTTPException(
                status_code=409,
                detail=(f"adapter '{rec.adapter_id}' was trained on '{rec.base_model}' "
                        f"but this server hosts base '{self.base_model_id}'"),
            )
        if not os.path.isdir(rec.path):
            raise HTTPException(
                status_code=404,
                detail=f"adapter weights not found on disk at '{rec.path}'",
            )
        if rec.adapter_id in self._loaded_adapters:
            return self._loaded_adapters[rec.adapter_id]

        from peft import PeftModel

        peft_name = rec.adapter_id  # use the stable id as the PEFT adapter name
        if isinstance(self.model, PeftModel) or hasattr(self.model, "load_adapter"):
            # Base is already a PeftModel (an adapter was attached before) → add.
            self.model.load_adapter(rec.path, adapter_name=peft_name)
        else:
            # First adapter: wrap the base model into a PeftModel.
            self.model = PeftModel.from_pretrained(
                self.model, rec.path, adapter_name=peft_name
            )
        self._loaded_adapters[rec.adapter_id] = peft_name
        return peft_name

    def generate(
        self,
        prompt: str,
        rec: Optional[AdapterRecord],
        *,
        max_new_tokens: int,
        temperature: float,
        top_p: float,
        system: Optional[str],
    ) -> Dict[str, Any]:
        """Run a single generation, selecting `rec`'s adapter or the raw base."""
        import torch
        from peft import PeftModel

        if not self.base_ready:
            raise HTTPException(status_code=503, detail="base model not loaded yet")

        # Select adapter (or disable all adapters to serve the pure base model).
        adapter_used: Optional[str] = None
        if rec is not None:
            peft_name = self.ensure_adapter(rec)
            self.model.set_adapter(peft_name)
            adapter_used = rec.adapter_id
        elif isinstance(self.model, PeftModel):
            self.model.disable_adapter_layers()

        # Build a chat-formatted prompt when the tokenizer has a chat template.
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        if getattr(self.tokenizer, "chat_template", None):
            text = self.tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True
            )
        else:
            text = (f"{system}\n\n" if system else "") + prompt

        inputs = self.tokenizer(text, return_tensors="pt").to(self.model.device)
        t0 = time.time()
        with torch.no_grad():
            out = self.model.generate(
                **inputs,
                max_new_tokens=min(max_new_tokens, MAX_NEW_TOKENS_CAP),
                do_sample=temperature > 0,
                temperature=max(temperature, 1e-5),
                top_p=top_p,
                pad_token_id=self.tokenizer.pad_token_id,
            )
        # Re-enable adapter layers if we had disabled them for a base-only call.
        if rec is None and isinstance(self.model, PeftModel):
            self.model.enable_adapter_layers()

        gen_tokens = out[0][inputs["input_ids"].shape[1]:]
        completion = self.tokenizer.decode(gen_tokens, skip_special_tokens=True)
        return {
            "text": completion,
            "adapter_id": adapter_used,
            "base_model": self.base_model_id,
            "tokens_generated": int(gen_tokens.shape[0]),
            "latency_ms": int((time.time() - t0) * 1000),
        }


# ----------------------------------------------------------------------------
# FastAPI app + lifespan (load the base model once at startup).
# ----------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _engine
    _engine = InferenceEngine(BASE_MODEL, LOAD_4BIT)
    try:
        _engine.load_base()
    except Exception as exc:  # noqa: BLE001 — keep server up so /health reports why
        # Don't crash the process: /health surfaces the failure, /generate 503s.
        print(f"[inference_server] base model load failed: {exc!r}")
    yield
    _engine = None


app = FastAPI(title="Asta ml-service — Inference", version="1.0.0", lifespan=lifespan)


class GenerateRequest(BaseModel):
    prompt: str = Field(..., description="User prompt / instruction")
    system: Optional[str] = Field(None, description="Optional system prompt")
    # Pick the adapter either explicitly by id, or implicitly by active purpose.
    adapter_id: Optional[str] = Field(None, description="Exact adapter to use")
    purpose: Optional[str] = Field(None, description="Use the active adapter for this purpose")
    use_base: bool = Field(False, description="Ignore adapters and serve raw base model")
    max_new_tokens: int = 512
    temperature: float = 0.7
    top_p: float = 0.95


class GenerateResponse(BaseModel):
    text: str
    adapter_id: Optional[str]
    base_model: str
    tokens_generated: int
    latency_ms: int


@app.get("/health")
def health() -> Dict[str, Any]:
    eng = _engine
    return {
        "status": "ok" if (eng and eng.base_ready) else "degraded",
        "base_model": BASE_MODEL,
        "base_ready": bool(eng and eng.base_ready),
        "device": eng.device if eng else "unknown",
        "load_4bit": LOAD_4BIT,
        "loaded_adapters": list(eng._loaded_adapters.keys()) if eng else [],
        "registered_adapters": len(registry.list()),
    }


@app.get("/adapters")
def list_adapters(purpose: Optional[str] = None,
                  status: Optional[str] = None) -> List[Dict[str, Any]]:
    """List registry entries this server could serve (filterable)."""
    return [r.to_dict() for r in registry.list(purpose=purpose, status=status)]


@app.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    eng = _engine
    if eng is None:
        raise HTTPException(status_code=503, detail="engine not initialized")

    # Resolve which adapter (if any) to serve, in precedence order.
    rec: Optional[AdapterRecord] = None
    if req.use_base:
        rec = None
    elif req.adapter_id:
        rec = registry.get(req.adapter_id)
        if rec is None:
            raise HTTPException(status_code=404,
                                detail=f"unknown adapter_id '{req.adapter_id}'")
    else:
        purpose = req.purpose or DEFAULT_PURPOSE
        rec = registry.get_active(purpose)
        # rec may be None → fall back to serving the base model.

    result = eng.generate(
        req.prompt,
        rec,
        max_new_tokens=req.max_new_tokens,
        temperature=req.temperature,
        top_p=req.top_p,
        system=req.system,
    )
    return GenerateResponse(**result)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "inference_server:app",
        host=os.environ.get("INFERENCE_HOST", "0.0.0.0"),
        port=int(os.environ.get("INFERENCE_PORT", "8001")),
        reload=False,
    )
