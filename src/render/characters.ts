import type { Coat } from '../games/kitten/kittenTypes';
import type { Emote, Kitten, Player } from '../games/kitten/types';
import { C } from './palette';

type Ctx = CanvasRenderingContext2D;

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

function fillStroke(ctx: Ctx, fill: string, stroke: string = C.ink, lw = 1.6): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/* ------------------------------------------------------------------------------------------ */
/* Deputy the tiger, with Natalie riding                                                        */
/* ------------------------------------------------------------------------------------------ */

export interface RiderPose {
  x: number;
  y: number;
  faceX: number;
  speed01: number;
  walkPhase: number;
  whistleT: number;
  throwT: number;
  cheerT: number;
  idleT: number;
  mood: Player['mood']['kind'];
  clock: number;
  /** -1 riding north, +1 riding south (for a slight lean). */
  vertical: number;
  /** Skip the ground shadow (used for the see-through pass). */
  ghost?: boolean;
}

function tigerLeg(ctx: Ctx, hipX: number, hipY: number, angle: number, len: number, near: boolean): void {
  ctx.save();
  ctx.translate(hipX, hipY);
  ctx.rotate(angle);
  roundRectPath(ctx, -5, -2, 10, len, 5);
  fillStroke(ctx, near ? C.tiger : C.tigerDark, C.ink, 1.5);
  // Paw.
  ellipse(ctx, 1.5, len - 1, 6.5, 4);
  fillStroke(ctx, near ? C.cream : '#e8d2b6', C.ink, 1.4);
  // Leg stripe.
  ctx.strokeStyle = C.tigerStripe;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, len * 0.35);
  ctx.lineTo(3, len * 0.42);
  ctx.stroke();
  ctx.restore();
}

