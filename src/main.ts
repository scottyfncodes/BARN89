import './core/polyfill';
import './style.css';
import { KittenScene } from './app/kittenScene';
import { $, formatTime, Hint, show, starRow, starSvg, Toast } from './app/dom';
import { drawHero } from './app/hero';
import { Hud } from './app/hud';
import { paintMap, type MapHit } from './app/mapScreen';
import { MowerScene } from './app/mowerScene';
import type { GameScene, SceneContext, SceneResult } from './app/scene';
import { WoodScene } from './app/woodScene';
import { Sfx } from './audio/sfx';
import {
  ACTIVITIES,
  activity,
  activityStars,
  ALL_CHALLENGES,
  CAT_COUNT,
  challenge as challengeDef,
  HOWTO,
  isUnlocked,
  MAX_STARS,
  ORNAMENT_COUNT,
  REWARDS,
  rewardUnlocked,
  totalStars,
  unlockedRewards,
  type GameId,
} from './content/activities';
import { FAMILY, FAMILY_ORDER, type FamilyId, type HatKind } from './content/cast';
import { SaveStore } from './core/save';
import { BARN_PLAN_LABEL, BARN_PLAN_SIGN, sundayScript, type Beat } from './content/sunday';
import { PERSONALITIES } from './games/kitten/kittenTypes';
import { LEVELS } from './games/kitten/levels';
import { MOW_LEVELS } from './games/mower/levels';
import { WOOD_ROUNDS } from './games/woodpile/woodpile';
import { Homestead, LONG_TABLE, type HubEvent } from './hub/homestead';
import { HubView } from './hub/hubView';
import { HUNT_ITEMS, LOCKBOX_CODE, ROUNDS_TASKS } from './hub/missions';
import { drawKittenFigure } from './render/characters';
import { paintPortrait } from './render/people';
import type { Decor } from './render/worldView';
import { Controls } from './ui/input';
import { sharedWorld } from './world/shared';

const STEP = 1 / 60;
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// --- Core objects ----------------------------------------------------------------------------
const store = new SaveStore();
const sfx = new Sfx();
sfx.setMuted(!store.data.sound);
const shared = sharedWorld();
const canvas = $<HTMLCanvasElement>('game');
const controls = new Controls($('touch'), $('stick-base'), $('stick-knob'));
const hud = new Hud();
const toast = new Toast($('toast'));
const hint = new Hint($('hint'));

const hub = new Homestead(shared, {
  explorer: store.data.explorer,
  ornaments: store.data.ornaments,
  discoveries: store.data.discoveries,
  huntFound: store.data.hunt.found,
});
const hubView = new HubView(canvas, hub);
hubView.overview = new URLSearchParams(location.search).has('overview');
for (const c of store.data.pets) hubView.petted.add(c);
const ctx: SceneContext = { canvas, controls, sfx, hud, toast, hint, caches: hubView.sharedCaches };

controls.bindButton($('whistle-btn'), 'whistle');
controls.bindButton($('treat-btn'), 'treat');
controls.bindButton($('act-btn'), 'act');
controls.bindButton($('toss-btn'), 'toss');

type Mode = 'title' | 'hub' | 'game';
let mode: Mode = 'title';
let game: GameScene | null = null;
let paused = false;
let resultsUp = false;
/** Screens open over the current mode, top last. */
const stack: string[] = [];
let acc = 0;
let last = performance.now();
let playT = 0;
let lastStation: string | null = null;
let lastAction = '';
let lastMission = '';
let mapHits: MapHit[] = [];
let introActivity: GameId = 'kitten';
let introChallenge = '';
const dial = [0, 0];
const top = (): string | undefined => stack[stack.length - 1];

// --- Cosmetics and decorations ---------------------------------------------------------------
function decor(): Decor {
  const u = unlockedRewards(store.data);
  const c = store.data.cosmetics;
  return {
    evening: c.evening && u.has('evening'),
    fixedBulbs: store.data.hunt.done,
    holiday: c.holiday && u.has('holiday'),
    sign: store.data.barnPlan ? BARN_PLAN_SIGN[store.data.barnPlan] : null,
  };
}

function explorerHat(): HatKind | undefined {
  const h = store.data.cosmetics.hat;
  if (h === 'default') return undefined;
  const r = REWARDS.find((x) => x.hat === h);
  return r && rewardUnlocked(store.data, r) ? h : undefined;
}

function applyLook(): void {
  const u = unlockedRewards(store.data);
  const c = store.data.cosmetics;
  if (c.mower !== 'red' && !u.has(`mower-${c.mower}`)) c.mower = 'red';
  if (c.ride && !u.has('ride-deputy')) c.ride = false;
  hubView.decor = decor();
  hubView.hat = explorerHat();
  hubView.mowerPaint = c.mower;
  hubView.untried = new Set(ACTIVITIES.filter((a) => activityStars(store.data, a.id).got === 0).map((a) => a.id));
}

/** Announce rewards that became available since `before`. */
function announceUnlocks(before: Set<string>): string[] {
  const after = unlockedRewards(store.data);
  const fresh = REWARDS.filter((r) => after.has(r.id) && !before.has(r.id));
  applyLook();
  return fresh.map((r) => r.name);
}

// --- Layout ------------------------------------------------------------------------------------
function insetTop(): number {
  const el = mode === 'game' ? hud.root : $('hub-hud');
  if (el.hidden) return 0;
  return el.getBoundingClientRect().bottom;
}

