# Model evaluation

PitForge has two kinds of "model": the **exact optimiser** (the headline) and **two learned models** (honest, fast
baselines). Each is evaluated differently.

## The optimiser — exactness, not accuracy

The ultimate pit is an EXACT combinatorial result, so it is checked for **correctness**, not fit:

- **Value identity** — every solve asserts `pitValue == Σ positiveValue − maxflow` (the min-cut value), within a
  float epsilon. A bug in the graph construction or the flow would break it.
- **The `CTRL` oracle** — a 5×1×3 model with one deep ore block under a 45° slope. The optimal pit is, by hand, the
  9-block inverted pyramid with value `10 − 8 = 2`. The engine reproduces it exactly (`frontend/test/opt.test.ts`).
- **Monotone nesting** — `nestedPitShells` is checked to be monotone (a higher revenue factor never yields a smaller
  pit), and the economic/slope cases satisfy their anchors (low price ⊂ base ⊂ high price; flatter walls → lower value).

## The learned models — held-out, vs a classical baseline

Both are trained offline (`science/train_pit.py`, torch) and reported next to the baseline they would replace. The
metrics live in `data/derived/pit-learned.json` and show in the App’s Learned-models tab + Benchmark.

| Model | Task | Baseline | Held-out metric (this build) |
|---|---|---|---|
| `grade-nn` | masked 3×3×3 grade stencil → centre grade | IDW · Ordinary Kriging | **R² 0.999** vs IDW 0.936 / OK 0.991 |
| `pit-surrogate` | 4 block features → P(block ∈ pit) | the EXACT min-cut | **AUC 0.984 · acc 0.919** vs majority 0.757 |

**Honesty.** On the smooth synthetic fields the local grade is highly predictable, so all three grade methods score
high — the NN is *competitive* with geostatistics, not a dramatic win. The pit-surrogate is a strong fast
approximation (AUC 0.98) but **not** the exact answer; the App shows its agreement with the exact pit per section, and
the exact min-cut is always the authority. No metric is computed on training data; the split is a held-out fraction.
