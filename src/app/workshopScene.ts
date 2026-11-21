import { GRANDPA_LINES, PAINTS, type PieceDef, type Restored } from '../content/blueStar';
import { Workshop, type WorkshopEvent } from '../games/workshop/workshop';
import { WorkshopView } from '../games/workshop/workshopView';
import type { GameScene, SceneContext, SceneResult } from './scene';

const STAR_ICON = `<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="#2f63c0" stroke="#3b2a20" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

const STEP: Record<string, { n: number; label: string }> = {
  sand: { n: 1, label: 'sand it back' },
  paint: { n: 2, label: 'paint it' },
  star: { n: 3, label: 'add the star' },
  done: { n: 3, label: 'all done' },
};

/**
 * The Blue Star workshop with Grandpa: restore one piece of furniture. No clock, no score and
 * no stars; the app saves the piece and sets it out front of the shop when you're done.
 */
export class WorkshopScene implements GameScene {
  readonly challenge = 'workshop';
  readonly game: Workshop;
  readonly view: WorkshopView;
  /** Last touch point on the piece, in piece units, while dragging. */
  private last: { x: number; y: number } | null = null;
  private sent = false;
  /** Grandpa's tip for a step goes once you've made a start on it. */
  private started = { sand: false, paint: false };
  private soundT = 0;

  constructor(
    private readonly ctx: SceneContext,
    readonly piece: PieceDef,
    /** Every other piece in the shop is already done. */
    private readonly lastOne: boolean,
  ) {
    this.game = new Workshop(piece);
    this.view = new WorkshopView(ctx.canvas, this.game);
  }

  enter(look: Parameters<GameScene['enter']>[0]): void {
    const c = this.ctx;
    c.hud.configure({ icon: STAR_ICON, required: '/3', label: 'sand it back', barTarget: 1 });
    c.controls.enabled = false;
    c.controls.tapMode = false;
    c.controls.keyMap = {};
    c.controls.onPointer = (kind, x, y) => this.pointer(kind, x, y);
    this.view.insetTop = look.insetTop;
    this.restart();
  }

  exit(): void {
    this.ctx.hint.set(null);
    this.ctx.controls.pointerMode = false;
    this.ctx.controls.onPointer = () => {};
  }

  restart(): void {
    this.game.reset();
    this.view.setGame(this.game);
    this.last = null;
    this.sent = false;
    this.started = { sand: false, paint: false };
    this.ctx.toast.show(`<b>Grandpa</b>${this.piece.intro}`, 4);
  }

  resize(w: number, h: number, dpr: number, insetTop: number): void {
    this.view.insetTop = insetTop;
    this.view.resize(w, h, dpr);
  }

  /** Drag to sand or paint, tap a can to change colour, tap to place the star. */
  pointer(kind: 'down' | 'move' | 'up', x: number, y: number): void {
    const g = this.game;
    const v = this.view;
    if (kind === 'up') {
      this.last = null;
      const r = v.doneBox();
      const onButton = x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
      if (g.phase === 'paint' && g.covered && onButton) {
        g.toStar();
        this.ctx.sfx.click();
      } else if (g.phase === 'star') {
        const p = v.toPiece(x, y);
        g.placeStar(p.x, p.y);
      } else if (g.phase === 'done' && !this.sent && onButton) {
        this.sent = true;
        this.ctx.sfx.click();
      }
      v.pointer = null;
      return;
    }
    if (kind === 'down' && g.phase === 'paint') {
      const i = v.swatchAt(x, y);
      if (i >= 0) {
        g.pickColor(i);
        return;
      }
      // The button isn't a place to paint.
      const r = v.doneBox();
      if (g.covered && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return;
    }
    v.pointer = { x, y };
    if (g.phase !== 'sand' && g.phase !== 'paint') return;
    const p = v.toPiece(x, y);
    const from = kind === 'down' || !this.last ? p : this.last;
    this.last = p;
    // Draw first, while the phase still matches the stroke.
    v.stroke(from.x, from.y, p.x, p.y);
    const phase = g.phase;
    if (phase === 'sand' || phase === 'paint') this.started[phase] = true;
    if (g.stroke(from.x, from.y, p.x, p.y) > 0 && this.soundT <= 0) {
      if (phase === 'sand') this.ctx.sfx.sand();
      else this.ctx.sfx.brush();
      this.soundT = 0.09;
    }
  }

  step(dt: number): void {
    this.soundT -= dt;
    for (const e of this.game.drainEvents()) this.handle(e);
  }

  private handle(e: WorkshopEvent): void {
    const { sfx, hud, toast } = this.ctx;
    this.view.handleEvent(e);
    switch (e.type) {
      case 'sanded':
        sfx.discover();
        hud.bump();
        this.last = null;
        toast.show('<b>Back to bare wood.</b>Nice and smooth.', 2.4);
        break;
      case 'painted':
        sfx.collect();
        hud.bump();
        toast.show('<b>All covered.</b>Touch it up or mix in another color, then on to the star.', 3.4);
        break;
      case 'color':
        sfx.tick();
        break;
      case 'starred':
        sfx.victory();
        hud.bump();
        toast.show(`<b>Grandpa</b>${this.lastOne ? GRANDPA_LINES.allDone : GRANDPA_LINES.done}`, 6);
        break;
    }
  }

  frame(dt: number, _alpha: number, paused: boolean): void {
    const g = this.game;
    const { hud, hint } = this.ctx;
    if (!paused) {
      const st = STEP[g.phase];
      hud.setCount(String(st.n));
      hud.setLabel(st.label);
      hud.setBar(g.progress);
      hud.setTime(`${Math.round(g.progress * 100)}%`);
      hud.setScore(g.phase === 'paint' ? PAINTS[g.color].name : g.phase === 'sand' ? 'sanded' : 'painted');
      let h: string | null = null;
      if (g.phase === 'sand' && !this.started.sand) h = `<b>Grandpa</b> ${GRANDPA_LINES.sand}`;
      else if (g.phase === 'paint' && !this.started.paint) h = `<b>Grandpa</b> ${GRANDPA_LINES.paint}`;
      else if (g.phase === 'star') h = `<b>Grandpa</b> ${GRANDPA_LINES.star}`;
      hint.set(h);
    }
    this.view.update(paused ? 0 : dt);
    this.view.render();
  }

  /** Done once the piece has its star and you've sent it out front. */
  isComplete(): boolean {
    return this.sent;
  }

  restored(): Restored {
    return this.game.result();
  }

  result(): SceneResult {
    return { stars: 0, score: 0, title: this.piece.name, sub: '', lines: [], finished: true };
  }

  pauseText(): string {
    return `${this.piece.name} · ${STEP[this.game.phase].label}`;
  }
}
