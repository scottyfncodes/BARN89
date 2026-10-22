import { WoodGame, type WoodEvent, type WoodRound } from '../games/woodpile/woodpile';
import { WoodView } from '../games/woodpile/woodView';
import { $, formatTime, ICONS, show } from './dom';
import type { GameScene, SceneContext, SceneResult } from './scene';

/** Woodpile: Jason's chop-and-stack challenge by the woodshed. */
export class WoodScene implements GameScene {
  readonly challenge: string;
  readonly game: WoodGame;
  readonly view: WoodView;
  private tossBtn = $('toss-btn');
  private taps = 0;

  constructor(
    private readonly ctx: SceneContext,
    readonly round: WoodRound,
  ) {
    this.challenge = round.id;
    this.game = new WoodGame(round);
    this.view = new WoodView(ctx.canvas, this.game);
  }

  enter(look: Parameters<GameScene['enter']>[0]): void {
    const c = this.ctx;
    c.hud.configure({ icon: ICONS.log, required: `/${this.round.goal}`, label: 'stacked', barTarget: 1 });
    c.controls.enabled = false;
    c.controls.tapMode = true;
    c.controls.keyMap = { t: 'toss', x: 'toss' };
    c.controls.onTap = () => this.taps++;
    this.view.insetTop = look.insetTop;
    this.restart();
  }

  exit(): void {
    this.ctx.controls.tapMode = false;
    this.ctx.controls.onTap = () => {};
    show(this.tossBtn, false);
    this.ctx.hint.set(null);
  }

  restart(): void {
    this.game.reset();
    this.taps = 0;
  }

  resize(w: number, h: number, dpr: number, insetTop: number): void {
    this.view.insetTop = insetTop;
    this.view.resize(w, h, dpr);
  }

  step(dt: number): void {
    const g = this.game;
    if (this.ctx.controls.consume('toss')) g.toss();
    while (this.taps > 0) {
      this.taps--;
      g.tap();
    }
    g.step(dt);
    for (const e of g.drainEvents()) this.handle(e);
  }

  private handle(e: WoodEvent): void {
    const { sfx, toast, hud } = this.ctx;
    this.view.handleEvent(e);
    switch (e.type) {
      case 'chop':
        if (e.grade === 'miss') sfx.thud();
        else {
          sfx.chop(e.grade === 'perfect' ? 1 : 0.4);
          if (e.final) setTimeout(() => sfx.split(), 90);
        }
        break;
      case 'rotten':
        sfx.oops();
        toast.show('<b>Rotten log!</b>Soft, mossy logs go on the burn pile. Tap <b>Toss it</b>.', 3);
        break;
      case 'toss':
        if (e.good) sfx.collect();
        else sfx.oops();
        break;
      case 'stack':
        sfx.stack(e.grade === 'snug');
        if (e.grade === 'snug') hud.bump();
        break;
      case 'tumble':
        sfx.thud();
        break;
      case 'collapse':
        sfx.clunk();
        setTimeout(() => sfx.thud(), 120);
        toast.show(`<b>Timber!</b>${e.lost} pieces rolled off. Stack them snug.`, 2.8);
        break;
      case 'row':
        sfx.tick();
        break;
      case 'done':
        sfx.victory();
        toast.show("<b>That'll keep us warm!</b>Woodpile done.", 2.4);
        break;
      case 'timeout':
        sfx.denied();
        toast.show('<b>Sun went down.</b>Not quite enough wood. Try again?', 2.6);
        break;
    }
  }

  frame(dt: number, _alpha: number, paused: boolean): void {
    const g = this.game;
    const { hud, hint } = this.ctx;
    if (!paused) {
      hud.setCount(String(g.stacked));
      hud.setBar(g.stacked / g.round.goal);
      hud.setTime(`${formatTime(g.timeLeft)} left`);
      hud.setScore(String(g.score));
      const aiming = g.phase === 'aim' || g.phase === 'ready' || g.phase === 'arrive';
      show(this.tossBtn, aiming);
      let h: string | null = null;
      if (g.phase === 'ready') h = '<em>Tap anywhere</em> when the red marker is over the <em>gold</em>.';
      else if (aiming && g.log.punky) h = 'Moss and mushrooms: this one is <em>rotten</em>. Tap <em>Toss it</em>.';
      else if (aiming && g.logs <= 2) h = '<em>Tap</em> when the marker is in the <em>gold</em>.';
      else if ((g.phase === 'slide' || g.phase === 'drop') && g.stacked < 4) h = '<em>Tap</em> to drop it right at the <em>dotted line</em>, snug against the last piece.';
      else if (g.wobble > 0.6 && g.phase === 'slide') h = 'This row is <em>wobbly</em>. Make the next one snug!';
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
    return {
      stars: r.stars,
      score: r.score,
      title: r.finished ? 'Stacked!' : 'Sun went down',
      sub: r.finished
        ? `${this.round.goal} pieces split and stacked. Quality ${Math.round(r.quality * 100)}%.`
        : `${this.game.stacked} of ${this.round.goal} stacked. Snug stacks and clean chops are faster.`,
      lines: r.lines,
      finished: r.finished,
    };
  }

  pauseText(): string {
    return `${this.game.stacked} of ${this.round.goal} stacked · ${formatTime(this.game.timeLeft)} left`;
  }
}
