# Chicken Farm — Phase 2 spec: Level 1, the brooding week

**Goal (approved plan):** a Level 1 vertical slice. Prepare the house and run the brooding week,
with the job list, info signs, flock records and the first two skill branches. The farmer plays
from the day before the chicks arrive to the day 7 weigh-in and judges whether learning by doing
farm jobs works for him.

Read with `ARCHITECTURE.md` (Phase 1 contracts, still valid). This file adds what Phase 2 builds,
the shared contracts already in code (`src/config.js`, `src/events.js`, `src/interact.js`,
`src/content-signs.js`, `src/content-jobs.js`, the stub modules) and the four work packages (§14).
Revision 2 answers the design review; §18 maps each review issue to the place it is fixed.

## 0. Rules that hold everywhere (approved design, do not break)

- **No lessons, no quizzes.** Facts sit on signs and equipment plates at the place where you use them.
  The job list walks you through each job and points to where its facts are.
- **No "correct" / "wrong" messages anywhere**, no green ticks on values, no red crosses, no "good job",
  and no hidden answer key that marks what the farmer wrote. A job turns "done" because it was *done*,
  not because the value was right. Results appear only as measured numbers: in the daily flock record
  (body weight against target, feed, water, deaths, FCR, litter moisture), on gauges and instruments,
  and in what the flock does.
- **Every sign fact shows its source** in small text: one of the six guides (`GUIDES` in config:
  Week 1 guide, Week 2 guide, Week 3 guide, Week 4 guide, Broiler Ventilation, Broiler Management 101)
  or "general practice". The guide PDFs and content-map.md are not in this repo: **no page numbers**;
  only the facts listed in §6.1 may carry a guide name. Every other number is "general practice".
- Missing the level's key target fails the level and you replay it (§10). Skill points come from
  results of play (§9), never from answering anything.
- Desktop browser, English, one self-contained page, three 0.160.0 from jsDelivr, procedural low-poly
  flat-shaded art, all constraints of ARCHITECTURE.md "Publishing constraints".
- Phase 1 stays playable: the **sandbox** (Phase 1 farm, 4-job tutorial, test tools) is one choice on
  the title card, and the default under automation so every Phase 1 harness scenario still passes.

## 1. Player experience walkthrough

Real times at normal speed. Clock speeds (§2): walking 120× (one farm hour = 30 s), an equipment
or inspection panel 30×, carrying boxes / barrow / frame and the whole chick placement 30×, a sign
board or plate open: **the clock stands still**. Budget for a whole level: **about 40 minutes**;
the farmer can leave at any time (autosave, §11).

### Title card (boot)
Over the farm at dawn: **"Level 1 – The brooding week"**. Buttons: *Start Level 1*, *Continue — Day 3,
10:40* (only with a save), *Walk the Phase 1 farm (sandbox)*. "Skill tree" opens the 11-branch
screen read-only. One sentence: "Get the house ready, take in 6,000 chicks and bring them to day 7."
Under it the keys: E use · Q squeeze litter · T floor thermometer · N notebook · K skill tree · H help.

### Prep day (Day −1) — about 8 minutes
07:00. The farmer stands inside the farm gate (FARM.spawn). The house is empty and clean: bare grey
concrete floor, drinker lines winched up (50 cm), feeder pans up, brooders cold. A heap of rice husk
and a wheelbarrow sit on the apron west of the door. The job card reads **"Prep day — chicks arrive
tomorrow 08:00"** with ten jobs.

1. **Foot dip at the gate** — walk through the dip beside the gate sign (splash). Done.
2. **Start pre-heating** — at the climate controller (north wall), *Temperature* section: brooder
   setpoint. Done when the brooders burn at a setpoint ≥ 30 °C. How early shows tomorrow in the floor
   temperature: the concrete under the litter takes most of a day to warm (§6.2).
3. **Spread the litter** — E at the heap opens the heap panel: depth 2 / 5 / 8 / 10 cm beside the
   litter facts, *Take the barrow*. Walking the house with the barrow (clock 30×) paints the floor from
   concrete to husk in a 2.4 m swath; the job bar shows "floor covered 63 %". About 60–90 s real.
4. **Lower the drinker lines** — at each line's regulator (west end) E opens the *Drinker line* panel:
   a side view with the nipple, a ruler in cm and **a day-old chick's head drawn at its eye level from
   the prep day on**; winch up / down in 1 cm steps; pressure knob with the sight-tube column; *Flow
   test* (a cup under a nipple for one farm minute, shows ml). Plate: flow rule, "day 0: nipple at chick
   eye level, about 10–12 cm" (general). Done when all four lines have been set (any value).
5. **Fill the feeder pans** — feeder control box: per line *Run*, *Flood*, pan height (the plate shows
   a pan sitting on the litter for days 0–3). Done when all three lines are flooded and full.
6. **Check the silos** — outside, north of the house; E reads the level gauge: 1,100 kg.
7. **Set the light program** — controller, *Lights* section: dark start, dark hours, dimmer; shows lux
   at chick level. Plate: 23 h light in the brooding week (Week 1 guide), 30–40 lux (general).
8. **Set the minimum ventilation timer** — controller, *Ventilation* section (fans, on-seconds, cycle);
   the min-vent sign beside the controller has the per-1,000-bird table and a worked example.
9. **Flush the water lines** (opens 16:00: "about 12 hours before the chicks" on the water sign). At
   the water supply (SW corner) each line's flush valve: four sight tubes, brown water turning clear
   over ~10 farm minutes per line (panel 30×: 20 s real), close each when clear.
10. **Sign the prep checklist** at the office desk: the book lists what was done and when (no
    judgement). Signing ends the day; *Next job* skips the night to 06:00.

Night: skipped in one jump (the farm keeps integrating). The farmer wakes at the gate at 06:00.

### Day 0 — chicks arrive — about 8 minutes
- **Before the truck (06:00–08:00, 60 s real at 120×)** the card shows only four jobs, in a group
  headed "Before the truck": dips, *Read the climate controller*, *Read the water meter* (the first
  reading is the baseline) and **Measure the floor temperature** (T at his feet, or the job button: he
  crouches, the reading floats over him for 3 s and goes into the notebook; three spots in three
  sectors; open until the first stack is tipped). The other morning jobs (drinkers, feeders) are open
  until 12:00 and listed below. The reading is the truth (30.6 °C, or 27.6 °C if he pre-heated late).
- **08:00 the chick truck** drives in and stops at the door path; the driver stacks six stacks of ten
  boxes. *Next job* skips to 08:00 if he is early. From the truck stopping until the last stack is
  tipped the clock runs at 30×. **Anchor jobs are pinned to the top of the card while open**: place,
  grade, then vent and crop.
- **Place the chicks.** E at a stack picks up ten boxes. Inside the brooding area E tips them where he
  stands: 1,000 chicks spill and spread. Six carries, about 60–90 s real = 30–45 farm minutes. Time
  in the boxes counts (§6.3). The sign says "get the chicks out quickly"; grading can wait.
- **Grade a sample box** (chick table by the truck, open truck +0..6 h). Ten chicks drawn in 2D: *Turn
  on its back* (rights itself after 1–6 s, a timer counts), *Look at the navel*, *Look at the hocks*,
  and **Cull** for a weak one (it goes to the cull bucket: `chicks.cull`). A grading sheet beside it has
  tally boxes he fills himself; *Weigh the box* shows gross kg; the box weight is printed on the box.
  *Hand in the sheet* copies the sheet into the record as his chick-quality note. Nothing checks the
  tallies. The chick weight in the record comes from the box weighing itself (gross − box) ÷ 100, never
  from a typed value.
- **Vent temperatures** (open 2–3.5 h after the first tip). E near chicks: *Pick up a chick*. The
  *Chick in hand* panel: *Take vent temperature* → "39.8 °C", *Put back*. Five chicks, three sectors.
  He reads the numbers against the chick sign range and acts (or not) on the thermostat.
- Afternoon round: dips, walk the house (spread, sounds), controller, litter (Q squeezes a handful),
  dead birds (box deaths and weak chicks show up from today; weak ones can be picked up and culled).
- Evening: the daily record at the office. **The first results**: chicks placed, dead in boxes, dead
  today, culls, feed and water since placement, house min/max against target, floor at arrival, vent
  temperature mean, chick weight. Sign; skip to 06:00.

### Days 1–6 — about 3–4 minutes each, one event a day so the days differ
Morning round (≈ 2.5 min), afternoon (≈ 1 min), record (≈ 20 s), skips between. Each event starts
silently; a job appears only once the farmer has met a symptom (§7), titled by what he saw:
- **Day 1**: crop check at 24 h (ten chicks, *Feel the crop*); one brooder's flame went out at 05:00 —
  standing near it on the walk, he sees it unlit and the chicks under it huddled → *A brooder is not
  burning* → E *Relight*.
- **Day 2**: the radio at the office desk gives tonight's forecast, low 13 °C → *Night check*
  (20:00–24:00: controller and a short walk). A wide-open vent timer loses the heat (§6.2).
- **Day 3**: from 10:00 the main water filter clogs. The day 4 meter reading shows water per 1,000
  birds 10 % *below* yesterday (in week 1 it should rise every day; the meter panel shows the change);
  the flow tests show every line low; chicks crowd the nipples. A flow test showing a low line, or a
  look at the filter gauges, opens *Low water flow: find the cause* → *Clean the filter*.
- **Day 4**: a nipple on line 3 starts dripping at 10:00; by the afternoon a dark wet patch → walking
  past it or squeezing there opens *Wet litter here: find what wets it* → *Replace the nipple*, then
  *Put fresh litter on the wet patch* (a sack from the heap).
- **Day 5**: the silo gauge reads about 280 kg; the plate says order below two days of feed (6,000 ×
  34 g ≈ 200 kg a day) → *Order feed for the silos* (office phone; ordered before 16:00, it comes the
  next morning 09:00).
- **Day 6**: a hot, sunny afternoon (+3 °C outside and the sun on the roof): the controller shows the
  house over its target, chicks pant along the walls → *The house is above its target this afternoon*
  → the brooders are off by their thermostat; more fan time on the minimum ventilation timer (air in
  at the side inlets, low air speed at the chicks). Tunnel fans chill week-1 chicks: they pile up.
Each afternoon he raises nipples and feeders a little (the side view shows the chick's head moving up).

### Day 7 — weigh-in and result — about 5 minutes
Morning round plus **weigh sample birds** (open 08:00–18:00; 08:00 day 7 is flock age 7.0). He takes
the hand scale and catching frame from the bird scale (panel), sets the frame down in a sector (E):
ten birds are held; the weigh panel opens (*Weigh next*, 0.4 s each, or *Weigh all*). Five sectors →
50 birds; the panel shows each weight and the sample mean. Plate: 4–5 × chick weight (Week 1 guide).
Then the evening record and **the result screen** (§10).

## 2. Clock, days and speed

- **Two clocks (in code: `config.flockAgeAt`, `PLACEMENT_DAY`).**
  - *Calendar day N* = `env.dayNumber`, the HUD's "Day N" (day −1 = prep day, `MIN_DAY`; day 0 = the
    chicks come at 08:00). Job windows, record rows and everything the farmer reads off a sign by day
    (brooder table, "age + 20 ml/min", feed per day) use N. Milestones compare with the sign value for N.
  - *Flock age* a = `env.day − PLACEMENT_DAY` (`PLACEMENT_DAY` = 0 + 8/24). The model's continuous
    rates (intake, growth, water need, nipple and pan height curves) use a. 08:00 day 7 is a = 7.0,
    the earliest weigh-in. The two differ by less than one day.
  - `targetTempAt(N)` = 34 °C for N ≤ 1. The Phase 1 sandbox keeps its own start (day 1, 08:00).
- **Speeds** (`LEVEL1.clock`, game seconds per real second): `work` 120 walking; `panel` 30 while an
  equipment or inspection panel is open; `carry` 30 while carrying boxes, the barrow, a sack or the
  catching frame, and from the truck stopping until the last tip; `sign` 0 while a sign board or a
  plate is open (reading is free); `fast` 480 (4× button). The records book, notebook, skill tree and
  result screen pause. The sandbox keeps `TIME.gameSecondsPerRealSecond` (360). The level sets
  `env.timeScale` every frame from this list (highest-priority state wins: paused > sign > panel >
  carry > fast > work).
- **Rounds** (`LEVEL1.rounds`): morning 06:00–12:00, afternoon 13:00–18:00, evening 16:00–24:00,
  prep 07:00–24:00 (flush 16:00–02:00).
- **Each morning** after an overnight skip the farmer starts at the gate (FARM.spawn).
- **Next job** (job card footer and time bar; replaces "Skip 1 hour" / "Next morning" in a level):
  - if a job is open → the marker moves to the next open job in card order (no time passes); a second
    press within 3 s (the button now reads *Skip to 13:00 — 2 jobs open*) skips anyway;
  - if no job is open → the clock skips (`env.skipHours`, the farm integrates every minute) to the
    moment the next job opens, never past the truck at 08:00 day 0 or the end of day 7;
  - a skip past a window's end marks its open jobs **missed** (struck through in grey on the card;
    the record shows "not read"). No message; it shows as blanks and in what the flock does.
- A problem never stops a skip and is never announced (§7).

