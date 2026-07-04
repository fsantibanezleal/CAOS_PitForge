# Cases + categories

Each case (`data-pipeline/pflab/cases/pit_cases.py`, mirrored in `frontend/src/opt/cases.ts`) declares a
**CATEGORY**, its parameters, an **expected band** (what a domain reader should see), a **validation anchor** (a
property the result MUST satisfy, checked in `frontend/test/contract.test.ts`), and a real|synthetic flag. The **App
shows ONE selected case**; **Experiments/Benchmark show cross-case summaries** (never mixed into the App).

## The 9-case matrix

| id | category | deposit / regime | validation anchor |
|---|---|---|---|
| `A01` | deposit archetype | porphyry copper (disseminated shell) | value identity + monotone nested shells |
| `A02` | deposit archetype | tabular dipping vein | precedence cone honoured (no overhang) |
| `A03` | deposit archetype | layered stratabound | shell nesting |
| `A04` | deposit archetype | high-grade core + low-grade halo | halo enters only at high RF |
| `E01` | economic scenario | low price ($5 500/t) | pit ⊂ the base-price pit |
| `E02` | economic scenario | high price ($14 000/t) | pit ⊃ the base-price pit |
| `G01` | slope / geotech | shallow walls (30°) | value ≤ the 45° base (more stripping) |
| `G02` | slope / geotech | very shallow walls (18°) | value ≤ the 30° pit |
| `CTRL` | oracle control | single deep ore block (5×1×3, 45°) | **closed-form**: the 9-block inverted pyramid, value 2 |

The archetypes vary the **geology**; the economic + slope cases reuse the porphyry geology and vary the **decision**,
so the cross-case comparisons isolate one axis at a time. `CTRL` is the exactness anchor, its optimum is computable
by hand, so any regression in the solver is caught immediately.
