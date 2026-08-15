# Attribution

## Methods

PitForge implements established open-pit optimization, network-flow, scheduling, and geostatistical methods:

- Lerchs, H. and Grossmann, I. F. (1965). Optimum design of open-pit mines. *CIM Bulletin*, 58, 47-54.
- Picard, J.-C. (1976). Maximal closure of a graph and applications to combinatorial problems. *Management
  Science*, 22(11), 1268-1272. doi:10.1287/mnsc.22.11.1268.
- Hochbaum, D. S. and Chen, A. (2000). Performance analysis and best implementations of old and new algorithms
  for the open-pit mining problem. *Operations Research*, 48(6), 894-914. doi:10.1287/opre.48.6.894.12392.
- Hochbaum, D. S. (2008). The pseudoflow algorithm: a new algorithm for the maximum-flow problem. *Operations
  Research*, 56(4), 992-1009. doi:10.1287/opre.1080.0524.
- Dinic, E. A. (1970). Algorithm for solution of a problem of maximum flow in networks with power estimation.
  *Soviet Mathematics Doklady*, 11, 1277-1280.
- Chicoisne, R. et al. (2012). A new algorithm for the open-pit mine production scheduling problem. *Operations
  Research*, 60(3), 517-528. doi:10.1287/opre.1120.1050.
- Bienstock, D. and Zuckerberg, M. (2010). Solving LP relaxations of large-scale precedence constrained problems.
  *IPCO*, LNCS 6080, 1-14. doi:10.1007/978-3-642-13036-6_1.
- Chilès, J.-P. and Delfiner, P. (2012). *Geostatistics: Modeling Spatial Uncertainty*, 2nd ed. Wiley.
  doi:10.1002/9781118136188.
- Virtanen, P. et al. (2020). SciPy 1.0: fundamental algorithms for scientific computing in Python. *Nature
  Methods*, 17, 261-272. doi:10.1038/s41592-019-0686-2.

PitForge uses Picard's maximum-closure reduction and Dinic's maximum-flow algorithm. It does not claim that
different exact algorithms return the same cut under tied optima, only that they solve the same optimal-value
problem. The scheduling certificate is the cumulative Chicoisne et al. formulation solved with SciPy/HiGHS;
Bienstock-Zuckerberg is cited as specialized literature context, not as the implementation executed here.

The full bibliography is in `frontend/src/data/citations.ts` and the in-app Methodology page.

## MineLib data and published benchmarks

The real-data lane uses MineLib, attributed to:

Espinoza, D., Goycoolea, M., Moreno, E. and Newman, A. (2013). MineLib: a library of open pit mining problems.
*Annals of Operations Research*, 206, 93-114. doi:10.1007/s10479-012-1258-3.

MineLib instances are licensed under [CC BY-SA 3.0 Unported](https://creativecommons.org/licenses/by-sa/3.0/).
That license permits sharing and adaptation subject to attribution and share-alike. PitForge nevertheless fetches
the source instances into a gitignored local cache and commits only attributed aggregate results as an engineering
and repository-size policy. This policy is not a license restriction.

The published `newman1.cpit` scenario is parsed with 6 periods, 8% discount, and two resource constraints. Its
published LP bound (24,486,184), cited feasible value (23,483,671), and cited gap (4.1%) are retained as reference
facts. PitForge separately reports its reproduced bound and its own feasible heuristic without claiming a new
best-known solution.

## Synthetic data

The built-in deposits and oreblocks twins are synthetic, fixed-seed fields. The three committed twin sidecars
record `oreblocks_version` 0.1.0. They were generated with `oreblocks.make_twin` from
[CAOS_OreBlocks](https://github.com/fsantibanezleal/CAOS_OreBlocks), Copyright 2026 Felipe Santibáñez-Leal,
licensed MIT. Their values illustrate methods and do not describe a real mine. The `CTRL` case is a closed-form
analytic control. The generated twin files are distributed under MIT.

## Report and software

The PitForge software is MIT. The technical report is CC BY 4.0 and has concept DOI
[10.5281/zenodo.21519687](https://doi.org/10.5281/zenodo.21519687). The existing deposited report is immutable;
corrected source in this repository is for a future explicitly authorized release and does not silently replace a
published record.

PitForge is built on the CAOS product-repository archetype and the shared `@fasl-work/caos-app-shell`, by Felipe
Santibáñez-Leal.
