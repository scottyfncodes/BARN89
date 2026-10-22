import { describe, expect, it } from 'vitest';
import { ACTIVITIES } from '../src/content/activities';
import { PLAYER_RADIUS } from '../src/games/kitten/player';
import { Homestead, type HubEvent } from '../src/hub/homestead';
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
