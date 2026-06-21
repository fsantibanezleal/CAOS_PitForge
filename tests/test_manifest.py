"""CONTRACT 2 (artifact) tests: a manifest points to a real trace with the recorded byte size, the lane verdict is
consistent with the gate, and the schema is the PitForge one. Uses the committed case-results.json (no torch/node)."""
import json

from pflab import pipeline


def test_manifest_matches_artifact_and_gate():
    m = pipeline.precompute("A01", seed=7)
    artifact = pipeline.DERIVED / m["artifact"]["path"]
    assert artifact.exists() and artifact.stat().st_size == m["artifact"]["bytes"]
    assert m["schema"].startswith("pitforge.manifest/")
    assert m["lane"] == m["gate"]["lane"] == "live", f"expected live, got {m['lane']} ({m['gate']['reasons']})"
    assert m["category"].startswith("deposit archetype")


def test_oracle_case_trace_is_the_inverted_pyramid():
    m = pipeline.precompute("CTRL", seed=7)
    trace = json.loads((pipeline.DERIVED / m["artifact"]["path"]).read_text(encoding="utf-8"))
    # the closed-form control: value = 10 − 8 = 2, exactly 9 blocks in the pit.
    assert trace["ultimate"]["pitValue"] == 2
    assert trace["ultimate"]["nBlocks"] == 9
    assert trace["spec"]["dims"] == {"nx": 5, "ny": 1, "nz": 3}
