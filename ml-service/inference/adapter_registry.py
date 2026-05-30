"""
adapter_registry.py — local source of truth for trained LoRA/PEFT adapters.

This is the Python-side mirror of NestJS `model_adapters` (see
docs/FINE_TUNING_LORA_ARCHITECTURE.md §2). NestJS owns the *lifecycle* record in
Mongo; this registry is what the GPU host actually consults at inference time to
resolve an `adapter_id` → on-disk weights + the base model it was trained against.

Design goals
------------
- **Zero external deps.** Backed by a single JSON file so it works on a fresh GPU
  box before any DB/object-store wiring exists. The schema mirrors Nest's
  `ModelAdapter` (adapterId, baseModel, version, metrics, status, artifactUri →
  here `path`) so the two stay 1:1 and an adapter can be synced either direction.
- **One active adapter per `purpose`.** Promotion (`registered → active`) archives
  the previously active adapter for the same purpose, mirroring the Nest promotion
  rule, so rollback is a single `set_active` flip.
- **Append-friendly + concurrency-safe enough.** Writes go to a temp file and are
  atomically renamed, so a crashed write never corrupts the registry.

Status values (match Nest): 'registered' | 'active' | 'archived'.

NOTE: This file only *tracks* adapters. Loading them onto a GPU happens in
`inference_server.py`, which calls `get_active()` / `get()` here.
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# Default registry location — overridable so tests / multiple hosts can isolate.
DEFAULT_REGISTRY_PATH = os.environ.get(
    "ADAPTER_REGISTRY_PATH",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "adapters", "registry.json"),
)

VALID_STATUSES = ("registered", "active", "archived")


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class AdapterRecord:
    """One immutable-ish adapter entry. Mirrors Nest `ModelAdapter`.

    `path` is the local filesystem location of the PEFT adapter directory
    (the folder containing `adapter_config.json` + `adapter_model.safetensors`),
    i.e. the resolved form of Nest's `artifactUri` on this host.
    """

    adapter_id: str                       # stable id shared with Nest `adapterId`
    base_model: str                       # HF id/path; adapter is ONLY valid on this base
    version: str                          # semver-ish, monotonic per (base_model, purpose)
    path: str                             # local dir with adapter weights (PEFT format)
    purpose: str = "general"              # logical slot; one `active` per purpose
    metrics: Dict[str, Any] = field(default_factory=dict)   # {evalLoss, winRateVsBase, ...}
    lora_config: Dict[str, Any] = field(default_factory=dict)  # r, alpha, target_modules (audit)
    status: str = "registered"            # 'registered' | 'active' | 'archived'
    is_mock: bool = False                 # produced by MockTrainer (no real weights)
    job_id: Optional[str] = None          # provenance → fine_tuning_jobs
    dataset_id: Optional[str] = None      # provenance → exported dataset
    size_bytes: int = 0
    created_at: str = field(default_factory=_utcnow_iso)
    updated_at: str = field(default_factory=_utcnow_iso)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @staticmethod
    def from_dict(d: Dict[str, Any]) -> "AdapterRecord":
        # Be tolerant of extra keys so the schema can evolve without breaking loads.
        known = {f for f in AdapterRecord.__dataclass_fields__}  # type: ignore[attr-defined]
        return AdapterRecord(**{k: v for k, v in d.items() if k in known})


class AdapterRegistry:
    """JSON-file-backed registry. Thread-safe within a single process."""

    def __init__(self, path: str = DEFAULT_REGISTRY_PATH):
        self.path = path
        self._lock = threading.RLock()
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        if not os.path.exists(self.path):
            self._write_all([])

    # ---- low-level persistence -------------------------------------------------

    def _read_all(self) -> List[AdapterRecord]:
        with self._lock:
            try:
                with open(self.path, "r", encoding="utf-8") as fh:
                    raw = json.load(fh)
            except (FileNotFoundError, json.JSONDecodeError):
                return []
            return [AdapterRecord.from_dict(r) for r in raw.get("adapters", [])]

    def _write_all(self, records: List[AdapterRecord]) -> None:
        """Atomic write: serialize to a temp file in the same dir, then rename."""
        with self._lock:
            payload = {"version": 1, "updated_at": _utcnow_iso(),
                       "adapters": [r.to_dict() for r in records]}
            d = os.path.dirname(self.path)
            fd, tmp = tempfile.mkstemp(prefix=".registry-", dir=d)
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as fh:
                    json.dump(payload, fh, indent=2)
                os.replace(tmp, self.path)  # atomic on POSIX/Windows
            finally:
                if os.path.exists(tmp):
                    os.remove(tmp)

    # ---- public API ------------------------------------------------------------

    def register(
        self,
        adapter_id: str,
        base_model: str,
        version: str,
        path: str,
        *,
        purpose: str = "general",
        metrics: Optional[Dict[str, Any]] = None,
        lora_config: Optional[Dict[str, Any]] = None,
        is_mock: bool = False,
        job_id: Optional[str] = None,
        dataset_id: Optional[str] = None,
        activate: bool = False,
    ) -> AdapterRecord:
        """Add (or overwrite) an adapter record. Idempotent on `adapter_id`.

        If `activate=True`, the new adapter is promoted to `active` and any other
        `active` adapter sharing its `purpose` is archived (single-active rule).
        """
        with self._lock:
            records = self._read_all()
            # Compute on-disk size if a real (non-mock) directory is present.
            size = 0
            if not is_mock and os.path.isdir(path):
                size = _dir_size_bytes(path)

            rec = AdapterRecord(
                adapter_id=adapter_id,
                base_model=base_model,
                version=version,
                path=path,
                purpose=purpose,
                metrics=metrics or {},
                lora_config=lora_config or {},
                status="registered",
                is_mock=is_mock,
                job_id=job_id,
                dataset_id=dataset_id,
                size_bytes=size,
            )
            # Replace existing entry with the same id (re-register), else append.
            records = [r for r in records if r.adapter_id != adapter_id]
            records.append(rec)
            self._write_all(records)

        if activate:
            return self.set_active(adapter_id)
        return rec

    def list(self, *, purpose: Optional[str] = None,
             status: Optional[str] = None) -> List[AdapterRecord]:
        """Return all adapters, optionally filtered by purpose and/or status."""
        records = self._read_all()
        if purpose is not None:
            records = [r for r in records if r.purpose == purpose]
        if status is not None:
            records = [r for r in records if r.status == status]
        # Newest first for predictable UI ordering.
        return sorted(records, key=lambda r: r.created_at, reverse=True)

    def get(self, adapter_id: str) -> Optional[AdapterRecord]:
        """Resolve a single adapter by id, or None if unknown."""
        for r in self._read_all():
            if r.adapter_id == adapter_id:
                return r
        return None

    def get_active(self, purpose: str = "general") -> Optional[AdapterRecord]:
        """Return the single `active` adapter for a purpose (or None)."""
        for r in self._read_all():
            if r.purpose == purpose and r.status == "active":
                return r
        return None

    def set_active(self, adapter_id: str) -> AdapterRecord:
        """Promote `adapter_id` to `active`, archiving the prior active one for
        the same purpose. Enforces the single-active-per-purpose invariant."""
        with self._lock:
            records = self._read_all()
            target = next((r for r in records if r.adapter_id == adapter_id), None)
            if target is None:
                raise KeyError(f"adapter '{adapter_id}' is not registered")
            now = _utcnow_iso()
            for r in records:
                if r.purpose == target.purpose and r.status == "active":
                    r.status = "archived"      # rollback target
                    r.updated_at = now
            target.status = "active"
            target.updated_at = now
            self._write_all(records)
            return target

    def archive(self, adapter_id: str) -> AdapterRecord:
        """Mark an adapter `archived` (e.g. manual retire / rollback)."""
        with self._lock:
            records = self._read_all()
            target = next((r for r in records if r.adapter_id == adapter_id), None)
            if target is None:
                raise KeyError(f"adapter '{adapter_id}' is not registered")
            target.status = "archived"
            target.updated_at = _utcnow_iso()
            self._write_all(records)
            return target


def _dir_size_bytes(path: str) -> int:
    total = 0
    for root, _dirs, files in os.walk(path):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return total


# Process-wide default instance, convenient for the FastAPI server to import.
registry = AdapterRegistry()


if __name__ == "__main__":
    # Tiny smoke test / CLI: `python adapter_registry.py` prints current adapters.
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "demo":
        # Register a mock adapter so the registry is non-empty for local testing.
        registry.register(
            adapter_id="asta-tutor-llama31-8b-v1",
            base_model="meta-llama/Llama-3.1-8B-Instruct",
            version="1.0.0",
            path="./adapters/asta-tutor-llama31-8b-v1",
            purpose="tutor",
            metrics={"evalLoss": 0.81, "winRateVsBase": 0.63},
            lora_config={"r": 16, "lora_alpha": 32,
                         "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj"]},
            is_mock=True,
            activate=True,
        )
    for rec in registry.list():
        marker = "*" if rec.status == "active" else " "
        print(f"[{marker}] {rec.adapter_id:40s} {rec.purpose:12s} "
              f"{rec.status:10s} base={rec.base_model}")