function resize(): void {
  const vv = window.visualViewport;
  const w = Math.round(vv?.width ?? window.innerWidth);
  const h = Math.round(vv?.height ?? window.innerHeight);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const dpr = window.devicePixelRatio || 1;
  const inset = insetTop();
  if (mode === 'game' && game) game.resize(w, h, dpr, inset);
  else {
    hubView.resize(w, h, dpr);
    const missionBottom = $('mission').hidden ? inset : $('mission').getBoundingClientRect().bottom;
    const dialog = top() === 'sunday' ? document.querySelector('#sunday .dialog')!.getBoundingClientRect().height + 16 : 0;
    hubView.insets = { top: mode === 'hub' ? missionBottom : 0, bottom: dialog || ($('prompt').hidden ? 0 : $('prompt').getBoundingClientRect().height) };
    hubView.guideRect = { left: 0, top: missionBottom + 6, right: w, bottom: h };
  }
  if (top() === 'map') openMap();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
window.visualViewport?.addEventListener('resize', resize);

// --- No page scrolling, zooming or callouts during play --------------------------------------
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

// --- Screens ---------------------------------------------------------------------------------
const SCREENS = ['title', 'who', 'intro', 'pause', 'results', 'board', 'rewards', 'map', 'menu', 'herd', 'lockbox', 'notice', 'sunday'];

function syncScreens(): void {
  document.body.dataset.scene = mode === 'game' && game instanceof WoodScene ? 'woodpile' : mode;
  const topId = top() ?? null;
  const covered = !!topId;
  for (const id of SCREENS) show($(id), id === topId || (id === 'title' && mode === 'title' && !covered));
  const inHub = mode === 'hub';
  show($('hub-hud'), inHub && !covered);
  show($('hud'), mode === 'game' && !resultsUp);
  const m = hub.mission;
  show($('mission'), inHub && !!m && !covered);
  show($('prompt'), inHub && !covered && !!hub.nearStation && !m);
  show($('act-btn'), inHub && !covered && !!hub.action);
  controls.enabled = !covered && (mode === 'hub' || (mode === 'game' && !paused && !(game instanceof WoodScene)));
  if (covered || mode !== 'game' || paused) {
    hint.set(null);
    if (mode === 'game') controls.reset();
  }
  if (covered && mode === 'hub') controls.reset();
  if (mode === 'game' && game instanceof WoodScene) controls.tapMode = !covered && !paused && !resultsUp;
  resize();
}

function open(id: string): void {
  if (top() === id) return;
  stack.push(id);
  if (id === 'board') buildBoard();
  else if (id === 'rewards') buildRewards();
  else if (id === 'who') buildWho();
  else if (id === 'herd') buildRoster();
  else if (id === 'menu') $('menu-sub').textContent = `${totalStars(store.data)} of ${MAX_STARS} stars · ${store.data.ornaments.length} of ${ORNAMENT_COUNT} ornaments`;
  syncScreens();
}

function close(): void {
  stack.pop();
  if (top() === 'board') buildBoard();
  syncScreens();
  last = performance.now();
}

function closeAll(): void {
  stack.length = 0;
  syncScreens();
}

document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('[data-open],[data-close]') as HTMLElement | null;
  if (!t) return;
  sfx.unlock();
  sfx.click();
  if (t.dataset.open) open(t.dataset.open);
  else close();
});

function notice(title: string, text: string, ok = 'OK', onOk?: () => void, cancel?: string): void {
  $('notice-title').textContent = title;
  $('notice-text').innerHTML = text;
  $('notice-ok').textContent = ok;
  show($('notice-cancel'), !!cancel);
  if (cancel) $('notice-cancel').textContent = cancel;
  noticeOk = onOk ?? null;
  open('notice');
}
let noticeOk: (() => void) | null = null;
$('notice-ok').addEventListener('click', () => {
  sfx.click();
  const f = noticeOk;
  noticeOk = null;
  close();
  f?.();
});
$('notice-cancel').addEventListener('click', () => {
  sfx.click();
  noticeOk = null;
  close();
});

// --- Sound -----------------------------------------------------------------------------------
function syncSound(): void {
  for (const id of ['sound-btn', 'menu-sound', 'title-sound']) {
    const b = $(id);
    b.textContent = `Sound: ${store.data.sound ? 'on' : 'off'}`;
    b.setAttribute('aria-pressed', String(store.data.sound));
  }
}
for (const id of ['sound-btn', 'menu-sound', 'title-sound']) {
  $(id).addEventListener('click', () => {
    store.data.sound = !store.data.sound;
    store.save();
    sfx.unlock();
    sfx.setMuted(!store.data.sound);
    syncSound();
    sfx.click();
  });
}

// --- Title -----------------------------------------------------------------------------------
function refreshTitle(): void {
  const who = FAMILY[store.data.explorer];
  $('who-name').textContent = who.name;
  paintPortrait($<HTMLCanvasElement>('who-face'), who.look, { hat: explorerHat() });
  const stars = totalStars(store.data);
  $('title-best').textContent = stars ? `${stars} of ${MAX_STARS} stars` : '';
  show($('storage-note'), !store.persistent);
}

$('play-btn').addEventListener('click', () => {
  sfx.unlock();
  sfx.click();
  enterHub();
});
$('who-btn').addEventListener('click', () => {
  sfx.unlock();
  sfx.click();
  open('who');
});

