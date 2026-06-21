"""Stage 6 — export (CONTRACT 2): build the compact per-case trace from the committed solver outputs
(case-results.json, baked by the SAME TS optimiser the browser runs) + the learned-model metrics (pit-learned.json,
when trained), run the lane gate, and write the manifest. No torch/node — so the contract + replay regenerate
deterministically anywhere, and CI stays fast. The HEAVY export (baking case-results.json + training the ONNX) is done
by the preserved science (pflab/science/bake_cases.mjs + train_pit.py), invoked by pipeline.retrain."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from ..core.gate import classify_lane
from ..core.manifest import build_case_manifest
from ..core.trace import build_trace
from ..io.formats import write_json

_RUN_MS = 60.0   # a teaching-scale full solve + nested shells — tens of ms; deterministic gate budget
_RUNTIMES = {"ts-pseudoflow", "onnxruntime-web"}


def _case_metrics(case_result: dict, learned: dict | None) -> dict:
    u = case_result.get("ultimate", {}) or {}
    m = {
        "pit_value": float(u.get("pitValue", 0.0)),
        "ore_tonnes": float(u.get("oreTonnes", 0.0)),
        "strip_ratio": float(u.get("stripRatio", 0.0)),
        "n_blocks": float(u.get("nBlocks", 0.0)),
        "n_shells": float(len(case_result.get("curve", []))),
    }
    if learned:
        gnn = (learned.get("gradeNN") or {})
        ps = (learned.get("pitSurrogate") or {})
        m["grade_nn_r2"] = float(gnn.get("r2_vs_holdout", 0.0))
        m["pit_surrogate_auc"] = float(ps.get("auc", 0.0))
    return m


def build_replay(case: Any, *, derived_dir: str, manifests_dir: str,
                 case_results: dict, learned: dict | None, contract_flags: list[dict], seed: int) -> dict:
    cr = case_results["cases"][case.id]
    trace = build_trace(case, case_result=cr, learned=learned)
    artifact_rel = f"{case.id}/trace.json"
    trace_bytes = write_json(Path(derived_dir) / artifact_rel, trace)
    gate = classify_lane(client_side=True, runtimes=_RUNTIMES, run_ms=_RUN_MS, trace_bytes=trace_bytes)
    manifest = build_case_manifest(
        case=case, seed=seed, artifact_rel=artifact_rel, trace_bytes=trace_bytes,
        gate=gate, flags=contract_flags, metrics=_case_metrics(cr, learned),
    )
    write_json(Path(manifests_dir) / f"{case.id}.json", manifest)
    return manifest
