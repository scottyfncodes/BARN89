import { describe, expect, it } from 'vitest';
import { CAT_COUNT, ORNAMENT_COUNT } from '../src/content/activities';
import { dayKey, fillPages, PAGES, prettyDay } from '../src/content/scrapbook';
import { freshSave, normalize } from '../src/core/save';

const NOV9 = new Date(2026, 10, 9, 15, 0);

describe('the family scrapbook', () => {
  it('starts with the family photo and nothing else', () => {
    const s = freshSave();
    expect(fillPages(s, NOV9).map((p) => p.id)).toEqual(['home']);
    expect(s.scrapbook).toEqual({ home: '2026-11-09' });
    expect(fillPages(s, NOV9)).toEqual([]);
  });

  it('pastes in pages for what the save already shows, dated the day they were noticed', () => {
    const s = freshSave();
    s.stars['mower-2'] = 3;
    s.stars['kitten-1'] = 2;
    s.hunt.done = true;
    s.ornaments = Array.from({ length: ORNAMENT_COUNT }, (_, i) => `o${i}`);
    s.pets = Array.from({ length: CAT_COUNT }, (_, i) => `c${i}`);
    s.seen.push('skunk', 'season-october-2026');
    s.barnPlan = 'supper';
    const ids = fillPages(s, NOV9).map((p) => p.id);
    expect(ids).toEqual(['home', 'mower', 'hunt', 'ornaments', 'cats', 'skunk', 'sunday', 'october']);
    expect(ids).not.toContain('kitten');
  });

  it('a page, once in, stays in with its first date', () => {
    const s = freshSave();
    s.stars['putt-1'] = 3;
    fillPages(s, NOV9);
    s.stars['putt-1'] = 0;
    fillPages(s, new Date(2027, 0, 2));
    expect(s.scrapbook.putt).toBe('2026-11-09');
  });

  it('every page has a title, a caption and a way to earn it', () => {
    const s = freshSave();
    expect(new Set(PAGES.map((p) => p.id)).size).toBe(PAGES.length);
    for (const p of PAGES) {
      expect(p.title.length).toBeGreaterThan(2);
      expect(p.caption(s)).not.toMatch(/—/);
      expect(p.hint).toMatch(/\.$/);
    }
  });

  it('survives the save round trip and drops anything malformed', () => {
    const s = normalize({ scrapbook: { home: '2026-11-09', kitten: 'yesterday', mower: 7 } });
    expect(s.scrapbook).toEqual({ home: '2026-11-09' });
    expect(normalize({}).scrapbook).toEqual({});
  });

  it('writes dates the way a person would', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(prettyDay('2026-11-09')).toBe('November 9, 2026');
  });
});