function buildWho(): void {
  const ul = $('who-list');
  ul.innerHTML = '';
  for (const id of FAMILY_ORDER) {
    const m = FAMILY[id];
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'who-item' + (store.data.explorer === id ? ' on' : '');
    b.setAttribute('aria-pressed', String(store.data.explorer === id));
    const c = document.createElement('canvas');
    b.append(c);
    const t = document.createElement('span');
    t.innerHTML = `<b>${m.name}</b><small>${m.role}</small>`;
    b.append(t);
    b.addEventListener('click', () => {
      sfx.click();
      setExplorer(id);
      buildWho();
    });
    li.append(b);
    ul.append(li);
    requestAnimationFrame(() => paintPortrait(c, m.look));
  }
}

function setExplorer(id: FamilyId): void {
  store.data.explorer = id;
  store.save();
  hub.setExplorer(id);
  refreshTitle();
}
$('who-done').addEventListener('click', () => {
  sfx.click();
  close();
});

// --- Homestead -------------------------------------------------------------------------------
function enterHub(): void {
  mode = 'hub';
  stack.length = 0;
  applyLook();
  hubView.snap();
  sfx.startMusic();
  playT = 0;
  syncScreens();
  if (!store.data.seen.includes('welcome')) {
    store.addTo('seen', 'welcome');
    toast.show('<b>Welcome to Barn 89!</b>Walk up to anyone in a glowing ring to play with them.', 5);
  }
}

function toTitle(): void {
  game?.exit();
  game = null;
  mode = 'title';
  paused = false;
  resultsUp = false;
  hub.endMission();
  stack.length = 0;
  sfx.stopMusic();
  sfx.setEngine(-1);
  toast.clear();
  refreshTitle();
  syncScreens();
}
$('menu-title').addEventListener('click', () => {
  sfx.click();
  toTitle();
});
$('erase-btn').addEventListener('click', () => {
  sfx.click();
  notice(
    'Erase progress?',
    'This clears stars, rewards and secrets saved in this browser. It does not affect anyone else\'s phone.',
    'Erase',
    () => {
      store.reset();
      location.reload();
    },
    'Keep my progress',
  );
});

function onHubEvent(e: HubEvent): void {
  hubView.handleEvent(e);
  switch (e.type) {
    case 'ornament': {
      sfx.collect();
      store.addTo('ornaments', e.id);
      if (e.count >= ORNAMENT_COUNT) toast.show("<b>Every ornament found!</b>Grandpa's porch tree is complete. Go take a look.", 5);
      else toast.show(`<b>Christmas ornament!</b>${e.count} of ${ORNAMENT_COUNT}. It's on Grandpa's porch tree now.`, 3.6);
      break;
    }
    case 'discover':
      sfx.discover();
      store.addTo('discoveries', e.id);
      toast.show(`<b>${e.title}</b>${e.text}`, 4.2);
      break;
    case 'throw':
      sfx.whistle();
      break;
    case 'fetched':
      sfx.bark();
      store.data.fetches++;
      store.save();
      if (store.data.fetches === 1 || store.data.fetches % 5 === 0) toast.show(`<b>Good dog, ${e.dog}!</b>Fetches so far: ${store.data.fetches}.`, 2.6);
      break;
    case 'bark':
      if (Math.random() < 0.6) sfx.bark();
      break;
    case 'carrot':
      if (e.ok) {
        sfx.crunch();
        store.data.carrots++;
        store.save();
        toast.show(`<b>${e.donkey} takes the carrot.</b>Very politely, for a donkey.`, 2.4);
      } else {
        sfx.denied();
        toast.show(`<b>${e.donkey} considers your offer...</b>and declines. Donkeys.`, 2.4);
      }
      break;
    case 'bray':
      sfx.bray();
      break;
    case 'pet': {
      sfx.meow(1 + Math.random() * 0.2);
      const before = unlockedRewards(store.data);
      const first = store.addTo('pets', e.cat);
      toast.show(`<b>${e.name}</b>${e.text}${first ? ` <span class="tag">${store.data.pets.length}/${CAT_COUNT} cats met</span>` : ''}`, 3.2);
      const fresh = announceUnlocks(before);
      if (fresh.length) setTimeout(() => toast.show(`<b>Unlocked: ${fresh.join(', ')}</b>Find it under Rewards.`, 4), 3300);
      break;
    }
    case 'task':
      sfx.penned();
      toast.show(`<b>${ROUNDS_TASKS.find((t) => t.id === e.id)?.label}</b>${e.text}`, 2.4);
      break;
    case 'roundsDone': {
      sfx.victory();
      const m = hub.mission;
      const seconds = m?.kind === 'rounds' ? m.t : e.seconds;
      showResults('rounds-1', {
        stars: e.stars,
        score: Math.max(0, Math.round(2000 - seconds * 10)),
        title: 'Rounds done!',
        sub: `All six chores in ${formatTime(seconds)}. Megan says thanks.`,
        lines: ROUNDS_TASKS.map((t) => ({ label: t.label, value: 'done' })),
        finished: true,
      });
      break;
    }
    case 'huntItem':
      sfx.collect();
      store.data.hunt.found = [...hub.huntFound];
      store.save();
      toast.show(`<b>${HUNT_ITEMS.find((h) => h.id === e.id)?.name}</b>${e.text}`, 3.6);
      break;
    case 'sunday':
      openSunday();
      break;
    case 'huntReady':
      sfx.discover();
      setTimeout(() => toast.show("<b>That's everything!</b>Take it all back to Grandpa.", 4), 3700);
      break;
  }
}

