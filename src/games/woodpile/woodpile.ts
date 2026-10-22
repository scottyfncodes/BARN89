import { Rng } from '../../core/math';

/** Rack width in rack units; pieces are 28 to 40 wide. */
export const RACK_W = 300;
export const ROW_H = 26;

export type LogKind = 'small' | 'round' | 'big';

export interface LogSpec {
  kind: LogKind;
  knots: number;
  punky: boolean;
}

export interface WoodRound {
  id: string;
  name: string;
  /** Pieces stacked to finish. */
  goal: number;
  timeLimit: number;
  /** Swing meter speed in sweeps per second. */
  meter: number;
  /** Piece slide speed over the rack, rack units per second. */
  slide: number;
  /** Fraction of logs that are knotty, big and rotten. */
  knotty: number;
  big: number;
  punky: number;
  seed: number;
}

export const WOOD_ROUNDS: WoodRound[] = [
  { id: 'woodpile-1', name: 'Morning Pile', goal: 18, timeLimit: 150, meter: 0.6, slide: 150, knotty: 0, big: 0, punky: 0, seed: 11 },
  { id: 'woodpile-2', name: 'Knotty Oak', goal: 22, timeLimit: 165, meter: 0.78, slide: 190, knotty: 0.5, big: 0.3, punky: 0.18, seed: 23 },
  { id: 'woodpile-3', name: 'Before the Freeze', goal: 26, timeLimit: 175, meter: 0.95, slide: 235, knotty: 0.6, big: 0.45, punky: 0.22, seed: 37 },
];

export interface Piece {
  w: number;
  x: number;
  /** Visual variety. */
  shade: number;
  snug: boolean;
}

export interface Faller {
  w: number;
  x: number;
  y: number;
  vy: number;
  vx: number;
  rot: number;
  vr: number;
  shade: number;
  life: number;
}

export type ChopGrade = 'perfect' | 'good' | 'miss';

export type WoodEvent =
  | { type: 'chop'; grade: ChopGrade; final: boolean }
  | { type: 'rotten' }
  | { type: 'toss'; good: boolean }
  | { type: 'stack'; grade: 'snug' | 'ok' | 'gappy'; x: number; row: number }
  | { type: 'tumble' }
  | { type: 'collapse'; row: number; lost: number }
  | { type: 'row'; row: number }
  | { type: 'done' }
  | { type: 'timeout' };

export interface WoodResult {
  stars: number;
  score: number;
  quality: number;
  finished: boolean;
  lines: { label: string; value: string }[];
}

type Phase = 'ready' | 'arrive' | 'aim' | 'swing' | 'stuck' | 'split' | 'slide' | 'drop' | 'toss' | 'celebrating' | 'complete';

const PIECE_W: Record<LogKind, number> = { small: 30, round: 38, big: 34 };

export type Fit = 'snug' | 'ok' | 'gappy' | 'tumble';

/** How a piece dropped at `x` lands against the open slot at `slot`. */
export function landingFit(x: number, slot: number): Fit {
  // Landing on top of the last piece rolls it off; a little overlap just gets nudged into place.
  if (x < slot - 12) return 'tumble';
  const gap = Math.abs(x - slot);
  return gap <= 5 ? 'snug' : gap <= 15 ? 'ok' : 'gappy';
}
const PIECES: Record<LogKind, number> = { small: 2, round: 2, big: 4 };

