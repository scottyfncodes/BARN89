import { dist, Rng, type Vec } from '../core/math';
import type { SpeciesId } from '../content/wildlife';

/**
 * The wild ones: Big Country natives that live round the edges of the homestead, mostly in the
 * corners nobody else uses (the north-west paddocks, the creek woods, the meadow behind the
 * barns, the fence along Buffalo Gap Rd). Each behaves the way the real thing does: the
 * roadrunner sprints and stops, the armadillo jumps straight up when startled, the horned
 * lizard freezes, the deer flag their tails and bound off. Get close enough for a good look and
 * it goes in the field guide.
 */
export interface Wild {
  sp: SpeciesId;
  /** Where it lives; it comes back here after being scared off. */
  home: Vec;
  x: number;
  y: number;
  px: number;
  py: number;
  /** Height off the ground (perches, hops, the vultures way up). */
  z: number;
  vx: number;
  vy: number;
  faceX: number;
  state: 'idle' | 'flee' | 'away' | 'return';
  t: number;
  phase: number;
  /** Seconds left of a one-off move: the armadillo's jump, a sally, a gobble, a song. */
  act: number;
  /** Variant: a fawn beside the doe, a tom among the hens, which song the mockingbird is on. */
  tint: number;
  /** Where it's heading while idle (sprints, wandering). */
  goal: Vec | null;
}

interface Habit {
  /** How close you can get before it bolts (0: it never does). */
  scare: number;
  flee: number;
  fleeT: number;
  awayT: [number, number];
  /** How far it wanders from home while idle. */
  roam: [number, number];
  /** Walking pace while idle. */
  pace: number;
  /** How close you need to be to get a good look. */
  spot: number;
}

export const HABITS: Record<SpeciesId, Habit> = {
  roadrunner: { scare: 120, flee: 430, fleeT: 1.2, awayT: [8, 14], roam: [12, 150], pace: 230, spot: 190 },
  armadillo: { scare: 95, flee: 120, fleeT: 2.4, awayT: [10, 18], roam: [60, 40], pace: 22, spot: 150 },
  jackrabbit: { scare: 170, flee: 360, fleeT: 1.3, awayT: [12, 20], roam: [50, 40], pace: 0, spot: 220 },
  hornedLizard: { scare: 0, flee: 0, fleeT: 0, awayT: [0, 0], roam: [14, 10], pace: 10, spot: 70 },
  deer: { scare: 230, flee: 330, fleeT: 1.7, awayT: [20, 32], roam: [50, 30], pace: 14, spot: 300 },
  turkey: { scare: 150, flee: 230, fleeT: 1.6, awayT: [12, 20], roam: [70, 46], pace: 26, spot: 220 },
  scissortail: { scare: 0, flee: 0, fleeT: 0, awayT: [0, 0], roam: [0, 0], pace: 0, spot: 170 },
  mockingbird: { scare: 0, flee: 0, fleeT: 0, awayT: [0, 0], roam: [0, 0], pace: 0, spot: 170 },
  vulture: { scare: 0, flee: 0, fleeT: 0, awayT: [0, 0], roam: [0, 0], pace: 0, spot: 300 },
  monarch: { scare: 0, flee: 0, fleeT: 0, awayT: [0, 0], roam: [0, 0], pace: 0, spot: 130 },
};

/** Up on a post or the farm stand roof. */
export const PERCH_Z: Partial<Record<SpeciesId, number>> = { scissortail: 34, mockingbird: 46 };
/** How high the vultures circle, and how wide. */
export const VULTURE_ALT = 300;
export const VULTURE_CIRCLE = { x: 1720, y: 1740, r: 150 };
/** The roadrunner's stretch of the access road (it sprints up and down between these). */
export const ROADRUNNER_RUN: [Vec, Vec] = [
  { x: 352, y: 840 },
  { x: 292, y: 1190 },
];

/** [species, x, y, how many]. Homes sit in the parts of the map nobody else uses much. */
export const WILD_HOMES: [SpeciesId, number, number, number][] = [
  ['roadrunner', 322, 1000, 1],
  ['armadillo', 610, 2290, 1],
  ['armadillo', 900, 2560, 1],
  ['jackrabbit', 170, 520, 1],
  ['jackrabbit', 200, 840, 1],
  ['hornedLizard', 575, 1985, 1],
  ['deer', 1010, 2660, 2],
  ['turkey', 1330, 2770, 4],
  ['scissortail', 2012, 1230, 1],
  ['scissortail', 284, 600, 1],
  ['mockingbird', 640, 120, 1],
  ['vulture', VULTURE_CIRCLE.x, VULTURE_CIRCLE.y, 2],
  ['monarch', 770, 1186, 3],
];

