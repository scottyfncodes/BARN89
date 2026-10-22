import type { DogDef, DonkeyDef } from '../content/cast';
import { C } from './palette';

type Ctx = CanvasRenderingContext2D;

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

function fillStroke(ctx: Ctx, fill: string, lw = 1.5): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
}

function limb(ctx: Ctx, x: number, y: number, angle: number, len: number, w: number, fill: string, hoof?: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.roundRect(-w / 2, -1, w, len, w / 2);
  fillStroke(ctx, fill, 1.3);
  if (hoof) {
    ctx.beginPath();
    ctx.roundRect(-w / 2 - 0.5, len - 3, w + 1, 4, 1.5);
    fillStroke(ctx, hoof, 1.1);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------------------------------ */
/* Dogs                                                                                         */
/* ------------------------------------------------------------------------------------------ */

export type DogPose = 'stand' | 'walk' | 'run' | 'sit' | 'lie';

export interface DogLook {
  x: number;
  y: number;
  faceX: number;
  pose: DogPose;
  phase: number;
  clock: number;
  /** Tail wag intensity 0..1. */
  wag: number;
  ball?: boolean;
  ghost?: boolean;
}

function drawDogRight(ctx: Ctx, d: DogDef, s: DogLook): void {
  const run = s.pose === 'run';
  const moving = s.pose === 'walk' || run;
  const sw = moving ? Math.sin(s.phase) * (run ? 0.75 : 0.45) : 0;
  const bob = moving ? Math.abs(Math.sin(s.phase)) * (run ? 2.5 : 1.2) : 0;
  const sit = s.pose === 'sit';
  const lie = s.pose === 'lie';
  const bodyY = lie ? -7 : sit ? -13 : -16 - bob;
  const fluffy = d.kind === 'collie';
  const terrier = d.kind === 'terrier';

  // Tail.
  const wag = Math.sin(s.clock * (8 + s.wag * 12)) * (4 + s.wag * 7);
  ctx.lineCap = 'round';
  ctx.beginPath();
  const tx = sit ? -11 : -14;
  const ty = sit ? -6 : bodyY - 3;
  ctx.moveTo(tx + 2, ty + 1);
  ctx.quadraticCurveTo(tx - 8, ty - 4, tx - 9 + wag * 0.5, ty - 12 + Math.abs(wag) * 0.2);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = fluffy ? 8 : 6;
  ctx.stroke();
  ctx.strokeStyle = d.base;
  ctx.lineWidth = fluffy ? 6 : 4;
  ctx.stroke();
  if (fluffy) {
    ellipse(ctx, tx - 9 + wag * 0.5, ty - 12, 2.6, 2.6);
    ctx.fillStyle = d.patch;
    ctx.fill();
  }

  if (lie) {
    ellipse(ctx, 0, bodyY, 16, 6.5);
    fillStroke(ctx, d.base, 1.5);
    if (terrier) wiryCoat(ctx, d, 0, bodyY, 16, 6.5);
    limb(ctx, 10, -3, -1.5, 9, 4.5, d.base);
  } else if (sit) {
    // Haunch and straight front legs.
    ellipse(ctx, -4, -8, 10, 8);
    fillStroke(ctx, d.base, 1.5);
    ellipse(ctx, 4, -14, 7, 10, -0.5);
    fillStroke(ctx, d.base, 1.5);
    limb(ctx, 6, -10, 0, 10, 4.5, d.base);
    limb(ctx, 9, -10, 0, 10, 4.5, d.kind === 'collie' ? d.patch : d.base);
  } else {
    limb(ctx, 9, bodyY + 4, -sw, 13 + bob, 4.5, d.base);
    limb(ctx, -9, bodyY + 4, sw, 13 + bob, 4.5, d.base);
    ellipse(ctx, 0, bodyY, 15, 7.5);
    fillStroke(ctx, d.base, 1.6);
    if (terrier) wiryCoat(ctx, d, 0, bodyY, 15, 7.5);
    if (d.kind === 'collie') {
      ellipse(ctx, 8, bodyY + 2, 7, 5.5);
      ctx.fillStyle = d.patch;
      ctx.fill();
    }
    limb(ctx, 11, bodyY + 5, sw, 12 + bob, 4.5, d.kind === 'collie' ? d.patch : d.base);
    limb(ctx, -7, bodyY + 5, -sw, 12 + bob, 4.5, d.base);
  }

  // Head.
  const hx = lie ? 15 : sit ? 9 : 15;
  const hy = lie ? -11 : sit ? -26 : bodyY - 8 + (moving ? Math.sin(s.phase * 2) * 0.8 : 0);
  ellipse(ctx, hx, hy, 7.5, 7);
  fillStroke(ctx, d.base, 1.5);
  // Snout.
  ellipse(ctx, hx + 7, hy + 2.5, 5.5, 3.6);
  fillStroke(ctx, terrier ? d.base : d.patch, 1.3);
  ellipse(ctx, hx + 11.6, hy + 1.2, 1.8, 1.5);
  ctx.fillStyle = C.ink;
  ctx.fill();
  if (d.kind === 'collie') {
    // White blaze.
    ctx.beginPath();
    ctx.moveTo(hx + 1, hy - 7);
    ctx.lineTo(hx + 3, hy - 7);
    ctx.lineTo(hx + 5, hy + 1);
    ctx.lineTo(hx + 1.5, hy + 1);
    ctx.closePath();
    ctx.fillStyle = d.patch;
    ctx.fill();
    // Perky ears with folded tips.
    ctx.beginPath();
    ctx.moveTo(hx - 4, hy - 5);
    ctx.lineTo(hx - 3, hy - 13);
    ctx.lineTo(hx + 1.5, hy - 6);
    ctx.closePath();
    fillStroke(ctx, d.base, 1.2);
  } else if (terrier) {
    // Two upright, pointed ears.
    for (const [ex, lean] of [[-4.5, -1], [-0.5, 1.5]] as [number, number][]) {
      ctx.beginPath();
      ctx.moveTo(hx + ex - 2.5, hy - 5);
      ctx.lineTo(hx + ex + lean, hy - 15);
      ctx.lineTo(hx + ex + 3, hy - 5.5);
      ctx.closePath();
      fillStroke(ctx, d.base, 1.2);
    }
    // Whiskery beard and eyebrows.
    ctx.strokeStyle = shadeHex(d.base, 1.6);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const bx = hx + 4 + i * 1.6;
      ctx.moveTo(bx, hy + 4.5);
      ctx.lineTo(bx - 0.6 + (i % 2), hy + 8.5 + (i % 3));
    }
    ctx.moveTo(hx + 1.5, hy - 4);
    ctx.lineTo(hx + 5.5, hy - 5.5);
    ctx.stroke();
  } else {
    // Floppy ear.
    ctx.beginPath();
    ctx.moveTo(hx - 3, hy - 5);
    ctx.quadraticCurveTo(hx - 8, hy - 2, hx - 5, hy + 6 + Math.sin(s.clock * 3) * 0.6);
    ctx.quadraticCurveTo(hx - 1, hy + 3, hx + 1, hy - 4);
    ctx.closePath();
    fillStroke(ctx, d.patch, 1.2);
  }
  // Eye.
  ellipse(ctx, hx + 3.5, hy - 1.5, 1.3, 1.6);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ellipse(ctx, hx + 3.9, hy - 2.1, 0.5, 0.5);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  if (s.ball) {
    ellipse(ctx, hx + 10, hy + 5, 3.6, 3.6);
    fillStroke(ctx, '#d9e64a', 1.1);
  } else if (run || s.wag > 0.6) {
    // Happy tongue.
    ellipse(ctx, hx + 7, hy + 6.5, 1.8, 2.6);
    fillStroke(ctx, '#ef7d8f', 0.9);
  }
  // Collar.
  if (!lie) {
    ctx.strokeStyle = d.collar ?? (d.kind === 'collie' ? '#d9434f' : '#8a8f96');
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(hx - 5, hy + 4);
    ctx.lineTo(hx - 1, hy + 6.5);
    ctx.stroke();
  }
}

function shadeHex(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.min(255, Math.round(v * k));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

/** Scruffy terrier coat: brindle streaks, wiry tufts along the back, white chest blaze. */
function wiryCoat(ctx: Ctx, d: DogDef, x: number, y: number, rx: number, ry: number): void {
  ctx.save();
  ellipse(ctx, x, y, rx, ry);
  ctx.clip();
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = shadeHex(d.base, 1.45);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const [ox, len] of [[-9, 0.5], [-3, 0.35], [4, 0.45], [9, 0.3]]) {
    ctx.moveTo(x + ox, y - ry);
    ctx.quadraticCurveTo(x + ox + 3, y - ry * (1 - len), x + ox + 1, y - ry * (1 - len * 2));
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.strokeStyle = d.base;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  // A few wiry tufts at the shoulders and rump, not a full fringe.
  for (const i of [-4, -3, 3, 4]) {
    const tx = x + i * 2.8;
    const ty = y - ry * Math.sqrt(Math.max(0, 1 - ((i * 2.8) / rx) ** 2));
    ctx.moveTo(tx, ty + 1.5);
    ctx.lineTo(tx - 1.2, ty - 2);
  }
  ctx.stroke();
  ellipse(ctx, x + rx * 0.8, y + ry * 0.45, 2.6, 3);
  ctx.fillStyle = d.patch;
  ctx.fill();
}

export function drawDog(ctx: Ctx, d: DogDef, s: DogLook): void {
  ctx.save();
  ctx.translate(s.x, s.y);
  if (!s.ghost) {
    ellipse(ctx, 0, 0, 16 * (d.size ?? 1), 4.5 * (d.size ?? 1));
    ctx.fillStyle = C.shadow;
    ctx.fill();
  }
  if (s.faceX < 0) ctx.scale(-1, 1);
  if (d.size) ctx.scale(d.size, d.size);
  ctx.lineJoin = 'round';
  drawDogRight(ctx, d, s);
  ctx.restore();
}

/* ------------------------------------------------------------------------------------------ */
/* Donkeys                                                                                      */
/* ------------------------------------------------------------------------------------------ */

export interface DonkeyLook {
  x: number;
  y: number;
  faceX: number;
  walking: boolean;
  phase: number;
  clock: number;
  /** Head down to graze / eat. */
  graze: boolean;
  /** Mid hee-haw: head up, mouth open. */
  bray: boolean;
  ghost?: boolean;
}

function drawDonkeyRight(ctx: Ctx, d: DonkeyDef, s: DonkeyLook): void {
  const sw = s.walking ? Math.sin(s.phase) * 0.4 : 0;
  const bob = s.walking ? Math.abs(Math.sin(s.phase)) * 1.4 : 0;
  const bodyY = -30 - bob;
  const muzzle = '#e9e1d2';

  // Tail with a tuft.
  const tsw = Math.sin(s.clock * 1.7) * 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(-24, bodyY - 4);
  ctx.quadraticCurveTo(-31, bodyY + 4, -29 + tsw, bodyY + 16);
  ctx.stroke();
  ctx.strokeStyle = d.coat;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ellipse(ctx, -29 + tsw, bodyY + 18, 2.6, 4);
  fillStroke(ctx, d.dark, 1);

  // Far legs.
  limb(ctx, 14, bodyY + 6, -sw, 25 + bob, 5.5, d.dark, '#3b2a20');
  limb(ctx, -16, bodyY + 6, sw, 25 + bob, 5.5, d.dark, '#3b2a20');
  // Barrel body with a pale belly.
  ellipse(ctx, -1, bodyY, 26, 13.5);
  fillStroke(ctx, d.coat, 1.8);
  ctx.save();
  ellipse(ctx, -1, bodyY, 26, 13.5);
  ctx.clip();
  ellipse(ctx, 0, bodyY + 12, 22, 6);
  ctx.fillStyle = muzzle;
  ctx.fill();
  // Dorsal stripe and shoulder cross, a donkey trademark.
  ctx.strokeStyle = d.dark;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-24, bodyY - 11);
  ctx.quadraticCurveTo(0, bodyY - 15, 18, bodyY - 11);
  ctx.moveTo(12, bodyY - 13);
  ctx.lineTo(10, bodyY - 1);
  ctx.stroke();
  ctx.restore();
  // Near legs.
  limb(ctx, 17, bodyY + 7, sw, 24 + bob, 5.8, d.coat, '#3b2a20');
  limb(ctx, -13, bodyY + 7, -sw, 24 + bob, 5.8, d.coat, '#3b2a20');

  // Neck and head.
  const hx = s.graze ? 30 : 30;
  const hy = s.graze ? bodyY + 18 : s.bray ? bodyY - 22 : bodyY - 16;
  const rot = s.graze ? 1.1 : s.bray ? -0.6 : 0.35;
  ctx.beginPath();
  ctx.moveTo(14, bodyY - 10);
  ctx.quadraticCurveTo(hx - 4, hy - 6, hx - 2, hy - 2);
  ctx.lineTo(hx + 2, hy + 6);
  ctx.quadraticCurveTo(hx - 2, bodyY + 4, 18, bodyY + 4);
  ctx.closePath();
  fillStroke(ctx, d.coat, 1.6);
  // Short upright mane.
  ctx.strokeStyle = d.dark;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(15, bodyY - 11);
  ctx.quadraticCurveTo(hx - 6, hy - 9, hx - 4, hy - 5);
  ctx.stroke();
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(rot);
  // Ears: long, the whole point of a donkey.
  const flick = Math.sin(s.clock * 0.9 + d.coat.length) > 0.92 ? 0.35 : 0;
  for (const [ex, a] of [
    [-3, -0.45 - flick],
    [2, -0.15],
  ] as [number, number][]) {
    ctx.save();
    ctx.translate(ex, -6);
    ctx.rotate(a);
    ellipse(ctx, 0, -9, 3.6, 10);
    fillStroke(ctx, d.coat, 1.4);
    ellipse(ctx, 0, -9, 1.6, 7);
    ctx.fillStyle = d.dark;
    ctx.fill();
    ctx.restore();
  }
  // Long head with a pale muzzle.
  ellipse(ctx, 6, 2, 12, 7.5, 0.25);
  fillStroke(ctx, d.coat, 1.6);
  ellipse(ctx, 13, 5, 6.5, 5.5, 0.25);
  fillStroke(ctx, muzzle, 1.3);
  ellipse(ctx, 15.5, 3.6, 1, 1.4);
  ctx.fillStyle = C.ink;
  ctx.fill();
  if (s.bray) {
    ellipse(ctx, 15, 9, 3.4, 2.4);
    fillStroke(ctx, '#8a2f3a', 1);
  }
  // Eye with a pale ring.
  ellipse(ctx, 3, -1, 2.6, 2.4);
  ctx.fillStyle = muzzle;
  ctx.fill();
  ellipse(ctx, 3.3, -1, 1.2, 1.5);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.restore();
}

export function drawDonkey(ctx: Ctx, d: DonkeyDef, s: DonkeyLook): void {
  ctx.save();
  ctx.translate(s.x, s.y);
  if (!s.ghost) {
    ellipse(ctx, 0, 0, 30, 7);
    ctx.fillStyle = C.shadow;
    ctx.fill();
  }
  if (s.faceX < 0) ctx.scale(-1, 1);
  ctx.lineJoin = 'round';
  drawDonkeyRight(ctx, d, s);
  ctx.restore();
}

/* ------------------------------------------------------------------------------------------ */
/* Chickens                                                                                     */
/* ------------------------------------------------------------------------------------------ */

export function drawChicken(ctx: Ctx, x: number, y: number, dir: number, peck: boolean, brown: boolean, flap = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.shadow;
  ctx.fill();
  ctx.scale(dir, 1);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.2;
  ctx.fillStyle = '#f2b33a';
  ctx.fillRect(-2, -3, 1.4, 3);
  ctx.fillRect(1, -3, 1.4, 3);
  ctx.beginPath();
  ctx.ellipse(0, -7, 7, 5.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = brown ? '#b4683a' : '#fffaf0';
  ctx.fill();
  ctx.stroke();
  if (flap > 0) {
    ctx.beginPath();
    ctx.ellipse(-2, -10 - flap * 3, 5, 2.5, -0.6 - flap, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
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
}
