"""CPIT scheduling controls, the two MANDATORY negative controls of the depth capstone (dossier section 3).

These tie the new scheduling lane to the proven ultimate-pit optimum. They run on small deterministic
synthetic instances (no network, no MineLib data), so they are safe in CI.

  DUALITY   at rate 0 + infinite capacity the CPIT LP mined set MUST equal the exact ultimate pit
            block-for-block, and the LP bound MUST equal the exact UPL value. A mismatch is a bug.
  BOUND     the certified LP bound MUST be >= any feasible integer NPV (a bound below a feasible is a bug).
  EXACTNESS the provably-safe fix-in / fix-out reductions MUST agree with the exact pit (fix-in subset of
            the pit, fix-out disjoint), so the learning-accelerated preprocessing can never change the optimum.

The exact ultimate pit is also pinned against the hand-computable inverted-pyramid oracle (the same anchor
opt.test.ts uses on the TypeScript engine), so the Python max-flow must not drift from the browser engine.
"""
from __future__ import annotations

import numpy as np
import pytest

from pflab.science import cpit


# --------------------------------------------------------------------------------------------------------
# small deterministic instance builders (3-D grid with 45-degree slope precedence, like the TS engine)
# --------------------------------------------------------------------------------------------------------
def _grid_instance(nx: int, ny: int, nz: int, value: np.ndarray, weight: np.ndarray) -> cpit.Instance:
    """A regular grid with the classic 9-point (theta=45deg cubic) slope precedence: block (ix,iy,iz)
    depends on the up-to-9 blocks in the (2r+1)^2 box directly above it at iz-1 (r=1)."""
    def idx(ix: int, iy: int, iz: int) -> int:
        return (iz * ny + iy) * nx + ix

    pred_start = [0]
    pred_list: list[int] = []
    for iz in range(nz):
        for iy in range(ny):
            for ix in range(nx):
                preds: list[int] = []
                if iz > 0:
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            jx, jy = ix + dx, iy + dy
                            if 0 <= jx < nx and 0 <= jy < ny:
                                preds.append(idx(jx, jy, iz - 1))
                pred_list.extend(preds)
                pred_start.append(len(pred_list))
    return cpit.Instance(n=nx * ny * nz, value=value.astype(np.float64), weight=weight.astype(np.float64),
                         pred_start=np.array(pred_start, dtype=np.int32),
                         pred_list=np.array(pred_list, dtype=np.int32))


def _pyramid() -> cpit.Instance:
    """The 5x1x3 inverted-pyramid oracle: one deep ore block (value +10) under 8 waste blocks (value -1),
    exact pit = the 9-block cone, value 10 - 8 = 2 (opt.test.ts anchor)."""
    nx, ny, nz = 5, 1, 3
    n = nx * ny * nz
    value = np.full(n, -1.0)
    value[(2 * ny + 0) * nx + 2] = 10.0  # deep block at (2,0,2)
    return _grid_instance(nx, ny, nz, value, np.ones(n))


def _porphyry(seed: int = 7) -> cpit.Instance:
    """A seeded 8x8x5 porphyry-like block: a central high-value core tapering out, sitting in waste."""
    rng = np.random.default_rng(seed)
    nx, ny, nz = 8, 8, 5
    value = np.zeros(nx * ny * nz)
    cx, cy = (nx - 1) / 2, (ny - 1) / 2
    for iz in range(nz):
        for iy in range(ny):
            for ix in range(nx):
                r = np.hypot(ix - cx, iy - cy)
                depth = iz / (nz - 1)
                ore = max(0.0, 1.0 - r / 3.0) * (0.4 + depth)  # richer + deeper toward the centre
                v = 40.0 * ore - 6.0 + rng.normal(0, 1.5)  # net value; waste is negative
                value[(iz * ny + iy) * nx + ix] = v
    return _grid_instance(nx, ny, nz, value, np.full(nx * ny * nz, 1000.0))


# --------------------------------------------------------------------------------------------------------
# ANCHOR: the exact ultimate pit must not drift from the hand-computable oracle / the TS engine.
# --------------------------------------------------------------------------------------------------------
def test_anchor_inverted_pyramid_oracle():
    inst = _pyramid()
    in_pit, value = cpit.exact_upit(inst.value, inst.pred_start, inst.pred_list)
    assert int(in_pit.sum()) == 9, "the inverted pyramid is 5 + 3 + 1 = 9 blocks"
    assert abs(value - 2.0) < 1e-9, f"pit value = 10 - 8 = 2 (got {value})"


def test_anchor_below_breakeven_pit_is_empty():
    # deep block worth only +3 but reaching it costs 8 in waste -> optimal pit is empty.
    nx, ny, nz = 5, 1, 3
    value = np.full(nx * ny * nz, -1.0)
    value[(2 * ny) * nx + 2] = 3.0
    inst = _grid_instance(nx, ny, nz, value, np.ones(nx * ny * nz))
    in_pit, value_out = cpit.exact_upit(inst.value, inst.pred_start, inst.pred_list)
    assert int(in_pit.sum()) == 0
    assert abs(value_out) < 1e-9


