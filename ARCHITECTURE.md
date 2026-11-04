# Chicken Farm — architecture (Phases 1, 2 and 3)

A browser game that teaches broiler farming by running a farm through a flock cycle.
**Phase 1** was the look-and-feel test: one chicken house, the farm around it, a walking farmer and
a flock that reacts to temperature. It lives on as the **sandbox** mode. **Phase 2** is the Level 1
vertical slice (the prep day and the brooding week, days −1..7), specified in `PHASE2.md` and
integrated on main: title card, job list and daily rounds, signs and equipment plates, the farm
model, flock records, the skill tree (11 branches, two earnable), problem events, pass / fail at the
day 7 weigh-in, autosave. The Phase 1 sections below are still valid; **"Phase 2 (Level 1)"** at the
end lists the modules, the contracts as integrated, and the tests. **Phase 3** (the full flock cycle:
seven levels on one flock from the plan to the rested house, all eleven skill branches) is specified in
`PHASE3.md` and integrated on main: see **"Phase 3 (the full flock cycle) — as integrated"** at the end.
Not in scope yet: sound, settings, farm overview map (Phase 5), harder replays (Phase 4).

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
- Every sign shows its source in small text: the guide's name (one of the six guides in
  `config.GUIDES`), or "general practice". No page numbers: the guide PDFs and content-map.md are
  not in this repo, so only the facts listed in PHASE2.md §6.1 (and, provisionally, the bare week topics
  of PHASE3.md §5.1) carry a guide name.
- Art: simple shapes with flat colours (`flatShading`, Lambert/Standard materials), procedural
  geometry (no external model files: the sandbox has no network for assets). The house has its
  **roof cut away** so you see inside; walls between camera and farmer drop to a stub. From the yard
  (farmer more than 8 m away) the roof is on; it dissolves between 8 and 6 m, before the walls drop.
  An invisible shadow-only roof keeps the litter in shade at every hour, as under a real roof.
- Flock: hundreds of chickens drawn at once (`FLOCK_COUNT` = 1800, InstancedMesh). They grow
  from yellow chicks to white broilers as the days pass.

## Files and owners

| File | Owner | What it is |
| --- | --- | --- |
| `src/config.js` | shared, read-only for agents | Layout, positions, palette, target temp and weight curves |
| `src/main.js` | integrator | Renderer, loop, wiring, `window.__game` test hooks |
| `src/sim.js` | systems/UI agent | Farm clock and house climate model (`env`) |
| `src/world.js` | world agent | Ground, sky, sun/day-night, farm buildings, fence, trees, paddies |
| `src/house.js` | house agent | Chicken house, all equipment, wall cutaway, equipment animation (`house-roof.js`: roof, shade, fades) |
| `src/player.js` | player agent | Farmer model + animation, WASD/click movement, collision, camera rig |
| `src/flock.js` | flock agent | Instanced birds, behaviour, growth, metrics |
| `src/ui.js`, `src/content.js` | systems/UI agent | HUD, task list, sign + controller panels, test tools, task marker |
| `src/index.template.html` | systems/UI agent | Page template: title, fonts, HUD CSS, import map |
| `build.mjs`, `scripts/shoot.mjs` | shared tooling | Bundle to `dist/index.html`; screenshot/test harness |
| `src/events.js`, `src/interact.js` | integrator | Phase 2 event bus (`EV`, `matchPayload`) and the interactable registry |
| `src/farm.js`, `src/farm-*.js`, `src/records*.js`, `src/skills*.js`, `src/save.js` | sim | Farm model, problems, profiles, records, skill rules, autosave store (no DOM, run in node) |
| `src/level.js`, `src/job-engine.js`, `src/content-jobs.js`, `src/content-signs.js`, `src/ui-*.js` | level | Level flow, jobs, every Level 1 panel, sign and job content |
| `src/props.js`, `src/props-*.js`, `src/house-level.js`, `src/player-carry.js` | props | Level 1 props, triggers, trucks, boxes, boards, floor states and overlay, carried things |
| `src/flock-level.js`, `flock-pop/dead/catch/sick.js` | flock | Level 1 population, dead and sick birds, catching, access behaviour |
| `src/run.js`, `src/ui-run.js`, `ui-letters.js`, `ui-summary.js` (+ level.js, job-engine.js, the core ui) | run (Phase 3) | The run of seven levels: chaining, saved starts, replays, the run card, letters, the cycle summary |
| `src/farm-cycle*.js`, `farm-house/health/silos/harvest/clean.js`, `farm-profiles-cycle*.js`, `records-cycle.js`, `skills-rules-cycle.js` | sim (Phase 3) | The farm model from Week 2 to the rested house, the cycle profiles, records pages, milestone rules, the run store (`save.js`) |
| `src/ui-cycle-*.js` (+ ui-climate/water/equipment/inspect.js) | panels (Phase 3) | Every new equipment and inspection panel and the Phase 3 parts of the Phase 2 panels |
| `src/props-cycle-*.js`, `props-air/catch/overlay/pictos/tools.js`, `flock-cycle.js`, `flock-harvest.js`, `house-door/fans/pad.js` | scene (Phase 3) | Boards, yard props, hand tools and painting, floor views, the catching night, the grown flock, the house's Phase 3 states |

Agents edit **only their own files**. If you need something from another module, code against the
contract below and note the need in your report; do not edit their file.

## Coordinates

Metres. Y up, ground at y = 0. X runs along the house (west = −X, east = +X); Z across it
(north = −Z, south = +Z). Default camera yaw 0 looks north (camera sits south of the farmer).
House interior: x −24..24, z −6..6, walls 2.6 m. Door in the south wall at x = −14 (1.8 m wide).
All positions live in `src/config.js` (`HOUSE`, `HEATERS`, `FEEDER_LINES_Z`, `DRINKER_LINES_Z`,
`FEEDER_PAN_X`, `NIPPLE_X`, `FEED_INLET`, `SPOTS`, `FARM`, …). Use them; do not hard-code different numbers.
- `FEEDER_PAN_X` / `NIPPLE_X`: the exact x of every pan and nipple. The house draws them there and
  the flock eats and drinks there.