/** Draws Deputy + Natalie facing right; the caller flips for left. Origin is the ground point. */
function drawRiderRight(ctx: Ctx, s: RiderPose): void {
  const moving = s.speed01 > 0.05;
  const ph = s.walkPhase;
  const swing = moving ? Math.sin(ph) * 0.55 * Math.min(1, s.speed01 * 1.6) : 0;
  const bob = moving ? Math.abs(Math.sin(ph)) * 2.2 : Math.sin(s.clock * 2) * 0.6;
  const lean = s.vertical * 2;
  const bodyY = -30 - bob;

  // Tail: swishes lazily, faster when happy.
  const happy = s.mood === 'proud' || s.cheerT > 0;
  const tailSw = Math.sin(s.clock * (happy ? 9 : 2.6)) * (happy ? 9 : 5);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-32, bodyY - 2);
  ctx.bezierCurveTo(-50, bodyY - 4, -54, bodyY - 22 + tailSw * 0.4, -46 + tailSw * 0.3, bodyY - 34 + tailSw);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 9.5;
  ctx.stroke();
  ctx.strokeStyle = C.tiger;
  ctx.lineWidth = 6.5;
  ctx.stroke();
  ctx.setLineDash([3.5, 5]);
  ctx.strokeStyle = C.tigerStripe;
  ctx.stroke();
  ctx.setLineDash([]);
  ellipse(ctx, -46 + tailSw * 0.3, bodyY - 34 + tailSw, 4.2, 4.2);
  ctx.fillStyle = C.tigerStripe;
  ctx.fill();
  ctx.restore();

  // Far legs.
  tigerLeg(ctx, 18, bodyY + 6, -swing, 25 + bob, false);
  tigerLeg(ctx, -22, bodyY + 6, swing, 25 + bob, false);

  // Body.
  ellipse(ctx, -2, bodyY, 36, 17);
  fillStroke(ctx, C.tiger, C.ink, 2);
  ctx.save();
  ellipse(ctx, -2, bodyY, 36, 17);
  ctx.clip();
  ellipse(ctx, 0, bodyY + 15, 32, 10);
  ctx.fillStyle = C.cream;
  ctx.fill();
  ellipse(ctx, -6, bodyY - 9, 28, 7);
  ctx.fillStyle = C.tigerLight;
  ctx.fill();
  // Stripes over the back.
  ctx.strokeStyle = C.tigerStripe;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const sx = -30 + i * 10;
    ctx.lineWidth = i % 2 ? 2.6 : 3.4;
    ctx.beginPath();
    ctx.moveTo(sx, bodyY - 18);
    ctx.quadraticCurveTo(sx + 4, bodyY - 8, sx - 1, bodyY + 2 + (i % 2) * 3);
    ctx.stroke();
  }
  ctx.restore();

  // Near legs.
  tigerLeg(ctx, 22, bodyY + 8, swing, 23 + bob, true);
  tigerLeg(ctx, -18, bodyY + 8, -swing, 23 + bob, true);

  // Head.
  const headX = 36;
  const headY = bodyY - 10 + (moving ? Math.sin(ph * 2) * 0.8 : 0);
  // Ears.
  for (const ex of [-9, 6]) {
    ellipse(ctx, headX + ex, headY - 15, 6, 6);
    fillStroke(ctx, C.tiger, C.ink, 1.6);
    ellipse(ctx, headX + ex, headY - 14.5, 3, 3);
    ctx.fillStyle = C.tigerStripe;
    ctx.fill();
  }
  ellipse(ctx, headX, headY, 17, 15.5);
  fillStroke(ctx, C.tiger, C.ink, 2);
  // Cheek ruff.
  ctx.beginPath();
  ctx.moveTo(headX - 14, headY + 2);
  ctx.quadraticCurveTo(headX - 18, headY + 12, headX - 8, headY + 14);
  ctx.quadraticCurveTo(headX, headY + 18, headX + 10, headY + 13);
  ctx.quadraticCurveTo(headX + 18, headY + 10, headX + 15, headY + 2);
  ctx.closePath();
  ctx.fillStyle = C.cream;
  ctx.fill();
  // Muzzle.
  ellipse(ctx, headX + 9, headY + 5, 8.5, 6.5);
  fillStroke(ctx, C.cream, C.ink, 1.3);
  // Nose.
  ctx.beginPath();
  ctx.moveTo(headX + 11, headY + 0.5);
  ctx.lineTo(headX + 16.5, headY + 0.5);
  ctx.lineTo(headX + 13.8, headY + 4);
  ctx.closePath();
  ctx.fillStyle = C.pink;
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Forehead stripes.
  ctx.strokeStyle = C.tigerStripe;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(headX - 2, headY - 14);
  ctx.lineTo(headX, headY - 8);
  ctx.moveTo(headX + 4, headY - 14);
  ctx.lineTo(headX + 4.5, headY - 9);
  ctx.moveTo(headX - 8, headY - 12);
  ctx.lineTo(headX - 5, headY - 7);
  ctx.moveTo(headX - 16, headY - 2);
  ctx.lineTo(headX - 10, headY - 1);
  ctx.stroke();
  // Eyes: big friendly eyes, happy arcs when proud or chuffing.
  const blink = Math.sin(s.clock * 1.3) > 0.985;
  const content = happy || s.mood === 'chuff';
  const yawning = s.mood === 'yawn';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  if (content || blink || yawning) {
    ctx.beginPath();
    ctx.arc(headX + 4, headY - 3, 3, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  } else {
    ellipse(ctx, headX + 4.5, headY - 3.5, 3.2, 3.8);
    ctx.fillStyle = '#f7e27a';
    ctx.fill();
    ctx.stroke();
    ellipse(ctx, headX + 5.4, headY - 3.2, 1.5, 2.6);
    ctx.fillStyle = C.ink;
    ctx.fill();
    ellipse(ctx, headX + 4.6, headY - 4.6, 0.9, 0.9);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  // Mouth.
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  if (yawning) {
    ellipse(ctx, headX + 11, headY + 9, 4, 4.5);
    ctx.fillStyle = '#8a2f3a';
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.moveTo(headX + 13.8, headY + 4);
    ctx.quadraticCurveTo(headX + 12, headY + 8, headX + 9, headY + 7);
    ctx.moveTo(headX + 13.8, headY + 4);
    ctx.quadraticCurveTo(headX + 15.5, headY + 8, headX + 18, headY + 6.5);
    ctx.stroke();
  }
  // Whiskers.
  ctx.strokeStyle = 'rgba(59,42,32,0.6)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(headX + 16, headY + 6);
  ctx.lineTo(headX + 27, headY + 4);
  ctx.moveTo(headX + 16, headY + 7.5);
  ctx.lineTo(headX + 26, headY + 9);
  ctx.stroke();

  drawNatalie(ctx, -4 + lean * 0.3, bodyY - 14, s);
}

function drawNatalie(ctx: Ctx, x: number, seatY: number, s: RiderPose): void {
  const moving = s.speed01 > 0.05;
  const bounce = moving ? Math.abs(Math.sin(s.walkPhase + 0.6)) * 1.6 : 0;
  const y = seatY - bounce;
  const cheering = s.cheerT > 0;

  // Boot + leg dangling down Deputy's side.
  ctx.save();
  ctx.translate(x + 3, y + 2);
  ctx.rotate(moving ? Math.sin(s.walkPhase) * 0.12 : 0);
  roundRectPath(ctx, -4, -2, 8, 15, 4);
  fillStroke(ctx, '#f5caa6', C.ink, 1.4);
  ctx.beginPath();
  ctx.moveTo(-4.5, 11);
  ctx.lineTo(4.5, 11);
  ctx.lineTo(5, 18);
  ctx.lineTo(10, 19);
  ctx.quadraticCurveTo(11, 22.5, 8, 22.5);
  ctx.lineTo(-5, 22.5);
  ctx.closePath();
  fillStroke(ctx, '#e9a7b8', C.ink, 1.4);
  ctx.fillStyle = C.gold;
  ctx.fillRect(-4, 13, 8, 1.6);
  ctx.restore();

  // Braids swing behind.
  const braidSw = moving ? Math.sin(s.walkPhase * 1.0 + 1) * 3 : Math.sin(s.clock * 1.5) * 1;
  ctx.strokeStyle = C.ink;
  ctx.lineCap = 'round';
  for (const bx of [-6, 3]) {
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x + bx, y - 26);
    ctx.quadraticCurveTo(x + bx - 6, y - 18, x + bx - 7 + braidSw, y - 10);
    ctx.stroke();
    ctx.strokeStyle = '#e8cc8a';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = C.ink;
    ellipse(ctx, x + bx - 7 + braidSw, y - 9, 2.2, 2.2);
    ctx.fillStyle = C.hatBand;
    ctx.fill();
  }

  // Torso: red shirt with a fringed vest and yellow bandana.
  ctx.beginPath();
  ctx.moveTo(x - 7, y + 1);
  ctx.quadraticCurveTo(x - 9, y - 12, x - 5, y - 19);
  ctx.lineTo(x + 5, y - 19);
  ctx.quadraticCurveTo(x + 9, y - 12, x + 8, y + 1);
  ctx.closePath();
  fillStroke(ctx, '#fbf3e6', C.ink, 1.6);
  for (const [fx, fy, fc] of [[-3, -14, '#e2486a'], [3, -8, '#f2b33a'], [-4, -4, '#f28aa0'], [4, -16, '#5f9e6e']] as [number, number, string][]) {
    ctx.beginPath();
    ctx.arc(x + fx, y + fy, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = fc;
    ctx.fill();
  }

  // Arms.
  const shoulder = { x: x + 3, y: y - 15 };
  let hand: { x: number; y: number };
  let free: { x: number; y: number };
  if (cheering) {
    const wave = Math.sin(s.clock * 14) * 4;
    hand = { x: x + 10, y: y - 4 };
    free = { x: x + 4 + wave, y: y - 40 };
  } else if (s.whistleT > 0) {
    hand = { x: x + 12, y: y - 4 };
    free = { x: x + 7, y: y - 23 };
  } else if (s.throwT > 0) {
    const k = s.throwT / 0.5;
    hand = { x: x + 12, y: y - 4 };
    free = { x: x + 4 + (1 - k) * 18, y: y - 34 + (1 - k) * 18 };
  } else {
    hand = { x: x + 13, y: y - 4 };
    free = { x: x + 15, y: y - 7 + (moving ? Math.sin(s.walkPhase) : 0) };
  }
  // Rope rein loosely looped around Deputy's neck.
  ctx.strokeStyle = '#d8b87a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(hand.x, hand.y);
  ctx.quadraticCurveTo(x + 24, y + 8, x + 34, y + 2);
  ctx.stroke();
  for (const h of [hand, free]) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 5.4;
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(h.x, h.y);
    ctx.stroke();
    ctx.strokeStyle = '#f5caa6';
    ctx.lineWidth = 3.6;
    ctx.stroke();
    ellipse(ctx, h.x, h.y, 2.6, 2.6);
    fillStroke(ctx, C.skin, C.ink, 1.1);
  }

  // Head.
  const hx = x + 1.5;
  const hy = y - 27;
  ellipse(ctx, hx, hy, 8, 8.2);
  fillStroke(ctx, C.skin, C.ink, 1.6);
  // Fringe of hair.
  ctx.beginPath();
  ctx.moveTo(hx - 8, hy - 2);
  ctx.quadraticCurveTo(hx - 3, hy - 6, hx + 2, hy - 4);
  ctx.quadraticCurveTo(hx + 6, hy - 7, hx + 8, hy - 2);
  ctx.lineTo(hx + 8, hy - 8);
  ctx.lineTo(hx - 8, hy - 8);
  ctx.closePath();
  ctx.fillStyle = '#e8cc8a';
  ctx.fill();
  // Face.
  ctx.fillStyle = C.ink;
  const blink = Math.sin(s.clock * 1.7 + 2) > 0.98;
  if (blink || cheering) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(hx + 4, hy + 0.5, 1.6, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  } else {
    ellipse(ctx, hx + 4.2, hy + 0.2, 1.2, 1.6);
    ctx.fill();
  }
  // Freckles + cheek.
  ellipse(ctx, hx + 2.5, hy + 3.6, 2, 1.3);
  ctx.fillStyle = 'rgba(232,110,110,0.45)';
  ctx.fill();
  ctx.fillStyle = '#b5714a';
  for (const [fx, fy] of [[1.5, 3], [3, 3.8], [4.4, 3]]) ctx.fillRect(hx + fx, hy + fy, 0.8, 0.8);
  // Mouth.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (s.whistleT > 0) {
    ellipse(ctx, hx + 6.6, hy + 4.6, 1.3, 1.3);
    ctx.stroke();
  } else {
    ctx.arc(hx + 5, hy + 4, cheering ? 2.6 : 2, 0.1, Math.PI * 0.8);
    if (cheering) {
      ctx.fillStyle = '#8a2f3a';
      ctx.fill();
    }
    ctx.stroke();
  }

  // The hat: oversized, tilted back a little, the thing you recognise from across the ranch.
  if (!cheering) drawHat(ctx, hx - 0.5, hy - 6.5, -0.08);
  else drawHat(ctx, free.x + 1, free.y - 5, Math.sin(s.clock * 14) * 0.25);
}

