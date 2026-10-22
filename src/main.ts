import './core/polyfill';
import './style.css';
import { Sfx } from './audio/sfx';
import { Game } from './game/game';
import { PERSONALITIES } from './game/kittenTypes';
import { LEVEL_ONE } from './game/levels';
import { formatTime } from './game/scoring';
import { emptyInput, type GameEvent } from './game/types';
import { drawKittenFigure, drawRider } from './render/characters';
import { Renderer } from './render/renderer';
import { Hints } from './ui/hints';
import { Controls } from './ui/input';

const STEP = 1 / 60;
type Mode = 'title' | 'playing' | 'paused' | 'results';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode: fine, just don't remember */
    }
  },
};

// --- Bootstrap ---------------------------------------------------------------------------
const canvas = $<HTMLCanvasElement>('game');
const game = new Game(LEVEL_ONE);
const renderer = new Renderer(canvas, game);
const sfx = new Sfx();
const hints = new Hints();
const controls = new Controls($('touch'), $('stick-base'), $('stick-knob'), $('whistle-btn'), $('treat-btn'));
const input = emptyInput();

let mode: Mode = 'title';
let overlay: 'herd' | null = null;
let acc = 0;
let last = performance.now();
let whistled = false;
let treated = false;
let toastTimer = 0;
let soundOn = store.get('kc.sound') !== 'off';
sfx.setMuted(!soundOn);

const hud = {
  root: $('hud'),
  actions: $('actions'),
  count: $('count'),
  required: $('required'),
  pips: $('pips'),
  time: $('time'),
  score: $('score'),
  objective: document.querySelector('.objective') as HTMLElement,
  treatCount: $('treat-count'),
  treatBtn: $('treat-btn'),
  whistleCd: $('whistle-cd'),
  toast: $('toast'),
  hint: $('hint'),
};
const last_ = { count: -1, time: '', score: -1, treats: -1, cd: -1, hint: '' };

hud.required.textContent = `/${LEVEL_ONE.required}`;
hud.pips.innerHTML = Array.from({ length: LEVEL_ONE.required }, () => '<i></i>').join('');

// --- Layout ------------------------------------------------------------------------------
function resize(): void {
  const vv = window.visualViewport;
  const w = Math.round(vv?.width ?? window.innerWidth);
  const h = Math.round(vv?.height ?? window.innerHeight);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  renderer.resize(w, h, window.devicePixelRatio || 1);
  const hudBox = hud.root.getBoundingClientRect();
  const playing = mode === 'playing';
  renderer.insets = { top: playing ? hudBox.bottom : 0, bottom: 0 };
  // Off-screen guides avoid the HUD and the action buttons (below them in portrait, beside them in landscape).
  const act = hud.actions.getBoundingClientRect();
  const landscape = w > h;
  renderer.guideRect = {
    left: 0,
    top: playing ? hudBox.bottom : 0,
    right: playing && landscape && act.width ? act.left : w,
    bottom: playing && !landscape && act.height ? act.top - 6 : h,
  };
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
window.visualViewport?.addEventListener('resize', resize);
resize();

// --- No page scrolling, zooming or callouts during play ----------------------------------
document.addEventListener(
  'touchmove',
  (e) => {
    const t = e.target as HTMLElement | null;
    if (t && t.closest('.scrollable')) return;
    e.preventDefault();
  },
  { passive: false },
);
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());

// --- Screens ------------------------------------------------------------------------------
const screens = { title: $('title'), pause: $('pause'), results: $('results'), herd: $('herd') };

function show(el: HTMLElement, on: boolean): void {
  el.hidden = !on;
}

function setMode(m: Mode): void {
  mode = m;
  show(screens.title, m === 'title');
  show(screens.pause, m === 'paused');
  show(screens.results, m === 'results');
  show(hud.root, m === 'playing' || m === 'paused');
  show(hud.actions, m === 'playing');
  controls.enabled = m === 'playing';
  if (m !== 'playing') {
    controls.reset();
    hud.hint.classList.remove('show');
  }
  resize();
}

