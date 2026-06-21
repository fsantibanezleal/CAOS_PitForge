"""CONTRACT 1 — ingestion (raw -> pipeline). The *bring-your-own-orebody* gate.

Two entry points, one policy:

* ``validate_records`` — validates SCENARIO rows (one per case: archetype, grid, economics, slope). This is what the
  pipeline runs over the case set; it proves the gate and carries flags into the manifest.
* ``validate_blocks`` — validates a real block-model table (one row per BLOCK: ix,iy,iz, tonnage, density, grade).
  This is the path that lets PitForge open a NEW deposit instead of only replaying the baked cases.

A row is ACCEPTED iff it passes; ill-formed rows are REJECTED with a reason (never silently coerced); plausible-but-
extreme rows are FLAGGED (accepted; the flag travels into the manifest). Documented in data/README.md.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from .schema import ARCHETYPES, PitScenario

# ---- scenario-level schema (one row per case) ----------------------------------------------------------------
REQUIRED_COLUMNS: tuple[str, ...] = (
    "case_id", "archetype", "nx", "ny", "nz", "price", "recovery", "mining_cost", "processing_cost", "slope_angle_deg",
)
VALID_ARCHETYPES: frozenset[str] = frozenset(ARCHETYPES)
GRID_RANGE = (1, 200)              # blocks per axis
PRICE_RANGE = (1.0, 1e6)          # $/t metal
RECOVERY_RANGE = (0.01, 1.0)
COST_RANGE = (0.0, 1e5)           # $/t
SLOPE_RANGE = (10.0, 89.0)        # degrees from horizontal
SLOPE_FLAG_LO, SLOPE_FLAG_HI = 25.0, 75.0   # outside this band the discrete cone is coarse / the wall is unusual

# ---- block-level schema (one row per block) ------------------------------------------------------------------
BLOCK_COLUMNS: tuple[str, ...] = ("ix", "iy", "iz", "tonnage", "density", "grade")
GRADE_PHYSICAL_MAX = 1.0          # grade is a mass fraction; > this is unphysical => REJECT
GRADE_FLAG_MAX = 0.5              # a > 50 % grade is implausible for a bulk metal => FLAG


@dataclass
class ContractReport:
    accepted: list
    rejected: list[dict[str, Any]]
    flagged: list[dict[str, Any]]

    @property
    def ok(self) -> bool:
        return len(self.accepted) > 0

    def summary(self) -> str:
        return f"{len(self.accepted)} accepted, {len(self.rejected)} rejected, {len(self.flagged)} flagged"


def validate_records(raw_rows: list[dict[str, Any]]) -> ContractReport:
    """Apply CONTRACT 1 to raw scenario rows (e.g. from a CSV). Pure; deterministic; no I/O."""
    accepted: list[PitScenario] = []
    rejected: list[dict[str, Any]] = []
    flagged: list[dict[str, Any]] = []

    for i, row in enumerate(raw_rows):
        cid = str(row.get("case_id", f"row{i}"))
        missing = [c for c in REQUIRED_COLUMNS if c not in row or row[c] in (None, "")]
        if missing:
            rejected.append({"row": i, "case_id": cid, "reason": f"missing/empty columns: {missing}"})
            continue
        try:
            nx, ny, nz = (int(float(row["nx"])), int(float(row["ny"])), int(float(row["nz"])))
            price = float(row["price"])
            recovery = float(row["recovery"])
            mining = float(row["mining_cost"])
            proc = float(row["processing_cost"])
            slope = float(row["slope_angle_deg"])
        except (TypeError, ValueError):
            rejected.append({"row": i, "case_id": cid, "reason": "non-numeric numeric field"})
            continue
        arch = str(row["archetype"])

        bad: list[str] = []
        for name, val, rng in (("nx", nx, GRID_RANGE), ("ny", ny, GRID_RANGE), ("nz", nz, GRID_RANGE),
                               ("price", price, PRICE_RANGE), ("recovery", recovery, RECOVERY_RANGE),
                               ("mining_cost", mining, COST_RANGE), ("processing_cost", proc, COST_RANGE),
                               ("slope_angle_deg", slope, SLOPE_RANGE)):
            if not (rng[0] <= val <= rng[1]):
                bad.append(f"{name}={val:g} out of [{rng[0]:g},{rng[1]:g}]")
        if arch not in VALID_ARCHETYPES:
            bad.append(f"archetype={arch!r} not in {sorted(VALID_ARCHETYPES)}")
        if any(math.isnan(v) or math.isinf(v) for v in (price, recovery, mining, proc, slope)):
            bad.append("NaN/Inf value")
        if bad:
            rejected.append({"row": i, "case_id": cid, "reason": "; ".join(bad)})
            continue

        rec_flags: list[str] = []
        if not (SLOPE_FLAG_LO <= slope <= SLOPE_FLAG_HI):
            rec_flags.append(f"slope {slope:g}° outside [{SLOPE_FLAG_LO:g},{SLOPE_FLAG_HI:g}] — the discrete cone is "
                             f"coarse at this angle (verify against a bench-by-bench geotech model)")
        if rec_flags:
            flagged.append({"case_id": cid, "flags": rec_flags})
        accepted.append(PitScenario(case_id=cid, archetype=arch, nx=nx, ny=ny, nz=nz, price=price, recovery=recovery,
                                    mining_cost=mining, processing_cost=proc, slope_angle_deg=slope,
                                    flags=tuple(rec_flags)))
    return ContractReport(accepted=accepted, rejected=rejected, flagged=flagged)


def validate_blocks(raw_rows: list[dict[str, Any]], *, dims: tuple[int, int, int] | None = None) -> ContractReport:
    """Apply CONTRACT 1 to a real block-model table (one row per block). Rejects negative tonnage/density, out-of-box
    indices, NaN/Inf and unphysical grade; flags implausibly rich grades + duplicate indices. Pure; deterministic."""
    accepted: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    flagged: list[dict[str, Any]] = []
    seen: set[tuple[int, int, int]] = set()

    for i, row in enumerate(raw_rows):
        missing = [c for c in BLOCK_COLUMNS if c not in row or row[c] in (None, "")]
        if missing:
            rejected.append({"row": i, "reason": f"missing/empty columns: {missing}"})
            continue
        try:
            ix, iy, iz = int(float(row["ix"])), int(float(row["iy"])), int(float(row["iz"]))
            tonnage = float(row["tonnage"])
            density = float(row["density"])
            grade = float(row["grade"])
        except (TypeError, ValueError):
            rejected.append({"row": i, "reason": "non-numeric ix/iy/iz/tonnage/density/grade"})
            continue

        bad: list[str] = []
        if any(math.isnan(v) or math.isinf(v) for v in (tonnage, density, grade)):
            bad.append("NaN/Inf value")
        if tonnage <= 0:
            bad.append(f"tonnage={tonnage:g} ≤ 0")
        if density <= 0:
            bad.append(f"density={density:g} ≤ 0")
        if not (0.0 <= grade <= GRADE_PHYSICAL_MAX):
            bad.append(f"grade={grade:g} out of [0,{GRADE_PHYSICAL_MAX:g}] (mass fraction)")
        if dims is not None and not (0 <= ix < dims[0] and 0 <= iy < dims[1] and 0 <= iz < dims[2]):
            bad.append(f"index ({ix},{iy},{iz}) outside the {dims} model box")
        if bad:
            rejected.append({"row": i, "reason": "; ".join(bad)})
            continue

        rec_flags: list[str] = []
        if (ix, iy, iz) in seen:
            rec_flags.append(f"duplicate block index ({ix},{iy},{iz})")
        seen.add((ix, iy, iz))
        if grade > GRADE_FLAG_MAX:
            rec_flags.append(f"grade {grade:g} > {GRADE_FLAG_MAX:g} — implausibly rich for a bulk metal")
        if rec_flags:
            flagged.append({"index": [ix, iy, iz], "flags": rec_flags})
        accepted.append({"ix": ix, "iy": iy, "iz": iz, "tonnage": tonnage, "density": density, "grade": grade})
    return ContractReport(accepted=accepted, rejected=rejected, flagged=flagged)
