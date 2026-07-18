# Guide, bring your own block model

PitForge is built to open **your** block model, not just the baked synthetic cases. The gate is Contract 1
(`pflab/io/contract.py`); the schema + outlier policy are documented in [data-contracts](../architecture/08_data-contracts.md)
and `data/README.md`. The App also accepts the same CSV directly: drag & drop it onto the **Bring your own** tab
(Contract-1 validation mirrored in the browser; every tab then re-solves on your model). This guide covers the
Python lane.

## The block-model schema

A CSV (or any table) with one row per block:

| column | unit | rule |
|---|---|---|
| `ix, iy, iz` | block indices (z increases downward) | integers; inside the model box; no duplicates |
| `tonnage` | tonnes | `> 0` |
| `density` | t/m³ | `> 0` |
| `grade` | **mass fraction** (e.g. 0.012 = 1.2 % Cu) | `[0, 1]`; `> 0.5` is flagged as implausibly rich |

A tiny valid example ships at `data/examples/blockmodel.csv`.

## Validate it

```python
from pflab.io.contract import validate_blocks
from pflab.io.formats import read_csv_rows

rep = validate_blocks(read_csv_rows("my_blocks.csv"), dims=(nx, ny, nz))
print(rep.summary())          # "N accepted, M rejected, K flagged"
for r in rep.rejected: print("REJECT", r["reason"])
for f in rep.flagged:  print("FLAG  ", f["flags"])
```

Bad rows are **rejected with a reason** (never silently coerced); suspicious-but-usable rows are **flagged** (accepted;
the flag is recorded). Once your blocks pass, set the economics (price, recovery, mining/processing cost) and the
slope, and the same TS optimiser that powers the App computes your ultimate pit + nested shells.

## What to check first

- **Units**, grade must be a *mass fraction*, not a percentage or ppm. A 1.2 % block is `0.012`, not `1.2`.
- **Orientation**, `iz = 0` is the **top** bench (surface); the slope cone opens upward against increasing `iz`.
- **Economics**, the floating cutoff is implicit in the costs; a block is ore iff `RF·revenue > processingCost·tonnage`
  (see [the optimiser](../frameworks/01_optimiser.md)).
