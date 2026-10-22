import { ACTIVITIES } from '../content/activities';
import { FAMILY, type FamilyId, type HatKind } from '../content/cast';
import { clamp, dist, lerp } from '../core/math';
import { drawDog, drawDonkey } from '../render/animals';
import { drawEmote, drawKittenFigure, star } from '../render/characters';
import { C } from '../render/palette';
import { drawPerson, paintPortrait, type PersonAction } from '../render/people';
import type { BuildingSprites, TreeSprites } from '../render/sprites';
import type { TerrainTiles } from '../render/terrain';
import { drawMotorcycle, drawMower, drawScooter, type MowerPaint } from '../render/vehicles';
import { WorldView, type Box } from '../render/worldView';
import { MOTO_PARKED, MOTO_RIDERS, MOWER_PARKED, type MotoSeat, type Npc, type Sport } from './family';
import { TRAMPOLINE, type HubEvent, type Homestead } from './homestead';
import { HUNT_ITEMS, ORNAMENTS, RACE_COURSE, RACE_GATE_R, RACE_GATES, RACE_START, ROUNDS_TASKS, type OrnamentDef } from './missions';

type Ctx = CanvasRenderingContext2D;

/** Where Grandpa keeps his little porch tree; found ornaments get hung on it. */
export const PORCH_TREE = { x: 1562, y: 716 };

export class HubView extends WorldView {
  hat: HatKind | undefined;
  mowerPaint: MowerPaint = 'red';
  /** Natalie's riding her e-scooter. */
  scooter = false;
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

