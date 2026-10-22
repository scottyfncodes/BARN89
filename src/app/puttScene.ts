import { PuttGame, toParLabel, type PuttEvent, type PuttRound } from '../games/putt/putt';
import { PuttView } from '../games/putt/puttView';
import { ICONS } from './dom';
import type { GameScene, SceneContext, SceneResult } from './scene';

/** Putt-Putt: mini golf with Grandpa, starting from the putting green in his back yard. */
export class PuttScene implements GameScene {
  readonly challenge: string;
  readonly game: PuttGame;
  readonly view: PuttView;
  /** Pull-back in progress: shot direction and power. */
  private aim: { dx: number; dy: number; power: number } | null = null;

  constructor(
    private readonly ctx: SceneContext,
    readonly round: PuttRound,
  ) {
    this.challenge = round.id;
    this.game = new PuttGame(round);
    this.view = new PuttView(ctx.canvas, this.game);
  }

  enter(look: Parameters<GameScene['enter']>[0]): void {
    const c = this.ctx;
    c.hud.configure({ icon: ICONS.flag, required: `/${this.round.holes.length}`, label: 'hole' });
    c.controls.enabled = true;
    c.controls.tapMode = false;
    c.controls.keyMap = {};
    this.view.insetTop = look.insetTop;
    this.restart();
  }

  exit(): void {
    this.ctx.hint.set(null);
  }

  restart(): void {
    this.game.reset();
    this.aim = null;
    this.ctx.controls.moved = false;
  }

  resize(w: number, h: number, dpr: number, insetTop: number): void {
    this.view.insetTop = insetTop;
    this.view.resize(w, h, dpr);
  }

  step(dt: number): void {
    const g = this.game;
    const s = this.ctx.controls.stick();
    const mag = Math.hypot(s.x, s.y);
    const ready = g.phase === 'aim' || g.phase === 'intro';
    if (ready && mag > 0.08) {
      // Pull back like a slingshot: the ball goes the other way.
      this.aim = { dx: -s.x, dy: -s.y, power: Math.min(1, mag) };
    } else if (this.aim && mag === 0) {
      // Let go to putt (a tiny pull is a change of mind, not a shot).
      if (ready && this.aim.power > 0.12) g.putt(this.aim.dx, this.aim.dy, this.aim.power);
      this.aim = null;
    }
    this.view.aim = this.aim;
    g.step(dt);
    for (const e of g.drainEvents()) this.handle(e);
  }

  private handle(e: PuttEvent): void {
    const { sfx, toast, hud } = this.ctx;
    this.view.handleEvent(e);
    switch (e.type) {
      case 'putt':
        sfx.tick();
        break;
      case 'bump':
        if (e.speed > 60) sfx.clunk();
        if (e.what === 'donkey' && e.speed > 60) toast.show('<b>Chewy has the right of way.</b>Wait for him to amble past.', 2.4);
        break;
      case 'lip':
        sfx.denied();
        break;
      case 'sink':
        if (e.strokes === 1) {
          sfx.victory();
          toast.show('<b>Hole in one!</b>Grandpa will be telling people about this.', 2.6);
        } else sfx.collect();
        hud.bump();
        break;
      case 'pickup':
        sfx.oops();
        toast.show('<b>"Pick it up!"</b>Grandpa calls that one a seven. On to the next.', 2.6);
        break;
      case 'done':
        sfx.victory();
        break;
    }
  }

  frame(dt: number, _alpha: number, paused: boolean): void {
    const g = this.game;
    const { hud, hint } = this.ctx;
    if (!paused) {
      hud.setCount(String(Math.min(g.round.holes.length, g.holeIndex + 1)));
      hud.setTime(`Par ${g.hole.par} · ${toParLabel(g.toPar)}`);
      hud.setScore(g.strokes === 1 ? '1 stroke' : `${g.strokes} strokes`);
      let h: string | null = null;
      if (g.holeIndex === 0 && g.card.length === 0 && g.strokes === 0) h = '<em>Pull back</em> anywhere, then <em>let go</em> to putt. Pull further for more power.';
      else if (g.phase === 'aim' && g.strokes >= 3 && g.holeIndex === 0) h = 'Gently does it near the cup: <em>too fast</em> and it rolls right over.';
      hint.set(h);
    }
    this.view.update(paused ? 0 : dt);
    this.view.render();
  }

  isComplete(): boolean {
    return this.game.phase === 'complete';
  }

  result(): SceneResult {
    const r = this.game.result!;
    const d = r.strokes - r.par;
    return {
      stars: r.stars,
      score: r.score,
      title: d < 0 ? 'Under par!' : d === 0 ? 'Even par!' : 'Round done!',
      sub: `${this.round.name}: ${r.strokes} strokes, par ${r.par} (${toParLabel(d)}).${r.aces ? ` ${r.aces === 1 ? 'A hole in one!' : `${r.aces} holes in one!`}` : ''}`,
      lines: r.lines,
      finished: true,
    };
  }

  pauseText(): string {
    return `Hole ${this.game.holeIndex + 1} of ${this.round.holes.length} · ${toParLabel(this.game.toPar)}`;
  }
}
