import { hash2, Rng } from '../core/math';
import type { BuildingDef, FenceStyle, PropDef, TreeDef } from '../world/mapTypes';
import { heartPath, star } from './characters';
import { C } from './palette';
import { drawPickup } from './vehicles';

type Ctx = CanvasRenderingContext2D;

function makeCanvas(w: number, h: number): { c: HTMLCanvasElement; ctx: Ctx } {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return { c, ctx: c.getContext('2d')! };
}

function blob(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

/* ------------------------------------------------------------------------------------------ */
/* Trees: a handful of pre-rendered variants scaled per tree                                    */
/* ------------------------------------------------------------------------------------------ */

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Anchor (ground point) in sprite pixels at scale 1. */
  ax: number;
  ay: number;
  w: number;
  h: number;
  scale: number;
}

const REF_R = 60;

function paintTree(ctx: Ctx, variant: TreeDef['variant'], seed: number): void {
  const rng = new Rng(seed);
  const r = REF_R;
  ctx.lineJoin = 'round';
  if (variant === 'pine') {
    // Trunk.
    ctx.fillStyle = C.woodDark;
    ctx.fillRect(-5, -16, 10, 18);
    const tiers = 4;
    for (let i = 0; i < tiers; i++) {
      const w = r * (1 - i * 0.2);
      const yb = -12 - i * r * 0.42;
      ctx.beginPath();
      ctx.moveTo(-w, yb);
      ctx.quadraticCurveTo(0, yb + 10, w, yb);
      ctx.lineTo(0, yb - r * 0.75);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? '#3f7a3c' : '#457f3f';
      ctx.fill();
      ctx.strokeStyle = '#25502a';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w * 0.15, yb - r * 0.55);
      ctx.lineTo(-w * 0.55, yb - 2);
      ctx.strokeStyle = 'rgba(160,210,120,0.45)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    return;
  }
  if (variant === 'bush') {
    const parts = 6;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < parts; i++) {
        const a = (i / parts) * Math.PI - Math.PI;
        const x = Math.cos(a) * r * 0.55;
        const y = -r * 0.45 + Math.sin(a) * r * 0.35;
        blob(ctx, x, y, r * 0.42 + rng.range(-4, 4));
        ctx.fillStyle = pass ? '#5f9e3c' : '#2f5a26';
        if (pass === 0) {
          ctx.lineWidth = 6;
          ctx.strokeStyle = '#2f5a26';
          ctx.stroke();
        }
        ctx.fill();
      }
    }
    blob(ctx, -r * 0.2, -r * 0.6, r * 0.3);
    ctx.fillStyle = 'rgba(170,220,110,0.5)';
    ctx.fill();
    // Berries.
    for (let i = 0; i < 7; i++) {
      blob(ctx, rng.range(-r * 0.7, r * 0.7), rng.range(-r * 0.8, -r * 0.2), 3);
      ctx.fillStyle = rng.next() < 0.5 ? '#e85d5d' : '#f2f2f2';
      ctx.fill();
    }
    return;
  }
  // Oak / willow: trunk then layered canopy.
  ctx.fillStyle = C.woodDark;
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.quadraticCurveTo(-5, -20, -6, -r * 0.8);
  ctx.lineTo(6, -r * 0.8);
  ctx.quadraticCurveTo(5, -20, 9, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#4a2f1b';
  ctx.lineWidth = 2;
  ctx.stroke();
  const cy = -r * 1.15;
  const dark = variant === 'willow' ? '#4d8a3a' : '#3f7a35';
  const mid = variant === 'willow' ? '#77b04f' : '#5f9e3f';
  const light = variant === 'willow' ? '#a2d06a' : '#8cc35a';
  const lobes: [number, number, number][] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rng.range(-0.2, 0.2);
    lobes.push([Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.5, r * 0.46 + rng.range(-5, 5)]);
  }
  for (const [x, y, rr] of lobes) {
    blob(ctx, x, y, rr + 3);
    ctx.fillStyle = '#2b5323';
    ctx.fill();
  }
  for (const [x, y, rr] of lobes) {
    blob(ctx, x, y, rr);
    ctx.fillStyle = dark;
    ctx.fill();
  }
  blob(ctx, 0, cy, r * 0.62);
  ctx.fillStyle = mid;
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    blob(ctx, rng.range(-r * 0.5, r * 0.1), cy + rng.range(-r * 0.5, 0), r * rng.range(0.16, 0.26));
    ctx.fillStyle = light;
    ctx.globalAlpha = 0.75;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (variant === 'willow') {
    ctx.strokeStyle = '#5c9a3e';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const x = -r * 0.8 + (i / 13) * r * 1.6;
      ctx.beginPath();
      ctx.moveTo(x, cy + r * 0.1);
      ctx.quadraticCurveTo(x + 4, cy + r * 0.5, x + 1, cy + r * 0.75);
      ctx.stroke();
    }
  } else {
    // A few apples on some oaks.
    if (seed % 3 === 0) {
      for (let i = 0; i < 6; i++) {
        blob(ctx, rng.range(-r * 0.6, r * 0.6), cy + rng.range(-r * 0.4, r * 0.4), 3.4);
        ctx.fillStyle = '#e04b3c';
        ctx.fill();
      }
    }
  }
}

export class TreeSprites {
  private sprites = new Map<string, Sprite>();
  constructor(private scale: number) {}

  setScale(s: number): void {
    if (Math.abs(s - this.scale) > 0.01) {
      this.scale = s;
      this.sprites.clear();
    }
  }

  get(t: TreeDef): Sprite {
    const v = t.seed % 4;
    const key = `${t.variant}:${v}`;
    let s = this.sprites.get(key);
    if (!s) {
      const w = REF_R * 2.8;
      const h = REF_R * 2.6;
      const k = this.scale * Math.max(1, 70 / REF_R);
      const { c, ctx } = makeCanvas(w * k, h * k);
      ctx.scale(k, k);
      ctx.translate(w / 2, h - 8);
      paintTree(ctx, t.variant, 1000 + v * 7919 + t.variant.length);
      s = { canvas: c, ax: w / 2, ay: h - 8, w, h, scale: k };
      this.sprites.set(key, s);
    }
    return s;
  }
}

/** Draws a tree sprite with its trunk base at (x, y). */
export function drawTree(ctx: Ctx, sprites: TreeSprites, t: TreeDef, alpha = 1, sway = 0): void {
  const s = sprites.get(t);
  const k = t.r / REF_R;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(t.x, t.y);
  if (sway) ctx.transform(1, 0, sway, 1, 0, 0);
  ctx.scale(k * (t.seed % 2 ? 1 : -1), k);
  ctx.drawImage(s.canvas, -s.ax, -s.ay, s.w, s.h);
  ctx.restore();
}

/** Visual bounds of a tree canopy for occlusion tests. */
export function treeCanopy(t: TreeDef): { x: number; y: number; w: number; h: number } {
  const k = t.r / REF_R;
  return { x: t.x - REF_R * 1.1 * k, y: t.y - REF_R * 2.0 * k, w: REF_R * 2.2 * k, h: REF_R * 2.0 * k - 6 };
}

/* ------------------------------------------------------------------------------------------ */
/* Buildings                                                                                    */
/* ------------------------------------------------------------------------------------------ */

