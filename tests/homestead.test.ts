import { describe, expect, it } from 'vitest';
import { ACTIVITIES } from '../src/content/activities';
import { PLAYER_RADIUS } from '../src/games/kitten/player';
import { Homestead, NPC_ROUTINES, PATH_BOOST, ROOF_PERCH, TRAMPOLINE, TREEHOUSE_PERCHES, type HubEvent } from '../src/hub/homestead';
import { MOTO_PARKED, MOTO_ROUTE, MOW_LAP, MOWER_PARKED, PUTTING_GREEN, SPORT_SPOTS } from '../src/hub/family';
import { HUNT_ITEMS, ORNAMENTS, PUDDLES, RACE_COURSE, RACE_GATES, RACE_START, RAMPS, ROUNDS_TASKS } from '../src/hub/missions';
import { RIDE_IDS, RIDES, type RideId } from '../src/content/rides';
import { PORCH_TREE } from '../src/hub/hubView';
import { NavGrid } from '../src/world/navgrid';
import { sharedWorld } from '../src/world/shared';

const DT = 1 / 60;
const shared = sharedWorld();
const walkerNav = new NavGrid(shared.world, 16, PLAYER_RADIUS);
const still = { moveX: 0, moveY: 0, whistle: false, treat: false };

function fresh(): Homestead {
  return new Homestead(shared, { explorer: 'natalie', ornaments: [], discoveries: [], huntFound: [] });
}

function run(h: Homestead, seconds: number, act = false): HubEvent[] {
  const out: HubEvent[] = [];
  for (let i = 0; i < seconds * 60; i++) {
    h.step(still, DT, act && i === 0);
    out.push(...h.drainEvents());
  }
  return out;
}

describe('homestead layout', () => {
  const start = fresh().startPoint();

  it('starts the explorer on open ground', () => {
    expect(shared.world.isFree(start.x, start.y, PLAYER_RADIUS)).toBe(true);
  });

  const reach = (label: string, p: { x: number; y: number }, within: number) => {
    const spot = walkerNav.isWalkable(p.x, p.y) ? p : walkerNav.nearestWalkable(p.x, p.y, 6);
    expect(spot, `${label} has no walkable spot`).not.toBeNull();
    expect(Math.hypot(spot!.x - p.x, spot!.y - p.y), `${label} too far from walkable ground`).toBeLessThan(within);
    expect(walkerNav.reachable(start, spot!), `${label} unreachable`).toBe(true);
  };

  it('lets you walk up to every family member', () => {
    for (const a of ACTIVITIES) reach(a.id, a.station, 40);
  });

  it('puts every ornament, hunt item and chore somewhere you can reach', () => {
    for (const o of ORNAMENTS) reach(o.id, o, 30);
    for (const h of HUNT_ITEMS) reach(h.id, h, 40);
    for (const t of ROUNDS_TASKS) reach(t.id, t, 50);
  });

  it('keeps stations apart so prompts never overlap', () => {
    for (const a of ACTIVITIES)
      for (const b of ACTIVITIES) if (a !== b) expect(Math.hypot(a.station.x - b.station.x, a.station.y - b.station.y), `${a.id}/${b.id}`).toBeGreaterThan(260);
  });

  it("keeps Grandpa's porch tree in his yard", () => {
    const yard = shared.map.fences.find((f) => f.style === 'picket')!;
    expect(PORCH_TREE.y).toBeGreaterThan(670);
    expect(PORCH_TREE.y).toBeLessThan(yard.points[1][1]);
  });
});