export function drawHat(ctx: Ctx, x: number, y: number, rot: number, scale = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  // Brim (curled up at the sides).
  ctx.beginPath();
  ctx.moveTo(-16, -2);
  ctx.quadraticCurveTo(-13, 3.5, 0, 3.5);
  ctx.quadraticCurveTo(13, 3.5, 16, -2);
  ctx.quadraticCurveTo(12, 0, 0, 0.5);
  ctx.quadraticCurveTo(-12, 0, -16, -2);
  ctx.closePath();
  fillStroke(ctx, C.hat, C.ink, 1.5);
  // Crown with a pinch.
  ctx.beginPath();
  ctx.moveTo(-8.5, 0.5);
  ctx.quadraticCurveTo(-10, -9, -6, -12);
  ctx.quadraticCurveTo(-2, -9.5, 0, -12.5);
  ctx.quadraticCurveTo(2, -9.5, 6, -12);
  ctx.quadraticCurveTo(10, -9, 8.5, 0.5);
  ctx.closePath();
  fillStroke(ctx, C.hat, C.ink, 1.5);
  ctx.beginPath();
  ctx.moveTo(-8.7, -1);
  ctx.lineTo(8.7, -1);
  ctx.lineTo(8.9, -4);
  ctx.lineTo(-8.9, -4);
  ctx.closePath();
  ctx.fillStyle = C.hatBand;
  ctx.fill();
  // Little gold star on the band.
  star(ctx, 3.5, -2.6, 2.2, C.gold);
  ctx.strokeStyle = C.hatDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-5, -9);
  ctx.quadraticCurveTo(-3, -6, -4, -4.5);
  ctx.stroke();
  ctx.restore();
}

