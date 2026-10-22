import { describe, expect, it } from 'vitest';
import { circlePenetration, ringFence } from '../src/world/shapes';
import { CollisionWorld } from '../src/world/collision';

describe('shapes', () => {
  it('pushes a circle out of a rectangle', () => {
    const push = circlePenetration(95, 50, 10, { kind: 'rect', x: 100, y: 0, w: 50, h: 100 });
    expect(push).not.toBeNull();
    expect(push!.x).toBeCloseTo(-5);
    expect(push!.y).toBeCloseTo(0);
  });

  it('pushes a circle out from inside a rectangle through the nearest face', () => {
    const push = circlePenetration(102, 50, 10, { kind: 'rect', x: 100, y: 0, w: 50, h: 100 });
    expect(push!.x).toBeLessThan(-11);
  });

  it('handles circles and segments', () => {
    expect(circlePenetration(0, 0, 5, { kind: 'circle', x: 8, y: 0, r: 5 })!.x).toBeCloseTo(-2);
    expect(circlePenetration(0, 3, 5, { kind: 'segment', ax: -10, ay: 0, bx: 10, by: 0, r: 2 })!.y).toBeCloseTo(4);
    expect(circlePenetration(0, 30, 5, { kind: 'segment', ax: -10, ay: 0, bx: 10, by: 0, r: 2 })).toBeNull();
  });

  it('leaves a gap in a ring fence for the gate', () => {
    const full = ringFence(0, 0, 100, 28);
    const gated = ringFence(0, 0, 100, 28, { angle: 0, width: 60 });
    expect(full.length).toBe(28);
    expect(gated.length).toBeLessThan(28);
    // Nothing blocks the gate direction.
    const world = new CollisionWorld(gated.map((s) => ({ ...s, ax: s.ax + 500, ay: s.ay + 500, bx: s.bx + 500, by: s.by + 500 })), 1000, 1000, 0);
    expect(world.clearPath(500, 500, 650, 500, 10)).toBe(true);
    expect(world.clearPath(500, 500, 500, 650, 10)).toBe(false);
  });
});

describe('CollisionWorld', () => {
  const world = new CollisionWorld([{ kind: 'rect', x: 100, y: 100, w: 100, h: 100 }], 400, 400, 10);

  it('resolves overlap and reports contact', () => {
    const p = { x: 95, y: 150 };
    expect(world.resolve(p, 10)).toBe(true);
    expect(p.x).toBeCloseTo(90);
    expect(world.isFree(p.x, p.y, 9.9)).toBe(true);
  });

  it('keeps circles inside the playable bounds', () => {
    const p = { x: -50, y: 500 };
    world.resolve(p, 8);
    expect(p.x).toBe(18);
    expect(p.y).toBe(382);
  });
});
