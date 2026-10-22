import { hash2 } from '../core/math';
import type { AreaDef, Pt, RanchMap, RoadDef } from '../world/mapTypes';
import { treeSolidRadius } from '../world/solids';
import { C } from './palette';

type Ctx = CanvasRenderingContext2D;

export const TILE = 256;

/** Smooth Catmull-Rom curve through the points, emitted as bezier segments. */
export function tracePath(ctx: Ctx | Path2D, pts: readonly Pt[], loop = false): void {
  const n = pts.length;
  const get = (i: number): Pt => (loop ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  ctx.moveTo(pts[0][0], pts[0][1]);
  const segs = loop ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
      p2[0],
      p2[1],
    );
  }
  if (loop) ctx.closePath();
}

function roadBounds(r: RoadDef) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of r.points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const pad = r.width + 40;
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

function areaBounds(a: AreaDef) {
  const s = a.shape;
  if (s.type === 'poly') {
    const xs = s.points.map((p) => p[0]);
    const ys = s.points.map((p) => p[1]);
    return { minX: Math.min(...xs) - 20, minY: Math.min(...ys) - 20, maxX: Math.max(...xs) + 20, maxY: Math.max(...ys) + 20 };
  }
  if (s.type === 'rect') return { minX: s.x - 20, minY: s.y - 20, maxX: s.x + s.w + 20, maxY: s.y + s.h + 20 };
  return { minX: s.x - s.rx - 20, minY: s.y - s.ry - 20, maxX: s.x + s.rx + 20, maxY: s.y + s.ry + 20 };
}

function areaPath(ctx: Ctx, a: AreaDef, inset = 0): void {
  const s = a.shape;
  ctx.beginPath();
  if (s.type === 'poly') {
    s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  } else if (s.type === 'rect') ctx.roundRect(s.x + inset, s.y + inset, s.w - inset * 2, s.h - inset * 2, Math.max(0, (s.r ?? 0) - inset));
  else ctx.ellipse(s.x, s.y, Math.max(1, s.rx - inset), Math.max(1, s.ry - inset), 0, 0, Math.PI * 2);
}

const AREA_FILL: Record<AreaDef['kind'], string> = {
  sand: C.sand,
  dirt: C.dirt,
  garden: '#8a5f3a',
  lawn: C.lawn,
  meadow: C.meadow,
  water: C.water,
  woods: C.woods,
  clay: '#c8703f',
  asphalt: '#66666b',
};

/**
 * Bakes the static ground layer (grass, paths, arena sand, pond, shadows) into cached tiles.
 * Each tile only draws features that overlap it, and procedural detail is hashed on world
 * coordinates so tiles join seamlessly.
 */
export class TerrainTiles {
  private cache = new Map<string, HTMLCanvasElement>();
  private order: string[] = [];
  private scale = 1;
  private readonly roadBox: ReturnType<typeof roadBounds>[];
  private readonly areaBox: ReturnType<typeof areaBounds>[];

  constructor(
    private readonly map: RanchMap,
    public maxTiles = 48,
  ) {
    this.roadBox = map.roads.map(roadBounds);
    this.areaBox = map.areas.map(areaBounds);
  }

  setScale(s: number): void {
    const q = Math.round(s * 4) / 4;
    if (q !== this.scale) {
      this.scale = q;
      this.cache.clear();
      this.order = [];
    }
  }

  get tileScale(): number {
    return this.scale;
  }

  has(tx: number, ty: number): boolean {
    return this.cache.has(`${tx},${ty}`);
  }

  get(tx: number, ty: number): HTMLCanvasElement {
    const key = `${tx},${ty}`;
    let c = this.cache.get(key);
    if (c) return c;
    c = this.render(tx, ty);
    this.cache.set(key, c);
    this.order.push(key);
    while (this.order.length > this.maxTiles) {
      const old = this.order.shift()!;
      const canvas = this.cache.get(old);
      if (canvas) {
        // Release backing store promptly on iOS.
        canvas.width = 1;
        canvas.height = 1;
      }
      this.cache.delete(old);
    }
    return c;
  }

  private render(tx: number, ty: number): HTMLCanvasElement {
    const px = Math.ceil(TILE * this.scale);
    const c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(this.scale, 0, 0, this.scale, -tx * TILE * this.scale, -ty * TILE * this.scale);
    drawGround(ctx, this.map, tx * TILE, ty * TILE, TILE, this.roadBox, this.areaBox);
    return c;
  }
}