- `FEED_INLET`: where the silo feed auger passes the north wall. The world's auger from the silo
  boots ends at the outside face of the wall there; the house's cross auger continues inside.
- `SPOTS.signBrooder` (x −16) and `SPOTS.controller` (x −12) hang on north-wall columns across from
  the door, facing south, so the default camera reads their fronts; stand at z ≈ −4.6 and press E.

## Module contracts

All modules import three as `import * as THREE from 'three'` (resolved by the import map; esbuild
keeps it external). `ctx = { THREE, renderer, scene, camera, canvas, config, env }`.

### `env` (sim.js → `createSim()`)
Fields: `day` (flock age, float: day = N + hour / 24, so the whole number changes at midnight; the
game starts on day 1 at 08:00 = 1.333), getter `dayNumber` (the whole flock day N; use it for every
"Day N" label), `hour` (0–24), `timeScale` (game s per real s),
`paused`, `weather` (`cool|normal|hot|rainy`), `outsideTemp`, `outsideRH`, `houseTemp`, `houseRH`,
`heaterSetpoint`, `heatersOn` (burners lit: output above 2 %), `heaterDemand` (0..1 output the
thermostat asks for), `heaterLevel` (0..1 actual output, follows the demand within a few game
minutes; drives heat, glow and radiant), `fansOn` (0..6), `padOn`,
`airSpeed` (m/s), `lightsOn`, `targetTemp` (= `targetTempAt(dayNumber)`, so day 1 is 34 °C all day,
as on the brooder sign), `windChill`, `feelsLike`, `bodyWeight` (g),
`broodCurtain` (bool), getters `isNight`, `timeLabel`.
Methods: `localTemp(x,z)` (°C a chick feels there: house air + brooder radiant − wind chill,
slightly cooler at side walls), `comfort(x,z)` (= localTemp − targetTemp; negative = cold),
`brooderHeat(x,z)` (the brooder radiant part of localTemp, °C), `setDay` (keeps the time of day),
`setHour`, `reset()`, `setWeather`, `setHeaterSetpoint`, `setFans`, `setPad`, `forceHouseTemp(t|null)`,
`skipHours(h)` (lands on a whole minute), `settleHeaters()` (test hook: output jumps to the demand),
`update(dtReal)`, `on(event, fn)` (events: `day`, `time`, `weather`, `controls`, `*`).
`MAX_DAY` (42, exported): the HUD time jumps never run the clock past the end of day 42.

### world.js → `buildWorld(ctx)` returns
`{ colliders, interactables, sun, night, update(dt, env, view) }` (`night`: 0 day .. 1 full night,
which main.js passes on as `view.night`). Owns scene background, fog, hemisphere
light, the sun (a shadow-casting DirectionalLight whose shadow box follows `view.playerPos`), and
the day/night look driven by `env.hour` (sunrise 06:00, sunset 18:30; night stays readable).

### house.js → `buildHouse(ctx)` returns
`{ group, colliders, interactables, feeders, drinkers, update(dt, env, view) }`.
`view = { camera, playerPos, playerInside, night }` (`night` from the world, so the house lights
switch with the yard lamps). `feeders = { z, panX, rimHeight(day) }`, `drinkers = { z, nippleX, nippleHeight(day) }`.
Animates: tunnel fan blades when `env.fansOn` > i, brooder glow from `env.heaterLevel`, house lights
from `env.lightsOn` (full at night, a third by day: the shade roof keeps the sun off the litter),
brooding curtain shown while `env.broodCurtain` (and the brooders winched up 0.62 m once it is gone),
drinker and feeder line heights rising with `env.day`, pad water flow when `env.padOn`. Wall cutaway:
any wall between the camera and the house interior drops smoothly to `HOUSE.stubHeight` when the
farmer is inside the house or within ~6 m of it; the column tops and eave beam on that side drop with
it (the two board columns stay). The roof and rafters dissolve between 8 and 6 m; the truss tie beams
stay but dither away where they cross the camera's sight line to the farmer; the door portal and
canopy fade while the farmer is at the door or inside with the camera on the south side.

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
Interactable: `{ id, label, x, z, radius, inside? }`. With `inside` set, it only answers when
`player.isInside` matches (the indoor boards cannot be used through the north wall). Ids in Phase 1:
`sign-gate` (world), `controller` and `sign-brooder` (house). ui.js maps ids to panel content in
`content.js`; E and H are matched by physical key (`KeyboardEvent.code`) so a Thai layout works.

## Climate model (sim.js, already written)
Modulating brooders (up to 6.5 °C/h heat; output 1 at 1.2 °C below the setpoint down to 0 at 0.3 °C
above it, so there is no on/off flicker at game speed), flock body heat rising with weight, leak toward the inlet air,
tunnel fans (6 × 0.42 m/s), evaporative pad (about 1 °C of cooling per 5 % RH the air can still
take up), wind chill by age (general practice). `localTemp` adds up to +7 °C radiant under a
running brooder (Gaussian, σ 1.6 m), −1 °C beside side walls, and a pad-to-fan gradient.

## Flock behaviour (what the farmer must be able to read)

| Bird feels | What you see |
| --- | --- |
| Cold (comfort < −1.5 °C) | Tight huddles right under the brooders, sitting, little walking. With no brooder running: tight piles at fixed huddle sites between the lines (about one per 120 birds) |
| Right (within ±1.5 °C) | Evenly spread, walking, eating at feeder pans, drinking at nipple lines, some resting alone |
| Hot (each bird from its own threshold, +1.5 to +4.5 °C) | Away from brooders, spread out along the side walls and toward the pad end when fans run, sitting with wings held out, panting (fast head bob, open beak). The share of panting birds, wing spread and panting grow with the heat |