## 3. The job system

### 3.1 Data model
Job definitions are data in `src/content-jobs.js` (`JOBS`, committed; package "level" owns it; the
header documents every field). A `JobDef` has `id`, `kind` (`dated` | `routine` | `problem`), `day`
or `days` (calendar days), `round` or `window` [fromH, toH] or `rel: { anchor: 'truck'|'placed',
fromH, toH }` ('placed' = first stack tipped), optional `closeOn: 'placed'`, `preTruck`, `pin`,
`spot`, `signs` (ids of `content-signs.js` BOARDS), `branch`, `done` (rule) and for problems
`problem` (farm problem id) and `after` (opens only when that job is done).

The engine (`src/job-engine.js`, package "level", **no DOM, runs in node**) turns defs into
**instances**, one per day: `{ key: 'r-meter@3', id, def, day, status, opensAt, closesAt, doneAt,
progress, result }`, status `waiting → open → done | missed`, times as `env.day` floats. It creates
the prep day's instances at level start and each next day's at midnight. Relative windows get their
times when the anchor happens. Problem instances are created on `EV.FARM_PROBLEM { phase: 'symptom' }`
for that problem and close as missed only at the end of the level. API:
`createJobEngine({ events, env, farm, props, jobs = JOBS })` → `{ start(day), restore(d), tick(),
list(), open(), current(), byKey(key), complete(key), serialize() }`; `tick()` runs the state rules
and the windows (level.update calls it twice a second; node tests call it directly).

### 3.2 How a job knows it is done
The engine listens to the bus and evaluates the open jobs' rules on each event, plus `state` rules
on every tick. **Only events while the instance is open count.**

| Rule | Meaning | Example |
| --- | --- | --- |
| `event` | one bus event whose payload `matchPayload`es `match` (events.js: subset match, nested objects recursive); `sameDay`: `payload.day === instance.day` | `EV.RECORD_CLOSED {signed:true}` sameDay |
| `action` | one `EV.ACTION` with this `id` (payload `{ id, ...args, result }`), optional `match` on the whole payload | `water.clearFilter` with `match: { result: { fixed: true } }` |
| `each` | the action once for every value of `payload[key]` | `water.flowtest` for lines 0–3 |
| `count` | n actions, from ≥ `sectors` different `broodSector(x, z)`; `nearDrinker`: k of them within 1 m of a drinker line (z) | 5 × `sample.vent` from 3 sectors |
| `coverage` | share of the 300 brooding cells (`FLOOR_GRID` cells whose centre is inside `BROOD_BOUNDS`) **seen** this round: every cell whose centre is within `sight` m (2) of an `EV.CELL` position; `listen`: and one `EV.LISTEN` | 50 % + listened |
| `state` | named predicate (`STATE_TEST_IDS` in content-jobs.js, defined there) | `litter-covered` |
| `all` / `any` | combinations; in `all` each part **latches** once met | dips: gate then house |

`progress` (0..1) drives the job's bar (coverage, count, each, chicks placed, cover).

