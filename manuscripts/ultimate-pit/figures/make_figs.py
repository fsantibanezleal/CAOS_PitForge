#!/usr/bin/env python3
"""Regenerate the figures for the PitForge ultimate-pit report from the COMMITTED artifacts. Two figures:

  fig-minelib.pdf - the exact-solver validation on published MineLib instances. (a) The solver reproduces the
                    published optimum of newman1, zuck_small and kd to relative error near 1e-10. (b) The exact
                    solve is fast: milliseconds to a fraction of a second for 1000 to 14000 blocks.
  fig-whittle.pdf - (a) the Whittle nested pit shells: pit value and strip ratio against the revenue factor, the
                    parameterisation used for phase/pushback design. (b) constrained scheduling: the certified
                    upper-bound NPV versus the achievable rounded-schedule NPV, and the optimality gap between them.

Run:  python make_figs.py     (from repo root)
Deps: matplotlib, numpy.
"""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

HERE = Path(__file__).resolve().parent
DATA = HERE.parent / "data"

INK = "#1a1a2e"
GRID = "#d8d8e0"

plt.rcParams.update({
    "font.family": "serif", "font.size": 9.4, "axes.edgecolor": INK,
    "axes.labelcolor": INK, "text.color": INK, "xtick.color": INK, "ytick.color": INK,
    "axes.linewidth": 0.8, "figure.dpi": 200,
})


DERIVED = HERE.parents[2] / "data" / "derived"

# The three MineLib instances the report validates against. The rest of the eleven are excluded
# with reasons, recorded in docs/frameworks/05_minelib.md, not silently dropped.
VALIDATED = ("newman1", "zuck_small", "kd")
SHELL_CASE = "A01"


def _load():
    """Derive the figure inputs from the SHIPPED artifacts, then snapshot them to pf.json.

    pf.json used to be hand-copied, and drifted a whole generation of solve times behind the
    product while this docstring claimed otherwise. Reading data/derived/ directly is what makes
    the claim true: the figures cannot now disagree with what the app serves.
    """
    ml = json.loads((DERIVED / "minelib-results.json").read_text(encoding="utf-8"))
    cases = json.loads((DERIVED / "case-results.json").read_text(encoding="utf-8"))
    cpit = json.loads((DERIVED / "cpit-schedule.json").read_text(encoding="utf-8"))

    by_id = {r["id"]: r for r in ml["results"]}
    missing = [i for i in VALIDATED if i not in by_id]
    if missing:
        raise SystemExit(f"minelib-results.json is missing validated instances: {missing}")

    minelib = [{
        "id": i,
        "nBlocks": by_id[i]["nBlocks"],
        "published": by_id[i]["publishedOptimum"],
        "ours": by_id[i]["ourValue"],
        "relError": by_id[i]["relError"],
        "solveMs": by_id[i]["dinicMsMedian"],
    } for i in VALIDATED]

    case = cases["cases"][SHELL_CASE]
    scen = {k: {
        "periods": v["periods"],
        "rate": v["discountRatePerPeriod"],
        "boundNpv": v["certifiedBoundNpv"],
        "schedNpv": v["feasibleHeuristicNpv"],
        "gapPct": v["boundToFeasibleGapPct"],
        "uplValue": v["uplValue"],
    } for k, v in cpit["cases"].items()}

    d = {
        "provenance": "derived by make_figs.py from data/derived/{minelib-results,case-results,"
                      "cpit-schedule}.json; do not hand-edit",
        "timingEnvironment": ml.get("timingEnvironment"),
        "minelib": minelib,
        "shell_case": case["name"],
        "curve": case["curve"],
        "cpit_scenarios": scen,
    }
    (DATA / "pf.json").write_text(json.dumps(d, indent=1) + "\n", encoding="utf-8")
    return d


def fig_minelib():
    d = _load()
    ml = d["minelib"]
    ids = [r["id"] for r in ml]
    rel = [max(r["relError"], 1e-13) for r in ml]
    nb = [r["nBlocks"] for r in ml]
    ms = [r["solveMs"] for r in ml]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.0, 3.0))

    # (a) relative error vs published optimum
    x = np.arange(len(ids))
    a1.bar(x, rel, color="#1b6ca8", edgecolor=INK, linewidth=0.6, width=0.6, zorder=3)
    a1.axhline(1e-6, color="#b23a48", linewidth=1.1, linestyle="--", label="exact-match threshold ($10^{-6}$)")
    a1.set_yscale("log")
    a1.set_xticks(x)
    a1.set_xticklabels(ids, fontsize=8.2)
    a1.set_ylabel("rel. error vs published optimum")
    a1.set_ylim(1e-11, 1e-5)
    a1.set_title("(a) reproduces the published\nMineLib optima exactly", fontsize=8.6)
    a1.grid(axis="y", color=GRID, linewidth=0.7, zorder=0)
    a1.set_axisbelow(True)
    a1.legend(fontsize=7.2, frameon=True, facecolor="white", edgecolor=GRID, loc="upper right")
    for s in ("top", "right"):
        a1.spines[s].set_visible(False)

    # (b) solve time vs blocks
    order = np.argsort(nb)
    a2.plot(np.array(nb)[order], np.array(ms)[order], "o-", color="#e07a3f", linewidth=1.7, markersize=6, zorder=3)
    for x0, y0, i in zip(nb, ms, ids):
        a2.annotate(f"{i}\n{y0:.0f} ms", (x0, y0), textcoords="offset points", xytext=(5, -12), fontsize=7.0)
    a2.set_xlabel("blocks in the instance")
    a2.set_ylabel("exact solve time (ms, median of 3, Node)")
    a2.set_title("(b) exact solve time, Node,\nmedian of 3, one machine", fontsize=8.6)
    a2.grid(True, color=GRID, linewidth=0.7)
    a2.set_axisbelow(True)
    for s in ("top", "right"):
        a2.spines[s].set_visible(False)

    fig.tight_layout()
    fig.savefig(HERE / "fig-minelib.pdf", bbox_inches="tight")
    plt.close(fig)