/** Woodpile: time the swing to split each log, then drop the pieces snugly onto the rack. */
export class WoodGame {
  phase: Phase = 'ready';
  phaseT = 0;
  log!: LogSpec;
  /** Chops still needed on the current log (big rounds take two). */
  chopsLeft = 1;
  /** Swing meter, 0..1, ping-pong. */
  meter = 0;
  meterDir = 1;
  sweet = 0.5;
  sweetW = 0.24;
  lastGrade: ChopGrade | null = null;
  queue: number[] = [];
  /** The piece sliding over the rack. */
  slider: { w: number; x: number; dir: number; shade: number } | null = null;
  drop: { w: number; x: number; y: number; vy: number; shade: number } | null = null;
  rows: Piece[][] = [[]];
  wobble = 0;
  fallers: Faller[] = [];
  elapsed = 0;
  clock = 0;
  chopPts = 0;
  stackPts = 0;
  bonusPts = 0;
  maxPts = 0;
  logs = 0;
  misses = 0;
  snugs = 0;
  collapses = 0;
  result: WoodResult | null = null;
  private events: WoodEvent[] = [];
  private rng: Rng;

  constructor(readonly round: WoodRound) {
    this.rng = new Rng(round.seed);
    this.reset();
  }

  reset(): void {
    this.rng = new Rng(this.round.seed);
    this.phase = 'ready';
    this.phaseT = 0;
    this.queue = [];
    this.slider = null;
    this.drop = null;
    this.rows = [[]];
    this.wobble = 0;
    this.fallers = [];
    this.elapsed = 0;
    this.clock = 0;
    this.chopPts = 0;
    this.stackPts = 0;
    this.bonusPts = 0;
    this.maxPts = 0;
    this.logs = 0;
    this.misses = 0;
    this.snugs = 0;
    this.collapses = 0;
    this.result = null;
    this.events = [];
    this.lastGrade = null;
    this.nextLog();
    this.phase = 'ready';
  }

  get stacked(): number {
    let n = 0;
    for (const r of this.rows) n += r.length;
    return n;
  }

  get rowIndex(): number {
    return this.rows.length - 1;
  }

  get rowRight(): number {
    const r = this.rows[this.rows.length - 1];
    if (!r.length) return 0;
    const p = r[r.length - 1];
    return p.x + p.w;
  }

  get timeLeft(): number {
    return Math.max(0, this.round.timeLimit - this.elapsed);
  }

  get score(): number {
    return Math.max(0, this.chopPts + this.stackPts + this.bonusPts);
  }

  drainEvents(): WoodEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  private nextLog(): void {
    const r = this.round;
    const big = this.rng.next() < r.big;
    const punky = this.logs > 0 && this.rng.next() < r.punky;
    const knots = this.rng.next() < r.knotty ? (this.rng.next() < 0.4 ? 2 : 1) : 0;
    this.log = { kind: big ? 'big' : this.rng.next() < 0.2 ? 'small' : 'round', knots, punky };
    this.chopsLeft = this.log.kind === 'big' ? 2 : 1;
    this.logs++;
    this.newSweet();
    this.phase = 'arrive';
    this.phaseT = 0;
  }

  private newSweet(): void {
    this.sweet = 0.28 + this.rng.next() * 0.44;
    this.sweetW = Math.max(0.12, 0.26 - this.log.knots * 0.06);
    this.meter = this.rng.next() < 0.5 ? 0 : 1;
    this.meterDir = this.meter === 0 ? 1 : -1;
  }

  /** Tap: chop while aiming, drop while a piece is sliding. */
  tap(): void {
    // The clock starts with the first swing; the meter is already moving while you get ready.
    if (this.phase === 'ready') this.phase = 'aim';
    if (this.phase === 'aim') this.chop();
    else if (this.phase === 'slide') this.dropPiece();
  }

  /** Throw the current log on the burn pile instead of splitting it. */
  toss(): void {
    if (this.phase !== 'aim' && this.phase !== 'ready') return;
    if (this.phase === 'ready') this.phase = 'aim';
    const good = this.log.punky;
    if (good) this.bonusPts += 60;
    else this.bonusPts -= 25;
    this.events.push({ type: 'toss', good });
    this.phase = 'toss';
    this.phaseT = 0;
  }

