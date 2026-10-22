import { FAMILY, type HatKind } from '../../content/cast';
import { clamp, hash2, lerp } from '../../core/math';
import { star } from '../../render/characters';
import { C } from '../../render/palette';
import { drawPerson } from '../../render/people';
import { landingFit, RACK_W, ROW_H, type Fit, type LogSpec, type WoodEvent, type WoodGame } from './woodpile';

type Ctx = CanvasRenderingContext2D;

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
  max: number;
  size: number;
  color: string;
  text?: string;
}

interface Layout {
  W: number;
  H: number;
  s: number;
  rackX: number;
  rackY: number;
  blockX: number;
  blockY: number;
  meterX: number;
  meterY: number;
  meterW: number;
  far: number;
}

const BLOCK_H = 30;

/** Side-view woodpile scene by the woodshed. Purely visual; the game state lives in WoodGame. */
export class WoodView {
  private ctx: Ctx;
  private vw = 1;
  private vh = 1;
  private dpr = 1;
  private bits: Bit[] = [];
  private shake = 0;
  private L!: Layout;
  hat: HatKind | undefined;
  /** CSS px covered by the HUD at the top. */
  insetTop = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly game: WoodGame,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  resize(w: number, h: number, dpr: number): void {
    this.vw = w;
    this.vh = h;
    this.dpr = Math.min(2, dpr);
    if (this.canvas.width !== Math.round(w * this.dpr)) this.canvas.width = Math.round(w * this.dpr);
    if (this.canvas.height !== Math.round(h * this.dpr)) this.canvas.height = Math.round(h * this.dpr);
    this.layout();
  }

  private layout(): void {
    const landscape = this.vw > this.vh * 1.1;
    if (landscape) {
      const s = Math.min(this.vw / 820, this.vh / 430);
      const W = this.vw / s;
      const H = this.vh / s;
      const blockX = W * 0.27;
      this.L = { W, H, s, rackX: W * 0.53, rackY: H * 0.84, blockX, blockY: H * 0.88, meterX: blockX - 130, meterY: H * 0.44, meterW: 260, far: H * 0.6 };
    } else {
      const s = Math.min(this.vw / 400, this.vh / 760);
      const W = this.vw / s;
      const H = this.vh / s;
      const top = this.insetTop / s;
      const rackY = Math.max(top + 170, H * 0.52);
      this.L = { W, H, s, rackX: (W - RACK_W) / 2, rackY, blockX: W * 0.6, blockY: H * 0.9, meterX: (W - 280) / 2, meterY: rackY + (H * 0.9 - rackY) * 0.3, meterW: 280, far: rackY - 30 };
    }
  }

  handleEvent(e: WoodEvent): void {
    const L = this.L;
    const bx = L.blockX;
    const by = L.blockY - BLOCK_H - 30;
    switch (e.type) {
      case 'chop':
        if (e.grade === 'miss') {
          this.text(bx, by - 70, 'Stuck!', '#ffffff');
          this.shake = 0.12;
        } else {
          this.shake = e.grade === 'perfect' ? 0.28 : 0.18;
          this.text(bx, by - 80, e.grade === 'perfect' ? 'Perfect!' : 'Good', e.grade === 'perfect' ? '#fff3b0' : '#ffffff');
          for (let i = 0; i < (e.grade === 'perfect' ? 18 : 10); i++) this.chip(bx, by - 30, '#e8c690');
          if (e.grade === 'perfect') for (let i = 0; i < 8; i++) this.spark(bx, by - 40);
        }
        break;
      case 'rotten':
        this.shake = 0.1;
        this.text(bx, by - 80, 'Rotten! Toss those.', '#ffd0dc');
        for (let i = 0; i < 16; i++) this.chip(bx, by - 30, '#8f8a6a');
        break;
      case 'toss':
        this.text(bx, by - 80, e.good ? 'Good eye!' : 'That one was fine!', e.good ? '#fff3b0' : '#ffd0dc');
        break;
      case 'stack': {
        const x = L.rackX + e.x;
        const y = L.rackY - e.row * ROW_H - ROW_H;
        this.text(x, y - 20, e.grade === 'snug' ? 'Snug!' : e.grade === 'ok' ? 'Fine' : 'Gappy', e.grade === 'snug' ? '#fff3b0' : '#ffffff');
        for (let i = 0; i < 5; i++) this.chip(x, y + ROW_H - 4, '#d9c39a');
        if (e.grade === 'snug') this.spark(x, y);
        break;
      }
      case 'tumble':
        this.text(L.rackX + this.game.rowRight, L.rackY - this.game.rowIndex * ROW_H - 50, 'Tumble!', '#ffffff');
        break;
      case 'collapse':
        this.shake = 0.35;
        this.text(L.rackX + RACK_W / 2, L.rackY - e.row * ROW_H - 60, 'Timber!', '#ffd0dc');
        break;
      case 'row':
        this.text(L.rackX + RACK_W / 2, L.rackY - e.row * ROW_H - 50, 'Row done!', '#fff3b0');
        break;
      default:
        break;
    }
  }