  /** Jump the camera to the explorer, framed the way follow() settles (clear of the HUD and cards). */
  snap(): void {
    this.snapTo(this.hub.player.x, this.hub.player.y);
    this.cam.y += (this.insets.bottom - this.insets.top) / 2 / this.cam.zoom - 20;
    this.clampCam();
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
      case 'pupPet':
        this.burst('heart', e.x, e.y - 14, '#ef5d84', 26, 2);
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
    const riding = this.scooter && !h.gathered;
    // Bouncing on the trampoline: lifted off the mat, with a shadow left on it.
    const lift = h.trampolineLift();
    const drawMe = (ctx: Ctx, ghost: boolean) => {
      // On the scooter: feet on the deck, hands on the bars, wheels turning.
      if (riding && !ghost) drawScooter(ctx, px, py, p.faceX, false, p.walkPhase * 2);
      if (lift > 0 && !ghost) {
        ctx.beginPath();
        ctx.ellipse(px, py - TRAMPOLINE.mat, 11 - (lift - TRAMPOLINE.mat) * 0.08, 3.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();
      }
      drawPerson(ctx, me, {
        x: px,
        y: riding ? py - 6 : py - lift,
        faceX: p.faceX,
        speed01: riding ? 0 : clamp(sp / p.maxSpeed, 0, 1),
        walkPhase: p.walkPhase * 0.85,
        clock,
        action: p.throwT > 0 ? 'throw' : riding ? 'point' : h.bigJumpT > 0 ? 'cheer' : 'none',
        actionT: p.throwT / 0.5,
        hat: this.hat,
        hold: h.mission?.kind === 'rounds' && h.mission.done.has('eggs') && !h.mission.done.has('kitchen') ? 'basket' : null,
        ghost: ghost || riding || lift > 0,
      });
      if (riding && !ghost) drawScooter(ctx, px, py, p.faceX, true, 0);
    };
    const m = h.mission;

    this.renderFrame({
      clock,
      focus: { x: px, y: py },
      ground: (ctx, v) => {
        // Soft rings where activities start.
        if (!m) {
          for (const a of ACTIVITIES) {
            if (a.id === 'race' && !h.raceOpen) continue;
            if (!a.fixed && onOuting(h, a.who)) continue;
            // The ring goes wherever the person is (Megan on the mower gets a bigger one).
            const st = h.stationPos(a);
            if (!inBox(st, v, 80)) continue;
            const near = h.nearStation?.id === a.id;
            const riding = a.who === 'megan' && h.family.mow && h.family.mow.phase !== 'walk';
            ctx.beginPath();
            ctx.ellipse(st.x, st.y + 4, riding ? 58 : 46, riding ? 26 : 18, 0, 0, Math.PI * 2);
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
        if (m?.kind === 'race') {
          // The next gate glows; the one after is faint, so you can see where you're headed.
          for (let i = m.gate; i < Math.min(RACE_COURSE.length, m.gate + 2); i++) {
            const g = RACE_COURSE[i];
            if (!inBox(g, v, 80)) continue;
            const next = i === m.gate;
            const pulse = 0.5 + 0.5 * Math.sin(clock * 5);
            ctx.beginPath();
            ctx.ellipse(g.x, g.y, RACE_GATE_R, RACE_GATE_R * 0.42, 0, 0, Math.PI * 2);
            ctx.fillStyle = next ? `rgba(255,220,110,${0.3 + pulse * 0.2})` : 'rgba(255,255,255,0.14)';
            ctx.fill();
            ctx.setLineDash(next ? [] : [6, 6]);
            ctx.strokeStyle = next ? '#fff3b0' : 'rgba(255,255,255,0.5)';
            ctx.lineWidth = next ? 3.5 : 2;
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
        // Jason's motorcycle: parked, or out with Jason and Natalie (or the explorer) aboard.
        const moto = h.family.moto;
        const seated = (seat: MotoSeat) => {
          if (moto?.player === seat) return 'me';
          const n = h.npcs.find((x) => x.who === MOTO_RIDERS[seat]);
          return n && n.outing === 'moto' && moto && moto.phase !== 'gather' ? n : null;
        };
        const driver = seated('driver');
        const passenger = seated('passenger');
        const lead = driver ?? passenger;
        const bx = lead === 'me' ? px : lead ? lerp(lead.px, lead.x, alpha) : MOTO_PARKED.x;
        const by = lead === 'me' ? py : lead ? lerp(lead.py, lead.y, alpha) : MOTO_PARKED.y;
        const bf = moto && lead ? moto.faceX : 1;
        if (inBox({ x: bx, y: by }, v, 60)) {
          const spin = clock * (lead ? 18 : 0);
          const rider = (r: Npc | 'me' | null, seat: MotoSeat) => {
            if (!r) return;
            const L = r === 'me' ? me : FAMILY[r.who].look;
            const off = seat === 'driver' ? 3 : -11;
            drawPerson(ctx, L, { x: bx + bf * off, y: by - 7, faceX: bf, speed01: 0, walkPhase: 0, clock, action: seat === 'driver' ? 'point' : 'none', hat: r === 'me' ? this.hat : undefined, ghost: true });
          };
          items.push({
            y: by,
            draw: () => {
              drawMotorcycle(ctx, bx, by, bf, false, spin);
              rider(passenger, 'passenger');
              rider(driver, 'driver');
              drawMotorcycle(ctx, bx, by, bf, true, spin);
            },
          });
        }
        // On the trampoline, draw over it rather than behind its far edge.
        if (!moto?.player) items.push({ y: lift > 0 ? Math.max(py, TRAMPOLINE.y + 13) : py, draw: () => drawMe(ctx, false) });
        const ride = h.family.mow && h.family.mow.phase !== 'walk' ? h.family.mow : null;
        for (const n of h.npcs) {
          const x = lerp(n.px, n.x, alpha);
          const y = lerp(n.py, n.y, alpha);
          if (!inBox({ x, y }, v, 40)) continue;
          const L = FAMILY[n.who].look;
          if (n.outing === 'moto' && moto && moto.phase !== 'gather') continue;
          if (n.outing === 'race') {
            // Your rival, on a scooter of their own.
            const fx = n.faceX;
            items.push({
              y,
              draw: () => {
                drawScooter(ctx, x, y, fx, false, clock * 12);
                drawPerson(ctx, L, { x, y: y - 6, faceX: fx, speed01: 0, walkPhase: 0, clock: clock + n.home.x, action: 'point', ghost: true });
                drawScooter(ctx, x, y, fx, true, 0);
              },
            });
            continue;
          }
          if (ride && n.outing === 'mow') {
            // Megan out on Jay's mower.
            const heading = ride.heading;
            items.push({ y, draw: () => drawMower(ctx, x, y, heading, this.mowerPaint, L, clock, !n.attending) });
            continue;
          }
          const moving = Math.hypot(n.x - n.px, n.y - n.py) > 0.05;
          items.push({
            y,
            draw: () =>
              drawPerson(ctx, L, {
                x,
                y,
                faceX: n.faceX,
                speed01: moving ? 0.3 : 0,
                walkPhase: n.walkPhase,
                clock: clock + n.home.x,
                // Tools stay put at the breakfast table.
                hold: h.gathered ? null : n.hold,
                ...npcGesture(n, clock),
              }),
          });
        }
        // The start line by the treehouse, once scooter races are open.
        if ((h.raceOpen || m?.kind === 'race') && inBox(RACE_START, v, 60)) items.push({ y: RACE_START.y - 30, draw: () => drawStartLine(ctx, RACE_START.x, RACE_START.y, clock) });
        if (m?.kind === 'race') {
          const g = RACE_COURSE[m.gate];
          if (g && g !== RACE_START && inBox(g, v, 60)) items.push({ y: g.y, draw: () => drawGateFlags(ctx, g.x, g.y, m.gate, clock) });
        }
        // Jay's mower parked at his spot, ready to go (unless Megan's got it).
        if (!ride && inBox(MOWER_PARKED, v, 60)) {
          const { x: mx, y: my, heading } = MOWER_PARKED;
          items.push({ y: my, draw: () => drawMower(ctx, mx, my, heading, this.mowerPaint, null, clock, false) });
        }
        // A skunk out for a stroll.
        const sk = h.skunk;
        if (sk && inBox(sk, v, 30)) {
          const kx = lerp(sk.px, sk.x, alpha);
          const ky = lerp(sk.py, sk.y, alpha);
          const fade = sk.state === 'leave' ? Math.max(0, 1 - Math.max(0, sk.t - 3) / 1) : 1;
          items.push({ y: ky, draw: () => drawSkunk(ctx, kx, ky, sk.faceX, sk.phase, sk.state === 'spray' || (sk.cloudT >= 0 && sk.cloudT < 1.6), fade) });
        }
        // The snake (Grandpa's least favourite resident).
        const sn = h.snake;
        if (sn && inBox(sn, v, 30)) {
          const sx = lerp(sn.px, sn.x, alpha);
          const sy = lerp(sn.py, sn.y, alpha);
          items.push({ y: sy, draw: () => drawSnake(ctx, sx, sy, sn.dx, sn.dy, sn.phase, clock) });
        }
        // Jay and Jason's ball, and Grandpa's golf ball.
        const sb = h.family.sportBall(h.npcs);
        if (sb && inBox(sb, v, 40)) items.push({ y: sb.y + 1, draw: () => drawSportBall(ctx, sb.x, sb.y, sb.lift, sb.sport, clock) });
        const gb = h.family.puttBall();
        if (gb && inBox(gb, v, 30)) {
          items.push({
            y: gb.y,
            draw: () => {
              ctx.save();
              ctx.globalAlpha = gb.alpha;
              ctx.beginPath();
              ctx.arc(gb.x, gb.y - 1.6, 2.2, 0, Math.PI * 2);
              ctx.fillStyle = '#ffffff';
              ctx.fill();
              ctx.strokeStyle = C.ink;
              ctx.lineWidth = 0.9;
              ctx.stroke();
              ctx.restore();
            },
          });
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
                pose: d.state === 'rest' ? 'lie' : moving ? (fast ? 'run' : 'walk') : d.state === 'sniff' || d.state === 'treed' ? 'stand' : 'sit',
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
          const walking = d.state === 'wander' || d.state === 'come' || d.state === 'greet';
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
        // Grandpa's chihuahuas (unless they're indoors).
        for (const d of h.pups) {
          if (d.state === 'inside') continue;
          const x = lerp(d.px, d.x, alpha);
          const y = lerp(d.py, d.y, alpha);
          if (!inBox({ x, y }, v, 20)) continue;
          const moving = Math.hypot(d.x - d.px, d.y - d.py) > 0.2;
          const fast = Math.hypot(d.x - d.px, d.y - d.py) > 1.6;
          items.push({
            y,
            draw: () =>
              drawDog(ctx, d.def, {
                x,
                y,
                faceX: d.faceX,
                pose: moving ? (fast ? 'run' : 'walk') : d.state === 'guard' ? 'stand' : 'sit',
                phase: d.phase,
                clock: clock * 1.4 + d.phase,
                wag: d.heartT > 0 ? 1 : 0.5,
              }),
          });
        }
        for (const c of h.cats) {
          const x = lerp(c.px, c.x, alpha);
          const y = lerp(c.py, c.y, alpha);
          if (!inBox({ x, y }, v, 30)) continue;
          const moving = Math.hypot(c.x - c.px, c.y - c.py) > 0.2;
          // Cats up high (treehouse platform, the roof) draw at their perch, in front of it.
          const up = c.lift;
          items.push({
            y: up > 0 ? y + 2 : y,
            draw: () =>
              drawKittenFigure(ctx, {
                x,
                y: y - up,
                faceX: c.faceX,
                coat: c.coat,
                pose: moving || (up > 0 && c.state !== 'rest') ? 'walk' : c.personality === 'sleepy' ? 'lie' : 'sit',
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
      ghosts: (ctx) => {
        if (!h.family.moto?.player) drawMe(ctx, true);
      },
      overlay: (ctx, v) => {
        for (const c of h.cats) {
          if (c.emote === 'none' || !inBox(c, v, 20)) continue;
          const lift = (c.personality === 'sleepy' && c.state === 'rest' ? 14 : 26) + c.lift;
          drawEmote(ctx, c.emote, c.x, c.y - lift, Math.min(1, c.emoteT * 4 + 0.3), clock);
        }
        for (const d of h.donkeys) if (d.brayT > 0) this.bubbleText(ctx, d.x + d.faceX * 30, d.y - 78, 'HEE-HAW');
        // A dog barking up the treehouse at the cat that got away.
        for (const d of h.dogs) if (d.state === 'treed' && d.treedT % 0.9 > 0.45) this.bubbleText(ctx, d.x + d.faceX * 12, d.y - 42 * (d.def.size ?? 1), 'WOOF!');
        for (const n of h.npcs) if (n.spookT > 0) this.bubbleText(ctx, n.x, n.y - 64 * FAMILY[n.who].look.scale - 12, 'SNAKE!', C.barnRed);
        // The spray, and the smell that follows Annie around after.
        const sk2 = h.skunk;
        if (sk2 && sk2.cloudT >= 0 && sk2.cloudT < 2.4) drawStinkCloud(ctx, sk2.x - sk2.faceX * 14, sk2.y - 12, sk2.cloudT);
        for (const d of h.dogs) if (d.stinkT > 0 && inBox(d, v, 20)) drawStinkLines(ctx, lerp(d.px, d.x, alpha), lerp(d.py, d.y, alpha) - 30 * (d.def.size ?? 1), clock, Math.min(1, d.stinkT / 4));
        h.pups.forEach((d, i) => {
          if (d.yipT > 0 && d.state !== 'inside') this.bubbleText(ctx, d.x + d.faceX * 8, d.y - 30 - i * 16, 'yip!');
        });
        // Name tags over family members when you're close.
        for (const n of h.gathered ? [] : h.npcs) {
          if (dist(n, p) > 240 || onOuting(h, n.who) || n.spookT > 0) continue;
          const L = FAMILY[n.who];
          this.bubbleText(ctx, n.x, n.y - 64 * L.look.scale - 12, L.name, C.barnRed);
        }
        // Gold star over activities you haven't tried yet.
        if (!m && !h.gathered) {
          for (const a of ACTIVITIES) {
            const st = h.stationPos(a);
            if (!this.untried.has(a.id) || !inBox(st, v, 60) || (a.id === 'race' && !h.raceOpen) || (!a.fixed && onOuting(h, a.who))) continue;
            const who = FAMILY[a.who].look.scale;
            const sx = st.x + 16;
            const sy = st.y - 70 * who - 18 + Math.sin(clock * 3) * 2;
            star(ctx, sx, sy, 8, C.gold);
            ctx.strokeStyle = C.ink;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }
      },
      screen: (ctx, left, top, z) => {
        if (!m && !h.gathered) this.familyMarkers(ctx, left, top, z);
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
        } else if (m?.kind === 'race') {
          const g = RACE_COURSE[m.gate];
          if (g) this.edgeMarker(ctx, left, top, z, g.x, g.y, this.guideRect, (c) => {
            c.fillStyle = C.ink;
            c.font = '900 13px ui-rounded, system-ui, sans-serif';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(String((m.gate % RACE_GATES.length) + 1), 0, 1);
          });
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
          const g = h.stationPos(ACTIVITIES.find((a) => a.id === 'hunt')!);
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

  private faces = new Map<FamilyId, HTMLCanvasElement>();

  /**
   * Little portraits at the screen edge pointing toward family members just out of view, so
   * there's always someone to go and find. Only the nearest two, and only fairly close by.
   */
  private familyMarkers(ctx: Ctx, left: number, top: number, z: number): void {
    const p = this.hub.player;
    const near = this.hub.npcs
      .map((n) => ({ n, d: dist(n, p) }))
      .filter((e) => e.d < MARKER_RANGE)
      .sort((a, b) => a.d - b.d);
    let shown = 0;
    for (const { n, d } of near) {
      if (shown >= 2) break;
      // Even half in view, they're easy enough to spot without an arrow on top of them.
      const sx = (n.x - left) * z;
      const sy = (n.y - top) * z;
      if (sx > -30 && sx < this.vw + 30 && sy > -20 && sy < this.vh + 70) continue;
      const a = ACTIVITIES.find((x) => x.who === n.who);
      ctx.save();
      ctx.globalAlpha = clamp((MARKER_RANGE - d) / 380, 0.4, 0.92);
      const face = this.face(n.who);
      const drawn = this.edgeMarker(
        ctx,
        left,
        top,
        z,
        n.x,
        n.y - 30,
        this.guideRect,
        (c) => {
          c.save();
          c.beginPath();
          c.arc(0, 0, 13, 0, Math.PI * 2);
          c.clip();
          c.drawImage(face, -13, -13, 26, 26);
          c.restore();
        },
        a && this.untried.has(a.id) ? C.gold : '#fff8e9',
      );
      ctx.restore();
      if (drawn) shown++;
    }
  }

  private face(who: FamilyId): HTMLCanvasElement {
    let c = this.faces.get(who);
    if (!c) {
      c = document.createElement('canvas');
      paintPortrait(c, FAMILY[who].look);
      this.faces.set(who, c);
    }
    return c;
  }
}

/** How far away (world units) a family member can be and still get an edge marker. */
const MARKER_RANGE = 1000;

/** What a family member's hands are doing right now: celebrating, waving hello, or their routine. */
function npcGesture(n: Npc, clock: number): { action: PersonAction; actionT?: number; axe?: number; tool?: number } {
  // Arms up: there is a snake.
  if (n.spookT > 0 || n.cheerT > 0) return { action: 'cheer' };
  if (n.waveT > 0) return { action: 'wave' };
  if (n.busyT <= 0 || !n.gesture) return { action: 'none' };
  const k = 1 - n.busyT / n.gestureT;
  switch (n.gesture) {
    case 'toss':
    case 'throw':
      return { action: 'throw', actionT: 1 - k };
    case 'catch':
      return { action: 'point' };
    case 'swing': {
      // Lift the axe up behind the head, then bring it down easy.
      const e = k < 0.55 ? k / 0.55 : 1 - (k - 0.55) / 0.45;
      return { action: 'none', axe: 0.6 + (-2.1 - 0.6) * e * e * (3 - 2 * e) };
    }
    case 'rake':
      return { action: 'none', tool: Math.sin(clock * 5) };
    case 'water':
      // Tip the can, give it a good long pour, tip it back.
      return { action: 'none', tool: k < 0.2 ? k / 0.2 : k > 0.85 ? (1 - k) / 0.15 : 1 };
    case 'putt':
      // Slow back, smooth through, hold the finish.
      return { action: 'none', tool: k < 0.35 ? -k / 0.35 : Math.min(1, -1 + ((k - 0.35) / 0.2) * 2) };
    case 'point':
      return { action: 'point' };
    case 'wave':
      return { action: 'wave' };
    default:
      return { action: 'none' };
  }
}

/** A skunk, side on: black, a white stripe, and a big tail that goes straight up when it matters. */
function drawSkunk(ctx: Ctx, x: number, y: number, faceX: number, phase: number, tailUp: boolean, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale((faceX < 0 ? -1 : 1) * 1.3, 1.3);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 3.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.shadow;
  ctx.fill();
  // Legs, scurrying.
  const sw = Math.sin(phase) * 2;
  ctx.fillStyle = '#1d1b1f';
  for (const lx of [-7 + sw, -3 - sw, 5 + sw, 8 - sw]) ctx.fillRect(lx - 1.2, -5, 2.4, 5);
  // Body and stripe.
  ctx.beginPath();
  ctx.ellipse(0, -8, 11, 6.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1d1b1f';
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#f6f3ea';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(10, -13);
  ctx.quadraticCurveTo(0, -16, -10, -12);
  ctx.stroke();
  // Tail: trailing behind, or straight up.
  ctx.save();
  ctx.translate(-10, -10);
  ctx.rotate(tailUp ? -1.25 : -0.35);
  ctx.beginPath();
  ctx.ellipse(-8, 0, 10, 5.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1d1b1f';
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = '#f6f3ea';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-1, -2);
  ctx.lineTo(-14, -2);
  ctx.stroke();
  ctx.restore();
  // Head.
  ctx.beginPath();
  ctx.ellipse(12, -8, 5, 4, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = '#1d1b1f';
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = '#f6f3ea';
  ctx.fillRect(11, -12, 4, 1.4);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(13.5, -9, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The spray: a yellow-green cloud that billows and fades. */
function drawStinkCloud(ctx: Ctx, x: number, y: number, t: number): void {
  const k = t / 2.4;
  ctx.save();
  ctx.globalAlpha = 0.55 * (1 - k);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05;
    const r = 8 + k * 26 + (i % 3) * 3;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * k * 20, y + Math.sin(a) * k * 10 - k * 10, r, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? '#c9d36a' : '#a9c25a';
    ctx.fill();
  }
  ctx.restore();
}

/** Wavy green lines rising off a dog who lost an argument with a skunk. */
function drawStinkLines(ctx: Ctx, x: number, y: number, clock: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = 0.8 * alpha;
  ctx.strokeStyle = '#8fa83e';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const rise = (clock * 0.8 + i * 0.33) % 1;
    ctx.beginPath();
    for (let s = 0; s <= 6; s++) {
      const py = y - s * 3 - rise * 8;
      const px = x + i * 8 + Math.sin(s * 1.2 + clock * 4 + i) * 2.2;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** A little garter snake, wiggling along (dx, dy), flicking its tongue. */
function drawSnake(ctx: Ctx, x: number, y: number, dx: number, dy: number, phase: number, clock: number): void {
  const nx = -dy;
  const ny = dx;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= 8; i++) {
    const back = i * 3.4;
    const wig = Math.sin(phase - i * 0.9) * (2 + i * 0.35);
    pts.push({ x: x - dx * back + nx * wig, y: y - dy * back * 0.6 + ny * wig * 0.6 });
  }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
  };
  path();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 5.6;
  ctx.stroke();
  path();
  ctx.strokeStyle = '#4f7d36';
  ctx.lineWidth = 3.6;
  ctx.stroke();
  path();
  ctx.strokeStyle = '#e8d36a';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Head and tongue.
  ctx.beginPath();
  ctx.ellipse(x + dx * 2, y + dy * 1.2, 3.4, 2.6, Math.atan2(dy * 0.6, dx), 0, Math.PI * 2);
  ctx.fillStyle = '#4f7d36';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  if (Math.sin(clock * 9) > 0.3) {
    ctx.strokeStyle = '#d9434f';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x + dx * 5, y + dy * 3);
    ctx.lineTo(x + dx * 9, y + dy * 5.4);
    ctx.stroke();
  }
  ctx.restore();
}

/** Two posts and a checkered banner: the scooter race start and finish. */
function drawStartLine(ctx: Ctx, x: number, y: number, clock: number): void {
  const half = 46;
  ctx.save();
  ctx.translate(x, y);
  // Checkered line on the grass.
  for (let i = -6; i < 6; i++)
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? 'rgba(255,255,255,0.85)' : 'rgba(43,42,48,0.75)';
      ctx.fillRect(i * 7.6, -4 + j * 4, 7.6, 4);
    }
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.6;
  for (const s of [-1, 1]) {
    ctx.fillStyle = C.wood;
    ctx.fillRect(s * half - 2, -54, 4, 54);
    ctx.strokeRect(s * half - 2, -54, 4, 54);
  }
  // The banner, flapping a little.
  const sag = Math.sin(clock * 2.4) * 1.5;
  ctx.beginPath();
  ctx.moveTo(-half, -54);
  ctx.quadraticCurveTo(0, -48 + sag, half, -54);
  ctx.lineTo(half, -42);
  ctx.quadraticCurveTo(0, -36 + sag, -half, -42);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  for (let i = -8; i < 8; i++)
    for (let j = 0; j < 3; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#fffaf0' : '#2b2a30';
      ctx.fillRect(i * 6, -56 + j * 6 + sag * 0.5, 6, 6);
    }
  ctx.restore();
  ctx.stroke();
  ctx.restore();
}

/** Little flags either side of the next race gate, with its number. */
function drawGateFlags(ctx: Ctx, x: number, y: number, gate: number, clock: number): void {
  ctx.save();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.4;
  for (const s of [-1, 1]) {
    const fx = x + s * (RACE_GATE_R - 6);
    ctx.beginPath();
    ctx.moveTo(fx, y);
    ctx.lineTo(fx, y - 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fx, y - 30);
    ctx.lineTo(fx + 12, y - 26 + Math.sin(clock * 4 + s) * 1.5);
    ctx.lineTo(fx, y - 21);
    ctx.closePath();
    ctx.fillStyle = C.gold;
    ctx.fill();
    ctx.stroke();
  }
  ctx.font = '900 13px ui-rounded, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#fff8e9';
  const label = String((gate % RACE_GATES.length) + 1);
  ctx.strokeText(label, x, y - 18);
  ctx.fillStyle = C.ink;
  ctx.fillText(label, x, y - 18);
  ctx.restore();
}

/** Football (spiral), baseball or soccer ball, with its shadow on the grass. */
function drawSportBall(ctx: Ctx, x: number, y: number, lift: number, sport: Sport, clock: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, sport === 'soccer' ? 5 : 4, 1.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.shadow;
  ctx.fill();
  const by = y - lift - (sport === 'soccer' ? 4.5 : 0);
  ctx.save();
  ctx.translate(x, by);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.1;
  if (sport === 'football') {
    ctx.rotate(-0.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.4, 3.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#8a4b2a';
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#fffaf0';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(2, 0);
    for (const lx of [-1, 0, 1]) {
      ctx.moveTo(lx, -0.9);
      ctx.lineTo(lx, 0.9);
    }
    ctx.stroke();
  } else if (sport === 'baseball') {
    ctx.beginPath();
    ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
    ctx.fillStyle = '#fffaf0';
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#d9434f';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(-2.6, 0, 2, -0.9, 0.9);
    ctx.arc(2.6, 0, 2, Math.PI - 0.9, Math.PI + 0.9);
    ctx.stroke();
  } else {
    ctx.rotate(clock * 6);
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fffaf0';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(0, 0, 1.4, 0, Math.PI * 2);
    ctx.arc(2.9, 1.6, 0.9, 0, Math.PI * 2);
    ctx.arc(-2.9, 1.6, 0.9, 0, Math.PI * 2);
    ctx.arc(0, -3.2, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Out on the motorcycle or racing: no ring, star or name tag following them about. */
function onOuting(h: Homestead, who: string): boolean {
  const n = h.npcs.find((x) => x.who === who);
  if (!n) return false;
  if (n.outing === 'race') return true;
  return n.outing === 'moto' && !!h.family.moto && h.family.moto.phase !== 'gather';
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