function shingles(ctx: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  for (let yy = y + 8; yy < y + h; yy += 8) {
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
    const off = (yy / 8) % 2 ? 0 : 7;
    ctx.beginPath();
    for (let xx = x + off; xx < x + w; xx += 14) {
      ctx.moveTo(xx, yy - 8);
      ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
}

function windowAt(ctx: Ctx, x: number, y: number, w: number, h: number, shutters = '#5b7fa8', box = false): void {
  ctx.fillStyle = '#fff8e8';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = '#8fc4dc';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.moveTo(x + 2, y + h - 2);
  ctx.lineTo(x + w * 0.5, y + 2);
  ctx.lineTo(x + w * 0.7, y + 2);
  ctx.lineTo(x + w * 0.2, y + h - 2);
  ctx.fill();
  ctx.strokeStyle = '#fff8e8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
  if (shutters) {
    ctx.fillStyle = shutters;
    ctx.fillRect(x - 10, y - 3, 6, h + 6);
    ctx.fillRect(x + w + 4, y - 3, 6, h + 6);
    ctx.strokeRect(x - 10, y - 3, 6, h + 6);
    ctx.strokeRect(x + w + 4, y - 3, 6, h + 6);
  }
  if (box) {
    ctx.fillStyle = C.wood;
    ctx.fillRect(x - 4, y + h + 3, w + 8, 6);
    for (let i = 0; i < 4; i++) {
      blob(ctx, x + 2 + i * (w / 3), y + h + 2, 3);
      ctx.fillStyle = i % 2 ? '#f26b8a' : '#ffd34d';
      ctx.fill();
    }
  }
}

function paintBuilding(ctx: Ctx, b: BuildingDef): void {
  const w = b.w;
  const h = b.h;
  const wall = b.wall;
  // Local coordinates: footprint occupies (0..w, 0..h); the front wall rises from y=h up to y=h-wall.
  const roofTop = -wall * 0.15;
  const wallTop = h - wall;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Front wall.
  ctx.fillStyle = b.walls;
  ctx.fillRect(0, wallTop, w, wall);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;

  if (b.style === 'barn') {
    paintMetalBarn(ctx, b, wallTop, roofTop);
    return;
  }

  // Siding lines.
  ctx.strokeStyle = 'rgba(80,60,40,0.18)';
  ctx.lineWidth = 1;
  for (let y = wallTop + 7; y < h; y += 7) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  if (b.style === 'farmhouse') {
    windowAt(ctx, 30, wallTop + 26, 26, 30, '#5b7fa8', true);
    windowAt(ctx, w - 56, wallTop + 26, 26, 30, '#5b7fa8', true);
    windowAt(ctx, 92, wallTop + 26, 26, 30, '#5b7fa8');
    // Door.
    const dx = w / 2 + 34;
    ctx.fillStyle = '#c0443c';
    ctx.fillRect(dx, h - 48, 26, 48);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(dx, h - 48, 26, 48);
    blob(ctx, dx + 20, h - 24, 2);
    ctx.fillStyle = C.gold;
    ctx.fill();
    // Wreath with a paw-print.
    ctx.strokeStyle = '#3f7a35';
    ctx.lineWidth = 3;
    blob(ctx, dx + 13, h - 36, 6);
    ctx.stroke();
  } else if (b.style === 'cottage') {
    windowAt(ctx, 22, wallTop + 20, 22, 24, '#6f9f6a', true);
    windowAt(ctx, w - 50, wallTop + 20, 22, 24, '#6f9f6a', true);
    ctx.fillStyle = '#4f88c6';
    ctx.fillRect(w / 2 - 12, h - 42, 24, 42);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(w / 2 - 12, h - 42, 24, 42);
    ctx.beginPath();
    ctx.arc(w / 2, h - 42, 12, Math.PI, 0);
    ctx.fillStyle = '#4f88c6';
    ctx.fill();
    ctx.stroke();
  } else if (b.style === 'garage') {
    for (const gx of [10, w / 2 + 4]) {
      ctx.fillStyle = '#efe6d2';
      ctx.fillRect(gx, h - 50, w / 2 - 14, 50);
      ctx.strokeStyle = 'rgba(80,60,40,0.4)';
      for (let y = h - 44; y < h; y += 8) {
        ctx.beginPath();
        ctx.moveTo(gx, y);
        ctx.lineTo(gx + w / 2 - 14, y);
        ctx.stroke();
      }
      ctx.strokeStyle = C.ink;
      ctx.strokeRect(gx, h - 50, w / 2 - 14, 50);
    }
  } else if (b.style === 'shop') {
    paintShopFront(ctx, b, wallTop);
  } else if (b.style === 'shed') {
    ctx.fillStyle = '#3b2418';
    ctx.fillRect(w / 2 - 20, h - 50, 40, 50);
    ctx.strokeStyle = C.white;
    ctx.lineWidth = 3;
    ctx.strokeRect(w / 2 - 20, h - 50, 40, 50);
    ctx.beginPath();
    ctx.moveTo(w / 2 - 20, h - 50);
    ctx.lineTo(w / 2 + 20, h);
    ctx.stroke();
    windowAt(ctx, 14, wallTop + 14, 18, 16, '');
  } else if (b.style === 'coop') {
    ctx.fillStyle = '#3b2418';
    ctx.fillRect(w / 2 - 7, h - 16, 14, 16);
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 6, h);
    ctx.lineTo(w / 2 - 2, h + 12);
    ctx.moveTo(w / 2 + 6, h);
    ctx.lineTo(w / 2 + 10, h + 12);
    ctx.stroke();
  }

  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, wallTop, w, wall);

  // Gable roof seen from above: a back slope (lit) and a front slope.
  const over = b.style === 'coop' ? 5 : 12;
  const ridge = roofTop + (wallTop - roofTop) * 0.42;
  ctx.fillStyle = b.roof;
  ctx.beginPath();
  ctx.moveTo(-over, wallTop + 6);
  ctx.lineTo(w + over, wallTop + 6);
  ctx.lineTo(w + over * 0.6, roofTop);
  ctx.lineTo(-over * 0.6, roofTop);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(-over * 0.6, roofTop, w + over * 1.2, ridge - roofTop);
  shingles(ctx, -over, roofTop, w + over * 2, wallTop + 6 - roofTop, 'rgba(0,0,0,0.16)');
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-over * 0.6, ridge);
  ctx.lineTo(w + over * 0.6, ridge);
  ctx.stroke();
  // Eave shadow on the wall.
  ctx.fillStyle = 'rgba(40,20,10,0.22)';
  ctx.fillRect(0, wallTop + 6, w, 7);

  if (b.style === 'farmhouse') {
    // Chimney.
    ctx.fillStyle = '#b5543f';
    ctx.fillRect(w - 70, roofTop - 22, 22, 40);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.8;
    ctx.strokeRect(w - 70, roofTop - 22, 22, 40);
    ctx.fillStyle = '#7d3527';
    ctx.fillRect(w - 73, roofTop - 26, 28, 6);
    // Front porch roof over the door side.
    const px = w / 2 - 20;
    ctx.fillStyle = '#6b7b8d';
    ctx.beginPath();
    ctx.moveTo(px, h - 58);
    ctx.lineTo(w - 8, h - 58);
    ctx.lineTo(w + 2, h - 44);
    ctx.lineTo(px - 10, h - 44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.white;
    for (const x of [px - 4, (px + w) / 2, w - 6]) {
      ctx.fillRect(x - 2.5, h - 44, 5, 44);
      ctx.strokeRect(x - 2.5, h - 44, 5, 44);
    }
  }
  if (b.label) {
    // Tiny house number / name plaque.
    ctx.font = 'bold 7px ui-rounded, system-ui, sans-serif';
    const pw = Math.max(30, ctx.measureText(b.label).width + 8);
    ctx.fillStyle = C.wood;
    ctx.fillRect(23 - pw / 2, h - 18, pw, 11);
    ctx.fillStyle = C.white;
    ctx.font = 'bold 7px ui-rounded, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, 23, h - 10);
  }
}