  private text(x: number, y: number, text: string, color: string): void {
    this.bits.push({ x, y, vx: 0, vy: -30, rot: 0, vr: 0, life: 1.3, max: 1.3, size: 15, color, text });
  }

  private chip(x: number, y: number, color: string): void {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
    const sp = 120 + Math.random() * 160;
    this.bits.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16, life: 0.9, max: 0.9, size: 2 + Math.random() * 3, color });
  }

  private spark(x: number, y: number): void {
    const a = Math.random() * Math.PI * 2;
    this.bits.push({ x, y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, rot: 0, vr: 0, life: 0.7, max: 0.7, size: 4, color: C.gold, text: '*' });
  }

  update(dt: number): void {
    this.shake = Math.max(0, this.shake - dt);
    for (const b of this.bits) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (!b.text) b.vy += 520 * dt;
      b.rot += b.vr * dt;
    }
    this.bits = this.bits.filter((b) => b.life > 0);
  }

  render(): void {
    const ctx = this.ctx;
    const g = this.game;
    const L = this.L;
    const k = this.dpr * L.s;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    let sx = 0;
    let sy = 0;
    if (this.shake > 0) {
      sx = Math.sin(g.clock * 90) * this.shake * 10;
      sy = Math.cos(g.clock * 77) * this.shake * 7;
    }
    ctx.setTransform(k, 0, 0, k, sx * k, sy * k);
    this.drawBackdrop(ctx);
    this.drawRack(ctx);
    this.drawBlock(ctx);
    this.drawMeter(ctx);
    this.drawSteps(ctx);
    this.drawBits(ctx);
    // Vignette.
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const vg = ctx.createRadialGradient(this.vw / 2, this.vh * 0.5, Math.min(this.vw, this.vh) * 0.45, this.vw / 2, this.vh / 2, Math.max(this.vw, this.vh) * 0.8);
    vg.addColorStop(0, 'rgba(60,40,10,0)');
    vg.addColorStop(1, 'rgba(60,40,10,0.3)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.vw, this.vh);
  }

  private drawBackdrop(ctx: Ctx): void {
    const L = this.L;
    const g = this.game;
    // The sky warms toward sunset as daylight runs out.
    const dusk = clamp(g.elapsed / g.round.timeLimit, 0, 1);
    const sky = ctx.createLinearGradient(0, 0, 0, L.far);
    sky.addColorStop(0, mix('#8fcbe8', '#5a6aa8', dusk));
    sky.addColorStop(1, mix('#fbe7b8', '#f2a36a', dusk));
    ctx.fillStyle = sky;
    ctx.fillRect(-20, -20, L.W + 40, L.H + 40);
    // Sun sinking.
    const sunY = lerp(L.far * 0.25, L.far - 10, dusk);
    ctx.beginPath();
    ctx.arc(L.W * 0.82, sunY, 26, 0, Math.PI * 2);
    ctx.fillStyle = mix('#fff2b0', '#ffb36a', dusk);
    ctx.fill();
    // Far hills and tree line.
    ctx.fillStyle = mix('#9cc76a', '#6d8a5c', dusk);
    ctx.beginPath();
    ctx.moveTo(-20, L.far);
    for (let x = -20; x <= L.W + 20; x += 20) ctx.lineTo(x, L.far - 18 - Math.sin(x * 0.012) * 14 - Math.sin(x * 0.031) * 6);
    ctx.lineTo(L.W + 20, L.far + 40);
    ctx.lineTo(-20, L.far + 40);
    ctx.fill();
    for (let i = 0; i < 14; i++) {
      const x = (i / 13) * (L.W + 60) - 30 + hash2(i, 1, 4) * 30;
      const r = 16 + hash2(i, 2, 4) * 14;
      ctx.beginPath();
      ctx.arc(x, L.far - 6 - r * 0.6, r, 0, Math.PI * 2);
      ctx.fillStyle = mix(i % 2 ? '#4f8a3a' : '#5f9a42', '#3d5a3a', dusk);
      ctx.fill();
    }
    // Barn 89 far away, for anyone who looks.
    const bx = L.W * 0.12;
    const by = L.far - 4;
    ctx.fillStyle = mix('#b8382c', '#7a2a2a', dusk);
    ctx.fillRect(bx - 18, by - 22, 36, 22);
    ctx.fillStyle = mix('#8d9cab', '#5f6a7a', dusk);
    ctx.beginPath();
    ctx.moveTo(bx - 22, by - 21);
    ctx.lineTo(bx - 14, by - 32);
    ctx.lineTo(bx + 14, by - 32);
    ctx.lineTo(bx + 22, by - 21);
    ctx.closePath();
    ctx.fill();
    // Ground.
    const ground = ctx.createLinearGradient(0, L.far, 0, L.H);
    ground.addColorStop(0, mix('#8cc456', '#6b8f4a', dusk));
    ground.addColorStop(1, mix('#79b047', '#55773d', dusk));
    ctx.fillStyle = ground;
    ctx.fillRect(-20, L.far, L.W + 40, L.H - L.far + 30);
    // The white woodshed behind the rack.
    const shx = L.rackX - 30;
    const shw = RACK_W + 60;
    const shTop = L.rackY - this.shownRows() * ROW_H - 64;
    ctx.fillStyle = mix('#f6f3ea', '#c9c3c8', dusk);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(shx, shTop, shw, L.rackY - shTop);
    ctx.strokeRect(shx, shTop, shw, L.rackY - shTop);
    ctx.strokeStyle = 'rgba(80,60,40,0.15)';
    ctx.lineWidth = 1;
    for (let y = shTop + 10; y < L.rackY; y += 10) {
      ctx.beginPath();
      ctx.moveTo(shx, y);
      ctx.lineTo(shx + shw, y);
      ctx.stroke();
    }
    ctx.fillStyle = mix('#e9ecef', '#a9adb8', dusk);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(shx - 16, shTop + 4);
    ctx.lineTo(shx + shw + 16, shTop + 4);
    ctx.lineTo(shx + shw + 4, shTop - 22);
    ctx.lineTo(shx - 4, shTop - 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Ground shadow strip under the rack.
    ctx.fillStyle = 'rgba(40,30,15,0.18)';
    ctx.fillRect(shx - 10, L.rackY, shw + 20, 8);
    // Wood chips on the ground by the block.
    for (let i = 0; i < 26; i++) {
      const x = L.blockX + (hash2(i, 5, 1) - 0.5) * 160;
      const y = L.blockY - 4 + hash2(i, 6, 1) * 16;
      ctx.fillStyle = i % 3 ? '#e8c690' : '#d4a86a';
      ctx.fillRect(x, y, 5, 2.2);
    }
  }

  /** Rack height grows as rows fill, so the shed never looks empty. */
  private shownRows(): number {
    const perRow = Math.floor(RACK_W / 37);
    return Math.max(Math.ceil(this.game.round.goal / perRow) + 1, this.game.rows.length + 1);
  }

  private drawPieceEnd(ctx: Ctx, x: number, y: number, w: number, shade: number, alpha = 1): void {
    // A split wedge, end-grain out, bark along one side. (x, y) = bottom-left.
    const h = ROW_H - 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(x + 1, y);
    ctx.lineTo(x + w * (0.3 + shade * 0.2), y - h);
    ctx.lineTo(x + w - 1, y - h + 3);
    ctx.lineTo(x + w - 2, y);
    ctx.closePath();
    ctx.fillStyle = shade > 0.5 ? '#e2b77a' : '#d9a865';
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // Bark edge.
    ctx.strokeStyle = '#6e4a2d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + w * (0.3 + shade * 0.2) + 1, y - h + 1);
    ctx.lineTo(x + w - 2, y - h + 4);
    ctx.stroke();
    // Growth rings.
    ctx.strokeStyle = 'rgba(140,90,40,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x + w * 0.62, y - h * 0.15, w * 0.28, Math.PI * 1.05, Math.PI * 1.75);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + w * 0.62, y - h * 0.15, w * 0.5, Math.PI * 1.1, Math.PI * 1.7);
    ctx.stroke();
    ctx.restore();
  }

  private drawRack(ctx: Ctx): void {
    const L = this.L;
    const g = this.game;
    const x0 = L.rackX;
    const y0 = L.rackY;
    const rows = this.shownRows();
    const topY = y0 - rows * ROW_H - 6;
    // Posts and base rail.
    ctx.fillStyle = C.woodDark;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.8;
    ctx.fillRect(x0 - 10, topY, 8, y0 - topY + 6);
    ctx.strokeRect(x0 - 10, topY, 8, y0 - topY + 6);
    ctx.fillRect(x0 + RACK_W + 2, topY, 8, y0 - topY + 6);
    ctx.strokeRect(x0 + RACK_W + 2, topY, 8, y0 - topY + 6);
    ctx.fillStyle = C.wood;
    ctx.fillRect(x0 - 12, y0, RACK_W + 24, 7);
    ctx.strokeRect(x0 - 12, y0, RACK_W + 24, 7);
    // Stacked rows; the working row sways with the wobble.
    const wob = g.wobble;
    g.rows.forEach((row, ri) => {
      const working = ri === g.rows.length - 1;
      const lean = working ? Math.sin(g.clock * 7) * wob * 3 + wob * 4 : 0;
      for (const p of row) this.drawPieceEnd(ctx, x0 + p.x + lean * (1 - 0), y0 - ri * ROW_H, p.w, p.shade);
    });
    // The target: a glowing outline of the piece, snug against the last one.
    const slot = g.rowRight;
    const rowY = y0 - g.rowIndex * ROW_H;
    const s = g.slider;
    const w = s?.w ?? g.drop?.w ?? 34;
    if (s || g.drop) {
      const fit = s ? landingFit(s.x, slot) : 'snug';
      const glow = fit === 'snug' ? 1 : 0.45 + Math.sin(g.clock * 6) * 0.15;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x0 + slot + 1, rowY - ROW_H + 1, w - 2, ROW_H - 2, 4);
      ctx.fillStyle = `rgba(242,197,61,${0.25 + glow * 0.35})`;
      ctx.fill();
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -g.clock * 12;
      ctx.strokeStyle = fit === 'snug' ? C.ink : 'rgba(59,42,32,0.75)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      if (s) {
        // A line straight down from the piece shows where it'll land: green is snug.
        const col = FIT_COLOR[fit];
        const cx = x0 + s.x + s.w / 2;
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, rowY - 34 + 2);
        ctx.lineTo(cx, rowY - 4);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = col;
        ctx.fillRect(x0 + s.x + 3, rowY - 4, s.w - 6, 4);
        ctx.font = '900 12px ui-rounded, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = C.ink;
        ctx.fillText(fit === 'snug' ? 'NOW!' : 'drop here', Math.max(x0 + 34, x0 + slot + w / 2), rowY - ROW_H - 42 - (fit === 'snug' ? Math.sin(g.clock * 14) : 0));
        this.drawPieceEnd(ctx, x0 + s.x, rowY - 34, s.w, s.shade);
      }
    }
    if (g.drop) {
      const d = g.drop;
      this.drawPieceEnd(ctx, x0 + d.x, rowY + d.y, d.w, d.shade);
    }
    for (const f of g.fallers) {
      ctx.save();
      ctx.translate(x0 + f.x + f.w / 2, y0 + f.y);
      ctx.rotate(f.rot);
      this.drawPieceEnd(ctx, -f.w / 2, ROW_H / 2, f.w, f.shade, Math.min(1, f.life * 2));
      ctx.restore();
    }
  }

  /** "1 Split, 2 Stack": which half of the job you're on, and how many pieces are waiting. */
  private drawSteps(ctx: Ctx): void {
    const g = this.game;
    if (g.phase === 'celebrating' || g.phase === 'complete') return;
    const L = this.L;
    const stacking = g.phase === 'split' || g.phase === 'slide' || g.phase === 'drop';
    const waiting = g.queue.length + (g.slider || g.drop ? 1 : 0);
    const steps = [
      { n: '1', label: 'SPLIT', on: !stacking },
      { n: '2', label: stacking && waiting ? `STACK  ${waiting} left` : 'STACK', on: stacking },
    ];
    const w = 124;
    const h = 30;
    const cx = L.meterX + L.meterW / 2;
    const y = L.meterY - 58;
    ctx.save();
    ctx.font = '900 13px ui-rounded, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    steps.forEach((st, i) => {
      const x = cx - w - 4 + i * (w + 8);
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 15);
      ctx.fillStyle = st.on ? C.gold : 'rgba(255,248,233,0.7)';
      ctx.fill();
      ctx.strokeStyle = st.on ? C.ink : 'rgba(59,42,32,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 16, y + h / 2, 9, 0, Math.PI * 2);
      ctx.fillStyle = st.on ? C.ink : 'rgba(59,42,32,0.35)';
      ctx.fill();
      ctx.fillStyle = st.on ? C.gold : '#fff8e9';
      ctx.textAlign = 'center';
      ctx.fillText(st.n, x + 16, y + h / 2 + 1);
      ctx.fillStyle = st.on ? C.ink : 'rgba(59,42,32,0.45)';
      ctx.textAlign = 'left';
      ctx.fillText(st.label, x + 31, y + h / 2 + 1);
    });
    ctx.restore();
  }

  private drawLog(ctx: Ctx, cx: number, base: number, log: LogSpec, split: number, halved: boolean): void {
    const w = log.kind === 'big' ? 64 : log.kind === 'small' ? 38 : 50;
    const h = log.kind === 'big' ? 52 : 46;
    const bark = log.punky ? '#7d7a62' : '#7a5232';
    const face = log.punky ? '#b8b08a' : '#e8c48a';
    const halves = halved || split > 0 ? 2 : 1;
    for (let i = 0; i < halves; i++) {
      const side = halves === 1 ? 0 : i === 0 ? -1 : 1;
      const hw = halves === 1 ? w : w / 2;
      const off = side * (split * 60 + (halved ? 2 : 0));
      const rot = side * split * 1.2;
      ctx.save();
      ctx.translate(cx + off + (side * hw) / 2, base - split * 30);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.roundRect(-hw / 2, -h, hw, h, 4);
      ctx.fillStyle = bark;
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      // Bark texture.
      ctx.strokeStyle = 'rgba(30,20,10,0.35)';
      ctx.lineWidth = 1.2;
      for (let j = 0; j < 4; j++) {
        const xx = -hw / 2 + 5 + j * (hw / 4);
        ctx.beginPath();
        ctx.moveTo(xx, -h + 6);
        ctx.lineTo(xx + 2, -6);
        ctx.stroke();
      }
      if (log.knots) {
        for (let j = 0; j < log.knots; j++) {
          ctx.beginPath();
          ctx.ellipse(-hw / 4 + j * hw * 0.4, -h * (0.35 + j * 0.25), 4, 6, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#3e2a1a';
          ctx.fill();
        }
      }
      if (log.punky) {
        for (let j = 0; j < 3; j++) {
          ctx.beginPath();
          ctx.ellipse(-hw / 3 + j * 8, -h * 0.55 + j * 6, 5, 2.6, 0, 0, Math.PI);
          ctx.fillStyle = '#efe2c8';
          ctx.fill();
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(110,150,80,0.6)';
        ctx.fillRect(-hw / 2 + 2, -h + 2, hw - 4, 7);
      }
      // End grain on top.
      ctx.beginPath();
      ctx.ellipse(0, -h, hw / 2, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = face;
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(140,90,40,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, -h, hw / 4, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawBlock(ctx: Ctx): void {
    const L = this.L;
    const g = this.game;
    const cx = L.blockX;
    const by = L.blockY;
    // Burn pile on the far side for rotten logs.
    const px = cx + 95;
    ctx.fillStyle = '#8f8a6a';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(px + (i % 3) * 12 - 12, by - 6 - Math.floor(i / 3) * 8, 10, 5, (i - 2) * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.font = '800 10px ui-rounded, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(59,42,32,0.6)';
    ctx.fillText('burn pile', px, by + 12);
    // Stump.
    ctx.beginPath();
    ctx.ellipse(cx + 4, by + 4, 46, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.shadow;
    ctx.fill();
    ctx.fillStyle = C.wood;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.fillRect(cx - 38, by - BLOCK_H, 76, BLOCK_H);
    ctx.strokeRect(cx - 38, by - BLOCK_H, 76, BLOCK_H);
    ctx.beginPath();
    ctx.ellipse(cx, by - BLOCK_H, 38, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#d6a868';
    ctx.fill();
    ctx.stroke();

    // The log on the block.
    const top = by - BLOCK_H;
    const ph = g.phase;
    let split = 0;
    let drop = 0;
    if (ph === 'arrive') drop = (1 - clamp(g.phaseT / 0.35, 0, 1)) * 140;
    if (ph === 'split') split = clamp(g.phaseT / 0.4, 0, 1);
    const halved = g.log.kind === 'big' && g.chopsLeft === 1;
    const showLog = ph !== 'slide' && ph !== 'drop' && ph !== 'celebrating' && ph !== 'complete' && !(ph === 'split' && g.log.punky);
    if (ph === 'toss') {
      const t = clamp(g.phaseT / 0.5, 0, 1);
      ctx.save();
      ctx.translate(lerp(0, 95, t), -Math.sin(t * Math.PI) * 60 + t * 20);
      this.drawLog(ctx, cx, top, g.log, 0, false);
      ctx.restore();
    } else if (showLog) this.drawLog(ctx, cx, top - drop, g.log, split, halved);
    if (ph === 'split' && g.log.punky) {
      ctx.fillStyle = '#8f8a6a';
      for (let i = 0; i < 6; i++) ctx.fillRect(cx - 30 + i * 11, top - 6 + (i % 2) * 3, 8, 5);
    }

    // Split pieces waiting their turn.
    g.queue.forEach((w, i) => {
      this.drawPieceEnd(ctx, cx - 150 + i * 20, by - 2, w * 0.7, 0.4 + i * 0.1);
    });

    // Jason with the axe.
    let a = -2.2 + Math.sin(g.clock * 2.4) * 0.05;
    if (ph === 'swing') a = lerp(-2.4, 0.05, clamp(g.phaseT / 0.1, 0, 1));
    else if (ph === 'stuck') a = 0.05 + Math.sin(g.phaseT * 40) * 0.05 * (1 - g.phaseT);
    else if (ph === 'split' || ph === 'slide' || ph === 'drop' || ph === 'toss' || ph === 'ready') a = 0.9;
    else if (ph === 'celebrating' || ph === 'complete') a = -1.6;
    const jx = cx - 98;
    ctx.save();
    ctx.translate(jx, by);
    ctx.scale(2.05, 2.05);
    drawPerson(ctx, FAMILY.jason.look, { x: 0, y: 0, faceX: 1, speed01: 0, walkPhase: 0, clock: g.clock, hold: 'axe', axe: a, hat: this.hat });
    ctx.restore();
  }

  private drawMeter(ctx: Ctx): void {
    const L = this.L;
    const g = this.game;
    if (g.phase !== 'aim' && g.phase !== 'swing' && g.phase !== 'stuck' && g.phase !== 'arrive' && g.phase !== 'ready') return;
    const x = L.meterX;
    const y = L.meterY;
    const w = L.meterW;
    const h = 22;
    ctx.save();
    ctx.globalAlpha = g.phase === 'arrive' ? 0.6 : 1;
    ctx.beginPath();
    ctx.roundRect(x - 6, y - 6, w + 12, h + 12, 16);
    ctx.fillStyle = 'rgba(255,248,233,0.92)';
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 11);
    ctx.fillStyle = '#e6d3b0';
    ctx.fill();
    const sw = g.sweetW * w;
    const sc = x + g.sweet * w;
    // The zones light up while the marker is in them: that's when to tap.
    const d = Math.abs(g.meter - g.sweet);
    const inGold = d < g.sweetW / 6;
    const inGreen = d < g.sweetW / 2;
    ctx.fillStyle = inGreen && !inGold ? '#9be06e' : '#7cc05a';
    ctx.fillRect(sc - sw / 2, y, sw, h);
    ctx.fillStyle = inGold ? '#ffe680' : C.gold;
    ctx.fillRect(sc - sw / 6, y, sw / 3, h);
    if (inGold && (g.phase === 'aim' || g.phase === 'ready')) {
      ctx.save();
      ctx.shadowColor = 'rgba(255,214,80,0.9)';
      ctx.shadowBlur = 16;
      ctx.strokeStyle = '#fff3b0';
      ctx.lineWidth = 3;
      ctx.strokeRect(sc - sw / 6, y - 2, sw / 3, h + 4);
      ctx.restore();
    }
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 11);
    ctx.stroke();
    // Marker.
    const mx = x + g.meter * w;
    ctx.beginPath();
    ctx.moveTo(mx, y + h + 2);
    ctx.lineTo(mx - 9, y - 12);
    ctx.lineTo(mx + 9, y - 12);
    ctx.closePath();
    ctx.fillStyle = C.barnRed;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.fillRect(mx - 1.5, y, 3, h);
    if (g.log.knots) {
      ctx.font = '800 11px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = C.ink;
      ctx.fillText(g.log.knots > 1 ? 'Very knotty: small sweet spot' : 'Knotty: small sweet spot', x, y + h + 20);
    }
    if (g.log.kind === 'big') {
      ctx.font = '800 11px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = C.ink;
      ctx.fillText(g.chopsLeft === 2 ? 'Big round: 2 chops' : '1 more chop', x + w, y + h + 20);
    }
    ctx.restore();
  }

  private drawBits(ctx: Ctx): void {
    for (const b of this.bits) {
      const f = b.life / b.max;
      ctx.save();
      ctx.globalAlpha = Math.min(1, f * 2);
      if (b.text === '*') {
        star(ctx, b.x, b.y, b.size * (0.6 + f * 0.6), b.color);
      } else if (b.text) {
        ctx.font = `900 ${b.size}px Rockwell, "Roboto Slab", Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = C.ink;
        ctx.strokeText(b.text, b.x, b.y);
        ctx.fillStyle = b.color;
        ctx.fillText(b.text, b.x, b.y);
      } else {
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.fillStyle = b.color;
        ctx.fillRect(-b.size, -b.size * 0.4, b.size * 2, b.size * 0.8);
      }
      ctx.restore();
    }
  }
}

const FIT_COLOR: Record<Fit, string> = { snug: '#3f9a3f', ok: '#c48e1c', gappy: '#d06a14', tumble: '#c8443a' };

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r},${g},${bl})`;
}