export function star(ctx: Ctx, x: number, y: number, r: number, fill: string): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function drawRider(ctx: Ctx, s: RiderPose): void {
  ctx.save();
  ctx.translate(s.x, s.y);
  if (!s.ghost) {
    ellipse(ctx, 2, 0, 40, 10);
    ctx.fillStyle = C.shadowDeep;
    ctx.fill();
  }
  if (s.faceX < 0) ctx.scale(-1, 1);
  ctx.lineJoin = 'round';
  drawRiderRight(ctx, s);
  ctx.restore();
}

/* ------------------------------------------------------------------------------------------ */
/* Kittens                                                                                      */
/* ------------------------------------------------------------------------------------------ */

export type KittenPose = 'walk' | 'sit' | 'lie' | 'eat' | 'pounce';

export interface KittenLook {
  x: number;
  y: number;
  faceX: number;
  coat: Coat;
  pose: KittenPose;
  phase: number;
  speed: number;
  alarm: number;
  happy: boolean;
  clock: number;
  /** Highlight ring under unpenned kittens. */
  ring?: string | null;
  ghost?: boolean;
}

function patternBody(ctx: Ctx, coat: Coat, bx: number, by: number, rx: number, ry: number): void {
  ctx.save();
  ellipse(ctx, bx, by, rx, ry);
  ctx.clip();
  switch (coat.pattern) {
    case 'tabby':
      ctx.strokeStyle = coat.accent;
      ctx.lineWidth = 1.7;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(bx + i * 3.6, by - ry);
        ctx.quadraticCurveTo(bx + i * 3.6 + 1.5, by - ry * 0.2, bx + i * 3.6 - 0.5, by + ry * 0.3);
        ctx.stroke();
      }
      break;
    case 'tuxedo':
      ellipse(ctx, bx + rx * 0.55, by + ry * 0.5, rx * 0.55, ry * 0.7);
      ctx.fillStyle = coat.extra;
      ctx.fill();
      break;
    case 'calico':
      ellipse(ctx, bx - rx * 0.4, by - ry * 0.4, rx * 0.5, ry * 0.6);
      ctx.fillStyle = coat.accent;
      ctx.fill();
      ellipse(ctx, bx + rx * 0.35, by - ry * 0.6, rx * 0.35, ry * 0.45);
      ctx.fillStyle = coat.extra;
      ctx.fill();
      break;
    case 'points':
      ellipse(ctx, bx - rx * 0.9, by, rx * 0.4, ry);
      ctx.fillStyle = coat.accent;
      ctx.globalAlpha = 0.45;
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    case 'tortie':
      for (const [ox, oy, r] of [[-0.5, -0.3, 0.32], [0.25, 0.1, 0.28], [0.55, -0.5, 0.22], [-0.1, 0.6, 0.25]]) {
        ellipse(ctx, bx + rx * ox, by + ry * oy, rx * r, ry * r * 1.4);
        ctx.fillStyle = coat.accent;
        ctx.fill();
      }
      break;
    case 'bicolor':
      ellipse(ctx, bx, by + ry * 0.75, rx, ry * 0.6);
      ctx.fillStyle = coat.extra;
      ctx.fill();
      ellipse(ctx, bx - rx * 0.2, by - ry * 0.55, rx * 0.5, ry * 0.4);
      ctx.fillStyle = coat.accent;
      ctx.fill();
      break;
    case 'solid':
      ellipse(ctx, bx, by + ry * 0.6, rx * 0.8, ry * 0.5);
      ctx.fillStyle = coat.accent;
      ctx.fill();
      break;
  }
  ctx.restore();
}

