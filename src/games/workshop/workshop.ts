import { PAINTS, STAR_BLUE, STAR_CREAM, type PieceDef, type Restored } from '../../content/blueStar';

/** Grid cell size, in piece units. Sanding and painting are tracked per cell. */
export const CELL = 4;
/** Brush radius in piece units. */
export const SAND_R = 10;
export const PAINT_R = 11;
/** Sanded or painted this much of the piece and the rest is done for you. */
export const SAND_DONE = 0.9;
export const PAINT_DONE = 0.94;
/** Star stencil radius, piece units. */
export const STAR_R = 9;

export type WorkshopPhase = 'sand' | 'paint' | 'star' | 'done';

export type WorkshopEvent =
  | { type: 'sanded' }
  | { type: 'painted' }
  | { type: 'starred'; x: number; y: number }
  | { type: 'color'; index: number };

/**
 * Restoring one piece of furniture: sand off the old finish, paint it, stencil a blue star.
 * No clock and no way to fail. Coordinates are piece units with the origin at the top left.
 */
export class Workshop {
  readonly cols: number;
  readonly rows: number;
  /** Topmost paintable part in each cell, or -1. */
  readonly partAt: Int16Array;
  readonly sanded: Uint8Array;
  /** Paint index in each cell, or -1. */
  readonly paint: Int16Array;
  phase: WorkshopPhase = 'sand';
  color = 0;
  star: { x: number; y: number } | null = null;
  /** The whole piece has paint on it; touch it up as long as you like, then go on to the star. */
  covered = false;
  private cells = 0;
  private sandedN = 0;
  private paintedN = 0;
  private events: WorkshopEvent[] = [];

