import { FAMILY } from '../../content/cast';
import { C } from '../../render/palette';
import { drawPerson } from '../../render/people';
import { E, LOFT, N, S, slideRange, SOLVED_PAUSE, W, wet, type Bale, type PipeBoard, type PuzzleEvent, type PuzzleGame } from './puzzle';

type Ctx = CanvasRenderingContext2D;

interface Floater {
  text: string;
  x: number;
  y: number;
  t: number;
}

/** A piece being dragged: which one, and how far along its length (in cells, fractional). */
export interface Drag {
  id: string;
  offset: number;
}

/**
 * Draws Barn Puzzles: the hay loft floor from above with its bales and the wagon, or the water
 * line from the pump to the troughs. Jason leans on the rail at the bottom.
 */
export class PuzzleView {
  insetTop = 0;
  drag: Drag | null = null;
  private ctx: Ctx;
  private vw = 1;
  private vh = 1;
  private dpr = 1;
  /** Board square on screen (CSS pixels). */
  bx = 0;
  by = 0;
  cell = 40;
  private floaters: Floater[] = [];
  /** Pipe pieces mid-turn: how far they still have to swing (radians), by cell index. */
  private spin = new Map<number, number>();
  private clock = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly game: PuzzleGame,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  private get cols(): number {
    const b = this.game.board;
    return b.kind === 'hay' ? LOFT : b.w;
  }

  private get rowsN(): number {
    const b = this.game.board;
    return b.kind === 'hay' ? LOFT : b.h;
  }

  resize(w: number, h: number, dpr: number): void {
    this.vw = w;
    this.vh = h;
    this.dpr = Math.min(2, dpr);
    if (this.canvas.width !== Math.round(w * this.dpr)) this.canvas.width = Math.round(w * this.dpr);
    if (this.canvas.height !== Math.round(h * this.dpr)) this.canvas.height = Math.round(h * this.dpr);
    this.layout();
  }

  /** Fit the board below the HUD with room round the edge for the door, pump and troughs. */
  layout(): void {
    const top = this.insetTop + 24;
    const bottom = 96;
    const availH = this.vh - top - bottom;
    const availW = this.vw - 88;
    const n = Math.max(this.cols, this.rowsN);
    this.cell = Math.max(24, Math.min(availW / n, availH / n, 74));
    this.bx = (this.vw - this.cell * this.cols) / 2;
    this.by = top + (availH - this.cell * this.rowsN) / 2;
  }

  /** Which cell a screen point is in (may be off the board). */
  cellAt(x: number, y: number): { cx: number; cy: number } {
    return { cx: Math.floor((x - this.bx) / this.cell), cy: Math.floor((y - this.by) / this.cell) };
  }

  /** The "start this board over" link under the board. */
  retryBox(): { x: number; y: number; w: number; h: number } {
    return { x: this.vw / 2 - 90, y: this.by + this.cell * this.rowsN + 30, w: 180, h: 36 };
  }

  handleEvent(e: PuzzleEvent): void {
    if (e.type === 'solved') {
      const d = e.moves - e.par;
      this.floaters.push({ text: d <= 0 ? 'Par!' : `+${d}`, x: this.bx + (this.cell * this.cols) / 2, y: this.by - 4, t: 0 });
    }
  }

  /** A pipe piece just turned: swing it the last quarter on screen. */
  turned(i: number): void {
    this.spin.set(i, (this.spin.get(i) ?? 0) - Math.PI / 2);
  }

  update(dt: number): void {
    this.clock += dt;
    for (const f of this.floaters) f.t += dt;
    this.floaters = this.floaters.filter((f) => f.t < 1.4);
    for (const [i, a] of this.spin) {
      const n = a * Math.exp(-dt * 18);
      if (Math.abs(n) < 0.01) this.spin.delete(i);
      else this.spin.set(i, n);
    }
  }

