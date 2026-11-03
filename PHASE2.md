# Chicken Farm — Phase 2 spec: Level 1, the brooding week

**Goal (approved plan):** a Level 1 vertical slice. Prepare the house and run the brooding week,
with the job list, info signs, flock records and the first two skill branches. The farmer plays
from the day before the chicks arrive to the day 7 weigh-in and judges whether learning by doing
farm jobs works for him.

Read with `ARCHITECTURE.md` (Phase 1 contracts, still valid). This file adds what Phase 2 builds,
the shared contracts already in code (`src/config.js`, `src/events.js`, `src/interact.js`, the stub
modules) and the four work packages.

## 0. Rules that hold everywhere (approved design, do not break)

- **No lessons, no quizzes.** Facts sit on signs and equipment plates at the place where you use them.
  The job list walks you through each job and points to where its facts are.
- **No "correct" / "wrong" messages anywhere**, no green ticks on values, no red crosses, no "good job".
  A job turns "done" because it was *done*, not because the value was right. Results appear only as
  measured numbers: in the daily flock record (body weight against target, feed, water, deaths, FCR,
  litter moisture), on gauges and instruments, and in what the flock does.
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

Times are real minutes at normal level speed (`LEVEL1.clock.work` = 120: one real second is two farm
minutes, one farm hour is 30 s). While an equipment or inspection panel is open the clock runs at
`clock.panel` = 30 (a 1-minute flow test takes 2 s). The records book, skill tree and result screen
pause the clock. 4× (`clock.fast` = 480) is on the time bar. Budget for a whole level: **about 40
minutes**; the farmer can save and leave at any time (autosave, §11).

### Title card (boot)
Over the farm at dawn: **"Level 1 – The brooding week"**. Buttons: *Start Level 1*, *Continue — Day 3,
10:40* (only with a save), *Walk the Phase 1 farm (sandbox)*. A line under them: "Skill tree" opens
the 11-branch screen read-only. No intro text beyond one sentence: "Get the house ready, take in 6,000
chicks and bring them to day 7."

### Prep day (Day −1) — about 8 minutes
07:00. The farmer stands inside the farm gate (FARM.spawn). The house is empty and clean: bare grey
concrete floor, drinker lines winched up high (50 cm), feeder pans up, brooders cold, lights off.
A heap of rice husk and a wheelbarrow sit on the apron west of the door. The job card (top right)
reads **"Prep day — chicks arrive tomorrow 08:00"** and lists ten jobs; the first is marked.

1. **Foot dip at the gate** — he walks through the dip next to the gate sign (it splashes, boots wet).
   Done. The gate sign is linked on the job for the biosecurity facts.
2. **Start pre-heating** (marker on the climate controller). Walking to the house, through the house
   dip at the door, he reads the brooder sign (target 34 °C day 1, pre-heat until the floor is
   28–30 °C) and sets the brooder thermostat. Done as soon as the brooders burn at a setpoint ≥ 30 °C.
   How early he did it shows tomorrow in the floor temperature.
3. **Spread the litter.** At the heap, E opens a small card: depth 2 / 5 / 8 / 10 cm, next to the
   litter sign facts. He picks one and takes the barrow. Walking the house with the barrow paints the
   floor from concrete to husk in a 2.4 m swath (a fill bar on the job: "floor covered 63 %").
   About 60–90 s of walking. Done at 95 % covered. Thin litter warms faster but holds less water.
4. **Lower the drinker lines.** At each line's regulator (west end) E opens the *Drinker line* panel:
   a side view with the nipple, a ruler and (from day 0) a chick's head; winch up/down in 1 cm steps;
   a pressure knob with the sight-tube column; *Flow test* (a cup under a nipple for one farm minute,
   shows ml). The water sign beside the meter has the flow rule (age + 20 ml/min) and the height rule.
   Done when all four lines have been set (any value: the result shows later).
5. **Fill the feeder pans.** Feeder control box (north wall, west end): run each line, flood on
   (pans filled to the rim for chicks), pan height. Done when all three lines are flooded and full.
6. **Check the feed in the silos** — round the west end of the house to the silos; E reads the level
   gauge (kg). Done on reading. (1,500 kg starter at the start.)
7. **Set the light program** — light panel on the north wall: hours of light and dimmer; it shows the
   lux at chick level. Facts on the panel plate (23 h in the brooding week, Week 1 guide).
8. **Set the minimum ventilation timer** — the min-vent sign next to the controller explains the
   timer per 1,000 birds; the controller has a timer section (fans, on-seconds, cycle).
9. **Flush the water lines** (opens at 12:00, "about 12 hours before the chicks" on the water sign).
   At the water supply (meter and flush valves, SW corner) he opens each line's flush valve: the
   panel shows four sight tubes, brown water turning clear over ~10 farm minutes per line, and he
   closes each when clear. Usually done in the evening (~20:00, using *Next job* to skip there).
10. **Sign the prep checklist** at the office (evening). The office book opens on a prep page listing
    what was done and when (no judgment). Signing ends the day; *Next job* skips the night to 06:00.

Night: skipped in one jump (the farm keeps integrating: the house warms, the slab warms, the flushed
water warms). The skip stops at 06:00 day 0 and the farmer stands at the gate again.

### Day 0 — chicks arrive — about 8 minutes
- 06:00 morning round opens (dips, temperature, meter first reading = baseline, drinkers, feeders,
  vent, lights; dead birds and walk the house are not listed before the chicks come).
- **Measure the floor temperature** (06:00–08:00). With the floor thermometer (key **T**, or the
  button on the job) he crouches and reads the litter surface at his feet; the reading floats over
  him for 3 s and goes into the notebook. Three spots in three different sectors complete it. The
  reading is the truth (28.6 °C, or 25.9 °C if he pre-heated late) — no comment on it.
- **08:00 the chick truck** drives in from the gate and stops on the road at the door path. The
  driver stacks six stacks of ten boxes on the path. *Next job* skips to 08:00 if he is early.
- **Grade a sample box** (chick table by the truck). The inspection panel shows a box lid opening
  on ten chicks (2D drawings). For each chick: *Turn on its back* (it rights itself after 1–6 s, a
  timer counts), *Look at the navel* (healed / string / open / black button picture), *Look at the
  hocks* (clean / red). A grading sheet beside it has tally boxes he fills himself; *Weigh the box*
  gives gross kg, the box weight is printed on the box (net ÷ 100 = chick weight). *Hand in the
  sheet* completes it. The chick sign facts (reflex, navel, hocks, uniformity) are on the table.
  About 90 s.
- **Place the chicks.** E at a stack picks up ten boxes (the farmer carries them). Inside the
  brooding area, E tips them out where he stands: 1,000 chicks spill and spread toward feed, water
  and warmth. Six carries. The job bar counts "3,000 of 6,000 placed". Time in the boxes counts
  (§6.4). About 90 s.
- **Vent temperatures 2–3 h after placing** (opens 1.5 h after the first tip). E near chicks
  catches one (prompt "E Pick up a chick" only while a sample job is open). The *Chick in hand*
  panel shows a drawing and *Take vent temperature* → "39.8 °C". Five chicks from three sectors.
  The farmer reads the numbers against the chick sign range and acts (or not) on the thermostat.
- Afternoon round: dips, walk the house (spread, sounds), temperature, litter squeeze, dead birds
  (box deaths and weak chicks show up from today).
- Evening: the daily record at the office. **The first results appear**: chicks placed, dead in
  boxes, dead today, feed and water used since placement, house min/max against target, floor
  temperature measured at arrival, vent temperature mean. Sign; skip to 06:00.

### Day 1 — about 5 minutes
Morning round as on every day (§4.3), plus **check the crops at 24 h** (opens 22 h after the first
tip): catch ten chicks from three sectors, *Feel the crop*: full and soft / hard (feed, little water)
/ soft and watery (water only) / empty. The notebook tallies. The record shows "crops full: 9 of 10".

