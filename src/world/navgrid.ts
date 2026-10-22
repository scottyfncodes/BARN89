import type { Vec } from '../core/math';
import type { CollisionWorld } from './collision';

/**
 * Walkability grid used for kitten pathfinding (A*) and for rescuing anything that ends up
 * wedged inside geometry. Built once per level from the collision world.
 */
export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  readonly blocked: Uint8Array;
  private readonly g: Float32Array;
  private readonly parent: Int32Array;
  private readonly closed: Uint32Array;
  private readonly openStamp: Uint32Array;
  private search = 0;

  constructor(
    private readonly world: CollisionWorld,
    readonly cell: number,
    readonly agentRadius: number,
  ) {
    this.cols = Math.ceil(world.width / cell);
    this.rows = Math.ceil(world.height / cell);
    const n = this.cols * this.rows;
    this.blocked = new Uint8Array(n);
    this.g = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.closed = new Uint32Array(n);
    this.openStamp = new Uint32Array(n);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = (c + 0.5) * cell;
        const y = (r + 0.5) * cell;
        this.blocked[r * this.cols + c] = world.isFree(x, y, agentRadius) ? 0 : 1;
      }
    }
  }

  index(x: number, y: number): number {
    const c = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cell)));
    const r = Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cell)));
    return r * this.cols + c;
  }

  center(idx: number): Vec {
    return { x: ((idx % this.cols) + 0.5) * this.cell, y: (Math.floor(idx / this.cols) + 0.5) * this.cell };
  }

  isWalkable(x: number, y: number): boolean {
    return this.blocked[this.index(x, y)] === 0;
  }

  /** Breadth-first search outward for the closest walkable cell centre. */
  nearestWalkable(x: number, y: number, maxRings = 40): Vec | null {
    const c0 = Math.floor(x / this.cell);
    const r0 = Math.floor(y / this.cell);
    let best: Vec | null = null;
    let bestD = Infinity;
    for (let ring = 0; ring <= maxRings; ring++) {
      for (let dr = -ring; dr <= ring; dr++) {
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
          const c = c0 + dc;
          const r = r0 + dr;
          if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
          const idx = r * this.cols + c;
          if (this.blocked[idx]) continue;
          const p = this.center(idx);
          const d = Math.hypot(p.x - x, p.y - y);
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /**
   * A* from `from` to `to`. Returns smoothed world-space waypoints (excluding the start),
   * or null when unreachable. `maxNodes` bounds the cost on a phone.
   */
  findPath(from: Vec, to: Vec, maxNodes = 6000): Vec[] | null {
    let start = this.index(from.x, from.y);
    let goal = this.index(to.x, to.y);
    if (this.blocked[start]) {
      const p = this.nearestWalkable(from.x, from.y, 6);
      if (!p) return null;
      start = this.index(p.x, p.y);
    }
    if (this.blocked[goal]) {
      const p = this.nearestWalkable(to.x, to.y, 6);
      if (!p) return null;
      goal = this.index(p.x, p.y);
    }
    if (start === goal) return [{ x: to.x, y: to.y }];

    const s = ++this.search;
    const cols = this.cols;
    const gx = goal % cols;
    const gy = Math.floor(goal / cols);
    const heap = new MinHeap();
    this.g[start] = 0;
    this.parent[start] = -1;
    this.openStamp[start] = s;
    heap.push(start, 0);
    let expanded = 0;
    let found = false;

    while (heap.size > 0) {
      const cur = heap.pop();
      if (this.closed[cur] === s) continue;
      this.closed[cur] = s;
      if (cur === goal) {
        found = true;
        break;
      }
      if (++expanded > maxNodes) break;
      const cx = cur % cols;
      const cy = Math.floor(cur / cols);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= this.rows) continue;
          const ni = ny * cols + nx;
          if (this.blocked[ni] || this.closed[ni] === s) continue;
          // No corner cutting through blocked diagonals.
          if (dx && dy && (this.blocked[cy * cols + nx] || this.blocked[ny * cols + cx])) continue;
          const step = dx && dy ? Math.SQRT2 : 1;
          const ng = this.g[cur] + step;
          if (this.openStamp[ni] === s && ng >= this.g[ni]) continue;
          this.openStamp[ni] = s;
          this.g[ni] = ng;
          this.parent[ni] = cur;
          const hx = Math.abs(nx - gx);
          const hy = Math.abs(ny - gy);
          const h = Math.max(hx, hy) + (Math.SQRT2 - 1) * Math.min(hx, hy);
          heap.push(ni, ng + h);
        }
      }
    }
    if (!found) return null;

    const cells: Vec[] = [];
    for (let i = goal; i !== -1 && i !== start; i = this.parent[i]) cells.push(this.center(i));
    cells.reverse();
    cells[cells.length - 1] = { x: to.x, y: to.y };
    return this.smooth(from, cells);
  }

  /** String-pulling: drop waypoints that can be skipped with a clear straight line. */
  private smooth(from: Vec, pts: Vec[]): Vec[] {
    const out: Vec[] = [];
    let anchor = from;
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.world.clearPath(anchor.x, anchor.y, pts[j].x, pts[j].y, this.agentRadius * 0.9)) j--;
      out.push(pts[j]);
      anchor = pts[j];
      i = j + 1;
    }
    return out;
  }

  /** Flood fill connectivity check (used by level validation tests). */
  reachable(a: Vec, b: Vec): boolean {
    const start = this.index(a.x, a.y);
    const goal = this.index(b.x, b.y);
    if (this.blocked[start] || this.blocked[goal]) return false;
    const seen = new Uint8Array(this.blocked.length);
    const queue = [start];
    seen[start] = 1;
    while (queue.length) {
      const cur = queue.pop()!;
      if (cur === goal) return true;
      const cx = cur % this.cols;
      const cy = Math.floor(cur / this.cols);
      const nbrs = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ];
      for (const [nx, ny] of nbrs) {
        if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
        const ni = ny * this.cols + nx;
        if (seen[ni] || this.blocked[ni]) continue;
        seen[ni] = 1;
        queue.push(ni);
      }
    }
    return false;
  }
}

class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size(): number {
    return this.ids.length;
  }
  push(id: number, key: number): void {
    const ids = this.ids;
    const keys = this.keys;
    let i = ids.length;
    ids.push(id);
    keys.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      ids[i] = ids[p];
      keys[i] = keys[p];
      i = p;
    }
    ids[i] = id;
    keys[i] = key;
  }
  pop(): number {
    const ids = this.ids;
    const keys = this.keys;
    const top = ids[0];
    const lastId = ids.pop()!;
    const lastKey = keys.pop()!;
    const n = ids.length;
    if (n > 0) {
      let i = 0;
      while (true) {
        const l = i * 2 + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && keys[r] < keys[l] ? r : l;
        if (keys[c] >= lastKey) break;
        ids[i] = ids[c];
        keys[i] = keys[c];
        i = c;
      }
      ids[i] = lastId;
      keys[i] = lastKey;
    }
    return top;
  }
}