function updatePrompt(): void {
  const a = hub.nearStation;
  const id = a?.id ?? null;
  if (id !== lastStation) {
    lastStation = id;
    if (a) {
      const who = FAMILY[a.who];
      $('prompt-who').textContent = a.title;
      $('prompt-line').textContent = hub.explorer === a.who ? `${who.name}, this one is yours. Ready?` : `${who.name}: "${a.line}"`;
      const st = activityStars(store.data, a.id);
      $('prompt-stars').innerHTML = `${starSvg(st.got > 0, 14)} ${st.got}/${st.max}`;
      requestAnimationFrame(() => paintPortrait($<HTMLCanvasElement>('prompt-face'), who.look, { wave: true }));
      if (!stack.length) sfx.tick();
    }
    syncScreens();
  }
  const act = hub.action?.label ?? '';
  if (act !== lastAction) {
    lastAction = act;
    $('act-label').textContent = act;
    syncScreens();
  }
}

$('prompt-go').addEventListener('click', () => {
  sfx.unlock();
  sfx.click();
  if (hub.nearStation) openIntro(hub.nearStation.id);
});

function updateMissionHud(): void {
  const m = hub.mission;
  let key = '';
  if (m?.kind === 'rounds') {
    key = `r${m.done.size}`;
    $('mission-time').textContent = formatTime(m.t);
  } else if (m?.kind === 'hunt') key = `h${m.step}${m.ready}${m.hints}`;
  if (key === lastMission) return;
  lastMission = key;
  if (!m) {
    syncScreens();
    return;
  }
  if (m.kind === 'rounds') {
    $('mission-title').textContent = "Megan's Morning Rounds";
    $('mission-body').innerHTML = `<ol class="chores">${ROUNDS_TASKS.map((t, i) => `<li class="${m.done.has(t.id) ? 'done' : t.needs && !m.done.has(t.needs) ? 'wait' : ''}"><span>${i + 1}</span>${t.short}</li>`).join('')}</ol>`;
    show($('mission-hint'), false);
  } else {
    $('mission-title').textContent = "Grandpa's Treasure Hunt";
    $('mission-time').textContent = `${Math.min(m.step, HUNT_ITEMS.length)}/${HUNT_ITEMS.length}`;
    $('mission-body').innerHTML = m.ready
      ? '<p class="clue">You found everything! Take it all back to Grandpa and open his lockbox.</p>'
      : `<p class="clue">"${HUNT_ITEMS[m.step].clue}"</p>`;
    show($('mission-hint'), !m.ready);
    $('mission-hint').textContent = m.hints ? `Hint (${m.hints} used)` : 'Hint';
  }
  syncScreens();
}

$('mission-hint').addEventListener('click', () => {
  sfx.click();
  hub.useHint();
  lastMission = '';
  toast.show('<b>Follow the arrow.</b>Hints cost a star at the end.', 2.4);
});
$('mission-quit').addEventListener('click', () => {
  sfx.click();
  const m = hub.mission;
  notice(
    m?.kind === 'hunt' ? 'Stop the hunt?' : 'Stop the rounds?',
    m?.kind === 'hunt' ? 'Things you found stay found. Talk to Grandpa to pick it back up.' : "The chores will wait. You can start again from Megan or the board.",
    'Stop',
    () => {
      hub.endMission();
      lastMission = '';
      syncScreens();
    },
    'Keep going',
  );
});

function hubFrame(dt: number): void {
  const top = stack.length > 0;
  if (!top) {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 6) {
      const s = controls.stick();
      hub.step({ moveX: s.x, moveY: s.y, whistle: false, treat: false }, STEP, controls.consume('act'));
      for (const e of hub.drainEvents()) onHubEvent(e);
      acc -= STEP;
      steps++;
    }
    if (steps === 6) acc = 0;
    playT += dt;
    updatePrompt();
    updateMissionHud();
    // Back at Grandpa's with everything: open the lockbox.
    const m = hub.mission;
    if (m?.kind === 'hunt' && m.ready && Math.hypot(hub.player.x - activity('hunt').station.x, hub.player.y - activity('hunt').station.y) < 110 && !stack.length) {
      dial[0] = 0;
      dial[1] = 0;
      syncDials();
      $('lock-line').textContent = '"Two numbers. It\'s painted on the big red barn, plain as day."';
      open('lockbox');
    }
    // Coaching for first-timers.
    if (hub.nearStation || stack.length) hint.set(null);
    else if (!hub.mission && playT < 14 && !controls.moved) hint.set('<em>Drag anywhere</em> to walk around the homestead.');
    else if (!hub.mission && playT > 4 && playT < 18 && !hub.nearStation && totalStars(store.data) === 0) hint.set('Look for the <em>glowing rings</em>. Each family member has a game.');
    else hint.set(null);
  }
  hubView.update(top ? 0 : dt, 'play');
  hubView.render(top ? 1 : acc / STEP);
  $('hub-stars-n').textContent = String(totalStars(store.data));
  $('hub-orn-n').textContent = `${store.data.ornaments.length}/${ORNAMENT_COUNT}`;
}

// --- Sunday at the Barn ----------------------------------------------------------------------
// Optional, unrewarded, and always available: sit down whenever you like.
let sundayBeats: Beat[] = [];
let sundayAt = 0;

function openSunday(): void {
  sundayBeats = sundayScript();
  sundayAt = 0;
  hub.gather(true);
  sfx.discover();
  showSundayBeat();
  open('sunday');
  frameTable();
}