export function createWildlife(seed = 7929): Wild[] {
  const rng = new Rng(seed);
  const out: Wild[] = [];
  for (const [sp, hx, hy, n] of WILD_HOMES)
    for (let i = 0; i < n; i++) {
      const spread = sp === 'turkey' ? 34 : sp === 'deer' ? 26 : sp === 'monarch' ? 20 : 0;
      const x = hx + (spread ? rng.range(-spread, spread) : 0);
      const y = hy + (spread ? rng.range(-spread * 0.6, spread * 0.6) : 0);
      out.push({
        sp,
        home: { x, y },
        x,
        y,
        px: x,
        py: y,
        z: PERCH_Z[sp] ?? (sp === 'vulture' ? VULTURE_ALT : 0),
        vx: 0,
        vy: 0,
        faceX: rng.next() < 0.5 ? -1 : 1,
        state: 'idle',
        t: rng.range(0.5, 3),
        phase: rng.range(0, 6) + i * Math.PI,
        act: 0,
        tint: i,
        goal: null,
      });
    }
  return out;
}

/** Where the explorer has to stand for a proper look at this one. */
export function spotPoint(w: Wild): Vec {
  return w.sp === 'vulture' ? VULTURE_CIRCLE : w;
}

/** Can you see it well enough to put it in the guide from here? */
export function canSpot(w: Wild, from: Vec): boolean {
  if (w.state === 'away') return false;
  return dist(from, spotPoint(w)) < HABITS[w.sp].spot;
}

/** One step for every wild animal. `threats` are the explorer and the dogs. Returns who bolted. */
export function updateWildlife(list: Wild[], threats: Vec[], dt: number, rng: Rng): Wild[] {
  const bolted: Wild[] = [];
  for (const w of list) {
    w.px = w.x;
    w.py = w.y;
    w.phase += dt;
    w.act = Math.max(0, w.act - dt);
    w.t -= dt;
    const h = HABITS[w.sp];
    switch (w.sp) {
      case 'vulture': {
        // Slow wide circles, the two birds on opposite sides.
        const a = w.phase * 0.32 + w.tint * Math.PI;
        w.x = VULTURE_CIRCLE.x + Math.cos(a) * VULTURE_CIRCLE.r;
        w.y = VULTURE_CIRCLE.y + Math.sin(a) * VULTURE_CIRCLE.r * 0.6;
        w.faceX = -Math.sin(a) < 0 ? -1 : 1;
        continue;
      }
      case 'monarch': {
        // Drifting loops over the flowers, settling now and then.
        const a = w.phase * 0.7 + w.tint * 2.1;
        w.x = w.home.x + Math.cos(a) * 30 + Math.sin(w.phase * 1.7) * 8;
        w.y = w.home.y + Math.sin(a * 1.2) * 14;
        w.z = 14 + Math.sin(w.phase * 2.4 + w.tint) * 7;
        w.faceX = Math.cos(a) < 0 ? 1 : -1;
        continue;
      }
      case 'scissortail': {
        // Sits on its post, then darts out after a bug and loops back.
        if (w.act <= 0 && w.t <= 0) {
          w.act = 1.4;
          w.t = rng.range(3, 7);
          w.faceX = rng.next() < 0.5 ? -1 : 1;
        }
        const k = w.act > 0 ? Math.sin(Math.PI * (1 - w.act / 1.4)) : 0;
        w.x = w.home.x + w.faceX * k * 46;
        w.y = w.home.y + k * 10;
        w.z = (PERCH_Z.scissortail ?? 30) + k * 28;
        continue;
      }
      case 'mockingbird': {
        // Sings from the top of the farm stand, a new song every few seconds.
        if (w.t <= 0) {
          w.t = rng.range(3.5, 6);
          w.act = 2.2;
          w.tint = (w.tint + 1) % MOCK_SONGS.length;
          w.faceX = -w.faceX;
        }
        continue;
      }
      case 'hornedLizard': {
        // Freezes and puffs up when you're close; otherwise a slow shuffle after ants.
        const near = threats.some((p) => dist(p, w) < 80);
        if (near) {
          w.act = Math.max(w.act, 0.4);
          continue;
        }
        wander(w, h, dt, rng);
        continue;
      }
      default:
        break;
    }
    const near = threats.find((p) => dist(p, w) < h.scare);
    if (w.state === 'idle') {
      if (near) {
        const d = dist(near, w) || 1;
        w.vx = ((w.x - near.x) / d) * h.flee;
        w.vy = ((w.y - near.y) / d) * h.flee;
        if (w.sp === 'roadrunner') {
          // Away down the road, the way roadrunners do.
          const [a, b] = ROADRUNNER_RUN;
          const toB = (b.y - a.y) * (w.y - near.y) + (b.x - a.x) * (w.x - near.x) > 0;
          const to = toB ? b : a;
          const dd = dist(to, w) || 1;
          w.vx = ((to.x - w.x) / dd) * h.flee;
          w.vy = ((to.y - w.y) / dd) * h.flee;
        }
        w.faceX = w.vx > 0 ? 1 : -1;
        w.state = 'flee';
        w.t = h.fleeT;
        // The armadillo's famous jump.
        if (w.sp === 'armadillo') w.act = 0.5;
        bolted.push(w);
        continue;
      }
      if (w.sp === 'roadrunner') sprint(w, h, dt, rng);
      else if (w.sp === 'jackrabbit') {
        // Sits tight; flicks an ear now and then.
        if (w.t <= 0) {
          w.t = rng.range(2, 5);
          w.act = 0.5;
        }
      } else {
        wander(w, h, dt, rng);
        if (w.sp === 'turkey' && w.t <= 0 && w.act <= 0 && rng.next() < 0.004) w.act = 1.2;
      }
      continue;
    }
    if (w.state === 'flee') {
      // The armadillo hangs in the air a moment before it scurries.
      const airborne = w.sp === 'armadillo' && w.act > 0;
      w.z = airborne ? Math.sin(Math.PI * (1 - w.act / 0.5)) * 22 : 0;
      if (!airborne) {
        w.x += w.vx * dt;
        w.y += w.vy * dt;
      }
      if (w.t <= 0) {
        w.state = 'away';
        w.t = rng.range(...h.awayT);
      }
      continue;
    }
    if (w.state === 'away') {
      if (w.t <= 0) {
        w.state = 'return';
        const a = rng.range(0, Math.PI * 2);
        w.x = w.px = w.home.x + Math.cos(a) * 140;
        w.y = w.py = w.home.y + Math.sin(a) * 90;
        w.z = 0;
      }
      continue;
    }
    // Returning, warily.
    const d = dist(w.home, w);
    if (near && d > 30) {
      w.state = 'away';
      w.t = 6;
      continue;
    }
    const sp = Math.max(40, h.pace * 3) * dt;
    if (d <= sp) {
      w.x = w.home.x;
      w.y = w.home.y;
      w.state = 'idle';
      w.t = 1;
    } else {
      w.x += ((w.home.x - w.x) / d) * sp;
      w.y += ((w.home.y - w.y) / d) * sp;
      w.faceX = w.home.x > w.x ? 1 : -1;
    }
  }
  return bolted;
}

