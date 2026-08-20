"""Validate Contract 2 as a closed, two-way inventory.

The checker rejects missing shared artifacts, undeclared traces/manifests, identity/schema/version drift, unsafe
paths, stale byte counts, cross-case flags, and lane verdicts without runtime evidence. It uses only the standard
library so the same gate runs before dependency installation, in CI, and in deployment.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]


def _norm_version(value):
    """Compare the padded display form (0.13.001) and the semver manifest form (0.13.1) as equal.

    conventions/versioning.md splits them deliberately; comparing raw strings makes the two rules
    mutually unsatisfiable. See scripts/check_version_coherence.py for the same normalisation.
    """
    if value is None:
        return None
    parts = str(value).strip().lstrip("v").split(".")
    try:
        return ".".join(str(int(part)) for part in parts)
    except ValueError:
        return str(value).strip()


def _json(path: Path, errors: list[str]) -> Any | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        errors.append(f"missing JSON: {path}")
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"invalid JSON {path}: {exc}")
    return None


def _safe_child(root: Path, relative: object, label: str, errors: list[str]) -> Path | None:
    if not isinstance(relative, str) or not relative:
        errors.append(f"{label} must be a non-empty relative path")
        return None
    candidate = (root / relative).resolve()
    if not candidate.is_relative_to(root.resolve()):
        errors.append(f"{label} escapes {root}: {relative}")
        return None
    return candidate


def validate(root: Path = ROOT) -> list[str]:
    """Return every Contract-2 error found under ``root``; an empty list means the tree is valid."""
    errors: list[str] = []
    derived = root / "data" / "derived"
    manifests = derived / "manifests"
    index = _json(manifests / "index.json", errors)
    if not isinstance(index, dict):
        return errors
    if index.get("schema") != "pitforge.index/v1":
        errors.append(f"index schema drift: {index.get('schema')!r}")
    entries = index.get("cases")
    if not isinstance(entries, list):
        errors.append("index cases must be a list")
        return errors

    case_ids = [entry.get("case_id") for entry in entries if isinstance(entry, dict)]
    if len(case_ids) != len(entries) or any(not isinstance(case_id, str) or not case_id for case_id in case_ids):
        errors.append("every index entry must have a non-empty string case_id")
        return errors
    if len(set(case_ids)) != len(case_ids):
        errors.append("duplicate case_id in index")
    expected = set(case_ids)
    if index.get("n_cases") != len(entries):
        errors.append(f"index n_cases={index.get('n_cases')} but contains {len(entries)} entries")

    actual_manifests = {p.stem for p in manifests.glob("*.json") if p.name != "index.json"}
    actual_traces = {p.parent.name for p in derived.glob("*/trace.json") if p.parent.name != "manifests"}
    if actual_manifests != expected:
        errors.append(f"manifest inventory drift: missing={sorted(expected - actual_manifests)}, "
                      f"orphan={sorted(actual_manifests - expected)}")
    if actual_traces != expected:
        errors.append(f"trace inventory drift: missing={sorted(expected - actual_traces)}, "
                      f"orphan={sorted(actual_traces - expected)}")

    package = _json(root / "frontend" / "package.json", errors)
    product_version = package.get("version") if isinstance(package, dict) else None
    if product_version and _norm_version(index.get("engine_version")) != _norm_version(product_version):
        errors.append(f"index engine_version={index.get('engine_version')!r}, product={product_version!r}")

    shared_signature: str | None = None
    for entry in entries:
        case_id = entry["case_id"]
        expected_manifest_path = f"manifests/{case_id}.json"
        if entry.get("manifest_path") != expected_manifest_path:
            errors.append(f"{case_id}: manifest_path must be {expected_manifest_path!r}")
        manifest_path = _safe_child(derived, entry.get("manifest_path"), f"{case_id} manifest_path", errors)
        manifest = _json(manifest_path, errors) if manifest_path else None
        if not isinstance(manifest, dict):
            continue
        if manifest.get("schema") != "pitforge.manifest/v2":
            errors.append(f"{case_id}: manifest schema drift: {manifest.get('schema')!r}")
        if manifest.get("case_id") != case_id:
            errors.append(f"{case_id}: manifest identity is {manifest.get('case_id')!r}")
        if _norm_version(manifest.get("engine", {}).get("version")) != _norm_version(product_version):
            errors.append(f"{case_id}: engine version does not match product {product_version!r}")

        artifact = manifest.get("artifact")
        if not isinstance(artifact, dict):
            errors.append(f"{case_id}: artifact must be an object")
            continue
        trace_path = _safe_child(derived, artifact.get("path"), f"{case_id} artifact.path", errors)
        if trace_path and trace_path != (derived / case_id / "trace.json").resolve():
            errors.append(f"{case_id}: trace path must be {case_id}/trace.json")
        if trace_path and trace_path.exists():
            size = trace_path.stat().st_size
            if size == 0:
                errors.append(f"{case_id}: empty trace")
            if size != artifact.get("bytes"):
                errors.append(f"{case_id}: byte drift, manifest={artifact.get('bytes')} disk={size}")
            trace = _json(trace_path, errors)
            if isinstance(trace, dict):
                if trace.get("schema") != artifact.get("trace_schema") or trace.get("schema") != "pitforge.trace/v1":
                    errors.append(f"{case_id}: trace schema drift")
                if trace.get("case_id") != case_id:
                    errors.append(f"{case_id}: trace identity is {trace.get('case_id')!r}")
                learned = trace.get("learned", {})
                if learned.get("scope") != "corpus" or learned.get("source") != "pit-learned.json":
                    errors.append(f"{case_id}: learned metrics must declare corpus scope and source")
        elif trace_path:
            errors.append(f"{case_id}: missing trace {trace_path}")

        gate = manifest.get("gate", {})
        if manifest.get("lane") != gate.get("lane"):
            errors.append(f"{case_id}: lane/gate mismatch")
        if not isinstance(gate.get("measured_run_ms"), (int, float)) or not gate.get("measurement_source"):
            errors.append(f"{case_id}: lane verdict lacks measured runtime evidence")
        for flag in manifest.get("flags", []):
            if not isinstance(flag, dict) or flag.get("case_id") != case_id:
                errors.append(f"{case_id}: contains a flag for another case")
        if any(key in manifest.get("metrics", {}) for key in ("grade_nn_r2", "pit_surrogate_auc")):
            errors.append(f"{case_id}: corpus learned metrics are mislabeled as per-case metrics")

        shared = manifest.get("shared")
        if not isinstance(shared, dict):
            errors.append(f"{case_id}: shared must be an object")
            continue
        signature = json.dumps(shared, sort_keys=True, separators=(",", ":"))
        if shared_signature is None:
            shared_signature = signature
        elif signature != shared_signature:
            errors.append(f"{case_id}: shared artifact declaration differs across manifests")
        shared_paths: list[object] = [shared.get("learned_metrics"), shared.get("case_results"),
                                      shared.get("runtime_benchmarks")]
        models = shared.get("models")
        if not isinstance(models, list) or not models:
            errors.append(f"{case_id}: shared.models must be a non-empty list")
        else:
            shared_paths.extend(model.get("file") for model in models if isinstance(model, dict))
        for relative in shared_paths:
            shared_path = _safe_child(derived, relative, f"{case_id} shared artifact", errors)
            if shared_path and (not shared_path.is_file() or shared_path.stat().st_size == 0):
                errors.append(f"{case_id}: missing or empty shared artifact {relative!r}")
    return errors


def main() -> int:
    errors = validate()
    if errors:
        print("CONTRACT 2 DRIFT:")
        for error in errors:
            print("  -", error)
        return 1
    index = json.loads((ROOT / "data" / "derived" / "manifests" / "index.json").read_text(encoding="utf-8"))
    print(f"CONTRACT 2 OK: {index['n_cases']} cases, closed inventory and shared artifacts verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