/** Keep the table in view above the dialogue card. */
function frameTable(): void {
  hubView.snapTo(LONG_TABLE.x, LONG_TABLE.y);
  hubView.cam.y += hubView.insets.bottom / 2 / hubView.cam.zoom;
  hubView.clampCam();
}

function closeSunday(): void {
  store.data.sundays++;
  store.save();
  hub.gather(false);
  close();
  hubView.snap();
  if (store.data.barnPlan) toast.show(`<b>Barn 89, next chapter</b>${BARN_PLAN_LABEL[store.data.barnPlan]}. Check the old sign out by the road.`, 4);
}

function showSundayBeat(): void {
  const beat = sundayBeats[sundayAt];
  const face = $<HTMLCanvasElement>('sunday-face');
  const who = 'line' in beat ? beat.line.who : beat.choice.who;
  const text = 'line' in beat ? beat.line.text : beat.choice.prompt;
  show(face, who !== 'narrator');
  $('sunday-who').textContent = who === 'narrator' ? '' : FAMILY[who].name;
  const p = $('sunday-text');
  p.textContent = text;
  p.classList.toggle('narration', who === 'narrator');
  if (who !== 'narrator') requestAnimationFrame(() => paintPortrait(face, FAMILY[who].look));
  const choices = $('sunday-choices');
  choices.innerHTML = '';
  show($('sunday-next'), 'line' in beat);
  $('sunday-next').textContent = sundayAt === sundayBeats.length - 1 ? 'Back to it' : 'Next';
  if ('choice' in beat) {
    for (const opt of beat.choice.options) {
      const b = document.createElement('button');
      b.textContent = opt.label;
      b.addEventListener('click', () => {
        sfx.click();
        if (opt.plan) {
          store.data.barnPlan = opt.plan;
          store.save();
          applyLook();
        }
        sundayBeats.splice(sundayAt + 1, 0, ...opt.reply.map((line) => ({ line })));
        sundayAt++;
        showSundayBeat();
      });
      choices.append(b);
    }
  }
  if (top() === 'sunday') {
    resize();
    frameTable();
  }
}

$('sunday-next').addEventListener('click', () => {
  sfx.click();
  if (sundayAt >= sundayBeats.length - 1) closeSunday();
  else {
    sundayAt++;
    showSundayBeat();
  }
});
$('sunday-leave').addEventListener('click', () => {
  sfx.click();
  closeSunday();
});

// --- Lockbox ---------------------------------------------------------------------------------
function syncDials(): void {
  $('dial-0').textContent = String(dial[0]);
  $('dial-1').textContent = String(dial[1]);
}
document.querySelectorAll<HTMLElement>('.dial-btn').forEach((b) =>
  b.addEventListener('click', () => {
    const i = Number(b.dataset.dial);
    dial[i] = (dial[i] + Number(b.dataset.d) + 10) % 10;
    sfx.tick();
    syncDials();
  }),
);
$('lock-close').addEventListener('click', () => {
  sfx.click();
  close();
  // Step away so the lockbox doesn't pop straight back up.
  hub.teleport(activity('hunt').station.x, activity('hunt').station.y + 150);
});
$('lock-open').addEventListener('click', () => {
  if (dial[0] !== LOCKBOX_CODE[0] || dial[1] !== LOCKBOX_CODE[1]) {
    sfx.denied();
    const lines = ['"Not quite. Go have a look at the barn, kiddo."', '"Nope. Big red barn. Big white letters."', '"Close! Well, no. But keep trying."'];
    $('lock-line').textContent = lines[Math.floor(Math.random() * lines.length)];
    return;
  }
  sfx.victory();
  const m = hub.mission;
  const hints = m?.kind === 'hunt' ? m.hints : 0;
  const stars = hints === 0 ? 3 : hints <= 2 ? 2 : 1;
  const before = unlockedRewards(store.data);
  store.data.hunt.done = true;
  store.data.hunt.found = [];
  hub.huntFound.clear();
  hub.endMission();
  store.save();
  stack.length = 0;
  showResults(
    'hunt-1',
    {
      stars,
      score: 1000 - hints * 150,
      title: 'Lockbox open!',
      sub: 'Inside, wrapped in a handkerchief: a box of new bulbs and a note. "For the string lights at Barn 89. Every one of them should shine." Grandpa winks.',
      lines: [
        { label: 'Lost things found', value: '5 of 5' },
        { label: 'Hints used', value: String(hints) },
      ],
      finished: true,
    },
    before,
  );
});

