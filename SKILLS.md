# Chicken Farm — Skills update spec: skills that make playing easier

**Goal (the farmer, after Phase 5 and the night fix):** "This phase needs to better tie the skills in the game to making
things easier in the game." He chose: **every branch gets a three-step payoff**, all eleven branches (water and drinkers,
ventilation and heat, feed and silo, chicks, weighing and dead birds first), and **automation that sometimes fails** so the
manual skill still matters. Today 32 of the 33 unlocks (`config.UNLOCKS`) are information views: they help understanding
but save no time, walking or steps. After this update each branch level makes play noticeably easier in the area the branch
is about:

| Step | Name on the tree | What it gives |
| --- | --- | --- |
| Level 1 | **See more** | the branch's view (the existing level 1 unlock), easy to find: a key or a button where the job is done, named in the job strip when it helps |
| Level 2 | **Faster** | fewer steps, less walking, no arithmetic, more farm time: the routine job of the branch done in one place or one press |
| Level 3 | **The equipment does it** | a routine job handed to the farm's equipment, as a real controller does; the job stays on the card as a quick glance; rare faults hand it back |

Read with `ARCHITECTURE.md` (Phases 1–5, the farmer's requests, the night report and its check round), `PHASE2.md` §9 and
`PHASE3.md` §9 (the skill tree as it is), `PHASE4.md` §15 (the flock watch, held jobs, the bucket) and `PHASE5.md` §4 (the
settings menu). The shared contracts of this update are **in code now** (§12): the Skills section of `src/config.js`
(`SKILLS_UPDATE`, `PAYOFFS`, `SKILL_VIEWS`, `AUTO_SYSTEMS`, `AUTO`, `FAULTS`, `FAULT_PLAN`, `SKILL_STEP_NAMES`), four events and five
action ids in `src/events.js`, the perks (`src/perks.js`, working), the farm's automation and faults (`src/farm-auto.js`,
`src/farm-faults.js`: stubs with their state and result shapes, wired into `farm.js` as no-ops), the job variants
(`src/job-variants.js`: stub), the new milestones (`src/skills-payoff.js`: contract data), the sign lines
(`src/content-signs-skills.js`: contract data, merged behind the switch), the settings' `automation` group (hidden until the
package draws its tab), `skills.debug.force` and the `__game` hooks. §15 splits the work into **four packages with disjoint
files** — **model**, **jobs**, **panels**, **scene** — each section standing alone.

