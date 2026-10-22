import { CHIHUAHUAS, DONKEYS, FAMILY } from '../../content/cast';
import { drawChicken, drawDog, drawDonkey } from '../../render/animals';
import { C } from '../../render/palette';
import { drawPerson } from '../../render/people';
import { BALL_R, CUP_R, moverPos, type Bumper, type Mover, type PuttEvent, type PuttGame } from './putt';

type Ctx = CanvasRenderingContext2D;

/** The field every hole is laid out in (see putt.ts). */
const FIELD_W = 320;
const FIELD_H = 480;

interface Floater {
  text: string;
  x: number;
  y: number;
  t: number;
}

/** Draws Putt-Putt: the hole from above, Grandpa watching from the side, and your aim. */
export class PuttView {
  insetTop = 0;
  /** Aim from the scene: direction the ball will go, and power 0..1. */
  aim: { dx: number; dy: number; power: number } | null = null;
  private ctx: Ctx;
  private vw = 1;
  private vh = 1;
  private dpr = 1;
  private s = 1;
  private ox = 0;
  private oy = 0;
  private floaters: Floater[] = [];
  private cheerT = 0;
  private sinkT = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly game: PuttGame,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  resize(w: number, h: number, dpr: number): void {
    this.vw = w;
    this.vh = h;
    this.dpr = Math.min(2, dpr);
    if (this.canvas.width !== Math.round(w * this.dpr)) this.canvas.width = Math.round(w * this.dpr);
    if (this.canvas.height !== Math.round(h * this.dpr)) this.canvas.height = Math.round(h * this.dpr);
    // Fit the hole below the HUD, leaving room at the sides for Grandpa in landscape.
    const top = this.insetTop + 10;
    const availH = h - top - 16;
    const landscape = w > h * 1.1;
    this.s = Math.min((landscape ? w * 0.6 : w - 16) / FIELD_W, availH / FIELD_H);
    this.ox = (w - FIELD_W * this.s) / 2;
    this.oy = top + (availH - FIELD_H * this.s) / 2;
  }

  handleEvent(e: PuttEvent): void {
    const g = this.game;
    if (e.type === 'sink') {
      const d = e.strokes - e.par;
      const word = e.strokes === 1 ? 'Hole in one!' : d <= -2 ? 'Eagle!' : d === -1 ? 'Birdie!' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : `+${d}`;
      this.floaters.push({ text: word, x: g.hole.cup.x, y: g.hole.cup.y - 24, t: 0 });
      if (d <= 0) this.cheerT = 1.4;
      this.sinkT = 0.5;
    } else if (e.type === 'pickup') this.floaters.push({ text: 'Pick it up!', x: g.ball.x, y: g.ball.y - 20, t: 0 });
    else if (e.type === 'lip') this.floaters.push({ text: 'Too hot!', x: g.hole.cup.x, y: g.hole.cup.y - 20, t: 0 });
    else if (e.type === 'done') this.cheerT = 2;
  }

  update(dt: number): void {
    for (const f of this.floaters) f.t += dt;
    this.floaters = this.floaters.filter((f) => f.t < 1.4);
    this.cheerT = Math.max(0, this.cheerT - dt);
    this.sinkT = Math.max(0, this.sinkT - dt);
  }

