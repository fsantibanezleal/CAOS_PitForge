"""Stage 1, preprocess (heavy lane): generate the synthetic deposit block models for the cases by running the SAME
TypeScript generator the browser uses (frontend/src/opt/blockmodel.ts, via tsx) and validate them through CONTRACT 1
(io.contract.validate_blocks). Delegates to the preserved science `pflab/science/bake_cases.mjs`, invoked by
`pipeline.retrain`. No Python re-port of the generator, the lesson from the sibling products."""
