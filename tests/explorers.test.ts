import { describe, expect, it } from 'vitest';
import { FAMILY_ORDER, type FamilyId } from '../src/content/cast';
import { GREETINGS, HUM_TUNE, PERKS } from '../src/content/explorers';
import { BACK_YARD, DAD_TRUCK, Homestead, type HubEvent } from '../src/hub/homestead';
import { CHICKEN_RUN } from '../src/world/ranch';
import { sharedWorld } from '../src/world/shared';

const shared = sharedWorld();
const DT = 1 / 60;
const still = { moveX: 0, moveY: 0, whistle: false, treat: false };

function as(explorer: FamilyId): Homestead {
  return new Homestead(shared, { explorer, ornaments: [], discoveries: [], huntFound: [] });
}

function run(h: Homestead, seconds: number, opts: { act?: boolean; move?: { x: number; y: number } } = {}): HubEvent[] {
  const out: HubEvent[] = [];
  const input = opts.move ? { ...still, moveX: opts.move.x, moveY: opts.move.y } : still;
  for (let i = 0; i < seconds * 60; i++) {
    h.step(input, DT, !!opts.act && i === 0);
    out.push(...h.drainEvents());
  }
  return out;
}

describe('who you explore as', () => {
  it('gives everyone something of their own, and a hello for everybody else', () => {
    for (const who of FAMILY_ORDER) {
      expect(PERKS[who].length).toBeGreaterThan(10);
      for (const other of FAMILY_ORDER) if (other !== who) expect(GREETINGS[who][other], `${who} to ${other}`).toBeTruthy();
    }
    const text = [...Object.values(PERKS), ...FAMILY_ORDER.flatMap((w) => Object.values(GREETINGS[w]))].join(' ');
    expect(text).not.toMatch(/—/);
  });

  it('Grandpa hums when he is out and about, and stops to talk or eat', () => {
    expect(HUM_TUNE.some(([n]) => n === 0)).toBe(true);
    const h = as('natalie');
    run(h, 1);
    const g = h.npcs.find((n) => n.who === 'grandpa')!;
    expect(h.hummer()).toBe(g);
    h.teleport(g.x, g.y + 40);
    run(h, 0.5);
    expect(g.attending).toBe(true);
    expect(h.hummer()).toBeNull();
    h.gather(true);
    expect(h.hummer()).toBeNull();
    // Exploring as Grandpa, he hums as he goes.
    const me = as('grandpa');
    expect(me.hummer()).toBe(me.player);
  });

  it("Grandpa's chihuahuas don't yap at him", () => {
    const yips = (who: FamilyId) => {
      const h = as(who);
      h.teleport((BACK_YARD.x0 + BACK_YARD.x1) / 2, BACK_YARD.y1 + 40);
      return run(h, 30).filter((e) => e.type === 'yip').length;
    };
    expect(yips('natalie')).toBeGreaterThan(0);
    expect(yips('grandpa')).toBe(0);
  });

  it('Mom gathers eggs, and the hens need a minute between', () => {
    const h = as('megan');
    h.teleport(CHICKEN_RUN.x, CHICKEN_RUN.y + CHICKEN_RUN.r + 20);
    run(h, 0.1);
    expect(h.action?.kind).toBe('eggs');
    const first = run(h, 0.1, { act: true }).find((e) => e.type === 'eggs');
    expect(first && first.type === 'eggs' && first.n).toBeGreaterThan(0);
    const again = run(h, 0.1, { act: true }).find((e) => e.type === 'eggs');
    expect(again && again.type === 'eggs' && again.n).toBe(0);
    const jay = as('jay');
    jay.teleport(CHICKEN_RUN.x, CHICKEN_RUN.y + CHICKEN_RUN.r + 20);
    run(jay, 0.1);
    expect(jay.action?.kind).not.toBe('eggs');
  });

  it('the donkeys never turn down Mom', () => {
    const h = as('megan');
    h.teleport(h.pen.x + h.pen.r + 40, h.pen.y);
    let refused = 0;
    for (let i = 0; i < 12; i++) refused += run(h, 9, { act: true }).filter((e) => e.type === 'carrot' && !e.ok).length;
    expect(refused).toBe(0);
  });

  it('Dad loads the dogs in the truck and lets them out again', () => {
    const h = as('jason');
    h.teleport(DAD_TRUCK.x + 70, DAD_TRUCK.y - 50);
    expect(shared.world.isFree(548, 718, 11)).toBe(true);
    run(h, 0.1);
    expect(h.action?.kind).toBe('truck');
    run(h, 6, { act: true });
    expect(h.dogs.every((d) => d.state === 'truck' && d.inBed)).toBe(true);
    expect(h.action?.label).toBe('Let the dogs out');
    run(h, 0.5, { act: true });
    expect(h.dogs.every((d) => d.state !== 'truck')).toBe(true);
    for (const d of h.dogs) expect(shared.world.isFree(d.x, d.y, 10)).toBe(true);
    // Only Dad's truck, only for Dad.
    const mom = as('megan');
    mom.teleport(DAD_TRUCK.x + 70, DAD_TRUCK.y - 50);
    run(mom, 0.1);
    expect(mom.action?.kind).not.toBe('truck');
  });

  it('Jay throws a football, and it goes a long way', () => {
    const reach = (who: FamilyId) => {
      const h = as(who);
      h.teleport(1000, 300);
      run(h, 0.6, { move: { x: 1, y: 0 } });
      run(h, 0.1);
      expect(h.action?.kind).toBe('ball');
      run(h, 0.1, { act: true });
      return { d: Math.hypot(h.ball!.x - h.ball!.fromX, h.ball!.y - h.ball!.fromY - 40), football: !!h.ball!.football, label: h.action?.label };
    };
    const jay = reach('jay');
    const nat = reach('natalie');
    expect(jay.football).toBe(true);
    expect(nat.football).toBe(false);
    expect(jay.d).toBeGreaterThan(nat.d * 1.4);
  });

  it('the barn cats fall in behind Natalie when she walks by', () => {
    const h = as('natalie');
    // Three cats napping in a row along the north lawn; Natalie strolls past them.
    const row = h.cats.filter((x) => x.lift === 0 && x.state === 'rest').slice(0, 3);
    row.forEach((c, i) => {
      c.x = c.px = 1000 + i * 70;
      c.y = c.py = 300;
    });
    h.teleport(940, 300);
    const events = run(h, 1.2, { move: { x: 1, y: 0 } });
    expect(h.cats.filter((c) => c.state === 'follow').length).toBeGreaterThanOrEqual(3);
    expect(events.some((e) => e.type === 'parade')).toBe(true);
    // Nobody else gets a parade.
    const jay = as('jay');
    const c = jay.cats.find((x) => x.lift === 0 && x.state === 'rest')!;
    jay.teleport(c.x - 50, c.y);
    run(jay, 0.35, { move: { x: 1, y: 0 } });
    expect(jay.cats.some((x) => x.state === 'follow')).toBe(false);
    // Switching explorer ends the parade.
    h.setExplorer('jay');
    run(h, 0.1);
    expect(h.cats.some((x) => x.state === 'follow')).toBe(false);
  });
});

