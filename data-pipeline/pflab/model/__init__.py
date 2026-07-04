"""The learned-model contracts. PitForge's analytic core (the exact ultimate-pit optimiser) is the TypeScript engine
in frontend/src/opt/, it is NOT re-implemented in Python. This package only declares the FEATURE contracts of the
two learned models so the offline trainer (science/train_pit.py) and the in-browser inference (frontend) agree
byte-for-byte. See model/learned.py."""