def fig_whittle():
    d = _load()
    # A pit value of exactly 0 is a real result, the empty pit, not a missing point: at the lowest
    # revenue factor no block pays for itself. Keep it, so the value curve starts where it truly starts.
    curve = [p for p in d["curve"] if p["pitValue"] is not None and p["pitValue"] >= 0]
    rf = [p["rf"] for p in curve]
    val = [p["pitValue"] / 1e6 for p in curve]
    # Strip ratio is waste/ore and is undefined when the pit is empty, so that series omits those
    # points rather than drawing a 0 that would read as "no waste" instead of "no pit".
    stripped = [p for p in curve if p["pitValue"] > 0]
    rf_strip = [p["rf"] for p in stripped]
    strip = [p["stripRatio"] for p in stripped]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.0, 3.0))

    # (a) Whittle nested shells: value + strip ratio vs revenue factor
    a1.plot(rf, val, "o-", color="#1b6ca8", linewidth=1.8, markersize=5, label="pit value")
    a1.set_xlabel("revenue factor")
    a1.set_ylabel("ultimate-pit value (M\\$)", color="#1b6ca8")
    a1.tick_params(axis="y", labelcolor="#1b6ca8")
    a1.set_title(f"(a) Whittle nested pit shells\n{d['shell_case']}", fontsize=8.2)
    a1.grid(True, color=GRID, linewidth=0.7)
    a1.set_axisbelow(True)
    for s in ("top",):
        a1.spines[s].set_visible(False)
    ax2 = a1.twinx()
    ax2.plot(rf_strip, strip, "s--", color="#e07a3f", linewidth=1.3, markersize=4, label="strip ratio")
    ax2.set_ylabel("strip ratio (waste/ore)", color="#e07a3f")
    ax2.tick_params(axis="y", labelcolor="#e07a3f")
    ax2.spines["top"].set_visible(False)

    # (b) CPIT scheduling, BOTH scenarios side by side. They have different denominators and are
    # not comparable; showing only one, unlabelled, is what the v2.0 correction had to undo.
    scen = d["cpit_scenarios"]
    order = [k for k in ("newman1", "twin-porphyry-s") if k in scen]
    titles = {"newman1": "newman1\n(published)", "twin-porphyry-s": "twin\n(synthetic)"}
    xs = np.arange(len(order))
    w = 0.34
    bounds = [scen[k]["boundNpv"] / 1e6 for k in order]
    scheds = [scen[k]["schedNpv"] / 1e6 for k in order]
    a2.bar(xs - w / 2, bounds, width=w, color="#7d99b0", edgecolor=INK, linewidth=0.6, zorder=3,
           label="certified bound")
    a2.bar(xs + w / 2, scheds, width=w, color="#3fa34d", edgecolor=INK, linewidth=0.6, zorder=3,
           label="feasible schedule")
    top = max(bounds)
    for i, k in enumerate(order):
        a2.text(xs[i], max(bounds[i], scheds[i]) + top * 0.04,
                f"{scen[k]['gapPct']:.2f}% gap", ha="center", va="bottom",
                fontsize=7.6, fontweight="bold")
    a2.set_xticks(xs)
    a2.set_xticklabels([titles[k] for k in order], fontsize=8.0)
    a2.set_ylabel("NPV (M\\$)")
    a2.set_ylim(0, top * 1.28)
    a2.legend(fontsize=7.0, frameon=True, facecolor="white", edgecolor=GRID, loc="upper left")
    a2.set_title("(b) constrained scheduling,\neach scenario against its own bound", fontsize=8.2)
    a2.grid(axis="y", color=GRID, linewidth=0.7, zorder=0)
    a2.set_axisbelow(True)
    for s in ("top", "right"):
        a2.spines[s].set_visible(False)

    fig.tight_layout()
    fig.savefig(HERE / "fig-whittle.pdf", bbox_inches="tight")
    plt.close(fig)


def main():
    fig_minelib()
    fig_whittle()
    print("wrote fig-minelib.pdf, fig-whittle.pdf")


if __name__ == "__main__":
    main()
