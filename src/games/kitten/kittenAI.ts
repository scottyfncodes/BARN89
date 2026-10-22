import { clamp, damp, dist, fromAngle, norm, Rng, type Vec } from '../../core/math';
import { PERSONALITIES } from './kittenTypes';
import type { KittenSpawn } from './levels';
import type { Game } from './game';
import type { Emote, Kitten, KittenState, Treat } from './types';

export const KITTEN_RADIUS = 9;

/** Sixteen candidate steering directions for context steering. */
const DIRS: Vec[] = Array.from({ length: 16 }, (_, i) => fromAngle((i / 16) * Math.PI * 2));
const PROBES = [11, 23, 36];

export function createKitten(s: KittenSpawn): Kitten {
  const rng = new Rng(s.seed);
  return {
    id: s.id,
    name: s.name,
    personality: s.personality,
    coat: s.coat,
    x: s.x,
    y: s.y,
    px: s.x,
    py: s.y,
    vx: 0,
    vy: 0,
    radius: KITTEN_RADIUS,
    faceX: rng.next() < 0.5 ? -1 : 1,
    state: 'idle',
    stateT: rng.range(0, 1.5),
    home: { x: s.x, y: s.y },
    rng,
    target: null,
    targetId: null,
    path: null,
    pathAge: 0,
    steer: { x: 0, y: 0 },
    steerT: 0,
    desiredSpeed: 0,
    alarm: 0,
    emote: 'none',
    emoteT: 0,
    animPhase: rng.range(0, 10),
    // Sleepy kittens start part-way through their nap cycle; Ziggy's first butterfly comes quickly.
    cycleT: s.personality === 'distractible' ? 9 : s.personality === 'sleepy' ? rng.range(1, 4) : 0,
    cooldowns: {},
    stuckCheckT: 1.2,
    stuckFrom: { x: s.x, y: s.y },
    stuckCount: 0,
    penned: false,
    pennedAt: 0,
    focusT: 0,
  };
}

function setState(k: Kitten, s: KittenState): void {
  if (k.state === s) return;
  k.state = s;
  k.stateT = 0;
  k.path = null;
  k.pathAge = 0;
  k.steerT = 0;
}

export function emote(k: Kitten, e: Emote, t = 1.4): void {
  k.emote = e;
  k.emoteT = t;
}

/**
 * Context steering: pick the candidate direction that best matches `desired`, penalising
 * directions that run into walls. This is what lets kittens slide out of corners instead
 * of pinning themselves against a fence.
 */
