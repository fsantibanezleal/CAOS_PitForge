"""Executable light-lane stages.

Contract-1 validation is orchestrated before writes in :mod:`pipeline.pipeline`; :mod:`export` builds each replay
trace, gate verdict, and manifest. Heavy case generation and model training are explicit programs under
``pipeline/science`` rather than empty stage placeholders.
"""