describe('homestead life', () => {
  it('shows the prompt for an activity when you walk up to it', () => {
    const h = fresh();
    const a = ACTIVITIES.find((x) => x.id === 'mower')!;
    h.teleport(a.station.x, a.station.y + 40);
    run(h, 0.1);
    expect(h.nearStation?.id).toBe('mower');
  });

  it('dogs follow along and fetch a thrown ball', () => {
    const h = fresh();
    h.teleport(1300, 1450);
    run(h, 2);
    for (const d of h.dogs) expect(Math.hypot(d.x - h.player.x, d.y - h.player.y)).toBeLessThan(140);
    expect(h.action?.kind).toBe('ball');
    const events = run(h, 8, true);
    expect(events.some((e) => e.type === 'throw')).toBe(true);
    expect(events.some((e) => e.type === 'fetched')).toBe(true);
    expect(h.ball).toBeNull();
  });

  it('donkeys come for a carrot (eventually)', () => {
    const h = fresh();
    h.teleport(h.pen.x + h.pen.r + 40, h.pen.y);
    run(h, 0.2);
    expect(h.action?.kind).toBe('carrot');
    let ate = false;
    for (let tries = 0; tries < 6 && !ate; tries++) {
      const ev = run(h, 7, true);
      ate = ev.some((e) => e.type === 'carrot' && e.ok);
    }
    expect(ate).toBe(true);
  });

  it('petting a cat gets a reaction', () => {
    const h = fresh();
    const c = h.cats[0];
    h.teleport(c.x + 30, c.y + 10);
    run(h, 0.1);
    expect(h.action?.kind).toBe('pet');
    const ev = run(h, 0.5, true);
    expect(ev.some((e) => e.type === 'pet')).toBe(true);
  });

  it('collects ornaments by walking over them', () => {
    const h = fresh();
    const o = ORNAMENTS[0];
    h.teleport(o.x, o.y);
    const ev = run(h, 0.1);
    expect(ev.some((e) => e.type === 'ornament' && e.id === o.id)).toBe(true);
    expect(h.ornaments.has(o.id)).toBe(true);
  });

  it("Megan's Morning Rounds can be finished, with eggs before the kitchen", () => {
    const h = fresh();
    h.startRounds();
    const kitchen = ROUNDS_TASKS.find((t) => t.id === 'kitchen')!;
    h.teleport(kitchen.x, kitchen.y);
    run(h, 0.1);
    expect(h.action).toBeNull();
    let done: HubEvent | undefined;
    for (const t of [...ROUNDS_TASKS.filter((x) => x.id !== 'kitchen'), kitchen]) {
      h.teleport(t.x, t.y);
      run(h, 0.1);
      expect(h.action?.kind, t.id).toBe('task');
      const ev = run(h, 1.2, true);
      done = ev.find((e) => e.type === 'roundsDone') ?? done;
    }
    expect(done).toBeDefined();
    expect(done!.type === 'roundsDone' && done!.stars).toBe(3);
  });

  it("Grandpa's hunt goes item by item until it's ready for the lockbox", () => {
    const h = fresh();
    h.startHunt();
    let ready = false;
    for (const item of HUNT_ITEMS) {
      h.teleport(item.x, item.y);
      run(h, 0.1);
      expect(h.action?.kind, item.id).toBe('pickup');
      const ev = run(h, 0.2, true);
      expect(ev.some((e) => e.type === 'huntItem' && e.id === item.id)).toBe(true);
      ready = ev.some((e) => e.type === 'huntReady') || ready;
    }
    expect(ready).toBe(true);
    expect(h.mission?.kind === 'hunt' && h.mission.ready).toBe(true);
  });

  it('hints point at the current hunt item and are counted', () => {
    const h = fresh();
    h.startHunt();
    h.useHint();
    expect(h.mission?.kind === 'hunt' && h.mission.hints).toBe(1);
    expect(h.huntTarget()).toEqual(HUNT_ITEMS[0]);
  });
});

