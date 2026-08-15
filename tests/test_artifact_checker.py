"""Adversarial regression tests for the closed Contract-2 inventory."""
from __future__ import annotations

import importlib.util
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("check_artifacts", ROOT / "scripts" / "check_artifacts.py")
assert SPEC and SPEC.loader
CHECKER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECKER)


def _contract_tree(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    shutil.copytree(ROOT / "data" / "derived", root / "data" / "derived")
    (root / "frontend").mkdir(parents=True)
    shutil.copy2(ROOT / "frontend" / "package.json", root / "frontend" / "package.json")
    return root


def test_committed_contract_is_closed():
    assert CHECKER.validate(ROOT) == []


def test_checker_rejects_missing_shared_artifact(tmp_path):
    root = _contract_tree(tmp_path)
    (root / "data" / "derived" / "grade-nn.onnx").unlink()
    assert any("shared artifact" in error for error in CHECKER.validate(root))


def test_checker_rejects_orphan_and_cross_case_flag(tmp_path):
    root = _contract_tree(tmp_path)
    orphan = root / "data" / "derived" / "ORPHAN"
    orphan.mkdir()
    (orphan / "trace.json").write_text("{}", encoding="utf-8")
    manifest_path = root / "data" / "derived" / "manifests" / "CTRL.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["flags"] = [{"case_id": "G02", "flags": ["wrong case"]}]
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    errors = CHECKER.validate(root)
    assert any("orphan" in error for error in errors)
    assert any("flag for another case" in error for error in errors)
