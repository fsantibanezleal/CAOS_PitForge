// PitForge engine, shared types for the ultimate-pit / nested-shells solver.
//
// A block model is a regular 3-D grid. The z index increases DOWNWARD (z=0 is the top bench / surface), which is the
// mining convention and the direction the slope-precedence cone opens against. All arrays are flat, length
// nx*ny*nz, indexed by `idx(ix,iy,iz) = (iz*ny + iy)*nx + ix`.

export interface GridDims {
  nx: number;
  ny: number;
  nz: number; // number of benches (z increases downward)
}

export interface BlockSize {
  dx: number; // metres
  dy: number;
  dz: number; // bench height
}

export interface BlockModel {
  dims: GridDims;
  block: BlockSize;
  /** mass of each block (tonnes) = dx*dy*dz*density. */
  tonnage: Float64Array;
  /** in-situ dry density (t/m³). */
  density: Float64Array;
  /** primary metal grade as a FRACTION of mass (e.g. 0.012 = 1.2 % Cu). */
  grade: Float64Array;
  meta: { name: string; archetype: string; gradeUnit: string };
}

/** Economic + geotech parameters. The block value model and the slope-precedence cone both read from here. */
export interface EconParams {
  /** $ per tonne of recovered metal (so revenue = price · tonnage · grade · recovery). */
  price: number;
  /** metallurgical recovery, 0..1. */
  recovery: number;
  /** $ per tonne MINED (paid by every block, ore or waste). */
  miningCost: number;
  /** $ per tonne MILLED (paid only by ore blocks sent to the plant). */
  processingCost: number;
  /** overall slope angle measured from horizontal, degrees. */
  slopeAngleDeg: number;
  /** Whittle revenue factor RF ∈ (0,1]; scales revenue only. Default 1. */
  revenueFactor?: number;
}

export interface PitResult {
  /** 1 if the block is inside the optimal pit, else 0. */
  inPit: Uint8Array;
  /** Σ block value over the pit = sumPositive − maxflow (the two are asserted equal). */
  pitValue: number;
  oreTonnes: number;
  wasteTonnes: number;
  /** recovered metal tonnes over the ore blocks in the pit. */
  metalTonnes: number;
  /** waste:ore mass ratio. */
  stripRatio: number;
  nBlocks: number;
  /** internal max-flow value (for the value identity check). */
  maxflow: number;
  sumPositive: number;
}

export interface WhittlePoint {
  rf: number;
  pitValue: number;
  oreTonnes: number;
  wasteTonnes: number;
  metalTonnes: number;
  stripRatio: number;
  nBlocks: number;
}

export interface ShellResult {
  /** the RF schedule (ascending). */
  rfs: number[];
  /** per block: index into `rfs` of the smallest shell it enters; -1 if it is never in any pit. */
  shellOf: Int32Array;
  /** one entry per RF: the pit summary at that revenue factor. */
  curve: WhittlePoint[];
}

/** Flat-array index helper. */
export function idx(d: GridDims, ix: number, iy: number, iz: number): number {
  return (iz * d.ny + iy) * d.nx + ix;
}

export function nBlocks(d: GridDims): number {
  return d.nx * d.ny * d.nz;
}
