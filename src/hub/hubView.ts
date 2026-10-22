import { ACTIVITIES } from '../content/activities';
import { FAMILY, type HatKind } from '../content/cast';
import { clamp, dist, lerp } from '../core/math';
import { drawDog, drawDonkey } from '../render/animals';
import { drawEmote, drawKittenFigure, star } from '../render/characters';
import { C } from '../render/palette';
import { drawPerson, type HeldItem } from '../render/people';
import type { BuildingSprites, TreeSprites } from '../render/sprites';
import type { TerrainTiles } from '../render/terrain';
import { drawMower, type MowerPaint } from '../render/vehicles';
import { WorldView, type Box } from '../render/worldView';
import type { HubEvent, Homestead } from './homestead';
import { HUNT_ITEMS, ORNAMENTS, ROUNDS_TASKS, type OrnamentDef } from './missions';

type Ctx = CanvasRenderingContext2D;

const NPC_HOLD: Partial<Record<string, HeldItem>> = { megan: 'basket' };
/** Where Grandpa keeps his little porch tree; found ornaments get hung on it. */
export const PORCH_TREE = { x: 1562, y: 716 };

export class HubView extends WorldView {
  hat: HatKind | undefined;
  mowerPaint: MowerPaint = 'red';
  /** Screen rect kept clear of the HUD for edge markers. */
  guideRect = { left: 0, top: 0, right: 0, bottom: 0 };
  /** Cats already petted (faint heart under them). */
  petted = new Set<string>();

  constructor(
    canvas: HTMLCanvasElement,
    private readonly hub: Homestead,
    shared?: { tiles: TerrainTiles; trees: TreeSprites; buildings: BuildingSprites },
  ) {
    super(canvas, hub.map, shared);
    this.ambient.donkeys = false;
    this.snapTo(hub.player.x, hub.player.y);
  }

  snap(): void {
    this.snapTo(this.hub.player.x, this.hub.player.y);
  }

  handleEvent(e: HubEvent): void {
    switch (e.type) {
      case 'ornament':
        this.burst('spark', e.x, e.y - 10, C.gold, 100, 16);
        this.floatText(e.x, e.y - 30, `Ornament ${e.count}/8`, '#fff3b0');
        break;
      case 'fetched':
        this.burst('heart', e.x, e.y - 20, '#ef5d84', 40, 4);
        break;
      case 'carrot':
        if (e.ok) this.burst('heart', e.x, e.y - 50, '#ef5d84', 40, 4);
        else this.floatText(e.x, e.y - 70, 'nope', '#ffffff', 12);
        break;
      case 'pet':
        this.burst('heart', e.x, e.y - 18, '#ef5d84', 30, 3);
        this.petted.add(e.cat);
        break;
      case 'task':
        this.burst('spark', e.x, e.y - 20, C.gold, 90, 14);
        this.ring(e.x, e.y, 70, '#fff3b0');
        break;
      case 'huntItem':
        this.burst('spark', e.x, e.y - 10, C.gold, 100, 18);
        break;
      case 'roundsDone':
        this.confetti();
        break;
      default:
        break;
    }
  }

  update(dt: number, mode: 'title' | 'play'): void {
    const p = this.hub.player;
    if (mode === 'title') this.drift(dt, 1250, 1500, 520, 900);
    else this.follow(p.x, p.y, p.vx, p.vy, dt);
    this.updateParticles(dt);
  }

