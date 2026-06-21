"""The compact per-case TRACE = the web-replay artifact. Part of CONTRACT 2: its shape is mirrored by
frontend/src/lib/contract.types.ts, so a drift fails the web build. Each trace is built deterministically from the
committed solver outputs (case-results.json, produced by the SAME TS engine the browser runs) + the learned-model
metrics (pit-learned.json, when present). It carries the case SPEC so the browser can re-solve LIVE, the Whittle
curve, the ultimate-pit summary, and a vertical cross-section for an instant 2-D preview. It references the shared
ONNX models, never copies them."""
from __future__ import annotations

from typing import Any


TRACE_SCHEMA = "pitforge.trace/v1"


def _learned_block(learned: dict | None) -> dict:
    if not learned:
        return {"status": "pending-training", "gradeNN": None, "pitSurrogate": None}
    return {
        "status": "trained",
        "gradeNN": learned.get("gradeNN"),          # {r2_vs_holdout, r2_idw, r2_ok, nTrain, nEval}
        "pitSurrogate": learned.get("pitSurrogate"),  # {auc, acc, baseline, nTrain, nEval}
    }


def build_trace(case: Any, *, case_result: dict, learned: dict | None) -> dict:
    return {
        "schema": TRACE_SCHEMA,
        "case_id": case.id,
        "name": case.name,
        "category": case.category,
        "real_or_synthetic": case.real_or_synthetic,
        "expected_band": case.expected_band,
        "spec": {
            "archetype": case_result.get("archetype"),
            "seed": case_result.get("seed"),
            "dims": case_result.get("dims"),
            "block": case_result.get("block"),
            "econ": case_result.get("econ"),
        },
        "ultimate": case_result.get("ultimate"),       # {pitValue, oreTonnes, wasteTonnes, metalTonnes, stripRatio, nBlocks}
        "curve": case_result.get("curve", []),         # the Whittle nested-shell curve (per revenue factor)
        "section": case_result.get("section"),         # {iy, nx, nz, shellOf[][]} — a vertical cross-section
        "grade_stats": case_result.get("gradeStats"),
        "learned": _learned_block(learned),
    }
