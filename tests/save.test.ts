import { describe, expect, it } from 'vitest';
import { ALL_CHALLENGES, isUnlocked, MAX_STARS, REWARDS, rewardUnlocked, totalStars, unlockedRewards } from '../src/content/activities';
import { freshSave, normalize, SaveStore, type Storage } from '../src/core/save';

class MemStorage implements Storage {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
}

describe('saving progress', () => {
  it('round-trips through storage', () => {
    const mem = new MemStorage();
    const a = new SaveStore(mem);
    a.record('mower-1', 2, 1234);
    a.addTo('ornaments', 'orn-barn');
    a.data.explorer = 'grandpa';
    a.save();
    const b = new SaveStore(mem);
    expect(b.data.stars['mower-1']).toBe(2);
    expect(b.data.best['mower-1']).toBe(1234);
    expect(b.data.ornaments).toEqual(['orn-barn']);
    expect(b.data.explorer).toBe('grandpa');
  });

  it('keeps the best stars and score, not the latest', () => {
    const s = new SaveStore(new MemStorage());
    s.record('kitten-1', 3, 900);
    const r = s.record('kitten-1', 1, 500);
    expect(r.newStars).toBe(false);
    expect(s.data.stars['kitten-1']).toBe(3);
    expect(s.data.best['kitten-1']).toBe(900);
  });

  it('survives corrupt or missing storage', () => {
    const mem = new MemStorage();
    mem.setItem('barn89.save.v1', '{not json');
    expect(new SaveStore(mem).data).toEqual(freshSave());
    const none = new SaveStore(null);
    expect(none.persistent).toBe(false);
    none.record('woodpile-1', 2, 10);
    expect(none.data.stars['woodpile-1']).toBe(2);
  });

  it('normalizes odd values from older saves', () => {
    const s = normalize({ explorer: 'mystery', stars: { 'kitten-1': 'lots', 'mower-1': 2 }, ornaments: [1, 'orn-barn'], cosmetics: { hat: 'santa' } });
    expect(s.explorer).toBe('natalie');
    expect(s.stars).toEqual({ 'mower-1': 2 });
    expect(s.ornaments).toEqual(['orn-barn']);
    expect(s.cosmetics.hat).toBe('santa');
    expect(s.cosmetics.mower).toBe('red');
  });
});

describe('progression', () => {
  it('unlocks the next challenge after one star', () => {
    const s = freshSave();
    expect(isUnlocked(s, 'mower-1')).toBe(true);
    expect(isUnlocked(s, 'mower-2')).toBe(false);
    s.stars['mower-1'] = 1;
    expect(isUnlocked(s, 'mower-2')).toBe(true);
    expect(isUnlocked(s, 'mower-3')).toBe(false);
  });

  it('counts stars across every challenge', () => {
    const s = freshSave();
    for (const c of ALL_CHALLENGES) s.stars[c.id] = 3;
    expect(totalStars(s)).toBe(MAX_STARS);
    expect(unlockedRewards(s).size).toBe(REWARDS.filter((r) => r.stars !== undefined).length);
  });

  it('gives secret rewards for petting every cat and finishing the hunt', () => {
    const s = freshSave();
    const beanie = REWARDS.find((r) => r.id === 'hat-beanie')!;
    const bulbs = REWARDS.find((r) => r.id === 'bulbs')!;
    expect(rewardUnlocked(s, beanie)).toBe(false);
    s.pets = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    expect(rewardUnlocked(s, beanie)).toBe(true);
    s.hunt.done = true;
    expect(rewardUnlocked(s, bulbs)).toBe(true);
  });

  it('every star-gated reward is reachable', () => {
    for (const r of REWARDS) if (r.stars !== undefined) expect(r.stars, r.id).toBeLessThanOrEqual(MAX_STARS);
  });
});
