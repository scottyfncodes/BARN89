import type { HatKind, PersonLook } from '../content/cast';
import { drawHat } from './characters';
import { C } from './palette';

type Ctx = CanvasRenderingContext2D;

export type PersonAction = 'none' | 'wave' | 'cheer' | 'throw' | 'point';
export type HeldItem = 'basket' | 'carrot' | 'ball' | 'pail' | 'axe' | null;

export interface PersonPose {
  x: number;
  y: number;
  faceX: number;
  /** 0..1 of top speed. */
  speed01: number;
  walkPhase: number;
  clock: number;
  action?: PersonAction;
  /** 1 → 0 progress of a timed action (throw). */
  actionT?: number;
  hold?: HeldItem;
  /** Override the hat (cosmetics). */
  hat?: HatKind;
  /** With hold 'axe': arm angle in radians (-2.3 raised behind the head, 0.9 swung down). */
  axe?: number;
  /** See-through pass behind trees and roofs: no shadow. */
  ghost?: boolean;
}

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

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
}

function leg(ctx: Ctx, hx: number, hy: number, angle: number, len: number, pants: string, shoes: string, boots: boolean, glitter: boolean): void {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.roundRect(-3.6, -1, 7.2, len, 3.4);
  fillStroke(ctx, pants, 1.4);
  if (boots) {
    // Western boot: shaft up the shin, pointed toe, little heel.
    ctx.beginPath();
    ctx.moveTo(-4, len - 10);
    ctx.lineTo(4.2, len - 10);
    ctx.lineTo(4, len - 3);
    ctx.lineTo(8.5, len - 1.5);
    ctx.quadraticCurveTo(9.5, len + 1.6, 6.5, len + 1.6);
    ctx.lineTo(-4.2, len + 1.6);
    ctx.closePath();
    fillStroke(ctx, shoes, 1.3);
    ctx.fillStyle = shade(shoes.startsWith('#') ? shoes : '#7b4a2a', 0.7);
    ctx.fillRect(-4.2, len + 0.2, 3, 1.6);
    if (glitter) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const [gx, gy] of [[-2, len - 8], [1.5, len - 5], [-1, len - 2], [3, len - 1], [5.5, len]]) ctx.fillRect(gx, gy, 1.2, 1.2);
    } else {
      ctx.strokeStyle = 'rgba(255,240,210,0.6)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-2, len - 8);
      ctx.quadraticCurveTo(0, len - 5, 2.5, len - 8);
      ctx.stroke();
    }
  } else {
    ellipse(ctx, 2.2, len - 0.5, 5.4, 3.1);
    fillStroke(ctx, shoes, 1.3);
  }
  ctx.restore();
}

function arm(ctx: Ctx, sx: number, sy: number, hx: number, hy: number, sleeve: string, skin: string): void {
  ctx.lineCap = 'round';
  // Elbow bends outward a touch so arms read as arms, not sticks.
  const mx = (sx + hx) / 2 - (hy - sy) * 0.08;
  const my = (sy + hy) / 2 + 1;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(mx, my, hx, hy);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 5.6;
  ctx.stroke();
  ctx.strokeStyle = sleeve;
  ctx.lineWidth = 3.8;
  ctx.stroke();
  ellipse(ctx, hx, hy, 2.7, 2.7);
  fillStroke(ctx, skin, 1.1);
}

