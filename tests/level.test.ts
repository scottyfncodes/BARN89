import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/game';
import { LEVEL_ONE } from '../src/game/levels';
import { PLAYER_RADIUS } from '../src/game/player';
import { NavGrid } from '../src/world/navgrid';

describe('Ranch Roundup level', () => {
  const game = new Game(LEVEL_ONE);
  const start = LEVEL_ONE.player;
  // Separate grid sized for Deputy, so we know the tiger fits through every route too.
  const tigerNav = new NavGrid(game.world, 16, PLAYER_RADIUS);
  const pen = game.targetPen;

  it('starts Natalie on open ground', () => {
    expect(game.world.isFree(start.x, start.y, PLAYER_RADIUS)).toBe(true);
  });

  it('has enough kittens to finish and none start penned', () => {
    expect(LEVEL_ONE.kittens.length).toBeGreaterThanOrEqual(LEVEL_ONE.required);
    for (const k of LEVEL_ONE.kittens) {
      expect(Math.hypot(k.x - pen.x, k.y - pen.y), k.id).toBeGreaterThan(pen.r);
    }
  });

  it('spawns every kitten somewhere free and reachable from the corral interior', () => {
    for (const k of LEVEL_ONE.kittens) {
      expect(game.world.isFree(k.x, k.y, 9), `${k.id} spawn blocked`).toBe(true);
      expect(game.nav.reachable(k, pen), `${k.id} cannot reach corral`).toBe(true);
    }
  });

  it('lets Deputy reach every kitten, collectible and discovery', () => {
    const targets = [
      ...LEVEL_ONE.kittens.map((k) => ({ id: k.id, x: k.x, y: k.y })),
      ...game.map.collectibles,
      ...game.map.discoveries,
    ];
    for (const t of targets) {
      const spot = tigerNav.isWalkable(t.x, t.y) ? t : tigerNav.nearestWalkable(t.x, t.y, 5);
      expect(spot, `${t.id} has no reachable spot`).not.toBeNull();
      // Collectibles are grabbed within radius + 22, discoveries within their own radius.
      expect(Math.hypot(spot!.x - t.x, spot!.y - t.y), `${t.id} too far from walkable ground`).toBeLessThan(46);
      expect(tigerNav.reachable(start, spot!), `${t.id} unreachable for Deputy`).toBe(true);
    }
  });

  it('keeps Deputy able to ride into the corral', () => {
    expect(tigerNav.reachable(start, pen)).toBe(true);
  });

  it('pathfinds from far corners of the ranch to the corral', () => {
    const path = game.nav.findPath({ x: 300, y: 1385 }, pen, 30000);
    expect(path).not.toBeNull();
  });
});
