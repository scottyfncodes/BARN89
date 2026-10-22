/**
 * Putt-Putt with Grandpa: mini golf, one hole at a time. Pull back and let go to putt; walls
 * and hay bales bounce the ball, sand slows it down, and the animals wander across.
 * Holes are laid out in a 320 x 480 field (portrait), tee at the bottom, cup near the top.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface Bumper {
  x: number;
  y: number;
  r: number;
  kind: 'bale' | 'rock' | 'bucket';
}

/** Something that wanders back and forth across the hole between `a` and `b`. */
export interface Mover {
  kind: 'pup' | 'donkey' | 'chicken';
  a: Pt;
  b: Pt;
  r: number;
  /** Seconds for a there-and-back. */
  period: number;
  /** Where in its walk it starts, 0..1. */
  offset?: number;
}

export interface Patch {
  kind: 'sand' | 'mud';
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface PuttHole {
  name: string;
  par: number;
  tee: Pt;
  cup: Pt;
  /** The course outline; every edge is a wall. */
  outline: Pt[];
  /** Walls inside the course. */
  walls?: [Pt, Pt][];
  bumpers?: Bumper[];
  movers?: Mover[];
  patches?: Patch[];
}

export interface PuttRound {
  id: string;
  name: string;
  holes: PuttHole[];
}

const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

export const PUTT_ROUNDS: PuttRound[] = [
  {
    id: 'putt-1',
    name: "Grandpa's Green",
    holes: [
      { name: 'Straight Shot', par: 2, tee: { x: 160, y: 410 }, cup: { x: 160, y: 90 }, outline: rect(60, 40, 260, 450), patches: [{ kind: 'sand', x: 205, y: 250, rx: 30, ry: 44 }] },
      {
        name: 'The Dogleg',
        par: 3,
        tee: { x: 95, y: 410 },
        cup: { x: 240, y: 112 },
        outline: [
          { x: 40, y: 450 },
          { x: 150, y: 450 },
          { x: 150, y: 175 },
          { x: 285, y: 175 },
          { x: 285, y: 50 },
          { x: 40, y: 50 },
        ],
        bumpers: [{ x: 70, y: 82, r: 14, kind: 'bucket' }],
      },
      {
        name: 'Doggie Door',
        par: 3,
        tee: { x: 160, y: 415 },
        cup: { x: 160, y: 85 },
        outline: rect(40, 40, 280, 455),
        walls: [
          [{ x: 40, y: 255 }, { x: 136, y: 255 }],
          [{ x: 184, y: 255 }, { x: 280, y: 255 }],
        ],
        movers: [{ kind: 'pup', a: { x: 70, y: 180 }, b: { x: 250, y: 180 }, r: 10, period: 4.2 }],
      },
    ],
  },
  {
    id: 'putt-2',
    name: 'Around the Ranch',
    holes: [
      {
        name: 'Hay Day',
        par: 3,
        tee: { x: 160, y: 415 },
        cup: { x: 160, y: 78 },
        outline: rect(40, 40, 280, 455),
        bumpers: [
          { x: 112, y: 262, r: 24, kind: 'bale' },
          { x: 208, y: 262, r: 24, kind: 'bale' },
          { x: 160, y: 176, r: 24, kind: 'bale' },
        ],
      },
      {
        name: 'Donkey Crossing',
        par: 3,
        tee: { x: 90, y: 415 },
        cup: { x: 232, y: 92 },
        outline: rect(40, 40, 280, 455),
        movers: [{ kind: 'donkey', a: { x: 70, y: 245 }, b: { x: 250, y: 245 }, r: 28, period: 6 }],
        patches: [{ kind: 'sand', x: 150, y: 110, rx: 46, ry: 30 }],
      },
      {
        name: 'Barnyard Zigzag',
        par: 4,
        tee: { x: 78, y: 420 },
        cup: { x: 238, y: 82 },
        outline: rect(40, 40, 280, 455),
        walls: [
          [{ x: 40, y: 330 }, { x: 212, y: 330 }],
          [{ x: 108, y: 195 }, { x: 280, y: 195 }],
        ],
        movers: [{ kind: 'chicken', a: { x: 70, y: 262 }, b: { x: 250, y: 262 }, r: 9, period: 3.4, offset: 0.3 }],
        patches: [{ kind: 'mud', x: 168, y: 298, rx: 34, ry: 18 }],
        bumpers: [{ x: 90, y: 120, r: 13, kind: 'rock' }],
      },
    ],
  },
];

export const BALL_R = 6;
export const CUP_R = 8;
/** Fastest a putt can go (full pull-back). */
export const MAX_SPEED = 620;
/** Faster than this and the ball lips out instead of dropping. */
const SINK_SPEED = 300;
/** After this many strokes on a hole, Grandpa says "pick it up". */
export const MAX_STROKES = 7;

export type BumpWhat = 'wall' | Bumper['kind'] | Mover['kind'];

export type PuttEvent =
  | { type: 'putt'; power: number }
  | { type: 'bump'; what: BumpWhat; speed: number }
  | { type: 'lip' }
  | { type: 'sink'; hole: number; strokes: number; par: number }
  | { type: 'pickup'; hole: number }
  | { type: 'done' };

export interface PuttResult {
  stars: number;
  score: number;
  strokes: number;
  par: number;
  aces: number;
  lines: { label: string; value: string }[];
}

type Phase = 'intro' | 'aim' | 'rolling' | 'sunk' | 'celebrating' | 'complete';

export function moverPos(m: Mover, t: number): Pt & { vx: number; vy: number } {
  // Ease in and out at each end, like an animal ambling across.
  const u = (t / m.period + (m.offset ?? 0)) % 1;
  const k = 0.5 - 0.5 * Math.cos(u * Math.PI * 2);
  const dk = Math.PI * Math.sin(u * Math.PI * 2) * (1 / m.period);
  return { x: m.a.x + (m.b.x - m.a.x) * k, y: m.a.y + (m.b.y - m.a.y) * k, vx: (m.b.x - m.a.x) * dk, vy: (m.b.y - m.a.y) * dk };
}

function inPatch(p: Patch, x: number, y: number): boolean {
  return ((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2 <= 1;
}

export class PuttGame {
  phase: Phase = 'intro';
  phaseT = 0;
  holeIndex = 0;
  ball = { x: 0, y: 0, vx: 0, vy: 0 };
  /** Strokes on the current hole. */
  strokes = 0;
  /** Strokes per finished hole. */
  card: number[] = [];
  clock = 0;
  /** For the sink animation: where the ball dropped. */
  sinkT = 0;
  result: PuttResult | null = null;
  private events: PuttEvent[] = [];
  /** Already rattled over the cup on this roll. */
  private lipped = false;

  constructor(readonly round: PuttRound) {
    this.reset();
  }

  get hole(): PuttHole {
    return this.round.holes[this.holeIndex];
  }

  get par(): number {
    return this.round.holes.reduce((n, h) => n + h.par, 0);
  }

  get total(): number {
    return this.card.reduce((n, s) => n + s, 0) + this.strokes;
  }

  /** Strokes compared with par for the holes played so far ("-1", "E", "+2"). */
  get toPar(): number {
    let p = 0;
    for (let i = 0; i < this.card.length; i++) p += this.card[i] - this.round.holes[i].par;
    return p;
  }

  get moving(): boolean {
    return this.phase === 'rolling';
  }

  reset(): void {
    this.holeIndex = 0;
    this.card = [];
    this.result = null;
    this.events = [];
    this.clock = 0;
    this.startHole();
  }

  private startHole(): void {
    const h = this.hole;
    this.ball = { x: h.tee.x, y: h.tee.y, vx: 0, vy: 0 };
    this.strokes = 0;
    this.phase = 'intro';
    this.phaseT = 0;
  }

  drainEvents(): PuttEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** Putt toward (dx, dy) with power 0..1. Only while the ball is at rest. */
  putt(dx: number, dy: number, power: number): boolean {
    if (this.phase !== 'aim' && this.phase !== 'intro') return false;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6 || power < 0.04) return false;
    const speed = 30 + Math.min(1, power) * (MAX_SPEED - 30);
    this.ball.vx = (dx / d) * speed;
    this.ball.vy = (dy / d) * speed;
    this.strokes++;
    this.phase = 'rolling';
    this.phaseT = 0;
    this.events.push({ type: 'putt', power });
    return true;
  }

  step(dt: number): void {
    this.clock += dt;
    this.phaseT += dt;
    switch (this.phase) {
      case 'intro':
        if (this.phaseT > 0.9) this.phase = 'aim';
        break;
      case 'rolling':
        this.roll(dt);
        break;
      case 'sunk':
        if (this.phaseT > 1.3) this.nextHole();
        break;
      case 'celebrating':
        if (this.phaseT > 1.6) this.phase = 'complete';
        break;
      default:
        break;
    }
  }

  private roll(dt: number): void {
    const h = this.hole;
    const b = this.ball;
    const sub = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 3));
    const sdt = dt / sub;
    for (let i = 0; i < sub; i++) {
      // Rolling resistance: grass, more in sand, lots in mud.
      const patch = h.patches?.find((p) => inPatch(p, b.x, b.y));
      const decel = patch?.kind === 'mud' ? 900 : patch?.kind === 'sand' ? 520 : 150;
      const sp = Math.hypot(b.vx, b.vy);
      const ns = Math.max(0, sp - decel * sdt);
      if (sp > 0) {
        b.vx *= ns / sp;
        b.vy *= ns / sp;
      }
      b.x += b.vx * sdt;
      b.y += b.vy * sdt;
      this.collide(h);
      // The cup.
      const dc = Math.hypot(b.x - h.cup.x, b.y - h.cup.y);
      if (dc < CUP_R) {
        if (ns < SINK_SPEED) {
          this.sink();
          return;
        }
        if (dc < CUP_R * 0.6 && !this.lipped) {
          // Too hot: it rattles over the cup and keeps going, a little slower and a little off line.
          this.lipped = true;
          const a = Math.atan2(b.vy, b.vx) + (b.x < h.cup.x ? -0.25 : 0.25);
          const s = ns * 0.7;
          b.vx = Math.cos(a) * s;
          b.vy = Math.sin(a) * s;
          this.events.push({ type: 'lip' });
        }
      } else this.lipped = false;
    }
    if (Math.hypot(b.vx, b.vy) < 3) {
      b.vx = b.vy = 0;
      if (this.strokes >= MAX_STROKES) {
        // Grandpa: "Pick it up, we'll call that one a seven."
        this.events.push({ type: 'pickup', hole: this.holeIndex });
        this.card.push(this.strokes);
        this.strokes = 0;
        this.phase = 'sunk';
        this.phaseT = 0;
        return;
      }
      this.phase = 'aim';
      this.phaseT = 0;
    }
  }

