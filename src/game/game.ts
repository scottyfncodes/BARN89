import { dist, fromAngle, norm, Rng } from '../core/math';
import { CollisionWorld } from '../world/collision';
import type { CollectibleDef, PenDef, RanchMap } from '../world/mapTypes';
import { NavGrid } from '../world/navgrid';
import { buildSolids } from '../world/solids';
import { createKitten, emote, KITTEN_RADIUS, updateKitten, whistleKitten } from './kittenAI';
import type { LevelDef } from './levels';
import { createPlayer, updatePlayer } from './player';
import { finalScore, liveScore, type ScoreResult } from './scoring';
import type { Butterfly, GameEvent, InputState, Kitten, Phase, Player, Treat } from './types';

export const WHISTLE_RADIUS = 210;
export const TREAT_THROW = 95;
const CELEBRATE_SECONDS = 3.2;

/** The whole simulation for one play of a level. Rendering and input live elsewhere. */
export class Game {
  readonly map: RanchMap;
  readonly world: CollisionWorld;
  readonly nav: NavGrid;
  readonly targetPen: PenDef;
  player!: Player;
  kittens: Kitten[] = [];
  treats: Treat[] = [];
  butterflies: Butterfly[] = [];
  collected = new Set<string>();
  discovered = new Set<string>();
  treatsLeft = 0;
  elapsed = 0;
  /** Monotonic clock for animation, keeps ticking during celebration. */
  clock = 0;
  phase: Phase = 'playing';
  celebrateT = 0;
  result: ScoreResult | null = null;
  private events: GameEvent[] = [];
  private nextId = 1;
  private rng = new Rng(7);
  private chuffCooldown = 0;

  constructor(readonly level: LevelDef, shared?: { map: RanchMap; world: CollisionWorld; nav: NavGrid }) {
    // Static geometry is expensive to build, so restarts reuse it.
    this.map = shared?.map ?? level.createMap();
    this.world = shared?.world ?? new CollisionWorld(buildSolids(this.map), this.map.width, this.map.height, this.map.margin);
    this.nav = shared?.nav ?? new NavGrid(this.world, 16, KITTEN_RADIUS);
    const pen = this.map.pens.find((p) => p.id === level.targetPen);
    if (!pen) throw new Error(`Level ${level.id} has no pen ${level.targetPen}`);
    this.targetPen = pen;
    this.reset();
  }

  /** Fresh start of the same level (used by Play Again). */
  reset(): void {
    this.player = createPlayer(this.level.player.x, this.level.player.y);
    this.kittens = this.level.kittens.map(createKitten);
    this.treats = [];
    this.butterflies = [];
    this.collected = new Set();
    this.discovered = new Set();
    this.treatsLeft = this.level.startTreats;
    this.elapsed = 0;
    this.clock = 0;
    this.phase = 'playing';
    this.celebrateT = 0;
    this.result = null;
    this.events = [];
    this.nextId = 1;
    this.rng = new Rng(7);
    this.chuffCooldown = 0;
  }

  get shared(): { map: RanchMap; world: CollisionWorld; nav: NavGrid } {
    return { map: this.map, world: this.world, nav: this.nav };
  }

  get pennedCount(): number {
    let n = 0;
    for (const k of this.kittens) if (k.penned) n++;
    return n;
  }

  get horseshoes(): number {
    let n = 0;
    for (const c of this.map.collectibles) if (c.kind === 'horseshoe' && this.collected.has(c.id)) n++;
    return n;
  }

  get score(): number {
    return liveScore(this.pennedCount, this.horseshoes, this.discovered.size);
  }

  emit(e: GameEvent): void {
    this.events.push(e);
  }

  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  inZoomies(x: number, y: number): boolean {
    for (const z of this.map.zoomieZones) if (x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h) return true;
    return false;
  }

  /** Where a curious kitten should stand to investigate a distraction (it may itself be solid). */
  distractionSpot(id: string): { x: number; y: number } | null {
    const d = this.map.distractions.find((dd) => dd.id === id);
    if (!d) return null;
    if (this.nav.isWalkable(d.x, d.y)) return { x: d.x, y: d.y };
    return this.nav.nearestWalkable(d.x, d.y, 14);
  }

  spawnButterflyFor(k: Kitten): void {
    const a = k.rng.range(0, Math.PI * 2);
    const off = fromAngle(a, 34);
    const v = fromAngle(a, 62);
    this.butterflies.push({
      id: this.nextId++,
      x: k.x + off.x,
      y: k.y + off.y - 12,
      vx: v.x,
      vy: v.y,
      t: 0,
      life: 9,
      hue: k.rng.range(0, 360),
      bait: k.id,
    });
    this.emit({ type: 'butterfly', kittenId: k.id, x: k.x, y: k.y });
  }

  onPenned(k: Kitten): void {
    this.emit({ type: 'penned', kittenId: k.id, x: k.x, y: k.y });
    this.player.mood = { kind: 'proud', t: 1.8 };
    this.player.cheerT = 1.1;
    if (this.pennedCount >= this.level.required && this.phase === 'playing') {
      this.phase = 'celebrating';
      this.celebrateT = 0;
      this.result = finalScore({
        penned: this.pennedCount,
        required: this.level.required,
        seconds: this.elapsed,
        horseshoes: this.horseshoes,
        discoveries: this.discovered.size,
        treatsLeft: this.treatsLeft,
        starTimes: this.level.starTimes,
      });
      this.emit({ type: 'victory' });
    }
  }

