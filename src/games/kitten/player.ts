import { angleOf, clamp, damp } from '../../core/math';
import type { CollisionWorld } from '../../world/collision';
import type { InputState, Player } from './types';

export const PLAYER_RADIUS = 24;
export const PLAYER_SPEED = 250;

export function createPlayer(x: number, y: number): Player {
  return {
    x,
    y,
    px: x,
    py: y,
    vx: 0,
    vy: 0,
    radius: PLAYER_RADIUS,
    maxSpeed: PLAYER_SPEED,
    heading: 0,
    faceX: 1,
    walkPhase: 0,
    whistleT: 0,
    throwT: 0,
    cheerT: 0,
    idleT: 0,
    whistleCooldown: 0,
    mood: { kind: 'none', t: 0 },
  };
}

/** Steering for Natalie & Deputy: analog input with a little momentum so the tiger feels heavy but responsive. */
export function updatePlayer(p: Player, input: InputState, world: CollisionWorld, dt: number, locked = false): void {
  let ix = locked ? 0 : input.moveX;
  let iy = locked ? 0 : input.moveY;
  const mag = Math.hypot(ix, iy);
  if (mag > 1) {
    ix /= mag;
    iy /= mag;
  }
  const tx = ix * p.maxSpeed;
  const ty = iy * p.maxSpeed;
  // Accelerate briskly, brake a little faster than that so stopping near kittens is precise.
  const rate = p.accel ? (mag > 0.05 ? p.accel : p.accel * 1.3) : mag > 0.05 ? 9 : 12;
  p.vx = damp(p.vx, tx, rate, dt);
  p.vy = damp(p.vy, ty, rate, dt);
  if (Math.abs(p.vx) < 0.5 && mag < 0.05) p.vx = 0;
  if (Math.abs(p.vy) < 0.5 && mag < 0.05) p.vy = 0;

  const before = { x: p.x, y: p.y };
  const pos = { x: p.x + p.vx * dt, y: p.y + p.vy * dt };
  world.resolve(pos, p.radius);
  p.x = pos.x;
  p.y = pos.y;
  // Bleed velocity into walls so we don't keep "pushing" after a collision.
  if (dt > 0) {
    const actualVx = (p.x - before.x) / dt;
    const actualVy = (p.y - before.y) / dt;
    if (Math.abs(actualVx) < Math.abs(p.vx)) p.vx = actualVx;
    if (Math.abs(actualVy) < Math.abs(p.vy)) p.vy = actualVy;
  }

  const speed = Math.hypot(p.vx, p.vy);
  if (mag > 0.15) p.heading = angleOf({ x: ix, y: iy });
  if (ix > 0.2) p.faceX = 1;
  else if (ix < -0.2) p.faceX = -1;
  p.walkPhase += dt * (2 + clamp(speed / p.maxSpeed, 0, 1) * 9);
  p.idleT = speed < 8 ? p.idleT + dt : 0;

  p.whistleT = Math.max(0, p.whistleT - dt);
  p.throwT = Math.max(0, p.throwT - dt);
  p.cheerT = Math.max(0, p.cheerT - dt);
  p.whistleCooldown = Math.max(0, p.whistleCooldown - dt);
  if (p.mood.t > 0) {
    p.mood.t -= dt;
    if (p.mood.t <= 0) p.mood.kind = 'none';
  }
  if (p.idleT > 6 && p.mood.kind === 'none' && (p.idleT - 6) % 9 < dt) p.mood = { kind: 'yawn', t: 2.2 };
}
