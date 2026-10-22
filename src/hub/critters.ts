import { dist, Rng, type Vec } from '../core/math';

/**
 * Small wildlife that makes the place feel lived in: sparrows pecking on the ground that take off
 * when you come close, cottontails that bolt for the trees, and butterflies over the flower beds.
 * None of it is collectible; it's just there, and it reacts to you.
 */
export type CritterKind = 'bird' | 'rabbit' | 'butterfly';

export interface Critter {
  kind: CritterKind;
  /** Where it lives; it comes back here after being scared off. */
  home: Vec;
  x: number;
  y: number;
  px: number;
  py: number;
  /** Height off the ground (birds and butterflies). */
  z: number;
  vx: number;
  vy: number;
  faceX: number;
  state: 'idle' | 'flee' | 'away' | 'return';
  t: number;
  phase: number;
  /** A butterfly's colour, a bird's or rabbit's shade. */
  tint: number;
}

/** How close you can get before something bolts. */
export const SCARE: Record<CritterKind, number> = { bird: 110, rabbit: 150, butterfly: 0 };

/** Flocks of sparrows, rabbits at the edges of the woods and paddocks, butterflies on the flowers. */
const HOMES: [CritterKind, number, number, number][] = [
  // [kind, x, y, how many]
  ['bird', 1180, 470, 3],
  ['bird', 760, 1200, 3],
  ['bird', 1700, 2470, 4],
  ['bird', 520, 640, 3],
  ['bird', 1560, 1600, 3],
  ['rabbit', 380, 520, 1],
  ['rabbit', 900, 1640, 1],
  ['rabbit', 1260, 2620, 2],
  ['rabbit', 200, 1500, 1],
  ['rabbit', 1880, 1050, 1],
  ['butterfly', 760, 1190, 2],
  ['butterfly', 1515, 400, 2],
  ['butterfly', 1700, 400, 1],
  ['butterfly', 1880, 448, 1],
  ['butterfly', 1030, 380, 2],
  ['butterfly', 1400, 610, 1],
];

export function createCritters(seed = 4141): Critter[] {
  const rng = new Rng(seed);
  const out: Critter[] = [];
  for (const [kind, hx, hy, n] of HOMES)
    for (let i = 0; i < n; i++) {
      const x = hx + rng.range(-30, 30);
      const y = hy + rng.range(-20, 20);
      out.push({ kind, home: { x, y }, x, y, px: x, py: y, z: kind === 'butterfly' ? 18 : 0, vx: 0, vy: 0, faceX: rng.next() < 0.5 ? -1 : 1, state: 'idle', t: rng.range(0, 3), phase: rng.range(0, 6), tint: rng.int(0, 3) });
    }
  return out;
}

/** One step for every critter. `threats` are the explorer and the dogs. Returns how many took fright. */
export function updateCritters(list: Critter[], threats: Vec[], dt: number, rng: Rng): number {
  let scared = 0;
  for (const c of list) {
    c.px = c.x;
    c.py = c.y;
    c.phase += dt;
    if (c.kind === 'butterfly') {
      // Lazy loops round the flowers.
      const a = c.phase * 0.9 + c.tint;
      c.x = c.home.x + Math.cos(a) * 26 + Math.sin(c.phase * 2.3) * 8;
      c.y = c.home.y + Math.sin(a * 1.3) * 14;
      c.z = 16 + Math.sin(c.phase * 3.1) * 6;
      c.faceX = Math.cos(a) < 0 ? 1 : -1;
      continue;
    }
    c.t -= dt;
    const near = threats.find((p) => dist(p, c) < SCARE[c.kind]);
    if (c.state === 'idle') {
      if (near) {
        // Away from whoever came too close.
        const d = dist(near, c) || 1;
        const sp = c.kind === 'bird' ? 260 : 300;
        c.vx = ((c.x - near.x) / d) * sp;
        c.vy = ((c.y - near.y) / d) * sp - (c.kind === 'bird' ? 40 : 0);
        c.faceX = c.vx > 0 ? 1 : -1;
        c.state = 'flee';
        c.t = c.kind === 'bird' ? 1.6 : 1.1;
        scared++;
        continue;
      }
      // Hop, peck, look about.
      if (c.t <= 0) {
        c.t = rng.range(0.6, 2.4);
        const hop = c.kind === 'bird' ? 10 : 22;
        const tx = c.home.x + rng.range(-40, 40);
        const ty = c.home.y + rng.range(-24, 24);
        const d = Math.hypot(tx - c.x, ty - c.y) || 1;
        c.x += ((tx - c.x) / d) * Math.min(hop, d);
        c.y += ((ty - c.y) / d) * Math.min(hop, d);
        c.faceX = tx > c.x ? 1 : -1;
      }
      continue;
    }
    if (c.state === 'flee') {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.kind === 'bird') c.z += 90 * dt;
      if (c.t <= 0) {
        c.state = 'away';
        c.t = rng.range(12, 22);
      }
      continue;
    }
    if (c.state === 'away') {
      if (c.t <= 0) {
        // Drift back in from off to the side once the coast is clear.
        c.state = 'return';
        c.x = c.home.x + (c.kind === 'bird' ? rng.range(-200, 200) : rng.range(-90, 90));
        c.y = c.home.y + (c.kind === 'bird' ? -160 : rng.range(-60, 60));
        c.z = c.kind === 'bird' ? 120 : 0;
        c.px = c.x;
        c.py = c.y;
      }
      continue;
    }
    // Returning.
    const d = Math.hypot(c.home.x - c.x, c.home.y - c.y);
    if (near && d > 30) {
      c.state = 'away';
      c.t = 6;
      continue;
    }
    const sp = (c.kind === 'bird' ? 160 : 120) * dt;
    if (d <= sp) {
      c.x = c.home.x;
      c.y = c.home.y;
      c.z = 0;
      c.state = 'idle';
      c.t = 1;
    } else {
      c.x += ((c.home.x - c.x) / d) * sp;
      c.y += ((c.home.y - c.y) / d) * sp;
      c.faceX = c.home.x > c.x ? 1 : -1;
      if (c.kind === 'bird') c.z = Math.max(0, Math.min(c.z, d * 0.6));
    }
  }
  return scared;
}
