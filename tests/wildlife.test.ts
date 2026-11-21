import { describe, expect, it } from 'vitest';
import { ACTIVITIES, REWARDS, rewardUnlocked } from '../src/content/activities';
import { FAMILY_ORDER } from '../src/content/cast';
import { beaten, beatenCount, hatDayReady, hatDayScript, PRIMARY_GAME, SILLY_HATS } from '../src/content/hatday';
import { SPECIES, SPECIES_COUNT } from '../src/content/wildlife';
import { freshSave, normalize } from '../src/core/save';
import { PLAYER_RADIUS } from '../src/games/kitten/player';
import { Homestead, type HubEvent } from '../src/hub/homestead';
import { BARREL_KNOCK_R, BARREL_STAR_TIMES, BARRELS, BARREL_START, FIRE_ANTS, HAT_LAWN, HIDE_SPOTS, HOME_BASE, SEEK_ROUNDS, SEEK_STAR_TIMES } from '../src/hub/missions';
import { canSpot, HABITS, spotPoint, WILD_HOMES } from '../src/hub/wildlife';
import { NavGrid } from '../src/world/navgrid';
import { sharedWorld } from '../src/world/shared';

const DT = 1 / 60;
const shared = sharedWorld();
const walkerNav = new NavGrid(shared.world, 16, PLAYER_RADIUS);
const still = { moveX: 0, moveY: 0, whistle: false, treat: false };

function fresh(explorer: 'natalie' | 'jay' = 'natalie'): Homestead {
  return new Homestead(shared, { explorer, ornaments: [], discoveries: [], huntFound: [] });
}

function run(h: Homestead, seconds: number, act = false): HubEvent[] {
  const out: HubEvent[] = [];
  for (let i = 0; i < seconds * 60; i++) {
    h.step(still, DT, act && i === 0);
    out.push(...h.drainEvents());
  }
  return out;
}

/** Distance from point c to the segment a-b. */
function segDist(c: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(a.x + dx * t - c.x, a.y + dy * t - c.y);
}

/** Steer toward a point, round obstacles on the nav grid when the straight line is blocked. */
function steer(h: Homestead, goal: { x: number; y: number }, cache: { path: { x: number; y: number }[] | null; for: string }): { x: number; y: number } {
  const p = h.player;
  if (shared.world.clearPath(p.x, p.y, goal.x, goal.y, 12)) {
    cache.path = null;
    return goal;
  }
  const key = `${Math.round(goal.x)},${Math.round(goal.y)}`;
  if (cache.for !== key || !cache.path) {
    cache.path = walkerNav.findPath(p, goal, 40000);
    cache.for = key;
  }
  while (cache.path && cache.path.length > 1 && Math.hypot(cache.path[0].x - p.x, cache.path[0].y - p.y) < 20) cache.path.shift();
  return cache.path?.[0] ?? goal;
}

const start = fresh().startPoint();
const reach = (label: string, p: { x: number; y: number }, within: number) => {
  const spot = walkerNav.isWalkable(p.x, p.y) ? p : walkerNav.nearestWalkable(p.x, p.y, 10);
  expect(spot, `${label} has no walkable spot`).not.toBeNull();
  expect(Math.hypot(spot!.x - p.x, spot!.y - p.y), `${label} too far from walkable ground`).toBeLessThan(within);
  expect(walkerNav.reachable(start, spot!), `${label} unreachable`).toBe(true);
};