  render(): void {
    const ctx = this.ctx;
    const g = this.game;
    const h = g.hole;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // The lawn around the course, with a few tufts.
    ctx.fillStyle = C.grass;
    ctx.fillRect(0, 0, this.vw, this.vh);
    ctx.strokeStyle = C.grassDark;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 70; i++) {
      const x = ((i * 97) % 1000) / 1000 * this.vw;
      const y = ((i * 61 + 13) % 1000) / 1000 * this.vh;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 2, y - 6);
      ctx.moveTo(x + 3, y);
      ctx.lineTo(x + 4, y - 7);
      ctx.stroke();
    }
    ctx.setTransform(this.dpr * this.s, 0, 0, this.dpr * this.s, this.dpr * this.ox, this.dpr * this.oy);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Carpet, hazards, rails.
    const outline = () => {
      ctx.beginPath();
      h.outline.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
    };
    outline();
    ctx.fillStyle = 'rgba(40,30,15,0.25)';
    ctx.save();
    ctx.translate(4, 6);
    ctx.fill();
    ctx.restore();
    outline();
    ctx.fillStyle = '#6cc152';
    ctx.fill();
    ctx.save();
    outline();
    ctx.clip();
    // Mowing stripes on the carpet.
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 0; y < FIELD_H; y += 40) ctx.fillRect(0, y, FIELD_W, 20);
    for (const p of h.patches ?? []) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.kind === 'sand' ? C.sand : '#7a5a3a';
      ctx.fill();
      ctx.strokeStyle = p.kind === 'sand' ? C.sandDark : '#5a4028';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = p.kind === 'sand' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.18)';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(i * 2.1) * p.rx * 0.5, p.y + Math.sin(i * 1.7) * p.ry * 0.5, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    // Tee box.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(h.tee.x - 14, h.tee.y + 10, 28, 3);
    // Rails round the outside and across the middle.
    const rail = (pts: { x: number; y: number }[], closed: boolean) => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      if (closed) ctx.closePath();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.strokeStyle = C.woodLight;
      ctx.lineWidth = 6.5;
      ctx.stroke();
    };
    rail(h.outline, true);
    for (const w of h.walls ?? []) rail(w, false);

    // The cup and its flag (the flag lifts out as the ball rolls close).
    const near = Math.hypot(g.ball.x - h.cup.x, g.ball.y - h.cup.y) < 60;
    ctx.beginPath();
    ctx.ellipse(h.cup.x, h.cup.y, CUP_R, CUP_R * 0.75, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1f2a14';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (!near) {
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(h.cup.x, h.cup.y);
      ctx.lineTo(h.cup.x, h.cup.y - 40);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(h.cup.x, h.cup.y - 40);
      ctx.lineTo(h.cup.x + 18, h.cup.y - 34 + Math.sin(g.clock * 3) * 2);
      ctx.lineTo(h.cup.x, h.cup.y - 27);
      ctx.closePath();
      ctx.fillStyle = C.barnRed;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#fff8e9';
      ctx.font = '900 9px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(g.holeIndex + 1), h.cup.x + 6.5, h.cup.y - 33.5);
    }

    // Bumpers and animals, back to front.
    const things: { y: number; draw: () => void }[] = [];
    for (const k of h.bumpers ?? []) things.push({ y: k.y, draw: () => drawBumper(ctx, k) });
    for (const m of h.movers ?? []) {
      const mp = moverPos(m, g.clock);
      things.push({ y: mp.y, draw: () => drawMover(ctx, m, mp.x, mp.y, mp.vx, g.clock) });
    }
    // The ball (shrinking into the cup once it drops).
    const sinking = g.phase === 'sunk' || g.phase === 'celebrating';
    const br = sinking ? BALL_R * Math.max(0, this.sinkT / 0.5) : BALL_R;
    if (br > 0.2) {
      things.push({
        y: g.ball.y,
        draw: () => {
          ctx.beginPath();
          ctx.ellipse(g.ball.x + 2, g.ball.y + 3, br, br * 0.6, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(30,40,20,0.3)';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(g.ball.x, g.ball.y, br, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        },
      });
    }
    things.sort((a, b) => a.y - b.y);
    for (const t of things) t.draw();

    // Aim: a dotted line out of the ball, longer and hotter with more power.
    const a = this.aim;
    if (a && (g.phase === 'aim' || g.phase === 'intro')) {
      const d = Math.hypot(a.dx, a.dy) || 1;
      const len = 26 + a.power * 150;
      const col = a.power < 0.45 ? '#3f9a3f' : a.power < 0.8 ? '#e0a92a' : C.barnRed;
      ctx.save();
      ctx.setLineDash([2, 7]);
      ctx.lineDashOffset = -g.clock * 30;
      ctx.strokeStyle = col;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(g.ball.x, g.ball.y);
      ctx.lineTo(g.ball.x + (a.dx / d) * len, g.ball.y + (a.dy / d) * len);
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(g.ball.x, g.ball.y, BALL_R + 4 + a.power * 6, 0, Math.PI * 2);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Floating calls ("Birdie!").
    for (const f of this.floaters) {
      const k = f.t / 1.4;
      ctx.save();
      ctx.globalAlpha = 1 - k * k;
      ctx.font = '900 20px Rockwell, "Roboto Slab", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#fff8e9';
      ctx.strokeText(f.text, f.x, f.y - k * 30);
      ctx.fillStyle = C.barnRed;
      ctx.fillText(f.text, f.x, f.y - k * 30);
      ctx.restore();
    }

    // Grandpa watching from beside the course, putter in hand.
    this.drawGrandpa(ctx);

    // Hole card while it starts.
    if (g.phase === 'intro') {
      const k = Math.min(1, g.phaseT * 4) * Math.min(1, (0.9 - g.phaseT) * 4 + 0.2);
      ctx.save();
      ctx.globalAlpha = Math.max(0, k);
      ctx.beginPath();
      ctx.roundRect(FIELD_W / 2 - 110, FIELD_H / 2 - 36, 220, 66, 16);
      ctx.fillStyle = '#fff8e9';
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = C.barnRed;
      ctx.font = '900 20px Rockwell, "Roboto Slab", Georgia, serif';
      ctx.fillText(`Hole ${g.holeIndex + 1}: ${h.name}`, FIELD_W / 2, FIELD_H / 2 - 8);
      ctx.fillStyle = C.ink;
      ctx.font = '800 14px ui-rounded, system-ui, sans-serif';
      ctx.fillText(`Par ${h.par}`, FIELD_W / 2, FIELD_H / 2 + 16);
      ctx.restore();
    }
  }

  private drawGrandpa(ctx: Ctx): void {
    const g = this.game;
    const L = FAMILY.grandpa.look;
    // Just off the course, on whichever side has more room.
    const xs = g.hole.outline.map((p) => p.x);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const x = left > FIELD_W - right ? left - 22 : right + 22;
    const y = FIELD_H - 30;
    drawPerson(ctx, L, {
      x,
      y,
      faceX: x < FIELD_W / 2 ? 1 : -1,
      speed01: 0,
      walkPhase: 0,
      clock: g.clock,
      action: this.cheerT > 0 ? 'cheer' : 'none',
      hold: this.cheerT > 0 ? null : 'putter',
      tool: 0,
    });
  }
}

function drawBumper(ctx: Ctx, k: Bumper): void {
  ctx.save();
  ctx.translate(k.x, k.y);
  ctx.beginPath();
  ctx.ellipse(3, 4, k.r, k.r * 0.85, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(30,40,20,0.3)';
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.8;
  if (k.kind === 'bale') {
    // A round hay bale seen from above: rolled-up spiral.
    ctx.beginPath();
    ctx.arc(0, 0, k.r, 0, Math.PI * 2);
    ctx.fillStyle = '#e7c35a';
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#b8902e';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.2) {
      const r = (a / (Math.PI * 6)) * k.r * 0.85;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (k.kind === 'bucket') {
    ctx.beginPath();
    ctx.arc(0, 0, k.r, 0, Math.PI * 2);
    ctx.fillStyle = '#b9c1c8';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, k.r * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = '#8e979f';
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(0, 0, k.r, k.r * 0.85, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#a7a39b';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-k.r * 0.3, -k.r * 0.3, k.r * 0.35, k.r * 0.2, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMover(ctx: Ctx, m: Mover, x: number, y: number, vx: number, clock: number): void {
  const faceX = vx >= 0 ? 1 : -1;
  const walking = Math.abs(vx) > 8;
  if (m.kind === 'donkey') {
    ctx.save();
    ctx.translate(x, y + 14);
    ctx.scale(0.62, 0.62);
    drawDonkey(ctx, DONKEYS[1], { x: 0, y: 0, faceX, walking, phase: clock * 7, clock, graze: !walking, bray: false });
    ctx.restore();
  } else if (m.kind === 'pup') {
    drawDog(ctx, CHIHUAHUAS[0], { x, y: y + 6, faceX, pose: walking ? 'walk' : 'stand', phase: clock * 16, clock, wag: 0.8 });
  } else {
    drawChicken(ctx, x, y + 5, faceX, !walking, false);
  }
}
