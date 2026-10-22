import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import { LEVEL_ONE, type LevelDef } from '../src/game/levels';
import { emptyInput, type InputState, type Kitten } from '../src/game/types';
import { Rng } from '../src/core/math';

const DT = 1 / 60;
const run = (g: Game, seconds: number, input: InputState | ((t: number) => InputState) = emptyInput()) => {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) g.step(typeof input === 'function' ? input(i * DT) : input, DT);
};
const kitten = (g: Game, id: string): Kitten => g.kittens.find((k) => k.id === id)!;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** A level with a single kitten in open meadow, for isolated behaviour checks. */
function solo(id: string, x = 1300, y = 1300): LevelDef {
  const spawn = LEVEL_ONE.kittens.find((k) => k.id === id)!;
  return { ...LEVEL_ONE, required: 1, player: { x: x - 300, y }, kittens: [{ ...spawn, x, y }] };
}

describe('kitten behaviour', () => {
  it('shy kittens run from an approaching tiger', () => {
    const g = new Game(solo('pepper'));
    const k = kitten(g, 'pepper');
    const start = { x: k.x, y: k.y };
    run(g, 1.6, { ...emptyInput(), moveX: 1 });
    expect(k.state === 'flee' || k.x > start.x + 20).toBe(true);
    expect(k.x).toBeGreaterThan(start.x + 20);
  });

  it('shy kittens flee earlier than curious ones', () => {
    const shy = new Game(solo('pepper'));
    const cur = new Game(solo('pickles'));
    for (const g of [shy, cur]) {
      g.player.x = g.kittens[0].x - 120;
      run(g, 0.3);
    }
    expect(shy.kittens[0].state).toBe('flee');
    expect(cur.kittens[0].state).not.toBe('flee');
  });

  it('sleepy kittens flee slower than shy kittens', () => {
    const speeds: number[] = [];
    for (const id of ['pepper', 'tater']) {
      const g = new Game(solo(id));
      const k = g.kittens[0];
      k.cycleT = 50; // stay awake
      g.player.x = k.x - 40;
      run(g, 0.8);
      speeds.push(Math.hypot(k.vx, k.vy));
    }
    expect(speeds[0]).toBeGreaterThan(speeds[1] * 1.5);
  });

  it('hungry kittens go to a thrown treat, eat it, then follow Deputy', () => {
    const g = new Game(solo('biscuit'));
    const k = g.kittens[0];
    g.player.x = k.x - 380;
    g.player.heading = 0;
    g.treatsLeft = 1;
    expect(g.throwTreat()).not.toBeNull();
    const treat = g.treats[0];
    run(g, 8);
    expect(treat.eaten).toBe(true);
    expect(g.treatsLeft).toBe(0);
    expect(k.state).toBe('follow');
    // Riding away, Biscuit tags along.
    run(g, 3, { ...emptyInput(), moveY: 0.6 });
    expect(dist(k, g.player)).toBeLessThan(160);
  });

  it('sleepy kittens nap on a schedule and a whistle wakes them', () => {
    const g = new Game(solo('marshmallow'));
    const k = g.kittens[0];
    run(g, 6);
    expect(k.state).toBe('nap');
    g.player.x = k.x - 150;
    g.player.heading = 0;
    expect(g.whistle()).toBe(1);
    expect(k.state).toBe('dash');
    const x0 = k.x;
    run(g, 1);
    expect(k.x).toBeGreaterThan(x0 + 40);
  });

  it('whistle sends kittens the way Deputy is facing', () => {
    const g = new Game(solo('pickles'));
    const k = g.kittens[0];
    g.player.x = k.x;
    g.player.y = k.y + 120;
    g.player.heading = -Math.PI / 2; // facing north
    g.whistle();
    const y0 = k.y;
    run(g, 0.9);
    expect(k.y).toBeLessThan(y0 - 60);
  });

  it('curious kittens come over when Deputy waits', () => {
    const g = new Game(solo('pickles'));
    const k = g.kittens[0];
    g.player.x = k.x - 200;
    run(g, 6);
    expect(dist(k, g.player)).toBeLessThan(110);
  });

  it('the distractible kitten chases butterflies on a timer', () => {
    const g = new Game(solo('ziggy'));
    let chased = false;
    for (let i = 0; i < 60 * 14; i++) {
      g.step(emptyInput(), DT);
      if (g.kittens[0].state === 'chase') chased = true;
    }
    expect(chased).toBe(true);
    expect(g.drainEvents().some((e) => e.type === 'butterfly')).toBe(true);
  });

  it('is deterministic for the same inputs', () => {
    const script = (t: number): InputState => ({ moveX: Math.sin(t * 0.7), moveY: Math.cos(t * 0.4), whistle: Math.floor(t * 60) % 300 === 0, treat: Math.floor(t * 60) % 700 === 0 });
    const a = new Game(LEVEL_ONE);
    const b = new Game(LEVEL_ONE, a.shared);
    run(a, 20, script);
    run(b, 20, script);
    expect(a.kittens.map((k) => [k.x, k.y, k.state])).toEqual(b.kittens.map((k) => [k.x, k.y, k.state]));
  });
});

