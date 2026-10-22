import { clamp, damp, hash2, lerp } from '../core/math';
import type { Game } from '../game/game';
import { WHISTLE_RADIUS } from '../game/game';
import type { GameEvent, Kitten } from '../game/types';
import type { BuildingDef, PropDef, TreeDef } from '../world/mapTypes';
import { drawEmote, drawKittenFigure, drawRider, heartPath, kittenLook, star } from './characters';
import { C } from './palette';
import {
  BuildingSprites,
  drawBuilding,
  drawFencePiece,
  drawFishTreat,
  drawHorseshoe,
  drawProp,
  drawTree,
  drawTreatBag,
  propIsFlat,
  splitFence,
  treeCanopy,
  TreeSprites,
  type FencePiece,
} from './sprites';
import { TerrainTiles, TILE } from './terrain';

type Ctx = CanvasRenderingContext2D;

interface Particle {
  kind: 'dust' | 'heart' | 'note' | 'spark' | 'confetti' | 'text' | 'ring' | 'leaf';
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

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface View {
  mode: 'title' | 'play';
}

/** Draws the ranch and everything on it. Owns the camera and purely visual effects. */
export class Renderer {
  private ctx: Ctx;
  private tiles: TerrainTiles;
  private trees: TreeSprites;
  private buildings: BuildingSprites;
  private statics: Static[] = [];
  private particles: Particle[] = [];
  private dustT = 0;
  cam = { x: 0, y: 0, zoom: 1 };
  private vw = 1;
  private vh = 1;
  private dpr = 1;
  private shake = 0;
  private titleT = 0;
  /** Extra space (CSS px) covered by HUD at the top/bottom, so the camera can keep Natalie clear of it. */
  insets = { top: 0, bottom: 0 };
  /** Screen rect (CSS px) kept clear for off-screen guides: excludes HUD and action buttons. */
  guideRect = { left: 0, top: 0, right: 0, bottom: 0 };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly game: Game,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.tiles = new TerrainTiles(game.map);
    this.trees = new TreeSprites(1);
    this.buildings = new BuildingSprites(1);
    this.buildStatics();
    this.cam.x = game.player.x;
    this.cam.y = game.player.y;
  }

