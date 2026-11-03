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
`src/skills-cycle.js`, the stub modules) and the four work packages (§14). Each package section in
§14 stands alone.

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
  carry a guide name only if it is in PHASE2.md §6.1 or in the closed list of §5.1 below. Every figure
  that is not in those lists is "general".
- **Missing a level's key target fails the level and you replay that level** (§10). Skill points come
  from results of play (milestones, §9); each branch level unlocks a tool or view.
- Days pass in a few minutes of play with the *Next job* skip. Desktop browser, English, low-poly
  flat-shaded procedural art, one self-contained page (three 0.160.0 from jsDelivr), the publishing
  constraints of ARCHITECTURE.md.
- **Earlier phases keep working:** the Phase 1 sandbox (boot mode under automation, `tour`, `cold-hot`,
  `walk`, `p2-hooks`, `phase1-jobs.json`), the Phase 2 level (`__game.startLevel({ seed: 1 })` still
  starts the brooding week exactly as before; `npm test` and the Phase 2 steps files pass).

## 1. Player experience walkthrough

Real times at normal speed (clock speeds of PHASE2.md §2: walking 120×, a panel 30×, carrying 30×, a
sign 0×, fast 480×). A whole cycle is about **3 hours of play** in seven sittings; the farmer can stop
at any time (autosave, §11).

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
contract at the office desk ("3,600 birds for sale every week, about 2.8 kg live weight"), take the
tape measure from the office, measure house 1 inside (hook the tape at the west end wall, read it at
the east end wall: 48.0 m; south wall to north wall: 12.0 m), read the planning sign on the office
porch (the sums, a worked example), fill in the **planning sheet** (his own lines for chicks per week,
floor area and houses; then his decisions: houses, chicks per house, days per cycle, losses he plans
for) and *Send the plan* before 16:00. At 17:00 the company's reply lies on the desk: his plan run
through the sums — "6 houses × 6,000 chicks every 67 days: 3,761 chicks a week, 3,611 birds for sale
a week at 4 % losses, 28.0 kg/m² at catching, 21 rest days". Signing the plan page ends the level.
Key target: birds for sale per week ≥ the contract's and density ≤ the limit on the sign (§10).

### Level 2 — The brooding week (days −1 to 7) — about 40 minutes
Exactly PHASE2.md §1, with one difference at the end: the result screen's first button is *Continue to
Week 2* (the night of day 7 is skipped; the run saves the Week 2 start).

### Level 3 — Week 2 (days 8–14) — about 25 minutes
Each morning the farmer starts at the gate. The rounds are Phase 2's, the walks now cover whatever floor
the birds use. New this week:
- **Day 8: light against sudden death.** *Set the light program for the growing birds* (controller,
  Lights; the new light sign beside it: a dark period every night from week 2) and *Measure the light
  at bird level* (key **L**, three parts of the floor). From today the morning job *Step up the minimum
  ventilation for the birds' weight* comes every other day (the vent sign's table now runs to 3 kg).
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
  the birds up to drink; the record shows how long they took to drink it. A poor vaccination shows
  in week 3 (§6.7).
