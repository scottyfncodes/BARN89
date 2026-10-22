import { describe, expect, it } from 'vitest';
import { MAX_STROKES, PUTT_ROUNDS, PuttGame, moverPos, type Pt } from '../src/games/putt/putt';

const DT = 1 / 60;

/** Where a sensible player aims, shot by shot, on the holes that need it. */
const ROUTES: Record<string, Pt[]> = {
  'The Dogleg': [{ x: 95, y: 112 }],
  'Hay Day': [{ x: 66, y: 176 }],
  'Barnyard Zigzag': [{ x: 246, y: 360 }, { x: 246, y: 285 }, { x: 74, y: 262 }, { x: 74, y: 160 }],
};

/** Plays a round: aims at the next waypoint (or the cup) with just enough pace. */
function play(round: (typeof PUTT_ROUNDS)[number]) {
  const g = new PuttGame(round);
  let leg = 0;
  let hole = -1;
  let waited = 0;
  for (let i = 0; i < 60 * 60 * 6 && g.phase !== 'complete'; i++) {
    if (g.holeIndex !== hole) {
      hole = g.holeIndex;
      leg = 0;
    }
    if (g.phase === 'aim') {
      const route = ROUTES[g.hole.name] ?? [];
      // Next waypoint we haven't reached yet.
      while (leg < route.length && Math.hypot(route[leg].x - g.ball.x, route[leg].y - g.ball.y) < 30) leg++;
      const t = route[leg] ?? g.hole.cup;
      const toCup = leg >= route.length;
      // Wait for any animal to be clear of the line, like a person would.
      const blocked = (g.hole.movers ?? []).some((m) => {
        const mp = moverPos(m, g.clock);
        const ex = t.x - g.ball.x;
        const ey = t.y - g.ball.y;
        const k = Math.max(0, Math.min(1, ((mp.x - g.ball.x) * ex + (mp.y - g.ball.y) * ey) / (ex * ex + ey * ey)));
        return Math.hypot(g.ball.x + ex * k - mp.x, g.ball.y + ey * k - mp.y) < m.r + 30;
      });
      if (blocked && waited < 3) {
        waited += DT;
        g.step(DT);
        continue;
      }
      waited = 0;
      const d = Math.hypot(t.x - g.ball.x, t.y - g.ball.y);
      // v^2 = 2 a d on grass, a touch more to drop in.
      const v = Math.sqrt(2 * 150 * (d + (toCup ? 12 : 0)));
      g.putt(t.x - g.ball.x, t.y - g.ball.y, (v - 30) / 590);
      if (!toCup) leg++;
    }
    g.step(DT);
    const xs = g.hole.outline.map((p) => p.x);
    const ys = g.hole.outline.map((p) => p.y);
    expect(g.ball.x).toBeGreaterThan(Math.min(...xs) - 1);
    expect(g.ball.x).toBeLessThan(Math.max(...xs) + 1);
    expect(g.ball.y).toBeGreaterThan(Math.min(...ys) - 1);
    expect(g.ball.y).toBeLessThan(Math.max(...ys) + 1);
  }
  return g;
}

describe('Putt-Putt', () => {
  it('every round can be finished, close to par, without the ball ever leaving the course', () => {
    for (const round of PUTT_ROUNDS) {
      const g = play(round);
      expect(g.result, round.id).not.toBeNull();
      expect(g.result!.strokes, round.id).toBeLessThanOrEqual(g.result!.par + 3);
      expect(g.result!.stars, round.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('a gentle putt straight at the cup drops; a rocket lips out', () => {
    const g = new PuttGame(PUTT_ROUNDS[0]);
    g.phase = 'aim';
    g.ball.x = g.hole.cup.x;
    g.ball.y = g.hole.cup.y + 60;
    g.putt(0, -1, 0.3);
    for (let i = 0; i < 300 && g.moving; i++) g.step(DT);
    expect(g.card[0]).toBe(1);
    const h = new PuttGame(PUTT_ROUNDS[0]);
    h.phase = 'aim';
    h.ball.x = h.hole.cup.x;
    h.ball.y = h.hole.cup.y + 40;
    h.putt(0, -1, 1);
    let lipped = false;
    for (let i = 0; i < 30; i++) {
      h.step(DT);
      lipped = h.drainEvents().some((e) => e.type === 'lip') || lipped;
    }
    expect(lipped).toBe(true);
  });

  it('after seven strokes Grandpa says pick it up', () => {
    const g = new PuttGame(PUTT_ROUNDS[0]);
    for (let s = 0; s < MAX_STROKES; s++) {
      g.phase = 'aim';
      g.putt(1, 0, 0.05);
      for (let i = 0; i < 200 && g.moving; i++) g.step(DT);
    }
    expect(g.card).toEqual([MAX_STROKES]);
  });

  it('nothing to hit sits on a tee or a cup', () => {
    for (const round of PUTT_ROUNDS)
      for (const h of round.holes) {
        for (const k of h.bumpers ?? []) for (const p of [h.tee, h.cup]) expect(Math.hypot(k.x - p.x, k.y - p.y), h.name).toBeGreaterThan(k.r + 20);
        for (const m of h.movers ?? [])
          for (let t = 0; t < m.period; t += 0.1) {
            const mp = moverPos(m, t);
            for (const p of [h.tee, h.cup]) expect(Math.hypot(mp.x - p.x, mp.y - p.y), h.name).toBeGreaterThan(m.r + 12);
          }
      }
  });
});
