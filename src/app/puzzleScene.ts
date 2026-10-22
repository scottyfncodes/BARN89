import { PuzzleGame, type PuzzleEvent, type PuzzleRound } from '../games/puzzle/puzzle';
import { PuzzleView } from '../games/puzzle/puzzleView';
import { ICONS } from './dom';
import type { GameScene, SceneContext, SceneResult } from './scene';

/** Barn Puzzles with Jason: slide the hay bales to get the wagon out, or turn pipes to water the stock. */
export class PuzzleScene implements GameScene {
  readonly challenge: string;
  readonly game: PuzzleGame;
  readonly view: PuzzleView;
  /** Where the current touch started, and the piece under it (hay). */
  private press: { x: number; y: number; id: string | null } | null = null;

  constructor(
    private readonly ctx: SceneContext,
    readonly round: PuzzleRound,
  ) {
    this.challenge = round.id;
    this.game = new PuzzleGame(round);
    this.view = new PuzzleView(ctx.canvas, this.game);
  }

  enter(look: Parameters<GameScene['enter']>[0]): void {
    const c = this.ctx;
    c.hud.configure({ icon: ICONS.bale, required: `/${this.round.boards.length}`, label: 'puzzle' });
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
    this.press = null;
    this.view.drag = null;
  }

  resize(w: number, h: number, dpr: number, insetTop: number): void {
    this.view.insetTop = insetTop;
    this.view.resize(w, h, dpr);
  }

  /** Touches: drag a bale along its length, or tap a pipe to turn it. */
  pointer(kind: 'down' | 'move' | 'up', x: number, y: number): void {
    const g = this.game;
    const v = this.view;
    if (g.phase !== 'play') {
      this.press = null;
      v.drag = null;
      return;
    }
    const b = g.board;
    if (kind === 'down') {
      const { cx, cy } = v.cellAt(x, y);
      let id: string | null = null;
      if (b.kind === 'hay') {
        const p = g.pieces.find((q) => q.kind !== 'post' && cx >= q.x && cy >= q.y && cx < q.x + (q.dir === 'h' ? q.len : 1) && cy < q.y + (q.dir === 'v' ? q.len : 1));
        id = p?.id ?? null;
        if (id) v.drag = { id, offset: 0 };
      }
      this.press = { x, y, id };
      return;
    }
    const pr = this.press;
    if (!pr) return;
    if (b.kind === 'hay' && pr.id) {
      const p = g.pieces.find((q) => q.id === pr.id)!;
      const along = (p.dir === 'h' ? x - pr.x : y - pr.y) / v.cell;
      const [back, fwd] = v.dragLimits(pr.id);
      const off = Math.max(-back, Math.min(fwd, along));
      if (kind === 'move') {
        v.drag = { id: pr.id, offset: off };
        return;
      }
      v.drag = null;
      this.press = null;
      g.slide(pr.id, Math.round(off));
      return;
    }
    if (kind !== 'up') return;
    this.press = null;
    // A tap (not a drag): turn the pipe under it, or start the board over.
    if (Math.hypot(x - pr.x, y - pr.y) > 18) return;
    const r = v.retryBox();
    if (g.moves > 0 && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      g.retry();
      this.ctx.sfx.click();
      return;
    }
    if (b.kind === 'pipes') {
      const { cx, cy } = v.cellAt(x, y);
      if (cx < 0 || cy < 0 || cx >= b.w || cy >= b.h) return;
      g.tap(cx, cy);
      v.turned(cy * b.w + cx);
    }
  }

  step(dt: number): void {
    this.game.step(dt);
    for (const e of this.game.drainEvents()) this.handle(e);
  }

  private handle(e: PuzzleEvent): void {
    const { sfx, hud, toast } = this.ctx;
    this.view.handleEvent(e);
    switch (e.type) {
      case 'slide':
        sfx.clunk();
        break;
      case 'turn':
        sfx.tick();
        break;
      case 'solved':
        if (this.game.board.kind === 'hay') sfx.collect();
        else sfx.discover();
        hud.bump();
        if (e.board === 0 && e.moves <= e.par) toast.show('<b>Right on par.</b>Jason is impressed. He will not say so.', 2.4);
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
      hud.setCount(String(Math.min(this.round.boards.length, g.boardIndex + 1)));
      hud.setTime(`Par ${g.par}`);
      hud.setScore(g.moves === 1 ? '1 move' : `${g.moves} moves`);
      let h: string | null = null;
      if (g.phase === 'play' && g.moves === 0 && g.boardIndex === 0) {
        h = g.board.kind === 'hay' ? '<em>Drag</em> the bales along their length to clear a way. Get the <em>red wagon</em> out the door.' : '<em>Tap</em> a pipe to turn it. Run the water from the <em>pump</em> to every <em>trough</em>.';
      }
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
    const d = r.moves - r.par;
    return {
      stars: r.stars,
      score: r.score,
      title: d <= 0 ? 'Right on par!' : 'All three done!',
      sub: `${this.round.name}: ${r.moves} moves, par ${r.par}.${d > 0 ? ' Fewer moves for more stars.' : ''}`,
      lines: r.lines,
      finished: true,
    };
  }

  pauseText(): string {
    return `Puzzle ${this.game.boardIndex + 1} of ${this.round.boards.length} · ${this.game.moves} moves`;
  }
}
