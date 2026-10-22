import type { PersonLook } from '../content/cast';
import { C } from './palette';

type Ctx = CanvasRenderingContext2D;

export const MOWER_COLORS = {
  red: { body: '#d23c34', dark: '#8f2620', seat: '#2b2a30', trim: '#f2f2ee' },
  green: { body: '#3f8f3f', dark: '#285f28', seat: '#2b2a30', trim: '#f2c53d' },
  gold: { body: '#e8b53a', dark: '#a87a18', seat: '#3b2a20', trim: '#fff6d8' },
} as const;

export type MowerPaint = keyof typeof MOWER_COLORS;

/**
 * Riding mower seen from above, nose pointing along `heading` (radians, 0 = east). Vehicles
 * are drawn top-down (like the cars on Buffalo Gap Rd) so steering reads clearly.
 */
export function drawMower(
  ctx: Ctx,
  x: number,
  y: number,
  heading: number,
  paint: MowerPaint,
  driver: PersonLook | null,
  clock: number,
  blades: boolean,
  bounce = 0,
): void {
  const col = MOWER_COLORS[paint];
  ctx.save();
  ctx.translate(x, y);
  // Shadow (not rotated by the bounce).
  ctx.beginPath();
  ctx.ellipse(3, 6, 30, 22, heading, 0, Math.PI * 2);
  ctx.fillStyle = C.shadowDeep;
  ctx.fill();
  ctx.rotate(heading);
  ctx.translate(0, -bounce);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.8;
  // Wheels.
  ctx.fillStyle = '#26262b';
  for (const [wx, wy, w, h] of [
    [-20, -19, 14, 7],
    [-20, 12, 14, 7],
    [10, -16, 10, 6],
    [10, 10, 10, 6],
  ]) {
    ctx.beginPath();
    ctx.roundRect(wx, wy, w, h, 3);
    ctx.fill();
    ctx.stroke();
  }
  // Cutting deck under the middle, wider than the body.
  ctx.beginPath();
  ctx.roundRect(-4, -23, 18, 46, 6);
  ctx.fillStyle = '#5d636b';
  ctx.fill();
  ctx.stroke();
  if (blades) {
    ctx.save();
    ctx.translate(5, 0);
    ctx.rotate(clock * 40);
    ctx.strokeStyle = 'rgba(230,236,240,0.5)';
    ctx.lineWidth = 2;
    for (const oy of [-11, 11]) {
      ctx.beginPath();
      ctx.arc(0, oy, 7, 0, Math.PI * 1.2);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Body and hood.
  ctx.beginPath();
  ctx.moveTo(-22, -12);
  ctx.lineTo(16, -11);
  ctx.quadraticCurveTo(30, -10, 30, 0);
  ctx.quadraticCurveTo(30, 10, 16, 11);
  ctx.lineTo(-22, 12);
  ctx.quadraticCurveTo(-26, 0, -22, -12);
  ctx.closePath();
  ctx.fillStyle = col.body;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = col.dark;
  ctx.beginPath();
  ctx.roundRect(8, -7, 18, 14, 5);
  ctx.fill();
  ctx.fillStyle = col.trim;
  ctx.fillRect(13, -1.2, 12, 2.4);
  // Headlights.
  ctx.fillStyle = '#fff6c8';
  for (const oy of [-6, 6]) {
    ctx.beginPath();
    ctx.arc(28, oy, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // Seat.
  ctx.beginPath();
  ctx.roundRect(-20, -9, 13, 18, 5);
  ctx.fillStyle = col.seat;
  ctx.fill();
  ctx.stroke();
  // Steering wheel.
  ctx.strokeStyle = '#26262b';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(3, -6);
  ctx.lineTo(3, 6);
  ctx.stroke();
  if (driver) {
    // Driver from above: shoulders, arms to the wheel, head with cap.
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-12, 0, 6.5, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = driver.shirt;
    ctx.fill();
    ctx.stroke();
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-10, s * 8);
      ctx.lineTo(1, s * 6);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 4.6;
      ctx.stroke();
      ctx.strokeStyle = driver.shirt;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(2, s * 6, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = driver.skin;
      ctx.fill();
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = C.ink;
    ctx.beginPath();
    ctx.arc(-11, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = driver.hair;
    ctx.fill();
    ctx.stroke();
    if (driver.hat === 'capBack' || driver.hat === 'cap') {
      ctx.beginPath();
      ctx.arc(-11, 0, 5.4, 0, Math.PI * 2);
      ctx.fillStyle = driver.hatColor ?? '#d9434f';
      ctx.fill();
      ctx.stroke();
      const dir = driver.hat === 'cap' ? 1 : -1;
      ctx.beginPath();
      ctx.ellipse(-11 + dir * 6, 0, 3.5, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Natalie's e-scooter, side on, facing `faceX`. `front` draws only the stem and handlebars
 * (they go in front of the rider); otherwise the deck and wheels (behind her feet).
 */
export function drawScooter(ctx: Ctx, x: number, y: number, faceX: number, front: boolean, spin: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(faceX < 0 ? -1 : 1, 1);
  ctx.strokeStyle = C.ink;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (front) {
    // Stem up from the front wheel, T-bar handlebars with grips.
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(15, -4);
    ctx.lineTo(19, -40);
    ctx.stroke();
    ctx.strokeStyle = '#3fb6c9';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(15, -41);
    ctx.lineTo(23, -39);
    ctx.stroke();
    ctx.strokeStyle = '#2b2a30';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.ellipse(1, 2, 21, 3.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.shadow;
  ctx.fill();
  // Wheels.
  for (const wx of [-14, 15]) {
    ctx.beginPath();
    ctx.arc(wx, -3.6, 3.8, 0, Math.PI * 2);
    ctx.fillStyle = '#26262b';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = '#9aa5ad';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wx + Math.cos(spin) * 2.4, -3.6 + Math.sin(spin) * 2.4);
    ctx.lineTo(wx - Math.cos(spin) * 2.4, -3.6 - Math.sin(spin) * 2.4);
    ctx.stroke();
    ctx.strokeStyle = C.ink;
  }
  // Deck.
  ctx.beginPath();
  ctx.roundRect(-16, -8.4, 30, 3.6, 1.8);
  ctx.fillStyle = '#3fb6c9';
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.restore();
}

export const TRUCK_PAINT = {
  white: { body: '#f4f3ee', panel: '#d9d9d2', roof: '#ffffff' },
  charcoal: { body: '#3e4249', panel: '#2d3036', roof: '#4c5159' },
} as const;

export type TruckPaint = keyof typeof TRUCK_PAINT;

/** A pickup seen from above, nose along `heading`; `len` is bumper to bumper. */
export function drawPickup(ctx: Ctx, x: number, y: number, heading: number, paint: TruckPaint, len = 100): void {
  const col = TRUCK_PAINT[paint];
  const W = len * 0.44;
  const H = len / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.roundRect(-H + 4, -W / 2 + 5, len, W, 9);
  ctx.fillStyle = C.shadowDeep;
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.6;
  // Tyres peek out past the body.
  ctx.fillStyle = '#26262b';
  for (const wx of [-H * 0.62, H * 0.58])
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect(wx - 9, s * (W / 2) - 4, 18, 8, 3);
      ctx.fill();
      ctx.stroke();
    }
  // Body.
  ctx.beginPath();
  ctx.roundRect(-H, -W / 2, len, W, 9);
  ctx.fillStyle = col.body;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  // Bed with its liner, and the tailgate.
  const bedEnd = -H * 0.12;
  ctx.beginPath();
  ctx.roundRect(-H + 4, -W / 2 + 4, bedEnd + H - 6, W - 8, 4);
  ctx.fillStyle = '#2e2f33';
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 1; i < 4; i++) {
    const ly = -W / 2 + 4 + ((W - 8) * i) / 4;
    ctx.moveTo(-H + 7, ly);
    ctx.lineTo(bedEnd - 4, ly);
  }
  ctx.stroke();
  ctx.strokeStyle = C.ink;
  // Cab roof between the rear window and the windshield.
  const cabFront = H * 0.36;
  ctx.fillStyle = '#9fd3ea';
  ctx.beginPath();
  ctx.roundRect(bedEnd + 2, -W / 2 + 6, 6, W - 12, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cabFront - 2, -W / 2 + 6);
  ctx.lineTo(cabFront + 8, -W / 2 + 8);
  ctx.lineTo(cabFront + 8, W / 2 - 8);
  ctx.lineTo(cabFront - 2, W / 2 - 6);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(bedEnd + 9, -W / 2 + 5, cabFront - bedEnd - 12, W - 10, 5);
  ctx.fillStyle = col.roof;
  ctx.fill();
  ctx.stroke();
  // Hood seam and mirrors.
  ctx.strokeStyle = col.panel;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cabFront + 14, -W / 2 + 7);
  ctx.quadraticCurveTo(H - 4, 0, cabFront + 14, W / 2 - 7);
  ctx.stroke();
  ctx.strokeStyle = C.ink;
  ctx.fillStyle = col.body;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(cabFront - 6, s * (W / 2 + 2) - 3, 7, 6, 2);
    ctx.fill();
    ctx.stroke();
  }
  // Headlights.
  ctx.fillStyle = '#fff3c4';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(H - 5, s * (W / 2 - 7) - 3, 4, 6, 1);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Jason's motorcycle, side on, facing `faceX`. Riders (if any) are drawn between the two
 * passes: `front` adds the tank, bars and front fork over their legs.
 */
export function drawMotorcycle(ctx: Ctx, x: number, y: number, faceX: number, front: boolean, spin: number, lean = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(faceX < 0 ? -1 : 1, 1);
  ctx.rotate(lean);
  ctx.strokeStyle = C.ink;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (front) {
    // Tank, front fork and handlebars.
    ctx.beginPath();
    ctx.ellipse(6, -21, 10, 5.5, -0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#1f2a44';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(1, -23);
    ctx.lineTo(9, -24);
    ctx.stroke();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(22, -9);
    ctx.lineTo(16, -30);
    ctx.stroke();
    ctx.strokeStyle = '#c9ced4';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(16, -30);
    ctx.lineTo(12, -33);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.ellipse(0, 1, 30, 4.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.shadow;
  ctx.fill();
  // Wheels with spokes.
  for (const wx of [-20, 22]) {
    ctx.beginPath();
    ctx.arc(wx, -9, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#26262b';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(wx, -9, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#9aa5ad';
    ctx.fill();
    ctx.strokeStyle = '#5d636b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = spin + (i * Math.PI) / 3;
      ctx.moveTo(wx + Math.cos(a) * 5, -9 + Math.sin(a) * 5);
      ctx.lineTo(wx - Math.cos(a) * 5, -9 - Math.sin(a) * 5);
    }
    ctx.stroke();
    ctx.strokeStyle = C.ink;
  }
  // Frame, engine, exhaust and the long seat.
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-20, -9);
  ctx.lineTo(-6, -18);
  ctx.lineTo(16, -18);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-6, -16, 16, 10, 3);
  ctx.fillStyle = '#5d636b';
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-2, -6);
  ctx.lineTo(-26, -5);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = '#c9ced4';
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.strokeStyle = C.ink;
  ctx.beginPath();
  ctx.roundRect(-24, -24, 26, 6, 3);
  ctx.fillStyle = '#2b2a30';
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // Rear fender.
  ctx.beginPath();
  ctx.arc(-20, -9, 11, Math.PI * 1.1, Math.PI * 1.75);
  ctx.strokeStyle = '#1f2a44';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}