const hit = (b: { minX: number; minY: number; maxX: number; maxY: number }, x: number, y: number, s: number) =>
  b.maxX >= x && b.minX <= x + s && b.maxY >= y && b.minY <= y + s;

export function drawGround(
  ctx: Ctx,
  map: RanchMap,
  x0: number,
  y0: number,
  size: number,
  roadBox = map.roads.map(roadBounds),
  areaBox = map.areas.map(areaBounds),
): void {
  ctx.fillStyle = C.grass;
  ctx.fillRect(x0, y0, size, size);

  // Low-frequency colour blotches give the grass some life.
  const B = 160;
  for (let gy = Math.floor((y0 - B) / B); gy <= Math.floor((y0 + size + B) / B); gy++) {
    for (let gx = Math.floor((x0 - B) / B); gx <= Math.floor((x0 + size + B) / B); gx++) {
      const h = hash2(gx, gy, 1);
      const cx = gx * B + hash2(gx, gy, 2) * B;
      const cy = gy * B + hash2(gx, gy, 3) * B;
      const r = 90 + h * 110;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      const col = h > 0.5 ? 'rgba(170,214,104,0.35)' : 'rgba(80,140,50,0.25)';
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  }

  // Areas (woods floor, lawns, meadow, sand, dirt, garden, water).
  map.areas.forEach((a, i) => {
    if (!hit(areaBox[i], x0, y0, size)) return;
    drawArea(ctx, a, x0, y0, size);
  });

  // Roads and paths.
  map.roads.forEach((r, i) => {
    if (!hit(roadBox[i], x0, y0, size)) return;
    drawRoad(ctx, r);
  });

  // Grass tufts and wildflowers, skipping anything that lands on a path or sand.
  const G = 26;
  for (let gy = Math.floor(y0 / G) - 1; gy <= Math.floor((y0 + size) / G) + 1; gy++) {
    for (let gx = Math.floor(x0 / G) - 1; gx <= Math.floor((x0 + size) / G) + 1; gx++) {
      const h = hash2(gx, gy, 9);
      if (h < 0.45) continue;
      const x = gx * G + hash2(gx, gy, 10) * G;
      const y = gy * G + hash2(gx, gy, 11) * G;
      if (!isGrassy(map, x, y)) continue;
      if (h > 0.965) {
        const colors = ['#fff6e0', '#ffd34d', '#f59ab5', '#b9a0f0', '#ffffff'];
        const col = colors[Math.floor(hash2(gx, gy, 12) * colors.length)];
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * 2.2, y + Math.sin(a) * 2.2, 1.7, 0, Math.PI * 2);
          ctx.fillStyle = col;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(x, y, 1.3, 0, Math.PI * 2);
        ctx.fillStyle = '#e8a23a';
        ctx.fill();
      } else {
        ctx.strokeStyle = h > 0.75 ? C.grassDark : C.grassLight;
        ctx.lineWidth = 1.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 3, y);
        ctx.lineTo(x - 4, y - 5);
        ctx.moveTo(x, y);
        ctx.lineTo(x + 0.5, y - 7);
        ctx.moveTo(x + 3, y);
        ctx.lineTo(x + 5, y - 5);
        ctx.stroke();
      }
    }
  }

  // Static shadows for trees and buildings (light from the upper left).
  for (const t of map.trees) {
    if (t.x + t.r * 2 < x0 || t.x - t.r * 2 > x0 + size || t.y + t.r < y0 || t.y - t.r * 2 > y0 + size) continue;
    ctx.beginPath();
    ctx.ellipse(t.x + t.r * 0.35, t.y + 2, t.r * 0.95, t.r * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.shadow;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(t.x, t.y, treeSolidRadius(t) * 0.9, treeSolidRadius(t) * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(40,30,15,0.18)';
    ctx.fill();
  }
  for (const b of map.buildings) {
    if (b.x + b.w + 60 < x0 || b.x > x0 + size || b.y + b.h + 30 < y0 || b.y - b.wall > y0 + size) continue;
    ctx.fillStyle = C.shadow;
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, b.y - b.wall * 0.5);
    ctx.lineTo(b.x + b.w + 34, b.y - b.wall * 0.2);
    ctx.lineTo(b.x + b.w + 34, b.y + b.h + 12);
    ctx.lineTo(b.x + 10, b.y + b.h + 12);
    ctx.lineTo(b.x, b.y + b.h);
    ctx.closePath();
    ctx.fill();
  }
}

