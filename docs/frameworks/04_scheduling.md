# Framework, the scheduling frontier (CPIT)

The ultimate pit (UPL) that PitForge solves exactly is static: it has no time, resource capacity, or discounting.
Precedence-constrained production scheduling (CPIT) decides when each block is extracted to maximise discounted
NPV under one or more per-period resource limits. This lane adds the decision the fast exact UPL does not make.

The contribution is deliberately bounded: a certified upper bound from a linear-programming relaxation, a
feasible integer pushback schedule, and the named gap between them. An LP relaxation is a bound, not a schedule.

## The cumulative time-indexed formulation

Let `x[b,t]` be 1 when block `b` has been extracted by the end of period `t`, and 0 otherwise. Let `v[b]` be net
block value, `a[k,b]` be consumption of resource `k`, `C[k,t]` be its period limit, and `r` be the discount rate.
With `x[b,0] = 0`, the mined-in-period indicator is `y[b,t] = x[b,t] - x[b,t-1]`:

```text
maximise    sum(b,t) v[b] / (1+r)^(t-1) * (x[b,t] - x[b,t-1])

subject to  x[b,t-1] <= x[b,t]                              monotonicity
            x[b,t] <= x[p,t] for every p in pred(b)          precedence
            sum(b) a[k,b] * (x[b,t] - x[b,t-1]) <= C[k,t]    every resource k and period t
            x[b,t] in {0,1}
```

The implementation supports multiple resources with distinct limits in every period. `newman1.cpit`, for
example, has total-movement and processing constraints; the separate synthetic-twin scenario has one movement
constraint.

## The certified bound and the algorithm actually run

PitForge relaxes `x[b,t]` to `[0,1]` and solves that cumulative Chicoisne et al. (2012) formulation offline with
`scipy.optimize.linprog` using HiGHS. Since CPIT is a maximisation problem, its LP optimum is an upper bound:

```text
feasible integer NPV <= optimal integer NPV <= LP upper bound
```

Bienstock and Zuckerberg (2010) is important specialized algorithmic context for large precedence-constrained LP
relaxations, but PitForge does not run the Bienstock-Zuckerberg algorithm. The artifact and interface name the
actual SciPy/HiGHS execution path.

The browser cannot run this general LP. The offline pipeline commits only the resulting aggregate certificate and
the license-safe synthetic schedule in `data/derived/cpit-schedule.json`. The live tab separately computes a
glass-box greedy schedule for the current synthetic deposit.

## Two scenarios that must not be mixed

| Scenario | Definition | LP bound | PitForge feasible NPV | Named gap |
|---|---|---:|---:|---:|
| MineLib `newman1.cpit` | Published: 6 periods, 8% discount, movement plus processing | 24,486,184 | 23,553,245 | 3.81% to the reproduced published bound |
| `twin-porphyry-s` | PitForge-authored and non-comparable: 8 periods, 10% discount, one movement limit | 104,612,788 | 92,806,606 | 11.29% to the PitForge scenario bound |

For the published `newman1.cpit` scenario, PitForge reproduces the MineLib LP bound to relative error below
`4e-9`. MineLib also reports a historical feasible value of 23,483,671 and a 4.1% gap. PitForge's feasible
heuristic is about 0.30% above that cited historical feasible value, but this repository does not claim a new
best-known result. The reproduced published upper bound remains the certificate.

The twin is a useful replay and interaction case, not a MineLib CPIT reproduction. Its 11.29% gap cannot be used
as the `newman1.cpit` gap, and neither number is described without its scenario and denominator.

## Feasible rounding and mandatory controls

The integer heuristic repeatedly selects a high-value available block whose predecessors are already scheduled
and whose resource vector fits the remaining limits. Every generated case must pass all of these controls:

1. At zero discount and infinite capacity, the mined set equals the exact ultimate pit block for block.
2. The zero-discount LP value equals the exact UPL value within floating-point tolerance.
3. The certified LP bound is not below the feasible integer NPV.
4. Every resource-period usage is within its published or authored limit.
5. Every scheduled block respects all precedence relations.
6. Every block in the ultimate pit is scheduled.

The controls run in `tests/test_cpit.py`, the generator fails closed, and `scripts/check_reference_integrity.py`
validates the committed artifact without requiring network access.

## Scope

CPIT is established literature, not a new PitForge algorithm. PitForge delivers a transparent, reproducible,
didactic slice with a certificate, a feasible heuristic, explicit controls, and an interactive explanation. It is
not a production mine plan and does not replace geological, geotechnical, operational, or financial review.

## References

- Chicoisne, R., Espinoza, D., Goycoolea, M., Moreno, E. and Rubio, E. (2012). A new algorithm for the open-pit
  mine production scheduling problem. Operations Research, 60(3), 517-528. doi:10.1287/opre.1120.1050
- Bienstock, D. and Zuckerberg, M. (2010). Solving LP relaxations of large-scale precedence constrained problems.
  IPCO, LNCS 6080, 1-14. doi:10.1007/978-3-642-13036-6_1
- Munoz, G. et al. (2018). A study of the Bienstock-Zuckerberg algorithm. Computational Optimization and
  Applications, 69, 501-534. doi:10.1007/s10589-017-9946-1
- Espinoza, D., Goycoolea, M., Moreno, E. and Newman, A. (2013). MineLib: a library of open pit mining problems.
  Annals of Operations Research, 206, 93-114. doi:10.1007/s10479-012-1258-3
- Virtanen, P. et al. (2020). SciPy 1.0: fundamental algorithms for scientific computing in Python. Nature
  Methods, 17, 261-272. doi:10.1038/s41592-019-0686-2