  private buildStatics(): void {
    const m = this.game.map;
    for (const t of m.trees) {
      const c = treeCanopy(t);
      this.statics.push({ type: 'tree', y: t.y, t, box: { x0: c.x, y0: c.y, x1: c.x + c.w, y1: t.y + 10 } });
    }
    for (const b of m.buildings) {
      this.statics.push({ type: 'building', y: b.y + b.h, b, box: { x0: b.x - 30, y0: b.y - b.wall * 0.15 - 60, x1: b.x + b.w + 30, y1: b.y + b.h + 20 } });
    }
    for (const p of m.props) {
      if (propIsFlat(p)) continue;
      const w = (p.w ?? 40) + 40;
      this.statics.push({ type: 'prop', y: p.y + (p.kind === 'mouseHole' ? 2 : 0), p, box: { x0: p.x - w, y0: p.y - 80, x1: p.x + w, y1: p.y + 20 } });
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
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.cam.zoom = this.baseZoom();
    const s = clamp(this.cam.zoom * this.dpr, 1, 2);
    this.tiles.setScale(s);
    this.trees.setScale(s);
    this.buildings.setScale(s);
  }

  private baseZoom(): number {
    return clamp(Math.sqrt(this.vw * this.vh) / 660, 0.7, 1.3);
  }

  /** Snap the camera to the player (after restart). */
  snap(): void {
    const p = this.game.player;
    this.cam.x = p.x;
    this.cam.y = p.y;
    this.particles = [];
  }

  /** Pre-render terrain around a point so the first frames don't hitch. */
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
        if (tx < 0 || ty < 0 || tx * TILE >= this.game.map.width || ty * TILE >= this.game.map.height) continue;
        if (!this.tiles.has(tx, ty)) {
          this.tiles.get(tx, ty);
          made++;
        }
      }
    }
    return made;
  }

  handleEvent(e: GameEvent, kittens: Kitten[]): void {
    switch (e.type) {
      case 'penned': {
        const k = kittens.find((kk) => kk.id === e.kittenId);
        this.floatText(e.x, e.y - 30, `+100 ${k?.name ?? ''}`, '#fff3b0');
        for (let i = 0; i < 14; i++) this.burst('spark', e.x, e.y - 10, C.gold, 90);
        for (let i = 0; i < 4; i++) this.burst('heart', e.x, e.y - 14, '#ef5d84', 40);
        this.shake = 0.15;
        break;
      }
      case 'whistle': {
        this.particles.push({ kind: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, life: 0.6, max: 0.6, size: WHISTLE_RADIUS, color: '#ffffff' });
        for (let i = 0; i < 4; i++) {
          this.particles.push({
            kind: 'note',
            x: e.x + (Math.random() - 0.5) * 30,
            y: e.y - 60,
            vx: (Math.random() - 0.5) * 30,
            vy: -40 - Math.random() * 30,
            life: 1,
            max: 1,
            size: 1,
            color: ['#7b54c9', '#3d7fd6', '#ef5d84'][i % 3],
          });
        }
        break;
      }
      case 'treatEaten':
        for (let i = 0; i < 3; i++) this.burst('heart', e.x, e.y - 12, '#ef5d84', 30);
        break;
      case 'collect':
        for (let i = 0; i < 16; i++) this.burst('spark', e.x, e.y - 16, e.kind === 'horseshoe' ? C.gold : '#ffffff', 100);
        this.floatText(e.x, e.y - 40, e.kind === 'horseshoe' ? '+150 Lucky!' : '+2 treats', e.kind === 'horseshoe' ? '#fff3b0' : '#ffffff');
        break;
      case 'startle':
        for (let i = 0; i < 3; i++) this.burst('dust', e.x, e.y, '#efe2c0', 30);
        break;
      case 'victory':
        for (let i = 0; i < 120; i++) {
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
        break;
      default:
        break;
    }
  }

  private burst(kind: Particle['kind'], x: number, y: number, color: string, speed: number): void {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.6);
    this.particles.push({
      kind,
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - (kind === 'heart' ? 40 : 0),
      life: kind === 'dust' ? 0.5 : 0.9,
      max: kind === 'dust' ? 0.5 : 0.9,
      size: kind === 'dust' ? 5 + Math.random() * 4 : 3 + Math.random() * 2,
      color,
    });
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    this.particles.push({ kind: 'text', x, y, vx: 0, vy: -28, life: 1.6, max: 1.6, size: 13, color, text });
  }

  update(dt: number, view: View): void {
    const g = this.game;
    const p = g.player;
    const vw = this.vw / this.cam.zoom;
    const vh = this.vh / this.cam.zoom;
    if (view.mode === 'title') {
      // Lazy drift over the ranch behind the title card.
      this.titleT += dt;
      const t = this.titleT * 0.05;
      this.cam.x = 1250 + Math.sin(t) * 320;
      this.cam.y = 1900 + Math.cos(t * 0.8) * 380;
      this.cam.zoom = damp(this.cam.zoom, this.baseZoom() * 0.9, 2, dt);
    } else {
      const celebrating = g.phase !== 'playing';
      const zoomTarget = this.baseZoom() * (celebrating ? 1.18 : 1);
      this.cam.zoom = damp(this.cam.zoom, zoomTarget, 2.5, dt);
      // Keep Natalie a touch below centre in portrait so you can see more ahead; HUD-aware.
      const lookX = p.vx * 0.32;
      const lookY = p.vy * 0.32 + (this.insets.top - this.insets.bottom) / 2 / this.cam.zoom;
      this.cam.x = damp(this.cam.x, p.x + lookX, 4.2, dt);
      this.cam.y = damp(this.cam.y, p.y - 20 + lookY, 4.2, dt);
    }
    const m = g.map;
    this.cam.x = clamp(this.cam.x, vw / 2, Math.max(vw / 2, m.width - vw / 2));
    this.cam.y = clamp(this.cam.y, vh / 2, Math.max(vh / 2, m.height - vh / 2));
    if (vw >= m.width) this.cam.x = m.width / 2;
    if (vh >= m.height) this.cam.y = m.height / 2;
    this.shake = Math.max(0, this.shake - dt);

    // Dust from Deputy's paws.
    const sp = Math.hypot(p.vx, p.vy);
    this.dustT -= dt;
    if (view.mode === 'play' && sp > 140 && this.dustT <= 0) {
      this.dustT = 0.07;
      const sandy = g.inZoomies(p.x, p.y);
      this.particles.push({
        kind: 'dust',
        x: p.x - Math.sign(p.vx || 1) * 22 + (Math.random() - 0.5) * 10,
        y: p.y - 2,
        vx: -p.vx * 0.1,
        vy: -10 - Math.random() * 10,
        life: 0.55,
        max: 0.55,
        size: sandy ? 8 : 5,
        color: sandy ? '#f0dcaa' : '#e7dcc0',
      });
    }
    for (const q of this.particles) {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.kind === 'spark' || q.kind === 'heart') {
        q.vx *= 0.92;
        q.vy = q.vy * 0.92 - 6 * dt;
      } else if (q.kind === 'confetti') {
        q.vx += Math.sin(q.life * 4 + q.size) * 30 * dt;
        q.rot = (q.rot ?? 0) + dt * 5;
      }
    }
    this.particles = this.particles.filter((q) => q.life > 0);
  }

  render(alpha: number, view: View): void {
    const ctx = this.ctx;
    const g = this.game;
    const z = this.cam.zoom;
    const vw = this.vw / z;
    const vh = this.vh / z;
    let cx = this.cam.x;
    let cy = this.cam.y;
    if (this.shake > 0) {
      cx += Math.sin(g.clock * 80) * 3 * this.shake * 6;
      cy += Math.cos(g.clock * 73) * 2 * this.shake * 6;
    }
    const left = cx - vw / 2;
    const top = cy - vh / 2;
    const view0: Box = { x0: left - 10, y0: top - 10, x1: left + vw + 10, y1: top + vh + 90 };
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
    const tx1 = Math.min(Math.ceil(g.map.width / TILE) - 1, Math.floor((left + vw) / TILE));
    const ty1 = Math.min(Math.ceil(g.map.height / TILE) - 1, Math.floor((top + vh) / TILE));
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

    // 2. Ground-level dynamic decoration.
    this.drawGroundLayer(ctx, view0, view);

    // 3. Y-sorted world.
    const p = g.player;
    const px = lerp(p.px, p.x, alpha);
    const py = lerp(p.py, p.y, alpha);
    type Item = { y: number; draw: () => void };
    const items: Item[] = [];
    const inView = (b: Box) => b.x1 >= view0.x0 && b.x0 <= view0.x1 && b.y1 >= view0.y0 && b.y0 <= view0.y1;
    const clock = g.clock;
    for (const s of this.statics) {
      if (!inView(s.box)) continue;
      if (s.type === 'tree') {
        const t = s.t;
        const behind = py < t.y && py > s.box.y0 + 10 && px > s.box.x0 + 10 && px < s.box.x1 - 10;
        const sway = Math.sin(clock * 0.8 + t.seed) * 0.015;
        items.push({ y: s.y, draw: () => drawTree(ctx, this.trees, t, behind ? 0.5 : 1, sway) });
      } else if (s.type === 'building') {
        const b = s.b;
        const behind = py < b.y + b.h && py > s.box.y0 && px > b.x - 10 && px < b.x + b.w + 10;
        items.push({ y: s.y, draw: () => drawBuilding(ctx, this.buildings, b, behind ? 0.55 : 1) });
      } else if (s.type === 'prop') {
        const pr = s.p;
        items.push({ y: s.y, draw: () => drawProp(ctx, pr, clock) });
      } else {
        const f = s.f;
        items.push({ y: s.y, draw: () => drawFencePiece(ctx, f) });
      }
    }
    for (const c of g.map.collectibles) {
      if (g.collected.has(c.id)) continue;
      if (c.x < view0.x0 - 30 || c.x > view0.x1 + 30 || c.y < view0.y0 || c.y > view0.y1 + 30) continue;
      items.push({ y: c.y, draw: () => (c.kind === 'horseshoe' ? drawHorseshoe(ctx, c.x, c.y, clock) : drawTreatBag(ctx, c.x, c.y, clock)) });
    }
    this.addChickens(items, view0);
    const kittenPos = new Map<string, { x: number; y: number }>();
    for (const kt of g.kittens) {
      const x = lerp(kt.px, kt.x, alpha);
      const y = lerp(kt.py, kt.y, alpha);
      kittenPos.set(kt.id, { x, y });
      if (x < view0.x0 - 20 || x > view0.x1 + 20 || y < view0.y0 - 20 || y > view0.y1 + 20) continue;
      items.push({ y, draw: () => drawKittenFigure(ctx, kittenLook(kt, x, y, clock)) });
    }
    const pose = this.riderPose(px, py);
    items.push({ y: py, draw: () => drawRider(ctx, pose) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    // 4. X-ray: keep Natalie and loose kittens faintly visible behind trees and roofs.
    ctx.save();
    ctx.globalAlpha = 0.28;
    for (const kt of g.kittens) {
      if (kt.penned) continue;
      const q = kittenPos.get(kt.id)!;
      if (q.x < view0.x0 || q.x > view0.x1 || q.y < view0.y0 || q.y > view0.y1) continue;
      drawKittenFigure(ctx, { ...kittenLook(kt, q.x, q.y, clock), ring: null, ghost: true });
    }
    drawRider(ctx, { ...pose, ghost: true });
    ctx.restore();

    // 5. Overlay: treats in flight, butterflies, emotes, particles.
    for (const t of g.treats) {
      if (t.flightT >= t.flight) continue;
      const f = t.flightT / t.flight;
      const x = lerp(t.fromX, t.x, f);
      const y = lerp(t.fromY, t.y, f) - Math.sin(f * Math.PI) * 50;
      drawFishTreat(ctx, x, y, 1.1, f * 8);
    }
    for (const b of g.butterflies) this.drawButterfly(ctx, b.x, b.y, b.t, b.hue, b.life);
    for (const kt of g.kittens) {
      if (kt.emote === 'none') continue;
      const q = kittenPos.get(kt.id)!;
      const lift = kt.state === 'nap' ? 14 : kt.state === 'idle' || kt.state === 'penned' ? 30 : 24;
      drawEmote(ctx, kt.emote, q.x, q.y - lift, Math.min(1, kt.emoteT * 4), clock);
    }
    if (p.mood.kind === 'chuff') this.bubbleText(ctx, px + p.faceX * 40, py - 70, 'prrr!');
    else if (p.mood.kind === 'proud') {
      star(ctx, px + p.faceX * 34, py - 76 + Math.sin(clock * 6) * 2, 7, C.gold);
    }
    this.drawParticles(ctx, false);
    this.drawClouds(ctx, view0);

    // 6. Screen space: off-screen guides, confetti, vignette.
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (view.mode === 'play' && g.phase === 'playing') this.drawIndicators(ctx, left, top, z, kittenPos);
    this.drawParticles(ctx, true);
    const vg = ctx.createRadialGradient(this.vw / 2, this.vh * 0.45, Math.min(this.vw, this.vh) * 0.45, this.vw / 2, this.vh / 2, Math.max(this.vw, this.vh) * 0.75);
    vg.addColorStop(0, 'rgba(60,40,10,0)');
    vg.addColorStop(1, 'rgba(60,40,10,0.28)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.vw, this.vh);
  }

  private riderPose(x: number, y: number) {
    const p = this.game.player;
    const sp = Math.hypot(p.vx, p.vy);
    return {
      x,
      y,
      faceX: p.faceX,
      speed01: clamp(sp / p.maxSpeed, 0, 1),
      walkPhase: p.walkPhase,
      whistleT: p.whistleT,
      throwT: p.throwT,
      cheerT: p.cheerT,
      idleT: p.idleT,
      mood: p.mood.kind,
      clock: this.game.clock,
      vertical: sp > 20 ? p.vy / sp : 0,
    };
  }

  private drawGroundLayer(ctx: Ctx, v: Box, view: View): void {
    const g = this.game;
    const clock = g.clock;
    const pen = g.targetPen;
    // Corral: glowing scoring circle and chevrons leading in through the gate.
    if (pen.x + pen.r > v.x0 && pen.x - pen.r < v.x1 && pen.y + pen.r > v.y0 && pen.y - pen.r < v.y1) {
      ctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(clock * 3);
      ctx.beginPath();
      ctx.arc(pen.x, pen.y, pen.r - 22, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,236,150,${0.12 + pulse * 0.1})`;
      ctx.fill();
      ctx.setLineDash([10, 9]);
      ctx.lineDashOffset = -clock * 12;
      ctx.strokeStyle = `rgba(255,246,200,${0.55 + pulse * 0.3})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.setLineDash([]);
      if (view.mode === 'play' && g.phase === 'playing') {
        const ga = pen.gateAngle ?? 0;
        const ox = Math.cos(ga);
        const oy = Math.sin(ga);
        for (let i = 0; i < 3; i++) {
          const phase = (clock * 1.2 + i / 3) % 1;
          const d = pen.r + 70 - phase * 90;
          const x = pen.x + ox * d;
          const y = pen.y + oy * d;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(ga + Math.PI);
          ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.85;
          ctx.beginPath();
          ctx.moveTo(-8, -14);
          ctx.lineTo(6, 0);
          ctx.lineTo(-8, 14);
          ctx.strokeStyle = '#fff6c8';
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore();
    }
    // Flat props (flower beds, hay pile).
    for (const p of g.map.props) {
      if (!propIsFlat(p)) continue;
      if (p.x < v.x0 - 60 || p.x > v.x1 + 60 || p.y < v.y0 - 60 || p.y > v.y1 + 60) continue;
      drawProp(ctx, p, clock);
    }
    // Ducks paddling on the pond.
    const pond = g.map.areas.find((a) => a.kind === 'water');
    if (pond && pond.shape.type === 'ellipse') {
      const s = pond.shape;
      if (s.x + s.rx > v.x0 && s.x - s.rx < v.x1 && s.y + s.ry > v.y0 && s.y - s.ry < v.y1) {
        for (let i = 0; i < 3; i++) {
          const a = clock * (0.18 + i * 0.05) + i * 2.1;
          const x = s.x + Math.cos(a) * s.rx * (0.45 + i * 0.12);
          const y = s.y + Math.sin(a) * s.ry * (0.4 + i * 0.1);
          const dir = -Math.sin(a) > 0 ? 1 : -1;
          this.drawDuck(ctx, x, y, dir, clock + i, i === 2);
        }
      }
    }
    // Treats on the ground with a beckoning ring.
    for (const t of g.treats) {
      if (t.flightT < t.flight) continue;
      const pulse = (clock * 1.5) % 1;
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, 8 + pulse * 26, (8 + pulse * 26) * 0.45, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,190,90,${(1 - pulse) * 0.8})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(t.x, t.y + 2, 7, 2.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.shadow;
      ctx.fill();
      drawFishTreat(ctx, t.x, t.y - 3, 1, 0);
    }
  }

  private drawDuck(ctx: Ctx, x: number, y: number, dir: number, t: number, duckling: boolean): void {
    const s = duckling ? 0.65 : 1;
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 2) * 0.8);
    ctx.scale(dir * s, s);
    ctx.beginPath();
    ctx.ellipse(0, 2, 14, 4, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -3, 9, 5.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = duckling ? '#ffe066' : '#ffffff';
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(7, -9, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f29a2e';
    ctx.beginPath();
    ctx.moveTo(10, -9.5);
    ctx.lineTo(15, -8.5);
    ctx.lineTo(10, -7.2);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.fillRect(8, -10.5, 1.3, 1.3);
    ctx.restore();
  }

  private addChickens(items: { y: number; draw: () => void }[], v: Box): void {
    const pen = this.game.map.pens.find((p) => p.role === 'chickens');
    if (!pen) return;
    if (pen.x + pen.r < v.x0 || pen.x - pen.r > v.x1 || pen.y + pen.r < v.y0 || pen.y - pen.r > v.y1 + 30) return;
    const ctx = this.ctx;
    const t = this.game.clock;
    for (let i = 0; i < 5; i++) {
      const a = t * 0.22 * (i % 2 ? 1 : -1) + i * 1.3 + Math.sin(t * 0.7 + i) * 0.4;
      const r = (pen.r - 30) * (0.35 + 0.6 * hash2(i, 1, 5));
      const x = pen.x + Math.cos(a) * r;
      const y = pen.y + 10 + Math.sin(a) * r * 0.8;
      const peck = Math.sin(t * 4 + i * 3) > 0.7;
      const dir = Math.cos(a + Math.PI / 2) * (i % 2 ? 1 : -1) > 0 ? 1 : -1;
      items.push({
        y,
        draw: () => {
          ctx.save();
          ctx.translate(x, y);
          ctx.beginPath();
          ctx.ellipse(0, 0, 7, 2.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = C.shadow;
          ctx.fill();
          ctx.scale(dir, 1);
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(0, -7, 7, 5.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = i === 3 ? '#b4683a' : '#fffaf0';
          ctx.fill();
          ctx.stroke();
          const hy = peck ? -4 : -12;
          ctx.beginPath();
          ctx.arc(6, hy, 3.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#e04646';
          ctx.fillRect(5, hy - 6, 3, 3);
          ctx.fillStyle = '#f2b33a';
          ctx.beginPath();
          ctx.moveTo(9, hy - 1);
          ctx.lineTo(12, hy);
          ctx.lineTo(9, hy + 1);
          ctx.fill();
          // Unimpressed eye.
          ctx.fillStyle = C.ink;
          ctx.fillRect(6.5, hy - 1.5, 2, 0.9);
          ctx.restore();
        },
      });
    }
  }

  private drawButterfly(ctx: Ctx, x: number, y: number, t: number, hue: number, life: number): void {
    const flap = Math.abs(Math.sin(t * 16));
    ctx.save();
    ctx.globalAlpha = Math.min(1, life);
    ctx.translate(x, y - 16 + Math.sin(t * 5) * 3);
    ctx.fillStyle = `hsl(${hue},85%,65%)`;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 0.9;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 4 * flap, -2, 4.5 * flap + 0.6, 4, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(s * 3 * flap, 3, 3 * flap + 0.5, 2.5, -s * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = C.ink;
    ctx.fillRect(-0.8, -4, 1.6, 9);
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(x, y, 3, 1.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(40,30,15,0.15)';
    ctx.fill();
  }

  private bubbleText(ctx: Ctx, x: number, y: number, text: string): void {
    ctx.save();
    ctx.font = 'bold 10px ui-rounded, system-ui, sans-serif';
    const w = ctx.measureText(text).width + 12;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 9, w, 18, 9);
    ctx.fillStyle = '#fffdf6';
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = C.tigerDark;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
  }

  private drawParticles(ctx: Ctx, screen: boolean): void {
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

  private drawClouds(ctx: Ctx, v: Box): void {
    // Big soft cloud shadows drifting over the ranch.
    const t = this.game.clock;
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

  private drawIndicators(ctx: Ctx, left: number, top: number, z: number, kittenPos: Map<string, { x: number; y: number }>): void {
    const g = this.game;
    const margin = 24;
    const gr = this.guideRect;
    const L = gr.left + margin;
    const T = gr.top + margin;
    const R = (gr.right || this.vw) - margin;
    const B = (gr.bottom || this.vh) - margin;
    const toScreen = (x: number, y: number) => ({ x: (x - left) * z, y: (y - top) * z });
    const edge = (sx: number, sy: number) => {
      const cx = (L + R) / 2;
      const cy = (T + B) / 2;
      const dx = sx - cx;
      const dy = sy - cy;
      const s = Math.min((R - L) / 2 / Math.abs(dx || 1e-6), (B - T) / 2 / Math.abs(dy || 1e-6));
      return { x: cx + dx * s, y: cy + dy * s, a: Math.atan2(dy, dx) };
    };
    const onScreen = (sx: number, sy: number) => sx > 0 && sx < this.vw && sy > 0 && sy < this.vh;

    // Corral.
    const pen = g.targetPen;
    const ps = toScreen(pen.x, pen.y);
    if (!onScreen(ps.x, ps.y)) {
      const e = edge(ps.x, ps.y);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.save();
      ctx.rotate(e.a);
      ctx.beginPath();
      ctx.moveTo(26, 0);
      ctx.lineTo(14, -9);
      ctx.lineTo(14, 9);
      ctx.closePath();
      ctx.fillStyle = C.gold;
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fillStyle = C.gold;
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Little fence icon.
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const x of [-7, 0, 7]) {
        ctx.moveTo(x, -6);
        ctx.lineTo(x, 7);
      }
      ctx.moveTo(-9, -2);
      ctx.lineTo(9, -2);
      ctx.moveTo(-9, 4);
      ctx.lineTo(9, 4);
      ctx.stroke();
      ctx.restore();
    }

    // Loose kittens.
    for (const kt of g.kittens) {
      if (kt.penned) continue;
      const q = kittenPos.get(kt.id)!;
      const s = toScreen(q.x, q.y);
      if (onScreen(s.x, s.y)) continue;
      const e = edge(s.x, s.y);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.save();
      ctx.rotate(e.a);
      ctx.beginPath();
      ctx.moveTo(19, 0);
      ctx.lineTo(10, -6);
      ctx.lineTo(10, 6);
      ctx.closePath();
      ctx.fillStyle = '#fffdf6';
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      // Cat face in the kitten's colours.
      ctx.fillStyle = kt.coat.base;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.lineTo(-7, -12);
      ctx.lineTo(-2, -7);
      ctx.lineTo(2, -7);
      ctx.lineTo(7, -12);
      ctx.lineTo(8, -3);
      ctx.arc(0, 0, 8.5, -0.3, Math.PI + 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.fillRect(-4, -1.5, 2, 2.4);
      ctx.fillRect(2, -1.5, 2, 2.4);
      ctx.restore();
    }
  }
}