function kittenHead(ctx: Ctx, k: KittenLook, hx: number, hy: number, eyesClosed: boolean): void {
  const coat = k.coat;
  const earBack = k.alarm > 0.5 ? 0.6 : 0;
  // Ears.
  for (const [ex, tilt] of [[-3.6, -0.25], [2.8, 0.2]]) {
    ctx.save();
    ctx.translate(hx + ex, hy - 4);
    ctx.rotate(tilt - earBack * (ex < 0 ? 1 : 0.6));
    ctx.beginPath();
    ctx.moveTo(-2.8, 1);
    ctx.lineTo(0, -5.6);
    ctx.lineTo(2.8, 1);
    ctx.closePath();
    const earColor = coat.pattern === 'points' || coat.pattern === 'tuxedo' ? coat.accent : coat.base;
    fillStroke(ctx, earColor, C.ink, 1.1);
    ctx.beginPath();
    ctx.moveTo(-1.2, 0.4);
    ctx.lineTo(0, -3.2);
    ctx.lineTo(1.2, 0.4);
    ctx.closePath();
    ctx.fillStyle = C.pink;
    ctx.fill();
    ctx.restore();
  }
  ellipse(ctx, hx, hy, 6.4, 5.8);
  fillStroke(ctx, coat.base, C.ink, 1.3);
  ctx.save();
  ellipse(ctx, hx, hy, 6.4, 5.8);
  ctx.clip();
  if (coat.pattern === 'points') {
    ellipse(ctx, hx + 2.5, hy + 1.5, 4.4, 3.8);
    ctx.fillStyle = coat.accent;
    ctx.fill();
  } else if (coat.pattern === 'tuxedo') {
    ellipse(ctx, hx + 2.6, hy + 3, 3.6, 3);
    ctx.fillStyle = coat.extra;
    ctx.fill();
  } else if (coat.pattern === 'tabby') {
    ctx.strokeStyle = coat.accent;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(hx - 1.5, hy - 5.5);
    ctx.lineTo(hx - 1, hy - 3);
    ctx.moveTo(hx + 1, hy - 5.5);
    ctx.lineTo(hx + 1, hy - 3);
    ctx.stroke();
  } else if (coat.pattern === 'calico') {
    ellipse(ctx, hx - 3, hy - 3, 3.5, 3.5);
    ctx.fillStyle = coat.accent;
    ctx.fill();
  } else if (coat.pattern === 'tortie') {
    ellipse(ctx, hx + 2, hy - 3, 3, 2.4);
    ctx.fillStyle = coat.accent;
    ctx.fill();
  } else if (coat.pattern === 'bicolor') {
    ellipse(ctx, hx + 2.5, hy + 3, 3.5, 3);
    ctx.fillStyle = coat.extra;
    ctx.fill();
  }
  ctx.restore();
  // Eyes.
  if (eyesClosed || k.happy) {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    if (k.happy && !eyesClosed) {
      ctx.arc(hx + 2.8, hy + 0.2, 1.4, Math.PI * 1.1, Math.PI * 1.9);
    } else {
      ctx.moveTo(hx + 1.4, hy + 0.4);
      ctx.quadraticCurveTo(hx + 2.8, hy + 1.6, hx + 4.2, hy + 0.4);
    }
    ctx.stroke();
  } else {
    const big = k.alarm > 0.5 ? 2.1 : 1.8;
    ellipse(ctx, hx + 2.8, hy - 0.2, big, big + 0.2);
    ctx.fillStyle = coat.eyes;
    ctx.fill();
    ellipse(ctx, hx + 3.2, hy - 0.1, 0.8, big * 0.8);
    ctx.fillStyle = C.ink;
    ctx.fill();
    ellipse(ctx, hx + 2.5, hy - 1, 0.55, 0.55);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  // Nose & whiskers.
  ellipse(ctx, hx + 6, hy + 1.6, 1, 0.8);
  ctx.fillStyle = C.pink;
  ctx.fill();
  ctx.strokeStyle = 'rgba(59,42,32,0.5)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(hx + 5, hy + 2.4);
  ctx.lineTo(hx + 10, hy + 1.8);
  ctx.moveTo(hx + 5, hy + 3);
  ctx.lineTo(hx + 9.5, hy + 3.8);
  ctx.stroke();
}

function kittenTail(ctx: Ctx, k: KittenLook, x: number, y: number, curl: number): void {
  const coat = k.coat;
  const sw = Math.sin(k.clock * 3 + k.phase) * 2.5;
  const color = coat.pattern === 'points' || coat.pattern === 'tuxedo' ? coat.accent : coat.base;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - 8, y - 2, x - 7 + sw, y - 9 - curl);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = coat.fluffy ? 6.2 : 4.6;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = coat.fluffy ? 4.2 : 2.8;
  ctx.stroke();
  if (coat.pattern === 'tabby' || coat.pattern === 'tortie') {
    ctx.setLineDash([1.6, 2.4]);
    ctx.strokeStyle = coat.accent;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** A kitten facing right at the origin (ground point). */
function drawKittenRight(ctx: Ctx, k: KittenLook): void {
  const coat = k.coat;
  const moving = k.speed > 6;
  const step = moving ? Math.sin(k.phase * 2.2) : 0;
  const legColor = coat.pattern === 'points' ? coat.accent : coat.pattern === 'tuxedo' ? coat.extra : coat.pattern === 'bicolor' ? coat.extra : coat.base;

  if (k.pose === 'lie') {
    // Curled up loaf, tail wrapped round.
    ellipse(ctx, 0, -5, 11, 6);
    fillStroke(ctx, coat.base, C.ink, 1.3);
    patternBody(ctx, coat, 0, -5, 11, 6);
    ctx.beginPath();
    ctx.moveTo(-10, -3);
    ctx.quadraticCurveTo(-4, 3, 8, -1);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 4.4;
    ctx.stroke();
    ctx.strokeStyle = coat.pattern === 'points' || coat.pattern === 'tuxedo' ? coat.accent : coat.base;
    ctx.lineWidth = 2.8;
    ctx.stroke();
    kittenHead(ctx, k, 7, -8, true);
    return;
  }

  if (k.pose === 'sit') {
    kittenTail(ctx, k, -4, -2, -4);
    ellipse(ctx, -1, -8, 6.5, 8);
    fillStroke(ctx, coat.base, C.ink, 1.3);
    patternBody(ctx, coat, -1, -8, 6.5, 8);
    // Front paws.
    ellipse(ctx, 3, -1, 2.4, 1.7);
    fillStroke(ctx, legColor, C.ink, 1);
    ellipse(ctx, 0, -1, 2.4, 1.7);
    fillStroke(ctx, legColor, C.ink, 1);
    kittenHead(ctx, k, 2, -17, false);
    return;
  }

  const crouch = k.pose === 'pounce' ? 2 : 0;
  const stretch = k.alarm > 0.5 && moving ? 1.5 : 0;
  const bodyY = -7 + crouch + (moving ? Math.abs(step) * -0.8 : 0);
  kittenTail(ctx, k, -8 - stretch, bodyY - 1, k.alarm > 0.5 ? 4 : 0);
  // Far legs.
  for (const [lx, sgn] of [[5, -1], [-5, 1]]) {
    ctx.save();
    ctx.translate(lx, bodyY + 2);
    ctx.rotate(step * 0.5 * sgn);
    roundRectPath(ctx, -1.5, 0, 3, 6 - crouch, 1.5);
    fillStroke(ctx, legColor, C.ink, 0.9);
    ctx.restore();
  }
  ellipse(ctx, 0, bodyY, 9.5 + stretch, 5.6);
  fillStroke(ctx, coat.base, C.ink, 1.3);
  patternBody(ctx, coat, 0, bodyY, 9.5 + stretch, 5.6);
  for (const [lx, sgn] of [[6, 1], [-4, -1]]) {
    ctx.save();
    ctx.translate(lx, bodyY + 2.5);
    ctx.rotate(step * 0.5 * sgn);
    roundRectPath(ctx, -1.6, 0, 3.2, 5.6 - crouch, 1.6);
    fillStroke(ctx, legColor, C.ink, 0.9);
    ctx.restore();
  }
  const headDown = k.pose === 'eat' ? 6 : 0;
  kittenHead(ctx, k, 9 + stretch, bodyY - 5 + headDown, false);
  if (coat.fluffy) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + i * 0.5;
      ctx.moveTo(Math.cos(a) * 9, bodyY + Math.sin(a) * 5.5);
      ctx.lineTo(Math.cos(a) * 11, bodyY + Math.sin(a) * 6.8);
    }
    ctx.stroke();
  }
}