Birds also step away from the farmer (a moving clearing around him) and stay inside the brooding
area (west of the curtain at x = 2) while `env.broodCurtain` is true. When the curtain lifts with the
clock running, the share of the flock that belongs on the new floor walks out to it (about a minute);
when it lifts during a time jump, the flock is re-placed over the whole house. Birds in a brooder's
glow pool get its warm light too (shader), so they stay brighter than the litter. The flock casts no
shadows (the litter is always in roof shade).

## Build, run, test

```
npm install                 # three 0.160.0 + esbuild
npm run build               # -> dist/index.html (single page, three from jsDelivr)
node scripts/shoot.mjs      # build + "tour" scenario screenshots into shots/
node scripts/shoot.mjs --scenario walk --out /tmp/x
node scripts/shoot.mjs --steps my-steps.json --no-build
node scripts/shoot.mjs --steps scripts/phase1-jobs.json   # the four Phase 1 jobs end to end
```
Steps files that call `__game.stop()` drive the game with `advance`; `{"holdKey": "w", "for": 0.6}`
holds a real key while advancing and `{"clickOn": "css selector"}` clicks a page element.
The harness serves the page exactly as the artifact viewer wraps it, maps the three.js CDN URL to
`node_modules/three`, blanks Google Fonts (no network in the sandbox), prints console errors,
page errors and flock metrics. Headless Chromium renders WebGL with SwiftShader (software), so
expect 3–10 fps there; that is not the real frame rate. Look at your screenshots with the Read
tool, they are PNGs.

`window.__game` hooks: `setState({ day, hour, weather, setpoint, fans, pad, houseTemp (null to
release), heaterLevel, paused, farmer: {x, z, yaw}, cameraYaw, zoom })`, `settle(sec)`,
`advance(sec)`, `metrics()`, `snapshot()`, `renderNow()`. In setState, `heaterLevel` 1 / 0 forces the
brooders full on / off; a `setpoint` or `houseTemp` without it lets the thermostat pick the level
at once (`env.settleHeaters()`), so the HUD, glow and radiant heat always agree.

## Publishing constraints (claude.ai artifact)
- `dist/index.html` is published as one page; the viewer adds `<!doctype>`, `<head>` and `<body>`.
- Scripts only from cdn.jsdelivr.net/npm (three 0.160.0 via the import map). No other network:
  no fetch, no external images or models, no esm.sh. Fonts only from Google Fonts with fallbacks.
- No `alert/confirm/prompt`, no `window.open`, no downloads. `localStorage` must be in try/catch.
- At phone width (~400 px) nothing scrolls sideways; show a short note that the game needs a
  desktop with a keyboard and mouse.
- Respect `prefers-reduced-motion` for UI animation.
- Renderer (main.js): pixel ratio capped at 1.5 and re-read on resize; a frame-time governor steps
  down to 1.0, then 0.85, then a 1024 PCF shadow map if the median frame is slower than ~50 fps
  (off under automation); every shader program is compiled behind the boot card; the loop survives
  a thrown frame and stops with a message after three in a row. `ctx.perf = { fps, pixelRatio,
  shadowMap }` feeds the test tools' frame-rate readout.
- Performance target: 60 fps on a mid-range laptop with 1800 birds. Share geometries and
  materials, use InstancedMesh, avoid per-frame allocations, keep draw calls low (merge static
  geometry where it is repeated many times, e.g. feeder pans and nipples).

## Phase 2 (Level 1) — as integrated

`PHASE2.md` is the spec (jobs, model, problems, records, skills, contracts §13). This section lists
how the four packages are wired on main and every contract that changed at integration.

### Modes
`level.mode`: `title` (title card over the farm at dawn; real browsers boot here) · `sandbox` (the
Phase 1 farm exactly as before: 4-job tutorial, test tools; the boot mode under automation, so
every Phase 1 harness scenario still runs) · `level` · `result` (result screen; *Keep walking the
farm* returns to `level` with the level over). `farm.mode` is `'level'` only while a level runs
(`farm.start` / `farm.stop`); with it `env.levelClimate` is on (slab, timer, humidity balance,
brooders out). Props are hidden and the flock uses its Phase 1 tables while `farm.mode === 'off'`.

### Wiring (main.js)
Created in this order: `env` → `events` → `farm` (`env.addStepper(farm.step)`: the farm integrates
every ≤ 60 game s, skips included) → `records` → `skills` (both subscribe to the bus) → `save` →
world → house → `interact` (world and house boards) → `props` (registers its interactables and
providers) → `colliders` (world + house + props; props adds its own in level mode only) → `player`
→ `flock` (providers) → `ui` → `level`. `ctx` carries `events, farm, records, skills, interact,
props, colliders, player, flock, level`. Frame order: env → player → world → house → props → flock
→ ui → level. The hot-reload snapshot carries `level.saveBlob()` while a level runs.

### Clock (level.js, every frame)
`env.timeScale` from `LEVEL1.clock`, highest state wins: paused (records book, notebook, skill
tree, result, title, the pause button) > `sign` 0 (a sign board, or an equipment panel whose
plate is unfolded) > `panel` 30 > `carry` 30 (barrow, boxes, sack, frame; and from the truck
stopping until the last tip) > `fast` 480 (4×) > `work` 120. Equipment plates open unfolded;
every machine action that needs farm time folds them (flow test, flush valves, filter cleaning,
feeder *Running* / *Flood on*, *Weigh next* / *Weigh all*).

