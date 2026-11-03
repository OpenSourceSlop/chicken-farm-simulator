# Chicken Farm — Phase 3 spec: the full flock cycle

**Goal (approved plan, build phase 3):** the farmer runs one flock from planning to an empty, rested
house. Phase 2's Level 1 (prep day and brooding week) stays as it is and becomes the second level of
a **run** of seven levels on the same flock: *Plan the farm* → *The brooding week* → *Week 2* →
*Week 3* → *Weeks 4 and 5* → *Finishing and harvest* → *Clean-out and rest*. All eleven skill branches
become earnable. Every week has its own problems and jobs; the daily rounds of PHASE2.md §4.3 go on
every day and change with the age of the birds.

Read with `ARCHITECTURE.md` (Phase 1 and Phase 2 as integrated) and `PHASE2.md` (Level 1: still valid;
its §0 rules, §3 job system, §6 model and §13 contracts are the base this file extends). This file
adds what Phase 3 builds, the shared contracts already in code (§13: `src/config.js` Phase 3 section,
`src/events.js`, the contract data `src/content-jobs-cycle.js`, `src/content-signs-cycle.js`,
`src/skills-cycle.js`, the contract code `src/farm-heat.js`, `src/farm-plan.js`, the cycle climate in
`src/sim.js`, `scripts/cycle-refs.mjs` with the checks of `scripts/test-cycle.mjs`, the stub modules) and
the four work packages (§14). Each package section in §14 stands alone. This version follows the design
review: the heat and growth numbers are re-derived and held by a committed check that runs the env alone
(§6.1, §6.3), and §13.9 settles every hand-over point.

## 0. Rules that hold everywhere (approved design, do not break)

- **No lessons, no quizzes, no hidden-answer scoring.** Facts sit on signs and equipment plates at the
  place where they are used; the job list walks the farmer through each job and points to the signs
  that hold its facts. The planning sheet (Level 1) is the farmer's own worksheet: nothing marks what
  he writes on it; only what his plan *gives* (by the planning sums, shown as plain numbers) counts.
- **No "correct" / "wrong" messages anywhere**, no green ticks, no red crosses, no praise. A job is
  done because it was done. Results show as measured numbers in the daily flock record (body weight
  against target, feed and water, deaths, FCR, litter moisture, and from Phase 3 the harvest page and
  the cycle summary), on gauges and in what the flock does.
- **Every sign fact shows its source** in small text: a guide name (`GUIDES`: Week 1 guide, Week 2
  guide, Week 3 guide, Week 4 guide, Broiler Ventilation, Broiler Management 101) or "general
  practice". The guide PDFs and content-map.md are not in the repo: **no page numbers**, and a fact may
  carry a guide name only if it is in PHASE2.md §6.1 or in the closed list of §5.1 below (the bare plan
  topic of that week, nothing added). Every figure and every added cause is "general".
- **Missing a level's key target fails the level and you replay that level** (§10). Skill points come
  from results of play (milestones, §9); each branch level unlocks a tool or view. Every threshold a
  milestone names is on the sign or plate its job links, or is a measured outcome its text states.
- Days pass in a few minutes of play with the *Next job* skip. Desktop browser, English, low-poly
  flat-shaded procedural art, one self-contained page (three 0.160.0 from jsDelivr), the publishing
  constraints of ARCHITECTURE.md.
- **Earlier phases keep working:** the Phase 1 sandbox (boot mode under automation, `tour`, `cold-hot`,
  `walk`, `p2-hooks`, `phase1-jobs.json`), the Phase 2 level (`__game.startLevel({ seed: 1 })` still
  starts the brooding week exactly as before; `npm test` and the Phase 2 steps files pass).

## 1. Player experience walkthrough

Real times at normal speed (clock speeds of PHASE2.md §2: walking 120×, a panel 30×, carrying 30×, a
sign 0×, fast 480×). A whole cycle is about **3 hours of play** in seven sittings; the farmer can stop
at any time (autosave, §11). The budget is per game day: about 3.5 minutes of real input for a day of
the flock levels (Phase 2 measured 3–4 minutes for a 13-job day), which is why the walks are capped at
week 1's cell counts, the lines are raised every three or four days and the fan-panel read is one job
beside the afternoon walk. `scripts/p3-cycle.json` times one real-input day per level (§16); a day over
4.5 minutes gets fewer `onDays` before release.

### Title card and run screen (boot)
Over the farm at dawn: **"Chicken Farm — one flock, from the plan to the clean house"**. Buttons:
*Start a new flock* (Level 1, Plan the farm), *Start at the brooding week* (skips the plan: the run has
no plan to compare with), *Continue — Week 3, day 17, 10:40* (with a run save), *Walk the Phase 1 farm
(sandbox)*, *Skill tree*. Below them the **run card**: the seven levels in a column, each with its days,
its key target in words ("Day 14: weigh 50 birds"), its state (not reached · playing · passed with its
key number, e.g. "day 14: 472 g" · not passed) and, once reached, *Replay from day 8* (its saved start).
After a full cycle a line reads "Harder flocks (hot season, rainy season, a bad batch of chicks, a
water problem) come in the next build" — nothing to click yet (Phase 4).

### Level 1 — Plan the farm (planning day, calendar day −2) — about 10 minutes
07:00 outside the gate. Job card "Planning day — no birds yet": read the farm rules at the gate (the
gate sign), walk the foot dip, change into farm clothes and boots at the guard hut, read the company's
contract at the office desk. The letter says, as plain lines: "3,600 birds for sale every week, about
2.8 kg live weight · we count at least 4 % losses from chick to catching · at least 21 days of rest
between flocks · at most 6,000 chicks a house (the drinkers and feeders of house 1) · at most 32 kg of
live bird per m² at catching · our drawings show the standard house, 50 × 12 m". He takes the tape
measure from the office, measures house 1 inside (hook the tape at the west end wall, read it at the
east end wall: 48.0 m; south wall to north wall: 12.0 m), reads the planning sign on the office porch
(the sums, a worked example), fills in the **planning sheet** (his own lines for chicks per week, floor
area and houses; then his decisions: houses, chicks per house, days per cycle, losses he plans for,
sale weight) and presses *Send the plan* before 16:00. An hour later the company's reply lies on the
desk: his plan run through the contract's terms, one line per term with his number beside it — "6
houses × 6,000 chicks every 67 days · losses counted 4 % · 3,611 birds for sale a week (contract
3,600) · 28.0 kg/m² at catching (limit 32) · 21 rest days (at least 21) · 6,000 chicks a house (at
most 6,000)". Signing the plan page ends the level. Key target: every term met (§10). A plan of 5
houses × 6,000 every 49 days at 0 % losses gives 4,114 a week on his sheet, but the reply counts 4 %
losses and shows 3 rest days against 21: not passed.

### Level 2 — The brooding week (days −1 to 7) — about 40 minutes
Exactly PHASE2.md §1, with one difference at the end: the result screen's first button is *Continue to
Week 2* (the night of day 7 is skipped; the run saves the Week 2 start).

