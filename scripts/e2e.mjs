// Browser gameplay checks on phone-sized viewports.
// Usage: npm run build && npm run test:e2e
// Starts `vite preview` on the built app, drives it with Playwright (touch-enabled iPhone
// profile), and saves screenshots to test-results/.
import { mkdirSync } from 'node:fs';
import { chromium, devices } from 'playwright';
import { preview } from 'vite';

const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
const OUT = 'test-results';
mkdirSync(OUT, { recursive: true });

const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'silent' });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const browser = await chromium.launch();
try {
  await portrait();
  await landscape();
} finally {
  await browser.close();
  await server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);

async function newPage(device) {
  const ctx = await browser.newContext({ ...device });
  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  const failedReq = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => !r.url().startsWith(BASE) && !r.url().startsWith('data:') && external.push(r.url()));
  page.on('response', (r) => r.status() >= 400 && failedReq.push(`${r.status()} ${r.url()}`));
  return { page, errors, external, failedReq };
}

function kc(page, fn, arg) {
  return page.evaluate(fn, arg);
}

async function drag(page, x0, y0, dx, dy, ms) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 + dx, y0 + dy, { steps: 6 });
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

async function portrait() {
  const { page, errors, external, failedReq } = await newPage(devices['iPhone 13']);
  await page.goto(BASE);
  await page.waitForTimeout(1200);
  check('title screen visible', await page.isVisible('#play-btn'));
  const painted = await page.evaluate(() => {
    const c = document.getElementById('game');
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(c.width / 2, c.height / 2, 1, 1).data;
    return d[0] + d[1] + d[2] > 0;
  });
  check('ranch renders behind title', painted);
  await page.screenshot({ path: `${OUT}/01-title-portrait.png` });

  await page.tap('#play-btn');
  await page.waitForTimeout(500);
  check('playing after tapping Saddle up', (await kc(page, () => window.__kc.mode)) === 'playing');
  check('HUD + actions visible', (await page.isVisible('#hud')) && (await page.isVisible('#whistle-btn')));
  check('objective shows 0/6', (await page.textContent('#count')) === '0' && (await page.textContent('#required')) === '/6');

  // Movement via the floating joystick (drag right).
  const p0 = await kc(page, () => ({ x: window.__kc.game.player.x, y: window.__kc.game.player.y }));
  await drag(page, 120, 520, 70, 0, 1200);
  const p1 = await kc(page, () => ({ x: window.__kc.game.player.x, y: window.__kc.game.player.y }));
  check('joystick moves Deputy right', p1.x - p0.x > 150 && Math.abs(p1.y - p0.y) < 60, `dx=${(p1.x - p0.x).toFixed(0)}`);
  await page.screenshot({ path: `${OUT}/02-riding.png` });

  // Collision: ride north into the barn from just below it.
  await kc(page, () => {
    const g = window.__kc.game;
    g.player.x = g.player.px = 1020;
    g.player.y = g.player.py = 2830;
    window.__kc.renderer.snap();
  });
  await drag(page, 120, 520, 0, -70, 1500);
  const pb = await kc(page, () => ({ x: window.__kc.game.player.x, y: window.__kc.game.player.y }));
  check('barn blocks movement', pb.y > 2760, `y=${pb.y.toFixed(0)}`);
  await page.screenshot({ path: `${OUT}/03-barn-collision.png` });

  // Boundaries: ride far west into the tree line.
  await kc(page, () => {
    const g = window.__kc.game;
    g.player.x = g.player.px = 300;
    g.player.y = g.player.py = 1900;
    window.__kc.renderer.snap();
  });
  await drag(page, 200, 520, -70, 0, 1500);
  const pw = await kc(page, () => window.__kc.game.player.x);
  check('map boundary holds', pw >= 72 + 24 - 0.5, `x=${pw.toFixed(1)}`);

  // Whistle & treat buttons.
  await kc(page, () => {
    const g = window.__kc.game;
    const k = g.kittens.find((kk) => kk.id === 'pepper');
    g.player.x = g.player.px = k.x - 120;
    g.player.y = g.player.py = k.y;
    window.__kc.renderer.snap();
  });
  await page.waitForTimeout(200);
  await page.tap('#whistle-btn');
  await page.waitForTimeout(100);
  const dashed = await kc(page, () => window.__kc.game.kittens.find((k) => k.id === 'pepper').state);
  check('whistle button scoots nearby kitten', dashed === 'dash' || dashed === 'flee', dashed);
  const t0 = Number(await page.textContent('#treat-count'));
  await page.tap('#treat-btn');
  await page.waitForTimeout(150);
  const t1 = Number(await page.textContent('#treat-count'));
  check('treat button uses a treat', t1 === t0 - 1, `${t0} -> ${t1}`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/04-whistle-treat.png` });

  // Penning updates the HUD and score.
  await kc(page, () => {
    const g = window.__kc.game;
    const k = g.kittens.find((kk) => kk.id === 'biscuit');
    k.x = g.targetPen.x;
    k.y = g.targetPen.y;
    g.player.x = g.player.px = g.targetPen.x - 220;
    g.player.y = g.player.py = g.targetPen.y - 60;
    window.__kc.renderer.snap();
  });
  await page.waitForTimeout(400);
  check('penned kitten counted in HUD', (await page.textContent('#count')) === '1');
  check('score updated', Number(await page.textContent('#score')) >= 100);
  await page.screenshot({ path: `${OUT}/05-penned.png` });

  // Pause freezes time; resume continues.
  await page.tap('#pause-btn');
  await page.waitForTimeout(200);
  const e0 = await kc(page, () => window.__kc.game.elapsed);
  await page.waitForTimeout(1000);
  const e1 = await kc(page, () => window.__kc.game.elapsed);
  check('pause screen shown and clock frozen', (await page.isVisible('#pause')) && e1 === e0);
  await page.screenshot({ path: `${OUT}/06-pause.png` });
  await page.tap('[data-open="herd"] >> nth=1');
  await page.waitForTimeout(300);
  check('herd roster lists all kittens', (await page.locator('#roster li').count()) === 8);
  await page.screenshot({ path: `${OUT}/07-herd.png` });
  await page.tap('#herd-close');
  await page.tap('#resume-btn');
  await page.waitForTimeout(500);
  const e2 = await kc(page, () => window.__kc.game.elapsed);
  check('resume continues the clock', e2 > e1);

  // Interruption: app goes to background.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  check('backgrounding auto-pauses', (await kc(page, () => window.__kc.mode)) === 'paused');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.tap('#resume-btn');

  // No page scrolling from swipes.
  await drag(page, 200, 700, 0, -300, 200);
  const scroll = await page.evaluate(() => ({ y: window.scrollY, x: window.scrollX, h: document.documentElement.scrollHeight, ih: window.innerHeight }));
  check('page never scrolls', scroll.y === 0 && scroll.x === 0 && scroll.h <= scroll.ih + 1, JSON.stringify(scroll));

  // Completion → results → play again.
  await kc(page, () => {
    const g = window.__kc.game;
    g.kittens.slice(0, 6).forEach((k, i) => {
      k.x = g.targetPen.x + Math.cos(i) * 40;
      k.y = g.targetPen.y + Math.sin(i) * 40;
    });
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/08-victory.png` });
  await page.waitForSelector('#results:not([hidden])', { timeout: 8000 });
  check('results screen after victory', await page.isVisible('#again-btn'));
  check('results show a total', Number(await page.textContent('#total')) > 600);
  await page.screenshot({ path: `${OUT}/09-results.png` });
  await page.tap('#again-btn');
  await page.waitForTimeout(400);
  const fresh = await kc(page, () => ({ mode: window.__kc.mode, n: window.__kc.game.pennedCount, t: window.__kc.game.elapsed }));
  check('play again restarts cleanly', fresh.mode === 'playing' && fresh.n === 0 && fresh.t < 1, JSON.stringify(fresh));
  check('HUD reset to 0', (await page.textContent('#count')) === '0');

  // Frame rate sanity on this machine (software-rendered headless Chromium, so a rough floor).
  const fps = await page.evaluate(
    () =>
      new Promise((res) => {
        let n = 0;
        const t0 = performance.now();
        const f = () => (++n < 90 ? requestAnimationFrame(f) : res((n * 1000) / (performance.now() - t0)));
        requestAnimationFrame(f);
      }),
  );
  check('renders at a playable frame rate', fps > 20, `${fps.toFixed(0)} fps headless`);

  check('no console errors', errors.length === 0, errors.join(' | '));
  check('no external network requests', external.length === 0, external.join(' '));
  check('all assets load', failedReq.length === 0, failedReq.join(' '));
}

