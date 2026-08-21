# Technical report release boundary

`main.pdf` is the PDF deposited for the current **v2.0** Zenodo record, version DOI
[10.5281/zenodo.22015986](https://doi.org/10.5281/zenodo.22015986), published 2026-08-19 under concept DOI
[10.5281/zenodo.21519687](https://doi.org/10.5281/zenodo.21519687). v2.0 carried the 2026-08-18 audit
correction: the two scheduling scenarios separated and named with their own denominators, the Node timings no
longer labelled in-browser, eleven MineLib instances acknowledged, and the licence premise corrected. v1.0
([10.5281/zenodo.21519688](https://doi.org/10.5281/zenodo.21519688)) is superseded.

## Source ahead of the deposit: v2.1 candidates (as of 2026-08-20)

`tex/main.tex` and `figures/` now run ahead of the deposited `main.pdf`. One of the three is a correction to a
claim the deposited PDF makes, not a presentation tidy-up:

1. **The v2.0 audit correction fixed the prose and missed the figure.** v2.0 retired the "in-browser" label on
   the MineLib timings and stopped quoting them as a property of the method, but panel (b) of `fig-minelib.pdf`
   still read "exact solve, in-browser, sub-second to 14k blocks", and its caption still read "fast enough to
   run interactively in a browser: about 5 ms ... about a quarter of a second". Those timings are Node,
   median-of-3, on one machine. The panel title, the y-axis label and the caption now say so, and the caption
   records that repeat runs on the same laptop varied by a factor of several. **The deposited v2.0 PDF still
   carries the old label.**
2. The Whittle figure dropped its first shell, because that shell has pit value exactly 0 and the filter tested
   truthiness. The empty pit is a real result, so the value curve now starts at zero; the strip-ratio series
   still starts at the second shell, since waste-over-ore is undefined with no ore. The caption says both.
3. That figure title nested parentheses, because the case name already carries its own.

`main.pdf` is NOT rebuilt here: it is the deposited artifact and is not silently overwritten. Item 1 is the
reason to cut a v2.1 rather than let the source drift. Rebuilding, versioning, and publishing that version is
an explicit release decision; ordinary software builds and deployments do not alter the Zenodo record.
