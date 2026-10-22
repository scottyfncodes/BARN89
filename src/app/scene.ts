import type { Sfx } from '../audio/sfx';
import type { Cosmetics } from '../core/save';
import type { BuildingSprites, TreeSprites } from '../render/sprites';
import type { TerrainTiles } from '../render/terrain';
import type { Decor } from '../render/worldView';
import type { Controls } from '../ui/input';
import type { Hint, Toast } from './dom';
import type { Hud } from './hud';

export interface SceneResult {
  stars: number;
  score: number;
  title: string;
  sub: string;
  lines: { label: string; value: string }[];
  finished: boolean;
}

export interface SceneContext {
  canvas: HTMLCanvasElement;
  controls: Controls;
  sfx: Sfx;
  hud: Hud;
  toast: Toast;
  hint: Hint;
  caches: { tiles: TerrainTiles; trees: TreeSprites; buildings: BuildingSprites };
}

/** A minigame running full screen. The app owns the loop, menus and results. */
export interface GameScene {
  readonly challenge: string;
  /** Configure HUD and buttons for this game. */
  enter(look: { cosmetics: Cosmetics; decor: Decor; insetTop: number }): void;
  exit(): void;
  /** Fresh start (Play again / Restart). */
  restart(): void;
  step(dt: number): void;
  frame(dt: number, alpha: number, paused: boolean): void;
  resize(w: number, h: number, dpr: number, insetTop: number): void;
  isComplete(): boolean;
  result(): SceneResult;
  pauseText(): string;
}
