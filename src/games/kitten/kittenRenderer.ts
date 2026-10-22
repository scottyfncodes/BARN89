import type { HatKind } from '../../content/cast';
import { FAMILY } from '../../content/cast';
import { clamp, lerp } from '../../core/math';
import { drawEmote, drawKittenFigure, drawRider, kittenLook, star } from '../../render/characters';
import { C } from '../../render/palette';
import { drawPerson } from '../../render/people';
import { drawFishTreat, drawHorseshoe, drawTreatBag } from '../../render/sprites';
import type { TerrainTiles } from '../../render/terrain';
import type { BuildingSprites, TreeSprites } from '../../render/sprites';
import { WorldView, type Box } from '../../render/worldView';
import type { Game } from './game';
import { WHISTLE_RADIUS } from './game';
import type { GameEvent, Kitten } from './types';

type Ctx = CanvasRenderingContext2D;

export interface View {
  mode: 'title' | 'play';
}

/** Kitten Cowgirl on the shared homestead view: Natalie (or Deputy, once unlocked), the cats and the corral. */
export class Renderer extends WorldView {
  /** Screen rect (CSS px) kept clear for off-screen guides: excludes HUD and action buttons. */
  guideRect = { left: 0, top: 0, right: 0, bottom: 0 };
  /** Unlockable: Natalie rides Deputy the tiger instead of walking. */
  mounted = false;
  hat: HatKind | undefined;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly game: Game,
    shared?: { tiles: TerrainTiles; trees: TreeSprites; buildings: BuildingSprites },
  ) {
    super(canvas, game.map, shared);
    this.snap();
  }

  /** Snap the camera to the player (after restart). */
  snap(): void {
    this.snapTo(this.game.player.x, this.game.player.y);
  }

  handleEvent(e: GameEvent, kittens: Kitten[]): void {
    switch (e.type) {
      case 'penned': {
        const k = kittens.find((kk) => kk.id === e.kittenId);
        this.floatText(e.x, e.y - 30, `+100 ${k?.name ?? ''}`, '#fff3b0');
        this.burst('spark', e.x, e.y - 10, C.gold, 90, 14);
        this.burst('heart', e.x, e.y - 14, '#ef5d84', 40, 4);
        this.addShake(0.15);
        break;
      }
      case 'whistle': {
        this.ring(e.x, e.y, WHISTLE_RADIUS);
        for (let i = 0; i < 4; i++) {
          this.push({
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
        this.burst('heart', e.x, e.y - 12, '#ef5d84', 30, 3);
        break;
      case 'collect':
        this.burst('spark', e.x, e.y - 16, e.kind === 'horseshoe' ? C.gold : '#ffffff', 100, 16);
        this.floatText(e.x, e.y - 40, e.kind === 'horseshoe' ? '+150 Lucky!' : '+2 treats', e.kind === 'horseshoe' ? '#fff3b0' : '#ffffff');
        break;
      case 'startle':
        this.burst('dust', e.x, e.y, '#efe2c0', 30, 3);
        break;
      case 'victory':
        this.confetti();
        break;
      default:
        break;
    }
  }

  private dustT = 0;

  update(dt: number, view: View): void {
    const g = this.game;
    const p = g.player;
    if (view.mode === 'title') this.drift(dt);
    else this.follow(p.x, p.y, p.vx, p.vy, dt, g.phase !== 'playing' ? 1.18 : 1);
    // Dust from boots (or paws).
    const sp = Math.hypot(p.vx, p.vy);
    this.dustT -= dt;
    if (view.mode === 'play' && sp > 140 && this.dustT <= 0) {
      this.dustT = this.mounted ? 0.07 : 0.12;
      const sandy = g.inZoomies(p.x, p.y);
      this.push({
        kind: 'dust',
        x: p.x - Math.sign(p.vx || 1) * (this.mounted ? 22 : 8) + (Math.random() - 0.5) * 10,
        y: p.y - 2,
        vx: -p.vx * 0.1,
        vy: -10 - Math.random() * 10,
        life: 0.55,
        max: 0.55,
        size: sandy ? 8 : 5,
        color: sandy ? '#f0dcaa' : '#e7dcc0',
      });
    }
    this.updateParticles(dt);
  }

  render(alpha: number, view: View): void {
    const g = this.game;
    const p = g.player;
    const px = lerp(p.px, p.x, alpha);
    const py = lerp(p.py, p.y, alpha);
    const clock = g.clock;
    const kittenPos = new Map<string, { x: number; y: number }>();
    for (const kt of g.kittens) kittenPos.set(kt.id, { x: lerp(kt.px, kt.x, alpha), y: lerp(kt.py, kt.y, alpha) });
    const drawPlayer = (ctx: Ctx, ghost: boolean) => this.drawNatalie(ctx, px, py, ghost);
    this.renderFrame({
      clock,
      focus: { x: px, y: py },
      ground: (ctx, v) => this.drawGroundLayer(ctx, v, view),
      actors: (items, v) => {
        const ctx = this.ctx;
        for (const c of g.map.collectibles) {
          if (g.collected.has(c.id)) continue;
          if (c.x < v.x0 - 30 || c.x > v.x1 + 30 || c.y < v.y0 || c.y > v.y1 + 30) continue;
          items.push({ y: c.y, draw: () => (c.kind === 'horseshoe' ? drawHorseshoe(ctx, c.x, c.y, clock) : drawTreatBag(ctx, c.x, c.y, clock)) });
        }
        for (const kt of g.kittens) {
          const q = kittenPos.get(kt.id)!;
          if (q.x < v.x0 - 20 || q.x > v.x1 + 20 || q.y < v.y0 - 20 || q.y > v.y1 + 20) continue;
          items.push({ y: q.y, draw: () => drawKittenFigure(ctx, kittenLook(kt, q.x, q.y, clock)) });
        }
        items.push({ y: py, draw: () => drawPlayer(ctx, false) });
      },
      ghosts: (ctx, v) => {
        for (const kt of g.kittens) {
          if (kt.penned) continue;
          const q = kittenPos.get(kt.id)!;
          if (q.x < v.x0 || q.x > v.x1 || q.y < v.y0 || q.y > v.y1) continue;
          drawKittenFigure(ctx, { ...kittenLook(kt, q.x, q.y, clock), ring: null, ghost: true });
        }
        drawPlayer(ctx, true);
      },
      overlay: (ctx) => {
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
        const headY = this.mounted ? 70 : 62;
        if (p.mood.kind === 'chuff') this.bubbleText(ctx, px + p.faceX * 30, py - headY, this.mounted ? 'prrr!' : 'here, kitty!', C.tigerDark);
        else if (p.mood.kind === 'proud') star(ctx, px + p.faceX * 26, py - headY - 6 + Math.sin(clock * 6) * 2, 7, C.gold);
      },
      screen: (ctx, left, top, z) => {
        if (view.mode === 'play' && g.phase === 'playing') this.drawIndicators(ctx, left, top, z, kittenPos);
      },
    });
  }

  private drawNatalie(ctx: Ctx, x: number, y: number, ghost: boolean): void {
    const p = this.game.player;
    const sp = Math.hypot(p.vx, p.vy);
    const clock = this.game.clock;
    if (this.mounted) {
      drawRider(ctx, {
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
        clock,
        vertical: sp > 20 ? p.vy / sp : 0,
        ghost,
      });
      return;
    }
    drawPerson(ctx, FAMILY.natalie.look, {
      x,
      y,
      faceX: p.faceX,
      speed01: clamp(sp / p.maxSpeed, 0, 1),
      walkPhase: p.walkPhase * 0.85,
      clock,
      action: p.cheerT > 0 ? 'cheer' : p.throwT > 0 ? 'throw' : p.whistleT > 0 ? 'point' : 'none',
      actionT: p.throwT / 0.5,
      hat: this.hat,
      ghost,
    });
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
          ctx.save();
          ctx.translate(pen.x + ox * d, pen.y + oy * d);
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
