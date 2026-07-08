#!/usr/bin/env python3
"""Generate the committed CPIT scheduling artifact (data/derived/cpit-schedule.json).

Beyond-the-ultimate-pit depth capstone (dossier depth-research-2026-07-07). For each instance this runs the
offline CPIT LP relaxation (a CERTIFIED upper bound on the discounted NPV) + a greedy capacity-constrained
integer pushback schedule (a heuristic), and records the two mandatory negative controls (dossier section 3):
  DUALITY : at rate 0 + infinite capacity the CPIT mined set equals the exact ultimate pit block-for-block,
            and the LP bound equals the exact UPL value.
  BOUND   : the certified bound is >= the feasible integer NPV.

Instances:
  twin-porphyry-s : our own oreblocks synthetic twin (license-free, committed under frontend/public/twins),
                    so the FULL per-block schedule is committed and the browser can replay it bench by bench.
  newman1         : the smallest MineLib instance (Espinoza et al. 2013), read from the local academic-only
                    cache (frontend/.minelib-cache, never redistributed). Only AGGREGATE facts are committed
                    (per-period NPV series, the certified bound, the gap, the duality result), never the
                    per-block values or a per-block schedule.

This is a precompute/heavy-lane script (needs scipy); it is NOT run in CI or the deploy build. The JSON it
writes is committed and served as-is. Run it manually after changing the CPIT engine or the parameters:

    .venv-precompute/Scripts/python.exe scripts/gen_cpit.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "data-pipeline"))

from pflab.science import cpit  # noqa: E402

# Didactic schedule parameters (a small, honestly reported problem, not a production plan).
PERIODS = 8
RATE = 0.10  # discount rate per period (period 1 undiscounted)
CAP_SLACK = 1.15  # per-period capacity = CAP_SLACK * total UPL tonnage / PERIODS (slight slack to finish in T)


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _run_instance(inst: cpit.Instance) -> dict:
    """Full CPIT run + both controls for one instance. Returns a JSON-ready dict of results."""
    in_pit, upl_value = cpit.exact_upit(inst.value, inst.pred_start, inst.pred_list)
    upl_tonnage = float(inst.weight[in_pit].sum())
    capacity = CAP_SLACK * upl_tonnage / PERIODS

    # DUALITY control: rate 0, infinite capacity -> mined set == UPL, bound == UPL value.
    lp0 = cpit.solve_cpit_lp(inst, periods=1, rate=0.0, capacity=upl_tonnage * 10.0 + 1.0)
    mined0 = lp0.x[:, -1] > 0.5
    duality_match = bool(np.array_equal(mined0, in_pit))
    duality_bound_gap = abs(lp0.bound - upl_value)

    # the certified bound + the feasible discounted schedule.
    lp = cpit.solve_cpit_lp(inst, periods=PERIODS, rate=RATE, capacity=capacity)
    sched = cpit.round_schedule(inst, in_pit, periods=PERIODS, rate=RATE, capacity=capacity)
    bound = lp.bound
    npv = sched.npv
    gap = (bound - npv) / bound if bound > 0 else 0.0
    bound_valid = bound >= npv - 1e-6 * max(1.0, abs(bound))

    return {
        "nBlocks": inst.n,
        "nPrecs": inst.n_precs,
        "uplValue": upl_value,
        "uplBlocks": int(in_pit.sum()),
        "uplTonnage": upl_tonnage,
        "periods": PERIODS,
        "discountRatePerPeriod": RATE,
        "capacityTonnesPerPeriod": capacity,
        "certifiedBoundNpv": bound,
        "roundedScheduleNpv": npv,
        "integralityGapPct": 100.0 * gap,
        "minedBlocks": int(sched.mined.sum()),
        "controls": {
            "dualityMatch": duality_match,
            "dualityBoundVsUpl": duality_bound_gap,
            "boundGeqFeasible": bool(bound_valid),
        },
        "perPeriod": [
            {
                "period": t + 1,
                "minedTonnes": float(sched.per_period_tonnes[t]),
                "npvIncrement": float(sched.per_period_npv[t]),
                "cumulativeNpv": float(sched.per_period_cum_npv[t]),
            }
            for t in range(PERIODS)
        ],
        "_period_of_block": sched.period_of_block,  # popped out below for the license-safe instances only
    }


def main() -> int:
    out: dict = {
        "schema": "pitforge.cpit-schedule/v1",
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "engine": "CPIT LP relaxation (Bienstock-Zuckerberg 2010 / Chicoisne 2012 formulation) via scipy HiGHS; "
                  "greedy capacity-constrained integer rounding; exact ultimate pit via Dinic max-flow (Picard).",
        "honesty": "The LP relaxation is a CERTIFIED upper bound on the discounted NPV, not a schedule. The "
                   "rounded schedule is a heuristic and is never optimal; the integrality gap is reported. The "
                   "ultimate pit (rate 0, infinite capacity) is the degenerate case and is reproduced exactly.",
        "parameters": {"periods": PERIODS, "discountRatePerPeriod": RATE, "capacitySlack": CAP_SLACK},
        "cases": {},
    }

    twins = ROOT / "frontend" / "public" / "twins"
    # 1) synthetic twin, license-free: commit the FULL per-block schedule (drives the bench replay).
    tp = twins / "twin-porphyry-s"
    inst = cpit.parse_minelib(_read(tp.with_suffix(".blocks")), _read(tp.with_suffix(".prec")),
                              _read(tp.with_suffix(".upit")), tonnage_col=5)
    res = _run_instance(inst)
    pob = res.pop("_period_of_block")
    res["source"] = "synthetic twin (oreblocks); license-free, committed in this repo"
    res["periodOfBlock"] = [int(v) for v in pob]  # -1 = never mined
    out["cases"]["twin-porphyry-s"] = res
    print(f"twin-porphyry-s: UPL {res['uplValue']:.0f} ({res['uplBlocks']} blks) | "
          f"bound {res['certifiedBoundNpv']:.0f} | npv {res['roundedScheduleNpv']:.0f} | "
          f"gap {res['integralityGapPct']:.2f}% | duality {res['controls']['dualityMatch']}")

    # 2) newman1 (MineLib) from the local academic-only cache, AGGREGATE facts only (no per-block schedule).
    nm = ROOT / "frontend" / ".minelib-cache" / "newman1"
    if (nm / "newman1.blocks").exists():
        inst_n = cpit.parse_minelib(_read(nm / "newman1.blocks"), _read(nm / "newman1.prec"),
                                    _read(nm / "newman1.upit"), tonnage_col=6)
        res_n = _run_instance(inst_n)
        res_n.pop("_period_of_block")  # never commit a per-block MineLib schedule
        res_n["source"] = "MineLib (Espinoza et al. 2013), academic-only cache; aggregate facts only, never redistributed"
        out["cases"]["newman1"] = res_n
        print(f"newman1: UPL {res_n['uplValue']:.0f} ({res_n['uplBlocks']} blks) | "
              f"bound {res_n['certifiedBoundNpv']:.0f} | npv {res_n['roundedScheduleNpv']:.0f} | "
              f"gap {res_n['integralityGapPct']:.2f}% | duality {res_n['controls']['dualityMatch']}")
    else:
        print("newman1 cache absent (frontend/.minelib-cache/newman1); skipping the MineLib aggregate case.")

    dest = ROOT / "data" / "derived" / "cpit-schedule.json"
    dest.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
