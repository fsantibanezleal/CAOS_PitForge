"""PitForge cases spanning CATEGORIES (the open-pit design problem-type taxonomy). The App shows ONE selected case;
Experiments/Benchmark show cross-case summaries by category. The 9 cases mirror the SPA's src/opt/cases.ts. All
deposits are SYNTHETIC (seeded) — stated openly; CTRL is the closed-form ORACLE control (the optimal pit is exactly
the 9-block inverted pyramid, value 10 − 8 = 2)."""
from __future__ import annotations

from dataclasses import dataclass

CAT_ARCH = "deposit archetype (the orebody shape)"
CAT_ECON = "economic scenario (the price/cost regime)"
CAT_SLOPE = "slope / geotech (the wall angle)"
CAT_ORACLE = "oracle control (closed-form check)"


@dataclass(frozen=True)
class Case:
    id: str                       # matches src/opt/cases.ts CASES
    name: str
    category: str
    archetype: str                # one of schema.ARCHETYPES ('oracle' for CTRL)
    nx: int
    ny: int
    nz: int
    price: float
    recovery: float
    mining_cost: float
    processing_cost: float
    slope_angle_deg: float
    expected_band: str
    validation_anchor: str
    real_or_synthetic: str = "synthetic"


_D = (24, 24, 12)            # the standard teaching grid
_BASE = dict(recovery=0.88, mining_cost=2.5, processing_cost=9.0, slope_angle_deg=45.0)

CASES: list[Case] = [
    Case("A01", "Porphyry copper (disseminated shell)", CAT_ARCH, "porphyry", *_D, price=9000, **_BASE,
         expected_band="a broad bowl pit centred on the buried ore shell; moderate strip ratio",
         validation_anchor="value identity (ΣpositiveValue − maxflow) + monotone nested shells"),
    Case("A02", "Tabular vein (dipping)", CAT_ARCH, "vein", *_D, price=9000, **_BASE,
         expected_band="a narrow, steep-walled pit tracking the inclined vein; high strip",
         validation_anchor="precedence cone honoured (no overhang)"),
    Case("A03", "Layered stratabound", CAT_ARCH, "layered", *_D, price=9000, **_BASE,
         expected_band="a wide shallow pit stopping at the first uneconomic band",
         validation_anchor="shell nesting"),
    Case("A04", "High-grade core + low-grade halo", CAT_ARCH, "coreHalo", *_D, price=9000, **_BASE,
         expected_band="a deep central pit; the halo enters only at high revenue factors",
         validation_anchor="RF-driven halo inclusion"),
    Case("E01", "Low price ($5 500/t)", CAT_ECON, "porphyry", *_D, price=5500, **_BASE,
         expected_band="a markedly smaller pit — only the richest core pays",
         validation_anchor="pit ⊂ the base-price pit"),
    Case("E02", "High price ($14 000/t)", CAT_ECON, "porphyry", *_D, price=14000, **_BASE,
         expected_band="a larger pit — lower-grade material becomes ore",
         validation_anchor="pit ⊃ the base-price pit"),
    Case("G01", "Shallow walls (30°)", CAT_SLOPE, "porphyry", *_D, price=9000,
         recovery=0.88, mining_cost=2.5, processing_cost=9.0, slope_angle_deg=30.0,
         expected_band="flatter walls → more waste stripping per tonne of ore → lower value than the 45° base",
         validation_anchor="value ≤ the 45° base pit (more stripping)"),
    Case("G02", "Very shallow walls (18°)", CAT_SLOPE, "porphyry", *_D, price=9000,
         recovery=0.88, mining_cost=2.5, processing_cost=9.0, slope_angle_deg=18.0,
         expected_band="the flattest walls → the widest cone and the most stripping → the lowest value",
         validation_anchor="value ≤ the 30° pit (even more stripping)"),
    Case("CTRL", "Oracle — single deep ore block (45°)", CAT_ORACLE, "oracle", 5, 1, 3, price=11.0,
         recovery=1.0, mining_cost=1.0, processing_cost=0.0, slope_angle_deg=45.0,
         expected_band="the optimal pit is EXACTLY the 9-block inverted pyramid; value = 10 − 8 = 2",
         validation_anchor="closed-form inverted pyramid (hand-computed)", real_or_synthetic="analytic control"),
]