### Contracts that changed or were settled at integration
- **E** (ui.js): in a level `interact.nearest(player, accept)`; an interactable with `use()` is
  used, else the ui panel registered under its id opens. In the sandbox only the three Phase 1
  boards answer. **`interact.nearest`**: highest `priority`, then the nearest, where what the
  farmer faces counts up to 0.45 m nearer (`player.yaw`; facing = (−sin yaw, −cos yaw)), so of two
  machines side by side the one he turns to answers. An interactable may give `nearRadius` /
  `nearPriority`: within that distance it competes with the near priority (the dead-bird provider:
  6, but 15 within 0.8 m, so a bird at his feet beats the north-wall board whose 2 m reach he stands in).
- **Feeder control box** moved to `SPOTS2.feederBox` x −18 (between the water and brooder signs):
  at x −22 it sat 0.9 m behind the line 1 drinker regulator, which always won.
- **Controller** (ui-climate.js): *min / max since read* = `farm.controllerMemory()`; the farm
  restarts it on the `controller.read` action (and saves it). Tunnel fan ± steps
  `env.setFans(env.fansManual ± 1)`: in a level `env.fansOn` also counts the timer fans during the
  on-part of each cycle. `vent.timer` / `light.program` actions: the farm calls
  `env.setVentTimer` / `env.setLightProgram` itself.
- **`records.timeline()`** rows (result screen "Your week"): `{ day, setpointC, signSetpointC,
  flowsMlMin[4], flowSignMlMin, nippleHeightsCm[4], nippleSignCm, ventTimer, ventTimerM3h,
  ventSignM3h, lightHours, floorAtArrivalC, cropTally: { full, of }, weightG, targetWeightG }`.
- **Props follow every `chicks.tip`**: a stack tipped without the hand truck (goto auto) goes to the
  pile of empties. The **`frame` provider** answers nowhere within 1.8 m of the bird scale, so E
  there opens the scale (*Put them back*).
- **Dead birds**: the farm owns `farm.flock.deadOnFloor` (+1 per death, −n on `EV.DEAD_PICK`); the
  flock lays one drawn bird per death by cause and mirrors the count after 1 s (oldest go first).
- **Floor thermometer view** (F, unlock `floorOverlay`): `config.FLOOR_TEMP_RAMP` (24 → 36 °C, blue
  to orange, sRGB) is painted by props-floor and drawn as the HUD legend by ui.js.
- **Autosave size**: the job engine saves closed jobs as `[key, status, opensAt, closesAt, doneAt]`
  (rule state only for sample counts; results live in `records.logJob`, a count job's as
  `{ n, sectors, values }`); records save notebook lines as `[day, hour, kind, value, where?]`, make
  one setting line of a control stepped many times in a row, and skip a look note with the same
  words as the last one within the hour. Measured after the real-input play-through: see
  PHASE2.md §11 (target 60 KB; localStorage holds megabytes, so a bigger save still works).
