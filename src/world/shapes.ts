import type { Vec } from '../core/math';

/** Solid geometry. Everything that blocks movement is one of these three primitives. */
export interface RectShape {
  kind: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CircleShape {
  kind: 'circle';
  x: number;
  y: number;
  r: number;
}

/** A thick line segment: fences, rails, walls. */
export interface SegmentShape {
  kind: 'segment';
  ax: number;
  ay: number;
  bx: number;
  by: number;
  r: number;
}

export type Shape = RectShape | CircleShape | SegmentShape;

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function shapeBounds(s: Shape): Bounds {
  switch (s.kind) {
    case 'rect':
      return { minX: s.x, minY: s.y, maxX: s.x + s.w, maxY: s.y + s.h };
    case 'circle':
      return { minX: s.x - s.r, minY: s.y - s.r, maxX: s.x + s.r, maxY: s.y + s.r };
    case 'segment':
      return {
        minX: Math.min(s.ax, s.bx) - s.r,
        minY: Math.min(s.ay, s.by) - s.r,
        maxX: Math.max(s.ax, s.bx) + s.r,
        maxY: Math.max(s.ay, s.by) + s.r,
      };
  }
}

/** Closest point on a segment to p. */
export function closestOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): Vec {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return { x: ax + dx * t, y: ay + dy * t };
}

/**
 * Penetration of a circle (cx, cy, r) into a shape.
 * Returns the push vector that resolves the overlap, or null when not touching.
 */
export function circlePenetration(cx: number, cy: number, r: number, s: Shape): Vec | null {
  let qx: number;
  let qy: number;
  let extra = 0;
  if (s.kind === 'rect') {
    const inside = cx > s.x && cx < s.x + s.w && cy > s.y && cy < s.y + s.h;
    if (inside) {
      // Centre is inside the rectangle: push out through the nearest face.
      const left = cx - s.x;
      const right = s.x + s.w - cx;
      const top = cy - s.y;
      const bottom = s.y + s.h - cy;
      const m = Math.min(left, right, top, bottom);
      if (m === left) return { x: -(left + r), y: 0 };
      if (m === right) return { x: right + r, y: 0 };
      if (m === top) return { x: 0, y: -(top + r) };
      return { x: 0, y: bottom + r };
    }
    qx = cx < s.x ? s.x : cx > s.x + s.w ? s.x + s.w : cx;
    qy = cy < s.y ? s.y : cy > s.y + s.h ? s.y + s.h : cy;
  } else if (s.kind === 'circle') {
    qx = s.x;
    qy = s.y;
    extra = s.r;
  } else {
    const q = closestOnSegment(cx, cy, s.ax, s.ay, s.bx, s.by);
    qx = q.x;
    qy = q.y;
    extra = s.r;
  }
  const dx = cx - qx;
  const dy = cy - qy;
  const d2 = dx * dx + dy * dy;
  const rr = r + extra;
  if (d2 >= rr * rr) return null;
  const d = Math.sqrt(d2);
  if (d < 1e-6) {
    // Degenerate: exactly on the shape's core. Push upward-ish deterministically.
    return { x: 0, y: -rr };
  }
  const push = rr - d;
  return { x: (dx / d) * push, y: (dy / d) * push };
}

export function circleOverlaps(cx: number, cy: number, r: number, s: Shape): boolean {
  return circlePenetration(cx, cy, r, s) !== null;
}

/** Does the segment p0->p1 (swept with radius r) hit the shape? Sampled; good enough for line-of-sight. */
export function segmentHits(x0: number, y0: number, x1: number, y1: number, r: number, s: Shape, step = 8): boolean {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(d / step));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (circleOverlaps(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, s)) return true;
  }
  return false;
}

/** Builds a ring of fence segments around a centre with an optional gap (the gate). */
export function ringFence(
  cx: number,
  cy: number,
  radius: number,
  segments: number,
  gate?: { angle: number; width: number },
  thickness = 5,
): SegmentShape[] {
  const out: SegmentShape[] = [];
  const gateHalf = gate ? gate.width / radius / 2 : 0;
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    if (gate) {
      const mid = (a0 + a1) / 2;
      const d = Math.abs(((((mid - gate.angle) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < gateHalf) continue;
    }
    out.push({
      kind: 'segment',
      ax: cx + Math.cos(a0) * radius,
      ay: cy + Math.sin(a0) * radius,
      bx: cx + Math.cos(a1) * radius,
      by: cy + Math.sin(a1) * radius,
      r: thickness,
    });
  }
  return out;
}

/** A fence following a run of points. Leave gates by starting a new run. */
export function polylineFence(points: readonly (readonly [number, number])[], thickness = 5): SegmentShape[] {
  const out: SegmentShape[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    out.push({ kind: 'segment', ax, ay, bx, by, r: thickness });
  }
  return out;
}