describe('penning, completion and restart', () => {
  it('counts kittens that enter the corral and keeps them there', () => {
    const g = new Game(LEVEL_ONE);
    const pen = g.targetPen;
    const k = kitten(g, 'biscuit');
    k.x = pen.x;
    k.y = pen.y;
    g.step(emptyInput(), DT);
    expect(k.penned).toBe(true);
    expect(g.pennedCount).toBe(1);
    expect(g.score).toBe(100);
    expect(g.drainEvents().some((e) => e.type === 'penned')).toBe(true);
    run(g, 30);
    expect(Math.hypot(k.x - pen.x, k.y - pen.y)).toBeLessThan(pen.r);
  });

  it('a kitten herded through the gate gets penned', () => {
    const g = new Game(solo('pickles'));
    const pen = g.targetPen;
    const gate = { x: pen.x + Math.cos(pen.gateAngle!) * pen.r, y: pen.y + Math.sin(pen.gateAngle!) * pen.r };
    const out = { x: (gate.x - pen.x) / pen.r, y: (gate.y - pen.y) / pen.r };
    const k = g.kittens[0];
    k.x = gate.x + out.x * 40;
    k.y = gate.y + out.y * 40;
    k.focusT = 100;
    g.player.x = gate.x + out.x * 130;
    g.player.y = gate.y + out.y * 130;
    // Ride straight at the gate.
    run(g, 3, { ...emptyInput(), moveX: -out.x * 0.6, moveY: -out.y * 0.6 });
    expect(k.penned).toBe(true);
  });

  it('celebrates, completes with a result, and resets cleanly', () => {
    const g = new Game(LEVEL_ONE);
    const pen = g.targetPen;
    g.kittens.slice(0, 6).forEach((k, i) => {
      k.x = pen.x + Math.cos(i) * 40;
      k.y = pen.y + Math.sin(i) * 40;
    });
    run(g, 0.1);
    expect(g.phase).toBe('celebrating');
    expect(g.result).not.toBeNull();
    const frozen = g.elapsed;
    run(g, 4);
    expect(g.phase).toBe('complete');
    expect(g.elapsed).toBe(frozen);
    expect(g.result!.lines[0].value).toBe(600);

    g.reset();
    expect(g.phase).toBe('playing');
    expect(g.pennedCount).toBe(0);
    expect(g.elapsed).toBe(0);
    expect(g.treatsLeft).toBe(LEVEL_ONE.startTreats);
    expect(g.kittens[0].x).toBe(LEVEL_ONE.kittens[0].x);
  });

  it('collects horseshoes, treat bags and discoveries', () => {
    const g = new Game(LEVEL_ONE);
    const bag = g.map.collectibles.find((c) => c.kind === 'treatBag')!;
    const shoe = g.map.collectibles.find((c) => c.kind === 'horseshoe')!;
    const disc = g.map.discoveries[0];
    for (const t of [bag, shoe, disc]) {
      g.player.x = t.x;
      g.player.y = t.y;
      g.step(emptyInput(), DT);
    }
    expect(g.treatsLeft).toBe(LEVEL_ONE.startTreats + 2);
    expect(g.horseshoes).toBe(1);
    expect(g.discovered.size).toBeGreaterThanOrEqual(1);
  });

  it('refuses treats when the pouch is empty', () => {
    const g = new Game(LEVEL_ONE);
    g.treatsLeft = 0;
    expect(g.throwTreat()).toBeNull();
    expect(g.drainEvents().some((e) => e.type === 'noTreats')).toBe(true);
  });
});

describe('robustness', () => {
  it('kittens never end up inside solids or stuck, even when chased around for two minutes', () => {
    const g = new Game(LEVEL_ONE);
    const rng = new Rng(99);
    let mx = 0;
    let my = 0;
    const moved = new Map<string, number>();
    let last = new Map(g.kittens.map((k) => [k.id, { x: k.x, y: k.y }]));
    for (let i = 0; i < 60 * 120; i++) {
      if (i % 90 === 0) {
        // Every 1.5s, ride toward a random kitten (chasing them into corners).
        const target = g.kittens[rng.int(0, g.kittens.length)];
        const dx = target.x - g.player.x;
        const dy = target.y - g.player.y;
        const l = Math.hypot(dx, dy) || 1;
        mx = dx / l;
        my = dy / l;
      }
      g.step({ moveX: mx, moveY: my, whistle: i % 400 === 0, treat: false }, DT);
      for (const k of g.kittens) {
        expect(g.world.isFree(k.x, k.y, k.radius - 2), `${k.id} wedged at ${k.x.toFixed(0)},${k.y.toFixed(0)}`).toBe(true);
      }
      if (i % 600 === 0) {
        for (const k of g.kittens) {
          const p = last.get(k.id)!;
          moved.set(k.id, (moved.get(k.id) ?? 0) + Math.hypot(k.x - p.x, k.y - p.y));
        }
        last = new Map(g.kittens.map((k) => [k.id, { x: k.x, y: k.y }]));
      }
    }
    for (const k of g.kittens) expect(moved.get(k.id)!, `${k.id} never moved`).toBeGreaterThan(40);
  });

  it('steps fast enough for a phone (8 kittens, 60 steps)', () => {
    const g = new Game(LEVEL_ONE);
    const t0 = performance.now();
    run(g, 1, { ...emptyInput(), moveX: 1 });
    expect(performance.now() - t0).toBeLessThan(250);
  });
});

describe('full playthrough', () => {
  it('an autopilot can herd six kittens into the corral within ten minutes', async () => {
    const { HerdBot } = await import('./bot');
    const g = new Game(LEVEL_ONE);
    const bot = new HerdBot(g);
    let t = 0;
    while (g.phase === 'playing' && t < 600) {
      g.step(bot.next(DT), DT);
      t += DT;
    }
    expect(g.phase).toBe('celebrating');
    expect(g.pennedCount).toBe(LEVEL_ONE.required);
    expect(g.result!.total).toBeGreaterThan(600);
  }, 60000);
});
