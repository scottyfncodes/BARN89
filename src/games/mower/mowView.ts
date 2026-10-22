import { FAMILY } from '../../content/cast';
import { hash2, lerp } from '../../core/math';
import { drawDog } from '../../render/animals';
import { C } from '../../render/palette';
import type { BuildingSprites, TreeSprites } from '../../render/sprites';
import type { TerrainTiles } from '../../render/terrain';
import { drawMower, type MowerPaint } from '../../render/vehicles';
import { WorldView } from '../../render/worldView';
import { CELL, type MowEvent, type MowGame } from './mower';

type Ctx = CanvasRenderingContext2D;

const TALL = ['#4f8a33', '#558f36', '#4a8430'];
const LIGHT = '#b4dc78';
const DARK = '#8cc456';
const PX = 1.6;

export class MowView extends WorldView {
  paint: MowerPaint = 'red';
  guideRect = { left: 0, top: 0, right: 0, bottom: 0 };
  private grass: HTMLCanvasElement;
  private gctx: Ctx;
  private chuteT = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly game: MowGame,
    shared?: { tiles: TerrainTiles; trees: TreeSprites; buildings: BuildingSprites },
  ) {
    super(canvas, game.shared.map, shared);
    this.zoomScale = 0.86;
    this.ambient.donkeys = true;
    this.grass = document.createElement('canvas');
    this.grass.width = Math.ceil(game.cols * CELL * PX);
    this.grass.height = Math.ceil(game.rows * CELL * PX);
    this.gctx = this.grass.getContext('2d')!;
    this.repaintAll();
  }

  snap(): void {
    const m = this.game.mower;
    this.snapTo(m.x, m.y);
  }

  /** Full repaint of the grass layer (new level or restart). */
  repaintAll(): void {
    const g = this.game;
    const ctx = this.gctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.grass.width, this.grass.height);
    ctx.setTransform(PX, 0, 0, PX, 0, 0);
    // Tall grass: soft overlapping blobs with blades, so the lawn edge looks organic.
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        if (!g.cells[r * g.cols + c]) continue;
        const x = (c + 0.5) * CELL;
        const y = (r + 0.5) * CELL;
        ctx.beginPath();
        ctx.arc(x, y, CELL * 0.82, 0, Math.PI * 2);
        ctx.fillStyle = TALL[Math.floor(hash2(c, r, 4) * 3)];
        ctx.fill();
      }
    }
    ctx.lineCap = 'round';
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        if (!g.cells[r * g.cols + c]) continue;
        const x = (c + 0.5) * CELL;
        const y = (r + 0.5) * CELL;
        for (let k = 0; k < 3; k++) {
          const bx = x + (hash2(c, r, 10 + k) - 0.5) * CELL;
          const by = y + (hash2(c, r, 20 + k) - 0.5) * CELL + 4;
          const lean = (hash2(c, r, 30 + k) - 0.5) * 4;
          ctx.strokeStyle = k === 0 ? '#3d7228' : '#7cb64a';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + lean, by - 7);
          ctx.stroke();
        }
      }
    }
    g.dirty = [];
    for (let i = 0; i < g.cells.length; i++) if (g.cells[i] > 1) this.paintCell(i);
  }

  private paintCell(i: number): void {
    const g = this.game;
    const v = g.cells[i];
    const c = i % g.cols;
    const r = Math.floor(i / g.cols);
    const ctx = this.gctx;
    ctx.fillStyle = v === 2 ? LIGHT : DARK;
    // Slight overdraw hides seams between cells.
    ctx.fillRect(c * CELL - 0.6, r * CELL - 0.6, CELL + 1.2, CELL + 1.2);
  }

  handleEvent(e: MowEvent): void {
    switch (e.type) {
      case 'bump':
        this.addShake(0.2);
        this.burst('dust', e.x, e.y, '#e7dcc0', 50, 5);
        this.floatText(e.x, e.y - 30, e.what === 'flowers' ? 'The flowers!' : 'Bonk!', '#ffffff');
        if (e.what === 'tree') this.burst('grass', e.x, e.y - 40, '#5f9e3f', 60, 6);
        break;
      case 'bed':
        this.burst('heart', e.x, e.y - 10, '#f26b8a', 60, 6);
        this.floatText(e.x, e.y - 30, 'Not the flowers!', '#ffd0dc');
        break;
      case 'toy':
        this.addShake(0.15);
        this.floatText(e.x, e.y - 30, 'Clank!', '#ffffff');
        this.burst('spark', e.x, e.y - 6, '#ffffff', 80, 8);
        break;
      case 'dog':
        this.floatText(e.x, e.y - 40, `Easy! ${e.name} is fine.`, '#ffffff', 12);
        break;
      case 'milestone':
        this.floatText(this.game.mower.x, this.game.mower.y - 50, `${e.pct}% mowed`, '#fff3b0', 14);
        break;
      case 'done':
        this.confetti();
        break;
      default:
        break;
    }
  }

  update(dt: number): void {
    const g = this.game;
    const m = g.mower;
    // Incremental grass updates.
    if (g.dirty.length) {
      const ctx = this.gctx;
      ctx.setTransform(PX, 0, 0, PX, 0, 0);
      for (const i of g.dirty) this.paintCell(i);
      g.dirty = [];
    }
    const vx = Math.cos(m.heading) * m.speed;
    const vy = Math.sin(m.heading) * m.speed;
    this.follow(m.x, m.y, vx, vy, dt, g.phase === 'celebrating' || g.phase === 'complete' ? 1.12 : 1, 0.45);
    // Clippings out of the side chute while cutting.
    this.chuteT -= dt;
    if (Math.abs(m.speed) > 40 && this.chuteT <= 0 && g.phase === 'playing') {
      this.chuteT = 0.05;
      const side = m.heading + Math.PI / 2;
      this.push({
        kind: 'grass',
        x: m.x + Math.cos(side) * 24,
        y: m.y + Math.sin(side) * 24 - 4,
        vx: Math.cos(side) * 90 + (Math.random() - 0.5) * 40,
        vy: Math.sin(side) * 90 - 60 - Math.random() * 40,
        life: 0.5,
        max: 0.5,
        size: 1.6 + Math.random() * 1.6,
        color: Math.random() < 0.5 ? '#7cb64a' : '#a3d264',
        rot: Math.random() * 6,
      });
    }
    this.updateParticles(dt);
  }

  render(alpha: number): void {
    const g = this.game;
    const m = g.mower;
    const x = lerp(m.px, m.x, alpha);
    const y = lerp(m.py, m.y, alpha);
    const heading = m.pheading + (m.heading - m.pheading) * alpha;
    const clock = g.clock;
    const jay = FAMILY.jay.look;
    this.renderFrame({
      clock,
      focus: { x, y },
      ground: (ctx) => {
        ctx.drawImage(this.grass, g.x0, g.y0, g.cols * CELL, g.rows * CELL);
        for (const b of g.beds) drawBed(ctx, b.x, b.y, b.r, b.colors, b.ruined);
      },
      actors: (items) => {
        const ctx = this.ctx;
        for (const t of g.toys) items.push({ y: t.y, draw: () => drawToy(ctx, t.x, t.y, t.kind, t.hit) });
        for (const d of g.dogs) {
          const dx = lerp(d.px, d.x, alpha);
          const dy = lerp(d.py, d.y, alpha);
          const sp = Math.hypot(d.x - d.px, d.y - d.py);
          items.push({
            y: dy,
            draw: () => drawDog(ctx, d.def, { x: dx, y: dy, faceX: d.faceX, pose: sp > 2.5 ? 'run' : sp > 0.2 ? 'walk' : 'sit', phase: d.phase, clock, wag: d.flee > 0 ? 1 : 0.5 }),
          });
        }
        items.push({ y: y + 10, draw: () => drawMower(ctx, x, y, heading, this.paint, jay, clock, g.phase === 'playing', m.bounce * 2) });
      },
      screen: (ctx, left, top, z) => {
        if (g.phase !== 'playing' || g.coverage < 0.6) return;
        const spot = this.nearestTall();
        if (!spot) return;
        this.edgeMarker(ctx, left, top, z, spot.x, spot.y, this.guideRect, (c) => {
          c.fillStyle = '#4f8a33';
          c.strokeStyle = C.ink;
          c.lineWidth = 1.5;
          for (const bx of [-5, 0, 5]) {
            c.beginPath();
            c.moveTo(bx - 1.5, 6);
            c.lineTo(bx, -7 + Math.abs(bx) * 0.4);
            c.lineTo(bx + 1.5, 6);
            c.closePath();
            c.fill();
            c.stroke();
          }
        }, '#cfe8b4');
      },
    });
  }

  private nearestTall(): { x: number; y: number } | null {
    const g = this.game;
    const m = g.mower;
    let best: { x: number; y: number } | null = null;
    let bd = Infinity;
    for (let r = 0; r < g.rows; r += 2) {
      for (let c = 0; c < g.cols; c += 2) {
        if (g.cells[r * g.cols + c] !== 1) continue;
        const x = g.x0 + (c + 0.5) * CELL;
        const y = g.y0 + (r + 0.5) * CELL;
        const d = (x - m.x) ** 2 + (y - m.y) ** 2;
        if (d < bd) {
          bd = d;
          best = { x, y };
        }
      }
    }
    return best;
  }
}

