import type { SpeciesId } from '../content/wildlife';
import { C } from './palette';

/**
 * The Big Country wildlife, hand-drawn in the same storybook style as everything else: ink
 * outlines, flat fills, side-on, facing right (flipped for left). Origin is the ground point.
 */
type Ctx = CanvasRenderingContext2D;

export interface WildPose {
  x: number;
  y: number;
  /** Height off the ground. */
  z: number;
  faceX: number;
  /** Moving fast (fleeing, sprinting). */
  run: boolean;
  /** Walking slowly. */
  walk: boolean;
  /** 0..1 progress of a one-off move (jump, sally, gobble, song, puff). */
  act: number;
  phase: number;
  clock: number;
  tint: number;
  /** Fade (leaving the scene). */
  alpha?: number;
}

function fs(ctx: Ctx, fill: string, lw = 1): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function shadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.16): void {
  ctx.beginPath();
  ctx.ellipse(x, y + 1, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.fill();
}

function eye(ctx: Ctx, x: number, y: number, r = 0.9): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = C.ink;
  ctx.fill();
}

export function drawWild(ctx: Ctx, sp: SpeciesId, p: WildPose): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (p.alpha !== undefined) ctx.globalAlpha = p.alpha;
  switch (sp) {
    case 'roadrunner':
      roadrunner(ctx, p);
      break;
    case 'armadillo':
      armadillo(ctx, p);
      break;
    case 'jackrabbit':
      jackrabbit(ctx, p);
      break;
    case 'hornedLizard':
      hornedLizard(ctx, p);
      break;
    case 'deer':
      deer(ctx, p);
      break;
    case 'turkey':
      turkey(ctx, p);
      break;
    case 'scissortail':
      scissortail(ctx, p);
      break;
    case 'mockingbird':
      mockingbird(ctx, p);
      break;
    case 'vulture':
      vulture(ctx, p);
      break;
    case 'monarch':
      monarch(ctx, p);
      break;
  }
  ctx.restore();
}

/** Brown-and-white streaks, a shaggy crest, a long tail held up when it stops. */
function roadrunner(ctx: Ctx, p: WildPose): void {
  shadow(ctx, p.x, p.y, 11, 2.4);
  ctx.translate(p.x, p.y);
  ctx.scale(p.faceX, 1);
  const legs = p.run || p.walk ? Math.sin(p.clock * 34) * 4 : 0;
  ctx.strokeStyle = '#6d6a60';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-0.5, -8);
  ctx.lineTo(-1 + legs, -3.5);
  ctx.lineTo(-0.5 + legs, 0);
  ctx.moveTo(1.5, -8);
  ctx.lineTo(1 - legs, -3.5);
  ctx.lineTo(2.5 - legs, 0);
  ctx.stroke();
  // Tail: long and tapering, held level while running, cocked up when it stops.
  const up = p.run ? 0.12 : 0.35 + p.act * 0.8;
  ctx.save();
  ctx.translate(-5, -11);
  ctx.rotate(up);
  ctx.beginPath();
  ctx.moveTo(1, -2.2);
  ctx.quadraticCurveTo(-8, -3.4, -16, -2.6);
  ctx.lineTo(-16.5, 0.8);
  ctx.quadraticCurveTo(-8, 1.6, 1, 2);
  ctx.closePath();
  fs(ctx, '#5a4a3a', 0.9);
  ctx.strokeStyle = '#fbf6ea';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-15.6, -2.2);
  ctx.lineTo(-15.9, 0.4);
  ctx.stroke();
  ctx.restore();
  // Body, leaning forward.
  ctx.beginPath();
  ctx.ellipse(0, -11, 7.5, 4, -0.2, 0, Math.PI * 2);
  fs(ctx, '#8a7458', 1);
  ctx.strokeStyle = '#4e3d2d';
  ctx.lineWidth = 0.8;
  for (const sx of [-4, -1, 2]) {
    ctx.beginPath();
    ctx.moveTo(sx, -13);
    ctx.lineTo(sx + 2, -10);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(1, -9.5, 4, 2, -0.2, 0, Math.PI);
  ctx.fillStyle = '#efe6d2';
  ctx.fill();
  // Head, crest and a long bill.
  ctx.beginPath();
  ctx.arc(7, -16, 3.2, 0, Math.PI * 2);
  fs(ctx, '#7e6a50', 1);
  ctx.beginPath();
  ctx.moveTo(4.5, -18);
  ctx.lineTo(4, -22.5);
  ctx.lineTo(6.5, -19);
  ctx.lineTo(7.5, -22);
  ctx.lineTo(8.5, -18.6);
  fs(ctx, '#4e3d2d', 0.8);
  ctx.beginPath();
  ctx.moveTo(9.6, -16.6);
  ctx.lineTo(15, -15.6);
  ctx.lineTo(9.8, -14.8);
  ctx.closePath();
  fs(ctx, '#3b3a36', 0.7);
  // The bare patch of blue and red behind the eye.
  ctx.fillStyle = '#5fa7d8';
  ctx.fillRect(5.4, -17.4, 1.6, 1.5);
  ctx.fillStyle = '#e0533f';
  ctx.fillRect(4.2, -17.2, 1.2, 1.3);
  eye(ctx, 8.2, -16.6, 0.8);
}

