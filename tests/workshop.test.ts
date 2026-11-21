import { describe, expect, it } from 'vitest';
import { GRANDPA_LINES, PAINTS, PIECES, STAR_BLUE, STAR_CREAM } from '../src/content/blueStar';
import { normalize } from '../src/core/save';
import { PLAYER_RADIUS } from '../src/games/kitten/player';
import { CELL, Workshop } from '../src/games/workshop/workshop';
import { Homestead, WORKSHOP } from '../src/hub/homestead';
import { NavGrid } from '../src/world/navgrid';
import { sharedWorld } from '../src/world/shared';

const shared = sharedWorld();
const still = { moveX: 0, moveY: 0, whistle: false, treat: false };

/** Back and forth across the whole piece, the way a patient kid would. */
function sweep(w: Workshop): void {
  const p = w.piece;
  const start = w.phase;
  for (let y = 0; y <= p.h && w.phase === start && !(start === 'paint' && w.covered); y += CELL * 2) w.stroke(-4, y, p.w + 4, y);
}

describe('Blue Star workshop', () => {
  it('sands, paints and stars every piece, with no clock and no way to fail', () => {
    for (const piece of PIECES) {
      const w = new Workshop(piece);
      if (piece.halfDone) {
        // The cabinet out front: already sanded, left half painted, right half bare.
        expect(w.phase).toBe('paint');
        expect(PAINTS[w.color].hex).toBe(piece.halfDone);
        expect(w.paintFrac).toBeGreaterThan(0.35);
        expect(w.paintFrac).toBeLessThan(0.65);
      } else {
        expect(w.phase).toBe('sand');
        sweep(w);
        expect(w.phase, piece.id).toBe('paint');
        expect(w.drainEvents().some((e) => e.type === 'sanded')).toBe(true);
      }
      sweep(w);
      expect(w.covered, piece.id).toBe(true);
      expect(w.paintFrac).toBe(1);
      expect(w.toStar()).toBe(true);
      expect(w.phase).toBe('star');
      // Thin air doesn't take a star; the piece does.
      expect(w.placeStar(-20, -20)).toBe(false);
      const p = piece.parts.find((q) => !q.open)!;
      expect(w.placeStar(p.x + p.w / 2, p.y + p.h / 2)).toBe(true);
      expect(w.phase).toBe('done');
      const r = w.result();
      expect(r.parts).toHaveLength(piece.parts.length);
      expect(r.star![0]).toBeGreaterThanOrEqual(0);
      expect(r.star![1]).toBeLessThanOrEqual(1);
    }
  });

  it('keeps every colour you used, part by part', () => {
    const piece = PIECES.find((p) => p.id === 'chest')!;
    const w = new Workshop(piece);
    sweep(w);
    w.pickColor(PAINTS.findIndex((p) => p.id === 'sage'));
    sweep(w);
    // Touch up the lid in barn red.
    w.pickColor(PAINTS.findIndex((p) => p.id === 'red'));
    w.stroke(0, 6, piece.w, 6);
    expect(w.toStar()).toBe(true);
    const r = w.result();
    expect(r.parts[3]).toBe('#b8382c');
    expect(r.parts[0]).toBe('#9db58c');
  });

  it('puts the star on in cream where the paint is shop blue', () => {
    const w = new Workshop(PIECES[1]);
    sweep(w);
    w.pickColor(PAINTS.findIndex((p) => p.hex === STAR_BLUE));
    sweep(w);
    expect(w.starColorAt(40, 20)).toBe(STAR_CREAM);
    const v = new Workshop(PIECES[1]);
    sweep(v);
    sweep(v);
    expect(v.starColorAt(40, 20)).toBe(STAR_BLUE);
  });

  it('keeps Grandpa from putting words in Apple\'s mouth, and keeps score out of it', () => {
    const text = [...Object.values(GRANDPA_LINES), ...PIECES.map((p) => p.intro)].join(' ');
    expect(text).not.toMatch(/\b(points?|stars? earned|score|reward|bonus|hurry up)\b/i);
    expect(text).not.toMatch(/Apple (said|used to say|always said)/i);
    expect(text).not.toMatch(/—/);
  });

  it('starts at the cabinet outside the shop, never during a mission', () => {
    const nav = new NavGrid(shared.world, 16, PLAYER_RADIUS);
    const h = new Homestead(shared, { explorer: 'natalie', ornaments: [], discoveries: [], huntFound: [] });
    const spot = nav.nearestWalkable(WORKSHOP.x, WORKSHOP.y + 30, 6)!;
    expect(Math.hypot(spot.x - WORKSHOP.x, spot.y - WORKSHOP.y)).toBeLessThan(50);
    expect(nav.reachable(h.startPoint(), spot)).toBe(true);
    h.teleport(spot.x, spot.y);
    h.step(still, 1 / 60, false);
    expect(h.action?.kind).toBe('workshop');
    h.step(still, 1 / 60, true);
    expect(h.drainEvents().some((e) => e.type === 'workshop')).toBe(true);
    h.startHunt();
    h.teleport(spot.x, spot.y);
    h.step(still, 1 / 60, false);
    expect(h.action?.kind).not.toBe('workshop');
  });

  it('remembers restored pieces, and ignores junk', () => {
    const cab = PIECES[0];
    const good = { parts: cab.parts.map(() => '#8fb1d6'), star: [0.5, 0.3] };
    const s = normalize({ restored: { cabinet: good, piano: good, chest: { parts: ['red'], star: null }, chair: { parts: PIECES[2].parts.map(() => '#123456'), star: [3, 3] } } });
    expect(Object.keys(s.restored).sort()).toEqual(['cabinet', 'chair']);
    expect(s.restored.cabinet.star).toEqual([0.5, 0.3]);
    expect(s.restored.chair.star).toBeNull();
    expect(normalize({}).restored).toEqual({});
  });
});