  private chop(): void {
    const d = Math.abs(this.meter - this.sweet);
    const grade: ChopGrade = d < this.sweetW / 6 ? 'perfect' : d < this.sweetW / 2 ? 'good' : 'miss';
    this.lastGrade = grade;
    this.phase = 'swing';
    this.phaseT = 0;
    if (this.log.punky) {
      // Rotten wood just crumbles: no firewood, and you should have tossed it.
      this.bonusPts -= 30;
      this.events.push({ type: 'rotten' });
      return;
    }
    if (grade === 'miss') {
      this.misses++;
      this.chopPts -= 10;
      this.maxPts += 0;
    } else {
      this.chopPts += grade === 'perfect' ? 60 : 30;
      this.chopsLeft--;
    }
    this.maxPts += grade === 'miss' ? 0 : 60;
    this.events.push({ type: 'chop', grade, final: grade !== 'miss' && this.chopsLeft === 0 });
  }

  private dropPiece(): void {
    const s = this.slider;
    if (!s) return;
    this.drop = { w: s.w, x: s.x, y: -46, vy: 0, shade: s.shade };
    this.slider = null;
    this.phase = 'drop';
    this.phaseT = 0;
  }

  private land(): void {
    const d = this.drop!;
    this.drop = null;
    const row = this.rows[this.rows.length - 1];
    const slot = this.rowRight;
    const ri = this.rowIndex;
    this.maxPts += 40;
    const fit = landingFit(d.x, slot);
    if (fit === 'tumble') {
      // Landed on the last piece and rolled off.
      this.wobble += 0.2;
      this.fallers.push({ w: d.w, x: d.x, y: -ri * ROW_H - ROW_H, vy: -60, vx: -40, rot: 0, vr: -3, shade: d.shade, life: 1.4 });
      this.events.push({ type: 'tumble' });
    } else {
      const gap = Math.abs(d.x - slot);
      const x = Math.max(slot, d.x);
      const grade = fit;
      if (grade === 'snug') {
        this.stackPts += 40;
        this.snugs++;
        this.wobble = Math.max(0, this.wobble - 0.1);
      } else if (grade === 'ok') {
        this.stackPts += 18;
        this.wobble += 0.04;
      } else {
        this.stackPts += 5;
        this.wobble += Math.min(0.35, gap / 90);
      }
      row.push({ w: d.w, x, shade: d.shade, snug: grade === 'snug' });
      this.events.push({ type: 'stack', grade, x: x + d.w / 2, row: ri });
    }
    if (this.wobble >= 1) this.collapse();
    if (this.stacked >= this.round.goal) {
      this.finish(true);
      return;
    }
    this.nextPiece();
  }

  /** Too wobbly: the last few pieces on the working row tumble off. */
  private collapse(): void {
    const ri = this.rowIndex;
    const row = this.rows[ri];
    const lost = row.splice(Math.max(0, row.length - 3));
    for (const p of lost) {
      this.fallers.push({ w: p.w, x: p.x, y: -ri * ROW_H - ROW_H / 2, vy: -80 - this.rng.next() * 60, vx: (this.rng.next() - 0.3) * 120, rot: 0, vr: (this.rng.next() - 0.5) * 8, shade: p.shade, life: 1.6 });
    }
    this.events.push({ type: 'collapse', row: ri, lost: lost.length });
    this.collapses++;
    this.stackPts -= 30;
    this.wobble = 0.25;
  }

  private nextPiece(): void {
    const w = this.queue.shift();
    if (w === undefined) {
      this.nextLog();
      return;
    }
    if (this.rowRight + w > RACK_W - 2) {
      this.events.push({ type: 'row', row: this.rowIndex });
      this.rows.push([]);
      this.wobble = Math.max(0, this.wobble - 0.3);
    }
    const lo = this.slideLo(w);
    this.slider = { w, x: this.rng.next() < 0.5 ? lo : RACK_W - w, dir: 1, shade: this.rng.next() };
    this.slider.dir = this.slider.x === lo ? 1 : -1;
    this.phase = 'slide';
    this.phaseT = 0;
  }