// --- Activity board, rewards, map -----------------------------------------------------------
function buildBoard(): void {
  const s = store.data;
  $('board-sub').textContent = `${totalStars(s)} of ${MAX_STARS} stars earned. Stars unlock rewards.`;
  const ul = $('board-list');
  ul.innerHTML = '';
  for (const a of ACTIVITIES) {
    const who = FAMILY[a.who];
    const li = document.createElement('li');
    const c = document.createElement('canvas');
    c.className = 'face';
    const st = activityStars(s, a.id);
    const best = Math.max(0, ...a.challenges.map((ch) => s.best[ch.id] ?? 0));
    const info = document.createElement('div');
    info.className = 'board-info';
    info.innerHTML = `<b>${a.title}</b><small>with ${who.name}</small><span class="chals">${a.challenges
      .map((ch) => `<span class="chal ${isUnlocked(s, ch.id) ? '' : 'locked'}" title="${ch.name}">${isUnlocked(s, ch.id) ? starRow(s.stars[ch.id] ?? 0, 3, 13) : 'Locked'}</span>`)
      .join('')}</span>${best ? `<small>Best score ${best}</small>` : ''}`;
    const b = document.createElement('button');
    b.className = 'go-btn';
    b.textContent = st.got ? 'Play' : 'Try it';
    b.addEventListener('click', () => {
      sfx.click();
      openIntro(a.id);
    });
    li.append(c, info, b);
    ul.append(li);
    requestAnimationFrame(() => paintPortrait(c, who.look));
  }
  const sec = $('secrets');
  sec.innerHTML = [
    `<li><b>${s.ornaments.length}/${ORNAMENT_COUNT}</b> Christmas ornaments found</li>`,
    `<li><b>${s.pets.length}/${CAT_COUNT}</b> barn cats petted</li>`,
    `<li><b>${s.discoveries.length}/${shared.map.discoveries.length}</b> places discovered</li>`,
    `<li><b>${s.fetches}</b> fetches · <b>${s.carrots}</b> carrots for the donkeys</li>`,
    `<li><b>Sunday at the Barn</b> ${s.barnPlan ? `Next chapter: ${BARN_PLAN_LABEL[s.barnPlan].toLowerCase()}.` : 'Pull up a chair at the long table under the string lights, whenever you like.'}</li>`,
  ].join('');
}

function buildRewards(): void {
  const s = store.data;
  const stars = totalStars(s);
  $('rewards-sub').textContent = `${stars} of ${MAX_STARS} stars. Play the family's games to unlock more.`;
  const ul = $('reward-list');
  ul.innerHTML = '';
  const c = s.cosmetics;
  for (const r of REWARDS) {
    const got = rewardUnlocked(s, r);
    const li = document.createElement('li');
    li.className = got ? 'got' : 'locked';
    const need = r.stars !== undefined ? `${starSvg(false, 14)} ${r.stars} stars` : r.how === 'pets' ? `${s.pets.length}/${CAT_COUNT} cats petted` : 'Secret';
    let control = '';
    if (got) {
      if (r.kind === 'hat') control = `<button class="toggle ${c.hat === r.hat ? 'on' : ''}" data-hat="${r.hat}">${c.hat === r.hat ? 'Wearing' : 'Wear'}</button>`;
      else if (r.kind === 'mower') {
        const paint = r.id.replace('mower-', '');
        control = `<button class="toggle ${c.mower === paint ? 'on' : ''}" data-mower="${paint}">${c.mower === paint ? 'In use' : 'Use'}</button>`;
      } else if (r.kind === 'ride') control = `<button class="toggle ${c.ride ? 'on' : ''}" data-flag="ride">${c.ride ? 'On' : 'Off'}</button>`;
      else if (r.id === 'evening' || r.id === 'holiday') control = `<button class="toggle ${c[r.id] ? 'on' : ''}" data-flag="${r.id}">${c[r.id] ? 'On' : 'Off'}</button>`;
      else control = '<span class="have">Done</span>';
    }
    li.innerHTML = `<div><b>${r.name}</b><small>${got ? r.desc : r.how === 'hunt' ? "Finish Grandpa's Treasure Hunt." : r.desc}</small></div>${got ? control : `<span class="need">${need}</span>`}`;
    ul.append(li);
  }
  ul.querySelectorAll<HTMLElement>('[data-hat]').forEach((b) =>
    b.addEventListener('click', () => {
      sfx.click();
      const h = b.dataset.hat as HatKind;
      c.hat = c.hat === h ? 'default' : h;
      store.save();
      applyLook();
      buildRewards();
    }),
  );
  ul.querySelectorAll<HTMLElement>('[data-mower]').forEach((b) =>
    b.addEventListener('click', () => {
      sfx.click();
      const p = b.dataset.mower as 'green' | 'gold';
      c.mower = c.mower === p ? 'red' : p;
      store.save();
      applyLook();
      buildRewards();
    }),
  );
  ul.querySelectorAll<HTMLElement>('[data-flag]').forEach((b) =>
    b.addEventListener('click', () => {
      sfx.click();
      const f = b.dataset.flag as 'ride' | 'evening' | 'holiday';
      c[f] = !c[f];
      store.save();
      applyLook();
      buildRewards();
    }),
  );
}

function openMap(): void {
  const cv = $<HTMLCanvasElement>('map-canvas');
  const panel = cv.parentElement!;
  const maxW = Math.min(Math.max(200, panel.clientWidth - 36), 560);
  const maxH = Math.max(200, window.innerHeight - 230);
  mapHits = paintMap(cv, shared.map, { x: hub.player.x, y: hub.player.y, who: hub.explorer }, maxW, maxH);
}
$('map-canvas').addEventListener('click', (e) => {
  const r = (e.target as HTMLElement).getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  let best: MapHit | null = null;
  let bd = Infinity;
  for (const h of mapHits) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d < h.r + 14 && d < bd) {
      bd = d;
      best = h;
    }
  }
  if (!best) return;
  sfx.click();
  const a = activity(best.id);
  hub.teleport(a.station.x, a.station.y + 70);
  hubView.snap();
  closeAll();
});

