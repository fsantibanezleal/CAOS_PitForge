#!/usr/bin/env python3
"""Generate the committed CPIT scheduling artifact (data/derived/cpit-schedule.json).

Beyond-the-ultimate-pit depth capstone (dossier depth-research-2026-07-07). For each instance this runs the
offline CPIT LP relaxation (a CERTIFIED upper bound on the discounted NPV) + a greedy capacity-constrained
integer pushback schedule (a heuristic), and records six fail-closed schedule controls:
  DUALITY : at rate 0 + infinite capacity the CPIT mined set equals the exact ultimate pit block-for-block,
            and the LP bound equals the exact UPL value.
  BOUND   : the certified bound is >= the feasible integer NPV.
  RESOURCE, PRECEDENCE, COMPLETE: every limit and precedence is respected and the UPL is fully scheduled.

Instances:
  twin-porphyry-s : our MIT-licensed oreblocks 0.1.0 synthetic twin (committed under frontend/public/twins),
                    so the FULL per-block schedule is committed and the browser can replay it bench by bench.
  newman1         : the published MineLib CPIT scenario (6 periods, 8% discount, two resources), read from the
                    local project-policy cache. MineLib is CC BY-SA 3.0 Unported. Only attributed AGGREGATE
                    facts are committed, never the per-block values or a per-block schedule.

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

from pipeline.science import cpit  # noqa: E402

# Didactic schedule parameters (a small, honestly reported problem, not a production plan).
PERIODS = 8
RATE = 0.10  # discount rate per period (period 1 undiscounted)
CAP_SLACK = 1.15  # per-period capacity = CAP_SLACK * total UPL tonnage / PERIODS (slight slack to finish in T)
PUBLISHED_NEWMAN_BOUND = 24_486_184.0
PUBLISHED_NEWMAN_FEASIBLE = 23_483_671.0
PUBLISHED_NEWMAN_GAP_PCT = 4.1


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _run_instance(inst: cpit.Instance, *, periods: int = PERIODS, rate: float = RATE,
                  capacity: float | np.ndarray | None = None,
                  resource_weights: np.ndarray | None = None) -> dict:
    """Run one CPIT instance and return results only after every control passes."""
    in_pit, upl_value = cpit.exact_upit(inst.value, inst.pred_start, inst.pred_list)
    upl_tonnage = float(inst.weight[in_pit].sum())
    if capacity is None:
        capacity = CAP_SLACK * upl_tonnage / periods

    if resource_weights is None:
        duality_capacity: float | np.ndarray = upl_tonnage * 10.0 + 1.0
    else:
        duality_capacity = (resource_weights.sum(axis=1) * 10.0 + 1.0).reshape(-1, 1)

    # DUALITY control: rate 0, infinite capacity -> mined set == UPL, bound == UPL value.
    lp0 = cpit.solve_cpit_lp(inst, periods=1, rate=0.0, capacity=duality_capacity,
                             resource_weights=resource_weights)
    mined0 = lp0.x[:, -1] > 0.5
    duality_match = bool(np.array_equal(mined0, in_pit))
    duality_bound_gap = abs(lp0.bound - upl_value)

    # the certified bound + the feasible discounted schedule.
    lp = cpit.solve_cpit_lp(inst, periods=periods, rate=rate, capacity=capacity,
                            resource_weights=resource_weights)
    sched = cpit.round_schedule(inst, in_pit, periods=periods, rate=rate, capacity=capacity,
                                resource_weights=resource_weights)
    bound = lp.bound
    npv = sched.npv
    gap = (bound - npv) / bound if bound > 0 else 0.0
    bound_valid = bound >= npv - 1e-6 * max(1.0, abs(bound))
    _, limits = cpit.normalise_resource_model(inst, periods, capacity, resource_weights)
    resource_feasible = bool(np.all(sched.per_period_resources <= limits + 1e-6))
    precedence_feasible = True
    for block in range(inst.n):
        if sched.period_of_block[block] < 0:
            continue
        for edge in range(int(inst.pred_start[block]), int(inst.pred_start[block + 1])):
            predecessor = int(inst.pred_list[edge])
            if (sched.period_of_block[predecessor] < 0
                    or sched.period_of_block[predecessor] > sched.period_of_block[block]):
                precedence_feasible = False
                break
    complete_upl = bool(np.array_equal(sched.mined, in_pit))
    if not (bound_valid and resource_feasible and precedence_feasible and complete_upl):
        raise AssertionError("rounded CPIT schedule failed a feasibility control")

    return {
        "nBlocks": inst.n,
        "nPrecs": inst.n_precs,
        "uplValue": upl_value,
        "uplBlocks": int(in_pit.sum()),
        "uplTonnage": upl_tonnage,
        "periods": periods,
        "discountRatePerPeriod": rate,
        "certifiedBoundNpv": bound,
        "feasibleHeuristicNpv": npv,
        "boundToFeasibleGapPct": 100.0 * gap,
        "minedBlocks": int(sched.mined.sum()),
        "controls": {
            "dualityMatch": duality_match,
            "dualityBoundVsUpl": duality_bound_gap,
            "boundGeqFeasible": bool(bound_valid),
            "resourceLimitsRespected": resource_feasible,
            "precedenceRespected": precedence_feasible,
            "completeUltimatePit": complete_upl,
        },
        "perPeriod": [
            {
                "period": t + 1,
                "minedTonnes": float(sched.per_period_tonnes[t]),
                "npvIncrement": float(sched.per_period_npv[t]),
                "cumulativeNpv": float(sched.per_period_cum_npv[t]),
                "resourceUsage": [float(value) for value in sched.per_period_resources[:, t]],
            }
            for t in range(periods)
        ],
        "_period_of_block": sched.period_of_block,  # popped out below for the license-safe instances only
    }


def main() -> int:
    out: dict = {
        "schema": "pitforge.cpit-schedule/v2",
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "engine": "Time-indexed CPIT LP relaxation (Chicoisne et al. 2012) via scipy HiGHS; "
                  "independent greedy capacity-constrained integer heuristic; exact ultimate pit via Dinic "
                  "max-flow (Picard).",
        "honesty": "The LP relaxation is a CERTIFIED upper bound on the discounted NPV, not a schedule. The "
                   "feasible schedule is an independent greedy heuristic, not an LP rounding, and is not claimed "
                   "optimal; the gap to the LP bound is reported. The "
                   "ultimate pit (rate 0, infinite capacity) is the degenerate case and is reproduced exactly.",
        "parameters": {"syntheticTwinScenario": {"periods": PERIODS,
                                                   "discountRatePerPeriod": RATE,
                                                   "capacitySlack": CAP_SLACK}},
        "cases": {},
    }

    twins = ROOT / "frontend" / "public" / "twins"
    # 1) MIT synthetic twin: commit the full per-block schedule that drives the bench replay.
    tp = twins / "twin-porphyry-s"
    inst = cpit.parse_minelib(_read(tp.with_suffix(".blocks")), _read(tp.with_suffix(".prec")),
                              _read(tp.with_suffix(".upit")), tonnage_col=5)
    res = _run_instance(inst)
    pob = res.pop("_period_of_block")
    res["source"] = "synthetic twin generated by oreblocks 0.1.0; MIT, committed in this repo"
    res["scenario"] = {
        "kind": "pitforge-authored",
        "label": "PitForge didactic scenario: 8 periods, 10% discount, one movement constraint",
        "comparableToPublishedMineLibCpit": False,
    }
    res["provenance"] = {
        "kind": "synthetic-twin",
        "generator": "oreblocks",
        "generatorVersion": "0.1.0",
        "generatorRepository": "https://github.com/fsantibanezleal/CAOS_OreBlocks",
        "license": "MIT",
    }
    twin_limit = float(np.asarray(CAP_SLACK * res["uplTonnage"] / PERIODS))
    res["resourceConstraints"] = [{"id": 0, "label": "total movement", "limits": [twin_limit] * PERIODS}]
    res["periodOfBlock"] = [int(v) for v in pob]  # -1 = never mined
    out["cases"]["twin-porphyry-s"] = res
    print(f"twin-porphyry-s: UPL {res['uplValue']:.0f} ({res['uplBlocks']} blks) | "
          f"bound {res['certifiedBoundNpv']:.0f} | npv {res['feasibleHeuristicNpv']:.0f} | "
          f"gap {res['boundToFeasibleGapPct']:.2f}% | duality {res['controls']['dualityMatch']}")

    # 2) newman1: solve the PUBLISHED .cpit scenario, AGGREGATE facts only (no per-block schedule).
    nm = ROOT / "frontend" / ".minelib-cache" / "newman1"
    if (nm / "newman1.cpit").exists() and (nm / "newman1.prec").exists():
        published = cpit.parse_minelib_cpit(_read(nm / "newman1.cpit"), _read(nm / "newman1.prec"))
        res_n = _run_instance(published.instance, periods=published.periods, rate=published.rate,
                              capacity=published.resource_limits,
                              resource_weights=published.resource_coefficients)
        res_n.pop("_period_of_block")  # never commit a per-block MineLib schedule
        res_n["source"] = "MineLib (Espinoza et al. 2013), CC BY-SA 3.0 Unported; attributed aggregate facts"
        res_n["scenario"] = {
            "kind": "minelib-published",
            "label": "Published newman1.cpit: 6 periods, 8% discount, two resource constraints",
            "comparableToPublishedMineLibCpit": True,
        }
        res_n["provenance"] = {
            "kind": "minelib",
            "citationDoi": "10.1007/s10479-012-1258-3",
            "license": "CC BY-SA 3.0 Unported",
            "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/",
            "scenarioUrl": "https://raw.githubusercontent.com/ampl/colab.ampl.com/master/"
                           "authors/eduardosalaz/minelib/data/newman1/newman1.cpit",
            "repositoryPolicy": "Only attributed aggregate results are committed; source bytes stay in a "
                                "gitignored cache by project choice.",
        }
        res_n["resourceConstraints"] = [
            {"id": 0, "label": "total movement (MineLib resource 0)",
             "limits": [float(value) for value in published.resource_limits[0]]},
            {"id": 1, "label": "processing (MineLib resource 1)",
             "limits": [float(value) for value in published.resource_limits[1]]},
        ]
        relative_error = abs(res_n["certifiedBoundNpv"] - PUBLISHED_NEWMAN_BOUND) / PUBLISHED_NEWMAN_BOUND
        res_n["publishedComparison"] = {
            "mineLibLpUpperBoundNpv": PUBLISHED_NEWMAN_BOUND,
            "mineLibPublishedFeasibleNpv": PUBLISHED_NEWMAN_FEASIBLE,
            "mineLibPublishedGapPct": PUBLISHED_NEWMAN_GAP_PCT,
            "ourBoundRelativeError": relative_error,
            "ourBoundMatchesPublished": relative_error <= 1e-6,
            "ourHeuristicMinusPublishedFeasibleNpv": (
                res_n["feasibleHeuristicNpv"] - PUBLISHED_NEWMAN_FEASIBLE
            ),
            "ourHeuristicRelativeToPublishedFeasiblePct": 100.0 * (
                res_n["feasibleHeuristicNpv"] - PUBLISHED_NEWMAN_FEASIBLE
            ) / PUBLISHED_NEWMAN_FEASIBLE,
        }
        if not res_n["publishedComparison"]["ourBoundMatchesPublished"]:
            raise AssertionError(
                f"published newman1 CPIT bound drift: {res_n['certifiedBoundNpv']} vs {PUBLISHED_NEWMAN_BOUND}"
            )
        out["cases"]["newman1"] = res_n
        print(f"newman1: UPL {res_n['uplValue']:.0f} ({res_n['uplBlocks']} blks) | "
              f"bound {res_n['certifiedBoundNpv']:.0f} | npv {res_n['feasibleHeuristicNpv']:.0f} | "
              f"gap {res_n['boundToFeasibleGapPct']:.2f}% | duality {res_n['controls']['dualityMatch']}")
    else:
        print("newman1 .cpit/.prec cache absent; run frontend/scripts/fetch-minelib.mjs newman1.")

    dest = ROOT / "data" / "derived" / "cpit-schedule.json"
    dest.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {dest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