  /** The slide range starts a little left of the open slot so there's always room to miss. */
  slideLo(_w: number): number {
    return Math.max(0, this.rowRight - 50);
  }

  step(dt: number): void {
    this.clock += dt;
    for (const f of this.fallers) {
      f.life -= dt;
      f.vy += 600 * dt;
      f.y += f.vy * dt;
      f.x += f.vx * dt;
      f.rot += f.vr * dt;
    }
    this.fallers = this.fallers.filter((f) => f.life > 0);
    if (this.phase === 'complete') return;
    if (this.phase === 'ready') {
      this.sweepMeter(dt);
      return;
    }
    if (this.phase === 'celebrating') {
      this.phaseT += dt;
      if (this.phaseT > 2.4) this.phase = 'complete';
      return;
    }
    this.elapsed += dt;
    this.phaseT += dt;
    if (this.elapsed >= this.round.timeLimit) {
      this.finish(false);
      return;
    }
    switch (this.phase) {
      case 'arrive':
        if (this.phaseT > 0.45) {
          this.phase = 'aim';
          this.phaseT = 0;
        }
        break;
      case 'aim':
        this.sweepMeter(dt);
        break;
      case 'swing':
        if (this.phaseT > 0.2) {
          this.phaseT = 0;
          if (this.log.punky) {
            this.phase = 'split';
            this.queue = [];
          } else if (this.lastGrade === 'miss') this.phase = 'stuck';
          else if (this.chopsLeft > 0) {
            // Halved a big round: line up the next swing.
            this.phase = 'arrive';
            this.newSweet();
          } else {
            this.phase = 'split';
            const n = PIECES[this.log.kind];
            this.queue = Array.from({ length: n }, () => PIECE_W[this.log.kind] + Math.round((this.rng.next() - 0.5) * 6));
          }
        }
        break;
      case 'stuck':
        if (this.phaseT > 0.55) {
          this.phase = 'aim';
          this.phaseT = 0;
        }
        break;
      case 'split':
        if (this.phaseT > 0.45) this.nextPiece();
        break;
      case 'toss':
        if (this.phaseT > 0.6) this.nextLog();
        break;
      case 'slide': {
        const s = this.slider!;
        const lo = this.slideLo(s.w);
        const hi = RACK_W - s.w;
        s.x += s.dir * this.round.slide * dt;
        if (s.x >= hi) {
          s.x = hi;
          s.dir = -1;
        } else if (s.x <= lo) {
          s.x = lo;
          s.dir = 1;
        }
        break;
      }
      case 'drop': {
        const d = this.drop!;
        d.vy += 1400 * dt;
        d.y += d.vy * dt;
        if (d.y >= 0) this.land();
        break;
      }
      default:
        break;
    }
  }

  private sweepMeter(dt: number): void {
    this.meter += this.meterDir * this.round.meter * 2 * dt;
    if (this.meter >= 1) {
      this.meter = 2 - this.meter;
      this.meterDir = -1;
    } else if (this.meter <= 0) {
      this.meter = -this.meter;
      this.meterDir = 1;
    }
  }

  private finish(ok: boolean): void {
    const quality = this.maxPts > 0 ? Math.max(0, (this.chopPts + this.stackPts) / this.maxPts) : 0;
    const stars = ok ? (quality >= 0.72 ? 3 : quality >= 0.45 ? 2 : 1) : 0;
    const timeBonus = ok ? Math.round(this.timeLeft * 5) : 0;
    this.bonusPts += timeBonus;
    this.result = {
      stars,
      score: this.score,
      quality,
      finished: ok,
      lines: [
        { label: `Chopping (${this.misses} stuck)`, value: String(this.chopPts) },
        { label: `Stacking (${this.snugs} snug)`, value: String(this.stackPts) },
        { label: 'Burn pile and time', value: String(this.bonusPts) },
      ],
    };
    this.phase = 'celebrating';
    this.phaseT = 0;
    this.events.push({ type: ok ? 'done' : 'timeout' });
  }
}
