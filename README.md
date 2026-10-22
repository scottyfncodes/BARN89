# Barn 89

*Our place. Our people. Our kind of chaos.*

A mobile-first family adventure set on the real Barn 89 homestead on Buffalo Gap Rd. Walk around the property, meet Megan, Jason, Jay, Natalie and Grandpa, throw a ball for the dogs, offer the donkeys a carrot (they may decline), pet the barn cats, and play everyone's games. Stars unlock rewards; ornaments and secrets are hidden around the place.

It's a static web app built for iPhone Safari and the Home Screen. No accounts, no backend, no analytics, no ads, and no network requests after the page loads. Progress is saved in the browser on each device. It does not sync between phones.

## What's in it

**The homestead.** One shared map, traced from the aerial photo in [`docs/reference/aerial.jpg`](docs/reference/aerial.jpg) (one aerial pixel = two world units). Every scene uses the same map, so the barn in Kitten Cowgirl is the barn on the map.

- The main house (west of the driveway loop) with the trampoline, red-mulch garden, doghouse and the ranch activity board
- Grandpa's house and fenced yard in the north-east, with his porch Christmas tree
- The big front lawn inside the teardrop driveway loop
- The woodshed and woodpile on the west access road
- The round pen (the donkeys' paddock), the riding arena, the stable
- **Barn 89**, the red barn in the south-east, with the old venue sign by the road, the string lights over the lawn, and a guestbook page tucked behind it
- The chicken run in the north-west and the red-dirt creek woods to the south-west

**Games and activities** (each challenge earns up to three stars; one star opens the next challenge):

| Activity | With | Challenges | How it plays |
| --- | --- | --- | --- |
| Kitten Cowgirl | Natalie | Ranch Roundup, Every Last Cat | Herd barn cats into the corral. Each cat has a personality (shy, curious, hungry, sleepy, distractible). Whistle and treats help. |
| Yard Boss | Jay | The Front Lawn, The Side Yard, Barn 89 Lawn | Zero-turn riding mower on the real lawns. Mow to the target before the clock runs out; straight passes make stripes. Trees, flower beds, toys and the dogs cost seconds. |
| Woodpile | Jason | Morning Pile, Knotty Oak, Before the Freeze | Tap when the swing meter hits the gold to split the log, then drop each piece snug on the rack. Gappy rows wobble and fall; rotten logs go on the burn pile. |
| Megan's Morning Rounds | Megan | Morning Rounds | Six chores around the homestead in any order (eggs before the kitchen), against the clock. |
| Grandpa's Treasure Hunt | Grandpa | Lost and Found | Follow five clues to his lost things, then crack his lockbox. Hints cost a star. |

**Rewards:** straw hat, Santa hat and barn cat beanie for the explorer, green and golden mower paint, Deputy the tiger (Natalie rides him in Kitten Cowgirl), Evening at Barn 89 (the string lights come on), Christmas lights with snow, and fixed string-light bulbs from Grandpa's hunt. Eight Christmas ornaments are hidden around the homestead and get hung on Grandpa's porch tree as you find them.

## Customizing the family

Everything family-specific lives in [`src/content/cast.ts`](src/content/cast.ts): names, roles, hair, clothes and hats for the five family members, and the names and coats of the two dogs and two donkeys. The barn cats are in [`src/games/kitten/levels.ts`](src/games/kitten/levels.ts). What each person says when you walk up is in [`src/content/activities.ts`](src/content/activities.ts). These are fictionalized game roles drawn from family reference photos. Annie (the big black Lab) is the real dog; Scout and the donkeys' names are placeholders until the real ones are filled in.

## Getting started

Requires Node 20+ (developed on Node 22) and npm.

```bash
npm install
npm run dev          # http://localhost:5173 (also on your LAN for phone testing)
```

To try it on a phone during development, open the network URL Vite prints from a device on the same Wi-Fi.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check, then build the production bundle into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest unit and simulation tests |
| `npm run test:e2e` | Browser checks against the built app (run `npm run build` first) |
| `npm run check` | lint + typecheck + tests + build |

`npm test` includes bots that play the games: a careful and a sloppy Woodpile player (to check the star curve), a lawn-mowing bot that must finish every lawn in time, a cat-herding autopilot, and homestead checks that every station, chore, ornament and hunt item is reachable on foot.

`test:e2e` uses Playwright's Chromium with iPhone 13 portrait and landscape profiles (touch enabled). It walks through the title, explorer picker, homestead, board, map travel, the station prompt and intro card, Yard Boss (driving, pause, restart, quit), Kitten Cowgirl, finishing a Woodpile round, results, Morning Rounds, the treasure hunt, persistence across a reload, page scrolling, console errors and network requests. Screenshots go to `test-results/`. If Playwright's browser isn't installed, run `npx playwright install chromium` first.

Debug views: `?overview` shows the whole map on one screen.

## Deploying

The output is a static site in `dist/` with relative asset paths, so any static host works.

**Vercel:** the repository is connected; merging to `main` deploys production. The framework preset is Vite (build `npm run build`, output `dist`). No environment variables are needed.

To add it to an iPhone Home Screen: open the link in Safari, then Share > Add to Home Screen. It launches full-screen with the barn icon.

## Project layout

```
src/
  main.ts               app shell: title, homestead, menus, results, the main loop
  app/                  scene adapters (kittenScene, mowerScene, woodScene), HUD, hero art, map screen
  content/              cast.ts (the family and animals), activities.ts (games, challenges, rewards)
  core/                 math, save.ts (local persistence)
  hub/                  homestead.ts (explore sim: NPCs, dogs, donkeys, cats, missions), hubView.ts, missions.ts
  games/kitten/         Kitten Cowgirl simulation, cat AI, renderer
  games/mower/          Yard Boss simulation, levels, renderer
  games/woodpile/       Woodpile simulation and side-view renderer
  render/               worldView.ts (shared map renderer), terrain, sprites, people, animals, vehicles
  world/                the map (ranch.ts), collision, navigation grid, shared world
  ui/input.ts           touch joystick, buttons, tap mode
  audio/sfx.ts          synthesised sounds and music
tests/                  Vitest suites and game-playing bots
scripts/e2e.mjs         Playwright browser checks
scripts/make-icons.mjs  regenerates PNG icons from public/icon.svg
```

### Architecture notes

- **One world, many scenes.** `sharedWorld()` builds the map, collision and nav grid once. The homestead, Kitten Cowgirl and Yard Boss all draw through `WorldView`, which owns the camera, baked terrain tiles, y-sorted buildings/trees/props, ambient animals, decorations and particles; each scene adds its own characters.
- **Simulation, input, rendering and persistence are separate.** Games step at a fixed 60 Hz with no DOM access; renderers interpolate; `Controls` turns touches into a joystick, button presses or taps; `SaveStore` is the only thing that touches `localStorage` and degrades to memory when storage is blocked.
- **Art is code.** Characters, animals, buildings and props are hand-drawn with Canvas 2D in a single storybook style; there are no image assets apart from the app icon.
- **Adding content:** a new challenge is an entry in `content/activities.ts` plus a level in the game's levels file. New rewards go in `REWARDS`. Map features are plain data in `world/ranch.ts`, and collision is derived from them.
