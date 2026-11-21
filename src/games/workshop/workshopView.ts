import { FAMILY } from '../../content/cast';
import { PAINTS } from '../../content/blueStar';
import { star } from '../../render/characters';
import { shade } from '../../render/furniture';
import { C } from '../../render/palette';
import { drawPerson } from '../../render/people';
import { wallStar } from '../../render/sprites';
import { CELL, PAINT_R, SAND_R, STAR_R, type Workshop, type WorkshopEvent } from './workshop';

type Ctx = CanvasRenderingContext2D;

interface Dust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  color: string;
}

/** Small seeded random, so the wood grain and old chips look the same every time. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Draws the Blue Star workshop: plank walls, the blue star on the wall, the piece on the floor
 * with its bare wood, old finish and new paint as layers, the paint shelf and Grandpa.
 */
export class WorkshopView {
  insetTop = 0;
  /** Where the finger is, while it's down (screen pixels). */
  pointer: { x: number; y: number } | null = null;
  private ctx: Ctx;
  private vw = 1;
  private vh = 1;
  private dpr = 1;
  /** Piece box on screen: top left, and screen pixels per piece unit. */
  px = 0;
  py = 0;
  s = 1;
  private wood: HTMLCanvasElement | null = null;
  private old: HTMLCanvasElement | null = null;
  private coat: HTMLCanvasElement | null = null;
  private built = '';
  private dust: Dust[] = [];
  private clock = 0;
  /** Seconds since the star went on (the stencil lifts away). */
  private starT = -1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private game: Workshop,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  setGame(g: Workshop): void {
    this.game = g;
    this.built = '';
    this.starT = -1;
    this.dust = [];
  }

  resize(w: number, h: number, dpr: number): void {
    this.vw = w;
    this.vh = h;
    this.dpr = Math.min(2, dpr);
    if (this.canvas.width !== Math.round(w * this.dpr)) this.canvas.width = Math.round(w * this.dpr);
    if (this.canvas.height !== Math.round(h * this.dpr)) this.canvas.height = Math.round(h * this.dpr);
    this.layout();
  }

  /** Floor line on screen. */
  get floorY(): number {
    return this.py + this.game.piece.h * this.s;
  }

  layout(): void {
    const p = this.game.piece;
    const top = this.insetTop + 34;
    const bottom = 184;
    const availH = Math.max(120, this.vh - top - bottom);
    const availW = Math.max(120, this.vw - 110);
    const s = Math.min(availW / p.w, availH / p.h, 3.4);
    this.px = Math.round((this.vw - p.w * s) / 2 + 18);
    this.py = Math.round(top + (availH - p.h * s) / 2 + 10);
    if (Math.abs(s - this.s) > 0.001 || this.built !== `${p.id}:${s}:${this.dpr}`) {
      this.s = s;
      this.rebuild();
    }
  }

  /** Screen point to piece units. */
  toPiece(x: number, y: number): { x: number; y: number } {
    return { x: (x - this.px) / this.s, y: (y - this.py) / this.s };
  }

  /** The paint cans on the shelf under the piece. */
  swatches(): { x: number; y: number; r: number }[] {
    const n = PAINTS.length;
    const gap = Math.min(58, (this.vw - 32) / n);
    const r = Math.min(22, gap / 2 - 4);
    const y = Math.min(this.vh - 96, this.floorY + 44);
    const x0 = this.vw / 2 - (gap * (n - 1)) / 2;
    return PAINTS.map((_, i) => ({ x: x0 + gap * i, y, r }));
  }

  swatchAt(x: number, y: number): number {
    return this.swatches().findIndex((w) => Math.hypot(x - w.x, y - w.y) <= w.r + 8);
  }

  /** The big button under the piece: on to the star, or send it out front. */
  doneBox(): { x: number; y: number; w: number; h: number } {
    return { x: this.vw / 2 - 110, y: Math.min(this.vh - 74, this.floorY + 94), w: 220, h: 44 };
  }