/** A plain five-pointed star with a little folded-metal shading, like a star hung on a shop wall. */
function wallStar(ctx: Ctx, cx: number, cy: number, r: number, color: string): void {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  // Each point folds along its spine: one half catches the light, the other doesn't.
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  for (let i = 0; i < 10; i += 2) {
    const [px, py] = pts[i];
    const [qx, qy] = pts[(i + 1) % 10];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.lineTo(qx, qy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.8;
  ctx.stroke();
}

/** Grandpa's shop: a roll-up door, a side door and a window. */
function paintShopFront(ctx: Ctx, b: BuildingDef, wallTop: number): void {
  const w = b.w;
  const h = b.h;
  const dw = Math.min(110, w * 0.55);
  const dx = 14;
  const dTop = h - 52;
  ctx.fillStyle = '#e4e7ea';
  ctx.fillRect(dx, dTop, dw, 52);
  ctx.strokeStyle = 'rgba(70,80,90,0.35)';
  ctx.lineWidth = 1;
  for (let y = dTop + 6; y < h; y += 6) {
    ctx.beginPath();
    ctx.moveTo(dx, y);
    ctx.lineTo(dx + dw, y);
    ctx.stroke();
  }
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.8;
  ctx.strokeRect(dx, dTop, dw, 52);
  // Side door.
  const sx = w - 40;
  ctx.fillStyle = '#7a8a9a';
  ctx.fillRect(sx, h - 44, 22, 44);
  ctx.strokeRect(sx, h - 44, 22, 44);
  blob(ctx, sx + 17, h - 22, 1.8);
  ctx.fillStyle = C.gold;
  ctx.fill();
  // Window, with something green on the sill.
  const wx = dx + dw + 12;
  const wy = wallTop + 34;
  windowAt(ctx, wx, wy, 26, 20, '');
  ctx.fillStyle = C.woodLight;
  ctx.fillRect(wx - 5, wy + 23, 36, 4);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(wx - 5, wy + 23, 36, 4);
  grannySmith(ctx, wx + 22, wy + 19);
  if (b.star) wallStar(ctx, dx + dw / 2, wallTop + 30, 16, b.star);
}

/** One green apple. */
function grannySmith(ctx: Ctx, x: number, y: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, 4.6, 4.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#8cc63f';
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x - 1.6, y - 1.4, 1.3, 0.9, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fill();
  ctx.strokeStyle = '#5a3b22';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x + 0.6, y - 6.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x + 2.4, y - 5.6, 2, 1, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#4f9a3a';
  ctx.fill();
}

/** Corrugated metal wall: red panels with ribs and white corner trim, like the real Barn 89. */
function metalWall(ctx: Ctx, w: number, top: number, bottom: number): void {
  ctx.strokeStyle = 'rgba(60,10,8,0.28)';
  ctx.lineWidth = 1.4;
  for (let x = 6; x < w; x += 7) {
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }
  ctx.fillStyle = C.white;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.4;
  for (const x of [0, w - 9]) {
    ctx.fillRect(x, top, 9, bottom - top);
    ctx.strokeRect(x, top, 9, bottom - top);
  }
  ctx.fillRect(0, top, w, 7);
  ctx.strokeRect(0, top, w, 7);
  // Stone skirt along the bottom.
  ctx.fillStyle = '#b9b1a3';
  ctx.fillRect(9, bottom - 6, w - 18, 6);
}

/** Standing-seam metal roof seen from above, with clear skylight strips and white edge trim. */
function metalRoof(ctx: Ctx, w: number, y0: number, y1: number, color: string, skylights: number): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.rect(-10, y0, w + 20, y1 - y0);
  ctx.fill();
  ctx.stroke();
  // Lit half and shaded half either side of the ridge.
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(-10, y0, (w + 20) / 2, y1 - y0);
  ctx.strokeStyle = 'rgba(30,40,60,0.22)';
  ctx.lineWidth = 1.2;
  for (let x = -4; x < w + 10; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, y0 + 2);
    ctx.lineTo(x, y1 - 2);
    ctx.stroke();
  }
  // Ridge cap.
  ctx.fillStyle = '#c9d1db';
  ctx.fillRect(w / 2 - 4, y0, 8, y1 - y0);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(w / 2 - 4, y0, 8, y1 - y0);
  // Skylight strips down each slope.
  ctx.fillStyle = 'rgba(240,246,250,0.85)';
  for (let i = 0; i < skylights; i++) {
    const yy = y0 + ((i + 0.5) / skylights) * (y1 - y0) - 5;
    for (const sx of [w * 0.28, w * 0.72]) ctx.fillRect(sx - 9, yy, 18, 10);
  }
  // White trim along the eave.
  ctx.fillStyle = C.white;
  ctx.fillRect(-10, y1 - 5, w + 20, 5);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(-10, y1 - 5, w + 20, 5);
}

function paintMetalBarn(ctx: Ctx, b: BuildingDef, wallTop: number, roofTop: number): void {
  const w = b.w;
  const h = b.h;
  ctx.fillStyle = b.walls;
  ctx.fillRect(0, wallTop, w, h - wallTop);
  metalWall(ctx, w, wallTop, h);
  // Big sliding door, rolled open with hay inside.
  const dw = Math.min(130, w * 0.42);
  const dx = w / 2 - dw / 2;
  const dh = Math.min(96, (h - wallTop) - 34);
  const dTop = h - dh;
  ctx.fillStyle = '#2e1d14';
  ctx.fillRect(dx, dTop, dw, dh);
  ctx.fillStyle = '#e7c35d';
  ctx.beginPath();
  ctx.moveTo(dx + 6, h);
  ctx.quadraticCurveTo(dx + dw * 0.3, h - 34, dx + dw * 0.55, h - 22);
  ctx.quadraticCurveTo(dx + dw * 0.8, h - 40, dx + dw - 4, h);
  ctx.fill();
  // The slid-back door panel, white like the trim.
  ctx.fillStyle = '#e9ecef';
  ctx.fillRect(dx + dw - 6, dTop, 40, dh);
  ctx.strokeStyle = 'rgba(80,90,100,0.35)';
  ctx.lineWidth = 1;
  for (let x = dx + dw; x < dx + dw + 34; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, dTop);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(dx + dw - 6, dTop, 40, dh);
  ctx.fillStyle = C.white;
  ctx.fillRect(dx - 6, dTop - 7, dw + 52, 7);
  ctx.strokeRect(dx - 6, dTop - 7, dw + 52, 7);
  ctx.strokeRect(dx, dTop, dw, dh);
  if (b.label) {
    const sw = Math.min(150, w - 40);
    const sy = Math.max(wallTop + 12, dTop - 40);
    ctx.fillStyle = C.white;
    ctx.fillRect(w / 2 - sw / 2, sy, sw, 28);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(w / 2 - sw / 2, sy, sw, 28);
    ctx.fillStyle = C.barnRed;
    ctx.font = '900 21px Rockwell, "Roboto Slab", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, w / 2, sy + 15);
  }
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, wallTop, w, h - wallTop);
  metalRoof(ctx, w, roofTop - 10, wallTop + 4, b.roof, Math.max(2, Math.round(h / 110)));
  // A row of round roof vents along the ridge.
  for (let i = 0; i < 3; i++) {
    const vy = roofTop + ((i + 1) / 4) * (wallTop - roofTop);
    ctx.beginPath();
    ctx.arc(w / 2, vy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#dfe3e6';
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
}

export class BuildingSprites {
  private sprites = new Map<string, Sprite>();
  constructor(private scale: number) {}

  setScale(s: number): void {
    if (Math.abs(s - this.scale) > 0.01) {
      this.scale = s;
      this.sprites.clear();
    }
  }

  get(b: BuildingDef): Sprite {
    let s = this.sprites.get(b.id);
    if (!s) {
      const pad = 30;
      const top = b.wall * 0.15 + 60;
      const w = b.w + pad * 2;
      const h = b.h + top + 20;
      const k = this.scale;
      const { c, ctx } = makeCanvas(w * k, h * k);
      ctx.scale(k, k);
      ctx.translate(pad, top);
      paintBuilding(ctx, b);
      s = { canvas: c, ax: pad, ay: top, w, h, scale: k };
      this.sprites.set(b.id, s);
    }
    return s;
  }
}

export function drawBuilding(ctx: Ctx, sprites: BuildingSprites, b: BuildingDef, alpha = 1): void {
  const s = sprites.get(b);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(s.canvas, b.x - s.ax, b.y - s.ay, s.w, s.h);
  ctx.restore();
}

/* ------------------------------------------------------------------------------------------ */
/* Fences: drawn in short y-sorted pieces so characters weave in front of and behind them       */
/* ------------------------------------------------------------------------------------------ */

export interface FencePiece {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  style: FenceStyle;
  /** Draw the post at the start. */
  postA: boolean;
  postB: boolean;
}

export function splitFence(points: readonly (readonly [number, number])[], style: FenceStyle, step: number): FencePiece[] {
  const out: FencePiece[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.round(len / step));
    for (let j = 0; j < n; j++) {
      const t0 = j / n;
      const t1 = (j + 1) / n;
      out.push({
        ax: ax + (bx - ax) * t0,
        ay: ay + (by - ay) * t0,
        bx: ax + (bx - ax) * t1,
        by: ay + (by - ay) * t1,
        style,
        postA: true,
        postB: i === points.length - 2 && j === n - 1,
      });
    }
  }
  return out;
}

