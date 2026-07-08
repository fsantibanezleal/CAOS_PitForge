# Framework, the scheduling frontier (CPIT)

Beyond the ultimate pit. The ultimate pit (UPL) that PitForge solves exactly is **static**: it has no time,
no capacity, and no discounting. The open, published frontier is **precedence-constrained production
scheduling** (CPIT): decide in which period each block is extracted so as to maximise the **discounted NPV**
under a per-period tonnage capacity. This lane adds exactly the capability the fast exact UPL does not have.

Honesty first. The UPL is already proven optimal and the min-cut reproduces the MineLib optima exactly, so
nothing here beats it. The contribution is (1) a **certified upper bound** on the discounted NPV from a linear
programming relaxation, and (2) a **feasible integer pushback schedule** rounded from that relaxation, with the
**integrality gap reported explicitly**. An LP relaxation is a bound, not a schedule.

## The time-indexed formulation

Introduce a binary variable per block and period, in the by-period cumulative form (Chicoisne et al. 2012):

```
x_{b,t} in {0,1}   =  1 if block b has been extracted by the END of period t (cumulative, monotone in t)
```

with `x_{b,0} = 0`. Write `w_b` for the extraction tonnage of block b, `v_b` for its net value (destination
already optimised, the same `.upit` value the min-cut uses), `r` the discount rate per period, and `C_t` the
tonnage capacity of period t. The block mined-in-period-t indicator is `y_{b,t} = x_{b,t} - x_{b,t-1}`.

```
maximise    sum_{b,t}  v_b / (1+r)^(t-1)  ( x_{b,t} - x_{b,t-1} )        (discounted NPV; period 1 undiscounted)

subject to  x_{b,t-1} <= x_{b,t}                        (once mined, stays mined)
            x_{b,t}   <= x_{a,t}   for a in pred(b)      (precedence, in every period)
            sum_b w_b ( x_{b,t} - x_{b,t-1} ) <= C_t     (per-period tonnage capacity)
            x_{b,t} in {0,1}
```

The precedence constraint says: block b cannot be mined by period t unless every predecessor a (each block in
b's slope cone, which must be removed first) has also been mined by period t.

## The Bienstock and Zuckerberg LP relaxation (the certified bound)

Relaxing the integrality (`x_{b,t} in [0,1]` instead of `{0,1}`) gives a linear program. Because the problem is
a **maximisation**, the LP optimum is a valid **upper bound** on the best integer NPV:

```
NPV*(integer)  <=  NPV(LP relaxation)  =  the certified bound
```

Solving this LP at scale is itself a research contribution: Bienstock and Zuckerberg (2010) give a specialised
algorithm for the LP relaxation of large precedence-constrained problems, studied and extended for mining and
resource-constrained project scheduling by Munoz et al. (2018). PitForge solves the LP **offline** in the
`.venv` with `scipy.optimize.linprog` (the HiGHS backend) on a small MineLib instance and a license-free
synthetic twin, commits the bound and the per-period schedule as an artifact
(`data/derived/cpit-schedule.json`), and the browser replays it. The browser cannot run a general LP, so the
certified bound is offline by construction; the live tab shows a feasible greedy schedule for the animation.

## The rounded schedule and the integrality gap

The LP gives a fractional solution and a bound, not an integer plan. We round to a feasible integer schedule
with a greedy heuristic: fill each period up to its capacity, mining the highest-value available block first
(all predecessors already mined), advancing the period when the best available block no longer fits. Then

```
integrality gap  =  ( certified bound  -  rounded schedule NPV )  /  certified bound
```

is reported honestly. On the committed cases the gap is around 10 to 11 percent. It is never presented as
optimal; the honest bound and gap are the deliverable.

## Duality to the ultimate pit (the mandatory control)

Set the discount rate to `r = 0` and the capacity to infinity. Then every discount factor is 1, the objective
collapses to `sum_b v_b x_{b,T}`, and the only remaining constraints are precedence and `x in [0,1]`. That is
exactly the **max-closure LP**, whose optimum is integral and equals the ultimate pit. Therefore:

> At rate 0 and infinite capacity the CPIT mined set MUST equal the exact ultimate pit **block-for-block**,
> and the LP bound MUST equal the exact UPL value. If it does not, it is a bug, not a result.

This is the mandatory duality negative control (verified in `tests/test_cpit.py` and, on the live TypeScript
schedule, in `frontend/test/schedule.test.ts`). On `newman1` and the porphyry twin the LP bound reproduces the
exact UPL optima 26,086,899 and 126,908,454 to floating-point noise (~1e-7). The ultimate pit is the
undiscounted, uncapacitated degenerate case of the schedule, so the new lane is a rigorous **superset** of the
current product, not a bolt-on.

A second control is bound validity: the certified bound must be greater than or equal to any feasible integer
NPV (a bound below a feasible solution is a bug).

## Scope (honest)

CPIT is 2012 SOTA, not a new algorithm. The contribution here is the transparent, certified, in-browser
**delivery** (the bound, the gap, the bench-sequence animation), wired to the same MineLib ground truth.
PitForge ships a **didactic slice**: a certified bound plus a pushback schedule on one to two instances. The
full production scheduler is the sibling product PhaseFlow; PitForge does not annex it.

## References

- Chicoisne, R., Espinoza, D., Goycoolea, M., Moreno, E. & Rubio, E. (2012). A new algorithm for the open-pit
  mine production scheduling problem. Operations Research, 60(3), 517-528. doi:10.1287/opre.1120.1050
- Bienstock, D. & Zuckerberg, M. (2010). Solving LP relaxations of large-scale precedence constrained
  problems. IPCO, LNCS 6080, 1-14. doi:10.1007/978-3-642-13036-6_1
- Munoz, G., Espinoza, D., Goycoolea, M., Moreno, E., Queyranne, M. & Rivera Letelier, O. (2018). A study of
  the Bienstock-Zuckerberg algorithm. Computational Optimization and Applications, 69, 501-534.
  doi:10.1007/s10589-017-9946-1
- Lambert, W. B. & Newman, A. M. (2014). Tailored Lagrangian relaxation for the open pit block sequencing
  problem. Annals of Operations Research, 222, 419-438. doi:10.1007/s10479-012-1287-y
- Espinoza, D., Goycoolea, M., Moreno, E. & Newman, A. (2013). MineLib: a library of open pit mining problems.
  Annals of Operations Research, 206, 93-114. doi:10.1007/s10479-012-1258-3

Full citation list in `frontend/src/data/citations.ts`.