### Level 3 — Week 2 (days 8–14) — about 25 minutes
Each morning the farmer starts at the gate. The rounds are Phase 2's; the walks cover the floor the birds
use, at most as many cells as week 1's walks (150 in the morning, 105 in the afternoon). New this week:
- **Day 8: light against sudden death.** *Set the light program for the growing birds* (controller,
  Lights; the new light sign beside it: a dark period every night from week 2; with Lighting level 1,
  earned in the brooding week of a run, the presets) and *Measure the light at bird level* (key **L**,
  three parts of the floor). From today the morning job *Step up the minimum ventilation for the birds'
  weight* comes every other day (the vent sign's table now runs to 3 kg) and *Raise the drinker and feeder
  lines* every three or four days (days 8, 11, 14, 17, 20, 24, 28, 32).
- **Day 9: a rainy spell** (two days of 92 % humidity outside). The house air goes damp; the controller
  shows it, a squeeze sticks, the look note says "damp air, wet patches by the walls" → *The air in the
  house feels damp* → more minimum ventilation. Afternoon: *Get the rest of the house ready for the
  birds* (litter on the east half if he only spread the brooding area on the prep day).
- **Day 10: the brooding curtain lifts.** *Lift the brooding curtain and let the birds spread* (winch
  on the north wall at the curtain, open day 9 13:00 – day 11 18:00) and *Walk the whole house and look at
  the spread* within 6 h. The birds walk out over the east half; the flock now has twice the floor.
- **Days 10 and 13: bird checks.** *Check ten birds in the hand: walk, feathers, feet* (any bird, E:
  the bird-in-hand panel for older birds: watch it walk (gait 0–5), look at the feathers, the feet).
- **Day 11: lame birds.** From day 11 a few birds sit and limp; catching one or a gait score of 3 or
  more opens *Birds that cannot walk well* → cull the lame birds on the floor.
- **Day 12: vaccination** (schedule general): *Vaccinate the flock in the drinking water* — water off
  at the water supply 1–2 h, mix the vaccine and stabiliser in the header tank, open the lines, walk
  the birds up to drink; the record shows how long they took to drink it ("vaccine drunk in 1.8 h"). A
  poor vaccination shows in week 3 as deaths and weight (§6.7), not as a fail on its own.
- **Day 13: sudden deaths.** A big bird is found dead on its back → *Big birds found dead on their
  backs* (points to the controller's light program and the light sign).
- **Day 14: weigh 50 birds from 5 parts of the house** (key target, §10), sign the record, result.

### Level 4 — Week 3 (days 15–21) — about 25 minutes
The season turns warmer ("normal": 24–33 °C, about 89 % humidity at dawn and 54 % at 15:00). The
afternoon round now has *Check the fans and the house in the afternoon heat* (the **fan panel** at the
east end: six fan switches with their status lamps, pad pump, air speed) and the evening *Set the
ventilation for the night* (the heat sign: tunnel fans from week 3, by how the birds feel; young birds
want them off at night). New this week:
- **Days 14–16: crumble to pellets.** On day 13 he orders grower pellets (office phone; the feed sign:
  starter crumble to day 14, grower pellets from day 15); they come to silo 2 on day 14 at 09:00.
  *Change the feed lines to grower pellets* (day 15 06:00 – day 16 18:00): the silo panel's two slide
  valves (half and half for a day, then silo 2 only), the feeder box runs the lines so the new feed
  reaches the pans. An abrupt change shows as undigested feed in the droppings for a day.
- **Day 16: the first warm afternoon** (+2 °C, sun on the roof). With the usual three or four fans
  half the birds pant at 15:00; a listen or the fan panel shows it → *Birds panting in the afternoon* →
  more tunnel fans (all six bring them back). A farmer who runs only minimum ventilation all week sees
  the birds panting every afternoon and eating less; none die of it in week 3 (§6.3).
- **Days 16 and 19: droppings.** *Check the droppings on ten birds* (bird check, *Look at the vent and
  droppings*; Feed & Digestion level 1, earned by the end of week 2, adds the droppings guide).
- **Day 17: the pad overflows.** The pad's float valve sticks; a strip of litter at the pad end goes wet
  → *Wet litter at the pad end: find what wets it* → *Free the float valve* at the pad pump → *Put fresh
  litter on the wet strip*.
- **Day 18: top up the litter.** *Fork over caked litter and top it up under the drinker lines* (fork
  and sacks from the husk heap).
- **Day 19: blood in the droppings** (coccidiosis in part of the flock): a bird check or a look note
  shows it → *Blood in the droppings* → phone the vet → medicine in the water (the medicator at the water
  supply) for 3 days.
- **Day 20: Gumboro** — only if the day 12 vaccine reached too few birds (§6.7): birds sit hunched
  with white, watery droppings, deaths rise → *Birds sitting hunched with white watery droppings* →
  phone the vet. With a good vaccination nothing happens: the farmer never sees this problem. Gumboro
  alone costs 0.3–0.6 % of the birds and 4–8 % of the day 21 weight, under the week's limits; with
  untreated coccidiosis on top the week fails, and its fail screen also offers *Replay Week 2* with the
  record line "vaccine drunk in 4.2 h on day 12" (§10).
- **Day 21: weigh 50 birds** (key target), sign, result.

### Level 5 — Weeks 4 and 5 (days 22–35) — about 45 minutes, saved starts on day 22 and day 29
The heat level. Afternoons reach 33 °C outside and the birds weigh 1–2.3 kg: their own heat rises with
weight. The brooders go up (*Turn the brooders off and winch them up*, day 22). Day 23: *Measure the air
speed at bird height* (key **V**, the hand air meter). Heat & Ventilation level 1 (the wind chill readout
on the fan panel) comes with the first hot afternoon at the latest (day 25). The week table splits the
level into Week 4 (days 22–28) and Week 5 (29–35). Problems, about one every other day:
- **Day 23: dusty air** — a dry spell from 04:00 (30 points off the outside humidity); in the busy hours
  after the lights come on, on minimum ventilation, a listen stop hears snicking and a rattle →
  *Dusty air and birds breathing with a rattle* → two or more tunnel fans clear it.
- **Day 24: check the cooling pad** (water on every section).
- **Day 25: the first hot afternoon** (+3 °C, sun on the roof: about 36 °C, 47 % humidity) → *Birds
  panting in the afternoon heat* → all fans and the pads (the house at about 28 °C, no bird panting).
- **Day 27: fan 4 stops** (a broken belt): its lamp is on, the blade stands still, the fan end is hot →
  *Fan 4 is not turning* → E at the fan: fit a new belt.
- **Day 28: weigh 50 birds** (for the record; no target).
- **Day 29: a third of the pad runs dry** (clogged distribution pipe) → *Part of the cooling pad is dry*
  → flush the pipe at the pad pump. The radio forecasts a heat wave; finisher feed from today.
- **Days 30–32: heat wave** (up to 39 °C, about 40 % humidity, nights 30 °C) → *A heat wave is coming:
  get the house ready* (fans, pad, water). Full tunnel and pads all afternoon, all fans on into the
  night; the feeders lifted in the hottest hours (feed sign). With fan 4 and the pad in order a few
  birds pant at the fan end at 15:00 and none die; a stopped fan or a dry pad section triples the hours
  of panting; fans without the pads lose several per cent of the flock.
- **Day 33: hot and humid** (33 °C, 85 % outside): with the pads on the house humidity rises to 97 %
  and the birds feel 2 °C hotter (the pad plate's temperature + humidity limit: pads off over 90 %) →
  *Hot and humid in the house* → pump off, all fans; the birds pant all afternoon either way.
- **Day 35: weigh 50 birds** (key target), sign, result.

### Level 6 — Finishing and harvest (days 36–42) — about 25 minutes
All general practice. Full tunnel and pads on hot afternoons, some tunnel fans at night for the big
birds. Day 36: *Order the last feed for the flock* (the feed sign: less than one day's feed, about 1.2 t,
left at catching). Days 37–39: *Book the catching crew and the trucks* (office phone, at least 3 days
ahead; the crew catches between day 41 18:00 and day 42 06:00; the company's default is day 42, 02:00;
the phone answers a time outside that with the plain fact). Day 38: a hot afternoon (about 37 °C).
Day 40: *Weigh sample birds before catching* (uniformity for the harvest page). Day 41: *Take the feed
away before catching* (feeder box: the lines stop about an hour before the pans run empty, the pans
empty 8–12 h before the catch and are winched up; water stays on). The night of the catch: *Get the
house ready for the catching crew* (dim the lights to about 10 lux, put up the catching panels), *Lift
the drinker lines as the catching starts*. 02:00 the crew (four
workers) and the trucks arrive; they pen and catch the house section by section from the door end
(about 3 h); the farmer keeps the fans running for the birds still inside and *Reads the weight tickets
at the loading bay* (each truck: crates, birds, gross, tare, net kg). By 05:30 the house is empty: a
few feathers on the litter. Day 42: *Sign the harvest record*: birds sold, mean live weight, FCR,
deaths + culls + dead on arrival, uniformity, production efficiency (§8.3). Key target (§10).

### Level 7 — Clean-out and rest (days 43 to the next chicks) — about 15 minutes
All wash steps general. Day 43: *Winch all the lines and brooders up*, *Take the old litter out of the
house* (the scraper, a 4 m strip: three walks along the house paint husk back to concrete; the litter
goes onto the trailer), *Brush the dust off the lines, fans, pad, brooders and inlets*. Day 44: *Wash
the house with the pressure washer* (from the wash bay; a 5 m strip, three walks along the house paint
the floor washed and wet), *Clean the drinker lines with disinfectant* (disinfectant into the header
tank, then flush each line), *Wash the feeder pans*. Days 44–45: *Let the house dry with the fans*, then
*Disinfect the house* (the sprayer, a 5 m strip; on a wet floor the disinfectant is weak), *Wash and
disinfect the tools at the wash bay*, *Set rodent bait round the house*. Day 46: *Take swabs from the
clean house* (the lab's ten places, marked with small flags where cleaning is hardest), *Close the house
for the rest*. Day 48: *Read the lab result* ("1 of 10 swabs grew bacteria"; the result is the whole
house's cleaning, §6.10); more than 2 → *Swabs grew bacteria: wash and disinfect again* (a second pass
and new swabs). *Book the next chicks* (office phone, any day from 14 days after the house was closed;
the phone answers an earlier day with the plain fact); the rest is skipped in one *Next job* jump. At 06:00 on the booked day the **cycle summary** opens.
Key target: lab result ≤ 2 positive swabs and ≥ 21 days of rest before the next chicks (§10).

### Cycle summary (end of the run)
One page: chicks placed, birds sold, deaths by week, the weight curve against the target, FCR and
production efficiency, feed, water and gas used, the plan's numbers beside the flock's (losses, sale
weight, birds sold, cycle days), rest days and swabs, and the skill points of this cycle by branch.
Buttons: *Start the next flock* (a new run: Plan the farm with this cycle's numbers on the sheet when
Farm Planning level 3 is unlocked), *Replay a level*, *Skill tree*, *Back to the title*.

## 2. The run: levels, calendar, chaining, starts

### 2.1 Levels and the calendar (`config.LEVELS`, in code)
One calendar for the whole cycle: calendar day N = `env.dayNumber` (HUD "Day N"), flock age a =
`env.day − PLACEMENT_DAY` as in PHASE2.md §2. `MIN_DAY` is now −2 (planning day); `CYCLE.lastDay` 70
(`env.setMaxDay(70)` in the clean-out level; the sandbox keeps 42).

| n | id | Title on the run card | Days (start → end) · saved starts | Weather | Key target (§10) |
| --- | --- | --- | --- | --- | --- |
| 1 | `plan` | Level 1 – Plan the farm | −2 07:00 → plan page signed · −2 | cool | every term of the contract met by the company's reply (§6.11) |
| 2 | `level1` | Level 2 – The brooding week | −1 07:00 → day 7 signed (PHASE2.md) · −1 | cool | day 7 ≥ 4.0 × chick weight, deaths + culls ≤ 2 % |
| 3 | `week2` | Level 3 – Week 2 | 8 06:00 → day 14 signed · 8 | cool, rainy spell days 9–10 | day 14 weighed mean ≥ 90 % of 480 g; level deaths + culls ≤ 1.0 % |
| 4 | `week3` | Level 4 – Week 3 | 15 06:00 → day 21 signed · 15 | normal, warm afternoon day 16 | day 21 ≥ 90 % of 950 g; ≤ 1.0 % |
| 5 | `weeks45` | Level 5 – Weeks 4 and 5 | 22 06:00 → day 35 signed · 22, 29 | normal, dry spell 23–24, hot day 25, heat wave 30–32, humid day 33 | day 35 ≥ 90 % of 2,200 g; ≤ 2.0 % |
| 6 | `finish` | Level 6 – Finishing and harvest | 36 06:00 → day 42 harvest record signed · 36 | normal, hot day 38 | harvest live weight ≥ 90 % of `weightAt(age at catch)` × 0.98 (`HARVEST.shrink`); level deaths + culls + DOA ≤ 1.5 % |
| 7 | `cleanout` | Level 7 – Clean-out and rest | 43 06:00 → 06:00 on the booked chick day · 43 | normal | lab ≤ 2 positive swabs of 10 and ≥ 21 rest days |

Target weights are `weightAt(day)` (general, config). With every intake factor at 0.97 (the ideal) the
flock weighs about 5 % over the target on every weigh day (§6.1), so the 90 % line sits 14–17 points
under the ideal everywhere; the harvest is judged after the expected 2 % shrink (sign-catch). Level
deaths are counted from the birds alive at the level's start (`farm.stats.levelStart.alive`, the one
owner, set by `farm.enterLevel`). Each level def carries `id, n, title, short, starts, startDay,
startHour, endDay, weather, rounds, clock, problems, target, fail` (and `weighDays`, `anchors` where they
apply; the catch figures are in `config.HARVEST`); the title is "Level n – short" (the brooding week's
result screen now reads "Level 2 – The brooding week"); `LEVEL1` keeps every Phase 2 field and gains
`n: 2`, `short`, `starts`, `target`.

### 2.2 Chaining on one flock (package "run", `src/run.js` + `src/level.js`)
- **Start a new flock** → `run.startRun({ seed })`: a fresh run at Level 1 (`plan`). The plan level
  uses `farm.start(PLAN_LEVEL)` (an empty, clean house, no flock).
- **Start at the brooding week** → `run.startRun({ seed, at: 'level1' })`: no plan (`run.plan` null).
- Passing a level shows its result screen; *Continue to <next>* calls `run.next()`:
  - `plan` → `level1`: `level.start(LEVEL1)` exactly as Phase 2 (fresh farm, records, props, flock);
    `run.plan` (the sent plan and its sums) stays in the run, not in the farm.
  - every later step **keeps the farm, records, props and flock**: the clock skips to the next level's
    start (06:00 the next morning; the farm integrates the night with the farmer's settings), the farmer
    is placed at the gate, `farm.enterLevel(def)` installs that level's problems and weather (and from
    Week 2 the cycle climate, `env.setCycleClimate(true)`), the job engine starts the level's days, and
    the run saves the **level start** (§11) before the first frame; weeks 4–5 also save a start at day 29
    06:00.
- A failed level shows *Replay <level>* (restores that level's latest saved start that lies before the
  measurement that failed it; weeks 4–5: day 29 for a failure from day 29 on, else day 22, and both
  buttons when both exist), **Replay <the previous level>** with the record lines of that level that the
  failure carried over (§10: e.g. "vaccine drunk in 4.2 h on day 12", "day 14 weight 455 g, 95 % of the
  target"), and *Back to the title*. The model is deterministic and the problems come on the same days
  (PHASE2.md open question 4), so a cause that lies in an earlier level is replayed there.
- **Replay from the run card**: any reached level, from its saved start. It truncates the run to that
  level (a second press confirms: "Replay Week 2 — your run goes back to day 8"). Later starts are
  deleted. Skills are never taken away (milestones only rise, PHASE2.md §9).
- **Standard start** (`run.startLevel(id, { from: 'standard' })`): the run plays the ideal farmer
  (`farm-profiles-cycle.applyCycleRound` through `level.debug.goto(..., { auto: true })`) from the
  brooding week up to that level's start and starts the level there. Used when a level's saved start
  is missing (storage cleared) and by every test and harness run. In the browser it runs behind a card
  "Getting the flock to day 22 …" (≤ 6 s in a desktop browser).
- `__game.startLevel({ seed: 1 })` (no `level`) still means Phase 2's lone brooding week start; with
  `level: 'week3', from: 'standard'` it is a standard start.

### 2.3 Clock, rounds, day labels, skips
- Clock speeds and their priority: PHASE2.md §2 (`LEVEL1.clock`, shared by every level). The catching
  night runs at `work` (the crew works on its own); the *Next job* skip may jump the rest period in one
  go (days 46 → booked day).
- Rounds (`config.ROUNDS`): Phase 2's `am` 06–12, `pm` 13–18, `eve` 16–24, `prep` 07–24, plus `plan`
  07–24 and `night` 18–22 (evening ventilation from day 22). Windows past 24 run into the next day
  (Phase 2's `prep-flush` 16–26).
- HUD day label (`content.js dayLabel`, run package): "Planning day" (−2), "Prep day" (−1), "Day N"
  (0–41), "Day 42 · catching", "Clean-out day k" (43–46), "Rest day k" (from day 47), "Chicks
  booked: day N" while resting. The flock age shows only while birds are in the house.
- Each morning after an overnight skip the farmer starts at the gate (`FARM.spawn`).
- *Next job* (PHASE2.md §2) never skips past the level's end, a weigh-in window or the catch time.

## 3. The job system in Phase 3 (package "run")

The engine of PHASE2.md §3 (`src/job-engine.js`) is generalized; Level 1's behaviour does not change.

### 3.1 Engine changes (contract for the content of §4)
- `createJobEngine({ events, env, farm, props, records, jobs, level })`: `level` is the level def
  (default `LEVEL1`). Windows use `level.rounds`; days run `level.startDay..level.endDay`; the level's
  end time is `level.endDay + 1` 06:00 (`LEVEL1`: day 8 06:00 as before; `cleanout`: the booked day
  06:00, `farm.clean.bookedDay`). Only jobs whose days lie inside the level are made.
- `onDays: [8, 10, 12]` on a routine def: made only on those days (inside `days`).
- **Anchors** beyond truck / placed: a level def may declare `anchors: { curtain: { action:
  'house.curtain', match: { open: true } }, catch: { stat: 'catchAt' } }`: an action anchor is set at
  the first matching `EV.ACTION`; a stat anchor is read from `farm.stats[stat]` (or `farm.harvest` for
  `catchAt`) every tick and may move until it opens (the booked catch time). `rel.fromH` may be negative
  (`f-withdraw`: −14 h … −6 h before the catch).
- `coverage` gains `area: 'brood' | 'house' | 'used'` (default `'brood'` = Phase 2; `'used'` = the
  brooding cells while `env.broodCurtain`, every house cell after), `maxCells` (the walk needs `frac` of
  the area but never more than this many cells: the routine walks stay at week 1's 150 / 105 cells after
  the curtain lift; Phase 2's engine ignores the field, and in week 1 frac × 300 = maxCells) and `tool:
  'washer' | 'sprayer' | 'scraper'` (only `EV.CELL` while `props.carrying` is that tool counts).
- `count` gains `sectorsOf: 'brood' | 'house' | 'used'` (`config.houseSector`, 8 sectors: four along the
  house, two across; 'used' = brood sectors while the curtain is down) and `match` on the payload (e.g.
  `{ look: 'droppings' }`).
- `each` gains `has: 'heightCm'`: only actions whose payload has that key count (a feeder height change,
  not a run / flood toggle). `each clean.swab` keys on `spot` (the index into `CLEAN.swabSpots`).
- An `action` rule's `match` may name the result (`{ result: { booked: true } }`, PHASE2.md matchPayload):
  a booking the phone refused does not complete *Book the catching crew* or *Book the next chicks*.
- New state tests (`STATE_TEST_IDS`, defined in `content-jobs-cycle.js`, implemented in the engine):
  `house-ready` (litter cover ≥ 95 % of all 576 cells), `rh-under` (house RH ≤ 75 % for 60 min),
  `lame-cleared` (`farm.flock.lameOnFloor === 0`), `vaccine-drunk` (`farm.health.vaccine.state ===
  'drunk'`), `pans-grower` / `pans-finisher` (`farm.feed.panType[type] ≥ 0.9`), `caked-cleared` (caked
  share of the used floor ≤ 2 %), `air-clear` (`farm.air.dustIndex ≤ 1` and NH3 ≤ 15 ppm for 2 h),
  `heat-handled` (for 30 game min: `farm.comfort.pantShare ≤ 0.1`, or every fan that turns is on —
  `env.fansEffective === 6 − broken` — and the pad runs, or the pad is off with the house RH over
  `HEAT.padOffAboveRH`: done by doing what the heat sign and pad plate say even while the weather still
  makes some birds pant), `pad-humid-ok` (for 30 game min: the pad off or the house RH ≤
  `HEAT.padOffAboveRH`, and `env.fansEffective ≥ 5`), `house-empty` (`farm.flock.alive === 0` after the
  catch began), `litter-removed` (cover ≤ 5 % of all cells), `house-washed` / `house-disinfected`
  (`farm.clean.washShare` / `sprayShare` ≥ 0.95), `house-dry` (`farm.clean.wetShare` ≤ 0.1),
  `lines-disinfected` (every drinker line `farm.clean.lines[i] ≥ 1`), `rest-done` (`env.day ≥
  farm.clean.bookedDay` + 06:00). Every state test can be met while its problem lasts (the climate check,
  §6.3, holds the numbers).
- Problem jobs as Phase 2: opened only by `EV.FARM_PROBLEM { id, phase: 'symptom' }` of a problem of the
  current level; one instance per problem and level; missed at the level end.
- `nextOpening()` across the level's days; the rest period: from the closing of the house to the booked
  day, the only openings are the lab result (day 48) and `rest-done`.

### 3.2 The job card
As PHASE2.md §3.5. Header "Day 25 · Afternoon round 13:00–18:00"; on the planning day "Planning day ·
no birds yet"; clean-out "Clean-out day 2"; resting "Rest day 9 · chicks booked for day 67". The
**weekly weigh-in** and the catch jobs are pinned while open.

### 3.3 Daily routine by age (PHASE2.md §4.3 table, every day)
| Round | Days 0–7 (Phase 2) | Days 8–14 | Days 15–41 |
| --- | --- | --- | --- |
| Morning | dips · controller · meter · walk (brood floor 50 % = 150 cells + listen) · drinkers (flow test 4 lines) · feeders (meter + silo) · dead birds | same; the walk covers 50 % of the **used** floor, at most 150 cells; *Step up the minimum ventilation* on days 8, 10, 12, 14 | same; *Step up the minimum ventilation* on days 16, 18, 20 |
| Afternoon | house dip · walk 35 % (105 cells) · controller · litter (3 squeezes) · dead birds | same (walk on the used floor, at most 105 cells); *Raise the lines* on days 8, 11, 14 | house dip · walk · **fans** instead of the controller (the fan panel read, `r-fans-pm`) · litter · dead birds; *Raise the lines* on days 17, 20, 24, 28, 32 |
| Evening | record | record | **night ventilation** (18–22: fan panel or controller read, `r-vent-night`) · record |
About 13 routine jobs a day as in week 1, plus one or two of the level's own. Day 42 has only the catch
and harvest jobs; the routine ends with day 41. The clean-out days have their own jobs and a record each
day 43–46.

## 4. Every new job

Exact rules are in `src/content-jobs-cycle.js` (contract data, package "run" owns it; ids, spots, rules
and branches are the contract, titles and "where" lines may be reworded). Columns: **When** (calendar
day, round or hours; `rel` = relative to an anchor) · **Where** (spot) · **Done when** (rule) · **Sim**
(what the model does with it, §6) · **Facts** (boards / plates, §5) · **Branch** the job feeds. Titles
name the check, never the value; problem titles name what was seen, never the cause.

### 4.1 Level 1 — Plan the farm (day −2)
| Job | When | Where | Done when | Sim | Facts | Branch |
| --- | --- | --- | --- | --- | --- | --- |
| `pl-gate-read` *Read the farm rules at the gate* | plan | signGate | ui `sign.read { board: 'sign-gate' }` | — | sign-gate | biosecurity |
| `pl-gate-dip` *Enter through the foot dip* | plan | footDipGate | `EV.FOOTDIP gate` | lapses | sign-gate | biosecurity |
| `pl-clothes` *Change into farm clothes and boots* | plan | guardHut | `bio.change` (guard hut, E) | `stats.changedAt` | sign-gate, guard-hut | biosecurity |
| `pl-letter` *Read the company's contract* | plan | officeDesk | ui `plan.letter` | — | sign-plan | planning |
| `pl-measure` *Measure house 1: length and width* | plan | houseDoor | `each plan.measure` axis `length`, `width` | `farm.plan.measured` | sign-plan | planning |
| `pl-house-dip` *Dip your boots at the house door* | plan | houseDoor | `EV.HOUSE_ENTER { dipped: true }` | lapses | sign-gate | biosecurity |
| `pl-sheet` *Work out the plan on the planning sheet* | 07:00–16:00 (`PLAN_CONTRACT.sendBy`) | officeDesk (the records book's Plan tab opens the sheet) | `plan.send` | `farm.plan` = his decisions, his sums and the company's outcome (§6.11); reply letter 1 h later | sign-plan, plan-sheet | planning |
| `pl-reply` *Read the company's reply* | rel `sent` +1 … +12 h | officeDesk | ui `plan.reply` | checkpoint `plan` | sign-plan | planning |
| `pl-record` *Sign the plan page* | eve | officeDesk | `RECORD_CLOSED { signed }` same day | ends the level | — | — |

### 4.2 Level 2 — The brooding week (days −1 to 7)
PHASE2.md §4, unchanged. The routine defs keep their ids; their `days` now run to day 41 (§3.3), the two
walks carry `area: 'used'` and `maxCells` 150 / 105 (identical in week 1), `r-controller-pm` ends on day
14 (`r-fans-pm` takes over on day 15) and `r-record` runs to day 46 (in `content-jobs.js` now; Level 1's
engine only makes days −1..7).

### 4.3 Level 3 — Week 2 (days 8–14)
| Job | When | Where | Done when | Sim | Facts | Branch |
| --- | --- | --- | --- | --- | --- | --- |
| `w2-lights` *Set the light program for the growing birds* | d8 am | controller | `light.program` | dark hours, lux → SDS, legs (§6.5) | controller-lights, sign-light | lighting |
| `w2-lux` *Measure the light at bird level* | d8 am | signLight | `count light.lux` n 3, 3 sectors (L key) | reading | sign-light | lighting |
| `r-minvent` *Step up the minimum ventilation for the birds' weight* | days 8, 10 … 20 am | controller | `vent.timer` | air, humidity (§6.4) | sign-vent | moisture |
| `w2-ready` *Get the rest of the house ready for the birds* | d9 13:00–18:00 | litterHeap | state `house-ready` | litter cover | sign-curtain, sign-litter | brooding |
| `w2-curtain` *Lift the brooding curtain and let the birds spread* (pin) | d9 13:00 → d11 18:00 | curtainWinch | `house.curtain { open: true }` | floor in use → house (§6.2) | sign-curtain | brooding |
| `w2-spread` *Walk the whole house and look at the spread* | rel `curtain` +0.5 … +6 h | curtainWinch | `coverage` area house 25 % (144 cells) + listen | look notes | sign-curtain, sign-health | brooding |
| `w2-check` *Check ten birds in the hand: walk, feathers, feet* | d10, d13 08–18 | birdScale | `count sample.bird { look: 'gait' }` n 10, 3 sectors (used floor) | gait, feathering, footpad readings | sign-legs, bird-check | biosecurity |
| `w2-vaccine` *Vaccinate the flock in the drinking water* (pin) | d12 06–16 | waterSupply | state `vaccine-drunk` | coverage (§6.7) | vaccine, water-supply | biosecurity |
| `w2-order` *Order grower pellets for the feed change* | d13 06–16 | officeDesk | `feed.order { type: 'grower' }` | silo 2 filled d14 09:00 | sign-feed, silo | feed |
| `r-raise` *Raise the drinker and feeder lines for the birds' size* | days 8, 11, 14, 17, 20, 24, 28, 32 pm | drinkers.0 | all: `each water.height` lines 0–3, `each feed.line` (has `heightCm`) lines 0–2 | access (§6.4–6.6) | drinker, feeder-box | water |
| `w2-weigh` *Weigh sample birds* (pin) | d14 08–18 | birdScale | `count sample.weigh` n 50, 5 house sectors | weighed mean (key target) | bird-scale | growth |
| `p-damp` *The air in the house feels damp* | problem `rainy-spell` | controller | all: any `vent.timer` / `vent.fans`, state `rh-under` | humidity, litter | sign-vent, sign-air | moisture |
| `p-lame` *Birds that cannot walk well* | problem `lame-birds` | lame (nearest lame bird) | state `lame-cleared` | culls | sign-legs | biosecurity |
| `p-sds` *Big birds found dead on their backs* | problem `sudden-deaths` | controller | `controller.read` | — | sign-light, controller-lights | lighting |

### 4.4 Level 4 — Week 3 (days 15–21)
| Job | When | Where | Done when | Sim | Facts | Branch |
| --- | --- | --- | --- | --- | --- | --- |
| `r-fans-pm` *Check the fans and the house in the afternoon heat* | days 15–41 pm | fanPanel | ui `fans.read` (the walk is `r-walk-pm`'s) | — | sign-heat, fan-panel | ventilation |
| `r-vent-night` *Set the ventilation for the night* | days 15–41 18–22 | fanPanel | any: ui `fans.read`, ui `controller.read` | — | sign-heat, sign-vent | moisture |
| `w3-change` *Change the feed lines to grower pellets* (pin) | d15 06:00 → d16 18:00 | silo | state `pans-grower` | feed form, digestion (§6.6) | sign-feed, silo, feeder-box | feed |
| `w3-droppings` *Check the droppings on ten birds* | d16, d19 08–18 | birdScale | `count sample.bird { look: 'droppings' }` n 10, 3 house sectors | droppings readings | sign-droppings, bird-check | feed |
| `w3-topup` *Fork over caked litter and top it up under the drinker lines* | d18 08–18 | litterHeap | `count litter.patch` n 4, 4 within 1 m of a drinker line | moisture, caking | sign-litter, sign-droppings | moisture |
| `w3-weigh` *Weigh sample birds* (pin) | d21 08–18 | birdScale | 50 birds, 5 house sectors | key target | bird-scale | growth |
| `p-pad-wet` *Wet litter at the pad end: find what wets it* | problem `pad-overflow` | padPump | `pad.fixFloat` → `{ fixed: true }` | wet strip stops growing | pad-pump, sign-litter | moisture |
| `p-pad-patch` *Put fresh litter on the wet strip* | after `p-pad-wet` | litterHeap | `litter.patch` → `{ onPad: true }` | strip to 15 % | sign-litter | moisture |
| `p-heat3` *Birds panting in the afternoon* | problem `warm-afternoon3` | fanPanel | all: any `vent.fans` / `vent.pad`, state `heat-handled` | heat (§6.3) | sign-heat, fan-panel | ventilation |
| `p-blood` *Blood in the droppings* | problem `coccidiosis` | officeDesk | all: ui `phone.vet`, `water.medicate { on: true }` | outbreak fades (§6.7) | sign-droppings, medicator | biosecurity |
| `p-hunched` *Birds sitting hunched with white watery droppings* | problem `gumboro` (only with a poor vaccination) | officeDesk | ui `phone.vet` | — (no treatment; the deaths are the record) | sign-droppings, sign-health | biosecurity |

### 4.5 Level 5 — Weeks 4 and 5 (days 22–35)
| Job | When | Where | Done when | Sim | Facts | Branch |
| --- | --- | --- | --- | --- | --- | --- |
| `w45-brooders` *Turn the brooders off and winch them up* | d22 06–18 | heater | `heat.brooders { up: true }` | no brooder heat after (§6.3) | sign-brooder, sign-heat | heating |
| `w45-air` *Measure the air speed at bird height* | d23 08–18 | fanPanel | `count air.probe` n 3, 3 house sectors (V key) | reading | sign-heat | ventilation |
| `w45-pad` *Check the cooling pad: water on every section* | d24 08–18 | padPump | `pad.check` | — | pad-pump | ventilation |
| `w45-order` *Order finisher pellets* | d27 06–16 | officeDesk | `feed.order { type: 'finisher' }` | silo 1 filled d28 09:00 | sign-feed | feed |
| `w45-weigh28` *Weigh sample birds* (pin) | d28 08–18 | birdScale | 50 birds | record only | bird-scale | growth |
| `w45-change` *Change the feed lines to finisher pellets* | d29 06:00 → d30 18:00 | silo | state `pans-finisher` | feed form | sign-feed, silo | feed |
| `w45-weigh35` *Weigh sample birds* (pin) | d35 08–18 | birdScale | 50 birds | key target | bird-scale | growth |
| `p-dust` *Dusty air and birds breathing with a rattle* | problem `dusty-air` | fanPanel | all: any `vent.timer` / `vent.fans`, state `air-clear` | dust, NH3 (§6.7) | sign-air | moisture |
| `p-panting` *Birds panting in the afternoon heat* | problem `hot-afternoon` | fanPanel | all: any `vent.fans` / `vent.pad` / `vent.stages`, state `heat-handled` | heat (§6.3) | sign-heat, fan-panel | ventilation |
| `p-fan` *Fan 4 is not turning* | problem `fan-belt` | fan-broken | `fan.fix` → `{ fixed: true }` | air speed back | fan-panel | ventilation |
| `p-pad-dry` *Part of the cooling pad is dry* | problem `pad-clog` | padPump | `pad.flush` → `{ fixed: true }` | pad cooling back | pad-pump | ventilation |
| `p-heatwave` *A heat wave is coming: get the house ready* | problem `heat-wave` | fanPanel | all: ui `fans.read`, `pad.check`, `water.flowtest` | — | sign-heat, pad-pump, sign-feed | ventilation |
| `p-humid` *Hot and humid in the house* | problem `humid-heat` | padPump | all: any `vent.pad` / `vent.fans`, state `pad-humid-ok` | pad and humidity (§6.3) | pad-pump | ventilation |

### 4.6 Level 6 — Finishing and harvest (days 36–42; general practice)
| Job | When | Where | Done when | Sim | Facts | Branch |
| --- | --- | --- | --- | --- | --- | --- |
| `f-order` *Order the last feed for the flock* | d36 06–16 | officeDesk | `feed.order` | feed left at catching | sign-feed, silo | planning |
| `f-book` *Book the catching crew and the trucks* | d37 06:00 → d39 18:00 | officeDesk | `phone.bookCatch { day, hour }` → `{ booked: true }` | `farm.harvest.catchAt` (default d42 02:00; the phone refuses a time outside d41 18:00 – d42 06:00 with the plain fact) | sign-catch | planning |
| `f-weigh` *Weigh sample birds before catching* (pin) | d40 08–18 | birdScale | 50 birds, 5 house sectors | uniformity for the harvest | bird-scale | growth |
| `f-withdraw` *Take the feed away before catching* | rel `catch` −14 … −6 h | feederBox | `feed.withdraw { on: true }` | the pans run empty about an hour later; withdrawal hours W = catch − pans empty (§6.6) | sign-feed, sign-catch | feed |
| `f-ready` *Get the house ready for the catching crew* | rel `catch` −3 … +0.5 h | controller | all: `light.program` (any), `catch.panels` | DOA (§6.9) | sign-catch, sign-light | comfort |
| `f-lines` *Lift the drinker lines as the catching starts* | rel `catch` −1 … +1 h | drinkers.0 | `each water.height` lines 0–3 | — | sign-catch | water |
| `f-catch` *Catch and load the birds with the crew* (pin) | rel `catch` 0 … +6 h | loadingBay | state `house-empty` | sections, DOA | sign-catch | comfort |
| `f-tickets` *Read the weight tickets at the loading bay* | rel `catch` +0.5 … +8 h | loadingBay | `each load.ticket` truck 0, 1 | harvest result (§6.9) | sign-catch, loading-bay | growth |
| `p-panting-fin` *Birds panting in the afternoon heat* | problem `hot-finish` | fanPanel | as `p-panting` | heat | sign-heat | ventilation |
The day 42 record (`r-record@42`) is the harvest record; signing it ends the level.

### 4.7 Level 7 — Clean-out and rest (days 43 → booked day; wash steps general)
| Job | When | Where | Done when | Sim | Facts | Branch |
| --- | --- | --- | --- | --- | --- | --- |
| `c-raise` *Winch all the lines and brooders up* | d43 06–12 | drinkers.0 | all: `each water.height` 0–3, `each feed.line` (has `heightCm`) 0–2 | — | sign-clean | biosecurity |
| `c-litter` *Take the old litter out of the house* | d43 06–20 | litterHeap | state `litter-removed` | cover → 0 (§6.10) | sign-clean | biosecurity |
| `c-brush` *Brush the dust off the lines, fans, pad, brooders and inlets* | d43 06–20 | controller | `each clean.brush` part lines, fans, pad, brooders, inlets | parts brushed | sign-clean | biosecurity |
| `c-wash` *Wash the house with the pressure washer* (pin) | d44 06–20 | washBay | state `house-washed` | wash grid, wet floor | sign-clean, wash-bay | biosecurity |
| `c-lines` *Clean the drinker lines with disinfectant* | d44 06–20 | waterSupply | all: `water.disinfect { on: true }`, state `lines-disinfected` (each `water.flush` with the tank disinfected) | lines | sign-clean, water-supply | water |
| `c-pans` *Wash the feeder pans* | d44 06–20 | feederBox | `each feed.wash` line 0–2 | — | sign-clean | feed |
| `c-dry` *Let the house dry with the fans* | d44 13:00 → d45 18:00 | fanPanel | state `house-dry` | wet grid dries (§6.10) | sign-clean | moisture |
| `c-spray` *Disinfect the house* | d45 06–20 | washBay | state `house-disinfected` | spray grid × dryness | sign-clean, wash-bay | biosecurity |
| `c-washbay` *Wash and disinfect the tools at the wash bay* | d45 06–20 | washBay | `each clean.washbay` item boots, buckets, barrow, washer | — | sign-clean, wash-bay | biosecurity |
| `c-bait` *Set rodent bait round the house* | d45 06–20 | baitStation | `count clean.bait` n 4 | — | sign-clean | biosecurity |
| `c-swabs` *Take swabs from the clean house* | d46 06–18 | swab (the next flagged place) | `each clean.swab` spot 0–9 (`CLEAN.swabSpots`) | lab result d48 (§6.10) | sign-clean, wash-bay | biosecurity |
| `c-close` *Close the house for the rest* | d46 06–24 | houseDoor | `house.close` | rest starts | sign-clean | biosecurity |
| `c-lab` *Read the lab result* | d48 06–24 | officeDesk | ui `swab.read` | checkpoint `swabs` | sign-clean | biosecurity |
| `c-book` *Book the next chicks* | d48 06:00 → d66 24:00 | officeDesk | `phone.bookChicks { day }` → `{ booked: true }` | `farm.clean.bookedDay` (the phone refuses a day before close + 14 or after 69 with the plain fact) | sign-clean, sign-plan | planning |
| `c-rest` *Rest the house* | after `c-book` | houseDoor | state `rest-done` | the skip; checkpoint `rest` | sign-clean | — |
| `p-rewash` *Swabs grew bacteria: wash and disinfect again* | problem `swab-positive` | washBay | all: state `house-washed`, state `house-disinfected` (the farm clears both shares when it opens) | — | sign-clean | biosecurity |
| `p-reswab` *Take new swabs* | after `p-rewash` | swab | `each clean.swab` spot 0–9 | lab result 2 days later | sign-clean | biosecurity |
The routine `r-record` runs on days 43–46; nothing else of §3.3 runs without birds.

## 5. Signs and equipment plates

All texts and sources are data in **`src/content-signs-cycle.js`** (contract data, package "run" owns
it): `BOARDS_CYCLE` (new 3D boards and plates, same shape as PHASE2.md §5 `BOARDS`) and
`BOARD_EXTRA_ITEMS` (lines added to Phase 2 boards and plates, each with `fromDay`: shown from that
calendar day on, so the brooding week looks exactly as before). `content-signs.js` keeps Phase 2's
`BOARDS`; `boardsForDay(day)` merges both (the one merge function: the ui's sign panels, `api.boards`,
and `ui-boards.js buildPlate`, which reads the merged board of `env.dayNumber`), props paints new boards
from `BOARDS_CYCLE`. `scripts/test-contracts.mjs` checks every item's source key and that no text has a
page reference or a verdict word. Every threshold a milestone names (§9) is on the sign or plate its
job links: "at least 3 days ahead", "about 10 lux", "at least three tunnel fans", "less than one day's
feed (about 1.2 t)", "pans empty 8–12 hours before", "house humidity about 90 %", "200–300 kg of gas".

### 5.1 Guide facts Phase 3 may cite (closed list, provisional)
The plan doc puts these topics in the level of that week. **A guide-tagged line holds the bare plan
topic and nothing else**; every cause, rule or figure added to it is its own line tagged general. Weeks
4–5 use the Week 4 guide (there is no Week 5 guide). The mapping of topic to guide is our inference from
the plan's level list, recorded as provisional in ARCHITECTURE.md until the farmer answers open
question 1.

| Statement (the plan topic only) | Source | Boards |
| --- | --- | --- |
| Light control against sudden death in week 2 | Week 2 guide | sign-light, controller-lights (extra) |
| Watch the feathering and the legs in week 2 | Week 2 guide | sign-legs |
| Ventilate for moisture as the birds grow | Week 2 guide | sign-air, sign-vent (extra) |
| Vaccinate the flock in week 2 | Week 2 guide | vaccine |
| Lift the brooding curtain in week 2 and spread the flock | Week 2 guide | sign-curtain |
| Read the droppings at the bird check | Week 3 guide | sign-droppings |
| Keep the litter dry | Week 3 guide | sign-droppings, sign-litter (extra) |
| Change the feed from crumble to pellets | Week 3 guide | sign-feed |
| Watch the breathing and the dust in weeks 4–5 | Week 4 guide | sign-air |
| Use the tunnel fans against heat stress | Week 4 guide | sign-heat |
| Cooling pads with the tunnel fans | Week 4 guide | pad-pump |
Phase 2's list (PHASE2.md §6.1) still holds: Broiler Ventilation for minimum ventilation, ≤ 30 % litter
moisture and "5 % humidity ≈ 1 °C of pad cooling"; Week 1–4 guides for what huddling, panting, droppings
and breathing sounds tell you; Broiler Management 101 for the gate dip and reporting abnormal deaths.
Everything else is general: wind chill and how moving air cools birds, the temperature + humidity limit
(it comes from the Phase 3 goal text, not the plan's week topics), "about day 10" for the curtain, the
vaccination schedule, every hour, lux, m/s, °C, %, kg and day; plan the farm, finishing, harvest and
clean-out throughout (the plan says so).

### 5.2 New boards (3D, `SPOTS3`; the clock stands still while one is read)
Each line: text — source. `g` = general. (Texts may be reworded by "run"; facts and sources may not.)
- **sign-plan** *Production planning* (office porch): chicks to place per week = birds for sale per week ÷
  (1 − losses) — g · plan for about 4 % losses from chick to catching — g · birds per m² at catching =
  kg of live bird allowed per m² ÷ sale weight — g · allow about 32 kg of live bird per m² at catching in
  a tunnel (EVAP) house — g · floor for one week's chicks = chicks per week ÷ birds per m² — g · days a
  house is used per flock = 42 growing + about 4 clean-out + the rest days — g · rest the clean, empty
  house at least 3 weeks before the next chicks — g · houses needed = floor for one week's chicks × weeks
  a house is used ÷ floor of one house — g · example: 1,000 birds for sale a week at 4 % losses = about
  1,042 chicks a week — g · house 1 has drinkers and feeders for 6,000 birds — g.
- **sign-light** *Light program for growing birds*: light control against sudden death in week 2 — Week 2
  guide · from the second week a dark period every night: rest in the dark lowers sudden deaths and leg
  problems — g · about 4–6 hours of darkness in one block from day 8, kept until the last days before
  catching — g · about 20 lux at bird level from week 2 (30–40 lux in week 1) — g · measure at bird
  height (L), under the lamps and between them — g · sudden death: big, well-grown birds dead on their
  backs, legs up, often near the feeders — g · for catching dim to about 10 lux at bird height — g.
- **sign-curtain** *Opening up the house*: lift the brooding curtain in week 2 and let the birds spread
  over the whole house — Week 2 guide · lift it about day 10, in the morning when the house is warm, and
  walk through the birds — g · the day before, litter the rest of the floor — g · the lines feed the
  whole house: check flow and height at the far end too — g · before the lift the litter of the brooding
  half gets wetter and the birds more crowded every day — g.
- **sign-legs** *Legs and feathers*: watch the feathering and the legs in week 2 — Week 2 guide · gait
  score 0–5 — g · cull birds that cannot reach feed and water (gait 4–5) the day you find them — g · back
  and wings feathered by about day 21; patchy feathering: too hot or too cold, crowding or feed — g ·
  footpad spots and sores come from wet litter — g · a dark period every night and dry litter give
  stronger legs — g.
- **sign-air** *Air quality*: watch the breathing and the dust in weeks 4–5 — Week 4 guide · what the
  breathing sounds tell you: snicking or a rattle means too much ammonia or dust — Week 1–4 guides ·
  eyes sting at bird height: ammonia above about 20 ppm — g · dust rises with dry litter, low humidity
  and busy birds, most in the hours after the lights come on; more air carries it out — g · minimum
  ventilation brings fresh air in, moisture and ammonia out — Broiler Ventilation · ventilate for
  moisture as the birds grow — Week 2 guide · step the minimum ventilation up as the birds gain weight
  (the table on the minimum ventilation sign) — g.
- **sign-droppings** *Droppings* (pictogram): read the droppings at the bird check — Week 3 guide ·
  droppings tell you about the gut and the feed — g · normal; caecal one in ten — g · watery: heat or
  too much water; undigested feed: a feed change or a gut upset — g · blood or orange-red: call the vet;
  white and watery with hunched birds: call the vet — g · keep the litter dry — Week 3 guide · wet, caked
  litter spreads gut disease and burns the feet — g.
- **sign-heat** *Heat and tunnel fans* (by the fan panel; kicker "From week 3"): use the tunnel fans
  against heat stress — Week 4 guide · tunnel fans from week 3, by how the birds feel: young birds as few
  as the heat allows, big birds in the heat all six — g · moving air cools the birds (wind chill); young
  birds feel it far more than big birds — g · six fans about 2.5 m/s at bird height, each about 0.4 m/s —
  g · at 2.5 m/s birds of 5 weeks feel about 3–4 °C cooler, birds of 2 weeks 6–7 °C — g · big birds make
  more heat: each week the same afternoon needs more air — g · heat stress: panting, wings out, lying
  along the walls; deaths start in the hottest hours — g · in the evening step the fans down as the house
  cools: young birds want the tunnel fans off at night, big birds still want some tunnel air on warm
  nights — g.
- **sign-feed** *Feed program* (by the silo gauge): change the feed from crumble to pellets — Week 3
  guide · starter crumble days 0–14, grower pellets 15–28, finisher from 29 — g · change over a day: half
  from each silo for 24 hours — g · about 75 / 130 / 160 / 185 / 200 g a bird a day on days 14 / 21 / 28 /
  35 / 42 — g (`feedStdGAt`) · ordered before 16:00, delivered the next day at 09:00; each silo 6 t and
  empties from the bottom, the oldest feed first — g · the last order: enough to the withdrawal and no
  more, less than one day's feed (about 1.2 t) left at catching — g · in a heat wave lift the feeders
  about 11:00–16:00 — g · the pans empty 8–12 hours before the catch: stop the lines about an hour before
  that; water on until catching starts — g.
- **sign-catch** *Catching and loading*: all g — book the crew and the trucks at least 3 days ahead · the
  pans empty 8–12 h before catching, the lines stopped about an hour before that, water on until the
  catch · dim to about 10 lux at bird height, catch in the cool of the night · keep at least three tunnel
  fans running for the birds still inside and the crates · lift the lines just before the crew starts ·
  pen small groups with catching panels · about 10 birds of 2.8 kg to a crate · the birds lose about 2 %
  of their weight between the feed going off and the plant · read each truck's weight ticket.
- **sign-clean** *Clean-out* (wash bay): all g — the nine steps of §1 Level 7 · swab the ten places the
  lab marks with flags, where cleaning is hardest: the lab shows what still grows anywhere in the house ·
  rest the clean house at least 3 weeks (21 days).

### 5.3 New plates (fact columns inside a panel)
- **guard-hut**: farm clothes and boots before the houses — g · wash hands; visitors sign the book — g.
- **plan-sheet**: about 4 % losses — g · at most about 32 kg/m² — g · 42 + about 4 + the rest days (at
  least 21) per flock — g · the contract's terms: at least 4 % losses counted, at least 21 days of rest,
  at most 6,000 chicks a house — g.
- **vaccine**: vaccinate the flock in week 2 — Week 2 guide · here day 12, Gumboro vaccine in the water —
  g · chlorine and medicine off 2 days before — g · water off 1–2 hours before — g · vaccine with skim
  milk powder in the header tank, enough to drink in about 2 hours — g · walk slowly through the house
  while they drink — g.
- **medicator**: medicine at the vet's dose for the full course, mixed fresh each day — g · bloody or
  orange droppings with hunched birds: call the vet the same day — g.
- **pad-pump**: cooling pads with the tunnel fans — Week 4 guide · each 5 % of humidity the air can still
  take up gives about 1 °C of pad cooling — Broiler Ventilation · a pad in good order gives most of that,
  never all of it — g · **the temperature + humidity limit**: the pads help while the house humidity stays
  at or under about 90 %; above it they add more damp than cool: pump off, keep all the fans running — g
  (`HEAT.padOffAboveRH`; the one number of the rule everywhere: plate, job, milestone, symptom) · water on
  every part of the pad; a dry stripe lets hot air in — g · the pump only while the tunnel fans run — g.
- **fan-panel**: lamp on and the blade still: the belt is broken or slipping — g · six fans about 2.5 m/s
  — g · big birds in the heat: all fans and the pads; young birds: as few as the heat allows — g · house
  °C and humidity side by side: with the pads on, watch the humidity (the pad plate's limit) — g.
- **gas-tank**: read the gauge every morning while the brooders run — g · brooders burn most on cold
  nights and with too much minimum ventilation — g · in the cool season 6,000 chicks to day 21 burn about
  200–300 kg of gas — g.
- **bird-check**: how it walks, the feathers, the feet, the breathing, the vent and droppings, the crop —
  g · what huddling, panting, droppings and breathing sounds tell you — Week 1–4 guides.
- **loading-bay**: net = gross − empty truck; mean live weight = net ÷ birds loaded — g · dead on arrival
  is counted at the plant and comes back on the ticket — g.
- **wash-bay**: washer with detergent, rinse, the sprayer once dry — g · mix the disinfectant as its label
  says — g · the washer and the sprayer each cover a strip about 5 m wide: three passes along the house —
  g.

### 5.4 Lines added to Phase 2 boards (`BOARD_EXTRA_ITEMS`, shown from `fromDay`)
sign-vent (8): fresh air per 1,000 birds to 3 kg — g (`MIN_VENT_PER_1000`) · ventilate for moisture as the
birds grow — Week 2 guide · step the timer up every day or two as the birds gain weight — g. ·
controller-lights (8): light control against sudden death from week 2 — Week 2 guide · a dark period every
night (the light program sign) — g. · sign-litter (15): keep the litter dry — Week 3 guide · fork over
caked patches and top up, most of all under the drinker lines — g. · feeder-box (8): raise the pans every
few days to the birds' backs — g; (36): before catching stop the lines and winch the pans up once empty —
g. · silo (13): silo 1 starter, later finisher; silo 2 grower; 6 t each, emptied from the bottom — g. ·
bird-scale (8): weigh 50 birds from 5 places on days 14, 21, 28, 35 and before catching — g · target
weights 480 / 950 / 1,550 / 2,200 / 2,850 g — g (`weightAt`). · water-supply (12): vaccine and medicine
through the header tank — g; (43): clean-out: disinfectant in the header tank, then flush each line — g.
· sign-health (8): abnormal after week 1: more than about 0.15 % of the flock in one day — g.

## 6. Flock simulation for the whole cycle (package "sim")

Everything runs in `farm.step` (≤ 60 game s, skips included) and `sim.js`, **in level mode only**; the
sandbox climate is Phase 1's. **The brooding week stays Phase 2's to its end** (all of
`scripts/test-sim.mjs PROFILE_TARGETS` must keep passing): the Phase 3 terms start when the run enters
Week 2 (`farm.enterLevel(WEEK2)` at day 8 06:00, which also turns on `env.setCycleClimate(true)`), or at
the event that starts them; the brooding week played alone or inside a run is identical. Constants marked
*model* are tuning values, never on a sign; the sim package may tune them to pass §6.14 and records every
change in §6.16 at integration, as Phase 2 did in its §6.11. Figures marked *general* are on signs (§5).
**Committed now and run by `npm test`:** `src/farm-heat.js` (what the birds feel, panting, heat deaths,
intake, dust), the cycle climate in `sim.js`, `config.feedPerGainAt`, and `scripts/cycle-refs.mjs` (the
climate and growth references of §6.1, §6.3, §6.4 on the env alone; `test-cycle.mjs` checks every one).

### 6.1 Growth and feed to day 42
- `feedStdGAt(a)` (config, general): `12 + 4a` for a ≤ 7 (Phase 2), then `FEED_STD_TABLE` [7 40] [14 75]
  [21 128] [28 160] [35 185] [42 200] g/bird/day (straight lines, flat after 42; the feed sign rounds them
  to 75 / 130 / 160 / 185 / 200).
- Feed per gain `feedPerGainAt(a)` (config, model): Phase 2's `0.97 + 0.03a` to age 14 (identical through
  the brooding week and week 2's first half), then `FPG_TABLE` [14 1.39] [21 1.43] [28 1.63] [35 1.77]
  [42 2.03]. `farm-flock.js` already uses it.
- Intake `FI = FI_std · f_T · f_L · f_F · f_W · f_air` (Phase 2) `· f_space · f_form · f_heat · f_health`
  (new, all 1 before Week 2 or before their event). Gain = FI ÷ FPG (Phase 2: no cap).
- **Reference (the growth check, `cycle-refs growthAt`)**: all factors 1: 208 / 519 / 1,023 / 1,681 /
  2,391 / 3,076 g on days 7 / 14 / 21 / 28 / 35 / 41.75 (the catch), 1.08–1.10 × `weightAt`. Factors 0.97
  (the ideal): 203 / 505 / 993 / 1,632 / 2,320 / 2,985 g, **1.045–1.07 × the target on every weigh day**,
  so the 90 % fail line lies 14–17 points under the ideal everywhere (the check holds 1.12–1.19 ×
  the fail line on days 14, 21, 35 and at the harvest after the 2 % shrink). Feed ÷ live weight 0.87 /
  1.12 / 1.26 / 1.37 / 1.47 / 1.56. Targets (`weightAt`, general): 190 / 480 / 950 / 1,550 / 2,200 /
  2,826 g at the catch age. Heat, disease or crowding take their cost off this margin.

### 6.2 The whole house: the curtain and the floor in use
- `house.curtain { open }` sets `farm.house.curtainOpen` and `env.setBroodCurtain(!open)`. In level mode
  the curtain stays down until the farmer lifts it (Phase 1's "gone at day 10" rule is the sandbox's:
  `env.setBroodCurtain(null)`). The flock keeps west of x 2 while it is down (Phase 1 behaviour).
- **Floor in use** U = the 300 brooding cells while the curtain is down, all 576 cells after. Litter
  water, comfort, observe, `coverage area 'used'` and the litter mean all run over U.
- **Crowding** (model, from Week 2): allowed birds per m² `A(a) = max(11, 30 − 1.2a)`, density `D = alive
  ÷ |U|`; `f_space = max(0.7, 1 − 0.15 · max(0, D/A − 1))`; within-cohort CV + `0.01 · max(0, D/A − 1)`
  per day. In the brooding half the droppings fall on 300 cells instead of 576.
- Reference: 5,950 birds on 300 cells = 19.8 /m²: day 8 D/A 0.97, day 10 1.10 (f_space 0.985), after the
  lift 10.3 /m² (1.0). No lift to day 15 (`lateLift`): day 14 D/A 1.50, f_space 0.925 → day 14 weight ≥
  3 % and uniformity ≥ 3 points under the ideal, brooding-half litter ≥ 32 % on day 14.
- `w2-ready`: cells east of the curtain without litter read as bare concrete (Phase 2 rules: 60 % on a
  squeeze, wet chill) once the birds walk there.

### 6.3 Climate and heat for big birds (committed: `sim.js` cycle climate, `src/farm-heat.js`)
- **Outside air** (cycle climate, model): the temperature is Phase 1's daily curve plus the events; the
  air keeps the day's water content `OUTSIDE_WATER_GM3[weather]` (normal 19.5 g/m³, cool 14), so the RH
  follows the temperature: 'normal' about 89 % at 05:00 (24 °C) and 54 % at 15:00 (33 °C). A weather event
  with `rh` sets the outside RH during it (rainy spell 92 %, humid day 85 %), `rhDrop` takes points off
  (dry spell 30); the heat events have neither, so their RH falls as they heat (hot afternoon about 47 %
  at 15:00, heat wave about 40 %, hot finishing day about 44 %).
- **Brooders**: Phase 2 thermostat. `heat.brooders { up: true }` turns them off for good (`env.broodersUp`:
  output 0, the house look winches them up 0.62 m). **Gas**: `farm.stats.gasKg += heaterLevel · lit
  brooders · 0.15 kg/h` (model; the ideal to day 21 lands in the gas plate's 200–300 kg).
- **Tunnel fans**: `env.setFans(n)` runs fans 1..n (Phase 2). `env.setFansBroken([i])` (in code): a broken
  fan inside the first n shows its lamp (`env.fansOn` counts it) but moves no air; `env.fansEffective` =
  n − broken among them feeds the airflow, the air speed, the tunnel gradient and the pad's tunnel share.
  Optional **stage table** (`vent.stages { stages: [{ overC, fans }], padOverC }`, unlock *tunnel
  stages*): each climate step the farm sets the fans from the house temperature over the target
  (`env.setFanStages(table | null)`). The ideal profile never uses it (a first-cycle farmer has no table).
- **Air speed** (Phase 2): 0.42 m/s per effective tunnel fan at bird height (+ 0.1 × that for timer fans);
  `air.probe` reads ± 15 % along the house (faster near the fans).
- **Wind chill** (general, unchanged): `airSpeed · (3.0 − 1.6 · clamp((day − 7)/28))` °C.
- **Pad** (cycle climate, in code): drop = `PAD_EFF (0.8) × (outside − outside wet bulb) × tunnel share ×
  env.padWorking` (0.67 while a third of the pad is dry); the pad adds 0.49 g/m³ of water per °C it cools
  (Phase 2's figure), so pad air never passes about 90 % RH from dry air but saturates from humid air.
  The sign's "5 % humidity ≈ 1 °C" (Broiler Ventilation) is the rule of thumb for the same physics; the
  plate adds "a pad in good order gives most of that, never all of it" (general).
- **What the birds feel** (`farm-heat.heatState`, from Week 2, per floor cell): `felt = env.localTemp(x, z)`
  (house air, tunnel gradient, wind chill, brooder radiant, side-wall term) `+ humidityTerm(RH, house °C)`
  + the farm's litter term (Phase 2's wet chill); `humidityTerm = 0.08 · max(0, RH − 75) + 0.35 · max(0,
  RH − 88)`, faded in from 24 to 28 °C house air (model). `e = felt − targetTempAt(N)`; zones `eZ[8]` are
  the 6 m strips along the house (§13.5).
- **Bands by age** (model, `HEAT_MODEL`): cold below −1.5 (Phase 2); panting share ramps 0 → 1 across
  `hotFrom(a) ± 0.5` with hotFrom [7 1.5] [14 2.5] [21 3.5] [28 4.5] [35 6.0] [42 6.0] °C over the target;
  heat deaths `0.05 %/h · (e − deathFrom)²` per cell (at most 3 %/h) above deathFrom [7 4] [14 5] [21 6.5]
  [28 8.5] [35 10.5] [42 10.5] minus 4 × (weight ÷ weightAt − 1); intake `f_heat = max(0.5, 1 − 0.04 · (e
  − hotFrom))` above hotFrom. In felt temperature: from day 35 big birds pant above about 26 °C and die
  above about 30.5 °C (the target is 20 °C; a Thai night is 24 °C). These replace Phase 2's heat rate and
  the hot side of f_T from Week 2. Cold deaths: Phase 2 per zone, from age 14 only below e < −4.
- **Heat load**: `env.flockHeatPerH` (Phase 2's formula: it rises with weight, `farm-heat.flockLoads`)
  × 0.85 while the feeders are lifted in the heat (from 1 h after; model).
- **The temperature + humidity limit** (pad plate, general; `HEAT.padOffAboveRH` 90): the one number of
  the rule — plate, job state `pad-humid-ok`, milestone `pads-limit`, symptom. In the model the pads stop
  paying at a pad-made house RH of about 92 %: the plate's 90 % costs a farmer who follows it nothing.
- **References** (`scripts/cycle-refs.mjs CLIMATE_REFS` / `WINDOW_REFS`, the check flock 5,900 birds at
  1.04 × weightAt, the ideal's fan plan `idealFans` / `idealPad` at its stops; all pass now):

| Hour | Plan | Outside | House °C · RH | Felt °C | Panting | Heat deaths |
| --- | --- | --- | --- | --- | --- | --- |
| d18 15:00 | ideal (4 fans) / minimum ventilation only | 33 °C 54 % | 32.8 · 56 / 31.6 · 69 | 28.7 / 31.3 | 0 / 1.0 | 0 / 0 |
| d16 15:00 warm afternoon | ideal's 4 fans / all 6 | 35 °C 49 % | 34.9 · 50 | 30.6 / 28.6 | 0.5 / 0 | 0 |
| d25 15:00 hot afternoon | ideal (6 + pad) / fans, no pad / min. vent. | 36 °C 47 % | 28.4 · 84 / 36.0 · 47 / 35.5 · 56 | 24.1 / 31.0 / 35.3 | 0 / 1.0 / 1.0 | 0 / 0 / 0.65 %/h |
| d31 15:00 heat wave | ideal (6 + pad) / fans, no pad / min. vent. | 39 °C 40 % | 29.7 · 82 / 39.2 · 40 / 40.0 · 44 | 26.0 / 35.0 / 39.8 | 0.09 / 1.0 / 1.0 | 0 / 0.83 / 3 %/h |
| d33 15:00 humid | ideal (pad off) / pads on | 33 °C 85 % | 32.9 · 86 / 31.1 · 97 | 29.9 / 32.3 | 1.0 / 1.0 | 0 / 0.14 %/h |
| d35 15:00 | ideal (6 + pad) / fans, no pad | 33 °C 54 % | 27.0 · 88 / 33.0 · 55 | 24.1 / 29.3 | 0 / 1.0 | 0 / 0 |
| d41 05:00 | ideal (tunnel air all night) / 2 fans / min. vent. | 24.6 °C 86 % | 24.9 · 86 / 25.3 · 85 / 26.9 · 83 | 21.4 / 24.2 / 27.1 | 0 / 0 / 0.98 | 0 |
| d38 15:00 hot finish | ideal (6 + pad) / fans, no pad | 37 °C 44 % | 28.8 · 84 / 37.1 · 45 | 25.8 / 33.4 | 0.39 / 1.0 | 0 / 0.47 %/h |
  Over windows (heat deaths % of the birds · panting bird-hours per bird): week 3 ideal 0 · 0.6, minimum
  ventilation only 0 · 63 (intake 0.98: weight, not deaths); weeks 4–5 normal days ideal 0 · 23, fans
  without pads 0 · 70, minimum ventilation only 9 %; hot afternoon minimum ventilation 1.6 %; heat wave
  ideal 0 · 4.9, fan 4 broken 0 · 15, a third of the pad dry 0 · 28, fans without pads 12.7 %, minimum
  ventilation 65 %; humid day ideal 0, pads on 0.4 %; hot finishing day fans without pads 1.1 %.

### 6.4 Minimum ventilation, humidity and litter for the whole house
- `MIN_VENT_PER_1000` (config, general) runs to 3 kg: [40 150] [100 290] [200 480] [500 950] [1000 1600]
  [1500 2150] [2000 2700] [3000 3650] m³/h per 1,000 birds. `signTimer` (profiles) uses it.
- Litter (Phase 2 model) over U: droppings water over the used cells (× 1.5 under the lines), drying,
  caking (> 40 % for 6 h), squeeze readings. `litter.fork { x, z }`: a caked cell is broken up (caking
  off, −5 points of moisture). `litter.patch` (Phase 2) tops up a cell to 15 %.
- **Ammonia** (model): `NH3 = 0.2 · F7 · (0.4 + m/20) / √airflow · 300/|U|`, F7 = feed eaten in the last 7
  days (kg). Identical to Phase 2 through day 7 (F7 = all feed so far, |U| = 300). Reference: ideal ≤ 15
  ppm by day and ≤ 25 ppm at night in weeks 4–6; `noStep` ≥ 25 ppm by the night of day 14.
- **Rainy spell** (days 9 07:00 → 10 18:00, outside 92 %, −2 °C): with the day 8 timer house RH ≥ 85 %
  within 12 h; with the table's timer for the day ≤ 82 %; 1.5 × that timer brings it to ≤ 75 % within 2 h.
- **Pad overflow** (day 17 10:00): 0.8 L/h into each cell of the two westmost columns until
  `pad.fixFloat`; zone (−23, 0) r 2.5, dwell 2 s, minMoisture 35 (`farm.problemZones()`).
- **Dust** (model, `farm-heat.dustIndex`, in code): `Dx = 4.2 · (age/28) · (1 − house RH/100) · activity /
  (1 + airflow/40,000)`; activity 0.3 in the dark, 1.5 for the 4 hours after the lights come on (the birds
  feed and scratch), 1.0 otherwise. Dx > 1 dusty (look note, motes, snicking), > 1.5 a rattle. The dry
  spell (day 23 04:00 → 24 18:00) takes 30 points off the outside RH. References (check): day 23 07:00
  and 14:00 on minimum ventilation in the spell Dx 1.70 (the ideal's morning walk hears it before its
  09:00 fans); two tunnel fans 0.83; day 22 14:00 without the spell 0.84.

### 6.5 Light, sudden death, legs, feathering
- Light program and lux as Phase 2 (`luxAtBirds = 60 · dimmer`). Presets (config `LIGHT_PRESETS`,
  general): brooding 23 h, dimmer 0.6 (36 lux) · growing dark 22:00–04:00, 0.35 (21 lux) · finishing
  dark 00:00–04:00, 0.35 · catching dimmer 0.1 (6 lux).
- From Week 2 `f_L = 1 − 0.01 · max(0, dark − 4) − 0.03 · max(0, dark − 8)`, × 0.95 below 10 lux (model;
  Phase 2's dark-hour cut stays in the brooding week).
- **Sudden death** (cause `sds`, ages 8–42, model): per bird per hour `4.5e-6 · (1 + max(0, 4 − dark)) ·
  g`, `g = clamp(gain today ÷ the target curve's gain, 0.5, 1.5)`. Reference: ideal (6 h dark) week 2
  0.04–0.1 % (4.5e-6 × 5,950 × 168 h ≈ 4.5 birds); `noDark` (23 h light) ≥ 3 × the ideal over days 8–35.
- **Lame birds** (ages 10–42, model): new per bird per hour `8e-6 · (1 + 0.5 · max(0, 4 − dark)) · (1 +
  0.1 · max(0, litter mean − 30)) · g`; `farm.flock.lameOnFloor` (drawn 1:1 up to 24) eat at half rate and
  die after 72 h (cause `legs`) unless culled (`chicks.cull { reason: 'lame' }`). Reference: ideal days
  10–14 about 6 (4–10), days 10–42 about 35 (0.6 %); `noDark` ≥ 2 × the ideal.
- Bird check readings (model): gait 4–5 for a lame bird, else 0–2 (more 1–2 with g > 1.1); feathers good
  / patchy (7-day mean e outside −1.5..hotFrom) / poor (also crowded); feet 0 / 1 / 2 by the 7-day litter
  moisture of its zone (≤ 30 / 30–38 / > 38 %).

### 6.6 Feed: two silos, feed types, the change, withdrawal
- `farm.feed.silos = [{ type, kg, layers: [{ type, kg }] }] × 2` (6,000 kg each; the stub has them now):
  each silo is a stack of deliveries drawn **from the bottom** (the oldest feed first); `type` is the
  bottom layer's (what the auger draws now). `feed.siloKg` stays their sum (Phase 2 readers). `feed.valve
  { silo, open: 0 | 0.5 | 1 }`: the augers draw in proportion. `feed.order { kg, type }` (default type:
  today's phase) → silo 1 for starter and finisher, silo 2 for grower, as a new top layer; arrives the next
  day 09:00 if ordered before 16:00 (Phase 2). A finisher order onto starter left in silo 1 is accepted:
  the starter comes out first (`overfullSilo`, §6.14). An order over the room left is cut to it (the
  phone says the kg it took).
- The pans hold a mix `farm.feed.panType = { starter, grower, finisher }` (well mixed, model).
- Feed form `f_form` (model): starter crumble 1.0 to age 16, then −1 % a day (≥ 0.9); grower pellets 1.0
  from age 12 (0.97 younger); finisher 1.0 from age 26 (0.97 younger); FPG × 0.98 on pellets.
- **Change shock** (model): the pan mix moving more than 60 points in 12 h → intake × 0.97 and droppings
  'undigested' for 24 h; a blend (between 20 and 80 % new for ≥ 24 h) gives none.
- **Withdrawal** `feed.withdraw { on }`: the lines stop; the birds empty the pans in about an hour; the
  pans winch up once empty (≤ 5 %). W = catch time − pans empty (the sign's "pans empty 8–12 hours
  before"; the ideal stops the lines at catch − 11 h, W ≈ 10 h). Shrink `1 − 0.0025 · clamp(W − 2, 0, 10)
  − 0.003 · max(0, W − 12)` (W 10 h → 0.98, the sign's 2 %); `harvest.gutFull` if W < 6 h (the plant's
  note); DOA + 0.05 % per hour over 12 h (model).
- Heat-wave feeders up 11:00–16:00 (lines stopped, pans up): intake that day −3 %, heat × 0.85 (model).
- Feed left at catching = silos + pans (record; the sign's "less than one day's feed, about 1.2 t").

### 6.7 Health: vaccination, Gumboro, coccidiosis, breathing
- **Vaccination** (day 12, `farm.health.vaccine = { state, thirstFrom, mixedAt, startAt, drunkAt,
  hours, stabiliser, coverage }`): `water.main { open: false }` (lines dry: thirst counts; water access
  0) → `vaccine.mix { stabiliser }` (header tank: 2 h of today's water) → `water.main { open: true }`
  (state 'drinking'; the birds drink the tank at their rate × thirst boost `1 + 0.25 · min(thirst h,
  2)` × access) → tank empty: state 'drunk'. Coverage (model) `= clamp(0.98 − 0.12 · max(0, T − 2) − 0.15 ·
  [thirst < 0.75 h] − 0.25 · [no stabiliser] − 0.3 · (1 − mean access while drinking) − 0.1 · [walked
  < 30 % of the house while they drank], 0.3, 0.99)`. The record shows T ("vaccine drunk in 1.8 h"),
  never the coverage. Reference: ideal (1.5 h thirst, stabiliser, walk) T 1.5–2.2 h, coverage 0.92–0.98;
  `poorVaccine` (no thirst, no stabiliser) T 3.5–5 h, 0.35–0.7.
- **Gumboro** (problem `gumboro`, day 18 06:00, starts only if coverage < 0.85): 5 days (`hump(t) =
  sin(π t / 5 d)`) of deaths (cause `disease`) at `0.008 %/h · (0.85 − coverage)/0.45 · hump(t)`, intake
  × (1 − 0.2 · severity · hump), droppings 'white'. About 85 % of it falls in week 3. Reference: coverage
  0.5 → week 3 disease deaths 0.3–0.6 % (with treated coccidiosis), week 3 deaths + culls 0.5–0.95 %
  (passes: the mistake shows as deaths, weight and points), day 21 weight 4–8 % under the ideal.
- **Coccidiosis** (problem `coccidiosis`, day 19 05:00, every run): severity × (1 + (litter mean − 28)/10)
  × (1 + 0.05 per biosecurity lapse); deaths `disease` from 0.008 %/h rising 50 % a day until treated,
  intake × 0.92, droppings 'bloody' in the wettest zone. `phone.vet` gives the advice ("medicine in the
  water for 3 days", `EV.LETTER { kind: 'vet' }`); `water.medicate { on: true }` takes the severity to 0
  over 48 h; the course is 3 days (`farm.health.medication`). Reference: treated the same day → ≤ 0.1 %;
  untreated → 0.5–1.5 % by day 21 (fails week 3, replayed in week 3); with Gumboro on top 0.9–2.5 %
  (`poorVaccineCocci`: fails week 3; its fail screen offers Replay Week 2 with the vaccine line).
- **Breathing**: hours with NH3 > 25 ppm or Dx > 1.5 raise a respiratory risk; while it lasts deaths
  `respiratory` 0.002 %/h, intake × 0.97, the breathing look 'rattle' on that share of birds.
- Biosecurity lapses: Phase 2's 'other' factor, and from week 2 each lapse adds 5 % to the coccidiosis
  severity.

### 6.8 Deaths by cause and the abnormal-deaths report
Causes (`EV.FARM_DEATH`): Phase 2's (cold, heat, dehydration, weak, starveout, other, box) plus `sds`
(on its back), `legs` (thin, beside the lines), `disease` (hunched, by the walls), `respiratory`, and
`doa` (counted at the plant, never on the floor). Reference ideal deaths + culls by level: brooding 0.5–0.9
% (Phase 2), week 2 0.15–0.5 %, week 3 0.15–0.5 %, weeks 4–5 0.2–0.8 % (no heat deaths: §6.3),
finishing 0.15–0.5 % + DOA 0.1–0.25 %; the cycle 1.4–3.2 %. `abnormal-deaths` (Phase 2 problem,
`p-report`): more than 0.3 % of the placed chicks counted at the bin in one day on days 0–7, more than
0.15 % from day 8.

### 6.9 Finishing, catching, harvest (general practice)
- **Catch time** `farm.harvest.catchAt`: `phone.bookCatch { day, hour }` (a farm action, §13.3: inside day
  41 18:00 … day 42 06:00 it books and returns `{ booked: true, catchAt }`, else `{ booked: false, catchAt,
  reason }` with the plain fact; booked at `stats.catchBookedAt`) or the company's default day 42 02:00.
- **The catch**: at catchAt the crew (4) and two trucks come (`EV.FARM_DELIVERY { kind: 'catch', phase:
  'arrive' }`). Eight sections of 6 m (x −24 → +24) are caught from the door end: order 1, 0, 2, 3, 4, 5,
  6, 7; each takes 22 game min (model) → about 3 h. `farm.harvest.sections[i] = { x0, x1, state:
  'waiting' | 'penned' | 'catching' | 'done', birds }`, `EV.CATCH { phase: 'start' | 'section' | 'end', i,
  birds }`. Truck 0 then truck 1 fill (300 crates × 10 birds each); `EV.FARM_DELIVERY { kind: 'catch',
  phase: 'leave', truck }`. Without `catch.panels` each section takes 5 min longer and DOA rises. (The
  stub runs this sequence now, §13.8.)
- **DOA** (model) = birds · (0.0010 + 0.0004 · max(0, e_catch − hotFrom) + 0.0008 · [lux > 12] + 0.001
  · [no panels] + 0.0005 · max(0, W − 12)); e_catch = mean e of the birds still in the house.
- **Weight tickets** `load.ticket { truck }` → `{ crates, birds, grossKg, tareKg: 12000, netKg, doa }`
  (net = the birds' live weight after shrink ± 0.2 %).
- **Harvest result** `farm.harvest.result`: birds sold (loaded − DOA), mean live weight (net ÷ loaded),
  FCR (all feed delivered and at the start − feed left, ÷ net kg), mortality (deaths + culls + DOA ÷
  placed), uniformity (the last hand weighing of ≥ 10 birds, ± 10 %), EPEF = livability % × mean live kg ÷
  (age days × FCR) × 100 (general formula), feed left kg, withdrawal hours, gut-full note. The key target
  compares the mean live weight with 90 % of `weightAt(age at the catch) × HARVEST.shrink` (2,826 × 0.98 ×
  0.9 = 2,493 g for a catch at day 42 02:00).
- Reference ideal (seed 1): catch d42 02:00, W 8–12 h, DOA 0.1–0.25 %, live 2,820–3,020 g (about 2,925),
  FCR 1.55–1.72, mortality 1.4–3.2 %, uniformity 62–80 %, EPEF 360–440, feed left < 1.2 t.
- After the catch `farm.flock.alive = 0`, `present = false`; the litter keeps its state.

### 6.10 Clean-out and rest (wash steps general)
- `farm.clean` (576 cells): `wash`, `spray`, `wet` grids (0..1), `brushed { lines, fans, pad, brooders,
  inlets }`, `lines[4]` (0..1 disinfected), `disinfectant` (the header tank holds it), `pans[3]`, `washbay
  { boots, buckets, barrow, washer }`, `baits[4]`, `closedDay`, `swabs [{ x, z, spot, cell }]`, `labDay`,
  `lab { positive, of, places: [{ x, z, positive }] }`, `pass`, `bookedDay`. Shares: `washShare` and
  `sprayShare` = the mean of their grid over all 576 cells; `wetShare` = the mean of `wet` (0 dry .. 1
  soaked) over all cells (`house-dry`: ≤ 0.1).
- `clean.scrape { x, z, r: 2.0 }` (quiet, while carrying the scraper, a 4 m strip): cover → 0 there.
- `clean.wash { x, z, r: 2.5 }` (quiet, washer, a 5 m strip): wash → 1 on bare cells, 0.3 where litter is
  left; wet → 1. Three walks along the house (z −4, 0, +4) cover it.
- Drying (model): wet −= `(0.04 + 0.03 · env.fansEffective) · (1 − outside RH/150)` per hour: at 65 %
  outside about 44 h with no fans, about 8 h with six.
- `clean.spray { x, z, r: 2.5 }` (quiet, sprayer): spray = max(spray, wash · (1 − 0.7 · wet)).
- **Swabs** `clean.swab { x, z, spot }` at the ten fixed places `CLEAN.swabSpots` (drinker lines, feeder
  pans, the pad, the fans, two corners, an inlet, inside the door: where cleaning is hardest; scene marks
  each with a small flag, the `swab` provider answers only there). The lab letter 2 days later
  (`EV.LETTER { kind: 'lab' }`) is **the whole house's** cleaning: swab i is positive with p = 0.02 + 0.9 ·
  (1 − the 10th-percentile spray of its house sector) + 0.1 · (parts not brushed ÷ 5) + 0.15 · (litter cover
  of its sector) (model, seeded): an unsprayed strip anywhere in a sector shows at that sector's place.
  The farmer's swabs only place the results on the swab map (unlock `swabMap`). More than 2 positive
  starts `swab-positive`: wash and spray are cleared (a second pass, `pass` + 1).
- `house.close` sets `closedDay`; `phone.bookChicks { day }` (a farm action: day ≥ closedDay + 14 and ≤ 69
  books and returns `{ booked: true, bookedDay }`, else `{ booked: false, bookedDay, reason }`); rest days =
  bookedDay − closedDay. The empty, closed house steps cheaply (no flock).
- Reference: ideal 0–1 positive, rest 21; `wetDisinfect` (sprayed an hour after washing) 3–9 positive;
  `litterLeft` (25 % cover) ≥ 3.

### 6.11 Plan sums and the contract's terms (`src/farm-plan.js`, pure, **in code now**)
`planSums({ houses, birdsPerHouse, cycleDays, lossesPct, saleKg }, houseM2)` → his numbers with his own
losses figure: `{ chicksPerWeek = houses · birdsPerHouse · 7 / cycleDays, salePerWeek = chicksPerWeek ·
(1 − losses), densityKgM2 = birdsPerHouse · (1 − losses) · saleKg / houseM2, birdsPerM2, restDays =
cycleDays − 42 − 4, houseM2 }` (the planning calculator, `losses-as-planned`). `planOutcome(plan, houseM2)`
→ the company's reply: the same sums with `lossesCountedPct = max(his losses, PLAN_CONTRACT.lossesMinPct
4)`, and four terms `[{ key, value, limit, met }]`: birds for sale a week ≥ 3,600 · density ≤ 32 kg/m² ·
rest days ≥ 21 · chicks a house ≤ 6,000; `pass` = all four. `PLAN_CONTRACT` (config, general): the letter's
terms, 2.8 kg sale weight, 42 growing and about 4 clean-out days, houses 1–12, chicks per house
1,000–9,000, cycle 49–100 days, send by 16:00. houseM2 = his measured floor (48.0 × 12.0 = 576), else the
company's drawings (600, the standard 50 × 12 m house): measuring changes the density he sees (28.0 against
26.9 kg/m²). Reference (`test-cycle`, `test-contracts`): 6 × 6,000 × 67 d at 4 % → 3,761 chicks, 3,611 for
sale, 28.0 kg/m², 21 rest days (passes) · 5 houses → 3,009 (not passed) · 6 × 7,000 → 32.7 kg/m² and over
6,000 a house (not passed) · 6 × 6,000 × 63 d → 17 rest days (not passed) · 5 × 6,000 × 49 d at 0 % → his
sheet 4,286, the reply 4,114 at 4 % and 3 rest days (not passed) · 4 × 6,500 × 49 d at 0 % → not passed ·
6 × 6,000 × 67 d at 6 % → 3,535 (his higher figure is used: not passed) · 7 × 6,000 × 77 d → 3,665, 31 rest
days (passes: more houses, longer rest).

### 6.12 Readings and samples (new instruments)
`light.lux { x, z }` → `{ lux }` ± 2 (key L) · `air.probe { x, z }` → `{ speedMs ± 0.1, tempC ± 0.2, rh ± 2 }`
(key V) · `sample.bird { x, z, index, look }` → `{ look, value }`: gait 0–5, feathers good | patchy | poor,
feet 0 | 1 | 2, breathing quiet | snick | rattle, droppings normal | caecal | watery | undigested | bloody |
white, crop full | half | empty, weight (the hand scale, g) · `gas.meter` → `{ kgLeft, kgUsed }` ·
`pad.check` → `{ dry: [6 sections], flowing }` · `fan.fix { index }` → `{ fixed }` · `pad.flush` / `pad.fixFloat`
→ `{ fixed }` · `load.ticket` (§6.9) · `plan.measure { axis, m }` → `{ m }` (48.0 / 12.0 ± 0.05 when hooked
and read at the end walls) · `clean.swab { x, z, spot }` → `{ n }` (results only on the lab letter) ·
`phone.bookCatch` / `phone.bookChicks` (§6.9, §6.10) · `dead.count { n, causes, byLook? }` (Phase 2; with the
*dead birds by look* unlock the bin panel adds `byLook: { back, thin, wingsOut, hunched }`, the farmer's
own counts, kept in the record row `deadByLook`).

### 6.13 What the farmer sees and hears (`farm.observe`, look notes; neutral words)
From day 8, added to Phase 2's words: spread 'spread over the whole house' · 'crowded in the brooding
half' (curtain down, D/A > 1.2) · 'panting along the walls, wings out' (pantShare > 0.2) · 'sitting
hunched, feathers fluffed' (disease); droppings 'some frothy caecal droppings' (normal, 1 in 10) ·
'undigested feed in the droppings' · 'blood in some droppings' · 'white, watery droppings'; sounds 'a
rattle in the breathing' (Dx > 1.5 or NH3 > 25) · 'gasping' (e > deathFrom − 1); air 'damp air, wet
patches by the walls' (RH > 85, house under 26 °C) · 'damp, heavy heat' (RH > 85, house over 30 °C) ·
'dusty air' (Dx > 1) · 'the ammonia stings your eyes' (NH3 > 20).

### 6.14 Acceptance (sim) — `node scripts/test-cycle.mjs` (`CYCLE_TARGETS`, `SNAPS`, `checkCycle`: in code now)
`src/farm-profiles-cycle.js`: `applyCycleRound(farm, env, day, round, profile)` (the ideal and the named
mistakes for days 8–69, through `farm.act` and the env setters, as `applyRound` does for week 1) and
`runCycle(name, { seed, from, to })` (from a standard start of level `from` through level `to`, playing
the level's part: records signed at 20:00, dead birds counted, checkpoints). Seed 1. **The model never
grades itself**: `runCycle` returns a trace — `hourly` (one row per game hour: outside and house °C and
RH, felt mean, panting share, air speed, `fansManual`, `fansEffective`, pad, NH3, dust, alive, deaths by
cause and culls by reason (cumulative), feed eaten (cumulative), mean weight, litter means, the flock's
main droppings look, the pan mix, lame birds on the floor), `levels[id]` (the level results of §10),
`levelEnds[id]` (JSON of `farm.health`, `farm.problems`, `farm.stats.levelStart` at each level end),
`points` (by branch) and the records — and the integrator's `checkCycle` measures every snap from that
trace with the definitions in `SNAPS` (each names its day, hour, quantity and units in the file). The
ideal's fans and pads follow `cycle-refs.mjs idealFans` / `idealPad` at its stops (06:15, 09:00, 11:00,
13:15, 15:30, 18:30, 21:00: fans by the outside temperature over the target, pads with six fans when the
outside is ≥ 10 °C over it, off over 90 % house RH); it never uses the stage table.

| Profile | Management (differs from the ideal in …) | Expect (`CYCLE_TARGETS`) |
| --- | --- | --- |
| `ideal` | timer by the table every other morning; growing light preset from day 8; curtain day 10 08:00; vaccine with 1.5 h thirst, stabiliser and a walk; grower ordered d13, blended d14 15:00 → d15 15:00; finisher d29; every problem fixed on the first round after its symptom (day 16: six fans); brooders up d22; fans and pads by the fan plan; feeders up 11–16 in the heat wave; last feed order to under 1.2 t left; catch booked d38 for d42 02:00; lines stopped d41 15:00 (pans empty about 16:00, W ≈ 10 h); lights 0.1 and panels at 01:30; clean-out in order with the house ≥ 95 % dry before spraying; closed d46; chicks booked d67 | every level passes · week 2 day 14 485–530 g, deaths + culls 0.15–0.5 % · week 3 960–1,040 g, 0.15–0.5 % · weeks 4–5 day 35 2,230–2,420 g, 0.2–0.8 % · finish §6.9 bands · clean-out 0–1 positive, 21 rest days · vaccine T 1.5–2.2 h, coverage 0.92–0.98 · day 31 15:00 house 28.8–31.5 °C, panting ≤ 0.3 · heat-wave heat deaths ≤ 0.05 %, 1–12 panting hours · weeks 4–5 heat deaths ≤ 0.05 % · day 18 15:00 panting ≤ 0.35 · NH3 ≤ 25 ppm on the nights of days 22–41 · **every branch ≥ 9 points** (level 2, the plan level included; §9) |
| `noDark` | 23 h light all cycle | SDS deaths days 8–35 ≥ 3 × ideal; lame + legs ≥ 2 × ideal |
| `lateLift` | curtain on day 15 | day 14 weight ≥ 3 % and uniformity ≥ 3 points under the ideal; brooding-half litter ≥ 32 % on day 14 |
| `noStep` | timer left at the day 8 setting days 8–21 | RH ≥ 85 % on 3–7 nights of week 2; litter mean ≥ 33 % on day 14; NH3 ≥ 25 ppm the night of day 14; day 21 ≥ 3 % under ideal |
| `poorVaccine` | no thirst, no stabiliser | T 3.5–5 h, coverage 0.35–0.7; Gumboro started; week 3 disease deaths 0.3–0.6 %, deaths + culls 0.5–0.95 %, **passes**; day 21 4–8 % under ideal |
| `poorVaccineCocci` | `poorVaccine` and the coccidiosis untreated | week 3 disease deaths 0.9–2.5 %; fails week 3 (the replay test of test-run, §10) |
| `cocciUntreated` | vet called, no medicine | week 3 disease deaths 0.5–1.5 %; fails week 3; day 21 ≥ 2 % under ideal |
| `minVentW3` | no tunnel fans in week 3 | passes week 3; panting 0.8–1 at 15:00 day 18; heat deaths ≤ 0.05 %; day 21 1–4 % under ideal |
| `crumbleOn` | starter only to day 28 | day 28 weight 3–8 % under ideal |
| `abruptChange` | grower 0 → 100 % at d15 06:00 | undigested droppings 12–30 h; intake d15 06:00 → d16 06:00 2–4 % under ideal |
| `overfullSilo` | 5 t of starter ordered on day 12 | the pans first ≥ 90 % finisher on day 31–40; day 35 weight 0–3 % under ideal |
| `dustOn` | no fan change for the dusty air | dust peak on day 23 1.5–2; ≥ 3 dusty hours that day |
| `noTunnel` | minimum ventilation only from day 22 | weeks 4–5 fails early, on day 23–27; heat deaths ≥ 2 % |
| `fansNoPad` | fans, never the pad | day 30 15:00 house 38–40.5 °C; heat-wave heat deaths ≥ 2 %; weeks 4–5 fails on day 30–31 |
| `padInHumid` | pads on all day 33 | felt at 15:00 day 33 1.5–3.5 °C over the ideal; heat deaths that day 0.15–1 % |
| `fanUnfixed` | fan 4 never fixed | air speed with six fans switched on 2.0–2.2 m/s; heat-wave panting hours ≥ 2 × ideal |
| `noWithdrawal` | feed on until the catch | gut-full note; live weight ≥ ideal + 1 % |
| `longWithdrawal` | feed off 24 h before | live weight 3.5–6 % under ideal; DOA ≥ 2 × ideal |
| `brightCatch` | lights 1.0 during the catch | DOA ≥ 1.4 × ideal |
| `wetDisinfect` | sprayed an hour after washing | 3–7 positive (`CYCLE_TARGETS`; §6.10 allows 3–9 for other seeds); clean-out not passed without the re-wash |
| `litterLeft` | 25 % of the litter left in | 3–10 positive |
| `shortRest` | chicks booked 14 days after closing | rest 14; clean-out not passed |
| `determinism` | ideal twice, seed 7 | records `serialize()` and the hourly trace identical, byte for byte |
Phase 2's `PROFILE_TARGETS` all pass unchanged (`node scripts/test-sim.mjs`). Also in the file, running
now: the climate check (every `CLIMATE_REFS` and `WINDOW_REFS` band of §6.3–§6.4), the growth check
(§6.1) and the plan-sum terms (§6.11).

### 6.15 Speed and save size
`farm.step` ≤ 0.5 ms in node with the whole house in use; a 24 h skip ≤ 200 ms; the whole cycle (−1 → 67)
≤ 15 s in node (the climate check alone runs in about 4 s). Run save ≤ 250 KB at any time, each level
start ≤ 250 KB, everything ≤ 2 MB (§11).

### 6.16 Tuning log (sim, at integration)
The sim package records here every model constant it changed to reach §6.14, with the reason (Phase 2
did the same in its §6.11). A band of `CYCLE_TARGETS`, `CLIMATE_REFS` or `GROWTH_REFS` changes only with
the integrator. Design-review changes already made (before the branch): pad by the outside wet bulb at
0.8 efficiency (the Phase 2 rule overstated humid-air cooling and saturated the house); outside air by
the day's water content (a fixed 65 % made every pad hour 95 %); humidity term from 75 % instead of 60 %;
hotFrom / deathFrom raised for big birds (the 20 °C target under 24 °C Thai nights); FEED_STD_TABLE and
FPG_TABLE so the ideal is about 5 % over the target on every weigh day; Gumboro day 18 and gentler;
coccidiosis from 0.008 %/h; lame birds 8e-6; crowding A(a) = 30 − 1.2a, slope 0.15; dust K 4.2 with the
feeding hours.

## 7. Problem events of the new levels

In `config.LEVELS[i].problems` (same shape as `LEVEL1.problems`; same days on every replay, PHASE2.md
open question 4). `farm.enterLevel(def)` adds that level's problems (pending) and their weather events,
and re-arms the two recurring ones (`abnormal-deaths`, `low-silo`) for the level. **Only the farm decides
that a symptom was met** (an action it sees, an `EV.NEAR` for one of `farm.problemZones()`, a listen stop,
the radio, its own state), then emits `EV.FARM_PROBLEM { id, phase: 'symptom' }` once; the job engine
opens the job. A gauge reading opens a job only where the reading *is* the investigation.

| Problem | Starts | What changes | Symptom | Fixed when (the farm) | Job |
| --- | --- | --- | --- | --- | --- |
| `rainy-spell` | d9 07:00 → d10 18:00 | outside −2 °C, RH 92 % | `controller.read` with house RH ≥ 80 %; `litter.squeeze` ≥ 32 %; a listen with RH ≥ 85 % | a vent change after it was found and RH ≤ 75 % for 60 min ('air'); else the spell ends ('weather', the job stays open) | p-damp |
| `lame-birds` | d11 06:00 | at least one lame bird on the floor from now (the lame model runs from day 10) | `EV.BIRD_PICK { purpose: 'lame' }`; `sample.bird { look: 'gait' }` ≥ 3 | `lameOnFloor` 0 | p-lame |
| `sudden-deaths` | d13 04:00 | one SDS death by a feeder line if none yet | `EV.DEAD_PICK` with `causes.sds` > 0 | `controller.read` after it was found | p-sds |
| `pad-overflow` | d17 10:00 | 0.8 L/h into the two westmost cell columns | zone (−23, 0) r 2.5, dwell 2 s, minMoisture 35; squeeze ≥ 35 % within 2.5 m; `pad.check` (water over the sump) | `pad.fixFloat` | p-pad-wet → p-pad-patch |
| `coccidiosis` | d19 05:00 | §6.7 | `sample.bird { look: 'droppings' }` → bloody; a listen in the bloody zone | `water.medicate { on: true }` | p-blood |
| `warm-afternoon3` | d16 11:00 → 17:00 | outside +2 °C, sun 1 °C/h (RH: the day's water, about 49 % at 15:00) | a listen or `fans.read` / `controller.read` with pantShare > 0.2 | a fan / pad change and `heat-handled` 30 min ('air'); else 'weather' | p-heat3 |
| `gumboro` | d18 06:00, only if vaccine coverage < 0.85 | §6.7 | a listen ('sitting hunched'); droppings look 'white'; the abnormal-deaths count | `phone.vet` | p-hunched |
| `dusty-air` | d23 04:00 → d24 18:00 | outside RH −30 points (`rhDrop`) | a listen with Dx > 1 or the rattle; `sample.bird { look: 'breathing' }` → rattle | a vent change and `air-clear` for 2 h ('air'); else 'weather' | p-dust |
| `hot-afternoon` | d25 11:00 → 17:00 | outside +3 °C, sun 1.5 °C/h (RH about 47 % at 15:00) | `fans.read` / `controller.read` or a listen with pantShare > 0.2 | a fan / pad / stage change and `heat-handled` 30 min ('air'); else 'weather' | p-panting |
| `fan-belt` | d27 09:00 | fan 4 (index 3) belt broken: `env.setFansBroken([3])` | `fans.read` (fan 4: lamp on, no air); zone at fan 4 inside r 2, dwell 2 s; `air.probe` east of x 12 under 85 % of the fans' speed | `fan.fix { index: 3 }` | p-fan |
| `pad-clog` | d29 10:00 | a third of the pad dry (padWorking 0.67) | `pad.check` (dry sections); zone at the dry section inside the west wall r 2, dwell 2 s | `pad.flush` | p-pad-dry |
| `heat-wave` | d30 10:00 → d32 19:00 | outside +6 °C (≈ 39 °C, RH about 40 %; nights 30 °C), sun 2 °C/h | `radio.listen` on day 29 ("Heat wave: up to 39 °C for three days"); `fans.read` days 30–32 with pantShare > 0.2 | `fans.read`, `pad.check` and a `water.flowtest` after it was found | p-heatwave |
| `humid-heat` | d33 10:00 → 18:00 | outside RH 85 % | `fans.read` / `controller.read` with house RH ≥ 85 % and house ≥ 30 °C; a listen ('damp, heavy heat', 'gasping') | a pad / fan change and `pad-humid-ok` 30 min ('air'); else 'weather' | p-humid |
| `hot-finish` | d38 11:00 → 17:00 | outside +4 °C, sun 1.5 °C/h (RH about 44 %) | as hot-afternoon | as hot-afternoon | p-panting-fin |
| `swab-positive` | at the lab letter, only with > 2 positive | wash and spray cleared | `swab.read` | the second lab letter ≤ 2 positive | p-rewash → p-reswab |
`farm.forecast(day)` (radio) knows the rainy spell (day 8: "Rain for two days from tomorrow"), the warm
and hot afternoons ("Tomorrow afternoon hot, up to 36 °C"), the dry spell (day 22: "Dry air from tonight")
and the heat wave (day 29). The ideal profile finds and fixes each one on the first round after its
symptom (§6.14). Symptom thresholds are the farm's detection, never a sign fact; every `Fixed when` state
can be met while its weather lasts (the climate check, §6.3).

## 8. Flock records (sim: data, `records*.js`; run: the office book UI)

### 8.1 Daily rows to day 46
`RecordRow` (records-rows.js) keeps every Phase 2 field and adds, null when not measured: `darkHours`,
`luxMeasured` (mean of today's `light.lux`), `houseRhMin` / `houseRhMax` (controller memory, read that day),
`airSpeedMs` (mean `air.probe`), `fansMax` (most tunnel fans seen on the fan panel today), `padOn` (seen
on), `lameCulled`, `feedType` (main type in the pans at the morning feeder check), `vaccine` ({ hours }),
`medication` (on that day), `gasKgUsed` (between two gauge readings), `deadByLook` (only with the
*dead birds by look* unlock: on its back / thin / wings out / hunched counts the farmer made at the bin).
Weight: the automatic scale every day (Phase 2) and "weighed" on weigh days. The week table is split by
level (tabs Week 1 · Week 2 · Week 3 · Weeks 4–5 · Finishing · Clean-out); rows of past levels stay
readable all cycle.

### 8.2 Plan tab
While `run.plan` exists: the contract (its terms as plain lines), his sums and decisions as he wrote
them, the company's reply (`planOutcome`: each term with his number beside it). On the planning day the
tab has *Open the planning sheet* (`api.openPanel('plan-sheet')`; the office desk itself opens the records
book, as in Phase 2). With Farm Planning level 2 (*plan against the flock*): beside them the running cycle's numbers
(losses so far, weight against the plan's sale weight, days used).

### 8.3 Harvest page (day 42 row)
Each truck's ticket (crates, birds, gross, empty, net, DOA); birds sold; mean live weight; FCR; deaths +
culls + DOA, by level and in all; uniformity (day 40 weighing); production efficiency (EPEF, formula on
the page, general); feed left; withdrawal hours; the plant's note (gut fill). Plain numbers; target
columns only with Growth level 1 (*flock records screen with targets*).

### 8.4 Clean-out page
What was done and when: litter out, washed %, dry %, disinfected %, lines, pans, wash bay, bait, swabs
taken, the lab letter (n of 10; with Biosecurity level 3 the places on a plan of the house), house
closed, chicks booked, rest days.

### 8.5 Cycle summary (`records.cycleSummary({ plan, levels })` in `records-cycle.js`)
One signature: the records object already holds the farm; the run passes `{ plan: run.plan, levels:
run.state().levels }`. Returns `{ placed, sold, liveKg, meanLiveG, fcr, epef, mortalityPct,
deathsByLevel[], weights: [{ day, weighedG, targetG }], feedKg, waterL, gasKg, restDays, swabsPositive,
plan: { lossesPct, saleKg, salePerWeek, cycleDays } | null, actual: { lossesPct, saleKg, cycleDays },
points: { branch: n } }`; the run package draws it. (`records-cycle.js cycleSummary(records, farm, {
plan, levels })` is the module function behind it.)

### 8.6 Compaction (save size)
`records.compact(beforeDay)` at each level start: notebook lines of days before the previous level's start
are folded into the rows (rows stay whole) and what the milestones still need (`skills-cycle.js` says per
milestone); look notes older than that keep one line a day.

### 8.7 "Your week" per level (`records.timeline()`)
Phase 2's fields plus `darkHours`, `luxMeasured`, `ventTimerM3h` against `ventSignM3h` (the extended table),
`fansMax`, `padOn`, `feedType`, `curtainOpen`, `vaccineHours`, for the level's days. The result screen
shows the rows of its level.

## 9. Skill tree: all eleven branches

Every branch is earnable in Phase 3. Points per level `SKILL_LEVEL_POINTS` 4 / 9 / 15 (Phase 2).
Milestones: Phase 2's 17 (`skills.js MILESTONES`) plus **`MILESTONES_CYCLE`** in `src/skills-cycle.js`
(contract data: `id, branch, level, checkpoint, text, tiers [{ points, rule }]`); `skills.js` exports
both as `ALL_MILESTONES`, **every Phase 2 milestone tagged `level: 'level1'`**. A milestone is a result of
play, kept per profile, only ever raised (PHASE2.md §9); its detail line is the measured value in plain
words. **Every threshold a tier names is on the sign or plate its job links** (§5), or is a measured
outcome the milestone text states ("Hours of panting per bird in the heat wave: 12 or fewer"): no tier
scores a setting the signs do not give.

**Level filter (in code now, `skills.js`):** `evaluate(checkpoint, ctx)` takes only the milestones of the
checkpoint's level: `ctx.level`, else the level the run last announced (`EV.RUN level-start`) or an
`EV.LEVEL` event carried, else `'level1'` (Phase 2's lone brooding week emits no level). Phase 2's rules
therefore never run at a later level's checkpoint (a 3.8 × brooding week earns no day7-weight at the day
14 weigh-in: `test-contracts.mjs` checks it). The cycle milestones of level `'level1'` are evaluated
**only inside a run (`ctx.run`) and only at the brooding week's `level-end`**: the week plays exactly as
Phase 2 (no new unlock appears during it); its result screen inside a run lists their points too, and
`test-level.mjs` (the lone week) awards exactly Phase 2's. Until the packages merge, `evaluate()` and the
current skill tree use Phase 2's `MILESTONES`; sim switches `evaluate()` to `ALL_MILESTONES`, run's skill
tree shows all eleven branches from it, and at the run merge the integrator sets `earnable` true for every
branch. **Checkpoints** (`EV.LEVEL { phase: 'checkpoint', name, level, run, day? }`, emitted by the
level): `plan` (reply read), `placed`, `vent`, `crop`, `weighin` (each weigh day), `curtain`, `vaccine`,
`heatwave` (day 32 19:00), `catch` (house empty), `harvest` (day 42 record), `clean` (house disinfected),
`swabs` (lab read), `rest` (rest end), `level-end` (each level, with its id); plus `problem` (found /
fixed) and `day` (each record close) from the bus, which take the current level.

| Branch (max) | Milestones: id (level) points — the ideal's points from the plan level | Ideal |
| --- | --- | --- |
| Farm Planning (17) | plan-measured (plan) 1 · plan-meets 2 / 3 · plan-density 2 · plan-rest 1 · catch-booked (finish, ≥ 3 days ahead) 1 · last-order (< 1.2 t left) 2 · sold-as-planned 2 / 3 · losses-as-planned 2 · cycle-as-planned (cleanout) 2 | 17 |
| Biosecurity & Health (20) | gate-route (plan) 1 · dips-l1 / -w2 / -w3 / -w45 / -fin 1 each · dead-w2 / -w3 / -w45 1 each · vaccine-drunk (week2, ≤ 2.5 h / ≤ 2 h) 2 / 3 · lame-culled 1 · cocci-treated (week3) 2 · swabs-clean (cleanout) 2 / 3 · rest-3w 2 | 18–20 |
| Chick Arrival & Brooding (16) | Phase 2's 14 · curtain-ready (week2) 1 · curtain-day 1 | 16 |
| Body Temperature & Comfort (16) | vent-band (level1) 1 · comfort-w2 2 · no-chill-w2 1 · comfort-w3 2 · panting-short (weeks45, ≤ 60 / ≤ 45 h) 2 / 3 · heatwave-safe (≤ 12 / ≤ 6 h) 1 / 3 · comfort-fin 2 · catch-cool (DOA ≤ 0.2 %) 2 | 15–16 |
| Heat & Ventilation (16) | warm-timer (level1) 1 · w3-heat (week3) 1 · air-measured (weeks45, day 23) 1 · hot-first (day 25) 1 · pads-limit (pads off over 90 %) 2 · fan-fixed 1 · pad-flushed 1 · heatwave-ready 2 · heat-deaths-w45 2 / 3 · heat-finish (finish, ≤ 3 h) 2 · catch-air (≥ 3 fans) 1 | 16 |
| Moisture & Minimum Ventilation (16) | minvent-l1 (level1) 2 · litter-l1 1 · damp-cleared (week2) 2 · minvent-w2 2 · minvent-w3 2 · litter-w3 2 / 3 · pad-overflow 1 · dust-cleared (weeks45) 2 · ammonia-w45 1 | 16 |
| Heating (15) | preheat-day (level1) 2 · cold-night 2 · thermostat-off 1 · setpoint-w2 2 · nights-w2 2 · no-overheat-w2 2 · gas-w13 (≤ 300 / ≤ 250 kg, the gas plate) 2 / 3 · brooders-up 1 | 14–15 |
| Water (20) | Phase 2's 11 · flow-w2 / -w3 / -w45 / -fin 1 each · raised-w2 / -w3 1 each · medicine-course 1 · lines-cleaned 2 | 20 |
| Feed & Digestion (16) | pans-flooded (level1) 1 · never-out-l1 / -w2 / -w3 / -w45 / -fin 1 each · pellet-change 2 / 3 · droppings-read 1 · rim-w2 / -w3 1 each · finisher-change 1 · heat-feeders 1 · withdrawal (pans empty 8–12 h before) 2 | 16 |
| Lighting (16) | light-23h (level1) 2 · lux-l1 1 · light-arrival 1 · dark-w2 2 · lux-measured 1 · sds-w2 2 / 3 · lame-w3 2 · dark-w45 2 · catch-light (≤ about 10 lux) 2 | 15–16 |
| Growth & Performance (19) | w14 / w21 / w35-weight 1 / 3 (≥ 98 % / ≥ 103 % of the target) · weighed-weekly 2 · harvest-fcr 2 / 3 (≤ 1.75 / ≤ 1.65) · harvest-uniformity 2 (≥ 70 %) · epef 1 / 3 (≥ 340 / ≥ 390) | 19 |
The ideal column is what the ideal's bands of §6.14 give (the worst case inside the bands): **every branch
≥ 9 points** (level 2), checked by `CYCLE_TARGETS.ideal.snaps.minBranchPoints`. A run started at the
brooding week has no plan points (Farm Planning then reaches 11 at most: level 2).

### 9.1 What each branch level unlocks (`config.UNLOCKS`, 33 keys; the plan's examples first)
| Branch | Level 1 | Level 2 | Level 3 | Built by |
| --- | --- | --- | --- | --- |
| Farm Planning | `planningCalc` planning calculator at the office desk | `planVsCycle` your plan beside the flock in the record book | `planCarry` the next plan starts from this cycle's numbers | panels · run · panels |
| Biosecurity & Health | `symptomCheck` quick symptom check when you inspect a bird | `deadByLook` dead birds counted by how they look at the bin | `swabMap` swab places on the lab letter | panels · panels (scene routes the bin) · run |
| Chick Arrival & Brooding | `floorOverlay` floor thermometer view (Phase 2) | `brooderChart` 24-hour chart (Phase 2) | `sampleCard` the day's samples on one card in the bird-in-hand panel | scene · panels · panels |
| Body Temperature & Comfort | `comfortOverlay` comfort colour overlay on the flock (C) | `comfortGraph` comfort graph in the record book | `birdTemp` body temperature in the bird check | scene + run · run · panels |
| Heat & Ventilation | `windChill` wind chill readout on the fan panel | `tunnelStages` fan stages on the fan panel | `fanChart` 24-hour fans, pad and house chart on the fan panel | panels · panels · panels |
| Moisture & Minimum Ventilation | `moistureOverlay` litter moisture overlay (M) | `minVentCalc` minimum ventilation calculator on the controller | `humidityChart` 24-hour humidity chart on the controller | scene + run · panels · panels |
| Heating | `heatLoss` heat loss readout for the house | `gasGraph` gas use graph in the record book | `brooderZones` brooder heat zones on the floor view | panels · run · scene |
| Water | `waterTrend` water meter trend graph (Phase 2) | `lineOverview` all-lines overview (Phase 2) | `waterTest` water test kit at the water supply | run · panels · panels |
| Feed & Digestion | `droppingsGuide` droppings guide at the bird check | `feedGraph` feed per bird graph against the plate | `siloDays` days of feed left on the silo gauge | panels · run · panels |
| Lighting | `lightPresets` light program presets | `luxMap` light map on the floor view | `dimming` dawn and dusk dimming in the light program | panels · scene · panels |
| Growth & Performance | `recordsTargets` flock records screen with targets | `weightGraph` weight curve against the target | `uniformityChart` weight spread chart in the weigh panel | run · run · panels |
Unlocked tools never show a verdict: overlays use continuous ramps (`COMFORT_RAMP`, `MOISTURE_RAMP`, Phase 2's
`FLOOR_TEMP_RAMP`) with a legend in °C or %; graphs draw the farmer's numbers beside the plate's.

**When the ideal (a run from the plan level) unlocks each level 1 tool**, before the level that uses it:
`lightPresets` at the brooding week's end (light-23h 2 + lux-l1 1 + light-arrival 1), for day 8 ·
`heatLoss` at the brooding week's end (preheat-day + cold-night), for week 2's cool nights ·
`moistureOverlay` day 9–10 (minvent-l1, litter-l1, damp-cleared) · `symptomCheck` day 12 (gate-route,
dips-l1, vaccine-drunk), for week 3's diseases · `comfortOverlay` and `droppingsGuide` at week 2's end
(vent-band, comfort-w2, no-chill-w2 · pans-flooded, never-out-l1 / -w2, rim-w2), for week 3 ·
`recordsTargets` day 14 (w14-weight 3) · `windChill` day 25 at the latest (warm-timer, w3-heat on day
16, air-measured on day 23, hot-first on day 25), before the heat wave · `planningCalc` after the first
plan: the first plan is worked by hand from the sign (that is the level); the calculator is for the plan
level's replays and the next flock's plan.

## 10. Level end, pass and fail

- **End**: plan — the plan page signed after the reply (or day −1 06:00 by itself). Flock levels — the
  last day's record signed after the weigh-in (or the next day 06:00 by itself; then the automatic scale
  at 08:00 of the weigh day is used, `farm.stats.scaleAt[day]`, as Phase 2's `scaleAtWeighInG`). Finish —
  the day 42 record signed with the house empty (or day 43 06:00). Clean-out — 06:00 on the booked day
  (day 70 06:00 if nothing was booked: "no chicks were booked").
- **Measured values only**: weight = the hand weighing (≥ 10 birds) of the weigh day, else the scale;
  level deaths = deaths + culls during the level (+ DOA in finishing) ÷ birds alive at the level start
  (`farm.stats.levelStart`); harvest weight from the tickets, against 90 % of `weightAt(age at catch) ×
  HARVEST.shrink`; swabs from the lab letter; plan numbers from `planOutcome` (the company's terms).
- **Pass**: §2.1 table (constants in `config.LEVELS[i].target` / `fail`). **Fail early**: at any day's
  close the level deaths already over the limit.
- **Result screen** (run package) per level: the key numbers large, each only when measured (Phase 2's
  rule); the level's week table and "Your week"; the points earned; then "<Level> complete" or "<Level>
  not passed: <the measurement>." — e.g. "the company counts 4 % losses: your plan gives 3,009 birds for
  sale a week; the contract asks for 3,600", "your plan leaves 3 days of rest; the contract asks for
  21", "day 21 weight 840 g, 88 % of the 950 g target", "deaths and culls in week 3 reached 1.4 % on day
  20", "harvest live weight 2,480 g, 88 % of 2,826 g less 2 % shrink", "4 of 10 swabs grew bacteria",
  "the next chicks came after 14 days of rest". Buttons: *Continue to <next>* (passed) · *Replay <level>*
  (its saved starts that lie before the failing measurement: weeks 4–5 offers *from day 29* and *from day
  22*) · **Replay <previous level> (from day N)** · *Skill tree* · *Back to the title*. After the
  clean-out the cycle summary (§8.5) comes after the result.
- **Carried over** (the line under *Replay <previous level>*): the previous level's record lines that the
  model carries into this one, as plain facts from the records — the vaccine hours on day 12 when they were
  over 2.5 h ("vaccine drunk in 4.2 h on day 12"), the previous weigh-in when it was under 98 % of its
  target ("day 14 weight 455 g, 95 % of the target"), a disease still active at the level start, the
  litter mean over 30 % at the level start. No line, no extra emphasis: the button is always there. A
  failure whose cause lies in an earlier level is replayed there (the model is deterministic; the
  problems come on the same days). `test-run.mjs` covers it with `poorVaccineCocci` (§6.14).

## 11. Save format

- **Keys** (`config.RUN_SAVE`): `chickenFarm.run.v3` = `{ version: 3, savedAt, run: run.serialize(), blob:
  level.saveBlob() }`; level starts `chickenFarm.run.v3.start.<levelId>[.<day>]` (one per `def.starts`
  entry: weeks 4–5 has `.22` and `.29`) = `{ version: 3, levelId, day, savedAt, run, blob }`; the skill
  profile stays `chickenFarm.profile.v1` (Phase 2). Phase 2's
  `chickenFarm.level1.v1` is read once: *Continue* resumes it as a run at `level1` with no plan, then the
  run key replaces it.
- `run.serialize()` = `{ v: 1, seed, levelId, plan, levels: { [id]: { state: 'reached' | 'passed' |
  'failed', key: number | null, attempts, starts: [day] } }, summary, conditions: [] }`. The level-start
  counters live only in `farm.stats.levelStart` (in the farm's save).
- `level.saveBlob()` (Phase 2 shape) adds `level.levelId`; `env`: `maxDay`, `curtain` (forced value or
  null), `cycleClimate`, `fansBroken`, `padWorking`, `fanStages`, `broodersUp`; `farm.serialize()`:
  `levelId`, `house`, `health`,
  `harvest`, `clean`, `plan`, `air`, the second silo and the pan mix, `flock.lameOnFloor`; records: the new
  note kinds and rows; props: the curtain winch, carried tools (never a chick or a bird), crates and trucks;
  flock: lame birds and catch sections.
- **When**: Phase 2's moments, at each level start and at day 29 06:00 in weeks 4–5 (its start key,
  before the first frame), and at each level end (run key).
- **Restore order**: Phase 2's, with `def = levelById(blob.level.levelId)` for `farm.start(def, { keepClock })`.
- **Sizes**: §6.15. A failed write (quota) deletes the oldest level start that is not the current one and
  tries again; that level then offers a standard start. Storage blocked: the game plays the same and the
  run card says "Saving is off in this browser: replays start from a standard flock".

## 12. New 3D content (package "scene")

All procedural, flat-shaded, merged where repeated, no external files; everything new is hidden in the
sandbox (`farm.mode === 'off'`), so the Phase 1 farm looks exactly as before.

**Props, house, world, player**
1. **Boards** of `BOARDS_CYCLE` at `SPOTS3` (painted like Phase 2's, orange facts tab when highlighted);
   `sign-plan` on the office porch.
2. **Guard hut** bench and clothes rack; interactable `guard-hut` (use: `farm.act('bio.change')`, a 1 s
   crouch).
3. **Tape measure**: `props.startCarry('tape')` (the plan sheet's *Take the tape measure*); provider `tape`
   (carrying the tape, inside, within 1.2 m of an end wall or a side wall, priority 20): first E hooks
   (a yellow line from the hook to the farmer), E at the opposite wall reads → `farm.act('plan.measure',
   { axis, m })` (48.0 / 12.0 ± 0.05); *Put the tape back* at the office desk → `drop()`.
4. **Curtain winch** (crank box at `SPOTS3.curtainWinch`, interactable → panel `curtain-winch`); the
   curtain rises on `env.broodCurtain` false (house-brooders already animates it). The brooders stay down
   after the lift and winch up on `env.broodersUp` (level mode; the sandbox keeps Phase 1's rule).
5. **Fan panel** (switch box: six lamps, an air-speed display) → panel `fan-panel`; a broken fan's lamp on
   and blade still (`env.fansBroken`); `fan-0..5` interactables enabled while that fan is broken (use:
   `farm.act('fan.fix', { index })`, a 1.5 s reach).
6. **Pad pump** box outside the west end → panel `pad-pump`; the pad's flow look by section (dry third
   lighter, no water sheet), the sump overflowing while `farm.house.padFloatStuck`.
7. **Gas tank** (white LPG tank on legs) → panel `gas-tank`; **two silo slide valves** on the boots and the
   feed truck delivering to the silo of the ordered type.
8. **Hand tools** in the farmer's hand for 2 s (pose `reach`): light meter (L), air meter (V); carried
   `fork` (provider `fork` on a caked cell → `litter.fork`), `scraper` (paints husk → concrete while
   walking inside: quiet `clean.scrape { r: 2.0 }` every 0.3 m, like the barrow), `washer` with a hose to
   the wash bay (quiet `clean.wash { r: 2.5 }`), `sprayer` (quiet `clean.spray { r: 2.5 }`), `swabs`
   (provider `swab`: only within 1 m of one of the ten flags at `CLEAN.swabSpots`, shown on clean-out days
   from day 46; E → `clean.swab { x, z, spot }`, the flag turns over); interactables `bait-0..3` (use: `clean.bait`), `catch-panels`
   (use: `farm.act('catch.panels')`), `house-door` (use while clean-out: `house.close`), `loading-bay`
   (panel), `wash-bay` (panel; *Take the washer / sprayer / swab kit* call `startCarry`).
9. **Floor looks** (props-floor, from `farm.clean` and the litter grids): litter removed (concrete), washed
   and wet (dark wet concrete with a sheen, drying lighter), disinfected (faint blue-white), feathers on the
   litter after the catch, sparse droppings decals by type (bloody spots in the cocci zone); overlays by
   `props.setOverlay(name, on)`: `floorTemp` (Phase 2), `moisture` (`MOISTURE_RAMP`), `lux` (unlock
   `luxMap`), `brooderZones` (unlock); one overlay at a time.
10. **Air**: dust motes in the lamp light while `farm.air.dustIndex` > 1; the pad sump water.
11. **Catching night**: two catching trucks (flatbeds whose crate stacks grow as they fill) at the truck
    stop, four crew workers (the farmer's model in orange overalls) carrying crates from the section being
    caught to the door and the truck, catching panels across the house at the section edges, all driven by
    `farm.harvest.sections` and `EV.CATCH` / `EV.FARM_DELIVERY { kind: 'catch' }`.
12. **Wash bay** (concrete pad, drain, pressure-washer cart, hose reel, disinfectant drums, boot brush) and
    a litter trailer by the west end that fills while the scraper works; four bait boxes; the door shut
    while the house rests.

**Flock**
13. Ages 8–42 over the whole house after the lift (Phase 1's growth visuals, sizes by the weight
    quantile): at harvest weight the 1,800 drawn birds cover the floor, a white carpet.
14. Heat: panting, wings out, along the walls and toward the pad end on hot days, from `farm.comfort` per
    zone (`farm.comfort.eZ[8]`, `hotFrom`); cold: Phase 2 huddles for young birds.
15. Lame birds `farm.flock.lameOnFloor` drawn 1:1 (up to 24): sitting, short one-legged walks, by the
    drinker lines; the `sick-bird` provider catches them with purpose 'lame'.
16. Dead birds by cause: `sds` on its back, legs up, by a feeder line; heat along the walls, wings out;
    `disease` hunched by the walls; `legs` thin beside the lines.
17. Vaccination: water off → crowding at the dry lines; lines open → the flock rushes to drink.
18. Catch: 'penned' sections hold their birds behind the panels, 'catching' sections lose birds two or
    three at a time toward the crew, 'done' sections are empty; after the last section the house is empty.
19. Comfort colour overlay (C, unlock `comfortOverlay`): each drawn bird tinted from its felt comfort with
    `COMFORT_RAMP` (continuous blue → white at the target → orange; legend in °C from the target).
20. `flock.sounds()` adds 'snick' / 'rattle' (breathing) and 'pant' (heat); the `chick` provider catches
    any bird near the farmer while `level.sampling === 'bird'` (purpose 'check').
Budgets (as Phase 2): ≤ +1 ms per frame at 1,800 birds; ≤ 40 extra draw calls and ≤ 60 k extra triangles
in the house view; every new material compiled in the warm-up.

## 13. Contracts between packages (in code now)

Shared, integrator-owned and **frozen** for the packages: `src/config.js` (the Phase 3 section after the
second banner), `src/events.js`, `src/interact.js`, `src/main.js` (wiring and `__game` hooks),
`build.mjs`, `scripts/shoot.mjs`, `scripts/test-contracts.mjs`. Contract data and code committed now and
owned by a package: `src/content-jobs-cycle.js`, `src/content-signs-cycle.js` (run), `src/skills-cycle.js`,
`src/farm-plan.js`, `src/farm-heat.js`, the cycle climate in `src/sim.js`, `scripts/cycle-refs.mjs` and
`scripts/test-cycle.mjs` `CYCLE_TARGETS` / `SNAPS` / `checkCycle` (sim: the code may be improved, the
references, bands and snap definitions change only with the integrator). Need a change in a frozen file?
Put it in your report; the integrator makes it.

### 13.1 `config.js` (Phase 3 section)
`MIN_DAY` −2 · `CYCLE { planDay, prepDay, placeDay, harvestDay, cleanFrom, restMinDays, lastDay }` ·
`ROUNDS` · `PLAN_LEVEL`, `WEEK2`, `WEEK3`, `WEEKS45`, `FINISH`, `CLEANOUT`, `LEVELS` (with `LEVEL1`),
`levelById(id)`, `levelOfDay(day)` (each def with `n`, a "Level n – …" `title`, `short`, `starts`) ·
`FEED_STD_TABLE` (`feedStdGAt` extended; ≤ 7 unchanged) · `FPG_TABLE`, `feedPerGainAt` (≤ 14 Phase 2's) ·
`MIN_VENT_PER_1000` extended (≤ 200 g unchanged) · `OUTSIDE_WATER_GM3`, `PAD_EFF` (model) · `FEED_TYPES` ·
`LIGHT_PRESETS` · `HEAT` (`airSpeedAllFans`, `padOffAboveRH` 90, `feedersOffHours`) · `PLAN_CONTRACT` (the
letter's terms, `sendBy` 16) · `HARVEST` (the sign-catch figures: `withdrawalH`, `stopLinesBeforeEmptyH`,
`shrink`, `bookAheadH`, `catchLux`, `catchFansMin`) · `CLEAN` (`swabSpots`) · `SPOTS3` · `houseSector(x, z)`
· `COMFORT_RAMP`,
`MOISTURE_RAMP` · `UNLOCKS` (33, each with `by`: the package that builds it) · `RUN_SAVE` · `CONDITIONS`
(Phase 4, `available: false`). `SKILL_BRANCHES[i].earnable` stays Phase 2's until the run merge (§9).

### 13.2 Events (`EV`, `src/events.js`)
New: `RUN` 'run' `{ phase: 'start' | 'level-start' | 'level-end' | 'cycle-end', level, pass? }` (run) ·
`CATCH` 'catch' `{ phase: 'start' | 'section' | 'end', i, birds }` (farm) · `LETTER` 'letter' `{ kind:
'contract' | 'reply' | 'vet' | 'lab', day }` (farm: something new lies on the office desk). `EV.LEVEL`
checkpoints carry `level`; `EV.FARM_DELIVERY` gains kinds `'catch'` (`truck`) and feed `type`;
`EV.BIRD_PICK` purposes `'lame'` and `'check'`; `EV.FARM_DEATH` causes of §6.8. `ACTION_IDS` (events.js)
lists every action id of Phase 2 and Phase 3 (the contract test checks every job rule against it);
`UI_ACTION_IDS_CYCLE` the Phase 3 ui-only ones.

### 13.3 Actions — `EV.ACTION { id, ...args, result }` (Phase 2 shape; ui = ui-only, result undefined)
| id | args | result | called by |
| --- | --- | --- | --- |
| `sign.read` (ui) | `{ board }` | — | any board or plate panel (Phase 2) |
| `bio.change` | `{}` | true | guard hut (scene use) |
| `plan.letter` / `plan.reply` (ui) | `{}` | — | office book letters (run) |
| `plan.measure` | `{ axis: 'length' \| 'width', m }` | `{ m }` | scene `tape` provider |
| `plan.send` | `{ houses, birdsPerHouse, cycleDays, lossesPct, saleKg, sums }` | `planSums(...)` | planning sheet (panels) |
| `house.curtain` | `{ open }` | true | curtain winch panel (panels) |
| `heat.brooders` | `{ up }` | true | controller Temperature (panels) |
| `light.lux` | `{ x, z }` | `{ lux }` | L key (run) |
| `light.preset` (ui) then `light.program` | `{ id }` | — | controller Lights (panels, unlock) |
| `air.probe` | `{ x, z }` | `{ speedMs, tempC, rh }` | V key (run) |
| `fans.read` (ui) | `{ fans, houseC, rh, speedMs }` | — | fan panel open ≥ 2 s (panels) |
| `vent.fans` / `vent.pad` (ui, Phase 2) · `vent.stages` | `{ n }` / `{ on }` · `{ stages, padOverC }` | — · true | fan panel (panels) |
| `fan.fix` | `{ index }` | `{ fixed }` | scene `fan-N` use |
| `pad.check` / `pad.flush` / `pad.fixFloat` | `{}` | `{ dry, flowing }` / `{ fixed }` / `{ fixed }` | pad pump panel (panels) |
| `gas.meter` | `{}` | `{ kgLeft, kgUsed }` | gas tank panel (panels) |
| `sample.bird` | `{ x, z, index, look }` | `{ look, value }` | bird check panel (panels) |
| `chicks.cull` (Phase 2) | `{ n, reason: 'grading' \| 'sick' \| 'lame', index? }` | true | chick-in-hand / bird check |
| `water.main` | `{ open }` | true | water supply (panels) |
| `vaccine.mix` | `{ stabiliser }` | `{ litres }` | water supply, Vaccine tab (panels) |
| `water.medicate` | `{ on }` | true | water supply, Medicine tab (panels) |
| `water.test` | `{}` | `{ ph, chlorinePpm }` | water supply (panels, unlock) |
| `feed.valve` | `{ silo, open }` | true | silo panel (panels) |
| `feed.order` (Phase 2) | `{ kg, type? }` | `{ arriveDay, arriveHour, kg }` (kg: what fits in the silo of its type) | office phone (run) |
| `feed.withdraw` | `{ on }` | true | feeder box (panels) |
| `feed.wash` | `{ line }` | true | feeder box in clean-out (panels) |
| `litter.fork` | `{ x, z }` | `{ caked }` | scene `fork` provider |
| `litter.patch` (Phase 2) | `{ x, z }` | `{ onLeak, onPad }` (`onPad`: on the pad-overflow strip) | scene `patch` provider |
| `water.disinfect` | `{ on }` | true (`farm.clean.disinfectant`) | water supply, Clean-out tab (panels) |
| `water.flush` (Phase 2) | `{ line, on }` | `{ flushClear, disinfected }` (`disinfected` true and `clean.lines[line] = 1` while the header tank holds disinfectant) | water supply (panels) |
| `phone.vet` (ui) | `{ reason }` | — | office phone (run); the farm answers with the vet letter |
| `phone.bookCatch` | `{ day, hour }` | `{ booked, catchAt, reason? }` (inside `HARVEST.bookFrom..bookTo` and before the catch began; else `booked: false` with the plain fact) | office phone (run) |
| `phone.bookChicks` | `{ day }` | `{ booked, bookedDay, reason? }` (house closed, day ≥ closedDay + 14, ≤ 69) | office phone (run) |
| `dead.count` (Phase 2) | `{ n, causes, byLook? }` | Phase 2's | bin (scene / Phase 2); with `deadByLook` the bin panel (panels) adds `byLook { back, thin, wingsOut, hunched }` |
| `catch.panels` | `{}` | true | scene `catch-panels` use |
| `load.ticket` | `{ truck }` | `{ crates, birds, grossKg, tareKg, netKg, doa }` | loading bay panel (panels) |
| `clean.scrape` / `clean.wash` / `clean.spray` (quiet) | `{ x, z, r }` (r 2.0 / 2.5 / 2.5) | `{ share }` | scene while carrying the tool |
| `clean.brush` | `{ part }` | true | scene: E at the part while clean-out (the five parts) |
| `clean.washbay` | `{ item }` | true | wash bay panel (panels) |
| `clean.bait` | `{ x, z, i }` | true | scene `bait-N` use |
| `clean.swab` | `{ x, z, spot }` (spot: index into `CLEAN.swabSpots`) | `{ n }` | scene `swab` provider (at the flags only) |
| `house.close` | `{}` | true | scene `house-door` use (clean-out) |
| `swab.read` (ui) | `{}` | — | office book lab letter (run) |
The farm sees the ui-only ids it needs (`UI_ACTION_IDS_CYCLE`: `plan.letter`, `plan.reply`, `fans.read`,
`phone.vet`, `swab.read`, `light.preset`) on the bus, as Phase 2's `UI_ACTIONS`. The bookings are farm
actions (`farm.act`), so the ui shows their result and the job rules match `result.booked`.

### 13.4 Interactables and priorities (Phase 2 rule: highest priority, then nearest, facing counts)
| id | registered by | priority | E does |
| --- | --- | --- | --- |
| boards of `BOARDS_CYCLE` (`sign-plan`, `sign-light`, `sign-curtain`, `sign-legs`, `sign-air`, `sign-droppings`, `sign-heat`, `sign-feed`, `sign-catch`, `sign-clean`) | scene | 10 | sign panel (run, from the merged boards) |
| `curtain-winch`, `fan-panel`, `pad-pump`, `gas-tank`, `wash-bay`, `loading-bay` | scene | 10 | panel (panels) |
| `guard-hut`, `fan-0..5` (enabled while broken), `bait-0..3` (clean-out), `catch-panels` (finish night), `house-door` (clean-out, after the swabs) | scene | 10 | `use()` |
| providers `tape` · `fork` · `swab` (only while carrying that tool) | scene | 20 | `use()` |
| provider `chick` (Phase 2) also answers while `level.sampling === 'bird'` (a bird-check or droppings job open, day ≥ 8) | flock | 5 | catch → bird check panel (purpose 'check') |
| provider `sick-bird` (Phase 2) now also lame birds (purpose 'lame') | flock | 5 | catch → bird check panel |
| `dead-bin` (Phase 2 use) | scene | 10 | with the bucket: counts (Phase 2); with *dead birds by look* unlocked opens panel `dead-bin` (panels) |
The five clean-out brush parts are fixed spots inside (`SPOTS3.brush`: lines, fans, pad, brooders,
inlets), registered by scene, enabled on clean-out days, use → `clean.brush { part }`.

### 13.5 State other packages read
- `farm.house { curtainOpen, broodersUp, fansBroken[], padWorking, padFloatStuck, closed }`, `farm.health
  { vaccine, medication, disease: { gumboro, cocci } }`, `farm.air { dustIndex, ammoniaPpm }`,
  `farm.flock.lameOnFloor`, `farm.comfort.{ eZ[8], hotFrom, pantShare }` (`eZ[i]`: the mean comfort e of
  the 6 m strip i along the house, x −24 + 6i … −18 + 6i, always; strips the birds do not use — east of
  the curtain while it is down — hold `NaN`; Phase 2's brooder groups stay `farm.comfort.eG`),
  `farm.feed.{ silos[2] { type, kg, layers }, panType, withdrawn }`, `farm.harvest { catchAt, sections[8],
  trucks[2], result }`, `farm.clean` (§6.10), `farm.plan { decisions, sums, outcome, sentAt, replyAt,
  measured }`, `farm.stats` additions (`gasKg`, `scaleAt[day]`, `catchBookedAt`, `changedAt`, and
  `levelStart { level, day, alive, deaths, culls, doa }`: the one owner of the level-start counters, set by
  `farm.enterLevel`).
- `env.maxDay`, `env.broodCurtain` (level: the farm's), `env.cycleClimate`, `env.fansBroken`,
  `env.fansEffective`, `env.padWorking`, `env.broodersUp`, `env.fanStages`.
- `run.state()` `{ levelId, levels, plan, seed }`, `level.def` (the current level def), `level.sampling`
  adds `'bird'` (bird checks open), `skills.unlocked(key)` for every key of §9.1.
- `ctx.ui.registerPanel(id, build, opts)` and the panel helpers `L` (PHASE2.md ui.js) are passed to the
  panels package's `registerCyclePanels(api)` (§13.8, §13.9).

### 13.6 Keys (physical `KeyboardEvent.code`)
Phase 2's E, Esc, H, Q, T, F, N, K plus **L** light meter (lux at your feet), **V** air meter (air speed,
temperature, humidity at bird height), **C** comfort view (unlocked), **M** moisture view (unlocked).
The run package handles the keys in `ui.js` (as Q and T) and shows the reading over the farmer; help and
title cards list them. One floor overlay at a time (F, M, and the floor-view unlocks).

### 13.7 Hand-offs (carrying stays `props.startCarry` / `drop`, PHASE2.md §13.6)
| Chain | Steps (who) |
| --- | --- |
| Plan sheet | office desk E → records book (run) → Plan tab *Open the planning sheet* → `api.openPanel('plan-sheet')` (run) → `plan-sheet` panel (panels) → *Send the plan* → `farm.act('plan.send', …)` (panels) |
| Tape | plan sheet *Take the tape measure* → `startCarry('tape')` (panels) → `tape` provider hook / read → `plan.measure` (scene) → office desk *Put the tape back* → `drop()` (panels) |
| Fork, sacks | husk heap panel *Take the fork* / *Take a sack* → `startCarry('fork' \| 'sack')` (panels) → `fork` / `patch` providers (scene) → heap panel *Put it back* → `drop()` |
| Scraper | husk heap panel in clean-out *Take the scraper* → `startCarry('scraper')` (panels) → scene paints `clean.scrape` while walking inside → heap panel → `drop()` |
| Washer, sprayer, swabs | wash bay panel *Take the washer / sprayer / swab kit* → `startCarry(kind)` (panels) → scene paints `clean.wash` / `clean.spray`, the `swab` provider at the flags → wash bay panel → `drop()` |
| Bird check | `chick` / `sick-bird` provider → `flock.catchNearest` (Phase 2) → `startCarry('chick', { index })` and `EV.BIRD_PICK { index, x, z, purpose }` (flock: purpose 'check' while `level.sampling === 'bird'`, 'lame' for a lame bird) → ui.js (run) opens `bird-check` (day ≥ 8) or `chick-in-hand` (days 0–7) and calls the opened panel's `take(p)` → `sample.bird { look }` per button → *Cull* (`chicks.cull { reason }`) or *Put back* → `flock.releaseBird(index, culled)` (panels) |
| Dead birds by look | with `deadByLook`: E at the bin with the bucket opens panel `dead-bin` (scene routes it; panels builds it) → the farmer's counts → `dead.count { n, causes, byLook }` (panels) |
| Catch | `catch.panels` (scene use) → the farm runs the sections (§6.9) → `EV.CATCH` → flock removes birds, scene moves the crew and trucks → `load.ticket` at the loading bay panel (panels) |

### 13.8 Stub modules and contract code (in code now; each package replaces or extends its own)
| File | Owner | What it does now |
| --- | --- | --- |
| `src/farm-cycle.js` | sim | STUB. `installCycle(farm, env)` adds `farm.house`, `health`, `air`, `harvest`, `clean`, `plan`, `feed.silos` (layers), `flock.lameOnFloor`, `cycleStub: true`, `enterLevel(def)` (stores `farm.cycleLevel`), `farm.debug.set(path, value)`; **minimal state changes** so the run package's flows work on it: vaccine `water.main` off → mix → on → 'drunk' 2 h later (coverage 0.95); the catch at `catchAt` (default day 42 02:00) empties the eight sections over 3 h with `EV.CATCH` and the catch deliveries, fills the trucks and `harvest.result`; `clean.scrape` / `wash` / `spray` paint the grids and shares, the wet grid dries with the fans; ten swabs → the lab letter (0 positive) 2 days later at 06:00 with `EV.LETTER { kind: 'lab' }`; `house.close`; `phone.bookCatch` / `bookChicks` with their results and windows; `water.disinfect` and the disinfected flush; `cycleAct` falls through to Phase 2's `doAct` (true) for every other id |
| `src/farm-plan.js` | sim | complete: `planSums`, `planOutcome` (the contract's terms), `PLAN_FIELDS` |
| `src/farm-heat.js` | sim | complete (contract code): `HEAT_MODEL`, `hotFrom`, `deathFrom`, `humidityTerm`, `heatDeathRate`, `pantingAt`, `heatIntake`, `heatState(env, { age, weightG, cellFeel })`, `flockLoads`, `DUST`, `birdActivity`, `dustIndex`, `ZONES`, `zoneOfX`; the sim package wires them into the flock |
| `src/sim.js` (Phase 3 part) | sim | in code: `setMaxDay`, `setBroodCurtain`, `setCycleClimate`, `setFansBroken` / `fansEffective`, `padWorking`, `wetBulb()`, events' `rh` / `rhDrop`; still to build: `broodersUp`, `setFanStages`, `heatBudget()` |
| `src/farm-profiles-cycle.js` | sim | STUB. `applyCycleRound(farm, env, day, round)`: placeholder care (Phase 2's ideal `am` round on any day, feed orders, the curtain from day 10); `climateCare` (a fan + pad thermostat for free runs; stays exported, a no-op once the ideal runs the fans, until the run merge drops level.js's import); `CYCLE_PROFILES`; `runCycle` throws "not built" |
| `src/records-cycle.js` | sim | STUB. `harvestPage()` / `cleanPage()` → null, `cycleSummary({ plan, levels })` → placeholder from the counts, `compact()` no-op |
| `src/skills-cycle.js`, `src/skills.js` | sim | contract data `MILESTONES_CYCLE` (no rules yet: nothing is awarded); `ALL_MILESTONES` with Phase 2's tagged `level1`; `evaluate()` level filter (§9) in code |
| `src/run.js` | run | STUB. `createRun({ level, save, events })`: `state()`, `startRun()` (→ the brooding week; the plan level is not built), `startLevel(id, { from: 'standard' })` → `level.debug.freeRun(def.startDay, def.startHour)`, `serialize` / `restore`, `stub: true` |
| `src/level.js` (one addition) | run | `debug.freeRun(day, hour)`: plays the ideal brooding week (goto auto to day 7 12:00), then runs the clock to (day, hour) with the placeholder care, no jobs, no level end, no autosave — a level-mode farm at any age for the other packages' harness runs until standard starts exist |
| `src/content-jobs-cycle.js`, `src/content-signs-cycle.js` | run | contract data (§4, §5); not yet in the engine; `boardsForDay(day)` merges the boards for the ui |
| `src/content-jobs.js` (days only) | run | the Phase 2 routines' `days` run to day 41 / 46, `r-controller-pm` to day 14, the walks carry `area: 'used'` and `maxCells` (§4.2) |
| `src/ui.js`, `src/ui-boards.js` (small) | run | ui.js calls `registerCyclePanels(api)` after the Phase 2 panels with `{ register, L, boards, plate, sourceLabel, openPanel }`; `buildPlate(id, { open, day })` reads `boardsForDay` (the day from `setPlateDay`, set by ui.js) |
| `src/main.js` | integrator | creates the run (`ctx.run`), `__game.run`, `startRun`, `startLevel({ level })`, `cycleAt` |
| `src/ui-cycle-panels.js` | panels | STUB. `registerCyclePanels(api)` registers a placeholder panel (title, plate) for every new panel id |
| `scripts/cycle-refs.mjs` | sim | complete (contract): the check flock, the ideal's fan plan, `CLIMATE_REFS`, `WINDOW_REFS`, `GROWTH_REFS`, `runPlan`, `growthAt` |
| `scripts/test-cycle.mjs` | sim | `CYCLE_TARGETS`, `SNAPS`, `checkCycle`; the climate, growth and plan-term checks run now; profile tests skip while `farm.cycleStub` |
| `scripts/test-run.mjs` | run | the chaining tests skip while `run.stub` **or** `farm.cycleStub` (they need both real); `freeRun(30, 14)` reaches day 30 with birds alive |

### 13.9 One owner, one signature (the hand-over points)
| Point | Owner | Signature / meaning |
| --- | --- | --- |
| Disinfectant in the drinker lines | panels calls, sim answers | `water.disinfect { on }` → true; then `water.flush { line, on }` → `{ flushClear, disinfected }` |
| Booking the catch / the chicks | run (phone ui) calls `farm.act`, sim answers | `phone.bookCatch { day, hour }` → `{ booked, catchAt, reason? }`; `phone.bookChicks { day }` → `{ booked, bookedDay, reason? }`; the ui prints `reason` as given; jobs match `result.booked` |
| Panels api | run builds, panels uses | `registerCyclePanels({ register(id, build, { kind }), L, boards(id), plate(id, { open }), sourceLabel(src), openPanel(id) })` |
| Bird pick → panel | run (ui.js) | `EV.BIRD_PICK` → `openPanel(day ≥ 8 ? 'bird-check' : 'chick-in-hand')` then the panel's `take(p)` (a panel may define `take(payload)`; Phase 2's chick-in-hand and weigh panels do) |
| Opening the plan sheet | run | the records book's Plan tab button → `openPanel('plan-sheet')`; the office desk itself opens the records book |
| Dead birds by look | panels (panel), scene (routes the bin), sim (row) | `dead.count { n, causes, byLook: { back, thin, wingsOut, hunched } }`; the row keeps `deadByLook` |
| Bird-check purpose | flock (scene) | `EV.BIRD_PICK { purpose: 'check' }` while `level.sampling === 'bird'` (not 'bird') |
| Comfort zones | sim | `farm.comfort.eZ[8]` = 6 m strips along the house always (NaN where no birds); `eG` = Phase 2's brooder groups |
| Level-start counters | sim | `farm.stats.levelStart { level, day, alive, deaths, culls, doa }`, set by `farm.enterLevel`; the run reads it, never keeps its own |
| Cycle summary | sim | `records.cycleSummary({ plan, levels })` |
| Board merge | run | `boardsForDay(day)` (content-signs-cycle.js) is the only merge; `buildPlate` and `api.boards` / `api.plate` read it |
| Level titles | integrator (config) | `def.title` = "Level n – short"; the ui shows it (the brooding week's result head reads "Level 2 – The brooding week") |
| Swab places | integrator (config), scene, sim | `CLEAN.swabSpots[10]`; the provider only at them; `clean.swab { x, z, spot }`; the lab reads the whole house |
| Cycle climate | sim (farm) | `farm.enterLevel(def)` calls `env.setCycleClimate(def !== LEVEL1 && def !== PLAN_LEVEL)`; `farm.start` turns it off |

## 14. Work packages (four, disjoint files, parallel worktrees)

Each engineer works in `git worktree add ../cf3-<key> -b phase3/<key> main`, edits **only the files
listed** (new files with the listed prefixes are theirs too), codes against the stubs and §13 (§13.9 has
one owner and one signature for every hand-over point), and keeps these passing on the branch: `npm run
build`, `npm test` (also `scripts/test-cycle.mjs` — its climate, growth and plan checks run on every branch
— and `scripts/test-run.mjs`, whose chaining part skips while `run.stub` or `farm.cycleStub`),
`node scripts/shoot.mjs --scenario cold-hot --size 960x600`, `--scenario p2-hooks`,
`--steps scripts/phase1-jobs.json` (sandbox) and `--steps scripts/p2-level1.json` (the brooding week).
Other packages' stubs return placeholders or the minimal state changes of §13.8: test your side with them,
`farm.debug.set(path, value)` and events (`__game.events.emit(...)`), and reach any day in level mode with
`__game.cycleAt(day, hour)` (`level.debug.freeRun`, §13.8). The machine renders WebGL in software: keep
harness runs short (`--size 960x600`, `settle` / `advance`, `__game` hooks) and prefer node tests for
logic. Write in chunks of ≤ 250 lines and commit after each working milestone.

### 14.1 `sim` — the farm model for the whole cycle, records, skills, saves (branch `phase3/sim`)
**Owns:** `src/sim.js`, `src/farm.js`, `src/farm-*.js` (incl. `farm-cycle.js`, `farm-plan.js`,
`farm-heat.js`, `farm-profiles-cycle.js`; new `farm-health.js`, `farm-harvest.js`, `farm-clean.js` …),
`src/records.js`, `src/records-*.js` (incl. `records-cycle.js`), `src/skills.js`, `src/skills-*.js`
(incl. `skills-cycle.js`, new `skills-rules-cycle.js`), `src/save.js`, `scripts/test-sim.mjs`,
`scripts/test-cycle.mjs`, `scripts/cycle-refs.mjs` (code only: the references and bands change with the
integrator). Pure logic: no three.js, no DOM (save.js touches `localStorage` only).
**Contract:** §6 (model), §7 (problems), §8 (record data), §9 (milestone rules, the level filter in code),
§11 (farm serialize / restore with `levelId`; the run store), §13.2 events it emits (`FARM_PROBLEM`,
`FARM_DEATH` causes, `FARM_DELIVERY` catch and feed type, `CATCH`, `LETTER`), §13.3 every action marked as
a farm action with its result shape (the bookings, `water.disinfect`, `clean.swab { spot }`), §13.5 the
state others read, §13.9.
**In code already (keep it passing):** the cycle climate in `sim.js`, `farm-heat.js`, `feedPerGainAt` in
`farm-flock.js`, `planOutcome`, the skills level filter, the stub's minimal state changes, the climate,
growth and plan checks of `test-cycle.mjs`.
**Builds:**
- `farm.enterLevel(def)`: the level's problems (pending) and weather events (`rh` / `rhDrop` as given),
  re-armed recurring problems, `stats.levelStart`, `env.setCycleClimate(true)` from Week 2,
  `env.setMaxDay(70)` in the clean-out; `farm.start(def)` for the plan level (empty clean house, no
  truck). Remove `cycleStub` when the model runs; keep `climateCare` exported (a no-op is fine) because
  `level.js` imports it until the run package merges.
- The model of §6.1–§6.10 from Week 2 (the brooding week Phase 2's), the curtain and floor in use,
  crowding, **heat through `farm-heat.heatState`** per cell and zone (with the litter term as `cellFeel`;
  `farm.comfort.eZ`, `pantShare`, heat deaths, `f_heat`), fans broken (`env.setFansBroken`), stages
  (`env.setFanStages`), `env.padWorking` from the pad problems, gas, SDS, legs, the bird-check readings,
  two silos with layers and the pan mix, the change shock, withdrawal and shrink, vaccination, Gumboro,
  coccidiosis and medication, dust (`farm-heat.dustIndex`) and breathing, catching, DOA, tickets, the
  harvest result, the clean-out grids, swabs at the fixed places and the whole-house lab result, rest and
  booking; `farm.problemZones()`, `forecast()` and `observe()` for the new problems and words.
- `env` (sim.js): `broodersUp`; `setFanStages`; a heat budget `env.heatBudget()` → `{ wallsCh, airCh,
  brooderCh, birdsCh, sunCh }` °C/h for the *heat loss* readout; saves of the new env fields (§11).
- Records (§8): rows to day 46 with the new fields, `timeline()` per level, `harvestPage()`,
  `cleanPage()`, `cycleSummary({ plan, levels })`, `compact(beforeDay)`; skills (§9): rules for every
  `MILESTONES_CYCLE` id, `evaluate()` over `ALL_MILESTONES` with the level filter (the `level1` cycle
  milestones only with `ctx.run` at the brooding week's level-end; `test-level.mjs` keeps passing).
- `save.js`: `createRunStore()` → `{ available, load(), save(run, blob), loadStart(id, day?), saveStart(id,
  day, run, blob), clearStarts(fromId), info(), migratePhase2() }` (quota: drop the oldest start, retry).
- `farm-profiles-cycle.js`: `applyCycleRound(farm, env, day, round, profile)` for rounds `am`, `pm`,
  `eve`, `night`, `noon` and the dated ones (`curtain`, `vaccine`, `change`, `brooders`, `heatwave`,
  `withdraw`, `catch`, `clean1..4`, `swabs`, `book`), the ideal (fans and pads by `cycle-refs idealFans` /
  `idealPad` at its stops, base controls only) and every profile of §6.14; `runCycle` returning the trace
  `checkCycle` reads (§6.14). The run package's goto(auto) and standard starts call `applyCycleRound` at
  the rounds your `cycleStops(fromDay, toDay)` export lists (you own that list; run reads it).
**Acceptance:** `node scripts/test-cycle.mjs` — the climate, growth and plan checks (now) and every
`CYCLE_TARGETS` profile through `checkCycle` (§6.14), determinism byte for byte, speed (§6.15), save sizes
(run blob ≤ 250 KB at day 41 of the ideal; a level start ≤ 250 KB; restore → serialize identical for each
level start), every farm action of §13.3 returns its result shape, rows hold null for every reading not
taken; the farm's own numbers at the `CLIMATE_REFS` hours inside the same bands (snaps); `node
scripts/test-sim.mjs` — Phase 2 unchanged; `grep -iE "correct|wrong|well done|good job|mistake|perfect|
excellent" src/records*.js src/skills*.js` finds no player-facing text. Record every tuning in §6.16.

### 14.2 `run` — the run, the levels, jobs, signs and the core UI (branch `phase3/run`)
**Owns:** `src/level.js`, `src/run.js`, `src/job-engine.js`, `src/content.js`, `src/content-jobs.js`,
`src/content-jobs-cycle.js`, `src/content-signs.js`, `src/content-signs-cycle.js`, `src/ui.js`,
`src/ui-title.js`, `src/ui-jobs.js`, `src/ui-hud.js`, `src/ui-result.js`, `src/ui-records.js`,
`src/ui-notebook.js`, `src/ui-skilltree.js`, `src/ui-format.js`, `src/ui-caption.js`, `src/ui-marker.js`,
`src/ui-help.js`, `src/ui-panels.js`, `src/ui-boards.js`, `src/ui-dom.js`, `src/ui-icons.js`, new
`src/ui-run.js`, `src/ui-summary.js`, `src/ui-letters.js`, `src/index.template.html`,
`scripts/test-jobs.mjs`, `scripts/test-level.mjs`, `scripts/test-run.mjs`, `scripts/p3-run-*.json`, and the
title-card clicks in `scripts/p2-*.json` (only those lines, if the title text changes). The sandbox files
`ui-tasks.js`, `ui-testtools.js`, `ui-controller.js` stay untouched.
**Contract:** §2 (run, chaining, starts incl. weeks 4–5's two), §3 (engine), §4 (job content), §5 (the
merge `boardsForDay(day)`, in code; `buildPlate` reads it), §8 (records UI), §9 (checkpoints with `level`
and `run: true`; skill tree), §10 (results, the previous-level replay with its carried-over lines), §11
(when to save, through the sim's run store), §13.6 keys, §13.9, §15 hooks. Calls `registerCyclePanels(api)`
(panels) with `api = { register, L, boards, plate, sourceLabel, openPanel }` once, after Phase 2's panels
(in code now). Routes `EV.BIRD_PICK` to `bird-check` from day 8 and calls the panel's `take(p)`. The
phone's bookings are `farm.act` calls (§13.3): show their `reason` as the plain fact.
**Builds:**
- `run.js`: `startRun({ seed, at })`, `next()`, `replay(id)`, `startLevel(id, { from: 'saved' | 'standard',
  seed })`, `state()`, the run card data, Phase 2 save migration; `level.js`: the current `level.def`,
  `start(def)` / `enter(def)` (keep the flock) / `resume(blob)` for every level, the end and pass rules of
  §10 per level, checkpoints of §9, `sampling` incl. 'bird', `debug.goto(day, hour, { auto })` across the
  cycle (sim's `cycleStops()` + `applyCycleRound`), `debug.freeRun` kept for tools, the catch-night clock;
  drop level.js's `climateCare` import at your merge (sim keeps it exported until then).
- `job-engine.js`: every §3.1 change (incl. `maxCells`, result matches, `each clean.swab` by `spot`, the
  state tests `heat-handled` / `pad-humid-ok`); Level 1 identical (`test-jobs.mjs` Phase 2 cases unchanged).
- Content: wire `JOBS_CYCLE` into the engine (one list `allJobs()`), the routine `days` / `area` of §3.3,
  `JOB_WHERE_CYCLE`; board merge and the ten new sign panels (run draws boards; scene paints them).
- UI: title card and run card (§1), HUD day labels, the job card headers, keys L / V / C / M with the
  float readings and the overlay legends, the records book (level week tabs, Plan, Harvest, Clean-out,
  letters: contract with its terms, the reply's term lines, vet, lab; phone: order feed by type, vet, book
  catch, book chicks; the Plan tab's *Open the planning sheet*), result screens per level (titles from
  `def.title`; *Replay <previous level>* with the carried-over lines, §10), the cycle summary, the skill tree with all eleven branches (`ALL_MILESTONES`, every
  branch's three unlocks; ask the integrator to set every `earnable` true at the merge), and the
  unlocks marked "run" in §9.1 (`planVsCycle`, `swabMap`, `comfortGraph`, `gasGraph`, `feedGraph`,
  `recordsTargets`, `weightGraph`; `comfortOverlay` / `moistureOverlay` keys and legends).
**Acceptance:** `node scripts/test-jobs.mjs` (Phase 2 cases; new: per-level windows and days, `onDays`,
action and stat anchors with negative `fromH`, `area` used / house and `tool`, `sectorsOf` house and
`match`, `has`, each new state test on the farm stub with fields set, problem jobs only of the current
level, the rest skip's `nextOpening`); `node scripts/test-run.mjs` (the chaining part skips while
`run.stub` or `farm.cycleStub`, so it runs at the integration, on the real sim; test it on your branch by
hand with the stub's state changes and `farm.debug.set`): the eight tests listed in the file — a scripted
plan passes with 3,611 a week and a 49-day plan at 0 % does not; goto(7, 21, auto) passes the brooding
week; *Continue* starts week 2 at day 8 06:00 with the same alive count and the start saved; goto(auto)
through every level passes, the cycle summary exists; a failed week 3 replays from day 15 06:00 with a
farm identical to the saved start; `poorVaccineCocci` fails week 3 and *Replay Week 2* (with "vaccine drunk
in N h on day 12") then passes it; weeks 4–5's two starts; a standard start of `weeks45` reaches day 22
06:00 in ≤ 6 s; level start blobs ≤ 250 KB and a Phase 2 save continues as a run;
`node scripts/test-level.mjs` (Phase 2 cases pass). Harness: `p3-run-title.json` (run card, *Start a new
flock* → planning day 07:00 at the gate; *Start at the brooding week* → prep day 07:00), `p3-run-chain.json`
(plan by synthetic actions → result → *Continue* → brooding week → `goto(7, 21, auto)` → result →
*Continue to Week 2* → day 8 06:00, jobs `w2-lights@8`, `r-minvent@8` open), `p3-run-replay.json` (fail week
2 by `level.debug.result(false)` → *Replay Week 2* → day 8 06:00), `p3-run-ui.json` (records tabs, letters,
skill tree, job card at 960 × 600 with no sideways scroll). Text checks as Phase 2 (`grep` of verdict
words in `src/ui*.js src/content*.js` finds nothing; `test-contracts.mjs` passes).

### 14.3 `panels` — every new equipment and inspection panel (branch `phase3/panels`)
**Owns:** `src/ui-climate.js`, `src/ui-water.js`, `src/ui-equipment.js`, `src/ui-inspect.js`,
`src/ui-cycle-panels.js`, new `src/ui-cycle-*.js` (e.g. `ui-cycle-plan.js`, `ui-cycle-birdcheck.js`,
`ui-cycle-fans.js`, `ui-cycle-harvest.js`, `ui-cycle-clean.js`, `ui-cycle-style.js` (its CSS, injected once
by `registerCyclePanels`), `ui-cycle-icons.js`), `scripts/p3-panels-*.json`.
**Contract:** `registerCyclePanels(api)` (§13.8, §13.9, in code: `api.register(id, build, { kind })`,
`api.L` = Phase 2's panel helpers: `act`, `uiAct`, `close`, `env`, `farm`, `records`, `skills`, `props`,
`flock`, `events`; `api.boards(id)` the merged board of the day, `api.plate(id, { open })` Phase 2's plate
builder reading the merged board, `api.sourceLabel(src)`, `api.openPanel(id)`); a built panel may define
`take(p)` (ui.js calls it after opening `bird-check` for an `EV.BIRD_PICK`); the actions of §13.3 marked
"panels" (incl. `water.disinfect` on the water supply's Clean-out tab, `dead.count { byLook }` from the bin
panel); the hand-offs of §13.7 that start in a panel; the unlocks marked "panels" in §9.1
(`skills.unlocked(key)`); plates from §5.3 with sources in small text (the pad plate's temperature +
humidity limit: 90 %; the fan panel shows house °C and RH side by side, nothing else to add up); clock
classes as Phase 2 (`sign` while a plate is unfolded, `panel` otherwise; machines that need farm time
fold their plate).
**Builds:** panels `plan-sheet` (his sums, his decisions, *Send the plan* until 16:00, *Take / Put back
the tape*; `planningCalc`: his sums live, for the plan level's replays and the next flock; `planCarry`:
starts from the last cycle; the reply's terms are the run's letter), `bird-check` (days ≥ 8: watch it
walk, feathers, feet, breathing, vent and droppings, crop, weigh; *Cull* / *Put back*; `droppingsGuide`,
`symptomCheck`, `birdTemp`, `sampleCard`), `curtain-winch`, `fan-panel` (six fan switches with lamps, pad
pump, air speed; `windChill`, `tunnelStages`, `fanChart`; `fans.read` after 2 s open), `pad-pump` (check,
flush, float valve), `gas-tank`, `loading-bay` (tickets), `wash-bay` (washer, sprayer, swab kit, the four
wash items), `dead-bin` (by look, unlock); additions to Phase 2 panels: controller (light presets and
`dimming`, `heatLoss` readout from `env.heatBudget()`, `minVentCalc`, `humidityChart`, *Brooders off and
up*), water supply (main valve, Vaccine and Medicine tabs, `waterTest`, disinfect the lines in clean-out),
silo (two gauges, slide valves, order type hint, `siloDays`), feeder box (*Take the feed away*, pan wash in
clean-out), husk heap (fork, scraper), weigh panel (`uniformityChart`).
**Acceptance:** harness steps with `expect` (each on the stubs, from `__game.cycleAt(day, hour)` or
`__game.startLevel({ seed: 1 })`, panels opened with `__game.ui.openPanel(id)` and real clicks):
`p3-panels-plan.json` (two `plan.measure` synthetic actions, then enter 6 / 6,000 / 67 / 4 / 2.8 and *Send
the plan* → `farm.plan.sums.salePerWeek` 3,610–3,612, `densityKgM2` 28.0, `farm.plan.outcome.pass`; the
plate shows "general practice" on every line), `p3-panels-week2.json`
(day 12: main valve off, mix with stabiliser, valve on → the bus saw `water.main`, `vaccine.mix`,
`water.main` and `farm.health.vaccine.state` 'drunk' 2 game hours later (the stub's state change);
curtain winch *Lift* → `env.broodCurtain === false`; a bird check → `sample.bird` with look gait,
feathers, feet), `p3-panels-heat.json` (day 31 14:00: six fans and the pad → `env.fansManual
=== 6 && env.padOn`; `fans.read` once after 2 s; the wind chill line absent, then present after
`__game.skills.award(...)` reaches Heat & Ventilation level 1), `p3-panels-harvest.json` (`cycleAt(42, 1)`,
the stub's catch from 02:00 → loading bay at 05:30: two tickets with net = gross − 12,000),
`p3-panels-clean.json` (wash bay: *Take the washer* → `props.carrying === 'washer'`; water supply
Clean-out tab: disinfect, flush four lines → `farm.clean.lines` all 1); shots at 960 × 600 of every new panel reviewed (no sideways scroll, plate
sources readable, no verdict colours). `grep` of verdict words in `src/ui*.js` finds nothing.

### 14.4 `scene` — 3D props, house, world, farmer and flock (branch `phase3/scene`)
**Owns:** `src/props.js`, `src/props-*.js`, `src/house.js`, `src/house-*.js`, `src/world.js`,
`src/world-*.js`, `src/player.js`, `src/player-*.js`, `src/flock.js`, `src/flock-*.js`,
`scripts/p3-scene-*.json`.
**Contract:** §12; the interactables and providers of §13.4 marked "scene" / "flock" with their
priorities; the quiet painting actions and the hand-offs of §13.7 (keep `startCarry` / `drop` the only way
to carry); reads the state of §13.5; listens to `EV.CATCH`, `EV.FARM_DELIVERY { kind: 'catch' | 'feed' }`,
`EV.FARM_DEATH` causes; `props.setOverlay(name, on)` for `floorTemp`, `moisture`, `lux`, `brooderZones`;
`flock.setOverlay('comfort', on)`; `level.sampling === 'bird'` for the `chick` provider.
**Builds:** §12 items 1–20.
**Builds (Phase 3 details):** the ten swab flags at `CLEAN.swabSpots` and the `swab` provider only
there (`clean.swab { x, z, spot }`); scraper / washer / sprayer strips of r 2.0 / 2.5 / 2.5; the catch from
`farm.harvest.sections` (the stub runs it now: `cycleAt(42, 1)` and play shows the crew); `EV.BIRD_PICK {
purpose: 'check' }` while `level.sampling === 'bird'`; the bin routed to panel `dead-bin` with
`deadByLook`; panting along the walls from `farm.comfort.eZ` / `pantShare` (strips with `NaN` hold no birds).
**Acceptance:** against the stubs, by setting farm fields (`farm.debug.set('clean.wetShare', …)`,
`farm.harvest.sections[i].state`, `farm.flock.lameOnFloor`, `env.setFansBroken([3])` …) and emitting events: `p3-scene-look.json`
shots reviewed — day 11 after the lift (spread over the house), day 21, day 31 15:00 with six fans (panting
along the walls), a lame bird, an SDS dead bird on its back, day 41 (white carpet), the catching night
(crew, two trucks, penned sections), the empty house with feathers, litter removed, the washed wet floor,
disinfected, the wash bay, overlays C and M with their legends; `p3-scene-events.json` with `expect`: tape
hooked at x −23.6 and read at x 23.6 → `plan.measure { axis: 'length' }` with m 48.0; `house.curtain` →
the mean x of the drawn birds > −4 within 60 s of play; fan 4 broken → its rotor still while the others
turn; three scraper passes along z −4, 0 and +4 → ≥ 540 cells scraped (`farm.litter` cover ≤ 5 %); E at
each of the ten flags with the swab kit → ten `clean.swab` with spots 0–9; a catch section set 'done'
→ no drawn birds left in its x range within 5 s; perf ≤ +1 ms per frame at 1,800 birds; ≤ 40 extra draw
calls and ≤ 60 k triangles in the house view; `renderer.info.programs.length` unchanged after a full prop
tour; the Phase 1 `tour` shots unchanged in the sandbox.

## 15. Test hooks and harness scenarios

`window.__game` (main.js, in code now): Phase 1 and Phase 2 hooks, plus
- `run` (the run object), `startRun({ seed, at })` (stub: starts the brooding week), `startLevel({ level,
  from, seed })` (no `level` = Phase 2's brooding week; a later level = standard start, stub: `freeRun`),
  `cycleAt(day, hour)` (= `level.debug.freeRun`: a level-mode farm at any age, no jobs, for the
  panels and scene packages until standard starts exist).
- `level.def`, `level.debug.goto(day, hour, { auto })` (run: across the cycle), `level.debug.result(pass)`,
  `level.debug.trigger(id)`, `farm.debug.trigger(id)`, `farm.debug.truth()`, **`farm.debug.set(path,
  value)`** (any farm field by a dotted path, e.g. `'clean.wetShare'`; tests and harness only);
  `ui.openPanel(id)`.
- `snapshot()` adds `levelId`, `maxDay`, `fansBroken`.
`scripts/p3-design-stubs.json` (integrator, runs on the stubs now): the hooks exist, `startLevel({ seed })`
is still the prep day, `startLevel({ level: 'weeks45' })` gives day 22 in level mode, `cycleAt(31, 15)`
draws the flock over the whole house, `ui.openPanel('fan-panel')` opens the placeholder with its plate.
Node: `npm test` = `test-contracts.mjs` + `test-sim.mjs` + `test-jobs.mjs` + `test-level.mjs` +
**`test-cycle.mjs`** (sim; the climate, growth and plan checks run now) + **`test-run.mjs`** (run). Steps
files per package: `p3-run-*.json`, `p3-panels-*.json`, `p3-scene-*.json` (§14). The design run of this
phase: `node scripts/shoot.mjs --scenario cold-hot --size 960x600` (no errors) and `npm test`.

## 16. Integration order

1. Merge `sim` (pure; `test-cycle.mjs` runs its profiles on main; `climateCare` still exported, so
   `level.js` builds). 2. `scene` and `panels` (either order; both read the farm). 3. `run` last (it drives
   the levels and starts; it drops the `climateCare` import; `test-run.mjs`'s chaining tests now run, on
   the real sim). After each merge: `npm run build`, `npm test`, `cold-hot`, `tour`, `phase1-jobs`,
   `p2-hooks`, `p2-level1.json`, and the merged packages' steps files. Then the integrator's runs with
   real input: **`scripts/p3-cycle.json`** — title → *Start a new flock* → the planning day by walking
   (gate sign, dip, guard hut, the tape at both end walls, the sheet, the reply, sign) → `goto(7, 21,
   auto)` → *Continue to Week 2* → **day 8 played by real input from 06:00 to the record, timed** → day 10
   lift the curtain by walking to the winch, day 12 vaccinate at the water supply → `goto(15, 6, auto)` →
   **day 16 by real input, timed** (the warm afternoon at the fan panel) → `goto(21, 21, auto)` → weeks
   4–5: **day 25 by real input, timed**, the day 27 fan found by walking past it, the heat wave with the
   fan panel → `goto(37, 6, auto)` → **day 37 by real input, timed** → `goto(41, 20, auto)` → the catching
   night watched, the tickets read → clean-out: **day 44 by real input, timed** (three washer passes) →
   `goto(67, 7, auto)` → the cycle summary (every level passed, ideal bands of §6.14). The budget: about
   3.5 real minutes for a flock day, 4.5 at most (§1); a day over it gets fewer `onDays` before release,
   recorded in ARCHITECTURE.md. **`scripts/p3-replay.json`** — fail week 3 with the poor vaccine and the
   coccidiosis left (real clicks at the water supply on day 12, no medicine on day 19) → the fail screen
   shows *Replay Week 2* with "vaccine drunk in … h on day 12" → replay week 2 with the vaccine done by the
   plate → week 3 passes. Then ARCHITECTURE.md ("Phase 3 — as integrated") and a play-through recording
   for the farmer.

## 17. Open questions for the farmer

1. **Guide tags (§5.1):** we put only the plan's topic for each week under that week's guide (e.g. "Light
   control against sudden death in week 2" — Week 2 guide; "Use the tunnel fans against heat stress" —
   Week 4 guide; "Cooling pads with the tunnel fans" — Week 4 guide) and every cause, rule and number under
   general practice. Which guide says each one, and may some of the general lines carry a guide name?
2. **Light from week 2:** how many hours of darkness do you give, from which day, and at how many lux?
   For catching, about 10 lux?
3. **Brooding curtain:** do you brood in half the house and release on about day 10? Do you warm the other
   half first?
4. **Vaccination:** your schedule (vaccines, days, water / spray / eye drop); do you thirst the birds, and
   for how long; do you use a milk powder stabiliser? Should a poor vaccination fail week 3 on its own
   (now it costs deaths and weight but passes unless another problem comes on top)?
5. **Feed program:** your days for starter, grower and finisher; crumble or pellets; one silo per feed?
   Who orders the feed? Is "less than one day's feed left at catching" your rule for the last order?
6. **Heat:** at what house temperature do you add tunnel fans, from which week, and do you run some
   tunnel fans at night for big birds? Our **temperature + humidity limit** is one number: the pads off
   when the house humidity goes over about 90 %. Do you use that, a sum of °C and humidity, or a chart?
7. **How hot is too hot:** in our model big birds (from day 35) pant above about 26 °C felt (after the wind
   chill) and start to die above about 30.5 °C felt; with all six fans and the pads a 33 °C afternoon keeps
   them comfortable and a 39 °C heat wave makes a few pant. Does that match your houses, and do you lose
   birds in a heat wave with the pads working?
8. **Weekly targets:** a week fails below 90 % of the target weight or above 1 % deaths a week (2 % for
   weeks 4–5, 1.5 % for the last week incl. dead on arrival); the harvest after 2 % shrink — your
   company's numbers? Our flock grows about 5 % over the target table with good care: is the target table
   (480 / 950 / 1,550 / 2,200 / 2,850 g) right for your breed?
9. **Harvest:** catching time, hours of feed withdrawal (we say the pans empty 8–12 hours before), crew
   size, how many days ahead you book; do you get weight tickets and the dead on arrival from the plant?
10. **Clean-out:** your steps and products; do you take swabs, and where (we use ten fixed places: lines,
    pans, pad, fans, corners, an inlet, the door); is 3 weeks of rest your rule?
11. **Planning:** does the planning sum match how your company plans (birds for sale per week, 32 kg/m²
    at catching, at least 4 % losses counted, 42 + 4 + 21 days, 6,000 chicks a house)?
12. **Diseases:** are Gumboro (week 3, after a poor vaccination) and coccidiosis (bloody droppings) the
    right examples for your area?
13. **Lame birds:** do you cull by a gait score, and on which round do you walk for them?
14. **Pace:** a whole cycle is about 3 hours. We kept weeks 4–5 as one level (as in the plan) with a
    second saved start at day 29 and Week 4 / Week 5 tabs in the records. Would you rather have two levels?
15. **Gas:** do you read a gauge on the LPG tank, and how much gas do 6,000 chicks use to day 21 in the cool
    season (we say about 200–300 kg)?
