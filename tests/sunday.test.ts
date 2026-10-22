import { describe, expect, it } from 'vitest';
import { FAMILY } from '../src/content/cast';
import { BARN_PLAN_SIGN, sundayScript } from '../src/content/sunday';
import { normalize } from '../src/core/save';
import { Homestead, LONG_TABLE } from '../src/hub/homestead';
import { sharedWorld } from '../src/world/shared';

const shared = sharedWorld();
const still = { moveX: 0, moveY: 0, whistle: false, treat: false };

describe('Sunday at the Barn', () => {
  const beats = sundayScript();

  it('only uses real speakers and every choice leads somewhere', () => {
    for (const b of beats) {
      const who = 'line' in b ? b.line.who : b.choice.who;
      expect(who === 'narrator' || who in FAMILY).toBe(true);
      if ('choice' in b) {
        expect(b.choice.options.length).toBeGreaterThanOrEqual(2);
        for (const o of b.choice.options) expect(o.reply.length).toBeGreaterThan(0);
      }
    }
  });

  it('lets the family pick a next chapter for the barn, each with a sign', () => {
    const barn = beats.find((b) => 'choice' in b && b.choice.options.some((o) => o.plan));
    expect(barn).toBeDefined();
    if (barn && 'choice' in barn) for (const o of barn.choice.options) expect(BARN_PLAN_SIGN[o.plan!]).toBeTruthy();
  });

  it('keeps grace to a single, short moment', () => {
    const grace = beats.filter((b) => 'line' in b && /grace|gives thanks/i.test(b.line.text));
    expect(grace.length).toBeLessThanOrEqual(2);
    const text = beats.map((b) => ('line' in b ? b.line.text : b.choice.prompt)).join(' ');
    expect(text).not.toMatch(/\b(points?|stars?|reward|bonus)\b/i);
  });

  it('is offered at the long table, never during a mission', () => {
    const h = new Homestead(shared, { explorer: 'natalie', ornaments: [], discoveries: [], huntFound: [] });
    h.teleport(LONG_TABLE.x, LONG_TABLE.y + 60);
    h.step(still, 1 / 60, false);
    expect(h.action?.kind).toBe('sunday');
    h.step(still, 1 / 60, true);
    expect(h.drainEvents().some((e) => e.type === 'sunday')).toBe(true);
    h.startHunt();
    h.teleport(LONG_TABLE.x, LONG_TABLE.y + 60);
    h.step(still, 1 / 60, false);
    expect(h.action?.kind).not.toBe('sunday');
  });

  it('gathers everyone at the table and sends them home afterwards', () => {
    const h = new Homestead(shared, { explorer: 'jay', ornaments: [], discoveries: [], huntFound: [] });
    h.gather(true);
    for (const n of h.npcs) expect(Math.hypot(n.x - LONG_TABLE.x, n.y - LONG_TABLE.y)).toBeLessThan(110);
    expect(Math.hypot(h.player.x - LONG_TABLE.x, h.player.y - LONG_TABLE.y)).toBeLessThan(110);
    expect(shared.world.isFree(h.player.x, h.player.y, h.player.radius)).toBe(true);
    h.gather(false);
    for (const n of h.npcs) expect(n.x === n.home.x && n.y === n.home.y).toBe(true);
  });

  it('remembers the barn plan, and ignores junk', () => {
    expect(normalize({ barnPlan: 'neighbors' }).barnPlan).toBe('neighbors');
    expect(normalize({ barnPlan: 'casino' }).barnPlan).toBeNull();
    expect(normalize({}).sundays).toBe(0);
  });
});
