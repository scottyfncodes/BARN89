import { Game } from '../src/game/game';
import { PLAYER_RADIUS } from '../src/game/player';
import type { InputState, Kitten } from '../src/game/types';
import { NavGrid } from '../src/world/navgrid';

/**
 * A simple autopilot that herds kittens the way a player would: get behind a kitten
 * (relative to its route to the corral gate), then push it along. Used to prove the level
 * is finishable through actual herding, not just by teleporting kittens.
 */
export class HerdBot {
  private tigerNav: NavGrid;
  private target: Kitten | null = null;
  private route: { x: number; y: number }[] | null = null;
  private routeAge = 0;
  private myPath: { x: number; y: number }[] | null = null;
  private myPathAge = 0;
  private stuckT = 0;
  private lastPos = { x: 0, y: 0 };

  constructor(private g: Game) {
    this.tigerNav = new NavGrid(g.world, 16, PLAYER_RADIUS);
  }

  private gateInside() {
    const pen = this.g.targetPen;
    return { x: pen.x, y: pen.y };
  }

  next(dt: number): InputState {
    const g = this.g;
    const p = g.player;
    const out: InputState = { moveX: 0, moveY: 0, whistle: false, treat: false };
    if (!this.target || this.target.penned) {
      this.target = null;
      let best = Infinity;
      for (const k of g.kittens) {
        if (k.penned) continue;
        const d = Math.hypot(k.x - g.targetPen.x, k.y - g.targetPen.y) + Math.hypot(k.x - p.x, k.y - p.y) * 0.5;
        if (d < best) {
          best = d;
          this.target = k;
        }
      }
      this.route = null;
    }
    const k = this.target;
    if (!k) return out;

    this.routeAge -= dt;
    if (!this.route || this.routeAge <= 0) {
      this.route = g.nav.findPath(k, this.gateInside(), 40000);
      this.routeAge = 0.5;
    }
    let wp = this.route?.[0] ?? this.gateInside();
    if (this.route && this.route.length > 1 && Math.hypot(wp.x - k.x, wp.y - k.y) < 30) wp = this.route[1];
    const dx = wp.x - k.x;
    const dy = wp.y - k.y;
    const l = Math.hypot(dx, dy) || 1;
    const ux = dx / l;
    const uy = dy / l;
    // Herding spot: behind the kitten.
    const back = 75;
    const spot = { x: k.x - ux * back, y: k.y - uy * back };
    const toSpot = Math.hypot(spot.x - p.x, spot.y - p.y);
    const along = (p.x - k.x) * ux + (p.y - k.y) * uy; // >0 means we're in front of it

    let goal: { x: number; y: number };
    let speed = 1;
    if (toSpot > 45 || along > -30) {
      // Circle round wide so we don't spook it the wrong way.
      if (along > -30 && Math.hypot(p.x - k.x, p.y - k.y) < 160) {
        const side = (p.x - k.x) * -uy + (p.y - k.y) * ux >= 0 ? 1 : -1;
        goal = { x: k.x - uy * side * 170 - ux * 60, y: k.y + ux * side * 170 - uy * 60 };
      } else goal = spot;
    } else {
      goal = { x: k.x + ux * 20, y: k.y + uy * 20 };
      speed = 0.55;
    }
    if (k.personality === 'sleepy' && k.state === 'nap' && Math.hypot(p.x - k.x, p.y - k.y) < 180 && along < 0) {
      p.heading = Math.atan2(uy, ux);
      out.whistle = true;
    }
    this.myPathAge -= dt;
    if (!this.myPath || this.myPathAge <= 0) {
      const free = this.tigerNav.isWalkable(goal.x, goal.y) ? goal : this.tigerNav.nearestWalkable(goal.x, goal.y, 6) ?? goal;
      this.myPath = this.tigerNav.findPath(p, free, 40000);
      this.myPathAge = 0.3;
    }
    let mp = this.myPath?.[0] ?? goal;
    if (this.myPath && this.myPath.length > 1 && Math.hypot(mp.x - p.x, mp.y - p.y) < 20) {
      this.myPath.shift();
      mp = this.myPath[0];
    }
    const mx = mp.x - p.x;
    const my = mp.y - p.y;
    const ml = Math.hypot(mx, my);
    if (ml > 4) {
      out.moveX = (mx / ml) * speed;
      out.moveY = (my / ml) * speed;
    }
    this.stuckT += dt;
    if (this.stuckT > 4) {
      if (Math.hypot(p.x - this.lastPos.x, p.y - this.lastPos.y) < 20) this.target = null;
      this.lastPos = { x: p.x, y: p.y };
      this.stuckT = 0;
    }
    return out;
  }
}
