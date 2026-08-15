# Changelog

All notable changes to CAOS PitForge. Versions follow `X.XX.XXX` (display), see `pipeline.__version__` and
`frontend/package.json`. The project stays in `0.x` until the epic-#18 at-bar review closes (real published
block models are now first-class; the synthetic archetypes remain the teaching lane, stated openly).

## Unreleased

### Changed

- Rebuilt the workbench as a responsive, single-scroll-owner instrument with desktop grouped navigation and a
  phone-safe grouped selector that keeps every view reachable.
- Localized canonical case names, provenance, validation anchors, chart labels, empty states, error states, and
  loading states in English and Spanish. The browser title and document language now follow the visible locale.
- Replaced static mini bars with keyboard-operable uPlot charts, localized summaries, exact-value tables, wheel
  zoom, keyboard pan and zoom, and reset controls. WebGL and artifact failures remain bounded and retryable.
- Self-hosted the pinned ONNX runtime assets from the application origin and lazy-loaded 3-D and learned panels.
  Production chunking reduces the main application JavaScript from about 708 KB to 143 KB.

### Verification

- Added a 13-contract Playwright and axe-core suite covering six workbench viewports including 200% responsive
  zoom equivalence, short-phone focus mode, keyboard navigation, both color themes, locale synchronization,
  content reachability, horizontal overflow, WebGL degradation, artifact failure, and long prose routes. CI
  installs Chromium and runs the same browser suite.
- Documented the binding responsive, accessibility, runtime-asset, degraded-capability, and browser-test contract
  in `docs/architecture/09_production-ui.md`.

## [0.12.000] · 2026-07-31

### Fixed - three routes hid more than half a page with no way to reach it

The ADR-0071 floor put `height: 100dvh; overflow: hidden` on the WHOLE shell while the only inner scroll it
provided was `.pf-tabpanel`, a class no TSX used. Measured on production at 1600x900: `/experiments` hid
1055px of 1955px (54% of the page), `/benchmark` hid 749px including the MineLib reproduction table that is
this product's headline evidence, `/methodology` hid 328px. Mouse wheel and the End key both left `scrollY`
at 0. Fixed at source in `tools/ui-floor/apply_ui_floor.py` (now v2) and back-ported to every product the
v1 floor had touched.

### Fixed - two of eleven tabs could not be clicked

At 1280x800 the tab row needed 1329px of a 918px container. `Surrogate · preview` and `Bring your own` sat
entirely beyond the window, and with `overflow: hidden` on the shell no gesture brought them back; a real
pointer click could reach tabs 0-8 and not 9-10. The eleven views are now SIX groups on one 45px row
(Pit, Shells, Deposit, Schedule, Learned, Your model), sub-views revealed on hover from the same tab.

### Added - ADR-0070 focus mode

A full-viewport view of the SELECTED deposit, re-solving the pit EXACTLY on every control change with the
same Lerchs-Grossmann min-cut the App runs, not a cheaper approximation. Stage at 80% of the viewport, the
economic state named in one plain sentence (bands over `PitResult.stripRatio`, described as descriptive and
not as a published cut-off), KPIs as a HUD, price / revenue-factor / slope in the rail, visible return, and
an entry control in the App rail carrying the selected case.

`PitView3D` now fills its parent when asked to. Passing `height={0}` straight through gave the renderer a
zero-height viewport: the scene built, the canvas existed and nothing was ever visible, while every
presence-and-share check passed. The gate now measures the canvas box and samples its pixels.

## [0.11.000] · 2026-07-30

### Fixed
- **Version coherence.** Every version source in this repo now declares the same number. They had drifted
  apart (0.10.000), which `conventions/versioning.md` forbids: `VERSION`, the manifests, the CHANGELOG and the
  git tag are required to move together on every release.
- A line-wide sweep on 2026-07-30 found 79 tags across 9 CAOS repos pointing at commits declaring a
  different version, plus 13 repos whose working tree was internally incoherent. The cause is one habit: a
  release gets merged, tagged and deployed while the version files stay where they were. The cost is not
  cosmetic, since a product footer reads its version from a manifest, so a deployed app reported a version
  older than the release it was running.
- This is a MINOR bump rather than a patch: it puts the whole repo onto one clean number regardless of
  development stage, so the numbering is in order from here rather than carrying the drift forward.
- Historical tags are left untouched. A published tag is the accurate record of a release that happened, so
  drift is fixed by moving the files forward, never by rewriting or deleting a tag.
- Guarded going forward by `tools/version-audit/check_version_coherence.py` in CAOS_MANAGE.

## [0.10.000], 2026-07-11

