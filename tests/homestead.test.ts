import { describe, expect, it } from 'vitest';
import { ACTIVITIES } from '../src/content/activities';
import { PLAYER_RADIUS } from '../src/games/kitten/player';
import { Homestead, NPC_ROUTINES, type HubEvent } from '../src/hub/homestead';
import { HUNT_ITEMS, ORNAMENTS, ROUNDS_TASKS } from '../src/hub/missions';
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
        const R = NPC_ROUTINES[n.who];
        expect(Math.hypot(n.x - n.home.x, n.y - n.home.y), n.who).toBeLessThanOrEqual(R.roam + 1);
        if (n.x !== n.px || n.y !== n.py) moved++;
        if (n.busyT > 0) gestures++;
      }
    }
    expect(moved).toBeGreaterThan(0);
    expect(gestures).toBeGreaterThan(0);
  });

  it('they come back to their spot and turn to you when you walk up', () => {
    const h = fresh();
    h.teleport(far.x, far.y);
    run(h, 30);
    const a = ACTIVITIES.find((x) => x.id === 'rounds')!;
    h.teleport(a.station.x + 90, a.station.y + 20);
    run(h, 2);
    const megan = h.npcs.find((n) => n.who === 'megan')!;
    expect(Math.hypot(megan.x - megan.home.x, megan.y - megan.home.y)).toBeLessThan(2);
    expect(megan.faceX).toBe(1);
    expect(megan.busyT).toBe(0);
    expect(h.nearStation?.id).toBe('rounds');
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