function drawHair(ctx: Ctx, L: PersonLook, hx: number, hy: number, pose: PersonPose, back: boolean): void {
  const sway = pose.speed01 > 0.05 ? Math.sin(pose.walkPhase + 1) * 2.5 : Math.sin(pose.clock * 1.5) * 0.8;
  ctx.fillStyle = L.hair;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.3;
  if (back) {
    if (L.hairStyle === 'braids') {
      ctx.lineCap = 'round';
      for (const bx of [-6, 2]) {
        ctx.beginPath();
        ctx.moveTo(hx + bx, hy + 1);
        ctx.quadraticCurveTo(hx + bx - 6, hy + 8, hx + bx - 7 + sway, hy + 16);
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.strokeStyle = L.hair;
        ctx.lineWidth = 4;
        ctx.stroke();
        ellipse(ctx, hx + bx - 7 + sway, hy + 17, 2.2, 2.2);
        ctx.fillStyle = C.hatBand;
        ctx.fill();
      }
    } else if (L.hairStyle === 'wavy') {
      ctx.beginPath();
      ctx.moveTo(hx - 2, hy - 8);
      ctx.quadraticCurveTo(hx - 13, hy - 4, hx - 11 + sway * 0.4, hy + 12);
      ctx.quadraticCurveTo(hx - 6, hy + 15, hx - 1, hy + 11);
      ctx.quadraticCurveTo(hx + 2, hy + 4, hx + 1, hy - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (L.hairStyle === 'ponytail') {
      ctx.beginPath();
      ctx.moveTo(hx - 7, hy - 4);
      ctx.quadraticCurveTo(hx - 16, hy - 2, hx - 13 + sway, hy + 10);
      ctx.quadraticCurveTo(hx - 9, hy + 4, hx - 5, hy - 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    return;
  }
  // Front layer: hair cap over the top and back of the head.
  ctx.beginPath();
  switch (L.hairStyle) {
    case 'grey':
      ctx.moveTo(hx - 8.6, hy + 2);
      ctx.quadraticCurveTo(hx - 9.5, hy - 5, hx - 4, hy - 7);
      ctx.lineTo(hx - 3, hy - 3);
      ctx.quadraticCurveTo(hx - 6, hy - 1, hx - 5.5, hy + 3);
      ctx.closePath();
      break;
    case 'shaggy':
      ctx.moveTo(hx - 8.8, hy + 3);
      ctx.quadraticCurveTo(hx - 11, hy - 8, hx - 2, hy - 10);
      ctx.lineTo(hx + 1, hy - 12);
      ctx.lineTo(hx + 3, hy - 9.5);
      ctx.lineTo(hx + 7, hy - 10);
      ctx.quadraticCurveTo(hx + 10, hy - 6, hx + 8.5, hy - 2);
      ctx.lineTo(hx + 5, hy - 4.5);
      ctx.lineTo(hx + 2.5, hy - 2.5);
      ctx.lineTo(hx, hy - 4.5);
      ctx.quadraticCurveTo(hx - 4, hy - 2, hx - 5, hy + 4);
      ctx.closePath();
      break;
    case 'short':
      ctx.moveTo(hx - 8.7, hy + 2);
      ctx.quadraticCurveTo(hx - 10, hy - 8, hx, hy - 9.5);
      ctx.quadraticCurveTo(hx + 8, hy - 9, hx + 8.5, hy - 3);
      ctx.quadraticCurveTo(hx + 3, hy - 6, hx - 3, hy - 4);
      ctx.quadraticCurveTo(hx - 5, hy - 1, hx - 5, hy + 3);
      ctx.closePath();
      break;
    default:
      // Braids, wavy, ponytail: a soft fringe swept across.
      ctx.moveTo(hx - 8.8, hy + 4);
      ctx.quadraticCurveTo(hx - 10, hy - 9, hx, hy - 9.6);
      ctx.quadraticCurveTo(hx + 8.5, hy - 9, hx + 8.8, hy - 2);
      ctx.quadraticCurveTo(hx + 5, hy - 6, hx + 1, hy - 4);
      ctx.quadraticCurveTo(hx - 4, hy - 4, hx - 5, hy + 4);
      ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
}

function drawHeadwear(ctx: Ctx, hat: HatKind, L: PersonLook, hx: number, hy: number, clock: number): void {
  const col = L.hatColor ?? '#c98a4b';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.4;
  switch (hat) {
    case 'cowgirl':
      drawHat(ctx, hx - 0.5, hy - 6.5, -0.08, 0.95);
      break;
    case 'cap':
    case 'capBack': {
      const dir = hat === 'cap' ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(hx - 9, hy - 3);
      ctx.quadraticCurveTo(hx - 9, hy - 12.5, hx, hy - 12.5);
      ctx.quadraticCurveTo(hx + 9, hy - 12.5, hx + 9, hy - 3);
      ctx.closePath();
      fillStroke(ctx, col, 1.4);
      ctx.beginPath();
      ctx.moveTo(hx + dir * 6, hy - 4);
      ctx.quadraticCurveTo(hx + dir * 14, hy - 4, hx + dir * 16, hy - 2);
      ctx.lineTo(hx + dir * 6, hy - 1.5);
      ctx.closePath();
      fillStroke(ctx, shade(col, 0.75), 1.3);
      ellipse(ctx, hx, hy - 12.3, 1.5, 1);
      ctx.fillStyle = shade(col, 0.7);
      ctx.fill();
      break;
    }
    case 'flatcap':
      ctx.beginPath();
      ctx.moveTo(hx - 9.2, hy - 3);
      ctx.quadraticCurveTo(hx - 8, hy - 11.5, hx + 2, hy - 11);
      ctx.quadraticCurveTo(hx + 11, hy - 9, hx + 13, hy - 4.5);
      ctx.lineTo(hx + 8, hy - 3.2);
      ctx.closePath();
      fillStroke(ctx, col, 1.4);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.moveTo(hx - 4, hy - 10);
      ctx.quadraticCurveTo(hx + 2, hy - 7, hx + 8, hy - 7);
      ctx.stroke();
      break;
    case 'straw':
      ellipse(ctx, hx, hy - 6, 17, 4);
      fillStroke(ctx, '#ecd08a', 1.3);
      ctx.beginPath();
      ctx.moveTo(hx - 8, hy - 6);
      ctx.quadraticCurveTo(hx - 8, hy - 15, hx, hy - 15);
      ctx.quadraticCurveTo(hx + 8, hy - 15, hx + 8, hy - 6);
      ctx.closePath();
      fillStroke(ctx, '#f2dc9c', 1.3);
      ctx.fillStyle = '#d9434f';
      ctx.fillRect(hx - 8, hy - 9, 16, 2.6);
      break;
    case 'santa': {
      const flop = Math.sin(clock * 2) * 1.5;
      ctx.beginPath();
      ctx.moveTo(hx - 9, hy - 5);
      ctx.quadraticCurveTo(hx - 6, hy - 18, hx - 14 + flop, hy - 15);
      ctx.quadraticCurveTo(hx + 4, hy - 20, hx + 9, hy - 5);
      ctx.closePath();
      fillStroke(ctx, '#d6333f', 1.4);
      ctx.beginPath();
      ctx.roundRect(hx - 10, hy - 7, 20, 5, 2.5);
      fillStroke(ctx, '#fffaf0', 1.2);
      ellipse(ctx, hx - 14 + flop, hy - 15, 3, 3);
      fillStroke(ctx, '#fffaf0', 1.1);
      break;
    }
    case 'beanie':
      ctx.beginPath();
      ctx.moveTo(hx - 9, hy - 3);
      ctx.quadraticCurveTo(hx - 9, hy - 14, hx, hy - 14);
      ctx.quadraticCurveTo(hx + 9, hy - 14, hx + 9, hy - 3);
      ctx.closePath();
      fillStroke(ctx, '#3f8f6a', 1.4);
      ctx.fillStyle = '#2f6e50';
      ctx.fillRect(hx - 9, hy - 6, 18, 3);
      ellipse(ctx, hx, hy - 14.5, 2.6, 2.6);
      fillStroke(ctx, '#f2f2ee', 1);
      break;
    default:
      break;
  }
}

/** Draws one family member facing right (flipped for left). Origin is the ground point. */
function drawPersonRight(ctx: Ctx, L: PersonLook, p: PersonPose): void {
  const moving = p.speed01 > 0.05;
  const ph = p.walkPhase;
  const swing = moving ? Math.sin(ph) * 0.62 * Math.min(1, p.speed01 * 1.6) : 0;
  const bob = moving ? Math.abs(Math.cos(ph)) * 1.6 : Math.sin(p.clock * 2.1) * 0.4;
  const hipY = -22 - bob;
  const shY = -39 - bob;
  const hx = 1.6;
  const hy = -49.5 - bob;
  const action = p.action ?? 'none';

  // Hands.
  const sh = { x: 1, y: shY + 2 };
  let back = { x: sh.x - 3 - swing * 9, y: sh.y + 15 };
  let front = { x: sh.x + 3 + swing * 9, y: sh.y + 15 };
  if (!moving) {
    back = { x: sh.x - 3, y: sh.y + 15.5 };
    front = { x: sh.x + 4, y: sh.y + 15 };
  }
  if (action === 'wave') {
    front = { x: sh.x + 9 + Math.sin(p.clock * 12) * 3, y: sh.y - 13 };
  } else if (action === 'cheer') {
    const w = Math.sin(p.clock * 14) * 2.5;
    front = { x: sh.x + 7 + w, y: sh.y - 15 };
    back = { x: sh.x - 6 - w, y: sh.y - 15 };
  } else if (action === 'point') {
    front = { x: sh.x + 15, y: sh.y - 2 };
  } else if (action === 'throw') {
    const k = p.actionT ?? 0;
    front = { x: sh.x - 8 + (1 - k) * 24, y: sh.y - 14 + (1 - k) * 14 };
  }
  if (p.hold === 'basket' || p.hold === 'pail') front = { x: sh.x + 8, y: sh.y + 12 };
  const axeA = p.axe ?? 0.6;
  if (p.hold === 'axe') {
    front = { x: sh.x + Math.cos(axeA) * 15, y: sh.y + Math.sin(axeA) * 15 };
    back = { x: front.x - Math.cos(axeA) * 3, y: front.y - Math.sin(axeA) * 3 };
  }
  if (p.hold === 'carrot') front = { x: sh.x + 13, y: sh.y + 4 };

  // Back hair, back arm, legs.
  drawHair(ctx, L, hx, hy, p, true);
  const sleeve = L.sleeveless ? L.skin : L.shirt;
  const boots = !!L.cowboyBoots;
  arm(ctx, sh.x - 1, sh.y, back.x, back.y, shade(sleeve, 0.85), L.skin);
  leg(ctx, -1, hipY, swing, 22 + bob, shade(L.pants, 0.85), shade(L.shoes, 0.8), boots, !!L.glitter);
  leg(ctx, 2, hipY, -swing, 22 + bob, L.pants, L.shoes, boots, !!L.glitter);

  // Torso.
  ctx.beginPath();
  ctx.moveTo(-7.5, hipY + 2);
  ctx.quadraticCurveTo(-8.8, shY + 8, -6, shY);
  ctx.lineTo(7, shY);
  ctx.quadraticCurveTo(9.6, shY + 8, 8.4, hipY + 2);
  ctx.closePath();
  fillStroke(ctx, L.shirt, 1.6);
  if (L.dress) {
    // Skirt flaring to the knee.
    const sw = Math.sin(p.walkPhase) * (moving ? 1.5 : 0);
    ctx.beginPath();
    ctx.moveTo(-7.5, hipY - 1);
    ctx.lineTo(-11 + sw, hipY + 11);
    ctx.quadraticCurveTo(0.5, hipY + 14, 12 + sw, hipY + 11);
    ctx.lineTo(8.4, hipY - 1);
    ctx.closePath();
    fillStroke(ctx, L.shirt, 1.6);
    if (L.dress.pattern === 'floral' && L.dress.colors) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-7.5, shY);
      ctx.lineTo(7, shY);
      ctx.lineTo(12 + sw, hipY + 11);
      ctx.quadraticCurveTo(0.5, hipY + 14, -11 + sw, hipY + 11);
      ctx.closePath();
      ctx.clip();
      const spots: [number, number][] = [[-4, shY + 4], [3, shY + 9], [-2, shY + 14], [5, hipY - 2], [-7, hipY + 4], [1, hipY + 6], [8, hipY + 8], [-4, hipY + 10]];
      spots.forEach(([fx, fy], i) => {
        ctx.fillStyle = L.dress!.colors![i % L.dress!.colors!.length];
        ctx.beginPath();
        ctx.arc(fx, fy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    } else {
      // Chambray seams.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0.5, shY + 2);
      ctx.lineTo(0.5, hipY + 12);
      ctx.stroke();
    }
  }
  if (L.check) {
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = L.check;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let gx = -10; gx < 12; gx += 5) {
      ctx.moveTo(gx, shY);
      ctx.lineTo(gx, hipY + 3);
    }
    for (let gy = shY + 2; gy < hipY + 3; gy += 5) {
      ctx.moveTo(-10, gy);
      ctx.lineTo(10, gy);
    }
    ctx.stroke();
    ctx.restore();
  }
  if (L.vest) {
    ctx.beginPath();
    ctx.moveTo(-7.5, hipY + 1.5);
    ctx.quadraticCurveTo(-8.6, shY + 8, -5.5, shY + 0.5);
    ctx.lineTo(-1, shY + 0.5);
    ctx.lineTo(0.5, hipY + 1.5);
    ctx.closePath();
    ctx.fillStyle = L.vest;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4, shY + 0.5);
    ctx.lineTo(7, shY + 0.5);
    ctx.quadraticCurveTo(9.4, shY + 8, 8.2, hipY + 1.5);
    ctx.lineTo(5, hipY + 1.5);
    ctx.closePath();
    ctx.fill();
  }
  if (L.suspenders) {
    ctx.strokeStyle = L.suspenders;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-3, shY + 0.5);
    ctx.lineTo(-2, hipY + 2);
    ctx.moveTo(4.5, shY + 0.5);
    ctx.lineTo(5, hipY + 2);
    ctx.stroke();
  }
  if (!L.dress) {
    // Belt.
    ctx.fillStyle = shade(L.pants, 0.6);
    ctx.fillRect(-7.5, hipY, 16, 2.6);
  }
  if (L.necklace) {
    ctx.strokeStyle = '#c9ced4';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-2.5, shY);
    ctx.lineTo(1.5, shY + 5);
    ctx.lineTo(5, shY);
    ctx.stroke();
    ctx.fillStyle = '#e6e9ec';
    ctx.fillRect(1, shY + 5, 1.2, 4);
    ctx.fillRect(0, shY + 6, 3.2, 1.1);
  }
  if (L.bandana) {
    ctx.beginPath();
    ctx.moveTo(-4.5, shY);
    ctx.lineTo(6, shY);
    ctx.lineTo(2, shY + 5.5);
    ctx.closePath();
    fillStroke(ctx, L.bandana, 1);
  }

  // Head.
  ctx.fillStyle = L.skin;
  ctx.fillRect(hx - 2, hy + 6, 4.4, 4);
  ellipse(ctx, hx, hy, 8.3, 8.6);
  fillStroke(ctx, L.skin, 1.5);
  // Ear.
  ellipse(ctx, hx - 2.5, hy + 1, 1.8, 2.4);
  fillStroke(ctx, L.skin, 1);
  if (L.beard) {
    ctx.beginPath();
    ctx.moveTo(hx - 3.5, hy + 1);
    ctx.quadraticCurveTo(hx - 3, hy + 9.6, hx + 3.5, hy + 9.4);
    ctx.quadraticCurveTo(hx + 8.4, hy + 7.5, hx + 8.3, hy + 2.5);
    ctx.quadraticCurveTo(hx + 6, hy + 5, hx + 4, hy + 4.6);
    ctx.quadraticCurveTo(hx, hy + 5, hx - 0.5, hy + 1);
    ctx.closePath();
    ctx.fillStyle = L.beard;
    ctx.fill();
  }
  drawHair(ctx, L, hx, hy, p, false);
  // Face.
  const blink = Math.sin(p.clock * 1.7 + L.scale * 9) > 0.985;
  const happy = action === 'cheer' || action === 'wave';
  ctx.fillStyle = C.ink;
  ctx.strokeStyle = C.ink;
  if (blink || happy) {
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(hx + 4, hy + 0.3, 1.6, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  } else {
    ellipse(ctx, hx + 4.2, hy, 1.15, 1.55);
    ctx.fill();
  }
  if (L.glasses) {
    ctx.lineWidth = 1;
    ellipse(ctx, hx + 4.3, hy, 2.8, 2.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx + 1.5, hy - 0.5);
    ctx.lineTo(hx - 2, hy - 1);
    ctx.stroke();
  }
  ellipse(ctx, hx + 2.6, hy + 3.4, 1.9, 1.2);
  ctx.fillStyle = 'rgba(232,110,110,0.4)';
  ctx.fill();
  if (L.mustache) {
    ctx.beginPath();
    ctx.ellipse(hx + 5.6, hy + 3.6, 3.2, 1.5, -0.1, 0, Math.PI * 2);
    ctx.fillStyle = L.mustache;
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.stroke();
  } else {
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.arc(hx + 5, hy + 3.8, happy ? 2.4 : 1.9, 0.15, Math.PI * 0.8);
    if (happy) {
      ctx.fillStyle = '#8a2f3a';
      ctx.fill();
    }
    ctx.stroke();
  }
  drawHeadwear(ctx, p.hat ?? L.hat, L, hx, hy, p.clock);

  // Front arm and anything held.
  if (p.hold === 'axe') drawAxe(ctx, front.x, front.y, axeA);
  arm(ctx, sh.x + 2, sh.y, front.x, front.y, sleeve, L.skin);
  drawHeld(ctx, p.hold ?? null, front.x, front.y);
}

/** Axe held at the grip, handle continuing along the arm. */
export function drawAxe(ctx: Ctx, gx: number, gy: number, a: number): void {
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.roundRect(-6, -1.7, 34, 3.4, 1.7);
  fillStroke(ctx, '#b07a44', 1.2);
  ctx.beginPath();
  ctx.moveTo(24, -2);
  ctx.lineTo(23, -9);
  ctx.quadraticCurveTo(31, -10, 33, -7);
  ctx.lineTo(30, -2);
  ctx.closePath();
  ctx.moveTo(24, 2);
  ctx.lineTo(23, 9);
  ctx.quadraticCurveTo(31, 10, 33, 7);
  ctx.lineTo(30, 2);
  ctx.closePath();
  fillStroke(ctx, '#9aa5ad', 1.2);
  ctx.fillStyle = '#e8eef2';
  ctx.fillRect(31, -8, 1.6, 16);
  ctx.restore();
}

function drawHeld(ctx: Ctx, item: HeldItem, x: number, y: number): void {
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.3;
  if (item === 'basket') {
    ctx.beginPath();
    ctx.moveTo(x - 7, y + 1);
    ctx.lineTo(x + 7, y + 1);
    ctx.lineTo(x + 5, y + 9);
    ctx.lineTo(x - 5, y + 9);
    ctx.closePath();
    fillStroke(ctx, '#c9954f', 1.3);
    for (const ex of [-3.5, 0.5, 4]) {
      ellipse(ctx, x + ex, y, 2.2, 2.8);
      fillStroke(ctx, ex > 0 ? '#fffaf0' : '#e9c59a', 0.9);
    }
    ctx.beginPath();
    ctx.arc(x, y + 1, 6, Math.PI, 0);
    ctx.strokeStyle = '#8c5a35';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (item === 'pail') {
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 1);
    ctx.lineTo(x + 5, y + 1);
    ctx.lineTo(x + 4, y + 10);
    ctx.lineTo(x - 4, y + 10);
    ctx.closePath();
    fillStroke(ctx, '#aeb7bf', 1.3);
  } else if (item === 'carrot') {
    ctx.beginPath();
    ctx.moveTo(x + 1, y - 2);
    ctx.lineTo(x + 12, y + 1);
    ctx.lineTo(x + 1, y + 3);
    ctx.closePath();
    fillStroke(ctx, '#f08a24', 1.1);
    ctx.strokeStyle = '#5f9e3f';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4, y - 3);
    ctx.moveTo(x, y + 1);
    ctx.lineTo(x - 4, y + 3);
    ctx.stroke();
  } else if (item === 'ball') {
    ellipse(ctx, x + 2, y - 1, 3.4, 3.4);
    fillStroke(ctx, '#d9e64a', 1.1);
  }
}

export function drawPerson(ctx: Ctx, L: PersonLook, p: PersonPose): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (!p.ghost) {
    ellipse(ctx, 1, 0, 14 * L.scale, 4.5 * L.scale);
    ctx.fillStyle = C.shadow;
    ctx.fill();
  }
  ctx.scale(L.scale * (p.faceX < 0 ? -1 : 1), L.scale);
  ctx.lineJoin = 'round';
  drawPersonRight(ctx, L, p);
  ctx.restore();
}

/** Small canvas portrait for cards and lists. */
export function paintPortrait(canvas: HTMLCanvasElement, L: PersonLook, opts: { hat?: HatKind; wave?: boolean } = {}): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 64;
  const h = canvas.clientHeight || 64;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  // Frame the head and shoulders.
  const s = (h / 46) / L.scale;
  ctx.save();
  ctx.translate(w / 2 - 2 * s, h * 0.5 + 40 * s * L.scale);
  ctx.scale(s, s);
  drawPerson(ctx, L, { x: 0, y: 0, faceX: 1, speed01: 0, walkPhase: 0, clock: 0.3, action: opts.wave ? 'wave' : 'none', hat: opts.hat, ghost: true });
  ctx.restore();
}