async function landscape() {
  const iphone = devices['iPhone 13 landscape'];
  const { page, errors } = await newPage(iphone);
  await page.goto(BASE);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/10-title-landscape.png` });
  const fits = await page.evaluate(() => {
    const r = document.getElementById('play-btn').getBoundingClientRect();
    return r.bottom <= window.innerHeight && r.top >= 0;
  });
  check('landscape: play button on screen', fits);
  await page.tap('#play-btn');
  await page.waitForTimeout(800);
  const inView = await page.evaluate(() =>
    ['whistle-btn', 'treat-btn', 'pause-btn'].every((id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;
    }),
  );
  check('landscape: controls inside viewport', inView);
  await drag(page, 150, 250, 0, -60, 800);
  await page.screenshot({ path: `${OUT}/11-play-landscape.png` });
  // Rotate back to portrait mid-game.
  await page.setViewportSize({ width: 390, height: 664 });
  await page.waitForTimeout(600);
  const canvasOk = await page.evaluate(() => {
    const c = document.getElementById('game');
    return Math.abs(c.getBoundingClientRect().width - window.innerWidth) < 2 && Math.abs(c.getBoundingClientRect().height - window.innerHeight) < 2;
  });
  check('orientation change resizes the canvas', canvasOk);
  await page.screenshot({ path: `${OUT}/12-rotated-portrait.png` });
  check('landscape: no console errors', errors.length === 0, errors.join(' | '));
}