describe('living ranch', () => {
  const far = { x: 1250, y: 1150 };

  it('family members keep busy near their spot while you are away', () => {
    const h = fresh();
    h.teleport(far.x, far.y);
    let moved = 0;
    let gestures = 0;
    for (let i = 0; i < 40 * 60; i++) {
      h.step(still, DT, false);
      for (const n of h.npcs) {
        // Settled somewhere, they stay close to that spot.
        if (!n.target && !n.outing) expect(Math.hypot(n.x - n.stop.at.x, n.y - n.stop.at.y), n.who).toBeLessThanOrEqual(n.stop.roam + 1);
        if (n.x !== n.px || n.y !== n.py) moved++;
        if (n.busyT > 0) gestures++;
      }
    }
    expect(moved).toBeGreaterThan(0);
    expect(gestures).toBeGreaterThan(0);
  });

  it('they stop and turn to you when you walk up, wherever they are', () => {
    const h = fresh();
    h.teleport(far.x, far.y);
    run(h, 30);
    for (const who of ['megan', 'grandpa'] as const) {
      const n = h.npcs.find((x) => x.who === who)!;
      h.teleport(n.x + 60, n.y + 20);
      run(h, 1);
      const at = { x: n.x, y: n.y };
      run(h, 2);
      expect(n.attending, who).toBe(true);
      expect(Math.hypot(n.x - at.x, n.y - at.y), who).toBeLessThan(1);
      expect(n.faceX, who).toBe(h.player.x >= n.x ? 1 : -1);
      expect(h.nearStation?.who, who).toBe(who);
    }
  });

  it('cheers after you play their game', () => {
    const h = fresh();
    h.celebrate('jay');
    expect(h.npcs.find((n) => n.who === 'jay')!.cheerT).toBeGreaterThan(0);
    run(h, 3);
    expect(h.npcs.find((n) => n.who === 'jay')!.cheerT).toBe(0);
  });

  it('cats wander between their favourite spots on their own', () => {
    const h = fresh();
    h.teleport(far.x, far.y);
    const start = h.cats.map((c) => c.spot);
    run(h, 70);
    const moved = h.cats.filter((c, i) => c.spot !== start[i] && c.personality !== 'sleepy');
    expect(moved.length).toBeGreaterThan(0);
  });

  it('a cat you are standing next to stays put to be petted', () => {
    const h = fresh();
    const c = h.cats.find((x) => x.personality === 'distractible')!;
    h.teleport(c.x + 30, c.y + 10);
    run(h, 40);
    expect(c.state).toBe('rest');
    expect(h.action?.kind).toBe('pet');
  });

  it('a donkey wanders over when you stand at the pen fence', () => {
    const h = fresh();
    h.teleport(h.pen.x + h.pen.r + 40, h.pen.y);
    const ev = run(h, 10);
    expect(ev.some((e) => e.type === 'carrot')).toBe(false);
    const chewy = h.donkeys.find((d) => d.def.id === 'chewy')!;
    expect(chewy.state === 'watch' || chewy.state === 'greet').toBe(true);
    expect(Math.hypot(chewy.x - h.player.x, chewy.y - h.player.y)).toBeLessThan(110);
    // Carrots still work while they're at the fence.
    expect(h.action?.kind).toBe('carrot');
  });

  it('dogs go off sniffing when you stand still, and come back when you move', () => {
    const h = fresh();
    h.teleport(far.x, far.y);
    let sniffed = false;
    for (let i = 0; i < 40 * 60 && !sniffed; i++) {
      h.step(still, DT, false);
      sniffed = h.dogs.some((d) => d.state === 'sniff');
    }
    expect(sniffed).toBe(true);
    h.step({ ...still, moveX: 1 }, DT, false);
    h.step({ ...still, moveX: 1 }, DT, false);
    expect(h.dogs.every((d) => d.state === 'follow')).toBe(true);
  });

  it('everyone sits still at Sunday breakfast', () => {
    const h = fresh();
    h.gather(true);
    const seats = h.npcs.map((n) => ({ x: n.x, y: n.y }));
    run(h, 20);
    h.npcs.forEach((n, i) => expect(Math.hypot(n.x - seats[i].x, n.y - seats[i].y), n.who).toBeLessThan(1));
    expect(h.dogs.every((d) => d.state === 'rest')).toBe(true);
  });
});