// --- Intro / challenge picker ---------------------------------------------------------------
function openIntro(id: GameId): void {
  const a = activity(id);
  introActivity = id;
  const who = FAMILY[a.who];
  $('intro-title').textContent = a.title;
  $('intro-who').textContent = `with ${who.name}: "${a.line}"`;
  requestAnimationFrame(() => paintPortrait($<HTMLCanvasElement>('intro-face'), who.look, { wave: true }));
  // Default to the first unlocked challenge without three stars.
  const unlocked = a.challenges.filter((c) => isUnlocked(store.data, c.id));
  introChallenge = (unlocked.find((c) => (store.data.stars[c.id] ?? 0) < 3) ?? unlocked[unlocked.length - 1]).id;
  buildIntroChallenges();
  $('intro-howto').innerHTML = HOWTO[id].map((l) => `<li>${l}</li>`).join('');
  show($('intro-extra'), id === 'kitten');
  $('intro-start').textContent = id === 'hunt' && store.data.hunt.found.length && !store.data.hunt.done ? 'Keep looking' : 'Start';
  if (top() !== 'intro') open('intro');
}

function buildIntroChallenges(): void {
  const a = activity(introActivity);
  const box = $('intro-challenges');
  box.innerHTML = '';
  a.challenges.forEach((c, i) => {
    const b = document.createElement('button');
    const un = isUnlocked(store.data, c.id);
    b.className = `chal-btn ${c.id === introChallenge ? 'on' : ''} ${un ? '' : 'locked'}`;
    b.disabled = !un;
    b.setAttribute('aria-pressed', String(c.id === introChallenge));
    b.innerHTML = `<b>${c.name}</b><span>${un ? starRow(store.data.stars[c.id] ?? 0, 3, 14) : `Get 1 star on ${a.challenges[i - 1]?.name} to unlock`}</span><small>${c.blurb}</small>`;
    b.addEventListener('click', () => {
      sfx.click();
      introChallenge = c.id;
      buildIntroChallenges();
    });
    box.append(b);
  });
}

$('intro-start').addEventListener('click', () => {
  sfx.unlock();
  sfx.click();
  startChallenge(introChallenge);
});
$('intro-close').addEventListener('click', () => {
  sfx.click();
  close();
});
$('intro-extra').addEventListener('click', () => {
  sfx.click();
  open('herd');
});
$('herd-close').addEventListener('click', () => {
  sfx.click();
  close();
});

function buildRoster(): void {
  const ul = $('roster');
  ul.innerHTML = '';
  for (const k of LEVELS[0].kittens) {
    const li = document.createElement('li');
    const c = document.createElement('canvas');
    c.width = 112;
    c.height = 88;
    const g = c.getContext('2d')!;
    g.scale(2.6, 2.6);
    drawKittenFigure(g, { x: 21, y: 29, faceX: 1, coat: k.coat, pose: 'sit', phase: 0, speed: 0, alarm: 0, happy: store.data.pets.includes(k.id) || false, clock: 1 });
    const t = PERSONALITIES[k.personality];
    const info = document.createElement('div');
    info.innerHTML = `<b>${k.name}</b><span class="trait">${t.label}</span><p>${t.blurb}</p>`;
    li.append(c, info);
    ul.append(li);
  }
}

// --- Minigames -------------------------------------------------------------------------------
function makeScene(id: string): GameScene | null {
  const c = challengeDef(id);
  if (c.game === 'kitten') return new KittenScene(ctx, LEVELS.find((l) => l.id === id)!, shared);
  if (c.game === 'mower') return new MowerScene(ctx, MOW_LEVELS.find((l) => l.id === id)!, shared);
  if (c.game === 'woodpile') return new WoodScene(ctx, WOOD_ROUNDS.find((r) => r.id === id)!);
  return null;
}

let currentChallenge = '';

function startChallenge(id: string): void {
  const c = challengeDef(id);
  if (!isUnlocked(store.data, id)) return;
  currentChallenge = id;
  stack.length = 0;
  resultsUp = false;
  paused = false;
  toast.clear();
  if (c.game === 'rounds' || c.game === 'hunt') {
    game?.exit();
    game = null;
    mode = 'hub';
    if (c.game === 'rounds') {
      hub.startRounds();
      hubView.snap();
      toast.show('<b>Go!</b>Six chores, any order. The clock is running.', 3);
    } else {
      if (store.data.hunt.done && !store.data.hunt.found.length) hub.huntFound.clear();
      hub.startHunt();
      toast.show('<b>Grandpa\'s first clue is up top.</b>Lost things glint when you get close.', 4);
    }
    lastMission = '';
    sfx.startMusic();
    syncScreens();
    return;
  }
  game?.exit();
  game = makeScene(id);
  mode = 'game';
  syncScreens();
  game!.enter({ cosmetics: store.data.cosmetics, decor: decor(), insetTop: insetTop() });
  resize();
  acc = 0;
  last = performance.now();
  sfx.startMusic();
}

function pauseGame(): void {
  if (mode !== 'game' || !game || paused || resultsUp) return;
  paused = true;
  $('pause-sub').textContent = game.pauseText();
  sfx.stopMusic();
  sfx.setEngine(-1);
  open('pause');
}

function resumeGame(): void {
  if (!paused) return;
  paused = false;
  stack.length = 0;
  last = performance.now();
  acc = 0;
  sfx.resume();
  sfx.startMusic();
  syncScreens();
}

function leaveGame(): void {
  const c = currentChallenge ? challengeDef(currentChallenge) : null;
  game?.exit();
  game = null;
  paused = false;
  resultsUp = false;
  hub.endMission();
  mode = 'hub';
  stack.length = 0;
  if (c) {
    const a = activity(c.game);
    hub.teleport(a.station.x, a.station.y + 70);
  }
  applyLook();
  hubView.snap();
  sfx.setEngine(-1);
  sfx.startMusic();
  lastStation = null;
  syncScreens();
}