  render(): void {
    const ctx = this.ctx;
    const g = this.game;
    this.layout();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const b = g.board;
    if (b.kind === 'hay') this.renderHay();
    else this.renderPipes(b);
    // Jason, watching from the rail.
    const jx = Math.min(this.vw - 34, this.bx + this.cell * this.cols + 26);
    const jy = this.vh - 22;
    drawPerson(ctx, FAMILY.jason.look, { x: jx, y: jy, faceX: -1, speed01: 0, walkPhase: 0, clock: this.clock, action: g.phase !== 'play' ? 'cheer' : 'none', ghost: false });
    // Start the board over.
    if (g.phase === 'play' && g.moves > 0) {
      const r = this.retryBox();
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 18);
      ctx.fillStyle = 'rgba(255,250,240,0.9)';
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.font = '800 14px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Start this one over', r.x + r.w / 2, r.y + r.h / 2 + 1);
    }
    for (const f of this.floaters) {
      const k = f.t / 1.4;
      ctx.globalAlpha = 1 - k * k;
      ctx.font = '900 26px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = C.ink;
      ctx.strokeText(f.text, f.x, f.y - k * 30);
      ctx.fillStyle = '#fff3b0';
      ctx.fillText(f.text, f.x, f.y - k * 30);
      ctx.globalAlpha = 1;
    }
  }

  /* --- Hay Loft --------------------------------------------------------------------------- */

  private renderHay(): void {
    const ctx = this.ctx;
    const g = this.game;
    const cs = this.cell;
    const { bx, by } = this;
    const size = cs * LOFT;
    // The barn around the loft.
    ctx.fillStyle = '#7a3a2e';
    ctx.fillRect(0, 0, this.vw, this.vh);
    // Loft walls, with the door on the right at the wagon's row.
    const wall = Math.max(8, cs * 0.22);
    ctx.fillStyle = C.woodDark;
    ctx.fillRect(bx - wall, by - wall, size + wall * 2, size + wall * 2);
    // Floor planks.
    for (let i = 0; i < LOFT * 2; i++) {
      ctx.fillStyle = i % 2 ? '#c4935f' : '#b8864f';
      ctx.fillRect(bx, by + (i * size) / (LOFT * 2), size, size / (LOFT * 2));
    }
    ctx.strokeStyle = 'rgba(59,42,32,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= LOFT; i++) {
      ctx.beginPath();
      ctx.moveTo(bx + i * cs, by);
      ctx.lineTo(bx + i * cs, by + size);
      ctx.stroke();
    }
    // Loose straw.
    ctx.strokeStyle = 'rgba(240,210,120,0.55)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 40; i++) {
      const x = bx + ((i * 97) % 100) / 100 * size;
      const y = by + ((i * 61) % 100) / 100 * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 6, y + 2);
      ctx.stroke();
    }
    // The open door, and the daylight through it.
    const dy = by + 2 * cs;
    ctx.fillStyle = '#9fd47a';
    ctx.fillRect(bx + size, dy + 2, wall + 40, cs - 4);
    const pulse = 0.5 + 0.5 * Math.sin(this.clock * 4);
    ctx.fillStyle = `rgba(255,236,150,${0.25 + pulse * 0.25})`;
    ctx.fillRect(bx + size - 4, dy + 2, wall + 4, cs - 4);
    // Arrow out the door.
    ctx.save();
    ctx.translate(bx + size + wall + 18, dy + cs / 2);
    ctx.beginPath();
    ctx.moveTo(-8, -9);
    ctx.lineTo(4, 0);
    ctx.lineTo(-8, 9);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
    // Pieces.
    const out = g.phase !== 'play' ? Math.min(1, g.solvedT / (SOLVED_PAUSE * 0.7)) : 0;
    for (const p of g.pieces) {
      let ox = 0;
      let oy = 0;
      if (this.drag?.id === p.id) {
        if (p.dir === 'h') ox = this.drag.offset;
        else oy = this.drag.offset;
      }
      if (p.kind === 'wagon') ox += out * 3;
      this.drawPiece(p, bx + (p.x + ox) * cs, by + (p.y + oy) * cs);
    }
  }

  private drawPiece(p: Bale, x: number, y: number): void {
    const ctx = this.ctx;
    const cs = this.cell;
    const w = (p.dir === 'h' ? p.len : 1) * cs;
    const h = (p.dir === 'v' ? p.len : 1) * cs;
    const pad = cs * 0.07;
    ctx.save();
    ctx.lineJoin = 'round';
    if (p.kind === 'post') {
      ctx.beginPath();
      ctx.arc(x + cs / 2, y + cs / 2, cs * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = C.wood;
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + cs / 2, y + cs / 2, cs * 0.16, 0, Math.PI * 2);
      ctx.strokeStyle = C.woodDark;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
      return;
    }
    // Shadow.
    ctx.beginPath();
    ctx.roundRect(x + pad + 3, y + pad + 4, w - pad * 2, h - pad * 2, cs * 0.14);
    ctx.fillStyle = 'rgba(40,25,10,0.3)';
    ctx.fill();
    if (p.kind === 'wagon') {
      // The hay wagon: red sides, a load of hay, wheels at the corners.
      for (const [wx, wy] of [
        [x + cs * 0.38, y + pad + 1],
        [x + w - cs * 0.38, y + pad + 1],
        [x + cs * 0.38, y + h - pad - 1],
        [x + w - cs * 0.38, y + h - pad - 1],
      ]) {
        ctx.beginPath();
        ctx.ellipse(wx, wy, cs * 0.17, cs * 0.08, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#2b2a30';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.roundRect(x + pad, y + pad + cs * 0.06, w - pad * 2, h - pad * 2 - cs * 0.12, cs * 0.12);
      ctx.fillStyle = C.barnRed;
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(x + pad + cs * 0.14, y + pad + cs * 0.2, w - pad * 2 - cs * 0.28, h - pad * 2 - cs * 0.4, cs * 0.18);
      ctx.fillStyle = '#efcf72';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // Tongue at the front, pointing at the door.
      ctx.beginPath();
      ctx.moveTo(x + w - pad, y + h / 2);
      ctx.lineTo(x + w + cs * 0.12, y + h / 2);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      return;
    }
    // A hay bale: straw, two twine bands across it.
    ctx.beginPath();
    ctx.roundRect(x + pad, y + pad, w - pad * 2, h - pad * 2, cs * 0.12);
    ctx.fillStyle = p.len === 3 ? '#dcb85a' : '#e8c76a';
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150,110,40,0.55)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const sx = x + pad + ((i * 37) % 90) / 100 * (w - pad * 2);
      const sy = y + pad + ((i * 53) % 80) / 100 * (h - pad * 2) + 4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (p.dir === 'h' ? 7 : 2), sy + (p.dir === 'h' ? 1 : 7));
      ctx.stroke();
    }
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 2;
    const long = p.dir === 'h' ? w : h;
    for (const f of [0.3, 0.7]) {
      ctx.beginPath();
      if (p.dir === 'h') {
        ctx.moveTo(x + long * f, y + pad);
        ctx.lineTo(x + long * f, y + h - pad);
      } else {
        ctx.moveTo(x + pad, y + long * f);
        ctx.lineTo(x + w - pad, y + long * f);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /** How far a dragged piece may go each way right now (cells). */
  dragLimits(id: string): [number, number] {
    const p = this.game.pieces.find((q) => q.id === id);
    if (!p) return [0, 0];
    return slideRange(this.game.pieces, p);
  }

  /* --- Water Line -------------------------------------------------------------------------- */

  private renderPipes(b: PipeBoard): void {
    const ctx = this.ctx;
    const g = this.game;
    const cs = this.cell;
    const { bx, by } = this;
    ctx.fillStyle = '#86c051';
    ctx.fillRect(0, 0, this.vw, this.vh);
    const wetCells = wet(b, g.tiles);
    // Packed dirt under the board.
    ctx.beginPath();
    ctx.roundRect(bx - 8, by - 8, cs * b.w + 16, cs * b.h + 16, 14);
    ctx.fillStyle = C.dirtDark;
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let y = 0; y < b.h; y++)
      for (let x = 0; x < b.w; x++) {
        const i = y * b.w + x;
        const t = g.tiles[i];
        const cx = bx + x * cs + cs / 2;
        const cy = by + y * cs + cs / 2;
        ctx.beginPath();
        ctx.roundRect(cx - cs / 2 + 2, cy - cs / 2 + 2, cs - 4, cs - 4, 6);
        ctx.fillStyle = (x + y) % 2 ? '#cfa66c' : '#c99e62';
        ctx.fill();
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.spin.get(i) ?? 0);
        drawPipe(ctx, t.mask, cs, wetCells.has(i), this.clock);
        ctx.restore();
      }
    // The pump and the troughs, just off the board.
    const port = (p: { x: number; y: number; side: number }) => {
      const cx = bx + p.x * cs + cs / 2;
      const cy = by + p.y * cs + cs / 2;
      const off = cs * 0.5 + 18;
      const dx = p.side === E ? off : p.side === W ? -off : 0;
      const dy = p.side === S ? off : p.side === N ? -off : 0;
      return { x: cx + dx, y: cy + dy, horiz: p.side === E || p.side === W };
    };
    const pp = port(b.pump);
    drawPump(ctx, pp.x, pp.y, cs, this.clock);
    for (const t of b.troughs) {
      const tp = port(t);
      const full = wetCells.has(t.y * b.w + t.x) && !!(g.tiles[t.y * b.w + t.x].mask & t.side);
      drawTrough(ctx, tp.x, tp.y, cs, !tp.horiz, full, this.clock);
    }
  }
}