describe('family outings', () => {
  const far = { x: 1250, y: 1700 };
  const world = shared.world;

  it("everyone's spots, Megan's mower lap and the catch spots are on open ground", () => {
    for (const stops of Object.values(NPC_ROUTINES))
      for (const s of stops) {
        expect(world.isFree(s.at.x, s.at.y, 10), s.id).toBe(true);
        expect(walkerNav.reachable(stops[0].at, s.at), s.id).toBe(true);
      }
    for (const p of Object.values(SPORT_SPOTS)) expect(world.isFree(p.x, p.y, 10)).toBe(true);
    const lap = [MOWER_PARKED, ...MOW_LAP, MOW_LAP[0]];
    for (let i = 0; i < lap.length - 1; i++) expect(world.clearPath(lap[i].x, lap[i].y, lap[i + 1].x, lap[i + 1].y, 16), `lap leg ${i}`).toBe(true);
    expect(world.clearPath(MOW_LAP[MOW_LAP.length - 1].x, MOW_LAP[MOW_LAP.length - 1].y, MOWER_PARKED.x, MOWER_PARKED.y, 16)).toBe(true);
  });

  it('Grandpa works the front yard and putts out back', () => {
    const h = fresh();
    h.teleport(far.x, far.y);
    const seen = new Set<string>();
    let putts = 0;
    for (let i = 0; i < 900 * 60; i++) {
      h.step(still, DT, false);
      const g = h.npcs.find((n) => n.who === 'grandpa')!;
      if (!g.target) seen.add(g.stop.id);
      if (h.family.putt && h.family.putt.t < 0 && h.family.putt.t > -DT * 1.5) putts++;
      if (seen.size === 5 && putts > 0) break;
    }
    expect([...seen].sort()).toEqual(['backBeds', 'frontBeds', 'frontYard', 'porch', 'putting']);
    expect(putts).toBeGreaterThan(0);
    expect(PUTTING_GREEN.x).toBeLessThan(2020);
  });

  it('Megan takes the mower round the north lawn and parks it back', () => {
    const h = fresh();
    h.teleport(far.x, far.y);
    let rode = false;
    let parked = false;
    for (let i = 0; i < 600 * 60 && !parked; i++) {
      h.step(still, DT, false);
      if (h.family.mow?.phase === 'ride') rode = true;
      if (rode && !h.family.mow) parked = true;
    }
    expect(rode).toBe(true);
    expect(parked).toBe(true);
  });

  it('Jay and Jason meet up to practise football, baseball and soccer', () => {
    const h = fresh();
    h.teleport(far.x, far.y);
    const sports = new Set<string>();
    let passes = 0;
    for (let i = 0; i < 900 * 60 && sports.size < 3; i++) {
      const before = h.family.sport?.flying;
      h.step(still, DT, false);
      const s = h.family.sport;
      if (s?.phase === 'play') sports.add(s.sport);
      if (!before && s?.flying) passes++;
    }
    expect([...sports].sort()).toEqual(['baseball', 'football', 'soccer']);
    expect(passes).toBeGreaterThan(6);
  });

  it("the chihuahuas never leave Grandpa's back yard, and go in and out the doggie door", () => {
    const h = fresh();
    h.teleport(1700, 860);
    let inside = 0;
    for (let i = 0; i < 240 * 60; i++) {
      // Wander past the fence, then stand in the yard, then leave.
      if (i === 60 * 60) h.teleport(1800, 740);
      if (i === 90 * 60) h.teleport(far.x, far.y);
      h.step(still, DT, false);
      for (const d of h.pups) {
        if (d.state === 'inside') {
          inside++;
          continue;
        }
        expect(d.x).toBeGreaterThanOrEqual(1380);
        expect(d.x).toBeLessThanOrEqual(2006);
        expect(d.y).toBeGreaterThanOrEqual(684);
        expect(d.y).toBeLessThanOrEqual(780);
      }
    }
    expect(inside).toBeGreaterThan(0);
  });

  it('the chihuahuas yap at you from the fence, and can be petted', () => {
    const h = fresh();
    h.teleport(1700, 830);
    const ev = run(h, 4);
    expect(ev.some((e) => e.type === 'yip')).toBe(true);
    const d = h.pups[0];
    h.teleport(d.x, d.y + 30);
    run(h, 0.1);
    expect(h.action?.kind === 'pup' || h.action?.kind === 'pet').toBe(true);
  });

  it('Sunday breakfast calls everything off and everyone sits down', () => {
    const h = fresh();
    h.teleport(far.x, far.y);
    for (let i = 0; i < 300 * 60 && !(h.family.mow || h.family.sport); i++) h.step(still, DT, false);
    h.gather(true);
    expect(h.family.mow).toBeNull();
    expect(h.family.sport).toBeNull();
    expect(h.npcs.every((n) => !n.outing && !n.target)).toBe(true);
  });
});

describe("Jason's motorcycle", () => {
  it('the route stays on open ground the whole way round', () => {
    const pts = [MOTO_PARKED, ...MOTO_ROUTE, MOTO_PARKED];
    for (let i = 0; i < pts.length - 1; i++) expect(shared.world.clearPath(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 10), `leg ${i}`).toBe(true);
  });

  it('Jason and Natalie head out together and park it back', () => {
    const h = new Homestead(shared, { explorer: 'megan', ornaments: [], discoveries: [], huntFound: [] });
    h.teleport(1250, 1700);
    let rode = false;
    let done = false;
    for (let i = 0; i < 600 * 60 && !done; i++) {
      h.step(still, DT, false);
      const m = h.family.moto;
      if (m?.phase === 'ride') {
        rode = true;
        const riders = h.npcs.filter((n) => n.outing === 'moto').map((n) => n.who).sort();
        expect(riders).toEqual(['jason', 'natalie']);
      }
      if (rode && !m) done = true;
    }
    expect(rode).toBe(true);
    expect(done).toBe(true);
  });

  it('Natalie can ride along with Jason, and hop off', () => {
    const h = fresh();
    h.teleport(MOTO_PARKED.x, MOTO_PARKED.y + 30);
    run(h, 0.2);
    expect(h.action?.kind).toBe('moto');
    expect(h.action?.label).toBe('Ride with Dad');
    run(h, 0.1, true);
    expect(h.family.moto?.player).toBe('passenger');
    // Jason walks over from the woodpile, then off they go.
    for (let i = 0; i < 60 * 60 && h.family.moto?.phase !== 'ride'; i++) h.step(still, DT, false);
    expect(h.family.moto?.phase).toBe('ride');
    run(h, 4);
    const m = h.family.moto!;
    expect(Math.hypot(h.player.x - m.x, h.player.y - m.y)).toBeLessThan(1);
    expect(Math.hypot(m.x - MOTO_PARKED.x, m.y - MOTO_PARKED.y)).toBeGreaterThan(200);
    expect(h.action?.label).toBe('Hop off');
    run(h, 0.1, true);
    expect(h.family.moto?.player ?? null).toBeNull();
    expect(shared.world.isFree(h.player.x, h.player.y, 8)).toBe(true);
  });
});