- **Resume** (`level.resume(blob)`): skill profile (`loadProfile`, so Continue and the hot reload
  never start from empty skills) → `ui.newRun()` → clock → `farm.start(LEVEL1, { keepClock: true })`
  → saved env values (setpoint, house, slab, humidity, heater level, manual fans, pad) →
  `farm.restore` (timer, light, weather events, brooders out) → records → props → flock (a carried
  chick is dropped: it is not in the flock's save, and `props.serialize` never saves one) → level
  jobs. `saveBlob().env` carries `fansManual` and `houseRH`. main.js snapshots `levelSave` for the
  hot reload only while a level runs (not after its end).
- **A new run** (`ui.newRun()`, called by `level.start` and `level.resume`): every built panel is
  rebuilt, the job card, captions, the controller chart and memory, the last flows and the weighings
  of the run before are cleared (Replay and Back to the title then Start).
- **Skips** (`level.skip`): after `env.skipHours` the level calls `flock.afterSkip(hours)`; a jump of
  30 game minutes or more flushes the spill queue and re-places the free drawn birds over the floor
  (penned and sick birds stay), so the flock never shows tip piles as cold huddles after *Next job*.
- **Keep walking** after the end: the clock runs to 23:59 on day 7 and stands (no day wrap; the farm
  stops with it).
- **Spawn**: the player is clamped to `FARM.walk` (the fence rectangle plus the first 5 m of the walled
  farm road outside the gate, z ≤ 43), so the spawn is not pulled into the gateway on the first frame.
  A level starts and each morning begins outside the gate (`FARM.spawn` −40, 40.5,
  facing north) and the gate foot dip lies across the gateway (`FARM.footDipGate` −40, 36.9, half
  sizes 2.2 × 0.5 m), so walking onto the farm crosses it. The sandbox keeps its Phase 1 start just
  inside the gate (`FARM.spawnSandbox`).
- **Records** (review round 2): the notebook writes each control as the farmer would ("Line 2 winch:
  nipples at 11 cm", "Min. vent timer: 1 fan, 9 s in every 300 s") and places as "west part, south
  side"; a missed job goes on the row of its own day by title; the week table shows one line of
  numbers per day and the day's notes in a full-width row under it; the job log is saved as
  `[key, day]` (nothing reads its results).
- **`level.debug.goto(day, hour, { auto })`** (a prep round already past due when goto is called
  is played at once): auto plays the ideal profile through
  `farm-profiles.applyRound` at the rounds test-sim plays (prep unless the prep record is signed,
  flush, morning 06:15 / 06:30, truck 08:06, vent first tip + 2.6 h, crop first tip + 23 h,
  afternoon, day 6 warm-afternoon timer 12:00–17:00, day 7 weigh 09:00), picks up and counts the dead birds
  after each round, signs each evening, and completes the jobs still open. Without auto it skips.

### Tests and harness
- `npm test` = `scripts/test-contracts.mjs` (registry priority, action shapes, banned words) +
  `scripts/test-sim.mjs` (§6.10 profiles, determinism, timing, save) + `scripts/test-jobs.mjs` (job
  engine) + `scripts/test-level.mjs` (level.js with the real farm, records and skills in node:
  `goto(7, 21, auto)` ends on the day 7 signing with a pass at 4.6–4.95 ×, both branches level 2,
  no routine job missed; a week without care fails; save → resume keeps clock, jobs, farm and
  humidity; no hand weighing uses the scale at age 7.0; a late goto still pre-heats; resume keeps
  the skill profile; keep walking stops at 23:59).
- Harness steps for play-throughs (`scripts/shoot.mjs`, with `__game.stop()`): `walkTo [x, z]`
  (real mouse clicks on the ground: the farmer's click-to-walk and path finding, leg by leg),
  `clickText` (real click on a visible HUD button / tab by its text or aria-label, `times`),
  `pressIf` (a real key only while a condition holds), `advanceUntil`, `expect` (PASS / FAIL; a
  FAIL makes the exit code 1).
- **Integrator play-throughs**: `scripts/p2-level1.json` — the title card, the whole prep day by
  walking and panel clicks, `goto(0, 7.9, auto)`, the truck, box weighing and grading, six stacks
  tipped by walking (placed-fast ≤ 90 game min), vent temperatures, `goto(7, 8, auto)`, 50 birds
  weighed from 5 sectors with the frame, signing day 7, the result screen (pass, 4.6–4.95 ×).
  `scripts/p2-level1-find.json` — day 4: the meter shows the drop, a flow test opens *Low water flow*,
  cleaning the filter closes it; walking past the wet patch at 15:00 opens *Wet litter here*, E at
  the drip replaces the nipple, a sack of husk patches the cell.
- Package steps files: `p2-level-*.json` (level; written against the stubs, they now start from a
  `goto(auto)` level; `p2-level-prep` / `p2-level-day0` say at the top that they are panel demos
  that check nothing), `p2-flock-events.json` (drives the real farm: 22 `expect` checks, a FAIL sets
  the exit code; the clock held by the HUD pause hook, which now sets `env.paused` at once; the chick
  provider checked while the *Next job* skip has the vent window open, then five vent samples close
  it so the sick-bird check is not shadowed by the sampling chick provider), `p2-flock-look/perf.json`, `p2-props-*.json`. Review round 2:
  `scripts/p2-review2.json` (spawn and gate dip, Replay resets the grading table and chart, flock
  spread after a skip, a save with a chick in the hand) and `scripts/p2-review2-ui.json` (drinker
  view, water supply at 960 × 600, sign sources, HUD rate slot, job card, notebook words, week
  table rows, skill tree, floor legend). Phase 1: `tour`, `cold-hot`, `walk`, `p2-hooks` scenarios,
  `scripts/phase1-jobs.json`, `systems-phone.json`, `systems-tasks.json` in the sandbox.
- `window.__game` Phase 2 hooks: `events, farm, records, skills, save, props, interact, level`,
  `startLevel({ seed })`, `nextJob()`, `jobs()` (key, status, progress), `snapshot()` with `mode` and
  `farmMode`, `ui.openPanel(id)`, `level.debug.goto / trigger / result`, `farm.debug.trigger /
  truth()`. Steps files start a level with `{"eval": "__game.startLevel({ seed: 1 })"}` or from the
  title (`__game.level.toTitle()` then `{"clickText": "Start Level 1"}`).

## Phase 3 (the full flock cycle) — as integrated

`PHASE3.md` is the spec (§13 the contracts, §14 the four packages). The packages `sim`, `scene`, `panels` and
`run` were merged in that order with `--no-ff` (no file was touched by two packages); this section lists the
wiring and every contract that changed or was settled at the merge.

### The run (run.js + level.js)
Seven levels on one flock (`config.LEVELS`): Plan the farm (day −2) · the brooding week (Phase 2's Level 1,
days −1..7) · Week 2 · Week 3 · Weeks 4 and 5 (saved starts on day 22 and day 29) · Finishing and harvest ·
Clean-out and rest (to the booked chick day, at least 21 days after the house closed). `run.startRun({ seed, at })`,
`next()` (Continue: `level.enter(def)` keeps the farm and the flock, skips the night, `farm.enterLevel`, the
level's jobs), `replay(id, { day })`, `startLevel(id, { from: 'saved' | 'standard' })` (standard: the ideal
farmer plays to the level's start), `continueSave()` (a Phase 2 save continues as a run at the brooding week),
`state()` `{ levelId, seed, plan, levels, summary, conditions, lastCycle }`, `card()`. A failed level's screen
offers *Replay <level>* (its saved starts) and *Replay <previous level>* with the record lines it carried
over ("vaccine drunk in 4.4 h on day 12"); the last level's pass gives *See the cycle summary*.

### Wiring (main.js)
Phase 2's order, then `run = createRun({ level, save, events, farm, env, records })` (`ctx.run`; it calls
`level.attachRun`). ui.js calls `registerCyclePanels({ register, L, boards, plate, sourceLabel, openPanel })`
after the Phase 2 panels. `window.__game` adds `run`, `startRun`, `startLevel({ level, from })`, `cycleAt(day,
hour)` (`level.debug.freeRun`) and `config` (the config module: steps files read the signs' numbers).

### Contracts changed or settled at the merge
- **Stub fallbacks removed.** run.js uses `save.js createRunStore` (its own local store is gone) and
  `records.cycleSummary`; a Phase 2 save comes from `migratePhase2().blob`. level.js reads the farm's
  `stats.levelStart` and `stats.scaleAt[day]` only (it keeps no counters of its own) and the stub fan thermostat
  `climateCare` is gone from level.js and farm-profiles-cycle.js. ui-letters reads `records.harvestPage()` /
  `cleanPage()`. The panels take the farm's answers as given (`pad.check`, `load.ticket`, `gas.meter`,
  `env.heatBudget()`), and read the main valve (`farm.health.mainClosed`), the medicator, the withdrawal, the
  slide valves (`farm.feed.valves`), the washed items and pans (`farm.clean`) and the two silos from the farm.
  The scene reads `env.broodersUp`, `env.padWorking`, `farm.feed.valves`, `farm.health.mainClosed`,
  `farm.harvest.panels` without fallbacks.
- **New shared state:** `farm.health.droppings` (the flock's main droppings look; the scene's floor colour,
  §13.5); `config.GAS_TANK_KG` (500 kg; the farm's `gas.meter` and the scene's gauge); `run.state().lastCycle`
  `{ plan, summary }` (kept across *Start a new flock* and in the run save; the plan sheet's `planCarry`).
- **All eleven skill branches earnable** (`config.SKILL_BRANCHES[i].earnable`); the skill tree shows each
  branch's next unlock.
- **Vet letters** come from `farm.health.vet` (saved with the farm), so they survive a reload.
- **Payloads as built:** `light.preset { preset }` (an `id` arg would overwrite the action id; PHASE3.md §13.3
  updated); `fans.read { fans, houseC, rh, speedMs, pad }` (the reading at 2 s open, once per opening);
  `vent.stages` off = `{ stages: null, padOverC: null }`; `feed.order` → `{ arriveDay, arriveHour, kg, type,
  silo, roomKg }`; `feed.silo` → `{ kg, silos }`; `litter.patch` → `{ onLeak, onPad }`; `water.flush` →
  `{ flushClear, disinfected }` (a line is disinfected at once while the header tank holds disinfectant).
- **Records:** the day's row is drawn when the record is signed; the week table's *Tunnel fans (most)* and
  *Pad on* are what the farmer read at the fan panel that day (`fans.read`), not a hidden log.
- **Sign sources (§5.1):** three guide-tagged lines that carried a cause or a rule were split into the bare
  guide topic and a general line (sign-air breathing sounds, sign-air minimum ventilation, the vaccine plate).
- **Look notes** say "birds" from day 8 (the brooding week keeps "chicks"); an empty house reads as such.
- **The vaccine walk** (`farm-cycle-act.js`, EV.CELL while the birds drink the vaccine) counts the cells within
  the farmer's 2 m sight, as the walk jobs do: counting only the cells he stepped on, the model's 30 % meant
  walking nearly all of the 1.5 h of drinking, and the plate's vaccination by real input got coverage 0.86
  (0.96 now; the ideal's `noteWalk` is unchanged, so test-cycle is not affected).
- **test-cycle bands (integrator):** `noStep` is measured against the ideal (night RH ≥ +2.5 points, litter on
  day 14 ≥ +2 points, NH3 the night of day 14 ≥ +1.5 ppm, day 21 ≥ 0.2 % under): the absolute bands could not
  hold in a heated week-2 house (PHASE3.md §6.16). `minVentW3` heat deaths ≤ 0.07 % (one bird over 0.05).

### Tests and harness
- `npm test` = test-contracts, test-sim (Phase 2 unchanged: ratio 4.873, FCR 0.840), test-jobs (26), test-level,
  **test-cycle** (climate, growth and plan checks; 23 profiles incl. the ideal: every level passes, harvest
  2,887 g live, FCR 1.58, mortality 2.35 %, EPEF 427; determinism; whole cycle 2.5 s; 24 h skip about 80 ms;
  level starts 8–140 KB, the day 41 blob 149 KB) and **test-run** (the chaining tests on the real sim: a
  scripted plan, Continue to Week 2, goto(auto) through every level with the cycle summary, a failed week 3
  replayed from its identical saved start, poorVaccineCocci → *Replay Week 2* → week 3 passes, the two weeks
  4–5 starts, a standard start in about 1 s, run start blobs 10–227 KB, a Phase 2 save continuing as a run).
- Harness additions (`scripts/shoot.mjs`): `{"walkToExpr": "js"}` walks to a point worked out in the page (the
  nearest dead bird or bird), `{"clickTextUntil": "One second more", "until": "js"}` presses a button until the
  display shows the number (the farmer reading a sign and setting a control).
- Package steps files (all pass on main): `p3-run-title/chain/replay/ui`, `p3-panels-plan/week2/heat/harvest/
  clean/shots`, `p3-scene-look/events/perf`, `p3-design-stubs`.
- **Integrator play-throughs**, generated by `node scripts/p3-cycle-steps.mjs` (helpers for the routes and the
  daily rounds; `--dev <segment,...> <file>` writes one part, `start:<level>` begins at a standard start):
  `scripts/p3-cycle.json` — title → *Start a new flock* → the planning day by walking (gate dip and sign,
  guard hut, the planning sign, the contract letter, the tape at both end walls and across, the sheet typed in
  and sent, the reply, signed) → `goto(7, 21, auto)` → **day 8 by real input** (every routine job, the light
  program, lux with L at three places, the timer by the vent sign, the lines raised) → day 10 the curtain at
  the winch → day 12 the vaccine at the water supply (main valve shut 1.5 h, stabiliser, open, the birds walked
  up) → week 2 result → **day 16 by real input** (ten droppings checks in the hand, six fans for the warm
  afternoon) → **day 25 by real input** (the hot afternoon: six fans, the pad) → day 27 the stopped fan found
  by walking past it and fixed with E → the heat wave at the fan panel → **day 37 by real input** (the crew
  booked on the phone) → the catching night watched from the house and the yard, the tickets read →
  **day 44 by real input** (three washer passes, the lines disinfected, the pans washed, the fans to dry) →
  `goto(67, 7, auto)` → every level passed, the cycle summary. `scripts/p3-replay.json` — week 2 from its
  standard start, a poor vaccination by real clicks (no thirst, no stabiliser), week 3 with the coccidiosis
  left untreated fails, the fail screen offers *Replay Week 2* with "vaccine drunk in … h on day 12", week 2
  replayed with the vaccine by the plate, week 3 passes.
- **Results on main** (960 × 600, seed 1): `p3-cycle.json` 154 PASS, 0 FAIL, no console or page errors — plan
  3,611 birds a week at 28.0 kg/m² · brooding week 4.87 × · Week 2 492 g, 0.25 % · Week 3 985 g, 0.44 % · Weeks
  4–5 2,294 g, 0.59 % · harvest 2,884 g live, FCR 1.58, EPEF 428, 2.28 % lost over the cycle · clean-out 0 of
  10 swabs positive, 21 rest days · the cycle summary. `p3-replay.json` 16 PASS, 0 FAIL — the poor vaccine (4.5 h, coverage 0.39) and the untreated coccidiosis fail week 3 at 1.50 %; *Replay Week 2 from day 8* with "From Week 2: vaccine drunk in 4.5 h on day 12"; the vaccine by the plate (1.5 h, coverage 0.96); week 3 passes (980 g, 0.45 %).
- **Every earlier run passes on main** (960 × 600, exit 0, no console errors): the Phase 1 `tour`, `cold-hot`,
  `p2-hooks`, `phase1-jobs` (4 of 4), `p2-level1` (57/0, 4.87 ×), `p2-level1-find`, `p2-review2` and
  `p2-review2-ui` (the skill tree check now expects the eleven earnable branches), every `p3-run-*`,
  `p3-panels-*` and `p3-scene-*` file and `p3-design-stubs`. Scene budget on main: house view 118 draw calls,
  570 k triangles, 55 shader programs (unchanged through a prop tour), frame step 1.9 ms.
- **Play time of the real-input days** (the seconds the harness advanced the game — walking, panels and
  carrying at their clock speeds — plus 2 s per click or key press, 0.4 s when it repeats the press before):

  | Day | Jobs by real input | Play time | Game hours covered |
  | --- | --- | --- | --- |
  | −2 planning day | 9 (walking, tape, sheet, reply, sign) | 2.6 min | 2.6 h (then Next job) |
  | 8 | 17 (routine, lights, lux, timer, lines raised) | 5.0 min | 10.0 h |
  | 16 | 15 (routine, 10 droppings checks, fans, night) | 7.5 min | 12.7 h |
  | 25 | 14 (routine, hot afternoon fans and pad, night) | 5.4 min | 12.7 h |
  | 37 | 15 (routine, the phone booking, fans, night) | 6.0 min | 12.7 h |
  | 44 | 5 (three washer passes, lines, pans, drying fans) | 4.9 min | 10.0 h |

  Every flock day is over PHASE3.md's 4.5-minute ceiling. The time goes to walking (2.9–5 of the minutes: the
  48 m house, the round to the silo and the bin, the office and back for the 18:00 fan check) and on day 16 to
  the ten birds in the hand (about 2 min). **Before release (fewer `onDays`):** from Week 2 the four flow tests
  every other morning (with `r-minvent`), the silo gauge on order days only, five birds instead of ten for the
  droppings checks, and the evening ventilation job readable at the controller by the door; each of these saves
  roughly 0.5–1 min. Not changed in Phase 3 (content for the farmer to confirm; PHASE3.md §17 question 14).
- **The model as played** (found by the real-input days): 16-day-old birds chill under six fans with the pad
  (house 28 °C, wind chill at 2.5 m/s: about 3 cold deaths an hour from 14:00) — the heat sign's "young birds:
  as few tunnel fans as the heat allows"; six fans without the pad keep them comfortable with no deaths. Two hours
  of few fans in the day-25 hot afternoon before the farmer's 13:00 round is enough for an abnormal-deaths
  report; the scripted farmer sets six fans at the end of the morning round on hot days.

### Review fixes (Phase 3 review round)
- **Records and UI:** `records-cycle deathsByLevel()` is an array `[{ level, deaths, culls, doa, pct }]`; the cycle
  summary and the harvest page read it through `ui-letters deathsByLevelRows` (an old `{ id: pct }` map is read too).
  Readings in the notebook are the reading, never a bare `true` the farm returned (`fans`, `controller` merge the args
  with an object result). Charts: round ticks (1-2-2.5-5 × 10ⁿ), the day label inside the view. The skill tree and the
  summary say "1 point". The fan panel's wind chill unlock reads *Birds feel* (house − wind chill) with "4.1 °C cooler
  in 2.5 m/s air" under it. The phone's feed note carries its source line (general practice). The HUD clock card keeps
  one width (`.clock-day` ellipsis; the booked chick day stays on the job card); day 42 reads "Day 42 · the catch" on
  both. The bird check's droppings guide: pictograms in three columns, the looks in four columns under 700 px, scrolled
  into view when it opens.
- **Scene:** the comfort view's warm half is relative to the age's panting threshold (`uHotFrom` = `farm.comfort.hotFrom`
  from day 8, 1.5 °C for chicks): orange where panting starts, red 3 °C past it; the legend reads *cold · cool · right ·
  panting starts · too hot* with "birds this age start to pant at +X °C". The three office palms moved south-east of the
  office (world-yard.js), off the default camera's line to the wash bay and the planning sign (`p3-scene-look`
  look-17). `patchOcclusion` handles instanced meshes (`instanceMatrix`), and the catch's crates and crew use the
  occlusion material, so a stack between the camera and the farmer dithers away. House dust is a matte grey-brown haze
  (normal blending, 0.3 opacity).
- **Model and jobs:** the plan's sale term has an upper end (`PLAN_CONTRACT.saleMaxPct` 110 %: 12 houses fail; the
  letter, the sheet and the plate say so). Week 2 fails under 95 % of the day-14 target (`noCare` profile: no input
  weighs about 91 %). `heatHandled` (farm-cycle-problems.js, also the job engine's `heat-handled`): never while the
  mean felt comfort is under −1.5 °C, never by the pad for birds under 21 days; `w3-heat` needs no cold death between
  found and fixed (`padWeek3` profile). A weather problem the farmer never met ends quietly (`fixed`, `fixedBy:
  'weather'`, `unseen`, EV.FARM_PROBLEM `passed`: a plain line on the day's row, no job). With a withdrawal under 6 h the
  plant deducts 3 % gut fill from each ticket (`gutKg`; `noWithdrawal` pays less, FCR and EPEF worse than the ideal).
  New state test `dark-period` (≥ 4 h): `w2-lights` and `p-sds` need it, and the farm fixes the sudden deaths only with
  it; `vent.timer` answers `{ air, prevAir, stepUp }` and `r-minvent` counts a step up. The vet answers what was
  reported and seen (medicine only for blood in the droppings once found or on the floor; Gumboro by the vet only once
  found or named). The crew needs 3 days' notice (`f-book` to day 39 06:00). Birds with no feed in reach lose about 2 %
  of their weight a day before they starve (`FLOCK.starveLossPerDay`, not during the withdrawal or the heat-wave lift).
  The fail screen's carried lines name "no vaccine given on day 12", "vaccine reached N % of the birds" and "brooding
  curtain still down on day 15".
- **Run and level:** *Next job* with jobs open words the skip with its day ("Skip to 13:00, day 12 — 2 jobs open",
  "End Clean-out and rest at 06:00, day 70") and the confirmed skip stops at the earliest close of an open job or the
  next 06:00; a skip of more than a day runs behind the busy card. `L.weighings()` reads the level's saved weighs of the
  day and counts places as the weigh job does (house sectors from day 8). The drawn flock's generator is reseeded from
  the level seed and the clock minute at every level start and restore (`flock-level reseed`), and the play-through
  steps stop the loop before anything runs in real time. Once the harness stops the loop (`__game.stop()`), the
  double click ("run there"), the route search budget, the *Next job* confirm window, the brooder "Off and up"
  confirm and the chick-righting time read `src/clock.js`, a clock that only `advance()` moves: a steps file gives
  the same play-through on a busy or an idle machine (real time otherwise). The notebook folds away the levels before the last one when a
  level is entered (`records.compact`); day stats and notebook values are rounded in the save (`src/round.js`); the run
  key leaves out the blob's copy of the run: the run key at day 67 is about 175 KB (test-run asserts ≤ 250 KB). A
  standard start clears the later levels and their starts of the abandoned flock and keeps the player's entries of the
  levels before; a replay from day 22 deletes the stored day-29 start too (`store.clearStart`). The day-29 inner start
  reached by the running clock no longer teleports the farmer. A skill award schedules a run save (0.5 s).
- **Pacing (`onDays`):** from day 8 the four flow tests come on even mornings (`FLOW_DAYS`), the silo gauge on odd
  mornings and the order days 13, 27, 36 (`SILO_DAYS`; `r-feedmeter` asks for the feed meter alone on the others), the
  droppings checks take five birds, the night ventilation is done at the controller by the door, and the afternoon
  walk rests on the quiet days 26 and 34.

### Open (Phase 4 and later)
- **Day budget:** the `onDays` cuts of the review round are in (above); they are content for the farmer to confirm
  (PHASE3.md §17 question 14).
- **noStep** (minimum ventilation never stepped up) costs little in the model (night RH +4 points, litter +3
  points, NH3 +2.5 ppm, 0.4 % of the day-21 weight): the bands are relative for now; a stronger response to too
  little air (wet litter, ammonia, intake) is Phase 4 tuning.
- **Week 3 heat:** `heat-handled` no longer accepts the pad for birds under 21 days or chilled birds (review); the
  model itself still chills 16-day-old birds under six fans and the pad (about 3 cold deaths an hour): softening
  wind chill by age is Phase 4 tuning.
- **Ideal profile points** the sim package could not reach (vent-band, warm-timer, heat-finish, damp-cleared,
  comfort-fin, harvest-uniformity 66 %); every branch still reaches level 2.
- **Records:** the week table's *Tunnel fans (most)* / *Pad on* are the farmer's own fan-panel readings (one per
  opening, 2 s after it opens): a day without a reading, or with a reading taken before switching, shows less (the
  `goto(auto)` days now show the ideal's readings: the notebook keeps the reading, not the farm's `true`).
- **Model (review round):** the gut-fill deduction (3 %), the empty-pan weight loss (2 % a day) and week 2's 95 %
  line are model values for the farmer to confirm; the reviewer's second option for week 2 (stronger crowding and
  line-height effects after day 10) is left to Phase 4.
- **Speed:** the brooding week's 24 h skip costs 40–130 ms in node (the limit is 150 ms; Phase 2's was 30 ms).
- **Scene:** the catching crew walks fixed paths through the farmer and the stacks; the grown flock covers about
  65 % of the floor at 2,950 g; the two board textures take about 46 MB of GPU memory; `ui-jobs.js` imports
  `FAN_Z` from `house-fans.js` (could move to config with `LUX_RAMP` / `BROODER_RAMP`).
- **Panels:** at 960 × 600 the water supply (Lines from day 8), the controller's Ventilation tab with the
  calculator, the bird check with the guide and the fan panel with the stages scroll vertically (never sideways).
- **Guide tags** stay provisional (PHASE3.md §5.1, open question 1).
- **Phase 4:** the harder replay conditions (`config.CONDITIONS`, `available: false`) and the model tuning to the
  guides' numbers; **Phase 5:** sound, settings, save slots, the farm overview map.
