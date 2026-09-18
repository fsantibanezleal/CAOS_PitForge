# Technical report release boundary

`main.pdf` is the PDF deposited for the current **v2.1** Zenodo record, version DOI
[10.5281/zenodo.22824952](https://doi.org/10.5281/zenodo.22824952), published 2026-09-18 under concept DOI
[10.5281/zenodo.21519687](https://doi.org/10.5281/zenodo.21519687). `tex/main.tex` and `figures/` build exactly this
PDF; the publishing tool reserves the version DOI and writes it into the page-1 header block.

Earlier versions: v2.0 ([10.5281/zenodo.22015986](https://doi.org/10.5281/zenodo.22015986), 2026-08-19) and v1.0
([10.5281/zenodo.21519688](https://doi.org/10.5281/zenodo.21519688)). Both are superseded.

## What v2.1 changes relative to v2.0

1. Figure 1(b) and its caption state the environment of the timings (Node, median of three runs, one machine, with
   two- to five-fold variation between repeat runs) instead of labelling them in-browser, and the abstract and
   conclusion no longer quote solve times.
2. The figures read `data/derived/{minelib-results,case-results,cpit-schedule}.json` directly and write the plotted
   values to `data/pf.json`, which previously was a hand-copied snapshot holding the timings of a superseded build.
3. Figure 2(b) plots both scheduling scenarios, each against its own bound (3.81% on `newman1.cpit`, 11.29% on the
   synthetic twin).
4. The Whittle value curve starts at the empty first shell, and the strip-ratio series at the second.
5. The text is revised to the scientific-voice convention and carries the page-1 header block; the reproduction
   appendix describes the feasible schedule as an independent greedy heuristic, not a rounding of the relaxation.

`main.pdf` changes only through a new Zenodo version. Ordinary software builds and deployments do not alter the
deposited record.
