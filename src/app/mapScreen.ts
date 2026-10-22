import { ACTIVITIES, type GameId } from '../content/activities';
import { FAMILY, type FamilyId } from '../content/cast';
import { C } from '../render/palette';
import { drawPerson } from '../render/people';
import type { RanchMap } from '../world/mapTypes';


const LABELS: { text: string; x: number; y: number }[] = [
  { text: 'Main House', x: 760, y: 640 },
  { text: "Grandpa's", x: 1760, y: 380 },
  { text: 'Front Lawn', x: 1180, y: 300 },
  { text: 'Barn 89', x: 1670, y: 2560 },
  { text: 'Stable', x: 1680, y: 2050 },
  { text: 'Arena', x: 1720, y: 1740 },
  { text: 'Donkeys', x: 1180, y: 1790 },
  { text: 'Corral', x: 1300, y: 2700 },
  { text: 'Chickens', x: 400, y: 190 },
  { text: 'Woodshed', x: 505, y: 1120 },
  { text: 'Creek', x: 420, y: 2500 },
];

export interface MapHit {
  id: GameId;
  x: number;
  y: number;
  r: number;
}

/** Paints the storybook map of the homestead; returns tap targets in CSS px. */
export function paintMap(
  canvas: HTMLCanvasElement,
  map: RanchMap,
  me: { x: number; y: number; who: FamilyId },
  maxW: number,
  maxH: number,
  /** Where each activity's person is right now (defaults to their usual spot). */
  where: (id: GameId) => { x: number; y: number } = (id) => ACTIVITIES.find((a) => a.id === id)!.station,
  /** Activities to leave off the map (still locked). */
  hide: (id: GameId) => boolean = () => false,
): MapHit[] {
  const aspect = map.width / map.height;
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  w = Math.floor(w);
  h = Math.floor(h);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d')!;
  const s = w / map.width;
  ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.fillStyle = '#93c75e';
  ctx.fillRect(0, 0, map.width, map.height);
  const areaColor: Record<string, string> = {
    woods: '#6a9e45',
    lawn: '#a6d66d',
    meadow: '#9fd068',
    sand: '#ecd69f',
    dirt: '#d2ac74',
    clay: '#cf7f52',
    asphalt: '#6f7378',
    water: '#5fb6d6',
    garden: '#c9a46a',
  };
  for (const a of map.areas) {
    ctx.fillStyle = areaColor[a.kind] ?? '#93c75e';
    ctx.beginPath();
    const sh = a.shape;
    if (sh.type === 'rect') ctx.roundRect(sh.x, sh.y, sh.w, sh.h, sh.r ?? 0);
    else if (sh.type === 'ellipse') ctx.ellipse(sh.x, sh.y, sh.rx, sh.ry, 0, 0, Math.PI * 2);
    else {
      sh.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
    }
    ctx.fill();
  }
  for (const r of map.roads) {
    ctx.strokeStyle = r.kind === 'footpath' ? '#dcc492' : '#e2c995';
    ctx.lineWidth = r.width * 1.1;
    ctx.beginPath();
    r.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(47,90,38,0.75)';
  for (const t of map.trees) {
    ctx.beginPath();
    ctx.arc(t.x, t.y - t.r * 0.5, t.r * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(110,74,45,0.7)';
  ctx.lineWidth = 6;
  for (const f of map.fences) {
    ctx.beginPath();
    f.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  for (const p of map.pens) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const b of map.buildings) {
    ctx.fillStyle = b.style === 'barn' || b.id === 'stable' ? C.barnRed : b.roof;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y - b.wall * 0.3, b.w, b.h + b.wall * 0.3, 10);
    ctx.fill();
    ctx.stroke();
  }
  // Labels.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(12 / s)}px ui-rounded, system-ui, sans-serif`;
  for (const l of LABELS) {
    ctx.lineWidth = 5 / s;
    ctx.strokeStyle = 'rgba(255,248,233,0.95)';
    ctx.strokeText(l.text, l.x, l.y);
    ctx.fillStyle = C.ink;
    ctx.fillText(l.text, l.x, l.y);
  }

  // Activity markers with portraits.
  const hits: MapHit[] = [];
  const r = 19 / s;
  for (const a of ACTIVITIES) {
    if (hide(a.id)) continue;
    const { x, y } = where(a.id);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff8e9';
    ctx.fill();
    ctx.lineWidth = 3 / s;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r - 1.5 / s, 0, Math.PI * 2);
    ctx.clip();
    const L = FAMILY[a.who].look;
    const k = (r * 2.1) / 46 / L.scale;
    ctx.translate(x - 2 * k, y + r * 0.9 + 40 * k * L.scale);
    ctx.scale(k, k);
    drawPerson(ctx, L, { x: 0, y: 0, faceX: 1, speed01: 0, walkPhase: 0, clock: 0.4, ghost: true });
    ctx.restore();
    hits.push({ id: a.id, x: x * s, y: y * s, r: 30 });
  }
  // You are here.
  ctx.beginPath();
  ctx.arc(me.x, me.y, 14 / s, 0, Math.PI * 2);
  ctx.fillStyle = FAMILY[me.who].look.shirt;
  ctx.fill();
  ctx.lineWidth = 4 / s;
  ctx.strokeStyle = '#fff8e9';
  ctx.stroke();
  ctx.font = `900 ${Math.round(13 / s)}px ui-rounded, system-ui, sans-serif`;
  ctx.lineWidth = 5 / s;
  ctx.strokeStyle = C.ink;
  ctx.strokeText('You', me.x, me.y - 26 / s);
  ctx.fillStyle = '#fff8e9';
  ctx.fillText('You', me.x, me.y - 26 / s);
  // Frame.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  return hits;
}