$('pause-btn').addEventListener('click', () => {
  sfx.click();
  pauseGame();
});
$('resume-btn').addEventListener('click', () => {
  sfx.click();
  resumeGame();
});
$('restart-btn').addEventListener('click', () => {
  sfx.click();
  paused = false;
  stack.length = 0;
  game?.restart();
  syncScreens();
  sfx.startMusic();
});
$('quit-btn').addEventListener('click', () => {
  sfx.click();
  leaveGame();
});
$('howto-btn').addEventListener('click', () => {
  sfx.click();
  const c = challengeDef(currentChallenge);
  notice(activity(c.game).title, `<ul class="howto">${HOWTO[c.game].map((l) => `<li>${l}</li>`).join('')}</ul>`, 'Got it');
});

controls.onInteract = () => sfx.unlock();
controls.onPause = () => {
  if (mode === 'game') {
    if (paused) resumeGame();
    else pauseGame();
  } else if (mode === 'hub') {
    if (stack.length) close();
    else open('menu');
  }
};

// --- Results ---------------------------------------------------------------------------------
function showResults(id: string, r: SceneResult, before = unlockedRewards(store.data)): void {
  const prevStars = store.data.stars[id] ?? 0;
  const prevBest = store.data.best[id] ?? 0;
  const { newBest } = store.record(id, r.stars, r.score);
  const fresh = announceUnlocks(before);
  const c = challengeDef(id);
  const a = activity(c.game);
  const idx = a.challenges.findIndex((x) => x.id === id);
  const next = a.challenges[idx + 1];
  const nextNew = !!next && prevStars === 0 && r.stars > 0;

  $('results-title').textContent = r.title;
  $('results-sub').textContent = r.sub;
  $('stars').innerHTML = [1, 2, 3].map((i) => starSvg(i <= r.stars, 52)).join('');
  $('lines').innerHTML = r.lines.map((l) => `<li><span>${l.label}</span><b>${l.value}</b></li>`).join('');
  $('total').textContent = String(r.score);
  $('results-best').textContent = newBest && prevBest > 0 ? 'New best score!' : prevBest ? `Best: ${Math.max(prevBest, r.score)}` : '';
  const notes: string[] = [];
  if (nextNew) notes.push(`New challenge: <b>${next.name}</b>`);
  for (const f of fresh) notes.push(`Unlocked: <b>${f}</b>`);
  if (!r.finished) notes.push('Get at least one star to unlock the next challenge.');
  $('unlocks').innerHTML = notes.map((n) => `<p>${n}</p>`).join('');
  show($('next-btn'), !!next && isUnlocked(store.data, next.id));
  $('next-btn').textContent = next ? `Next: ${next.name}` : 'Next';
  $('again-btn').textContent = r.finished ? 'Play again' : 'Try again';
  resultsUp = true;
  if (mode === 'hub') hub.endMission();
  sfx.stopMusic();
  sfx.setEngine(-1);
  stack.length = 0;
  open('results');
  if (fresh.length) setTimeout(() => sfx.collect(), 900);
}

$('again-btn').addEventListener('click', () => {
  sfx.click();
  if (game) {
    stack.length = 0;
    resultsUp = false;
    game.restart();
    sfx.startMusic();
    syncScreens();
  } else startChallenge(currentChallenge);
});
$('next-btn').addEventListener('click', () => {
  sfx.click();
  const c = challengeDef(currentChallenge);
  const a = activity(c.game);
  const next = a.challenges[a.challenges.findIndex((x) => x.id === currentChallenge) + 1];
  if (next) startChallenge(next.id);
});
$('home-btn').addEventListener('click', () => {
  sfx.click();
  leaveGame();
});

// Interruptions: calls, app switching, locking the phone.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseGame();
    sfx.setEngine(-1);
    sfx.suspend();
  } else {
    last = performance.now();
    sfx.resume();
  }
});
window.addEventListener('pagehide', () => pauseGame());

// --- Main loop -------------------------------------------------------------------------------
let warmed = false;
const hero = $<HTMLCanvasElement>('hero');
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  toast.update(dt);

  if (mode === 'game' && game) {
    const running = !paused && !resultsUp && !stack.length;
    if (running) {
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 6) {
        game.step(STEP);
        acc -= STEP;
        steps++;
      }
      if (steps === 6) acc = 0;
      if (game.isComplete()) showResults(game.challenge, game.result());
    }
    game.frame(dt, running ? acc / STEP : 1, !running && !resultsUp);
  } else if (mode === 'hub') {
    hubFrame(dt);
  } else {
    hub.clock += dt;
    hubView.update(dt, 'title');
    hubView.render(1);
    if (!stack.length) drawHero(hero, hub.clock, reducedMotion);
    if (!warmed) warmed = hubView.warm(hubView.cam.x, hubView.cam.y, 2) === 0;
  }
  requestAnimationFrame(frame);
}

applyLook();
refreshTitle();
syncSound();
syncScreens();
if (hubView.overview) {
  mode = 'hub';
  syncScreens();
  show($('hub-hud'), false);
}
requestAnimationFrame(frame);

// Test/debug hook for automated browser checks. Harmless for players.
(window as unknown as { __b89: unknown }).__b89 = {
  hub,
  store,
  get mode() {
    return mode;
  },
  get game() {
    return game;
  },
  get stack() {
    return [...stack];
  },
  startChallenge,
  enterHub,
  pauseGame,
  resumeGame,
  allChallenges: ALL_CHALLENGES.map((c) => c.id),
};
