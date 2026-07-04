"""The offline pipeline orchestrator + CLI (ADR-0057). Per case it applies CONTRACT 1, builds the compact per-case
trace from the committed solver outputs (case-results.json) + the learned-model metrics (pit-learned.json, when
present), runs the lane gate, and writes the manifest + a flat index (CONTRACT 2). The committed case-results.json IS
the exact optimiser's real output (baked by the SAME TS solver the browser runs), so the DEFAULT path is light
(numpy/stdlib, no torch/node) and deterministic. `--retrain` regenerates the artifacts (bake case-results via the TS
solver; train the learned models torch → ONNX), see pflab/science/.

    python -m pflab.pipeline                 # rebuild all replay traces + manifests from committed artifacts
    python -m pflab.pipeline A01             # one case
    python -m pflab.pipeline all --retrain   # re-bake case-results + train the learned models, then rebuild
"""
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

from . import registry
from .core.manifest import build_index
from .io.contract import validate_records
from .io.formats import read_json, write_json
from .stages import export

REPO_ROOT = Path(__file__).resolve().parents[2]
DERIVED = REPO_ROOT / "data" / "derived"
MANIFESTS = DERIVED / "manifests"
SCIENCE = Path(__file__).resolve().parent / "science"


def _load_artifacts() -> tuple[dict, dict | None]:
    cr = DERIVED / "case-results.json"
    if not cr.exists():
        raise SystemExit(
            f"missing committed artifact {cr}. case-results.json is baked by the TS solver "
            f"(science/bake_cases.mjs), run `python -m pflab.pipeline all --retrain` (or `npm run bake` in frontend/)."
        )
    learned_path = DERIVED / "pit-learned.json"
    learned = read_json(learned_path) if learned_path.exists() else None  # learned models are optional until trained
    return read_json(cr), learned


def _contract_flags() -> list[dict]:
    """Apply CONTRACT 1 to the cases' design scenarios, proves the ingestion gate, carries the slope flags."""
    rows = [{"case_id": c.id, "archetype": c.archetype, "nx": c.nx, "ny": c.ny, "nz": c.nz, "price": c.price,
             "recovery": c.recovery, "mining_cost": c.mining_cost, "processing_cost": c.processing_cost,
             "slope_angle_deg": c.slope_angle_deg} for c in registry.list_cases()]
    return validate_records(rows).flagged


def precompute(case_id: str, seed: int = 42,
               artifacts: tuple[dict, dict | None] | None = None, flags: list[dict] | None = None) -> dict:
    case = registry.get_case(case_id)
    case_results, learned = artifacts if artifacts is not None else _load_artifacts()
    return export.build_replay(
        case, derived_dir=str(DERIVED), manifests_dir=str(MANIFESTS),
        case_results=case_results, learned=learned,
        contract_flags=(flags if flags is not None else _contract_flags()), seed=seed,
    )


def _node(*args: str) -> None:
    subprocess.run(["node", "--import", "tsx", *args], check=True, cwd=str(REPO_ROOT))


def retrain(seed: int = 42) -> None:
    """HEAVY lane (two-language): re-bake the exact solver outputs (the SAME TS optimiser) and train the learned models
    (torch → ONNX). The science is preserved verbatim in pflab/science/."""
    print("[retrain] bake case-results (TS exact ultimate-pit + Whittle shells over the cases) ...", flush=True)
    _node(str(SCIENCE / "bake_cases.mjs"))
    train = SCIENCE / "train_pit.py"
    if train.exists():
        print("[retrain] generate the learned-model training tables (the SAME TS engine) ...", flush=True)
        _node(str(SCIENCE / "gen_train.mjs"))
        print("[retrain] torch train the learned models (grade-nn + pit-surrogate) → ONNX ...", flush=True)
        # the heavy lane runs in the .venv-precompute (torch); fall back to the current interpreter.
        vp = REPO_ROOT / ".venv-precompute" / "Scripts" / "python.exe"
        py = str(vp) if vp.exists() else "python"
        subprocess.run([py, str(train)], check=True, cwd=str(REPO_ROOT))
    else:
        print("[retrain] (science/train_pit.py absent, learned models pending; traces record learned=pending)",
              flush=True)
    print(f"[retrain] artifacts -> {DERIVED}", flush=True)


def run_all(seed: int = 42) -> list[dict]:
    artifacts = _load_artifacts()
    flags = _contract_flags()
    entries = []
    for c in registry.list_cases():
        precompute(c.id, seed=seed, artifacts=artifacts, flags=flags)
        entries.append({"case_id": c.id, "category": c.category, "manifest_path": f"manifests/{c.id}.json"})
    write_json(MANIFESTS / "index.json", build_index(entries))
    return entries


def main() -> None:
    ap = argparse.ArgumentParser(prog="pflab.pipeline")
    ap.add_argument("case", nargs="?", default="all", help="a case id, or 'all'")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--retrain", action="store_true",
                    help="re-bake case-results (TS solver) + train the learned models (torch) before rebuilding")
    args = ap.parse_args()
    if args.retrain:
        retrain(args.seed)
    if args.case == "all":
        entries = run_all(args.seed)
        print(f"precomputed {len(entries)} cases -> {DERIVED}")
        for e in entries:
            print(f"  {e['case_id']:5s} [{e['category']}]")
        print(f"index -> {MANIFESTS / 'index.json'}")
    else:
        m = precompute(args.case, args.seed)
        print(f"precomputed {args.case}: lane={m['lane']} bytes={m['artifact']['bytes']} "
              f"metrics={m['metrics']} -> {DERIVED / m['artifact']['path']}")


if __name__ == "__main__":
    main()
