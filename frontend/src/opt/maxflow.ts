// Dinic's maximum-flow / minimum-cut, the exact engine under the ultimate-pit solver.
//
// The ultimate-pit (Lerchs–Grossmann) problem is the maximum-weight CLOSURE of the block-precedence graph, and
// maximum closure reduces to a minimum s–t cut (Picard 1976): the blocks on the SOURCE side of the min cut are the
// optimal pit. We solve the equivalent max-flow with Dinic's algorithm, exact, deterministic, O(V²E) worst case but
// near-linear on these sparse precedence graphs, and fast enough in the browser for teaching-scale models. This is
// the same min-cut that Hochbaum's pseudoflow computes; we keep the implementation transparent and self-checking.
//
// Capacities are doubles. A precedence arc carries INF (a value larger than the total positive block value, so the
// cut can never pass through it). EPS guards float residuals.

const EPS = 1e-7;

export class MaxFlow {
  private readonly n: number;
  private readonly to: number[] = [];
  private readonly cap: number[] = [];
  private readonly first: number[]; // head of the adjacency linked list per node
  private readonly next: number[] = [];
  private readonly level: Int32Array;
  private readonly it: Int32Array; // current-arc iterator for the blocking-flow DFS

  constructor(n: number) {
    this.n = n;
    this.first = new Array(n).fill(-1);
    this.level = new Int32Array(n);
    this.it = new Int32Array(n);
  }

  /** Directed arc u→v with capacity `c` (≥0), plus its residual reverse arc v→u with capacity 0. */
  addEdge(u: number, v: number, c: number): void {
    this.to.push(v);
    this.cap.push(c);
    this.next.push(this.first[u]);
    this.first[u] = this.to.length - 1;

    this.to.push(u);
    this.cap.push(0);
    this.next.push(this.first[v]);
    this.first[v] = this.to.length - 1;
  }

  private bfs(s: number, t: number): boolean {
    this.level.fill(-1);
    const q = new Int32Array(this.n);
    let head = 0;
    let tail = 0;
    this.level[s] = 0;
    q[tail++] = s;
    while (head < tail) {
      const u = q[head++];
      for (let e = this.first[u]; e !== -1; e = this.next[e]) {
        if (this.cap[e] > EPS && this.level[this.to[e]] < 0) {
          this.level[this.to[e]] = this.level[u] + 1;
          q[tail++] = this.to[e];
        }
      }
    }
    return this.level[t] >= 0;
  }

  private dfs(u: number, t: number, f: number): number {
    if (u === t) return f;
    for (; this.it[u] !== -1; this.it[u] = this.next[this.it[u]]) {
      const e = this.it[u];
      const v = this.to[e];
      if (this.cap[e] > EPS && this.level[v] === this.level[u] + 1) {
        const d = this.dfs(v, t, Math.min(f, this.cap[e]));
        if (d > EPS) {
          this.cap[e] -= d;
          this.cap[e ^ 1] += d;
          return d;
        }
      }
    }
    return 0;
  }

  /** Returns the maximum flow from s to t. The residual graph left behind encodes the min cut. */
  maxflow(s: number, t: number): number {
    let flow = 0;
    while (this.bfs(s, t)) {
      for (let i = 0; i < this.n; i++) this.it[i] = this.first[i];
      let f: number;
      // Use a large finite "infinite" push bound, INF caps already bound real flow.
      while ((f = this.dfs(s, t, Number.MAX_VALUE)) > EPS) flow += f;
    }
    return flow;
  }

  /** Nodes reachable from s in the residual graph = the SOURCE side of the min cut. Call AFTER maxflow(). */
  minCutReachable(s: number): Uint8Array {
    const seen = new Uint8Array(this.n);
    const q = new Int32Array(this.n);
    let head = 0;
    let tail = 0;
    seen[s] = 1;
    q[tail++] = s;
    while (head < tail) {
      const u = q[head++];
      for (let e = this.first[u]; e !== -1; e = this.next[e]) {
        if (this.cap[e] > EPS && !seen[this.to[e]]) {
          seen[this.to[e]] = 1;
          q[tail++] = this.to[e];
        }
      }
    }
    return seen;
  }
}