export function chooseSteer(k: Kitten, desired: Vec, g: Game): Vec {
  const want = norm(desired);
  if (want.x === 0 && want.y === 0) return want;
  let best = want;
  let bestScore = -Infinity;
  for (const d of DIRS) {
    let score = d.x * want.x + d.y * want.y;
    let blocked = 0;
    for (let i = 0; i < PROBES.length; i++) {
      if (!g.nav.isWalkable(k.x + d.x * PROBES[i], k.y + d.y * PROBES[i])) {
        blocked += PROBES.length - i;
        break;
      }
    }
    score -= blocked * 0.55;
    score += 0.12 * (d.x * k.steer.x + d.y * k.steer.y);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function followPath(k: Kitten, g: Game, goal: Vec, dt: number, repath = 1.2): Vec {
  k.pathAge -= dt;
  if (g.world.clearPath(k.x, k.y, goal.x, goal.y, k.radius * 0.9)) {
    k.path = null;
    return { x: goal.x - k.x, y: goal.y - k.y };
  }
  if (!k.path || k.pathAge <= 0) {
    k.path = g.nav.findPath({ x: k.x, y: k.y }, goal);
    k.pathAge = repath + k.rng.range(0, 0.3);
    if (!k.path) return { x: 0, y: 0 };
  }
  while (k.path.length > 1 && dist(k, k.path[0]) < 14) k.path.shift();
  const wp = k.path[0];
  return wp ? { x: wp.x - k.x, y: wp.y - k.y } : { x: 0, y: 0 };
}

function nearestTreat(k: Kitten, g: Game, sense: number): Treat | null {
  let best: Treat | null = null;
  let bestD = sense;
  for (const t of g.treats) {
    if (t.eaten || t.flightT < t.flight) continue;
    if (t.eatenBy && t.eatenBy !== k.id) continue;
    const d = dist(k, t);
    if (d >= bestD) continue;
    // Shy kittens won't approach a treat while Deputy is looming over it.
    if (k.personality === 'shy' && dist(g.player, t) < 130) continue;
    bestD = d;
    best = t;
  }
  return best;
}

function pickWanderTarget(k: Kitten, g: Game): Vec {
  // Drift toward nearby kittens a little so herds form naturally.
  let cx = 0;
  let cy = 0;
  let n = 0;
  for (const o of g.kittens) {
    if (o === k || o.penned) continue;
    if (dist(o, k) < 170) {
      cx += o.x;
      cy += o.y;
      n++;
    }
  }
  const range = k.personality === 'sleepy' ? 50 : 95;
  let tx = k.home.x + k.rng.range(-range, range);
  let ty = k.home.y + k.rng.range(-range, range);
  if (n > 0) {
    tx = tx * 0.65 + (cx / n) * 0.35;
    ty = ty * 0.65 + (cy / n) * 0.35;
  }
  if (!g.nav.isWalkable(tx, ty)) {
    const p = g.nav.nearestWalkable(tx, ty, 8);
    if (p) return p;
    return { x: k.x, y: k.y };
  }
  return { x: tx, y: ty };
}

/** Whistle response: wake up and scoot ahead in the direction Natalie is riding. */
export function whistleKitten(k: Kitten, g: Game): void {
  const p = g.player;
  const away = norm({ x: k.x - p.x, y: k.y - p.y });
  const ahead = fromAngle(p.heading);
  const dir = norm({ x: ahead.x + away.x * 0.6, y: ahead.y + away.y * 0.6 });
  // Release any butterfly Ziggy was chasing.
  for (const b of g.butterflies) if (b.bait === k.id) b.bait = null;
  setState(k, 'dash');
  k.target = { x: dir.x, y: dir.y };
  k.steerT = 0;
  k.focusT = 5;
  if (k.personality === 'sleepy') k.cycleT = 9;
  emote(k, 'alarm', 0.9);
}

function updatePenned(k: Kitten, g: Game, dt: number): void {
  const pen = g.targetPen;
  if (k.state !== 'penned') setState(k, 'penned');
  // Wander between comfy spots inside the corral, resting in between.
  k.cycleT -= dt;
  let moving = !!k.target && dist(k, k.target) > 8;
  if (!moving && k.cycleT <= 0) {
    const a = k.rng.range(0, Math.PI * 2);
    const r = k.rng.range(10, pen.r - 50);
    k.target = { x: pen.x + Math.cos(a) * r, y: pen.y + Math.sin(a) * r };
    k.cycleT = k.rng.range(2.5, 5.5);
    moving = true;
  }
  k.desiredSpeed = moving ? PERSONALITIES[k.personality].walk * 0.8 : 0;
  k.steer = moving && k.target ? norm({ x: k.target.x - k.x, y: k.target.y - k.y }) : { x: 0, y: 0 };
  if (k.emoteT <= 0 && k.rng.next() < dt * 0.08) emote(k, k.rng.next() < 0.5 ? 'note' : 'heart', 1.2);
}

export function updateKitten(k: Kitten, g: Game, dt: number): void {
  const tune = PERSONALITIES[k.personality];
  k.stateT += dt;
  k.emoteT = Math.max(0, k.emoteT - dt);
  if (k.emoteT === 0) k.emote = 'none';
  k.focusT = Math.max(0, k.focusT - dt);
  for (const id in k.cooldowns) k.cooldowns[id] = Math.max(0, k.cooldowns[id] - dt);

  if (k.penned) {
    updatePenned(k, g, dt);
    integrate(k, g, dt);
    return;
  }

  const p = g.player;
  const dP = dist(k, p);
  const zoom = g.inZoomies(k.x, k.y) ? 1.3 : 1;

  // --- Threat assessment -------------------------------------------------------------
  const pSpeed = Math.hypot(p.vx, p.vy);
  const toK = norm({ x: k.x - p.x, y: k.y - p.y });
  const approach = pSpeed > 1 ? (p.vx * toK.x + p.vy * toK.y) / pSpeed : 0;
  let fear = tune.fear * (0.72 + 0.28 * clamp(pSpeed / p.maxSpeed, 0, 1) + 0.18 * Math.max(0, approach));
  if (k.state === 'nap') fear = 58;
  else if (k.state === 'follow') fear = 46;
  else if (k.state === 'eat') fear *= 0.45;
  else if (k.state === 'inspect' && k.targetId === 'deputy') fear = 50;
  const pressure = dP < fear ? 1 - dP / fear : 0;
  k.alarm = damp(k.alarm, pressure > 0 ? 1 : 0, 5, dt);

  // --- Personality timers ------------------------------------------------------------
  if (k.personality === 'sleepy') {
    k.cycleT -= dt;
    if (k.state === 'nap' && k.cycleT <= 0) {
      setState(k, 'idle');
      k.cycleT = 9;
    } else if (k.cycleT <= 0 && (k.state === 'wander' || k.state === 'idle')) {
      setState(k, 'nap');
      k.cycleT = 7;
    }
  }
  if (k.personality === 'distractible') {
    k.cycleT -= dt;
    if (k.cycleT <= 0 && (k.state === 'wander' || k.state === 'idle')) {
      k.cycleT = 16;
      g.spawnButterflyFor(k);
      setState(k, 'chase');
      emote(k, 'alarm', 1);
    }
  }

  // --- State transitions (highest priority first) ------------------------------------
  if (k.state === 'dash') {
    if (k.stateT > (k.personality === 'sleepy' ? 1.5 : 1.05)) {
      setState(k, 'idle');
      k.home = { x: k.x, y: k.y };
    }
  } else if (pressure > 0 && k.state !== 'flee') {
    if (k.state === 'nap') emote(k, 'alarm', 1.1);
    else if (k.state !== 'eat' && k.state !== 'follow') emote(k, 'alarm', 0.8);
    if (k.state !== 'eat' || pressure > 0.55) {
      if (k.state !== 'follow') {
        g.emit({ type: 'startle', kittenId: k.id, x: k.x, y: k.y });
        if (k.state === 'chase') for (const b of g.butterflies) if (b.bait === k.id) b.bait = null;
        setState(k, 'flee');
      }
    }
  } else if (k.state === 'flee' && pressure === 0 && k.stateT > 0.5) {
    setState(k, 'idle');
    k.home = { x: k.x, y: k.y };
  }

  const free = k.state === 'wander' || k.state === 'idle' || k.state === 'follow' || k.state === 'inspect' || k.state === 'play';
  // Treats beat everything except fear.
  if (free || k.state === 'nap') {
    const sense = k.state === 'nap' ? Math.min(120, tune.treatSense) : tune.treatSense;
    const t = nearestTreat(k, g, sense);
    if (t) {
      setState(k, 'seek');
      k.targetId = String(t.id);
      k.target = { x: t.x, y: t.y };
      emote(k, 'heart', 1);
    }
  }
  if (k.state === 'wander' || k.state === 'idle') {
    if (k.personality === 'curious' && k.focusT <= 0) {
      if (p.idleT > 1 && dP < 240 && dP > 70 && (k.cooldowns.deputy ?? 0) <= 0) {
        setState(k, 'inspect');
        k.targetId = 'deputy';
        emote(k, 'question', 1.2);
      } else {
        for (const d of g.map.distractions) {
          if ((k.cooldowns[d.id] ?? 0) > 0) continue;
          if (dist(k, d) < d.radius) {
            setState(k, 'inspect');
            k.targetId = d.id;
            k.target = g.distractionSpot(d.id);
            emote(k, 'question', 1.2);
            break;
          }
        }
      }
    }
  }

  // --- Behaviour per state -----------------------------------------------------------
  let desired: Vec = { x: 0, y: 0 };
  let speed = 0;
  switch (k.state) {
    case 'flee': {
      const away = norm({ x: k.x - p.x, y: k.y - p.y });
      // Align with other fleeing kittens so a herd moves together.
      let ax = 0;
      let ay = 0;
      for (const o of g.kittens) {
        if (o === k || o.penned || o.state !== 'flee') continue;
        if (dist(o, k) < 90) {
          ax += o.steer.x;
          ay += o.steer.y;
        }
      }
      desired = { x: away.x + ax * 0.25, y: away.y + ay * 0.25 };
      speed = (tune.walk + (tune.run - tune.walk) * Math.pow(pressure, 0.6)) * zoom;
      break;
    }
    case 'dash': {
      desired = k.target ?? { x: 0, y: 0 };
      speed = tune.dash * zoom * (1 - 0.35 * (k.stateT / 1.5));
      break;
    }
    case 'seek': {
      const t = g.treats.find((tr) => String(tr.id) === k.targetId);
      if (!t || t.eaten || (t.eatenBy && t.eatenBy !== k.id)) {
        setState(k, 'idle');
        emote(k, 'question', 1);
        break;
      }
      if (dist(k, t) < 13) {
        t.eatenBy = k.id;
        setState(k, 'eat');
        k.targetId = String(t.id);
        break;
      }
      desired = followPath(k, g, t, dt, 0.9);
      speed = (k.personality === 'hungry' ? tune.run * 0.85 : tune.walk * 2) * zoom;
      if (k.stateT > 14) setState(k, 'idle');
      break;
    }
    case 'eat': {
      speed = 0;
      if (k.emoteT <= 0.1) emote(k, 'heart', 0.8);
      if (k.stateT > 2.2) {
        const t = g.treats.find((tr) => String(tr.id) === k.targetId);
        if (t && !t.eaten) {
          t.eaten = true;
          g.emit({ type: 'treatEaten', kittenId: k.id, x: t.x, y: t.y });
        }
        if (k.personality === 'hungry') {
          setState(k, 'follow');
          emote(k, 'heart', 1.5);
        } else {
          setState(k, 'idle');
          k.home = { x: k.x, y: k.y };
        }
      }
      break;
    }
    case 'follow': {
      // Hungry kittens trot behind Deputy hoping for seconds.
      const behind = fromAngle(p.heading + Math.PI, 62);
      const goal = { x: p.x + behind.x, y: p.y + behind.y };
      const d = dist(k, goal);
      if (d > 26) {
        desired = followPath(k, g, goal, dt, 0.7);
        speed = clamp(d * 2.2, tune.walk, tune.run * 1.4) * zoom;
      }
      if (k.stateT > 10 || dP > 420) {
        setState(k, 'idle');
        k.home = { x: k.x, y: k.y };
        emote(k, 'question', 1);
      }
      break;
    }
    case 'inspect': {
      const goal = k.targetId === 'deputy' ? { x: p.x, y: p.y } : k.target;
      if (!goal) {
        setState(k, 'idle');
        break;
      }
      const near = k.targetId === 'deputy' ? 52 : 24;
      if (dist(k, goal) <= near) {
        if (k.targetId === 'deputy') {
          speed = 0;
          if (k.emoteT <= 0 && k.rng.next() < dt * 0.6) emote(k, 'heart', 1);
          if (p.idleT < 0.2 || k.stateT > 9) {
            k.cooldowns.deputy = 6;
            setState(k, 'idle');
            k.home = { x: k.x, y: k.y };
          }
        } else {
          setState(k, 'play');
          k.cooldowns[k.targetId ?? ''] = 24;
        }
        break;
      }
      if (k.targetId === 'deputy' && p.idleT < 0.2) {
        setState(k, 'idle');
        break;
      }
      desired = followPath(k, g, goal, dt, 1.4);
      speed = tune.walk * 1.7 * zoom;
      if (k.stateT > 15) {
        k.cooldowns[k.targetId ?? ''] = 15;
        setState(k, 'idle');
      }
      break;
    }
    case 'play': {
      // Pounce around the spot for a few seconds.
      if (k.steerT <= 0) k.target = { x: k.x + k.rng.range(-20, 20), y: k.y + k.rng.range(-20, 20) };
      if (k.target) desired = { x: k.target.x - k.x, y: k.target.y - k.y };
      speed = Math.sin(k.stateT * 7) > 0.4 ? 70 : 0;
      if (k.emoteT <= 0) emote(k, 'note', 0.8);
      if (k.stateT > 4) {
        setState(k, 'idle');
        k.home = { x: k.x, y: k.y };
      }
      break;
    }
    case 'chase': {
      const b = g.butterflies.find((bf) => bf.bait === k.id);
      if (!b || k.stateT > 5.5) {
        if (b) b.bait = null;
        setState(k, 'idle');
        k.home = { x: k.x, y: k.y };
        emote(k, 'question', 1.1);
        break;
      }
      desired = { x: b.x - k.x, y: b.y + 10 - k.y };
      speed = tune.run * 0.82 * zoom;
      break;
    }
    case 'nap': {
      speed = 0;
      if (k.emoteT <= 0) emote(k, 'zzz', 1.6);
      break;
    }
    case 'wander': {
      if (!k.target || dist(k, k.target) < 10 || k.stateT > 7) {
        setState(k, 'idle');
        break;
      }
      desired = { x: k.target.x - k.x, y: k.target.y - k.y };
      speed = tune.walk * zoom * (zoom > 1 ? 1.8 : 1);
      break;
    }
    case 'idle':
    default: {
      speed = 0;
      const wait = k.personality === 'sleepy' ? 3.5 : zoom > 1 ? 0.8 : 2.2;
      if (k.stateT > wait + k.rng.range(0, 0.02)) {
        setState(k, 'wander');
        k.target = pickWanderTarget(k, g);
        if (k.rng.next() < 0.25) g.emit({ type: 'meow', kittenId: k.id, x: k.x, y: k.y });
      }
      break;
    }
  }

  // --- Steering -------------------------------------------------------------------
  k.steerT -= dt;
  if (speed > 0) {
    if (k.steerT <= 0) {
      k.steer = chooseSteer(k, desired, g);
      k.steerT = k.state === 'flee' || k.state === 'dash' ? 0.1 : 0.18;
    }
  } else {
    k.steer = { x: 0, y: 0 };
  }
  k.desiredSpeed = speed;
  integrate(k, g, dt);
  unstick(k, g, dt);

  // --- Penning ----------------------------------------------------------------------
  const pen = g.targetPen;
  if (Math.hypot(k.x - pen.x, k.y - pen.y) < pen.r - 22) {
    k.penned = true;
    k.pennedAt = g.elapsed;
    setState(k, 'penned');
    k.target = null;
    k.cycleT = 0;
    for (const b of g.butterflies) if (b.bait === k.id) b.bait = null;
    emote(k, 'sparkle', 2);
    g.onPenned(k);
  }
}

function integrate(k: Kitten, g: Game, dt: number): void {
  const tvx = k.steer.x * k.desiredSpeed;
  const tvy = k.steer.y * k.desiredSpeed;
  const rate = k.state === 'flee' || k.state === 'dash' ? 10 : 7;
  k.vx = damp(k.vx, tvx, rate, dt);
  k.vy = damp(k.vy, tvy, rate, dt);
  const pos = { x: k.x + k.vx * dt, y: k.y + k.vy * dt };

  // Soft separation from other kittens.
  for (const o of g.kittens) {
    if (o === k) continue;
    const dx = pos.x - o.x;
    const dy = pos.y - o.y;
    const min = k.radius + o.radius + 2;
    const d2 = dx * dx + dy * dy;
    if (d2 < min * min && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      const push = (min - d) * 0.5;
      pos.x += (dx / d) * push;
      pos.y += (dy / d) * push;
    }
  }
  // Deputy is solid: kittens get nudged out of the way.
  const p = g.player;
  const dx = pos.x - p.x;
  const dy = pos.y - p.y;
  const min = k.radius + p.radius;
  const d2 = dx * dx + dy * dy;
  if (d2 < min * min) {
    const d = Math.sqrt(d2) || 1;
    pos.x = p.x + (dx / d) * min;
    pos.y = p.y + (dy / d) * min;
  }
  g.world.resolve(pos, k.radius);

  if (k.penned) {
    const pen = g.targetPen;
    const ddx = pos.x - pen.x;
    const ddy = pos.y - pen.y;
    const dd = Math.hypot(ddx, ddy);
    const lim = pen.r - 20;
    if (dd > lim) {
      pos.x = pen.x + (ddx / dd) * lim;
      pos.y = pen.y + (ddy / dd) * lim;
    }
  }

  k.x = pos.x;
  k.y = pos.y;
  const sp = Math.hypot(k.vx, k.vy);
  if (k.vx > 6) k.faceX = 1;
  else if (k.vx < -6) k.faceX = -1;
  k.animPhase += dt * (1.5 + sp * 0.11);
}

/** Last line of defence against getting wedged: detect lack of progress and wriggle free. */
function unstick(k: Kitten, g: Game, dt: number): void {
  if (!g.world.isFree(k.x, k.y, k.radius - 1)) {
    const p = g.nav.nearestWalkable(k.x, k.y, 10);
    if (p) {
      const d = dist(k, p);
      const step = Math.min(d, 160 * dt);
      if (d > 0) {
        k.x += ((p.x - k.x) / d) * step;
        k.y += ((p.y - k.y) / d) * step;
      }
    }
  }
  k.stuckCheckT -= dt;
  if (k.stuckCheckT > 0) return;
  k.stuckCheckT = 1.1;
  const moved = dist(k, k.stuckFrom);
  k.stuckFrom = { x: k.x, y: k.y };
  if (k.desiredSpeed > 30 && moved < 9) {
    k.stuckCount++;
    // Wriggle in the freest direction away from where we were trying to go.
    const sideways = { x: -k.steer.y, y: k.steer.x };
    if (k.rng.next() < 0.5) {
      sideways.x *= -1;
      sideways.y *= -1;
    }
    k.steer = chooseSteer(k, sideways, g);
    k.steerT = 0.6;
    if (k.stuckCount >= 3) {
      k.stuckCount = 0;
      k.path = null;
      if (k.state !== 'dash' && k.state !== 'flee') {
        setState(k, 'idle');
        k.home = { x: k.x, y: k.y };
      }
      const p = g.nav.nearestWalkable(k.x, k.y, 12);
      if (p && !g.nav.isWalkable(k.x, k.y)) {
        k.x = p.x;
        k.y = p.y;
      }
    }
  } else {
    k.stuckCount = 0;
  }
}