### Days 2–6 — about 3–4 minutes each
Morning round (≈ 2.5 min), afternoon round (≈ 1 min), record (≈ 20 s), skips between. Problems add
jobs so the days differ (§7): day 2 a cold night forecast on the office radio and a night check;
day 3 water intake drops (a blocked regulator filter on line 2) — he sees it on the meter, in the
flow test or as chicks crowding other lines; day 4 a leaking nipple makes a wet patch that cakes;
day 5 the silo reads lower than expected and feed must be ordered from the office phone. Each
afternoon he raises nipples and feeders a little as the chicks grow (the side view in the drinker
panel shows the chick's head moving up past the nipple).

### Day 7 — weigh-in and result — about 5 minutes
Morning round plus **weigh sample birds**: he takes the hand scale with a catching frame from the
bird-scale spot, sets the frame down in a sector (E), the panel weighs the ten caught birds one by
one (*Weigh next*, 0.4 s each, or *Weigh all*), five sectors → 50 birds. The panel shows each
weight and the sample mean; the weigh facts (4–5 × chick weight, Week 1 guide) are on its plate.
Then the evening record and **the level result screen** (§10): the week's record table, day 7 weight
as "× chick weight", deaths %, uniformity, FCR, litter moisture, the skill points earned, and either
*Level 1 complete* or *Replay the brooding week*.

## 2. Clock, days and speed

- **Day numbering (new):** day 0 is the placement day (chicks at 08:00), day −1 the prep day
  (`MIN_DAY`). The HUD shows "Prep day" for −1 and "Day N" otherwise. `targetTempAt(0)` = 34 °C, as
  day 1. The Phase 1 sandbox keeps its own start (day 1, 08:00) and its 1..42 test slider.
- **Speeds in a level:** `LEVEL1.clock` work 120, fast 480, panel 30; records/skills/result pause.
  The Phase 1 sandbox keeps `TIME.gameSecondsPerRealSecond` (360).
- **Rounds** (`LEVEL1.rounds`): morning 06:00–12:00, afternoon 13:00–18:00, evening 16:00–24:00.
  Prep day jobs are open 07:00–24:00 (flush 12:00–02:00).
- **Each morning** after an overnight skip the farmer starts at the gate (FARM.spawn), so the gate
  dip is a real step every day.
- **Next job** (job card footer and time bar; replaces "Skip 1 hour" / "Next morning" in a level):
  - if a job is open now → it moves the marker to the next open job in list order (no time passes);
    a second press within 3 s (button now reads *Skip to 13:00 — 2 jobs open*) skips anyway;
  - if no job is open → it skips the clock (`env.skipHours`, the farm integrates every minute) to the
    moment the next job opens, never past the truck at 08:00 day 0 or the end of day 7;
  - a skip that passes a window end marks that window's open jobs **missed** (job card shows them
    struck through in grey, the record shows the readings as "not read"). Missing is not punished
    with a message; it shows as blanks in the record and in what the flock does.
- A problem never stops a skip and is never announced; it shows in the farm (§7).

## 3. The job system

### 3.1 Data model
Job definitions are data in `src/content-jobs.js` (`JOBS`, contract written; package "level" owns
it). A `JobDef` has `id`, `kind` (`dated` | `routine` | `problem`), `day` or `days`, `round` or an
explicit `window` or a relative window `rel: { anchor: 'truck'|'placed', fromH, toH }`, `spot`
(where the marker points), `signs` (ids of the boards/panels holding its facts), `branch` (skill
branch it feeds) and `done` (completion rule).

The engine (`src/job-engine.js`, package "level") turns defs into **instances**, one per day:
`{ key: 'r-meter@3', id, def, day, status, opensAt, closesAt, doneAt, progress, result }` with
status `waiting → open → done | missed`. Times are `env.day` floats. At level start it creates the
prep day's instances; at each midnight the next day's. Relative windows get their times when the
anchor happens (truck stops, first stack tipped). Problem instances are created when the farm
reports a symptom the farmer *saw* (§7) and close as missed only at the end of the level.

### 3.2 How a job knows it is done
The engine listens to the bus (`ctx.events`, `EV` in `src/events.js`) and evaluates the open jobs'
rules on each event, plus `state` rules twice a second:

| Rule | Meaning | Example |
| --- | --- | --- |
| `event` | one bus event whose payload matches `match` | `EV.FOOTDIP {where:'gate'}` |
| `action` | one `EV.ACTION` with this id (actions come from `farm.act`, §13.2) | `water.meter` |
| `each` | the action once for every value of a key | `water.flowtest` for lines 0–3 |
| `count` | n actions, from at least `sectors` different `broodSector(x,z)`; `nearDrinker`: k of them within 1 m of a drinker line | 5 × `sample.vent` from 3 sectors |
| `coverage` | share of the brooding-floor `FLOOR_GRID` cells the farmer stepped in this round (`EV.CELL`); `listen`: and one `EV.LISTEN` | 60 % + listened |
| `state` | named predicate (`preheat-on`, `litter-covered`, `pans-flooded`, `lines-flushed`, `all-placed`, `dead-cleared`) | farm.litter.cover ≥ 0.95 |
| `all` / `any` | combinations | dips: gate and house |

Only events that happen while the job is open count (a meter read at 05:50 does not count for the
06:00 round). `progress` (0..1) drives the job's fill bar (coverage, count, chicks placed).

### 3.3 Quality is judged silently
Completion never looks at the value. Each job's **result** is what was measured or set when it was
done (e.g. `r-drinkers`: the four flows tested and the heights at that moment; `prep-flush`: hours
before the truck; `d0-grade`: the sheet the farmer filled in and the true sample). The engine writes
it with `records.logJob(key, day, result)`. Three things use it, none of them with a verdict:
1. the **simulation** already felt the setting itself (a flow that is too low lowers intake, §6);
2. the **daily record** shows the measured numbers (and blanks for checks not done);
3. **skills.evaluate(checkpoint)** compares results with the milestone rules (§9) and awards points.

### 3.4 Pointing to places and facts
- The 3D marker (Phase 1 diamond and ground ring, plus the edge arrow when off screen) sits over the
  current job's `spot`: a key of `SPOTS` / `SPOTS2` / `FARM`, `drinkers.N`, or a dynamic one
  (`heater` = nearest brooder, `dead` = nearest dead bird, `leak` = the leaking nipple once found).
- The open job shows one line of *where* text and its fact links: "Facts: Water lines sign (north
  wall, west end)". Clicking a link moves the marker to that board until the board is read.
- Boards a current job links to wear a small orange tab in 3D (props), so you see where to read.
- Jobs list facts, never values: "Check drinker flow and height", never "set flow to 23 ml/min".

### 3.5 The job card (HUD, top right; replaces Phase 1's in a level)
Header "Day 3 · Morning round 06:00–12:00", the open jobs of the current round in order (current
one expanded with *where*, fact links and its bar), done ones collapsed to the count, missed ones
struck through, problem jobs at the top with a neutral "new" pin (not a warning colour). Footer:
*Next job* (§2), *Notebook* (N), *Skill tree* (K). Narrow screens: same rules as Phase 1.

## 4. Every job in the slice

Columns: **Where** (spot) · **Action** (what the player presses, panel UI) · **Done when** · **Sim**
(what the model does with it) · **Facts** (sign, source). Facts are listed in full in §5.

### 4.1 Prep day (day −1, open 07:00–24:00)

| Job | Where | Action | Done when | Sim | Facts |
| --- | --- | --- | --- | --- | --- |
| `prep-gate` Foot dip at the gate | `FARM.footDipGate` | walk through the dip | `EV.FOOTDIP gate` | biosecurity log | sign-gate |
| `prep-preheat` Start pre-heating | controller | thermostat +/− | setpoint ≥ 30 °C and burning | house air, slab and litter warm (§6.2) | sign-brooder |
| `prep-litter` Spread the litter | litter heap | E: depth card (2/5/8/10 cm); walk with the barrow | cover ≥ 95 % | `litter.depth`, `litter.spread` → cover grid, insulation, moisture capacity | sign-litter |
| `prep-drinkers` Lower the drinker lines | regulators `drinkers.0..3` | drinker panel: winch, pressure knob, flow test | `water.height` on all 4 lines | nipple height and flow per line | sign-water |
| `prep-feeders` Fill the pans | feeder box | per line: run, flood, pan height | all lines flooded, pans full | pan fill, feed access | feeder-box plate |
| `prep-silo` Check the silos | silos (outside N) | E: level gauge | `feed.silo` | none (reading) | silo plate |
| `prep-lights` Light program | light panel | hours of light (dark start, dark hours), dimmer; lux shown | `light.program` | lighting → intake (§6.5) | light-panel plate |
| `prep-vent` Min-vent timer | min-vent sign / controller | timer: fans, on-s, cycle-s | `vent.timer` | air exchange, heat loss, RH, ammonia | sign-vent |
| `prep-flush` Flush the lines (12:00–02:00) | water supply | flush valve per line; sight tube brown → clear (~10 farm min) | all 4 clear | water quality, water temperature at arrival | sign-water |
| `prep-record` Sign the prep checklist | office desk | office book prep page, *Sign* | `record.sign` | ends the prep day | — |

### 4.2 Dated jobs, days 0–7