export function drawFencePiece(ctx: Ctx, f: FencePiece): void {
  const H = f.style === 'picket' ? 15 : f.style === 'round' ? 17 : 19;
  ctx.lineCap = 'round';
  // Shadow on the ground.
  ctx.strokeStyle = 'rgba(40,30,15,0.2)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(f.ax + 4, f.ay + 3);
  ctx.lineTo(f.bx + 4, f.by + 3);
  ctx.stroke();
  if (f.style === 'picket') {
    const len = Math.hypot(f.bx - f.ax, f.by - f.ay);
    const n = Math.max(1, Math.round(len / 7));
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.2;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = f.ax + (f.bx - f.ax) * t;
      const y = f.ay + (f.by - f.ay) * t;
      ctx.fillStyle = C.picket;
      ctx.beginPath();
      ctx.moveTo(x - 2.4, y);
      ctx.lineTo(x - 2.4, y - H + 3);
      ctx.lineTo(x, y - H);
      ctx.lineTo(x + 2.4, y - H + 3);
      ctx.lineTo(x + 2.4, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = '#d9cfba';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(f.ax, f.ay - H * 0.55);
    ctx.lineTo(f.bx, f.by - H * 0.55);
    ctx.stroke();
    return;
  }
  const rail = f.style === 'round' ? '#b9875a' : C.woodGrey;
  const railDark = f.style === 'round' ? '#7d5432' : '#6f6455';
  for (const hy of [H * 0.42, H * 0.85]) {
    ctx.strokeStyle = railDark;
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.moveTo(f.ax, f.ay - hy);
    ctx.lineTo(f.bx, f.by - hy);
    ctx.stroke();
    ctx.strokeStyle = rail;
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }
  const post = (x: number, y: number) => {
    ctx.fillStyle = railDark;
    ctx.fillRect(x - 3.2, y - H - 3, 6.4, H + 3);
    ctx.fillStyle = rail;
    ctx.fillRect(x - 2, y - H - 2, 3, H + 1);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x - 3.2, y - H - 3, 6.4, 2);
  };
  if (f.postA) post(f.ax, f.ay);
  if (f.postB) post(f.bx, f.by);
}

/* ------------------------------------------------------------------------------------------ */
/* Props                                                                                        */
/* ------------------------------------------------------------------------------------------ */

