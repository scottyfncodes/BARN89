// Browser checks on phone-sized viewports.
// Usage: npm run build && npm run test:e2e
// Starts `vite preview` on the built app, drives it with Playwright (touch-enabled iPhone
// profiles), and saves screenshots to test-results/.
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
  return { page, ctx, errors, external, failedReq };
}

function b89(page, fn, arg) {
  return page.evaluate(fn, arg);
}
function visible(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    return !!el && !el.hidden && el.getBoundingClientRect().height > 0;
  }, sel);
}

async function drag(page, x0, y0, dx, dy, ms) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 + dx, y0 + dy, { steps: 6 });
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

async function tap(page, sel) {
  const box = await page.locator(sel).boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function portrait() {
  const { page, ctx, errors, external, failedReq } = await newPage(devices['iPhone 13']);
  await page.goto(BASE);
  await page.waitForTimeout(800);
  const vw = page.viewportSize().width;

  check('title screen shows on load', await visible(page, '#title'));
  check('title shows Barn 89 logo', (await page.textContent('.logo')).replace(/\s+/g, '') === 'BARN89');
  await page.screenshot({ path: `${OUT}/p-title.png` });

  // Explorer picker.
  await tap(page, '#who-btn');
  check('explorer picker opens', await visible(page, '#who'));
  await page.locator('.who-item').nth(4).click();
  check('choosing Grandpa saves the explorer', (await b89(page, () => window.__b89.store.data.explorer)) === 'grandpa');
  await tap(page, '#who-done');

  // Into the homestead.
  await tap(page, '#play-btn');
  await page.waitForTimeout(600);
  check('explore enters the homestead', (await b89(page, () => window.__b89.mode)) === 'hub');
  check('homestead HUD visible', await visible(page, '#hub-hud'));
  const p0 = await b89(page, () => ({ x: window.__b89.hub.player.x, y: window.__b89.hub.player.y }));
  await drag(page, vw / 2, 520, 0, 70, 900);
  const p1 = await b89(page, () => ({ x: window.__b89.hub.player.x, y: window.__b89.hub.player.y }));
  check('joystick walks the explorer', p1.y - p0.y > 60, `moved ${(p1.y - p0.y).toFixed(0)}`);
  await page.screenshot({ path: `${OUT}/p-hub.png` });

  // Board and map.
  await page.click('#hub-hud [data-open="board"]');
  check('activity board opens', await visible(page, '#board'));
  check('board lists eight activities', (await page.locator('#board-list li').count()) === 8);
  await page.screenshot({ path: `${OUT}/p-board.png` });
  await page.click('#board [data-close]');
  await page.click('#hub-hud [data-open="map"]');
  await page.waitForTimeout(200);
  check('map opens and is drawn', (await page.evaluate(() => document.getElementById('map-canvas').getBoundingClientRect().width)) > 200);
  await page.screenshot({ path: `${OUT}/p-map.png` });
  // Tap Jay's marker (wherever he's got to) to travel.
  const jay = await page.evaluate(() => {
    const r = document.getElementById('map-canvas').getBoundingClientRect();
    const st = window.__b89.hub.npcs.find((n) => n.who === 'jay');
    const s = r.width / 2400;
    return { x: r.left + st.x * s, y: r.top + st.y * s };
  });
  await page.mouse.click(jay.x, jay.y);
  await page.waitForTimeout(400);
  check('map travel closes the map', !(await visible(page, '#map')));
  check('map travel lands next to Jay', (await b89(page, () => window.__b89.hub.nearStation?.id)) === 'mower');
  check('station prompt shows', await visible(page, '#prompt'));
  await page.screenshot({ path: `${OUT}/p-prompt.png` });

  // Yard Boss through the intro card.
  await tap(page, '#prompt-go');
  check('intro card opens', await visible(page, '#intro'));
  check('locked challenges are disabled', (await page.locator('.chal-btn.locked').count()) === 2);
  await tap(page, '#intro-start');
  await page.waitForTimeout(500);
  check('Yard Boss starts', (await b89(page, () => window.__b89.game?.challenge)) === 'mower-1');
  check('game HUD visible', await visible(page, '#hud'));
  const cov0 = await b89(page, () => window.__b89.game.game.coverage);
  await drag(page, vw / 2, 520, 0, -60, 1500);
  const cov1 = await b89(page, () => window.__b89.game.game.coverage);
  check('driving mows the lawn', cov1 > cov0 + 0.01, `${(cov0 * 100).toFixed(1)}% -> ${(cov1 * 100).toFixed(1)}%`);
  await page.screenshot({ path: `${OUT}/p-mower.png` });
  await tap(page, '#pause-btn');
  check('pause opens', await visible(page, '#pause'));
  const t0 = await b89(page, () => window.__b89.game.game.elapsed);
  await page.waitForTimeout(500);
  check('pause freezes the clock', (await b89(page, () => window.__b89.game.game.elapsed)) === t0);
  await tap(page, '#restart-btn');
  check('restart resets the lawn', (await b89(page, () => window.__b89.game.game.coverage)) < cov1);
  await tap(page, '#pause-btn');
  await tap(page, '#quit-btn');
  check('back to the homestead from a game', (await b89(page, () => window.__b89.mode)) === 'hub');

  // Kitten Cowgirl.
  await b89(page, () => window.__b89.startChallenge('kitten-1'));
  await page.waitForTimeout(400);
  check('Kitten Cowgirl starts', (await b89(page, () => window.__b89.game?.challenge)) === 'kitten-1');
  check('whistle and treat buttons visible', await visible(page, '#actions'));
  await tap(page, '#whistle-btn');
  await page.waitForTimeout(200);
  check('whistle works', (await b89(page, () => window.__b89.game.game.player.whistleCooldown)) > 0);
  await page.screenshot({ path: `${OUT}/p-kitten.png` });

  // Woodpile, finished quickly with a tiny goal.
  await b89(page, () => window.__b89.startChallenge('woodpile-1'));
  await page.waitForTimeout(400);
  check('Woodpile starts', (await b89(page, () => window.__b89.game?.challenge)) === 'woodpile-1');
  check('toss button shows while aiming', await visible(page, '#toss-btn'));
  await b89(page, () => {
    window.__b89.game.game.round.goal = 2;
  });
  for (let i = 0; i < 400; i++) {
    const done = await b89(page, () => {
      const g = window.__b89.game?.game;
      if (!g) return true;
      if ((g.phase === 'aim' || g.phase === 'ready') && Math.abs(g.meter - g.sweet) < g.sweetW / 8) g.tap();
      else if (g.phase === 'slide' && Math.abs(g.slider.x - g.rowRight) < 4) g.tap();
      return document.getElementById('results') && !document.getElementById('results').hidden;
    });
    if (done) break;
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(500);
  check('finishing shows results', await visible(page, '#results'));
  const stars = await b89(page, () => window.__b89.store.data.stars['woodpile-1'] ?? 0);
  check('result stars saved', stars >= 1, `${stars} stars`);
  check('next challenge offered', await visible(page, '#next-btn'));
  await page.screenshot({ path: `${OUT}/p-results.png` });
  await tap(page, '#home-btn');
  check('results return to the homestead', (await b89(page, () => window.__b89.mode)) === 'hub');

  // Putt-Putt: pull back and let go.
  await b89(page, () => window.__b89.startChallenge('putt-1'));
  await page.waitForTimeout(1300);
  check('Putt-Putt starts', (await b89(page, () => window.__b89.game?.challenge)) === 'putt-1');
  const ball0 = await b89(page, () => ({ ...window.__b89.game.game.ball }));
  await drag(page, vw / 2, 400, 0, 50, 400);
  await page.waitForTimeout(700);
  const putt1 = await b89(page, () => ({ strokes: window.__b89.game.game.strokes, card: window.__b89.game.game.card.length, y: window.__b89.game.game.ball.y }));
  check('pulling back and letting go putts the ball up the hole', (putt1.strokes === 1 || putt1.card === 1) && putt1.y < ball0.y - 20, JSON.stringify(putt1));
  await page.screenshot({ path: `${OUT}/p-putt.png` });

  // Barn Puzzles: drag a bale along its row, tap a pipe to turn it.
  await b89(page, () => window.__b89.startChallenge('puzzle-1'));
  await page.waitForTimeout(900);
  check('Barn Puzzles starts', (await b89(page, () => window.__b89.game?.challenge)) === 'puzzle-1');
  const loft = await b89(page, () => {
    const v = window.__b89.game.view;
    const a = window.__b89.game.game.pieces.find((p) => p.id === 'A');
    return { x: v.bx + (a.x + 1.5) * v.cell, y: v.by + (a.y + 0.5) * v.cell, cell: v.cell, ax: a.x };
  });
  await drag(page, loft.x, loft.y, loft.cell * 1.1, 0, 200);
  await page.waitForTimeout(200);
  const slid = await b89(page, () => ({ moves: window.__b89.game.game.moves, ax: window.__b89.game.game.pieces.find((p) => p.id === 'A').x }));
  check('dragging a bale slides it along its row', slid.moves === 1 && slid.ax === loft.ax + 1, JSON.stringify(slid));
  await page.screenshot({ path: `${OUT}/p-hayloft.png` });
  await b89(page, () => { window.__b89.store.data.stars['puzzle-1'] = 1; window.__b89.startChallenge('puzzle-2'); });
  await page.waitForTimeout(900);
  const pipe = await b89(page, () => {
    const v = window.__b89.game.view;
    return { x: v.bx + 1.5 * v.cell, y: v.by + 1.5 * v.cell, mask: window.__b89.game.game.tiles[5].mask };
  });
  await page.touchscreen.tap(pipe.x, pipe.y);
  await page.waitForTimeout(200);
  const turned = await b89(page, () => ({ moves: window.__b89.game.game.moves, mask: window.__b89.game.game.tiles[5].mask }));
  check('tapping a pipe turns it', turned.moves === 1 && turned.mask !== pipe.mask, JSON.stringify(turned));
  await page.screenshot({ path: `${OUT}/p-pipes.png` });

  // Morning Rounds and the hunt.
  await b89(page, () => window.__b89.startChallenge('rounds-1'));
  await page.waitForTimeout(300);
  check('Morning Rounds shows the chore card', await visible(page, '#mission'));
  await b89(page, () => window.__b89.hub.endMission());
  await b89(page, () => window.__b89.startChallenge('hunt-1'));
  await page.waitForTimeout(300);
  check("Grandpa's hunt shows a clue", (await page.textContent('#mission-body')).length > 20);
  await page.screenshot({ path: `${OUT}/p-hunt.png` });
  await b89(page, () => window.__b89.hub.endMission());

  // Sunday at the Barn: optional, walk up to the long table.
  await b89(page, () => window.__b89.hub.teleport(1670, 2955));
  await page.waitForTimeout(300);
  check('long table offers Sunday breakfast', (await page.textContent('#act-label')) === 'Sunday breakfast');
  await tap(page, '#act-btn');
  await page.waitForTimeout(400);
  check('Sunday at the Barn opens', await visible(page, '#sunday'));
  check('the family gathers at the table', await b89(page, () => window.__b89.hub.gathered));
  await page.screenshot({ path: `${OUT}/p-sunday.png` });
  for (let i = 0; i < 40 && (await visible(page, '#sunday')); i++) {
    const n = await page.locator('#sunday-choices button').count();
    if (n) await page.locator('#sunday-choices button').nth(n - 1).click();
    else await page.click('#sunday-next');
  }
  check('Sunday ends back on the homestead', !(await visible(page, '#sunday')) && !(await b89(page, () => window.__b89.hub.gathered)));
  check("the barn's next chapter is remembered", (await b89(page, () => window.__b89.store.data.barnPlan)) === 'dance');
  check('no stars for Sunday', (await b89(page, () => Object.keys(window.__b89.store.data.stars).every((k) => !k.includes('sunday')))));

  // Blue Star workshop: sand, paint and star the cabinet with Grandpa, and it stays out front.
  await b89(page, () => window.__b89.hub.teleport(1792, 728));
  await page.waitForTimeout(300);
  check('the cabinet offers the workshop', /Grandpa|workshop/.test(await page.textContent('#act-label')));
  await tap(page, '#act-btn');
  await page.waitForTimeout(400);
  check('Blue Star workshop opens', (await b89(page, () => window.__b89.game?.challenge)) === 'workshop');
  const wb = await b89(page, () => { const v = window.__b89.game.view; const p = window.__b89.game.piece; return { x: v.px, y: v.py, w: p.w * v.s, h: p.h * v.s, s: v.s }; });
  for (let y = wb.y; y <= wb.y + wb.h; y += 7 * wb.s) await drag(page, wb.x - 4, y, wb.w + 8, 0, 10);
  check('painting covers the cabinet', await b89(page, () => window.__b89.game.game.covered));
  const db = await b89(page, () => window.__b89.game.view.doneBox());
  await page.mouse.click(db.x + db.w / 2, db.y + db.h / 2);
  await page.mouse.click(wb.x + wb.w * 0.7, wb.y + wb.h * 0.3);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/p-workshop.png` });
  await page.mouse.click(db.x + db.w / 2, db.y + db.h / 2);
  await page.waitForTimeout(500);
  check('the cabinet goes out front, back on the homestead', (await b89(page, () => window.__b89.mode)) === 'hub' && (await b89(page, () => !!window.__b89.store.data.restored.cabinet?.star)));
  check('no stars for the workshop', (await b89(page, () => !('workshop' in window.__b89.store.data.stars))));

  // Persistence across a reload.
  await page.reload();
  await page.waitForTimeout(600);
  check('progress survives a reload', (await b89(page, () => window.__b89.store.data.stars['woodpile-1'] ?? 0)) >= 1);
  check('the restored cabinet survives a reload', await b89(page, () => !!window.__b89.store.data.restored.cabinet));
  check('explorer survives a reload', (await b89(page, () => window.__b89.store.data.explorer)) === 'grandpa');

  check('page never scrolls', (await page.evaluate(() => window.scrollY + document.documentElement.scrollTop)) === 0);
  check('no horizontal overflow', (await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)));
  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('no external network requests', external.length === 0, external.slice(0, 3).join(' '));
  check('no failed requests', failedReq.length === 0, failedReq.slice(0, 3).join(' '));
  await ctx.close();
}

async function landscape() {
  const { page, ctx, errors } = await newPage(devices['iPhone 13 landscape']);
  await page.goto(BASE);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/l-title.png` });
  const fits = await page.evaluate(() => {
    const r = document.querySelector('#title .panel').getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight + 1;
  });
  check('landscape: title card fits', fits);
  await page.click('#play-btn');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/l-hub.png` });
  for (const id of ['kitten-1', 'mower-1', 'woodpile-1', 'putt-1', 'puzzle-1']) {
    await b89(page, (c) => window.__b89.startChallenge(c), id);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/l-${id}.png` });
    check(`landscape: ${id} runs`, (await b89(page, () => window.__b89.mode)) === 'game');
  }
  check('landscape: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}
