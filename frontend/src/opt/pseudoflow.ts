// Exact maximum-weight closure through Hochbaum's normalized-tree pseudoflow method.
//
// This is an independent, closure-specialised implementation of the phase-one algorithm
// described in Hochbaum (2008), Operations Research 56(4), 992-1009,
// https://doi.org/10.1287/opre.1080.0524. It does not incorporate the separately
// distributed HPF reference source.
//
// Positive and negative node weights are represented by saturated source and sink arcs.
// Their imbalance is held as node excess. Precedence arcs begin with zero flow. The
// algorithm maintains a forest of normalised branches, merges a strong branch into a
// weak branch through a residual arc, reverses the strong path, and pushes its excess
// towards the weak root. Saturated tree arcs split branches. When no strong-to-weak
// residual arc remains, the union of strong branches is a minimum-cut source set and
// therefore the exact maximum closure.
//
// The paper's labelled variants improve the theoretical running time. This transparent
// rung deliberately uses a deterministic full merger scan: it is compact enough to
// inspect and gives an honest browser-side comparison with the production Dinic rung.

const EPS = 1e-7;

export interface PseudoflowStats {
  mergers: number;
  pushes: number;
  splits: number;
  arcScans: number;
}

export interface PseudoflowClosureResult {
  /** Source side of the minimum cut / selected maximum closure. */
  selected: Uint8Array;
  /** Minimum-cut value, equal to total positive weight minus closure value. */
  minCut: number;
  /** Sum of selected node weights. */
  closureValue: number;
  sumPositive: number;
  stats: PseudoflowStats;
}

interface Merger {
  strongNode: number;
  weakNode: number;
  edge: number;
}

/**
 * Solve a maximum-weight closure with precedence arcs `from[k] -> to[k]`.
 * Selecting `from[k]` requires selecting `to[k]`.
 *
 * `infiniteCapacity` must be strictly larger than the sum of positive weights.
 */
