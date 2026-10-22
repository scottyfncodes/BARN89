import { dist } from '../../core/math';
import type { Game } from './game';
import type { GameEvent } from './types';

export interface HintContext {
  moved: boolean;
  whistled: boolean;
  treated: boolean;
}

interface Active {
  id: string;
  html: string;
  t: number;
}

/**
 * Contextual coaching: short tips that appear exactly when they're useful, once each per play.
 * The very first tip stays up until the player has actually moved.
 */
export class Hints {
  private shown = new Set<string>();
  private active: Active | null = null;
  private queue: Active[] = [];
  private playT = 0;

  reset(): void {
    this.shown.clear();
    this.active = null;
    this.queue = [];
    this.playT = 0;
  }

  private push(id: string, html: string, t = 5.5): void {
    if (this.shown.has(id)) return;
    this.shown.add(id);
    this.queue.push({ id, html, t });
  }

  onEvent(e: GameEvent, g: Game): void {
    if (e.type === 'penned' && g.pennedCount === 1 && g.pennedCount < g.level.required) {
      this.push('arrows', 'One down! The <em>arrows at the screen edge</em> point to loose cats.');
    } else if (e.type === 'butterfly') {
      const k = g.kittens.find((kk) => kk.id === e.kittenId);
      this.push('butterfly', `${k?.name ?? 'A cat'} spotted a butterfly. Of course.`, 4);
    } else if (e.type === 'noTreats') {
      this.push('notreats', 'Out of treats! Look for <em>treat bags</em> around the homestead.', 4.5);
    }
  }

  update(dt: number, g: Game, c: HintContext): string | null {
    this.playT += dt;
    if (!this.shown.has('move')) {
      if (c.moved) this.shown.add('move');
      else return 'Drag <em>anywhere</em> on the screen to move.';
    }
    if (this.playT > 1.5) this.push('push', 'Get <em>behind</em> a cat to push it toward the glowing <em>corral</em>.', 6.5);
    const p = g.player;
    for (const k of g.kittens) {
      if (k.penned) continue;
      const d = dist(k, p);
      if (d > 230) continue;
      if (k.personality === 'hungry' && g.treatsLeft > 0 && !c.treated && this.playT > 6) {
        this.push('hungry', `${k.name} is <em>hungry</em>. Tap <em>Treat</em> to toss one, then lead the way.`, 6.5);
      } else if (k.personality === 'curious' && this.playT > 8) {
        this.push('curious', `${k.name} is <em>curious</em>. Stop and wait, and she'll come say hi.`);
      } else if (k.state === 'nap') {
        this.push('sleepy', `Shh, ${k.name} is napping. A <em>whistle</em> wakes sleepy cats.`);
      } else if (k.personality === 'shy' && k.state === 'flee' && this.playT > 6) {
        this.push('shy', `${k.name} is <em>shy</em> and bolts early. Herd from further back.`);
      }
    }
    if (this.playT > 35 && !c.whistled) {
      this.push('whistle', 'Tap <em>Whistle</em>: nearby cats scoot the way you\'re heading.');
    }

    if (this.active) {
      this.active.t -= dt;
      if (this.active.t <= 0) this.active = null;
    }
    if (!this.active && this.queue.length) this.active = this.queue.shift()!;
    return this.active ? this.active.html : null;
  }
}
