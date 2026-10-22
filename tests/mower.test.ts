import { describe, expect, it } from 'vitest';
import { MOW_LEVELS } from '../src/games/mower/levels';
import { CELL, MOWER_RADIUS, MowGame, pointInPoly } from '../src/games/mower/mower';
import { sharedWorld } from '../src/world/shared';

const DT = 1 / 60;
const shared = sharedWorld();

/** Drives back-and-forth passes over the lawn, then mops up leftover patches. */
export function mowBot(level: (typeof MOW_LEVELS)[number], spacing = 40, maxSeconds = 400) {
  const g = new MowGame(level, shared);
  // Build a list of row waypoints across the mowable cells.
  const rows: { x: number; y: number }[][] = [];
  const horiz = Math.abs(Math.cos(level.axis)) > 0.5;
  const span = horiz ? g.rows * CELL : g.cols * CELL;
  for (let off = spacing / 2; off < span; off += spacing) {
    const pts: { x: number; y: number }[] = [];
    const len = horiz ? g.cols : g.rows;
    for (let i = 0; i < len; i++) {
      const x = horiz ? g.x0 + (i + 0.5) * CELL : g.x0 + off;
      const y = horiz ? g.y0 + off : g.y0 + (i + 0.5) * CELL;
      const c = Math.floor((x - g.x0) / CELL);
      const r = Math.floor((y - g.y0) / CELL);
      if (g.cells[r * g.cols + c] && shared.world.isFree(x, y, MOWER_RADIUS)) pts.push({ x, y });
    }
    if (pts.length) rows.push(rows.length % 2 ? pts.reverse() : pts);
  }
  const plan = rows.flatMap((r) => [r[0], r[r.length - 1]]);
  let target = 0;
  let stuckT = 0;
  let lastD = Infinity;
  for (let i = 0; i < maxSeconds * 60 && g.phase !== 'complete'; i++) {
    const m = g.mower;
    let goal = plan[target];
    if (!goal) {
      // Mop up: head for the nearest tall cell.
      let bd = Infinity;
      for (let r = 0; r < g.rows; r++)
        for (let c = 0; c < g.cols; c++) {
          if (g.cells[r * g.cols + c] !== 1) continue;
          const x = g.x0 + (c + 0.5) * CELL;
          const y = g.y0 + (r + 0.5) * CELL;
          const d = Math.hypot(x - m.x, y - m.y);
          if (d < bd) {
            bd = d;
            goal = { x, y };
          }
        }
      if (!goal) break;
    }
    const dx = goal.x - m.x;
    const dy = goal.y - m.y;
    const d = Math.hypot(dx, dy);
    if (d < 14) {
      target++;
      stuckT = 0;
      lastD = Infinity;
    } else {
      if (d > lastD - 0.5) stuckT += DT;
      else stuckT = Math.max(0, stuckT - DT);
      lastD = d;
      if (stuckT > 1.2) {
        target++;
        stuckT = 0;
        lastD = Infinity;
      }
    }
    g.step({ x: dx / (d || 1), y: dy / (d || 1) }, DT);
  }
  return g;
}

describe('Yard Boss', () => {
  it('every lawn has a sizeable mowable area and a clear starting spot', () => {
    for (const l of MOW_LEVELS) {
      const g = new MowGame(l, shared);
      expect(g.total, l.id).toBeGreaterThan(900);
      expect(shared.world.isFree(l.start.x, l.start.y, MOWER_RADIUS), `${l.id} start`).toBe(true);
      expect(pointInPoly(l.start.x, l.start.y, l.lawn) || g.coverage > 0, l.id).toBe(true);
      for (const b of l.beds) expect(pointInPoly(b.x, b.y, l.lawn), `${l.id} bed`).toBe(true);
      for (const t of l.toys) expect(pointInPoly(t.x, t.y, l.lawn), `${l.id} toy`).toBe(true);
    }
  });

  it('a methodical driver can finish every lawn inside the time limit', () => {
    for (const l of MOW_LEVELS) {
      const g = mowBot(l);
      expect(g.result, l.id).not.toBeNull();
      expect(g.result!.finished, `${l.id} coverage ${g.coverage.toFixed(2)} in ${g.elapsed.toFixed(0)}s`).toBe(true);
      expect(g.result!.stars, l.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('waits for the player before starting the clock', () => {
    const g = new MowGame(MOW_LEVELS[0], shared);
    for (let i = 0; i < 120; i++) g.step({ x: 0, y: 0 }, DT);
    expect(g.phase).toBe('ready');
    expect(g.elapsed).toBe(0);
    g.step({ x: 0, y: -1 }, DT);
    expect(g.phase).toBe('playing');
  });

  it('mowing turns tall grass into stripes', () => {
    const g = new MowGame(MOW_LEVELS[0], shared);
    const before = g.cut;
    for (let i = 0; i < 90; i++) g.step({ x: 0, y: -1 }, DT);
    expect(g.cut).toBeGreaterThan(before + 50);
    let light = 0;
    let dark = 0;
    for (const v of g.cells) {
      if (v === 2) light++;
      if (v === 3) dark++;
    }
    expect(light + dark).toBe(g.cut);
  });

  it('flower beds cost time when mowed over', () => {
    const l = MOW_LEVELS[0];
    const g = new MowGame(l, shared);
    const bed = l.beds[0];
    g.mower.x = bed.x - 80;
    g.mower.y = bed.y;
    g.mower.heading = 0;
    for (let i = 0; i < 120; i++) g.step({ x: 1, y: 0 }, DT);
    expect(g.beds[0].ruined).toBe(true);
    expect(g.penalties).toBeGreaterThanOrEqual(6);
  });
});