describe('races on the Loop', () => {
  /** Rides the course: straight at each gate, following the nav grid round anything in the way. */
  function raceBot(h: Homestead, ride: RideId, maxSeconds = 120): HubEvent | undefined {
    h.ride = ride;
    h.player.maxSpeed = RIDES[ride].speed;
    h.player.accel = RIDES[ride].accel;
    let done: HubEvent | undefined;
    let path: { x: number; y: number }[] | null = null;
    let pathGate = -1;
    for (let i = 0; i < maxSeconds * 60 && !done; i++) {
      const m = h.mission;
      if (m?.kind !== 'race') break;
      const g = RACE_COURSE[m.gate];
      const p = h.player;
      let goal = g;
      if (!shared.world.clearPath(p.x, p.y, g.x, g.y, 12)) {
        if (pathGate !== m.gate || !path) {
          path = walkerNav.findPath(p, g, 20000);
          pathGate = m.gate;
        }
        while (path && path.length > 1 && Math.hypot(path[0].x - p.x, path[0].y - p.y) < 20) path.shift();
        if (path?.length) goal = path[0];
      } else path = null;
      const dx = goal.x - p.x;
      const dy = goal.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      h.step({ ...still, moveX: dx / d, moveY: dy / d }, DT, false);
      for (const e of h.drainEvents()) if (e.type === 'raceDone') done = e;
    }
    return done;
  }

  it('the Loop is one circuit on open ground, every stretch clear to ride straight down', () => {
    expect(RACE_GATES[RACE_GATES.length - 1]).toBe(RACE_START);
    for (let i = 0; i < RACE_GATES.length; i++) {
      const a = RACE_GATES[i];
      const b = RACE_GATES[(i + 1) % RACE_GATES.length];
      expect(shared.world.isFree(a.x, a.y, 14), `${a.x},${a.y}`).toBe(true);
      expect(shared.world.clearPath(a.x, a.y, b.x, b.y, PLAYER_RADIUS), `${a.x},${a.y} to ${b.x},${b.y}`).toBe(true);
    }
    // The ramps sit on the track.
    for (const r of RAMPS) expect(RACE_GATES.some((g, i) => {
      const n = RACE_GATES[(i + 1) % RACE_GATES.length];
      const t = ((r.x - g.x) * (n.x - g.x) + (r.y - g.y) * (n.y - g.y)) / ((n.x - g.x) ** 2 + (n.y - g.y) ** 2);
      return t > 0 && t < 1 && Math.hypot(g.x + (n.x - g.x) * t - r.x, g.y + (n.y - g.y) * t - r.y) < 4;
    })).toBe(true);
  });

  for (const id of RIDE_IDS) {
    it(`${id}: a good ride beats the rival for three stars; the rival beats a slow one`, () => {
      const ride = RIDES[id];
      const h = fresh();
      h.raceOpen = true;
      h.startRace(id);
      expect(h.raceRival()?.who).toBe(ride.owner === 'natalie' ? 'jay' : ride.owner);
      run(h, 3.2);
      const done = raceBot(h, id);
      expect(done?.type).toBe('raceDone');
      if (done?.type !== 'raceDone') return;
      expect(done.ride).toBe(id);
      expect(done.won).toBe(true);
      expect(done.seconds).toBeLessThan(ride.starTimes[0]);
      // Not by a mile, though: the three-star time still takes a clean ride.
      expect(done.seconds).toBeGreaterThan(ride.starTimes[0] * 0.75);
      // Dawdling at the start: the rival gets home first.
      const slow = fresh();
      slow.startRace(id);
      run(slow, 3.2 + 10);
      const late = raceBot(slow, id);
      expect(late?.type === 'raceDone' && late.won).toBe(false);
    });
  }

  it('ramps put you in the air on a ride, never on foot', () => {
    const h = fresh();
    const r = RAMPS[0];
    h.teleport(r.x, r.y - 60);
    h.ride = 'truck';
    h.player.maxSpeed = RIDES.truck.speed;
    let hop = false;
    for (let i = 0; i < 60 && !hop; i++) {
      h.step({ ...still, moveY: 1 }, DT, false);
      hop = h.drainEvents().some((e) => e.type === 'hop');
    }
    expect(hop).toBe(true);
    run(h, 0.3);
    expect(h.airLift()).toBeGreaterThan(10);
    const w = fresh();
    w.teleport(r.x, r.y - 60);
    for (let i = 0; i < 60; i++) w.step({ ...still, moveY: 1 }, DT, false);
    expect(w.drainEvents().some((e) => e.type === 'hop')).toBe(false);
  });

  it("you're held at the line until go, then the rival heads home after", () => {
    const h = fresh();
    h.startRace();
    const at = { x: h.player.x, y: h.player.y };
    for (let i = 0; i < 60; i++) h.step({ ...still, moveX: 1 }, DT, false);
    expect(Math.hypot(h.player.x - at.x, h.player.y - at.y)).toBeLessThan(0.5);
    h.endMission();
    expect(h.npcs.every((n) => n.outing !== 'race')).toBe(true);
  });

  it('you race whoever owns the ride, or a stand-in when it is yours', () => {
    const asJay = new Homestead(shared, { explorer: 'jay', ornaments: [], discoveries: [], huntFound: [] });
    asJay.startRace('scooter');
    expect(asJay.raceRival()?.who).toBe('natalie');
    asJay.startRace('truck');
    expect(asJay.raceRival()?.who).toBe('jason');
    const asMegan = new Homestead(shared, { explorer: 'megan', ornaments: [], discoveries: [], huntFound: [] });
    asMegan.startRace('rider');
    expect(asMegan.raceRival()?.who).toBe('grandpa');
    asMegan.startRace('dirtbike');
    expect(asMegan.raceRival()?.who).toBe('jason');
    const asGrandpa = new Homestead(shared, { explorer: 'grandpa', ornaments: [], discoveries: [], huntFound: [] });
    asGrandpa.startRace('golfcart');
    expect(asGrandpa.raceRival()?.who).toBe('natalie');
    asMegan.startRace('golfcart');
    expect(asMegan.raceRival()?.who).toBe('grandpa');
  });

  it('a corner cut a little fine still counts the next gate', () => {
    const h = fresh();
    h.startRace();
    run(h, 3.2);
    const m = h.mission!;
    if (m.kind !== 'race') return;
    // Straight to the second gate, skipping the first.
    h.teleport(RACE_COURSE[1].x, RACE_COURSE[1].y);
    run(h, 0.05);
    expect(m.gate).toBe(2);
    // But never two at once.
    h.teleport(RACE_COURSE[4].x, RACE_COURSE[4].y);
    run(h, 0.05);
    expect(m.gate).toBe(2);
  });
});

