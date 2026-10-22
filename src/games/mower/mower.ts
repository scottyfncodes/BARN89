import { DOGS, type DogDef } from '../../content/cast';
import { angleDiff, clamp, dist, Rng, type Vec } from '../../core/math';
import type { Pt } from '../../world/mapTypes';
import type { SharedWorld } from '../../world/shared';
import type { FlowerBed, MowLevel, Toy } from './levels';

export const CELL = 10;
export const MOWER_RADIUS = 21;
export const DECK_RADIUS = 25;
export const MAX_SPEED = 215;
const TURN_RATE = 3.4;
const BUMP_PENALTY = 2;
const BED_PENALTY = 6;
const TOY_PENALTY = 4;
const DOG_PENALTY = 3;

export interface MowInput {
  /** Joystick, each axis -1..1. */
  x: number;
  y: number;
}

export interface Mower {
  x: number;
  y: number;
  px: number;
  py: number;
  heading: number;
  pheading: number;
  speed: number;
  stall: number;
  bounce: number;
  /** Seconds before another bump costs time (holding into a tree shouldn't snowball). */
  bumpCool: number;
}

export interface LawnDog {
  def: DogDef;
  x: number;
  y: number;
  px: number;
  py: number;
  faceX: number;
  phase: number;
  target: Vec;
  flee: number;
  hitCooldown: number;
}

export type MowEvent =
  | { type: 'bump'; x: number; y: number; what: 'tree' | 'flowers' | 'thing' }
  | { type: 'bed'; x: number; y: number }
  | { type: 'toy'; x: number; y: number; kind: Toy['kind'] }
  | { type: 'dog'; x: number; y: number; name: string }
  | { type: 'cut'; x: number; y: number; n: number }
  | { type: 'milestone'; pct: number }
  | { type: 'done' }
  | { type: 'timeout' };

export interface MowResult {
  stars: number;
  time: number;
  penalties: number;
  coverage: number;
  stripes: number;
  score: number;
  lines: { label: string; value: string }[];
  finished: boolean;
}