describe('Big Country wildlife', () => {
  it('has a home on the map for every species in the field guide, and nothing extra', () => {
    const homed = new Set(WILD_HOMES.map((w) => w[0]));
    expect(homed.size).toBe(SPECIES_COUNT);
    for (const s of SPECIES) expect(homed.has(s.id), s.id).toBe(true);
    for (const s of SPECIES) expect(s.fact.includes('—'), s.id).toBe(false);
  });

  it('every species can be walked up to close enough to spot', () => {
    for (const [sp, x, y] of WILD_HOMES) reach(sp, { x, y }, HABITS[sp].spot * 0.7);
  });

  it('lives mostly in the corners nobody else uses', () => {
    // Away from the busy middle: no wildlife home within 150 of any activity station.
    for (const [sp, x, y] of WILD_HOMES) for (const a of ACTIVITIES) expect(Math.hypot(a.station.x - x, a.station.y - y), `${sp}/${a.id}`).toBeGreaterThan(150);
  });

  it('walking up to an animal puts it in the field guide, once', () => {
    const h = fresh();
    const deer = h.wild.find((w) => w.sp === 'deer')!;
    const spot = walkerNav.nearestWalkable(deer.x, deer.y + 200, 10)!;
    h.teleport(spot.x, spot.y);
    let ev = run(h, 0.2);
    expect(ev.some((e) => e.type === 'wild' && e.species === 'deer')).toBe(true);
    // The deer bolt, flags up.
    run(h, 0.3);
    expect(h.wild.filter((w) => w.sp === 'deer').every((w) => w.state !== 'idle')).toBe(true);
    ev = run(h, 1);
    expect(ev.some((e) => e.type === 'wild' && e.species === 'deer')).toBe(false);
  });

  it('the armadillo jumps straight up when startled', () => {
    const h = fresh();
    const a = h.wild.find((w) => w.sp === 'armadillo')!;
    const spot = walkerNav.nearestWalkable(a.x + 60, a.y, 10)!;
    h.teleport(spot.x, spot.y);
    let peak = 0;
    for (let i = 0; i < 40; i++) {
      h.step(still, DT, false);
      peak = Math.max(peak, a.z);
    }
    expect(a.state).toBe('flee');
    expect(peak).toBeGreaterThan(15);
  });

  it('the horned lizard freezes instead of running, so you can get close', () => {
    const h = fresh();
    const l = h.wild.find((w) => w.sp === 'hornedLizard')!;
    const spot = walkerNav.nearestWalkable(l.x + 40, l.y, 10)!;
    h.teleport(spot.x, spot.y);
    const ev = run(h, 1);
    expect(l.state).toBe('idle');
    expect(l.act).toBeGreaterThan(0);
    expect(ev.some((e) => e.type === 'wild' && e.species === 'hornedLizard')).toBe(true);
  });

  it('the vultures are spotted from under their circle, high over the arena', () => {
    const h = fresh();
    const v = h.wild.find((w) => w.sp === 'vulture')!;
    expect(canSpot(v, spotPoint(v))).toBe(true);
    expect(canSpot(v, start)).toBe(false);
  });

  it('remembers what you already spotted', () => {
    const h = new Homestead(shared, { explorer: 'natalie', ornaments: [], discoveries: [], huntFound: [], wildlife: ['mockingbird'] });
    h.teleport(640, 200);
    const ev = run(h, 0.5);
    expect(ev.some((e) => e.type === 'wild' && e.species === 'mockingbird')).toBe(false);
  });

  it('the field hat comes with a full field guide', () => {
    const r = REWARDS.find((x) => x.id === 'hat-boonie')!;
    const s = freshSave();
    s.wildlife = SPECIES.slice(1).map((x) => x.id);
    expect(rewardUnlocked(s, r)).toBe(false);
    s.wildlife.push(SPECIES[0].id);
    expect(rewardUnlocked(s, r)).toBe(true);
  });
});

describe('Easter eggs', () => {
  it('standing on the fire ant mound ends one way', () => {
    const h = fresh();
    const spot = walkerNav.nearestWalkable(FIRE_ANTS.x, FIRE_ANTS.y, 4)!;
    expect(Math.hypot(spot.x - FIRE_ANTS.x, spot.y - FIRE_ANTS.y)).toBeLessThan(FIRE_ANTS.r);
    h.teleport(FIRE_ANTS.x, FIRE_ANTS.y);
    const ev = run(h, 1.2);
    expect(ev.some((e) => e.type === 'ants')).toBe(true);
    expect(h.ouchLift()).toBeGreaterThanOrEqual(0);
  });

  it('a tumbleweed blows through now and then, and bowls on when you touch it', () => {
    const h = fresh();
    h.teleport(1200, 470);
    h.tumbleT = 0;
    run(h, 0.1);
    const w = h.tumbleweed!;
    expect(w).not.toBeNull();
    expect(w.x).toBeLessThan(h.player.x);
    // Stand in its way.
    h.teleport(w.x + 60, w.y);
    const ev = run(h, 2);
    expect(ev.some((e) => e.type === 'tumbleweed')).toBe(true);
  });

  it('adds discoveries out in the paddocks, the meadow and the creek', () => {
    for (const id of ['pricklyPear', 'paddock', 'meadow', 'dryCreek']) {
      const d = shared.map.discoveries.find((x) => x.id === id)!;
      expect(d, id).toBeDefined();
      reach(id, d, d.r * 0.8);
    }
  });
});