| Job | Where | Action | Done when | Sim | Facts |
| --- | --- | --- | --- | --- | --- |
| `d0-floor` Measure the floor (06–08) | nearest brooder | **T** / job button: floor thermometer at the feet | 3 × `floor.probe` in 3 sectors | none (reading, noted) | sign-brooder |
| `d0-grade` Grade a sample box (truck +0..6 h) | chick table | inspection panel: 10 chicks × reflex / navel / hocks, weigh box, fill the grading sheet, *Hand in* | `grade.submit` | none; result = sheet vs true sample | sign-chicks |
| `d0-place` Place the chicks (truck +0..12 h) | box stacks | E pick stack (10 boxes); E tip inside the brooding area | `all-placed` | chicks placed where tipped; minutes in box; placement spread | sign-chicks, sign-brooder |
| `d0-vent` Vent temperatures (placed +1.5..4 h) | nearest brooder | E catch chick; *Take vent temperature* | 5 × `sample.vent`, 3 sectors | none (reading) | sign-chicks |
| `d1-crop` Crop check (placed +22..28 h) | nearest brooder | E catch; *Feel the crop* | 10 × `sample.crop`, 3 sectors | none; reveals crop fill (§6.4) | sign-chicks |
| `d7-weigh` Weigh sample birds (06–18) | bird scale spot | take scale + frame; E set frame; *Weigh next* / *Weigh all* | 50 × `sample.weigh`, 5 sectors | none; result = weighed mean, CV | bird-scale plate |

### 4.3 Routine jobs, every day 0–7
Morning round (06:00–12:00):

| Job | Where | Action | Done when | Sim | Facts |
| --- | --- | --- | --- | --- | --- |
| `r-dips` Enter through the foot dips | gate, house door | walk through both | gate dip, then `house:enter {dipped}` | entering without a dip adds infection pressure (§6.6) | sign-gate |
| `r-walk` Walk the house | brooding floor | walk; stand still 2 s to listen (caption "You hear: …") | 60 % of brooding cells + 1 listen | none; the farmer sees spread, droppings, sick and lame birds, hears sounds | sign-health, sign-brooder |
| `r-temp` Temperature against target | controller | open the controller (reads house, min/max since last check, setpoint) | panel opened | min/max since last read noted | sign-brooder |
| `r-meter` Read the water meter | water supply | panel: odometer litres, *Note it* | `water.meter` | reading noted; record computes litres/day and change vs yesterday | sign-water |
| `r-drinkers` Drinker flow and height | 4 regulators | flow test each line; winch, knob as wanted | `water.flowtest` × 4 lines | heights/pressures as set | sign-water |
| `r-feeders` Feeders and silo | feeder box + silos | feeder box (feed meter kg, pans, heights, flood off from day 3) and the silo gauge | `feed.meter` + `feed.silo` | pan fill, feeder height | feeder-box, silo |
| `r-vent` Minimum ventilation | min-vent sign / controller | timer section; *Set* (also when unchanged) | `vent.timer` | as prep | sign-vent |
| `r-lights` Light program | light panel | read lux, change program or *Keep* | `light.program` or `light.lux` | as prep | light-panel |
| `r-dead-am` Dead birds | nearest dead bird | E pick up (picks all within 1.5 m, farmer carries a bucket); E at the bin counts them | none left on the brooding floor, carried ones binned | `dead.count` → the record's deaths | sign-health |

