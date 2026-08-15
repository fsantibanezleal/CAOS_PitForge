# Model evaluation

PitForge has two kinds of "model": the **exact optimiser** (the headline) and **two learned models** (honest, fast
baselines). Each is evaluated differently.

## The optimiser, exactness, not accuracy

The ultimate pit is an exact combinatorial result, so it is checked for **correctness**, not fit:

- **Value identity**, every solve asserts `pitValue == Σ positiveValue − maxflow` (the min-cut value), within a
  float epsilon. A bug in the graph construction or the flow would break it.
- **The `CTRL` oracle**, a 5×1×3 model with one deep ore block under a 45° slope. The optimal pit is, by hand, the
  9-block inverted pyramid with value `10 − 8 = 2`. The engine reproduces it exactly (`frontend/test/opt.test.ts`).
- **Monotone nesting**, `nestedPitShells` is checked to be monotone (a higher revenue factor never yields a smaller
  pit), and the economic/slope cases satisfy their anchors (low price ⊂ base ⊂ high price; flatter walls give lower value).

## The learned models, held-out, vs a classical baseline

Both are trained offline (`science/train_pit.py`, torch) and reported next to the baseline they would replace. The
metrics live in `data/derived/pit-learned.json` and show in Benchmark; the models run live in the App’s
**Infill · what-if** (grade-NN) and **Surrogate · preview** (pit-surrogate) tabs.

| Model | Task | Baseline | Held-out metric (this build) |
|---|---|---|---|
| `grade-nn` | masked 3×3×3 grade stencil → centre grade | IDW · Ordinary Kriging | **R² 0.8757** vs IDW 0.8591 / OK 0.9333 |
| `pit-surrogate` | 4 block features → P(block ∈ pit) | exact labels; majority reference | **AUC 0.9123 · acc 0.8294** vs AUC 0.5 / majority acc 0.6428 |

**Honesty.** The deterministic split leaves the vein geology out entirely. Full and random-dropout stencil pairs
share a group and can never cross the boundary. On that unseen geology, the NN narrowly beats IDW but trails Ordinary
Kriging; it is not a geostatistical win. The pit surrogate is useful at AUC 0.9123 but **not** the exact answer. The
App shows its agreement with the exact pit per section, and the exact min-cut is always the authority. No metric is
computed on training data and no reused porphyry geometry leaks into evaluation.
