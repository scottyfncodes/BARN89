import { PIECES, type Restored } from '../content/blueStar';
import { DOGS, FAMILY, type FamilyId, type HatKind } from '../content/cast';
import type { PageId } from '../content/scrapbook';
import type { SaveData } from '../core/save';
import { COATS } from '../games/kitten/levels';
import { drawPorchTree, drawSkunk, drawStinkLines, drawHuntItem } from '../hub/hubView';
import { HUNT_ITEMS, ORNAMENTS } from '../hub/missions';
import { drawChicken, drawDog } from '../render/animals';
import { drawKittenFigure } from '../render/characters';
import { drawPiece } from '../render/furniture';
import { C } from '../render/palette';
import { drawPerson, type HeldItem, type PersonAction } from '../render/people';
import { drawPorchFlag, drawProp, drawPumpkin, wallStar } from '../render/sprites';
import { drawRide } from '../render/vehicles';
import type { PropDef } from '../world/mapTypes';

type Ctx = CanvasRenderingContext2D;

/** Every photo is composed in this many scene units; the canvas scales it to fit. */
const W = 240;
const H = 160;
const GROUND = 112;
/** Photos are a still moment: everything is drawn at one instant. */
const T = 1.2;

/** Paints one scrapbook photo into `canvas` (sized by CSS), from what the save remembers. */
export function paintPage(canvas: HTMLCanvasElement, id: PageId, s: SaveData): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = canvas.clientWidth || 280;
  const ch = Math.round((cw * H) / W);
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform((dpr * cw) / W, 0, 0, (dpr * cw) / W, 0, 0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  SCENES[id](ctx, s);
}

/* ------------------------------------------------------------------------------------------ */
/* Pieces of a photo                                                                           */
/* ------------------------------------------------------------------------------------------ */

function sky(ctx: Ctx, top: string, bottom: string): void {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, GROUND);
}

/** A soft line of trees on the horizon. */
function treeLine(ctx: Ctx, col: string, y = GROUND - 14): void {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  for (let x = -10; x <= W + 10; x += 18) ctx.arc(x, y + Math.sin(x * 0.7) * 3, 12 + Math.cos(x * 1.3) * 3, Math.PI, 0);
  ctx.lineTo(W, GROUND);
  ctx.closePath();
  ctx.fill();
}

function grass(ctx: Ctx, col: string, tuft: string): void {
  ctx.fillStyle = col;
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.strokeStyle = tuft;
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const x = (i * 53) % W;
    const y = GROUND + 6 + ((i * 29) % (H - GROUND - 10));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 1.5, y - 4);
    ctx.moveTo(x + 2, y);
    ctx.lineTo(x + 3, y - 4.5);
    ctx.stroke();
  }
}

function day(ctx: Ctx): void {
  sky(ctx, '#a9d6ee', '#e8f2df');
  treeLine(ctx, '#6f9f4f');
  grass(ctx, '#8cc35a', 'rgba(60,110,40,0.45)');
}

function dusk(ctx: Ctx, snow = false): void {
  sky(ctx, '#3c4777', '#d99a72');
  treeLine(ctx, '#2f4a35');
  grass(ctx, snow ? '#e9eef2' : '#4f7a3a', snow ? 'rgba(150,170,190,0.6)' : 'rgba(20,50,20,0.5)');
}