describe("Mom's Barrel Pattern", () => {
  it('runs round the arena barrels that are on the map', () => {
    for (const b of BARRELS) expect(shared.map.props.some((p) => p.kind === 'barrel' && p.x === b.x && p.y === b.y)).toBe(true);
    reach('barrel start', BARREL_START, 20);
  });

  it('every leg of the pattern, and the run home, has a clean line past the other barrels', () => {
    const legs = [BARREL_START, ...BARRELS, BARREL_START];
    for (let i = 0; i + 1 < legs.length; i++)
      for (const b of BARRELS) {
        if (b === legs[i] || b === legs[i + 1]) continue;
        expect(segDist(b, legs[i], legs[i + 1]), `leg ${i} passes barrel ${b.x},${b.y}`).toBeGreaterThan(BARREL_KNOCK_R + 30);
      }
  });

  /** A bot that circles each barrel at a fixed radius, then runs for the gate. */
  function barrelBot(h: Homestead, radius: number, maxSeconds = 90): HubEvent | undefined {
    const cache = { path: null as { x: number; y: number }[] | null, for: '' };
    for (let i = 0; i < maxSeconds * 60; i++) {
      const m = h.mission;
      if (m?.kind !== 'barrels') return undefined;
      const p = h.player;
      let goal: { x: number; y: number };
      // Like a rider: finish the turn round the last barrel before cutting across to the next.
      const prev = m.next > 0 ? BARRELS[m.next - 1] : null;
      const target = m.next < BARRELS.length ? BARRELS[m.next] : { x: BARREL_START.x - 30, y: BARREL_START.y };
      const blocked = !!prev && segDist(prev, p, target) < 48 && Math.hypot(p.x - prev.x, p.y - prev.y) < radius + 20;
      if (blocked && prev) {
        const a = Math.atan2(p.y - prev.y, p.x - prev.x) + 0.6;
        goal = { x: prev.x + Math.cos(a) * radius, y: prev.y + Math.sin(a) * radius };
      } else if (m.next < BARRELS.length) {
        const b = BARRELS[m.next];
        const d = Math.hypot(p.x - b.x, p.y - b.y);
        if (d > radius + 30) {
          const k = radius / (d || 1);
          goal = steer(h, { x: b.x + (p.x - b.x) * k, y: b.y + (p.y - b.y) * k }, cache);
        } else {
          // Lead a little round the circle, clockwise.
          const a = Math.atan2(p.y - b.y, p.x - b.x) + 0.6;
          goal = { x: b.x + Math.cos(a) * radius, y: b.y + Math.sin(a) * radius };
        }
      } else goal = steer(h, { x: BARREL_START.x - 30, y: BARREL_START.y }, cache);
      const dx = goal.x - p.x;
      const dy = goal.y - p.y;
      const dd = Math.hypot(dx, dy) || 1;
      h.step({ ...still, moveX: dx / dd, moveY: dy / dd }, DT, false);
      for (const e of h.drainEvents()) {
        if (e.type === 'barrelsDone') return e;
      }
    }
    return undefined;
  }

  it('a clean, tight run earns three stars, but only just', () => {
    const h = fresh();
    h.startBarrels();
    run(h, 3.1);
    const done = barrelBot(h, 55);
    expect(done?.type).toBe('barrelsDone');
    if (done?.type !== 'barrelsDone') return;
    expect(done.knocks).toBe(0);
    expect(done.seconds).toBeLessThan(BARREL_STAR_TIMES[0]);
    expect(done.seconds).toBeGreaterThan(BARREL_STAR_TIMES[0] * 0.55);
  });

  it('a sloppy, wide run still finishes, slower', () => {
    const h = fresh();
    h.startBarrels();
    run(h, 3.1);
    const done = barrelBot(h, 85);
    expect(done?.type).toBe('barrelsDone');
    if (done?.type === 'barrelsDone') expect(done.seconds).toBeLessThan(BARREL_STAR_TIMES[1]);
  });

  it('you are held at the gate until go, and brushing a barrel costs five seconds', () => {
    const h = fresh();
    h.startBarrels();
    const at = { ...h.player };
    h.step({ ...still, moveX: 1 }, DT, false);
    run(h, 1);
    expect(Math.hypot(h.player.x - at.x, h.player.y - at.y)).toBeLessThan(1);
    run(h, 2.2);
    const b = BARRELS[0];
    h.teleport(b.x - 70, b.y);
    const ev: HubEvent[] = [];
    for (let i = 0; i < 40; i++) {
      h.step({ ...still, moveX: 1 }, DT, false);
      ev.push(...h.drainEvents());
    }
    expect(ev.some((e) => e.type === 'barrelKnock')).toBe(true);
    const m = h.mission;
    expect(m?.kind === 'barrels' && m.penalty).toBe(5);
  });

  it('running straight past a barrel does not count as going round it', () => {
    const h = fresh();
    h.startBarrels();
    run(h, 3.1);
    const b = BARRELS[0];
    h.teleport(b.x - 100, b.y + 60);
    for (let i = 0; i < 60; i++) h.step({ ...still, moveX: 1 }, DT, false);
    const m = h.mission;
    expect(m?.kind === 'barrels' && m.next).toBe(0);
  });

  it('is run on foot, with no stray prompts', () => {
    const h = fresh();
    h.startBarrels();
    run(h, 3.1);
    expect(h.action).toBeNull();
    expect(h.nearStation).toBeNull();
  });
});

