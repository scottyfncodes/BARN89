import { Game } from '../games/kitten/game';
import { Hints } from '../games/kitten/hints';
import { Renderer } from '../games/kitten/kittenRenderer';
import type { LevelDef } from '../games/kitten/levels';
import { formatTime as kcTime } from '../games/kitten/scoring';
import { emptyInput, type GameEvent } from '../games/kitten/types';
import type { SharedWorld } from '../world/shared';
import { $, ICONS, show } from './dom';
import type { GameScene, SceneContext, SceneResult } from './scene';

/** Kitten Cowgirl: Natalie herds the barn cats into the corral. */
export class KittenScene implements GameScene {
  readonly challenge: string;
  readonly game: Game;
  readonly view: Renderer;
  private hints = new Hints();
  private input = emptyInput();
  private whistled = false;
  private treated = false;
  private actions = $('actions');
  private treatCount = $('treat-count');
  private treatBtn = $('treat-btn');
  private whistleCd = $('whistle-cd');
  private last = { treats: -1, cd: -1 };

  constructor(
    private readonly ctx: SceneContext,
    readonly level: LevelDef,
    shared: SharedWorld,
  ) {
    this.challenge = level.id;
    this.game = new Game(level, shared);
    this.view = new Renderer(ctx.canvas, this.game, ctx.caches);
  }

  enter(look: Parameters<GameScene['enter']>[0]): void {
    const c = this.ctx;
    c.hud.configure({ icon: ICONS.cat, required: `/${this.level.required}`, label: 'in the corral', pips: this.level.required });
    show(this.actions, true);
    c.controls.enabled = true;
    c.controls.tapMode = false;
    c.controls.keyMap = { ' ': 'whistle', q: 'whistle', e: 'treat', f: 'treat' };
    this.view.mounted = look.cosmetics.ride;
    this.view.decor = look.decor;
    this.restart();
  }

  exit(): void {
    show(this.actions, false);
    this.ctx.hint.set(null);
  }

  restart(): void {
    this.game.reset();
    this.view.snap();
    this.hints.reset();
    this.whistled = false;
    this.treated = false;
    this.ctx.controls.moved = false;
    this.last = { treats: -1, cd: -1 };
  }

  resize(w: number, h: number, dpr: number, insetTop: number): void {
    this.view.resize(w, h, dpr);
    this.view.insets = { top: insetTop, bottom: 0 };
    const act = this.actions.getBoundingClientRect();
    const landscape = w > h;
    this.view.guideRect = {
      left: 0,
      top: insetTop,
      right: landscape && act.width ? act.left : w,
      bottom: !landscape && act.height ? act.top - 6 : h,
    };
  }

  step(dt: number): void {
    this.ctx.controls.read(this.input);
    this.game.step(this.input, dt);
    for (const e of this.game.drainEvents()) this.handle(e);
  }

  private handle(e: GameEvent): void {
    const { sfx, toast, hud } = this.ctx;
    const g = this.game;
    this.view.handleEvent(e, g.kittens);
    this.hints.onEvent(e, g);
    switch (e.type) {
      case 'penned': {
        const k = g.kittens.find((kk) => kk.id === e.kittenId);
        sfx.penned();
        setTimeout(() => sfx.meow(1.1), 180);
        hud.bump();
        if (g.pennedCount < this.level.required) {
          const left = this.level.required - g.pennedCount;
          toast.show(`<b>${k?.name ?? 'A cat'} is in!</b>${left} more to go.`, 2.4);
        }
        break;
      }
      case 'whistle':
        this.whistled = true;
        sfx.whistle();
        break;
      case 'treatThrown':
        this.treated = true;
        sfx.treat();
        break;
      case 'treatEaten':
        sfx.crunch();
        break;
      case 'noTreats':
        sfx.denied();
        break;
      case 'collect':
        sfx.collect();
        if (e.kind === 'horseshoe') toast.show(`<b>Golden horseshoe!</b>${g.horseshoes} of 4 found. Lucky!`);
        else toast.show('<b>Treat bag!</b>+2 treats in your pouch.', 2.4);
        break;
      case 'discover':
        sfx.discover();
        toast.show(`<b>${e.title}</b>${e.text}`, 4.2);
        break;
      case 'startle':
        if (Math.random() < 0.5) sfx.startle();
        break;
      case 'meow':
        if (Math.hypot(e.x - g.player.x, e.y - g.player.y) < 420 && Math.random() < 0.5) sfx.meow(0.9 + Math.random() * 0.3);
        break;
      case 'victory':
        sfx.victory();
        toast.show('<b>Corral complete!</b>Every cat accounted for (well, enough of them).', 3);
        break;
      default:
        break;
    }
  }

  frame(dt: number, alpha: number, paused: boolean): void {
    const g = this.game;
    // Keep things gently animating behind the results card.
    if (!paused && g.phase === 'complete') g.clock += dt;
    if (!paused) this.updateHud(dt);
    this.view.update(paused ? 0 : dt, { mode: 'play' });
    this.view.render(paused ? 1 : alpha, { mode: 'play' });
  }

  private updateHud(dt: number): void {
    const { hud, hint, controls } = this.ctx;
    const g = this.game;
    hud.setCount(String(g.pennedCount));
    hud.setPips(g.pennedCount);
    hud.setTime(kcTime(g.elapsed));
    hud.setScore(String(g.score));
    if (g.treatsLeft !== this.last.treats) {
      this.last.treats = g.treatsLeft;
      this.treatCount.textContent = String(g.treatsLeft);
      this.treatBtn.classList.toggle('empty', g.treatsLeft === 0);
    }
    const cd = Math.round((g.player.whistleCooldown / 1.1) * 100);
    if (cd !== this.last.cd) {
      this.last.cd = cd;
      this.whistleCd.style.setProperty('--cd', `${cd}%`);
    }
    hint.set(g.phase === 'playing' ? this.hints.update(dt, g, { moved: controls.moved, whistled: this.whistled, treated: this.treated }) : null);
  }

  isComplete(): boolean {
    return this.game.phase === 'complete';
  }

  result(): SceneResult {
    const r = this.game.result!;
    return {
      stars: r.stars,
      score: r.total,
      title: 'Yee-haw!',
      sub: `${this.game.pennedCount} cats corralled in ${kcTime(this.game.elapsed)}. They look very smug about it.`,
      lines: r.lines.map((l) => ({ label: l.label, value: String(l.value) })),
      finished: true,
    };
  }

  pauseText(): string {
    return `${this.game.pennedCount} of ${this.level.required} cats corralled · ${kcTime(this.game.elapsed)}`;
  }
}
