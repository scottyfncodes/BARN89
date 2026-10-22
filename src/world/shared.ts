import { CollisionWorld } from './collision';
import type { RanchMap } from './mapTypes';
import { NavGrid } from './navgrid';
import { createRanchMap } from './ranch';
import { buildSolids } from './solids';

export interface SharedWorld {
  map: RanchMap;
  world: CollisionWorld;
  /** Grid for small agents (cats, dogs). */
  nav: NavGrid;
}

let cached: SharedWorld | null = null;

/** The one homestead every scene shares. Built once; collision and nav are expensive. */
export function sharedWorld(): SharedWorld {
  if (!cached) {
    const map = createRanchMap();
    const world = new CollisionWorld(buildSolids(map), map.width, map.height, map.margin);
    // Agent radius 9 matches the kittens' (KITTEN_RADIUS) so the Kitten Cowgirl game can reuse it.
    const nav = new NavGrid(world, 16, 9);
    cached = { map, world, nav };
  }
  return cached;
}
