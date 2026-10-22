import { describe, expect, it } from 'vitest';
import { createRanchMap, EAST_FENCE } from '../src/world/ranch';

/**
 * The ranch is traced from docs/reference/aerial.jpg at 2 world units per aerial pixel.
 * These checks pin each landmark to where it sits in the photo (within a tolerance), so
 * future edits can't quietly drift away from the real layout.
 */
const AERIAL_TO_WORLD = 2;
const map = createRanchMap();
const building = (id: string) => map.buildings.find((b) => b.id === id)!;
const centre = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const near = (p: { x: number; y: number }, aerial: [number, number], tol: number) =>
  Math.hypot(p.x - aerial[0] * AERIAL_TO_WORLD, p.y - aerial[1] * AERIAL_TO_WORLD) < tol;

describe('ranch layout matches the aerial photo', () => {
  it('places the buildings where the photo shows them', () => {
    expect(near(centre(building('mainHouse')), [425, 410], 120)).toBe(true);
    // Grandpa's place is several roofs; the whole of it sits where the photo shows it.
    const gp = ['grandpaHouse', 'grandpaBayW', 'grandpaBayE', 'grandpaShop', 'grandpaEast'].map(building);
    const x0 = Math.min(...gp.map((b) => b.x));
    const x1 = Math.max(...gp.map((b) => b.x + b.w));
    const y0 = Math.min(...gp.map((b) => b.y));
    const y1 = Math.max(...gp.map((b) => b.y + b.h));
    expect(near({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, [860, 280], 80)).toBe(true);
    expect(near(centre(building('whiteShed')), [252, 610], 60)).toBe(true);
    expect(near(centre(building('stable')), [840, 1075], 80)).toBe(true);
    expect(near(centre(building('barn89')), [835, 1255], 80)).toBe(true);
  });

  it("puts Grandpa's shop on the east end of his house, with the blue star", () => {
    const house = building('grandpaHouse');
    const shop = building('grandpaShop');
    // The separately roofed east wing in the aerial, where his driveway comes in.
    expect(near(centre(shop), [915, 287], 80)).toBe(true);
    // Set back between the porch bay and the east wing, flush with the main block's front.
    const bay = building('grandpaBayE');
    const east = building('grandpaEast');
    expect(Math.abs(shop.x - (bay.x + bay.w))).toBeLessThan(4);
    expect(Math.abs(east.x - (shop.x + shop.w))).toBeLessThan(4);
    expect(shop.y + shop.h).toBe(house.y + house.h);
    expect(bay.y + bay.h).toBeGreaterThan(shop.y + shop.h);
    expect(shop.star).toBeTruthy();
  });

  it('gives the main house its L: the west wing reaches further south than the rest', () => {
    const main = building('mainHouse');
    const wing = building('mainHouseWing');
    expect(wing.x + wing.w).toBe(main.x);
    expect(wing.y + wing.h).toBeGreaterThan(main.y + main.h + 60);
    expect(wing.gable).toBe('front');
    // The whole house spans the roofline in the photo.
    expect(near({ x: (wing.x + main.x + main.w) / 2, y: main.y + main.h / 2 }, [425, 400], 60)).toBe(true);
  });

  it('puts the arena on the east side against Buffalo Gap Rd', () => {
    const z = map.zoomieZones[0];
    expect(near({ x: z.x + z.w / 2, y: z.y + z.h / 2 }, [855, 870], 140)).toBe(true);
    expect(z.x + z.w).toBe(EAST_FENCE);
  });

  it('has the round pen in the middle and the round corral south of it', () => {
    const roundPen = map.pens.find((p) => p.id === 'roundPen')!;
    const corral = map.pens.find((p) => p.id === 'corral')!;
    expect(near(roundPen, [590, 895], 80)).toBe(true);
    expect(near(corral, [670, 1255], 80)).toBe(true);
  });

  it('runs the highway beyond the east fence', () => {
    const road = map.areas.find((a) => a.kind === 'asphalt')!;
    expect(road.shape.type === 'rect' && road.shape.x > EAST_FENCE).toBe(true);
  });
});