/** Grey-pink armour bands, a pointy snout down in the leaf litter. */
function armadillo(ctx: Ctx, p: WildPose): void {
  shadow(ctx, p.x, p.y, 10 - p.z * 0.15, 2.4);
  ctx.translate(p.x, p.y - p.z);
  ctx.scale(p.faceX, 1);
  const step = p.run || p.walk ? Math.sin(p.clock * (p.run ? 30 : 10)) * 1.6 : 0;
  ctx.fillStyle = '#8a7568';
  for (const lx of [-5, 4]) ctx.fillRect(lx + step, -3, 2.2, 3);
  for (const lx of [-3, 6]) ctx.fillRect(lx - step, -3, 2.2, 3);
  // Tail.
  ctx.beginPath();
  ctx.moveTo(-8, -5);
  ctx.quadraticCurveTo(-13, -4, -15, -1.5);
  ctx.lineTo(-14, -1);
  ctx.quadraticCurveTo(-12, -3, -8, -3);
  fs(ctx, '#9c8577', 0.8);
  // Shell.
  ctx.beginPath();
  ctx.moveTo(-9, -3);
  ctx.quadraticCurveTo(-9, -12, 0, -12);
  ctx.quadraticCurveTo(8, -12, 8.5, -3);
  ctx.closePath();
  fs(ctx, '#a89082', 1);
  ctx.strokeStyle = 'rgba(59,42,32,0.55)';
  ctx.lineWidth = 0.8;
  for (const bx of [-3.5, -1, 1.5, 4]) {
    ctx.beginPath();
    ctx.moveTo(bx, -11.6);
    ctx.lineTo(bx, -3.4);
    ctx.stroke();
  }
  // Head and snout, nose down (up in the air when it jumps).
  const nose = p.z > 2 ? -3 : Math.sin(p.clock * 6) * 0.8;
  ctx.beginPath();
  ctx.moveTo(7, -9);
  ctx.quadraticCurveTo(12, -7 + nose, 14, -3 + nose);
  ctx.lineTo(12.6, -2.6 + nose);
  ctx.quadraticCurveTo(10, -4, 7, -4);
  ctx.closePath();
  fs(ctx, '#b49c8d', 0.9);
  ctx.beginPath();
  ctx.ellipse(8, -10, 1, 2, -0.3, 0, Math.PI * 2);
  fs(ctx, '#b49c8d', 0.7);
  eye(ctx, 9.5, -7, 0.6);
}

