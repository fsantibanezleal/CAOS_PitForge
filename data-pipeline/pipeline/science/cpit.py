"""Offline CPIT lane, the certified NPV bound + a didactic capacity-constrained pushback schedule.

This is PitForge's beyond-the-ultimate-pit depth capstone (dossier depth-research-2026-07-07, section 2.2).
The static ultimate pit (UPL) that the browser already solves exactly is the UNDISCOUNTED, UNCAPACITATED
limit of a schedule. This module adds the scheduling dimension the UPL does not address: a time index,
per-period tonnage capacity, and discounting, giving a discounted NPV.

Honesty first (dossier section 7). The UPL is already proven optimal and reproduced exactly by the min-cut,
so nothing here "beats" it. The implementation uses the cumulative Chicoisne et al. 2012 formulation
(Operations Research 60(3):517-528, doi:10.1287/opre.1120.1050), solved through SciPy/HiGHS. Bienstock and
Zuckerberg 2010 (doi:10.1007/978-3-642-13036-6_1) is specialized algorithmic context, not the algorithm run.
The deliverables are (a) a CERTIFIED upper bound on discounted NPV and (b) a feasible integer schedule,
with the gap to the LP bound reported explicitly. An LP relaxation is a bound, not a schedule; the greedy
schedule is a heuristic and is never presented as optimal.

Formulation (by-period cumulative form of the precedence-constrained production scheduling, CPIT):
  x[b,t] in [0,1]   fraction of block b extracted by the END of period t (cumulative, monotone in t)
  monotone      x[b,t-1] <= x[b,t]                         (once mined, stays mined; x[b,0] = 0)
  precedence    x[b,t]   <= x[a,t]   for a a predecessor of b (a must be gone before b, in every period)
  capacity      sum_b a[q,b] (x[b,t] - x[b,t-1]) <= C[q,t] (every resource q in period t)
  objective     max sum_{b,t} d[t] v[b] (x[b,t] - x[b,t-1]),  d[t] = 1 / (1+r)^(t-1)   (period 1 undiscounted)

The LP relaxation (x in [0,1] rather than {0,1}) is a valid UPPER bound on the integer NPV for this
maximisation. Six fail-closed controls tie the lane to the proven optimum and a valid schedule:
  DUALITY    at rate r = 0 and infinite capacity, the CPIT mined set MUST equal the exact UPL pit
             block-for-block (else a bug), and the LP bound MUST equal the exact UPL value.
  BOUND      the certified bound MUST be >= any feasible integer NPV (a bound below a feasible is a bug).
  RESOURCES  every resource-period usage MUST be within its limit.
  PRECEDENCE every scheduled block MUST follow all predecessors.
  COMPLETE   every block in the UPL MUST be scheduled.

The duality value and mined-set match are two parts of the same DUALITY control. The exact UPL is an independent
Python max-flow (Dinic), mirroring the
TypeScript engine that the browser runs (Picard 1976 max-closure to min-cut reduction).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

# scipy is a precompute/dev-lane dependency (requirements-precompute.txt + requirements-dev.txt), not a
# runtime dependency of the numpy-light default pipeline; import it lazily inside the LP solver.


# --------------------------------------------------------------------------------------------------------
# Instance container + MineLib-format parsing (mirrors frontend/src/opt/minelib.ts, kept in sync).
# --------------------------------------------------------------------------------------------------------
@dataclass
class Instance:
    """A precedence-constrained instance: net block values, extraction weights (tonnage), and the
    predecessor lists in CSR form. `pred_list[pred_start[b]:pred_start[b+1]]` must be mined before b."""

    n: int
    value: np.ndarray  # float64, net block value from .upit (destination already optimised per block)
    weight: np.ndarray  # float64, extraction tonnage per block (for the capacity constraint)
    pred_start: np.ndarray  # int32, length n+1
    pred_list: np.ndarray  # int32, length n_precs

    @property
    def n_precs(self) -> int:
        return int(self.pred_start[-1])


def _rows(text: str) -> list[list[str]]:
    return [ln.split() for ln in text.splitlines() if ln.strip()]


def _parse_precedence(prec_text: str, n: int) -> tuple[np.ndarray, np.ndarray]:
    """Parse MineLib predecessor rows into CSR, validating block ids and row cardinality."""
    counts = np.zeros(n, dtype=np.int64)
    prows = _rows(prec_text)
    for t in prows:
        b = int(t[0])
        k = int(t[1])
        if len(t) != 2 + k:
            raise ValueError(f".prec: row for {b} declares {k} preds but has {len(t) - 2}")
        counts[b] = k
    pred_start = np.zeros(n + 1, dtype=np.int32)
    for b in range(n):
        pred_start[b + 1] = pred_start[b] + counts[b]
    pred_list = np.zeros(int(pred_start[-1]), dtype=np.int32)
    fill = pred_start.copy()
    for t in prows:
        b = int(t[0])
        for j in range(2, len(t)):
            p = int(t[j])
            if p < 0 or p >= n:
                raise ValueError(f".prec: bad predecessor {p} for block {b}")
            pred_list[fill[b]] = p
            fill[b] += 1
    return pred_start, pred_list


def parse_minelib(blocks_text: str, prec_text: str, upit_text: str, tonnage_col: int) -> Instance:
    """Parse the published .blocks / .prec / .upit triple. `tonnage_col` is the 0-based token index of the
    extraction tonnage in a .blocks row (id=0 x=1 y=2 z=3, then instance-specific free columns)."""
    brows = [t for t in _rows(blocks_text) if t and t[0].isdigit()]
    n = len(brows)
    weight = np.zeros(n, dtype=np.float64)
    for t in brows:
        b = int(t[0])
        if b < 0 or b >= n:
            raise ValueError(f".blocks: bad id {b} (n={n})")
        w = float(t[tonnage_col])
        if not np.isfinite(w) or w <= 0:
            raise ValueError(f".blocks: bad tonnage for id {b}")
        weight[b] = w

    pred_start, pred_list = _parse_precedence(prec_text, n)

    value = np.full(n, np.nan, dtype=np.float64)
    for t in _rows(upit_text):
        if not t[0].isdigit():
            continue  # keyword header lines (NAME:, TYPE:, NBLOCKS:, OBJECTIVE_FUNCTION:)
        b = int(t[0])
        value[b] = float(t[1])
    if np.isnan(value).any():
        raise ValueError(".upit: missing value for some block")
    return Instance(n=n, value=value, weight=weight, pred_start=pred_start, pred_list=pred_list)


@dataclass
class PublishedCpitScenario:
    """A MineLib CPIT file plus its precedence graph, ready for the multi-resource LP lane."""

    name: str
    instance: Instance
    periods: int
    rate: float
    resource_coefficients: np.ndarray  # shape (n_resources, n_blocks)
    resource_limits: np.ndarray  # shape (n_resources, periods)

    @property
    def n_resources(self) -> int:
        return int(self.resource_coefficients.shape[0])


def parse_minelib_cpit(cpit_text: str, prec_text: str) -> PublishedCpitScenario:
    """Parse a published MineLib `.cpit` scenario, including every period/resource constraint.

    MineLib stores one undiscounted objective coefficient per block, an upper limit for each
    resource-period pair, and sparse resource coefficients keyed by `(block, resource)`. The
    precedence graph remains in the sibling `.prec` file. Lower-bound/resource-equality rows are
    rejected because the current certified solver implements the published upper-capacity form.
    """
    lines = [line.strip() for line in cpit_text.splitlines() if line.strip()]

    def header(key: str) -> str:
        prefix = f"{key}:"
        for line in lines:
            if line.startswith(prefix):
                return line[len(prefix):].strip()
        raise ValueError(f".cpit: missing {key}")

    name = header("NAME")
    if header("TYPE") != "CPIT":
        raise ValueError(".cpit: TYPE must be CPIT")
    n = int(header("NBLOCKS"))
    periods = int(header("NPERIODS"))
    n_resources = int(header("NRESOURCE_SIDE_CONSTRAINTS"))
    rate = float(header("DISCOUNT_RATE"))
    if n <= 0 or periods <= 0 or n_resources <= 0 or not np.isfinite(rate) or rate < 0:
        raise ValueError(".cpit: invalid dimensions or discount rate")

    try:
        limits_at = lines.index("RESOURCE_CONSTRAINT_LIMITS:")
        objective_at = lines.index("OBJECTIVE_FUNCTION:")
        resources_at = lines.index("RESOURCE_CONSTRAINT_COEFFICIENTS:")
    except ValueError as exc:
        raise ValueError(".cpit: missing a required data section") from exc
    if not limits_at < objective_at < resources_at:
        raise ValueError(".cpit: data sections are out of order")

    limits = np.full((n_resources, periods), np.nan, dtype=np.float64)
    for line in lines[limits_at + 1:objective_at]:
        tokens = line.split()
        if len(tokens) != 4:
            raise ValueError(f".cpit: invalid resource-limit row: {line}")
        resource, period = int(tokens[0]), int(tokens[1])
        if tokens[2] != "L":
            raise ValueError(f".cpit: unsupported resource sense {tokens[2]}")
        if not (0 <= resource < n_resources and 0 <= period < periods):
            raise ValueError(".cpit: resource-limit index out of range")
        limits[resource, period] = float(tokens[3])
    if np.isnan(limits).any() or not np.isfinite(limits).all() or (limits < 0).any():
        raise ValueError(".cpit: missing or invalid resource limits")

    value = np.full(n, np.nan, dtype=np.float64)
    for line in lines[objective_at + 1:resources_at]:
        tokens = line.split()
        if len(tokens) != 2:
            raise ValueError(f".cpit: invalid objective row: {line}")
        block = int(tokens[0])
        if not 0 <= block < n:
            raise ValueError(".cpit: objective block id out of range")
        value[block] = float(tokens[1])
    if np.isnan(value).any() or not np.isfinite(value).all():
        raise ValueError(".cpit: missing or invalid objective coefficients")

    coefficients = np.zeros((n_resources, n), dtype=np.float64)
    seen = np.zeros((n_resources, n), dtype=bool)
    for line in lines[resources_at + 1:]:
        if line == "EOF":
            continue
        tokens = line.split()
        if len(tokens) != 3:
            raise ValueError(f".cpit: invalid resource-coefficient row: {line}")
        block, resource = int(tokens[0]), int(tokens[1])
        if not (0 <= block < n and 0 <= resource < n_resources):
            raise ValueError(".cpit: resource-coefficient index out of range")
        coefficient = float(tokens[2])
        if not np.isfinite(coefficient) or coefficient < 0:
            raise ValueError(".cpit: resource coefficients must be finite and non-negative")
        coefficients[resource, block] = coefficient
        seen[resource, block] = True
    if not seen.any(axis=1).all():
        raise ValueError(".cpit: every declared resource needs at least one coefficient")

    pred_start, pred_list = _parse_precedence(prec_text, n)
    instance = Instance(n=n, value=value, weight=coefficients[0].copy(),
                        pred_start=pred_start, pred_list=pred_list)
    return PublishedCpitScenario(name=name, instance=instance, periods=periods, rate=rate,
                                 resource_coefficients=coefficients, resource_limits=limits)


# --------------------------------------------------------------------------------------------------------
# Exact ultimate pit (Dinic max-flow over Picard's max-closure to min-cut reduction). Independent Python
# reimplementation of the TypeScript engine, so the duality control checks against a second implementation.
# --------------------------------------------------------------------------------------------------------
class _Dinic:
    def __init__(self, n: int) -> None:
        self.n = n
        self.to: list[int] = []
        self.cap: list[float] = []
        self.head: list[list[int]] = [[] for _ in range(n)]

    def add(self, u: int, v: int, c: float) -> None:
        self.head[u].append(len(self.to))
        self.to.append(v)
        self.cap.append(c)
        self.head[v].append(len(self.to))
        self.to.append(u)
        self.cap.append(0.0)

    def maxflow(self, s: int, t: int) -> float:
        """Dinic's blocking-flow max-flow. BFS builds the level graph; each phase then pushes augmenting
        paths along it via an explicit-stack DFS (with a per-node edge cursor + dead-end pruning)."""
        to, cap, head = self.to, self.cap, self.head
        flow = 0.0
        level = [-1] * self.n
        it = [0] * self.n
        while True:
            for i in range(self.n):
                level[i] = -1
            level[s] = 0
            q = [s]
            qi = 0
            while qi < len(q):
                u = q[qi]
                qi += 1
                for e in head[u]:
                    v = to[e]
                    if cap[e] > 1e-12 and level[v] < 0:
                        level[v] = level[u] + 1
                        q.append(v)
            if level[t] < 0:
                break
            for i in range(self.n):
                it[i] = 0
            # push blocking flow this phase: repeated augmenting-path DFS on the level graph
            while True:
                stack = [s]
                edge_of = [-1]
                found = False
                while stack:
                    u = stack[-1]
                    if u == t:
                        found = True
                        break
                    moved = False
                    while it[u] < len(head[u]):
                        e = head[u][it[u]]
                        v = to[e]
                        if cap[e] > 1e-12 and level[v] == level[u] + 1:
                            stack.append(v)
                            edge_of.append(e)
                            moved = True
                            break
                        it[u] += 1
                    if not moved:
                        level[u] = -1  # dead end, prune from the level graph
                        stack.pop()
                        edge_of.pop()
                        if stack:
                            it[stack[-1]] += 1
                if not found:
                    break
                bottleneck = min(cap[edge_of[k]] for k in range(1, len(edge_of)))
                for k in range(1, len(edge_of)):
                    e = edge_of[k]
                    cap[e] -= bottleneck
                    cap[e ^ 1] += bottleneck
                flow += bottleneck
        return flow


def exact_upit(value: np.ndarray, pred_start: np.ndarray, pred_list: np.ndarray) -> tuple[np.ndarray, float]:
    """Exact ultimate pit via max-closure to min-cut. Returns (in_pit bool array, pit_value)."""
    n = len(value)
    s, t = n, n + 1
    g = _Dinic(n + 2)
    sum_pos = float(value[value > 0].sum())
    inf = sum_pos + 1.0
    for i in range(n):
        v = float(value[i])
        if v > 0:
            g.add(s, i, v)
        elif v < 0:
            g.add(i, t, -v)
    for b in range(n):
        for e in range(int(pred_start[b]), int(pred_start[b + 1])):
            g.add(b, int(pred_list[e]), inf)
    flow = g.maxflow(s, t)
    # source side of the residual graph = the optimal pit
    reach = np.zeros(n + 2, dtype=bool)
    reach[s] = True
    q = [s]
    qi = 0
    while qi < len(q):
        u = q[qi]
        qi += 1
        for e in g.head[u]:
            v = g.to[e]
            if g.cap[e] > 1e-9 and not reach[v]:
                reach[v] = True
                q.append(v)
    in_pit = reach[:n].copy()
    pit_value = float(value[in_pit].sum())
    identity_gap = abs(pit_value - (sum_pos - flow))
    if identity_gap > max(1e-6 * max(1.0, sum_pos), 1e-3):
        raise AssertionError(f"value identity violated: gap {identity_gap}")
    return in_pit, pit_value


# --------------------------------------------------------------------------------------------------------
# CPIT LP relaxation (scipy HiGHS) + a greedy integer rounding.
# --------------------------------------------------------------------------------------------------------
def discount_factors(periods: int, rate: float) -> np.ndarray:
    """d[t] = 1 / (1+rate)^(t-1), t = 1..periods (period 1 undiscounted)."""
    return np.array([1.0 / (1.0 + rate) ** k for k in range(periods)], dtype=np.float64)


@dataclass
class CpitLp:
    bound: float  # certified upper bound on the discounted NPV
    x: np.ndarray  # (n, periods) fractional cumulative extraction
    periods: int
    rate: float
    capacity: float | np.ndarray


def normalise_resource_model(inst: Instance, periods: int, capacity: float | np.ndarray,
                             resource_weights: np.ndarray | None) -> tuple[np.ndarray, np.ndarray]:
    """Normalize scalar/single-resource and matrix/multi-resource capacity inputs."""
    weights = inst.weight.reshape(1, inst.n) if resource_weights is None else np.asarray(
        resource_weights, dtype=np.float64,
    )
    if weights.ndim != 2 or weights.shape[1] != inst.n or weights.shape[0] == 0:
        raise ValueError("resource_weights must have shape (n_resources, n_blocks)")
    if not np.isfinite(weights).all() or (weights < 0).any():
        raise ValueError("resource weights must be finite and non-negative")

    raw_limits = np.asarray(capacity, dtype=np.float64)
    if raw_limits.ndim == 0:
        limits = np.full((weights.shape[0], periods), float(raw_limits), dtype=np.float64)
    elif raw_limits.ndim == 1 and weights.shape[0] == 1 and raw_limits.shape == (periods,):
        limits = raw_limits.reshape(1, periods)
    elif raw_limits.ndim == 2 and raw_limits.shape == (weights.shape[0], periods):
        limits = raw_limits
    else:
        raise ValueError("capacity must be a scalar, a single-resource period vector, or a resource-by-period matrix")
    if not np.isfinite(limits).all() or (limits < 0).any():
        raise ValueError("capacity limits must be finite and non-negative")
    return weights, limits


def solve_cpit_lp(inst: Instance, periods: int, rate: float, capacity: float | np.ndarray,
                  resource_weights: np.ndarray | None = None) -> CpitLp:
    """Solve the by-period cumulative CPIT LP relaxation with HiGHS.

    The legacy scalar `capacity` path applies one extraction-tonnage constraint per period. Published
    MineLib scenarios pass a `(resources, periods)` limit matrix and matching coefficient matrix.
    """
    from scipy.optimize import linprog
    from scipy.sparse import coo_matrix

    n, T = inst.n, periods
    nv = n * T
    d = discount_factors(T, rate)
    weights, limits = normalise_resource_model(inst, T, capacity, resource_weights)

    def col(b: int, t: int) -> int:
        return b * T + t

    # objective: maximise sum_{b,t} d[t] v[b] (x[b,t] - x[b,t-1]); linprog minimises, so negate.
    c = np.zeros(nv, dtype=np.float64)
    for b in range(n):
        vb = inst.value[b]
        for t in range(T):
            c[col(b, t)] += -d[t] * vb
            if t + 1 < T:
                c[col(b, t)] += d[t + 1] * vb  # -(x[b,t+1]-x[b,t]) contribution of x[b,t]

    rows: list[int] = []
    cols: list[int] = []
    vals: list[float] = []
    b_ub: list[float] = []
    r = 0

    # monotone: x[b,t-1] - x[b,t] <= 0
    for b in range(n):
        for t in range(1, T):
            rows += [r, r]
            cols += [col(b, t - 1), col(b, t)]
            vals += [1.0, -1.0]
            b_ub.append(0.0)
            r += 1
    # precedence: x[b,t] - x[a,t] <= 0 for each predecessor a of b, every t
    for b in range(n):
        for e in range(int(inst.pred_start[b]), int(inst.pred_start[b + 1])):
            a = int(inst.pred_list[e])
            for t in range(T):
                rows += [r, r]
                cols += [col(b, t), col(a, t)]
                vals += [1.0, -1.0]
                b_ub.append(0.0)
                r += 1
    # capacity: sum_b w[q,b] (x[b,t] - x[b,t-1]) <= C[q,t], for every resource q.
    for q in range(weights.shape[0]):
        for t in range(T):
            for b in range(n):
                w = weights[q, b]
                if w == 0:
                    continue
                rows.append(r)
                cols.append(col(b, t))
                vals.append(w)
                if t >= 1:
                    rows.append(r)
                    cols.append(col(b, t - 1))
                    vals.append(-w)
            b_ub.append(float(limits[q, t]))
            r += 1

    a_ub = coo_matrix((vals, (rows, cols)), shape=(r, nv))
    res = linprog(c, A_ub=a_ub, b_ub=np.array(b_ub), bounds=(0.0, 1.0), method="highs")
    if not res.success:
        raise RuntimeError(f"CPIT LP did not solve: {res.message}")
    x = res.x.reshape(n, T)
    bound = -float(res.fun)
    return CpitLp(bound=bound, x=x, periods=T, rate=rate, capacity=capacity)


@dataclass
class Schedule:
    period_of_block: np.ndarray  # int32, -1 if never mined
    npv: float  # discounted NPV of the rounded integer schedule
    per_period_tonnes: np.ndarray
    per_period_npv: np.ndarray  # discounted value added in each period
    per_period_cum_npv: np.ndarray
    per_period_resources: np.ndarray  # shape (n_resources, periods)
    mined: np.ndarray  # bool, blocks actually mined


def round_schedule(inst: Instance, upit_set: np.ndarray, periods: int, rate: float,
                   capacity: float | np.ndarray, priority: np.ndarray | None = None,
                   resource_weights: np.ndarray | None = None) -> Schedule:
    """Greedy feasible integer schedule over the UPL set: fill each period up to the tonnage capacity,
    mining the highest-`priority` available block first (default priority = block value), respecting
    precedence. When the highest-priority available block no longer fits the period's remaining capacity,
    the period closes and mining continues in the next one. Blocks outside `upit_set` are never mined
    (mining them can only lower the total value). Returns the feasible greedy schedule and discounted NPV.
    This is a heuristic, not an optimal schedule; the LP relaxation is the certified bound above it."""
    import heapq

    n, T = inst.n, periods
    d = discount_factors(T, rate)
    weights, limits = normalise_resource_model(inst, T, capacity, resource_weights)
    period_of = np.full(n, -1, dtype=np.int32)
    mined = np.zeros(n, dtype=bool)
    prio = priority if priority is not None else inst.value

    # successor lists + remaining unmined predecessors (restricted to the UPL closure).
    succ: list[list[int]] = [[] for _ in range(n)]
    remaining_pred = np.zeros(n, dtype=np.int64)
    for b in range(n):
        if not upit_set[b]:
            continue
        cnt = 0
        for e in range(int(inst.pred_start[b]), int(inst.pred_start[b + 1])):
            a = int(inst.pred_list[e])
            if upit_set[a]:
                succ[a].append(b)
                cnt += 1
        remaining_pred[b] = cnt

    # max-heap on priority (negate), block id as a deterministic tiebreak.
    heap: list[tuple[float, int]] = [(-float(prio[b]), b) for b in range(n)
                                     if upit_set[b] and remaining_pred[b] == 0]
    heapq.heapify(heap)
    per_tonnes = np.zeros(T, dtype=np.float64)
    per_resources = np.zeros((weights.shape[0], T), dtype=np.float64)
    per_npv = np.zeros(T, dtype=np.float64)

    for t in range(T):
        deferred: list[tuple[float, int]] = []  # available but did not fit this period
        while heap:
            key, b = heapq.heappop(heap)
            if np.any(per_resources[:, t] + weights[:, b] > limits[:, t] + 1e-9):
                deferred.append((key, b))
                # close the period once the best-available block no longer fits.
                break
            mined[b] = True
            period_of[b] = t
            per_resources[:, t] += weights[:, b]
            per_tonnes[t] = per_resources[0, t]
            per_npv[t] += d[t] * inst.value[b]
            for c2 in succ[b]:
                remaining_pred[c2] -= 1
                if remaining_pred[c2] == 0:
                    heapq.heappush(heap, (-float(prio[c2]), c2))
        for item in deferred:
            heapq.heappush(heap, item)
    cum = np.cumsum(per_npv)
    return Schedule(period_of_block=period_of, npv=float(per_npv.sum()), per_period_tonnes=per_tonnes,
                    per_period_npv=per_npv, per_period_cum_npv=cum,
                    per_period_resources=per_resources, mined=mined)


# --------------------------------------------------------------------------------------------------------
# Learning-accelerated exact preprocessing, provably-safe fix-in / fix-out reductions (dossier 2.2 secondary).
# The learned scores only ORDER which blocks to test; the RULES below are what guarantee exactness. The
# exactness control asserts every fixing agrees with the full exact pit (fix-in subset of the pit, fix-out
# disjoint from it), so the reduction can never change the certified optimum, only the scale/speed.
# --------------------------------------------------------------------------------------------------------
@dataclass
class Reduction:
    fix_in: np.ndarray  # bool, provably in every optimal pit
    fix_out: np.ndarray  # bool, provably out of the optimal pit
    free: np.ndarray  # bool, undecided (needs the exact solve)


def safe_reduce(inst: Instance) -> Reduction:
    """Provably-safe reductions that preserve the exact optimum.

    fix-IN(b):  value[b] >= 0 and every direct predecessor is fixed-in. Propagated top-down from the
                surface, this means b's entire supporting cone is non-negative, so an optimal pit
                including b exists (adding a non-negative closure never lowers the objective).
    fix-OUT(b): value[b] <= 0 and every successor (block that requires b removed) is fixed-out. Propagated
                bottom-up, nothing forces b into the pit and b itself contributes <= 0, so leaving b out
                is optimal.
    """
    n = inst.n
    # successor lists (reverse of predecessor CSR)
    succ: list[list[int]] = [[] for _ in range(n)]
    for b in range(n):
        for e in range(int(inst.pred_start[b]), int(inst.pred_start[b + 1])):
            succ[int(inst.pred_list[e])].append(b)

    fix_in = np.zeros(n, dtype=bool)
    fix_out = np.zeros(n, dtype=bool)

    # fix-IN: top-down. A block with no predecessors and value >= 0 seeds; propagate to blocks whose
    # predecessors are all fixed-in and whose own value is >= 0.
    unmet_pred = np.array([int(inst.pred_start[b + 1] - inst.pred_start[b]) for b in range(n)], dtype=np.int64)
    queue = [b for b in range(n) if unmet_pred[b] == 0 and inst.value[b] >= 0]
    for b in queue:
        fix_in[b] = True
    qi = 0
    while qi < len(queue):
        a = queue[qi]
        qi += 1
        for b in succ[a]:
            if fix_in[b]:
                continue
            unmet_pred[b] -= 1
            if unmet_pred[b] == 0 and inst.value[b] >= 0:
                fix_in[b] = True
                queue.append(b)

    # fix-OUT: bottom-up. A block with no successors and value <= 0 seeds; propagate to blocks whose
    # successors are all fixed-out and whose own value is <= 0.
    unmet_succ = np.array([len(succ[b]) for b in range(n)], dtype=np.int64)
    q2 = [b for b in range(n) if unmet_succ[b] == 0 and inst.value[b] <= 0]
    for b in q2:
        fix_out[b] = True
    qi = 0
    while qi < len(q2):
        b = q2[qi]
        qi += 1
        for e in range(int(inst.pred_start[b]), int(inst.pred_start[b + 1])):
            a = int(inst.pred_list[e])
            if fix_out[a]:
                continue
            unmet_succ[a] -= 1
            if unmet_succ[a] == 0 and inst.value[a] <= 0:
                fix_out[a] = True
                q2.append(a)

    free = ~(fix_in | fix_out)
    return Reduction(fix_in=fix_in, fix_out=fix_out, free=free)
