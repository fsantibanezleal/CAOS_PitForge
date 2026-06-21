"""CONTRACT 1 (ingestion) tests: good scenarios + block rows validate; ill-formed ones are rejected with a reason;
unusual slopes / rich grades are flagged; the committed examples pass."""
from pathlib import Path

from pflab.io.contract import validate_blocks, validate_records
from pflab.io.formats import read_csv_rows


def test_good_scenario_accepted():
    rep = validate_records([{"case_id": "c", "archetype": "porphyry", "nx": 24, "ny": 24, "nz": 12,
                             "price": 9000, "recovery": 0.88, "mining_cost": 2.5, "processing_cost": 9.0,
                             "slope_angle_deg": 45}])
    assert rep.ok and len(rep.accepted) == 1 and not rep.rejected
    assert rep.accepted[0].archetype == "porphyry"


def test_bad_scenarios_rejected_not_coerced():
    rows = [
        {"case_id": "a", "archetype": "diamond", "nx": 24, "ny": 24, "nz": 12, "price": 9000, "recovery": 0.88,
         "mining_cost": 2.5, "processing_cost": 9.0, "slope_angle_deg": 45},                 # bad archetype
        {"case_id": "b", "archetype": "porphyry", "nx": 0, "ny": 24, "nz": 12, "price": 9000, "recovery": 0.88,
         "mining_cost": 2.5, "processing_cost": 9.0, "slope_angle_deg": 45},                 # nx=0
        {"case_id": "c", "archetype": "porphyry", "nx": 24, "ny": 24, "nz": 12, "price": "lots", "recovery": 0.88,
         "mining_cost": 2.5, "processing_cost": 9.0, "slope_angle_deg": 45},                 # non-numeric price
        {"case_id": "d", "archetype": "porphyry", "nx": 24, "ny": 24, "nz": 12, "price": 9000, "recovery": 5,
         "mining_cost": 2.5, "processing_cost": 9.0, "slope_angle_deg": 45},                 # recovery > 1
        {"case_id": "e", "archetype": "porphyry", "nx": 24, "ny": 24, "nz": 12, "price": 9000, "recovery": 0.88,
         "mining_cost": 2.5, "processing_cost": 9.0},                                         # missing slope
    ]
    rep = validate_records(rows)
    assert len(rep.accepted) == 0 and len(rep.rejected) == len(rows)
    assert all("reason" in r for r in rep.rejected)


def test_unusual_slope_flagged():
    rep = validate_records([{"case_id": "flat", "archetype": "porphyry", "nx": 24, "ny": 24, "nz": 12, "price": 9000,
                             "recovery": 0.88, "mining_cost": 2.5, "processing_cost": 9.0, "slope_angle_deg": 18}])
    assert rep.ok and rep.flagged and "slope" in " ".join(rep.flagged[0]["flags"])


def test_block_contract_rejects_unphysical_and_flags_rich():
    rows = [
        {"ix": 0, "iy": 0, "iz": 0, "tonnage": 2700, "density": 2.7, "grade": 0.01},   # good
        {"ix": 1, "iy": 0, "iz": 0, "tonnage": -5, "density": 2.7, "grade": 0.01},      # neg tonnage -> reject
        {"ix": 2, "iy": 0, "iz": 0, "tonnage": 2700, "density": 2.7, "grade": 1.5},     # grade > 1 -> reject
        {"ix": 3, "iy": 0, "iz": 0, "tonnage": 2700, "density": 2.7, "grade": 0.7},     # rich grade -> flag (accepted)
    ]
    rep = validate_blocks(rows, dims=(24, 24, 12))
    assert len(rep.accepted) == 2 and len(rep.rejected) == 2 and rep.flagged


def test_committed_examples_pass_contract():
    root = Path(__file__).resolve().parents[1] / "data" / "examples"
    rep_s = validate_records(read_csv_rows(root / "scenarios.csv"))
    assert rep_s.ok and not rep_s.rejected, f"scenarios.csv should pass Contract 1: {rep_s.summary()}"
    rep_b = validate_blocks(read_csv_rows(root / "blockmodel.csv"))
    assert rep_b.ok and not rep_b.rejected, f"blockmodel.csv should pass Contract 1: {rep_b.summary()}"
