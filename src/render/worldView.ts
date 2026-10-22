import { DONKEYS } from '../content/cast';
import { clamp, damp, hash2 } from '../core/math';
import type { BuildingDef, PropDef, RanchMap, TreeDef } from '../world/mapTypes';
import { drawChicken, drawDonkey } from './animals';
import { heartPath, star } from './characters';
import { C } from './palette';
import {
  BuildingSprites,
  drawBuilding,
  drawFencePiece,
  drawProp,
  drawTree,
  festoonBulbs,
  propIsFlat,
  splitFence,
  treeCanopy,
  TreeSprites,
  type FencePiece,
} from './sprites';
import { TerrainTiles, TILE } from './terrain';

type Ctx = CanvasRenderingContext2D;

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface DrawItem {
  y: number;
  draw: () => void;
}

export interface Particle {
  kind: 'dust' | 'heart' | 'note' | 'spark' | 'confetti' | 'text' | 'ring' | 'leaf' | 'grass' | 'chip';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  text?: string;
  rot?: number;
  /** Screen-space particle (confetti). */
  screen?: boolean;
}

type Static =
  | { type: 'tree'; y: number; t: TreeDef; box: Box }
  | { type: 'building'; y: number; b: BuildingDef; box: Box }
  | { type: 'prop'; y: number; p: PropDef; box: Box }
  | { type: 'fence'; y: number; f: FencePiece; box: Box };

/** One frame's scene-specific content, layered into the shared world pipeline. */
export interface FrameSpec {
  clock: number;
  /** The character the camera follows; trees and roofs in front of it fade. */
  focus: { x: number; y: number } | null;
  ground?: (ctx: Ctx, v: Box) => void;
  actors?: (items: DrawItem[], v: Box) => void;
  /** Faint see-through pass for characters hidden behind trees and roofs. */
  ghosts?: (ctx: Ctx, v: Box) => void;
  overlay?: (ctx: Ctx, v: Box) => void;
  screen?: (ctx: Ctx, left: number, top: number, zoom: number) => void;
}

/** Light-up decorations unlocked as rewards. */
export interface Decor {
  /** Evening sky: string lights glow. */
  evening: boolean;
  /** Every old bulb on the Barn 89 string lights works again. */
  fixedBulbs: boolean;
  /** Christmas lights on the houses and barn, and a little snow. */
  holiday: boolean;
  /** Board under the old venue sign once the family picks the barn's next chapter. */
  sign?: string | null;
}

const HOLIDAY = ['#e2483c', '#3fae5a', '#f2c53d', '#3d7fd6', '#f28aa0'];

/**
 * Draws the homestead: baked terrain, y-sorted trees/buildings/fences/props, ambient animals,
 * weather, decorations and particles. Scenes add their own characters through a FrameSpec.
 */
export class WorldView {
  protected ctx: Ctx;
  readonly tiles: TerrainTiles;
  private trees: TreeSprites;
  private buildings: BuildingSprites;
  private statics: Static[] = [];
  protected particles: Particle[] = [];
  cam = { x: 0, y: 0, zoom: 1 };
  protected vw = 1;
  protected vh = 1;
  protected dpr = 1;
  protected shake = 0;
  private driftT = 0;
  /** Extra space (CSS px) covered by HUD at the top/bottom, so the camera keeps the player clear of it. */
  insets = { top: 0, bottom: 0 };
  /** Debug view: fit the whole map on screen (?overview). */
  overview = false;
  /** Zoom multiplier per scene (Yard Boss pulls back a little). */
  zoomScale = 1;
  ambient = { chickens: true, donkeys: true };
  decor: Decor = { evening: false, fixedBulbs: false, holiday: false };
  /** Flat props to hide (Yard Boss draws its own flower beds). */
  hideFlat = false;
  private flakes: { x: number; y: number; s: number; v: number }[] = [];

  constructor(
    protected readonly canvas: HTMLCanvasElement,
    readonly map: RanchMap,
    shared?: { tiles: TerrainTiles; trees: TreeSprites; buildings: BuildingSprites },
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.tiles = shared?.tiles ?? new TerrainTiles(map);
    this.trees = shared?.trees ?? new TreeSprites(1);
    this.buildings = shared?.buildings ?? new BuildingSprites(1);
    this.buildStatics();
    for (let i = 0; i < 70; i++) this.flakes.push({ x: Math.random(), y: Math.random(), s: 1 + Math.random() * 2.2, v: 14 + Math.random() * 22 });
  }