export function drawKittenFigure(ctx: Ctx, k: KittenLook): void {
  ctx.save();
  ctx.translate(k.x, k.y);
  if (k.ring) {
    ellipse(ctx, 0, 0, 13, 5);
    ctx.strokeStyle = k.ring;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  if (!k.ghost) {
    ellipse(ctx, 0, 0, 10, 3.6);
    ctx.fillStyle = C.shadow;
    ctx.fill();
  }
  if (k.faceX < 0) ctx.scale(-1, 1);
  ctx.lineJoin = 'round';
  drawKittenRight(ctx, k);
  ctx.restore();
}

export function kittenLook(k: Kitten, x: number, y: number, clock: number): KittenLook {
  const speed = Math.hypot(k.vx, k.vy);
  let pose: KittenPose = 'walk';
  if (k.state === 'nap') pose = 'lie';
  else if (k.state === 'eat') pose = 'eat';
  else if (k.state === 'play') pose = speed > 6 ? 'pounce' : 'sit';
  else if (speed < 4 && (k.state === 'idle' || k.state === 'penned' || k.state === 'inspect' || k.state === 'follow')) pose = 'sit';
  return {
    x,
    y,
    faceX: k.faceX,
    coat: k.coat,
    pose,
    phase: k.animPhase,
    speed,
    alarm: k.alarm,
    happy: k.penned || k.state === 'eat' || k.state === 'follow',
    clock,
    ring: k.penned ? null : 'rgba(255,255,255,0.75)',
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Emote bubbles                                                                                */
/* ------------------------------------------------------------------------------------------ */

export function heartPath(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.45, y - s * 1.05, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35);
  ctx.closePath();
}

export function drawEmote(ctx: Ctx, e: Emote, x: number, y: number, t: number, clock: number): void {
  if (e === 'none') return;
  const pop = Math.min(1, t * 6);
  const float = Math.sin(clock * 4) * 1.2;
  ctx.save();
  ctx.translate(x, y + float);
  ctx.scale(pop, pop);
  if (e === 'zzz') {
    ctx.font = 'bold 9px ui-rounded, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.4;
    const k = (clock * 0.8) % 1;
    for (let i = 0; i < 3; i++) {
      const f = (k + i / 3) % 1;
      ctx.globalAlpha = 1 - f;
      ctx.strokeText('z', 4 + f * 8, -f * 14);
      ctx.fillText('z', 4 + f * 8, -f * 14);
    }
    ctx.restore();
    return;
  }
  // Bubble.
  ctx.beginPath();
  ctx.arc(0, -8, 7.5, 0, Math.PI * 2);
  ctx.moveTo(-2.5, -1.5);
  ctx.lineTo(0, 2.5);
  ctx.lineTo(2.5, -1.5);
  ctx.fillStyle = '#fffdf6';
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, -8, 7.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = 'bold 11px ui-rounded, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (e === 'alarm') {
    ctx.fillStyle = '#e04646';
    ctx.fillText('!', 0, -7.5);
  } else if (e === 'question') {
    ctx.fillStyle = '#3d7fd6';
    ctx.fillText('?', 0, -7.5);
  } else if (e === 'heart') {
    heartPath(ctx, 0, -7, 4.6);
    ctx.fillStyle = '#ef5d84';
    ctx.fill();
  } else if (e === 'note') {
    ctx.fillStyle = '#7b54c9';
    ellipse(ctx, -1.5, -5, 2.2, 1.7, -0.4);
    ctx.fill();
    ctx.fillRect(0.2, -12.5, 1.2, 7.5);
    ctx.fillRect(0.2, -12.5, 3.6, 1.4);
  } else if (e === 'sparkle') {
    star(ctx, 0, -8, 5.5, C.gold);
  }
  ctx.restore();
}
