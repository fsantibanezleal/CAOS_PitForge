"""Typed objects passed between pipeline stages — the inter-stage contract. Plain dataclasses (no heavy deps)."""
from __future__ import annotations

from dataclasses import dataclass

ARCHETYPES = ("porphyry", "vein", "layered", "coreHalo", "oracle")  # the deposit shapes (matches frontend cases.ts)


@dataclass(frozen=True)
class PitScenario:
    """One validated open-pit design scenario (CONTRACT 1 output) — the orebody grid + the economic/geotech regime.

    This is the case-level descriptor the pipeline reads. The per-BLOCK bring-your-own-data path is validated by the
    same module (io.contract.validate_blocks) against the block schema documented in data/README.md.
    """

    case_id: str
    archetype: str            # one of ARCHETYPES
    nx: int
    ny: int
    nz: int
    price: float              # $ per tonne of recovered metal
    recovery: float           # 0..1
    mining_cost: float        # $/t mined
    processing_cost: float    # $/t milled
    slope_angle_deg: float
    flags: tuple[str, ...] = ()
