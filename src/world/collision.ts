import type { Vec } from '../core/math';
import { circlePenetration, segmentHits, shapeBounds, type Shape } from './shapes';

/**
 * Static collision world: a uniform spatial hash of solid shapes plus the playable bounds.
 * Movement is resolved by pushing circles out of overlapping shapes, which gives natural
 * sliding along fences and walls.
 */
export class CollisionWorld {
  readonly shapes: Shape[];
  private readonly cell: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly buckets: number[][];
  private stamp = 1;
  private readonly seen: Uint32Array;

  constructor(
    shapes: Shape[],
    readonly width: number,
    readonly height: number,
    readonly margin: number,
    cell = 96,
  ) {
    this.shapes = shapes;
    this.cell = cell;
    this.cols = Math.ceil(width / cell);
    this.rows = Math.ceil(height / cell);
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
    this.seen = new Uint32Array(shapes.length);
    shapes.forEach((s, i) => {
      const b = shapeBounds(s);
      this.forCells(b.minX, b.minY, b.maxX, b.maxY, (idx) => this.buckets[idx].push(i));
    });
  }

  private forCells(minX: number, minY: number, maxX: number, maxY: number, fn: (idx: number) => void): void {
    const c0 = Math.max(0, Math.floor(minX / this.cell));
    const r0 = Math.max(0, Math.floor(minY / this.cell));
    const c1 = Math.min(this.cols - 1, Math.floor(maxX / this.cell));
    const r1 = Math.min(this.rows - 1, Math.floor(maxY / this.cell));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) fn(r * this.cols + c);
  }

  /** Shapes whose bounds may overlap the given box. */
  query(minX: number, minY: number, maxX: number, maxY: number): Shape[] {
    const out: Shape[] = [];
    this.stamp++;
    this.forCells(minX, minY, maxX, maxY, (idx) => {
      for (const i of this.buckets[idx]) {
        if (this.seen[i] === this.stamp) continue;
        this.seen[i] = this.stamp;
        out.push(this.shapes[i]);
      }
    });
    return out;
  }

  /** Is a circle of radius r at (x, y) free of all solids and inside bounds? */
  isFree(x: number, y: number, r: number): boolean {
    const m = this.margin;
    if (x - r < m || y - r < m || x + r > this.width - m || y + r > this.height - m) return false;
    for (const s of this.query(x - r, y - r, x + r, y + r)) {
      if (circlePenetration(x, y, r, s)) return false;
    }
    return true;
  }

  /** Pushes a circle out of solids. Mutates and returns `p`. Returns whether any contact happened via `hit`. */
  resolve(p: Vec, r: number, iterations = 4): boolean {
    let hit = false;
    for (let it = 0; it < iterations; it++) {
      let moved = false;
      for (const s of this.query(p.x - r, p.y - r, p.x + r, p.y + r)) {
        const push = circlePenetration(p.x, p.y, r, s);
        if (push) {
          p.x += push.x;
          p.y += push.y;
          moved = true;
          hit = true;
        }
      }
      if (this.clampToBounds(p, r)) {
        moved = true;
        hit = true;
      }
      if (!moved) break;
    }
    return hit;
  }

  clampToBounds(p: Vec, r: number): boolean {
    const m = this.margin;
    let changed = false;
    if (p.x < m + r) {
      p.x = m + r;
      changed = true;
    } else if (p.x > this.width - m - r) {
      p.x = this.width - m - r;
      changed = true;
    }
    if (p.y < m + r) {
      p.y = m + r;
      changed = true;
    } else if (p.y > this.height - m - r) {
      p.y = this.height - m - r;
      changed = true;
    }
    return changed;
  }

  /** Can a circle of radius r travel straight from a to b? */
  clearPath(ax: number, ay: number, bx: number, by: number, r: number): boolean {
    const shapes = this.query(Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r);
    for (const s of shapes) if (segmentHits(ax, ay, bx, by, r, s)) return false;
    const m = this.margin + r;
    if (Math.min(ax, bx) < m || Math.min(ay, by) < m) return false;
    if (Math.max(ax, bx) > this.width - m || Math.max(ay, by) > this.height - m) return false;
    return true;
  }
}