- **Day 13: sudden deaths.** A big bird is found dead on its back → *Big birds found dead on their
  backs* (points to the controller's light program and the light sign).
- **Day 14: weigh 50 birds from 5 parts of the house** (key target, §10), sign the record, result.

### Level 4 — Week 3 (days 15–21) — about 25 minutes
The season turns warmer ("normal": 24–33 °C). New this week:
- **Days 14–16: crumble to pellets.** On day 13 he orders grower pellets (office phone; the feed sign:
  starter crumble to day 14, grower pellets from day 15); they come to silo 2 on day 14 at 09:00.
  *Change the feed lines to grower pellets* (day 15 06:00 – day 16 18:00): the silo panel's two slide
  valves (half and half for a day, then silo 2 only), the feeder box runs the lines so the new feed
  reaches the pans. An abrupt change shows as undigested feed in the droppings for a day.
- **Days 16 and 19: droppings.** *Check the droppings on ten birds* (bird check, *Look at the vent and
  droppings*; Feed & Digestion level 1 adds the droppings guide beside the bird).
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
  phone the vet. With a good vaccination nothing happens: the farmer never sees this problem.
- **Day 21: weigh 50 birds** (key target), sign, result.

### Level 5 — Weeks 4 and 5 (days 22–35) — about 45 minutes
The heat level. Afternoons reach 33 °C outside and the birds weigh 1–2.2 kg: their own heat rises with
weight. The brooders go up (*Turn the brooders off and winch them up*, day 22). From day 22 the
afternoon round has *Check the fans and the house in the afternoon heat* (the **fan panel** at the east
end: six fan switches with their status lamps, pad pump, air speed; Heat & Ventilation level 1 adds the
wind chill readout) and the evening has *Set the ventilation for the night*. Day 23: *Measure the air
speed at bird height* (key **V**, the hand air meter). Problems, about one every other day:
- **Day 23: dusty air** — dry litter and low humidity; a listen stop hears snicking and a rattle →
  *Dusty air and birds breathing with a rattle*.
- **Day 24: check the cooling pad** (water on every section).
- **Day 25: the first hot afternoon** (+3 °C, sun on the roof) → *Birds panting in the afternoon heat*.
- **Day 27: fan 4 stops** (a broken belt): its lamp is on, the blade stands still, the fan end is hot →
  *Fan 4 is not turning* → E at the fan: fit a new belt.
- **Day 28: weigh 50 birds** (for the record; no target).
- **Day 29: a third of the pad runs dry** (clogged distribution pipe) → *Part of the cooling pad is dry*
  → flush the pipe at the pad pump. The radio forecasts a heat wave; finisher feed from today.
- **Days 30–32: heat wave** (up to 39 °C) → *A heat wave is coming: get the house ready* (fans, pad,
  water). Full tunnel and pads all afternoon; the feeders lifted in the hottest hours (feed sign).
- **Day 33: hot and humid** (33 °C, 85 % outside): the pads now add more damp than cool (pad plate:
  temperature + humidity limit) → *Hot and humid in the house*.
- **Day 35: weigh 50 birds** (key target), sign, result.

### Level 6 — Finishing and harvest (days 36–42) — about 25 minutes
All general practice. Full tunnel by day, minimum ventilation at night. Day 36: *Order the last feed for
the flock* (enough to the withdrawal: feed left at catching is waste). Days 37–39: *Book the catching
crew and the trucks* (office phone; the company's default is day 42, 02:00). Day 38: a hot afternoon.
Day 40: *Weigh sample birds before catching* (uniformity for the harvest page). Day 41, 8–12 h before
the catch: *Take the feed away before catching* (feeder box: lines stop, pans winched up once empty;
water stays on). The night of the catch: *Get the house ready for the catching crew* (dim the lights,
put up the catching panels), *Lift the drinker lines as the catching starts*. 02:00 the crew (four
workers) and the trucks arrive; they pen and catch the house section by section from the door end
(about 3 h); the farmer keeps the fans running for the birds still inside and *Reads the weight tickets
at the loading bay* (each truck: crates, birds, gross, tare, net kg). By 05:30 the house is empty: a
few feathers on the litter. Day 42: *Sign the harvest record*: birds sold, mean live weight, FCR,
deaths + culls + dead on arrival, uniformity, production efficiency (§8.3). Key target (§10).

### Level 7 — Clean-out and rest (days 43 to the next chicks) — about 15 minutes
All wash steps general. Day 43: *Winch all the lines and brooders up*, *Take the old litter out of the
house* (the scraper: walking the house paints husk back to concrete; the litter goes onto the trailer),
*Brush the dust off the lines, fans, pad, brooders and inlets*. Day 44: *Wash the house with the
pressure washer* (from the wash bay; walking the house paints the floor washed and wet), *Clean the
drinker lines with disinfectant*, *Wash the feeder pans*. Days 44–45: *Let the house dry with the fans*,
then *Disinfect the house* (the sprayer; on a wet floor the disinfectant is weak), *Wash and disinfect
the tools at the wash bay*, *Set rodent bait round the house*. Day 46: *Take swabs from the clean
house* (10 swabs, 5 parts), *Close the house for the rest*. Day 48: *Read the lab result* ("1 of 10
swabs grew bacteria"); more than 2 → *Swabs grew bacteria: wash and disinfect again* (a second pass and
new swabs). *Book the next chicks* (office phone, any day from 14 days after the house was closed); the
rest is skipped in one *Next job* jump. At 06:00 on the booked day the **cycle summary** opens.
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

| n | id | Title on the run card | Days (start → end) | Weather | Key target (§10) |
| --- | --- | --- | --- | --- | --- |
| 1 | `plan` | Plan the farm | −2 07:00 → plan page signed | cool | plan gives ≥ the contract's birds a week, density ≤ limit |
| 2 | `level1` | The brooding week | −1 07:00 → day 7 signed (PHASE2.md) | cool | day 7 ≥ 4.0 × chick weight, deaths + culls ≤ 2 % |
| 3 | `week2` | Week 2 | 8 06:00 → day 14 signed | cool, rainy spell days 9–10 | day 14 weighed mean ≥ 90 % of 480 g; level deaths + culls ≤ 1.0 % |
| 4 | `week3` | Week 3 | 15 06:00 → day 21 signed | normal | day 21 ≥ 90 % of 950 g; ≤ 1.0 % |
| 5 | `weeks45` | Weeks 4 and 5 | 22 06:00 → day 35 signed | normal + hot days, heat wave 30–32 | day 35 ≥ 90 % of 2,200 g; ≤ 2.0 % |
| 6 | `finish` | Finishing and harvest | 36 06:00 → day 42 harvest record signed | normal, hot day 38 | harvest live weight ≥ 90 % of `weightAt(age at catch)`; level deaths + culls + DOA ≤ 1.5 % |
| 7 | `cleanout` | Clean-out and rest | 43 06:00 → 06:00 on the booked chick day | normal | lab ≤ 2 positive swabs of 10 and ≥ 21 rest days |

Target weights are `weightAt(day)` (general, config). Level deaths are counted from the birds alive at
the level's start (`run.levelStart.alive`). Each level def carries `id, n, title, short, startDay,
startHour, endDay, weather, rounds, clock, problems, target, fail` (and `weighDays`, `anchors` where
they apply; the catch times are in `config.HARVEST`); `LEVEL1` keeps every Phase 2 field and gains `n: 2`,
`short`, `target`.

### 2.2 Chaining on one flock (package "run", `src/run.js` + `src/level.js`)
- **Start a new flock** → `run.startRun({ seed })`: a fresh run at Level 1 (`plan`). The plan level
  uses `farm.start(PLAN_LEVEL)` (an empty, clean house, no flock).
- **Start at the brooding week** → `run.startRun({ seed, at: 'level1' })`: no plan (`run.plan` null).
- Passing a level shows its result screen; *Continue to <next>* calls `run.next()`:
  - `plan` → `level1`: `level.start(LEVEL1)` exactly as Phase 2 (fresh farm, records, props, flock);
    `run.plan` (the sent plan and its sums) stays in the run, not in the farm.
  - every later step **keeps the farm, records, props and flock**: the clock skips to the next level's
    start (06:00 the next morning; the farm integrates the night with the farmer's settings), the farmer
    is placed at the gate, `farm.enterLevel(def)` installs that level's problems and weather, the job
    engine starts the level's days, and the run saves the **level start** (§11) before the first frame.
- A failed level shows *Replay <level>* (restores that level's start) and *Back to the title*.
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
  brooding cells while `env.broodCurtain`, every house cell after) and `tool: 'washer' | 'sprayer' |
  'scraper'` (only `EV.CELL` while `props.carrying` is that tool counts).
- `count` gains `sectorsOf: 'brood' | 'house' | 'used'` (`config.houseSector`, 8 sectors: four along the
  house, two across; 'used' = brood sectors while the curtain is down) and `match` on the payload (e.g.
  `{ look: 'droppings' }`).
- `each` gains `has: 'heightCm'`: only actions whose payload has that key count (a feeder height change,
  not a run / flood toggle).
- New state tests (`STATE_TEST_IDS`, defined in `content-jobs-cycle.js`, implemented in the engine):
  `house-ready` (litter cover ≥ 95 % of all 576 cells), `rh-under` (house RH ≤ 75 % for 60 min),
  `lame-cleared` (`farm.flock.lameOnFloor === 0`), `vaccine-drunk` (`farm.health.vaccine.state ===
  'drunk'`), `pans-grower` / `pans-finisher` (`farm.feed.panType[type] ≥ 0.9`), `caked-cleared` (caked
  share of the used floor ≤ 2 %), `air-clear` (`farm.air.dustIndex ≤ 1` and NH3 ≤ 15 ppm for 2 h),
  `panting-low` (`farm.comfort.pantShare ≤ 0.1` for 30 min), `heat-index-ok` (house °C + RH % ≤ 110 for
  30 min), `house-empty` (`farm.flock.alive === 0` after the catch began), `litter-removed` (cover ≤
  5 % of all cells), `house-washed` / `house-disinfected` (`farm.clean.washShare` / `sprayShare` ≥
  0.95), `house-dry` (`farm.clean.wetShare` ≤ 0.1), `lines-disinfected` (every drinker line
  `farm.clean.lines[i] ≥ 1`), `rest-done` (`env.day ≥ farm.clean.bookedDay` + 06:00).
- Problem jobs as Phase 2: opened only by `EV.FARM_PROBLEM { id, phase: 'symptom' }` of a problem of the
  current level; one instance per problem and level; missed at the level end.
- `nextOpening()` across the level's days; the rest period: from the closing of the house to the booked
  day, the only openings are the lab result (day 48) and `rest-done`.

### 3.2 The job card
As PHASE2.md §3.5. Header "Day 25 · Afternoon round 13:00–18:00"; on the planning day "Planning day ·
no birds yet"; clean-out "Clean-out day 2"; resting "Rest day 9 · chicks booked for day 67". The
**weekly weigh-in** and the catch jobs are pinned while open.

### 3.3 Daily routine by age (PHASE2.md §4.3 table, every day)
| Round | Days 0–7 (Phase 2) | Days 8–21 | Days 22–41 |
| --- | --- | --- | --- |
| Morning | dips · controller · meter · walk (brood floor 50 % + listen) · drinkers (flow test 4 lines) · feeders (meter + silo) · dead birds | same; the walk covers 50 % of the **used** floor; *Step up the minimum ventilation* on days 8, 10 … 20 | same |
| Afternoon | house dip · walk 35 % · controller · litter (3 squeezes) · dead birds | same (walk on the used floor); *Raise the lines* on days 8, 10 … 34 | house dip · walk 35 % · **fans** instead of the controller (fan panel read + 30 % of the house) · litter · dead birds; *Raise the lines* to day 34 |
| Evening | record | record | **night ventilation** (18–22: fan panel or controller read) · record |
Day 42 has only the catch and harvest jobs; the routine ends with day 41. The clean-out days have
their own jobs and a record each day 43–46.

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
| `pl-sheet` *Work out the plan on the planning sheet* | 07:00–22:00 | officeDesk | `plan.send` | `farm.plan` = his decisions and the sums (§6.11); reply letter 1 h later | sign-plan, plan-sheet | planning |
| `pl-reply` *Read the company's reply* | rel `sent` +1 … +12 h | officeDesk | ui `plan.reply` | checkpoint `plan` | sign-plan | planning |
| `pl-record` *Sign the plan page* | eve | officeDesk | `RECORD_CLOSED { signed }` same day | ends the level | — | — |

### 4.2 Level 2 — The brooding week (days −1 to 7)
PHASE2.md §4, unchanged. The routine defs keep their ids; their `days` now run to day 41 (§3.3), the two
walks carry `area: 'used'` (identical in week 1), `r-controller-pm` ends on day 21 (`r-fans-pm` takes
over) and `r-record` runs to day 46 (in `content-jobs.js` now; Level 1's engine only makes days −1..7).

### 4.3 Level 3 — Week 2 (days 8–14)
| Job | When | Where | Done when | Sim | Facts | Branch |
| --- | --- | --- | --- | --- | --- | --- |
| `w2-lights` *Set the light program for the growing birds* | d8 am | controller | `light.program` | dark hours, lux → SDS, legs (§6.5) | controller-lights, sign-light | lighting |
| `w2-lux` *Measure the light at bird level* | d8 am | signLight | `count light.lux` n 3, 3 sectors (L key) | reading | sign-light | lighting |
| `r-minvent` *Step up the minimum ventilation for the birds' weight* | days 8, 10 … 20 am | controller | `vent.timer` | air, humidity (§6.4) | sign-vent | moisture |
| `w2-ready` *Get the rest of the house ready for the birds* | d9 13:00–18:00 | litterHeap | state `house-ready` | litter cover | sign-curtain, sign-litter | brooding |
| `w2-curtain` *Lift the brooding curtain and let the birds spread* (pin) | d9 13:00 → d11 18:00 | curtainWinch | `house.curtain { open: true }` | floor in use → house (§6.2) | sign-curtain | brooding |
| `w2-spread` *Walk the whole house and look at the spread* | rel `curtain` +0.5 … +6 h | curtainWinch | `coverage` area house 40 % + listen | look notes | sign-curtain, sign-health | brooding |
| `w2-check` *Check ten birds in the hand: walk, feathers, feet* | d10, d13 08–18 | birdScale | `count sample.bird { look: 'gait' }` n 10, 3 sectors (used floor) | gait, feathering, footpad readings | sign-legs, bird-check | biosecurity |
| `w2-vaccine` *Vaccinate the flock in the drinking water* (pin) | d12 06–16 | waterSupply | state `vaccine-drunk` | coverage (§6.7) | vaccine, water-supply | biosecurity |
| `w2-order` *Order grower pellets for the feed change* | d13 06–16 | officeDesk | `feed.order { type: 'grower' }` | silo 2 filled d14 09:00 | sign-feed, silo | feed |
| `r-raise` *Raise the drinker and feeder lines for the birds' size* | days 8, 10 … 34 pm | drinkers.0 | all: `each water.height` lines 0–3, `each feed.line` (has `heightCm`) lines 0–2 | access (§6.4–6.6) | drinker, feeder-box | water |
| `w2-weigh` *Weigh sample birds* (pin) | d14 08–18 | birdScale | `count sample.weigh` n 50, 5 house sectors | weighed mean (key target) | bird-scale | growth |
| `p-damp` *The air in the house feels damp* | problem `rainy-spell` | controller | all: any `vent.timer` / `vent.fans`, state `rh-under` | humidity, litter | sign-vent, sign-air | moisture |
| `p-lame` *Birds that cannot walk well* | problem `lame-birds` | lame (nearest lame bird) | state `lame-cleared` | culls | sign-legs | biosecurity |
| `p-sds` *Big birds found dead on their backs* | problem `sudden-deaths` | controller | `controller.read` | — | sign-light, controller-lights | lighting |

### 4.4 Level 4 — Week 3 (days 15–21)
| Job | When | Where | Done when | Sim | Facts | Branch |
| --- | --- | --- | --- | --- | --- | --- |
| `w3-change` *Change the feed lines to grower pellets* (pin) | d15 06:00 → d16 18:00 | silo | state `pans-grower` | feed form, digestion (§6.6) | sign-feed, silo, feeder-box | feed |
| `w3-droppings` *Check the droppings on ten birds* | d16, d19 08–18 | birdScale | `count sample.bird { look: 'droppings' }` n 10, 3 house sectors | droppings readings | sign-droppings, bird-check | feed |
| `w3-topup` *Fork over caked litter and top it up under the drinker lines* | d18 08–18 | litterHeap | `count litter.patch` n 4, 4 within 1 m of a drinker line | moisture, caking | sign-litter, sign-droppings | moisture |
| `w3-weigh` *Weigh sample birds* (pin) | d21 08–18 | birdScale | 50 birds, 5 house sectors | key target | bird-scale | growth |
| `p-pad-wet` *Wet litter at the pad end: find what wets it* | problem `pad-overflow` | padPump | `pad.fixFloat` → `{ fixed: true }` | wet strip stops growing | pad-pump, sign-litter | moisture |
| `p-pad-patch` *Put fresh litter on the wet strip* | after `p-pad-wet` | litterHeap | `litter.patch` → `{ onPad: true }` | strip to 15 % | sign-litter | moisture |
| `p-blood` *Blood in the droppings* | problem `coccidiosis` | officeDesk | all: ui `phone.vet`, `water.medicate { on: true }` | outbreak fades (§6.7) | sign-droppings, medicator | biosecurity |
| `p-hunched` *Birds sitting hunched with white watery droppings* | problem `gumboro` (only with a poor vaccination) | officeDesk | ui `phone.vet` | — (no treatment; the deaths are the record) | sign-droppings, sign-health | biosecurity |

### 4.5 Level 5 — Weeks 4 and 5 (days 22–35)
| Job | When | Where | Done when | Sim | Facts | Branch |
| --- | --- | --- | --- | --- | --- | --- |
| `w45-brooders` *Turn the brooders off and winch them up* | d22 06–18 | heater | `heat.brooders { up: true }` | no brooder heat after (§6.3) | sign-brooder, sign-heat | heating |
| `r-fans-pm` *Check the fans and the house in the afternoon heat* | days 22–41 pm | fanPanel | all: ui `fans.read`, coverage house 30 % | — | sign-heat, fan-panel | ventilation |
| `r-vent-night` *Set the ventilation for the night* | days 22–41 18–22 | fanPanel | any: ui `fans.read`, ui `controller.read` | — | sign-vent, sign-air | moisture |
| `w45-air` *Measure the air speed at bird height* | d23 08–18 | fanPanel | `count air.probe` n 3, 3 house sectors (V key) | reading | sign-heat | ventilation |
| `w45-pad` *Check the cooling pad: water on every section* | d24 08–18 | padPump | `pad.check` | — | pad-pump | ventilation |
| `w45-order` *Order finisher pellets* | d27 06–16 | officeDesk | `feed.order { type: 'finisher' }` | silo 1 filled d28 09:00 | sign-feed | feed |
| `w45-weigh28` *Weigh sample birds* (pin) | d28 08–18 | birdScale | 50 birds | record only | bird-scale | growth |
| `w45-change` *Change the feed lines to finisher pellets* | d29 06:00 → d30 18:00 | silo | state `pans-finisher` | feed form | sign-feed, silo | feed |
| `w45-weigh35` *Weigh sample birds* (pin) | d35 08–18 | birdScale | 50 birds | key target | bird-scale | growth |
| `p-dust` *Dusty air and birds breathing with a rattle* | problem `dusty-air` | fanPanel | all: any `vent.timer` / `vent.fans`, state `air-clear` | dust, NH3 (§6.7) | sign-air | moisture |
| `p-panting` *Birds panting in the afternoon heat* | problem `hot-afternoon` | fanPanel | all: any `vent.fans` / `vent.pad` / `vent.stages`, state `panting-low` | heat (§6.3) | sign-heat, fan-panel | ventilation |
| `p-fan` *Fan 4 is not turning* | problem `fan-belt` | fan-broken | `fan.fix` → `{ fixed: true }` | air speed back | fan-panel | ventilation |
| `p-pad-dry` *Part of the cooling pad is dry* | problem `pad-clog` | padPump | `pad.flush` → `{ fixed: true }` | pad cooling back | pad-pump | ventilation |
| `p-heatwave` *A heat wave is coming: get the house ready* | problem `heat-wave` | fanPanel | all: ui `fans.read`, `pad.check`, `water.flowtest` | — | sign-heat, pad-pump, sign-feed | ventilation |
| `p-humid` *Hot and humid in the house* | problem `humid-heat` | padPump | all: any `vent.pad` / `vent.fans`, state `heat-index-ok` | pad and humidity (§6.3) | pad-pump | ventilation |

### 4.6 Level 6 — Finishing and harvest (days 36–42; general practice)
| Job | When | Where | Done when | Sim | Facts | Branch |
| --- | --- | --- | --- | --- | --- | --- |
| `f-order` *Order the last feed for the flock* | d36 06–16 | officeDesk | `feed.order` | feed left at catching | sign-feed, silo | planning |
| `f-book` *Book the catching crew and the trucks* | d37 06:00 → d39 18:00 | officeDesk | ui `phone.bookCatch { day, hour }` | `farm.harvest.catchAt` (default d42 02:00) | sign-catch | planning |
| `f-weigh` *Weigh sample birds before catching* (pin) | d40 08–18 | birdScale | 50 birds, 5 house sectors | uniformity for the harvest | bird-scale | growth |
| `f-withdraw` *Take the feed away before catching* | rel `catch` −14 … −6 h | feederBox | `feed.withdraw { on: true }` | withdrawal hours (§6.9) | sign-feed, sign-catch | feed |
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
| `c-lines` *Clean the drinker lines with disinfectant* | d44 06–20 | waterSupply | state `lines-disinfected` | lines | sign-clean, water-supply | water |
| `c-pans` *Wash the feeder pans* | d44 06–20 | feederBox | `each feed.wash` line 0–2 | — | sign-clean | feed |
| `c-dry` *Let the house dry with the fans* | d44 13:00 → d45 18:00 | fanPanel | state `house-dry` | wet grid dries (§6.10) | sign-clean | moisture |
| `c-spray` *Disinfect the house* | d45 06–20 | washBay | state `house-disinfected` | spray grid × dryness | sign-clean, wash-bay | biosecurity |
| `c-washbay` *Wash and disinfect the tools at the wash bay* | d45 06–20 | washBay | `each clean.washbay` item boots, buckets, barrow, washer | — | sign-clean, wash-bay | biosecurity |
| `c-bait` *Set rodent bait round the house* | d45 06–20 | baitStation | `count clean.bait` n 4 | — | sign-clean | biosecurity |
| `c-swabs` *Take swabs from the clean house* | d46 06–18 | washBay | `count clean.swab` n 10, 5 house sectors | lab result d48 (§6.10) | sign-clean | biosecurity |
| `c-close` *Close the house for the rest* | d46 06–24 | houseDoor | `house.close` | rest starts | sign-clean | biosecurity |
| `c-lab` *Read the lab result* | d48 06–24 | officeDesk | ui `swab.read` | checkpoint `swabs` | sign-clean | biosecurity |
| `c-book` *Book the next chicks* | d48 06:00 → d66 24:00 | officeDesk | ui `phone.bookChicks { day }` | `farm.clean.bookedDay` (≥ close + 14) | sign-clean, sign-plan | planning |
| `c-rest` *Rest the house* | after `c-book` | houseDoor | state `rest-done` | the skip; checkpoint `rest` | sign-clean | — |
| `p-rewash` *Swabs grew bacteria: wash and disinfect again* | problem `swab-positive` | washBay | all: state `house-washed`, state `house-disinfected` (the farm clears both shares when it opens) | — | sign-clean | biosecurity |
| `p-reswab` *Take new swabs* | after `p-rewash` | washBay | `count clean.swab` n 10, 5 house sectors | lab result 2 days later | sign-clean | biosecurity |
The routine `r-record` runs on days 43–46; nothing else of §3.3 runs without birds.

## 5. Signs and equipment plates

All texts and sources are data in **`src/content-signs-cycle.js`** (contract data, package "run" owns
it): `BOARDS_CYCLE` (new 3D boards and plates, same shape as PHASE2.md §5 `BOARDS`) and
`BOARD_EXTRA_ITEMS` (lines added to Phase 2 boards and plates, each with `fromDay`: shown from that
calendar day on, so the brooding week looks exactly as before). `content-signs.js` keeps Phase 2's
`BOARDS`; the run package merges both for the ui (`allBoards(day)`), props paints new boards from
`BOARDS_CYCLE`. `scripts/test-contracts.mjs` checks every item's source key and that no text has a page
reference or a verdict word.

### 5.1 Guide facts Phase 3 may cite (closed list)
The plan doc puts these topics in the level of that week; the topic sentence carries the week's guide.
**Every figure (hours, lux, m/s, °C, days, kg, %) is general.** Weeks 4–5 use the Week 4 guide (there is
no Week 5 guide). Open question 1 asks the farmer to confirm each line against his guides.

| Statement (topic only) | Source | Boards |
| --- | --- | --- |
| A dark period every night from week 2: light control lowers sudden deaths | Week 2 guide | sign-light, controller-lights (extra) |
| Watch the feathering and the legs in week 2 | Week 2 guide | sign-legs |
| Ventilate for moisture: step the minimum ventilation up as the birds grow | Week 2 guide | sign-air, sign-vent (extra) |
| Vaccinate the flock in week 2 (the schedule is general) | Week 2 guide | vaccine |
| The brooding curtain lifts about day 10 | Week 2 guide | sign-curtain |
| Read the droppings at the bird check | Week 3 guide | sign-droppings |
| Keep the litter dry | Week 3 guide | sign-droppings, sign-litter (extra) |
| Change the feed from crumble to pellets as the birds grow | Week 3 guide | sign-feed |
| Watch the breathing and the dust | Week 4 guide | sign-air |
| Use the tunnel fans against heat stress | Week 4 guide | sign-heat |
| Cooling pads with the fans, inside the temperature + humidity limit | Week 4 guide | pad-pump |
Phase 2's list (PHASE2.md §6.1) still holds: Broiler Ventilation for minimum ventilation, ≤ 30 % litter
moisture and "5 % humidity ≈ 1 °C of pad cooling"; Week 1–4 guides for what huddling, panting, droppings
and breathing sounds tell you; Broiler Management 101 for the gate dip and reporting abnormal deaths.
Wind chill by age stays general (ARCHITECTURE.md). Plan the farm, finishing, harvest and clean-out are
general practice throughout (the plan says so).

### 5.2 New boards (3D, `SPOTS3`; the clock stands still while one is read)
Each line: text — source. `g` = general.
- **sign-plan** *Production planning* (office porch, beside the desk): chicks to place per week = birds
  for sale per week ÷ (1 − losses) — g · plan for about 4 % losses from chick to catching — g · birds
  per m² at catching = kg of live bird allowed per m² ÷ sale weight — g · allow about 32 kg of live bird
  per m² at catching in a tunnel (EVAP) house — g · floor for one week's chicks = chicks per week ÷
  birds per m² — g · days a house is used per flock = 42 growing days + about 4 clean-out days + the rest
  days — g · rest the clean, empty house at least 3 weeks before the next chicks — g · houses needed =
  floor for one week's chicks × weeks a house is used per flock ÷ floor of one house — g · example:
  1,000 birds for sale a week at 4 % losses = about 1,042 chicks a week — g · house 1 has drinkers and
  feeders for 6,000 birds — g.
- **sign-light** *Light program for growing birds* (north wall, x −4): from the second week give the
  birds a dark period every night: rest in the dark lowers sudden deaths and leg problems — Week 2 guide
  · about 4–6 hours of darkness in one block from day 7–8, kept until the last days before catching — g
  · light at bird level about 20 lux from week 2 (30–40 lux in week 1) — g · measure the light at bird
  height (L) under the lamps and between them — g · sudden death: big, well-grown birds found dead on
  their backs, legs up, often near the feeders — g · dim the lights for catching: birds stay calm in low
  light — g.
- **sign-curtain** *Opening up the house* (north wall, x 4, beside the winch at the curtain): the brooding
  curtain lifts about day 10: then the birds spread over the whole house — Week 2 guide · the day before,
  spread litter over the rest of the floor so it is dry and warm when the birds come — g · lift it in the
  morning when the house is warm and walk through the birds so they spread out — g · the lines feed the
  whole house: check flow and height at the far end too — g · before the lift the birds have half the
  floor: the litter there gets wetter and the birds more crowded every day — g.
- **sign-legs** *Legs and feathers* (north wall, x 8): watch the feathering and the legs in week 2 — Week 2
  guide · gait score 0 walks well, 1–2 small faults, 3 walks with difficulty, 4–5 can hardly walk or not
  at all — g · cull birds that cannot reach feed and water (gait 4–5) the day you find them — g · back and
  wings feathered by about day 21; slow or patchy feathering points to a house too hot or too cold,
  crowding or a feed problem — g · dark spots and sores on the footpads come from wet litter — g · a dark
  period every night and dry litter give stronger legs — g.
- **sign-air** *Air quality* (north wall, x 12): in weeks 4–5 watch the breathing and the dust — Week 4
  guide · what the breathing sounds tell you: snicking or a rattle means too much ammonia or dust in the
  air — Week 1–4 guides · ammonia: if your eyes sting at bird height it is above about 20 ppm — g · dust
  rises with dry litter, low humidity and busy birds; more minimum ventilation carries it out — g ·
  minimum ventilation brings fresh air in, moisture and ammonia out — Broiler Ventilation · ventilate for
  moisture: step the minimum ventilation up as the birds grow — Week 2 guide.
- **sign-droppings** *Droppings* (north wall, x 16; pictogram `droppings`): read the droppings at the bird
  check — Week 3 guide · normal: firm, brown with a white cap; about one in ten is a soft, frothy,
  mustard-brown caecal dropping, also normal — g · watery: heat or too much water; undigested feed: a
  feed change or a gut upset — g · blood or orange-red: call the vet; white and watery with hunched,
  sleepy birds: call the vet — g · keep the litter dry: wet, caked litter spreads gut disease and burns
  the feet — Week 3 guide.
- **sign-heat** *Heat and tunnel fans* (north wall, x 20, by the fan panel): from week 4 use the tunnel
  fans against heat stress: moving air cools big birds — Week 4 guide · wind chill: moving air feels
  cooler to the birds; young birds feel it far more than big birds — g · all six fans give about 2.5 m/s
  at bird height, each fan about 0.4 m/s — g · at 2.5 m/s birds of 5 weeks feel about 3–4 °C cooler,
  birds of 2 weeks 6–7 °C — g · big birds make more heat: each week the same afternoon needs more air — g
  · heat stress: panting, wings out, lying along the walls; deaths start in the hottest hours — g ·
  switch fans on as the house warms through the day; at night go back to minimum ventilation — g.
- **sign-feed** *Feed program* (outside, beside the silo gauge): change the feed from crumble to pellets
  as the birds grow — Week 3 guide · starter crumble days 0–14, grower pellets days 15–28, finisher
  pellets from day 29 — g · change over a day: half from each silo for 24 hours, then the new feed only
  — g · feed per bird per day: about 75 g on day 14, 120 g on day 21, 155 g on day 28, 185 g on day 35,
  200 g by day 42 — g (`feedStdGAt`) · feed ordered before 16:00 comes the next morning at 09:00; each
  silo holds 6 tonnes — g · in a heat wave lift the feeders in the hottest hours (about 11:00–16:00):
  digesting feed makes heat — g · before catching take the feed away 8–12 hours before; keep the water
  on until catching starts — g.
- **sign-catch** *Catching and loading* (outside the south wall, x −7): all g — book the catching crew and
  the trucks a few days ahead · feed off 8–12 h before catching, water on until the catch starts · dim
  the lights, catch in the cool of the night · keep the fans running for the birds still inside and the
  crates on the trucks · lift the drinker and feeder lines just before the crew starts · pen small groups
  with catching panels: fewer birds pile up · about 10 birds of 2.8 kg to a crate, fewer in hot weather ·
  read each truck's weight ticket: crates, birds, gross, empty and net weight.
- **sign-clean** *Clean-out* (at the wash bay): all g — 1 lift all lines and brooders, take out all the
  old litter · 2 brush the dust off lines, fans, pad, brooders and inlets · 3 wash everything with
  detergent and the pressure washer, from the far end to the door · 4 let the house dry: disinfectant on
  a wet floor is too weak · 5 disinfect every surface · 6 clean the drinker lines with disinfectant and
  wash the feeder pans · 7 wash and disinfect boots, buckets, the barrow and the washer at the wash bay ·
  8 set rodent bait, close the house · 9 take swabs from the clean house: the lab shows what still grows
  · rest the clean house at least 3 weeks before the next chicks.

### 5.3 New plates (fact columns inside a panel)
- **guard-hut**: change into farm clothes and boots before you go near the houses — g · wash your hands;
  visitors sign the visitor book — g.
- **plan-sheet**: plan for about 4 % losses — g · at most about 32 kg of live bird per m² at catching — g
  · a house is used 42 growing + about 4 clean-out + the rest days (at least 21) per flock — g.
- **vaccine** (water supply, Vaccine tab): vaccinate the flock in week 2 by the vet's schedule — Week 2
  guide · here: day 12, Gumboro vaccine in the drinking water — g · stop chlorine and medicine in the
  water 2 days before — g · turn the water off 1–2 hours before so the birds are thirsty — g · mix the
  vaccine with skim milk powder in the header tank, enough for the birds to drink in about 2 hours — g ·
  walk slowly through the house while they drink so every bird gets up — g.
- **medicator** (water supply, Medicine tab): medicine in the drinking water at the vet's dose for the
  full course; mix fresh each day — g · bloody or orange droppings with hunched birds: call the vet the
  same day — g.
- **pad-pump** (outside, west end): cooling pads work with the fans; keep inside the temperature +
  humidity limit — Week 4 guide · each 5 % of humidity the air can still take up gives about 1 °C of pad
  cooling — Broiler Ventilation · add the house °C and humidity %: above about 105 big birds struggle to
  lose heat — g · with the house humidity above about 80 % the pads add more damp than cool: pump off,
  keep the air moving — g · water should run down every part of the pad; a dry stripe lets hot air in —
  g · run the pump only while the tunnel fans run — g.
- **fan-panel**: lamp on and the blade still: the motor runs but the belt is broken or slipping — g · all
  six fans give about 2.5 m/s at bird height — g · big birds in the heat: all fans and the pads; young
  birds: as few tunnel fans as the heat allows — g.
- **gas-tank**: read the gas gauge every morning while the brooders run — g · brooders burn most on cold
  nights and with too much minimum ventilation — g.
- **bird-check** (bird in the hand from day 8): look at how it walks, the feathers, the feet, the
  breathing, the vent and droppings, the crop — g · what huddling, panting, droppings and breathing
  sounds tell you — Week 1–4 guides.
- **loading-bay**: net weight = gross − empty truck; mean live weight = net ÷ birds loaded — g · dead on
  arrival is counted at the plant and comes back on the ticket — g.
- **wash-bay**: washer first with detergent, rinse, then the sprayer with disinfectant once dry — g · mix
  the disinfectant as its label says — g.

### 5.4 Lines added to Phase 2 boards (`BOARD_EXTRA_ITEMS`, shown from `fromDay`)
sign-vent (8): fresh air per 1,000 birds as they grow: 950 m³/h at 500 g, 1,600 at 1 kg, 2,150 at 1.5 kg,
2,700 at 2 kg, 3,650 at 3 kg — g (`MIN_VENT_PER_1000`) · ventilate for moisture: step the timer up every
day or two as the birds gain weight — Week 2 guide. · controller-lights (8): from week 2 a dark period
every night (light program sign) — Week 2 guide. · sign-litter (15): keep the litter dry — Week 3 guide ·
fork over caked patches and top up with fresh husk, most of all under the drinker lines — g. ·
feeder-box (8): raise the pans every few days to the birds' backs — g; (36): before catching stop the
lines and winch the pans up once they are empty — g. · silo (13): silo 1 starter crumble, later
finisher pellets; silo 2 grower pellets; each holds 6 tonnes — g. · bird-scale (8): weigh 50 birds from
5 places every week: days 14, 21, 28, 35 and before catching — g · target weights 480 g on day 14, 950 g
on day 21, 1,550 g on day 28, 2,200 g on day 35, 2,850 g on day 42 — g (`weightAt`). · water-supply (12):
vaccine and medicine go in through the header tank (Vaccine and Medicine tabs) — g. · sign-health (8):
abnormal after week 1: more than about 0.15 % of the flock dying in one day (9 birds of 6,000) — g.

## 6. Flock simulation for the whole cycle (package "sim")

Everything runs in `farm.step` (≤ 60 game s, skips included) and `sim.js`, **in level mode only**; the
sandbox climate is Phase 1's. **At flock ages below 7.0 every Phase 2 number stays as it is** (all of
`scripts/test-sim.mjs PROFILE_TARGETS` must keep passing): the Phase 3 terms below start at age 7.0 (or
at the event that starts them). Constants marked *model* are tuning values, never on a sign; the sim
package may tune them to pass §6.14 and records every change in a new §6.16 at integration, as Phase 2
did in its §6.11. Figures marked *general* are on signs (§5).

### 6.1 Growth and feed to day 42
- `feedStdGAt(a)` (config, general): `12 + 4a` for a ≤ 7 (Phase 2), then the table `FEED_STD_TABLE`
  [7 40] [14 75] [21 118] [28 156] [35 184] [42 200] g/bird/day (straight lines, flat after 42).
- Feed per gain `FPG(a) = 0.97 + 0.03a` (Phase 2, model) for every age.
- Intake `FI = FI_std · f_T · f_L · f_F · f_W · f_air` (Phase 2) `· f_space · f_form · f_heat · f_health`
  (new, all 1 below age 7 or before their event). Gain = FI ÷ FPG (Phase 2: no cap).
- Reference, all factors 1 (computed): 208 / 517 / 965 / 1,526 / 2,147 / 2,780 g at days 7 / 14 / 21 /
  28 / 35 / 42, feed ÷ gain 0.87 / 1.12 / 1.30 / 1.45 / 1.58 / 1.71. With factors 0.97: 203 / 503 / 937 /
  1,481 / 2,084 / 2,698 g. Targets (`weightAt`, general): 190 / 480 / 950 / 1,550 / 2,200 / 2,850 g.

### 6.2 The whole house: the curtain and the floor in use
- `house.curtain { open }` sets `farm.house.curtainOpen` and `env.setBroodCurtain(!open)`. In level mode
  the curtain stays down until the farmer lifts it (Phase 1's "gone at day 10" rule is the sandbox's:
  `env.setBroodCurtain(null)`). The flock keeps west of x 2 while it is down (Phase 1 behaviour).
- **Floor in use** U = the 300 brooding cells while the curtain is down, all 576 cells after. Litter
  water, comfort, observe, `coverage area 'used'` and the litter mean all run over U.
- **Crowding** (model, from age 8): allowed birds per m² `A(a) = max(11, 30 − 1.5a)`, density `D = alive
  ÷ |U|`; `f_space = max(0.7, 1 − 0.08 · max(0, D/A − 1))`; within-cohort CV + `0.01 · max(0, D/A − 1)`
  per day. In the brooding half the droppings fall on 300 cells instead of 576.
- Reference: lift on day 10 → f_space ≥ 0.98 all the time; no lift to day 15 (`lateLift`) → D/A ≈ 1.8 on
  day 14, f_space ≈ 0.93, day 14 weight ≥ 3 % and uniformity ≥ 3 points under the ideal, brooding-half
  litter ≥ 32 % on day 14.
- `w2-ready`: cells east of the curtain without litter read as bare concrete (Phase 2 rules: 60 % on a
  squeeze, wet chill) once the birds walk there.

### 6.3 Climate and heat for big birds
- **Brooders**: Phase 2 thermostat. `heat.brooders { up: true }` turns them off for good (`env.broodersUp`:
  output 0, the house look winches them up 0.62 m). **Gas**: `farm.stats.gasKg += heaterLevel · lit
  brooders · 0.15 kg/h` (model); the gas tank gauge (`gas.meter`) reads kg left of 1,000 kg and kg used.
- **Tunnel fans**: `env.setFans(n)` runs fans 1..n (Phase 2). `env.setFansBroken([i])` (the fan-belt
  problem): a broken fan inside the first n turns no air (its lamp is on, the blade stands still).
  Effective fans for air, heat and wind chill = n − broken among them. Optional **stage table**
  (`vent.stages { stages: [{ overC, fans }], padOverC }`, unlock *tunnel stages*): each climate step the
  farm sets the fans from the house temperature over the target (`env.setFanStages(table | null)`).
- **Air speed** (Phase 2): 0.42 m/s per effective tunnel fan at bird height (+ 0.1 × that for timer fans);
  `air.probe` reads ± 15 % along the house (faster near the fans).
- **Wind chill** (general, unchanged): `airSpeed · (3.0 − 1.6 · clamp((day − 7)/28))` °C.
- **What the birds feel** from age 8, per zone (8 zones of 6 m along the house; before the lift Phase 2's
  eight brooder groups): `felt = house air + tunnel gradient (Phase 1 term) − wind chill + brooder radiant
  (if burning) − wall term + h(RH)`, `h = 0.1 · max(0, RH − 60) + 0.25 · max(0, RH − 85)` while the house
  is over 25 °C (model). `e = felt − targetTempAt(N)`.
- **Bands by age** (model): cold below −1.5 (Phase 2); comfortable up to `hotFrom(a) = 1.5 + 3.5 ·
  clamp((a − 7)/28)` (5.0 °C from day 35); `pantShare` = birds in zones with e > hotFrom; heat deaths from
  `deathFrom(a, w) = 4 + 6 · clamp((a − 7)/28) − 3 · w/2850` (day 35 at 2.2 kg: 7.7; day 42 at 2.8 kg:
  7.0) at `0.05 %/h · (e − deathFrom)²` per zone, weighted by its birds (replaces Phase 2's heat rate from
  age 8). Intake `f_heat = max(0.5, 1 − 0.04 · max(0, e − hotFrom))` (replaces Phase 2's hot side of f_T
  from age 8). Cold deaths: Phase 2 per group/zone, from age 14 only below e < −4.
- **Heat load**: `env.flockHeatPerH` (Phase 2 formula, it rises with weight) × 0.85 while the feeders are
  lifted in the heat (from 1 h after; model).
- **Pad** (Phase 2, Broiler Ventilation fact): drop `min(9, (100 − RH_out)/5) · 0.85 · tunnel share ·
  padWorking` (padWorking 0.67 while a third of the pad is dry); the pad adds 0.49 g/m³ per °C of cooling.
  The controller and fan panel show house °C and RH side by side (sign rule: their sum above about 105).
- **Weather events** gain `rh` (outside RH during the event, same 2 h ramps) for the rainy spell and the
  humid day.
- Reference (ideal, seed 1): day 25 15:00 (outside ≈ 36 °C): fans + pad → house 28–31 °C, pantShare
  0.1–0.4, heat deaths that day ≤ 0.05 %. Day 31 15:00 (heat wave, outside ≈ 39 °C, RH 55 %): six fans
  and the pad → house 30–33 °C, felt 27–30 °C, pantShare 0.4–0.9, heat deaths days 30–32 ≤ 0.3 %. Day 33
  15:00 (33 °C, 85 %): pads off → house RH 85–92 %; pads on → RH ≥ 94 % and felt ≥ 0.5 °C higher.

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
- **Dust** (model): `Dx = 2 · (age/35) · (1 − RH/100) · activity / (1 + airflow/20,000)`; ≤ 1 clear. The
  dusty spell (day 23 08:00 → 24 18:00) takes 25 points off the outside RH.

### 6.5 Light, sudden death, legs, feathering
- Light program and lux as Phase 2 (`luxAtBirds = 60 · dimmer`). Presets (config `LIGHT_PRESETS`,
  general): brooding 23 h, dimmer 0.6 (36 lux) · growing dark 22:00–04:00, 0.35 (21 lux) · finishing
  dark 00:00–04:00, 0.35 · catching dimmer 0.1 (6 lux).
- From age 8 `f_L = 1 − 0.01 · max(0, dark − 4) − 0.03 · max(0, dark − 8)`, × 0.95 below 10 lux (model;
  Phase 2's dark-hour cut stays for ages < 8).
- **Sudden death** (cause `sds`, ages 8–42, model): per bird per hour `4.5e-6 · (1 + max(0, 4 − dark)) ·
  g`, `g = clamp(gain today ÷ the target curve's gain, 0.5, 1.5)`. Reference: ideal (6 h dark) week 2
  0.04–0.1 %; `noDark` (23 h light) ≥ 3 × the ideal over days 8–35.
- **Lame birds** (ages 10–42, model): new per bird per hour `3e-6 · (1 + 0.5 · max(0, 4 − dark)) · (1 +
  0.1 · max(0, litter mean − 30)) · g`; `farm.flock.lameOnFloor` (drawn 1:1 up to 24) eat at half rate
  and die after 72 h (cause `legs`) unless culled (`chicks.cull { reason: 'lame' }`). Ideal week 2: 4–10.
- Bird check readings (model): gait 4–5 for a lame bird, else 0–2 (more 1–2 with g > 1.1); feathers good
  / patchy (7-day mean e outside −1.5..hotFrom) / poor (also crowded); feet 0 / 1 / 2 by the 7-day litter
  moisture of its zone (≤ 30 / 30–38 / > 38 %).

### 6.6 Feed: two silos, feed types, the change, withdrawal
- `farm.feed.silos = [{ type: 'starter', kg: 1,100 }, { type: 'grower', kg: 0 }]` (6,000 kg each);
  `feed.siloKg` stays their sum (Phase 2 readers). `feed.valve { silo, open: 0 | 0.5 | 1 }`: the augers
  draw in proportion. `feed.order { kg, type }` (default type: today's phase) → silo 1 for starter and
  finisher, silo 2 for grower; arrives the next day 09:00 if ordered before 16:00 (Phase 2).
- The pans hold a mix `farm.feed.panType = { starter, grower, finisher }` (well mixed, model).
- Feed form `f_form` (model): starter crumble 1.0 to age 16, then −1 % a day (≥ 0.9); grower pellets 1.0
  from age 12 (0.97 younger); finisher 1.0 from age 26 (0.97 younger); FPG × 0.98 on pellets.
- **Change shock** (model): the pan mix moving more than 60 points in 12 h → intake × 0.97 and droppings
  'undigested' for 24 h; a blend (between 20 and 80 % new for ≥ 24 h) gives none.
- **Withdrawal** `feed.withdraw { on }`: lines stop; pans winch up once empty (≤ 5 %). W = catch time −
  pans empty. Shrink `1 − 0.0025 · clamp(W − 2, 0, 10) − 0.003 · max(0, W − 12)`; `harvest.gutFull` if W <
  6 h (the plant's note); DOA + 0.05 % per hour over 12 h (model).
- Heat-wave feeders up 11:00–16:00 (lines stopped, pans up): intake that day −3 %, heat × 0.85 (model).
- Feed left at catching = silos + pans (record).

### 6.7 Health: vaccination, Gumboro, coccidiosis, breathing
- **Vaccination** (day 12, `farm.health.vaccine = { state, thirstFrom, mixedAt, startAt, drunkAt,
  hours, stabiliser, coverage }`): `water.main { open: false }` (lines dry: thirst counts; water access
  0) → `vaccine.mix { stabiliser }` (header tank: 2 h of today's water) → `water.main { open: true }`
  (state 'drinking'; the birds drink the tank at their rate × thirst boost `1 + 0.25 · min(thirst h,
  2)` × access) → tank empty: state 'drunk'. Coverage (model) `= clamp(0.98 − 0.12 · max(0, T − 2) − 0.15 ·
  [thirst < 0.75 h] − 0.25 · [no stabiliser] − 0.3 · (1 − mean access while drinking) − 0.1 · [walked
  < 30 % of the house while they drank], 0.3, 0.99)`. Reference: ideal (1.5 h thirst, stabiliser, walk)
  T 1.5–2.2 h, coverage 0.92–0.98; `poorVaccine` (no thirst, no stabiliser) T 3.5–5 h, 0.35–0.7.
- **Gumboro** (problem `gumboro`, day 20 06:00, starts only if coverage < 0.85): 5 days of deaths (cause
  `disease`) at `0.04 %/h · (0.85 − coverage)/0.45 · hump(t)`, intake × (1 − 0.2 · severity), droppings
  'white'. Reference: coverage 0.5 → week 3 deaths + culls 1.0–3.0 % (fails week 3), day 21 weight 5–12 %
  under the ideal.
- **Coccidiosis** (problem `coccidiosis`, day 19 05:00, every run): severity × (1 + (litter mean − 28)/10)
  × (1 + 0.05 per biosecurity lapse); deaths `disease` from 0.002 %/h rising 50 % a day until treated,
  intake × 0.92, droppings 'bloody' in the wettest zone. `phone.vet` gives the advice ("medicine in the
  water for 3 days", `EV.LETTER { kind: 'vet' }`); `water.medicate { on: true }` takes the severity to 0
  over 48 h; the course is 3 days (`farm.health.medication`). Reference: treated the same day → ≤ 0.1 %;
  untreated → 0.4–1.5 % by day 21.
- **Breathing**: hours with NH3 > 25 ppm or Dx > 1.5 raise a respiratory risk; while it lasts deaths
  `respiratory` 0.002 %/h, intake × 0.97, the breathing look 'rattle' on that share of birds.
- Biosecurity lapses: Phase 2's 'other' factor, and from week 2 each lapse adds 5 % to the coccidiosis
  severity.

### 6.8 Deaths by cause and the abnormal-deaths report
Causes (`EV.FARM_DEATH`): Phase 2's (cold, heat, dehydration, weak, starveout, other, box) plus `sds`
(on its back), `legs` (thin, beside the lines), `disease` (hunched, by the walls), `respiratory`, and
`doa` (counted at the plant, never on the floor). Reference ideal deaths + culls by level: brooding 0.5–0.9
% (Phase 2), week 2 0.15–0.5 %, week 3 0.15–0.5 %, weeks 4–5 0.3–0.9 %, finishing 0.15–0.5 % + DOA
0.1–0.25 %; the cycle 1.6–3.5 %. `abnormal-deaths` (Phase 2 problem, `p-report`): more than 0.3 % of
the placed chicks counted at the bin in one day on days 0–7, more than 0.15 % from day 8.

### 6.9 Finishing, catching, harvest (general practice)
- **Catch time** `farm.harvest.catchAt`: `phone.bookCatch { day, hour }` (day 41 18:00 … day 42 06:00;
  booked at `stats.catchBookedAt`) or the company's default day 42 02:00.
- **The catch**: at catchAt the crew (4) and two trucks come (`EV.FARM_DELIVERY { kind: 'catch', phase:
  'arrive' }`). Eight sections of 6 m (x −24 → +24) are caught from the door end: order 1, 0, 2, 3, 4, 5,
  6, 7; each takes 22 game min (model) → about 3 h. `farm.harvest.sections[i] = { x0, x1, state:
  'waiting' | 'penned' | 'catching' | 'done', birds }`, `EV.CATCH { phase: 'start' | 'section' | 'end', i,
  birds }`. Truck 0 then truck 1 fill (300 crates × 10 birds each); `EV.FARM_DELIVERY { kind: 'catch',
  phase: 'leave', truck }`. Without `catch.panels` each section takes 5 min longer and DOA rises.
- **DOA** (model) = birds · (0.0010 + 0.0004 · max(0, e_catch − hotFrom) + 0.0008 · [dimmer > 0.3] + 0.001
  · [no panels] + 0.0005 · max(0, W − 12)); e_catch = mean e of the birds still in the house.
- **Weight tickets** `load.ticket { truck }` → `{ crates, birds, grossKg, tareKg: 12000, netKg, doa }`
  (net = the birds' live weight after shrink ± 0.2 %).
- **Harvest result** `farm.harvest.result`: birds sold (loaded − DOA), mean live weight (net ÷ loaded),
  FCR (all feed delivered and at the start − feed left, ÷ net kg), mortality (deaths + culls + DOA ÷
  placed), uniformity (the last hand weighing of ≥ 10 birds, ± 10 %), EPEF = livability % × mean live kg ÷
  (age days × FCR) × 100 (general formula), feed left kg, withdrawal hours, gut-full note.
- Reference ideal (seed 1): catch d42 02:00, W 9–11 h, DOA 0.1–0.25 %, live 2,600–2,780 g, FCR 1.66–1.80,
  mortality 1.6–3.5 %, uniformity 62–80 %, EPEF 330–400, feed left ≤ one day of feed.
- After the catch `farm.flock.alive = 0`, `present = false`; the litter keeps its state.

### 6.10 Clean-out and rest (wash steps general)
- `farm.clean` (576 cells): `wash`, `spray`, `wet` grids (0..1), `brushed { lines, fans, pad, brooders,
  inlets }`, `lines[4]` (0..1 disinfected), `pans[3]`, `washbay { boots, buckets, barrow, washer }`,
  `baits[4]`, `closedDay`, `swabs [{ x, z, cell, positive }]`, `labDay`, `lab { positive, of }`, `pass`,
  `bookedDay`. Shares `washShare`, `sprayShare`, `wetShare` over all cells.
- `clean.scrape { x, z, r: 1.2 }` (quiet, while carrying the scraper): cover → 0 there.
- `clean.wash { x, z, r: 1.5 }` (quiet, washer): wash → 1 on bare cells, 0.3 where litter is left; wet → 1.
- Drying (model): wet −= `(0.04 + 0.03 · running fans) · (1 − RH_out/150)` per hour (≈ 25 h with no fans,
  ≈ 6 h with six).
- `clean.spray { x, z, r: 1.5 }` (quiet, sprayer): spray = max(spray, wash · (1 − 0.7 · wet)).
- `clean.swab { x, z }` ×10; the lab letter 2 days later (`EV.LETTER { kind: 'lab' }`): swab positive with
  p = 0.02 + 0.9 · (1 − spray) + 0.1 · (parts not brushed ÷ 5) + 0.15 · litter cover there (model, seeded).
  More than 2 positive starts `swab-positive`: wash and spray are cleared (a second pass, `pass` + 1).
- `house.close` sets `closedDay`; `phone.bookChicks { day }` (day ≥ closedDay + 14, ≤ 69) sets `bookedDay`;
  rest days = bookedDay − closedDay. The empty, closed house steps cheaply (no flock).
- Reference: ideal 0–1 positive, rest 21; `wetDisinfect` 3–7 positive; `litterLeft` (25 % cover) ≥ 3.

### 6.11 Plan sums (`src/farm-plan.js`, pure, **in code now**)
`planSums({ houses, birdsPerHouse, cycleDays, lossesPct, saleKg, houseM2 })` → `{ chicksPerWeek =
houses · birdsPerHouse · 7 / cycleDays, salePerWeek = chicksPerWeek · (1 − losses), densityKgM2 =
birdsPerHouse · (1 − losses) · saleKg / houseM2, birdsPerM2, restDays = cycleDays − 42 − 4 }`.
`PLAN_CONTRACT` (config, general): 3,600 birds for sale a week at 2.8 kg, at most 32 kg/m² at catching,
about 4 % losses, 42 growing and about 4 clean-out days, houses 1–12, chicks per house 1,000–9,000, cycle
49–100 days. houseM2 = his measured floor (48.0 × 12.0 = 576), or 576 "from the company's drawings" if he
did not measure. Reference: 6 × 6,000 × 67 d at 4 % → 3,761 chicks, 3,611 for sale, 28.0 kg/m², 21 rest
days (passes) · 5 houses → 3,009 (not passed) · 6 × 7,000 → 32.7 kg/m² (not passed) · 6 × 6,000 × 63 d →
3,840 for sale, 17 rest days (passes, no plan-rest point).

### 6.12 Readings and samples (new instruments)
`light.lux { x, z }` → `{ lux }` ± 2 (key L) · `air.probe { x, z }` → `{ speedMs ± 0.1, tempC ± 0.2, rh ± 2 }`
(key V) · `sample.bird { x, z, index, look }` → `{ look, value }`: gait 0–5, feathers good | patchy | poor,
feet 0 | 1 | 2, breathing quiet | snick | rattle, droppings normal | caecal | watery | undigested | bloody |
white, crop full | half | empty, weight (the hand scale, g) · `gas.meter` → `{ kgLeft, kgUsed }` ·
`pad.check` → `{ dry: [6 sections], flowing }` · `fan.fix { index }` → `{ fixed }` · `pad.flush` / `pad.fixFloat`
→ `{ fixed }` · `load.ticket` (§6.9) · `plan.measure { axis, m }` → `{ m }` (48.0 / 12.0 ± 0.05 when hooked
and read at the end walls) · `clean.swab` → `{ n }` (results only on the lab letter).

### 6.13 What the farmer sees and hears (`farm.observe`, look notes; neutral words)
From day 8, added to Phase 2's words: spread 'spread over the whole house' · 'crowded in the brooding
half' (curtain down, D/A > 1.2) · 'panting along the walls, wings out' (e > hotFrom) · 'sitting hunched,
feathers fluffed' (disease); droppings 'some frothy caecal droppings' (normal, 1 in 10) · 'undigested
feed in the droppings' · 'blood in some droppings' · 'white, watery droppings'; sounds 'a rattle in the
breathing' · 'gasping' (e > deathFrom); air 'damp air, wet patches by the walls' (RH > 85) · 'dusty air'
(Dx > 1) · 'the ammonia stings your eyes' (NH3 > 20).

### 6.14 Acceptance (sim) — `node scripts/test-cycle.mjs` (`CYCLE_TARGETS` in that file, in code now)
`src/farm-profiles-cycle.js`: `applyCycleRound(farm, env, day, round, profile)` (the ideal and the named
mistakes for days 8–69, through `farm.act` and the env setters, as `applyRound` does for week 1) and
`runCycle(name, { seed, from, to })` (from a standard start of level `from` through level `to`, playing
the level's part: records signed at 20:00, dead birds counted, checkpoints). Seed 1.

| Profile | Management (differs from the ideal in …) | Expect |
| --- | --- | --- |
| `ideal` | timer by the table every other morning; growing light preset from day 8; curtain day 10 08:00; vaccine with 1.5 h thirst, stabiliser and a walk; grower ordered d13, blended d14 15:00 → d15 15:00; finisher d29; every problem fixed on the first round after its symptom; brooders up d22; fan stages + pads from 11:00 on hot days, pads off while house °C + RH > 110; feeders up 11–16 in the heat wave; last feed order to one day left; catch booked d38 for d42 02:00; withdrawal from d41 16:00; lights 0.1 and panels at 01:30; clean-out in order with the house ≥ 95 % dry before spraying; closed d46; chicks booked d67 | week2: day 14 470–540 g, deaths + culls 0.15–0.5 %, pass · week3: day 21 900–1,000 g, pass · weeks45: day 35 2,000–2,200 g, deaths + culls 0.3–0.9 %, pass · finish: §6.9 bands, pass · cleanout: 0–1 positive, rest 21, pass · every branch reaches level 2 by the cycle end (§9) |
| `noDark` | 23 h light all cycle | SDS deaths days 8–35 ≥ 3 × ideal; lame birds ≥ 2 × ideal |
| `lateLift` | curtain on day 15 | §6.2 reference |
| `noStep` | timer left at the day 8 setting days 8–21 | RH ≥ 85 % on ≥ 3 nights of week 2; litter mean ≥ 33 % on day 14; NH3 ≥ 25 ppm by the night of day 14; day 21 ≥ 4 % under ideal |
| `poorVaccine` | no thirst, no stabiliser | coverage 0.35–0.7; Gumboro from day 20; week 3 deaths + culls 1.0–3.0 %, fails week 3 |
| `cocciUntreated` | vet called, no medicine | week 3 disease deaths 0.4–1.5 %; day 21 ≥ 2 % under ideal |
| `crumbleOn` | starter only to day 28 | day 28 weight 3–8 % under ideal |
| `abruptChange` | grower 0 → 100 % at d15 06:00 | undigested droppings 12–30 h; intake that day 2–4 % under ideal |
| `noTunnel` | minimum ventilation only, weeks 4–5 | house ≥ 36 °C at 15:00 day 31; heat deaths days 30–32 ≥ 3 %; fails weeks45 |
| `fansNoPad` | fans, never the pad | house 35–40 °C at 15:00 day 31; heat-wave heat deaths 0.4–3 % |
| `padInHumid` | pads on all day 33 | felt at 15:00 day 33 ≥ 0.5 °C over the ideal; heat deaths day 33 ≥ 1.5 × ideal |
| `fanUnfixed` | fan 4 never fixed | air speed with 6 fans 2.0–2.2 m/s; heat-wave heat deaths ≥ 1.5 × ideal |
| `noWithdrawal` | feed on until the catch | gut-full note; live weight ≥ ideal + 1 % |
| `longWithdrawal` | feed off 24 h before | live weight 3.5–6 % under ideal; DOA ≥ 2 × ideal |
| `brightCatch` | lights 1.0 during the catch | DOA ≥ 1.4 × ideal |
| `wetDisinfect` | sprayed right after washing | 3–7 positive; cleanout not passed without the re-wash |
| `litterLeft` | 25 % of the litter left in | ≥ 3 positive |
| `shortRest` | chicks booked 14 days after closing | rest 14; cleanout not passed |
| `determinism` | ideal twice, seed 7 | identical records, byte for byte |
Phase 2's `PROFILE_TARGETS` all pass unchanged (`node scripts/test-sim.mjs`).

### 6.15 Speed and save size
`farm.step` ≤ 0.5 ms in node with the whole house in use; a 24 h skip ≤ 200 ms; the whole cycle (−1 → 67)
≤ 15 s in node. Run save ≤ 250 KB at any time, each level start ≤ 250 KB, everything ≤ 2 MB (§11).

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
| `gumboro` | d20 06:00, only if vaccine coverage < 0.85 | §6.7 | a listen ('sitting hunched'); droppings look 'white'; the abnormal-deaths count | `phone.vet` | p-hunched |
| `dusty-air` | d23 08:00 → d24 18:00 | outside RH −25 points | a listen with Dx > 1 or the rattle; `sample.bird { look: 'breathing' }` → rattle | a vent change and `air-clear` for 2 h ('air'); else 'weather' | p-dust |
| `hot-afternoon` | d25 11:00 → 17:00 | outside +3 °C, sun 1.5 °C/h | `fans.read` / `controller.read` with house ≥ target + 6 °C; a listen with pantShare > 0.2 | a fan / pad / stage change and `panting-low` 30 min ('air'); else 'weather' | p-panting |
| `fan-belt` | d27 09:00 | fan 4 (index 3) belt broken: `env.setFansBroken([3])` | `fans.read` (fan 4: lamp on, no air); zone at fan 4 inside r 2, dwell 2 s; `air.probe` east of x 12 under 85 % of the fans' speed | `fan.fix { index: 3 }` | p-fan |
| `pad-clog` | d29 10:00 | a third of the pad dry (padWorking 0.67) | `pad.check` (dry sections); zone at the dry section inside the west wall r 2, dwell 2 s | `pad.flush` | p-pad-dry |
| `heat-wave` | d30 10:00 → d32 19:00 | outside +6 °C (≈ 39 °C), sun 2 °C/h | `radio.listen` on day 29 ("Heat wave: up to 39 °C for three days"); `fans.read` days 30–32 with house ≥ target + 8 °C | `fans.read`, `pad.check` and a `water.flowtest` after it was found | p-heatwave |
| `humid-heat` | d33 10:00 → 18:00 | outside RH 85 % | `fans.read` / `controller.read` with house °C + RH ≥ 115; a listen ('gasping') | a pad / fan change and `heat-index-ok` 30 min ('air'); else 'weather' | p-humid |
| `hot-finish` | d38 11:00 → 17:00 | outside +4 °C, sun 1.5 °C/h | as hot-afternoon | as hot-afternoon | p-panting-fin |
| `swab-positive` | at the lab letter, only with > 2 positive | wash and spray cleared | `swab.read` | the second lab letter ≤ 2 positive | p-rewash → p-reswab |
`farm.forecast(day)` (radio) knows the rainy spell (day 8: "Rain for two days from tomorrow"), the hot
afternoons ("Tomorrow afternoon hot, up to 36 °C") and the heat wave (day 29). The ideal profile finds and
fixes each one on the first round after its symptom (§6.14).

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
While `run.plan` exists: the contract, his sums and decisions as he wrote them, the company's reply (the
sums). With Farm Planning level 2 (*plan against the flock*): beside them the running cycle's numbers
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

### 8.5 Cycle summary (`records.cycleSummary(run)` in `records-cycle.js`)
`{ placed, sold, liveKg, meanLiveG, fcr, epef, mortalityPct, deathsByLevel[], weights: [{ day, weighedG,
targetG }], feedKg, waterL, gasKg, restDays, swabsPositive, plan: { lossesPct, saleKg, salePerWeek,
cycleDays } | null, actual: { lossesPct, saleKg, cycleDays }, points: { branch: n } }`; the run package
draws it.

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
both as `ALL_MILESTONES`. Until the packages merge, `evaluate()` and the current skill tree keep using
Phase 2's `MILESTONES` and `SKILL_BRANCHES[i].earnable` keeps Phase 2's meaning, so the brooding week
and its screens are unchanged; sim switches `evaluate()` to `ALL_MILESTONES`, run's skill tree shows all
eleven branches from it, and at the run merge the integrator sets `earnable` true for every branch. A
milestone is a result of play, kept per profile, only ever raised (PHASE2.md §9); its detail line is the
measured value in plain words. **Checkpoints** (`EV.LEVEL { phase: 'checkpoint', name, level, day? }`,
emitted by the level): `plan` (reply read), `placed`, `vent`, `crop`, `weighin` (each weigh day),
`curtain`, `vaccine`, `heatwave` (day 32 19:00), `catch` (house empty), `harvest` (day 42 record),
`clean` (house disinfected), `swabs` (lab read), `rest` (rest end), `level-end` (each level, with its
id); plus `problem` (found / fixed) and `day` (each record close) from the bus. `evaluate()` takes only
the milestones of the checkpoint's level (or with no level).

| Branch (max points) | Milestones: id (level) points |
| --- | --- |
| Farm Planning (17) | plan-measured (plan) 1 · plan-meets (plan) 2 / 3 · plan-density (plan) 2 · plan-rest (plan) 1 · catch-booked (finish) 1 · last-order (finish) 2 · sold-as-planned (finish) 2 / 3 · losses-as-planned (finish) 2 · cycle-as-planned (cleanout) 2 |
| Biosecurity & Health (20) | gate-route (plan) 1 · dips-l1 / dips-w2 / dips-w3 / dips-w45 / dips-fin 1 each · dead-w2 / dead-w3 / dead-w45 1 each · vaccine-drunk (week2) 2 / 3 · lame-culled (week2) 1 · cocci-treated (week3) 2 · swabs-clean (cleanout) 2 / 3 · rest-3w (cleanout) 2 |
| Chick Arrival & Brooding (16) | Phase 2's 14 · curtain-ready (week2) 1 · curtain-day (week2) 1 |
| Body Temperature & Comfort (16) | vent-band (level1) 1 · comfort-w2 2 · no-chill-w2 1 · comfort-w3 2 · panting-short (weeks45) 2 / 3 · heatwave-safe (weeks45) 1 / 3 · comfort-fin 2 · catch-cool (finish) 2 |
| Heat & Ventilation (15) | warm-timer (level1) 1 · fans-afternoon 2 · pads-limit 2 · fan-fixed 1 · pad-flushed 1 · heatwave-ready 2 · heat-deaths-w45 2 / 3 (all weeks45) · full-tunnel (finish) 2 · catch-air (finish) 1 |
| Moisture & Minimum Ventilation (16) | minvent-l1 (level1) 2 · litter-l1 (level1) 1 · damp-cleared (week2) 2 · minvent-w2 2 · minvent-w3 2 · litter-w3 2 / 3 · pad-overflow (week3) 1 · dust-cleared (weeks45) 2 · ammonia-w45 1 |
| Heating (15) | preheat-day (level1) 2 · cold-night (level1) 2 · thermostat-off (level1) 1 · setpoint-w2 2 · nights-w2 2 · no-overheat-w2 2 · gas-w13 (week3) 2 / 3 · brooders-up (weeks45) 1 |
| Water (20) | Phase 2's 11 · flow-w2 / flow-w3 / flow-w45 / flow-fin 1 each · raised-w2 / raised-w3 1 each · medicine-course (week3) 1 · lines-cleaned (cleanout) 2 |
| Feed & Digestion (16) | pans-flooded (level1) 1 · never-out-l1 / -w2 / -w3 / -w45 / -fin 1 each · pellet-change (week3) 2 / 3 · droppings-read (week3) 1 · rim-w2 / rim-w3 1 each · finisher-change (weeks45) 1 · heat-feeders (weeks45) 1 · withdrawal (finish) 2 |
| Lighting (15) | light-23h (level1) 2 · lux-l1 (level1) 1 · dark-w2 2 · lux-measured (week2) 1 · sds-w2 2 / 3 · lame-w3 2 · dark-w45 2 · catch-light (finish) 2 |
| Growth & Performance (19) | w14-weight 1 / 3 (≥ 95 % / ≥ 100 % of target) · w21-weight 1 / 3 · w35-weight 1 / 3 · weighed-weekly (finish) 2 · harvest-fcr 2 / 3 (≤ 1.80 / ≤ 1.70) · harvest-uniformity 2 (≥ 70 %) · epef 1 / 3 (≥ 300 / ≥ 350) |
The text and the measured rule of each are in `skills-cycle.js`. The **ideal cycle from the plan level**
reaches level 2 in every branch (§6.14); a run started at the brooding week has no plan points.

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

## 10. Level end, pass and fail

- **End**: plan — the plan page signed after the reply (or day −1 06:00 by itself). Flock levels — the
  last day's record signed after the weigh-in (or the next day 06:00 by itself; then the automatic scale
  at 08:00 of the weigh day is used, `farm.stats.scaleAt[day]`, as Phase 2's `scaleAtWeighInG`). Finish —
  the day 42 record signed with the house empty (or day 43 06:00). Clean-out — 06:00 on the booked day
  (day 70 06:00 if nothing was booked: "no chicks were booked").
- **Measured values only**: weight = the hand weighing (≥ 10 birds) of the weigh day, else the scale;
  level deaths = deaths + culls during the level (+ DOA in finishing) ÷ birds alive at the level start;
  harvest weight from the tickets; swabs from the lab letter; plan numbers from `planSums`.
- **Pass**: §2.1 table (constants in `config.LEVELS[i].target` / `fail`). **Fail early**: at any day's
  close the level deaths already over the limit.
- **Result screen** (run package) per level: the key numbers large, each only when measured (Phase 2's
  rule); the level's week table and "Your week"; the points earned; then "<Level> complete" or "<Level>
  not passed: <the measurement>. Replay <level>." — e.g. "your plan gives 3,009 birds for sale a week;
  the contract asks for 3,600", "your plan's density at catching is 32.7 kg/m²; the limit is 32", "day
  21 weight 840 g, 88 % of the 950 g target", "deaths and culls in week 3 reached 1.4 % on day 20",
  "harvest live weight 2,480 g, 88 % of 2,826 g", "4 of 10 swabs grew bacteria", "the next chicks came
  after 14 days of rest". Buttons: *Continue to <next>* (passed) · *Replay <level>* · *Skill tree* ·
  *Back to the title*. After the clean-out the cycle summary (§8.5) comes after the result.

## 11. Save format

- **Keys** (`config.RUN_SAVE`): `chickenFarm.run.v3` = `{ version: 3, savedAt, run: run.serialize(), blob:
  level.saveBlob() }`; level starts `chickenFarm.run.v3.start.<levelId>` = `{ version: 3, levelId, savedAt,
  run, blob }`; the skill profile stays `chickenFarm.profile.v1` (Phase 2). Phase 2's
  `chickenFarm.level1.v1` is read once: *Continue* resumes it as a run at `level1` with no plan, then the
  run key replaces it.
- `run.serialize()` = `{ v: 1, seed, levelId, plan, levels: { [id]: { state: 'reached' | 'passed' |
  'failed', key: number | null, attempts } }, levelStart: { alive, deaths, day }, summary, conditions: [] }`.
- `level.saveBlob()` (Phase 2 shape) adds `level.levelId`; `env`: `maxDay`, `curtain` (forced value or
  null), `fansBroken`, `fanStages`, `broodersUp`; `farm.serialize()`: `levelId`, `house`, `health`,
  `harvest`, `clean`, `plan`, `air`, the second silo and the pan mix, `flock.lameOnFloor`; records: the new
  note kinds and rows; props: the curtain winch, carried tools (never a chick or a bird), crates and trucks;
  flock: lame birds and catch sections.
- **When**: Phase 2's moments, at each level start (its start key, before the first frame) and at each
  level end (run key).
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
   walking inside: quiet `clean.scrape` every 0.3 m, like the barrow), `washer` with a hose to the wash bay
   (quiet `clean.wash`), `sprayer` (quiet `clean.spray`), `swabs` (provider `swab`: E on the floor →
   `clean.swab`, a small flag left there); interactables `bait-0..3` (use: `clean.bait`), `catch-panels`
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
`build.mjs`, `scripts/shoot.mjs`, `scripts/test-contracts.mjs`. Contract data committed now and owned by a
package: `src/content-jobs-cycle.js`, `src/content-signs-cycle.js` (run), `src/skills-cycle.js`,
`src/farm-plan.js`, `scripts/test-cycle.mjs` `CYCLE_TARGETS` (sim). Need a change in a frozen file? Put it
in your report; the integrator makes it.

### 13.1 `config.js` (Phase 3 section)
`MIN_DAY` −2 · `CYCLE { planDay, prepDay, placeDay, harvestDay, cleanFrom, restMinDays, lastDay }` ·
`ROUNDS` · `PLAN_LEVEL`, `WEEK2`, `WEEK3`, `WEEKS45`, `FINISH`, `CLEANOUT`, `LEVELS` (with `LEVEL1`),
`levelById(id)`, `levelOfDay(day)` · `FEED_STD_TABLE` (`feedStdGAt` extended; ≤ 7 unchanged) ·
`MIN_VENT_PER_1000` extended (≤ 200 g unchanged) · `FEED_TYPES` · `LIGHT_PRESETS` · `HEAT` (sign
figures) · `PLAN_CONTRACT` · `HARVEST` · `CLEAN` · `SPOTS3` · `houseSector(x, z)` · `COMFORT_RAMP`,
`MOISTURE_RAMP` · `UNLOCKS` (33, each with `by`: the package that builds it) · `RUN_SAVE` · `CONDITIONS`
(Phase 4, `available: false`). `SKILL_BRANCHES[i].earnable` stays Phase 2's until the run merge (§9).

### 13.2 Events (`EV`, `src/events.js`)
New: `RUN` 'run' `{ phase: 'start' | 'level-start' | 'level-end' | 'cycle-end', level, pass? }` (run) ·
`CATCH` 'catch' `{ phase: 'start' | 'section' | 'end', i, birds }` (farm) · `LETTER` 'letter' `{ kind:
'contract' | 'reply' | 'vet' | 'lab', day }` (farm: something new lies on the office desk). `EV.LEVEL`
checkpoints carry `level`; `EV.FARM_DELIVERY` gains kinds `'catch'` (`truck`) and feed `type`;
`EV.BIRD_PICK` purposes `'lame'` and `'check'`; `EV.FARM_DEATH` causes of §6.8. `ACTION_IDS` (events.js)
lists every action id of Phase 2 and Phase 3 (the contract test checks every job rule against it).

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
| `feed.order` (Phase 2) | `{ kg, type? }` | `{ arriveDay, arriveHour }` | office phone (run) |
| `feed.withdraw` | `{ on }` | true | feeder box (panels) |
| `feed.wash` | `{ line }` | true | feeder box in clean-out (panels) |
| `litter.fork` | `{ x, z }` | `{ caked }` | scene `fork` provider |
| `litter.patch` (Phase 2) | `{ x, z }` | `{ onLeak, onPad }` (`onPad`: on the pad-overflow strip) | scene `patch` provider |
| `water.flush` (Phase 2) | `{ line, on }` | `{ flushClear, disinfected }` (clean-out: with disinfectant in the header tank) | water supply (panels) |
| `phone.vet` / `phone.bookCatch` / `phone.bookChicks` (ui) | `{ reason }` / `{ day, hour }` / `{ day }` | — | office phone (run) |
| `catch.panels` | `{}` | true | scene `catch-panels` use |
| `load.ticket` | `{ truck }` | `{ crates, birds, grossKg, tareKg, netKg, doa }` | loading bay panel (panels) |
| `clean.scrape` / `clean.wash` / `clean.spray` (quiet) | `{ x, z, r }` | `{ share }` | scene while carrying the tool |
| `clean.brush` | `{ part }` | true | scene: E at the part while clean-out (the five parts) |
| `clean.washbay` | `{ item }` | true | wash bay panel (panels) |
| `clean.bait` | `{ x, z, i }` | true | scene `bait-N` use |
| `clean.swab` | `{ x, z }` | `{ n }` | scene `swab` provider |
| `house.close` | `{}` | true | scene `house-door` use (clean-out) |
| `swab.read` (ui) | `{}` | — | office book lab letter (run) |
The farm sees the ui-only ids it needs (`plan.letter`, `plan.reply`, `fans.read`, `phone.*`, `swab.read`,
`light.preset`) on the bus, as Phase 2's `UI_ACTIONS`.

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
  `farm.flock.lameOnFloor`, `farm.comfort.{ eZ[8], hotFrom, pantShare }`, `farm.feed.{ silos[2], panType,
  withdrawn }`, `farm.harvest { catchAt, sections[8], trucks[2], result }`, `farm.clean` (§6.10),
  `farm.plan { decisions, sums, sentAt, replyAt, measured }`, `farm.stats` additions (`gasKg`,
  `scaleAt[day]`, `catchBookedAt`, `changedAt`, per-level counters the milestones need).
- `env.maxDay`, `env.broodCurtain` (level: the farm's), `env.fansBroken`, `env.broodersUp`, `env.fanStages`.
- `run.state()` `{ levelId, levels, plan, seed }`, `level.def` (the current level def), `level.sampling`
  adds `'bird'` (bird checks open), `skills.unlocked(key)` for every key of §9.1.
- `ctx.ui.registerPanel(id, build, opts)` and the panel helpers `L` (PHASE2.md ui.js) are passed to the
  panels package's `registerCyclePanels(api)` (§13.8).

### 13.6 Keys (physical `KeyboardEvent.code`)
Phase 2's E, Esc, H, Q, T, F, N, K plus **L** light meter (lux at your feet), **V** air meter (air speed,
temperature, humidity at bird height), **C** comfort view (unlocked), **M** moisture view (unlocked).
The run package handles the keys in `ui.js` (as Q and T) and shows the reading over the farmer; help and
title cards list them. One floor overlay at a time (F, M, and the floor-view unlocks).

### 13.7 Hand-offs (carrying stays `props.startCarry` / `drop`, PHASE2.md §13.6)
| Chain | Steps (who) |
| --- | --- |
| Tape | plan sheet *Take the tape measure* → `startCarry('tape')` (panels) → `tape` provider hook / read → `plan.measure` (scene) → office desk *Put the tape back* → `drop()` (panels) |
| Fork, sacks | husk heap panel *Take the fork* / *Take a sack* → `startCarry('fork' \| 'sack')` (panels) → `fork` / `patch` providers (scene) → heap panel *Put it back* → `drop()` |
| Scraper | husk heap panel in clean-out *Take the scraper* → `startCarry('scraper')` (panels) → scene paints `clean.scrape` while walking inside → heap panel → `drop()` |
| Washer, sprayer, swabs | wash bay panel *Take the washer / sprayer / swab kit* → `startCarry(kind)` (panels) → scene paints `clean.wash` / `clean.spray`, `swab` provider → wash bay panel → `drop()` |
| Bird check | `chick` / `sick-bird` provider → `flock.catchNearest` (Phase 2) → `startCarry('chick', { index })` and `EV.BIRD_PICK { index, x, z, purpose }` (flock) → ui opens `bird-check` (panels: day ≥ 8) or `chick-in-hand` (Phase 2, days 0–7) → `sample.bird { look }` per button → *Cull* (`chicks.cull { reason }`) or *Put back* → `flock.releaseBird(index, culled)` (panels) |
| Catch | `catch.panels` (scene use) → the farm runs the sections (§6.9) → `EV.CATCH` → flock removes birds, scene moves the crew and trucks → `load.ticket` at the loading bay panel (panels) |

### 13.8 Stub modules (in code now; each package replaces its own)
| File | Owner | What the stub does now |
| --- | --- | --- |
| `src/farm-cycle.js` | sim | `installCycle(farm, env)` adds `farm.house`, `health`, `air`, `harvest`, `clean`, `plan`, `flock.lameOnFloor`, `cycleStub: true`, `enterLevel(def)` (keeps `farm.level`, stores `farm.cycleLevel`); `cycleAct(farm, env, id, args)` answers `house.curtain` (sets `env.setBroodCurtain`), `plan.send` (planSums), `plan.measure`, `bio.change`; every other Phase 3 id falls through to Phase 2's `doAct` (true) |
| `src/farm-plan.js` | sim | complete: `planSums`, `PLAN_FIELDS` |
| `src/farm-profiles-cycle.js` | sim | `applyCycleRound(farm, env, day, round)`: placeholder care (Phase 2's ideal `am` round on any day, a fan + pad thermostat, feed orders, dead birds counted); `CYCLE_PROFILES`; `runCycle` throws "not built" |
| `src/records-cycle.js` | sim | `harvestPage()` / `cleanPage()` → null, `cycleSummary(run)` → placeholder from the counts, `compact()` no-op |
| `src/skills-cycle.js` | sim | contract data `MILESTONES_CYCLE` (no rules yet: nothing is awarded); `skills.js` exports `ALL_MILESTONES` |
| `src/run.js` | run | `createRun({ level, save, events })`: `state()`, `startRun()` (→ the brooding week; the plan level is not built), `startLevel(id, { from: 'standard' })` → `level.debug.freeRun(def.startDay, def.startHour)`, `serialize` / `restore`, `stub: true` |
| `src/level.js` (one addition) | run | `debug.freeRun(day, hour)`: plays the ideal brooding week (goto auto to day 7 12:00), then runs the clock to (day, hour) with the placeholder care each morning and afternoon, no jobs, no level end, no autosave — a level-mode farm at any age for the other packages' harness runs until the run package builds standard starts |
| `src/content-jobs-cycle.js`, `src/content-signs-cycle.js` | run | contract data (§4, §5); not yet in the engine or on the boards (`boardsForDay(day)` merges them for the ui already) |
| `src/content-jobs.js` (days only) | run | the Phase 2 routines' `days` run to day 41 / 46 and the walks carry `area: 'used'` (§4.2) |
| `src/ui.js` (one call) | run | calls `registerCyclePanels(api)` after the Phase 2 panels |
| `src/main.js` | integrator | creates the run (`ctx.run`), `__game.run`, `startRun`, `startLevel({ level })`, `cycleAt` |
| `src/ui-cycle-panels.js` | panels | `registerCyclePanels(api)` registers a placeholder panel (title, plate, "this panel comes in Phase 3") for every new panel id, so E on a new interactable opens something |
| `scripts/test-cycle.mjs` | sim | `CYCLE_TARGETS` and the contract checks that run on stubs; profile tests skip while `farm.cycleStub` |
| `scripts/test-run.mjs` | run | the chaining tests skip while `run.stub`; `freeRun(30, 14)` reaches day 30 with birds alive |
`env.setMaxDay(n)` and `env.setBroodCurtain(closed | null)` are in `sim.js` now (sim owns the file).

## 14. Work packages (four, disjoint files, parallel worktrees)

Each engineer works in `git worktree add ../cf3-<key> -b phase3/<key> main`, edits **only the files
listed** (new files with the listed prefixes are theirs too), codes against the stubs and §13, and keeps
these passing on the branch: `npm run build`, `npm test` (now also `scripts/test-cycle.mjs` and
`scripts/test-run.mjs`, which skip their model / chaining parts on the stubs),
`node scripts/shoot.mjs --scenario cold-hot --size 960x600`, `--scenario p2-hooks`,
`--steps scripts/phase1-jobs.json` (sandbox) and `--steps scripts/p2-level1.json` (the brooding week).
Other packages' stubs return placeholders: test your side by setting fields on the stubs and emitting
events (`__game.events.emit(...)`), and reach any day in level mode with `__game.cycleAt(day, hour)`
(`level.debug.freeRun`, §13.8). The machine renders WebGL in software: keep harness runs short (`--size
960x600`, `settle` / `advance`, `__game` hooks) and prefer node tests for logic. Write in chunks of
≤ 250 lines and commit after each working milestone.

### 14.1 `sim` — the farm model for the whole cycle, records, skills, saves (branch `phase3/sim`)
**Owns:** `src/sim.js`, `src/farm.js`, `src/farm-*.js` (incl. `farm-cycle.js`, `farm-plan.js`,
`farm-profiles-cycle.js`; new `farm-heat.js`, `farm-health.js`, `farm-harvest.js`, `farm-clean.js` …),
`src/records.js`, `src/records-*.js` (incl. `records-cycle.js`), `src/skills.js`, `src/skills-*.js`
(incl. `skills-cycle.js`, new `skills-rules-cycle.js`), `src/save.js`, `scripts/test-sim.mjs`,
`scripts/test-cycle.mjs`. Pure logic: no three.js, no DOM (save.js touches `localStorage` only).
**Contract:** §6 (model), §7 (problems), §8 (record data), §9 (milestone rules, awards by level), §11 (farm
serialize / restore with `levelId`; the run store), §13.2 events it emits (`FARM_PROBLEM`, `FARM_DEATH`
causes, `FARM_DELIVERY` catch and feed type, `CATCH`, `LETTER`), §13.3 every action marked as a farm
action with its result shape, §13.5 the state others read.
**Builds:**
- `farm.enterLevel(def)`: the level's problems (pending) and weather events, re-armed recurring problems,
  the level-start counters (`stats.levelStart`), `env.setMaxDay(70)` in the clean-out; `farm.start(def)`
  for the plan level (empty clean house, no truck). Remove `cycleStub` when the model runs.
- The model of §6.1–§6.10 for ages ≥ 7 (Phase 2 numbers below age 7 unchanged), the curtain and floor in
  use, crowding, heat by zone with the humidity term, fans broken and stages, pads, gas, SDS, legs, the
  bird-check readings, two silos and the pan mix, the change shock, withdrawal and shrink, vaccination,
  Gumboro, coccidiosis and medication, dust and breathing, catching, DOA, tickets, the harvest result,
  the clean-out grids, swabs and the lab letter, rest and booking; `farm.problemZones()`, `forecast()`
  and `observe()` for the new problems and words; `planSums` (done) used by `plan.send`.
- `env` (sim.js): `rh` on weather events; `setFansBroken`, `setFanStages`, `broodersUp`; the effective fan
  count; `setMaxDay` / `setBroodCurtain` (in code); a heat budget `env.heatBudget()` → `{ wallsCh, airCh,
  brooderCh, birdsCh, sunCh }` °C/h for the *heat loss* readout.
- Records (§8): rows to day 46 with the new fields, `timeline()` per level, `harvestPage()`,
  `cleanPage()`, `cycleSummary(run)`, `compact(beforeDay)`; skills (§9): rules for every
  `MILESTONES_CYCLE` id, `evaluate(checkpoint, { level })` over `ALL_MILESTONES` taking only that level's
  milestones (Phase 2's awards in the brooding week unchanged: `test-level.mjs` keeps passing).
- `save.js`: `createRunStore()` → `{ available, load(), save(run, blob), loadStart(id), saveStart(id, run,
  blob), clearStarts(fromId), info(), migratePhase2() }` (quota: drop the oldest start, retry).
- `farm-profiles-cycle.js`: `applyCycleRound(farm, env, day, round, profile)` for rounds `am`, `pm`,
  `eve`, `night`, `noon` and the dated ones (`curtain`, `vaccine`, `change`, `brooders`, `heatwave`,
  `withdraw`, `catch`, `clean1..4`, `swabs`, `book`), the ideal and every mistake of §6.14; `runCycle`.
  The run package's goto(auto) and standard starts call `applyCycleRound` at the rounds your
  `cycleStops(fromDay, toDay)` export lists (you own that list; run reads it). `climateCare` is a stub
  helper only: drop it once the ideal profile runs the fans itself.
**Acceptance:** `node scripts/test-cycle.mjs` — every `CYCLE_TARGETS` profile in its bands (§6.14),
determinism byte for byte, speed (§6.15), save sizes (run blob ≤ 250 KB at day 41 of the ideal; a level
start ≤ 250 KB; restore → serialize identical for each level start), `planSums` reference (6 × 6,000 ×
67 d → 3,611 / 28.0 / 21), every farm action of §13.3 returns its result shape, rows hold null for every
reading not taken; `node scripts/test-sim.mjs` — Phase 2 unchanged; `grep -iE "correct|wrong|well done|
good job|mistake|perfect|excellent" src/records*.js src/skills*.js` finds no player-facing text.

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
**Contract:** §2 (run, chaining, starts), §3 (engine), §4 (job content), §5 (board merge `allBoards(day)`
with `fromDay`), §8 (records UI), §9 (checkpoints with `level`; skill tree), §10 (results), §11 (when to
save, through the sim's run store), §13.6 keys, §15 hooks. Calls `registerCyclePanels(api)` (panels) with
`api = { register(id, build, opts), L, boards(id), plate(id, opts) }` once, after Phase 2's panels.
**Builds:**
- `run.js`: `startRun({ seed, at })`, `next()`, `replay(id)`, `startLevel(id, { from: 'saved' | 'standard',
  seed })`, `state()`, the run card data, Phase 2 save migration; `level.js`: the current `level.def`,
  `start(def)` / `enter(def)` (keep the flock) / `resume(blob)` for every level, the end and pass rules of
  §10 per level, checkpoints of §9, `sampling` incl. 'bird', `debug.goto(day, hour, { auto })` across the
  cycle (sim's `cycleStops()` + `applyCycleRound`), `debug.freeRun` kept for tools, the catch-night clock.
- `job-engine.js`: every §3.1 change; Level 1 identical (`test-jobs.mjs` Phase 2 cases unchanged).
- Content: wire `JOBS_CYCLE` into the engine (one list `allJobs()`), the routine `days` / `area` of §3.3,
  `JOB_WHERE_CYCLE`; board merge and the ten new sign panels (run draws boards; scene paints them).
- UI: title card and run card (§1), HUD day labels, the job card headers, keys L / V / C / M with the
  float readings and the overlay legends, the records book (level week tabs, Plan, Harvest, Clean-out,
  letters: contract, reply, vet, lab; phone: order feed by type, vet, book catch, book chicks), result
  screens per level, the cycle summary, the skill tree with all eleven branches (`ALL_MILESTONES`, every
  branch's three unlocks; ask the integrator to set every `earnable` true at the merge), and the
  unlocks marked "run" in §9.1 (`planVsCycle`, `swabMap`, `comfortGraph`, `gasGraph`, `feedGraph`,
  `recordsTargets`, `weightGraph`; `comfortOverlay` / `moistureOverlay` keys and legends).
**Acceptance:** `node scripts/test-jobs.mjs` (Phase 2 cases; new: per-level windows and days, `onDays`,
action and stat anchors with negative `fromH`, `area` used / house and `tool`, `sectorsOf` house and
`match`, `has`, each new state test on the farm stub with fields set, problem jobs only of the current
level, the rest skip's `nextOpening`); `node scripts/test-run.mjs` (on the real sim once merged; the
chaining part skips while `run.stub`): a scripted plan (two measures, the reference plan, reply, sign)
passes with 3,611 a week; goto(7, 21, auto) passes the brooding week; *Continue* starts week 2 at day 8
06:00 with the same alive count and the start saved; goto(auto) through every level passes, the cycle
summary exists; a failed week 3 replays from day 15 06:00 with a farm identical to the saved start; a
standard start of `weeks45` reaches day 22 06:00 in ≤ 6 s; a Phase 2 save continues as a run;
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
**Contract:** `registerCyclePanels(api)` (§13.8: `api.register(id, build, { kind })`, `api.L` = Phase 2's
panel helpers: `act`, `uiAct`, `close`, `env`, `farm`, `records`, `skills`, `props`, `flock`, `events`;
`api.boards(id)` the merged board of the day, `api.plate(id, opts)` Phase 2's plate builder); the actions of
§13.3 marked "panels"; the hand-offs of §13.7 that start in a panel; the unlocks marked "panels" in §9.1
(`skills.unlocked(key)`); plates from §5.3 with sources in small text; clock classes as Phase 2 (`sign`
while a plate is unfolded, `panel` otherwise; machines that need farm time fold their plate).
**Builds:** panels `plan-sheet` (his sums, his decisions, *Send the plan*, *Take / Put back the tape*;
`planningCalc`: the sums live; `planCarry`: starts from the last cycle), `bird-check` (days ≥ 8: watch it
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
`p3-panels-plan.json` (enter 6 / 6,000 / 67 / 4 / 2.8 and *Send the plan* → `farm.plan.sums.salePerWeek`
3,610–3,612, `densityKgM2` 28.0; the plate shows "general practice" on every line), `p3-panels-week2.json`
(day 12: main valve off, mix with stabiliser, valve on → the bus saw `water.main`, `vaccine.mix`,
`water.main`; curtain winch *Lift* → `env.broodCurtain === false`; a bird check → `sample.bird` with
look gait, feathers, feet), `p3-panels-heat.json` (day 31 14:00: six fans and the pad → `env.fansManual
=== 6 && env.padOn`; `fans.read` once after 2 s; the wind chill line absent, then present after
`__game.skills.award(...)` reaches Heat & Ventilation level 1), `p3-panels-harvest.json` (loading bay:
two tickets with net = gross − 12,000), `p3-panels-clean.json` (wash bay: *Take the washer* →
`props.carrying === 'washer'`); shots at 960 × 600 of every new panel reviewed (no sideways scroll, plate
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
**Acceptance:** against the stubs, by setting farm fields (`farm.clean.wet`, `farm.harvest.sections[i].
state`, `farm.flock.lameOnFloor`, `env.setFansBroken([3])` …) and emitting events: `p3-scene-look.json`
shots reviewed — day 11 after the lift (spread over the house), day 21, day 31 15:00 with six fans (panting
along the walls), a lame bird, an SDS dead bird on its back, day 41 (white carpet), the catching night
(crew, two trucks, penned sections), the empty house with feathers, litter removed, the washed wet floor,
disinfected, the wash bay, overlays C and M with their legends; `p3-scene-events.json` with `expect`: tape
hooked at x −23.6 and read at x 23.6 → `plan.measure { axis: 'length' }` with m 48.0; `house.curtain` →
the mean x of the drawn birds > −4 within 60 s of play; fan 4 broken → its rotor still while the others
turn; two scraper passes along z −2.5 and +2.5 → ≥ 300 `clean.scrape` cells; a catch section set 'done'
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
  `level.debug.trigger(id)`, `farm.debug.trigger(id)`, `farm.debug.truth()`; `ui.openPanel(id)`.
- `snapshot()` adds `levelId`, `maxDay`, `fansBroken`.
`scripts/p3-design-stubs.json` (integrator, runs on the stubs now): the hooks exist, `startLevel({ seed })`
is still the prep day, `startLevel({ level: 'weeks45' })` gives day 22 in level mode, `cycleAt(31, 15)`
draws the flock over the whole house, `ui.openPanel('fan-panel')` opens the placeholder with its plate.
Node: `npm test` = `test-contracts.mjs` + `test-sim.mjs` + `test-jobs.mjs` + `test-level.mjs` +
**`test-cycle.mjs`** (sim) + **`test-run.mjs`** (run). Steps files per package: `p3-run-*.json`,
`p3-panels-*.json`, `p3-scene-*.json` (§14). The design run of this phase: `node scripts/shoot.mjs
--scenario cold-hot --size 960x600` (no errors) and `npm test`.

## 16. Integration order

1. Merge `sim` (pure; `test-cycle.mjs` runs its profiles on main). 2. `scene` and `panels` (either order;
both read the farm). 3. `run` last (it drives the levels and starts). After each merge: `npm run build`,
`npm test`, `cold-hot`, `tour`, `phase1-jobs`, `p2-hooks`, `p2-level1.json`, and the merged packages'
steps files. Then the integrator's runs with real input: **`scripts/p3-cycle.json`** — title → *Start a new
flock* → the planning day by walking (gate sign, dip, guard hut, the tape at both end walls, the sheet,
the reply, sign) → `goto(7, 21, auto)` → *Continue to Week 2* → day 10 lift the curtain by walking to the
winch, day 12 vaccinate at the water supply → `goto(21, 21, auto)` → weeks 4–5: the day 27 fan found by
walking past it, the heat wave with the fan panel → `goto(41, 20, auto)` → the catching night watched,
the tickets read → clean-out: one scraper pass and one washer pass by walking → `goto(67, 7, auto)` → the
cycle summary (every level passed, ideal bands of §6.14); **`scripts/p3-replay.json`** — fail week 3 with
the poor vaccine (real clicks at the water supply on day 12), *Replay Week 3* from day 15. Then
ARCHITECTURE.md ("Phase 3 — as integrated") and a play-through recording for the farmer.

## 17. Open questions for the farmer

1. **Guide tags (§5.1):** we put the plan's topic for each week under that week's guide (e.g. "a dark
   period every night from week 2 lowers sudden deaths" — Week 2 guide; "use the tunnel fans against heat
   stress" — Week 4 guide) and every number under general practice. Which guide says each one?
2. **Light from week 2:** how many hours of darkness do you give, from which day, and at how many lux?
3. **Brooding curtain:** do you brood in half the house and release on about day 10? Do you warm the other
   half first?
4. **Vaccination:** your schedule (vaccines, days, water / spray / eye drop); do you thirst the birds, and
   for how long; do you use a milk powder stabiliser?
5. **Feed program:** your days for starter, grower and finisher; crumble or pellets; one silo per feed?
   Who orders the feed?
6. **Heat:** at what house temperature do you add tunnel fans for big birds? Do you use a temperature +
   humidity rule (°C + RH above about 105) and turn the pads off above a humidity?
7. **Weekly targets:** a week fails below 90 % of the target weight or above 1 % deaths a week (2 % for
   weeks 4–5, 1.5 % for the last week incl. dead on arrival) — your company's numbers?
8. **Harvest:** catching time, hours of feed withdrawal, crew size; do you get weight tickets and the dead
   on arrival from the plant?
9. **Clean-out:** your steps and products; do you take swabs; is 3 weeks of rest your rule?
10. **Planning:** does the planning sum match how your company plans (birds for sale per week, 32 kg/m²
    at catching, 4 % losses, 42 + 4 + 21 days)? Should the plan also set the number of chicks in house 1
    (fixed at 6,000 now)?
11. **Diseases:** are Gumboro (week 3, after a poor vaccination) and coccidiosis (bloody droppings) the
    right examples for your area?
12. **Lame birds:** do you cull by a gait score, and on which round do you walk for them?
13. **Pace:** a whole cycle is about 3 hours; weeks 4–5 is the longest level (about 45 minutes). Split it
    into two levels?
14. **Gas:** do you read a gauge on the LPG tank, and about how much gas does a flock use in your season?