describe('Grandpa and snakes', () => {
  it('a snake near Grandpa sends him hurrying back to his porch, and Axel chases it off', () => {
    const h = fresh();
    const g = h.npcs.find((n) => n.who === 'grandpa')!;
    const front = NPC_ROUTINES.grandpa.find((s) => s.id === 'frontYard')!;
    g.stop = front;
    g.x = g.px = front.at.x;
    g.y = g.py = front.at.y;
    g.stayT = 999;
    // Stand nearby (but not close enough for a chat) so the snake turns up where you'd see it.
    h.teleport(front.at.x - 260, front.at.y + 120);
    h.snakeT = 0;
    let scare: HubEvent | undefined;
    for (let i = 0; i < 20 * 60 && !scare; i++) {
      h.step(still, DT, false);
      scare = h.drainEvents().find((e) => e.type === 'snake') ?? scare;
    }
    expect(scare).toBeDefined();
    expect(g.spookT).toBeGreaterThan(0);
    expect(g.stop.id).toBe('porch');
    expect(h.dogs.find((d) => d.def.id === 'axel')!.state).toBe('chase');
    // A few seconds later: no snake, Axel back at heel, Grandpa on his way home.
    run(h, 16);
    expect(h.snake).toBeNull();
    expect(h.dogs.every((d) => d.state !== 'chase')).toBe(true);
  });

  it('snakes only turn up while Grandpa is out in his yard', () => {
    const h = fresh();
    h.snakeT = 0;
    h.teleport(1625, 900);
    run(h, 5);
    const g = h.npcs.find((n) => n.who === 'grandpa')!;
    if (g.stop.id === 'porch') expect(h.snake).toBeNull();
  });
});

