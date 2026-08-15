# Determinism and the replay trace

The TypeScript case bake is a pure function of the canonical case definitions and their explicit seeds. It rounds
the solver summaries at the artifact boundary, writes compact JSON, and is checked in CI by regenerating
`data/derived/case-results.json`, every replay trace, and every manifest before requiring a clean diff.

`data-pipeline/pipeline/core/trace.py` builds `pitforge.trace/v1`. A trace contains the selected case specification,
ultimate-pit summary, full 12-point revenue-factor curve, centre cross-section, grade summary, and an explicitly
corpus-scoped reference to the learned-model metrics. It does not claim to contain raw solver state or a decimated
trajectory.

The production Experiments page loads `pitforge.index/v1`, then each declared manifest and trace. Runtime parsers in
`frontend/src/lib/artifacts.ts` reject schema, identity, path, lane, and required-field drift before rendering. The
same parsers are exercised against every committed record by `frontend/test/contract.test.ts`.

Wall-clock measurements are not deterministic. `npm run benchmark` creates the separately reviewed
`runtime-benchmarks.json` evidence record; deterministic manifest regeneration consumes that fixed record rather
than rewriting timings on every build. Raw training-table floats can vary in their last machine-level bits across
JavaScript/runtime versions, so learned-model retraining is a deliberate review event, not part of routine CI.
