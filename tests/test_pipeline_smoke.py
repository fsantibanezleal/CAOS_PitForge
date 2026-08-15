"""Pipeline smoke + determinism: a case regenerates deterministically (same seed -> identical trace), run_all writes
the flat index covering every category."""
import json
from copy import deepcopy
from dataclasses import replace

import pytest

from pipeline import pipeline, registry


def test_case_deterministic_same_seed(tmp_path):
    derived = tmp_path / "derived"
    manifests = derived / "manifests"
    a = pipeline.precompute("A04", seed=7, derived_dir=derived, manifests_dir=manifests)
    first = (derived / a["artifact"]["path"]).read_bytes()
    b = pipeline.precompute("A04", seed=7, derived_dir=derived, manifests_dir=manifests)
    assert a["artifact"]["bytes"] == b["artifact"]["bytes"]
    assert (derived / b["artifact"]["path"]).read_bytes() == first
    trace = json.loads((derived / a["artifact"]["path"]).read_text(encoding="utf-8"))
    assert trace["category"].startswith("deposit archetype")
    assert len(trace["curve"]) >= 8   # the Whittle nested-shell curve is present


def test_run_all_writes_index(tmp_path):
    derived = tmp_path / "derived"
    entries = pipeline.run_all(seed=42, publish=False, output_dir=derived)
    assert len(entries) == len(registry.list_cases()) == 9
    idx = json.loads((derived / "manifests" / "index.json").read_text(encoding="utf-8"))
    assert idx["n_cases"] == len(entries)
    assert idx["schema"].startswith("pitforge.index/")
    cats = {e["category"] for e in idx["cases"]}
    assert cats == set(registry.list_categories())


def test_contract_rejection_aborts_before_output(tmp_path, monkeypatch):
    cases = registry.list_cases()
    broken = replace(cases[0], archetype="not-an-archetype")
    monkeypatch.setattr(registry, "list_cases", lambda: [broken, *cases[1:]])
    output = tmp_path / "contract"
    with pytest.raises(ValueError, match="Contract 1 rejected"):
        pipeline.run_all(publish=False, output_dir=output)
    assert not output.exists()


def test_partial_generation_cannot_rewrite_canonical_index(monkeypatch):
    case_results, learned, runtime = pipeline._load_artifacts()
    broken = deepcopy(case_results)
    del broken["cases"]["A03"]
    monkeypatch.setattr(pipeline, "_load_artifacts", lambda: (broken, learned, runtime))
    before = (pipeline.MANIFESTS / "index.json").read_bytes()
    with pytest.raises(KeyError):
        pipeline.run_all()
    assert (pipeline.MANIFESTS / "index.json").read_bytes() == before