function drawBed(ctx: Ctx, x: number, y: number, r: number, colors: [string, string], ruined: boolean): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, r + 4, (r + 4) * 0.7, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#8a5a3a';
  ctx.fill();
  ctx.strokeStyle = '#d8c7a6';
  ctx.lineWidth = 3;
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = hash2(i, Math.round(x), 2) * Math.PI * 2;
    const d = Math.sqrt(hash2(i, Math.round(y), 3)) * r * 0.85;
    const fx = x + Math.cos(a) * d;
    const fy = y + Math.sin(a) * d * 0.7;
    if (ruined) {
      ctx.fillStyle = '#5f7a3a';
      ctx.fillRect(fx - 1, fy - 2, 2, 3);
      continue;
    }
    ctx.strokeStyle = '#3f7a35';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(fx, fy + 3);
    ctx.lineTo(fx, fy - 4);
    ctx.stroke();
    ctx.fillStyle = colors[i % 2];
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.arc(fx + Math.cos((k / 5) * 6.28) * 2.2, fy - 5 + Math.sin((k / 5) * 6.28) * 2.2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f2c53d';
    ctx.beginPath();
    ctx.arc(fx, fy - 5, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawToy(ctx: Ctx, x: number, y: number, kind: string, hit: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, 1, 8, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.shadow;
  ctx.fill();
  if (hit) ctx.globalAlpha = 0.5;
  if (kind === 'ball') {
    ctx.beginPath();
    ctx.arc(0, -6, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#3d7fd6';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(-6, -7, 12, 2.4);
  } else if (kind === 'frisbee') {
    ctx.beginPath();
    ctx.ellipse(0, -2, 9, 3.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f08a24';
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-3, -16);
    ctx.lineTo(3, -16);
    ctx.lineTo(3, -4);
    ctx.lineTo(10, -3);
    ctx.lineTo(10, 1);
    ctx.lineTo(-3, 1);
    ctx.closePath();
    ctx.fillStyle = '#3f6b3a';
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
