import { describe, expect, it } from 'vitest';
import { ACTIVITIES } from '../src/content/activities';
import { PLAYER_RADIUS } from '../src/games/kitten/player';
import { Homestead, NPC_ROUTINES, type HubEvent } from '../src/hub/homestead';
import { MOTO_PARKED, MOTO_ROUTE, MOW_LAP, MOWER_PARKED, PUTTING_GREEN, SPORT_SPOTS } from '../src/hub/family';
import { HUNT_ITEMS, ORNAMENTS, RACE_COURSE, RACE_GATES, RACE_START, RACE_STAR_TIMES, ROUNDS_TASKS } from '../src/hub/missions';
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
    h.teleport(1250, 1150);
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
    for (let i = 0; i < 400 * 60; i++) {
      h.step(still, DT, false);
      const g = h.npcs.find((n) => n.who === 'grandpa')!;
      if (!g.target) seen.add(g.stop.id);
      if (h.family.putt && h.family.putt.t < 0 && h.family.putt.t > -DT * 1.5) putts++;
      if (seen.size === 3 && putts > 0) break;
    }
    expect([...seen].sort()).toEqual(['frontYard', 'porch', 'putting']);
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
    expect(h.action?.label).toBe('Ride with Jason');
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

describe('scooter races', () => {
  /** Rides the course: straight at each gate, following the nav grid round anything in the way. */
  function raceBot(h: Homestead, maxSeconds = 120): HubEvent | undefined {
    h.player.maxSpeed = 390;
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
      done = h.drainEvents().find((e) => e.type === 'raceDone') ?? done;
    }
    return done;
  }

  it('the start line and every gate are on open ground you can reach', () => {
    const start = RACE_START;
    expect(shared.world.isFree(start.x, start.y, 14)).toBe(true);
    for (const g of RACE_GATES) {
      expect(shared.world.isFree(g.x, g.y, 14), `${g.x},${g.y}`).toBe(true);
      expect(walkerNav.reachable(start, g)).toBe(true);
    }
  });

  it('a good ride beats the rival and earns three stars; the rival beats a slow one', () => {
    const h = fresh();
    h.raceOpen = true;
    h.startRace();
    expect(h.raceRival()?.who).toBe('jay');
    run(h, 3.2);
    expect(h.mission?.kind === 'race' && h.mission.countdown <= 0).toBe(true);
    const done = raceBot(h);
    expect(done?.type).toBe('raceDone');
    if (done?.type !== 'raceDone') return;
    expect(done.won).toBe(true);
    expect(done.seconds).toBeLessThan(RACE_STAR_TIMES[0]);
    // Dawdling at the start: the rival gets home first.
    const slow = fresh();
    slow.startRace();
    run(slow, 30);
    const late = raceBot(slow);
    expect(late?.type === 'raceDone' && late.won).toBe(false);
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

  it('when racing as someone else, Natalie is the rival', () => {
    const h = new Homestead(shared, { explorer: 'jay', ornaments: [], discoveries: [], huntFound: [] });
    h.startRace();
    expect(h.raceRival()?.who).toBe('natalie');
  });
});
