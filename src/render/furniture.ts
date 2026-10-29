import { STAR_BLUE, STAR_CREAM, type PieceDef, type Restored } from '../content/blueStar';
import { star } from './characters';
import { C } from './palette';

type Ctx = CanvasRenderingContext2D;

/** A shade darker, for inset door and drawer fronts. */
export function shade(hex: string, k = 0.86): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k);
  const g = Math.round(((n >> 8) & 255) * k);
  const b = Math.round((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}

/** The part on top at a point (piece units), or -1. */
export function partUnder(def: PieceDef, x: number, y: number): number {
  let at = -1;
  def.parts.forEach((p, i) => {
    if (!p.open && x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) at = i;
  });
  return at;
}

/** Shop blue on shop blue doesn't show, so that star goes on in cream. */
export function starOn(def: PieceDef, look: Restored): string {
  if (!look.star) return STAR_BLUE;
  const at = partUnder(def, look.star[0] * def.w, look.star[1] * def.h);
  return at >= 0 && look.parts[at] === STAR_BLUE ? STAR_CREAM : STAR_BLUE;
}

/**
 * A restored piece as it stands out front of the shop: flat colours, ink outlines, brass knobs
 * and its star. (x, y) is the middle of its feet; s is world units per piece unit.
 */
export function drawPiece(ctx: Ctx, def: PieceDef, look: Restored, x: number, y: number, s: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 1, def.w * s * 0.62, 4.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.shadow;
  ctx.fill();
  ctx.translate(x - (def.w * s) / 2, y - def.h * s);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  def.parts.forEach((p, i) => {
    const col = look.parts[i] ?? look.parts[0];
    ctx.fillStyle = p.open ? '#3a2a20' : p.inset ? shade(col) : col;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5 / s;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
  });
  ctx.fillStyle = '#c9a548';
  for (const k of def.knobs) {
    ctx.beginPath();
    ctx.arc(k.x, k.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (look.star) star(ctx, look.star[0] * def.w, look.star[1] * def.h, 9, starOn(def, look));
  ctx.restore();
}
