import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../src/world/collision';
import { NavGrid } from '../src/world/navgrid';

describe('NavGrid', () => {
  // A wall with a single opening at the bottom.
  const world = new CollisionWorld([{ kind: 'rect', x: 290, y: 0, w: 20, h: 500 }], 600, 600, 0);
  const nav = new NavGrid(world, 16, 9);

  it('finds a path around obstacles through the opening', () => {
    const path = nav.findPath({ x: 100, y: 100 }, { x: 500, y: 100 });
    expect(path).not.toBeNull();
    expect(path!.some((p) => p.y > 500)).toBe(true);
    expect(path![path!.length - 1]).toEqual({ x: 500, y: 100 });
  });

  it('reports unreachable goals', () => {
    const closed = new CollisionWorld([{ kind: 'rect', x: 290, y: 0, w: 20, h: 600 }], 600, 600, 0);
    const n2 = new NavGrid(closed, 16, 9);
    expect(n2.findPath({ x: 100, y: 100 }, { x: 500, y: 100 })).toBeNull();
    expect(n2.reachable({ x: 100, y: 100 }, { x: 500, y: 100 })).toBe(false);
  });

  it('finds the nearest walkable cell from inside a wall', () => {
    const p = nav.nearestWalkable(300, 200)!;
    expect(nav.isWalkable(p.x, p.y)).toBe(true);
    expect(Math.abs(p.x - 300)).toBeLessThan(40);
  });
});
