# Kitten Cowgirl

Natalie is a little cowgirl who rides a giant, friendly tiger named Deputy. Her job: herd actual kittens into the Kitten Corral on the ranch where she lives. The kittens have opinions about this.

A mobile-first browser game built for iPhone Safari and the Home Screen. It has no backend, no accounts, no analytics and makes no network requests after the page loads.

## How to play

- **Ride:** put a thumb down anywhere and drag. A floating joystick appears under your thumb.
- **Herd:** kittens move away from Deputy, so get *behind* a kitten and push it toward the glowing corral. The arrows at the corral gate point the way in.
- **Whistle:** nearby kittens scoot in the direction you're riding. It also wakes nappers.
- **Treat:** tosses a fish cookie ahead of you. Hungry kittens come running, eat it, then follow Deputy for a while.
- Pen **6 of the 8 kittens** to win. Faster times earn more stars (3 stars under 6:00, 2 under 10:00). Golden horseshoes, treat bags and little discoveries are hidden around the ranch.

Keyboard works on desktop (WASD/arrows, Space = whistle, E = treat, Esc = pause), but nothing requires it.

### The herd

| Kitten | Personality | What that means |
| --- | --- | --- |
| Biscuit, Waffles | Hungry | Smell treats from far away, then tag along hoping for seconds |
| Pepper, Mochi | Shy | Bolt early, so push from further back |
| Marshmallow, Tater | Sleepy | Nap on a schedule, move slowly, and a whistle wakes them |
| Pickles | Curious | Wanders off to investigate yarn, boxes, ducks and chickens. Stop and wait and she comes over |
| Ziggy | Distractible | Every 16 seconds a butterfly appears, and he chases it |

Kittens in the sandy arena get the zoomies. Behaviour is seeded and deterministic, so it's learnable.

## Tech stack

- **TypeScript** with **Vite**: static build, no runtime dependencies.
- **Canvas 2D** renderer with hand-written procedural vector art for the characters, buildings, trees and props. There are no image assets apart from the app icon.
- **Web Audio**: every sound effect and the little banjo-ish loop are synthesised in code.
- **Vitest** for unit and simulation tests, **Playwright** for browser checks, and **ESLint** (typescript-eslint) for linting.

## Getting started

Requires Node 20+ (developed on Node 22) and npm.

```bash
npm install
npm run dev          # http://localhost:5173 (also exposed on your LAN for phone testing)
```

To try it on a phone during development, open the network URL Vite prints, from a device on the same Wi-Fi.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check, then build the production bundle into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest unit and simulation tests |
| `npm run test:e2e` | Browser gameplay checks against the built app (run `npm run build` first) |
| `npm run check` | lint + typecheck + tests + build |

`test:e2e` uses Playwright's Chromium with iPhone 13 portrait and landscape profiles (touch enabled). It checks the joystick, collisions, map bounds, the whistle and treat buttons, penning, the score, pause and auto-pause on backgrounding, completion, results, replay, no page scrolling, orientation changes, console errors and network requests. Screenshots go to `test-results/`. If Playwright's browser isn't installed, run `npx playwright install chromium` first.

## Deploying

The output is a static site in `dist/` with relative asset paths, so any static host works.

**Vercel:** import the repository. The framework preset is detected as Vite (build command `npm run build`, output directory `dist`). No environment variables are needed.

**Anything else:** run `npm run build`, then upload `dist/`.

To add it to an iPhone Home Screen, open the site in Safari, then Share > Add to Home Screen. It launches full-screen with its own icon.

## Project layout

```
src/
  core/math.ts          vectors, seeded RNG, hashing
  world/                map data and geometry
    ranch.ts            the ranch layout (level 1 map)
    mapTypes.ts         map data types
    shapes.ts           collision primitives (rect / circle / thick segment)
    solids.ts           derives collision geometry from the visual map
    collision.ts        spatial-hashed collision world (push-out + sliding)
    navgrid.ts          walkability grid + A* pathfinding
  game/                 simulation (no DOM)
    game.ts             Game: state, whistle, treats, pickups, penning, victory
    kittenAI.ts         kitten behaviour state machine + context steering
    kittenTypes.ts      personalities and their tuning
    player.ts           Natalie & Deputy movement
    levels.ts           level definitions (kittens, coats, targets)
    scoring.ts          score and stars
  render/               drawing only
    renderer.ts         camera, y-sorted world, effects, off-screen guides
    terrain.ts          baked, cached ground tiles
    sprites.ts          trees, buildings, fences, props, collectibles
    characters.ts       Deputy, Natalie, kittens, emotes
  ui/                   input.ts (joystick/buttons), hints.ts (contextual tips)
  audio/sfx.ts          synthesised sounds and music
  main.ts               bootstrap, screens, HUD, fixed-timestep loop
tests/                  Vitest suites + an autopilot herding bot
scripts/e2e.mjs         Playwright browser checks
scripts/make-icons.mjs  regenerates PNG icons from public/icon.svg
```

### Architecture notes

- **Simulation and rendering are separate.** `Game.step(input, dt)` runs at a fixed 60 Hz. The renderer interpolates positions, so movement is smooth and frame-rate independent on 60/120 Hz screens.
- **Collision comes from the art.** Buildings, trees, fences, round pens and props generate their own solids (`solids.ts`), so what you see is what blocks you. Kittens use A* on a walkability grid for goal-seeking, plus 16-direction context steering, so they slide along fences instead of pinning themselves in corners. A stuck detector wriggles them free if all else fails.
- **Mobile Safari performance:** the ground is baked into 256 px tiles (an LRU cache, generated a few per frame). Trees and buildings are pre-rendered sprites, the device pixel ratio is capped at 2, and the HUD is DOM that only updates when values change.
- **Adding content:** a new level is a `LevelDef` in `levels.ts` (map factory, target pen, kitten spawns, star times). New kitten varieties are a coat in `COATS` plus, optionally, a personality in `kittenTypes.ts`. The map format (`RanchMap`) is plain data.

## About the map

The ranch is traced from an aerial photo of the real property on Buffalo Gap Rd, kept at [`docs/reference/aerial.jpg`](docs/reference/aerial.jpg). One aerial pixel equals two world units, so every landmark keeps its real relative position:

- the drive along the north edge and the teardrop driveway loop with its lawn
- **Barn 89** (the main residence) west of the loop, with the trampoline and the red-mulch garden
- the second residence and its fenced yard in the north-east corner
- the white shed, and the access road winding down the west side through the trees to the barns
- the big sandy riding arena against the east fence line
- the stable and the big barn in the south-east, the walled round pen in the middle, and the round corral (the Kitten Corral) south of it
- north-west paddock fences and a chicken run, plus red-dirt creek woods running south-west
- Buffalo Gap Rd beyond the east fence, with traffic but no kittens allowed

`tests/map.test.ts` pins the main landmarks to their aerial positions. Open the game with `?overview` (for example `http://localhost:5173/?overview`) to see the whole ranch on one screen and compare it with the photo.