  private collide(h: PuttHole): void {
    const b = this.ball;
    const segs: [Pt, Pt][] = [];
    for (let i = 0; i < h.outline.length; i++) segs.push([h.outline[i], h.outline[(i + 1) % h.outline.length]]);
    if (h.walls) segs.push(...h.walls);
    for (const [p, q] of segs) {
      const ex = q.x - p.x;
      const ey = q.y - p.y;
      const len2 = ex * ex + ey * ey;
      const t = Math.max(0, Math.min(1, ((b.x - p.x) * ex + (b.y - p.y) * ey) / len2));
      const cx = p.x + ex * t;
      const cy = p.y + ey * t;
      const dx = b.x - cx;
      const dy = b.y - cy;
      const d = Math.hypot(dx, dy);
      if (d < BALL_R && d > 1e-6) this.bounce(dx / d, dy / d, BALL_R - d, 0, 0, 'wall', 0.72);
    }
    for (const k of h.bumpers ?? []) {
      const dx = b.x - k.x;
      const dy = b.y - k.y;
      const d = Math.hypot(dx, dy);
      if (d < k.r + BALL_R && d > 1e-6) this.bounce(dx / d, dy / d, k.r + BALL_R - d, 0, 0, k.kind, k.kind === 'bale' ? 0.45 : 0.75);
    }
    for (const m of h.movers ?? []) {
      const mp = moverPos(m, this.clock);
      const dx = b.x - mp.x;
      const dy = b.y - mp.y;
      const d = Math.hypot(dx, dy);
      if (d < m.r + BALL_R && d > 1e-6) this.bounce(dx / d, dy / d, m.r + BALL_R - d, mp.vx, mp.vy, m.kind, 0.6);
    }
  }