export function solveClosurePseudoflow(
  weight: Float64Array,
  from: Int32Array,
  to: Int32Array,
  infiniteCapacity: number,
): PseudoflowClosureResult {
  const n = weight.length;
  if (from.length !== to.length) throw new Error('pseudoflow: precedence endpoint lengths differ');
  if (!Number.isFinite(infiniteCapacity) || infiniteCapacity <= 0) {
    throw new Error('pseudoflow: infiniteCapacity must be finite and positive');
  }

  let sumPositive = 0;
  const excess = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const w = weight[i];
    if (!Number.isFinite(w)) throw new Error(`pseudoflow: non-finite weight at node ${i}`);
    excess[i] = w;
    if (w > 0) sumPositive += w;
  }
  if (!(infiniteCapacity > sumPositive)) {
    throw new Error(`pseudoflow: precedence capacity ${infiniteCapacity} must exceed positive sum ${sumPositive}`);
  }

  // The branch forest is oriented child -> parent -> root. A tree edge retains its
  // original directed endpoints; parentEdge only records which residual direction is
  // used from the child to its parent.
  const parent = new Int32Array(n).fill(-1);
  const parentEdge = new Int32Array(n).fill(-1);
  const flow = new Float64Array(from.length); // precedence arcs initialise at zero
  const roots = new Int32Array(n);
  const stats: PseudoflowStats = { mergers: 0, pushes: 0, splits: 0, arcScans: 0 };

  const residual = (edge: number, u: number, v: number): number => {
    if (from[edge] === u && to[edge] === v) return infiniteCapacity - flow[edge];
    if (to[edge] === u && from[edge] === v) return flow[edge];
    throw new Error(`pseudoflow: edge ${edge} does not join ${u} and ${v}`);
  };

  const push = (edge: number, u: number, v: number, amount: number): void => {
    if (from[edge] === u && to[edge] === v) flow[edge] += amount;
    else if (to[edge] === u && from[edge] === v) flow[edge] -= amount;
    else throw new Error(`pseudoflow: edge ${edge} does not join ${u} and ${v}`);
    // Guard accumulated floating-point dust without concealing a material violation.
    if (flow[edge] < 0 && flow[edge] > -EPS) flow[edge] = 0;
    if (flow[edge] > infiniteCapacity && flow[edge] < infiniteCapacity + EPS) flow[edge] = infiniteCapacity;
    if (flow[edge] < -EPS || flow[edge] > infiniteCapacity + EPS) {
      throw new Error(`pseudoflow: invalid flow ${flow[edge]} on edge ${edge}`);
    }
  };

  const computeRoots = (): void => {
    // Path compression is intentionally not used: parent links are the normalised tree
    // paths that merger inversion must preserve.
    for (let i = 0; i < n; i++) {
      let r = i;
      let hops = 0;
      while (parent[r] >= 0) {
        r = parent[r];
        if (++hops > n) throw new Error('pseudoflow: branch forest contains a cycle');
      }
      roots[i] = r;
    }
  };

  const findMerger = (): Merger | null => {
    computeRoots();
    for (let edge = 0; edge < from.length; edge++) {
      const u = from[edge];
      const v = to[edge];
      if (u < 0 || u >= n || v < 0 || v >= n) {
        throw new Error(`pseudoflow: precedence endpoint out of range on edge ${edge}`);
      }
      const ru = roots[u];
      const rv = roots[v];
      if (ru === rv) continue; // tree or out-of-tree arc internal to one branch
      stats.arcScans++;
      if (excess[ru] > EPS && excess[rv] <= EPS && infiniteCapacity - flow[edge] > EPS) {
        return { strongNode: u, weakNode: v, edge };
      }
      if (excess[rv] > EPS && excess[ru] <= EPS && flow[edge] > EPS) {
        return { strongNode: v, weakNode: u, edge };
      }
    }
    return null;
  };

  const merge = ({ strongNode, weakNode, edge }: Merger): number => {
    // Invert the path from the merger's strong node to its root, then attach that
    // node to the weak branch. The old strong root is returned for excess pushing.
    let current = strongNode;
    let newParent = weakNode;
    let newEdge = edge;
    while (parent[current] >= 0) {
      const oldParent = parent[current];
      const oldEdge = parentEdge[current];
      parent[current] = newParent;
      parentEdge[current] = newEdge;
      newParent = current;
      newEdge = oldEdge;
      current = oldParent;
    }
    parent[current] = newParent;
    parentEdge[current] = newEdge;
    stats.mergers++;
    return current;
  };

  const pushExcess = (oldStrongRoot: number): void => {
    let current = oldStrongRoot;
    while (excess[current] > EPS && parent[current] >= 0) {
      const next = parent[current];
      const edge = parentEdge[current];
      const available = residual(edge, current, next);
      if (available < -EPS) throw new Error(`pseudoflow: negative residual on tree edge ${edge}`);
      const amount = Math.min(excess[current], Math.max(0, available));
      if (amount > EPS) {
        push(edge, current, next, amount);
        excess[current] -= amount;
        excess[next] += amount;
        stats.pushes++;
      }
      // A strong remainder becomes a new root when the tree arc saturates.
      if (excess[current] > EPS && available - amount <= EPS) {
        parent[current] = -1;
        parentEdge[current] = -1;
        stats.splits++;
      }
      current = next;
    }
  };

  // Each merger removes one strong-to-weak residual connection; splits may expose new
  // strong branches. A conservative guard turns an implementation regression into a
  // visible failure rather than an unresponsive browser tab.
  const guard = Math.max(1, (n + from.length + 1) * (n + 1));
  for (let iteration = 0; ; iteration++) {
    if (iteration > guard) throw new Error(`pseudoflow: convergence guard exceeded (${guard})`);
    const merger = findMerger();
    if (!merger) break;
    pushExcess(merge(merger));
  }

  computeRoots();
  const selected = new Uint8Array(n);
  let closureValue = 0;
  for (let i = 0; i < n; i++) {
    if (excess[roots[i]] <= EPS) continue;
    selected[i] = 1;
    closureValue += weight[i];
  }

  // The returned partition must be a closure. Its cut must contain terminal arcs only.
  for (let edge = 0; edge < from.length; edge++) {
    if (selected[from[edge]] && !selected[to[edge]]) {
      throw new Error(`pseudoflow: closure violated on precedence ${from[edge]} -> ${to[edge]}`);
    }
  }
  const minCut = sumPositive - closureValue;
  if (minCut < -Math.max(EPS, sumPositive * 1e-12)) {
    throw new Error(`pseudoflow: negative cut ${minCut}`);
  }
  return { selected, minCut: Math.max(0, minCut), closureValue, sumPositive, stats };
}
