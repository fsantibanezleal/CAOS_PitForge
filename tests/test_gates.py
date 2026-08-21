"""Every gate must be able to FAIL.

The 2026-08-18 audit found that no test proved any gate could fail, which is how a gate ends up
measuring the wrong subject and passing forever. Each test here corrupts a COPY of the repository
state, runs the real gate against it, and asserts a non-zero exit. If a gate is ever weakened into
a no-op, the corresponding test here goes red.

The gates are run as subprocesses against a temporary ROOT so nothing here can write to the
committed artifacts (see the standing rule that tests must never write canonical files).
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def _sandbox(tmp_path: Path) -> Path:
    """A minimal copy of the repo: the gates only read these trees."""
    dest = tmp_path / "repo"
    (dest / "scripts").mkdir(parents=True)
    for name in (
        "check_artifacts.py",
        "check_headline_artifacts.py",
        "check_version_coherence.py",
        "check_docs_links.py",
    ):
        shutil.copy2(ROOT / "scripts" / name, dest / "scripts" / name)
    for tree in ("data", "docs", "data-pipeline"):
        shutil.copytree(ROOT / tree, dest / tree)
    (dest / "frontend").mkdir()
    shutil.copy2(ROOT / "frontend" / "package.json", dest / "frontend" / "package.json")
    (dest / "frontend" / "src").mkdir()
    shutil.copy2(ROOT / "frontend" / "src" / "main.tsx", dest / "frontend" / "src" / "main.tsx")
    for name in ("README.md", "CHANGELOG.md", "VERSION"):
        shutil.copy2(ROOT / name, dest / name)
    return dest


def _run(root: Path, gate: str) -> int:
    return subprocess.run(
        [sys.executable, str(root / "scripts" / gate)],
        capture_output=True,
        text=True,
        cwd=root,
    ).returncode


def _write_json(path: Path, mutate) -> None:
    doc = json.loads(path.read_text(encoding="utf-8"))
    mutate(doc)
    path.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")


def test_gates_pass_on_the_untouched_tree(tmp_path):
    root = _sandbox(tmp_path)
    for gate in ("check_artifacts.py", "check_headline_artifacts.py", "check_version_coherence.py"):
        assert _run(root, gate) == 0, f"{gate} should pass on an untouched tree"


def test_headline_gate_fails_when_the_published_scenario_disappears(tmp_path):
    """The exact failure mode gen_cpit.py used to produce silently."""
    root = _sandbox(tmp_path)
    _write_json(root / "data/derived/cpit-schedule.json", lambda d: d["cases"].pop("newman1"))
    assert _run(root, "check_headline_artifacts.py") != 0


def test_headline_gate_fails_when_a_gap_drifts_from_the_prose(tmp_path):
    root = _sandbox(tmp_path)
    _write_json(
        root / "data/derived/cpit-schedule.json",
        lambda d: d["cases"]["newman1"].__setitem__("boundToFeasibleGapPct", 7.77),
    )
    assert _run(root, "check_headline_artifacts.py") != 0


def test_headline_gate_fails_when_a_minelib_relerror_exceeds_the_claim(tmp_path):
    root = _sandbox(tmp_path)
    _write_json(
        root / "data/derived/minelib-results.json",
        lambda d: d["results"][0].__setitem__("relError", 1e-3),
    )
    assert _run(root, "check_headline_artifacts.py") != 0


def test_headline_gate_fails_when_the_twin_is_not_flagged_non_comparable(tmp_path):
    """Mixing the synthetic twin with the published scenario is the error the gate exists for."""
    root = _sandbox(tmp_path)
    _write_json(
        root / "data/derived/cpit-schedule.json",
        lambda d: d["cases"]["twin-porphyry-s"]["scenario"].__setitem__(
            "comparableToPublishedMineLibCpit", True
        ),
    )
    assert _run(root, "check_headline_artifacts.py") != 0


def test_contract_gate_fails_when_a_declared_case_is_not_shipped(tmp_path):
    """DECLARED vs SHIPPED: removing a case from the index AND disk used to print OK."""
    root = _sandbox(tmp_path)
    index_path = root / "data/derived/manifests/index.json"
    index = json.loads(index_path.read_text(encoding="utf-8"))
    dropped = index["cases"].pop()
    index["n_cases"] = len(index["cases"])
    index_path.write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    case_id = dropped["case_id"] if isinstance(dropped, dict) else dropped
    shutil.rmtree(root / "data/derived" / case_id, ignore_errors=True)
    (root / "data/derived/manifests" / f"{case_id}.json").unlink(missing_ok=True)
    assert _run(root, "check_artifacts.py") != 0


def test_version_gate_fails_on_a_real_divergence(tmp_path):
    root = _sandbox(tmp_path)
    (root / "VERSION").write_text("0.14.000\n", encoding="utf-8")
    assert _run(root, "check_version_coherence.py") != 0


def test_version_gate_accepts_the_padded_and_semver_spellings(tmp_path):
    """0.13.001 and 0.13.1 are the same version; the convention requires both spellings to coexist."""
    root = _sandbox(tmp_path)
    package = json.loads((root / "frontend/package.json").read_text(encoding="utf-8"))
    assert "." in package["version"]
    (root / "VERSION").write_text(package["version"] + "\n", encoding="utf-8")
    assert _run(root, "check_version_coherence.py") == 0


def test_version_gate_fails_when_the_version_file_is_missing(tmp_path):
    root = _sandbox(tmp_path)
    (root / "VERSION").unlink()
    assert _run(root, "check_version_coherence.py") != 0


@pytest.mark.parametrize("target", ["docs/cases.md", "docs/frameworks.md"])
def test_docs_gate_fails_on_a_link_that_escapes_the_repository(tmp_path, target):
    """A public repo must never link into the private management repo."""
    root = _sandbox(tmp_path)
    path = root / target
    path.write_text(
        path.read_text(encoding="utf-8") + "\n[escape](../../conventions/architecture/ADR-0057.md)\n",
        encoding="utf-8",
    )
    assert _run(root, "check_docs_links.py") != 0
