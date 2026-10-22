import { describe, expect, it } from 'vitest';
import { RACK_W, WOOD_ROUNDS, WoodGame } from '../src/games/woodpile/woodpile';

const DT = 1 / 60;

/** Plays a round. `skill` 1 = always perfect and snug; lower = sloppier timing. */
function play(round: (typeof WOOD_ROUNDS)[number], skill: number, seed = 1) {
  const g = new WoodGame(round);
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  let wait = 0;
  for (let i = 0; i < 60 * 400 && g.phase !== 'complete'; i++) {
    wait -= DT;
    if (wait <= 0) {
      if (g.phase === 'ready' || g.phase === 'aim') {
        if (g.log.punky && rand() < skill) {
          g.toss();
          wait = 0.2;
        } else {
          const tol = skill >= 1 ? g.sweetW / 8 : g.sweetW * (1.4 - skill);
          if (Math.abs(g.meter - g.sweet) < tol) {
            g.tap();
            wait = 0.15;
          }
        }
      } else if (g.phase === 'slide' && g.slider) {
        const tol = skill >= 1 ? 3 : 40 * (1.2 - skill);
        if (Math.abs(g.slider.x - g.rowRight) < tol && (skill >= 1 || rand() < 0.2)) {
          g.tap();
          wait = 0.1;
        }
      }
    }
    g.step(DT);
  }
  return g;
}

describe('Woodpile', () => {
  it('a careful player finishes every round with three stars and time to spare', () => {
    for (const r of WOOD_ROUNDS) {
      const g = play(r, 1);
      expect(g.result, r.id).not.toBeNull();
      expect(g.result!.finished, r.id).toBe(true);
      expect(g.result!.stars, r.id).toBe(3);
      expect(g.elapsed, r.id).toBeLessThan(r.timeLimit * 0.75);
      expect(g.stacked).toBeGreaterThanOrEqual(r.goal);
    }
  });

  it('sloppy play earns fewer stars than careful play', () => {
    for (const r of WOOD_ROUNDS) {
      const good = play(r, 1);
      const bad = play(r, 0.3, 7);
      expect(bad.score, r.id).toBeLessThan(good.score);
      if (bad.result?.finished) expect(bad.result.stars, r.id).toBeLessThanOrEqual(2);
    }
  });

  it('misses get the axe stuck and need another swing', () => {
    const g = new WoodGame(WOOD_ROUNDS[0]);
    g.meter = g.sweet > 0.5 ? 0 : 1;
    g.tap();
    expect(g.phase).toBe('swing');
    for (let i = 0; i < 20; i++) g.step(DT);
    expect(g.phase).toBe('stuck');
    expect(g.misses).toBe(1);
    for (let i = 0; i < 40; i++) g.step(DT);
    expect(g.phase).toBe('aim');
  });

  it('a perfect chop splits the log into pieces to stack', () => {
    const g = new WoodGame(WOOD_ROUNDS[0]);
    g.meter = g.sweet;
    g.tap();
    for (let i = 0; i < 60 && g.phase !== 'slide'; i++) g.step(DT);
    expect(g.phase).toBe('slide');
    expect(g.slider).not.toBeNull();
    expect(g.chopPts).toBe(60);
  });

  it('gappy drops make the row wobble until it falls', () => {
    const g = new WoodGame(WOOD_ROUNDS[0]);
    let collapsed = false;
    for (let i = 0; i < 60 * 120 && !collapsed; i++) {
      if (g.phase === 'ready' || g.phase === 'aim') {
        g.meter = g.sweet;
        g.tap();
      } else if (g.phase === 'slide' && g.slider && g.slider.x >= RACK_W - g.slider.w - 1) g.tap();
      g.step(DT);
      for (const e of g.drainEvents()) if (e.type === 'collapse') collapsed = true;
    }
    expect(collapsed).toBe(true);
  });

  it('rotten logs should be tossed, not chopped', () => {
    const r = WOOD_ROUNDS[2];
    const g = new WoodGame(r);
    // Find a rotten log by tossing good ones until one shows up.
    for (let i = 0; i < 200 && !g.log.punky; i++) {
      g.toss();
      for (let k = 0; k < 150 && g.phase !== 'aim'; k++) g.step(DT);
    }
    expect(g.log.punky).toBe(true);
    const before = g.bonusPts;
    g.toss();
    expect(g.bonusPts).toBe(before + 60);
  });

  it('runs out of daylight with no stars if nothing gets stacked', () => {
    const g = new WoodGame(WOOD_ROUNDS[0]);
    g.tap();
    for (let i = 0; i < 60 * (WOOD_ROUNDS[0].timeLimit + 5); i++) g.step(DT);
    expect(g.phase).toBe('complete');
    expect(g.result!.finished).toBe(false);
    expect(g.result!.stars).toBe(0);
  });
});