/** Big hare, tall black-tipped ears, long back legs. */
function jackrabbit(ctx: Ctx, p: WildPose): void {
  const hop = p.run ? Math.abs(Math.sin(p.clock * 13)) * 9 : 0;
  shadow(ctx, p.x, p.y, 9, 2.4);
  ctx.translate(p.x, p.y - hop);
  ctx.scale(p.faceX, 1);
  ctx.strokeStyle = C.ink;
  const coat = '#b49870';
  ctx.beginPath();
  ctx.ellipse(-1, -7, p.run ? 10 : 8, p.run ? 4.5 : 6, p.run ? 0 : -0.15, 0, Math.PI * 2);
  fs(ctx, coat, 1);
  // Long hind foot.
  ctx.beginPath();
  ctx.ellipse(-4, -1.2, 5, 1.6, 0, 0, Math.PI * 2);
  fs(ctx, '#a68a64', 0.8);
  ctx.beginPath();
  ctx.arc(7, p.run ? -9 : -12, 3.8, 0, Math.PI * 2);
  fs(ctx, coat, 1);
  // Ears: huge, black at the tips; one flicks.
  const flick = p.act > 0 ? Math.sin(p.act * 20) * 0.25 : 0;
  for (const [ex, tilt] of [
    [5.5, -0.2 + flick],
    [8, 0.12],
  ] as const) {
    ctx.save();
    ctx.translate(ex, p.run ? -12 : -15);
    ctx.rotate(p.run ? 1.0 : tilt);
    ctx.beginPath();
    ctx.ellipse(0, -6.5, 1.8, 7, 0, 0, Math.PI * 2);
    fs(ctx, coat, 0.9);
    ctx.beginPath();
    ctx.ellipse(0, -12, 1.4, 1.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2b2622';
    ctx.fill();
    ctx.restore();
  }
  // Black-topped tail.
  ctx.beginPath();
  ctx.arc(-9, -8, 2.2, 0, Math.PI * 2);
  fs(ctx, '#2b2622', 0.8);
  eye(ctx, 8.6, p.run ? -9.8 : -12.8, 0.9);
}

/** A flat, spiky little lizard the colour of the red dirt. Puffs up when you're close. */
function hornedLizard(ctx: Ctx, p: WildPose): void {
  const puff = 1 + p.act * 0.5;
  shadow(ctx, p.x, p.y, 8 * puff, 2);
  ctx.translate(p.x, p.y);
  ctx.scale(p.faceX * 1.25, 1.25);
  // Tail.
  ctx.beginPath();
  ctx.moveTo(-5, -2);
  ctx.lineTo(-12, -1);
  ctx.lineTo(-5, -0.5);
  fs(ctx, '#c08a5a', 0.7);
  // Legs splayed.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-3, -1.5);
  ctx.lineTo(-5, 0.5);
  ctx.moveTo(3, -1.5);
  ctx.lineTo(5, 0.5);
  ctx.stroke();
  // Round flat body.
  ctx.beginPath();
  ctx.ellipse(0, -2.5, 6 * puff, 3 * puff, 0, 0, Math.PI * 2);
  fs(ctx, '#cf9a66', 0.9);
  ctx.fillStyle = '#8a5838';
  for (const [sx, sy] of [
    [-3, -3.5],
    [0, -4],
    [3, -3.2],
    [-1.5, -2],
    [1.6, -2.2],
  ])
    ctx.fillRect(sx * puff - 0.6, sy * puff - 0.6, 1.2, 1.2);
  // Head with its crown of horns.
  ctx.beginPath();
  ctx.ellipse(6.2 * puff, -3, 2.6, 2, 0, 0, Math.PI * 2);
  fs(ctx, '#d4a272', 0.9);
  ctx.beginPath();
  for (const hx of [4.2, 5.6, 7]) {
    ctx.moveTo(hx * puff, -4.4);
    ctx.lineTo(hx * puff - 1, -7);
    ctx.lineTo(hx * puff + 0.8, -4.6);
  }
  ctx.fillStyle = '#f2dcc0';
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 0.6;
  ctx.stroke();
  eye(ctx, 7 * puff, -3.4, 0.55);
}

/** A white-tail doe (or her spotted fawn). The tail goes up like a flag when she runs. */
function deer(ctx: Ctx, p: WildPose): void {
  const fawn = p.tint % 2 === 1;
  const s = fawn ? 0.66 : 1;
  const bound = p.run ? Math.abs(Math.sin(p.clock * 9 + p.tint)) * 14 : 0;
  shadow(ctx, p.x, p.y, 16 * s, 3.4 * s);
  ctx.translate(p.x, p.y - bound);
  ctx.scale(p.faceX * s, s);
  const coat = fawn ? '#b77a48' : '#a8794f';
  // Legs: tucked in a bound, stepping while grazing.
  ctx.strokeStyle = '#6d4c33';
  ctx.lineWidth = 2;
  const step = p.walk ? Math.sin(p.clock * 6) * 2 : 0;
  ctx.beginPath();
  if (p.run) {
    ctx.moveTo(-9, -18);
    ctx.lineTo(-16, -12);
    ctx.moveTo(9, -18);
    ctx.lineTo(16, -14);
  } else {
    for (const [lx, d] of [
      [-10, step],
      [-7, -step],
      [8, -step],
      [11, step],
    ] as const) {
      ctx.moveTo(lx, -18);
      ctx.lineTo(lx + d, 0);
    }
  }
  ctx.stroke();
  // Tail: the white flag.
  if (p.run) {
    ctx.beginPath();
    ctx.ellipse(-15, -28, 3, 6, -0.4, 0, Math.PI * 2);
    fs(ctx, '#fffaf0', 1);
  } else {
    ctx.beginPath();
    ctx.ellipse(-15, -22, 2.2, 3.4, 0.4, 0, Math.PI * 2);
    fs(ctx, '#8a6240', 0.9);
  }
  // Body.
  ctx.beginPath();
  ctx.ellipse(0, -22, 15, 7.5, 0, 0, Math.PI * 2);
  fs(ctx, coat, 1.2);
  ctx.beginPath();
  ctx.ellipse(1, -17.5, 10, 2.6, 0, 0, Math.PI);
  ctx.fillStyle = '#f3e6cf';
  ctx.fill();
  if (fawn) {
    ctx.fillStyle = '#fbf1de';
    for (const [sx, sy] of [
      [-8, -25],
      [-3, -26],
      [2, -25.5],
      [7, -24.5],
      [-5, -22],
      [4, -22],
    ])
      ctx.fillRect(sx - 0.9, sy - 0.9, 1.8, 1.8);
  }
  // Neck and head: down to graze, or up and alert.
  const graze = p.walk && !p.run && !fawn;
  ctx.save();
  ctx.translate(11, -25);
  ctx.rotate(graze ? 1.2 : p.run ? 0.25 : 0);
  // A thick neck up from the shoulders.
  ctx.beginPath();
  ctx.moveTo(-5, 3);
  ctx.quadraticCurveTo(-3, -6, 1, -11);
  ctx.lineTo(7, -9);
  ctx.quadraticCurveTo(5, -2, 5, 4);
  ctx.closePath();
  fs(ctx, coat, 1.1);
  // Ears behind the head.
  for (const [ex, rot] of [
    [0.5, -0.9],
    [3, -0.45],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(ex, -15.5, 1.9, 4.2, rot, 0, Math.PI * 2);
    fs(ctx, coat, 0.9);
  }
  // Head: a long muzzle, pale chin, dark nose.
  ctx.beginPath();
  ctx.moveTo(1, -15);
  ctx.quadraticCurveTo(5, -16.5, 13, -12.5);
  ctx.quadraticCurveTo(14.5, -10.5, 12, -9.5);
  ctx.quadraticCurveTo(6, -8.5, 1.5, -9.5);
  ctx.closePath();
  fs(ctx, coat, 1.1);
  ctx.beginPath();
  ctx.ellipse(8, -9.6, 3.5, 1.1, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = '#f3e6cf';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(13, -11.6, 1.2, 0, Math.PI * 2);
  ctx.fillStyle = C.ink;
  ctx.fill();
  eye(ctx, 5.6, -13.2, 0.95);
  ctx.restore();
}

/** Bronze body, bare blue-and-red head, a fan of a tail on the tom. */
function turkey(ctx: Ctx, p: WildPose): void {
  const tom = p.tint === 0;
  shadow(ctx, p.x, p.y, 10, 2.6);
  ctx.translate(p.x, p.y);
  ctx.scale(p.faceX, 1);
  const legs = p.run ? Math.sin(p.clock * 26) * 4 : p.walk ? Math.sin(p.clock * 7) * 2 : 0;
  ctx.strokeStyle = '#c55a4a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-1, -8);
  ctx.lineTo(-2 + legs, 0);
  ctx.moveTo(2, -8);
  ctx.lineTo(3 - legs, 0);
  ctx.stroke();
  // Tom's fan, when he's showing off (gobbling).
  if (tom && p.act > 0) {
    ctx.save();
    ctx.translate(-6, -16);
    for (let i = -3; i <= 3; i++) {
      ctx.save();
      ctx.rotate(-Math.PI / 2 + i * 0.32 - 0.5);
      ctx.beginPath();
      ctx.ellipse(0, -8, 2.4, 8, 0, 0, Math.PI * 2);
      fs(ctx, i % 2 ? '#7a5634' : '#8e6a43', 0.8);
      ctx.fillStyle = '#e9d5ae';
      ctx.fillRect(-2.2, -16, 4.4, 1.6);
      ctx.restore();
    }
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.moveTo(-6, -14);
    ctx.lineTo(-13, -16);
    ctx.lineTo(-12, -10);
    ctx.closePath();
    fs(ctx, '#6e4e30', 0.9);
  }
  // Body.
  ctx.beginPath();
  ctx.ellipse(0, -13, 8.5, 6.5, -0.1, 0, Math.PI * 2);
  fs(ctx, tom ? '#5d4a34' : '#7a6248', 1.1);
  ctx.strokeStyle = tom ? 'rgba(140,190,130,0.55)' : 'rgba(250,240,220,0.4)';
  ctx.lineWidth = 0.8;
  for (const ry of [-16, -13, -10]) {
    ctx.beginPath();
    ctx.moveTo(-6, ry);
    ctx.quadraticCurveTo(0, ry + 1.5, 5, ry);
    ctx.stroke();
  }
  // Neck and bare head, pecking while it feeds.
  const peck = p.walk && !p.run && Math.sin(p.clock * 4 + p.phase * 3) > 0.6 ? 6 : 0;
  ctx.strokeStyle = tom ? '#c94a3e' : '#a7b2c8';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(5, -16);
  ctx.quadraticCurveTo(8, -20 + peck, 8.5, -23 + peck * 1.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(9, -24 + peck * 1.6, 2.6, 0, Math.PI * 2);
  fs(ctx, tom ? '#a7c4e0' : '#b8c3d6', 0.9);
  ctx.beginPath();
  ctx.moveTo(11.2, -24.6 + peck * 1.6);
  ctx.lineTo(13.6, -23.6 + peck * 1.6);
  ctx.lineTo(11.2, -23 + peck * 1.6);
  ctx.fillStyle = '#d9c38a';
  ctx.fill();
  if (tom) {
    // The red wattle.
    ctx.beginPath();
    ctx.ellipse(10.4, -21 + peck * 1.6, 1.4, 2.6, 0, 0, Math.PI * 2);
    fs(ctx, '#d6453a', 0.7);
  }
  eye(ctx, 9.6, -24.6 + peck * 1.6, 0.7);
}

/** Pale grey, salmon-pink sides, and a tail like an open pair of scissors. */
function scissortail(ctx: Ctx, p: WildPose): void {
  shadow(ctx, p.x, p.y, 4, 1.4, 0.12);
  ctx.translate(p.x, p.y - p.z);
  ctx.scale(p.faceX, 1);
  const flying = p.act > 0;
  const open = flying ? 0.5 + Math.sin(p.clock * 12) * 0.15 : 0.12;
  ctx.strokeStyle = C.ink;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(-3.5, -3);
    ctx.rotate(Math.PI + s * open + (flying ? 0 : -0.5));
    ctx.beginPath();
    ctx.moveTo(0, -0.7);
    ctx.lineTo(16, s * 0.4 - 0.5);
    ctx.lineTo(16, s * 0.4 + 0.7);
    ctx.lineTo(0, 0.8);
    fs(ctx, '#2f2e33', 0.6);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.ellipse(0, -4, 4.4, 3, flying ? 0 : -0.35, 0, Math.PI * 2);
  fs(ctx, '#d9dbd8', 0.9);
  ctx.beginPath();
  ctx.ellipse(0.5, -2.6, 2.8, 1.3, -0.2, 0, Math.PI);
  ctx.fillStyle = '#f0a08e';
  ctx.fill();
  ctx.beginPath();
  if (flying) {
    const w = Math.sin(p.clock * 32) * 5;
    ctx.moveTo(-1, -5);
    ctx.lineTo(-4, -10 - w);
    ctx.lineTo(2, -6);
    ctx.closePath();
  } else ctx.ellipse(-1.4, -4.4, 2.6, 1.5, -0.3, 0, Math.PI * 2);
  fs(ctx, '#3d3c42', 0.7);
  ctx.beginPath();
  ctx.arc(3.8, -6.2, 2.1, 0, Math.PI * 2);
  fs(ctx, '#e2e3e0', 0.9);
  ctx.beginPath();
  ctx.moveTo(5.6, -6.4);
  ctx.lineTo(7.6, -6);
  ctx.lineTo(5.6, -5.6);
  ctx.fillStyle = C.ink;
  ctx.fill();
  eye(ctx, 4.4, -6.6, 0.6);
}

/** Grey with flashing white wing bars; sings with its head thrown back. */
function mockingbird(ctx: Ctx, p: WildPose): void {
  ctx.translate(p.x, p.y - p.z);
  ctx.scale(p.faceX, 1);
  const sing = p.act > 0;
  // Tail.
  ctx.beginPath();
  ctx.moveTo(-3, -3);
  ctx.lineTo(-11, sing ? -8 : -1);
  ctx.lineTo(-10, sing ? -5.5 : 1);
  ctx.lineTo(-2, -1);
  fs(ctx, '#55575b', 0.8);
  ctx.beginPath();
  ctx.ellipse(0, -4, 4.6, 3.4, -0.25, 0, Math.PI * 2);
  fs(ctx, '#9da0a4', 0.9);
  ctx.beginPath();
  ctx.ellipse(0.8, -2.6, 3, 1.6, -0.2, 0, Math.PI);
  ctx.fillStyle = '#e8e8e3';
  ctx.fill();
  // Wings: flashed open now and then to show the white bars.
  const flash = sing && Math.sin(p.clock * 10) > 0.3;
  ctx.beginPath();
  if (flash) {
    ctx.moveTo(-1, -5);
    ctx.lineTo(-6, -12);
    ctx.lineTo(2, -6);
    ctx.closePath();
  } else ctx.ellipse(-1.4, -4.4, 3, 1.7, -0.3, 0, Math.PI * 2);
  fs(ctx, '#4a4c50', 0.7);
  ctx.fillStyle = '#ffffff';
  if (flash) ctx.fillRect(-4.5, -10, 2.4, 2.4);
  else ctx.fillRect(-2.4, -5, 2.2, 1.2);
  // Head, tipped back to sing.
  const hy = sing ? -8 : -7;
  ctx.beginPath();
  ctx.arc(3.6, hy, 2.3, 0, Math.PI * 2);
  fs(ctx, '#a3a6aa', 0.9);
  ctx.beginPath();
  if (sing) {
    ctx.moveTo(5.2, hy - 1.2);
    ctx.lineTo(7.6, hy - 3);
    ctx.lineTo(5.8, hy - 0.4);
    ctx.lineTo(7.6, hy + 0.4);
    ctx.lineTo(5.4, hy + 0.2);
  } else {
    ctx.moveTo(5.6, hy - 0.4);
    ctx.lineTo(8, hy);
    ctx.lineTo(5.6, hy + 0.5);
  }
  ctx.fillStyle = C.ink;
  ctx.fill();
  eye(ctx, 4.2, hy - 0.5, 0.6);
}

/** Way up: a dark V of wings with pale flight feathers and a small red head. */
function vulture(ctx: Ctx, p: WildPose): void {
  const tilt = Math.sin(p.clock * 0.9 + p.tint) * 0.12;
  ctx.translate(p.x, p.y);
  ctx.rotate(tilt);
  ctx.scale(p.faceX, 1);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(s * 10, -6, s * 25, -3);
    ctx.lineTo(s * 23, 1);
    ctx.quadraticCurveTo(s * 12, 1, 0, 3);
    ctx.closePath();
    fs(ctx, '#2e2a28', 0.9);
    ctx.beginPath();
    ctx.moveTo(s * 4, 2.2);
    ctx.quadraticCurveTo(s * 13, 0.8, s * 23, 1);
    ctx.strokeStyle = '#b9b2a8';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(0, 1, 2.6, 5, 0, 0, Math.PI * 2);
  fs(ctx, '#2e2a28', 0.8);
  ctx.beginPath();
  ctx.arc(0, -4.6, 1.8, 0, Math.PI * 2);
  fs(ctx, '#c8463c', 0.7);
}

/** Orange wings veined in black, white dots round the edges. */
function monarch(ctx: Ctx, p: WildPose): void {
  const flap = Math.abs(Math.sin(p.clock * 9 + p.tint * 2));
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 1, 3.5, 1.1, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fill();
  ctx.translate(p.x, p.y - p.z);
  ctx.scale(1.9, 1.9);
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.scale(s * (0.25 + flap * 0.75), 1);
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.quadraticCurveTo(4.5, -6, 5.5, -2.5);
    ctx.quadraticCurveTo(5, 0, 0, 0);
    ctx.quadraticCurveTo(4, 1, 3.6, 3.4);
    ctx.quadraticCurveTo(1, 3.2, 0, 0.6);
    fs(ctx, '#ee8a1c', 0.8);
    ctx.strokeStyle = '#2b1d14';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0.5, -0.5);
    ctx.lineTo(4.5, -3);
    ctx.moveTo(0.5, 0.3);
    ctx.lineTo(3, 2.4);
    ctx.stroke();
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(4.6, -3.4, 0.7, 0.7);
    ctx.fillRect(3.4, 2.6, 0.6, 0.6);
    ctx.restore();
  }
  ctx.fillStyle = C.ink;
  ctx.fillRect(-0.45, -2.4, 0.9, 4.6);
}

/** A soft vulture-shaped shadow sliding over the ground far below. */
export function drawVultureShadow(ctx: Ctx, x: number, y: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(20,16,10,0.12)';
  ctx.beginPath();
  ctx.ellipse(x, y, 22, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A field-guide portrait of one species, centred in a small canvas. */
export function paintSpecies(canvas: HTMLCanvasElement, sp: SpeciesId, known: boolean): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = 96;
  const h = 72;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const g = canvas.getContext('2d')!;
  g.scale(dpr, dpr);
  g.clearRect(0, 0, w, h);
  const zoom: Record<SpeciesId, [number, number]> = {
    roadrunner: [2.2, 62],
    armadillo: [2.6, 56],
    jackrabbit: [2.1, 62],
    hornedLizard: [2.8, 50],
    deer: [1.35, 66],
    turkey: [1.9, 62],
    scissortail: [1.9, 46],
    mockingbird: [2.8, 54],
    vulture: [1.6, 40],
    monarch: [3, 46],
  };
  const [s, gy] = zoom[sp];
  g.translate(w / 2, gy);
  g.scale(s, s);
  drawWild(g, sp, { x: 0, y: 0, z: 0, faceX: 1, run: false, walk: false, act: sp === 'turkey' ? 1 : 0, phase: 0, clock: 0.4, tint: 0 });
  if (!known) {
    // Not seen yet: just its outline, as a shadow to look out for.
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = 'rgba(59,42,32,0.3)';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.globalCompositeOperation = 'source-over';
  }
}