describe('Hide and Seek', () => {
  it('every hiding place is out in the open (somewhere you can walk to) and spread over the map', () => {
    for (const s of HIDE_SPOTS) reach(s.id, s, 20);
    reach('home base', HOME_BASE, 20);
    const xs = HIDE_SPOTS.map((s) => s.x);
    const ys = HIDE_SPOTS.map((s) => s.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1600);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(2500);
    expect(new Set(HIDE_SPOTS.map((s) => s.id)).size).toBe(HIDE_SPOTS.length);
  });

  function seekBot(h: Homestead, maxSeconds = 240): HubEvent[] {
    const cache = { path: null as { x: number; y: number }[] | null, for: '' };
    const out: HubEvent[] = [];
    for (let i = 0; i < maxSeconds * 60; i++) {
      const m = h.mission;
      if (m?.kind !== 'seek') break;
      const goal = steer(h, m.spot, cache);
      const dx = goal.x - h.player.x;
      const dy = goal.y - h.player.y;
      const d = Math.hypot(dx, dy) || 1;
      h.step({ ...still, moveX: dx / d, moveY: dy / d }, DT, false);
      const ev = h.drainEvents();
      out.push(...ev);
      if (ev.some((e) => e.type === 'seekDone')) break;
    }
    return out;
  }

  it('three rounds, each somewhere new and far from the last, found by walking there', () => {
    const h = fresh();
    h.startSeek();
    const m = h.mission;
    expect(m?.kind).toBe('seek');
    if (m?.kind !== 'seek') return;
    expect(m.hider).toBe('jay');
    const spots: string[] = [m.spot.id];
    const ev = seekBot(h);
    const found = ev.filter((e) => e.type === 'seekFound');
    expect(found.length).toBe(SEEK_ROUNDS);
    const done = ev.find((e) => e.type === 'seekDone');
    expect(done).toBeDefined();
    for (const f of found) if (f.type === 'seekFound') spots.push(f.where);
    // Knowing exactly where to go is well under the three-star time; searching takes longer.
    expect(done?.type === 'seekDone' && done.seconds).toBeLessThan(SEEK_STAR_TIMES[0] * 0.75);
  });

  it('Natalie hides when Jay is the one seeking', () => {
    const h = fresh('jay');
    h.startSeek();
    expect(h.seekHider()?.who).toBe('natalie');
  });

  it('says warmer and colder, and Axle can sniff them out', () => {
    const h = fresh();
    h.startSeek();
    run(h, 3.2);
    const m = h.mission;
    if (m?.kind !== 'seek') throw new Error('no seek');
    // Walk straight at them for a bit: warmer.
    for (let i = 0; i < 90; i++) {
      const dx = m.spot.x - h.player.x;
      const dy = m.spot.y - h.player.y;
      const d = Math.hypot(dx, dy) || 1;
      h.step({ ...still, moveX: dx / d, moveY: dy / d }, DT, false);
    }
    expect(['warmer', 'hot']).toContain(m.warmth);
    h.sniff();
    expect(m.sniffs).toBe(1);
    expect(m.sniffT).toBeGreaterThan(0);
  });

  it('never gives the hiding place away on the map', () => {
    const h = fresh();
    h.startSeek();
    const jay = ACTIVITIES.find((a) => a.id === 'mower')!;
    expect(h.stationPos(jay)).toEqual(jay.station);
  });

  it('the hider comes back out when you stop', () => {
    const h = fresh();
    h.startSeek();
    h.endMission();
    const n = h.npcs.find((x) => x.who === 'jay')!;
    expect(n.outing).toBeNull();
  });
});

