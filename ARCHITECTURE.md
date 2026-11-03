# Chicken Farm — Phase 1 architecture

A browser game that teaches broiler farming by running a farm through a flock cycle.
**Phase 1 is the look-and-feel test:** one chicken house, the farm around it, a walking farmer and a
flock that reacts to temperature. The farmer (the user, who runs a broiler farm in Thailand) approves
the art style and the controls. Nothing beyond that is in scope yet: no saving, sound, levels, skill
tree or full content.

## Decisions already made (from the plan doc)

- Low-poly 3D, angled top-down camera that follows the farmer and can turn and zoom.
- Desktop browser, mouse and keyboard. WASD or click to walk, **E** to read a sign / use a panel,
  mouse to turn (right-drag) and zoom (wheel).
- English text. Facts sit at the place on the farm where you use them (signs), never as quizzes.
- **No "correct" / "wrong" messages anywhere.** The player reads the flock, gauges and records.
  The HUD shows measured values only (clock, flock age, house/outside temperature, humidity).
  The *target* temperature is only on the brooder heater sign (and in the Phase 1 test tools).
- Farm layout: a typical Thai tunnel-ventilated (EVAP) broiler house: cooling pad at the west end,
  tunnel fans at the east end, nipple drinker lines, pan feeder lines, gas brooders.
- A day passes in a few minutes of play; a "next job" / skip button jumps ahead.
- Every sign shows its source in small text (guide + page). Pages come from content-map.md in
  Phase 2; Phase 1 signs show the guide name and "general" for general-practice facts.
- Art: simple shapes with flat colours (`flatShading`, Lambert/Standard materials), procedural
  geometry (no external model files: the sandbox has no network for assets). The house has its
  **roof cut away** so you see inside; walls between camera and farmer drop to a stub.
- Flock: hundreds of chickens drawn at once (`FLOCK_COUNT` = 1800, InstancedMesh). They grow
  from yellow chicks to white broilers as the days pass.

## Files and owners

| File | Owner | What it is |
| --- | --- | --- |
| `src/config.js` | shared, read-only for agents | Layout, positions, palette, target temp and weight curves |
| `src/main.js` | integrator | Renderer, loop, wiring, `window.__game` test hooks |
| `src/sim.js` | systems/UI agent | Farm clock and house climate model (`env`) |
| `src/world.js` | world agent | Ground, sky, sun/day-night, farm buildings, fence, trees, paddies |
| `src/house.js` | house agent | Chicken house, all equipment, wall cutaway, equipment animation |
| `src/player.js` | player agent | Farmer model + animation, WASD/click movement, collision, camera rig |
| `src/flock.js` | flock agent | Instanced birds, behaviour, growth, metrics |
| `src/ui.js`, `src/content.js` | systems/UI agent | HUD, task list, sign + controller panels, test tools, task marker |
| `src/index.template.html` | systems/UI agent | Page template: title, fonts, HUD CSS, import map |
| `build.mjs`, `scripts/shoot.mjs` | shared tooling | Bundle to `dist/index.html`; screenshot/test harness |

Agents edit **only their own files**. If you need something from another module, code against the
contract below and note the need in your report; do not edit their file.

## Coordinates

Metres. Y up, ground at y = 0. X runs along the house (west = −X, east = +X); Z across it
(north = −Z, south = +Z). Default camera yaw 0 looks north (camera sits south of the farmer).
House interior: x −24..24, z −6..6, walls 2.6 m. Door in the south wall at x = −14 (1.8 m wide).
All positions live in `src/config.js` (`HOUSE`, `HEATERS`, `FEEDER_LINES_Z`, `DRINKER_LINES_Z`,
`SPOTS`, `FARM`, …). Use them; do not hard-code different numbers.

## Module contracts

All modules import three as `import * as THREE from 'three'` (resolved by the import map; esbuild
keeps it external). `ctx = { THREE, renderer, scene, camera, canvas, config, env }`.

### `env` (sim.js → `createSim()`)
Fields: `day` (flock age, float, day 1 = arrival), `hour` (0–24), `timeScale` (game s per real s),
`paused`, `weather` (`cool|normal|hot|rainy`), `outsideTemp`, `outsideRH`, `houseTemp`, `houseRH`,
`heaterSetpoint`, `heatersOn`, `heaterLevel` (0..1 smoothed glow), `fansOn` (0..6), `padOn`,
`airSpeed` (m/s), `lightsOn`, `targetTemp`, `windChill`, `feelsLike`, `bodyWeight` (g),
`broodCurtain` (bool), getters `isNight`, `timeLabel`.
Methods: `localTemp(x,z)` (°C a chick feels there: house air + brooder radiant − wind chill,
slightly cooler at side walls), `comfort(x,z)` (= localTemp − targetTemp; negative = cold),
`setDay`, `setHour`, `setWeather`, `setHeaterSetpoint`, `setFans`, `setPad`, `forceHouseTemp(t|null)`,
`skipHours(h)`, `update(dtReal)`, `on(event, fn)` (events: `day`, `time`, `weather`, `controls`, `*`).