### Added (issue #50, feature 1 of 3: variable geomechanical slope)
- Variable slope per KhaloKakaie, Dowd & Fowell (2000, doi:10.1179/mnt.2000.109.2.77): `slopeTemplateVariable`
  builds an azimuth-dependent one-bench cone from per-principal-direction wall angles (N/E/S/W) with the KDF
  elliptic interpolation between them (block-unit radii, rounded per direction, same convention as the isotropic
  template); `EconParams.slopeAngles` switches the ultimate-pit solve to it; `forEachPrecedenceArcVariable` adds
  the per-rock-domain hook (a per-block template selector, the future BancoEstable allowable-angle coupling).
- Honest discretization note in code + tests: at equal 45 deg on cubic blocks the elliptic cone is the classic
  5-point PLUS (circular) pattern, not the 9-point box (whose diagonals are effectively ~35 deg); the isotropic
  box template is unchanged. Arcs still point one bench up only, so the relation composes to a valid CLOSURE and
  the min-cut stays exact; tested (0 closure violations on the solved anisotropic pit, equal-angles reproduces
  the isotropic optimum on the 2D slice, a shallower west wall widens only the west reach and cannot increase the
  pit value). 45/45 tests pass.

## [0.09.002], 2026-07-11

### Changed
- Interactive-viz rubric (issue #51): the NPV-vs-period chart in the Scheduling panel is now an INTERACTIVE uPlot
  chart, cumulative-NPV bars with crosshair + live money readout, the certified LP bound and the undiscounted-UPL
  reference as dashed flat series, drag-zoom + double-click reset, theme-aware. Replaces the static SVG; closes
  the last static-chart-debt item of the hub audit's viz wave.

## [0.09.001], 2026-07-11

### Fixed
- Reference integrity (ADR-0017 §4): the 5 link-less citations now carry a link or an explicit marker.
  Cappart et al. 2023 -> JMLR url; Hustrulid et al. 2013 -> doi 10.1201/b15068. Lerchs & Grossmann 1965,
  Dinic 1970 and Whittle 1988 are genuinely pre-DOI print/conference sources with no open landing page and are
  now explicitly marked as such (never a fabricated link).

### Added
- Per-panel error boundary (viz/PanelBoundary.tsx, mirroring RotorVitals) so one view crash cannot blank the App.

## [0.09.000], 2026-07-07

### Added, certified CPIT scheduling slice (beyond the ultimate pit)
- Offline CPIT LP relaxation (`data-pipeline/pipeline/science/cpit.py`): a certified upper bound on the
  discounted NPV of the precedence-constrained production schedule (Bienstock and Zuckerberg 2010,
  doi:10.1007/978-3-642-13036-6_1; Chicoisne et al. 2012, doi:10.1287/opre.1120.1050), solved with
  scipy HiGHS, plus a greedy capacity-constrained integer pushback schedule and its integrality gap.
  The static ultimate pit is the undiscounted, uncapacitated degenerate case, reproduced exactly.
- Committed artifact `data/derived/cpit-schedule.json` (generator `scripts/gen_cpit.py`). Results:
  twin-porphyry-s certified bound 104.6 M vs feasible NPV 92.8 M (gap 11.3 %); newman1 (MineLib,
  aggregate facts only) bound 20.5 M vs 18.4 M (gap 10.5 %). Both reproduce the exact UPL value
  (26,086,899 and 126,908,454) at rate 0 + infinite capacity.
- The two MANDATORY negative controls as hard tests (`tests/test_cpit.py`): DUALITY (rate 0 +
  infinite capacity mines exactly the ultimate pit, block-for-block, bound equals the UPL value) and
  BOUND validity (the certified bound dominates any feasible integer NPV). Plus the EXACTNESS control
  for the learned reduction (below).
- New App "Scheduling" tab: a paused-by-default bench-sequence animation (greedy pushback on the
  current deposit) + the NPV-vs-period certified-bound curve with the integrality gap shown honestly.
- Live scheduling engine `frontend/src/opt/schedule.ts` with a TypeScript duality control in the
  frontend suite (rate 0 + infinite capacity mines exactly the `solveUltimatePit` set).

### Changed
- Reframed the learned pit-surrogate from "fast triage" to "learning-accelerated EXACT preprocessing":
  the learned scores only ORDER provably-safe fix-in / fix-out reductions; the exact min-cut still
  certifies the reduced instance, so the optimum can never change (value is scale, not a new optimum).
  The EXACTNESS control asserts every fixing agrees with the exact pit. Updated the in-app panel + docs.
- Deepened the SOTA citations (`frontend/src/data/citations.ts`): added Lerchs-Grossmann LP-duality
  context, Gallo-Grigoriadis-Tarjan 1989 (parametric max-flow), Deutsch 2022 (MineFlow), Chicoisne
  2012, Bienstock-Zuckerberg 2010, Munoz 2018, Lambert-Newman 2014, Bengio-Lodi-Prouvost 2021,
  Cappart 2023.

### Docs
- New `docs/frameworks/04_scheduling.md` (CPIT/PCPSP formulation, the BZ LP relaxation, the duality to
  the ultimate pit, capacity constraints, verified DOIs). Deepened `docs/frameworks/01_optimiser.md`
  with the max-closure/min-cut LP-duality derivation and the parametric-pseudoflow honesty note.
- Methodology "Scheduling frontier" subtab; Experiments certified-gap table + the two control rows.

## [0.08.002], 2026-07-07

### Added
- Footer provenance + disclaimer (ADR-0016 §2): the real lane cites the MineLib source
  (Espinoza, Goycoolea, Moreno & Newman 2013, doi:10.1007/s10479-012-1258-3) and its academic-only
  license, names the exact min-cut engine, and states the honest scope (min-cut is the authority;
  the ONNX models are triage; not for production planning). Bilingual EN/ES.

### Fixed
- Corrected double-encoded (mojibake) characters in the Spanish nav labels (Introduccion,
  Metodologia, Implementacion now render with correct accents) and in the pipeline package docstring.
- In-app version string synced to the release (footer read 0.08.000, one patch behind the tag).

## [0.08.001], 2026-07-04

### Changed
- Content standards (ADR-0067): removed every em-dash from tracked content (replaced with commas, or
  "n/a" in table cells). No behaviour change.
- Added `scripts/check_content_standards.py` and wired it into the CI `guards` job so the repo cannot
  regress on em-dashes or emojis.

## [0.08.000], 2026-07-04

### Added, synthetic MineLib twins in the real-mode lane (#34, via oreblocks)
- Three committed synthetic MineLib-format twins (porphyry 16x16x8, vein 20x20x10, core+halo
  22x22x10) generated by the oreblocks package: a seeded deposit, UPIT economics, slope precedence,
  solved to the EXACT ultimate pit, written as .blocks/.prec/.upit with the optimum STAMPED in a
  meta sidecar. They are OUR data (no MineLib license), so unlike the published instances they are
  committed under frontend/public/twins/ and served locally.
- The real-mode instance picker now splits into "published · MineLib" and "synthetic twins ·
  oreblocks" groups. `RealCase.synthetic` flags the twins; the panel says "stamped optimum" (not
  "published") for them. The SAME exact engine reproduces each twin's stamped optimum in the browser
  (porphyry-s: 126,908,454 in 4 ms), giving realistic mid-size instances with a known-by-construction
  oracle and no license attached.