function flakes(ctx: Ctx): void {
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.arc((i * 61) % W, (i * 37) % (H - 6), 0.8 + (i % 3) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function glow(ctx: Ctx, x: number, y: number, r: number, col: string): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col);
  g.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

interface Pose {
  faceX?: number;
  action?: PersonAction;
  hold?: HeldItem;
  hat?: HatKind;
  axe?: number;
  tool?: number;
}

/** Waves and cheers move; the photo catches the moment the arms are furthest up and out. */
const POSE_CLOCK: Partial<Record<PersonAction, number>> = { wave: 1.178, cheer: 1.01 };

function person(ctx: Ctx, who: FamilyId, x: number, y: number, p: Pose = {}): void {
  ctx.save();
  drawPerson(ctx, FAMILY[who].look, { x, y, faceX: p.faceX ?? 1, speed01: 0, walkPhase: 0, clock: POSE_CLOCK[p.action ?? 'none'] ?? T, action: p.action ?? 'none', actionT: 0.5, hold: p.hold ?? null, hat: p.hat, axe: p.axe, tool: p.tool });
  ctx.restore();
}

function dog(ctx: Ctx, id: 'annie' | 'axle', x: number, y: number, faceX: number, pose: 'sit' | 'stand' | 'lie' = 'sit'): void {
  ctx.save();
  drawDog(ctx, DOGS.find((d) => d.id === id)!, { x, y, faceX, pose, phase: 0, clock: T, wag: 0.6 });
  ctx.restore();
}

function cat(ctx: Ctx, coat: keyof typeof COATS, x: number, y: number, faceX = 1, happy = true): void {
  ctx.save();
  drawKittenFigure(ctx, { x, y, faceX, coat: COATS[coat], pose: 'sit', phase: 0, speed: 0, alarm: 0, happy, clock: T });
  ctx.restore();
}

function prop(ctx: Ctx, p: PropDef): void {
  ctx.save();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  drawProp(ctx, p, T);
  ctx.restore();
}

/** The front of Barn 89: red boards, white trim, the old sign over the doors. */
function barnFront(ctx: Ctx, cx: number, base: number, w: number, lights = false): void {
  const h = w * 0.62;
  const roof = w * 0.34;
  ctx.save();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.fillStyle = C.barnRed;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, base);
  ctx.lineTo(cx - w / 2, base - h);
  ctx.lineTo(cx, base - h - roof);
  ctx.lineTo(cx + w / 2, base - h);
  ctx.lineTo(cx + w / 2, base);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Boards.
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  for (let x = cx - w / 2 + 8; x < cx + w / 2; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, base - h - roof * (1 - Math.abs(x - cx) / (w / 2)));
    ctx.stroke();
  }
  // Doors.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.6;
  ctx.fillStyle = '#7e2a22';
  ctx.fillRect(cx - w * 0.2, base - h * 0.62, w * 0.4, h * 0.62);
  ctx.strokeRect(cx - w * 0.2, base - h * 0.62, w * 0.4, h * 0.62);
  ctx.strokeStyle = '#fff6e2';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const sx of [-1, 1]) {
    const x0 = cx + sx * w * 0.2;
    ctx.moveTo(x0, base - h * 0.62);
    ctx.lineTo(cx, base);
    ctx.moveTo(x0, base);
    ctx.lineTo(cx, base - h * 0.62);
  }
  ctx.stroke();
  // Sign.
  ctx.fillStyle = '#fff6e2';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.4;
  ctx.fillRect(cx - w * 0.22, base - h * 0.9, w * 0.44, h * 0.18);
  ctx.strokeRect(cx - w * 0.22, base - h * 0.9, w * 0.44, h * 0.18);
  ctx.fillStyle = C.barnRed;
  ctx.font = `700 ${(h * 0.13).toFixed(1)}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BARN 89', cx, base - h * 0.81);
  if (lights) {
    const cols = ['#e2483c', '#3fae5a', '#f2c53d', '#3d7fd6'];
    for (let i = 0; i <= 12; i++) {
      const f = i / 12;
      const x = cx - w / 2 + f * w;
      const y = base - h - roof * (1 - Math.abs(f - 0.5) * 2) + 3;
      glow(ctx, x, y, 6, 'rgba(255,220,150,0.5)');
      ctx.fillStyle = cols[i % 4];
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A sagging string of warm bulbs between two posts. */
function stringLights(ctx: Ctx, x0: number, x1: number, y: number, sag: number, lit: boolean): void {
  ctx.save();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.quadraticCurveTo((x0 + x1) / 2, y + sag * 2, x1, y);
  ctx.stroke();
  for (let i = 1; i < 12; i++) {
    const f = i / 12;
    const x = x0 + (x1 - x0) * f;
    const yy = y + sag * 4 * f * (1 - f);
    if (lit) glow(ctx, x, yy + 2, 7, 'rgba(255,214,140,0.55)');
    ctx.fillStyle = lit ? '#ffe6a8' : '#f4eedf';
    ctx.beginPath();
    ctx.arc(x, yy + 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------------------------------ */
/* The photos                                                                                  */
/* ------------------------------------------------------------------------------------------ */

const SCENES: Record<PageId, (ctx: Ctx, s: SaveData) => void> = {
  home(ctx) {
    day(ctx);
    barnFront(ctx, W / 2, GROUND + 2, 128);
    const crew: [FamilyId, number, Pose][] = [
      ['grandpa', 62, { action: 'wave' }],
      ['megan', 93, {}],
      ['jason', 124, { faceX: -1 }],
      ['jay', 154, { faceX: -1 }],
      ['natalie', 184, { faceX: -1, action: 'wave' }],
    ];
    for (const [who, x, p] of crew) person(ctx, who, x, GROUND + 26, p);
    dog(ctx, 'annie', 28, GROUND + 38, 1);
    dog(ctx, 'axle', 214, GROUND + 38, -1);
  },

  kitten(ctx) {
    day(ctx);
    // The corral rails behind.
    ctx.strokeStyle = C.woodDark;
    ctx.lineWidth = 3;
    for (const y of [GROUND - 6, GROUND + 4]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.fillStyle = C.wood;
    for (let x = 12; x < W; x += 44) ctx.fillRect(x - 2.5, GROUND - 14, 5, 26);
    person(ctx, 'natalie', W / 2, GROUND + 30, { action: 'cheer' });
    const ring: [keyof typeof COATS, number, number, number][] = [
      ['orangeTabby', 40, 128, 1],
      ['calico', 66, 146, 1],
      ['marshmallow', 92, 134, 1],
      ['tuxedo', 150, 136, -1],
      ['siamese', 176, 148, -1],
      ['greyTabby', 202, 130, -1],
    ];
    for (const [coat, x, y, f] of ring) cat(ctx, coat, x, y, f);
  },

  mower(ctx) {
    sky(ctx, '#a9d6ee', '#e8f2df');
    treeLine(ctx, '#6f9f4f');
    ctx.fillStyle = '#8cc35a';
    ctx.fillRect(0, GROUND, W, H - GROUND);
    // Fresh stripes, light and dark, running away from the camera.
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 ? '#8cc35a' : '#a3d46e';
      ctx.beginPath();
      const x0 = -120 + i * 30;
      ctx.moveTo(x0, H);
      ctx.lineTo(x0 + 30, H);
      ctx.lineTo(W / 2 + (x0 + 30 - W / 2) * 0.35, GROUND);
      ctx.lineTo(W / 2 + (x0 - W / 2) * 0.35, GROUND);
      ctx.closePath();
      ctx.fill();
    }
    person(ctx, 'jay', 150, GROUND + 34, { action: 'cheer', faceX: -1 });
    dog(ctx, 'axle', 92, GROUND + 38, 1);
  },

  woodpile(ctx) {
    day(ctx);
    prop(ctx, { kind: 'woodpile', x: 78, y: GROUND + 18, w: 120 });
    prop(ctx, { kind: 'chopBlock', x: 168, y: GROUND + 36 });
    person(ctx, 'jason', 190, GROUND + 34, { faceX: -1, hold: 'axe', axe: -2.2 });
  },

  rounds(ctx) {
    day(ctx);
    person(ctx, 'megan', 120, GROUND + 30, { hold: 'basket', faceX: -1 });
    drawChicken(ctx, 60, GROUND + 30, 1, true, true);
    drawChicken(ctx, 84, GROUND + 42, 1, false, false);
    drawChicken(ctx, 168, GROUND + 36, -1, true, true);
    drawChicken(ctx, 196, GROUND + 26, -1, false, true);
  },

  hunt(ctx) {
    day(ctx);
    person(ctx, 'grandpa', 104, GROUND + 32, { action: 'cheer' });
    // Everything he lost, laid out on the grass.
    HUNT_ITEMS.forEach((it, i) => {
      ctx.save();
      drawHuntItem(ctx, it.id, 140 + (i % 3) * 26, GROUND + 18 + Math.floor(i / 3) * 22, T);
      ctx.restore();
    });
    dog(ctx, 'axle', 50, GROUND + 38, 1);
  },

  putt(ctx) {
    day(ctx);
    prop(ctx, { kind: 'puttingGreen', x: 130, y: GROUND + 24, w: 86 });
    person(ctx, 'grandpa', 92, GROUND + 32, { hold: 'putter', tool: 0.7 });
  },

  puzzle(ctx) {
    day(ctx);
    barnFront(ctx, 70, GROUND + 2, 110);
    prop(ctx, { kind: 'squareBale', x: 152, y: GROUND + 30, w: 52, h: 26 });
    prop(ctx, { kind: 'squareBale', x: 206, y: GROUND + 30, w: 52, h: 26 });
    prop(ctx, { kind: 'roundBale', x: 180, y: GROUND + 4, w: 20 });
    person(ctx, 'jason', 104, GROUND + 34, { action: 'point' });
  },

  race(ctx) {
    day(ctx);
    // Checkered finish line across the path.
    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, GROUND + 18, W, 22);
    for (let x = 0; x < W; x += 6) {
      for (let r = 0; r < 2; r++) {
        ctx.fillStyle = (x / 6 + r) % 2 ? '#fff8e9' : C.ink;
        ctx.fillRect(x, GROUND + 26 + r * 4, 6, 4);
      }
    }
    // Rides draw in two layers (behind and in front of whoever's on them); both, parked.
    for (const front of [false, true]) {
      ctx.save();
      drawRide(ctx, 'scooter', 44, GROUND + 22, 1, front, 0);
      drawRide(ctx, 'truck', 196, GROUND + 22, -1, front, 0);
      ctx.restore();
    }
    person(ctx, 'natalie', 108, GROUND + 40, { faceX: 1 });
    person(ctx, 'jay', 132, GROUND + 40, { faceX: -1 });
  },

  workshop(ctx, s) {
    sky(ctx, '#a9d6ee', '#e8f2df');
    // The shop wall with Apple's blue star.
    ctx.fillStyle = '#efe4c8';
    ctx.fillRect(0, 0, W, GROUND + 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    for (let y = 8; y < GROUND; y += 9) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    wallStar(ctx, 196, 40, 20, '#2f63c0');
    grass(ctx, '#8cc35a', 'rgba(60,110,40,0.45)');
    const [id, look] = (Object.entries(s.restored)[0] ?? ['cabinet', { parts: PIECES[0].parts.map(() => '#9db58c'), star: null }]) as [string, Restored];
    const def = PIECES.find((p) => p.id === id) ?? PIECES[0];
    ctx.save();
    drawPiece(ctx, def, look, 110, GROUND + 34, 0.62);
    ctx.restore();
    person(ctx, 'grandpa', 176, GROUND + 34, { action: 'wave', faceX: -1 });
  },

  ornaments(ctx) {
    dusk(ctx);
    ctx.save();
    ctx.translate(W / 2, GROUND + 34);
    ctx.scale(2.1, 2.1);
    // The page is for finding them all: every ornament is on it.
    drawPorchTree(ctx, 0, 0, new Set(ORNAMENTS.map((o) => o.id)), T);
    ctx.restore();
    person(ctx, 'grandpa', 182, GROUND + 34, { faceX: -1, action: 'point' });
  },

  cats(ctx) {
    day(ctx);
    const all = Object.keys(COATS) as (keyof typeof COATS)[];
    all.forEach((coat, i) => cat(ctx, coat, 26 + i * 27, GROUND + 26 + (i % 2) * 14, i < 4 ? 1 : -1));
  },

  skunk(ctx) {
    day(ctx);
    dog(ctx, 'annie', 86, GROUND + 36, 1, 'stand');
    ctx.save();
    drawStinkLines(ctx, 86, GROUND + 2, T, 1);
    drawSkunk(ctx, 176, GROUND + 30, 1, 0.3, true, 1);
    ctx.restore();
    dog(ctx, 'axle', 34, GROUND + 40, 1);
  },

  sunday(ctx) {
    dusk(ctx);
    for (const x of [14, 226]) {
      ctx.fillStyle = C.woodDark;
      ctx.fillRect(x - 2, 30, 4, GROUND + 10 - 30);
    }
    stringLights(ctx, 14, 226, 32, 10, true);
    const at: [FamilyId, number][] = [['grandpa', 50], ['megan', 86], ['jason', 122], ['jay', 158], ['natalie', 192]];
    for (const [who, x] of at) person(ctx, who, x, GROUND + 18, { faceX: x < W / 2 ? 1 : -1 });
    prop(ctx, { kind: 'longTable', x: W / 2, y: GROUND + 36, w: 190 });
  },

  christmas(ctx, s) {
    dusk(ctx, true);
    barnFront(ctx, 72, GROUND + 2, 112, true);
    ctx.save();
    ctx.translate(176, GROUND + 30);
    ctx.scale(1.6, 1.6);
    drawPorchTree(ctx, 0, 0, new Set(s.ornaments), T);
    ctx.restore();
    person(ctx, 'natalie', 132, GROUND + 38, { hat: 'santa', action: 'wave' });
    flakes(ctx);
  },

  october(ctx) {
    day(ctx);
    prop(ctx, { kind: 'farmStand', x: 96, y: GROUND + 24 });
    for (const [x, y, k] of [[132, GROUND + 30, 2.1], [156, GROUND + 36, 1.6], [62, GROUND + 34, 1.8], [146, GROUND + 18, 1.2]] as const) drawPumpkin(ctx, x, y, k);
    person(ctx, 'megan', 192, GROUND + 34, { faceX: -1, action: 'wave' });
  },

  july(ctx) {
    day(ctx);
    // A porch post to hang the flag from.
    ctx.fillStyle = '#fff6e2';
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.6;
    ctx.fillRect(56, 26, 7, GROUND + 12 - 26);
    ctx.strokeRect(56, 26, 7, GROUND + 12 - 26);
    ctx.save();
    drawPorchFlag(ctx, 60, GROUND - 22, T, 2.4);
    ctx.restore();
    person(ctx, 'grandpa', 168, GROUND + 34, { action: 'wave', faceX: -1 });
    dog(ctx, 'axle', 200, GROUND + 40, -1);
  },
};