function startGame(): void {
  game.reset();
  renderer.snap();
  hints.reset();
  whistled = false;
  treated = false;
  controls.moved = false;
  acc = 0;
  for (const k of Object.keys(last_) as (keyof typeof last_)[]) (last_ as Record<string, unknown>)[k] = k === 'time' || k === 'hint' ? '' : -1;
  setMode('playing');
  sfx.unlock();
  sfx.startMusic();
}

function pause(): void {
  if (mode !== 'playing') return;
  $('pause-sub').textContent = `${game.pennedCount} of ${LEVEL_ONE.required} kittens corralled · ${formatTime(game.elapsed)}`;
  setMode('paused');
  sfx.stopMusic();
}

function resume(): void {
  if (mode !== 'paused') return;
  last = performance.now();
  acc = 0;
  setMode('playing');
  sfx.resume();
  sfx.startMusic();
}

function toTitle(): void {
  sfx.stopMusic();
  game.reset();
  setMode('title');
  refreshBest();
}

function refreshBest(): void {
  const best = Number(store.get('kc.best') ?? 0);
  $('best').textContent = best > 0 ? `Best: ${best}` : '';
}

function openHerd(): void {
  overlay = 'herd';
  buildRoster();
  show(screens.herd, true);
}

function closeHerd(): void {
  overlay = null;
  show(screens.herd, false);
}

function buildRoster(): void {
  const ul = $('roster');
  ul.innerHTML = '';
  for (const k of game.kittens) {
    const li = document.createElement('li');
    if (k.penned) li.classList.add('penned');
    const c = document.createElement('canvas');
    c.width = 112;
    c.height = 88;
    const ctx = c.getContext('2d')!;
    ctx.scale(2.6, 2.6);
    drawKittenFigure(ctx, { x: 21, y: 29, faceX: 1, coat: k.coat, pose: 'sit', phase: 0, speed: 0, alarm: 0, happy: k.penned, clock: 1 });
    const t = PERSONALITIES[k.personality];
    const info = document.createElement('div');
    info.innerHTML = `<b>${k.name}</b><span class="trait">${t.label}</span>${k.penned ? ' <span class="trait" style="background:#c48e1c">Penned</span>' : ''}<p>${t.blurb}</p>`;
    li.append(c, info);
    ul.append(li);
  }
}