function isGrassy(map: RanchMap, x: number, y: number): boolean {
  for (const a of map.areas) {
    if (a.kind === 'lawn' || a.kind === 'meadow' || a.kind === 'woods') continue;
    const s = a.shape;
    if (s.type === 'poly') {
      if (pointInPoly(x, y, s.points)) return false;
    } else if (s.type === 'rect') {
      if (x > s.x - 4 && x < s.x + s.w + 4 && y > s.y - 4 && y < s.y + s.h + 4) return false;
    } else {
      const dx = (x - s.x) / (s.rx + 6);
      const dy = (y - s.y) / (s.ry + 6);
      if (dx * dx + dy * dy < 1) return false;
    }
  }
  for (const r of map.roads) {
    const half = r.width / 2 + 6;
    const pts = r.loop ? [...r.points, r.points[0]] : r.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const l2 = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
      // Generous: curves bulge beyond the polyline.
      if (Math.hypot(x - (ax + dx * t), y - (ay + dy * t)) < half + 14) return false;
    }
  }
  for (const b of map.buildings) {
    if (x > b.x - 6 && x < b.x + b.w + 6 && y > b.y - b.wall && y < b.y + b.h + 6) return false;
  }
  return true;
}

function pointInPoly(x: number, y: number, pts: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function drawRoad(ctx: Ctx, r: RoadDef): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = new Path2D();
  tracePath(path, r.points, r.loop);
  if (r.kind === 'footpath') {
    ctx.strokeStyle = 'rgba(150,110,60,0.35)';
    ctx.lineWidth = r.width + 4;
    ctx.stroke(path);
    ctx.strokeStyle = C.footpath;
    ctx.lineWidth = r.width;
    ctx.stroke(path);
    ctx.setLineDash([2, 14]);
    ctx.strokeStyle = 'rgba(255,240,200,0.7)';
    ctx.lineWidth = 3;
    ctx.stroke(path);
    ctx.setLineDash([]);
    return;
  }
  const base = r.kind === 'gravel' ? C.gravel : C.dirt;
  ctx.strokeStyle = r.kind === 'gravel' ? C.gravelEdge : C.dirtDark;
  ctx.lineWidth = r.width + 8;
  ctx.stroke(path);
  ctx.strokeStyle = base;
  ctx.lineWidth = r.width;
  ctx.stroke(path);
  // Two tyre tracks: a darker band with the middle painted back over.
  ctx.strokeStyle = r.kind === 'gravel' ? C.gravelTrack : C.dirtDark;
  ctx.lineWidth = r.width * 0.62;
  ctx.stroke(path);
  ctx.strokeStyle = base;
  ctx.lineWidth = r.width * 0.42;
  ctx.stroke(path);
  // Pebbles.
  ctx.setLineDash([1.5, 11, 2.5, 17]);
  ctx.strokeStyle = 'rgba(255,248,225,0.8)';
  ctx.lineWidth = 2.4;
  ctx.stroke(path);
  ctx.setLineDash([2, 23]);
  ctx.strokeStyle = 'rgba(140,105,60,0.55)';
  ctx.lineWidth = r.width * 0.8;
  ctx.stroke(path);
  ctx.setLineDash([]);
}