  /** Caches shared between views of the same map, so switching scenes doesn't re-bake terrain. */
  get sharedCaches(): { tiles: TerrainTiles; trees: TreeSprites; buildings: BuildingSprites } {
    return { tiles: this.tiles, trees: this.trees, buildings: this.buildings };
  }

  private buildStatics(): void {
    const m = this.map;
    for (const t of m.trees) {
      const c = treeCanopy(t);
      this.statics.push({ type: 'tree', y: t.y, t, box: { x0: c.x, y0: c.y, x1: c.x + c.w, y1: t.y + 10 } });
    }
    for (const b of m.buildings) {
      this.statics.push({ type: 'building', y: b.y + b.h, b, box: { x0: b.x - 30, y0: b.y - b.wall * 0.15 - 60, x1: b.x + b.w + 30, y1: b.y + b.h + 20 } });
    }
    for (const p of m.props) {
      if (propIsFlat(p)) continue;
      const w = p.kind === 'festoon' ? (p.w ?? 200) + 20 : (p.w ?? 40) + 40;
      const x0 = p.kind === 'festoon' ? p.x - 20 : p.x - w;
      this.statics.push({ type: 'prop', y: p.y + (p.kind === 'mouseHole' ? 2 : 0), p, box: { x0, y0: p.y - 90, x1: p.kind === 'festoon' ? p.x + w : p.x + w, y1: p.y + 20 } });
    }
    const pieces: FencePiece[] = [];
    for (const f of m.fences) pieces.push(...splitFence(f.points, f.style, 34));
    for (const pen of m.pens) {
      // Ring fences match the collision ring (28 segments, same gate gap).
      const segs = 28;
      const gateHalf = pen.gateAngle !== undefined ? (pen.gateWidth ?? 90) / pen.r / 2 : 0;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2;
        const a1 = ((i + 1) / segs) * Math.PI * 2;
        if (pen.gateAngle !== undefined) {
          const mid = (a0 + a1) / 2;
          const d = Math.abs(((((mid - pen.gateAngle) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (d < gateHalf) continue;
        }
        pieces.push({
          ax: pen.x + Math.cos(a0) * pen.r,
          ay: pen.y + Math.sin(a0) * pen.r,
          bx: pen.x + Math.cos(a1) * pen.r,
          by: pen.y + Math.sin(a1) * pen.r,
          style: 'round',
          postA: i % 2 === 0,
          postB: true,
        });
      }
    }
    for (const f of pieces) {
      this.statics.push({
        type: 'fence',
        y: Math.max(f.ay, f.by),
        f,
        box: { x0: Math.min(f.ax, f.bx) - 6, y0: Math.min(f.ay, f.by) - 26, x1: Math.max(f.ax, f.bx) + 6, y1: Math.max(f.ay, f.by) + 6 },
      });
    }
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.vw = cssW;
    this.vh = cssH;
    this.dpr = Math.min(dpr, 2);
    if (this.canvas.width !== Math.round(cssW * this.dpr)) this.canvas.width = Math.round(cssW * this.dpr);
    if (this.canvas.height !== Math.round(cssH * this.dpr)) this.canvas.height = Math.round(cssH * this.dpr);
    this.cam.zoom = this.baseZoom();
    const s = clamp(this.cam.zoom * this.dpr, 1, 2);
    this.tiles.setScale(s);
    this.trees.setScale(s);
    this.buildings.setScale(s);
  }

  get viewW(): number {
    return this.vw;
  }

  get viewH(): number {
    return this.vh;
  }

  baseZoom(): number {
    return clamp(Math.sqrt(this.vw * this.vh) / 660, 0.7, 1.3) * this.zoomScale;
  }

  snapTo(x: number, y: number): void {
    this.cam.x = x;
    this.cam.y = y;
    this.cam.zoom = this.baseZoom();
    this.particles = [];
    this.clampCam();
  }

  /** Smooth follow with a little look-ahead, keeping the target clear of the HUD. */
  follow(x: number, y: number, vx: number, vy: number, dt: number, zoomMul = 1, look = 0.32): void {
    if (this.overview) return this.fitAll();
    this.cam.zoom = damp(this.cam.zoom, this.baseZoom() * zoomMul, 2.5, dt);
    // Centre the target in the space between whatever is pinned to the top and the bottom.
    const lookY = vy * look + (this.insets.bottom - this.insets.top) / 2 / this.cam.zoom;
    this.cam.x = damp(this.cam.x, x + vx * look, 4.2, dt);
    this.cam.y = damp(this.cam.y, y - 20 + lookY, 4.2, dt);
    this.clampCam();
  }

  /** Lazy drift over the homestead behind title screens. */
  drift(dt: number, cx = 1300, cy = 1800, rx = 380, ry = 700): void {
    if (this.overview) return this.fitAll();
    this.driftT += dt;
    const t = this.driftT * 0.05;
    this.cam.x = cx + Math.sin(t) * rx;
    this.cam.y = cy + Math.cos(t * 0.8) * ry;
    this.cam.zoom = damp(this.cam.zoom, this.baseZoom() * 0.9, 2, dt);
    this.clampCam();
  }

  private fitAll(): void {
    const m = this.map;
    this.tiles.maxTiles = 400;
    this.cam.zoom = Math.min(this.vw / m.width, this.vh / m.height);
    this.cam.x = m.width / 2;
    this.cam.y = m.height / 2;
  }

  clampCam(): void {
    const m = this.map;
    const vw = this.vw / this.cam.zoom;
    const vh = this.vh / this.cam.zoom;
    this.cam.x = clamp(this.cam.x, vw / 2, Math.max(vw / 2, m.width - vw / 2));
    // Let the camera slide up past the map edge by the HUD's height so nothing hides under it.
    const top = vh / 2 - this.insets.top / this.cam.zoom;
    const bottom = m.height - vh / 2 + this.insets.bottom / this.cam.zoom;
    this.cam.y = clamp(this.cam.y, top, Math.max(top, bottom));
    if (vw >= m.width) this.cam.x = m.width / 2;
    if (vh >= m.height) this.cam.y = m.height / 2;
  }

  /** Pre-render terrain around a point so the first frames don't hitch. Returns tiles made. */
  warm(x: number, y: number, budget: number): number {
    const vw = this.vw / this.cam.zoom;
    const vh = this.vh / this.cam.zoom;
    let made = 0;
    const tx0 = Math.floor((x - vw / 2 - TILE) / TILE);
    const tx1 = Math.floor((x + vw / 2 + TILE) / TILE);
    const ty0 = Math.floor((y - vh / 2 - TILE) / TILE);
    const ty1 = Math.floor((y + vh / 2 + TILE) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (made >= budget) return made;
        if (tx < 0 || ty < 0 || tx * TILE >= this.map.width || ty * TILE >= this.map.height) continue;
        if (!this.tiles.has(tx, ty)) {
          this.tiles.get(tx, ty);
          made++;
        }
      }
    }
    return made;
  }

  /** Screen (CSS px) → world coordinates. */
  toWorld(sx: number, sy: number): { x: number; y: number } {
    const z = this.cam.zoom;
    return { x: this.cam.x + (sx - this.vw / 2) / z, y: this.cam.y + (sy - this.vh / 2) / z };
  }

  /* -------------------------------------------------------------------------------------- */
  /* Particles                                                                                */
  /* -------------------------------------------------------------------------------------- */

  addShake(s: number): void {
    this.shake = Math.max(this.shake, s);
  }

  burst(kind: Particle['kind'], x: number, y: number, color: string, speed: number, n = 1): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      const short = kind === 'dust' || kind === 'grass';
      this.particles.push({
        kind,
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - (kind === 'heart' ? 40 : kind === 'grass' ? 30 : 0),
        life: short ? 0.5 : 0.9,
        max: short ? 0.5 : 0.9,
        size: kind === 'dust' ? 5 + Math.random() * 4 : kind === 'grass' ? 2 + Math.random() * 2 : 3 + Math.random() * 2,
        color,
        rot: Math.random() * 6,
      });
    }
  }