  whistle(): number {
    const p = this.player;
    if (p.whistleCooldown > 0) return 0;
    p.whistleCooldown = 1.1;
    p.whistleT = 0.7;
    let affected = 0;
    for (const k of this.kittens) {
      if (k.penned) continue;
      if (dist(k, p) <= WHISTLE_RADIUS) {
        whistleKitten(k, this);
        affected++;
      }
    }
    this.emit({ type: 'whistle', x: p.x, y: p.y, affected });
    return affected;
  }

  throwTreat(): Treat | null {
    const p = this.player;
    if (p.throwT > 0.25) return null;
    if (this.treatsLeft <= 0) {
      this.emit({ type: 'noTreats' });
      return null;
    }
    const dir = fromAngle(p.heading);
    let tx = p.x + dir.x * TREAT_THROW;
    let ty = p.y + dir.y * TREAT_THROW;
    if (!this.nav.isWalkable(tx, ty)) {
      const spot = this.nav.nearestWalkable(tx, ty, 8);
      if (spot) {
        tx = spot.x;
        ty = spot.y;
      } else {
        tx = p.x;
        ty = p.y;
      }
    }
    this.treatsLeft--;
    p.throwT = 0.5;
    const t: Treat = {
      id: this.nextId++,
      x: tx,
      y: ty,
      fromX: p.x + p.faceX * 6,
      fromY: p.y - 46,
      flight: 0.45,
      flightT: 0,
      life: 18,
      eatenBy: null,
      eaten: false,
    };
    this.treats.push(t);
    this.emit({ type: 'treatThrown', x: tx, y: ty });
    return t;
  }

  step(input: InputState, dt: number): void {
    this.clock += dt;
    if (this.phase === 'complete') return;
    const playing = this.phase === 'playing';
    if (playing) this.elapsed += dt;
    else {
      this.celebrateT += dt;
      if (this.celebrateT >= CELEBRATE_SECONDS) this.phase = 'complete';
    }

    const p = this.player;
    p.px = p.x;
    p.py = p.y;
    for (const k of this.kittens) {
      k.px = k.x;
      k.py = k.y;
    }

    updatePlayer(p, input, this.world, dt, !playing);
    if (!playing) p.cheerT = Math.max(p.cheerT, 0.5);
    if (playing && input.whistle) this.whistle();
    if (playing && input.treat) this.throwTreat();

    for (const t of this.treats) {
      t.flightT = Math.min(t.flight, t.flightT + dt);
      if (t.flightT >= t.flight && !t.eatenBy) t.life -= dt;
    }
    this.treats = this.treats.filter((t) => !t.eaten && t.life > 0);

    this.updateButterflies(dt);
    for (const k of this.kittens) updateKitten(k, this, dt);

    if (playing) this.checkPickups();
    this.updateDeputyMood(dt);
  }

  private updateButterflies(dt: number): void {
    for (const b of this.butterflies) {
      b.t += dt;
      if (!b.bait) b.life -= dt * 3;
      else b.life -= dt;
      // Lazy zig-zag flight; turns away from walls so the chase stays on the ranch.
      const wob = Math.sin(b.t * 3.1 + b.id) * 0.9;
      const heading = Math.atan2(b.vy, b.vx) + wob * dt * 2;
      let sp = b.bait ? 62 : 120;
      const ahead = { x: b.x + Math.cos(heading) * 40, y: b.y + Math.sin(heading) * 40 };
      let h = heading;
      if (!this.nav.isWalkable(ahead.x, ahead.y)) {
        h += 1.8 * dt * 3;
        sp *= 0.7;
      }
      b.vx = Math.cos(h) * sp;
      b.vy = Math.sin(h) * sp;
      b.x += b.vx * dt;
      b.y += b.vy * dt - (b.bait ? 0 : 30 * dt);
      const m = this.map.margin;
      b.x = Math.min(this.map.width - m, Math.max(m, b.x));
      b.y = Math.min(this.map.height - m, Math.max(m, b.y));
    }
    this.butterflies = this.butterflies.filter((b) => b.life > 0);
  }

  private checkPickups(): void {
    const p = this.player;
    for (const c of this.map.collectibles) {
      if (this.collected.has(c.id)) continue;
      if (dist(p, c) < p.radius + 22) this.collect(c);
    }
    for (const d of this.map.discoveries) {
      if (this.discovered.has(d.id)) continue;
      if (dist(p, d) < d.r) {
        this.discovered.add(d.id);
        this.emit({ type: 'discover', id: d.id, title: d.title, text: d.text });
      }
    }
  }

  private collect(c: CollectibleDef): void {
    this.collected.add(c.id);
    if (c.kind === 'treatBag') this.treatsLeft += 2;
    this.emit({ type: 'collect', id: c.id, kind: c.kind, x: c.x, y: c.y });
  }

  private updateDeputyMood(dt: number): void {
    this.chuffCooldown -= dt;
    if (this.chuffCooldown > 0 || this.player.mood.kind !== 'none') return;
    for (const k of this.kittens) {
      if (!k.penned && dist(k, this.player) < 80) {
        this.player.mood = { kind: 'chuff', t: 1.3 };
        this.chuffCooldown = 7 + this.rng.range(0, 3);
        if (k.state !== 'flee') emote(k, 'question', 0.9);
        break;
      }
    }
  }

  /** Unit vector pointing from Natalie to the corral gate; used by the HUD's guide arrow. */
  gateDirection(): { x: number; y: number } {
    const pen = this.targetPen;
    const g = fromAngle(pen.gateAngle ?? 0, pen.r + 30);
    return norm({ x: pen.x + g.x - this.player.x, y: pen.y + g.y - this.player.y });
  }
}