- License posture preserved: the remote-HTTPS-only test now applies to published instances; synthetic
  twins are exempt (local, committable). +oracle tests (each twin reproduces its stamped optimum via
  the TS engine, rel <=1e-6) + registry guards. gen-twins.py regenerates them (pip install oreblocks).
  Build + tests green; live-verified.

## [0.07.001], 2026-07-03

### Changed
- **Case selector restructured as category tabs** (#33, Felipe's review): the four stacked
  category chip groups collapse into a compact tab row (archetype / economics / slope /
  oracle) showing one group at a time; a dot marks the tab holding the ACTIVE case; the
  open tab follows the active case on switches/resets; the caption (name + expected band)
  stays always visible.

## [0.07.000], 2026-07-03

The Faena real-workbench release (epic #18, issues #11–#17 + #26): PitForge now opens REAL published
block models and reproduces their published optima, alongside the synthetic teaching lane.

### Added
- **First-level SOURCE selector** (App): `synthetic (seeded)` (4 archetypes + econ/slope scenarios + the CTRL
  oracle) vs `real · MineLib` (published benchmark instances; you only pick the instance). (#12, PR #24)
- **Real MineLib lane, exact and live** (#13, PR #25; #17, PR #29): `.blocks/.prec/.upit` parsers (formats
  verified against live mirror bytes), `solveUpitExplicit()` (Picard → Dinic on the published explicit
  precedence, closure + value-identity self-checks), sparse bounding-box embedding for the standard viz.
  **All three mirror-verified instances reproduce their published UPIT optimum**: newman1 26,086,899
  (rel 1.0e-9, 5 ms) · zuck_small 1,422,726,898 (rel 1.9e-10, 237 ms) · kd 652,195,037 (rel 1.3e-10, 259 ms).
  newman1 solves on select; zuck_small/kd behind an explicit size-gate confirm (in-browser 272/317 ms).
  License posture enforced in code: runtime fetch into browser memory only, gitignored local cache for the
  offline bake, instance files never committed or redistributed (MineLib grants academic download only).
- **CONTRACT-1 drag-drop** (#14/#15, PR #27): `lib/contractLive.ts` mirrors the Python block rules 1:1
  (drift-guarded by shared-fixture tests); drop a `{ix,iy,iz,tonnage,density,grade}` CSV → accept/reject/flag
  report with row reasons → the WHOLE App re-solves on your model with the live Controls econ.
- **Learned models as working tools** (#16, PR #28): `Infill · what-if` (drilling density → grade-nn ONNX +
  IDW baseline infill → the EXACT pit re-solved per estimated deposit; pit-value delta + RMSE readout) and
  `Surrogate · preview` (instant P(in-pit) heatmap vs the exact outline + live agreement %, honest TRIAGE
  framing). grade-nn retrained on mixed-density stencils (full + random-dropout) so partial drilling is in
  distribution: held-out R² 0.9613 vs IDW 0.9129 vs OK 0.958; pit-surrogate AUC 0.9811.
- **Benchmark: Real MineLib (UPIT) table** (#17): our exact value vs the published optimum, rel error, solve
  times; marvin / mclaughlin_limit / mclaughlin excluded WITH reasons. Offline bake (`bake-minelib.mjs`,
  local-only, never CI) writes summary numbers only.
- Citations: Espinoza, Goycoolea, Moreno & Newman 2013 (MineLib, doi:10.1007/s10479-012-1258-3).

### Changed
- **Meta-tabs removed from the App** (#16/#12): `learned` metrics table (now Benchmark-only), `contract · gate`
  and `raw trace` (manifests/traces/CI drift gate all stay; the honesty statement moved into the Architecture
  ⓘ modal). The prose-only `bring your own` tab became the working upload panel.
- Real mode locks RF / price× / slope° with an explanatory tooltip (the instance publishes explicit precedence
  + net values; re-deriving them would break published-optimum comparability). Row-Y / 3-D mode stay live.

### Fixed
- **PitView3D on-demand rendering** (#26, PR #30): the unconditional rAF loop is gone, a wall-clock budget per
  gesture (damping's self-inflicted change events can never refill it), halt on hidden tabs, repaint on
  visibility/context restore. Measured: idle 0 frames / drag 43 / post-drag idle 0.

## [0.06.000], 2026-06-21

First complete build of PitForge on the CAOS product-repo archetype (ADR-0057).

### Added
- **The exact ultimate-pit engine** (`frontend/src/opt/`), a dependency-free TypeScript min-cut/max-flow solver
  (Dinic) implementing the Lerchs–Grossmann ultimate pit via Picard’s max-closure reduction, the slope-precedence
  cone, the floating-cutoff block-value model, and the Whittle nested-shell parameterisation. Runs **live in the
  browser** and in the offline Node bake (no Python re-port). Verified by a hand-computed inverted-pyramid oracle.
- **Two data contracts**, CONTRACT 1 (`io/contract.py`: scenario + real block-model ingestion with an outlier
  policy) and CONTRACT 2 (`core/manifest.py` `pitforge.manifest/v2` + `core/trace.py` `pitforge.trace/v1`), with a
  TS mirror (`frontend/src/lib/contract.types.ts`) that fails `tsc` on drift.
- **9 cases by category** (`cases/pit_cases.py`): 4 deposit archetypes, 2 economic scenarios, 2 slope scenarios,
  and the `CTRL` closed-form oracle, mirroring `frontend/src/opt/cases.ts`.
- **numpy-light pipeline** (`pipeline.pipeline`) that reshapes the committed `case-results.json` (baked by the TS solver)
  into per-case replay traces + manifests; a two-language `--retrain` lane (Node bake → torch train → ONNX).
- **The frontend SPA**, the 6 standard pages (App · Introduction · Methodology · Implementation · Experiments ·
  Benchmark) on the shared `@fasl-work/caos-app-shell`. The App re-solves the exact pit live as you drag RF / price /
  slope, with 11 reacting tabs (3-D voxel pit via three.js, vertical section, Whittle curves via uPlot, pushbacks,
  grade–tonnage, block-value histogram, the live learned-model panel, contract·gate, bring-your-own, raw trace).
- **Two honest learned models** (torch → ONNX, live via onnxruntime-web): a grade-NN estimator (vs IDW + Ordinary
  Kriging, held-out R²) and a pit-inclusion surrogate (vs the exact solver, AUC/accuracy). Held-out: grade-NN
  R² 0.999 (vs IDW 0.936 / OK 0.991); pit-surrogate AUC 0.984 / acc 0.919 (vs majority 0.757).
- The `docs/` wiki (ADR-0056), CI (`ci.yml` Python + frontend) + `deploy-pages.yml`, the cross-platform `scripts/`,
  the two-venv split, and the root `README` / `STRUCTURE` / `LICENSES` / `ATTRIBUTION`.

### Verified running
ruff clean · pytest 9/9 · `pipeline.pipeline all` (9 cases) · CONTRACT 2 OK · byte-identical re-run · npm test 9/9
(engine 5 + contract 4) · `npm run build` green.