  private layer(): HTMLCanvasElement {
    const p = this.game.piece;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(p.w * this.s * this.dpr));
    c.height = Math.max(1, Math.ceil(p.h * this.s * this.dpr));
    const g = c.getContext('2d')!;
    g.setTransform(this.s * this.dpr, 0, 0, this.s * this.dpr, 0, 0);
    return c;
  }

  /** Open shelves stay dark: nothing sticks to thin air. */
  private punchOpen(g: Ctx): void {
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    for (const q of this.game.piece.parts) if (q.open) g.fillRect(q.x, q.y, q.w, q.h);
    g.restore();
  }

  private clipParts(g: Ctx): void {
    g.beginPath();
    for (const q of this.game.piece.parts) if (!q.open) g.rect(q.x, q.y, q.w, q.h);
    g.clip();
  }

  /** Redraw every layer from the game's grid (new piece, resize, restart). */
  rebuild(): void {
    const gm = this.game;
    const p = gm.piece;
    this.built = `${p.id}:${this.s}:${this.dpr}`;
    if (typeof document === 'undefined') return;
    const rand = rng(p.id.length * 977 + p.w);

    // Bare wood with a little grain.
    this.wood = this.layer();
    let g = this.wood.getContext('2d')!;
    for (const q of p.parts) {
      g.fillStyle = q.open ? '#3a2a20' : C.woodLight;
      g.fillRect(q.x, q.y, q.w, q.h);
      if (q.open) continue;
      g.strokeStyle = 'rgba(110,74,45,0.35)';
      g.lineWidth = 0.7;
      const vertical = q.h > q.w;
      const n = Math.max(2, Math.round((vertical ? q.w : q.h) / 5));
      for (let i = 0; i < n; i++) {
        const o = ((i + 0.5) / n) * (vertical ? q.w : q.h) + (rand() - 0.5) * 2;
        g.beginPath();
        if (vertical) {
          g.moveTo(q.x + o, q.y);
          g.bezierCurveTo(q.x + o + 2, q.y + q.h * 0.3, q.x + o - 2, q.y + q.h * 0.7, q.x + o + 1, q.y + q.h);
        } else {
          g.moveTo(q.x, q.y + o);
          g.bezierCurveTo(q.x + q.w * 0.3, q.y + o + 1.5, q.x + q.w * 0.7, q.y + o - 1.5, q.x + q.w, q.y + o);
        }
        g.stroke();
      }
    }

    // The tired old finish, already flaking in places.
    this.old = this.layer();
    g = this.old.getContext('2d')!;
    for (const q of p.parts) {
      if (q.open) continue;
      g.fillStyle = q.inset ? shade(p.oldPaint, 0.92) : p.oldPaint;
      g.fillRect(q.x, q.y, q.w, q.h);
    }
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 40; i++) g.fillRect(rand() * p.w, rand() * p.h, 1 + rand() * 6, 0.8);
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    for (let i = 0; i < 26; i++) {
      g.beginPath();
      g.ellipse(rand() * p.w, rand() * p.h, 1 + rand() * 3, 0.6 + rand() * 1.6, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < gm.sanded.length; i++) {
      if (!gm.sanded[i]) continue;
      g.fillRect((i % gm.cols) * CELL - 0.5, Math.floor(i / gm.cols) * CELL - 0.5, CELL + 1, CELL + 1);
    }
    g.globalCompositeOperation = 'source-over';
    this.punchOpen(g);

    // New paint.
    this.coat = this.layer();
    g = this.coat.getContext('2d')!;
    g.save();
    this.clipParts(g);
    for (let i = 0; i < gm.paint.length; i++) {
      const k = gm.paint[i];
      if (k < 0) continue;
      g.fillStyle = PAINTS[k].hex;
      g.fillRect((i % gm.cols) * CELL - 0.5, Math.floor(i / gm.cols) * CELL - 0.5, CELL + 1, CELL + 1);
    }
    g.restore();
    this.punchOpen(g);
  }

  /** A stroke just went on: sand it off or brush it on, smoothly, on top of the grid. */
  stroke(ax: number, ay: number, bx: number, by: number): void {
    const gm = this.game;
    if (gm.phase === 'sand' && this.old) {
      const g = this.old.getContext('2d')!;
      g.save();
      g.globalCompositeOperation = 'destination-out';
      g.lineCap = 'round';
      g.lineWidth = SAND_R * 2;
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.stroke();
      g.restore();
      const p = gm.piece;
      for (let i = 0; i < 2; i++) {
        this.dust.push({
          x: this.px + bx * this.s,
          y: this.py + by * this.s,
          vx: (Math.random() - 0.5) * 60,
          vy: 20 + Math.random() * 40,
          t: 0,
          color: p.oldPaint,
        });
      }
    } else if (gm.phase === 'paint' && this.coat) {
      const g = this.coat.getContext('2d')!;
      const col = PAINTS[gm.color].hex;
      g.save();
      this.clipParts(g);
      g.lineCap = 'round';
      g.strokeStyle = col;
      g.lineWidth = PAINT_R * 2;
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.stroke();
      // Bristle marks, just a hint of them.
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const nx = -(by - ay) / len;
      const ny = (bx - ax) / len;
      g.lineWidth = 0.8;
      g.strokeStyle = shade(col, 0.93);
      for (const o of [-6, -1.5, 4]) {
        g.beginPath();
        g.moveTo(ax + nx * o, ay + ny * o);
        g.lineTo(bx + nx * o, by + ny * o);
        g.stroke();
      }
      g.restore();
      this.punchOpen(g);
    }
  }

  handleEvent(e: WorkshopEvent): void {
    if (e.type === 'sanded' || e.type === 'painted') this.rebuild();
    if (e.type === 'starred') this.starT = 0;
  }

  update(dt: number): void {
    this.clock += dt;
    if (this.starT >= 0) this.starT += dt;
    for (const d of this.dust) {
      d.t += dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 90 * dt;
    }
    this.dust = this.dust.filter((d) => d.t < 0.8);
    if (this.dust.length > 120) this.dust.splice(0, this.dust.length - 120);
  }

  render(): void {
    const ctx = this.ctx;
    const gm = this.game;
    const p = gm.piece;
    this.layout();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.backdrop();

    // The piece: shadow, wood, what's left of the old finish, new paint, then the details.
    const w = p.w * this.s;
    const h = p.h * this.s;
    ctx.beginPath();
    ctx.ellipse(this.px + w / 2 + 4, this.floorY + 2, w * 0.58, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(40,24,12,0.28)';
    ctx.fill();
    if (this.wood) ctx.drawImage(this.wood, this.px, this.py, w, h);
    if (this.old) ctx.drawImage(this.old, this.px, this.py, w, h);
    if (this.coat) ctx.drawImage(this.coat, this.px, this.py, w, h);
    ctx.save();
    ctx.translate(this.px, this.py);
    ctx.scale(this.s, this.s);
    for (const q of p.parts) {
      if (q.inset) {
        // A little bevel so door and drawer fronts read as set in.
        ctx.fillStyle = 'rgba(40,24,12,0.1)';
        ctx.fillRect(q.x, q.y, q.w, q.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(q.x + 1.5, q.y + q.h - 1.5);
        ctx.lineTo(q.x + q.w - 1.5, q.y + q.h - 1.5);
        ctx.lineTo(q.x + q.w - 1.5, q.y + 1.5);
        ctx.stroke();
      }
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.2 / this.s;
      ctx.strokeRect(q.x, q.y, q.w, q.h);
    }
    for (const k of p.knobs) {
      ctx.beginPath();
      ctx.arc(k.x, k.y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = '#c9a548';
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.2 / this.s;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(k.x - 1, k.y - 1, 1, 0, Math.PI * 2);
      ctx.fillStyle = '#f3e1a0';
      ctx.fill();
    }
    if (gm.star) this.drawStar(ctx, gm.star.x, gm.star.y);
    else if (gm.phase === 'star') {
      // Where the stencil will go: under the finger, or the middle of the piece.
      const at = this.pointer ? this.toPiece(this.pointer.x, this.pointer.y) : { x: p.w / 2, y: p.h * 0.4 };
      ctx.globalAlpha = 0.45 + Math.sin(this.clock * 4) * 0.2;
      star(ctx, at.x, at.y, STAR_R, gm.starColorAt(at.x, at.y));
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    for (const d of this.dust) {
      ctx.globalAlpha = 1 - d.t / 0.8;
      ctx.fillStyle = d.color;
      ctx.fillRect(d.x, d.y, 2.5, 2.5);
    }
    ctx.globalAlpha = 1;

    this.tool();
    if (gm.phase === 'paint') this.shelf();
    this.grandpa();
    if (gm.phase === 'done' && this.starT > 1.2) this.button('Set it out front');
    else if (gm.phase === 'paint' && gm.covered) this.button('Ready for the star');
  }

  private drawStar(ctx: Ctx, x: number, y: number): void {
    const t = this.starT;
    const col = this.game.starColorAt(x, y);
    star(ctx, x, y, STAR_R, col);
    if (t >= 0 && t < 1.2) {
      // The card stencil lifting off.
      const k = Math.min(1, t / 1.2);
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.translate(x, y - k * 26);
      ctx.rotate(-k * 0.3);
      // A card with a star-shaped hole in it.
      const c = STAR_R * 1.7;
      ctx.beginPath();
      ctx.rect(-c, -c, c * 2, c * 2);
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? STAR_R * 0.45 : STAR_R;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = '#e9dcc0';
      ctx.fill('evenodd');
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1;
      ctx.strokeRect(-c, -c, c * 2, c * 2);
      ctx.restore();
    }
  }

  /** Plank walls, the blue star on the wall, a window of daylight, the floorboards. */
  private backdrop(): void {
    const ctx = this.ctx;
    const fy = this.floorY;
    ctx.fillStyle = '#c99a63';
    ctx.fillRect(0, 0, this.vw, fy);
    ctx.strokeStyle = 'rgba(90,58,32,0.45)';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < this.vw; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, fy);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(90,58,32,0.35)';
    for (let x = 17; x < this.vw; x += 68) {
      ctx.fillRect(x - 1, this.insetTop + 60, 2, 2);
      ctx.fillRect(x + 33, fy - 50, 2, 2);
    }
    // The window, with daylight from outside.
    const wx = this.vw - 92;
    const wy = this.insetTop + 66;
    ctx.fillStyle = '#cfe6f2';
    ctx.fillRect(wx, wy, 64, 56);
    ctx.fillStyle = '#9fcf7a';
    ctx.fillRect(wx, wy + 40, 64, 16);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.strokeRect(wx, wy, 64, 56);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wx + 32, wy);
    ctx.lineTo(wx + 32, wy + 56);
    ctx.moveTo(wx, wy + 28);
    ctx.lineTo(wx + 64, wy + 28);
    ctx.stroke();
    wallStar(ctx, 52, this.insetTop + 84, 24, '#2f63c0');
    // Floorboards.
    ctx.fillStyle = '#8a6440';
    ctx.fillRect(0, fy, this.vw, this.vh - fy);
    ctx.strokeStyle = 'rgba(40,24,12,0.3)';
    ctx.lineWidth = 1;
    for (let y = fy + 16; y < this.vh; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(this.vw, y + 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, fy - 1, this.vw, 3);
  }

  /** The sanding block or brush under the finger. */
  private tool(): void {
    const pt = this.pointer;
    const gm = this.game;
    if (!pt || (gm.phase !== 'sand' && gm.phase !== 'paint')) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(pt.x + 10, pt.y - 34);
    if (gm.phase === 'sand') {
      const wob = Math.sin(this.clock * 30) * 1.5;
      ctx.translate(wob, 0);
      ctx.fillStyle = '#d8c08a';
      ctx.fillRect(-18, 12, 36, 8);
      ctx.fillStyle = '#9a6b42';
      ctx.beginPath();
      ctx.roundRect(-16, -2, 32, 15, 4);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeRect(-18, 12, 36, 8);
    } else {
      ctx.rotate(0.5);
      ctx.fillStyle = '#9a6b42';
      ctx.beginPath();
      ctx.roundRect(-3.5, -30, 7, 26, 3);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#c9ced4';
      ctx.fillRect(-6, -5, 12, 7);
      ctx.strokeRect(-6, -5, 12, 7);
      ctx.fillStyle = PAINTS[gm.color].hex;
      ctx.beginPath();
      ctx.moveTo(-6, 2);
      ctx.lineTo(6, 2);
      ctx.lineTo(4, 16);
      ctx.lineTo(-4, 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The paint cans, lids off, with the one in hand raised up. */
  private shelf(): void {
    const ctx = this.ctx;
    const sw = this.swatches();
    sw.forEach((w, i) => {
      const on = i === this.game.color;
      const y = w.y - (on ? 6 : 0);
      ctx.fillStyle = '#c9ced4';
      ctx.beginPath();
      ctx.roundRect(w.x - w.r, y, w.r * 2, w.r * 0.9, 3);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(w.x, y, w.r, w.r * 0.45, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#9aa1a8';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(w.x, y, w.r * 0.82, w.r * 0.34, 0, 0, Math.PI * 2);
      ctx.fillStyle = PAINTS[i].hex;
      ctx.fill();
      if (on) {
        ctx.font = '800 11px ui-rounded, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#fffaf0';
        ctx.fillText(PAINTS[i].name, w.x, w.y + w.r * 0.9 + 6);
      }
    });
  }

  private grandpa(): void {
    const gm = this.game;
    const x = Math.max(30, this.px - 34);
    drawPerson(this.ctx, FAMILY.grandpa.look, {
      x,
      y: this.floorY + 4,
      faceX: 1,
      speed01: 0,
      walkPhase: 0,
      clock: this.clock,
      action: gm.phase === 'done' ? 'cheer' : gm.phase === 'star' ? 'point' : 'none',
      ghost: false,
    });
  }

  private button(text: string): void {
    const ctx = this.ctx;
    const r = this.doneBox();
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 22);
    ctx.fillStyle = C.barnRed;
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#fffaf0';
    ctx.font = '800 16px ui-rounded, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 1);
  }
}
