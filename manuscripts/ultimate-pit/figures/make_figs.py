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


def _load():
    return json.loads((DATA / "pf.json").read_text(encoding="utf-8"))


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
    a1.set_xticks(x); a1.set_xticklabels(ids, fontsize=8.2)
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
    a2.set_ylabel("exact solve time (ms, median)")
    a2.set_title("(b) exact solve, in-browser,\nsub-second to 14k blocks", fontsize=8.6)
    a2.grid(True, color=GRID, linewidth=0.7)
    a2.set_axisbelow(True)
    for s in ("top", "right"):
        a2.spines[s].set_visible(False)

    fig.tight_layout()
    fig.savefig(HERE / "fig-minelib.pdf", bbox_inches="tight")
    plt.close(fig)


def fig_whittle():
    d = _load()
    curve = [p for p in d["curve"] if p["pitValue"] and p["pitValue"] > 0]
    rf = [p["rf"] for p in curve]
    val = [p["pitValue"] / 1e6 for p in curve]
    strip = [p["stripRatio"] for p in curve]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(7.0, 3.0))

    # (a) Whittle nested shells: value + strip ratio vs revenue factor
    a1.plot(rf, val, "o-", color="#1b6ca8", linewidth=1.8, markersize=5, label="pit value")
    a1.set_xlabel("revenue factor"); a1.set_ylabel("ultimate-pit value (M\\$)", color="#1b6ca8")
    a1.tick_params(axis="y", labelcolor="#1b6ca8")
    a1.set_title(f"(a) Whittle nested pit shells\n({d['shell_case']})", fontsize=8.2)
    a1.grid(True, color=GRID, linewidth=0.7)
    a1.set_axisbelow(True)
    for s in ("top",):
        a1.spines[s].set_visible(False)
    ax2 = a1.twinx()
    ax2.plot(rf, strip, "s--", color="#e07a3f", linewidth=1.3, markersize=4, label="strip ratio")
    ax2.set_ylabel("strip ratio (waste/ore)", color="#e07a3f")
    ax2.tick_params(axis="y", labelcolor="#e07a3f")
    ax2.spines["top"].set_visible(False)

    # (b) CPIT scheduling: certified bound vs achievable schedule NPV
    cpit = d["cpit"]
    labels = ["certified\nupper bound", "feasible\nschedule"]
    vals = [cpit["boundNpv"] / 1e6, cpit["schedNpv"] / 1e6]
    gap = 100 * (1 - cpit["schedNpv"] / cpit["boundNpv"])
    bars = a2.bar(labels, vals, color=["#7d99b0", "#3fa34d"], edgecolor=INK, linewidth=0.6, width=0.58, zorder=3)
    for b, v in zip(bars, vals):
        a2.text(b.get_x() + b.get_width() / 2, v + 1, f"{v:.0f}M", ha="center", va="bottom",
                fontsize=8.6, fontweight="bold")
    a2.set_ylabel("NPV (M\\$)")
    a2.set_ylim(0, max(vals) * 1.2)
    a2.set_title(f"(b) constrained scheduling:\n{gap:.1f}% optimality gap", fontsize=8.2)
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
