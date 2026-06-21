"""CONTRACT 2 — artifact (pipeline -> web). The manifest is the authoritative, versioned record of a baked case: its
category, seed, engine+version, the shared learned-model ONNX, the compact per-case trace pointer + byte size, the
lane/gate verdict, the CONTRACT-1 flags, and the case metrics. The web loads ONLY manifests + traces + the shared
artifacts; frontend/src/lib/contract.types.ts mirrors this schema so a drift fails the build. The committed
case-results.json (baked by the SAME TS solver the browser runs) IS the real output of the offline lane; the learned
models are honest — measured against their classical baselines (kriging/IDW; the exact solver), never a fabricated win."""
from __future__ import annotations

from typing import Any

from .. import __version__
from .trace import TRACE_SCHEMA

MANIFEST_SCHEMA = "pitforge.manifest/v2"
INDEX_SCHEMA = "pitforge.index/v1"

ENGINE_NOTE = ("exact ultimate-pit limit (Lerchs–Grossmann) via Picard max-closure → min-cut / max-flow (Dinic) + "
               "Whittle revenue-factor nested pit shells; the same TS solver runs live in the browser and in the "
               "offline Node bake.")
HONESTY = ("The deposits are SYNTHETIC (seeded), stated openly; CTRL is a closed-form analytic control. The optimiser "
           "is EXACT (the min-cut is the same one Hochbaum pseudoflow computes). The two learned models are framed "
           "against their classical baselines — the grade NN vs kriging/IDW, the pit-inclusion surrogate vs the exact "
           "solver — as fast approximations, never as beating the exact result.")


def shared_artifacts() -> dict:
    return {
        "models": [
            {"id": "grade-nn", "file": "grade-nn.onnx", "opset": 17, "kind": "NN grade estimator (vs kriging/IDW)"},
            {"id": "pit-surrogate", "file": "pit-surrogate.onnx", "opset": 17,
             "kind": "ultimate-pit inclusion surrogate (vs the exact solver)"},
        ],
        "learned_metrics": "pit-learned.json",
        "case_results": "case-results.json",
    }


def build_case_manifest(*, case: Any, seed: int, artifact_rel: str, trace_bytes: int,
                        gate: dict, flags: list[dict], metrics: dict) -> dict:
    return {
        "schema": MANIFEST_SCHEMA,
        "case_id": case.id,
        "name": case.name,
        "category": case.category,
        "real_or_synthetic": case.real_or_synthetic,
        "expected_band": case.expected_band,
        "validation_anchor": case.validation_anchor,
        "engine": {"package": "pflab", "version": __version__, "model": ENGINE_NOTE},
        "seed": seed,
        "shared": shared_artifacts(),
        "artifact": {"path": artifact_rel, "format": "json", "trace_schema": TRACE_SCHEMA, "bytes": trace_bytes},
        "lane": gate["lane"],
        "gate": gate,
        "flags": flags,
        "metrics": metrics,
        "honesty": HONESTY,
    }


def build_index(entries: list[dict]) -> dict:
    return {
        "schema": INDEX_SCHEMA,
        "engine_version": __version__,
        "n_cases": len(entries),
        "cases": sorted(entries, key=lambda e: e["case_id"]),
    }