**Design round results (main, 960 × 600, seed 1):** `npm test` all passed (449 ok, with test-contracts' four skills cases);
`npm run build` 1,541 KB; `cold-hot` without console or page errors; `scripts/skills-design-stubs.json` 10 PASS (the hooks, the
switch, perks under automation, Water 2 / 3 forced while live, the Automation setting, a debug fault open and saved, the stub
actions, the hidden tab); `p5-design-stubs.json` 20 PASS as on main. `node scripts/skill-progress.mjs ideal` prints the
baseline below.

**Measured at the design round (node, seed 1, `runCycle`):** the ideal's points per branch after one cycle are Planning 17 ·
Biosecurity 19 · Brooding 16 · Comfort 15 · Heat & Ventilation 13 · Moisture 14 · Heating 14 · Water 20 · Feed 16 · Lighting 15 ·
Growth 17 — level 3 (15 points) in 8 of 11 branches inside the first flock. A careful player who slips now and then (§2.4) lands
at 10–17: level 3 in about half the branches in the first flock too. Today a milestone counts once per profile, so a second flock
adds nothing. §2 retunes both.

## 0. Rules that hold everywhere (approved design, do not break)

- **No lessons, no quizzes, no hidden-answer scoring.** A payoff never asks a question. Every new text (the tree's *saves*
  lines, the job card's hints, captions, the equipment row, fault lines, settings labels) is checked by test-contracts'
  `VERDICT` words: no "correct", "wrong", "good job", "well done", "mistake", "failed to" …
- **No "correct" / "wrong" messages anywhere.** The equipment reports what it did and what it reads ("Winches: lines 1–4 at
  24 cm, plate 24 cm"), a fault says what stopped and where to look; the farmer reads the gauges, the flock and the records.
- **Every sign fact shows its source.** The new sign lines (§3.12, `content-signs-skills.js`) are all **general practice**:
  nothing about controllers, winches, scales or sample sizes is on the closed guide lists (PHASE2.md §6.1, PHASE3.md §5.1). No
  page numbers. The guide PDFs and content-map.md are not in this repo.
- **Missing a level's key target fails the level and you replay it.** No target, limit or pass rule changes. A fault never
  silently costs a level (§5.4): it is raised on the flock watch at once with its cause and place, it stops a Next job skip and
  shows on the night check, it starts only where there is time to fix it, and a fix by hand always works.
- **Skill tree:** points come from doing a branch's jobs well in play; a milestone is a result, not a question; each branch
  level unlocks a tool or a view — after this update a **payoff** (§3) beside its view. Existing milestones stay (ids, texts,
  thresholds); three count samples against the job's need so a payoff never costs points (`vent-checked`, `vent-band`,
  `weighed-weekly`: §3.5, §3.8); four are added (§2.3).
- **Days pass in a few minutes of play** with Next job; desktop browser, English, low-poly flat-shaded procedural art, one
  self-contained page (three 0.160.0 from jsDelivr), ARCHITECTURE.md's publishing constraints (no `alert` / `confirm` /
  `prompt`, no `window.open`, no downloads, `localStorage` only inside try/catch, nothing sideways at phone width,
  `prefers-reduced-motion`).
- **Earlier phases keep working.** With `config.SKILLS_UPDATE.live` false (main now) nothing a player sees or the model does
  changes: test-sim byte-identical, every node test and steps file as on main. The integrator sets `live` true at the last merge
  (§16); from then on, under automation (a steps file, `navigator.webdriver`) **no payoff acts** until a steps file calls
  `__game.perks.allow(true)` (as the governor and the introduction stay off), so the Phase 1 sandbox, Phase 2's lone brooding
  week, Phase 3's cycle, Phase 4's conditions, Phase 5's panels and the night fix's `test-night` / `req-night` play as before.
  Node tests that build their own world (`runCycle`, `runProfile`, test-level, test-run) make no perks unless they ask for them.

## 1. Player experience walkthrough

### 1.1 The first flock (the tree fills up; level 1 and 2 arrive)
The planning day ends with **Farm Planning level 1** (the plan's own points, 6–7): the caption under the HUD reads *"Farm
Planning 1 · See more: the planning calculator at the office desk. Use it on the planning sheet."* The skill tree's card for
Farm Planning now shows three rows, each with what it saves:

> **Level 1 · See more** — Planning calculator at the office desk · *works the sums on the planning sheet*
> **Level 2 · Faster** — Pocket phone · *saves the walk to the office for every order, vet call and booking* · 2 points to go
> **Level 3 · The equipment does it** — The next plan is filled in from this cycle · *saves working the next plan by hand*

In the brooding week the floor thermometer (F) and the water trend graph come with the first points; at the brooding week's
end **Water 2** arrives (*"Water 2 · Faster: flow-test all four lines from the water supply. Saves the walk to 4 regulators on
flow-test mornings."*) and **Chick Arrival & Brooding 2** (three chicks for the vent and crop samples, a *Next chick* key: it
will help on the next arrival day). On day 8 the job card's *Check drinker flow and height* reads *Water 2: all four lines
from the water supply* and its marker points to the water supply in the south-west corner instead of the line 1 regulator; one
press runs the four one-minute tests at once and the strip lists each line's flow beside age + 20 ml/min; only a line that reads
outside ±3 ml/min sends him to its own regulator.

Through weeks 2–3 Heating 2 (*Set to the sign's row* beside the thermostat, the pre-heat time on the heat-loss readout),
Moisture 2 (*Fill the timer* in the minimum ventilation calculator: the flock's count and weight to seconds in one press),
Lighting 2 (*Program for day 15* on the Lights tab) and Biosecurity 2 (the bucket with a tally: every dead bird within 2.5 m in
one pick, counted at pickup, one bin trip a day) arrive. The job card shows the next payoff of the job in hand: *Weigh sample
birds — Growth 2 would weigh 25 birds instead of 50 · 4 points to go*. By the end of the first flock a careful player has level
2 in nine to eleven branches and **no level 3**: level 3 needs points from a second flock (§2.2).

### 1.2 The second flock (the equipment takes jobs over)
Each milestone can count once more in a second flock. Water reaches level 3 in the second brooding week: *"Water 3 · The
equipment does it: the winches keep the nipples at the drinker plate's height for the flock's age. Look at the heights when
you read the water meter."* From then on *Raise the drinker and feeder lines* reads *drinker lines: handled by the controller
(Water 3)* and is done by looking at the heights on the water supply panel (he reads the meter there every morning anyway);
the feeder half stays his until Feed 3. The flock watch card gains an **Equipment** row (*"Winches · timer · 2 on, reading"*).
The climate controller's read shows what each controller did since the last read (*"Timer: stepped to 1 fan 21 s / 300 s at
06:00 for 5,890 birds of 480 g"*), so the morning controller read is also the glance for the timer, the brooders, the stages
and the lights.

On day 24 of the second flock at 09:12 the line 3 winch motor stalls: the Equipment row turns red, the caption and the notebook
say *"Line 3 winch motor stalled at 31 cm (plate 33 cm) at 09:12; the other lines go on rising. Look at the drinker line 3
regulator: winch it by hand to the drinker plate's height and reset the motor (Water 3 hands it back until then)."* A Next job
skip stops there; the job card's line for the drinker part reads *Line 3: by hand at its regulator*. He walks to the line 3
regulator, winches it to 33 cm and presses *Reset the motor*: the row is steady again.

### 1.3 Harder flocks
Faults come more often in the harder flocks (§5.2): in the rainy season the controller comes back from a power cut with its fan
stages off until he sets them again at the fan panel (the generator runs only the fans switched on); in the hot season a fan
stage relay trips on a morning and a sensor drifts in the brooding week; a bad batch's chicks meet a drifting sensor or a fouled
scale; the water condition's lines meet a stalled winch. Each is caught by the flock watch (and the night check and the skip's
stops), each names its cause and where to look, each is fixed by doing the job by hand — the skill the first flock taught.

### 1.4 Keeping every job by hand
Settings → **Automation** (§7) switches the equipment off for every branch or one branch at a time: *"Drinker winches follow the
flock's age (Water 3)"*. With a branch off its jobs are done by hand exactly as before (the level 2 shortcuts stay, as keys he may
use or not). The tree shows *off in Settings* on that level-3 row.

### 1.5 Time saved (what a day costs, §14)
Measured by the play-time model of §14 (the farm day's jobs as the card lists them, walks between their places, panel presses
and waits) and by real input on day 16 (§13.3): with every branch at level 2 a routine day takes about a fifth less play time
than without skills; at level 3 about a third less, the rest going to the day's own problems. Expected numbers in §14.2.

## 2. The skill tree after the update (package "model" for the numbers, "jobs" for the tree)

### 2.1 Three steps per branch
Each branch keeps its three levels and its existing view unlocks (`config.UNLOCKS`, 33 keys, the tree's *also* line) and gains
two **payoffs** (`config.PAYOFFS`, 22 keys): level 2 *Faster*, level 3 *The equipment does it*. Level 1 *See more* is the
branch's existing level 1 view (§3.0 makes each one easy to find). One change of level in the views: **Feed's `siloDays` moves
to level 2** (it is the gauge the level 2 payoff works from) and `feedGraph` to level 3 (each branch still has one view per
level; test-contracts' `1,2,3` holds). The tree's card per branch lists, for each level: the payoff's name, its *saves* line
(what it saves in plain words), where it is used, and the view under it in small text (*also: Water meter trend graph*).

### 2.2 Points per flock and the level thresholds (`config.SKILLS_UPDATE`, switch `live`)
- **A milestone counts in up to two flocks.** Today a milestone's best tier is kept per profile and a second flock adds
  nothing. From `live`: each milestone keeps its best tier **per flock slot** — slot 1 while the profile's `cyclesDone` is 0
  (the first flock), slot 2 once a cycle is finished (`cyclesDone` ≥ 1: the second and every later flock, any condition). A
  branch's points = the sum over both slots of each milestone's tier points. A replay inside the same flock can only raise its
  slot's tier (as now); a third flock raises slot 2 only; a standard start's auto play is not the player's (`level.profile`
  snapshot / restore, as now). A Phase 2–5 profile (format v1, `earned` only) restores into slot 1.
- **Thresholds** `SKILLS_UPDATE.levelPoints` = **[4, 9, 22]** (was `SKILL_LEVEL_POINTS` [4, 9, 15], which stays the value
  while `live` is false). Level 1 and 2 come inside the first flock; level 3 needs points from a second flock: the ideal earns at
  most 20 in one flock (Water), so no branch reaches level 3 before the second flock starts, and every branch's two-flock
  maximum (32–40) is well over 22. `skills.levelPoints()` returns the thresholds in force; the tree, the job card and the
  perks read it (never the constant).
- `skills.points(branch)` = both slots; `skills.points(branch, { slot: 0 | 1 })` one; `skills.milestones(branch)` gives each
  milestone `{ tier, points, tiers2: [slot1Tier, slot2Tier], points2: [p1, p2] }`; EV.SKILL_POINTS carries `slot`.
- The tree shows each milestone as *2 · 3* (first flock · another flock, the best of each) with the measured detail of the last
  award; the bar's marks at 4 / 9 / 22 of a 32-point scale (the bar is clipped at its end for a branch over 32).

### 2.3 Milestones added (contract data `src/skills-payoff.js` `MILESTONES_PAYOFF`; rules by "model")
Existing milestones stay (ids, rules, texts). Four are added where a branch's normal cycle (§2.4) earned under 13 points in one
flock, so two careful flocks always reach level 3. Each is a measured result of the branch's own jobs; each threshold is on the
sign the job links (all general practice):

| id | Branch | Level, checkpoint | Text (the result in plain words) | Tier |
| --- | --- | --- | --- | --- |
| `night-air-w3` | Heat & Ventilation | week3, level-end | Night ventilation set on every evening of week 3 | 1: the night-comfort state (a quarter of the birds panting at most and none chilled for 30 farm minutes after 18:00, `job-engine.js nightComfortNow`) held on all 7 evenings of days 15–21 |
| `heat-deaths-fin` | Heat & Ventilation | finish, level-end | Heat deaths in the last week | 2: heat deaths days 36–41 ≤ 0.1 % of the birds alive at the level start |
| `dark-fin` | Lighting | finish, level-end | A dark period kept in the last week | 1: dark hours ≥ 4 on ≥ 4 of days 36–40 (the light sign: about 4–6 hours) |
| `dead-fin` | Biosecurity & Health | finish, level-end | Dead birds picked up on every round of the last week | 1: no r-dead-am / r-dead-pm missed on days 36–41 |

With them the ideal's one-flock points are Ventilation 16, Lighting 16, Biosecurity 20 (all others unchanged): no branch over
21, so the ideal's level 3 also waits for the second flock.

### 2.4 The normal profile (a careful farmer in his first flock; `farm-profiles-*.js`, package "model")
`normal` is the ideal's management with these slips, each one a thing players do, none failing a level (the model package
builds it on `cycleProfileOf` + a Phase 2 part, and `runCycle('normal')` plays the whole cycle from the plan):

| Where | Slip | Milestones it costs |
| --- | --- | --- |
| Brooding week | Phase 2's `smallMistakes` (regulators 6 cm off the sign, lines lowered on day 3, thermostat 1 °C under the row, the filter found in the afternoon of day 4) | flow-matched 2, day7-weight tier 1 instead of 3 (−2) (measured: `runProfile('smallMistakes')` Brooding 12, Water 9) |
| Brooding week | Vent temperatures taken 4 h after placing (out of the 2–3 h window) | vent-checked 1 |
| Week 2 | Light not measured on day 8 | lux-measured 1 |
| Week 3 | Droppings looked at on five birds only | droppings-read 1 |
| Weeks 4–5 | Air speed not measured on day 23; no pad check before the heat wave; one house dip missed (day 26); one dead-bird round missed (day 30 pm); flows off the band on 5 mornings | air-measured 1, heatwave-ready 2, dips-w45 1, dead-w45 1, flow-w45 1 |
| Finish | The crew booked on day 39 06:15 (under 3 days ahead); catching at 30 % dimmer; feeders left down in the heat wave; 1.6 t of feed left at the catch | catch-booked 1, catch-light 2, heat-feeders 1, last-order 2 |
| Weighing | Day 28 not weighed | weighed-weekly 2 |

Expected points of one normal flock (±2, the model package records the measured table here): Planning 14 · Biosecurity 18 ·
Brooding 13 · Comfort 15 · Ventilation 13 · Moisture 14 · Heating 14 · Water 17 · Feed 14 · Lighting 13 · Growth 15. A second
normal flock earns the same again.

### 2.5 Progression targets (acceptance: `node scripts/skill-progress.mjs`, in `npm test` as `test-skills`, §13.1)
The script plays `ideal` and `normal` twice through the whole cycle (plan → clean-out) on one skills object, `cyclesDone`
raised between them, `SKILLS_UPDATE.live` on, and prints the day each branch reaches each level. It asserts:

| Profile | After flock 1 | After flock 2 |
| --- | --- | --- |
| ideal | every branch at level 2; **none at level 3** (every branch ≤ 21) | every branch at level 3 |
| normal | at least 9 branches at level 2; none at level 3 | at least 9 branches at level 3 |

Expected days for the normal (from §2.4's table and the checkpoints' levels; the script prints the measured ones): level 2 in
flock 1 — Water and Brooding day 7, Heating day 14, Moisture, Biosecurity and Lighting day 21, Comfort, Feed and Growth day
35, Heat & Ventilation day 42, Farm Planning at the harvest; level 3 in flock 2 — Water and Brooding day 7, Biosecurity day 12,
Heating day 14, Moisture, Feed and Lighting day 21, Comfort and Growth day 35, Heat & Ventilation day 41, Farm Planning at the
harvest. A run started at the brooding week has no plan points (Farm Planning then reaches level 1 in a flock; noted).

## 3. The payoffs, branch by branch (`config.PAYOFFS`, `config.SKILL_VIEWS`)
Every payoff entry in config carries `{ branch, level, step: 'faster' | 'auto', name, saves, where, jobs, by }` (+ `system` and
`fault` for an automated one). `saves` is the tree's plain-words line, `where` the unlock caption's "use it at …", `jobs` the job
ids the payoff eases (the job card and the strips read it), `by` the package that builds it. **Time saved** figures are the
§14 model's per occurrence (walking at 4 m/s on the route, 2 s per press, the panel clock 24 game s per real s); the package
measures them.

### 3.0 Level 1 · See more (the existing views, easy to find)
Nothing new to earn; each view gets a key or a button **at the place the job is done** and a strip line in the jobs it helps
(`SKILL_VIEWS[key] = { shows, where, keyId?, jobs }`; the strip line reads *"Your Brooding 1 view: F shows the floor's warmth
under the brooders"*; with the view not unlocked yet the line reads *"Brooding 1 would show the floor's warmth (F) · 2 points to
go"*, once per job, never on a sign):

| Branch | View (L1) | Key / button | Jobs whose strip names it |
| --- | --- | --- | --- |
| Farm Planning | `planningCalc` planning calculator | the planning sheet's *Work the sums* key | pl-sheet |
| Biosecurity & Health | `symptomCheck` quick symptom check | the bird check's *Quick look* row (exists) | w2-check, p-lame, p-hunched |
| Chick Arrival & Brooding | `floorOverlay` floor thermometer view | **F** (exists); the floor probe's caption names it | d0-floor, prep-preheat, prep-litter |
| Body Temperature & Comfort | `comfortOverlay` comfort colours | **C** (exists) | r-walk, r-walk-pm, p-warm, p-heat3, r-vent-night |
| Heat & Ventilation | `windChill` wind chill readout | the fan panel's *Birds feel* line (exists) | r-fans-pm, p-heat3, p-panting, p-humid |
| Moisture & Min. Ventilation | `moistureOverlay` litter moisture view | **M** (exists) | r-litter, w3-topup, p-leak, p-damp, p-pad-wet |
| Heating | `heatLoss` heat loss readout | the controller's Temperature tab (exists); the night check card names it | prep-preheat, p-cold-night |
| Water | `waterTrend` water meter trend | **new:** a *Trend* key beside the meter on the water supply panel (the 14-day graph inline) | r-meter |
| Feed & Digestion | `droppingsGuide` droppings guide | the bird check (exists) | w3-droppings, p-blood, p-hunched |
| Lighting | `lightPresets` light presets | the controller's Lights tab (exists) | prep-lights, w2-lights, p-sds |
| Growth & Performance | `recordsTargets` records with targets | **new:** a *Records* line on the weigh panel: "Day 14 target 456 g (records)" | every weigh job |

The level 2 and 3 views (`brooderChart`, `lineOverview`, `sampleCard`, `comfortGraph`, `birdTemp`, `tunnelStages`, `fanChart`,
`minVentCalc`, `humidityChart`, `gasGraph`, `brooderZones`, `waterTest`, `siloDays`, `feedGraph`, `luxMap`, `dimming`,
`weightGraph`, `uniformityChart`, `planVsCycle`, `deadByLook`, `swabMap`, `planCarry`) stay where they are; the tree lists each
under its level as *also: …*. The help legend's F / C / M rows read *"(Brooding 1)"* etc. instead of *"(once unlocked)"*.

### 3.1 Water (water and drinkers)
**Level 2 · `waterAllLines` — Flow-test all four lines from the water supply.** *Saves the walk to 4 regulators on flow-test
mornings.* At the water supply panel (`SPOTS2.waterSupply`, south-west corner inside) the Lines section gets *Test all four
lines*: four `water.flowtest { line: i, from: 'supply' }` actions run together over one farm minute (the panel's farm-time note
as for one line: "Clock running: the four tests take 1 farm minute"), each line's reading in the strip beside age + 20 ml/min
(the drinker plate). `r-drinkers`' `each` part is met by the four actions; its live part (every flow within ±3 ml/min, nipples
at the plate) is unchanged, so a line out of band sends him to **that** regulator (the strip names it and its − / + key).
`job-next`: while the payoff holds, r-drinkers' places are the water supply, then only the regulators of lines out of band. No
model change (the same readings, the same noise). Time saved: about 20 s of play and 15 farm minutes per flow-test morning (3
regulators, 3 panels, 3 one-minute tests); 25 mornings a flock.
Sign line (water-supply plate, general): *"The four test valves at the supply run a one-minute flow test on every line at once;
set a line that reads off at its own regulator."*

**Level 3 · `autoWinch` (system `winch`) — The drinker winches follow the flock's age.** *Saves winching four drinker lines by
hand every three or four days.* Each line's winch motor (scene: a small grey motor box with a lamp at the line's west end, by
its regulator) keeps the nipples at `nippleHeightCmAt(env.dayNumber)` (the drinker plate; the day-0 figure, 11 cm, from 07:00
on the prep day): the controller (`farm-auto.js`, every farm step ≤ 60 game s) moves a line at most **2 cm per farm hour**
(the winch's speed) toward the plate; the farmer's own winching of a line holds until the next 06:00 (his choice for the day).
Not handed over: the catching lift (`f-lines`, 55 cm with the crew) and the clean-out (`c-raise`). Jobs handed over:
`prep-drinkers`, `r-raise`'s drinker part, the nipple part of `r-drinkers`. The glance: the water supply panel open 1 s
(its Lines section shows the four heights against the plate) or any drinker regulator panel: `auto.glance { system: 'winch' }`.
Fault: `winch-stall` (§5). Time saved: about 25 s of play and 20 farm minutes on each of the 8 raise days (four regulators).
Sign lines (drinker plate, general): *"Auto winches keep each line at the day's figure on this plate; look at the heights when
you read the meter."* · *"A winch motor that stalls trips its overload and its line stays where it was: winch the line by hand
to the plate's figure and reset the motor."*

### 3.2 Moisture & Minimum Ventilation
**Level 2 · `ventFill` — The minimum ventilation calculator fills the timer.** *Saves working the timer seconds out of the vent
sign's table.* On the controller's Ventilation tab the calculator (`minVentCalc`: the farmer's count and today's scale weight,
already filled) gets *Fill the timer*: `vent.timer { fans, onSec, cycleSec: 300, by: 'calc' }` at **110 %** of the vent sign's
need for that flock (`ventNeed`, inside the sign's 90–130 % band): 1 fan while it fits in 300 s, else 2 fans
(`onSecFor(need × 1.1, fans)`). `r-minvent` (a step up and in the band) and `prep-vent` (in the band) are done in one press. A
night with the timer wide from a warm afternoon: the night check's *Fix it at the controller* opens this tab with the key in view.
Time saved: about 15 s of play (the reading of the table, four presses of *One second more*) per step-up morning (9 a flock).
Sign line (sign-vent, general): *"The controller's calculator works the timer from the bird count and weight with this table;
set it a little over the table (about 110 %) so the air keeps up as the birds grow through the day."*

**Level 3 · `autoTimer` (system `timer`) — The timer steps up with the flock by itself.** *Saves stepping the timer up by the
table every other morning.* At 06:00 each day, and when the farmer's count of the flock changes by 2 % or more, the controller
sets the timer to 110 % of the vent sign's need for the flock he knows (his count, the automatic scale's weight; `by: 'auto'`).
A setting the farmer sends himself stands until 18:00 that day (a warm afternoon's wide timer), then the controller goes back to
the table (the vent sign's "set it back by the table when the afternoon cools"). From the prep day (tomorrow's 6,000 chicks of
42 g: `PREP_FLOCK`). Jobs handed over: `prep-vent`, `r-minvent` (glance: the controller read, which also shows what the timer
did since the last read). Fault: `timer-reset`.
Sign lines (sign-vent, general): *"A controller can step the timer up by the birds' count and weight each morning: check it
against this table when you read the controller."* · *"After a power blip a controller may start again on its first setting:
look at the timer when the power comes back."*

### 3.3 Heat & Ventilation
**Level 2 · `fanAdvice` — The fan panel suggests the fans and the pad for the birds' age and the weather now.** *Saves working
the fans and the pad out of the heat sign every hot afternoon.* The fan panel (`SPOTS3.fanPanel`, east end) and the
controller's Tunnel fans row (by the door) show *"Suggested now (heat sign): 4 fans, pad off — birds 25 days, house 31.2 °C,
felt 27.0 °C"* and a key *Set as suggested*: `vent.fans { n, by: 'advice' }` + `vent.pad { on, by: 'advice' }`. The suggestion
is `farm-auto.js adviseFans(env, farm)`: the same rules the ideal farmer plays (`idealFans` / `idealPad` / `fansForFeel` /
`eveningPad` of farm-profiles-cycle.js and -cond.js: the heat sign's stages by age, the young birds' line, the pad plate's 90 %
limit, the evening rule) — never more than the sign says. The heat jobs (`p-heat3`, `p-panting`, `p-panting-fin`, `p-humid`,
`r-vent-night`) complete on their state tests as now. Time saved: about 20 s per hot afternoon (reading the sign and stepping)
and, at the controller, the walk to the fan panel (36 m each way, about 20 s and 15 farm minutes).

**Level 3 · `autoStages` (system `stages`) — The controller adds tunnel fans as the house warms.** *Saves walking to the fan
panel to step the fans through every hot afternoon and evening.* From day 15 (before it the timer and the brooders run the young
birds' house; the brooding week's heat stays the farmer's) the controller keeps `env.setFanStages` on the heat sign's stages for
the age (`adviseFans` evaluated over the house's range, refreshed every farm hour) with the pad rules (the pad only from day 21,
off over the pad plate's 90 % RH, the evening rule from day 28). The farmer's own fan or pad setting holds for 2 farm hours,
then the stages take over again (the panel says so). Jobs handed over: `r-fans-pm` (glance: the controller read or the fan
panel), `r-vent-night` (glance; the night-comfort state still has to hold, which the stages keep), `p-heat3`, `p-panting`,
`p-panting-fin`, `p-humid` (their state tests met by the stages; done by the glance once they hold). Not handed over: the heat
wave's checks (`p-heatwave`), the catch (`f-ready`, 3 fans), a stopped fan (`p-fan`: a repair). Fault: `stage-trip`. Time
saved: the walk to the fan panel on 27 afternoons (about 20 s and 15 farm minutes each) and the hot afternoons' stepping.
Sign lines (sign-heat, general): *"Fan stages add tunnel fans as the house goes over its target; for young birds keep the
stages few and high (the young birds line)."* · *"After a power cut or a blip a controller may come back with its stages off:
set the fans by hand and switch the stages on again at the fan panel."*

### 3.4 Heating
**Level 2 · `brooderRow` — One press sets the thermostat to the brooder sign's row; the heat-loss readout gives the pre-heat
time.** *Saves reading the brooder table and stepping the thermostat; tells you when to start the pre-heat.* On the
controller's Temperature tab: *Set to the sign's row (day 3: 32 °C)* → `heat.setpoint { c, by: 'row' }` with
`brooderRowC(day)` (a bad batch's warmer row, +1 °C on days 0–3, when its job names it: `rowShiftC`). The heat-loss readout
(`heatLoss`, level 1) gains *"Pre-heat: about 26 hours to bring the floor to 28 °C with the brooders at full in this weather —
start by 06:00 on day −1"* from `heat-diag.js preheatHours(env, farm)` (model: the slab's rate at full output from now, the
outside forecast). Jobs: `prep-preheat`, `p-cold-night`, the setpoint parts of the controller read — rules unchanged, one press.
Time saved: about 10 s per change (6–8 a flock) and the pre-heat started on time.
Sign line (sign-brooder, general): *"The concrete under the litter takes about a day to warm through; in a cold or wet week
it takes longer."*

**Level 3 · `autoBrooders` (system `brooders`) — The brooders follow the brooder sign's curve.** *Saves setting the thermostat
by the table each morning and on the prep day.* From 07:00 on the prep day (the pre-heat: the day-0 row) the controller sets
the thermostat to the day's row at 06:00 each day (`by: 'auto'`; a bad batch's warmer row on days 0–3). The farmer's own
setting stands until the next 06:00 (a cold night's extra degree). Winching the brooders up on day 22 stays his
(`w45-brooders`). Jobs handed over: `prep-preheat` (glance: the controller read). Fault: `sensor-drift`.
Sign line (sign-brooder, general): *"Auto brooders hold the controller's sensor at the row: its reading should be the same
as the thermometer beside the controller; compare the two when you read it."*

### 3.5 Chick Arrival & Brooding
**Level 2 · `quickSamples` — Three chicks for the vent check, six for the crops, and a Next chick key.** *Saves catching 2 vent
chicks and 4 crop chicks, and the walk back to the chicks after each one.* The sampling jobs' need: `d0-vent` 5 → **3** (one
from each of 3 parts of the floor), `d1-crop` 10 → **6** (3 parts), a bad batch's `b-crop48` 10 → **6**. The chick-in-hand
panel gets *Next chick*: the chick goes back down and the nearest other chick within 2.5 m comes into the hand without closing
the panel (one press instead of Esc, a step and E); the catch reach goes from 1.2 m to 2.0 m. The milestones that count these
samples read the job's need at the time (`perks.need(jobId)`, recorded with the job: `records.logJob` keeps `need`):
`vent-checked` "≥ need readings from ≥ 3 sectors in the window"; `vent-band` "≥ need − 1 of the first `need` readings in band"
(4 of 5, or 2 of 3); `crop-fill` measures the true fill (unchanged). Time saved: about 35 s of play on day 0 and 40 s on day 1.
Sign lines (sign-chicks, general): *"One chick from each of three parts of the floor shows where it is cold or hot; more chicks
give a steadier figure."* · *"Feel the crops of six to ten chicks from three parts of the floor."*

**Level 3 · `boxHelper` — A helper tips the chick boxes with you on arrival day.** *Saves carrying half of the six stacks of
chick boxes.* On day 0 (a bad batch's late truck too) a farm worker (scene: the catching crew's figure in farm clothes) waits by
the truck once it stops. Each time the farmer picks up a stack, the helper takes the next stack not taken and carries it to the
part of the brooding floor not tipped yet (the parts in order, west to east), tips it there and walks back: two stacks at a time,
the 6 stacks in about half the time (`chicks.tip { stack, x, z, by: 'helper' }`, the props' box tip). The helper never grades,
weighs or culls (that is the chick table's job). `d0-place` (all placed) as now; `placed-fast` comes easier. No fault (a helper is
a person). Time saved: about 50 s of play and 15 farm minutes on day 0.
Sign line (sign-chicks, general): *"Two people tipping the boxes get the chicks onto the litter in half the time."*

### 3.6 Feed & Digestion
**Level 2 · `siloOrder` — The silo gauge shows days of feed, warns at 2 days and orders from the gauge.** *Saves the walk to the
office to order, and the sums from the silo's kilos to days.* The `siloDays` view moves here (level 2): the silo gauge
(`SPOTS2.silo`, outside the north wall) reads *"About 2.4 days of feed at today's intake (5,880 birds × 128 g, the feed sign)"*
for each silo and both together. At 2.0 days or under (once per order: re-armed when an order arrives) a caption and the job
card's top line: *"Silo: about 2 days of feed left (Feed 2): order at the silo gauge."* Keys at the gauge: *Order to 3 days*
(`feed.order { kg, type, silo, from: 'silo' }`: the kilos to 3 days at the feed sign's intake for the age, the type by
`feedTypeForDay`, the silo with room; the order jobs' `order-days` check) and from day 36 *Order to the catch* (the
`order-withdrawal` check: to the withdrawal with under 1.2 t left). Jobs: `p-order-feed`, `w2-order`, `w45-order`, `f-order`
(their place lines read "the phone at the office, or the silo gauge (Feed 2)"). Time saved: the walk silo → office (about 45 m,
25 s and 20 farm minutes) on 4 orders a flock.
Sign line (silo plate, general): *"Order when the silo holds about two days of feed: the mill brings it the next day if you
order before 16:00, else the day after."*

**Level 3 · `autoFeed` (system `feed`) — Feed orders itself at 2 days and the feeder lines rise with the flock.** *Saves the feed
orders and raising three feeder lines by hand.* Every farm hour the controller reads the silo days: at 2.0 days or under, with no
order on the way, it orders to 3 days of the type for the age (`feed.order { by: 'auto' }`), until day 35 (the last order is the
farmer's: only he knows the catch). From day 4 it keeps each feeder line's rim at `feederRimCmAt(age)` (≤ 2 cm per farm hour;
days 0–3 the pans stay on the litter, flooded by the farmer); it does nothing during the withdrawal or the heat wave's lift
(the farmer's settings). The feed changes (`w3-change`, `w45-change`: the silo valves) stay his. Jobs handed over:
`p-order-feed`, `w2-order`, `w45-order` (glance at the silo gauge or the feeder box: the order shows *confirmed by the mill*),
`r-raise`'s feeder part, `r-feeders`' rim part. Fault: `order-lost`.
Sign line (silo plate, general): *"An automatic order is a message to the mill: look for its confirmation on the gauge."*

### 3.7 Lighting
**Level 2 · `weekLights` — One press sets the light program for the flock's age.** *Saves picking the dark hours and the dimmer
from the light sign.* The controller's Lights tab: *Program for day 15 (light sign)* → `light.program { darkStart, darkHours,
dimmer, by: 'week' }` with the age's program (`LIGHT_PRESETS`: brooding days −1–7, growing days 8–35, finishing days 36–41;
`lightPresetForDay(day)` in config). `prep-lights`, `w2-lights` and `p-sds`' dark block in one press. Time saved: about 10 s
per change (3 a flock); the presets (level 1) still need the right one picked.

**Level 3 · `autoLights` (system `lights`) — The controller changes the light program with the age and dims at dawn and dusk.**
*Saves setting the light program at each change of week.* At 06:00 on days −1, 8 and 36 the program by age; dawn and dusk
dimming (`rampMin` 20, the `dimming` control) from day 8. The catching dimmer (`f-ready`) stays the farmer's. Jobs handed over:
`prep-lights`, `w2-lights` (glance: the controller read). No fault (lamps on a dimmer rarely fail in a way the flock watch
cannot see; noted in §17).
Sign line (light plate, general): *"Dawn and dusk dimming over about 20 minutes keeps the birds calm when the lights change."*

### 3.8 Growth & Performance
**Level 2 · `weigh25` — Hand weighing needs 25 birds instead of 50.** *Saves weighing 25 birds on every weigh day.* The weigh
jobs (`d7-weigh`, `w2-weigh`, `w3-weigh`, `w45-weigh28`, `w45-weigh35`, `f-weigh`): n 50 → **25**, still from 5 parts of the
house. `weighed-weekly` reads each weigh day's need (≥ need hand weighings). The level result needs ≥ 10 hand-weighed birds as
now. The weigh panel's strip names 25; *Weigh all* weighs the frame's birds as now. Time saved: about 50 s of play and 20 farm
minutes on each of 6 weigh days.
Sign line (bird-scale plate, general): *"Weigh 50 birds from five parts of the house; 25 from five parts give the mean to
within about 2 %."*

**Level 3 · `autoScale` (system `scale`) — The automatic bird scale gives the day's weight.** *Saves hand weighing on weigh days:
read the scale's day average.* The automatic platform scale (Phase 2's model: `stats.scaleAt[day]`, `scaleAtWeighInG`) now
also counts its weighings (about 600 a day: model, the flock's mean × (1 ± 0.5 %) with the flock's spread) and its uniformity.
The weigh jobs complete on a glance at the bird scale — `scale.read { day }` (the panel shows *"Today 08:00–14:10: 312
weighings, mean 2,204 g, uniformity 74 %"*) once it has ≥ 300 weighings that day (from about 14:00 on a weigh day). The level
result reads the scale's day mean when fewer than 10 birds were weighed by hand (as now); `weighed-weekly` counts a scale read
with ≥ 300 weighings as the day's weighing. Fault: `scale-fouled`.
Sign line (bird-scale plate, general): *"An automatic platform scale weighs the birds that step on it all day; a fouled platform
reads light and counts few birds: clean it and weigh by hand."*

### 3.9 Body Temperature & Comfort
**Level 2 · `earlyWarning` — The flock watch warns about two farm hours earlier and names the fix.** *Saves hours of cold or
hot birds before you hear of it.* The flock watch raises its cold and hot warnings at **2** cold or hot hours of the last 8
(`WATCH.comfortAmber`) instead of 4 (`comfortRed`), and the warning ends with the fix: for cold the biggest of heat-diag
`coldFixes(env, farm)` (*"Fix: the Tunnel fans row to 0 on the controller's Ventilation tab: the house then settles at
33.9 °C"*), for heat the fan advice of §3.3 (*"Fix: 4 tunnel fans, pad off (heat sign) at the fan panel or the controller"*).
The watch card's comfort row gets *Show me*: the job marker points to the fix's place for 2 farm hours. Time saved: a warning
about 2 farm hours (80 s of play at 1×) before the level 1 watch.

**Level 3 · `comfortAlways` — The comfort colours show on the flock whenever you are in the house.** *Saves pressing C at every
visit, and shows a cold or hot corner as you pass.* On house enter the comfort view turns on (C turns it off for that visit);
the flock watch's comfort row adds *"where you stand: 1.2 °C under the row"* while he is inside. No equipment, no fault.

### 3.10 Biosecurity & Health
**Level 2 · `tallyBucket` — The bucket picks up every dead bird within 2.5 m and counts them as you pick them up.** *Saves the
walk to the bin after the morning round, and stooping for each bird.* E at a dead bird picks up every drawn dead bird within
**2.5 m** (`flock.dead.pickUp(x, z, 2.5)`, was 1.5) and the bucket's tally counts them at once (`dead.count { n, causes, at:
'pickup' }`: the record has them); `dead-cleared` holds with a counted bucket in hand, so the morning round no longer ends at the
bin; the bucket holds **30 birds** (a fuller bucket goes to the bin first) and is emptied at the bin after the afternoon round
(`r-dead-pm` needs the bucket empty: the bin's E empties it, counted already). Time saved: one bin trip a day (about 30 s and 20
farm minutes) and the pickups (about 2 s a bird).
Sign line (sign-health, general): *"A bucket with a tally counter counts each bird as you pick it up; empty it at the bin after
the afternoon round: dead birds never stay in the house overnight."*

**Level 3 · `passCheck` — Birds you walk past show a quick symptom tag.** *Saves catching birds to find the sick and lame ones.*
Inside the house a sick, lame or gasping drawn bird within 2 m of the farmer shows a small tag for 3 s with the symptom check's
words (*limps*, *sits hunched*, *gasps*, *watery droppings*); E at a tagged lame bird culls it (`p-lame`); `w2-check` (watch ten
birds walk) counts birds he walked within 2 m of while they walked (`EV.BIRD_SEEN { index, look: 'gait', x, z }`: ten from 3
parts → done without catching them). Time saved: about 60 s of play on each of days 10 and 13, and the lame birds found on the
walk.
Sign line (sign-health, general): *"Walk slowly and look at each bird near you: a bird that does not move away, sits hunched or
limps is checked in the hand."*

### 3.11 Farm Planning
**Level 2 · `pocketPhone` — A phone in your pocket.** *Saves the walk to the office for every order, vet call and booking.* Key
**R** (`keys.js` action `phone`, group farm, rebindable) or the phone key on the time bar opens the records book's Phone page
from anywhere in a level (panel `pocket-phone`: the Phone page alone, kind 'paused' as the book): order feed, report the deaths,
call the vet, book the crew, book the next chicks, call the hatchery — the same actions with `from: 'pocket'`. Jobs whose place
is the office phone (`p-order-feed`, `w2-order`, `w45-order`, `f-order`, `f-book`, `p-report`, `p-blood` / `p-hunched`' vet
calls, `c-book`, `p-weak-batch`) read *"the phone (R, anywhere)"*; their marker points nowhere and the *Next:* line reads
*"press R"*. Signing the record stays at the desk. Time saved: the walk to the office and back (about 80 m, 40 s and 30 farm
minutes) on about 8 calls a flock.

**Level 3 · `planReady` — The next plan is filled in from this cycle.** *Saves working the next plan by hand: check it and send.*
On the next planning day the planning sheet opens filled from the last cycle (`planCarry`: houses, birds per house, cycle days,
the losses measured, the sale weight) with the calculator's sums shown; *Send* in one press after he looks it over. Measuring the
house (`pl-measure`) stays (the plan's milestones still measure the plan). Time saved: about 60 s of play on the planning day.

### 3.12 The new sign lines (`src/content-signs-skills.js`, merged into the boards while `live`)
Every line of §3.1–§3.11 is **general practice** (source `'general'`), shown on its board from the start of the run (the facts
describe farm equipment; they never depend on the player's skills); test-contracts checks each is general, verdict-free and on
the board named. With `live` false the boards are exactly as on main.

## 4. The equipment does it: automation (package "model": `src/farm-auto.js`; contracts in code)

### 4.1 The systems (`config.AUTO_SYSTEMS`)
| System | Branch (payoff) | What the controller does | Every | Glance at (`auto.glance { system }` after 1 s open) |
| --- | --- | --- | --- | --- |
| `winch` | Water (`autoWinch`) | each line's nipples toward `nippleHeightCmAt(day)`, ≤ 2 cm / farm h | farm step | water supply panel, any drinker regulator |
| `timer` | Moisture (`autoTimer`) | the timer to 110 % of the vent sign's need for the known flock | 06:00, count change ≥ 2 % | climate controller (read) |
| `stages` | Heat & Ventilation (`autoStages`) | `env.setFanStages` from the heat sign for the age; the pad rules | farm hour, from day 15 | climate controller (read), fan panel |
| `brooders` | Heating (`autoBrooders`) | the thermostat to the brooder sign's row | 06:00 (and 07:00 on the prep day) | climate controller (read) |
| `feed` | Feed (`autoFeed`) | an order at ≤ 2 days to 3 days (to day 35); the feeder rims toward `feederRimCmAt(age)` from day 4 | farm hour | silo gauge, feeder box |
| `lights` | Lighting (`autoLights`) | the light program by age at 06:00 on days −1, 8, 36; dawn / dusk dimming from day 8 | 06:00 | climate controller (read) |
| `scale` | Growth (`autoScale`) | the platform scale's day count, mean and uniformity (`scale.read`) | farm step | bird scale |

The four level 3 payoffs without equipment (`boxHelper`, `comfortAlways`, `passCheck`, `planReady`) are not systems: they have
no glance, no fault, and switch with their branch's setting (§7).

### 4.2 How the controller acts
- **On:** `farm.auto.on[system]` is true only while the level runs (`farm.mode === 'level'`), the system's payoff holds
  (`perks.auto(system)`: its branch at level 3, `SKILLS_UPDATE.live`, `perks.allowed`, the settings' `automation.all` and
  `automation.<branch>`), its fault is not open (§5), and the power is on (`env.powerOn`; after a cut the system resumes with the
  power — except `stages` after a cut in the rainy season, §5.1). level.js sets `farm.auto.on` from the perks at every start,
  resume and EV.PERKS / EV.SETTINGS; `runCycle` / `runProfile` never set it (every node profile plays by hand unless a test asks:
  the `auto` profile option of §13.1).
- **Acts through the farm's own actions** (`farm.act(id, { ...args, by: 'auto', quiet: true })`): the same state the farmer's
  hand would change, no EV.ACTION (so no job counts a controller's step as the farmer's press), and one `EV.AUTO { system, did,
  text, args, day, hour }` per change, which the records write as a notebook line of kind `auto` (§8). Its result readings are
  the panels' (the winch heights, the timer, the setpoint).
- **The farmer's hand wins for a while:** his own setting of the same thing holds — the winch and the brooders until the next
  06:00, the timer until 18:00, the fans and the pad for 2 farm hours — then the controller takes it back (the panel's line:
  *"Your setting holds until 18:00, then the controller goes back to the table"*). `farm.auto.hold[system]` keeps the time.
- **No auto play of the ideal is changed:** while `level.debug.goto(…, { auto: true })` or a standard start plays the ideal
  farmer, `farm.auto.quiet(true)` holds every system and every fault (the ideal plays by hand, as test-cycle measures it).
- **Readings:** `farm.auto.status()` → `{ on: { [system]: bool }, systems: { [system]: { state: 'running' | 'held' | 'fault' |
  'off', text, since } }, faults: [open faults], last: { [system]: EV.AUTO payload } }`; the controller read, the flock watch's
  Equipment row and the panels show it.

### 4.3 The job handed over: a quick glance (package "jobs": `src/job-variants.js`)
A job of `AUTO_SYSTEMS[system].jobs` made (instance created) while the system is on gets a **variant** rule:
`{ type: 'any', handled: system, of: [GLANCE, original] }`, where `GLANCE = { type: 'all', of: [live('<what the equipment
keeps>', 'auto-ok', { system }), lab('Look at <the reading> (<place>)', action auto.glance { system })] }`. So the job is done
by a look at the reading while the equipment keeps it in band — or, as before, by hand (a fault, a setting turned off, a
farmer who wants to). The state test `auto-ok` (job-engine) reads `farm.auto.ok(system, inst)`: the system on, no open fault, and
the reading in the job's band (the winch: every line ±3 cm of the plate; the timer: 90–130 % of the need; the stages: the
job's own heat state; the brooders: within 1 °C of the row; the feed: an order confirmed or more than 2 days of feed, rims ±3 cm;
the lights: the program of the age; the scale: ≥ 300 weighings today). A job of two systems (`r-raise`: drinkers `winch`,
feeders `feed`) splits into its two parts (state tests `drinkers-raised`, `pans-raised`), each its own any-rule. The job card
shows the part as *"drinker lines: handled by the controller (Water 3) · look at the heights at the water supply"*; the strip at
the glance place shows the reading with the sign's figure.

The variant is taken when the instance is made (the next day's jobs after a level 3 arrives or a setting changes; an open job
keeps its rule, whose manual part still works). `perks.handled(jobId)` → `{ system, branch, label: 'handled by the controller
(Water 3)', glance: 'the water supply panel' } | null` for the card. The jobs that stay manual are listed in §3 per payoff.

## 5. Faults: automation that sometimes fails (package "model": `src/farm-faults.js`; data in config `FAULTS`, `FAULT_PLAN`)

### 5.1 The faults
| Fault | System | What happens | How it shows | Fixed by hand | Bound (winnable) |
| --- | --- | --- | --- | --- | --- |
| `winch-stall` | winch | one line's motor trips its overload: that line stays at its height while the plate's figure rises (about 1 cm a day) | the controller knows (the motor's lamp red): Equipment row red at once | winch the line by hand to the plate (`water.height`) at its regulator, then *Reset the motor* (`auto.reset { system: 'winch', line }`) | a line 3 cm low a day later at most; birds reach it (access falls a little) |
| `timer-reset` | timer | a power blip restarts the controller on its first timer setting (1 fan, 8 s in 300 s) | the controller logs the restart: Equipment row red at once; RH and ammonia climb over hours; the night check's timer cause | set the timer by hand or *Fill the timer* (`vent.timer`); the controller then steps from his setting (`auto.reset` implied by a timer sent) | 24 farm hours of a day-0 timer at most: then the controller's own retry restores the table (and says so) |
| `stage-trip` | stages | the stage output trips after a blip: the fans stay at the stage they had and no longer follow the heat. **Rainy season:** after each power cut the controller comes back on the generator or the mains with its stages off | Equipment row red at once (*"Fan stages off since 15:23: restarted on the generator"*); the comfort row as the house warms | set the fans by hand at the fan panel or the controller and switch the stages on again (`auto.reset { system: 'stages' }`, the fan panel's *Stages on* key) | normal season: drawn 07:00–10:00 or 17:00–19:00 only (not into the hottest hours); the fans keep turning at their last stage |
| `sensor-drift` | brooders | the controller's temperature sensor reads high, drifting +0.5 °C a farm hour to +2.5 °C: the brooders hold the sensor at the row, the house runs under it | not self-detected: the Equipment row compares the sensor with the house thermometer (the HUD's House gauge, the dial by the controller) — amber over 1 °C apart, red over 2 °C; the comfort row (cold hours); the night check (the house under the row with heat to spare) | *Check the sensor against the thermometer* on the Temperature tab (`auto.calibrate`), or set the thermostat by hand (his setting stands until 06:00) | days 0–21 only (brooders on); +2.5 °C at most |
| `order-lost` | feed | the automatic order of the day is never confirmed by the mill: no truck | the gauge shows *not confirmed*: Equipment row amber at once, red 6 farm hours later; the silo days fall to 1 by the next day | order by hand (the phone, the pocket phone, the silo key: `feed.order`) | drawn only for an order at ≥ 1.8 days of feed: the pans run short 2 days later at the earliest |
| `scale-fouled` | scale | litter on the platform: the scale reads about 6 % light and counts a quarter of the birds | the Equipment row amber (*"Bird scale: 140 weighings today, about 600 before"*); the weight row then reads the hand weighings when there are 10 or more | *Clean the platform* at the bird scale (`scale.clean`); weigh by hand (25 with Growth 2) | the level result never reads a fouled scale's mean: it takes the hand weighing, or the last clean day's figure with a note |

Lighting, the helper, the comfort view, the passing check and the plan have no fault (open question 4).

### 5.2 How often (`config.FAULT_PLAN`)
| Flock | Faults per flock | Drawn from |
| --- | --- | --- |
| normal season | at most 1, with chance 0.6 | the systems on at the draw |
| hot season | at most 2 | `stage-trip` and `sensor-drift` twice as likely |
| rainy season | at most 2, plus a `stage-trip` after every power cut while `stages` is on | `timer-reset` twice as likely |
| a bad batch | at most 2 | `sensor-drift` and `scale-fouled` twice as likely |
| a water problem | at most 2 | `winch-stall` twice as likely |

The draw is made at each level's start (`farm.start` / `farm.enterLevel`) from the farm's seed and the level's id (`farm.rng`
is not touched: a separate `createRng(seed × 31 + level n)`, so the model's own random numbers and every Phase 1–5 trace stay
the same): a time inside the level from 12 farm hours after its start to 24 farm hours before its end (never in a level's last
day, never before the chicks are placed), between 07:00 and 19:00, at most one open at a time; at its time the fault starts
only if its system is on (else it is dropped). A fault starts inside a Next job skip too: the skip stops on its warning.

### 5.3 Caught by the flock watch, the night check and the skip's stops (model + jobs)
- **The Equipment row** (`watch.status().rows.equipment`, shown while any system is on): green *"4 on · reading"* (the
  systems by name in its detail), amber or red per §5.1 with the fault's own words. A red row raises one warning (EV.WATCH kind
  `equipment`): *what* stopped, *the likely cause* (the fault's), *where to look* (its place and plate), as every warning: a
  caption, a notebook line, the card's last line, a Next job skip's stop.
- **The night check** (night-check.js): an open `timer-reset`, `stage-trip` or `sensor-drift` before a night skip is named in
  *What is off, and where to set it* (*"The controller's sensor reads 2.4 °C over the house thermometer: the brooders hold the
  house 2.4 °C under the row tonight. Check the sensor on the controller's Temperature tab"*), with *Fix it at the controller*.
- **The skip's stops:** a fault's warning is a new flock watch warning, so the skip stops (the night fix's guard). A fault that
  starts while the night is skipped stops it within the farm hour.
- **The job card:** a handed-over job whose system has a fault shows its manual part first: *"Line 3: by hand at its regulator
  (the winch motor stalled)"*.

### 5.4 Never silently costing a level
A fault is raised at once (the Equipment row) for every fault that the controller can know (stall, restart, order, trip) and
within the hour for the drift and the scale (the cross-checks); each starts with at least 24 farm hours of the level ahead and
in daylight; each is bounded (§5.1); each is fixed by the manual job of the branch, which always works (the variant keeps the
original rule). If a level fails with a fault still open, the fail screen's carried line names it (*"the fan stages were off from
15:23 to 18:40 after the power cut"*). test-auto checks for every fault: raised within its bound, caught by the watch (warning
and row), a skip stopped, fixed by hand, the level passing with the fix (the ideal with automation, §13.1).

## 6. Making the payoff visible (package "jobs"; the panels show their own)

### 6.1 The skill tree (`ui-skilltree.js`)
Each branch card: the badge, the three pips, the points (both flocks) and the bar (marks at 4 / 9 / 22), then the **next level's
payoff** in one line: *"Level 2 · Faster: flow-test all four lines from the water supply — 3 points to go"*. The picked branch's
detail: the three levels, each with its step name (`SKILL_STEP_NAMES`: *See more*, *Faster*, *The equipment does it*), the payoff's
name, its **saves** line, **where** it is used, the view under it (*also: …*), and for level 3 *on* / *off in Settings*; then the
milestones with *first flock · another flock* points and the last detail. The header's line: *"Points come from what happens on
your farm. Level 1 shows you more, level 2 makes a job faster, level 3 hands a routine job to the farm's equipment. Each
milestone counts once in your first flock and once more in a later one."*

### 6.2 The job card and the strips (`ui-jobs.js`, `job-strips*.js`)
- **Would be easier:** the open job's card shows at most one line under its title for the next payoff that eases it and is not
  held yet (`perks.easier(jobId)[0]`): *"Growth 2 would weigh 25 birds instead of 50 · 4 points to go"* (points to go = the level's
  threshold − the branch's points now; *"in a second flock"* when the level is 3 and the flock is the first). Once per job
  instance, small text, never a verdict.
- **Easier now:** a payoff that holds shows as the job's first strip row at its place: *"Water 2: Test all four lines here (the
  four regulators only for a line out of band)"*; the card's where line and the marker follow `job-next`'s places for the payoff
  (the water supply; the silo gauge; R for a phone job).
- **Handled:** *"handled by the controller (Water 3) · look at the heights at the water supply"*; the job's progress bar shows the
  glance part; with a fault the manual part leads (§5.3).

### 6.3 The unlock caption (`ui.js`, on EV.SKILL_UNLOCK of a payoff or a view)
One caption (shown at once, `caption.show(…, { now: true })`), the notebook line of kind `skill`, and a paper cue:
*"Water 2 · Faster: flow-test all four lines from the water supply. Use it at the water supply panel on flow-test mornings.
Saves the walk to 4 regulators."* — the step, the name, where to use it (`where`), what it saves (`saves`). A level 3 adds *"You
can switch it off in Settings → Automation."* On the result screen the level's new payoffs are listed under its points with the
same words.

### 6.4 The guide (`content-guide.js`)
A short *Skills* section (game words only, no farming fact; test-contracts' guide check): what the three steps do, that level 3
needs a second flock, that the equipment can fail and the flock watch's Equipment row says so, where the Automation settings are.

## 7. Settings: Automation (package "jobs": `settings.js` group `automation`, `ui-settings.js` its tab)
The group is in code now with `hidden: true, liveOnly: true`; the jobs package's `ui-settings.js` draws a group when `!G.hidden ||
(G.liveOnly && SKILLS_UPDATE.live)` (the tab only while live, so the six Phase 5 tabs stay as they are with the switch off):
`automation.all` (bool, true: *"Let the farm's equipment do the jobs my level 3 skills hand to it"*) and one bool per branch, all
true by default, labelled with the payoff (*"Water 3: drinker winches follow the flock's age"*, *"Chick Arrival & Brooding 3: a
helper tips the chick boxes"* …). Off: that branch's level 3 does nothing and its jobs are made by hand from the next instance
(an open job keeps its rule, which has the manual part). The level 2 shortcuts are keys the farmer may use or not; they have no
setting. Applied live (`settings.subscribe(fn, 'automation')`, EV.SETTINGS → `perks` → EV.PERKS → level.js sets `farm.auto.on`).

## 8. Records (package "model": `records*.js`)
- **Notebook kinds** `auto` (one line per system per change, compacted like the settings lines: *"Controller: timer stepped to 1
  fan 21 s / 300 s for 5,890 birds of 480 g"*, *"Winches: lines 1–4 to 24 cm (plate 24 cm)"*, *"Feed ordered by the controller:
  4,200 kg grower, due day 25 09:00"*), `fault` (*"Line 3 winch motor stalled at 31 cm (plate 33 cm) 09:12"* · *"Line 3 winched by
  hand to 33 cm; the motor reset 10:05"*) and `skill` (the unlock caption's words). Saved with the notebook as every line
  (`[day, hour, kind, value]`), rounded as now.
- **The day's row** lists the day's faults in its notes row (*"Equipment: line 3 winch stalled 09:12–10:05"*) and keeps the
  readings it has (the week table's *Tunnel fans (most)* is still what the farmer read at the fan panel or the controller).
- **The cycle summary** gains one line: the payoffs used in this flock (*"Level 3 at work: winches, timer, stages"*) and the faults
  met with their times. No score, no verdict.

## 9. Pass, fail and the targets
Unchanged: every level's target, limit, fail rule and early fail. A payoff never changes a pass rule; the jobs' outcomes
(`flows-in-band`, `vent-in-band`, `lines-raised` …) are the same whether the hand or the equipment met them. The milestones that
count samples follow the job's need (§3.5, §3.8), so a payoff never costs points. A fault is never a fail by itself; a level that
fails with a fault open names it on the fail screen (§5.4).

## 10. New 3D content (package "scene")
- **Winch motors** (Water 3): a small grey box with a lamp on each drinker line's west end (beside its regulator), shown while the
  branch is at level 3 with its setting on; the lamp green while running, off while held, **red while stalled**; the line's cable
  turns while it moves (≤ 2 cm an hour: only the cable texture's offset). One merged mesh, one instanced lamp (4).
- **The controller's sensor and a dial thermometer** (Heating 3): a white sensor box hanging under the controller (x −12, z −4.8,
  1.6 m) and a round dial thermometer beside it (its needle at the house temperature); the controller's LCD shows the sensor value,
  so a drift shows as two different numbers side by side.
- **The auto scale's platform** (Growth 3): the bird scale's platform (exists) gets a litter-covered look while `scale-fouled` is
  open (a husk-coloured top) and a small display post with the day's count.
- **The helper** (Brooding 3): one farm worker figure (the catching crew's mesh and walk, farm clothes, a cap) by the truck on day
  0, carrying stacks to the brooding parts, tipping them (the farmer's crouch and the props' box tip), walking off when the last
  stack is tipped. Draw calls: +2 (body and stack); the GFX budget holds (110 calls).
- **The bucket with a tally** (Biosecurity 2): a small counter on the bucket's rim showing the count (a canvas-texture digit, or an
  HTML tag over it as the dead-bird chip); the pickup reach 2.5 m (`flock-dead.pickUp`), up to 30 birds.
- **Symptom tags** (Biosecurity 3): a tag over a sick, lame or gasping drawn bird within 2 m inside (as the dead-bird chip, kept off
  the HUD cards), at most 6 at once.
- **Comfort colours on entering** (Comfort 3): `flock.setOverlay('comfort', true)` on house enter.
- **Chick in the hand** (Brooding 2): the catch reach 2.0 m (`flock-catch.catchNearest(x, z, 2.0, purpose)`) and *Next chick*'s
  release-and-catch in one call (`flock.catcher.nextNearest(index, 2.5)`).
- Under `prefers-reduced-motion` the helper walks without the bob; the lamps do not blink.

## 11. Save format changes
- **Skill profile** (`skills.serialize()`, the profile store and the slots' envelopes): `{ v: 2, earned: [[id, tier]] (best of
  either slot, for a Phase 5 reader), flocks: [[id, slot1Tier | null, slot2Tier | null]], cyclesDone, conditionsDone }`; a v1
  profile restores as slot 1. `save-slots.js mergeProfiles` keeps the higher tier per slot. Size: about 2 KB.
- **The farm** (`farm.serialize()` → `auto`): `{ hold: { [system]: untilDay }, last: { [system]: { did, day } }, faults: [{ id,
  system, phase: 'planned' | 'open' | 'fixed' | 'dropped', at, startedAt, foundAt, fixedAt, args }], drift }` (about 1 KB);
  `farm.auto.on` is not saved (level.js sets it from the perks after a resume).
- **The level blob:** unchanged shape; the job engine saves a variant instance by its job key as now, plus `v: 1` (variant made
  with the payoffs) so a resume makes the same rule (`job-variants.js` rebuilds it from the key and the saved `v`).
- **Settings:** the `automation` group in `chickenFarm.settings.v1` (coerce reads a store without it as the defaults).
- **Formats:** the slot envelope stays format 5 (the new fields are additive; `migrate` reads a v1 profile as before). A save made
  with `live` true opened by a Phase 5 build reads the best tiers (`earned`) and ignores the rest.

## 12. Contracts between packages (in code now)
Everything below is on main after the design round; with `SKILLS_UPDATE.live` false the game is the Phase 5 game (npm test,
test-sim byte-identical, `cold-hot`).

### 12.1 `config.js` (Skills section, at the end)
- `SKILLS_UPDATE = { live: false, levelPoints: [4, 9, 22], flocks: 2 }`; `skillLevelPoints()` (the thresholds in force);
  `unlockLevel(u)` (a view's level: `UNLOCKS.siloDays.levelLive` 2 and `feedGraph.levelLive` 3 while live).
- `SKILL_STEP_NAMES`, `SKILL_SHORT` (*Water*, *Ventilation* … for "handled by the controller (Water 3)").
- `SKILL_VIEWS` (the 11 level 1 views: `shows`, `where`, `keyId?`, `jobs`), `PAYOFFS` (22: `branch, level, step, name, saves,
  where, jobs, by`, + `system`, `fault`, `need`; texts may hold `{key:id}` tokens), `AUTO_SYSTEMS` (7: `branch, payoff, label,
  glanceAt, reading, keeps, jobs`), `AUTO` (every model value of §3–§4), `FAULTS` (6: `system, selfKnown, spot, plate, fix,
  what` + their bounds), `FAULT_PLAN` (per condition `max, chance, weights`; `window`, `rngMul`), `lightPresetForDay(day)`.

### 12.2 Events and actions (`events.js`)
- `EV.PERKS` `{ version, keys }` · `EV.AUTO` `{ system, did, text, args, day, hour }` · `EV.FAULT` `{ id, system, phase:
  'start'|'found'|'fixed'|'dropped', text, cause, sign, place, spot, line?, day, hour }` · `EV.BIRD_SEEN` `{ index, look, x, z }`.
- `ACTION_IDS` += `auto.glance` (ui-only: `UI_ACTION_IDS_SKILLS`; `{ system }`), `auto.reset` (`{ system, line? }` →
  `{ reset, system, line? }`), `auto.calibrate` (`{}` → `{ offsetC, sensorC, houseC }`), `scale.read` (`{ day? }` → `{ day, n,
  meanG, uniformityPct, fouled }`), `scale.clean` (`{}` → `{ cleaned }`).
- Existing actions take a `from` / `by` field where a payoff sends them (no new id): `water.flowtest { line, from: 'supply' }`,
  `vent.timer { …, by: 'calc' | 'auto' }`, `vent.fans` / `vent.pad { …, by: 'advice' }`, `heat.setpoint { c, by: 'row' | 'auto' }`,
  `light.program { …, by: 'week' | 'auto' }`, `feed.order { …, from: 'silo' | 'pocket', by?: 'auto' }`, `dead.count { …, at:
  'pickup' }`, `chicks.tip { …, by: 'helper' }`, `phone.* { …, from: 'pocket' }`, `water.height` / `feed.line { …, by: 'auto' }`.
  A controller's action is `quiet` (no EV.ACTION; its EV.AUTO instead).

### 12.3 The perks (`src/perks.js`, working; owner "model")
`createPerks({ skills, settings, events, allowed })` (main.js: `ctx.perks`, `__game.perks`; in `deps` for ui and level):
`has(key)`, `auto(system)`, `need(jobId)`, `easier(jobId)`, `handled(jobId)`, `list()`, `allowed` / `allow(on)`, `version`,
`refresh()`; EV.PERKS on a change. **Every payoff is read through the perks** (never `skills.unlocked` alone: the steps files that
patch `unlocked` for a layout review must turn no automation on). Under `navigator.webdriver` `allowed` starts false.

### 12.4 The skills (`src/skills.js`; owner "model")
In code now: `levelPoints()` (the thresholds in force), `unlocked(key)` for view keys (by `unlockLevel`) and payoff keys (the
branch level, while live), EV.SKILL_UNLOCK for the payoff keys a level passes (`{ key, payoff: true }`, while live),
`debug.force(branch, level | null)` (harness and node tests; never saved; emits EV.SKILL_UNLOCK so the perks follow). The model
package adds: the two-flock slots (§2.2, `serialize` v2, `points(branch, { slot })`, `milestones()`'s `tiers2` / `points2`,
EV.SKILL_POINTS `slot`), `MILESTONES_PAYOFF` merged while live, the rules following `perks.need` (§3.5, §3.8) — `evaluate(…,
ctx)` gets the job's recorded need from `records.logJob`.

### 12.5 The farm's automation and faults (`src/farm-auto.js`, `src/farm-faults.js`: stubs wired; owner "model")
`installAuto(farm, env)` (called by `createFarm`) adds `farm.auto` (plain data: `on, hold, last, faults, drift, quietN`; saved in
`farm.serialize().auto`) and `farm.autoCtl` (a getter: `quiet(on)`, `ok(system, inst)`, `status()`, `sensorC()`), wraps `farm.step`
(`stepAuto` after the model's step), `farm.act` (the four farm action ids of §12.2 → `autoAct`, with EV.ACTION), `farm.start`
(`planFaults`), `serialize` / `restore`. `farm-faults.js`: `planFaults`, `stepFaults`, `openFaults`, `faultWords`, and
`farm.debug.fault(id, opts)` / `farm.debug.faults()`. Exports for the others: `adviseFans(env, farm)` → `{ fans, pad, why }`
(the panels' suggestion), `preheatHours(env, farm)` (the heat-loss readout's line), `AUTO_ACTION_IDS`. Stubs today: nothing acts,
`ok()` false, no fault planned, `debug.fault` records an open fault with no model effect, the actions answer their shapes.
The model package also adds `feedDays(farm, env)` → `{ days, kgPerDay, bySilo }` to `farm-silos.js` (the gauge, the warning,
the controller and the order all read one figure).

### 12.6 The job variants (`src/job-variants.js`: stub; owner "jobs")
`jobVariant(jd, perks, ctx)`, `variantKeyOf(jd)`, `rebuildVariant(jd, saved, perks)`, `VARIANT_V`: shapes in the file's header
(§4.3). The engine takes `createJobEngine({ …, variant })` and calls it in `make()` and `restore()`; new state tests `auto-ok`
(`{ system }`), `drinkers-raised`, `pans-raised`; new rule type `seen` (`{ type: 'seen', look, n, sectors }` counting EV.BIRD_SEEN).

### 12.7 Milestones and sign lines (contract data)
`src/skills-payoff.js` `MILESTONES_PAYOFF` (§2.3; merged by "model" while live). `src/content-signs-skills.js` `SKILL_BOARD_ITEMS`
and `mergeBoardsSkills(boards, day)`, called by `content-signs-cycle.js boardsForDay` while live (in code now).

### 12.8 Settings (`settings.js`)
Group `automation` (`all` + one bool per branch, all true; hidden: the tab is drawn by "jobs" only while live). The perks read
`automation.all` and `automation.<branch>` and refresh on EV.SETTINGS of the group.

### 12.9 One owner, one signature (the hand-over points)
| What | Owner | Signature |
| --- | --- | --- |
| A payoff holds | model (perks.js) | `perks.has(key)`, `perks.auto(system)`, `perks.need(jobId)`, `perks.easier(jobId)`, `perks.handled(jobId)` |
| The controllers on | jobs (level.js) | `farm.auto.on[system] = perks.auto(system)` at start / resume / EV.PERKS / EV.SETTINGS; `farm.autoCtl.quiet(true/false)` around goto(auto) and standard starts |
| The glance | panels | `L.uiAct('auto.glance', { system })` once per opening, after `AUTO.glanceSec`, by every panel in `AUTO_SYSTEMS[s].glanceAt` while `perks.auto(s)` |
| The reading in band | model | `farm.autoCtl.ok(system, inst)` |
| The fan suggestion | model | `adviseFans(env, farm)` |
| The pre-heat time | model | `preheatHours(env, farm)` |
| Feed days | model | `feedDays(farm, env)` |
| A fault's words | model | `faultWords(fault, env, farm)` → `{ what, cause, place, fix }`; EV.FAULT |
| The Equipment row | model (flock-watch.js) / jobs (ui-watch.js) | `watch.status().rows.equipment` → `{ state, label: 'Equipment', value, detail, faults }` |
| The early warning | model (flock-watch.js) / jobs (level.js) | `watch.setLead({ comfortH, fix })` (level.js from `perks.has('earlyWarning')`); warnings carry `fix` |
| The job's need | jobs (variant) / model (rules) | `records.logJob(key, day, result, { need })`; rules read it |
| The bucket's tally | scene | `dead.count { n, causes, at: 'pickup' }` at pickup while `perks.has('tallyBucket')`; `props.bucketTally` `{ n, max }` |
| Symptom tags, gait seen | scene | EV.BIRD_SEEN; `flock.tags()` for the harness |
| The helper | scene | `props.helper` `{ state, stack }`; `chicks.tip { by: 'helper' }` |
| The pocket phone | jobs (ui.js, keys.js) / panels (ui-records.js) | key `phone` (KeyR) → `ui.openPanel('pocket-phone')`; the panel registered by `registerRecordsPanels` |

## 13. Tests, hooks and harness scenarios

### 13.1 Node tests (each package adds its own file to `npm test` at its merge)
- **`scripts/test-skills.mjs`** (model): the two-flock points (a replay raises a slot only; a third flock only slot 2; v1 profile →
  slot 1; `mergeProfiles` per slot); the thresholds while live; `skill-progress` (§2.5: ideal and normal, flocks 1 and 2, the
  table); the four new milestones on the ideal (earned) and on their mistakes (`noDark` → `dark-fin` not earned …); the need-
  following rules (`vent-checked` with 3 readings under Brooding 2; `weighed-weekly` with 25; with the scale read).
- **`scripts/test-auto.mjs`** (model): for every system with `farm.auto.on[system]` and the ideal's rounds without the jobs the
  system takes (profile option `auto: true`): the winch keeps every line ±3 cm of the plate from day −1 to 41 (and never > 2 cm a
  farm hour); the timer 90–130 % of the need at every 06:00 and back to the table at 18:00 after a hand setting; the stages keep
  the hot afternoons' panting under the ideal's (days 25, 30–32, 38) with ≤ the ideal's heat deaths; the brooders the row at every
  06:00; the feed never under 1 day with an order on the way, rims ±3 cm from day 4; the lights the program of the age; the scale
  ≥ 300 weighings by 14:00, its mean within 1 % of the flock's. The whole cycle with every system on passes every level at the
  ideal's figures ± 1 % (weight, FCR, EPEF) — **the automated job done by the equipment**. Then every fault through
  `farm.debug.fault`: its effect within its bound (§5.1), EV.FAULT `start`, the Equipment row red (or amber → red for the cross-
  checks within 1 farm hour), a flock watch warning of kind `equipment` with what / cause / place, a Next job skip stopped
  (`level.skip` in test-level style), fixed by the hand action of `FAULTS[id].fix` (EV.FAULT `fixed`), the level passing; the
  plan (`planFaults`): the normal season's flocks 1–20 seeds average 0.6 faults (0.5–0.7), the harder ones 2, every fault time
  inside its window, none in a level's last 24 h; no fault while `quietN` > 0 (a standard start through level.js plays as on main).
- **`scripts/test-payoffs.mjs`** (jobs): `jobVariant` for every payoff (the need, the glance any-rule and its two ways to finish,
  r-raise split, the places); a variant instance saved and resumed with the same rule; perks off (settings, allow, live) → the job
  exactly as on main; `easier` texts (*"Growth 2 would weigh 25 birds instead of 50 · 4 points to go"*, *"in a second flock"*);
  the handled line; the unlock caption's words (step, name, where, saves); every new text verdict-free and token-filled.
- **`scripts/skill-time.mjs`** (jobs, §14): the play-time model of a day with no skills, every branch at level 2, every branch at
  level 3: days 8, 16, 25, 37; asserts the savings of §14.2.
- Earlier tests extended by their owners: test-watch (the Equipment row, the comfort lead and its fix), test-night (a night check
  with an open timer-reset / sensor-drift names it), test-jobs (the `auto-ok` / `drinkers-raised` / `pans-raised` tests, the `seen`
  rule), test-level (perks wired: a lone brooding week with Brooding 2 forced asks 3 vent chicks; goto(auto) with every system on
  quiets them), test-contracts (the design round's four skills cases, in code now).

### 13.2 `window.__game` hooks
`__game.perks` (`allow(true)` first in every skills steps file; `has`, `list()`), `__game.skills.debug.force(branch, level)`,
`__game.config.SKILLS_UPDATE.live = true` (a steps file sets it before `startRun`), `__game.auto()` (= `farm.autoCtl.status()`),
`__game.farm.auto`, `__game.farm.debug.fault(id, { line })`, `__game.farm.debug.faults()`, `__game.flock.tags()` (scene),
`__game.props.bucketTally` / `props.helper` (scene), `__game.ui.openPanel('pocket-phone')` (panels).

### 13.3 Harness steps files (`--size 960x600`, real input where the line says so)
| File | Package | What it proves (expected numbers) |
| --- | --- | --- |
| `scripts/skills-water.json` | panels | Water 2 forced, day 8 06:30 standard start: walk to the water supply, *Test all four lines* by a real click, the clock runs 1 farm minute, four readings in the strip (each 27–29 ml/min for age 8 + 20 = 28), r-drinkers done **without visiting a regulator**; line 3 set off band by hook → the strip names the line 3 regulator, walked there, − pressed, tested, done. Play time ≤ 40 s (no skill: about 60 s). |
| `scripts/skills-minvent.json` | panels | Moisture 2 forced, day 9 06:30: the controller by real input, Ventilation tab, *Fill the timer* (one click), the timer 105–115 % of the vent sign's need, r-minvent done; no *One second more* pressed. |
| `scripts/skills-feed.json` | panels | Feed 2 forced, day 13 09:00 with the silo at 2.0 days (hook): the caption *about 2 days*, walk to the silo gauge, *Order to 3 days* by real click, `w2-order` done at the gauge (no walk to the office); the order due day 14 09:00. |
| `scripts/skills-weigh.json` | jobs | Growth 2 forced, day 14 08:30: the weigh job reads 25; the frame set down in 5 parts by real input, 5 birds weighed in each (*Weigh next* × 5, then lift the frame), w2-weigh done at 25; `weighed-weekly`'s need 25 recorded. Play time ≤ 70 % of the 50-bird run. |
| `scripts/skills-phone.json` | jobs | Planning 2 forced, day 37 08:00 inside the house: R by a real key press opens the Phone page; *Book the crew and the trucks* by real click; `f-book` done with the farmer still in the house (distance to the office desk > 30 m). |
| `scripts/skills-tree.json` | jobs | The tree's three rows per branch, *saves* lines, *points to go*, *on* / *off in Settings*; the unlock caption on a forced level; Settings → Automation (12 switches) by real clicks; the job card's *would* line and *handled by the controller (Water 3)* line at 960 × 600 without overlap (the p5-hud checks). |
| `scripts/skills-auto.json` | model | Every branch at 3 forced, day 25 13:00 (a standard start): `__game.auto()` all running; the clock runs to 16:00 at 4×: the stages add fans (`env.fansOn` 2 → 6 as the house warms), the pad on from the pad plate's rule, `r-fans-pm` and `p-panting` done by the glance at the controller (one E, panel open 2 s); day 24 → 25: the feed controller's order at 2.0 days (EV.AUTO, the notebook's *Feed ordered by the controller*), the truck at 09:00. |
| `scripts/skills-fault.json` | model | Water 3 forced, day 24 09:00: `farm.debug.fault('winch-stall', { line: 2 })`: the Equipment row red within one farm step, the caption, a Next job skip stops at once; the farmer walks to the line 3 regulator by real input, winches to the plate's height, *Reset the motor*: the row steady, EV.FAULT fixed; the r-raise job done by the glance with line 3 by hand. |
| `scripts/skills-scene.json` | scene | The winch motors and lamps (green, red when stalled), the sensor box and dial, the helper tipping stacks on day 0 (6 stacks tipped by 08:40 with the farmer carrying 3), the bucket's tally (5 birds within 2.5 m in one E), symptom tags within 2 m, the comfort colours on entering — screenshots reviewed, draw calls ≤ 110. |
| `scripts/skills-play.json` | integrator | Generated by `scripts/skills-play-steps.mjs` on the p3-cycle helpers, `live` on: a second flock's day 16 by real input with every branch at 3 against the same day with none (§14.2), the four-line test, the calculator, the auto stages, the auto order, the pocket phone, the 25-bird weighing, the winch fault caught and fixed — all by real input. |

## 14. Play time saved (measured, package "jobs" with the integrator)

### 14.1 The model (`scripts/skill-time.mjs`, node)
A day's play time = for each job of the day (the engine's instances of that day in the card's order, the ideal's rounds deciding
which problem jobs open) the walk from the last place to the job's places (`job-next.js jobPlaces` / `nextPlace` with the
variant's places; the route length from `player-path.js` on the farm's colliders, at 4 m/s) + 2 s per press the job needs (a
table per rule: each flow test 2 presses, a timer step 4 presses without the calculator and 1 with it, a weigh 1 press a bird
…) + the real seconds of its farm-time waits at the panel clock (1 farm minute = 2.5 s at 24 game s per real s) + the glance
(1 s open) for a handed-over job. The same day three times: no skills, every branch at level 2, every branch at level 3
(faults off). Printed per job and per day.

### 14.2 Expected (acceptance)
| Day | No skills (min, model) | Level 2 | Level 3 | Measured by real input (§13.3 `skills-play.json`) |
| --- | --- | --- | --- | --- |
| 8 (lights, lux, timer, lines raised) | about 4.4 (as p3-cycle: 4.4) | ≤ 85 % | ≤ 65 % | — |
| 16 (droppings, warm afternoon) | about 4.7 | ≤ 85 % | ≤ 70 % | ≤ 3.4 min with every branch at 3 (p3-cycle's day 16: 4.6–4.7) |
| 25 (hot afternoon) | about 4.1 | ≤ 85 % | ≤ 60 % | — |
| 37 (the crew booked) | about 4.2 | ≤ 80 % | ≤ 65 % | — |
The model's no-skill figures must land within 15 % of p3-cycle's measured play times (ARCHITECTURE.md) or the model is tuned
first. The savings come mostly from: the four regulators (Water 2), the fan panel at the far end (Ventilation 2 at the controller,
Ventilation 3), the office (Planning 2, Feed 2), the bin trip (Biosecurity 2), the weighing (Growth 2 / 3), the timer and the
thermostat presses (Moisture 2, Heating 2), and the raise days (Water 3, Feed 3).

## 15. Work packages (four, disjoint files, parallel worktrees)
Each engineer works in `git worktree add ../cfs-<key> -b skills/<key> main`, edits **only the files listed** (new files with the
listed prefixes are theirs too), codes against the contracts in code (§12; §12.9 has one owner and one signature for every
hand-over), writes in chunks of ≤ 250 lines and commits after each working milestone, and keeps these passing on the branch:
`npm run build`, `npm test`, `node scripts/shoot.mjs --scenario cold-hot --size 960x600`, `--scenario p2-hooks`, `--steps
scripts/phase1-jobs.json`, `--steps scripts/p2-level1.json`, `--steps scripts/hotfix-steps.json`, `--steps scripts/req-night.json`,
`--steps scripts/p5-design-stubs.json`, `--steps scripts/skills-design-stubs.json`, plus the earlier files its own files touch
(listed in its section). `node
scripts/test-night.mjs` (full) for model and jobs. `npm run perf` runs alone. **Frozen for every package** (changes go through the
integrator): `src/main.js`, `src/events.js`, `src/interact.js`, `src/clock.js`, `src/round.js`, `src/sim.js`, `src/content-signs.js`,
`src/content-signs-cycle.js`, `src/content-signs-cond.js`, `src/motion.js`, `build.mjs`, `package.json`, `scripts/shoot.mjs`,
`scripts/test-contracts.mjs`, `scripts/test-sim.mjs`, `scripts/test-perf.mjs`, `scripts/p3-cycle-steps.mjs`, `scripts/p4-cycle-steps.mjs`,
`scripts/night-steps.mjs`, `scripts/req-steps.mjs`, every earlier steps file (with `scripts/skills-design-stubs.json`), `SKILLS.md` (each package reports its measured numbers;
the integrator writes them in) and `src/config.js` — except the **values** (never the keys) of `SKILLS_UPDATE.levelPoints`, `AUTO`,
`FAULTS` and `FAULT_PLAN`, which package **model** owns. What every package must know in one paragraph: **with
`config.SKILLS_UPDATE.live` false the game is exactly the Phase 5 game** — every payoff, word and sign line goes behind it (a steps
file sets `__game.config.SKILLS_UPDATE.live = true` before `startRun`, and calls `__game.perks.allow(true)`; node tests set the
switch and restore it in a `finally`); **every payoff is read through `ctx.perks`** (`has`, `auto`, `need`, `easier`, `handled`),
never through `skills.unlocked` alone; a level is forced with `skills.debug.force(branch, level)`; a controller acts only through
`farm.auto.on` (level.js sets it) and never inside goto(auto) or a standard start; every text is plain English with no verdict word,
keys as `{key:id}` tokens, no farming fact outside a sign; facts go on signs with a source (all new ones general).

### 15.1 `model` — the points, the perks, the controllers, the faults, the watch (branch `skills/model`)
**Owns:** `src/skills.js`, `src/skills-rules.js`, `src/skills-rules-cycle.js`, `src/skills-rules-cond.js`, `src/skills-cycle.js`,
`src/skills-cond.js`, `src/skills-payoff.js`, new `src/skills-rules-payoff.js`, `src/perks.js`, `src/farm.js` and every `src/farm-*.js`
(`farm-auto.js`, `farm-faults.js`, `farm-act.js`, `farm-cycle*.js`, `farm-silos.js`, `farm-water.js`, `farm-feed.js`, `farm-cond*.js`,
`farm-profiles*.js` …), `src/heat-diag.js`, `src/flock-watch.js`, `src/night-check.js`, `src/records.js`, `src/records-cycle.js`,
`src/records-cond.js`, `src/save.js`, `src/save-slots.js`, the values of config's Skills section (above); scripts: new
`scripts/test-skills.mjs`, new `scripts/test-auto.mjs`, `scripts/skill-progress.mjs`, `scripts/test-watch.mjs`,
`scripts/test-night.mjs`, `scripts/test-cycle.mjs`, `scripts/test-cond.mjs`, `scripts/test-saves.mjs` (cases added), new
`scripts/skills-auto.json`, new `scripts/skills-fault.json`.
**Contract:** §2 (points, thresholds, the four milestones, the normal profile, the targets), §4 (the controllers), §5 (the faults),
§8 (records), §11 (the profile and the farm's save), §12.3–§12.5, the model rows of §12.9.
**Build:**
1. Two-flock points in `skills.js` (§2.2): `earned` per slot by `profile.cyclesDone` at the award, `points(branch, { slot })`,
   `milestones()` with `tiers2` / `points2`, EV.SKILL_POINTS `slot`, `serialize` v2 (+ `earned` best of both for old readers),
   `restore` of v1 into slot 1; `save-slots.js mergeProfiles` per slot. While `live` is false: slot 1 only (Phase 5 exactly).
2. `MILESTONES_PAYOFF` merged into the evaluated and shown tables while live (`skills.allMilestones()` for the tree), their
   rules (§2.3); the need-following rules (`vent-checked`, `vent-band`, `weighed-weekly` read the job's need from `records.logJob`;
   a scale read with ≥ 300 weighings counts for `weighed-weekly`).
3. The `normal` profile (§2.4): a Phase 2 part (`smallMistakes` + late vent temperatures) and a cycle part (the slips of the
   table, each a profile field), `runCycle('normal')`; `runCycle(name, { skillsFrom, cyclesDone })` to play a second flock on the
   same skills; `skill-progress.mjs` as the acceptance of §2.5 (`--json` prints the table the integrator records).
4. `farm-auto.js` (§4): the seven controllers (`stepAuto` every farm step; hourly / 06:00 as §4.1), the farmer's hold
   (`AUTO.handHold`), the quiet counter, `ok(system, inst)` for each system's band, `status()` with each system's words,
   `sensorC()`, `adviseFans` (the ideal's fan rules: move `idealFans` / `idealPad` / `fansForFeel` / `eveningPad` into a module both
   the profiles and the controller import, without changing the ideal's play), `preheatHours`, the actions of §12.2, `feedDays` in
   `farm-silos.js`; a profile option `auto: true` that turns every system on and drops the ideal's rounds the systems take over.
5. `farm-faults.js` (§5): the plan (its own rng, never `farm.rng`), the six faults' effects and bounds, the fixes by hand, the
   rainy season's stage trip after each cut (`farm-cond-power.js` EV.POWER on → the stages off while `stages` is on), EV.FAULT,
   `faultWords`, the debug hooks.
6. `flock-watch.js`: the Equipment row (§5.3; shown while any system is on; its warning kind `equipment`), `setLead({ comfortH,
   fix })` (Comfort 2: warn at 2 hours, the fix from `coldFixes` / `adviseFans` in the text and as `w.fix`), the sensor drift and the
   stage trip in the comfort causes (`watchState` carries `farm.auto`), the scale's weight read only when not fouled.
   `night-check.js`: an open timer-reset / stage-trip / sensor-drift in the check's rows and its fix line. `heat-diag.js`: the
   drifted sensor as a cold cause (*"the controller's sensor reads 2.4 °C over the house thermometer"*).
7. Records (§8): kinds `auto`, `fault`, `skill`; the day row's equipment note; the cycle summary's line.
**Acceptance:** `node scripts/test-skills.mjs` and `node scripts/test-auto.mjs` (§13.1, every case); `node scripts/skill-progress.mjs
ideal normal` meets §2.5 (ideal: every branch L2 after flock 1, none L3, all L3 after flock 2; normal: ≥ 9 L2 after flock 1, none L3,
≥ 9 L3 after flock 2); test-cycle and test-sim unchanged (the ideal's figures exactly as on main with no system on: harvest 2,887 g,
FCR 1.58, EPEF 427 — test-cycle's bands); test-cond full 31 ok; test-night full and test-watch with the new cases; `skills-auto.json`
and `skills-fault.json` PASS (§13.3); `req-night` 19, `req-watch` 13, `p3-cycle` 140, `p4-rainy` 17 unchanged (no perks under
automation).

### 15.2 `jobs` — the variants, the job card, the tree, the level's wiring, the keys and the settings (branch `skills/jobs`)
**Owns:** `src/job-engine.js`, `src/job-variants.js`, `src/job-strips.js`, `src/job-strips-cycle.js`, `src/job-strips-cond.js`,
`src/job-figures.js`, `src/job-next.js`, `src/content-jobs.js`, `src/content-jobs-cycle.js`, `src/content-jobs-cond.js`,
`src/content-signs-skills.js`, `src/content-guide.js`, `src/content.js`, `src/level.js`, `src/run.js`, `src/ui.js`, `src/ui-jobs.js`,
`src/ui-jobstrip.js`, `src/ui-skilltree.js`, `src/ui-watch.js`, `src/ui-night.js`, `src/ui-result.js`, `src/ui-hud.js`, `src/ui-help.js`,
`src/ui-run.js`, `src/ui-guide.js`, `src/keys.js`, `src/key-words.js`, `src/settings.js`, `src/ui-settings.js`, `src/ui-settings-keys.js`,
`src/ui-settings-style.js`; scripts: new `scripts/test-payoffs.mjs`, new `scripts/skill-time.mjs`, `scripts/test-jobs.mjs`,
`scripts/test-level.mjs`, `scripts/test-run.mjs`, `scripts/test-settings.mjs`, `scripts/test-fixes.mjs` (cases added), new
`scripts/skills-weigh.json`, `scripts/skills-phone.json`, `scripts/skills-tree.json`.
**Contract:** §3 (each payoff's job changes and places), §4.3 (the glance variant), §6 (the tree, the card, the strips, the caption,
the guide), §7 (settings), §9, §12.6–§12.8, the jobs rows of §12.9; reads `ctx.perks`, `farm.autoCtl`, `watch.status().rows.equipment`,
EV.PERKS / EV.AUTO / EV.FAULT / EV.SKILL_UNLOCK.
**Build:**
1. `job-variants.js` (§4.3, §12.6) and the engine's `variant` hook (`make()`, `restore()`, the saved `v` / keys); state tests `auto-ok`,
   `drinkers-raised`, `pans-raised`; rule type `seen` (EV.BIRD_SEEN); the needs of `quickSamples` / `weigh25`; `records.logJob` with
   `{ need }`; job-next places for `waterAllLines` (the supply, then lines out of band), `siloOrder` (the silo gauge), `pocketPhone`
   (none: *press {key:phone}*), the glance places.
2. `level.js`: `ctx.perks` → the engine's variant; `farm.auto.on` from `perks.auto` at start / resume / EV.PERKS / EV.SETTINGS;
   `farm.autoCtl.quiet(true)` around `debug.goto(…, { auto: true })` (so standard starts are quiet too); `watch.setLead` from
   `perks.has('earlyWarning')`; the night check and the skip guard read the Equipment row's warning as any warning.
3. The job card (`ui-jobs.js`): the *would be easier* line, the *easier now* row, *handled by the controller (Water 3)*, the fault's
   manual part first; the strips (`job-strips*.js`): the payoff rows at their places, the views' lines of §3.0.
4. The tree (`ui-skilltree.js`, §6.1): three steps per branch with *saves* / *where* / *also*, *on* / *off in Settings*, two-flock
   points, the 4 / 9 / 22 bar; the unlock caption and its notebook line (`ui.js`, §6.3); the result screen's list (`ui-result.js`).
5. `ui-watch.js`: the Equipment row (its round / triangle / square glyphs and words as the other rows), *Show me* (Comfort 2: the
   job marker to the fix's place for `AUTO.showMeH`); `ui-night.js`: the fault line.
6. Keys and panels hooks (`keys.js`, `ui.js`, `ui-hud.js`, `ui-help.js`, `content.js`): action `phone` on **KeyR** (group farm,
   rebindable) → `ui.openPanel('pocket-phone')` in a level while `perks.has('pocketPhone')` (else a caption naming Farm Planning 2);
   the time bar's phone key; the legend rows *(Brooding 1)* for F / C / M; Comfort 3's view on house enter (`flock.setOverlay`);
   the Feed 2 warning caption at 2 days (`feedDays`).
7. Settings → Automation (shown only while live: `ui-settings.js` draws the tab: *all* then one switch per branch, each with
   its branch's level; a branch under level 3 reads *"comes with level 3"*); the guide's Skills section; `content-signs-skills.js`
   (reword only).
8. `skill-time.mjs` (§14).
**Acceptance:** `node scripts/test-payoffs.mjs` (§13.1); `node scripts/skill-time.mjs` meets §14.2; test-jobs, test-level, test-run,
test-settings with their cases; with `live` false every earlier steps file unchanged (`p5-cross` 61 with six tabs, `p5-settings` 28,
`p3-run-ui` 16, `p5-hud` 20, `p5-look` 35); `skills-weigh.json`, `skills-phone.json`, `skills-tree.json` PASS (§13.3) with `live` on.

### 15.3 `panels` — every payoff where the job is done (branch `skills/panels`)
**Owns:** `src/ui-water.js`, `src/ui-equipment.js`, `src/ui-climate.js`, `src/ui-controller.js`, `src/ui-cycle-controller.js`,
`src/ui-cycle-fans.js`, `src/ui-cycle-equip.js`, `src/ui-cycle-water.js`, `src/ui-cycle-house.js`, `src/ui-records.js`, `src/ui-inspect.js`,
`src/ui-cycle-birdcheck.js`, `src/ui-cycle-plan.js`, `src/ui-cycle-kit.js`, `src/ui-cycle-style.js`, `src/ui-cycle-panels.js`,
`src/ui-cycle-clean.js`, `src/ui-cycle-harvest.js`, `src/ui-letters.js`, `src/ui-summary.js`, `src/ui-boards.js`, `src/ui-cond-*.js`,
`src/ui-farmtime.js`, `src/ui-format.js`; scripts: new `scripts/skills-water.json`, `scripts/skills-minvent.json`,
`scripts/skills-feed.json` (and their generators if any, `scripts/skills-panels-*.mjs`).
**Contract:** §3 (each payoff's panel: keys, readings, the farm-time notes), §4.2 (*Your setting holds until …*), §5.1 (the fix
keys), §6.2's strip rows (drawn by the strips the jobs package writes: mount them as now with `withJobStrip`), §12.2 (the actions'
`from` / `by` fields), §12.9's panel rows (the glance; the pocket phone panel); reads `L.perks` (`ctx.perks`), `farm.autoCtl.status()`,
`adviseFans`, `preheatHours`, `feedDays`. Until the model merges, `farm.autoCtl` answers its stub shapes (nothing running, no
fault, `adviseFans` the fans as they are): the panels draw their level 3 rows from `status()` as it is and are checked with forced
levels (`skills.debug.force`) and `farm.debug.fault`; a figure the model will give (`feedDays`, `preheatHours`) is computed in the
panel as today's `siloDays` view does, and switched to the model's function at the merge.
**Build:**
1. **Water supply** (`ui-water.js`): *Test all four lines* (Water 2; four `water.flowtest { line, from: 'supply' }` over one farm
   minute through `equipShell().needTime`, each reading in the strip and the panel's line rows); the *Trend* key beside the meter
   (`waterTrend`'s graph inline); the four winch heights against the plate with each motor's state (Water 3) and the glance.
   **Drinker regulator** (`ui-equipment.js`): the winch motor's row (running / held / stalled), *Reset the motor* (`auto.reset {
   system: 'winch', line }`), the farmer's winching holding *until 06:00*.
2. **Controller** (`ui-climate.js`, `ui-cycle-controller.js`): *Set to the sign's row* (Heating 2), the pre-heat line on the heat-loss
   readout, the sensor beside the thermometer and *Check the sensor against the thermometer* (`auto.calibrate`, Heating 3); *Fill the
   timer* in the calculator (Moisture 2); *Program for day N* (Lighting 2); the Tunnel fans row's suggestion and *Set as suggested*
   (Ventilation 2); the controllers' lines since the last read (*"Timer: stepped to 1 fan 21 s / 300 s at 06:00 …"*) and each
   handed-over system's state; the glance (`auto.glance` for timer, brooders, lights, stages after 1 s).
3. **Fan panel** (`ui-cycle-fans.js`): the suggestion and *Set as suggested*; the stages run by the controller (*"The controller's
   stages run the fans (Ventilation 3)"*), *Stages on* after a trip (`auto.reset { system: 'stages' }`); the glance.
4. **Silo gauge and feeder box** (`ui-cycle-equip.js`): the days of feed (`siloDays`, level 2 while live), the 2-day line, *Order to 3
   days* / *Order to the catch* (`feed.order { …, from: 'silo' }`, the farm-time note), the automatic order and its confirmation (or
   *not confirmed* with the fault's words), the rims kept by the feed controller; the glance at both.
5. **The pocket phone** (`ui-records.js`): register `pocket-phone` (the Phone page alone, kind 'paused', the same keys with `from:
   'pocket'`, its job strip); signing stays on the desk's book.
6. **Bird in hand and the scale** (`ui-inspect.js`, `ui-cycle-birdcheck.js`): *Next chick* (Brooding 2: `flock.catcher.nextNearest`),
   the strip's 3 / 6 / 25 (from `perks.need`); the weigh panel's *Records* line (`recordsTargets`); the bird scale's display
   (`scale.read`: count, mean, uniformity), *Clean the platform* (`scale.clean`), the glance (Growth 3).
7. **The plan** (`ui-cycle-plan.js`): `planReady` — the sheet filled from the last cycle with the sums shown, *Send* after a look.
8. `ui-summary.js`: each graph's hint names its level by `unlockLevel` (Feed's graph at level 3 while live).
**Acceptance:** `skills-water.json`, `skills-minvent.json`, `skills-feed.json` PASS at 960 × 600 with the numbers of §13.3 (the
four-line test without a regulator visit; the timer 105–115 % in one press; the order at the gauge); every panel with a new key fits
960 × 600 with no sideways scroll (the p5-a11y rings and floors on the new keys: run `p5-a11y.json` and `p5-cross.json`, both
unchanged in count with `live` false); `p3-panels-*` and `p4-panels-*` unchanged with `live` false; `hotfix-steps` 21, `p2-level1` 58.

### 15.4 `scene` — the equipment, the helper, the bucket, the tags (branch `skills/scene`)
**Owns:** `src/props.js` and every `src/props-*.js` (new `src/props-helper.js`, `src/props-auto.js`), `src/house.js` and every
`src/house-*.js`, `src/flock.js` and every `src/flock-*.js` **except `src/flock-watch.js`**, `src/player-carry.js`, `src/ui-deadmarks.js`,
`src/world*.js`; scripts: new `scripts/skills-scene.json`.
**Contract:** §10 (every model and look), §3.5 (the catch reach, *Next chick*'s `flock.catcher.nextNearest(index, r)`), §3.10 (the
bucket: reach, tally, 30 birds, `dead.count { at: 'pickup' }`, the bin's empty), §3.9 / §3.10 (tags, EV.BIRD_SEEN), §3.5 (the helper,
`chicks.tip { by: 'helper' }`), §12.9's scene rows; reads `ctx.perks`, `farm.auto` / `farm.autoCtl.status()` (the lamps: running /
held / stalled), EV.FAULT, EV.AUTO (the cable's turn), `farm.autoCtl.sensorC()` (the LCD's figure beside the dial).
**Build:**
1. The winch motors and lamps on the drinker lines (Water 3 shown with its setting on), the cable's turn while a line moves; the
   sensor box and the dial thermometer by the controller (Heating 3); the scale platform's fouled look and its display post
   (Growth 3); one merged mesh per kind, lamps instanced.
2. The helper (`props-helper.js`, Brooding 3): appears when the truck stops on day 0, takes the next stack the farmer did not take,
   carries it to the next brooding part not tipped, tips it (the box tip, `chicks.tip { by: 'helper' }` so the farm places the
   chicks), walks back; leaves after the last stack; never blocks the farmer (its collider off, it steps aside); saved in the props'
   serialize (its stack, mid-carry → back to the pile on a resume).
3. The bucket (Biosecurity 2): `pickUp(x, z, AUTO.deadReachM)`, the tally counted at pickup (`dead.count { at: 'pickup' }`), at most
   `AUTO.bucketMax`, the tally's digit on the rim, the bin's E empties a counted bucket (no second count); `props.bucketTally`.
4. The chick reach (Brooding 2: `AUTO.chickReachM`) and `nextNearest` (*Next chick*); symptom tags (Biosecurity 3: within `AUTO.tagM`
   inside, `AUTO.tagMax` at once, `AUTO.tagSec`, kept off the HUD cards as the dead-bird chip) and EV.BIRD_SEEN (`gait` for a walking
   bird he passed within 2 m, once per bird per day); `flock.tags()` for the harness.
5. Under `prefers-reduced-motion`: no bob, no lamp blink. The GFX budget (110 draw calls, 650 K triangles, no shader linked after the
   warm-up: `p5-gfx.json`) holds with every new model shown.
**Acceptance:** `skills-scene.json` PASS (the helper: 6 stacks tipped by about 08:40 with the farmer carrying 3, placement within half
the no-helper time; 5 dead birds within 2.5 m in one E with the tally at 5 and the record counted; a tag over a lame bird at 1.5 m; the
lamps' three states; shots reviewed); `p5-gfx.json` 10 within budget with the new models; `p2-props-*`, `p3-scene-*`, `p4-scene-*`,
`req-bucket` 18, `req-deadmark` 6 unchanged with `live` false.

Every file not named in a package above is frozen for all four (the integrator's).

## 16. Integration order
1. Merge **model** (`--no-ff`): npm test, test-skills, test-auto, test-cycle and test-sim unchanged with `live` false.
2. Merge **jobs**: npm test, test-payoffs, skill-time; the earlier steps files with `live` false.
3. Merge **panels**, then **scene**: their steps files with `live` on; the earlier ones with `live` false.
4. Set `SKILLS_UPDATE.live = true` on main. Expected to need the integrator's hand: earlier steps files that read the skill tree's
   words or count settings tabs (`p5-cross`, `p5-settings`: a seventh tab), the help legend's height (`p3-run-ui`'s check), the boards'
   new lines on the 3D faces (`p3-scene-look`, `props-boards` fit), `p2-level1`'s *both branches level 2* (holds: 14 and 11 points),
   test-contracts' Phase 3 *level 3 reachable in one flock* case (it becomes the two-flock case of the design round).
5. Write `scripts/skills-play-steps.mjs` → `scripts/skills-play.json` (§13.3) and run it; measure §14.2 by real input; record the
   normal profile's table (§2.4), the progression days (§2.5) and the play times in this file and in ARCHITECTURE.md
   (*Skills update — as integrated*); every Phase 1–5 play-through and the night fix's `test-night` / `req-night` again.

## 17. Open questions for the farmer
1. **Level 3 waits for a second flock** (22 points; each milestone counts again in a later flock). Is that the right pace, or
   should an excellent first flock reach level 3 in its last week?
2. **Sample sizes with Brooding 2 and Growth 2:** 3 chicks for the vent check, 6 for the crops, 25 birds for the weigh-in. Fair for
   a Thai farm? (The bird scale plate will say 25 from five places give the mean within about 2 %.)
3. **Faults:** about one in two normal flocks meets one fault, harder flocks two. Too many, too few? Should a player be able to
   switch faults off (we did not offer it: you asked that automation sometimes fails)?
4. **No faults for the lights, the helper, the comfort view, the passing check or the plan.** Any you would add (a lamp row's dimmer
   failing, the controller's clock losing time after a blip)?
5. **The bucket with a tally:** the morning's dead birds wait in the lidded bucket until the afternoon round's bin trip. Acceptable
   biosecurity on your farms?
6. **The controllers' timings:** your own setting holds until 06:00 (winches, brooders), 18:00 (timer) or 2 hours (fans), then the
   controller takes over again; the timer runs at 110 % of the sign's table; the fan stages start on day 15; the feed controller
   stops ordering after day 35. Do these match the controllers you know?
7. **The helper on arrival day** (Brooding 3): realistic for a family contract farm, or should it be the driver of the chick truck?
8. **The pocket phone:** every call from anywhere, but the daily record is still signed at the office desk. Right?
9. **Settings:** level 3 can be switched off per branch; the level 2 shortcuts are keys you may use or not. Should level 2 be
   switchable too?
10. **The new sign lines** are all marked general practice. Do any belong to one of your guides?
11. **Measured time saved** (§14.2: about a fifth at level 2, a third at level 3): enough to feel, or should the payoffs save more?