### 3.3 Quality is judged silently
Completion never looks at the value. Each job's **result** is what was measured or set while it was
done (e.g. `r-drinkers`: the four flows and heights; `prep-flush`: the time the last line ran clear;
`d0-grade`: the farmer's own sheet). The engine writes it with `records.logJob(key, day, result)`.
The simulation already felt every setting (§6); the record shows the numbers; skills read farm
stats and records at checkpoints (§9). None of them say whether it was right.

### 3.4 Pointing to places and facts
- The 3D marker (Phase 1 diamond, ground ring, edge arrow) sits over the current job's `spot`: a key
  of `SPOTS` / `SPOTS2` / `FARM`, `drinkers.N`, or dynamic: `heater` (nearest brooder), `heater-out`
  (the brooder that went out), `dead` (nearest dead bird), `leak` (the wet patch once found).
- The open job shows one line of *where* text and its fact links ("Facts: Water lines sign (north
  wall, west end)"). Clicking a link moves the marker to that board until it is read. Boards linked by
  the current job wear an orange "facts" tab in 3D (`props.highlight(ids)`).
- Jobs name the check, never the value: "Check drinker flow and height", never "set 23 ml/min".
  Problem jobs name what was seen, never the cause.

### 3.5 The job card (HUD, top right; replaces Phase 1's in a level)
Header "Day 3 · Morning round 06:00–12:00". Order: pinned jobs (open `pin` jobs, then problem jobs
with a neutral "new" pin), then on day 0 before the first tip the "Before the truck" group
(`preTruck`), then the rest of the round in list order. The current job is expanded (where, fact
links, bar); done jobs collapse to a count; missed ones are struck through. Footer: *Next job* (§2),
*Notebook* (N), *Skill tree* (K). Narrow screens: same rules as Phase 1.

## 4. Every job in the slice

Columns: **Where** · **Action** · **Done when** · **Sim** (what the model does) · **Facts** (§5 ids).
Exact rules are in `src/content-jobs.js`.

### 4.1 Prep day (day −1, 07:00–24:00)

| Job | Where | Action | Done when | Sim | Facts |
| --- | --- | --- | --- | --- | --- |
| `prep-gate` | gate dip | walk through | `EV.FOOTDIP gate` | biosecurity log | sign-gate |
| `prep-preheat` | controller | Temperature: setpoint | state `preheat-on` (≥ 30 °C, burning) | air, slab, litter warm (§6.2) | sign-brooder |
| `prep-litter` | litter heap | heap panel: depth, *Take the barrow*; walk | state `litter-covered` (≥ 95 %) | depth, cover grid | sign-litter |
| `prep-drinkers` | `drinkers.0..3` | drinker panel: winch, knob, flow test | `water.height` on lines 0–3 | heights, flows | sign-water, drinker |
| `prep-feeders` | feeder box | per line run, flood, height | state `pans-flooded` | pans filled (≈ 200 kg from the silo) | feeder-box |
| `prep-silo` | silo gauge | E: read | `feed.silo` | — | silo |
| `prep-lights` | controller | Lights: program, dimmer | `light.program` | lighting (§6.5) | controller-lights |
| `prep-vent` | controller | Ventilation: fans, on-s, cycle | `vent.timer` | air exchange (§6.2) | sign-vent |
| `prep-flush` (16:00–02:00) | water supply | flush valve per line, close when clear | state `lines-flushed` | water quality q (§6.4) | sign-water, water-supply |
| `prep-record` | office desk | prep page, *Sign* | `EV.RECORD_CLOSED {signed}` same day | ends the prep day | — |

### 4.2 Dated jobs, days 0–7

| Job | Window | Action | Done when | Sim | Facts |
| --- | --- | --- | --- | --- | --- |
| `d0-floor` | 06:00 until the first tip (latest 12:00), preTruck | T: floor thermometer | 3 × `floor.probe`, 3 sectors | reading only | sign-brooder |
| `d0-place` (pin) | truck +0..12 h | E stack, E tip in BROOD_BOUNDS | state `all-placed` | placement spot, box time | sign-chicks, sign-brooder |
| `d0-grade` (pin) | truck +0..6 h | grading panel; *Cull*; *Weigh the box*; *Hand in* | ui action `grade.submit` | culls; measured chick weight | sign-chicks |
| `d0-vent` (pin) | first tip +2..+3.5 h | E chick; *Take vent temperature* | 5 × `sample.vent`, 3 sectors | reading only | sign-chicks |
| `d1-crop` (pin) | first tip +22..+28 h | E chick; *Feel the crop* | 10 × `sample.crop`, 3 sectors | reveals crop fill | sign-chicks |
| `d7-weigh` (pin) | 08:00–18:00 day 7 | scale + frame; E set frame; weigh | 50 × `sample.weigh`, 5 sectors | weighed mean, CV | bird-scale |

### 4.3 Routine jobs (13 a day)
Morning (06:00–12:00): `r-dips` (gate dip, then house enter dipped; preTruck) · `r-controller`
(ui action `controller.read`: the controller panel open ≥ 2 s; it shows house now, min/max since the
last read, setpoint, vent timer and light program on one screen; preTruck) · `r-meter` (`water.meter`;
preTruck) · `r-walk` (days 1–7: 50 % of brooding cells seen + one listen stop) · `r-drinkers`
(`water.flowtest` × 4 lines; winch and knob as wanted) · `r-feeders` (`feed.meter` + `feed.silo`) ·
`r-dead-am` (days 1–7: state `dead-cleared`).
Afternoon (13:00–18:00): `r-dips-pm` (house dip) · `r-walk-pm` (35 %) · `r-controller-pm` ·
`r-litter` (3 × `litter.squeeze` with **Q**, 2 sectors, 1 within 1 m of a drinker line) · `r-dead-pm`.
Evening (16:00–24:00): `r-record` (sign today's record).

A listen stop (2 s standing still inside, no panel) shows the caption "You see: chicks evenly spread;
droppings firm, brown with a white cap. You hear: quiet chirping." and writes it into the notebook
beside that day's numbers (`farm.observe`, neutral words, §6.9).

### 4.4 Problem jobs (opened by a symptom, §7; titles name what was seen)
`p-brooder` *A brooder is not burning* (done `heat.relight` fixed) · `p-cold-night` *Night check: a
cold night is forecast* (20:00–24:00: `controller.read` + 30 % coverage) · `p-water-drop` *Low water
flow: find the cause* (done `water.clearFilter` fixed) · `p-leak` *Wet litter here: find what wets it*
(done `water.fixLeak` fixed) → `p-wet-patch` *Put fresh litter on the wet patch* (`litter.patch`) ·
`p-order-feed` *Order feed for the silos* (`feed.order`) · `p-warm` *The house is above its target
this afternoon* (state `house-near-target`: what the chicks feel within ±1.5 °C of the target for 30
farm min; final check, was house ≤ target + 1.5) · `p-report`
*Report the deaths to the company vet* (ui `phone.report`).

## 5. Signs and equipment plates

**All texts and sources are data in `src/content-signs.js` (committed):** `BOARDS` (7 boards:
sign-gate, sign-brooder, sign-water, sign-vent, sign-litter, sign-chicks, sign-health; 6 plates:
feeder-box, silo, controller-lights, bird-scale, water-supply, drinker), `BROODER_ROWS_L1` and
`sourceLabel()`. Props paints the 3D boards from it (title, kicker, pictogram `pic`, short lines);
ui draws the sign panels and the plate columns from it. Package "level" owns the file and may reword
texts, never move a fact to a guide that §6.1 does not list. `scripts/test-contracts.mjs` checks
that every item has a known source and no page reference.

Facts tagged with a guide (everything else in the file is `general`):

| Fact | Source | Where |
| --- | --- | --- |
| House 34 °C on day 1, falling to 20 °C by day 35 (table rows day 1 and 35 only; day 0 and rows between: general) | Week 1 guide / Broiler Ventilation | sign-brooder |
| Pre-heat so the floor reaches 28–30 °C before the chicks arrive | Week 1 guide | sign-brooder |
| Reading the chicks (huddled / along the walls, beaks open / evenly spread) | Week 1–4 guides | sign-brooder |
| What huddling, panting, droppings and breathing sounds tell you | Week 1–4 guides | sign-health |
| Flush the lines about 12 h before the chicks | Week 1 guide | sign-water, water-supply |
| Flow per nipple = age in days + 20 ml/min; nipple height sets the drinking angle, raise with the birds | Broiler Management 101 / Week 1 guide | sign-water, drinker |
| Minimum ventilation brings fresh air in, moisture and ammonia out | Broiler Ventilation | sign-vent |
| Litter at or below 30 % moisture | Broiler Ventilation | sign-vent, sign-litter |
| 5 % humidity the air can still take ≈ 1 °C of pad cooling | Broiler Ventilation | sign-vent |
| Check reflex, navel, hocks, uniformity on arrival; vent temperature 2–3 h after placing; crop check at 24 h | Week 1 guide | sign-chicks |
| 23 h of light in the brooding week | Week 1 guide | controller-lights |
| Week 1 target 4–5 × chick weight; a missed week 1 costs growth later | Week 1 guide | bird-scale |
| Disinfect at the gate (foot dip); report abnormal deaths | Broiler Management 101 | sign-gate, sign-health |

General (examples, all in the file): spray every vehicle; dip again at the house door; cup test;
"day 0 nipple at chick eye level, about 10–12 cm"; 45° / 75–85°; water : feed 1.6–2.0 L/kg; "in week 1
water per bird should rise every day; a day without a rise is the first warning: check the filter
and the lines"; water quality; min-vent table 150 / 290 / 480 m³/h per 1,000 birds at 40 / 100 /
200 g (`config.MIN_VENT_PER_1000`) and the timer formula with a worked example; squeeze test; 5–10 cm
husk; vent 39.4–40.5 °C; crops ≥ 95 % full; abnormal = > 0.3 % a day; cull weak birds; pans on the
litter days 0–3; feed per bird 14–42 g (`config.feedStdGAt`); order below 2 days of feed;
30–40 lux; weigh 50 birds from 5 places; filter gauges.

## 6. Flock simulation (package "sim")

All formulas run in `farm.step(env, s, fast)` once per ≤ 60 game seconds (also during skips) and in
`sim.js` for the climate, **only in level mode** (`farm.mode === 'level'`): in the sandbox the climate
is exactly Phase 1's. Constants marked **model** are tuning values (never shown on a sign). The
numbers below were checked by hand against each other; the "reference" values are what the formulas
give and what §6.10 tests. The engineer may tune model constants to pass §6.10 and records any change
here.

### 6.1 Guide facts the model and signs may cite
House temperature 34 °C day 1 → 20 °C day 35 (Week 1 guide / Broiler Ventilation); pre-heat floor
28–30 °C, flush lines 12 h ahead (Week 1 guide); reflex, navel, hocks, uniformity, vent temperature at
2–3 h, crop check at 24 h (Week 1 guide); week 1 weight 4–5 × chick weight and a missed week 1 costs
growth later (Week 1 guide); 23 h light in the brooding week (Week 1 guide); flow = age + 20 ml/min,
nipple angle, water-to-feed ratio, water quality (Broiler Management 101 / Week 1 guide; numbers for
ratio and quality: general); minimum ventilation per 1,000 birds and a fan timer (Broiler
Ventilation; numbers: general); litter ≤ 30 % moisture, 5 % humidity ≈ 1 °C (Broiler Ventilation);
huddling, panting, droppings, breathing sounds (Week 1–4 guides); disinfect at the gate, report
abnormal deaths (Broiler Management 101). Nothing else may carry a guide name.

### 6.2 Climate (sim.js)
- **One airflow figure** (`config.AIR`): `env.airflowM3h = 300 + (fansOn + timerFans·duty)·36,000`.
  Heat exchange toward the inlet air per hour = `AIR.wallLossPerH` (0.2425) + airflow / 40,000. This
  is Phase 1's 0.25 + 0.9 per fan exactly, so the sandbox is unchanged; humidity and ammonia use the
  same airflow.
- **Minimum ventilation timer** `setVentTimer({ fans, onSec, cycleSec })` (in code), duty d =
  on/cycle; `fansOn` shows `fans` during the on-part of each cycle (phase from the game clock) so the
  blades and the controller LED cycle; the heat and air use the mean (fans·d).
  Reference (sign): 6,000 chicks at 42 g need ≈ 930 m³/h → 1 fan, 8 s in 300 s; day 3 (≈ 85 g) ≈ 15 s;
  day 7 (≈ 200 g) ≈ 24 s.
- **Slab and floor.** `env.slabTemp`: dSlab/dt = (houseTemp + 1.0·heaterLevel − slab) / 30 h (model),
  start 23 °C (cool season). The slab is a heat sink on the house air: −0.3 /h · (houseTemp − slab)
  (model). Litter surface `env.floorTemp(x, z) = slab + k·(houseTemp + brooderHeat(x, z) − slab)`,
  k = 0.1 + 0.02·depth_cm (0.26 at 8 cm; 0.1 on bare concrete) (model).
  Reference at 08:00 day 0, cool season, 8 cm, setpoint 34 °C: pre-heat from 07:00 day −1 → floor
  30.2 °C between brooders to 31.3 °C under them (≥ 28 °C on the whole floor); from 20:00 day −1 →
  28.7–29.9 °C; from 02:00 day 0 → 27.3–28.7 °C (≥ 28 °C only under the brooders, < 50 % of the floor).
  With the slab sink the house air needs about 8 h to reach 33.5 °C at full burn.
- **Brooders out.** `env.brooderOut` (array of `HEATERS` indices, set by the farm's brooder-out
  problem): that brooder adds no radiant heat and the heat rate is × (8 − out) / 8.
- **Humidity** (absolute-humidity balance, model): water drunk splits 0.5 into the litter (droppings),
  0.4 to the air as breath, 0.1 kept by the birds. Inside humidity x_in = x_out + (breath + litter
  evaporation) g/h ÷ airflow m³/h; `houseRH` = x_in / x_sat(houseTemp), clamped 20–98 %. Reference:
  day 7 with the sign's timer ≈ 45–55 %; no minimum ventilation (300 m³/h) ≥ 90 % from day 3.
- **Weather events** `addWeatherEvent({ id, fromDay, toDay, outsideDrop })` (negative drop = rise)
  with 2 h ramps. Owned by the farm: it adds them from `LEVEL1.problems` and rebuilds them on restore
  (they are not in the env save). Cold night −6 °C day 2 19:00 → day 3 07:00 (≈ 13 °C at 04:00);
  warm afternoon +3 °C day 6 11:00 → 17:00 (≈ 32 °C at 15:00) with sun on the roof, `heatPerH` 1.5 °C/h
  into the house air (final check; the same ramps).
- **Air at the chicks** (level, final check): the tunnel fans pull the air through the pad end along
  the floor (0.42 m/s a fan at bird level, the wind chill above); the timer fans draw it in at the side
  inlets, which throw it up under the roof: 0.1 × that air speed at bird level (model). The pad cools
  only the tunnel fans' share of the air.
- **Light** `setLightProgram({ darkStart, darkHours, dimmer })` (in code); lux at birds =
  `EQUIP.luxMax`·dimmer (model). Phase 1 default (dark 02:00–03:00, dimmer 1) unchanged.
- **Cold night reference**: with the sign's timer the brooders just hold 33 °C at full burn (loss
  ≈ 6.2 °C/h against 6.5); with 2 fans 60 s / 300 s (14,700 m³/h) the house falls to ≈ 26–27 °C at
  04:00 day 3.

### 6.3 Chicks: delivery, boxes, placement, start
- Delivery (seeded): 6,000 chicks, mean 41.5 ± 1 g, **CV 8 %** (model); weak 0.8 % (open navel /
  black button, slow reflex; 35 % of them die if not culled), red hocks 4 % (model).
- **Box time** from the truck stopping to a stack's tip: hazard 0.01 %/h for 3 h, then +0.05 %/h per
  extra hour (model). Deaths in boxes show at the tip ("2 dead in these boxes").
- **Late starters** L (did not find feed and water in 24 h), share of placed chicks (model):
  `L = 0.02 + 0.06·max(0, 29 − Tfloor_at_tip) + 0.004·hours_in_box + 0.06·(1 − flooded)
     + 0.08·(1 − A_water_24h) + 0.03·[light < 20 h] + 0.03·[tips in < 3 sectors]
     + 0.01·(hours in the first 24 h with e < −2)`, clamped 0.02–0.6; the floor term is averaged
  over the tipped chicks at their tip spot.
  Reference: ideal L ≈ 0.025; late pre-heat (floor ≈ 27.6 °C) L ≈ 0.11.
- **Crop fill at 24 h** (true) = 1 − L − 0.5·weak share. Ideal ≈ 97 %, late pre-heat ≈ 88 %.
- **Culls**: `chicks.cull { n, reason }` removes n birds: weak chicks culled at the table or sick
  birds culled on the floor are taken out of the future deaths of their cohort (deaths move to culls).

### 6.4 Water (farm.water)
- Flow per nipple `f = (2·pressureCm + 4) · filterFactor` ml/min (model: 8 cm ≈ 20 ml/min;
  `filterFactor` 0.5 while the main filter is clogged).
- Need = `flowTargetAt(a)` (a = flock age). Line access `a_i = clamp(f / need, 0, 1)^0.6 · hf`, height
  factor from Δ = height − `nippleHeightCmAt(a)`: too high (Δ > 0) hf = clamp(1 − 0.12·Δ, 0.05, 1);
  too low hf = clamp(1 − 0.03·|Δ|, 0.7, 1) (model). Flock water access `A = 0.75·mean(a_i) +
  0.25·max(a_i)` (model). Clogged filter, lines set by the sign: A ≈ 0.66, intake × 0.72.
- Spill (to the litter under the line): 2 % of drunk + 15 % of flow above 1.25 × need + 2 % per cm
  too low (model). The leak puts 0.6 L/h into its cell (model).
- **Flush**: a line's `flushClear` rises 0 → 1 over 10 game min while its valve is open; 40 L per line
  through the meter (model). Water quality q = 1 if all lines ran clear within 24 h before the truck,
  else 0.85 (biofilm, model). `stats.flushDoneAt` = when the last line ran clear.
- **Meter** = drunk + spill + leak + flush. Drunk = FI × r, r = 1.75 + 0.03·max(0, houseTemp − 30)
  L/kg (model; ≈ 1.8–1.9, inside the sign's 1.6–2.0). The meter panel shows the odometer, the 24 h
  litres, **litres per 1,000 birds** and the **change against yesterday's 24 h** (plain numbers).
  Reference ideal: +15–25 % a day; day 4 reading (filter clogged since 10:00 day 3): about −10 %.
- **Filter gauges** (`water.filter`): in 2.5 bar, out 2.5 × filterFactor bar (± 0.05).

### 6.5 Feed, intake, growth, uniformity (farm.flock)
- Standard intake `feedStdGAt(a)` = 12 + 4a g/bird/day (general; the feeder plate shows 14, 18, …,
  42 g for days 0–7), eaten over the lit hours.
- Factors (model): **temperature** with e = felt temperature at the 70th-percentile-warmest point of
  the brooding floor − target: e < −1.5 → f_T = 1 − 0.12·(−1.5 − e); mean felt − target > 1.5 →
  f_T = 1 − 0.08·(over − 1.5); clamp 0.2–1. **Light**: f_L = 0.9 if lux < 20, × (1 − 0.04·(dark h − 1)).
  **Feed**: f_F = mean pan fill × (0.9 if not flooded on days 0–3) × (1 − 0.1·cm the rim sits above
  `feederRimCmAt(a)`). **Water**: f_W = A^0.8. **Air**: f_air = 1 − 0.01·max(0, NH3 − 20).
  FI = FI_std · f_T · f_L · f_F · f_W · f_air · cohort factor.
- **Gain** = FI ÷ feed-per-gain, FPG(a) = 0.97 + 0.03a (model), × (1 − 0.04·cold deficit °C).
  **No gain cap.**
- **Cohorts**: good (1 − L − weak), late (L: intake × 0.55 for a < 3, × 0.8 after), weak (× 0.6).
  Each has n, mean weight, CV. Within-cohort CV grows per day by 0.001 + 0.01·(1 − f_T) + 0.02·(1 − A)
  + 0.015·(1 − f_F) (model). Flock mean, CV and **uniformity** (share within ±10 % of the mean) come
  from the mixture of normals; `weightQuantile(u)` from the same mixture.
- Reference (weighed mean ÷ chick weight at 09:00 day 7, a = 7.04): all factors 1 → ≈ 4.95; ideal
  (factors ≈ 0.97, the clogged filter for one night) ≈ 4.75–4.8, FCR ≈ 0.87, uniformity ≈ 73–76 %;
  small mistakes ≈ 4.3–4.5; late pre-heat ≈ 4.6–4.7, uniformity ≈ 64 %; filter never found ≈ 4.1–4.2;
  no feed order (pans empty about 10 h before the weigh-in) ≈ 4.4; neglect ≈ 3.3–3.8.
- **Silo**: starts at `LEVEL1.siloStartKg` = 1,100 kg (model). Feed leaves the silo as the pans empty;
  `meterKg` counts it; flooding the pans on the prep day takes ≈ 200 kg. Empty silo → pans drain in
  ≈ 7 h (flood off), then f_F → 0. `feed.order { kg }` before 16:00 arrives the next day 09:00 (truck,
  `EV.FARM_DELIVERY { kind: 'feed' }`), later orders the day after. Reference: ≈ 450 kg on the day 4
  morning (above 2 days ≈ 355 kg), ≈ 280 kg on the day 5 morning (below 2 days ≈ 400 kg); without an
  order the silo is empty about day 6 16:00 and the pans about 23:00.
- **FCR** (record) = cumulative feed ÷ (alive × mean weight) (general definition).

### 6.6 Mortality (farm.flock.deadByCause)
Expected deaths per game minute, fractional accumulators per cause (seeded jitter);
`EV.FARM_DEATH { n, cause }` each time one passes 1. All rates model:
- weak cohort: 0.6 %/h a < 2, 0.25 %/h a 2–4, 0.05 %/h after (≈ 35 % of weak chicks die);
- starve-out (late cohort): 0.1 %/h for a 2–6 (≈ 10 % of them);
- cold: e < −4 → 0.02 %/h × (−4 − e)² of the flock; heat: mean felt − target > 4 → 0.03 %/h × (over − 4)²;
- dehydration: A < 0.5 → 0.05 %/h × (0.5 − A) / 0.5;
- other: 0.001 %/h from day 3, × (1 + 0.3 per biosecurity lapse), × 1.5 if q < 1; box: §6.3.
Reference: ideal ≈ 0.6–0.7 % by day 7; late pre-heat ≈ 1.4 %.
**Dead birds**: every death adds 1 to `farm.flock.deadOnFloor` (one drawn dead bird = one real bird;
the farm is the only owner; `EV.DEAD_PICK` subtracts). `flock.sick` = expected deaths of the next 12 h,
drawn 1:1 as sick birds (up to 24).

### 6.7 Litter, moisture, ammonia (farm.litter, FLOOR_GRID 48 × 12 cells of 1 m²)
- Dry mass per cell = depth_cm × 1 kg (husk ≈ 100 kg/m³); fresh husk 12 % moisture. Bare cells hold
  no litter (water stands on the concrete: the cell reads 60 %).
- Water in per cell: 0.5 of water drunk spread over the brooding cells (× 1.5 under the drinker lines),
  plus spill along each line, plus the leak. Moisture % = water ÷ (dry + water).
- Drying, kg/h per cell = 0.034 · dry kg · (m − 12)/100 · (1 − RH/100) / 0.5 (model); it also adds
  vapour to the humidity balance.
- Caking: a cell above 40 % for 6 h is caked (darker, lumpy; squeeze reads "wet and caked").
  Reference: ideal mean 18–24 %; no minimum ventilation ≥ 30 % by day 6; the leak cell reaches 35 %
  ≈ 4.5 h after it starts, 40 % ≈ 6 h, cakes ≈ 12 h, ≥ 45 % after 24 h.
- **Ammonia** ppm = 0.2 · cumulative feed kg · (0.4 + mean m / 20) / √airflow (model). Reference:
  ideal day 7 ≈ 6–7 ppm; no minimum ventilation day 6 ≈ 24–28 ppm.

### 6.8 Readings and samples (what the instruments show)
`floor.probe` floorTemp ± 0.2 °C · `sample.vent` 40.0 + 0.30·(felt at the bird − target) ± 0.25,
clamped 37.5–42 · `sample.crop` full-soft with p = crop fill; else hard (water was the limit), soft-
watery (feed was), or empty · `sample.grade` a chick of the true delivery (weak: navel open/black
button 60 %, reflex > 3 s 70 %; others healed 97 %, reflex 0.8–2.5 s; red hocks 4 %) · `sample.box`
100 chicks + 0.35 kg box (sets `stats.chickWeightMeasuredG` = net ÷ 100, `stats.boxWeighedAt`) ·
`sample.weigh` a bird of its cohort ± 1 g · `water.flowtest` ± 0.5 ml · `water.meter` integer litres ·
`feed.meter` integer kg · `feed.silo` ± 2 %, to 10 kg · `litter.squeeze` cell ± 1 % with the feel
(< 25 'dry', 25–30 'holds, then breaks', 30–38 'sticks', > 38 'wet', caked 'wet and caked') ·
`light.lux` ± 2.

### 6.9 What the flock shows and the farmer notes
`farm.flock.droppings` ('normal' | 'watery' (heat, high water:feed) | 'few' (low intake)).
`farm.observe(x, z)` → `{ spread, droppings, sounds }` in neutral words from the model at that spot:
spread from e there ('huddled under the brooder' e < −2, 'along the walls, beaks open' over > 2,
'evenly spread'), droppings from the state above, sounds ('quiet chirping', 'loud peeping' when > 10 %
of birds are cold, hungry or thirsty, 'snicking' at NH3 > 15). The flock package reads the same model
for its animation and `flock.sounds()`.

### 6.10 Acceptance (sim) — `node scripts/test-sim.mjs`
The expected numbers are **already in `scripts/test-sim.mjs` as `PROFILE_TARGETS`** (the acceptance
tests are skipped while `farm.stub` is true). Profiles are scripted by `src/farm-profiles.js`
(`applyRound`, `runProfile`, `checkProfile`; §14.1) through `farm.act` and the env setters with
`env.skipHours`, seed 1, cool season, weigh-in at 09:00 day 7.

| Profile | Management | Expect |
| --- | --- | --- |
| **ideal** | setpoint by the sign from 07:00 day −1 (34 °C; then the table each morning); 8 cm litter; flush 20:00; flows and heights by the sign every morning; flood days 0–3, rim by `feederRimCmAt` after; 23 h light, dimmer 0.6; timer by the sign (1 fan) each morning; tipped in 6 sectors within 40 min, box weighed first; vent and crop checks; each problem found and fixed on the first round after its symptom (brooder 06:30 day 1; night check; filter at the day 4 morning flow test; leak 15:00 day 4 and patched; feed ordered day 5 morning; day 6 timer 2 fans 120 s / 300 s 12:00–17:00, then the sign's timer) | ratio 4.6–4.95; uniformity 70–80 %; deaths + culls 0.4–0.9 %; FCR 0.83–0.92; mean litter ≤ 28 %; NH3 day 7 3–9 ppm; crop fill ≥ 95 %; floor ≥ 28 °C on ≥ 90 % at the first tip; meter change +5..+60 % every day except day 4 (−20..−4 %); skills Brooding level 2 and Water level 2 |
| **small mistakes** | ideal but pressure left at 6 cm (16 ml/min) all week, nipples raised only on day 3, setpoint 1 °C under the sign, filter found at the day 4 afternoon | ratio 4.2–4.5, passes |
| **late pre-heat** | ideal but the setpoint set at 02:00 day 0 | floor ≥ 28 °C on < 50 %; crop fill 85–93 %; ratio 4.45–4.75; uniformity ≥ 5 points under ideal; deaths 1.0–1.7 %; passes |
| **no flush** | ideal without the flush | q = 0.85; deaths 0.05–0.3 points over ideal |
| **neglect** | pre-heat 4 h; no flood; pressure 4 cm; nipples never raised; no timer; filter never found; no feed order | fails (ratio < 4.0 and/or deaths + culls > 2 %) |
| **cold night, wide timer** | ideal but timer 2 fans 60 s / 300 s from day 2 | house 20–28 °C at 04:00 day 3; cold deaths 3–30; uniformity ≥ 2 points under ideal |
| **no min vent** | ideal but no timer all week | RH ≥ 85 % from day 4; mean litter 30–60 % on day 6; NH3 20–60 ppm on day 6 |
| **leak unfixed 24 h** | ideal but the leak left 24 h | leak cell 45–70 % and caked |
| **filter never found** | ideal but the filter never cleaned | ratio 3.95–4.35; day 4 meter change −20..−4 %; no dehydration deaths |
| **no feed order** | ideal but no order | pans empty between day 6 16:00 and day 7 04:00; ratio 4.2–4.6 |
| **brooder never relit** | ideal but brooder 5 stays out | comfort share ≥ 2 points under ideal |
| **determinism** | ideal twice, seed 7 | identical records (byte for byte) |

### 6.11 Model tunings made by package "sim" (recorded at integration)
The constants live in `src/farm-*.js` (`FLOCK`, `WATER`, `FEED`, `LITTER`) and `src/sim.js`; all are
**model** values (never on a sign). Where they differ from §6.2–§6.7 above, the code wins:
- **Uniformity** (`FLOCK`): within-cohort CV grows per day by 0.0002 + 0.04·(1 − f_T) + 0.01·(1 − A)
  + 0.015·(1 − f_F) (spec: 0.001 / 0.01 / 0.02 / 0.015). Weak cohort: 0.92 × the mean chick weight,
  CV 10 %.
- **Water access** (`WATER`): a_i = min(1, (f / need) / 0.75)^0.88 · hf (spec: clamp(f / need)^0.6 · hf).
  Leak 0.5 L/h (spec 0.6). A flushed line puts 28 L through the meter (spec 40 L).
- **Feed** (`FEED`): one line's pans hold 18 kg normal, 66 kg flooded (three flooded lines ≈ 200 kg);
  auger 150 kg/h a line; the birds eat freely down to 30 % pan fill. Pans start winched up at 40 cm,
  drinker lines at 50 cm and 10 cm pressure.
- **Litter** (`LITTER`): dry husk 0.8 kg per cm per m² cell (≈ 80 kg/m³; spec 1 kg); drying rate
  0.045 (spec 0.034). The humidity balance and litter drying are solved together each climate step
  (`env.dryPotentialGh`), so RH and drying always agree.
- **Comfort e** (`farm-comfort.js`): the felt temperature at the point 70 % of the brooding floor is
  at least as warm as (the 0.3 quantile from the cold end), with the floor split into eight chick
  groups, one per brooder; read from the warm end a brooder that is out would look comfortable.
- **Brooder out** (`sim.js OUT_AIR`): besides losing its radiant, the air around an out brooder is
  up to 3 °C × output cooler (Gaussian, σ 2.5 m; the house mean is kept), so its chicks huddle.
- **Deaths** (`FLOCK`): cold 0.04 %/h × (−4 − e)² (spec 0.02); "other" × 2.0 when q < 1 (spec 1.5).
All §6.10 profiles pass with these values (`node scripts/test-sim.mjs`).

**Review round 2 (the mistakes must show in the records).** The code wins over §6.2–§6.7 here too:
- **Box time** runs while chicks wait: `stepBoxes` applies max(0.01 %/h, 0.05 %/h × (h − 3)) per hour
  to the chicks still in each stack; they are counted dead at once (`deadTotal`, `boxDead`) and shown
  at the tip ("n dead in these boxes"). Chicks never taken out die in the boxes (the level fails on
  deaths at the day 0 or day 1 close).
- **Late starters** get a feed-reach term: L += 0.4 × (1 − mean pan reach over the first 24 h), reach =
  pan fill × rim factor (`feed.reach`, no flood factor). Pans left winched up: crop fill ≈ 57 %.
- **Starvation**: hours with f_F < 0.3 (or the pans giving < 30 % of what the birds want) count up
  (`flock.hungryH`, down 2× as fast when fed); after 48 h the flock dies at up to 0.4 %/h (ramp 24 h),
  cause 'starveout', late starters first.
- **Temperature per chick group** (`farm-comfort` `eG`, one group per brooder, weighted by floor): the
  cold side of f_T, the cold gain penalty, cold deaths and the first-24 h cold hours are per group;
  CV growth adds 0.08 × the spread (sd) of the group factors. Comfort minutes = share of the chicks
  whose group e is within −1.5..+2 °C (`groupShare`). The air round an out brooder: 6 °C × output
  (`sim.js OUT_AIR`, was 3).
- **Litter on the chicks**: a cell over 35 % moisture feels 0.1 °C colder per % over 30; litter under
  5 cm feels 0.4 °C colder per missing cm, fading out by age 10. Caked floor adds 0.03 × caked share to
  the CV growth per day; f_air = 1 − 0.015 × (NH3 − 12 ppm), ≥ 0.5, and adds 0.05 × (1 − f_air).
- **Over-flow**: spill = drunk × (0.02 + 0.7 × (f / need − 1.25)⁺ + 0.02 per cm too low); on days 0–3
  a nipple jetting more than 1.5 × need wets the chicks: a_i × clamp(1 − 0.5 × (f / need − 1.5), 0.5, 1).
- **Warm afternoon** (final check, replaces round 2's +7 °C and tunnel fans): outside +3 °C and the sun
  on the roof (1.5 °C/h), so the closed house runs over its target and more air through it cools it;
  timer fans give 0.1 × the tunnel air speed at the chicks. The ideal profile gives the timer 2 fans,
  120 s / 300 s from 12:00 and the sign's timer again at 17:00 (`WARM_TIMER`); `warmTunnel` (two tunnel
  fans 12:00–17:00) keeps e ≈ −2.0..−2.5 all afternoon (the brooders burn under the fans; look notes
  "huddled under the brooder", "loud peeping"). `observe` says huddled from e < −1.5, as the drawn
  birds pile up. Ideal ratio 4.79 (seed 1), so the `latePreheat` ratio band is 4.45–4.8 (was 4.75).
  `pantShare` counts cells over target + 2 when
  e > 1.5 (or half of them when the mean is over 1.5). Round 2: the ideal profile ran two tunnel fans
  12:00–17:00 (one fan with the hotter air leaves the chicks panting).
- New profiles and targets in `PROFILE_TARGETS`: `pressure20` (≥ 0.12 under the ideal ratio, litter
  under the lines 35–70 % on day 6), `pansUp` (crop fill < 85 %, deaths ≥ 2 %, fails), `neverPlaced`
  (deaths ≥ 2 %, fails, no low-mortality / steady-heat / crop / weight points), `litter2cm` (comfort
  share ≥ 5 points and uniformity ≥ 5 points under the ideal, no steady-heat), `warmNoAction` (was `warmNoFan`; house
  2–6 °C over target and ≥ 20 % panting at 15:00 day 6); `noMinVent` now also ≥ 0.15 under the ideal
  ratio and ≥ 3 points of uniformity; `brooderNeverRelit` ≥ 3 points of uniformity, ≥ 0.02 ratio and
  4 points of comfort share under the ideal, no steady-heat. Seeds 1–3 pass.

Also (contract tests, written): action payload shape, award deltas, farm owns `deadOnFloor`, flock
age 7.0 at 08:00 day 7, save info day from `env.day`. Package checks: sandbox unchanged (with
`farm.mode === 'off'` the cold-hot metrics match Phase 1 within ±0.02); `farm.step` ≤ 0.3 ms in node, a
24 h skip ≤ 150 ms; save blob < 60 KB, restore → serialize identical; rows hold null for every reading
not taken.

## 7. Problem events

Scheduled in `LEVEL1.problems` (same days on every replay so the farmer can compare weeks; open
question 4). The farm starts them silently (`farm.problems[i].phase` pending → active). **Only the farm
decides that a symptom was met**, from three inputs: an `EV.ACTION` it sees (its own `farm.act` results
and ui actions like `radio.listen`), an `EV.NEAR { problemId }` that props emits after the farmer dwelled
in one of `farm.problemZones()`, and its own state. It then sets phase 'found', `foundAt`, `foundBy`
and emits `EV.FARM_PROBLEM { id, phase: 'symptom' }` once; the job engine opens the problem job. A fix
emits `{ phase: 'fixed' }`. Reading a gauge alone never opens a job unless that reading *is* the
investigation (a flow test that shows a low line); the meter shows the drop, and the farmer has to look
for the cause.

| Problem | Starts | What changes | Symptom (who detects) | Fix | Milestone |
| --- | --- | --- | --- | --- | --- |
| `brooder-out` | day 1 05:00 | brooder 5 (x −7, z 2.6) out: no radiant heat, heat rate × 7/8; chicks under it huddle | zone r 2.5 m, dwell 2 s (props `EV.NEAR`); props draws it unlit | E at it (props fixed `brooder-5`): *Relight* → `heat.relight { index }` | brooder-relit by 12:00 day 1 |
| `cold-night` | day 2 19:00 → day 3 07:00 | outside −6 °C | `radio.listen` (ui, office desk) on day 2: forecast "Tonight: low 13 °C" (`farm.forecast(2)`); or `controller.read` 20:00–24:00 day 2 with house < target − 1 | keep heat: timer by the sign, setpoint by the table | — |
| `blocked-filter` | day 3 10:00 | main filter at the water supply: every line's flow × 0.5 (`filterFactor`); intake × 0.72 | `water.flowtest` result < 0.8 × (day + 20) while active; `water.filter` with out < 0.8 × in | water supply panel: *Clean the filter* (a 5-game-minute bar in the panel, then `water.clearFilter` → `{ fixed: true }`) | drop-spotted if found by 12:00 day 4 |
| `leaking-nipple` | day 4 10:00 | line 3 nipple at x −9.15 drips 0.6 L/h into its cell | zone r 1.5 m, dwell 2 s, `minMoisture` 35 (props `EV.NEAR`); `litter.squeeze` within 2 m reading ≥ 35 % | E at the drip (props `leak`): *Replace the nipple* → `water.fixLeak`; then a husk sack on the patch → `litter.patch` (cell to 15 %, caking gone) | leak-fixed if replaced before the cell caked |
| `low-silo` | from day 4 06:00 (no event: the silo runs down from 1,100 kg) | — | `feed.silo` reading < 2 × today's need (6,000 × `feedStdGAt`) | office phone: *Order feed* kg → `feed.order` | — |
| `warm-afternoon` | day 6 11:00 → 17:00 | outside +3 °C (≈ 32 °C at 15:00) and sun on the roof 1.5 °C/h (final check; round 2 had +7 °C) | `controller.read` with house ≥ target + 2; a listen stop while > 20 % of birds pant | a change to the air or the heat (`vent.timer` / `heat.setpoint` / `vent.fans` / `vent.pad` after the job opened) **and** what the chicks feel (`feltNearTarget`: comfort e at chick level, wind chill included) within −1.5..+1.5 °C of the target for 30 min. Sign: brooders off by their thermostat, more timer fan time (2 fans 120 s / 300 s found at 14:00 → near target ≈ 14:50); tunnel fans chill the chicks below the band, so the job stays open while they run; with no action the problem ends 'weather' and the job stays open | — |
| `abnormal-deaths` | conditional | — | dead birds counted at the bin in one day > 0.3 % of placed | office phone: *Report to the company vet* (`phone.report`) | — |

`farm.problemZones()` → `[{ problemId, x, z, r, dwellSec, minMoisture? }]`, only for active,
not-yet-found problems. `farm.forecast(day)` → `{ day, lowC, highC, text }` (normal nights ≈ 19 °C;
day 2: 13 °C; day 5: "tomorrow afternoon hot, up to 33 °C"). Biosecurity lapses (`house:enter
{ dipped: false }`) are counted by the farm (§6.6 "other") and listed as plain facts in the day's row.

## 8. Flock records (office desk, `office-desk` panel)

A ledger book drawn on the panel, tabs: **Today** · **Week** · **Graphs** (unlock) · **Phone**. The
radio (forecast line, `radio.listen`) sits on top of *Today*. The notebook (N) shows the same readings.

**Today** lists what the farmer measured today, from the notebook, in job order: meter (litres, per
1,000 birds, change), feeder meter and silo, flow per line, nipple heights, filter gauges if read,
floor and vent temperatures, crop tally, litter squeezes, dead birds counted, controller min/max,
light program and vent timer as read, and his **look notes** (spread, droppings, sounds). A reading
not taken shows "—  not read". *Sign today's record* closes the row: the ui calls `records.sign(day)`,
records emits `EV.RECORD_CLOSED { day, row, signed: true }`, and that event completes the record job.
Nothing is coloured as good or bad.

**Week** (one row per day −1..7; the prep day row only lists the prep checks):

| Column | From | Note |
| --- | --- | --- |
| Alive | placed − counted deaths − culls | what the farmer knows |
| Deaths (culls) | bin counts and culls that day | causes not shown |
| Mortality % | cumulative counted + culls ÷ placed | |
| Feed kg, g/bird | feed meter, this morning − yesterday morning | "24 h to this morning" |
| Water L, L per 1,000 birds, change % | water meter, same 24 h | change vs the row before |
| Water : feed | water L ÷ feed kg | |
| Weight g | automatic bird scale (platform in the brooding area; reads +2 % ± 3 %, model); day 7 the hand weighing | source shown: scale / weighed |
| Target g | `weightAt(day)` | general |
| × chick weight | weight ÷ measured chick weight (box weighing; else the delivery note) | Week 1 guide target 4–5 × in the day 7 header |
| Uniformity % | day 7 weighing only | |
| FCR | cumulative feed ÷ (alive × weight) | general definition |
| Litter % | mean of today's squeezes | |
| House min / max, target | controller memory, if read that day | |
| Light h | light program as read | |
| Notes | chick-quality note (day 0, his own sheet), problems found / fixed, deliveries, feed ordered, jobs not done, dips missed, skill lines ("Skill points: Water +2, lines flushed 13 h before the chicks") | plain facts |

**Graphs** (unlock `waterTrend`): litres per 1,000 birds and water : feed by day. `brooderChart`
lives on the controller; `lineOverview` on the water supply panel.

## 9. Skill tree

Screen (K or the card button; pauses the clock): eleven branch cards in a 4-4-3 grid, each a low-poly
SVG badge, the name, three level pips and what each level unlocks. The two earnable branches show a
point bar (`SKILL_LEVEL_POINTS` 4 / 9 / 15) and their milestones: the result in the farmer's words,
its points, and once earned the measured value ("4.8 × chick weight"). The other nine read "Comes in a
later level" (names to confirm, open question 1).

**Who evaluates**: `skills.js` subscribes to the bus itself (in the stub already): `EV.LEVEL { phase:
'checkpoint', name }` (level emits 'placed' at the last tip, 'vent' and 'crop' when their windows
close, 'weighin' when the 50th bird is weighed or the window ends, 'level-end'), `EV.FARM_PROBLEM`
found/fixed → 'problem', `EV.RECORD_CLOSED` → 'day'. It reads `farm.stats` (§13.4), `farm.problems`
and the records. `award()` emits `EV.SKILL_POINTS` with the **delta** of points.

Milestones (`MILESTONES` in `src/skills.js`, rules there): **Brooding** (max 14) — floor-ready 2
(floor ≥ 28 °C on ≥ 90 % at the first tip), chick-weight 1 (box weighed before the first tip),
placed-fast 1 (last tip ≤ 90 game min after the truck), vent-checked 1 (≥ 5 readings in the vent
window, 3 sectors), crop-fill 1 / 2 (true fill ≥ 85 % / ≥ 95 %), brooder-relit 1 (by 12:00 day 1),
steady-heat 2 (the chicks' group e within −1.5..+2 °C for ≥ 95 % of the chick-minutes, ages 0–7;
review round 2, was 85 % of the minutes of the flock e), day7-weight 1 / 3 (≥ 4.0 / ≥ 4.5 ×),
low-mortality 1 (≤ 1.0 %, only for a week that was lived: chicks placed and flock age ≥ 7.0). **Water** (max 11) — flushed-on-time 2 (last line clear 6–18 h
before the truck; the job window 16:00–02:00 lies inside it), nipples-day0 1 (within 2 cm of 11 cm
at the first tip), flow-matched 2 (morning flows within 3 ml/min of day + 20 on ≥ 6 days), drop-
spotted 2, leak-fixed 1, meter-daily 1, raised-with-flock 1 (within 3 cm of 17 cm at the weigh-in),
ratio-steady 1 (1.6–2.2 on ≥ 5 of days 1–7). A milestone is kept per profile; a replay can only
raise it. The grading sheet is never scored.

Unlocks (`UNLOCKS`): Brooding 1 → **floor thermometer view** (F: colour band map of the litter
temperature, continuous blue-to-orange with a °C legend, no good/bad colours); Brooding 2 →
**24-hour temperature chart** on the controller; Water 1 → **water meter trend graph**; Water 2 →
**all-lines overview** on the water supply panel. Points show as a line in the day's record and on the
result screen; the Skill tree button gets a dot. No pop-up praise.

## 10. Level end and fail rules

- The level ends when the **day 7 record is signed** after the weigh-in, or at day 8 06:00 by itself
  (then the bird-scale weight is used and the result says "not weighed by hand"). That weight is the
  automatic scale **at the weigh-in age** (08:00 day 7 = age 7.0, `farm.stats.scaleAtWeighInG`, mean ×
  1.02), never the flock at the moment the level ends (review round 2).
- After the end, *Keep walking the farm* runs the clock to 23:59 on day 7 and stops there (the farm
  stops with it).
- **Pass**: day 7 mean ≥ `LEVEL1.fail.weightRatioMin` (4.0) × chick weight **and** deaths + culls
  ≤ `LEVEL1.fail.mortalityMaxPct` (2.0 %) of chicks placed (true counts). Chick weight =
  `farm.stats.chickWeightMeasuredG` (box gross − box, ÷ 100, as measured), or the delivery note (true
  mean) if he did not weigh the box. A typed value is never used.
- **Fail early**: at any day's close, if deaths + culls already exceed 2.0 %, the result screen opens.
- **Result screen**: four numbers large — day 7 weight "× chick weight" with the band 4–5 × (Week 1
  guide), deaths %, uniformity %, FCR — each only when it was measured (final check): no day 7 weight
  before the weigh-in age (an early end shows an *Ended early* card with what ended the level),
  uniformity only from a hand weighing of 10 birds or more, FCR only once chicks were placed; the week table (§8); **"Your week"** (`records.timeline()`): per
  day the setpoint against the sign's table, flow per line against day + 20, nipple heights, vent
  timer against the sign's air need, light hours, floor at arrival, crop tally, all as plain numbers
  side by side; the points earned; then **"Level 1 complete"** (*Keep walking the farm* stays on day 7)
  or **"Level 1 not passed: <the measurement>. Replay the brooding week."** ("day 7 weight 3.8 × chick
  weight", "deaths reached 2.4 % on day 5"). Buttons: *Replay Level 1* · *Skill tree* · *Back to the
  title*.

## 11. Autosave

`src/save.js` (complete): `createSaveStore()` over `SAVE.key` and `SAVE.profileKey`, every access in
try/catch; a save of another version is ignored; `info()` gives `{ day, hour }` with the calendar day
from `env.day`.
- **What**: `level.saveBlob()` (in the stub) = `{ level: level.serialize(), env: { day, hour, weather,
  houseTemp, slabTemp, heaterSetpoint, heaterLevel, fansOn, padOn, ventTimer, lightProgram }, farm:
  farm.serialize(), records: records.serialize(), props: props.serialize(), flock: flock.serialize(),
  player: { x, z, yaw } }`. Weather events are **not** saved: the farm rebuilds them from its problems.
  Grids as integer arrays (moisture × 10). Target < 60 KB. Skills live in the profile.
- **When** (level mode): 2 s after a job is done, at each record signing, every 2 game hours, after a
  skip, on `visibilitychange` (hidden) and `pagehide`. The artifact hot reload passes the same blob
  (main.js: `levelSave: level.saveBlob()`), and `level.resume(blob)` takes it.
- **Restore order**: env → farm (rebuilds weather events) → records → props → flock (alive birds from
  the counts and sizes, dead birds where they lay) → level (jobs, anchors).
- *Start Level 1* with a save asks by a second press ("Start again — replaces your day 3 save").
- Storage blocked: the game plays the same; the title card says "Saving is off in this browser".
- **Measured at integration** (`scripts/p2-level1.json`, real play, just before the day 7 signing, the
  largest point of the week): 64.3 KB (records 34.0, level 18.1, farm 11.5, flock and props < 1);
  under 60 KB through day 6. localStorage holds megabytes, so this only matters as a budget.
- **Review round 2**: the job log is saved as `[key, day]` (its results were never read): the day 7
  save at 15:00 is 53.0 KB in node (records 25.8, level 15.0, farm 11.7). The env part carries
  `houseRH`; a carried chick is never saved.

## 12. New 3D content

All procedural, flat-shaded, merged where repeated, no external files. In sandbox mode
(`farm.mode === 'off'`) everything looks exactly as in Phase 1.

### 12.1 Package "props"
1. **Floor states**: concrete ↔ husk by `farm.litter.coverGrid` (DataTexture, 2 texels per cell);
   wet cells darker from `moistureGrid` (> 30 % damp, > 38 % wet sheen, caked darker and lumpy);
   rewritten at most 2× a second, only when the grids changed.
2. **Litter heap** (shrinks with cover), **wheelbarrow** (`startCarry('barrow')`, swath paints the floor
   with `farm.act('litter.spread', { x, z, r, quiet: true })`), **husk sack** (`startCarry('sack')`).
3. **Level look of the house**: drinker lines and pans at the farm's heights (`farm.water.lines[i].
   heightCm`, `farm.feed.lines[i].heightCm`) instead of Phase 1's tables; sight tubes by `flushClear`;
   pans by `panFill` (flooded = heaped); lights by `env.lightLevel`; a brooder in `env.brooderOut`
   unlit (no glow, no flame).
4. **Chick truck** drives from the gate along `FARM.road` to `SPOTS2.truckStop` (≈ 8 s real), doors
   open, leaves after the last stack; the same truck with a blower pipe brings feed to the silos.
5. **Chick boxes**: 6 stacks × 10 at `SPOTS2.boxStacks` (`box-stack-0..5`: `startCarry('boxes',
   { stack })`, `EV.BOX_PICK`); the `tip` provider tips them (`farm.act('chicks.tip', { stack, chicks, x,
   z })`, `EV.BOX_TIP`, tip animation, empty boxes to a pile by the door), only inside `BROOD_BOUNDS`.
6. **Chick sample table** (`chick-table`) with an open box of 10 small chick models and a box scale.
7. **Hand scale and catching frame** at `SPOTS2.birdScale`; the frame (1 × 1 m wire pen) is set by the
   `frame` provider (§13.6); automatic bird scale platform beside it.
8. **Water supply** (`water-supply`): readable meter dial, a filter housing with two pressure gauges,
   four flush valves (handles turn), spouts at the east ends while flushing. Regulators `drinker-0..3`.
9. **Leak**: drip particles and the growing wet patch (`leak` interactable while it exists).
10. **Feeder control box** (`feeder-box`), **silo gauge** (`silo`, level strip from `siloKg`).
11. **Sign boards** `sign-water`, `sign-vent`, `sign-litter` (north wall at `SPOTS2`), `sign-chicks`,
    `sign-health` (outside the south wall), painted from `content-signs.js` BOARDS; orange "facts" tab
    while highlighted.
12. **Dead bird bin** (`dead-bin`, use with the bucket: `farm.act('dead.count', { n, causes })`,
    `EV.DEAD_DROP`, `drop()`); bucket in the farmer's hand while carrying.
13. **Office desk** (`office-desk`): porch table with the record book, a phone and a small radio.
14. **Floor thermometer view** (unlock, F): a plane 3 cm over the brooding floor, 96 × 24 DataTexture
    from `farm.floorTempAt`, continuous blue (≤ 24 °C) → orange (≥ 36 °C).
15. **Triggers** (`props-triggers.js`): foot dips (`EV.FOOTDIP`), house enter / exit (`dipped` = house
    dip crossed in the last 10 s), `EV.CELL` on each new floor cell inside, `EV.LISTEN` after 2 s
    standing still inside with no panel open (once per stop), `EV.NEAR` for `farm.problemZones()`.
16. **Farmer**: `player.carry(kind)` meshes (barrow, sack, boxes, bucket, frame + scale, chick) —
    called only by `props.startCarry` / `drop` — and `player.pose('crouch' | 'reach')` short poses.
17. **Droppings** (optional): sparse decals; 'watery' adds a sheen.

### 12.2 Package "flock"
1. **Empty house** before placement; **spilling chicks** on `EV.FARM_PLACED` (`placeBatch`: the
   stack's birds appear within 1 m over 2 s and walk out toward feed, water and warmth).
2. **Population**: drawn live birds = round(`farm.flock.alive` / `BIRDS_PER_INSTANCE`). **Dead birds
   1:1**: one drawn dead bird per real dead bird (InstancedMesh, up to 160; more wait in a queue),
   laid by cause on `EV.FARM_DEATH`: cold → at the edge of piles; weak / starve-out → alone, away from
   feed; dehydration → near the worst line; heat → along the walls; other → anywhere. `flock.dead.count`
   mirrors `farm.flock.deadOnFloor`.
3. **Uniformity**: each bird keeps a quantile u; size = cbrt(`weightQuantile(u)` / mean).
4. **Sick and lame birds**: `farm.flock.sick` birds (1:1, up to 24) sit apart, fluffed, eyes closed,
   rarely eat; a few limp.
5. **Access behaviour**: birds weight nipples by line access (clogged filter: crowding and repeated
   pecking at every line); empty pans: pecking, restless walking; cells > 40 % avoided; lux < 20 → less
   walking; a cold brooder: chicks under it huddle; dark period → resting.
6. **Catching**, **dead pick-up**, **sick birds**: providers and hand-offs in §13.3 / §13.6.
7. **Sounds** (`flock.sounds()`): distress, contented, snick (§6.9).

## 13. Contracts between packages (in code now)

Shared, integrator-owned and **frozen** for the packages: `src/config.js` (Phase 2 constants after the
banner), `src/events.js` (bus, `EV`, `matchPayload`), `src/interact.js` (registry and its priority
rule), `src/main.js` (wiring: `ctx.events`, `ctx.farm`, `ctx.records`, `ctx.skills`, `ctx.interact`,
`ctx.props`, `ctx.colliders`, `ctx.player`, `ctx.flock`, `ctx.level`; step order env → player → world
→ house → props → flock → ui → level), `build.mjs`, `scripts/shoot.mjs`, `scripts/test-contracts.mjs`.
Owned by a package but committed now as contract data: `src/content-jobs.js`, `src/content-signs.js`
(level), `scripts/test-sim.mjs` `PROFILE_TARGETS` (sim). Need a change in a frozen file? Write it in
your report; the integrator makes it.

### 13.1 Event catalogue (`EV`, payloads in `src/events.js`)
| Event | Emitted by | Used by |
| --- | --- | --- |
| `footdip`, `house:enter`, `house:exit`, `farmer:cell`, `listen`, `near`, `boxes:pick`, `boxes:tip`, `litter:spread`, `frame:set`, `carry` | props | jobs, farm (lapses, symptoms), records (looks), ui (weigh panel on `frame:set`) |
| `probe` | ui (T key) | ui floating label (the job counts the `floor.probe` action) |
| `bird:pick`, `bird:release`, `dead:pick` | flock | ui (chick-in-hand panel), farm (`dead:pick` → deadOnFloor) |
| `dead:drop` | props | records |
| `farm:death`, `farm:placed`, `farm:problem`, `farm:delivery` | farm | flock (deaths, spill), props (trucks), jobs (problem jobs), skills |
| `record:closed` | records | jobs (`record` jobs), skills ('day'), level (day end, fail early) |
| `skill:points`, `skill:unlock` | skills | ui, records (skill lines), props (overlay unlock) |
| `panel:open`, `panel:close`, `job:open`, `job:done`, `job:missed`, `level` (incl. checkpoints) | ui / level | jobs, records, skills, tests |
| `action` | farm (`farm.act`) and ui (ui-only actions) | jobs, records (notebook), farm (ui actions it cares about) |

### 13.2 Actions — one shape: `EV.ACTION { id, ...args, result }`
`farm.act(id, args)` changes the state, returns the result and emits the event (unless `args.quiet`).
UI-only actions (marked ui) are emitted by the ui with the same shape and `result` undefined. Job rules
match on it with `matchPayload` (e.g. `{ result: { fixed: true } }`).

| id | args | result | called by |
| --- | --- | --- | --- |
| `heat.setpoint` (ui) | `{ value }` | — | controller (after `env.setHeaterSetpoint`) |
| `heat.relight` | `{ index }` | `{ fixed }` | props `brooder-N` use |
| `vent.timer` | `{ fans, onSec, cycleSec }` | true | controller Ventilation (farm calls `env.setVentTimer`) |
| `vent.fans` (ui) | `{ n }` | — | controller (after `env.setFans`) |
| `light.program` / `light.lux` | `{ darkStart, darkHours, dimmer }` / `{ x, z }` | true / `{ lux }` | controller Lights |
| `controller.read` (ui) | `{ houseC, minC, maxC, setpoint, timer, light }` | — | controller open ≥ 2 s (once per opening) |
| `litter.depth` / `litter.spread` (quiet) / `litter.patch` / `litter.squeeze` | `{ cm }` / `{ x, z, r }` / `{ x, z }` / `{ x, z }` | true / `{ cover }` / true / `{ moisturePct, feel }` | heap panel / props barrow / props sack / ui (Q) |
| `floor.probe` | `{ x, z }` | `{ tempC }` | ui (T) |
| `water.flush` | `{ line, on }` | `{ flushClear }` | water supply panel |
| `water.pressure` / `water.height` | `{ line, cm }` | true | drinker panel |
| `water.flowtest` | `{ line }` | `{ mlMin }` | drinker panel |
| `water.meter` | `{}` | `{ litres, litres24h, per1000, changePct }` | water supply panel |
| `water.filter` / `water.clearFilter` | `{}` | `{ inBar, outBar }` / `{ fixed }` (immediate; the panel shows the 5-minute bar before calling) | water supply panel |
| `water.fixLeak` | `{ line, x }` | `{ fixed }` | props `leak` use |
| `feed.line` | `{ line, running?, flood?, heightCm? }` | true | feeder box |
| `feed.meter` / `feed.silo` / `feed.order` | `{}` / `{}` / `{ kg }` | `{ kg }` / `{ kg }` / `{ arriveDay, arriveHour }` | feeder box / silo / office phone |
| `chicks.tip` | `{ stack, chicks, x, z }` | `{ placed, deadInBoxes }` | props tip (farm emits `farm:placed`) |
| `chicks.cull` | `{ n, reason: 'grading'|'sick', index? }` | true | grading panel / chick-in-hand panel |
| `dead.count` | `{ n, causes }` | true | props bin |
| `sample.box` / `sample.grade` | `{}` / `{ i }` (0..9) | `{ chicks, weightKg, boxKg }` / `{ reflexSec, navel, hocks, weightG }` | grading panel |
| `grade.submit` (ui) | `{ sheet: { navelBad, redHocks, slowReflex, culled } }` | — | grading panel (copied to the record as the farmer's note; never compared) |
| `sample.vent` / `sample.crop` / `sample.weigh` | `{ x, z, index }` | `{ tempC }` / `{ crop }` / `{ weightG }` | chick-in-hand / weigh panels |
| `radio.listen` (ui) | `{ day }` | — | office desk (the panel shows `farm.forecast(day).text`) |
| `phone.report` (ui) | `{}` | — | office phone |
| `sign.read` (ui) | `{ id }` | — | sign panels and plates |

Signing a record is **not** an action: the ui calls `records.sign(day)`, records emits
`EV.RECORD_CLOSED { day, row, signed: true }`, and the record jobs complete on that event.

### 13.3 Interactables (`ctx.interact`) and priorities
`nearest()` picks, of everything in reach, the **highest priority, then the nearest**. Fixed
interactables default to 10, providers to 0. A provider returns null when it cannot act now (hands
full, wrong mode), so it never shadows another. Tested in `scripts/test-contracts.mjs`.

| id | registered by | priority | E does |
| --- | --- | --- | --- |
| `sign-gate`, `controller`, `sign-brooder` | world / house (Phase 1) | 10 | panel |
| `sign-water`, `sign-vent`, `sign-litter`, `sign-chicks`, `sign-health` | props | 10 | sign panel (ui, from content-signs) |
| `feeder-box`, `water-supply`, `drinker-0..3`, `silo`, `office-desk`, `chick-table`, `bird-scale`, `litter-heap` | props | 10 | panel (ui) |
| `box-stack-0..5`, `dead-bin`, `leak`, `brooder-0..7` (enabled while out) | props | 10 | `use()` |
| provider `tip` (carrying boxes, in BROOD_BOUNDS) · `patch` (carrying a sack, on litter) · `frame` (carrying the frame, in BROOD_BOUNDS) | props | 20 | `use()` |
| provider `dead-bird` (hands empty or carrying the bucket; drawn dead birds within 1.5 m) | flock | 6; **15 within 0.8 m** (`nearRadius` / `nearPriority`: a bird at his feet beats the board or machine whose 2 m reach he stands in; final check) | pick up all within 1.5 m |
| provider `sick-bird` (level mode, hands empty, nearest drawn sick bird within 1.2 m) | flock | 5 | catch → chick-in-hand panel (*Cull* / *Put back*) |
| provider `chick` (`ctx.level.sampling` set, hands empty) | flock | 5 | catch → chick-in-hand panel |

The litter squeeze is **not** on E: key **Q** anywhere on litter (or the notebook button) calls
`farm.act('litter.squeeze', { x, z })`.

### 13.4 State other packages read
- `farm.mode`, `farm.stub` (contract stub flag), `farm.age`, `farm.flock.{present, delivered, inBoxes,
  placed, alive, culls, deadByCause, deadOnFloor, sick, meanWeightG, cv, uniformityPct,
  weightQuantile(u), droppings}`, `farm.water.{lines[i].{heightCm, pressureCm, flowMlMin, access,
  flushClear}, filterFactor, leak}`, `farm.feed.{siloKg, meterKg, lines[i].{heightCm, panFill, flood}}`,
  `farm.litter.{coverGrid, moistureGrid, depthCm, cover}`, `farm.floorTempAt(x, z)`, `farm.problems`,
  `farm.problemZones()`, `farm.forecast(day)`, `farm.observe(x, z)`.
- **`farm.stats`** (typedef `FarmStats` in farm.js; skills and the result screen read it, computed in
  node): `truckAt, firstTipAt, lastTipAt, boxWeighedAt, floorShareAtFirstTip, heightsAtFirstTip,
  flushDoneAt, ventReadings[{t, sector, tempC}], cropFillTrue, comfortMinutes, levelMinutes,
  comfortShareByDay[], chickWeightMeasuredG`.
- `env` (Phase 1 fields) + `ventTimer`, `ventDuty`, `lightProgram`, `lightLevel`, `slabTemp`,
  `floorTemp(x, z)`, `airflowM3h`, `brooderOut`, `dayNumber` (−1 on the prep day).
- `level.mode`, `level.sampling`, `level.jobs.current()`, `skills.unlocked(key)`,
  `props.carrying` / `props.carryOpts`.

### 13.5 Keys (physical `KeyboardEvent.code`, as Phase 1)
E use · Esc close · H help · **Q** squeeze the litter · **T** floor thermometer (in the house) ·
**F** floor view (unlocked) · **N** notebook · **K** skill tree. Help card and title card list them.

### 13.6 Hand-offs (carrying, catching, weighing)
`props.startCarry(kind, opts)` / `props.drop()` are **the only way anything is carried** (in the
stub): they set `props.carrying` / `carryOpts`, call `player.carry(kind)` for the mesh and emit
`EV.CARRY { kind, opts }`. `player.carrying` mirrors it; nobody else calls `player.carry`.

| Chain | Steps (who) |
| --- | --- |
| Litter | heap panel: depth (`litter.depth`), *Take the barrow* → `props.startCarry('barrow', { depthCm })` (ui) → props paints with `litter.spread` → heap panel *Put the barrow back* → `props.drop()` (ui). From day 0 the same panel offers *Take a sack of husk* → `startCarry('sack')` → props `patch` provider → `litter.patch` → `drop()` (props). |
| Boxes | `box-stack-N` use → `startCarry('boxes', { stack })`, `EV.BOX_PICK` (props) → `tip` provider → `chicks.tip` → `EV.BOX_TIP`, `drop()` (props) → farm emits `farm:placed` → flock `placeBatch`. |
| Vent / crop | `chick` provider → `flock.catchNearest` → `startCarry('chick', { index })` and `EV.BIRD_PICK { index, x, z, purpose }` (flock) → ui opens chick-in-hand → `sample.vent` / `sample.crop` (ui) → *Put back* → `flock.releaseBird(index)` (ui) → flock calls `drop()`, emits `bird:release`. |
| Sick bird | `sick-bird` provider → same as above with purpose 'sick' → *Cull* → `chicks.cull { n: 1, reason: 'sick', index }` then `flock.releaseBird(index, true)` (ui). |
| Dead birds | `dead-bird` provider → `flock.dead.pickUp` → `EV.DEAD_PICK { n, causes }` and `startCarry('bucket', { n, causes })` (flock; the bucket adds up) → `dead-bin` use → `dead.count { n, causes }`, `EV.DEAD_DROP`, `drop()` (props). |
| Weighing | bird-scale panel *Take the scale and frame* → `startCarry('frame')` (ui) → `frame` provider → `flock.catchGroup(x, z, 10)` → `EV.FRAME_SET { x, z, birds }` (props) → ui opens the weigh panel → `sample.weigh` per bird → closing the panel calls `flock.releaseGroup()` (ui); the frame stays in hand for the next sector; *Put them back* at the bird scale → `drop()` (ui). |

## 14. Work packages (four, disjoint files, parallel worktrees)

Each engineer works in `git worktree add ../cf-<key> -b phase2/<key> main`, edits **only the files
listed** (new files with the listed prefixes are theirs too), codes against the stubs and §13, and
keeps `npm run build`, `npm test`, `node scripts/shoot.mjs --scenario cold-hot`, `--scenario p2-hooks`
and `--steps scripts/phase1-jobs.json` (sandbox) passing. Other packages' stubs return placeholders:
test your side with synthetic events (`__game.events.emit(...)`) and by setting fields on the stubs.
Each section below is the brief: read it with §13 and the sections it names.

### 14.1 `sim` — simulation, records, skills (branch `phase2/sim`)
**Owns:** `src/sim.js`, `src/farm.js`, new `src/farm-*.js` (incl. **`src/farm-profiles.js`**),
`src/records.js`, `src/skills.js`, `src/save.js`, `scripts/test-sim.mjs`. Pure logic: no three.js,
no DOM (save.js touches `localStorage` only).
**Builds:** the climate additions of §6.2 (airflow, timer, slab, floor, brooders out, humidity,
weather events, light), level mode only; the farm model of §6.3–§6.9; `farm.act` for every id of §13.2
with the results listed; the problem engine of §7 (start, symptom from actions / `EV.NEAR` /
`radio.listen`, fixed; weather events owned and rebuilt on restore); `farm.stats`; `farm.problemZones()`,
`forecast()`, `observe()`; records (§8: notebook from `EV.ACTION`, look notes from `EV.LISTEN`, rows,
`timeline()`, `sign()` / auto-close at 06:00 with `signed: false`); skills (§9: `evaluate` per
checkpoint over `farm.stats` and records, deltas); serialize / restore of farm, records, skills. Remove
`stub: true` from farm.js when the model runs.
**farm-profiles.js** (stub on main; used by test-sim and by `level.debug.goto(auto)`):
`applyRound(farm, env, day, round, profile = 'ideal')` performs that round's management of a profile
of §6.10 through `farm.act` and the env setters (no events other than what `farm.act` emits);
`runProfile(name, { seed })` runs a whole level (start, prep, skips, rounds, problems found as the
profile says, weigh-in at 09:00 day 7, ending) and returns `{ farm, env, records, skills, snaps,
result }`; `checkProfile(name, run, PROFILE_TARGETS, { assert, inBand })` asserts that profile's targets.
**Acceptance:** `node scripts/test-sim.mjs` — every contract test and every `PROFILE_TARGETS` profile
passes (§6.10 table), determinism byte for byte; sandbox unchanged (`farm.mode === 'off'`: cold-hot
metrics within ±0.02 of Phase 1); `farm.step` ≤ 0.3 ms in node, a 24 h skip ≤ 150 ms; save blob
< 60 KB and restore → serialize identical; rows hold null for every reading not taken and nothing from
the hidden model; `grep -iE "correct|wrong|well done|good job|mistake|perfect|excellent"
src/records.js src/skills.js` finds no player-facing text.

### 14.2 `level` — job system, level flow, UI, panels, sign content (branch `phase2/level`)
**Owns:** `src/level.js`, new `src/job-engine.js`, `src/content-jobs.js`, `src/content-signs.js`,
`src/content.js`, `src/ui.js` and every `src/ui-*.js` (new: `ui-title.js`, `ui-jobs.js`,
`ui-equipment.js` (drinker, water supply with filter gauges, feeder box, silo, controller sections
Temperature / Ventilation / Lights), `ui-inspect.js` (grading, chick in hand, weigh), `ui-records.js`
(office book, phone, radio), `ui-notebook.js`, `ui-skilltree.js`, `ui-result.js`),
`src/index.template.html`, new `scripts/test-jobs.mjs`, `scripts/p2-level-*.json`.
**Builds:** §1–§5 and §8–§11 user-facing parts; the level API documented in `level.js` (incl.
`saveBlob()`, checkpoints `EV.LEVEL { phase: 'checkpoint', name }`, `sampling`); `job-engine.js`
(§3.1–§3.2, **no DOM**, runs in node); clock speeds (§2) by setting `env.timeScale`; panels for every
id of §13.3 drawn from `content-signs.js`; E through `ctx.interact.nearest()`; Q squeeze, T probe; the
hand-offs of §13.6 that start in the ui; `props.highlight()` / `props.setOverlay()`; autosave (§11);
`__game.ui.openPanel(id)` for harness runs; `level.debug.goto(day, hour, { auto })` uses
`farm-profiles.applyRound` for each round passed (a no-op in the stub until sim merges), then
completes and logs the jobs still open.
**Acceptance:** `node scripts/test-jobs.mjs` (fake clock via the real `createSim`, the bus, the farm
stub, JOBS): windows open and close at the right `env.day` (prep-flush 16:00–02:00, d0-floor closes at
the first tip, d0-vent first tip +2..+3.5 h, d7-weigh 08:00–18:00); rel anchors; `each` / `count`
(sectors, nearDrinker) / `coverage` (sight 2 m: one pass along z = −2.5 and one along z = +2.5 over the
brooding area reaches ≥ 50 %) / `all` latching / `any`; `matchPayload` on `{ result: { fixed: true } }`;
record jobs on `RECORD_CLOSED` sameDay; a skip past a window marks jobs missed; problem jobs open only on
`farm:problem symptom` and `p-wet-patch` only after `p-leak`. Harness steps files run green:
`p2-level-prep.json` (ten prep jobs by synthetic events and `openPanel` clicks, skip to day 0),
`p2-level-day0.json` (truck anchor, pinned jobs, grading panel, six tips by synthetic `chicks.tip`, vent
window), `p2-level-routine.json` (a day's 13 jobs, a skip leaving 2 missed, record signed),
`p2-level-problems.json` (each symptom opens its job, each fix closes it), `p2-level-end.json` (pass and
fail screens via `level.debug.result`), `p2-level-save.json` (`reload` → Continue → same day, hour and
jobs). Text checks: `grep -riE "correct|wrong|well done|good job|great job|mistake|perfect|excellent"
src/ui*.js src/content*.js` finds nothing; `node scripts/test-contracts.mjs` passes; no horizontal
scroll at 400 px; sandbox still passes `phase1-jobs.json`.

### 14.3 `props` — 3D props and interactions (branch `phase2/props`)
**Owns:** `src/props.js` and new `src/props-*.js`, `src/house.js` and `src/house-*.js`, `src/world.js`
and `src/world-*.js`, `src/player.js` and `src/player-*.js`, `scripts/p2-props-*.json`.
**Builds:** §12.1; the interactables and providers of §13.3 that say "props"; the trigger events of
§13.1 incl. `EV.NEAR` (dwell in `farm.problemZones()`, real seconds, once per entry) and `EV.FRAME_SET`;
`startCarry` / `drop` (keep the stub's behaviour) and `player.carry` / `player.pose`; the physical
`farm.act` calls (`litter.spread`, `litter.patch`, `chicks.tip`, `dead.count`, `water.fixLeak`,
`heat.relight`); boards painted from `content-signs.js`; house in level mode from the farm's heights,
fill, lights and `env.brooderOut` (Phase 1 tables in sandbox; config `nippleHeightCmAt` /
`feederRimCmAt` are the shared curves).
**Acceptance:** `p2-props-look.json` shots reviewed (bare floor, half spread, full litter, wet patch and
caked cells, truck parked with stacks, farmer with boxes / barrow / bucket / frame, tipping, sight tubes
brown and clear, a brooder out, new boards readable at the default zoom, overlay on);
`p2-props-events.json` prints and checks counts: gate dip → 1 `footdip gate`; door with / without the
house dip → `house:enter` dipped true / false; two lengthwise passes → ≥ 200 distinct `farmer:cell`
cells; 2 s still → 1 `listen`; a stub zone (`__game.farm.problemZones = () => [{ problemId: 'x', x: -9, z:
2, r: 1.5, dwellSec: 2 }]`) → 1 `near` after ≥ 2 s inside, 0 when passing through; carry chain →
`carry` boxes then null; with boxes in hand next to a stub dead-bird provider E tips (priority);
warm-up covers every new material (`renderer.info.programs.length` unchanged after a full prop tour);
≤ 40 extra draw calls and ≤ 60 k extra triangles in the house view; Phase 1 `tour` shots match in
sandbox.

### 14.4 `flock` — flock extensions (branch `phase2/flock`)
**Owns:** `src/flock.js` and `src/flock-*.js` (new: `flock-pop.js`, `flock-dead.js`,
`flock-catch.js`, `flock-sick.js`), `scripts/p2-flock-*.json`.
**Builds:** §12.2; the flock API in `flock.js` (`placeBatch`, `catchNearest`, `catchGroup`,
`releaseBird(index, culled)`, `releaseGroup`, `dead`, `sounds`, `resetLevel`, `serialize` / `restore`);
reads `ctx.farm` each update; listens to `farm:death`, `farm:placed`; emits `bird:pick`,
`bird:release`, `dead:pick`; registers the `chick`, `sick-bird` and `dead-bird` providers with the
priorities of §13.3 and calls `ctx.props.startCarry` / `drop` as §13.6 says.
**Acceptance:** `p2-flock-*.json` driving the stub farm by setting fields and emitting events: no birds
before placement; six `farm:placed` → 1,800 birds spread within 60 s of play; `alive` drop hides
round(alive / 3.33) birds and 30 `farm:death` (n 1 each) lay 30 dead birds by cause, `flock.dead.count`
= 30; pick-up within 1.5 m emits `dead:pick` with the right n and the stub farm's `deadOnFloor` falls by
n; catch / release / group / cull work and call startCarry / drop (`carry` events); size spread grows
with `cv` (std of `S.size` reported for cv 0.08 and 0.14); with line 1 access 0.3 the share of drinkers
at line 1 falls below half the others'; `sick` 12 → 12 sick birds sitting apart; the `sick-bird`
provider answers within 1.2 m; serialize → restore keeps dead positions; ≤ +1 ms per frame at 1,800
birds (`flock.profile`); sandbox cold-hot metrics unchanged (±0.03).

## 15. Test hooks and harness scenarios

`window.__game` (main.js, in code): Phase 1 hooks plus `events`, `farm`, `records`, `skills`, `save`,
`props`, `interact`, `level`, `startLevel(opts)`, `nextJob()`, `jobs()` (key, status, progress), and
`snapshot()` with `mode` and `farmMode`. Package hooks: `__game.ui.openPanel(id)` (level),
`level.debug.goto(day, hour, { auto })`, `level.debug.trigger(id)`, `level.debug.result(pass)`,
`farm.debug.trigger(id)`, `farm.debug.truth()`. Harness (`scripts/shoot.mjs`): steps `{"reload": true}`
and `{"clearStorage": true}`; built-in scenario `p2-hooks` (passes on the stubs). Under automation the
game boots in the sandbox; steps files start a level with `{"eval": "__game.startLevel({ seed: 1 })"}`.
Node: `npm test` = `scripts/test-contracts.mjs` + `scripts/test-sim.mjs`; level adds `test-jobs.mjs`.

## 16. Integration order
1. Merge `sim` (pure; its tests run on main). 2. `flock` and `props` (either order; both read the farm).
3. `level` last. After each merge: build, `npm test`, `cold-hot`, `tour`, `phase1-jobs`, `p2-hooks` and
the merged packages' steps files. Then the integrator's runs: `scripts/p2-level1.json` — start, the prep
day with real inputs, `goto(0, 7.9, { auto: true })`, truck, grade, tip six stacks **by walking**
(placed-fast ≤ 90 game min must hold with real walking), vent, `goto(7, 8, { auto: true })`, weigh 50,
sign, result screen (expected: pass, ratio 4.6–4.95 because auto plays the ideal profile);
`scripts/p2-level1-find.json` — the farmer finds the leak by walking past it on day 4 afternoon and the
clogged filter by the day 4 flow tests (both problem jobs open from real symptoms); plus the four
Phase 1 scenarios. Then ARCHITECTURE.md and a play-through recording for the farmer.

**Integration status (done on main).** The four packages are merged (sim, flock, props, level) and
wired; the stub fallbacks are gone (`farm.stub` is false; the controller no longer sets the timer or
light program itself; `level.debug.trigger` only starts a problem). Contract changes made at
integration are listed in ARCHITECTURE.md "Phase 2 (Level 1) — as integrated". Both integrator runs
pass with real walking (click-to-walk), real E / Q / F key presses and real panel clicks:
`scripts/p2-level1.json` (title → prep day → truck → six tips by walking, last tip 35 game min after
the truck → vent → weigh 50 → sign → result: pass, ≈ 4.8 × chick weight, deaths ≈ 0.6 %, both earnable
branches at level 2) and `scripts/p2-level1-find.json` (brooder out, clogged filter, leak, low silo
found from real symptoms and fixed). `node scripts/test-level.mjs` checks the same level flow in node.

## 17. Open questions for the farmer
1. **Skill branches:** settled. config.js uses the 11 names from the plan doc (Farm Planning, Biosecurity & Health,
   Chick Arrival & Brooding, Body Temperature & Comfort, Heat & Ventilation, Moisture & Minimum Ventilation,
   Heating, Water, Feed & Digestion, Lighting, Growth & Performance).
2. **Day numbering:** arrival day = day 0 and the prep day = day −1 ("days 0–7")? Then the guide's
   "34 °C on day 1" sits on day 1 and day 0 also shows 34 °C (general). Phase 1 called arrival "day 1".
3. **Flock size:** 6,000 chicks in a 48 × 12 m house. Your houses are likely bigger; fine for learning?
4. **Problems on replay:** same days every time (compare your weeks) or moved around?
5. **Fail limits:** day 7 under 4.0 × chick weight, or more than 2 % dead in week 1 — do these match
   your company's standards (some use 1 %)?
6. **Rounds:** morning = every check, afternoon = walk, controller, litter, dead birds. Your split?
7. **Pre-heat:** how many hours do you pre-heat in the cool season, and how cold is your floor before?
   (The game's concrete takes about a day to reach 28 °C at the litter.)
8. **Chick grading:** do you grade a sample box yourself, or does the hatchery give the figures? Do you
   cull weak chicks at placement?
9. **Minimum ventilation:** fan timer (on-seconds per cycle) or a % setting on your controller? Real
   numbers would replace the general 150 / 290 / 480 m³/h per 1,000 birds.
10. **Light:** 23 h at 30–40 lux in week 1 — do you dim after day 3 or day 7? Is the light program on
    your climate controller (as in the game) or a separate box?
11. **Water : feed:** is 1.6–2.0 the figure you use in week 1? Do you read litres per 1,000 birds?
12. **Feed orders:** do you order feed yourself or does the integrator deliver on a schedule?
13. **Pace:** does a 3–5 minute day feel right? The clock stops while you read a sign and runs slower
    while you carry boxes; should a round get quicker once you know it?
14. **Water filter:** where is the main filter on your farm, and do you read pressure gauges on it?

## 18. Review issues and where they are fixed (revision 2)
| # | Issue | Fix |
| --- | --- | --- |
| 1 | perfect play on the fail line; day vs age | `flockAgeAt` / `PLACEMENT_DAY` (config, §2); FI 12 + 4a, FPG 0.97 + 0.03a, no cap (§6.5); weigh from age 7.0; ideal 4.6–4.95, small mistakes 4.2–4.5 in `PROFILE_TARGETS` |
| 2 | unreachable acceptance numbers | slab τ 30 h, k = 0.1 + 0.02·depth, floor term 0.06/°C below 29 (§6.2–6.3); CV 8 %, uniformity 70–80 %; NH3 with √airflow; one airflow (`config.AIR`); silo 1,100 kg runs down, no jump; all targets in test-sim |
| 3 | water drop never shows | main filter clogs at 10:00 day 3, every line × 0.5; meter shows per 1,000 birds and change; sign line "a day without a rise"; job opens only on a flow test / filter gauges; drop-spotted by 12:00 day 4 (§7) |
| 4 | clock too fast for physical jobs | sign 0×, carry 30× and the whole placement 30× (`LEVEL1.clock`); day 0 "before the truck" group; pinned anchor jobs; placed-fast ≤ 90 min, checked with real walking (§16) |
| 5 | providers ignore priority | `interact.nearest` priority then distance; table §13.3; squeeze on Q; `test-contracts.mjs` |
| 6 | two action shapes | one shape `{ id, ...args, result }`; `matchPayload` in events.js; records via `RECORD_CLOSED`; `clearFilter` immediate, bar in the panel |
| 7 | nobody owns symptoms | farm decides; `problemZones()` + `EV.NEAR` (props); `forecast()` + `radio.listen`; acceptance in sim and props |
| 8 | ui ↔ props ↔ flock hand-offs | `props.startCarry` / `drop` + `EV.CARRY`, one heap panel, `EV.FRAME_SET`; chains §13.6 |
| 9 | two owners of dead birds | farm owns `deadOnFloor`, `DEAD_PICK` subtracts (in the stub); dead birds 1:1; `flock.serialize()` in the blob |
| 10 | grading as a hidden quiz; typed weight | no match rule; cull at the table; sheet copied as his note; chick-weight milestone; ratio from the measured box |
| 11 | sick birds cannot be culled | `sick-bird` provider (flock), *Cull* / *Put back* |
| 12 | routine heavy and repetitive | coverage by sight 2 m, 50 % / 35 %; look notes; controller holds vent + lights (light panel removed); 13 jobs a day; day 1 brooder out, day 6 warm afternoon; "Your week" on the result screen |
| 13 | who calls evaluate | skills subscribe to the bus; `EV.LEVEL checkpoint`; `farm.stats`; delta points (in the stub, tested) |
| 14 | goto(auto) produces neglect | `farm-profiles.applyRound` shared by test-sim and goto(auto) |
| 15 | job engine untested | `job-engine.js` without DOM + `scripts/test-jobs.mjs`; `__game.ui.openPanel`; integrator run finding problems by walking |
| 16 | no chick height reference | chick head drawn on the prep day; "about 10–12 cm" line (general); pan-on-litter picture |
| 17 | windows open before the guide time | flush 16:00–02:00; vent +2..+3.5 h and the milestone counts the whole window |
| 18 | save contract | `level.saveBlob()` for autosave and hot reload; `info()` from `env.day` (fixed, tested); weather events owned by the farm, not saved |
| 19 | feederRim in a three.js file; content-signs missing | `feederRimCmAt` in config; `content-signs.js` committed |
| 20 | page text, tags, grep, two source tables | ARCHITECTURE.md and content.js say "guide name or general, no pages"; brooder rows tagged; gate line split; grep and `test-contracts.mjs` cover skills/records texts; `SOURCES = GUIDES` |

## 19. Review round 2 (fixer) — where each finding is handled
| # | Finding | Fix |
| --- | --- | --- |
| 1 | notebook settings read like a debug log | `ui-format.settingText` / `placeWords`; notebook label "Set"; places in words |
| 2 | week table rows hundreds of px tall | notes in a full-width row under each day's numbers; house and light columns first |
| 3 | drinker line out of the picture at 50 cm | line drawn at the top with "▲ line at 50 cm"; Shift steps winch / pans 5 cm |
| 4, 27 | brooder sign source tags run into the value | own Source column, guide name, 11.5 px after a 14 px gap (CSS specificity fixed) |
| 5 | no hand weighing gave a better result | `farm.stats.scaleAtWeighInG` (scale at age 7.0) in `computeResult`; test-level case |
| 6 | pans out of reach / never placed left no trace | feed reach in L, starvation after 48 h, box hazard while waiting, low-mortality needs a lived week; profiles `pansUp`, `neverPlaced` |
| 7 | over-pressure was the best strategy | spill 0.7 × over-flow, wet-chick access penalty days 0–3; profile `pressure20` |
| 8 | a brooder out all week left no trace | per-group comfort, CV from the group spread, out-brooder air 6 °C × output, steady-heat 95 % of chick-minutes |
| 9 | wet litter / no min vent did nothing | wet and thin litter chill, caked floor and bad air widen the CV, f_air from 12 ppm; profiles `litter2cm`, `noMinVent` targets |
| 10 | day 6 warm afternoon never showed; job done by the weather | outside +7 °C; p-warm needs a fan / timer / pad action and the felt air near target; 'weather' fix; profile `warmNoFan` (final check: +3 °C and sun on the roof, the timer is the answer, tunnel fans chill; profiles `warmNoAction`, `warmTunnel`) |
| 11 | wet patch done with the sack anywhere | `litter.patch` → `{ onLeak }`; p-wet-patch matches it; the sack snaps to the patch |
| 12 | missed jobs as ids on the wrong day | filed on their own day by title; "Not done: n jobs" with the list |
| 13 | Replay kept the old run's UI | `ui.newRun()` from `level.start` / `resume` |
| 14 | a chick in the hand in a save | never serialized; dropped on resume |
| 15 | piles after a skip read as cold huddles | `flock.afterSkip(hours)` from `level.skip` |
| 16 | hot reload lost the skill profile; result reappeared | `resume` loads the profile; snapshot only while the level runs |
| 17 | drinker right column past the plate | one-column grid, wrapping button |
| 18 | water supply cut at 960 × 600 | valves 2 × 2 and compact boxes under `max-height: 700px` |
| 19 | HUD jumps with the rate label | fixed rate slot |
| 20 | job card too long | later jobs one line per round, missed jobs folded, card ≤ 64 vh with a fade and "more" |
| 21 | time-bar Next job hid the skip | it shows the card's label ("Skip to 10:13") |
| 22 | later branches empty; shared badges | `LATER_UNLOCKS` shown dimmed; shield, sack and trend badges |
| 23 | edge pointer under the E prompt | the prompt and captions are in the avoid list |
| 24 | text and chart polish | Today header time, "6,000", F key chip, full-width graph with a 0–3 ratio axis |
| 25 | fail at 3 % beside a book at 0.03 % | result splits bin / floor / boxes / culls; fail text names the birds not picked up |
| 26 | raised-with-flock against a hidden 17 cm | drinker plate: "about 1 cm a day … about 17 cm on day 7" (general) |
| 28 | gate dip beside the gateway | level spawn outside the gate, dip across the gateway |
| 29 | keep walking looped day 7 | clock stops at 23:59 day 7 |
| 30 | late goto dropped the prep; props missed tips | past-due prep played at once; props listeners gated on `farm.mode` |
| 31 | humidity not saved | `houseRH` in the env save |
| 32 | job log in the save | `[key, day]` tuples |
| 33 | package checks that never fail | `p2-flock-events.json` on the real farm with `expect` steps; stub demos marked |