Afternoon round (13:00–18:00): `r-dips-pm` (house dip), `r-walk-pm` (50 %), `r-temp-pm`,
`r-litter` (E anywhere on litter: *Squeeze a handful* → it falls apart / holds loosely / sticks and
cakes, plus the moisture-meter %; 3 squeezes in 2 sectors, one within 1 m of a drinker line),
`r-dead-pm`. Evening (16:00–24:00): `r-record` (office book, §8, *Sign today's record*).

### 4.4 Problem jobs (opened by a symptom, §7)
`p-water-drop` Find why the water intake dropped (done: *Clean the filter* on the blocked line's
regulator); `p-leak` Fix the leaking nipple (E at the leak: *Replace the nipple*); `p-wet-patch`
Fresh litter on the wet patch (E with a husk sack from the heap); `p-cold-night` Night check
(20:00–24:00: controller + 40 % walk); `p-order-feed` Order feed (office phone: kg, delivery next
morning 09:00); `p-report` Report abnormal deaths (office phone: company vet).

## 5. Signs and equipment plates (every fact and its source)

Package "level" writes these into `src/content-signs.js` (new) and extends `content.js`; package
"props" builds the 3D boards at `SPOTS2` (painted canvas faces, same style as the brooder sign).
Every line shows its source in small text. "general" = `GUIDES.general` ("general practice").
Equipment panels (feeder box, light panel, silo, bird scale, water supply, drinker line) carry their
facts on a **plate** column inside the panel instead of a separate board.

| Board / plate | Fact | Source |
| --- | --- | --- |
| sign-gate (Phase 1 + 1 line) | Dip boots in the foot dip and spray every vehicle; disinfect at the gate | Broiler Management 101 |
| | Report abnormal deaths straight away | Broiler Management 101 |
| | Farm clothes and boots before going near the houses | general |
| | Dip again at the house door, every time you go in | general |
| sign-brooder (Phase 1, table from day 0) | House temperature 34 °C on day 0–1, falling to 20 °C by day 35 (rows between: approx.) | Week 1 guide / Broiler Ventilation |
| | Pre-heat so the floor reaches 28–30 °C before the chicks arrive | Week 1 guide |
| | Read the chicks: huddled = cold; along the walls, wings out, beaks open = hot; evenly spread, eating and drinking = comfortable | Week 1 guide (Week 1–4 guides) |
| | Measure the floor with a thermometer at chick level, in several places | general |
| sign-water (north wall x −20) | Flush the water lines 12 h before the chicks arrive | Week 1 guide |
| | Water flow per nipple = age in days + 20 ml/min; test with a cup for one minute | Broiler Management 101 / Week 1 guide (the cup test: general) |
| | Nipple height sets the drinking angle: chicks drink at eye level with the head a little up; raise the line as the birds grow so they stretch up | Broiler Management 101 / Week 1 guide |
| | About 45° for chicks, 75–85° for older birds | general |
| | Water to feed: about 1.6–2.0 L of water per kg of feed in the first week; more when hot | general |
| | Read the meter at the same time every morning; a drop in intake is the first warning: check the lines that day | general |
| | Water quality: clear, no smell, pH 6–8 | general |
| sign-vent (north wall x −8) | Minimum ventilation brings fresh air in and moisture and ammonia out, even on cold days | Broiler Ventilation |
| | Fresh air per 1,000 birds: 150 m³/h at 40 g, 290 m³/h at 100 g, 480 m³/h at 200 g | general |
| | Timer: on-seconds = cycle seconds × air needed ÷ (fans × 36,000 m³/h per 50-inch fan); cycle 300 s | general |
| | Keep the litter at or below 30 % moisture | Broiler Ventilation |
| | Each 5 % of humidity the air can still take up gives about 1 °C of pad cooling | Broiler Ventilation |
| sign-litter (north wall x 0) | Keep the litter at or below 30 % moisture | Broiler Ventilation |
| | Squeeze a handful: falls apart = dry; holds, then breaks when you open the hand = right; sticks together = too wet | general |
| | 5–10 cm of dry rice husk, spread evenly before pre-heating | general |
| | Wet spots under drinkers: look for a leaking nipple or too much pressure; cover with fresh litter | general |
| sign-chicks (outside, south wall x −17) | On arrival check reflex, navel, hocks and uniformity | Week 1 guide |
| | Reflex: on its back a chick rights itself within 3 s; navel closed and dry; hocks clean, not red | general |
| | Vent temperature 2–3 h after placing | Week 1 guide |
| | Vent 39.4–40.5 °C: comfortable; lower = cold, higher = hot | general |
| | Crop check at 24 h | Week 1 guide |
| | At 24 h at least 95 % of crops full and soft | general |
| | Get the chicks out of the boxes quickly, near feed and water | general |
| sign-health (outside, south wall x −11) | Report abnormal deaths | Broiler Management 101 |
| | Pick up dead birds every round, count them, put them in the bin | general |
| | Abnormal in week 1: more than 0.3 % of the flock dying in one day | general |
| | What huddling, panting, droppings and breathing sounds tell you (pictures: firm brown droppings with a white cap / watery / none; quiet chirping / loud peeping / snicking) | Week 1–4 guides |
| | Weak, lame or sick birds sit apart with fluffed feathers and closed eyes: cull them | general |
| feeder-box plate | Days 0–3: flood the pans so feed is easy to reach; then pan rim at the birds' back height | general |
| | Feed per bird per day, week 1: 9, 13, 17, 21, 25, 29, 33, 37 g (days 0–7) | general |
| silo plate | Order feed when the silos hold less than 2 days of feed | general |
| light-panel plate | 23 hours of light in the brooding week | Week 1 guide |
| | 30–40 lux at chick level in the first week | general |
| bird-scale plate | Week 1 target: 4–5 × chick weight; a missed week 1 costs growth later | Week 1 guide |
| | Weigh at least 50 birds from 5 places; uniformity = share within ±10 % of the mean | general |
| water-supply plate | Flush the lines 12 h before the chicks; read the meter at the same time each morning | Week 1 guide; general |

## 6. Flock simulation extensions (package "sim")

All formulas run in `farm.step(env, s, fast)` once per ≤ 60 game seconds (also during skips) and in
`sim.js` for the climate. Constants marked **model** are tuning values (never shown on a sign);
the engineer may tune them to pass the acceptance checks in §6.10, and documents changes here.

### 6.1 Guide facts the model and signs may cite
House temperature 34 °C day 1 → 20 °C day 35 (Week 1 guide / Broiler Ventilation); pre-heat floor
28–30 °C, flush lines 12 h ahead (Week 1 guide); reflex, navel, hocks, uniformity, vent temperature at
2–3 h, crop check at 24 h (Week 1 guide); week 1 weight 4–5 × chick weight and a missed week 1 costs
growth later (Week 1 guide); 23 h light in the brooding week (Week 1 guide); flow = age + 20 ml/min,
nipple angle, water-to-feed ratio, water quality (Broiler Management 101 / Week 1 guide, numbers for
ratio and quality: general); minimum ventilation per 1,000 birds and a fan timer (Broiler
Ventilation, numbers: general); litter ≤ 30 % moisture, 5 % humidity ≈ 1 °C (Broiler Ventilation);
huddling, panting, droppings, breathing sounds (Week 1–4 guides); disinfect at the gate, report
abnormal deaths (Broiler Management 101). Nothing else may carry a guide name.

### 6.2 Climate additions (sim.js)
- **Slab and floor.** `env.slabTemp` follows the brooding-floor air: dSlab/dt = (T̄air − slab) / τ,
  τ = 20 h (model); start 23 °C in the cool season (model). Litter surface
  `floorTemp(x,z) = slab + k·(houseTemp + brooderHeat(x,z) − slab)` with k = 0.1 on bare concrete and
  k = 0.25 + 0.04·depth_cm with litter (model). The slab is a heat sink on the house air:
  −0.3 /h·(houseTemp − slab) added to dT (model).
- **Minimum ventilation timer.** `setVentTimer({ fans, onSec, cycleSec })`, duty d = on/cycle. The
  heat balance and air exchange use manual fans + fans·d; the visible `fansOn` equals `fans` during
  the on-part of the cycle (phase from the game clock) so blades and the controller LED cycle.
  Airflow `env.airflowM3h` = 250 (infiltration, model) + (manual + fans·d)·`EQUIP.fanM3h`.
- **Humidity.** RH rises with the flock's water out (droppings and breath ≈ 0.6 of water drunk) and
  litter evaporation, and falls with airflow (model). No min vent on day 5 → RH ≥ 85 %.
- **Weather events.** `addWeatherEvent({ id, fromDay, toDay, outsideDrop })` lowers `outsideTemp`
  by `outsideDrop` with 2 h ramps (cold night: −6 °C from day 2 19:00 to day 3 07:00, so about
  13 °C at 04:00 in the cool season).
- **Light.** `setLightProgram({ darkStart, darkHours, dimmer })`; `lightsOn`, `lightLevel` (dimmer
  while lit). Phase 1 default (dark 02:00–03:00, dimmer 1) unchanged. Lux at birds =
  `EQUIP.luxMax`·dimmer (model).

### 6.3 Chicks: delivery, boxes, placement, start
- Delivery (seeded): 6,000 chicks, mean 41.5 ± 1 g, CV 9 % (model); weak 1.0 % (open navel, black
  button, slow reflex), red hocks 4 % (model, the sample shows what the delivery has).
- **Box time**: from the truck stopping to a stack's tip. Hazard in the box 0.01 %/h for 3 h, then
  +0.05 %/h per extra hour (model). Deaths in boxes are shown at the tip ("2 dead in these boxes").
- **Late starters** L (did not find feed and water in 24 h), share of placed chicks (model):
  `L = 0.02 + 0.012·max(0, 28 − Tfloor_at_tip) + 0.004·hours_in_box + 0.06·(1 − flooded)
     + 0.08·(1 − A_water_24h) + 0.03·[light < 20 h] + 0.03·[tips in < 3 sectors]
     + 0.01·(hours in the first 24 h with e < −2)`, clamped 0.02–0.6.
- **Crop fill at 24 h** (true) = 1 − L − 0.5·weak share. ≥ 95 % (general) needs L ≲ 4 %.

### 6.4 Water lines (farm.water)
- Flow per nipple: `f = 2·pressureCm + 4` ml/min (model: 8 cm ≈ 20 ml/min), × (1 − blocked).
- Need: `flowTargetAt(day)` = age + 20 (guide). Line access
  `a = clamp(f / need, 0, 1)^0.6 · hf` with height factor from Δ = height − `nippleHeightCmAt(day)`:
  too high Δ > 0: hf = clamp(1 − 0.12·Δ, 0.05, 1); too low: hf = clamp(1 − 0.03·|Δ|, 0.7, 1) (model).
- Spill (to the litter under the line): 2 % of drunk + 15 % of the flow above 1.25 × need + 2 % per
  cm too low (model). A leaking nipple adds 0.6 L/h into its cell (model).
- Flock water access `A = 0.75·mean(a) + 0.25·max(a)` (birds move to the better lines, model).
- **Flush**: a line's `flushClear` rises 0 → 1 over 10 game min while its valve is open; 40 L per
  line through the meter (model). Water quality q = 1 if all lines ran clear within 24 h before the
  truck, else 0.85 (biofilm; model). Result for skills: hours from the last line clear to the truck.
- **Meter** = water drunk + spill + leaks + flush. Drunk = FI × r, r = 1.7 + 0.05·max(0, T − 26) L/kg
  (model, inside the sign's general 1.6–2.0).

### 6.5 Feed, intake, growth, uniformity (farm.flock)
- Standard intake FI_std (g/bird/day, general, on the feeder plate): 9, 13, 17, 21, 25, 29, 33, 37 for
  days 0–7 (day 0 counts from placement), eaten over the lit hours.
- Factors (model): **temperature** with e = felt temperature at the 70th-percentile-warmest point of
  the brooding floor − target: e < −1.5 → f_T = 1 − 0.12·(−1.5 − e); mean felt − target > 2 →
  f_T = 1 − 0.08·(over − 2); clamp 0.2–1. **Light**: f_L = 0.9 if lux < 20, × (1 − 0.04·(dark h − 1)).
  **Feed**: f_F = mean pan fill × (0.9 if not flooded on days 0–3) × (1 − 0.1·cm the rim sits above
  `feederRim(day)`). **Water**: f_W = A^0.8. **Air**: f_air = 1 − 0.01·max(0, NH3 − 20).
  FI = FI_std · f_T · f_L · f_F · f_W · f_air · cohort factor.
- Gain = FI ÷ feed-per-gain (1.0 days 0–2, 1.15 days 3–5, 1.25 days 6–7; model) × (1 − 0.04·cold
  deficit °C), capped at 1.1 × the `weightAt` daily gain. Perfect play ≈ 200 g at day 7 (4.8 ×).
- **Cohorts**: good (1 − L − weak), late (L: intake × 0.55 days 0–2, × 0.8 after), weak (× 0.6).
  Each has n, mean weight, CV. Within-cohort CV grows 0.004/day + 0.01·(1 − f_T) + 0.02·(1 − A) +
  0.015·(1 − f_F) per day (model). Flock mean, CV and **uniformity** (share within ±10 % of the mean)
  are computed from the mixture of normals; `weightQuantile(u)` from the same mixture.
- **Silo**: feed leaves the silo into the lines as the pans empty; `meterKg` counts it; empty silo →
  pans drain in ~3 h, then f_F → 0. Ordered feed arrives next day 09:00 (+ `order.kg`).
- **FCR** (record) = cumulative feed ÷ (alive × mean weight) (general definition).

### 6.6 Mortality (farm.flock.deadByCause), expected deaths per game minute, emitted as whole birds
Fractional accumulators per cause (seeded jitter), `EV.FARM_DEATH { n, cause }` each time one
passes 1. All rates **model**:
- weak cohort: 0.6 %/h days 0–1, 0.25 %/h days 2–4, 0.05 %/h after (≈ 40 % of weak chicks die);
- starve-out (late cohort): 0.15 %/h days 2–5 (≈ 15–25 % of them);
- cold: e < −4 → 0.02 %/h × (−4 − e)² of the flock (chilling, smothering in piles);
- heat: mean felt − target > 4 → 0.03 %/h × (over − 4)²;
- dehydration: A < 0.5 → 0.05 %/h × (0.5 − A) / 0.5;
- other: 0.002 %/h from day 3, × (1 + 0.3 per biosecurity lapse), × 1.5 if q < 1;
- box: §6.3.
`flock.sick` = expected deaths of the next 12 h (the flock draws that many sick birds).
Culling a caught sick bird moves it from a future death to `culls`.

### 6.7 Litter, moisture, ammonia (farm.litter, FLOOR_GRID 48 × 12 cells of 1 m²)
- Litter mass per cell = depth_cm × 1 kg (rice husk ≈ 100 kg/m³, model); fresh husk 12 % moisture.
- Water in per cell: 35 % of water drunk spread over the brooding cells (× 1.5 under the drinker
  lines), plus spill along each line's cells, plus the leak; moisture % = water ÷ (dry + water).
- Drying per hour: 0.04 × (m − 12) × (1 + airflow/20,000) × vapour deficit factor (model).
- Caking: a cell above 40 % for 6 h is caked (drawn darker, lumpy; squeeze reads "wet and caked").
- Ammonia ppm = (alive/1000) × age^1.2 × (0.4 + mean m / 20) × 900 ÷ airflow (model).
- `meanMoisturePct` over the brooding cells. The record shows the mean of the farmer's squeezes.

### 6.8 Readings and samples (what the instruments show)
`floor.probe` floorTemp ± 0.2 °C · `sample.vent` 40.0 + 0.30·(felt at the bird − target) ± 0.25,
clamped 37.5–42 (model) · `sample.crop` full-soft with p = crop fill; otherwise hard if water access
was the limit, soft-watery if feed was, else empty · `sample.grade` a chick of the true delivery
(weak: navel open/black button 60 %, reflex > 3 s 70 %; others: healed 97 %, reflex 0.8–2.5 s; red
hocks 4 %) · `sample.box` 100 chicks + 0.35 kg box · `sample.weigh` a bird of its cohort ± 1 g ·
`water.flowtest` ± 0.5 ml · `water.meter` integer litres · `feed.meter` integer kg · `feed.silo`
± 2 %, to 10 kg · `litter.squeeze` cell ± 1 % with the feel (< 25 dry, 25–30 right, 30–38 sticks,
> 38 wet) · `light.lux` ± 2.

### 6.9 Sounds and sights the flock gives (package "flock" reads the model)
`flock.sounds()`: distress (share of cold or hungry/thirsty birds), contented, snick (NH3 > 15 ppm).
Droppings look (`farm.flock.droppings`: 'normal' | 'watery' (heat, high water:feed) | 'few' (low
intake)) is shown by props on the litter and as a line in the listen caption.

### 6.10 Acceptance (sim) — `node scripts/test-sim.mjs`
Management profiles are scripted through `farm.act` and env setters with `env.skipHours`:
| Profile | Expect at day 7 |
| --- | --- |
| **ideal**: pre-heat 34 °C from 07:00 day −1, 8 cm litter, flush 20:00, flows and heights by the sign every morning, flood days 0–3, 23 h light, timer by the sign, problems found and fixed the same day, feed ordered day 5 | ratio 4.6–4.9, uniformity ≥ 75 %, deaths ≤ 0.9 %, FCR 0.85–0.95, litter ≤ 28 %, NH3 < 10 ppm, crop fill ≥ 95 % |
| **late pre-heat** (setpoint at 02:00 day 0), rest ideal | floor ≥ 28 °C on < 50 % of the brooding floor at 08:00; crop fill 85–93 %; ratio 4.3–4.6 |
| **no flush** | q = 0.85; deaths + 0.1–0.3 % over ideal |
| **neglect**: pre-heat 4 h, no flood, flows never set (pressure 4 cm), blocked line never found, no feed order | ratio < 4.0 and/or deaths > 2 % (level fails) |
| **cold night, timer 3 fans 60/300 s** | house below 31 °C at 04:00 day 3, cold deaths > 0, uniformity −3 points or more vs ideal |
| **no min vent** | RH ≥ 85 % and litter ≥ 30 % by day 6, NH3 ≥ 20 ppm |
| **leak unfixed 24 h** | leak cell ≥ 45 % and caked |
| **determinism** | same seed and inputs → identical records (byte for byte) |

## 7. Problem events

Scheduled in `LEVEL1.problems` (same schedule on every replay so the farmer can compare weeks; open
question 4). The farm starts them silently; a problem **job** opens only when the farmer meets a
symptom (`EV.FARM_PROBLEM { phase: 'symptom' }`, emitted by the farm on the triggering action or by
props/flock on proximity). Nothing ever says what the cause is.

| Problem | Starts | What changes | Symptoms that open the job | Fix |
| --- | --- | --- | --- | --- |
| `cold-night` | day 2 19:00 → day 3 07:00 | outside −6 °C (≈ 13 °C at 04:00) | the office radio in the day 2 record panel: "Tonight cold, down to 13 °C" → `p-cold-night` (20:00–24:00) | keep the brooders able to hold the setpoint: timer not above the sign's minimum, setpoint as the sign. With 3 fans 60/300 s the house falls below 31 °C |
| `blocked-line` | day 3 02:00 | line 2 regulator filter: blocked 0.75 (flow ≈ 5 ml/min) | morning meter read ≥ 8 % below yesterday's 24 h (the meter panel shows yesterday's reading beside today's); a flow test on line 2; 3 s within 2 m of line 2 (chicks pecking at dry nipples, sight tube low) → `p-water-drop` | regulator panel *Clean the filter* (5 game min) |
| `leaking-nipple` | day 4 10:00 | line 3 nipple at x −9.15 drips 0.6 L/h into its cell | a squeeze within 2 m; walking within 1.5 m once the cell is ≥ 35 % (dark wet patch, drip); the afternoon litter check → `p-leak`, then `p-wet-patch` | E at the nipple: *Replace the nipple*; then fresh husk from the heap on the patch (cell back to 15 %, caking gone) |
| `low-silo` | day 5 06:00 | silo set to 260 kg (short delivery): empty about day 6 14:00 | a silo reading on day 5 or later → `p-order-feed` | office phone: order kg; truck at the silo next day 09:00 (ordered before 16:00) |
| `abnormal-deaths` (conditional) | any day | — | dead birds counted at the bin in one day > 0.3 % of the flock → `p-report` | office phone: report to the company vet (record note) |

Biosecurity lapses (house entered without the house dip, `house:enter { dipped: false }`) are counted
by the farm (§6.6 "other"). They are listed as plain facts in the day's record ("house entered
without the foot dip: 1 time").

## 8. Flock records (office desk, `office-desk` panel)

A ledger book drawn on the panel, tabs: **Today** · **Week** · **Graphs** (unlocks) · **Phone**.
The radio forecast line sits on top of *Today*. The notebook (key N) shows the same readings while
walking.

**Today** lists what the farmer measured today, from the notebook, in the order of the job list:
meter reading, feeder meter and silo, flow per line, nipple heights, floor and vent temperatures,
crop tally, litter squeezes, dead birds counted (by place picked up), the controller min/max he saw,
light program, vent timer. A reading not taken shows "—  not read". *Sign today's record* closes
the row. Nothing is coloured as good or bad.

**Week** (one row per day, −1..7; the prep day row only lists the prep checks):

| Column | From | Note |
| --- | --- | --- |
| Alive | placed − counted deaths − culls | what the farmer knows |
| Deaths (culls) | bin counts that day | + causes are not shown (the farmer did not see causes) |
| Mortality % | cumulative counted ÷ placed | |
| Feed kg, g/bird | feed meter: this morning − yesterday morning | "24 h to this morning" |
| Water L, ml/bird, change % | water meter, same 24 h | change vs the row before |
| Water : feed | water L ÷ feed kg | |
| Weight g | automatic bird scale (platform in the brooding area; reads +2 % ± 3 %, model); day 7 the hand weighing | source shown: scale / weighed |
| Target g | `weightAt(day)` | general |
| × chick weight | weight ÷ the graded chick weight | the Week 1 guide target 4–5 × in the header of day 7 |
| Uniformity % | day 7 weighing only | |
| FCR | cumulative feed ÷ (alive × weight) | general definition |
| Litter % | mean of today's squeezes | |
| House min / max, target | controller memory, if the controller was read that day | |
| Light h | light program, if checked | |
| Notes | problems found / fixed, deliveries, feed ordered, jobs not done, dips missed | plain facts |

**Graphs** (after unlocks): water trend (litres per 1,000 birds and water : feed by day, unlock
`waterTrend`). The brooder chart (`brooderChart`) lives on the controller.

## 9. Skill tree

Screen (key K or the job card button; pauses the clock): eleven branch cards in a 4-4-3 grid, each a
low-poly badge drawn in SVG, the branch name, three level pips and what each level unlocks. The two
earnable branches show a point bar (`SKILL_LEVEL_POINTS` 4 / 9 / 15) and their milestones: the result
in the farmer's words, its points, and, when earned, the measured value ("4.6 × chick weight").
The other nine read "Comes in a later level" (names to confirm, open question 1).

Milestones (`MILESTONES` in `src/skills.js`, rules there): Brooding — floor-ready 2, graded 1,
placed-fast 1, vent-checked 1, crop-fill 1/2, steady-heat 2, day7-weight 1/3, low-mortality 1
(max 13). Water — flushed-on-time 2, nipples-day0 1, flow-matched 2, drop-spotted 2, leak-fixed 1,
meter-daily 1, raised-with-flock 1, ratio-steady 1 (max 11). A milestone is earned once per profile;
a replay can raise it to its higher tier.

Unlocks (`UNLOCKS`): Brooding 1 → **floor thermometer view** (key F: a colour band map of the litter
temperature over the brooding floor with a °C legend; a continuous blue-to-orange scale, no good/bad
colours); Brooding 2 → **24-hour temperature chart** on the controller (house and target); Water 1 →
**water meter trend graph** (records Graphs tab and the meter panel); Water 2 → **all-lines
overview** on the water supply panel (last flow test, pressure and height of each line).

Points arrive at checkpoints (§ skills.js header). They show as a line in the day's record ("Skill
points: Water +2, lines flushed 13 h before the chicks") and on the result screen; the job card's
Skill tree button gets a dot. No pop-up praise.

## 10. Level end and fail rules

- The level ends when the **day 7 record is signed** after the weigh-in, or at day 8 06:00 by
  itself (then the bird-scale weight is used and the result says "not weighed by hand").
- **Pass**: day 7 mean ≥ `LEVEL1.fail.weightRatioMin` (4.0) × chick weight **and** deaths + culls
  ≤ `LEVEL1.fail.mortalityMaxPct` (2.0 %) of chicks placed (true counts, not only those picked up).
  Chick weight = the farmer's box weighing, or the delivery note (true mean) if he did not grade.
- **Fail early**: at any day's close, if deaths + culls already exceed 2.0 %, the result screen opens.
- Result screen: the week table (§8), then four numbers large — day 7 weight "× chick weight" with
  the target band 4–5 × (Week 1 guide), deaths %, uniformity %, FCR — the points earned this level,
  and either **"Level 1 complete"** (Level 2 comes in a later phase; *Keep walking the farm* stays on
  day 7) or **"Level 1 not passed: <the measured reason>. Replay the brooding week."** Buttons:
  *Replay Level 1* · *Skill tree* · *Back to the title*. The reason is a measurement ("day 7 weight
  3.8 × chick weight", "deaths reached 2.4 % on day 5"), never a judgement word.

## 11. Autosave

`src/save.js` (complete): `createSaveStore()` over `SAVE.key` and `SAVE.profileKey`, every access in
try/catch; a save of another version is ignored.
- **What**: `{ level: level.serialize(), env: {day, hour, weather, houseTemp, slabTemp,
  heaterSetpoint, heaterLevel, fansOn, padOn, ventTimer, lightProgram, weatherEvents}, farm:
  farm.serialize(), records: records.serialize(), props: props.serialize(), player: {x, z, yaw} }`.
  Grids as integer arrays (moisture × 10). Target < 60 KB. Skills live in the profile.
- **When** (level mode only): 2 s after a job is done, at each record signing, every 2 game hours,
  after a skip, on `visibilitychange` (hidden) and `pagehide`.
- **Load**: the title card's *Continue — Day 3, 10:40*. Restore order: env → farm → records →
  props → flock (re-places the alive birds from the counts and sizes, dead birds on the floor
  scattered where they were by cause) → level (jobs, anchors). The artifact hot reload passes the
  same blob (`levelSave`).
- *Start Level 1* with a save asks by a second press ("Start again — replaces your day 3 save").
- Storage blocked: the game plays the same; the title card says "Saving is off in this browser".

## 12. New 3D content

All procedural, flat-shaded, merged where repeated, no external files (ARCHITECTURE.md rules). In
sandbox mode (`farm.mode === 'off'`) everything looks exactly as in Phase 1.

### 12.1 Package "props" (house, world, player and the new props.js)
1. **Floor states**: the house floor blends bare grey concrete and rice husk by a mask from
   `farm.litter.coverGrid` (DataTexture, 2 texels per cell), darkens wet cells from `moistureGrid`
   (> 30 % damp, > 38 % wet sheen, caked cells darker and lumpy). Rewritten at most 2× a second, only
   when the grids changed.
2. **Litter heap** (husk cone on the apron, shrinks with cover), **wheelbarrow** pushed in front of
   the farmer (`player.carry('barrow')`; the swath paints the floor), husk sacks for the wet patch.
3. **Prep look**: drinker lines and feeder pans at the heights the farm holds (`farm.water.lines[i].
   heightCm`, `farm.feed.lines[i].heightCm`) instead of Phase 1's age tables; regulator sight tubes
   coloured by `flushClear` (brown → clear); pans show the feed level (`panFill`), flooded pans heaped;
   house lights dimmed by `env.lightLevel`.
4. **Chick truck**: low-poly hatchery truck (cab, ventilated box body, rear doors), drives in from the
   gate along `FARM.road` to `SPOTS2.truckStop` (about 8 s real), doors open, leaves after the last
   stack. The same truck body with a blower pipe brings feed to the silos (`low-silo` fix).
5. **Chick boxes**: 6 stacks × 10 perforated cardboard boxes on the path (`SPOTS2.boxStacks`);
   interactables `box-stack-0..5` (use: pick up → `EV.BOX_PICK`, `player.carry('boxes')`); inside the
   brooding area E tips them (`farm.act('chicks.tip', { stack, chicks, x, z })`, `EV.BOX_TIP`, tip
   animation, empty boxes go to a pile by the door). A stack cannot be tipped outside `BROOD_BOUNDS`.
6. **Chick sample table** (`chick-table`): folding table, an open box with 10 small chick models (own
   tiny instanced mesh, not the flock), box scale.
7. **Hand scale and catching frame** (day 7, `bird-scale`): a hanging scale on a tripod with a
   bucket; E with the frame sets a 1 × 1 m wire pen down at the farmer's feet (`flock.catchGroup`).
   **Automatic bird scale**: a small hanging platform at `SPOTS2.birdScale`.
8. **Water supply** (`water-supply`): the Phase 1 meter gets a readable dial; a manifold with four
   flush valves (handles turn when open); at each line's east end a spout runs while flushing.
   Regulators: interactables `drinker-0..3` at `SPOTS2.drinkers`.
9. **Leaking nipple**: drip particles and a growing dark patch at the leak (`leak` interactable,
   enabled while the leak exists).
10. **Feeder control box** (`feeder-box`, north wall x −22) with its plate; **light panel**
    (`light-panel`, x −4) with dimmer knob; **silo gauge** (`silo`, on the silo leg, level strip
    from `farm.feed.siloKg`).
11. **Sign boards**: `sign-water` (x −20), `sign-vent` (x −8), `sign-litter` (x 0) on north-wall
    columns facing south; `sign-chicks` (x −17) and `sign-health` (x −11) on the outside of the south
    wall; painted canvas faces (title, pictograms, short lines) in the brooder sign's style. An orange
    "facts" tab appears on a board while the current job links to it (`props.highlight(ids)`).
12. **Dead bird bin** by the door (`dead-bin`, use: drop the carried birds → `EV.DEAD_DROP`,
    `farm.act('dead.count', { n })`), the bucket in the farmer's hand while carrying.
13. **Office desk** (`office-desk`): a porch table with the record book, a phone and a small radio.
14. **Floor thermometer view** (unlock `floorOverlay`, key F): a plane 3 cm over the brooding floor
    with a 96 × 24 DataTexture from `farm.floorTempAt`, continuous blue (≤ 24 °C) → orange (≥ 36 °C).
15. **Triggers** (`props-triggers.js`): foot dips (`EV.FOOTDIP`, rectangles at `FARM.footDipGate`
    and `FARM.footDipHouse`, with a splash), house enter / exit (`dipped` = the house dip was crossed
    in the last 10 s), `EV.CELL` on each new floor cell inside, `EV.LISTEN` after 2 s standing still
    inside with no panel open (once per stop).
16. **Farmer**: `player.carry(kind)` meshes (barrow, boxes, bucket, scale, chick in hands) and
    `player.pose('crouch' | 'reach')` short poses (probe, squeeze, pick up, valve).
17. **Droppings** (optional if time): sparse droppings decals on the brooding litter;
    `farm.flock.droppings === 'watery'` adds a wet sheen.

### 12.2 Package "flock"
1. **Empty house** before placement; **spilling chicks** at each tip (`placeBatch`: the stack's
   birds appear within 1 m of the tip over 2 s and walk out toward feed, water and warmth).
2. **Population**: drawn birds = round(`farm.flock.alive` / `BIRDS_PER_INSTANCE`); each death hides
   a bird matching the cause and lays a **dead bird** there (InstancedMesh, lying on its side, up to
   128): cold → at the edge of piles; weak / starve-out → alone, away from feed; dehydration → near
   the worst line; other → anywhere.
3. **Uniformity**: each bird keeps a quantile u from placement; size = cbrt(`weightQuantile(u)` /
   mean) around the day's mean, so a spread-out flock looks uneven. Late starters are the small ones.
4. **Sick and lame birds**: about `farm.flock.sick / BIRDS_PER_INSTANCE` birds sit apart, fluffed
   (body scaled up a little), eyes closed (eye part hidden), rarely eat; a few lame birds limp.
5. **Access behaviour**: birds weight nipples by line access (a blocked line: crowding and repeated
   pecking, then drifting to other lines); empty pans: pecking at empty pans, restless walking; cells
   with litter > 40 % are avoided; lux < 20 → less walking; dark period → resting (Phase 1).
6. **Catching**: `catchNearest` hides the bird while a sample panel is open (`player.carry('chick')`),
   `releaseBird` puts it back at the farmer's feet and it runs off. `catchGroup` herds n nearest
   birds into the props frame and holds them until released.
7. **Dead bird pickup**: interact provider `dead-bird` (E "Pick up dead birds": all within 1.5 m) →
   `EV.DEAD_PICK`; `flock.dead.count` for the job's `dead-cleared` rule.
8. **Sounds** (`flock.sounds()`): distress, contented, snick (§6.9).

## 13. Contracts between packages (in code now)

Shared, integrator-owned and frozen for the packages: `src/config.js` (new constants after the
Phase 2 banner), `src/events.js` (bus + `EV`), `src/interact.js` (registry), `src/main.js` (wiring:
`ctx.events`, `ctx.farm`, `ctx.records`, `ctx.skills`, `ctx.interact`, `ctx.colliders`,
`ctx.player`, `ctx.flock`, `ctx.level`; step order env → player → world → house → props → flock →
ui → level), `build.mjs`, `scripts/shoot.mjs`. Need a change there? Write it in your report; the
integrator makes it.

### 13.1 Event catalogue (`EV`, payloads in `src/events.js`)
| Event | Emitted by | Used by |
| --- | --- | --- |
| `footdip`, `house:enter`, `house:exit`, `farmer:cell`, `listen`, `boxes:pick`, `boxes:tip`, `litter:spread` | props | jobs, farm (lapses), records |
| `probe` | ui (T key) | jobs (via the action), ui floating label |
| `bird:pick`, `bird:release`, `dead:pick`, `dead:drop` | flock / props | jobs, ui |
| `farm:death`, `farm:placed`, `farm:problem`, `farm:delivery` | farm | flock (deaths), props (truck), jobs (problem jobs) |
| `record:closed`, `skill:points`, `skill:unlock` | records / skills | ui, level, props (overlay unlock) |
| `panel:open`, `panel:close`, `action` (ui-only actions), `job:*`, `level` | ui / level / farm (`action`) | jobs, records, tests |

### 13.2 Actions (`farm.act(id, args)` → result, then `EV.ACTION { id, ...args, result }`)
UI-only actions are emitted by ui with the same shape (marked ui).

| id | args | result | called by |
| --- | --- | --- | --- |
| `heat.setpoint` (ui) | `{ value }` | — | controller panel (after `env.setHeaterSetpoint`) |
| `vent.timer` | `{ fans, onSec, cycleSec }` | true | controller vent section (farm calls `env.setVentTimer`) |
| `light.program` / `light.lux` | `{ darkStart, darkHours, dimmer }` / `{ x, z }` | true / `{ lux }` | light panel |
| `litter.depth` / `litter.spread` (quiet) / `litter.patch` / `litter.squeeze` | `{ cm }` / `{ x, z, r }` / `{ x, z }` / `{ x, z }` | true / `{ cover }` / true / `{ moisturePct, feel }` | heap card / props barrow / props sack / ui |
| `floor.probe` | `{ x, z }` | `{ tempC }` | ui (T) |
| `water.flush` | `{ line, on }` | `{ flushClear }` | water supply panel |
| `water.pressure` / `water.height` | `{ line, cm }` | true | drinker panel |
| `water.flowtest` | `{ line }` | `{ mlMin }` | drinker panel |
| `water.meter` | `{}` | `{ litres, yesterdayLitres }` | water supply panel |
| `water.clearBlock` / `water.fixLeak` | `{ line }` / `{ line, x }` | `{ fixed }` | drinker panel / leak use |
| `feed.line` | `{ line, running?, flood?, heightCm? }` | true | feeder box |
| `feed.meter` / `feed.silo` / `feed.order` | `{}` / `{}` / `{ kg }` | `{ kg }` / `{ kg }` / `{ arriveDay, arriveHour }` | feeder box / silo / office phone |
| `chicks.tip` | `{ stack, chicks, x, z }` | `{ placed, deadInBoxes }` | props (farm emits `farm:placed`; flock spills) |
| `chicks.cull` | `{ n, reason }` | true | chick-in-hand panel |
| `dead.count` | `{ n, causes }` | true | props bin |
| `sample.box` / `sample.grade` | `{}` / `{ i }` (0..9) | `{ chicks, weightKg, boxKg }` / `{ reflexSec, navel, hocks, weightG }` | inspection panel |
| `grade.submit` (ui) | `{ sheet: { navelBad, redHocks, slowReflex, weightG } }` | — | inspection panel |
| `sample.vent` / `sample.crop` / `sample.weigh` | `{ x, z, index }` | `{ tempC }` / `{ crop }` / `{ weightG }` | chick-in-hand / scale panels |
| `record.sign` | `{ day }` | the row | office desk (records.sign) |
| `phone.report` (ui) | `{}` | — | office phone |
| `sign.read` (ui) | `{ id }` | — | panels (fact links) |

### 13.3 Interactables (`ctx.interact`) and panels
| id | registered by | E does |
| --- | --- | --- |
| `sign-gate`, `controller`, `sign-brooder` | world / house (Phase 1) | panel |
| `sign-water`, `sign-vent`, `sign-litter`, `sign-chicks`, `sign-health` | props | panel (ui content-signs) |
| `feeder-box`, `light-panel`, `water-supply`, `drinker-0..3`, `silo`, `office-desk`, `chick-table`, `bird-scale`, `litter-heap` | props | panel (ui) |
| `box-stack-0..5`, `dead-bin`, `leak`, tip spot (provider `tip`) | props | `use()` |
| providers `chick` (answers only while `level.sampling` is set by an open sample job), `dead-bird` | flock | `use()` → catch → ui opens the chick-in-hand panel / pick up |
| provider `litter` (squeeze anywhere on litter while `r-litter` or a litter problem is open; else via the notebook button) | ui | squeeze |

The ui keeps Phase 1's rule: E picks the nearest usable one; fixed ones beat providers.

### 13.4 State other packages read
- `farm.mode`, `farm.flock.{present, alive, sick, deadOnFloor, meanWeightG, cv, weightQuantile(u),
  droppings}`, `farm.water.lines[i].{heightCm, flushClear, access, leakX}`,
  `farm.feed.{siloKg, lines[i].{heightCm, panFill, flood}}`, `farm.litter.{coverGrid, moistureGrid,
  depthCm}`, `farm.floorTempAt(x, z)`, `farm.problems`.
- `env` (Phase 1 fields) + `ventTimer`, `ventDuty`, `lightLevel`, `slabTemp`, `floorTemp(x, z)`,
  `airflowM3h`, `dayNumber` (−1 on the prep day).
- `level.mode`, `level.jobs.current()` (props highlights its signs, flock enables catching),
  `skills.unlocked(key)`.

### 13.5 Keys (physical `KeyboardEvent.code`, as Phase 1)
E use · Esc close · H help · **T** floor thermometer (in the house) · **F** floor view (unlocked) ·
**N** notebook · **K** skill tree. Help card and title card list them.

## 14. Work packages (four, disjoint files, parallel worktrees)

Each engineer works in `git worktree add ../cf-<key> -b phase2/<key> main`, edits **only the files
listed** (new files with the listed prefixes are theirs too), codes against the stubs and contracts
of the others, and keeps `npm run build`, `node scripts/shoot.mjs --scenario cold-hot` and
`--steps scripts/phase1-jobs.json` (sandbox) passing. Stubs of other packages return placeholders:
test your side with synthetic events (`__game.events.emit(...)`) and by setting fields on the stub.

### 14.1 `sim` — simulation and records engine (branch `phase2/sim`)
**Owns:** `src/sim.js`, `src/farm.js` and new `src/farm-*.js`, `src/records.js`, `src/skills.js`,
`src/save.js`, `scripts/test-sim.mjs`. Pure logic: no three.js, no DOM (save.js may touch
`localStorage` only).
**Contract:** §6 (all formulas), §7 problem engine (start, symptom detection on actions it sees,
`EV.FARM_PROBLEM`), §8 record rows (`RecordRow` in records.js; notebook filled from `EV.ACTION`),
§9 milestone evaluation at checkpoints, §11 serialize/restore of farm, records, skills, the env
additions of §6.2, the `farm.act` ids and results of §13.2. Farm listens to `house:enter`
(lapses), `boxes:tip` is not needed (props calls `chicks.tip`).
**Acceptance:** `node scripts/test-sim.mjs` passes the §6.10 profiles and the contract tests;
sandbox unchanged (with `farm.mode === 'off'` the cold-hot metrics match Phase 1 within ±0.02);
`farm.step` ≤ 0.3 ms in node, a 24 h skip ≤ 150 ms; save blob < 60 KB and restore → serialize is
identical; record rows hold null for every reading not taken; no hidden value leaks into a row.

### 14.2 `level` — job system, level flow, skill tree and all UI, panels and sign content (branch `phase2/level`)
**Owns:** `src/level.js`, new `src/job-engine.js`, `src/content-jobs.js`, new
`src/content-signs.js`, `src/content.js`, `src/ui.js` and every `src/ui-*.js` (new: `ui-title.js`,
`ui-jobs.js`, `ui-equipment.js` (drinker, water supply, feeder box, silo, light, vent section),
`ui-inspect.js` (grading, chick in hand, scale), `ui-records.js` (office book, phone, radio),
`ui-notebook.js`, `ui-skilltree.js`, `ui-result.js`), `src/index.template.html`,
`scripts/p2-level-*.json`.
**Contract:** §1–§5, §8–§11 user-facing parts, the level API in `level.js`, job rules §3.2 over the
bus, `farm.act` for every farm change (never writes farm fields), emits ui-only actions, registers
panels for the ids of §13.3, uses `ctx.interact.nearest()` for E (fixed + providers), enables the
`chick` provider while a sample job is open, calls `props.highlight()` and `props.setOverlay()`,
keys of §13.5, clock speeds of §2, autosave timing of §11.
**Acceptance:** steps files run green in the harness: `p2-level-prep.json` (all ten prep jobs done
by synthetic events and real panel clicks, skip to day 0), `p2-level-day0.json` (truck anchor,
grading panel, six tips, vent window opens 1.5 h after the first tip), `p2-level-routine.json`
(a day's 15 jobs, a skip leaving 2 missed, record signed), `p2-level-problems.json` (each
`farm:problem symptom` opens its job; fix closes it), `p2-level-end.json` (pass and fail result
screens via `level.debug`), `p2-level-save.json` (`reload` → Continue → same jobs and day);
`grep -riE "correct|wrong|well done|good job|great job|mistake|perfect|excellent" src/ui*.js
src/content*.js` finds nothing; every sign item has a `source`; no horizontal scroll at 400 px;
sandbox mode still passes `phase1-jobs.json`.

### 14.3 `props` — 3D props and interactions in the house and on the farm (branch `phase2/props`)
**Owns:** `src/props.js` and new `src/props-*.js`, `src/house.js` and `src/house-*.js`,
`src/world.js` and `src/world-*.js`, `src/player.js` and `src/player-*.js`, `scripts/p2-props-*.json`.
**Contract:** §12.1, interactables of §13.3 (registered on `ctx.interact`, colliders pushed into
`ctx.colliders`), the trigger events of §13.1, `farm.act('litter.spread' | 'chicks.tip' |
'litter.patch' | 'dead.count' | 'water.fixLeak')` from the physical actions, `player.carry()` and
`player.pose()`, `props.highlight(ids)`, `props.setOverlay()`, `props.truck`, house reading the farm
heights/fill/lights in level mode and Phase 1 tables in sandbox.
**Acceptance:** `p2-props-look.json` shots (bare floor, half spread, full litter, wet patch and
caked cells, truck parked with stacks, farmer carrying boxes and the barrow, tipping, sight tubes
brown/clear, new boards readable at the default zoom, overlay on) reviewed; `p2-props-events.json`
prints the expected event counts (dip at the gate, house enter with dipped true/false, 60 % cells,
listen after 2 s); warm-up covers every new material (no shader compile after boot: check
`renderer.info.programs.length` before and after a full prop tour); ≤ 40 extra draw calls and
≤ 60 k extra triangles in the house view; the Phase 1 `tour` shots match in sandbox.

### 14.4 `flock` — flock extensions (branch `phase2/flock`)
**Owns:** `src/flock.js` and `src/flock-*.js` (new: `flock-pop.js`, `flock-dead.js`,
`flock-catch.js`, `flock-sick.js`), `scripts/p2-flock-*.json`.
**Contract:** §12.2, the flock API in `flock.js` (placeBatch, catchNearest, catchGroup, releaseBird,
dead, sounds, resetLevel), reads `ctx.farm` each update, listens to `farm:death`, emits `bird:pick`,
`bird:release`, `dead:pick`, registers the `chick` and `dead-bird` providers.
**Acceptance:** `p2-flock-*.json` (driving a stub farm by setting fields and emitting
`farm:death`): no birds before placement; six tips → 1,800 birds spread within 60 s of play; alive
drop hides birds and lays dead ones by cause; pick-up clears them; catch / release / group work;
size spread grows with `cv` (std of `S.size` reported); with line 1 access 0.3 the share of
drinkers at line 1 falls below half the others'; sick birds sit apart; ≤ +1 ms per frame at 1,800
birds (`flock.profile`); sandbox cold-hot metrics unchanged (±0.03).

## 15. Test hooks and harness scenarios

`window.__game` (main.js, in code): Phase 1 hooks plus `events`, `farm`, `records`, `skills`,
`save`, `props`, `interact`, `level`, `startLevel(opts)`, `nextJob()`, `jobs()` (key, status,
progress), and `snapshot()` now also gives `mode` and `farmMode`. Package hooks:
`level.debug.goto(day, hour, { auto })` (jump, routine jobs done for you), `level.debug.trigger(id)`,
`level.debug.result(pass)`, `farm.debug.trigger(id)`, `farm.debug.truth()`.
Harness (`scripts/shoot.mjs`): new steps `{"reload": true}` and `{"clearStorage": true}`; built-in
scenario `p2-hooks` (contract smoke test, passes on the stubs). Under automation the game boots in
the sandbox; steps files start a level with `{"eval": "__game.startLevel({ seed: 1 })"}`.
Integrator end-to-end (after merging): `scripts/p2-level1.json` — start, play the prep day with real
inputs, `goto(0, 7.9, { auto: true })`, truck, grade, tip six stacks, vent, `goto(7, 6)`, weigh 50,
sign, result screen shot; plus the four Phase 1 scenarios.

## 16. Integration order
1. Merge `sim` (pure; its tests run on main). 2. `flock` and `props` (either order; both read the
farm). 3. `level` last (it drives everything). After each merge: build, `test-sim`, `cold-hot`,
`tour`, `phase1-jobs`, `p2-hooks`, and the merged packages' steps files. Then `p2-level1.json`,
ARCHITECTURE.md updated, and a play-through recording for the farmer.

## 17. Open questions for the farmer
1. **Skill branches:** the plan has 11; this build names nine of them as placeholders (Feed &
   Feeders, Ventilation & Cooling, Litter & Air Quality, Lighting, Biosecurity, Flock Health, Growth &
   Weighing, Records & Costs, Catching & Harvest). Which names does the plan use?
2. **Day numbering:** arrival day = day 0 and the prep day = day −1 (as in "days 0–7")? Phase 1 called
   the arrival day "day 1".
3. **Flock size:** 6,000 chicks in a 48 × 12 m house (each drawn bird stands for 3.3). Your houses are
   likely bigger; is a small house fine for learning?
4. **Problems on replay:** same days every time (compare your weeks) or moved around (no memorising)?
5. **Fail limits:** day 7 under 4.0 × chick weight, or more than 2 % dead in week 1 — do these match
   your company's standards (some use 1 %)?
6. **Rounds:** morning = every check, afternoon = walk, temperature, litter, dead birds. Is that how
   you split it? Meter and silo once a day in the morning?
7. **Pre-heat:** how many hours do you pre-heat in the cool season, and how cold is your floor before?
8. **Chick grading:** do you grade a sample box at the truck yourself, or does the hatchery give the
   figures? Do you cull weak chicks at placement?
9. **Minimum ventilation:** does your controller use a fan timer (on-seconds per cycle) or a % setting?
   Real numbers for the sign would replace the general ones.
10. **Light:** 23 h at 30–40 lux in week 1 — do you dim after day 3 or day 7?
11. **Water : feed:** is 1.6–2.0 the figure you use in week 1?
12. **Feed orders:** do you order feed yourself or does the integrator deliver on a schedule?
13. **Pace:** does a 3–5 minute day feel right, and should a round get quicker once you know it?
