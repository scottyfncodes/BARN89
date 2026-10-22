import type { MowLevel } from '../games/mower/levels';
import { MowGame, type MowEvent } from '../games/mower/mower';
import { MowView } from '../games/mower/mowView';
import type { SharedWorld } from '../world/shared';
import { formatTime, ICONS } from './dom';
import type { GameScene, SceneContext, SceneResult } from './scene';

/** Yard Boss: Jay's riding-mower challenge on the real lawns. */
export class MowerScene implements GameScene {
  readonly challenge: string;
  readonly game: MowGame;
  readonly view: MowView;
  private hintT = 0;

  constructor(
    private readonly ctx: SceneContext,
    readonly level: MowLevel,
    shared: SharedWorld,
  ) {
    this.challenge = level.id;
    this.game = new MowGame(level, shared);
    this.view = new MowView(ctx.canvas, this.game, ctx.caches);
  }

  enter(look: Parameters<GameScene['enter']>[0]): void {
    const c = this.ctx;
    c.hud.configure({ icon: ICONS.grass, required: `/${Math.round(this.level.target * 100)}%`, label: 'mowed', barTarget: this.level.target });
    c.controls.enabled = true;
    c.controls.tapMode = false;
    c.controls.keyMap = {};
    this.view.paint = look.cosmetics.mower;
    this.view.decor = look.decor;
    this.restart();
  }

  exit(): void {
    this.ctx.sfx.setEngine(-1);
    this.ctx.hint.set(null);
  }

  restart(): void {
    this.game.reset();
    this.view.repaintAll();
    this.view.snap();
    this.hintT = 0;
    this.ctx.controls.moved = false;
  }

  resize(w: number, h: number, dpr: number, insetTop: number): void {
    this.view.resize(w, h, dpr);
    this.view.insets = { top: insetTop, bottom: 0 };
    this.view.guideRect = { left: 0, top: insetTop, right: w, bottom: h };
  }

  step(dt: number): void {
    this.game.step(this.ctx.controls.stick(), dt);
    for (const e of this.game.drainEvents()) this.handle(e);
  }

  private handle(e: MowEvent): void {
    const { sfx, toast, hud } = this.ctx;
    this.view.handleEvent(e);
    switch (e.type) {
      case 'bump':
        sfx.clunk();
        if (e.what === 'flowers') toast.show('<b>Watch the flowers!</b>Mom will notice. +6 seconds.', 2.6);
        break;
      case 'bed':
        sfx.oops();
        toast.show('<b>Not the flower bed!</b>+6 seconds. Steer around the beds.', 2.8);
        break;
      case 'toy':
        sfx.clunk();
        toast.show(`<b>Clank!</b>Mowed over a ${e.kind}. Pick up the yard first next time. +4 seconds.`, 2.8);
        break;
      case 'dog':
        sfx.bark();
        toast.show(`<b>Whoa, ${e.name}!</b>Everybody's fine. Give the dogs room. +3 seconds.`, 2.8);
        break;
      case 'milestone':
        sfx.tick();
        hud.bump();
        break;
      case 'done':
        sfx.victory();
        toast.show('<b>Lawn done!</b>Looking sharp.', 2.4);
        break;
      case 'timeout':
        sfx.denied();
        toast.show("<b>Out of daylight!</b>Jay's going to tease you about this.", 2.6);
        break;
      default:
        break;
    }
  }

  frame(dt: number, alpha: number, paused: boolean): void {
    const g = this.game;
    const { hud, hint, sfx } = this.ctx;
    if (!paused) {
      hud.setCount(String(Math.floor(g.coverage * 100)));
      hud.setBar(g.coverage / 1);
      hud.setTime(`${formatTime(g.timeLeft)} left`);
      hud.setScore(g.penalties ? `+${g.penalties}s` : '');
      this.hintT += dt;
      let h: string | null = null;
      if (g.phase === 'ready') h = '<em>Drag</em> the way you want to drive. The clock starts when you move.';
      else if (g.phase === 'playing' && this.hintT < 9 && g.coverage < 0.15) h = 'Long <em>straight passes</em> make the best stripes.';
      else if (g.phase === 'playing' && g.coverage > 0.7 && g.coverage < g.level.target) h = 'Almost! The <em>arrow</em> points to the nearest tall grass.';
      hint.set(h);
      sfx.setEngine(g.phase === 'playing' ? Math.min(1, Math.abs(g.mower.speed) / 215) : g.phase === 'ready' ? 0 : -1);
    } else {
      sfx.setEngine(-1);
    }
    this.view.update(paused ? 0 : dt);
    this.view.render(paused ? 1 : alpha);
  }

  isComplete(): boolean {
    return this.game.phase === 'complete';
  }

  result(): SceneResult {
    const r = this.game.result!;
    return {
      stars: r.stars,
      score: r.score,
      title: r.finished ? 'Yard Boss!' : 'Out of daylight',
      sub: r.finished
        ? `${this.level.name} mowed in ${formatTime(r.time)}${r.penalties ? ` (with ${r.penalties} seconds of oops)` : ''}.`
        : `${Math.round(r.coverage * 100)}% mowed. Get to ${Math.round(this.level.target * 100)}% before the clock runs out.`,
      lines: r.lines,
      finished: r.finished,
    };
  }

  pauseText(): string {
    return `${Math.floor(this.game.coverage * 100)}% mowed · ${formatTime(this.game.timeLeft)} left`;
  }
}