### world.js → `buildWorld(ctx)` returns
`{ colliders, interactables, sun, update(dt, env, view) }`. Owns scene background, fog, hemisphere
light, the sun (a shadow-casting DirectionalLight whose shadow box follows `view.playerPos`), and
the day/night look driven by `env.hour` (sunrise 06:00, sunset 18:30; night stays readable).

### house.js → `buildHouse(ctx)` returns
`{ group, colliders, interactables, update(dt, env, view) }`. `view = { camera, playerPos, playerInside }`.
Animates: tunnel fan blades when `env.fansOn` > i, brooder glow from `env.heaterLevel`, house lights
from `env.lightsOn` (visible at night), brooding curtain shown while `env.broodCurtain`, drinker and
feeder line heights rising with `env.day`, pad water flow when `env.padOn`. Wall cutaway: any wall
between the camera and the house interior drops smoothly to `HOUSE.stubHeight` when the farmer is
inside the house or within ~6 m of it.

### player.js → `createPlayer(ctx, { colliders })` returns
`{ object3d, position (Vector3, y = 0), yaw, isInside, inputEnabled (get/set),
teleport(x, z, yaw?), setView({ yaw, distance }), update(dt) }`. Owns the camera.

### flock.js → `createFlock(ctx, { house })` returns
`{ count, update(dt, env, farmerPos), metrics() }` where `metrics()` returns
`{ count, meanDistToHeater, meanDistToWall, meanNearestNeighbor, fracHuddling, fracPanting,
fracComfortable, spreadIndex }` (distances in metres; fractions 0..1; `spreadIndex` 0 = all in one
clump, 1 = perfectly even over the usable floor).

### ui.js → `createUI(ctx, { player, flock, house, world, interactables })` returns `{ update(dt) }`.
Owns all DOM inside `#hud`. Handles **E** (nearest interactable within its `radius`), **Esc**
(close panel), sets `player.inputEnabled = false` while a panel is open.

### Colliders and interactables
Collider: `{ type: 'box', minX, maxX, minZ, maxZ }` or `{ type: 'circle', x, z, r }` (XZ plane).
Interactable: `{ id, label, x, z, radius }`. Ids in Phase 1: `sign-gate` (world), `controller`
and `sign-brooder` (house). ui.js maps ids to panel content in `content.js`.

## Climate model (sim.js, already written)
Thermostat brooders (6.5 °C/h heat), flock body heat rising with weight, leak toward the inlet air,
tunnel fans (6 × 0.42 m/s), evaporative pad (about 1 °C of cooling per 5 % RH the air can still
take up), wind chill by age (general practice). `localTemp` adds up to +7 °C radiant under a
running brooder (Gaussian, σ 1.6 m), −1 °C beside side walls, and a pad-to-fan gradient.

## Flock behaviour (what the farmer must be able to read)

| Bird feels | What you see |
| --- | --- |
| Cold (comfort < −1.5 °C) | Tight huddles right under the brooders, sitting, little walking |
| Right (within ±1.5 °C) | Evenly spread, walking, eating at feeder pans, drinking at nipple lines, some resting alone |
| Hot (comfort > +1.5 °C) | Away from brooders, spread out along the side walls and toward the pad end, sitting with wings held out, panting (fast head bob, open beak) |

Birds also step away from the farmer (a moving clearing around him) and stay inside the brooding
area (west of the curtain at x = 2) while `env.broodCurtain` is true.

## Build, run, test

```
npm install                 # three 0.160.0 + esbuild
npm run build               # -> dist/index.html (single page, three from jsDelivr)
node scripts/shoot.mjs      # build + "tour" scenario screenshots into shots/
node scripts/shoot.mjs --scenario walk --out /tmp/x
node scripts/shoot.mjs --steps my-steps.json --no-build
```
The harness serves the page exactly as the artifact viewer wraps it, maps the three.js CDN URL to
`node_modules/three`, blanks Google Fonts (no network in the sandbox), prints console errors,
page errors and flock metrics. Headless Chromium renders WebGL with SwiftShader (software), so
expect 3–10 fps there; that is not the real frame rate. Look at your screenshots with the Read
tool, they are PNGs.

`window.__game` hooks: `setState({ day, hour, weather, setpoint, fans, pad, houseTemp (null to
release), heaterLevel, paused, farmer: {x, z, yaw}, cameraYaw, zoom })`, `settle(sec)`,
`advance(sec)`, `metrics()`, `snapshot()`, `renderNow()`.

## Publishing constraints (claude.ai artifact)
- `dist/index.html` is published as one page; the viewer adds `<!doctype>`, `<head>` and `<body>`.
- Scripts only from cdn.jsdelivr.net/npm (three 0.160.0 via the import map). No other network:
  no fetch, no external images or models, no esm.sh. Fonts only from Google Fonts with fallbacks.
- No `alert/confirm/prompt`, no `window.open`, no downloads. `localStorage` must be in try/catch.
- At phone width (~400 px) nothing scrolls sideways; show a short note that the game needs a
  desktop with a keyboard and mouse.
- Respect `prefers-reduced-motion` for UI animation.
- Performance target: 60 fps on a mid-range laptop with 1800 birds. Share geometries and
  materials, use InstancedMesh, avoid per-frame allocations, keep draw calls low (merge static
  geometry where it is repeated many times, e.g. feeder pans and nipples).