describe('the chicken run and Blue Star', () => {
  it('the chicken run sits in the clearing south-east of the treehouse, with Megan beside it', () => {
    const run = shared.map.pens.find((p) => p.role === 'chickens')!;
    const tree = shared.map.props.find((p) => p.kind === 'treehouse')!;
    expect(run.x).toBeGreaterThan(tree.x);
    expect(run.y).toBeGreaterThan(tree.y);
    const megan = ACTIVITIES.find((a) => a.who === 'megan')!.station;
    expect(Math.hypot(megan.x - run.x, megan.y - run.y)).toBeLessThan(run.r + 110);
    const eggs = ROUNDS_TASKS.find((t) => t.id === 'eggs')!;
    expect(Math.hypot(eggs.x - run.x, eggs.y - run.y)).toBeLessThan(run.r + 40);
  });

  it('Jay and Jason play catch where the coop used to be', () => {
    expect(SPORT_SPOTS.jay.x).toBeLessThan(600);
    expect(SPORT_SPOTS.jay.y).toBeLessThan(500);
  });

  it('walking up to the workshop under the blue star tells you about Blue Star', () => {
    const h = fresh();
    const d = shared.map.discoveries.find((x) => x.id === 'blueStar')!;
    h.teleport(d.x, d.y + 20);
    const ev = run(h, 0.2);
    const found = ev.find((e) => e.type === 'discover' && e.id === 'blueStar');
    expect(found?.type === 'discover' && found.text).toContain('Blue Star');
  });
});

describe('Annie and the skunk', () => {
  it('Annie chases a skunk, gets sprayed, and comes back smelling of it', () => {
    const h = fresh();
    h.teleport(1250, 1500);
    run(h, 2);
    h.skunkT = 0;
    let sprayed: HubEvent | undefined;
    for (let i = 0; i < 20 * 60 && !sprayed; i++) {
      h.step(still, DT, false);
      if (i === 1) expect(h.dogs.find((d) => d.def.id === 'annie')!.state).toBe('skunk');
      sprayed = h.drainEvents().find((e) => e.type === 'skunk') ?? sprayed;
    }
    expect(sprayed).toBeDefined();
    const annie = h.dogs.find((d) => d.def.id === 'annie')!;
    expect(annie.stinkT).toBeGreaterThan(20);
    expect(annie.state).toBe('follow');
    // The skunk strolls off; Annie stays smelly a good while, but not forever.
    run(h, 8);
    expect(h.skunk).toBeNull();
    expect(annie.stinkT).toBeGreaterThan(0);
    run(h, 30);
    expect(annie.stinkT).toBe(0);
  });

  it('no skunks during Sunday breakfast or a mission', () => {
    const h = fresh();
    h.gather(true);
    h.skunkT = 0;
    run(h, 3);
    expect(h.skunk).toBeNull();
  });
});

describe('Putt-Putt on the homestead', () => {
  it("starts at Grandpa's putting green, which you can walk to", () => {
    const a = ACTIVITIES.find((x) => x.id === 'putt')!;
    expect(a.who).toBe('grandpa');
    expect(Math.hypot(a.station.x - PUTTING_GREEN.x, a.station.y - PUTTING_GREEN.y)).toBeLessThan(60);
    const h = fresh();
    h.teleport(a.station.x, a.station.y + 30);
    run(h, 0.1);
    expect(h.nearStation?.id).toBe('putt');
  });
});

describe('trampoline', () => {
  it('you can walk onto it and bounce, and tap Jump! for a big one', () => {
    const h = fresh();
    expect(shared.world.isFree(TRAMPOLINE.x, TRAMPOLINE.y, PLAYER_RADIUS)).toBe(true);
    h.teleport(TRAMPOLINE.x, TRAMPOLINE.y);
    run(h, 0.3);
    expect(h.onTrampoline).toBe(true);
    expect(h.action?.kind).toBe('jump');
    expect(h.trampolineLift()).toBeGreaterThanOrEqual(TRAMPOLINE.mat);
    const ev = run(h, 0.45, true);
    expect(ev.some((e) => e.type === 'boing')).toBe(true);
    expect(h.trampolineLift()).toBeGreaterThan(TRAMPOLINE.mat + 40);
    h.teleport(TRAMPOLINE.x, TRAMPOLINE.y + 120);
    run(h, 0.1);
    expect(h.trampolineLift()).toBe(0);
  });
});

