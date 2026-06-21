# The live / precompute gate

`pflab/core/gate.py` records, per case, whether it runs **live** (client-side) or falls back to **replay** of the
committed trace (ADR-0054). It is a **measurement written into the manifest**, never a hand-wave; `scripts/
check_artifacts.py` + CI fail on a mislabelled lane.

```python
classify_lane(client_side=True,
              runtimes={"ts-pseudoflow", "onnxruntime-web"},
              run_ms=...,            # a full solve + nested shells, measured
              trace_bytes=...)       # the committed per-case trace size
```

A case is **live** iff:

1. it is **client-side** (no server needed), and
2. its runtimes are a subset of the deployed client set `{ts-pseudoflow, onnxruntime-web}`, and
3. a full solve completes within the interaction budget (`RUN_MS_GATE = 1500 ms`), and
4. its replay trace stays small (`TRACE_BYTES_GATE = 256 KB`).

At teaching scale (≈7 000 blocks) a full ultimate-pit + nested-shell solve is tens of milliseconds and the trace is a
few KB, so **every case is LIVE**. A much larger block model (hundreds of thousands of blocks) would blow the runtime
budget — the gate would mark it **precompute** and the App would replay the baked pit instead of re-solving.

The verdict + the (deterministic) budgets go into the manifest; the raw wall-clock is used for the decision but never
stored (it would dirty git on re-run — see [determinism](02_determinism-and-trace.md)).
