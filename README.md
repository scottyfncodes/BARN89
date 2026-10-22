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
- The chicken run in the clearing south-east of the treehouse, and the red-dirt creek woods to the south-west
- Grandpa's workshop, the garage under the blue star: this was Apple's workshop, where she and Grandpa fixed up and painted antique furniture for her business, Blue Star. Walk up to it and the game says so; a stray half-painted cabinet sits outside

**Games and activities** (each challenge earns up to three stars; one star opens the next challenge):

| Activity | With | Challenges | How it plays |
| --- | --- | --- | --- |
| Kitten Cowgirl | Natalie | Ranch Roundup, Every Last Cat | Herd barn cats into the corral. Each cat has a personality (shy, curious, hungry, sleepy, distractible). Whistle and treats help. |
| Yard Boss | Jay | The Front Lawn, The Side Yard, Barn 89 Lawn | Zero-turn riding mower on the real lawns. Mow to the target before the clock runs out; straight passes make stripes. Trees, flower beds, toys and the dogs cost seconds. |
| Woodpile | Jason | Morning Pile, Knotty Oak, Before the Freeze | Two steps, shown on screen as *1 Split* and *2 Stack*. Split: tap when the marker is in the gold (it lights up). Stack: tap when the drop line under the sliding piece turns green over the glowing spot on the rack. Gappy rows wobble and fall; rotten logs go on the burn pile (*Toss rotten*). |
| Megan's Morning Rounds | Megan | Morning Rounds | Six chores around the homestead in any order (eggs before the kitchen), against the clock. |
| Grandpa's Treasure Hunt | Grandpa | Lost and Found | Follow five clues to his lost things, then crack his lockbox. Hints cost a star. |
| Scooter Races | Natalie | Round the Place | Opens with Natalie's e-scooter. Everyone rides a scooter: two laps through nine gates (in through the arena, round the jumps, back across the side yard) against Jay, or against Natalie when she isn't the one exploring. Win and finish fast for three stars. |

**Life on the homestead.** People and animals keep busy while you explore:
- Megan scatters feed by the chicken run, and now and then takes Jay's mower for a couple of laps of the north lawn.
- Jason takes practice swings at the woodpile, and now and then takes Natalie out on his motorcycle: down the access road to the barns and back, round the driveway loop, and home. Exploring as Natalie or Jason, walk up to the motorcycle (parked by Jason's truck) and tap *Ride with Jason* / *Ride with Natalie* to go along; *Hop off* any time.
- Jay and Jason meet in the open north-west corner, where the chicken coop used to be, to practise Jay's sports, taking turns with football, baseball and soccer.
- Grandpa moves between his back porch (waving at the trucks on Buffalo Gap Rd), raking his front yard, and practising his putting on the green in his fenced back yard. He is deathly afraid of snakes: now and then a little garter snake turns up while he's out in the yard, he throws his arms up and hurries back to the porch, and Axel chases it off.
- Grandpa's two little black chihuahuas never leave that back yard. They yap at anyone near the fence and come and go through the doggie door in his back wall.

Everyone stops and turns to you when you walk up, and their prompt goes wherever they are (the map shows where everyone is right now). Barn cats move between their favourite spots, the dogs go off sniffing if you stand still too long, Chewy wanders over when you stop at the pen fence, and the chickens shuffle away from the wire. Family members just off screen get a small portrait marker at the edge (gold if you haven't played their game yet). After a minigame you come back to where you started, and the person whose game it was cheers if you earned a star. The family's routines and outings are in [`src/hub/family.ts`](src/hub/family.ts); the animals are in the `Homestead` class in [`src/hub/homestead.ts`](src/hub/homestead.ts).

**Around the place:** the treehouse at the south-east corner of the main house, the one giant tree in the middle of the north lawn (the Yard Boss front lawn mows around it), Grandpa's putting green, Jason's big white truck and motorcycle beside the main house, and Grandpa's (Jimmy's) dark charcoal truck on his drive by the shop.

**Animal names:** the barn cats and Grandpa's chihuahuas can be renamed from the menu (*Animal names*). Names are saved on the device and show up everywhere, Kitten Cowgirl included. Annie, Axel, Yoda and Chewy keep their real names.

**Sunday at the Barn:** an optional breakfast at the long table under Barn 89's string lights. Walk up and tap *Sunday breakfast*: the family gathers, there's a squabble over a cinnamon roll and an open gate (patched up), a short grace, a round of "one good thing from this week," and a decision about what the barn becomes now that the wedding seasons are done. The choice hangs on a board under the old venue sign. It's always available, can be left at any point, and never gives stars or rewards. A couple of quiet details sit around the homestead too: a Bible on the kitchen counter (seen through the window) and a small cross by Grandpa's door.

**Rewards:** straw hat, Santa hat and barn cat beanie for the explorer, green and golden mower paint, Deputy the tiger (Natalie rides him in Kitten Cowgirl), Evening at Barn 89 (the string lights come on), Christmas lights with snow, fixed string-light bulbs from Grandpa's hunt, and Natalie's e-scooter (three stars in Kitten Cowgirl). With the scooter on, Natalie rides it around the homestead whenever she's the one exploring, about half again as fast as walking. Unlocking it also opens Scooter Races. Eight Christmas ornaments are hidden around the homestead and get hung on Grandpa's porch tree as you find them.

## Customizing the family

Everything family-specific lives in [`src/content/cast.ts`](src/content/cast.ts): names, roles, hair, clothes and hats for the five family members, and the names and coats of the two dogs and two donkeys. The barn cats are in [`src/games/kitten/levels.ts`](src/games/kitten/levels.ts). What each person says when you walk up is in [`src/content/activities.ts`](src/content/activities.ts). The Sunday at the Barn script is in [`src/content/sunday.ts`](src/content/sunday.ts); it's written fiction meant to be edited to fit the family (set `INCLUDE_GRACE` to `false` to leave the blessing out). These are fictionalized game roles drawn from family reference photos. Annie (the ninety-pound black Lab) and Axel (the twenty-five-pound scruffy terrier) are the real dogs; Chewy and Yoda are the real donkeys. Grandpa's chihuahuas (also in `cast.ts`) start out as Pip and Peanut, which are placeholders: rename them in the game, or change the defaults there.

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