/** Ambles about near home: walk to a spot, stop and feed, pick another. */
function wander(w: Wild, h: Habit, dt: number, rng: Rng): void {
  if (!w.goal) {
    if (w.t > 0) return;
    w.goal = { x: w.home.x + rng.range(-h.roam[0], h.roam[0]), y: w.home.y + rng.range(-h.roam[1], h.roam[1]) };
  }
  const d = dist(w.goal, w);
  const step = h.pace * dt;
  if (d <= step) {
    w.goal = null;
    w.t = rng.range(1.5, 4.5);
    return;
  }
  w.x += ((w.goal.x - w.x) / d) * step;
  w.y += ((w.goal.y - w.y) / d) * step;
  w.faceX = w.goal.x > w.x ? 1 : -1;
}

/** The roadrunner: a burst of speed along the road, a dead stop, tail up, look about. */
function sprint(w: Wild, h: Habit, dt: number, rng: Rng): void {
  if (!w.goal) {
    if (w.t > 0) return;
    const [a, b] = ROADRUNNER_RUN;
    const k = rng.range(0.1, 0.9);
    w.goal = { x: a.x + (b.x - a.x) * k + rng.range(-10, 10), y: a.y + (b.y - a.y) * k };
  }
  const d = dist(w.goal, w);
  const step = h.pace * dt;
  if (d <= step) {
    w.goal = null;
    w.t = rng.range(1.2, 3.4);
    // Tail cocked when it stops.
    w.act = 0.6;
    return;
  }
  w.x += ((w.goal.x - w.x) / d) * step;
  w.y += ((w.goal.y - w.y) / d) * step;
  w.faceX = w.goal.x > w.x ? 1 : -1;
}

/** What the mockingbird is singing (it does a fair barn cat). */
export const MOCK_SONGS = ['tweedle-dee!', 'meow?', 'chk chk chk', 'yip! yip!', 'wheet wheet', 'HEE-HAW'];