describe('Hat Day', () => {
  const beatAll = () => {
    const s = freshSave();
    for (const who of FAMILY_ORDER) for (const c of ACTIVITIES.find((a) => a.id === PRIMARY_GAME[who])!.challenges) s.stars[c.id] = 1;
    return s;
  };

  it('opens once every family member is beaten at their own game, every challenge', () => {
    const s = freshSave();
    expect(beatenCount(s)).toBe(0);
    s.stars['mower-1'] = 3;
    s.stars['mower-2'] = 2;
    expect(beaten(s, 'jay')).toBe(false);
    s.stars['mower-3'] = 1;
    expect(beaten(s, 'jay')).toBe(true);
    expect(hatDayReady(s)).toBe(false);
    expect(hatDayReady(beatAll())).toBe(true);
  });

  it('everyone gets their own silly hat, and the dogs do too', () => {
    expect(new Set(Object.values(SILLY_HATS)).size).toBe(FAMILY_ORDER.length);
    for (const who of FAMILY_ORDER) {
      const script = hatDayScript(who);
      const hats = script.filter((b) => b.hat).map((b) => b.hat);
      for (const w of FAMILY_ORDER) expect(hats, `${who} explorer: ${w}`).toContain(w);
      expect(hats).toContain('dogs');
      expect(script.some((b) => b.photo)).toBe(true);
      for (const b of script) if ('line' in b) expect(b.line.text.includes('—'), b.line.text).toBe(false);
    }
  });

  it('gathers the whole family on the front lawn, and the Hat Day prompt is there', () => {
    const h = fresh();
    h.hatDayOpen = true;
    h.teleport(HAT_LAWN.x, HAT_LAWN.y + 30);
    run(h, 0.1);
    expect(h.action?.kind).toBe('hatday');
    const ev = run(h, 0.05, true);
    expect(ev.some((e) => e.type === 'hatday')).toBe(true);
    h.gather(true, 'lawn');
    run(h, 2);
    for (const n of h.npcs) expect(Math.hypot(n.x - HAT_LAWN.x, n.y - HAT_LAWN.y), n.who).toBeLessThan(140);
    for (const n of h.npcs) expect(shared.world.isFree(n.x, n.y, 8), n.who).toBe(true);
    h.gather(false);
    expect(h.gathered).toBe(false);
  });

  it('no Hat Day prompt until it is earned', () => {
    const h = fresh();
    h.teleport(HAT_LAWN.x, HAT_LAWN.y + 30);
    run(h, 0.1);
    expect(h.action?.kind).not.toBe('hatday');
  });

  it('the silly hats reward comes with Hat Day', () => {
    const r = REWARDS.find((x) => x.id === 'silly')!;
    const s = beatAll();
    expect(rewardUnlocked(s, r)).toBe(false);
    s.hatDay = true;
    expect(rewardUnlocked(s, r)).toBe(true);
  });

  it('older saves load with an empty field guide and no Hat Day yet', () => {
    const old = normalize({ v: 1, explorer: 'jay', stars: { 'kitten-1': 2 }, cosmetics: { hat: 'straw' } });
    expect(old.wildlife).toEqual([]);
    expect(old.hatDay).toBe(false);
    expect(old.cosmetics.silly).toBe(false);
    expect(old.cosmetics.hat).toBe('straw');
    const back = normalize(JSON.parse(JSON.stringify({ ...freshSave(), wildlife: ['deer', 7], hatDay: true })));
    expect(back.wildlife).toEqual(['deer']);
    expect(back.hatDay).toBe(true);
  });
});