function drawArea(ctx: Ctx, a: AreaDef, x0: number, y0: number, size: number): void {
  const s = a.shape;
  ctx.save();
  if (a.kind === 'water') {
    // Muddy bank, reeds, water, highlights, lily pads.
    if (s.type !== 'ellipse') return;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 4, s.rx + 12, s.ry + 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#9b8a55';
    ctx.fill();
    areaPath(ctx, a);
    const g = ctx.createRadialGradient(s.x - s.rx * 0.2, s.y - s.ry * 0.3, 10, s.x, s.y, s.rx);
    g.addColorStop(0, C.waterLight);
    g.addColorStop(0.45, C.water);
    g.addColorStop(1, C.waterDeep);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const wx = s.x - s.rx * 0.5 + hash2(i, 1, 77) * s.rx;
      const wy = s.y - s.ry * 0.5 + hash2(i, 2, 77) * s.ry;
      ctx.moveTo(wx - 10, wy);
      ctx.quadraticCurveTo(wx, wy - 4, wx + 10, wy);
      ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const a2 = hash2(i, 5, 31) * Math.PI * 2;
      const lx = s.x + Math.cos(a2) * s.rx * 0.65;
      const ly = s.y + Math.sin(a2) * s.ry * 0.6;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.arc(lx, ly, 7, a2, a2 + Math.PI * 1.75);
      ctx.closePath();
      ctx.fillStyle = '#5f9e3f';
      ctx.fill();
      if (i % 2 === 0) {
        ctx.beginPath();
        ctx.arc(lx + 2, ly - 1, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffb7d0';
        ctx.fill();
      }
    }
    // Reeds round the edge.
    ctx.strokeStyle = '#4f7d32';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 28; i++) {
      const a2 = hash2(i, 9, 33) * Math.PI * 2;
      const rx = s.x + Math.cos(a2) * (s.rx + 8);
      const ry = s.y + Math.sin(a2) * (s.ry + 6);
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 2, ry - 12);
      ctx.moveTo(rx + 3, ry);
      ctx.lineTo(rx + 4, ry - 9);
      ctx.stroke();
      if (i % 3 === 0) {
        ctx.fillStyle = '#7a4e2c';
        ctx.fillRect(rx - 3.5, ry - 16, 3, 6);
      }
    }
    ctx.restore();
    return;
  }

  areaPath(ctx, a);
  ctx.fillStyle = AREA_FILL[a.kind];
  ctx.fill();
  ctx.clip();

  if (a.kind === 'sand' && s.type === 'rect') {
    // Raked arena: soft border, rake arcs, hoof... well, paw prints.
    ctx.strokeStyle = C.sandDark;
    ctx.lineWidth = 10;
    ctx.strokeRect(s.x, s.y, s.w, s.h);
    ctx.strokeStyle = 'rgba(255,248,225,0.6)';
    ctx.lineWidth = 1.6;
    for (let y = s.y + 40; y < s.y + s.h; y += 34) {
      if (y < y0 - 40 || y > y0 + size + 40) continue;
      ctx.beginPath();
      for (let x = s.x; x <= s.x + s.w; x += 20) {
        const yy = y + Math.sin(x * 0.02 + y * 0.1) * 6;
        if (x === s.x) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    // A meandering line of tiger paw prints.
    ctx.fillStyle = 'rgba(176,140,80,0.5)';
    for (let i = 0; i < 26; i++) {
      const t = i / 26;
      const px = s.x + 80 + t * (s.w - 160) + Math.sin(t * 9) * 60;
      const py = s.y + s.h - 60 - t * (s.h - 120);
      const side = i % 2 ? 7 : -7;
      paw(ctx, px + side, py);
    }
    // Sand texture speckles.
    for (let gy = Math.floor(y0 / 14); gy < Math.ceil((y0 + size) / 14); gy++) {
      for (let gx = Math.floor(x0 / 14); gx < Math.ceil((x0 + size) / 14); gx++) {
        const h = hash2(gx, gy, 21);
        if (h < 0.6) continue;
        ctx.fillStyle = h > 0.85 ? 'rgba(160,120,60,0.35)' : 'rgba(255,250,230,0.6)';
        ctx.fillRect(gx * 14 + hash2(gx, gy, 22) * 14, gy * 14 + hash2(gx, gy, 23) * 14, 1.6, 1.6);
      }
    }
  } else if (a.kind === 'asphalt' && s.type === 'rect') {
    // Buffalo Gap Rd: shoulders, white edge lines, dashed yellow centre line.
    ctx.fillStyle = '#d8cfae';
    ctx.fillRect(s.x, s.y, 10, s.h);
    ctx.fillRect(s.x + s.w - 10, s.y, 10, s.h);
    ctx.fillStyle = '#f4f1e8';
    ctx.fillRect(s.x + 14, s.y, 3, s.h);
    ctx.fillRect(s.x + s.w - 17, s.y, 3, s.h);
    ctx.fillStyle = '#f2c53d';
    const cx = s.x + s.w / 2;
    for (let y = Math.floor(y0 / 60) * 60; y < y0 + size; y += 60) ctx.fillRect(cx - 2, y, 4, 32);
    for (let gy = Math.floor(y0 / 12); gy < Math.ceil((y0 + size) / 12); gy++) {
      for (let gx = Math.floor(s.x / 12); gx < Math.ceil((s.x + s.w) / 12); gx++) {
        const h = hash2(gx, gy, 71);
        if (h < 0.75) continue;
        ctx.fillStyle = h > 0.9 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
        ctx.fillRect(gx * 12 + hash2(gx, gy, 72) * 12, gy * 12 + hash2(gx, gy, 73) * 12, 2, 2);
      }
    }
  } else if (a.kind === 'clay') {
    // West Texas red dirt: speckles and a few pale cracks.
    for (let gy = Math.floor(y0 / 15); gy < Math.ceil((y0 + size) / 15); gy++) {
      for (let gx = Math.floor(x0 / 15); gx < Math.ceil((x0 + size) / 15); gx++) {
        const h = hash2(gx, gy, 81);
        if (h < 0.5) continue;
        ctx.fillStyle = h > 0.8 ? 'rgba(120,50,20,0.35)' : 'rgba(255,190,140,0.35)';
        ctx.beginPath();
        ctx.arc(gx * 15 + hash2(gx, gy, 82) * 15, gy * 15 + hash2(gx, gy, 83) * 15, 1.2 + h, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (a.kind === 'dirt') {
    for (let gy = Math.floor(y0 / 16); gy < Math.ceil((y0 + size) / 16); gy++) {
      for (let gx = Math.floor(x0 / 16); gx < Math.ceil((x0 + size) / 16); gx++) {
        const h = hash2(gx, gy, 41);
        if (h < 0.55) continue;
        ctx.fillStyle = h > 0.8 ? 'rgba(120,85,45,0.35)' : 'rgba(255,240,205,0.45)';
        ctx.beginPath();
        ctx.arc(gx * 16 + hash2(gx, gy, 42) * 16, gy * 16 + hash2(gx, gy, 43) * 16, 1.4 + h, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Scattered straw near barns.
    ctx.strokeStyle = 'rgba(240,210,120,0.8)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 40; i++) {
      const hx = hash2(i, 3, 51);
      const hy = hash2(i, 4, 51);
      if (s.type !== 'ellipse') break;
      const sx = s.x + (hx - 0.5) * s.rx * 1.6;
      const sy = s.y + (hy - 0.5) * s.ry * 1.6;
      const ang = hash2(i, 5, 51) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(ang) * 7, sy + Math.sin(ang) * 7);
      ctx.stroke();
    }
  } else if (a.kind === 'garden' && s.type === 'rect') {
    // Vegetable rows.
    for (let y = s.y + 14; y < s.y + s.h - 6; y += 22) {
      ctx.fillStyle = '#6f4a2b';
      ctx.fillRect(s.x + 6, y - 4, s.w - 12, 8);
      for (let x = s.x + 16; x < s.x + s.w - 10; x += 18) {
        const pumpkin = (x + y) % 5 === 0;
        ctx.beginPath();
        ctx.arc(x, y - 2, pumpkin ? 5 : 5.5, 0, Math.PI * 2);
        ctx.fillStyle = pumpkin ? '#ef8a2c' : (x + y) % 3 ? '#6fbf4a' : '#8fd062';
        ctx.fill();
        ctx.strokeStyle = 'rgba(40,60,20,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  } else if (a.kind === 'lawn') {
    // Mown stripes.
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    const bb = areaBounds(a);
    for (let x = Math.floor(bb.minX / 36) * 36; x < bb.maxX; x += 72) ctx.fillRect(x, bb.minY, 36, bb.maxY - bb.minY);
  } else if (a.kind === 'woods') {
    // Leaf litter.
    for (let gy = Math.floor(y0 / 18); gy < Math.ceil((y0 + size) / 18); gy++) {
      for (let gx = Math.floor(x0 / 18); gx < Math.ceil((x0 + size) / 18); gx++) {
        const h = hash2(gx, gy, 61);
        if (h < 0.7) continue;
        ctx.fillStyle = h > 0.9 ? 'rgba(200,140,60,0.5)' : 'rgba(40,80,30,0.45)';
        ctx.beginPath();
        ctx.ellipse(gx * 18 + hash2(gx, gy, 62) * 18, gy * 18 + hash2(gx, gy, 63) * 18, 3, 1.6, h * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (a.kind === 'meadow' && s.type !== 'poly') {
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 500);
    g.addColorStop(0, 'rgba(190,225,110,0.35)');
    g.addColorStop(1, 'rgba(190,225,110,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, size, size);
  }
  ctx.restore();
  if (a.kind !== 'meadow' && a.kind !== 'woods' && a.kind !== 'lawn') {
    areaPath(ctx, a);
    ctx.strokeStyle = 'rgba(90,70,40,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function paw(ctx: Ctx, x: number, y: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, 3.6, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(x - 4.5 + i * 3, y - 4.5 - (i === 1 || i === 2 ? 1.2 : 0), 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
}
