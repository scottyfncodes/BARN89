import { closestOnSegment, polylineFence, ringFence, type Shape } from './shapes';
import type { PropDef, RanchMap, TreeDef } from './mapTypes';

export const TREE_TRUNK: Record<TreeDef['variant'], number> = { oak: 0.42, pine: 0.36, willow: 0.4, bush: 0.72 };

export function treeSolidRadius(t: TreeDef): number {
  return t.r * TREE_TRUNK[t.variant];
}

export function propSolid(p: PropDef): Shape | null {
  if (!p.solid) return null;
  switch (p.kind) {
    case 'roundBale':
    case 'trampoline':
    case 'barrel':
    case 'rock':
    case 'flowers':
      return { kind: 'circle', x: p.x, y: p.y, r: p.w ?? 16 };
    case 'squareBale':
    case 'trough': {
      const w = p.w ?? 50;
      const h = p.h ?? 26;
      return { kind: 'rect', x: p.x - w / 2, y: p.y - h / 2, w, h };
    }
    case 'farmStand':
      return { kind: 'rect', x: p.x - 24, y: p.y - 8, w: 48, h: 12 };
    case 'cart':
      return { kind: 'rect', x: p.x - 34, y: p.y - 16, w: 68, h: 32 };
    case 'jump': {
      const half = (p.w ?? 100) / 2;
      const a = p.angle ?? 0;
      const dx = Math.cos(a) * half;
      const dy = Math.sin(a) * half;
      return { kind: 'segment', ax: p.x - dx, ay: p.y - dy, bx: p.x + dx, by: p.y + dy, r: 5 };
    }
    case 'well':
      return { kind: 'circle', x: p.x, y: p.y, r: 22 };
    case 'mailbox':
    case 'sign':
      return { kind: 'circle', x: p.x, y: p.y, r: 8 };
    case 'scarecrow':
    case 'chopBlock':
      return { kind: 'circle', x: p.x, y: p.y, r: p.kind === 'chopBlock' ? 15 : 10 };
    case 'pickup': {
      // A capsule along the truck, nose to tailgate.
      const len = p.w ?? 100;
      const half = len / 2 - len * 0.22;
      const a = p.angle ?? 0;
      return { kind: 'segment', ax: p.x - Math.cos(a) * half, ay: p.y - Math.sin(a) * half, bx: p.x + Math.cos(a) * half, by: p.y + Math.sin(a) * half, r: len * 0.22 };
    }
    case 'cabinet':
      return { kind: 'circle', x: p.x, y: p.y, r: 13 };
    case 'treehouse':
      // The trunk and the foot of the ladder.
      return { kind: 'rect', x: p.x - 12, y: p.y - 8, w: 60, h: 12 };
    case 'doghouse':
      return { kind: 'rect', x: p.x - 30, y: p.y - 30, w: 60, h: 32 };
    case 'woodpile': {
      const w = p.w ?? 120;
      return { kind: 'rect', x: p.x - w / 2, y: p.y - 20, w, h: 24 };
    }
    case 'longTable': {
      const w = p.w ?? 150;
      return { kind: 'rect', x: p.x - w / 2 - 6, y: p.y - 30, w: w + 12, h: 52 };
    }
    case 'venueSign':
      return { kind: 'segment', ax: p.x - 44, ay: p.y, bx: p.x + 44, by: p.y, r: 6 };
    default:
      return null;
  }
}

/** Extra solids for props with more than one footprint (the festoon light poles). */
function propExtraSolids(p: PropDef): Shape[] {
  if (p.kind === 'festoon' && p.solid) {
    const w = p.w ?? 200;
    return [
      { kind: 'circle', x: p.x, y: p.y, r: 7 },
      { kind: 'circle', x: p.x + w, y: p.y, r: 7 },
    ];
  }
  return [];
}

/** Every solid in the level, derived from the visual map so art and collision always agree. */
export function buildSolids(map: RanchMap): Shape[] {
  const out: Shape[] = [];
  for (const b of map.buildings) out.push({ kind: 'rect', x: b.x, y: b.y, w: b.w, h: b.h });
  for (const t of map.trees) out.push({ kind: 'circle', x: t.x, y: t.y, r: treeSolidRadius(t) });
  for (const f of map.fences) out.push(...polylineFence(f.points, 4));
  for (const p of map.pens) {
    const gate = p.gateAngle !== undefined ? { angle: p.gateAngle, width: p.gateWidth ?? 90 } : undefined;
    out.push(...ringFence(p.x, p.y, p.r, 28, gate, 4));
  }
  for (const p of map.props) {
    const s = propSolid(p);
    if (s) out.push(s);
    out.push(...propExtraSolids(p));
  }
  out.push(...map.extraSolids);
  return out;
}

/** Removes decorative trees that would land on roads, buildings or enclosures. */
export function pruneTrees(map: RanchMap, trees: TreeDef[]): TreeDef[] {
  const roadClear = (x: number, y: number, pad: number): boolean => {
    for (const road of map.roads) {
      const pts = road.loop ? [...road.points, road.points[0]] : road.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const q = closestOnSegment(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
        if (Math.hypot(q.x - x, q.y - y) < road.width / 2 + pad) return false;
      }
    }
    return true;
  };
  const rects = [
    ...map.buildings.map((b) => ({ x: b.x, y: b.y - b.wall, w: b.w, h: b.h + b.wall })),
    ...map.zoomieZones,
  ];
  return trees.filter((t) => {
    const pad = treeSolidRadius(t) + 18;
    if (!roadClear(t.x, t.y, pad)) return false;
    for (const r of rects) {
      if (t.x > r.x - pad && t.x < r.x + r.w + pad && t.y > r.y - pad && t.y < r.y + r.h + pad) return false;
    }
    for (const p of map.pens) if (Math.hypot(t.x - p.x, t.y - p.y) < p.r + pad) return false;
    for (const c of map.collectibles) if (Math.hypot(t.x - c.x, t.y - c.y) < pad + 24) return false;
    for (const p of map.props) {
      const half = p.kind === 'festoon' ? (p.w ?? 200) / 2 : (p.w ?? 30) / 2;
      const cx = p.kind === 'festoon' ? p.x + half : p.x;
      if (Math.abs(t.x - cx) < half + pad && Math.abs(t.y - p.y) < pad + 20) return false;
    }
    for (const f of map.fences) {
      for (let i = 0; i < f.points.length - 1; i++) {
        const [ax, ay] = f.points[i];
        const [bx, by] = f.points[i + 1];
        const q = closestOnSegment(t.x, t.y, ax, ay, bx, by);
        if (Math.hypot(q.x - t.x, q.y - t.y) < pad) return false;
      }
    }
    return true;
  });
}