/** One pipe piece: a pipe from the middle out to each open side, blue where the water is. */
function drawPipe(ctx: Ctx, mask: number, cs: number, isWet: boolean, clock: number): void {
  const r = cs / 2 - 2;
  ctx.lineCap = 'round';
  const arms = [N, E, S, W].filter((s) => mask & s);
  const draw = (width: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (const s of arms) {
      ctx.moveTo(0, 0);
      ctx.lineTo(s === E ? r : s === W ? -r : 0, s === S ? r : s === N ? -r : 0);
    }
    ctx.stroke();
  };
  draw(cs * 0.34, C.ink);
  draw(cs * 0.26, isWet ? '#4aa3d8' : '#9aa5ad');
  if (isWet) {
    // Ripples running along the water.
    ctx.setLineDash([3, 7]);
    ctx.lineDashOffset = -clock * 30;
    draw(cs * 0.08, 'rgba(255,255,255,0.75)');
    ctx.setLineDash([]);
  }
  ctx.beginPath();
  ctx.arc(0, 0, cs * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = isWet ? '#3f93bd' : '#7d878f';
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

/** The old red hand pump the water comes from. */
function drawPump(ctx: Ctx, x: number, y: number, cs: number, clock: number): void {
  const s = Math.min(1.2, cs / 50);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.roundRect(-7, -16, 14, 30, 4);
  ctx.fillStyle = C.barnRed;
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Handle, rocking.
  ctx.save();
  ctx.translate(0, -14);
  ctx.rotate(Math.sin(clock * 3) * 0.3 - 0.3);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-16, -8);
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(7, -6);
  ctx.lineTo(14, -6);
  ctx.lineTo(14, -1);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

/** A stock trough: empty and dusty, or full and rippling. */
function drawTrough(ctx: Ctx, x: number, y: number, cs: number, flat: boolean, full: boolean, clock: number): void {
  const s = Math.min(1.2, cs / 50);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (!flat) ctx.rotate(Math.PI / 2);
  ctx.beginPath();
  ctx.roundRect(-20, -10, 40, 20, 6);
  ctx.fillStyle = '#9aa5ad';
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-15, -6, 30, 12, 4);
  ctx.fillStyle = full ? '#5fb6d6' : '#6b5440';
  ctx.fill();
  if (full) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const k = (clock * 0.8) % 1;
    ctx.ellipse(0, 0, 4 + k * 10, 1.5 + k * 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