  push(p: Particle): void {
    this.particles.push(p);
  }

  floatText(x: number, y: number, text: string, color: string, size = 13): void {
    this.particles.push({ kind: 'text', x, y, vx: 0, vy: -28, life: 1.6, max: 1.6, size, color, text });
  }

  ring(x: number, y: number, r: number, color = '#ffffff'): void {
    this.particles.push({ kind: 'ring', x, y, vx: 0, vy: 0, life: 0.6, max: 0.6, size: r, color });
  }

  confetti(n = 120): void {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        kind: 'confetti',
        screen: true,
        x: Math.random() * this.vw,
        y: -20 - Math.random() * this.vh * 0.6,
        vx: (Math.random() - 0.5) * 60,
        vy: 80 + Math.random() * 120,
        life: 4,
        max: 4,
        size: 5 + Math.random() * 5,
        color: ['#f2c53d', '#ef5d84', '#3d7fd6', '#6fbf4a', '#f08a24', '#ffffff'][i % 6],
        rot: Math.random() * 6,
      });
    }
  }

  clearParticles(): void {
    this.particles = [];
  }

  updateParticles(dt: number): void {
    this.shake = Math.max(0, this.shake - dt);
    for (const q of this.particles) {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.kind === 'spark' || q.kind === 'heart') {
        q.vx *= 0.92;
        q.vy = q.vy * 0.92 - 6 * dt;
      } else if (q.kind === 'grass' || q.kind === 'chip') {
        q.vx *= 0.9;
        q.vy += 160 * dt;
        q.rot = (q.rot ?? 0) + dt * 8;
      } else if (q.kind === 'confetti') {
        q.vx += Math.sin(q.life * 4 + q.size) * 30 * dt;
        q.rot = (q.rot ?? 0) + dt * 5;
      }
    }
    this.particles = this.particles.filter((q) => q.life > 0);
  }

  /* -------------------------------------------------------------------------------------- */
  /* Frame                                                                                    */
  /* -------------------------------------------------------------------------------------- */

  renderFrame(spec: FrameSpec): void {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const vw = this.vw / z;
    const vh = this.vh / z;
    let cx = this.cam.x;
    let cy = this.cam.y;
    const clock = spec.clock;
    if (this.shake > 0) {
      cx += Math.sin(clock * 80) * 3 * this.shake * 6;
      cy += Math.cos(clock * 73) * 2 * this.shake * 6;
    }
    const left = cx - vw / 2;
    const top = cy - vh / 2;
    const v: Box = { x0: left - 10, y0: top - 10, x1: left + vw + 10, y1: top + vh + 90 };
    const k = this.dpr * z;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.grass;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(k, 0, 0, k, -left * k, -top * k);
    ctx.imageSmoothingEnabled = true;

    // 1. Terrain tiles (generate a few missing ones per frame).
    let budget = 3;
    const tx0 = Math.max(0, Math.floor(left / TILE));
    const ty0 = Math.max(0, Math.floor(top / TILE));
    const tx1 = Math.min(Math.ceil(this.map.width / TILE) - 1, Math.floor((left + vw) / TILE));
    const ty1 = Math.min(Math.ceil(this.map.height / TILE) - 1, Math.floor((top + vh) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (!this.tiles.has(tx, ty)) {
          if (budget <= 0) continue;
          budget--;
        }
        // Slight overlap hides seams from fractional scaling.
        ctx.drawImage(this.tiles.get(tx, ty), tx * TILE, ty * TILE, TILE + 0.5, TILE + 0.5);
      }
    }

    // 2. Ground level: traffic, flat props, then the scene's own ground layer.
    this.drawTraffic(ctx, v, clock);
    if (!this.hideFlat) {
      for (const p of this.map.props) {
        if (!propIsFlat(p)) continue;
        if (p.x < v.x0 - 60 || p.x > v.x1 + 60 || p.y < v.y0 - 60 || p.y > v.y1 + 60) continue;
        drawProp(ctx, p, clock);
      }
    }
    spec.ground?.(ctx, v);

    // 3. Y-sorted world.
    const items: DrawItem[] = [];
    const inView = (b: Box) => b.x1 >= v.x0 && b.x0 <= v.x1 && b.y1 >= v.y0 && b.y0 <= v.y1;
    const f = spec.focus;
    for (const s of this.statics) {
      if (!inView(s.box)) continue;
      if (s.type === 'tree') {
        const t = s.t;
        const behind = !!f && f.y < t.y && f.y > s.box.y0 + 10 && f.x > s.box.x0 + 10 && f.x < s.box.x1 - 10;
        const sway = Math.sin(clock * 0.8 + t.seed) * 0.015;
        items.push({ y: s.y, draw: () => drawTree(ctx, this.trees, t, behind ? 0.5 : 1, sway) });
      } else if (s.type === 'building') {
        const b = s.b;
        const behind = !!f && f.y < b.y + b.h && f.y > s.box.y0 && f.x > b.x - 10 && f.x < b.x + b.w + 10;
        items.push({
          y: s.y,
          draw: () => {
            drawBuilding(ctx, this.buildings, b, behind ? 0.55 : 1);
            if (this.decor.holiday) this.drawEaveLights(ctx, b, clock, behind ? 0.55 : 1);
          },
        });
      } else if (s.type === 'prop') {
        const pr = s.p;
        items.push({
          y: s.y,
          draw: () => {
            drawProp(ctx, pr, clock);
            if (pr.kind === 'venueSign' && this.decor.sign) drawSignNote(ctx, pr.x, pr.y, this.decor.sign);
          },
        });
      } else {
        const fp = s.f;
        items.push({ y: s.y, draw: () => drawFencePiece(ctx, fp) });
      }
    }
    if (this.ambient.chickens) this.addChickens(items, v, clock, f);
    if (this.ambient.donkeys) this.addDonkeys(items, v, clock);
    spec.actors?.(items, v);
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    // 4. X-ray pass, overlay, particles, cloud shadows.
    if (spec.ghosts) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      spec.ghosts(ctx, v);
      ctx.restore();
    }
    spec.overlay?.(ctx, v);
    this.drawParticles(ctx, false);
    this.drawClouds(ctx, v, clock);
    if (this.decor.evening) this.drawEvening(ctx, v, clock, left, top, vw, vh);

    // 5. Screen space.
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.decor.holiday) this.drawSnow(ctx, clock);
    spec.screen?.(ctx, left, top, z);
    this.drawParticles(ctx, true);
    const vg = ctx.createRadialGradient(this.vw / 2, this.vh * 0.45, Math.min(this.vw, this.vh) * 0.45, this.vw / 2, this.vh / 2, Math.max(this.vw, this.vh) * 0.75);
    vg.addColorStop(0, 'rgba(60,40,10,0)');
    vg.addColorStop(1, 'rgba(60,40,10,0.28)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.vw, this.vh);
  }

  /* -------------------------------------------------------------------------------------- */
  /* Ambient life and decorations                                                             */
  /* -------------------------------------------------------------------------------------- */

  private drawTraffic(ctx: Ctx, v: Box, clock: number): void {
    // Traffic on Buffalo Gap Rd, safely beyond the fence.
    const road = this.map.areas.find((a) => a.kind === 'asphalt');
    if (!road || road.shape.type !== 'rect' || road.shape.x > v.x1 || road.shape.x + road.shape.w < v.x0) return;
    const s = road.shape;
    const span = this.map.height + 600;
    const cars: [number, number, number, string][] = [
      [s.x + s.w * 0.27, 1, 0, '#d9434f'],
      [s.x + s.w * 0.27, 1, 0.55, '#f2f2ee'],
      [s.x + s.w * 0.73, -1, 0.2, '#3d7fd6'],
      [s.x + s.w * 0.73, -1, 0.7, '#7a8a5a'],
    ];
    for (const [x, dir, off, col] of cars) {
      const f = (clock * 0.045 + off) % 1;
      const y = dir > 0 ? f * span - 300 : this.map.height + 300 - f * span;
      if (y < v.y0 - 80 || y > v.y1 + 80) continue;
      drawCar(ctx, x, y, dir, col);
    }
  }

  private addChickens(items: DrawItem[], v: Box, t: number, focus: { x: number; y: number } | null): void {
    const pen = this.map.pens.find((p) => p.role === 'chickens');
    if (!pen) return;
    if (pen.x + pen.r < v.x0 || pen.x - pen.r > v.x1 || pen.y + pen.r < v.y0 || pen.y - pen.r > v.y1 + 30) return;
    const ctx = this.ctx;
    for (let i = 0; i < 5; i++) {
      const a = t * 0.22 * (i % 2 ? 1 : -1) + i * 1.3 + Math.sin(t * 0.7 + i) * 0.4;
      const r = (pen.r - 30) * (0.35 + 0.6 * hash2(i, 1, 5));
      let x = pen.x + Math.cos(a) * r;
      let y = pen.y + 10 + Math.sin(a) * r * 0.8;
      let peck = Math.sin(t * 4 + i * 3) > 0.7;
      let dir = Math.cos(a + Math.PI / 2) * (i % 2 ? 1 : -1) > 0 ? 1 : -1;
      // Walk up to the wire and they shuffle off to the far side, deeply unimpressed.
      const fd = focus ? Math.hypot(x - focus.x, y - focus.y) : Infinity;
      if (focus && fd < 90) {
        const k = (90 - fd) / 90;
        x += ((x - focus.x) / (fd || 1)) * k * 34;
        y += ((y - focus.y) / (fd || 1)) * k * 26;
        const cx = x - pen.x;
        const cy = (y - pen.y - 10) / 0.8;
        const cr = Math.hypot(cx, cy);
        if (cr > pen.r - 22) {
          x = pen.x + (cx / cr) * (pen.r - 22);
          y = pen.y + 10 + (cy / cr) * (pen.r - 22) * 0.8;
        }
        peck = false;
        dir = x > focus.x ? 1 : -1;
      }
      items.push({ y, draw: () => drawChicken(ctx, x, y, dir, peck, i === 3) });
    }
  }

  /** The donkeys ambling around the round pen (the homestead scene simulates its own). */
  private addDonkeys(items: DrawItem[], v: Box, t: number): void {
    const pen = this.map.pens.find((p) => p.id === 'roundPen');
    if (!pen || pen.x + pen.r < v.x0 || pen.x - pen.r > v.x1 || pen.y + pen.r < v.y0 || pen.y - pen.r > v.y1 + 40) return;
    const ctx = this.ctx;
    DONKEYS.forEach((d, i) => {
      const at = (tt: number) => {
        // Long pauses to graze, then a slow amble.
        const cyc = tt * 0.06 + i * 0.5;
        const seg = Math.floor(cyc);
        const fr = cyc - seg;
        const k = fr < 0.6 ? 0 : (fr - 0.6) / 0.4;
        const a0 = hash2(seg, i, 7) * Math.PI * 2;
        const a1 = hash2(seg + 1, i, 7) * Math.PI * 2;
        const r0 = (pen.r - 40) * (0.2 + 0.7 * hash2(seg, i, 8));
        const r1 = (pen.r - 40) * (0.2 + 0.7 * hash2(seg + 1, i, 8));
        const e = k * k * (3 - 2 * k);
        return {
          x: pen.x + Math.cos(a0) * r0 * (1 - e) + Math.cos(a1) * r1 * e,
          y: pen.y + 14 + (Math.sin(a0) * r0 * (1 - e) + Math.sin(a1) * r1 * e) * 0.8,
          moving: k > 0 && k < 1,
        };
      };
      const p = at(t);
      const q = at(t + 0.1);
      const dir = q.x >= p.x ? 1 : -1;
      items.push({
        y: p.y,
        draw: () => drawDonkey(ctx, d, { x: p.x, y: p.y, faceX: dir, walking: p.moving, phase: t * 7, clock: t, graze: !p.moving && Math.sin(t * 0.5 + i) > -0.3, bray: false }),
      });
    });
  }

  private drawEaveLights(ctx: Ctx, b: BuildingDef, clock: number, alpha: number): void {
    const y = b.y + b.h - b.wall + (b.style === 'barn' ? 4 : 6);
    const x0 = b.x - 10;
    const x1 = b.x + b.w + 10;
    const span = 26;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#2f3a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x < x1; x += span) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + span / 2, y + 7, Math.min(x1, x + span), y);
    }
    ctx.stroke();
    let i = 0;
    for (let x = x0 + span / 4; x < x1; x += span / 2) {
      const tt = ((x - x0) % span) / span;
      const yy = y + 2 * tt * (1 - tt) * 7 + 2;
      const on = Math.sin(clock * 2 + i * 1.7) > -0.6;
      ctx.beginPath();
      ctx.arc(x, yy, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = on ? HOLIDAY[i % HOLIDAY.length] : '#6b6b6b';
      ctx.fill();
      i++;
    }
    ctx.restore();
  }

  /** Evening: a dusky wash, then warm glows for lit windows and lights. */
  private drawEvening(ctx: Ctx, v: Box, clock: number, left: number, top: number, vw: number, vh: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#8f8fc4';
    ctx.fillRect(left - 20, top - 20, vw + 40, vh + 40);
    ctx.globalCompositeOperation = 'lighter';
    const glow = (x: number, y: number, r: number, col: string, a: number) => {
      if (x < v.x0 - r || x > v.x1 + r || y < v.y0 - r || y > v.y1 + r) return;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col.replace('A', String(a)));
      g.addColorStop(1, col.replace('A', '0'));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (const p of this.map.props) {
      if (p.kind === 'festoon') {
        for (const b of festoonBulbs(p)) {
          if (b.out && !this.decor.fixedBulbs) continue;
          const flick = 0.75 + 0.25 * Math.sin(clock * 3 + b.x);
          glow(b.x, b.y + 2, 26, 'rgba(255,214,140,A)', 0.55 * flick);
        }
      } else if (p.kind === 'venueSign') {
        glow(p.x, p.y - 50, 60, 'rgba(255,214,140,A)', 0.3);
      }
    }
    for (const b of this.map.buildings) {
      if (b.style === 'farmhouse') {
        for (const wx of [43, b.w - 43, 105]) glow(b.x + wx, b.y + b.h - b.wall + 41, 34, 'rgba(255,200,110,A)', 0.45);
      }
      if (this.decor.holiday) {
        const y = b.y + b.h - b.wall + 8;
        for (let x = b.x; x < b.x + b.w; x += 26) glow(x, y, 18, 'rgba(255,170,120,A)', 0.25);
      }
    }
    ctx.restore();
  }

  private drawSnow(ctx: Ctx, clock: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const f of this.flakes) {
      const y = (f.y * this.vh + clock * f.v) % (this.vh + 10);
      const x = (f.x * this.vw + Math.sin(clock * 0.8 + f.y * 20) * 12 + this.vw) % this.vw;
      ctx.beginPath();
      ctx.arc(x, y, f.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  protected drawParticles(ctx: Ctx, screen: boolean): void {
    for (const q of this.particles) {
      if (!!q.screen !== screen) continue;
      const f = q.life / q.max;
      ctx.save();
      switch (q.kind) {
        case 'dust':
          ctx.globalAlpha = f * 0.7;
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.size * (1.6 - f * 0.6), 0, Math.PI * 2);
          ctx.fillStyle = q.color;
          ctx.fill();
          break;
        case 'spark':
          ctx.globalAlpha = f;
          star(ctx, q.x, q.y, q.size * (0.6 + f * 0.6), q.color);
          break;
        case 'heart':
          ctx.globalAlpha = f;
          heartPath(ctx, q.x, q.y, q.size + 1);
          ctx.fillStyle = q.color;
          ctx.fill();
          break;
        case 'grass':
        case 'chip':
          ctx.globalAlpha = Math.min(1, f * 2);
          ctx.translate(q.x, q.y);
          ctx.rotate(q.rot ?? 0);
          ctx.fillStyle = q.color;
          ctx.fillRect(-q.size, -q.size * 0.35, q.size * 2, q.size * 0.7);
          break;
        case 'note':
          ctx.globalAlpha = f;
          ctx.fillStyle = q.color;
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, 3.2, 2.4, -0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(q.x + 2, q.y - 11, 1.6, 11);
          ctx.fillRect(q.x + 2, q.y - 11, 5, 2);
          break;
        case 'ring': {
          const r = q.size * (1 - f * f);
          ctx.globalAlpha = f * 0.9;
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, r, r * 0.55, 0, 0, Math.PI * 2);
          ctx.strokeStyle = q.color;
          ctx.lineWidth = 4 * f + 1;
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, r * 0.8, r * 0.44, 0, 0, Math.PI * 2);
          ctx.lineWidth = 2 * f;
          ctx.stroke();
          break;
        }
        case 'text':
          ctx.globalAlpha = Math.min(1, f * 2);
          ctx.font = `800 ${q.size}px ui-rounded, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = C.ink;
          ctx.strokeText(q.text ?? '', q.x, q.y);
          ctx.fillStyle = q.color;
          ctx.fillText(q.text ?? '', q.x, q.y);
          break;
        case 'confetti':
          ctx.globalAlpha = Math.min(1, f * 2);
          ctx.translate(q.x, q.y);
          ctx.rotate(q.rot ?? 0);
          ctx.fillStyle = q.color;
          ctx.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2);
          break;
        default:
          break;
      }
      ctx.restore();
    }
  }

  private drawClouds(ctx: Ctx, v: Box, t: number): void {
    // Big soft cloud shadows drifting over the homestead.
    for (let i = 0; i < 4; i++) {
      const x = ((i * 900 + t * 14) % 3400) - 500;
      const y = 300 + i * 720 + Math.sin(t * 0.05 + i) * 80;
      const r = 260 + i * 30;
      if (x + r < v.x0 || x - r > v.x1 || y + r < v.y0 || y - r > v.y1) continue;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(30,40,60,0.10)');
      gr.addColorStop(1, 'rgba(30,40,60,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  /* -------------------------------------------------------------------------------------- */
  /* Shared screen-space helpers                                                              */
  /* -------------------------------------------------------------------------------------- */

  /** Edge-of-screen arrow toward an off-screen world point. Returns false if it's on screen. */
  edgeMarker(
    ctx: Ctx,
    left: number,
    top: number,
    z: number,
    wx: number,
    wy: number,
    rect: { left: number; top: number; right: number; bottom: number },
    paint: (ctx: Ctx) => void,
    fill: string = C.gold,
  ): boolean {
    const sx = (wx - left) * z;
    const sy = (wy - top) * z;
    if (sx > 0 && sx < this.vw && sy > 0 && sy < this.vh) return false;
    const margin = 24;
    const L = rect.left + margin;
    const T = rect.top + margin;
    const R = (rect.right || this.vw) - margin;
    const B = (rect.bottom || this.vh) - margin;
    const cx = (L + R) / 2;
    const cy = (T + B) / 2;
    const dx = sx - cx;
    const dy = sy - cy;
    const s = Math.min((R - L) / 2 / Math.abs(dx || 1e-6), (B - T) / 2 / Math.abs(dy || 1e-6));
    const ex = cx + dx * s;
    const ey = cy + dy * s;
    const a = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(14, -9);
    ctx.lineTo(14, 9);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    paint(ctx);
    ctx.restore();
    return true;
  }

  bubbleText(ctx: Ctx, x: number, y: number, text: string, color: string = C.ink): void {
    ctx.save();
    ctx.font = 'bold 11px ui-rounded, system-ui, sans-serif';
    const w = ctx.measureText(text).width + 14;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 10, w, 20, 10);
    ctx.fillStyle = '#fffdf6';
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 9.5);
    ctx.lineTo(x, y + 15);
    ctx.lineTo(x + 4, y + 9.5);
    ctx.fillStyle = '#fffdf6';
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
  }
}

/** Fresh-painted board hung on two little chains under the Barn 89 sign. */
function drawSignNote(ctx: Ctx, x: number, y: number, text: string): void {
  ctx.save();
  ctx.font = '900 7.5px ui-rounded, system-ui, sans-serif';
  const w = Math.max(58, ctx.measureText(text).width + 12);
  ctx.strokeStyle = '#6b6b6b';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + 6, y - 30);
  ctx.lineTo(x - w / 2 + 6, y - 25);
  ctx.moveTo(x + w / 2 - 6, y - 30);
  ctx.lineTo(x + w / 2 - 6, y - 25);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 25, w, 12, 2);
  ctx.fillStyle = '#fffaf0';
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = C.barnRed;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - 18.6);
  ctx.restore();
}

export function drawCar(ctx: Ctx, x: number, y: number, dir: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  if (dir < 0) ctx.rotate(Math.PI);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.roundRect(-17, -32, 38, 70, 10);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-20, -36, 40, 72, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#9fd3ea';
  ctx.beginPath();
  ctx.roundRect(-15, 10, 30, 13, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-15, -22, 30, 10, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-15, -10, 30, 18);
  ctx.fillStyle = '#ffe9a0';
  ctx.fillRect(-16, 32, 8, 4);
  ctx.fillRect(8, 32, 8, 4);
  ctx.restore();
}