  render(alpha: number): void {
    const h = this.hub;
    const p = h.player;
    const px = lerp(p.px, p.x, alpha);
    const py = lerp(p.py, p.y, alpha);
    const clock = h.clock;
    const me = FAMILY[h.explorer].look;
    const sp = Math.hypot(p.vx, p.vy);
    const drawMe = (ctx: Ctx, ghost: boolean) =>
      drawPerson(ctx, me, {
        x: px,
        y: py,
        faceX: p.faceX,
        speed01: clamp(sp / p.maxSpeed, 0, 1),
        walkPhase: p.walkPhase * 0.85,
        clock,
        action: p.throwT > 0 ? 'throw' : 'none',
        actionT: p.throwT / 0.5,
        hat: this.hat,
        hold: h.mission?.kind === 'rounds' && h.mission.done.has('eggs') && !h.mission.done.has('kitchen') ? 'basket' : null,
        ghost,
      });
    const m = h.mission;

    this.renderFrame({
      clock,
      focus: { x: px, y: py },
      ground: (ctx, v) => {
        // Soft rings where activities start.
        if (!m) {
          for (const a of ACTIVITIES) {
            if (!inBox(a.station, v, 80)) continue;
            const near = h.nearStation?.id === a.id;
            ctx.beginPath();
            ctx.ellipse(a.station.x, a.station.y + 4, 46, 18, 0, 0, Math.PI * 2);
            ctx.fillStyle = near ? 'rgba(255,236,150,0.45)' : 'rgba(255,248,220,0.22)';
            ctx.fill();
            ctx.setLineDash([7, 6]);
            ctx.lineDashOffset = -clock * 10;
            ctx.strokeStyle = near ? 'rgba(255,246,200,0.95)' : 'rgba(255,248,220,0.55)';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
        if (m?.kind === 'rounds') {
          for (const t of ROUNDS_TASKS) {
            if (m.done.has(t.id) || !inBox(t, v, 80)) continue;
            const blocked = !!t.needs && !m.done.has(t.needs);
            const pulse = 0.5 + 0.5 * Math.sin(clock * 4);
            ctx.beginPath();
            ctx.ellipse(t.x, t.y, 34, 14, 0, 0, Math.PI * 2);
            ctx.fillStyle = blocked ? 'rgba(255,255,255,0.12)' : `rgba(255,220,110,${0.25 + pulse * 0.2})`;
            ctx.fill();
            ctx.strokeStyle = blocked ? 'rgba(255,255,255,0.4)' : '#fff3b0';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            if (m.holding?.task === t.id) {
              ctx.beginPath();
              ctx.ellipse(t.x, t.y, 40, 17, 0, -Math.PI / 2, -Math.PI / 2 + (m.holding.t / 0.9) * Math.PI * 2);
              ctx.strokeStyle = C.gold;
              ctx.lineWidth = 5;
              ctx.stroke();
            }
          }
        }
      },
      actors: (items, v) => {
        const ctx = this.ctx;
        items.push({ y: py, draw: () => drawMe(ctx, false) });
        for (const n of h.npcs) {
          if (!inBox(n, v, 40)) continue;
          const L = FAMILY[n.who].look;
          items.push({
            y: n.y,
            draw: () =>
              drawPerson(ctx, L, {
                x: n.x,
                y: n.y,
                faceX: n.faceX,
                speed01: 0,
                walkPhase: 0,
                clock: clock + n.home.x,
                action: n.waveT > 0 ? 'wave' : 'none',
                hold: NPC_HOLD[n.who] ?? null,
              }),
          });
        }
        // Jay's mower parked at his station, ready to go.
        const mowSt = ACTIVITIES.find((a) => a.id === 'mower')!.station;
        if (inBox(mowSt, v, 60)) {
          const mx = mowSt.x + 52;
          const my = mowSt.y + 8;
          items.push({ y: my, draw: () => drawMower(ctx, mx, my, -0.3, this.mowerPaint, null, clock, false) });
        }
        for (const d of h.dogs) {
          const x = lerp(d.px, d.x, alpha);
          const y = lerp(d.py, d.y, alpha);
          if (!inBox({ x, y }, v, 30)) continue;
          const moving = Math.hypot(d.x - d.px, d.y - d.py) > 0.3;
          const fast = Math.hypot(d.x - d.px, d.y - d.py) > 3.5;
          items.push({
            y,
            draw: () =>
              drawDog(ctx, d.def, {
                x,
                y,
                faceX: d.faceX,
                pose: d.state === 'rest' ? 'lie' : moving ? (fast ? 'run' : 'walk') : 'sit',
                phase: d.phase,
                clock: clock + d.side,
                wag: d.wag,
                ball: d.ball,
              }),
          });
        }
        for (const d of h.donkeys) {
          const x = lerp(d.px, d.x, alpha);
          const y = lerp(d.py, d.y, alpha);
          if (!inBox({ x, y }, v, 60)) continue;
          const walking = d.state === 'wander' || d.state === 'come';
          items.push({
            y,
            draw: () =>
              drawDonkey(ctx, d.def, {
                x,
                y,
                faceX: d.faceX,
                walking: walking && Math.hypot(d.x - d.px, d.y - d.py) > 0.05,
                phase: d.phase,
                clock: clock + d.x * 0.01,
                graze: d.state === 'graze' || d.state === 'eat',
                bray: d.brayT > 0,
              }),
          });
        }
        for (const c of h.cats) {
          const x = lerp(c.px, c.x, alpha);
          const y = lerp(c.py, c.y, alpha);
          if (!inBox({ x, y }, v, 30)) continue;
          const moving = Math.hypot(c.x - c.px, c.y - c.py) > 0.2;
          items.push({
            y,
            draw: () =>
              drawKittenFigure(ctx, {
                x,
                y,
                faceX: c.faceX,
                coat: c.coat,
                pose: moving ? 'walk' : c.personality === 'sleepy' ? 'lie' : 'sit',
                phase: c.phase,
                speed: moving ? 60 : 0,
                alarm: c.emote === 'alarm' ? 1 : 0,
                happy: c.emote === 'heart',
                clock,
                ring: null,
              }),
          });
        }
        for (const o of ORNAMENTS) {
          if (h.ornaments.has(o.id) || !inBox(o, v, 30)) continue;
          items.push({ y: o.y, draw: () => drawOrnament(ctx, o, clock) });
        }
        if (inBox(PORCH_TREE, v, 60)) items.push({ y: PORCH_TREE.y, draw: () => drawPorchTree(ctx, PORCH_TREE.x, PORCH_TREE.y, h.ornaments, clock) });
        if (m?.kind === 'hunt' && !m.ready) {
          const it = HUNT_ITEMS[m.step];
          // Hidden objects only show up close by (or while a hint is lit).
          if (it && (dist(it, p) < 190 || m.hintT > 0)) items.push({ y: it.y, draw: () => drawHuntItem(ctx, it.id, it.x, it.y, clock) });
        }
        if (h.ball) {
          const b = h.ball;
          if (b.held) return;
          const f = b.t / b.flight;
          const x = lerp(b.fromX, b.x, f);
          const y = lerp(b.fromY, b.y, f);
          const lift = b.landed ? 0 : Math.sin(f * Math.PI) * 60;
          items.push({
            y: b.y,
            draw: () => {
              ctx.beginPath();
              ctx.ellipse(lerp(b.fromX, b.x, f), lerp(b.fromY + 40, b.y, f), 4, 1.6, 0, 0, Math.PI * 2);
              ctx.fillStyle = C.shadow;
              ctx.fill();
              ctx.beginPath();
              ctx.arc(x, y - 4 - lift, 3.6, 0, Math.PI * 2);
              ctx.fillStyle = '#d9e64a';
              ctx.fill();
              ctx.strokeStyle = C.ink;
              ctx.lineWidth = 1.1;
              ctx.stroke();
            },
          });
        }
      },
      ghosts: (ctx) => drawMe(ctx, true),
      overlay: (ctx, v) => {
        for (const c of h.cats) {
          if (c.emote === 'none' || !inBox(c, v, 20)) continue;
          const lift = c.personality === 'sleepy' && c.state === 'rest' ? 14 : 26;
          drawEmote(ctx, c.emote, c.x, c.y - lift, Math.min(1, c.emoteT * 4 + 0.3), clock);
        }
        for (const d of h.donkeys) if (d.brayT > 0) this.bubbleText(ctx, d.x + d.faceX * 30, d.y - 78, 'HEE-HAW');
        // Name tags over family members when you're close.
        for (const n of h.gathered ? [] : h.npcs) {
          if (dist(n, p) > 240) continue;
          const L = FAMILY[n.who];
          this.bubbleText(ctx, n.x, n.y - 64 * L.look.scale - 12, L.name, C.barnRed);
        }
        // Gold star over activities you haven't tried yet.
        if (!m && !h.gathered) {
          for (const a of ACTIVITIES) {
            if (!this.untried.has(a.id) || !inBox(a.station, v, 60)) continue;
            const who = FAMILY[a.who].look.scale;
            const sx = a.station.x + 16;
            const sy = a.station.y - 70 * who - 18 + Math.sin(clock * 3) * 2;
            star(ctx, sx, sy, 8, C.gold);
            ctx.strokeStyle = C.ink;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }
      },
      screen: (ctx, left, top, z) => {
        if (m?.kind === 'rounds') {
          for (const t of ROUNDS_TASKS) {
            if (m.done.has(t.id) || (t.needs && !m.done.has(t.needs))) continue;
            this.edgeMarker(ctx, left, top, z, t.x, t.y, this.guideRect, (c) => {
              c.fillStyle = C.ink;
              c.font = '900 13px ui-rounded, system-ui, sans-serif';
              c.textAlign = 'center';
              c.textBaseline = 'middle';
              c.fillText(String(ROUNDS_TASKS.indexOf(t) + 1), 0, 1);
            });
          }
        } else if (m?.kind === 'hunt' && m.hintT > 0) {
          const it = h.huntTarget();
          if (it) this.edgeMarker(ctx, left, top, z, it.x, it.y, this.guideRect, (c) => {
            c.fillStyle = C.ink;
            c.font = '900 15px ui-rounded, system-ui, sans-serif';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText('?', 0, 1);
          });
        } else if (m?.kind === 'hunt' && m.ready) {
          const g = ACTIVITIES.find((a) => a.id === 'hunt')!.station;
          this.edgeMarker(ctx, left, top, z, g.x, g.y, this.guideRect, (c) => {
            c.fillStyle = C.ink;
            c.font = '900 13px ui-rounded, system-ui, sans-serif';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText('G', 0, 1);
          });
        }
      },
    });
  }

  /** Activities with no stars yet get a little star over the character. */
  untried = new Set<string>();
}

function inBox(p: { x: number; y: number }, v: Box, pad: number): boolean {
  return p.x > v.x0 - pad && p.x < v.x1 + pad && p.y > v.y0 - pad && p.y < v.y1 + pad + 60;
}

export function drawOrnament(ctx: Ctx, o: OrnamentDef, clock: number): void {
  const bob = Math.sin(clock * 2 + o.x) * 1.5;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.shadow;
  ctx.fill();
  ctx.translate(0, -8 + bob);
  ctx.beginPath();
  ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
  ctx.fillStyle = o.color;
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.fillStyle = '#c9a548';
  ctx.fillRect(-2.5, -9, 5, 3);
  ctx.strokeRect(-2.5, -9, 5, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(-2.2, -2.2, 1.8, 1.2, -0.6, 0, Math.PI * 2);
  ctx.fill();
  // A glint now and then so sharp eyes can spot it.
  const g = (clock * 0.7 + o.y * 0.01) % 1;
  if (g < 0.15) star(ctx, 4, -5, 5 * Math.sin((g / 0.15) * Math.PI), '#ffffff');
  ctx.restore();
}

function drawPorchTree(ctx: Ctx, x: number, y: number, found: Set<string>, clock: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.ellipse(2, 1, 20, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.shadow;
  ctx.fill();
  ctx.fillStyle = '#9a6b42';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.5;
  ctx.fillRect(-9, -10, 18, 10);
  ctx.strokeRect(-9, -10, 18, 10);
  for (let i = 0; i < 3; i++) {
    const w = 22 - i * 6;
    const yb = -10 - i * 14;
    ctx.beginPath();
    ctx.moveTo(-w, yb);
    ctx.lineTo(0, yb - 22);
    ctx.lineTo(w, yb);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#3f7a3c' : '#457f3f';
    ctx.fill();
    ctx.stroke();
  }
  const spots: [number, number][] = [[-12, -14], [9, -16], [-4, -24], [12, -12], [-7, -33], [6, -36], [0, -46], [-15, -11]];
  let i = 0;
  for (const o of ORNAMENTS) {
    const [ox, oy] = spots[i++];
    if (!found.has(o.id)) continue;
    ctx.beginPath();
    ctx.arc(ox, oy, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = o.color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // The star goes on once every ornament is home.
  if (found.size >= ORNAMENTS.length) {
    star(ctx, 0, -58, 7 + Math.sin(clock * 3) * 0.6, C.gold);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHuntItem(ctx: Ctx, id: string, x: number, y: number, clock: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.ellipse(0, 1, 9, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.shadow;
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.3;
  switch (id) {
    case 'glasses':
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * 5, -4, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(190,225,240,0.8)';
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-1, -5);
      ctx.lineTo(1, -5);
      ctx.stroke();
      break;
    case 'watch':
      ctx.beginPath();
      ctx.arc(0, -5, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#e8c34a';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -5, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = '#fffaf0';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(0, -7.5);
      ctx.moveTo(0, -5);
      ctx.lineTo(1.8, -4.5);
      ctx.stroke();
      break;
    case 'harmonica':
      ctx.fillStyle = '#c9ced4';
      ctx.fillRect(-8, -7, 16, 6);
      ctx.strokeRect(-8, -7, 16, 6);
      ctx.fillStyle = C.ink;
      for (let i = -6; i < 7; i += 3) ctx.fillRect(i, -5, 1.4, 2);
      break;
    case 'lure':
      ctx.beginPath();
      ctx.ellipse(0, -5, 7, 3, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = '#f08a24';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fffaf0';
      ctx.fillRect(-2, -6, 4, 2);
      ctx.beginPath();
      ctx.arc(8, -3, 2.4, 0, Math.PI);
      ctx.stroke();
      break;
    default:
      // Brass key in a work glove.
      ctx.beginPath();
      ctx.ellipse(0, -4, 9, 5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#c9a26a';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e8c34a';
      ctx.beginPath();
      ctx.arc(6, -8, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(7, -9, 7, 2);
      break;
  }
  const g = (clock * 0.9) % 1;
  if (g < 0.2) star(ctx, 6, -12, 5 * Math.sin((g / 0.2) * Math.PI), '#ffffff');
  ctx.restore();
}