  private bounce(nx: number, ny: number, push: number, svx: number, svy: number, what: BumpWhat, rest: number): void {
    const b = this.ball;
    b.x += nx * push;
    b.y += ny * push;
    // Reflect relative to whatever we hit (animals carry the ball along a bit).
    const rvx = b.vx - svx;
    const rvy = b.vy - svy;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return;
    b.vx = rvx - (1 + rest) * vn * nx + svx;
    b.vy = rvy - (1 + rest) * vn * ny + svy;
    this.events.push({ type: 'bump', what, speed: -vn });
  }

  private sink(): void {
    const h = this.hole;
    this.ball.x = h.cup.x;
    this.ball.y = h.cup.y;
    this.ball.vx = this.ball.vy = 0;
    this.card.push(this.strokes);
    this.events.push({ type: 'sink', hole: this.holeIndex, strokes: this.strokes, par: h.par });
    this.strokes = 0;
    this.phase = 'sunk';
    this.phaseT = 0;
  }

  private nextHole(): void {
    if (this.holeIndex + 1 >= this.round.holes.length) {
      this.finish();
      return;
    }
    this.holeIndex++;
    this.startHole();
  }

  private finish(): void {
    const strokes = this.card.reduce((n, s) => n + s, 0);
    const par = this.par;
    const aces = this.card.filter((s) => s === 1).length;
    const stars = strokes <= par ? 3 : strokes <= par + 3 ? 2 : 1;
    this.result = {
      stars,
      score: Math.max(0, 1000 + (par - strokes) * 120 + aces * 250),
      strokes,
      par,
      aces,
      lines: this.round.holes.map((h, i) => ({ label: `${i + 1}. ${h.name} (par ${h.par})`, value: String(this.card[i]) })),
    };
    this.phase = 'celebrating';
    this.phaseT = 0;
    this.events.push({ type: 'done' });
  }
}

/** "E" for even, "+2", "-1". */
export function toParLabel(n: number): string {
  return n === 0 ? 'E' : n > 0 ? `+${n}` : String(n);
}
