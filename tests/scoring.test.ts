import { describe, expect, it } from 'vitest';
import { finalScore, formatTime, liveScore, POINTS } from '../src/game/scoring';

describe('scoring', () => {
  it('awards stars by time', () => {
    const base = { penned: 6, required: 6, horseshoes: 0, discoveries: 0, treatsLeft: 0, starTimes: [300, 480] as [number, number] };
    expect(finalScore({ ...base, seconds: 200 }).stars).toBe(3);
    expect(finalScore({ ...base, seconds: 400 }).stars).toBe(2);
    expect(finalScore({ ...base, seconds: 900 }).stars).toBe(1);
  });

  it('adds up every line', () => {
    const r = finalScore({ penned: 6, required: 6, seconds: 470, horseshoes: 2, discoveries: 3, treatsLeft: 1, starTimes: [300, 480] });
    expect(r.total).toBe(600 + 300 + 75 + 20 + 10 * POINTS.perSecond);
    expect(r.lines.reduce((a, l) => a + l.value, 0)).toBe(r.total);
  });

  it('has a live score and time formatting', () => {
    expect(liveScore(2, 1, 1)).toBe(200 + 150 + 25);
    expect(formatTime(125.7)).toBe('2:05');
  });
});