# --------------------------------------------------------------------------------------------------------
# CONTROL (a): DUALITY. rate 0 + infinite capacity -> CPIT mined set == UPL, bound == UPL value.
# --------------------------------------------------------------------------------------------------------
@pytest.mark.parametrize("builder", [_pyramid, _porphyry])
def test_duality_cpit_reduces_to_ultimate_pit(builder):
    inst = builder()
    in_pit, upl_value = cpit.exact_upit(inst.value, inst.pred_start, inst.pred_list)
    big = float(inst.weight.sum()) * 10.0 + 1.0
    lp = cpit.solve_cpit_lp(inst, periods=1, rate=0.0, capacity=big)
    mined = lp.x[:, -1] > 0.5
    assert np.array_equal(mined, in_pit), "rate 0 + infinite capacity must mine exactly the ultimate pit"
    assert abs(lp.bound - upl_value) <= 1e-4 * max(1.0, abs(upl_value)), \
        f"LP bound {lp.bound} must equal the exact UPL value {upl_value}"


def test_duality_multi_period_still_recovers_ultimate_pit():
    # even with several periods, rate 0 + infinite capacity mines the whole UPL by the final period.
    inst = _porphyry(seed=11)
    in_pit, upl_value = cpit.exact_upit(inst.value, inst.pred_start, inst.pred_list)
    big = float(inst.weight.sum()) * 10.0 + 1.0
    lp = cpit.solve_cpit_lp(inst, periods=4, rate=0.0, capacity=big)
    mined = lp.x[:, -1] > 0.5
    assert np.array_equal(mined, in_pit)
    assert abs(lp.bound - upl_value) <= 1e-4 * max(1.0, abs(upl_value))


# --------------------------------------------------------------------------------------------------------
# CONTROL (b): BOUND VALIDITY. the certified LP bound must dominate the feasible integer schedule NPV.
# --------------------------------------------------------------------------------------------------------
@pytest.mark.parametrize("rate", [0.0, 0.1, 0.25])
def test_bound_dominates_feasible_schedule(rate):
    inst = _porphyry(seed=3)
    in_pit, _ = cpit.exact_upit(inst.value, inst.pred_start, inst.pred_list)
    upl_tonnage = float(inst.weight[in_pit].sum())
    periods = 5
    capacity = 1.2 * upl_tonnage / periods
    lp = cpit.solve_cpit_lp(inst, periods=periods, rate=rate, capacity=capacity)
    sched = cpit.round_schedule(inst, in_pit, periods=periods, rate=rate, capacity=capacity)
    assert lp.bound >= sched.npv - 1e-6 * max(1.0, abs(lp.bound)), \
        f"certified bound {lp.bound} must be >= feasible NPV {sched.npv}"
    # a discounted schedule can only lose value versus the undiscounted UPL total.
    if rate > 0:
        assert sched.npv <= float(inst.value[in_pit].sum()) + 1e-6


def test_schedule_is_precedence_feasible_and_within_capacity():
    inst = _porphyry(seed=5)
    in_pit, _ = cpit.exact_upit(inst.value, inst.pred_start, inst.pred_list)
    upl_tonnage = float(inst.weight[in_pit].sum())
    periods = 6
    capacity = 1.15 * upl_tonnage / periods
    sched = cpit.round_schedule(inst, in_pit, periods=periods, rate=0.12, capacity=capacity)
    pob = sched.period_of_block
    # every mined block is in the UPL; every UPL block is mined (capacity has slack to finish).
    assert np.array_equal(sched.mined, in_pit)
    # precedence: a block is not mined before any of its predecessors.
    for b in range(inst.n):
        if pob[b] < 0:
            continue
        for e in range(int(inst.pred_start[b]), int(inst.pred_start[b + 1])):
            a = int(inst.pred_list[e])
            assert pob[a] >= 0 and pob[a] <= pob[b], f"block {b} mined before predecessor {a}"
    # capacity: no period exceeds the cap.
    for t in range(periods):
        assert sched.per_period_tonnes[t] <= capacity + 1e-6


# --------------------------------------------------------------------------------------------------------
# CONTROL (c): EXACTNESS of the learning-accelerated safe reductions (fix-in / fix-out preserve the optimum).
# --------------------------------------------------------------------------------------------------------
@pytest.mark.parametrize("builder", [_pyramid, lambda: _porphyry(2), lambda: _porphyry(9)])
def test_safe_reduction_agrees_with_exact_pit(builder):
    inst = builder()
    in_pit, _ = cpit.exact_upit(inst.value, inst.pred_start, inst.pred_list)
    red = cpit.safe_reduce(inst)
    # every provably-fixed-in block is actually in the exact pit; every fixed-out block is actually out.
    assert np.all(in_pit[red.fix_in]), "a fix-IN block must be in the exact optimal pit"
    assert not np.any(in_pit[red.fix_out]), "a fix-OUT block must be out of the exact optimal pit"
    # the three sets partition the blocks.
    assert np.array_equal(red.fix_in | red.fix_out | red.free, np.ones(inst.n, dtype=bool))
    assert not np.any(red.fix_in & red.fix_out)