export function drawProp(ctx: Ctx, p: PropDef, clock: number): void {
  const { x, y } = p;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.6;
  switch (p.kind) {
    case 'roundBale': {
      const r = p.w ?? 24;
      ctx.beginPath();
      ctx.ellipse(x + 4, y + 3, r, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.shadow;
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x - r, y - r * 1.5, r * 2, r * 1.5, 6);
      ctx.fillStyle = '#e5c25e';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y - r * 1.5, r, r * 0.42, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f2d67a';
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(150,110,30,0.6)';
      ctx.beginPath();
      ctx.ellipse(x, y - r * 1.5, r * 0.55, r * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - r, y - r * 0.8);
      ctx.lineTo(x + r, y - r * 0.8);
      ctx.stroke();
      break;
    }
    case 'squareBale': {
      const w = p.w ?? 56;
      const h = p.h ?? 30;
      ctx.fillStyle = C.shadow;
      ctx.fillRect(x - w / 2 + 4, y - h / 2 + 6, w, h);
      ctx.fillStyle = '#e8c86a';
      ctx.fillRect(x - w / 2, y - h / 2 - 14, w, h);
      ctx.strokeRect(x - w / 2, y - h / 2 - 14, w, h);
      ctx.fillStyle = '#d6b04f';
      ctx.fillRect(x - w / 2, y + h / 2 - 14, w, 14);
      ctx.strokeRect(x - w / 2, y + h / 2 - 14, w, 14);
      ctx.strokeStyle = '#8a6a2a';
      ctx.beginPath();
      ctx.moveTo(x - w / 6, y - h / 2 - 14);
      ctx.lineTo(x - w / 6, y + h / 2);
      ctx.moveTo(x + w / 6, y - h / 2 - 14);
      ctx.lineTo(x + w / 6, y + h / 2);
      ctx.stroke();
      break;
    }
    case 'barrel': {
      const r = p.w ?? 14;
      ctx.beginPath();
      ctx.ellipse(x + 3, y + 2, r, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.shadow;
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x - r, y - r * 2, r * 2, r * 2, 5);
      ctx.fillStyle = p.y < 2100 ? '#d9534a' : C.wood;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(x - r, y - r * 1.45, r * 2, 3);
      ctx.fillRect(x - r, y - r * 0.6, r * 2, 3);
      ctx.beginPath();
      ctx.ellipse(x, y - r * 2, r, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.y < 2100 ? '#e8766e' : C.woodLight;
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'trough': {
      const w = p.w ?? 76;
      const h = p.h ?? 26;
      ctx.fillStyle = C.shadow;
      ctx.fillRect(x - w / 2 + 4, y - h / 2 + 4, w, h);
      ctx.fillStyle = '#8f9aa3';
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h / 2 - 8, w, h + 8, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.water;
      ctx.beginPath();
      ctx.roundRect(x - w / 2 + 5, y - h / 2 - 4, w - 10, h - 8, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      const s = Math.sin(clock * 2) * 4;
      ctx.moveTo(x - 14 + s, y - 4);
      ctx.lineTo(x + 2 + s, y - 4);
      ctx.stroke();
      break;
    }
    case 'mailbox': {
      ctx.fillStyle = C.woodDark;
      ctx.fillRect(x - 2, y - 22, 4, 22);
      ctx.beginPath();
      ctx.roundRect(x - 11, y - 34, 22, 13, [7, 7, 2, 2]);
      ctx.fillStyle = '#3d6fb0';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e04646';
      ctx.fillRect(x + 9, y - 38, 2.5, 9);
      ctx.fillStyle = C.white;
      ctx.font = 'bold 5px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('N & D', x, y - 25.5);
      break;
    }
    case 'sign': {
      ctx.fillStyle = C.woodDark;
      ctx.fillRect(x - 2, y - 24, 4, 24);
      const text = p.text ?? '';
      ctx.font = 'bold 8px ui-rounded, system-ui, sans-serif';
      const tw = ctx.measureText(text).width + 12;
      ctx.beginPath();
      ctx.roundRect(x - tw / 2, y - 38, tw, 15, 3);
      ctx.fillStyle = C.woodLight;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'center';
      ctx.fillText(text, x, y - 27.5);
      break;
    }
    case 'scarecrow': {
      ctx.fillStyle = C.woodDark;
      ctx.fillRect(x - 2, y - 40, 4, 40);
      ctx.fillRect(x - 16, y - 32, 32, 3.5);
      ctx.beginPath();
      ctx.moveTo(x - 9, y - 32);
      ctx.lineTo(x + 9, y - 32);
      ctx.lineTo(x + 7, y - 14);
      ctx.lineTo(x - 7, y - 14);
      ctx.closePath();
      ctx.fillStyle = '#6a8fc0';
      ctx.fill();
      ctx.stroke();
      blob(ctx, x, y - 42, 7);
      ctx.fillStyle = '#f0dba0';
      ctx.fill();
      ctx.stroke();
      // Sad face (he was fired).
      ctx.beginPath();
      ctx.arc(x, y - 37, 2.5, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.fillRect(x - 3, y - 44, 1.5, 1.5);
      ctx.fillRect(x + 2, y - 44, 1.5, 1.5);
      ctx.beginPath();
      ctx.ellipse(x, y - 49, 11, 3, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#b48a4a';
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(x - 6, y - 56, 12, 7);
      // A crow, perfectly unbothered.
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.ellipse(x + 14, y - 36, 4.5, 3, -0.2, 0, Math.PI * 2);
      ctx.fill();
      blob(ctx, x + 17.5, y - 39, 2.3);
      ctx.fill();
      ctx.fillStyle = '#f2b33a';
      ctx.beginPath();
      ctx.moveTo(x + 19.5, y - 39.5);
      ctx.lineTo(x + 22.5, y - 38.5);
      ctx.lineTo(x + 19.5, y - 37.8);
      ctx.fill();
      break;
    }
    case 'box': {
      ctx.fillStyle = C.shadow;
      ctx.fillRect(x - 12, y - 4, 28, 9);
      ctx.fillStyle = '#c99a5b';
      ctx.fillRect(x - 13, y - 18, 26, 18);
      ctx.strokeRect(x - 13, y - 18, 26, 18);
      ctx.fillStyle = '#b48447';
      ctx.beginPath();
      ctx.moveTo(x - 13, y - 18);
      ctx.lineTo(x - 19, y - 25);
      ctx.lineTo(x - 5, y - 25);
      ctx.lineTo(x, y - 18);
      ctx.moveTo(x + 13, y - 18);
      ctx.lineTo(x + 19, y - 25);
      ctx.lineTo(x + 5, y - 25);
      ctx.lineTo(x, y - 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#7d5a30';
      ctx.font = 'bold 5px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FRAGILE', x, y - 8);
      break;
    }
    case 'jump': {
      const half = (p.w ?? 100) / 2;
      for (const ex of [-half, half]) {
        ctx.fillStyle = C.white;
        ctx.fillRect(x + ex - 3, y - 22, 6, 22);
        ctx.strokeRect(x + ex - 3, y - 22, 6, 22);
      }
      for (const [hy, col] of [[14, '#e04646'], [7, '#ffffff']] as const) {
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x - half, y - hy);
        ctx.lineTo(x + half, y - hy);
        ctx.stroke();
        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 10]);
        ctx.stroke();
        ctx.strokeStyle = col === '#ffffff' ? '#e04646' : '#ffffff';
        ctx.lineDashOffset = 10;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      }
      break;
    }
    case 'clothesline': {
      const w = p.w ?? 150;
      ctx.fillStyle = C.woodDark;
      ctx.fillRect(x - w / 2 - 2, y - 36, 4, 36);
      ctx.fillRect(x + w / 2 - 2, y - 36, 4, 36);
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y - 34);
      ctx.quadraticCurveTo(x, y - 26, x + w / 2, y - 34);
      ctx.stroke();
      const items = ['#e46f8f', '#6fa3e4', '#f2c94c', '#fff'];
      items.forEach((col, i) => {
        const ix = x - w / 2 + 22 + i * 34;
        const sway = Math.sin(clock * 2 + i) * 1.5;
        ctx.fillStyle = col;
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        if (i === 1) {
          // One lonely sock.
          ctx.moveTo(ix, y - 31);
          ctx.lineTo(ix + 5, y - 31);
          ctx.lineTo(ix + 5 + sway, y - 20);
          ctx.lineTo(ix + 11 + sway, y - 18);
          ctx.lineTo(ix + 10 + sway, y - 14);
          ctx.lineTo(ix + sway, y - 16);
        } else {
          ctx.rect(ix + sway * 0.3, y - 31, 16, 15);
        }
        ctx.fill();
        ctx.stroke();
      });
      break;
    }
    case 'flowers': {
      const r = p.w ?? 30;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.62, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#7a5434';
      ctx.fill();
      ctx.strokeStyle = '#d8d0c0';
      ctx.lineWidth = 3;
      ctx.stroke();
      for (let i = 0; i < Math.round(r / 2.5); i++) {
        const a = hash2(i, Math.round(x), 3) * Math.PI * 2;
        const d = Math.sqrt(hash2(i, Math.round(y), 4)) * r * 0.85;
        const fx = x + Math.cos(a) * d;
        const fy = y + Math.sin(a) * d * 0.6;
        ctx.strokeStyle = '#4f8a35';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx, fy - 7);
        ctx.stroke();
        blob(ctx, fx, fy - 8, 3);
        ctx.fillStyle = ['#ff7aa2', '#ffd34d', '#ffffff', '#b98cf0', '#ff9a52'][i % 5];
        ctx.fill();
      }
      break;
    }
    case 'rock': {
      const r = p.w ?? 20;
      ctx.beginPath();
      ctx.ellipse(x + 3, y + 2, r, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.shadow;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - r, y);
      ctx.quadraticCurveTo(x - r, y - r * 1.2, x - r * 0.2, y - r * 1.1);
      ctx.quadraticCurveTo(x + r * 0.9, y - r * 1.2, x + r, y);
      ctx.closePath();
      ctx.fillStyle = '#a7a39a';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.3, y - r * 0.75, r * 0.35, r * 0.18, -0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'cart': {
      ctx.fillStyle = C.shadow;
      ctx.fillRect(x - 34, y - 4, 72, 14);
      ctx.fillStyle = C.wood;
      ctx.fillRect(x - 34, y - 30, 68, 22);
      ctx.strokeRect(x - 34, y - 30, 68, 22);
      ctx.strokeStyle = C.woodDark;
      ctx.beginPath();
      ctx.moveTo(x - 34, y - 19);
      ctx.lineTo(x + 34, y - 19);
      ctx.stroke();
      ctx.fillStyle = '#e8c86a';
      ctx.beginPath();
      ctx.ellipse(x, y - 30, 30, 7, 0, Math.PI, 0);
      ctx.fill();
      for (const wx of [-22, 22]) {
        blob(ctx, x + wx, y - 6, 9);
        ctx.fillStyle = C.woodDark;
        ctx.fill();
        ctx.strokeStyle = C.ink;
        ctx.stroke();
        blob(ctx, x + wx, y - 6, 2.5);
        ctx.fillStyle = C.woodLight;
        ctx.fill();
      }
      ctx.strokeStyle = C.woodDark;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 34, y - 14);
      ctx.lineTo(x + 52, y - 8);
      ctx.stroke();
      break;
    }
    case 'yarn': {
      blob(ctx, x, y - 6, 6.5);
      ctx.fillStyle = '#ef6f9a';
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#c94a76';
      ctx.lineWidth = 1;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(x + i * 2, y - 6, 5, -1, 1.4);
        ctx.stroke();
      }
      ctx.strokeStyle = '#ef6f9a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x + 5, y - 2);
      ctx.bezierCurveTo(x + 14, y + 4, x + 20, y - 6, x + 28, y + 2);
      ctx.stroke();
      break;
    }
    case 'napHay': {
      const w = p.w ?? 70;
      ctx.beginPath();
      ctx.ellipse(x, y, w / 2, w / 4, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#e8c86a';
      ctx.fill();
      ctx.strokeStyle = '#b8963c';
      ctx.stroke();
      // Tiger-shaped dent.
      ctx.beginPath();
      ctx.ellipse(x - 4, y, w * 0.3, w * 0.13, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#c9a548';
      ctx.fill();
      blob(ctx, x + w * 0.28, y - 3, w * 0.09);
      ctx.fill();
      ctx.strokeStyle = 'rgba(240,138,36,0.8)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 10 + i * 5, y - 4);
        ctx.lineTo(x - 8 + i * 5, y + 3);
        ctx.stroke();
      }
      break;
    }
    case 'mouseHole': {
      ctx.beginPath();
      ctx.arc(x, y, 6, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = '#1e120b';
      ctx.fill();
      // Two eyes blink in the dark now and then.
      if (Math.sin(clock * 0.9) > 0.3) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - 2.5, y - 3, 1.2, 1.2);
        ctx.fillRect(x + 1.3, y - 3, 1.2, 1.2);
      }
      break;
    }
    case 'well': {
      ctx.beginPath();
      ctx.ellipse(x + 4, y + 2, 24, 9, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.shadow;
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x - 20, y - 22, 40, 22, 4);
      ctx.fillStyle = '#a7a39a';
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(60,50,40,0.4)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 20, y - 6 - i * 6);
        ctx.lineTo(x + 20, y - 6 - i * 6);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(x, y - 22, 20, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#26323a';
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.stroke();
      ctx.fillStyle = C.woodDark;
      ctx.fillRect(x - 18, y - 52, 4, 30);
      ctx.fillRect(x + 14, y - 52, 4, 30);
      ctx.fillStyle = C.roofRed;
      ctx.beginPath();
      ctx.moveTo(x - 26, y - 46);
      ctx.lineTo(x, y - 62);
      ctx.lineTo(x + 26, y - 46);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'trampoline': {
      const r = p.w ?? 40;
      ctx.beginPath();
      ctx.ellipse(x + 6, y + 4, r, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.shadow;
      ctx.fill();
      ctx.fillStyle = '#555';
      for (const lx of [-0.75, 0, 0.75]) ctx.fillRect(x + lx * r - 1.5, y - 14, 3, 14);
      ctx.beginPath();
      ctx.ellipse(x, y - 14, r, r * 0.42, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#3d7fd6';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y - 14, r * 0.8, r * 0.33, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#222428';
      ctx.fill();
      // A single kitten paw print. Evidence of The Incident.
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(x + 6, y - 12, 2.4, 0, Math.PI * 2);
      ctx.arc(x + 3, y - 16, 1, 0, Math.PI * 2);
      ctx.arc(x + 6, y - 17, 1, 0, Math.PI * 2);
      ctx.arc(x + 9, y - 16, 1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'pickup':
      drawPickup(ctx, x, y, p.angle ?? 0, p.color === 'charcoal' ? 'charcoal' : 'white', p.w ?? 100);
      break;
    case 'cabinet': {
      // A stray antique cabinet outside the workshop, one side painted, one side still bare wood.
      ctx.beginPath();
      ctx.ellipse(x + 3, y + 1, 18, 4.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.shadow;
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.5;
      const L = x - 13;
      const T = y - 38;
      ctx.fillStyle = C.woodLight;
      ctx.fillRect(L, T, 26, 34);
      ctx.fillStyle = '#8fb1d6';
      ctx.fillRect(L, T, 14, 34);
      // A ragged wet edge where the paint stops.
      ctx.beginPath();
      ctx.moveTo(L + 14, T);
      for (let i = 1; i <= 6; i++) ctx.lineTo(L + 14 + (i % 2 ? 2 : -1), T + (i * 34) / 6);
      ctx.lineTo(L, T + 34);
      ctx.lineTo(L, T);
      ctx.closePath();
      ctx.fill();
      ctx.strokeRect(L, T, 26, 34);
      ctx.beginPath();
      ctx.moveTo(x, T + 3);
      ctx.lineTo(x, T + 31);
      ctx.stroke();
      ctx.fillStyle = '#c9a548';
      for (const kx of [x - 3, x + 3]) {
        ctx.beginPath();
        ctx.arc(kx, T + 17, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      // Little turned feet, and the top.
      ctx.fillStyle = C.woodDark;
      ctx.fillRect(L + 1, y - 4, 3, 4);
      ctx.fillRect(L + 22, y - 4, 3, 4);
      ctx.fillStyle = '#8fb1d6';
      ctx.fillRect(L - 2, T - 3, 30, 4);
      ctx.strokeRect(L - 2, T - 3, 30, 4);
      // Paint can and brush.
      ctx.fillStyle = '#c9ced4';
      ctx.fillRect(x + 17, y - 9, 9, 9);
      ctx.strokeRect(x + 17, y - 9, 9, 9);
      ctx.fillStyle = '#8fb1d6';
      ctx.fillRect(x + 17.5, y - 9, 8, 2.5);
      ctx.strokeStyle = C.woodDark;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x + 20, y - 8);
      ctx.lineTo(x + 25, y - 17);
      ctx.stroke();
      break;
    }
    case 'treehouse': {
      // The treehouse at the corner of the main house: an old oak, a platform, a little house, a ladder.
      ctx.beginPath();
      ctx.ellipse(x + 10, y + 2, 50, 13, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.shadow;
      ctx.fill();
      const leaves = (cx: number, cy: number, rr: number, col: string) => {
        ctx.beginPath();
        ctx.arc(x + cx, y + cy, rr, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.stroke();
      };
      // Canopy behind the house.
      leaves(-34, -118, 34, '#4f8f3a');
      leaves(32, -122, 34, '#4f8f3a');
      leaves(0, -150, 40, '#579a40');
      // Trunk, forking under the platform.
      ctx.fillStyle = C.woodDark;
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x - 7, y - 70);
      ctx.lineTo(x + 7, y - 70);
      ctx.lineTo(x + 10, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Platform and railing.
      ctx.fillStyle = C.woodLight;
      ctx.fillRect(x - 40, y - 76, 80, 7);
      ctx.strokeRect(x - 40, y - 76, 80, 7);
      ctx.fillStyle = C.wood;
      for (const px of [-38, -20, 20, 36]) {
        ctx.fillRect(x + px, y - 90, 3, 14);
        ctx.strokeRect(x + px, y - 90, 3, 14);
      }
      ctx.fillRect(x - 40, y - 92, 80, 3);
      ctx.strokeRect(x - 40, y - 92, 80, 3);
      // The house: plank walls, a window, a doorway, a red roof.
      ctx.fillStyle = C.wood;
      ctx.fillRect(x - 26, y - 112, 50, 36);
      ctx.strokeRect(x - 26, y - 112, 50, 36);
      ctx.strokeStyle = 'rgba(59,42,32,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let py = y - 103; py < y - 77; py += 8) {
        ctx.moveTo(x - 25, py);
        ctx.lineTo(x + 23, py);
      }
      ctx.stroke();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.5;
      ctx.fillStyle = '#2b1a12';
      ctx.fillRect(x - 18, y - 104, 12, 11);
      ctx.strokeRect(x - 18, y - 104, 12, 11);
      ctx.fillStyle = '#9cc7d9';
      ctx.fillRect(x - 16.5, y - 102.5, 9, 8);
      ctx.fillStyle = '#2b1a12';
      ctx.beginPath();
      ctx.roundRect(x + 4, y - 100, 13, 24, [6, 6, 0, 0]);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.roofRed;
      ctx.beginPath();
      ctx.moveTo(x - 33, y - 110);
      ctx.lineTo(x - 1, y - 132);
      ctx.lineTo(x + 31, y - 110);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Leaves in front, round the edges.
      leaves(-46, -96, 15, '#62a648');
      leaves(44, -102, 14, '#62a648');
      leaves(-20, -138, 14, '#62a648');
      // Ladder down the right side.
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(x + 26, y - 70);
      ctx.lineTo(x + 34, y);
      ctx.moveTo(x + 38, y - 70);
      ctx.lineTo(x + 46, y);
      ctx.stroke();
      ctx.strokeStyle = C.woodLight;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.strokeStyle = C.woodLight;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 1; i < 6; i++) {
        const ry = y - 70 + i * 11.5;
        const off = (i * 11.5 * 8) / 70;
        ctx.moveTo(x + 26 + off, ry);
        ctx.lineTo(x + 38 + off, ry);
      }
      ctx.stroke();
      break;
    }
    case 'puttingGreen': {
      // Grandpa's putting green: a patch of short grass, the cup, and a flag.
      const w = p.w ?? 60;
      ctx.beginPath();
      ctx.ellipse(x - 8, y, w / 2, w / 4, -0.08, 0, Math.PI * 2);
      ctx.fillStyle = '#a9da6e';
      ctx.fill();
      ctx.strokeStyle = '#7fb94c';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y, 3.4, 1.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1f2a14';
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 26);
      ctx.stroke();
      const flap = Math.sin(clock * 3) * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y - 26);
      ctx.lineTo(x + 11, y - 22 + flap);
      ctx.lineTo(x, y - 18);
      ctx.closePath();
      ctx.fillStyle = C.barnRed;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
    case 'doggieDoor': {
      // A flap in the bottom of Grandpa's back wall, just the right size for a chihuahua.
      ctx.fillStyle = '#3b3a3f';
      ctx.beginPath();
      ctx.roundRect(x - 7, y - 19, 14, 15, [4, 4, 1, 1]);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 5, y - 13);
      ctx.lineTo(x + 5, y - 13);
      ctx.stroke();
      break;
    }
    case 'doghouse': {
      ctx.beginPath();
      ctx.ellipse(x + 4, y + 2, 34, 9, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.shadow;
      ctx.fill();
      ctx.fillStyle = C.barnRed;
      ctx.fillRect(x - 26, y - 30, 52, 30);
      ctx.strokeRect(x - 26, y - 30, 52, 30);
      ctx.fillStyle = '#2b1a12';
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x - 10, y - 14);
      ctx.arc(x, y - 14, 10, Math.PI, 0);
      ctx.lineTo(x + 10, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#efe2c8';
      ctx.beginPath();
      ctx.moveTo(x - 32, y - 28);
      ctx.lineTo(x, y - 50);
      ctx.lineTo(x + 32, y - 28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Water bowl.
      ctx.beginPath();
      ctx.ellipse(x + 34, y - 2, 8, 3.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#3d7fd6';
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'woodpile': {
      const w = p.w ?? 120;
      ctx.beginPath();
      ctx.ellipse(x + 4, y + 3, w / 2 + 6, 9, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.shadow;
      ctx.fill();
      ctx.fillStyle = C.woodDark;
      ctx.fillRect(x - w / 2 - 4, y - 42, 5, 42);
      ctx.fillRect(x + w / 2 - 1, y - 42, 5, 42);
      // Split log ends, stacked in rows.
      const rows = 4;
      for (let r = 0; r < rows; r++) {
        const cy = y - 6 - r * 9.5;
        const off = r % 2 ? 5 : 0;
        for (let lx = x - w / 2 + 5 + off; lx < x + w / 2 - 3; lx += 10) {
          const h = hash2(Math.round(lx), r, 3);
          ctx.beginPath();
          ctx.moveTo(lx - 5, cy + 4);
          ctx.lineTo(lx - 4 + h * 2, cy - 5);
          ctx.lineTo(lx + 5, cy - 3 + h * 2);
          ctx.lineTo(lx + 4, cy + 4);
          ctx.closePath();
          ctx.fillStyle = h > 0.5 ? '#e2b77a' : '#d9a865';
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.strokeStyle = 'rgba(140,90,40,0.5)';
          ctx.beginPath();
          ctx.arc(lx, cy, 1.6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = C.ink;
        }
      }
      ctx.lineWidth = 1.6;
      ctx.fillStyle = '#8c9aa6';
      ctx.beginPath();
      ctx.moveTo(x - w / 2 - 10, y - 40);
      ctx.lineTo(x + w / 2 + 10, y - 40);
      ctx.lineTo(x + w / 2 + 6, y - 50);
      ctx.lineTo(x - w / 2 - 6, y - 50);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'chopBlock': {
      ctx.beginPath();
      ctx.ellipse(x + 3, y + 2, 20, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.shadow;
      ctx.fill();
      // Wood chips.
      ctx.fillStyle = '#e8c690';
      for (let i = 0; i < 7; i++) ctx.fillRect(x - 24 + hash2(i, 1, 9) * 48, y - 3 + hash2(i, 2, 9) * 8, 4, 2);
      ctx.fillStyle = C.wood;
      ctx.fillRect(x - 14, y - 18, 28, 18);
      ctx.strokeRect(x - 14, y - 18, 28, 18);
      ctx.beginPath();
      ctx.ellipse(x, y - 18, 14, 5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#e2b77a';
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(140,90,40,0.6)';
      ctx.beginPath();
      ctx.ellipse(x, y - 18, 7, 2.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Axe resting in the block.
      ctx.strokeStyle = C.ink;
      ctx.save();
      ctx.translate(x + 2, y - 20);
      ctx.rotate(0.5);
      ctx.fillStyle = '#b07a44';
      ctx.fillRect(-1.8, -30, 3.6, 30);
      ctx.strokeRect(-1.8, -30, 3.6, 30);
      ctx.fillStyle = '#9aa5ad';
      ctx.beginPath();
      ctx.moveTo(-2, -2);
      ctx.lineTo(-11, 2);
      ctx.lineTo(-11, -8);
      ctx.lineTo(-2, -7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'festoon': {
      const w = p.w ?? 200;
      for (const px of [x, x + w]) {
        ctx.beginPath();
        ctx.ellipse(px + 3, y + 2, 7, 3, 0, 0, Math.PI * 2);
        ctx.fillStyle = C.shadow;
        ctx.fill();
        ctx.fillStyle = C.woodGrey;
        ctx.fillRect(px - 3, y - 74, 6, 74);
        ctx.strokeRect(px - 3, y - 74, 6, 74);
      }
      ctx.strokeStyle = '#4a3b30';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y - 70);
      ctx.quadraticCurveTo(x + w / 2, y - 40, x + w, y - 70);
      ctx.stroke();
      for (const b of festoonBulbs(p)) {
        ctx.beginPath();
        ctx.arc(b.x, b.y + 2, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = b.out ? '#9a9488' : '#fff1b8';
        ctx.fill();
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = C.ink;
        ctx.stroke();
      }
      break;
    }
    case 'venueSign': {
      // The old venue sign out by the road, sun-faded, a couple of bulbs still in the arch.
      ctx.beginPath();
      ctx.ellipse(x + 3, y + 2, 48, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.shadow;
      ctx.fill();
      ctx.fillStyle = C.woodDark;
      ctx.fillRect(x - 46, y - 62, 7, 62);
      ctx.fillRect(x + 39, y - 62, 7, 62);
      ctx.strokeRect(x - 46, y - 62, 7, 62);
      ctx.strokeRect(x + 39, y - 62, 7, 62);
      ctx.beginPath();
      ctx.moveTo(x - 44, y - 30);
      ctx.lineTo(x - 44, y - 54);
      ctx.quadraticCurveTo(x, y - 78, x + 44, y - 54);
      ctx.lineTo(x + 44, y - 30);
      ctx.closePath();
      ctx.fillStyle = '#efe4cc';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#a8443a';
      ctx.font = '900 15px Rockwell, "Roboto Slab", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BARN 89', x, y - 47);
      ctx.fillStyle = 'rgba(59,42,32,0.7)';
      ctx.font = 'italic 700 7px Georgia, serif';
      ctx.fillText('celebrations', x, y - 36);
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        const bx = x - 40 + t * 80;
        const by = y - 56 - Math.sin(t * Math.PI) * 14;
        ctx.beginPath();
        ctx.arc(bx, by, 2, 0, Math.PI * 2);
        ctx.fillStyle = i === 2 || i === 5 ? '#9a9488' : '#fff1b8';
        ctx.fill();
      }
      break;
    }
    case 'longTable': {
      // A long farm table with benches, set for breakfast.
      const w = p.w ?? 150;
      const x0 = x - w / 2;
      ctx.beginPath();
      ctx.ellipse(x + 6, y + 8, w / 2 + 14, 16, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.shadow;
      ctx.fill();
      // Back bench.
      ctx.fillStyle = C.woodDark;
      ctx.fillRect(x0 + 6, y - 40, w - 12, 7);
      ctx.strokeRect(x0 + 6, y - 40, w - 12, 7);
      // Legs.
      ctx.fillStyle = C.woodDark;
      for (const lx of [x0 + 8, x0 + w - 14]) {
        ctx.fillRect(lx, y - 12, 6, 14);
        ctx.strokeRect(lx, y - 12, 6, 14);
      }
      // Top.
      ctx.beginPath();
      ctx.roundRect(x0, y - 34, w, 26, 3);
      ctx.fillStyle = '#b98a58';
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(90,55,25,0.35)';
      ctx.lineWidth = 1;
      for (const py of [y - 25, y - 17]) {
        ctx.beginPath();
        ctx.moveTo(x0 + 2, py);
        ctx.lineTo(x0 + w - 2, py);
        ctx.stroke();
      }
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.6;
      ctx.fillStyle = C.wood;
      ctx.fillRect(x0, y - 8, w, 5);
      ctx.strokeRect(x0, y - 8, w, 5);
      // Checked runner down the middle.
      ctx.fillStyle = '#fffaf0';
      ctx.fillRect(x0 + 8, y - 25, w - 16, 9);
      ctx.fillStyle = 'rgba(200,68,58,0.75)';
      for (let i = 0; x0 + 8 + i * 6 < x0 + w - 8; i++) {
        ctx.fillRect(x0 + 8 + i * 6, i % 2 ? y - 25 : y - 20.5, 3, 4.5);
      }
      // Plates, mugs, and the empty cinnamon roll plate.
      for (let i = 0; i < 5; i++) {
        const px = x0 + 18 + i * ((w - 36) / 4);
        for (const py of [y - 29, y - 12]) {
          ctx.beginPath();
          ctx.ellipse(px, py, 6, 2.6, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.lineWidth = 0.9;
          ctx.stroke();
        }
        ctx.fillStyle = i % 2 ? '#3d7fd6' : '#d9434f';
        ctx.fillRect(px + 7, y - 33, 3.4, 4);
      }
      ctx.lineWidth = 1.6;
      ctx.fillStyle = '#e8c690';
      for (let i = 0; i < 4; i++) ctx.fillRect(x0 + w - 22 + i * 2, y - 22 + (i % 2), 1.2, 1.2);
      // Jar of wildflowers.
      ctx.fillStyle = 'rgba(190,225,240,0.9)';
      ctx.fillRect(x - 3, y - 30, 6, 8);
      ctx.strokeRect(x - 3, y - 30, 6, 8);
      for (const [fx, fy, fc] of [[-3, -34, '#f2c53d'], [1, -36, '#f26b8a'], [4, -33, '#ffffff']] as [number, number, string][]) {
        ctx.beginPath();
        ctx.arc(x + fx, y + fy, 2, 0, Math.PI * 2);
        ctx.fillStyle = fc;
        ctx.fill();
      }
      // Front bench.
      ctx.fillStyle = C.woodLight;
      ctx.fillRect(x0 + 6, y + 6, w - 12, 7);
      ctx.strokeRect(x0 + 6, y + 6, w - 12, 7);
      ctx.fillStyle = C.woodDark;
      ctx.fillRect(x0 + 12, y + 13, 4, 6);
      ctx.fillRect(x0 + w - 16, y + 13, 4, 6);
      break;
    }
    case 'nameSign': {
      // A weathered plank with hand-painted letters, wired to the fence.
      const w = p.w ?? 80;
      const top = y - 34;
      ctx.strokeStyle = '#7a7f86';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + 6, top - 3);
      ctx.lineTo(x - w / 2 + 6, top + 2);
      ctx.moveTo(x + w / 2 - 6, top - 3);
      ctx.lineTo(x + w / 2 - 6, top + 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - w / 2, top);
      ctx.lineTo(x + w / 2, top - 2);
      ctx.lineTo(x + w / 2 + 1, top + 13);
      ctx.lineTo(x - w / 2 + 1, top + 15);
      ctx.closePath();
      ctx.fillStyle = '#c99a55';
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(110,70,30,0.35)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + 3, top + 4);
      ctx.lineTo(x + w / 2 - 4, top + 2.5);
      ctx.moveTo(x - w / 2 + 6, top + 11);
      ctx.lineTo(x + w / 2 - 8, top + 10);
      ctx.stroke();
      ctx.save();
      ctx.translate(x, top + 7);
      ctx.rotate(-0.02);
      ctx.font = '900 8px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff6e2';
      ctx.fillText(p.text ?? '', 0, 0.5);
      ctx.restore();
      break;
    }
    case 'wallCross': {
      // Small, plain, hung by the door.
      ctx.fillStyle = C.wood;
      ctx.fillRect(x - 1.8, y - 50, 3.6, 18);
      ctx.strokeRect(x - 1.8, y - 50, 3.6, 18);
      ctx.fillRect(x - 6, y - 45, 12, 3.4);
      ctx.strokeRect(x - 6, y - 45, 12, 3.4);
      break;
    }
    case 'bench': {
      const w = p.w ?? 40;
      ctx.fillStyle = C.woodDark;
      ctx.fillRect(x - w / 2 + 3, y - 8, 3, 8);
      ctx.fillRect(x + w / 2 - 6, y - 8, 3, 8);
      ctx.fillStyle = C.woodLight;
      ctx.fillRect(x - w / 2, y - 12, w, 5);
      ctx.strokeRect(x - w / 2, y - 12, w, 5);
      ctx.fillRect(x - w / 2, y - 22, w, 4);
      ctx.strokeRect(x - w / 2, y - 22, w, 4);
      break;
    }
  }
  ctx.restore();
}

/** Bulb positions along a festoon string (some long since burned out). */
export function festoonBulbs(p: PropDef): { x: number; y: number; out: boolean }[] {
  const w = p.w ?? 200;
  const n = Math.max(4, Math.round(w / 22));
  const out: { x: number; y: number; out: boolean }[] = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = p.x + t * w;
    // Quadratic sag matching the drawn wire.
    const y = p.y - 70 + 2 * t * (1 - t) * 30;
    out.push({ x, y, out: hash2(i, Math.round(p.y), 89) < 0.22 });
  }
  return out;
}

/** Things drawn flat on the ground in the dynamic layer (no height). */
export function propIsFlat(p: PropDef): boolean {
  return p.kind === 'flowers' || p.kind === 'napHay' || p.kind === 'puttingGreen';
}

/* ------------------------------------------------------------------------------------------ */
/* Collectibles                                                                                 */
/* ------------------------------------------------------------------------------------------ */

export function drawHorseshoe(ctx: Ctx, x: number, y: number, clock: number): void {
  const bob = Math.sin(clock * 3) * 3;
  const spin = Math.cos(clock * 2.2);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, 9, 3.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.shadow;
  ctx.fill();
  ctx.translate(x, y - 18 + bob);
  // Glow.
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
  g.addColorStop(0, 'rgba(255,230,120,0.65)');
  g.addColorStop(1, 'rgba(255,230,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-22, -22, 44, 44);
  ctx.scale(Math.max(0.25, Math.abs(spin)), 1);
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 7.5;
  ctx.beginPath();
  ctx.arc(0, 0, 8, Math.PI * 0.8, Math.PI * 2.2);
  ctx.stroke();
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 4.8;
  ctx.stroke();
  ctx.strokeStyle = '#fff3b0';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, 8, Math.PI * 1.1, Math.PI * 1.6);
  ctx.stroke();
  ctx.restore();
  if (Math.sin(clock * 5) > 0.8) star(ctx, x + 7, y - 26 + bob, 3, '#fffbe0');
}

export function drawTreatBag(ctx: Ctx, x: number, y: number, clock: number): void {
  const bob = Math.sin(clock * 2.5) * 1.5;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, 11, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.shadow;
  ctx.fill();
  ctx.translate(x, y + bob * 0.3);
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.quadraticCurveTo(-13, -14, -6, -20);
  ctx.lineTo(6, -20);
  ctx.quadraticCurveTo(13, -14, 10, 0);
  ctx.closePath();
  ctx.fillStyle = '#d8b47a';
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-7, -20);
  ctx.lineTo(-9, -25);
  ctx.lineTo(9, -25);
  ctx.lineTo(7, -20);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#e04646';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-7, -20);
  ctx.lineTo(7, -20);
  ctx.stroke();
  drawFishTreat(ctx, 0, -9, 1);
  ctx.restore();
  heartPath(ctx, x + 12, y - 28 + bob, 3.2);
  ctx.fillStyle = `rgba(239,93,132,${0.5 + 0.5 * Math.sin(clock * 4)})`;
  ctx.fill();
}

/** A little fish-shaped cookie: the treat. */
export function drawFishTreat(ctx: Ctx, x: number, y: number, s: number, rot = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.quadraticCurveTo(0, -5.5, 5.5, 0);
  ctx.quadraticCurveTo(0, 5.5, -6, 0);
  ctx.moveTo(-5, 0);
  ctx.lineTo(-9.5, -4);
  ctx.lineTo(-9.5, 4);
  ctx.closePath();
  ctx.fillStyle = '#e8963f';
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  blob(ctx, 2.5, -1, 0.9);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.restore();
}