function showResults(): void {
  const r = game.result;
  if (!r) return;
  const prevBest = Number(store.get('kc.best') ?? 0);
  const isBest = r.total > prevBest;
  if (isBest) store.set('kc.best', String(r.total));
  $('results-sub').textContent = `${game.pennedCount} kittens corralled in ${formatTime(game.elapsed)}. They look very smug about it.`;
  const starSvg = (on: boolean) =>
    `<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="${on ? '#f2c53d' : '#e8dcc4'}" stroke="#3b2a20" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  $('stars').innerHTML = [1, 2, 3].map((i) => starSvg(i <= r.stars)).join('');
  $('lines').innerHTML = r.lines.map((l) => `<li><span>${l.label}</span><b>${l.value}</b></li>`).join('');
  $('total').textContent = String(r.total);
  $('results-best').textContent = isBest ? 'New best score!' : `Best: ${prevBest}`;
  setMode('results');
  sfx.stopMusic();
}

$('play-btn').addEventListener('click', () => {
  sfx.unlock();
  sfx.click();
  startGame();
});
$('again-btn').addEventListener('click', () => {
  sfx.click();
  startGame();
});
$('pause-btn').addEventListener('click', () => {
  sfx.click();
  pause();
});
$('resume-btn').addEventListener('click', () => {
  sfx.click();
  resume();
});
$('restart-btn').addEventListener('click', () => {
  sfx.click();
  startGame();
});
$('quit-btn').addEventListener('click', () => {
  sfx.click();
  toTitle();
});
$('results-title-btn').addEventListener('click', () => {
  sfx.click();
  toTitle();
});
$('herd-close').addEventListener('click', () => {
  sfx.click();
  closeHerd();
});
document.querySelectorAll<HTMLElement>('[data-open="herd"]').forEach((b) =>
  b.addEventListener('click', () => {
    sfx.click();
    openHerd();
  }),
);
const soundBtn = $('sound-btn');
const syncSound = () => {
  soundBtn.textContent = `Sound: ${soundOn ? 'on' : 'off'}`;
  soundBtn.setAttribute('aria-pressed', String(soundOn));
};
syncSound();
soundBtn.addEventListener('click', () => {
  soundOn = !soundOn;
  sfx.setMuted(!soundOn);
  store.set('kc.sound', soundOn ? 'on' : 'off');
  syncSound();
  sfx.click();
});

controls.onInteract = () => sfx.unlock();
controls.onPause = () => (mode === 'playing' ? pause() : mode === 'paused' ? resume() : undefined);

// Interruptions: calls, app switching, locking the phone.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pause();
    sfx.suspend();
  } else {
    last = performance.now();
  }
});
window.addEventListener('pagehide', () => pause());
window.addEventListener('blur', () => pause());

// --- Game events → audio, HUD, effects -------------------------------------------------------
function toast(html: string, seconds = 3.2): void {
  hud.toast.innerHTML = html;
  hud.toast.classList.add('show');
  toastTimer = seconds;
}

function handleEvent(e: GameEvent): void {
  renderer.handleEvent(e, game.kittens);
  hints.onEvent(e, game);
  switch (e.type) {
    case 'penned': {
      const k = game.kittens.find((kk) => kk.id === e.kittenId);
      sfx.penned();
      setTimeout(() => sfx.meow(1.1), 180);
      hud.objective.classList.remove('bump');
      void hud.objective.offsetWidth;
      hud.objective.classList.add('bump');
      if (game.pennedCount < LEVEL_ONE.required) {
        const left = LEVEL_ONE.required - game.pennedCount;
        toast(`<b>${k?.name ?? 'Kitten'} is in!</b>${left} more to go.`, 2.4);
      }
      break;
    }
    case 'whistle':
      whistled = true;
      sfx.whistle();
      break;
    case 'treatThrown':
      treated = true;
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
      if (e.kind === 'horseshoe') toast(`<b>Golden horseshoe!</b>${game.horseshoes} of 4 found. Lucky!`);
      else toast('<b>Treat bag!</b>+2 treats in your pouch.', 2.4);
      break;
    case 'discover':
      sfx.discover();
      toast(`<b>${e.title}</b>${e.text}`, 4.2);
      break;
    case 'startle':
      if (Math.random() < 0.5) sfx.startle();
      break;
    case 'meow':
      if (Math.hypot(e.x - game.player.x, e.y - game.player.y) < 420 && Math.random() < 0.5) sfx.meow(0.9 + Math.random() * 0.3);
      break;
    case 'butterfly':
      break;
    case 'victory':
      sfx.victory();
      toast('<b>Corral complete!</b>Every kitten accounted for (well, enough of them).', 3);
      break;
  }
}

// --- HUD -----------------------------------------------------------------------------------
function updateHud(dt: number): void {
  const n = game.pennedCount;
  if (n !== last_.count) {
    last_.count = n;
    hud.count.textContent = String(n);
    hud.pips.querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', i < n));
  }
  const t = formatTime(game.elapsed);
  if (t !== last_.time) {
    last_.time = t;
    hud.time.textContent = t;
  }
  if (game.score !== last_.score) {
    last_.score = game.score;
    hud.score.textContent = String(game.score);
  }
  if (game.treatsLeft !== last_.treats) {
    last_.treats = game.treatsLeft;
    hud.treatCount.textContent = String(game.treatsLeft);
    hud.treatBtn.classList.toggle('empty', game.treatsLeft === 0);
  }
  const cd = Math.round((game.player.whistleCooldown / 1.1) * 100);
  if (cd !== last_.cd) {
    last_.cd = cd;
    hud.whistleCd.style.setProperty('--cd', `${cd}%`);
  }
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) hud.toast.classList.remove('show');
  }
  const h = game.phase === 'playing' ? hints.update(dt, game, { moved: controls.moved, whistled, treated }) : null;
  const html = h ?? '';
  if (html !== last_.hint) {
    last_.hint = html;
    if (html) hud.hint.innerHTML = html;
    hud.hint.classList.toggle('show', !!html);
  }
}

// --- Title hero ------------------------------------------------------------------------------
const hero = $<HTMLCanvasElement>('hero');
const heroCtx = hero.getContext('2d')!;
function drawHero(clock: number): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (hero.width !== 360 * dpr) {
    hero.width = 360 * dpr;
    hero.height = 220 * dpr;
  }
  const ctx = heroCtx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, 360, 220);
  // Sunburst.
  ctx.save();
  ctx.translate(180, 150);
  for (let i = 0; i < 16; i++) {
    ctx.rotate(Math.PI / 8);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-20, -220);
    ctx.lineTo(20, -220);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? 'rgba(242,197,61,0.18)' : 'rgba(240,138,36,0.12)';
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(180, 196, 150, 22, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#9fd067';
  ctx.fill();
  ctx.save();
  ctx.translate(180, 196);
  ctx.scale(1.85, 1.85);
  drawRider(ctx, {
    x: 0,
    y: 0,
    faceX: 1,
    speed01: 0.6,
    walkPhase: clock * 6,
    whistleT: 0,
    throwT: 0,
    cheerT: Math.sin(clock * 0.8) > 0.6 ? 1 : 0,
    idleT: 0,
    mood: 'none',
    clock,
    vertical: 0,
  });
  ctx.restore();
  // Kittens scampering ahead, refusing to cooperate.
  const coats = game.kittens.map((k) => k.coat);
  [0, 3, 4].forEach((ci, i) => {
    const x = 285 + i * 22 + Math.sin(clock * 3 + i) * 6;
    const y = 192 - i * 4;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.6, 1.6);
    drawKittenFigure(ctx, {
      x: 0,
      y: 0,
      faceX: i === 1 ? -1 : 1,
      coat: coats[ci],
      pose: i === 1 ? 'sit' : 'walk',
      phase: clock * 8 + i,
      speed: i === 1 ? 0 : 60,
      alarm: i === 2 ? 1 : 0,
      happy: false,
      clock,
    });
    ctx.restore();
  });
  ctx.save();
  ctx.translate(48, 194);
  ctx.scale(1.6, 1.6);
  drawKittenFigure(ctx, { x: 0, y: 0, faceX: 1, coat: coats[2], pose: 'lie', phase: 0, speed: 0, alarm: 0, happy: false, clock });
  ctx.restore();
}

// --- Main loop -----------------------------------------------------------------------------
let warmed = false;
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (mode === 'playing' && !overlay) {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 6) {
      controls.read(input);
      game.step(input, STEP);
      acc -= STEP;
      steps++;
      for (const e of game.drainEvents()) handleEvent(e);
    }
    if (steps === 6) acc = 0;
    updateHud(dt);
    if (game.phase === 'complete') showResults();
  } else if (mode === 'results') {
    // Let the celebration keep animating behind the results card.
    game.step(emptyInput(), dt);
    game.drainEvents();
  } else {
    game.clock += dt;
  }

  renderer.update(dt, { mode: mode === 'title' ? 'title' : 'play' });
  renderer.render(mode === 'playing' ? acc / STEP : 1, { mode: mode === 'title' ? 'title' : 'play' });
  if (mode === 'title') {
    drawHero(game.clock);
    if (!warmed) warmed = renderer.warm(game.player.x, game.player.y, 2) === 0;
  }
  requestAnimationFrame(frame);
}

refreshBest();
setMode('title');
requestAnimationFrame(frame);

// Test/debug hook: lets automated browser checks inspect state. Harmless for players.
(window as unknown as { __kc: unknown }).__kc = { game, renderer, get mode() { return mode; }, startGame, pause, resume };