  constructor(readonly piece: PieceDef) {
    this.cols = Math.ceil(piece.w / CELL);
    this.rows = Math.ceil(piece.h / CELL);
    const n = this.cols * this.rows;
    this.partAt = new Int16Array(n).fill(-1);
    this.sanded = new Uint8Array(n);
    this.paint = new Int16Array(n).fill(-1);
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const x = (cx + 0.5) * CELL;
        const y = (cy + 0.5) * CELL;
        let at = -1;
        piece.parts.forEach((p, i) => {
          if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) at = p.open ? -1 : i;
        });
        this.partAt[cy * this.cols + cx] = at;
        if (at >= 0) this.cells++;
      }
    }
    this.reset();
  }

  reset(): void {
    this.sanded.fill(0);
    this.paint.fill(-1);
    this.sandedN = 0;
    this.paintedN = 0;
    this.star = null;
    this.covered = false;
    this.events = [];
    const half = this.piece.halfDone;
    if (half) {
      // Already sanded, and somebody got the left half painted.
      const idx = Math.max(0, PAINTS.findIndex((p) => p.hex === half));
      for (let i = 0; i < this.partAt.length; i++) {
        if (this.partAt[i] < 0) continue;
        this.sanded[i] = 1;
        this.sandedN++;
        if ((i % this.cols) + 0.5 < this.cols / 2) {
          this.paint[i] = idx;
          this.paintedN++;
        }
      }
      this.color = idx;
      this.phase = 'paint';
    } else {
      this.color = 0;
      this.phase = 'sand';
    }
  }

  get sandFrac(): number {
    return this.cells ? this.sandedN / this.cells : 1;
  }

  get paintFrac(): number {
    return this.cells ? this.paintedN / this.cells : 1;
  }

  /** Progress through the step you're on, 0..1. */
  get progress(): number {
    if (this.phase === 'sand') return Math.min(1, this.sandFrac / SAND_DONE);
    if (this.phase === 'paint') return Math.min(1, this.paintFrac / PAINT_DONE);
    return this.phase === 'done' ? 1 : 0;
  }

  /** Is this point on the piece itself (not an open shelf or thin air)? */
  onPiece(x: number, y: number): boolean {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return false;
    return this.partAt[cy * this.cols + cx] >= 0;
  }

  pickColor(i: number): void {
    if (i < 0 || i >= PAINTS.length || i === this.color) return;
    this.color = i;
    this.events.push({ type: 'color', index: i });
  }

  /** Drag the sanding block or the brush from a to b. Returns how many cells it changed. */
  stroke(ax: number, ay: number, bx: number, by: number): number {
    if (this.phase !== 'sand' && this.phase !== 'paint') return 0;
    const r = this.phase === 'sand' ? SAND_R : PAINT_R;
    const len = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(len / (CELL * 0.75)));
    let changed = 0;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      changed += this.stamp(ax + (bx - ax) * t, ay + (by - ay) * t, r);
    }
    if (this.phase === 'sand' && this.sandFrac >= SAND_DONE) {
      for (let i = 0; i < this.partAt.length; i++) if (this.partAt[i] >= 0) this.sanded[i] = 1;
      this.sandedN = this.cells;
      this.phase = 'paint';
      this.events.push({ type: 'sanded' });
    } else if (this.phase === 'paint' && !this.covered && this.paintFrac >= PAINT_DONE) {
      // The last few specks get the colour in hand.
      for (let i = 0; i < this.partAt.length; i++) if (this.partAt[i] >= 0 && this.paint[i] < 0) this.paint[i] = this.color;
      this.paintedN = this.cells;
      this.covered = true;
      this.events.push({ type: 'painted' });
    }
    return changed;
  }

  private stamp(x: number, y: number, r: number): number {
    const c0 = Math.max(0, Math.floor((x - r) / CELL));
    const c1 = Math.min(this.cols - 1, Math.floor((x + r) / CELL));
    const r0 = Math.max(0, Math.floor((y - r) / CELL));
    const r1 = Math.min(this.rows - 1, Math.floor((y + r) / CELL));
    let changed = 0;
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const dx = (cx + 0.5) * CELL - x;
        const dy = (cy + 0.5) * CELL - y;
        if (dx * dx + dy * dy > r * r) continue;
        const i = cy * this.cols + cx;
        if (this.partAt[i] < 0) continue;
        if (this.phase === 'sand') {
          if (this.sanded[i]) continue;
          this.sanded[i] = 1;
          this.sandedN++;
          changed++;
        } else {
          if (this.paint[i] === this.color) continue;
          if (this.paint[i] < 0) this.paintedN++;
          this.paint[i] = this.color;
          changed++;
        }
      }
    }
    return changed;
  }

  /** Painting's done (whenever you say so, once it's all covered): on to the star. */
  toStar(): boolean {
    if (this.phase !== 'paint' || !this.covered) return false;
    this.phase = 'star';
    return true;
  }

  /** Stencil the blue star here. Only on the piece itself. */
  placeStar(x: number, y: number): boolean {
    if (this.phase !== 'star' || !this.onPiece(x, y)) return false;
    // Keep the whole star on the piece's outline.
    const sx = Math.max(STAR_R, Math.min(this.piece.w - STAR_R, x));
    const sy = Math.max(STAR_R, Math.min(this.piece.h - STAR_R, y));
    this.star = { x: sx, y: sy };
    this.phase = 'done';
    this.events.push({ type: 'starred', x: sx, y: sy });
    return true;
  }

  /** The star goes on in shop blue, or in cream where the paint under it is shop blue already. */
  starColorAt(x: number, y: number): string {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    const k = cx >= 0 && cy >= 0 && cx < this.cols && cy < this.rows ? this.paint[cy * this.cols + cx] : -1;
    return k >= 0 && PAINTS[k].hex === STAR_BLUE ? STAR_CREAM : STAR_BLUE;
  }

  /** The colour most of the piece ended up. */
  mainColor(): string {
    const counts = new Array<number>(PAINTS.length).fill(0);
    for (let i = 0; i < this.paint.length; i++) if (this.paint[i] >= 0) counts[this.paint[i]]++;
    return PAINTS[counts.indexOf(Math.max(...counts))].hex;
  }

  /** What gets saved and drawn out front of the shop: each part's colour and the star. */
  result(): Restored {
    const main = this.mainColor();
    const parts = this.piece.parts.map((_, pi) => {
      const counts = new Array<number>(PAINTS.length).fill(0);
      let any = false;
      for (let i = 0; i < this.partAt.length; i++) {
        if (this.partAt[i] === pi && this.paint[i] >= 0) {
          counts[this.paint[i]]++;
          any = true;
        }
      }
      // A part hidden behind the others takes the main colour.
      return any ? PAINTS[counts.indexOf(Math.max(...counts))].hex : main;
    });
    const s = this.star;
    return { parts, star: s ? [s.x / this.piece.w, s.y / this.piece.h] : null };
  }

  drainEvents(): WorkshopEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}

