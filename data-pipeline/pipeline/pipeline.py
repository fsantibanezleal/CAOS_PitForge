"""The offline pipeline orchestrator + CLI (ADR-0057). Per case it applies Contract 1, builds the compact per-case
trace from the committed solver outputs (case-results.json) + the learned-model metrics (pit-learned.json, when
present), runs the lane gate, and writes the manifest + a flat index (Contract 2). The committed case-results.json is
the exact optimiser's real output (baked by the SAME TS solver the browser runs), so the DEFAULT path is light
(numpy/stdlib, no torch/node) and deterministic. `--retrain` regenerates the artifacts (bake case-results via the TS
solver; train the learned models torch → ONNX), see pipeline/science/.

    python data-pipeline/run.py                 # rebuild all replay traces + manifests from committed artifacts
    python data-pipeline/run.py A01             # one case
    python data-pipeline/run.py all --retrain   # re-bake case-results + train the learned models, then rebuild
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import tempfile
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


def _load_artifacts() -> tuple[dict, dict | None, dict]:
    cr = DERIVED / "case-results.json"
    if not cr.exists():
        raise SystemExit(
            f"missing committed artifact {cr}. case-results.json is baked by the TS solver "
            f"(science/bake_cases.mjs), run `python data-pipeline/run.py all --retrain` (or `npm run bake` in frontend/)."
        )
    learned_path = DERIVED / "pit-learned.json"
    learned = read_json(learned_path) if learned_path.exists() else None  # learned models are optional until trained
    runtime_path = DERIVED / "runtime-benchmarks.json"
    if not runtime_path.exists():
        raise SystemExit(f"missing runtime evidence {runtime_path}; run `npm run benchmark` in frontend/")
    return read_json(cr), learned, read_json(runtime_path)


def _contract_flags() -> list[dict]:
    """Apply Contract 1 to every registered scenario and fail before writing if any row is rejected."""
    rows = [{"case_id": c.id, "archetype": c.archetype, "nx": c.nx, "ny": c.ny, "nz": c.nz, "price": c.price,
             "recovery": c.recovery, "mining_cost": c.mining_cost, "processing_cost": c.processing_cost,
             "slope_angle_deg": c.slope_angle_deg} for c in registry.list_cases()]
    report = validate_records(rows)
    if report.rejected:
        details = "; ".join(f"{item.get('case_id')}: {item['reason']}" for item in report.rejected)
        raise ValueError(f"Contract 1 rejected {len(report.rejected)} registered case(s): {details}")
    if len(report.accepted) != len(rows):
        raise ValueError(f"Contract 1 accepted {len(report.accepted)} of {len(rows)} registered cases")
    return report.flagged


def precompute(case_id: str, seed: int = 42,
               artifacts: tuple[dict, dict | None, dict] | None = None, flags: list[dict] | None = None,
               *, derived_dir: Path | None = None, manifests_dir: Path | None = None) -> dict:
    case = registry.get_case(case_id)
    case_results, learned, runtime_benchmarks = artifacts if artifacts is not None else _load_artifacts()
    out_derived = derived_dir or DERIVED
    out_manifests = manifests_dir or MANIFESTS
    return export.build_replay(
        case, derived_dir=str(out_derived), manifests_dir=str(out_manifests),
        case_results=case_results, learned=learned, runtime_benchmarks=runtime_benchmarks,
        contract_flags=(flags if flags is not None else _contract_flags()), seed=seed,
    )


def _node(*args: str) -> None:
    subprocess.run(["node", "--import", "tsx", *args], check=True, cwd=str(REPO_ROOT))


def retrain(seed: int = 42) -> None:
    """Heavy lane (two-language): re-bake the exact solver outputs (the same TS optimiser) and train the learned models
    (torch → ONNX). The science is preserved verbatim in pipeline/science/."""
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


def _publish_staged_contract(staged: Path, case_ids: set[str]) -> None:
    """Publish a fully built Contract-2 tree and remove stale case records.

    All generation happens in a temporary directory first, so a validation or case failure cannot partly rewrite
    the canonical index/traces. The short publication phase runs only after every case and the index exist.
    """
    staged_manifests = staged / "manifests"
    for path in DERIVED.iterdir():
        if path.is_dir() and path.name != "manifests" and (path / "trace.json").exists() and path.name not in case_ids:
            shutil.rmtree(path)
    for case_id in case_ids:
        destination = DERIVED / case_id
        if destination.exists():
            shutil.rmtree(destination)
        shutil.copytree(staged / case_id, destination)
    if MANIFESTS.exists():
        shutil.rmtree(MANIFESTS)
    shutil.copytree(staged_manifests, MANIFESTS)


def run_all(seed: int = 42, *, publish: bool = True, output_dir: Path | None = None) -> list[dict]:
    artifacts = _load_artifacts()
    flags = _contract_flags()
    cases = registry.list_cases()
    if output_dir is not None:
        staging_root = output_dir
        staging_root.mkdir(parents=True, exist_ok=True)
        cleanup = None
    else:
        cleanup = tempfile.TemporaryDirectory(prefix="pitforge-contract-")
        staging_root = Path(cleanup.name)
    staged_manifests = staging_root / "manifests"
    try:
        entries = []
        for case in cases:
            precompute(
                case.id,
                seed=seed,
                artifacts=artifacts,
                flags=flags,
                derived_dir=staging_root,
                manifests_dir=staged_manifests,
            )
            entries.append({"case_id": case.id, "category": case.category,
                            "manifest_path": f"manifests/{case.id}.json"})
        write_json(staged_manifests / "index.json", build_index(entries))
        if publish:
            _publish_staged_contract(staging_root, {case.id for case in cases})
        return entries
    finally:
        if cleanup is not None:
            cleanup.cleanup()


def main() -> None:
    ap = argparse.ArgumentParser(prog="pipeline.pipeline")
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