describe('cats and dogs', () => {
  it('most of the barn cats live in and around the treehouse, and one likes the roof', () => {
    const h = fresh();
    const tree = shared.map.props.find((p) => p.kind === 'treehouse')!;
    const around = h.cats.filter((c) => c.spots.some((s) => Math.hypot(s.x - tree.x, s.y - tree.y) < 150));
    expect(around.length).toBeGreaterThanOrEqual(4);
    expect(h.cats.some((c) => c.spots.includes(ROOF_PERCH))).toBe(true);
    for (const c of h.cats) for (const s of c.spots) expect(walkerNav.isWalkable(s.x, s.y) || walkerNav.nearestWalkable(s.x, s.y, 3) !== null, `${c.name}`).toBe(true);
  });

  it('a cat climbs up onto the roof and back down', () => {
    const h = fresh();
    const z = h.cats.find((c) => c.name === 'Ziggy')!;
    h.teleport(1250, 1700);
    z.state = 'walk';
    z.target = ROOF_PERCH;
    run(h, 8);
    expect(z.lift).toBe(ROOF_PERCH.lift);
    z.state = 'walk';
    z.target = z.spots[0];
    run(h, 6);
    expect(z.lift).toBe(0);
  });

  it('a dog chases a cat, the cat escapes up the treehouse, the dog barks up at it and gives up', () => {
    const h = fresh();
    const w = h.cats.find((c) => c.name === 'Waffles')!;
    h.teleport(w.x + 120, w.y + 60);
    run(h, 1.5);
    h.catChaseT = 0;
    let chase: HubEvent | undefined;
    for (let i = 0; i < 120 && !chase; i++) {
      h.step(still, DT, false);
      chase = h.drainEvents().find((e) => e.type === 'catChase') ?? chase;
    }
    expect(chase).toBeDefined();
    const dog = h.dogs.find((d) => d.state === 'cat')!;
    const cat = h.cats.find((c) => c.id === dog.chaseCat)!;
    expect(cat.state).toBe('flee');
    let treed = false;
    for (let i = 0; i < 15 * 60; i++) {
      h.step(still, DT, false);
      if (dog.state === 'treed') treed = true;
      if (treed && dog.state === 'follow') break;
    }
    expect(treed).toBe(true);
    expect(cat.lift).toBeGreaterThan(60);
    expect(TREEHOUSE_PERCHES.some((s) => Math.hypot(s.x - cat.x, s.y - cat.y) < 8)).toBe(true);
    expect(dog.state).toBe('follow');
    // It stays up there a while, then comes home.
    expect(cat.refuge).toBe(true);
  });

  it('cats up high cannot be petted', () => {
    const h = fresh();
    const tater = h.cats.find((c) => c.name === 'Tater')!;
    expect(tater.lift).toBeGreaterThan(0);
    h.teleport(tater.x + 20, tater.y + 30);
    run(h, 0.1);
    expect(h.action?.kind === 'pet' && h.action.cat === tater).toBe(false);
  });
});

describe("Grandpa's flower beds", () => {
  it('Grandpa waters the beds round his house, can in hand', () => {
    const h = fresh();
    h.teleport(1250, 1700);
    const g = h.npcs.find((n) => n.who === 'grandpa')!;
    let watered = false;
    for (let i = 0; i < 400 * 60 && !watered; i++) {
      h.step(still, DT, false);
      watered = g.gesture === 'water' && g.busyT > 0 && g.hold === 'can';
    }
    expect(watered).toBe(true);
    const beds = shared.map.props.filter((p) => p.kind === 'flowers' && Math.hypot(p.x - 1700, p.y - 560) < 340);
    expect(beds.length).toBeGreaterThanOrEqual(5);
  });
});

describe('getting around', () => {
  it('paths and roads are a little quicker on foot', () => {
    const h = fresh();
    h.teleport(1060, 1330);
    expect(h.isOnPath(h.player.x, h.player.y)).toBe(true);
    run(h, 0.1);
    expect(h.player.maxSpeed).toBeCloseTo(260 * PATH_BOOST);
    h.teleport(1500, 1000);
    run(h, 0.1);
    expect(h.isOnPath(h.player.x, h.player.y)).toBe(false);
    expect(h.player.maxSpeed).toBe(260);
  });

  it('running through a puddle makes a splash', () => {
    const h = fresh();
    const q = PUDDLES[0];
    h.teleport(q.x - 60, q.y);
    let splash = false;
    for (let i = 0; i < 60 && !splash; i++) {
      h.step({ ...still, moveX: 1 }, DT, false);
      splash = h.drainEvents().some((e) => e.type === 'splash');
    }
    expect(splash).toBe(true);
  });

  it('birds and rabbits take off when you come close, and come back later', () => {
    const h = fresh();
    const bird = h.critters.find((c) => c.kind === 'bird')!;
    h.teleport(bird.home.x - 200, bird.home.y + 20);
    run(h, 0.5);
    expect(bird.state).toBe('idle');
    h.teleport(bird.x - 40, bird.y);
    run(h, 0.2);
    expect(bird.state).toBe('flee');
    h.teleport(200, 2900);
    run(h, 40);
    expect(bird.state).toBe('idle');
    expect(Math.hypot(bird.x - bird.home.x, bird.y - bird.home.y)).toBeLessThan(80);
    // Butterflies stay with their flowers.
    const fly = h.critters.find((c) => c.kind === 'butterfly')!;
    expect(Math.hypot(fly.x - fly.home.x, fly.y - fly.home.y)).toBeLessThan(45);
  });
});