export function pointInPoly(x: number, y: number, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Yard Boss: one lawn, one riding mower, one clock. */
export class MowGame {
  readonly x0: number;
  readonly y0: number;
  readonly cols: number;
  readonly rows: number;
  /** 0 = not lawn, 1 = tall grass, 2 = mowed light stripe, 3 = mowed dark stripe. */
  readonly cells: Uint8Array;
  readonly total: number;
  cut = 0;
  mower!: Mower;
  dogs: LawnDog[] = [];
  beds: (FlowerBed & { ruined: boolean })[] = [];
  toys: (Toy & { hit: boolean })[] = [];
  elapsed = 0;
  penalties = 0;
  clock = 0;
  phase: 'ready' | 'playing' | 'celebrating' | 'complete' = 'ready';
  celebrateT = 0;
  result: MowResult | null = null;
  /** Cells changed since the renderer last looked (for incremental redraw). */
  dirty: number[] = [];
  private events: MowEvent[] = [];
  private nextMilestone = 0.25;
  private rng = new Rng(31);

  constructor(
    readonly level: MowLevel,
    readonly shared: SharedWorld,
  ) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of level.lawn) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    this.x0 = Math.floor(minX / CELL) * CELL;
    this.y0 = Math.floor(minY / CELL) * CELL;
    this.cols = Math.ceil((maxX - this.x0) / CELL) + 1;
    this.rows = Math.ceil((maxY - this.y0) / CELL) + 1;
    this.cells = new Uint8Array(this.cols * this.rows);
    const w = shared.world;
    // A cell counts if it's lawn, not under a flower bed, and the deck can actually reach it.
    const reach = DECK_RADIUS - 4;
    let total = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = this.x0 + (c + 0.5) * CELL;
        const y = this.y0 + (r + 0.5) * CELL;
        if (!pointInPoly(x, y, level.lawn)) continue;
        if (level.beds.some((b) => Math.hypot(b.x - x, b.y - y) < b.r + 4)) continue;
        let ok = w.isFree(x, y, MOWER_RADIUS);
        for (let k = 0; k < 8 && !ok; k++) {
          const a = (k / 8) * Math.PI * 2;
          ok = w.isFree(x + Math.cos(a) * reach, y + Math.sin(a) * reach, MOWER_RADIUS);
        }
        if (!ok) continue;
        this.cells[r * this.cols + c] = 1;
        total++;
      }
    }
    this.total = total;
    this.reset();
  }

  reset(): void {
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i] > 1) this.cells[i] = 1;
    this.dirty = [];
    this.cut = 0;
    const s = this.level.start;
    this.mower = { x: s.x, y: s.y, px: s.x, py: s.y, heading: s.heading, pheading: s.heading, speed: 0, stall: 0, bounce: 0, bumpCool: 0 };
    this.beds = this.level.beds.map((b) => ({ ...b, ruined: false }));
    this.toys = this.level.toys.map((t) => ({ ...t, hit: false }));
    this.rng = new Rng(31);
    this.dogs = DOGS.slice(0, this.level.dogs).map((def, i) => {
      const p = this.randomLawnPoint();
      return { def, x: p.x, y: p.y, px: p.x, py: p.y, faceX: 1, phase: i, target: this.randomLawnPoint(), flee: 0, hitCooldown: 0 };
    });
    this.elapsed = 0;
    this.penalties = 0;
    this.clock = 0;
    this.phase = 'ready';
    this.celebrateT = 0;
    this.result = null;
    this.events = [];
    this.nextMilestone = 0.25;
    this.cutAround(s.x, s.y, s.heading);
    this.dirty = [];
  }

  get coverage(): number {
    return this.total ? this.cut / this.total : 0;
  }

  get timeLeft(): number {
    return Math.max(0, this.level.timeLimit - this.elapsed);
  }

  drainEvents(): MowEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  private randomLawnPoint(): Vec {
    for (let i = 0; i < 200; i++) {
      const r = Math.floor(this.rng.next() * this.rows);
      const c = Math.floor(this.rng.next() * this.cols);
      if (this.cells[r * this.cols + c]) {
        const p = { x: this.x0 + (c + 0.5) * CELL, y: this.y0 + (r + 0.5) * CELL };
        if (this.shared.world.isFree(p.x, p.y, 14)) return p;
      }
    }
    return { x: this.level.start.x, y: this.level.start.y };
  }

  /** Cuts every lawn cell under the deck; returns how many were newly cut. */
  private cutAround(x: number, y: number, heading: number): number {
    const r = DECK_RADIUS;
    const c0 = Math.max(0, Math.floor((x - r - this.x0) / CELL));
    const c1 = Math.min(this.cols - 1, Math.floor((x + r - this.x0) / CELL));
    const r0 = Math.max(0, Math.floor((y - r - this.y0) / CELL));
    const r1 = Math.min(this.rows - 1, Math.floor((y + r - this.y0) / CELL));
    // Classic lawn stripes: grass laid one way reads light, the other way dark.
    const along = Math.cos(angleDiff(heading, this.level.axis));
    const across = Math.sin(angleDiff(heading, this.level.axis));
    const stripe = (Math.abs(along) >= Math.abs(across) ? along : across) >= 0 ? 2 : 3;
    let n = 0;
    for (let rr = r0; rr <= r1; rr++) {
      for (let cc = c0; cc <= c1; cc++) {
        const cx = this.x0 + (cc + 0.5) * CELL;
        const cy = this.y0 + (rr + 0.5) * CELL;
        if ((cx - x) * (cx - x) + (cy - y) * (cy - y) > r * r) continue;
        const i = rr * this.cols + cc;
        const v = this.cells[i];
        if (!v || v === stripe) continue;
        if (v === 1) n++;
        this.cells[i] = stripe;
        this.dirty.push(i);
      }
    }
    this.cut += n;
    return n;
  }

  step(input: MowInput, dt: number): void {
    this.clock += dt;
    const m = this.mower;
    m.px = m.x;
    m.py = m.y;
    m.pheading = m.heading;
    for (const d of this.dogs) {
      d.px = d.x;
      d.py = d.y;
    }
    if (this.phase === 'complete') return;
    if (this.phase === 'celebrating') {
      this.celebrateT += dt;
      m.speed *= 0.9;
      if (this.celebrateT > 2.4) this.phase = 'complete';
      return;
    }
    const mag = Math.min(1, Math.hypot(input.x, input.y));
    if (this.phase === 'ready') {
      if (mag < 0.2) return;
      this.phase = 'playing';
    }
    this.elapsed += dt;
    m.bounce = Math.max(0, m.bounce - dt * 4);
    m.bumpCool = Math.max(0, m.bumpCool - dt);

    // Zero-turn steering: point the stick where you want to go.
    let targetSpeed = 0;
    if (m.stall > 0) {
      m.stall -= dt;
    } else if (mag > 0.15) {
      const want = Math.atan2(input.y, input.x);
      const diff = angleDiff(m.heading, want);
      const turn = clamp(diff, -TURN_RATE * dt, TURN_RATE * dt);
      m.heading += turn;
      // Ease off the throttle while swinging around so turns stay tight.
      targetSpeed = MAX_SPEED * mag * clamp(Math.cos(diff), 0.15, 1);
    }
    const accel = targetSpeed > m.speed ? 320 : 520;
    m.speed += clamp(targetSpeed - m.speed, -accel * dt, accel * dt);

    const before = { x: m.x, y: m.y };
    const pos = { x: m.x + Math.cos(m.heading) * m.speed * dt, y: m.y + Math.sin(m.heading) * m.speed * dt };
    this.shared.world.resolve(pos, MOWER_RADIUS);
    const expected = m.speed * dt;
    const moved = Math.hypot(pos.x - before.x, pos.y - before.y);
    m.x = pos.x;
    m.y = pos.y;
    if (m.speed > 90 && moved < expected * 0.45) {
      // Bonk.
      const what = this.bumpedWhat(m.x + Math.cos(m.heading) * 30, m.y + Math.sin(m.heading) * 30);
      m.speed = -50;
      m.stall = 0.35;
      m.bounce = 1;
      if (m.bumpCool <= 0) {
        this.penalties += what === 'flowers' ? BED_PENALTY : BUMP_PENALTY;
        this.events.push({ type: 'bump', x: m.x + Math.cos(m.heading) * 26, y: m.y + Math.sin(m.heading) * 26, what });
      }
      m.bumpCool = 2.5;
    }

    if (Math.abs(m.speed) > 5) {
      const n = this.cutAround(m.x + Math.cos(m.heading) * 3, m.y + Math.sin(m.heading) * 3, m.speed >= 0 ? m.heading : m.heading + Math.PI);
      if (n > 0) this.events.push({ type: 'cut', x: m.x, y: m.y, n });
    }
    this.checkHazards();
    this.updateDogs(dt);

    const cov = this.coverage;
    if (cov >= this.nextMilestone && this.nextMilestone < this.level.target) {
      this.events.push({ type: 'milestone', pct: Math.round(this.nextMilestone * 100) });
      this.nextMilestone += 0.25;
    }
    if (cov >= this.level.target) this.finish(true);
    else if (this.elapsed >= this.level.timeLimit) this.finish(false);
  }

  private bumpedWhat(x: number, y: number): 'tree' | 'flowers' | 'thing' {
    let best: 'tree' | 'flowers' | 'thing' = 'thing';
    let bd = 80;
    for (const t of this.shared.map.trees) {
      const d = Math.hypot(t.x - x, t.y - y) - t.r * 0.42;
      if (d < bd) {
        bd = d;
        best = 'tree';
      }
    }
    for (const p of this.shared.map.props) {
      if (p.kind !== 'flowers' || !p.solid) continue;
      const d = Math.hypot(p.x - x, p.y - y) - (p.w ?? 16);
      if (d < bd) {
        bd = d;
        best = 'flowers';
      }
    }
    return best;
  }

  private checkHazards(): void {
    const m = this.mower;
    const dx = m.x + Math.cos(m.heading) * 3;
    const dy = m.y + Math.sin(m.heading) * 3;
    for (const b of this.beds) {
      if (b.ruined) continue;
      if (Math.hypot(b.x - dx, b.y - dy) < b.r + DECK_RADIUS * 0.6) {
        b.ruined = true;
        this.penalties += BED_PENALTY;
        this.events.push({ type: 'bed', x: b.x, y: b.y });
      }
    }
    for (const t of this.toys) {
      if (t.hit) continue;
      if (Math.hypot(t.x - dx, t.y - dy) < DECK_RADIUS * 0.8) {
        t.hit = true;
        this.penalties += TOY_PENALTY;
        m.stall = 0.3;
        m.speed *= 0.3;
        m.bounce = 1;
        this.events.push({ type: 'toy', x: t.x, y: t.y, kind: t.kind });
      }
    }
  }

  private updateDogs(dt: number): void {
    const m = this.mower;
    const w = this.shared.world;
    for (const d of this.dogs) {
      d.hitCooldown = Math.max(0, d.hitCooldown - dt);
      const dm = dist(d, m);
      if (dm < 110 && Math.abs(m.speed) > 40) d.flee = 1.2;
      let speed = 80;
      let tx = d.target.x;
      let ty = d.target.y;
      if (d.flee > 0) {
        d.flee -= dt;
        speed = 230;
        const a = Math.atan2(d.y - m.y, d.x - m.x);
        tx = d.x + Math.cos(a) * 100;
        ty = d.y + Math.sin(a) * 100;
      } else if (dist(d, d.target) < 10) {
        d.target = this.randomLawnPoint();
      }
      const ddx = tx - d.x;
      const ddy = ty - d.y;
      const dd = Math.hypot(ddx, ddy);
      if (dd > 1) {
        const pos = { x: d.x + (ddx / dd) * speed * dt, y: d.y + (ddy / dd) * speed * dt };
        w.resolve(pos, 11);
        if (Math.hypot(pos.x - d.x, pos.y - d.y) < speed * dt * 0.3) d.target = this.randomLawnPoint();
        d.faceX = pos.x >= d.x ? 1 : -1;
        d.x = pos.x;
        d.y = pos.y;
        d.phase += dt * (speed > 100 ? 16 : 8);
      }
      if (dm < MOWER_RADIUS + 12 && d.hitCooldown <= 0 && Math.abs(m.speed) > 30) {
        d.hitCooldown = 2;
        d.flee = 1.5;
        this.penalties += DOG_PENALTY;
        m.stall = 0.4;
        m.speed = 0;
        m.bounce = 1;
        this.events.push({ type: 'dog', x: d.x, y: d.y, name: d.def.name });
      }
    }
  }

  /** Share of mowed cells whose neighbour along the stripe axis matches: long, straight passes. */
  stripeQuality(): number {
    let same = 0;
    let n = 0;
    const horiz = Math.abs(Math.cos(this.level.axis)) > 0.5;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const v = this.cells[r * this.cols + c];
        if (v < 2) continue;
        const r2 = horiz ? r : r + 1;
        const c2 = horiz ? c + 1 : c;
        if (r2 >= this.rows || c2 >= this.cols) continue;
        const w = this.cells[r2 * this.cols + c2];
        if (w < 2) continue;
        n++;
        if (w === v) same++;
      }
    }
    return n ? same / n : 0;
  }

  private finish(ok: boolean): void {
    if (this.phase !== 'playing') return;
    const time = this.elapsed + this.penalties;
    const [s3, s2] = this.level.starTimes;
    const stars = ok ? (time <= s3 ? 3 : time <= s2 ? 2 : 1) : 0;
    const stripes = this.stripeQuality();
    const stripeBonus = Math.round(stripes * 400);
    const timeBonus = ok ? Math.max(0, Math.round((this.level.timeLimit - time) * 12)) : 0;
    const base = Math.round(this.coverage * 1000);
    const score = Math.max(0, base + timeBonus + stripeBonus);
    const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    this.result = {
      stars,
      time,
      penalties: this.penalties,
      coverage: this.coverage,
      stripes,
      score,
      finished: ok,
      lines: [
        { label: `Lawn mowed ${Math.round(this.coverage * 100)}%`, value: String(base) },
        { label: `Time ${fmt(this.elapsed)}${this.penalties ? ` + ${this.penalties}s oops` : ''}`, value: String(timeBonus) },
        { label: `Straight stripes ${Math.round(stripes * 100)}%`, value: String(stripeBonus) },
      ],
    };
    this.phase = 'celebrating';
    this.celebrateT = 0;
    this.events.push({ type: ok ? 'done' : 'timeout' });
  }
}
