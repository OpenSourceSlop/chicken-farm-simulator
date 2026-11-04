# Chicken Farm — Phase 4 spec: simulation tuning and the harder replay conditions

**Goal (approved plan, build phase 4):** the birds and the house answer the farmer's settings the way well-run Ross /
Cobb-type broilers in a Thai tunnel-ventilated (EVAP) house do, across the whole cycle, and every number a sign shows
is what the simulation does. After his first full cycle the farmer can replay the cycle, or any level, under four
harder conditions: the **hot season**, the **rainy season**, **a bad batch of chicks** and **a water problem**. Each
changes the farm model and brings its own jobs, signs and record notes; each can be won by good play and lost by poor
play. The clarity leftovers of the last check are fixed.

Read with `ARCHITECTURE.md` (Phases 1–3 as integrated), `PHASE2.md` (Level 1, the job system, the model's Phase 2 part)
and `PHASE3.md` (the run, the cycle model, the contracts this file extends). This file adds what Phase 4 builds, the
shared contracts already in code (§10: the Phase 4 section of `src/config.js`, `src/events.js`, the contract code
`src/farm-tuning.js`, the contract data `src/content-jobs-cond.js`, `src/content-signs-cond.js`, `src/skills-cond.js`,
the stubs `src/farm-cond.js`, `src/ui-cond-panels.js`, `src/props-cond.js`, the checks `scripts/tuning-refs.mjs`,
`scripts/test-tuning.mjs`, the audit tool `scripts/tuning-audit.mjs`) and the four work packages (§12). Each package
section of §12 stands alone.

## 0. Rules that hold everywhere (approved design, do not break)

- **No lessons, no quizzes, no hidden-answer scoring.** Facts sit on signs and plates where they are used; the job list
  walks the farmer through each job and points to the signs that hold its facts. A condition is chosen by the farmer
  and named everywhere (run card, HUD, records, results): nothing about it is hidden.
- **No "correct" / "wrong" messages anywhere**, no green ticks, red crosses or praise. Results are measured numbers in
  the daily flock records, on gauges and in what the flock does. `scripts/test-contracts.mjs` checks every new title,
  sign line and milestone text for verdict words.
- **Every sign fact shows its source** in small text. The guide PDFs and content-map.md are not in the repo: only the
  facts of PHASE2.md §6.1 and PHASE3.md §5.1 carry a guide name, **every Phase 4 line is "general practice"**
  (test-contracts checks it), and no page numbers anywhere.
- **Every figure a sign prints is what the model does** (`config.SIGN_FIGURES`, §2.5): the run package prints the
  figure, the sim package's model gives it (`scripts/test-tuning.mjs`), test-contracts finds it on its board.
- **Missing a level's key target fails the level and you replay it.** The targets of PHASE3.md §2.1 hold in every
  condition; the one exception is written into the condition (a bad batch counts the chicks graded out at the table
  apart, §4.3). Skill points come from results of play; each branch level unlocks a tool or view (no new unlocks).
- Days pass in a few minutes of play with the *Next job* skip. Desktop browser, English, low-poly flat-shaded
  procedural art, one self-contained page (three 0.160.0 from jsDelivr), ARCHITECTURE.md's publishing constraints.
- **Earlier phases keep working**: the Phase 1 sandbox and its scenarios, Phase 2's lone brooding week
  (`__game.startLevel({ seed: 1 })`, `scripts/test-sim.mjs` unchanged), Phase 3's whole cycle (the normal season) with
  its tests and play-throughs, updated only where §2.6 says the tuning moves a number.

## 1. Player experience walkthrough

### 1.1 Every flock: what the tuning changes for the farmer
- **Moving air** cools big birds more (about 5–6 °C at 2.5 m/s for 5-week birds instead of 3–4 °C) and young birds a
  little more (about 7 °C at 2 weeks); it cools less once the house air is over about 35 °C and almost nothing near
  40 °C: then only the pads cool the birds. The heat sign and the fan panel's *Birds feel* readout say so.
- **Panting** spreads over about 4 °C of felt temperature instead of 1 °C: from day 35 the first birds pant at about
  24 °C felt, half at 26 °C, all at 28 °C. The flock no longer jumps from none to all panting within a degree, so
  "about 3 in 10 birds panting" is a real reading on the job strip and the comfort view.
- **Warm evenings of big birds** (the Phase 3 check's day-37 item, §2.4): at 19:00 the outside air is still about
  31 °C; with three fans most birds pant (about 9 in 10), with six fans about 3 in 10, with six fans and the pads none.
  The heat sign's evening line now says what to do: from week 5 every fan and the pads while the outside air is over
  about 30 °C, until about 21:00, then tunnel air all night. *Set the ventilation for the night* is done when no more
  than about a quarter of the birds pant (or every fan is on with the pads while the air is that warm).
- **Young birds on a hot afternoon** (week 3): six fans still bring them back; the pad with one or two fans does too
  (a new sign line). Six fans and the pad chill them, and the heat job does not count it.
- **Big birds make their own heat**: a closed house of 5-week birds on minimum ventilation at night warms to about
  29 °C at 05:00 and most birds pant; tunnel air all night keeps them comfortable (the heat sign's night line).
- **Water**: the birds drink more when they are warm (about 1.8 L of water a kg of feed in comfort, 2–2.5 on hot days,
  up to about 3 in a heat wave): the water meter's litres per 1,000 birds rise on hot days, and the drinker plate says
  why.
- **Older birds chilled** huddle and eat less before they die: 16-day-olds under six fans and the pad lose a few birds
  in the afternoon, not dozens.
- **The catch**: big birds no longer die of thirst in the three hours the lines are up for the crew.
- **Uniformity**: a well-run flock weighs 68–74 % within ±10 % at the day-40 weighing (Phase 3: 66 %).

### 1.2 After the first cycle: harder flocks
The cycle summary of a finished cycle (and the title card from then on, `skills profile.cyclesDone ≥ 1`) shows
**Harder flocks**: four cards side by side, each with its name, its months (where it is a season) and one line —
*Hot season · April–May: afternoons of 37–38 °C, nights hardly under 28 °C, a heat wave to about 41 °C in week 5*;
*Rainy season · August–September: damp air day and night, storms every week, a power cut in week 5*; *A bad batch of
chicks: small, uneven, many weak*; *A water problem: iron in the well water and an old pump*. Each card has *Start a new
flock in the hot season* (Plan the farm under that condition). The **run card** gives every reached level a condition
choice (*Normal season* · the four) beside *Play from a standard start*; before the first full cycle the choice reads
"Harder flocks: after your first full cycle" and nothing in it can be pressed. The HUD's clock card carries the
condition's name under the day ("Day 25 · Hot season"); the records book, the result screens and the cycle summary
name it in their headers ("Level 5 – Weeks 4 and 5 · Hot season").

### 1.3 The hot season (April–May; §4.1)
The prep day is already warm (the floor reaches 28 °C with little gas). From day 1 every afternoon the closed house runs
over the chicks' target: the new routine *Keep the chicks' afternoon heat down* (days 1–7, afternoon round) has him step
the timer up and from day 3 or 4 run one or two tunnel fans, while the brooders burn only at night. In week 2 the fan
panel's afternoon check and the night ventilation start on day 8 (not 15). Week 3's warm afternoon is 40 °C: the pad with
one or two fans for the 16-day-olds. In weeks 4–5 every afternoon wants the pads and all fans from about 11:00, the heat
wave reaches about 41 °C (a stopped fan or a dry pad section now costs birds), and days 33–35 bring hot nights (about
30 °C) that need the pads into the evening. From day 22 *Flush the warm water out of the drinker lines* comes every
afternoon (the water in the lines passes 30 °C and the birds drink less). Days 36–42 as Phase 3, with a 40 °C finishing
afternoon; the catch is booked after midnight.

### 1.4 The rainy season (August–September; §4.2)
The house air is damp day and night: the litter dries slowly and the minimum ventilation decides the litter and the
ammonia from week 1. Storms come on days 5, 12, 19, 26, 33 and 39 (four hours of rain, about 4 °C cooler, 98 %). On day 19
the storm drives rain in through the south side-wall inlets: *Wet litter along the south wall after the storm: find
what wets it* (the storm flaps on the controller's Ventilation tab) and *Put fresh litter on the wet strip*. The pads cool
only 2–4 °C in the damp air (the pad plate says so) and the hot afternoons of the normal season do not come. Days 29–31
are a damp spell (*The air in the house feels damp again*). Every week from day 8 *Test-run the generator*. On day 33 at
15:10, in the storm, **the power goes off**: the alarm sounds, the house goes dark, the fans and the pad stop, and
*The power is off: start the generator* opens pinned (a skip stops at it). He walks to the generator west of the house,
starts it and switches the house over: within half an hour few birds die; two hours without air cost a few in every
hundred and fail weeks 4–5. At 18:10 the mains is back: *switch over and stop the generator*.

### 1.5 A bad batch of chicks (§4.3)
The prep day has one more job: *Put feed trays and chick paper by the brooders*. The chick truck comes two hours late
with chicks from a young parent flock (the delivery ticket says so). The box weighing reads about 36 g and the grading
sample shows three or four weak chicks in ten: *Many weak chicks in the boxes* opens. At the chick table the new
*Grade the stacks* tab grades a stack in about 6 farm minutes (the weak ones go into the cull box: they are counted
apart and claimed from the hatchery), then the phone to the hatchery. *Brood the small chicks 1 °C warmer* (days 0–3) and
*Check the crops again at 48 hours* (day 2). The day 7 weigh-in is against his measured 36 g: 4.0 × is still the line, and
the week's deaths and floor culls may reach 2.5 %. Later weeks show the batch as a lower uniformity and a little less
weight, within the targets with good care.

### 1.6 A water problem (§4.4)
On day 1 *Test the well water* (the water supply's test kit, given with this condition): iron about 1.2 mg/L (the water
supply plate: over about 0.3 mg/L clogs the filter and the nipples). The filter blocks on day 3 (Phase 2), again on days
13 and 31 (*Low water flow again: find the cause*); on day 18 line 4's nipples clog (*One drinker line gives little
water*: flush it, then a flow test). From day 26 the old well pump gives about 8 % less each day: the afternoons' drinking
draws the tank down, the meter's litres per 1,000 birds stop rising, the birds crowd the drinker lines after 15:00 and
the droppings get firm and dry. *Read the water tank gauge* is a morning job from day 22; the tank under 30 % in the
afternoon, or a low flow test after 15:00, opens *The water tank runs low in the afternoon* → the pump at the tank:
pressure low, current high → *Repair the pump* (2 farm hours, best in the morning).

### 1.7 The result screens and the summary
Each result screen and the cycle summary name the condition; the summary of a condition cycle shows the farmer's last
normal-season cycle beside it when there is one (birds sold, mean live weight, FCR, EPEF, mortality by week). Records
rows carry the condition's notes (§3.3). The skill tree lists the condition milestones under their branches, marked
with the condition's name.

## 2. Tuning audit

### 2.1 Method
`node scripts/tuning-audit.mjs` (`npm run audit`; `--json` for the numbers) plays the ideal of PHASE3.md §6.14 through
the whole cycle (seed 1, about 3 s) and prints growth, intake, FCR, water, litter, ammonia and humidity by week, the
house and the birds at 05:00, 15:00, 19:00 and 22:00 on 14 days, deaths by cause and level, the harvest, the evening of
day 37, wind chill by age and air speed, and the minimum ventilation table per bird and per kg. The game column below
is the Phase 3 model as merged (main at `a93ff85`). The reference column is a fact the game already has (its guide
tag: PHASE2.md §6.1, PHASE3.md §5.1) or **general** broiler practice for Ross / Cobb-type broilers in a Thai EVAP house
(ranges, never page-cited). The Phase 4 responses are contract code in `src/farm-tuning.js`; their climate references
run on the env alone in `scripts/tuning-refs.mjs` and pass now (`node scripts/test-tuning.mjs`, in `npm test`).

### 2.2 The audit table
| # | Quantity | The game (Phase 3, ideal, by age) | Reference (source) | Verdict and fix |
| --- | --- | --- | --- | --- |
| 1 | Body weight | 200 / 498 / 986 / 1,630 / 2,310 / 2,914 g on days 7 / 14 / 21 / 28 / 35 / 41 = 1.03–1.055 × the target table | the target table 190 / 480 / 950 / 1,550 / 2,200 / 2,850 g (general, `weightAt`); breed objectives a little higher, Thai field flocks about the table (general); day 7 4–5 × chick weight (Week 1 guide) | OK (4.8 × on day 7) |
| 2 | FCR (flock, cumulative) | 0.87 / 1.12 / 1.26 / 1.36 / 1.45 / 1.54; harvest 1.58 (paid kg) | about 0.85–0.9 / 1.05–1.15 / 1.25–1.3 / 1.4 / 1.5–1.55 / 1.6–1.75 at 42 days (general) | OK. The records row's FCR reads 1.46 on day 41: the farmer's meter from day 0 over the automatic scale (+2 % ± 3 %): an instrument figure, kept and stated on the bird-scale plate (§6.9) |
| 3 | Feed intake | 70 / 120 / 151 / 175 / 192 g a bird a day on days 14–41: 95–97 % of the feed sign's 75 / 130 / 160 / 185 / 200 | about 75–85 / 130 / 160–170 / 185–200 / 200–215 (general) | OK (the sign prints the table; the flock eats about 96 % of it) |
| 4 | Water : feed | 1.80–1.87 L/kg on every weigh day, flat; + 0.03 per °C of house air over 30 °C | about 1.6–2.0 in comfort (sign-water, general); birds drink about 5–7 % more water per °C of heat (general): about 2–2.5 on hot days, up to about 3 in a heat wave | **Off** (flat in the heat). Fix: from Week 2 r = 1.8 × (1 + 0.05 × max(0, mean e)), at most 3.2 (`waterPerKgP4`); the drinker plate prints it (§2.5) |
| 5 | Target temperature | 34 °C day 1 → 20 °C day 35, a straight line | the ends: Week 1 guide / Broiler Ventilation; general tables about 29–30 °C at day 7, 27 at 14, 24–25 at 21, 22 at 28 | OK (the guide's ends; the line between runs 1–2 °C warmer than general tables in weeks 1–2 and is what the brooder sign prints) |
| 6 | Comfort zones, panting | cold under −1.5 °C; panting from hotFrom 1.5 (day 7) … 6.0 (day 35) °C over the target, 0 → 100 % of the birds within 1 °C | panting starts as the felt temperature passes about 31 °C at 2 weeks, 28–29 °C at 3 weeks, 24–26 °C for 5–6 week birds and spreads over several degrees as birds differ (general) | **Off** (1 °C ramp). Fix: a 4 °C ramp from hotFrom − 1.5; hotFrom 1.5 / 2.0 / 3.0 / 4.5 / 5.5 / 5.5 on days 7–42 (`pantShareP4`): big birds first pant at 24 °C felt, all at 28 °C |
| 7 | Wind chill | speed × (3.0 − 1.6 × clamp((age − 7)/28)): at 2.5 m/s 7.45 / 6.45 / 5.45 / 4.45 / 3.5 °C on days 7 / 14 / 21 / 28 / 35+; straight in speed; the same in any air | market-age birds about 5–7 °C at 2.5 m/s, young birds more; most of it in the first 1.5 m/s; it fades as the air nears body temperature, little left near 40 °C (general) | **Off** for big birds and hot air. Fix (`windChillP4`): K(age) × v^0.8 × 2.5^0.2 × τ(house °C), K 3.0 / 2.8 / 2.6 / 2.4 / 2.2 °C per m/s (days 7 / 14 / 21 / 28 / 35+), τ 1 up to 35 °C falling to 0.15 at 40 °C: 7.5 / 7.0 / 6.5 / 6.0 / 5.5 °C at 2.5 m/s, 30 °C |
| 8 | Temperature + humidity limit | pads off over 90 % house RH (`HEAT.padOffAboveRH`); felt + 0.08 °C per % RH over 75, + 0.35 over 88, faded in 24–28 °C | the plan's temperature + humidity limit; general: over about 90 % the pad adds more damp than cool | OK (one number on the plate; open question §14.3) |
| 9 | Pad cooling | 0.8 × (outside − wet bulb) × tunnel share: 6.2 / 7.7 / 9.6 °C at 33 °C 54 %, 36 °C 47 %, 39 °C 40 % = 67 / 73 / 82 % of the rule's 9.2 / 10.6 / 12 °C | about 1 °C per 5 % RH the air can still take up (Broiler Ventilation); a pad in good order gives most of it (general) | OK. The plate's "most of that, never all of it" is now a checked figure (60–95 %); the rainy season's 2–4 °C a new one |
| 10 | Minimum ventilation by weight | the sign table: 150 m³/h per 1,000 at 40 g … 3,650 at 3 kg = 0.16 → 3.65 m³/h a bird, 3.7 → 1.2 m³/h per kg | minimum ventilation per 1,000 birds by weight (Broiler Ventilation; numbers general): rates rise about as weight^0.75 | OK (the table rises 23 × from 40 g to 3 kg, weight^0.75 gives 25 ×; at the high end, fit for a humid house) |
| 11 | Too little minimum ventilation | `noStep` (the day-8 timer to day 21, cool season): night RH +4 points, litter +3, NH3 +2.5 ppm, −0.4 % at day 21 | in a heated house in dry cool air the moisture leaves with less air; in damp air it does not (general physics of the house) | OK for the cool season (the water balance holds); decisive in the rainy season (§4.2: `rainyNoStep` fails week 3) |
| 12 | Litter moisture | 22 / 24 / 26 / 27 / 28 / 29 % (days 7 → 41) | at or under 30 % (Broiler Ventilation); 20–30 % in a dry house (general) | OK |
| 13 | Ammonia | 6–7 ppm in week 1, 2–7 ppm after (tunnel air dilutes it) | under 20–25 ppm, 5–15 in a well-run house (general) | OK |
| 14 | Deaths by cause and level | brooding 0.63 % (weak 0.28, starve-out 0.22, other 0.12) · week 2 0.25 · week 3 0.44 · weeks 4–5 0.57 · finishing 0.46 incl. DOA 0.10 and **dehydration 0.07** · cycle 2.33 % | good flocks 2–4 % to 42 days; week 1 0.5–1.2 %; DOA 0.1–0.3 %; big birds do not die of thirst in the hours the lines are up for the catch (general) | OK except the catch. Fix: from day 21 no dehydration death in the first 6 h without water in reach (`dehydrationAllowed`) |
| 15 | Cold deaths of older birds | Phase 2's chick rate (0.04 %/h per °C² under e −4) from day 14: 16-day-olds under six fans and the pad lose about 3 birds an hour | chilled birds of 2–6 weeks huddle and eat less long before they die (general) | **Off**. Fix: from day 14 under e −(4 + 0.2 × (age − 14)), at most −8, at a quarter of the rate (`coldDeathRateP4`) |
| 16 | Uniformity (±10 %) | 73 / 70 / 72 / 68 / 68 % on days 7–35, 66 % at the day-40 weighing | an as-hatched flock with good care about 70–80 % (CV 8–10 %), lower at the end (general) | Low at the end. Fix: the within-cohort CV growth after day 14 × 0.8 (`TUNING.cvGrowthAfter14`): the ideal 68–74 % at day 40, the harvest-uniformity milestone (70 %) within reach |
| 17 | Sudden death, legs | SDS 0.07 / 0.08 / 0.15 / 0.08 % by level with 6 h dark; leg culls 0.08–0.29 % | SDS 0.5–1.5 % in fast-growing flocks without a dark period, much less with one; leg culls under 1 % (general) | OK |
| 18 | Harvest | 2,890 g live, FCR 1.58, mortality 2.33 %, EPEF 428, DOA 0.10 %, withdrawal 9.8 h | Thai EVAP at 42 days: 2.6–3.0 kg, FCR 1.6–1.75, mortality 2–4 %, EPEF 350–450; the pans empty 8–12 h before (general) | OK |
| 19 | The flock's own heat | 0.2 + 1.3 × kg/2.85 °C/h (Phase 2): about 1.2 W per kg of bird at 2.85 kg | broilers give off about 5–6 W per kg of sensible heat at 2–3 kg, less in hot air (more leaves as breath) (general) | **Low**. Fix: from Week 2 the sensible term × 2.5, faded to 0.4 between 30 and 35 °C house air (`sensibleHeatK`): a closed house of 5-week birds on minimum ventilation reaches about 29 °C at 05:00; a power cut matters (§4.2) |
| 20 | Gas to day 21 | the ideal inside the gas plate's 200–300 kg (cool season) | general | OK; must hold after fix 19 (more flock heat in week 2 burns less gas, §2.6) |
| 21 | Day 37 evening, 3 tunnel fans | 100 % of the birds panting from 18:00 to 21:00 (house 31 °C, felt 29 °C: e 9 over the 20 °C target); the ideal itself 94–98 % at 19:00 on days 35–41 with six fans | see §2.4 | **Off** (the model) and **unclear** (the job and the sign): §2.4 |
| 22 | Heat-wave mistakes | fans without pads 12.7 % dead over the 3 days; minimum ventilation 65 % | without evaporative cooling a 39 °C heat wave kills many big birds; moving air cools little in 39 °C air (general) | OK in kind; with fix 7 the air factor makes the pads decide: 20 % (§2.3) |
| 23 | Young birds in the warm afternoon (day 16, 35 °C) | four fans 50 % panting; six fans none; the pad with six fans chills (e −5.8) | young birds: as few fans as the heat allows; the pad with few fans (general) | OK; Phase 3's "never by the pad under 21 days" rule is replaced by "never with the birds chilled": the pad with one fan keeps 16-day-olds at e +0.2 (§2.3) |

### 2.3 The Phase 4 responses (`src/farm-tuning.js`, model unless `SIGN_FIGURES` lists them)
- **Wind chill** `windChillP4(v, age, airC) = K(age) · v^0.8 · 2.5^0.2 · τ(airC)`; K [[7, 3.0], [14, 2.8], [21, 2.6], [28, 2.4],
  [35, 2.2], [42, 2.2]] °C per m/s; τ = clamp((41 − airC)/6, 0.15, 1). From Week 2 (and in the brooding week of the hot and
  rainy seasons) it replaces sim.js's Phase 2 formula; the brooding week of a normal run and the sandbox keep Phase 2's.
- **Panting** `pantShareP4(e, age) = clamp((e − hotFrom(age) + 1.5) / 4, 0, 1)`, hotFrom [[7, 1.5], [14, 2.0], [21, 3.0],
  [28, 4.5], [35, 5.5], [42, 5.5]]; `pantFromP4 = hotFrom − 1.5` is the comfort legend's "birds start to pant at +X °C".
- **Heat deaths** `k · (e − deathFrom)²` per bird-hour, k 0.0003 (was 0.0005), at most 0.03; deathFrom [[7, 4], [14, 5], [21, 6.5],
  [28, 8], [35, 9.5], [42, 9.5]] − 4 × (weight ÷ target − 1). **Intake** `max(0.5, 1 − 0.04 · (e − hotFrom))` above hotFrom.
- **Cold deaths from day 14** below `−min(8, 4 + 0.2 · (age − 14))` at 0.01 %/h per °C² (a quarter of Phase 2's).
- **Flock heat** `0.2 · n/6000 + 1.3 · n · kg / (6000 · 2.85) · sensibleHeatK(house)`; sensibleHeatK = 2.5 ·
  clamp((38 − house)/8, 0.4, 1), from Week 2. **Breath** 0.4 × the water drunk, the water from `waterPerKgP4(mean e)`.
- **Water** `waterPerKgP4(e) = min(3.2, 1.8 · (1 + 0.05 · max(0, e)))` from Week 2 (the brooding week keeps Phase 2's
  1.75 + 0.03 · max(0, house − 30): its chicks live at 30–34 °C by design).
- **Dehydration** from day 21 only after 6 h with no water in reach (`TUNING.dry`); the vaccine's 4 h rule stays.
- **Uniformity** the within-cohort CV growth per day × 0.8 after day 14 (`TUNING.cvGrowthAfter14`).

**References** (`scripts/tuning-refs.mjs`, the check flock of PHASE3.md §6.3, measured now; every band is in the file):

| Hour | Plan | Outside | House °C · RH | Wind chill | Felt °C | Panting | Heat deaths %/h |
| --- | --- | --- | --- | --- | --- | --- | --- |
| d16 15:00 warm afternoon | 4 fans (ideal) / 6 fans / pad + 1 fan / pad + 6 fans | 35 °C 49 % | 34.9 · 50 / 34.9 · 50 / 29.8 · 77 / 28.1 · 85 | 5.0 / 6.8 / 1.7 / 6.8 | 29.8 / 27.9 / 28.0 / 22.0 | 0.28 / 0 / 0 / 0 (e −5.8, cold) | 0 |
| d18 15:00 | ideal / minimum ventilation | 33 °C 54 % | 32.9 · 55 / 32.2 · 68 | 4.9 / 0.1 | 27.8 / 31.9 | 0.01 / 0.95 | 0 |
| d25 15:00 hot afternoon | ideal (6 + pad) / fans, no pad / min. vent. | 36 °C 47 % | 28.5 · 84 / 36.0 · 47 / 35.9 · 57 | 6.2 / 5.1 / 0.1 | 22.8 / 30.7 / 35.6 | 0 / 0.96 / 1 | 0 / 0 / 0.53 |
| d31 15:00 heat wave | ideal / fans, no pad / min. vent. | 39 °C 40 % | 29.9 · 81 / 39.2 · 40 / 40.0 · 47 | 5.8 / 1.8 / 0 | 24.4 / 37.2 / 39.8 | 0 / 1 / 1 | 0 / 1.48 / 2.79 |
| d33 15:00 humid | ideal (pad off) / pads on | 33 °C 85 % | 33.0 · 86 / 31.3 · 97 | 5.6 | 28.0 / 30.2 | 0.85 / 1 | 0 / 0.01 |
| d35 15:00 | ideal / fans, no pad | 33 °C 54 % | 27.2 · 87 / 33.1 · 55 | 5.5 | 22.3 / 27.4 | 0 / 0.84 | 0 |
| d37 19:00 evening | 3 fans / 6 fans / 6 + pad (= the ideal) | 30.8 °C 61 % | 31.3 · 61 / 31.1 · 61 / 26.4 · 88 | 3.2 / 5.5 / 5.5 | 27.9 / 25.4 / 21.4 | 0.95 / 0.36 / 0 | 0 |
| d37 21:00 / 22:00 | 6 fans / 3 fans | 28.5 / 27.3 °C | 29.1 / 28.4 | 5.5 / 3.2 | 23.4 / 25.0 | 0.01 / 0.26 | 0 |
| d41 05:00 | ideal (tunnel air) / 2 fans / min. vent. | 24.6 °C 86 % | 25.2 · 84 / 26.0 · 82 / 28.8 · 77 | 5.5 / 2.3 / 0.1 | 19.7 / 23.8 / 28.7 | 0 / 0.01 / 1 | 0 |
| d38 15:00 hot finish | ideal / fans, no pad | 37 °C 44 % | 29.1 · 82 / 37.1 · 45 | 5.5 / 3.6 | 24.0 / 33.3 | 0.06 / 1 | 0 / 0.47 |
| hot season d25 15:00 | ideal / fans, no pad | 38 °C 48 % | 30.1 · 85 / 37.8 · 49 | 6.2 / 3.3 | 24.5 / 34.3 | 0 / 1 | 0 / 0.26 |
| hot season d37 19:00 | 6 + pad / 6 fans | 35.5 °C 54 % | 29.4 · 86 / 35.6 · 54 | 5.5 / 5.0 | 24.6 / 30.4 | 0.16 / 1 | 0 / 0.04 |
| rainy season d33 15:00 | ideal | 30 °C 69 % | 30.3 · 68 | 5.6 | 24.5 | 0.05 | 0 |

Windows (deaths % of the birds · panting bird-hours per bird): week 3 ideal 0 · 6.6, minimum ventilation 0.07 · 88; the
pad with six fans on day 16 0.2 % (cold, 7.6 cold bird-hours); weeks 4–5 normal days ideal 0 · 7.9, fans without pads
0 · 30, minimum ventilation 22 %; heat wave ideal 0 · 2.0, fan 4 broken 0 · 4.6 (2.3 × the ideal), a third of the pad
dry 0 · 10.2 (5.1 ×), fans without pads 20 %, minimum ventilation 59 %; humid day pads on 0.03 % (intake 1.6 % under
the ideal); hot finishing day fans without pads 0.9 %; **a power cut on day 33 at 15:00** for 15 / 30 / 120 minutes
0.09 / 0.24 / 2.2 % to the next morning; the hot season's heat wave ideal 0 · 5.5, fans without pads 44 %.

### 2.4 The known item: the evening of day 37
**What the Phase 3 model did.** On day 37 at 19:00 the outside air is still 30.8 °C (the day's curve: 33 °C at 15:00,
28.5 °C at 21:00, 24.6 °C at 05:00; Thai evenings are like that). Three tunnel fans gave 1.25 m/s and 1.75 °C of wind
chill (Phase 2's 1.4 °C per m/s for big birds), so the birds felt 29 °C: e = 9 over the 20 °C target, three degrees
past hotFrom 6, and the 1 °C ramp made that 100 % panting from 18:00 to 21:00. Even the ideal (six fans, pads off at
18:30) had 94–98 % of the birds panting at 19:00 every evening from day 35.
**Is it right for the weather?** Partly. Birds of 2.5 kg in 31 °C air with 1.25 m/s do pant, most of them: an
evening house at 31 °C is too warm for them. It was wrong in three ways: the wind chill of big birds was about half
of general practice; the ramp made the share jump to all of them; and the ideal itself left them panting because
nothing told the farmer that the pads belong to warm evenings too.
**The fix.** The model (§2.3: wind chill, ramp, flock heat) gives with three fans 95 % panting at 19:00, 77 % at 20:00,
53 % at 21:00, 26 % at 22:00; six fans 36 % at 19:00 and none by 21:00; six fans with the pads none. The heat sign's
evening line (§2.5) says: big birds (from week 5) on warm evenings every fan, and the pads while the outside air is over
about 30 °C (the controller's *Outside* reading), until about 21:00; then tunnel air all night (`config.HEAT_P4`). The
job *Set the ventilation for the night* (state `night-comfort`, re-defined): for 30 farm minutes after 18:00 no more
than a quarter of the birds pant and none are chilled (felt comfort ≥ −1.5 °C), or every working fan runs with the pad
on while the outside air is at or over 29.5 °C (or the house RH is over 90 %). Its strip shows the outside air, the
panting share the farmer sees ("about 9 in 10 birds panting"), the fans and the pad against the sign's evening line.
The ideal profile runs every fan and the pads from 18:00 to 21:00 from day 28 while the outside is at or over 29.5 °C.
**Three fans on day 37** after 18:00 is therefore a choice with a visible cost: the job stays open until about 22:00,
the birds pant 4–5 hours longer than the ideal's and eat a little less (about 2 % a day: `eveningFans3` §2.6), no bird
dies of it in the normal season. In the hot season the same choice kills (§4.1).

### 2.5 Every sign figure matches the model (`config.SIGN_FIGURES`, `content-signs-cond.js BOARD_P4_ITEMS`)
`SIGN_FIGURES` lists each figure a Phase 4 sign prints, the board it is on, and the check of the model
(`scripts/test-tuning.mjs`, the model side; `scripts/test-contracts.mjs`, the text side: the figure is on its board).
All general practice.

| Figure (as printed) | Board | Model check (now) |
| --- | --- | --- |
| at 2.5 m/s birds of 5 weeks feel about 5–6 °C cooler, birds of 2 weeks about 7 °C | sign-heat (replaces "3–4 °C … 6–7 °C") | windChillP4(2.5, 35) 5.5 · (2.5, 14) 7.0 |
| moving air cools less once the air is over about 35 °C; near 40 °C it gives little: then the pads cool the birds | sign-heat (new) | τ(39 °C) 0.33 |
| All six fans give about 2.5 m/s at bird height, each fan about 0.4 m/s | sign-heat (Phase 3) | 0.417 m/s a fan |
| birds of 5 weeks start to pant when they feel about 24 °C, all of them by about 28 °C (felt: the house less the wind chill) | sign-heat (new) | 24.0 / 28.0 °C |
| big birds (from week 5) on warm evenings: every fan, and the pads while the outside air is over about 30 °C, until about 21:00 | sign-heat (replaces the evening line) | `HEAT_P4` 29.5 °C, day 28, 21:00 (the ideal and `night-comfort`) |
| young birds on a hot afternoon: the pad with one or two tunnel fans; six fans and the pad chill them | sign-heat (new) | d16 pad + 1 fan e +0.2; pad + 6 fans e −5.8 |
| water : feed about 1.8 L/kg while the birds are comfortable; on hot days about 2–2.5; in a heat wave up to about 3 | drinker (new, from day 8) | waterPerKgP4(0 / 6 / 14) 1.80 / 2.34 / 3.06 |
| set each line to age + 20 ml/min, give or take 3 ml/min; nipple height and pan rim: the figure for the day, give or take 3 cm | drinker, feeder-box (new; the done rules' bands `FLOW_BAND`, `HEIGHT_BAND_CM`) | job-figures.js (run) |
| a pad in good order gives most of that, never all of it | pad-pump (Phase 3 line, now checked) | 0.69–0.82 of the 5 %-per-°C rule |
| in the damp air of the rainy season a pad cools only about 2–4 °C | pad-pump (rainy season) | 3.8 °C at 30 °C, 69 % |
| without fans big birds overheat at once: after half an hour the first die, after two hours a few in every hundred | sign-power (rainy season) | power cut 30 / 120 min: 0.24 / 2.2 % |

Also checked against the model by the packages' own tests (unchanged figures): the vent sign's table and its worked
example (6,000 chicks of 42 g: about 928 m³/h, the timer's 8 s = 960 m³/h, 103 %); the feed sign's 75 / 130 / 160 / 185 /
200 g (`feedStdGAt`); the bird-scale plate's targets (`weightAt`); the light sign's 20 lux (60 × 0.35 = 21); the catch
sign's 2 % shrink (the ideal's 10 h withdrawal: 0.98); the gas plate's 200–300 kg to day 21 (the ideal, test-cycle).

### 2.6 What the tuning changes in the farm, the profiles, the targets and the play-throughs
The sim package wires `farm-tuning.js` into the farm from Week 2 (`farm.cyc.on`) and into the brooding week of the hot and
rainy seasons; Phase 2's brooding week of a normal run is untouched (`test-sim.mjs` byte-identical). Then
`scripts/tuning-refs.mjs` replaces `scripts/cycle-refs.mjs CLIMATE_REFS / WINDOW_REFS` in test-cycle (the Phase 3
references stay in the file, unused, for the record), and the farm's own numbers at those hours must land in the
Phase 4 bands (snaps). **The ideal profile** gains the evening rule (every fan and the pads 18:00–21:00 from day 28 while
the outside is ≥ 29.5 °C and the house RH ≤ 90 %) at new `cycleStops` 18:00 and 20:00 (the `night` round stays 18:30).
**CYCLE_TARGETS** that move (integrator-agreed now; every other band stays):

| Profile · band | Phase 3 | Phase 4 |
| --- | --- | --- |
| ideal · `pantShareW3At15` (day 18 15:00) | [0, 0.35] | [0, 0.2] |
| ideal · `heatwavePantHours` | [1, 12] | [0.3, 8] |
| ideal · finish `uniformityPct` | [62, 80] | [68, 76] |
| ideal · new `eveningPant37At19` (day 37 19:00) | — | [0, 0.1] |
| ideal · new `dehydrationFinishPct` (days 36–42) | — | [0, 0] |
| ideal · new `waterFeedHotDay` (the records row of day 25, water ÷ feed) | — | [1.9, 2.4] |
| ideal · new `nh3NightMaxW46`, gas to day 21 | [0, 25] ppm, gas plate | unchanged: [0, 25] ppm; `gasKgTo21` [200, 300] |
| minVentW3 · `heatDeathsW3Pct` | [0, 0.07] | [0, 0.15] |
| padInHumid · `heatDeaths33Pct` | [0.15, 1] | [0, 0.3], and new `intake33UnderIdealPct` [1, 6] |
| fanUnfixed · `heatwavePantHoursVsIdeal` | [2, ∞] | [1.5, ∞] |
| padWeek3 · `coldDeathsDay16` | [1, ∞] | [1, 15] (the pad with six fans chills 16-day-olds: a few deaths, huddles, intake) |
| new profile `eveningFans3` (3 fans 18:00–24:00, days 29–41, the pads off at 18:30) | — | panting bird-hours 18:00–24:00 days 29–41 ≥ 3 × the ideal; day 35 weight 0.5–3 % under; weeks 4–5 passes |
| new profile `padYoung1` (day 16: the pad with one fan in the warm afternoon) | — | `w3-heat` earned; no cold death on day 16; panting ≤ 0.1 at 15:00 |
`noTunnel`, `fansNoPad`, `dustOn`, `noStep` and the rest keep their bands (`fansNoPad`'s heat wave 20 % in the reference,
≥ 2 % in its band). **Play-throughs**: `scripts/p3-cycle.json`'s day 16 (six fans) is unchanged; its day 37 night round
must give the evening rule: the steps generator (`scripts/p3-cycle-steps.mjs`, integrator) sets six fans and the pad at
the fan panel on the 18:00 round and checks `night-comfort` done. `p3-replay.json` is unchanged. The milestone
`harvest-uniformity` stays at 70 % (the ideal reaches it with fix 16).

### 2.7 Tuning log (filled at integration)
The sim package records here every model constant it changes from §2.3 / §4, with the reason and the bands it moved
(the integrator agrees a band change). *Empty until the sim package merges.*

## 3. The conditions system

### 3.1 Offering and choosing (package "run")
- **Gate:** `skills profile.cyclesDone` (new field of the skill profile `chickenFarm.profile.v1`, kept across runs and
  replays, raised by 1 when a run reaches the cycle summary with every level passed; a Phase 3 profile without the field
  reads 0, or 1 if its stored `lastCycle` exists). `config.CONDITIONS[id].available` is the build switch (false until
  the run merge, then the integrator sets it true, as `earnable` in Phase 3).
- **Where:** the cycle summary and the title card's run card (*Harder flocks*, §1.2); every reached level row of the run
  card has a condition select and *Play from a standard start* (`run.startLevel(id, { from: 'standard', condition })`).
  A saved start replays with the condition it was saved under (the select shows it and is fixed for *Replay from day N*).
- **One condition per run:** `run.startRun({ seed, at, condition })` (`condition` null = the normal season), kept in
  `run.state().condition` and the run save; `farm.start(def, { condition })` puts it on the farm (`farm.condition`,
  saved with the farm), so every later level of the run, a replay and a standard start play it.
- **Standard starts under a condition** play the condition's ideal (`cycleProfileOf('ideal', { condition })`, §9.6) to
  the level's start, behind the busy card ("Getting the flock to day 22 in the hot season …").

### 3.2 How a condition changes a level (one function: `config.conditionLevel(def, condition)`)
`conditionLevel(def, id)` → `{ condition, problems, weather, target, fail, routineDays, cycleClimate, delivery }` (pure, in code):
the level def's problems with the condition's `drop`ped, `replace`d (fields merged) and added; its weather; target and
fail rules merged; the routine days the condition moves (e.g. `r-fans-pm` from day 8 in the hot season, carried into the
later levels); `cycleClimate` true from the condition's `cycleClimateFrom` level (the hot and rainy seasons: the
brooding week too); `delivery` the brooding week's chick delivery of a bad batch (null = Phase 2's). **Level defs are never changed and never compared by object**: the sim and run packages replace
every `def === LEVEL1` / `def === PLAN_LEVEL` that a condition can reach by `def.id === …` (43 places today, §12).
- The **farm** installs `conditionLevel(def, farm.condition).problems` (and their weather events) at `farm.start` /
  `farm.enterLevel`, sets the weather, and the cycle climate by `cycleClimate`.
- The **job engine** makes the level's jobs plus `JOBS_COND` whose `condition` is the run's; its problem ids are the
  merged ones (`problemIds()`), and the routine days follow `routineDays`. Phase 2's `warm-afternoon` problem job
  (`p-warm`) is not made where the condition drops the problem.
- The **signs**: `boardsForDay(day, condition)` (one merge, content-signs-cycle.js) adds `BOARD_P4_ITEMS` (every run),
  `BOARD_COND_ITEMS[condition]` and `BOARDS_COND` boards and plates whose `condition` is the run's.
- The **level end** uses the merged `target` / `fail`.

### 3.3 Records, notes and result screens
- The records book's header, each result screen's title and the cycle summary name the condition
  (`config.conditionLabel(id)`: "Hot season", … "Normal season" when null, shown only for a condition).
- `records` adds a row field `condition` (the run's, on every row) and condition notes on the day's row (plain facts, from
  `EV.FARM_PROBLEM`, `EV.POWER`, `EV.ACTION`): "Storm 14:00–18:00", "Power cut 15:10–18:10; generator on at 15:24; mains
  back 18:10, generator stopped 18:16", "Rain in at the south inlets; storm flaps closed 15:40", "Heat wave: 41 °C at
  15:00", "Hot night: 30.5 °C at 23:00", "Chicks: 36.2 g, 4.4 % weak at grading; 238 graded out (claimed)", "Chick
  quality reported to the hatchery", "Well water: iron 1.2 mg/L", "Tank 24 % at 17:30", "Pump repaired 09:40–11:40".
- `records.cycleSummary({ plan, levels, condition, compare })` adds `condition` and, when the profile holds the farmer's
  last normal-season summary (`lastCycle` of a run without a condition), `compare: { sold, meanLiveG, fcr, epef,
  mortalityPct, deathsByLevel }` drawn beside the cycle's own numbers (plain numbers, no verdict).

### 3.4 Pass and fail
The key targets of PHASE3.md §2.1 hold in every condition. Merged into the level by the condition (`fail`):
**a bad batch's brooding week** counts deaths and floor culls ≤ 2.5 % of the chicks placed, and the chicks graded out at
the table (`farm.flock.claimed`) apart: they are the hatchery's claim (the chick-grading plate and the chick sign say
so); the day 7 ratio is against the measured chick weight as in Phase 2 (≥ 4.0 ×). Every other limit is unchanged. Each
condition is **winnable by good play** (its ideal passes every level, §4) and **lost by poor play for a reason the
records show** (each condition's named mistakes fail a named level on a measured number, §4).

## 4. The four conditions
Problems are `config.CONDITIONS[id].levels` (in code); jobs `content-jobs-cond.js JOBS_COND` (in code); sign lines
`content-signs-cond.js` (in code); milestones `skills-cond.js` (in code); the model is the sim package's (§9). Each
condition's **ideal** and **named mistakes** are profiles of `farm-profiles-cond.js` (sim, §9.6) with target bands in
`scripts/test-cond.mjs` (sim, §12.1); the bands below are integrator-agreed now (seed 1).

### 4.1 Hot season (`hot`) — April–May
**Weather.** Every level `hot`: 28–38 °C (Phase 1's `WEATHER.hot`), the day's water 22 g/m³ (about 80 % at 05:00, 47 % at
15:00, `OUTSIDE_WATER_GM3.hot`); the cycle climate from the prep day (the outside RH by its water content, the wet-bulb
pad, the Phase 4 wind chill for the chicks too).
**Model (sim).** Line water (hot season only): each drinker line's water warms toward the house air (time constant 2 h);
a flush of that line of 2 farm minutes or more puts tank water in it (27 °C, model); the birds drink × (1 − 0.015 ×
max(0, line °C − 28)) (model; the drinker plate's line, general). Box time costs 1.5 × in the brooding week's heat
(the truck stands in 35 °C, model). Everything else is the Phase 4 model under hotter air.

| Level | Problem (config) | What changes | Job |
| --- | --- | --- | --- |
| brooding week | `warm-afternoon` dropped | every afternoon is hot: the closed house runs over the chicks' target from about 11:00 | `h-brood-air` days 1–7 pm (below) |
| week 2 | — (routine days) | `r-fans-pm` and `r-vent-night` from day 8 (`routineDays`) | the fan panel check and the night ventilation from day 8 |
| week 3 | `warm-afternoon3` +2.5 °C | about 40 °C on day 16 | `p-heat3` (the pad with one or two fans, or six fans) |
| weeks 4–5 | `hot-afternoon` +1.5, `heat-wave` +3, `humid-heat` dropped, `hot-spell` d33 18:00 → d35 18:00 +2 °C | 39.5 °C on day 25; 41 °C days 30–32 (nights 31 °C); 40 °C afternoons and 30 °C nights days 33–35 | `p-panting`, `p-heatwave`, the evening rule (`r-vent-night`) |
| finishing | `hot-finish` +2 | about 40 °C on day 38 | `p-panting-fin` |

| Job | When | Where | Done when | Branch |
| --- | --- | --- | --- | --- |
| `h-brood-air` *Keep the chicks' afternoon heat down* | days 1–7, 13:00–18:00 | controller | all: a `vent.timer` / `vent.fans` change, state `house-near-target` (Phase 2's: felt within ±1.5 °C of the target for 30 farm min) | comfort |
| `h-flush` *Flush the warm water out of the drinker lines* | days 22–41, 12:00–15:00 | water supply | `each water.flush` lines 0–3 with `on: true` | water |
Signs: `BOARD_COND_ITEMS.hot` (sign-brooder, sign-heat, drinker, pad-pump, sign-catch; all general). Records notes: the
day's hottest outside reading the farmer took ("Outside 40.6 °C at 15:10, controller"), "Heat wave", "Hot night".
Milestones: `hot-brood-air`, `hot-nights`, `hot-wave`, `cool-water` (§7).

| Profile (sim) | Play | Expect |
| --- | --- | --- |
| `hot:ideal` | the Phase 4 ideal, plus: brooding afternoons the warm timer (2 fans 120 s / 300 s, Phase 2's `WARM_TIMER`) 11:00–17:00 and one tunnel fan 13:00–16:00 from day 4; brooders by the sign at night only; the pads by the plan from day 15 (with one or two fans under 21 days); the evening rule from day 28; the midday flush days 22–41; catch booked for day 42 01:00 | every level passes · brooding week ratio 4.5–4.95, deaths + culls ≤ 1.2 % · day 14 ≥ 100 % of the target · weeks 4–5 heat deaths ≤ 0.1 %, day 35 2,100–2,350 g · harvest 2,650–2,950 g, FCR 1.6–1.8, EPEF 330–420 · gas to day 7 ≤ 60 % of the normal ideal's |
| `hotNoBroodAir` | the brooding afternoons on the sign's timer only | the brooding week **fails** (heat deaths of chicks: deaths + culls > 2 %, or day 7 under 4.0 ×) |
| `hotNoPad` | fans by the plan, never the pads, from day 22 | weeks 4–5 **fails** by day 31 (heat deaths ≥ 2 %) |
| `hotNightFans3` | three fans and no pads from 18:30, days 29–41 | weeks 4–5 **fails** (the hot evenings: heat deaths ≥ 2 % by day 35) |
| `hotNoFlush` | no midday flush | passes; day 35 weight 0.5–3 % under `hot:ideal`; `cool-water` not earned |

### 4.2 Rainy season (`rainy`) — August–September
**Weather.** Every level `rainy`: 24–30 °C, the day's water 21 g/m³ (about 96 % at 05:00, 69 % at 15:00); the cycle
climate from the prep day. Storms (`storm: true` problems): −4 °C and 98 % for four hours on days 5, 12, 19, 26, 33, 39;
the radio forecasts each the day before ("Storms tomorrow afternoon"); `farm.weatherNow.rain` 1 while one lasts.
**Model (sim).** *Rain in at the inlets*: while a storm lasts and the storm flaps are open (`farm.house.flapsClosed`
false), 0.6 L/h into each cell of the two southmost cell rows between x −12 and +12 (model); `rain-in` is the problem of
the first time (day 19); later storms wet the strip too unless the flaps are closed. Closed flaps take 30 % off the
timer's air while closed (the inlets are half shut, model): open them after the storm. *The power*: `env.powerOn`
(sim.js) false while neither the mains nor the generator on the transfer switch feeds the house: no fans (manual and
timer), no pad pump, no lights, no augers, no brooder ignition; the farmer's settings stay and come back with the power.
The generator: `gen.start` runs it after 2 farm min (`GENERATOR.startMin`), 15 L/h from 150 L; `gen.switch { to }` puts
the house on it or back on the mains; `gen.stop`; `gen.test` (10 farm min, `ok` when it starts with fuel); empty, it stops
and the house goes dark again. *The pads* cool 2–4 °C in the damp air (physics, unchanged); the normal season's heat
problems do not come.

| Level | Problem | What changes | Symptom (farm) | Fixed when | Job |
| --- | --- | --- | --- | --- | --- |
| brooding week | `storm-5` | −4 °C, 98 % 14:00–18:00 | — (weather; the radio) | — | — |
| week 2 | `rainy-spell` rh 97, `storm-12` | damper spell; storm on the vaccine day (afternoon) | Phase 3's | Phase 3's | `p-damp` |
| week 3 | `storm-19`, `rain-in` | rain through the south inlets from 13:30 | `EV.NEAR` in the wet strip (zone x −12..12, z 5, dwell 2 s, minMoisture 35); a squeeze ≥ 35 % within it; a listen there ("rain blowing in at the inlets") | `inlets.storm { closed: true }` | `p-rain-in` → `p-rain-patch` |
| weeks 4–5 | `dusty-air`, `hot-afternoon`, `heat-wave`, `humid-heat` dropped; `storm-26`; `damp-spell` d29 07:00 → d31 18:00 (−2 °C, 97 %); `storm-33`; `power-cut` d33 15:10, mains back 18:10 (`alarm`); `mains-back` (only while the generator carries the house) | the house dark at 15:10 | the cut itself (at once: the alarm, `EV.POWER { on: false }`; the level stops a skip) · `mains-back`: the mains returning while on the generator | `power-on` · switched to the mains and the generator stopped | `p-power` (pinned), `p-power-back`, `p-damp2` |
| finishing | `hot-finish` dropped, `storm-39` | — | — | — | — |

| Job | When | Where | Done when | Branch |
| --- | --- | --- | --- | --- |
| `rn-gen-test` *Test-run the generator* | days 8, 15, 22, 29, 36 am | generator | `gen.test` → `{ ok: true }` | ventilation |
| `p-power` *The power is off: start the generator* | problem `power-cut` | generator | all: `gen.start` → running, `gen.switch { to: 'generator' }`, live state `power-on` | ventilation |
| `p-power-back` *The mains is back: switch over and stop the generator* | problem `mains-back` | generator | all: `gen.switch { to: 'mains' }`, `gen.stop` | ventilation |
| `p-rain-in` *Wet litter along the south wall after the storm: find what wets it* | problem `rain-in` | controller (Ventilation: the storm flaps) | `inlets.storm { closed: true }` | moisture |
| `p-rain-patch` *Put fresh litter on the wet strip by the south wall* | after `p-rain-in` | husk heap | `count litter.patch` n 3 with `result.onRain` (on the strip) | moisture |
| `p-damp2` *The air in the house feels damp again* | problem `damp-spell` | controller | all: a `vent.timer` / `vent.fans` change, `rh-under { max: 85 }` | moisture |
Signs: `BOARDS_COND['sign-power']` (3D board by the generator), the `generator` plate, `BOARD_COND_ITEMS.rainy`
(sign-vent, sign-litter, pad-pump, sign-health). Records notes: storms, the power cut with its times, the flaps.
Milestones: `gen-tested`, `gen-fast`, `storm-flaps`, `rain-litter`.

| Profile | Play | Expect |
| --- | --- | --- |
| `rainy:ideal` | the Phase 4 ideal; the timer by the table every morning (not every other); the flaps closed at each storm's start and opened at its end; the generator tested weekly; on the cut: started and switched 10 farm min after, back to the mains at 18:15 | every level passes · litter mean 26–31 % on every weigh day · NH3 ≤ 20 ppm on the nights of days 15–41 · power-cut deaths ≤ 0.1 % · weeks 4–5 deaths + culls 0.3–1.0 % · harvest 2,750–3,000 g, EPEF 370–440 |
| `rainyNoGenerator` | the generator started 2 h after the cut | weeks 4–5 **fails** on day 33 (deaths + culls > 2 %; the record: "power cut 15:10–17:10 before the generator") |
| `rainyNoStep` | the timer left at the day-8 setting, days 8–21 | week 3 **fails** (litter ≥ 33 % and NH3 ≥ 20 ppm on the nights of days 17–21; day 21 under 90 % of the target, or deaths + culls > 1 % with the coccidiosis); the fail screen offers *Replay Week 2* with "litter 34 % at the start of week 3" (PHASE3.md §10 carried line) |
| `rainyNoFlaps` | the storm flaps never closed | passes; the south strip ≥ 40 % after each storm; `storm-flaps` and `rain-litter` not earned |

### 4.3 A bad batch of chicks (`badChicks`)
**Weather and levels** as the normal season; the brooding week changes (the later levels carry the batch).
**Model (sim, all model values).** The delivery: mean 36 g (± 1.5 g between boxes, seeded; Phase 2: 41.5), CV 14 % (8 %),
weak 4.5 % (0.8 %), red hocks 10 % (4 %); the truck comes at 10:00 (2 h late: `delivery.arrivalHour`, all in
`CONDITIONS.badChicks.levels.level1.delivery`; the job engine's `truck` anchor follows the delivery), the chicks 7 h on the road (2 h more box hazard than Phase 2 before the
truck stops). Late starters L from 0.05 (Phase 2: 0.02); a weak chick not culled dies with 45 % (35 %). *Grading*
(`chicks.grade { stack }`, at the chick table, a stack still in its boxes): 6 farm minutes at the panel clock, culls 90 %
of that stack's weak chicks (seeded) into `farm.flock.claimed` (the hatchery's claim: not a death or cull of the level),
returns `{ stack, looked, weak, culled, minutes }`; box time runs on while he grades. *Feed trays and chick paper*
(`brood.trays { on }`): to day 4 the late-starter term −0.03 and the feed reach of the first 72 h +0.1. *Brooding 1 °C
warmer*: the batch's comfort target is the sign's row + 1 °C on days 0–3 (`farm.flock.targetShiftC` 1): what the chicks
feel is measured against it. *The hatchery call* (ui `phone.hatchery { chickWeightG, weakPct }`): a record note.
Later: the batch's CV carries on (day 14 uniformity about 55–62 %), the small chicks grow a little slower.

| Level | Problem | Symptom (farm) | Fixed when | Job |
| --- | --- | --- | --- | --- |
| brooding week | `weak-batch` (day 0 10:00, starts with the delivery) | `sample.box` mean under 38 g; `sample.grade` with 2 or more weak of 10; a look at the chick table | 4 stacks graded and the hatchery told | `p-weak-batch` (pinned) |

| Job | When | Where | Done when | Branch |
| --- | --- | --- | --- | --- |
| `b-trays` *Put feed trays and chick paper by the brooders* | prep day | feeder box | `brood.trays { on: true }` | brooding |
| `p-weak-batch` *Many weak chicks in the boxes* | problem `weak-batch` | chick table (*Grade the stacks* tab) | all: `count chicks.grade` n 4, `phone.hatchery` | brooding |
| `b-warm` *Brood the small chicks 1 °C warmer* | day 0 06:00 → day 3 06:00 | controller | live state `brood-warmer` (the thermostat 0.5–1.5 °C over the brooder sign's row) | heating |
| `b-crop48` *Check the crops again at 48 hours* | day 2 08:00–12:00 | any chicks | `count sample.crop` n 10, 3 sectors (Phase 2's crop rule) | brooding |
Signs: `BOARD_COND_ITEMS.badChicks` (sign-chicks, sign-brooder), the `chick-grading` plate. Records: the delivery note
("Chicks: parent flock 25 weeks, 7 h on the road"), the grading ("238 graded out, claimed from the hatchery"), the call.
Pass / fail: the brooding week's deaths + floor culls ≤ 2.5 % with the claimed chicks apart, ratio ≥ 4.0 × the measured
chick weight (§3.4). Milestones: `weak-graded`, `crop48`, `hatchery-told`, `bad-ratio`.

| Profile | Play | Expect |
| --- | --- | --- |
| `bad:ideal` | Phase 2's ideal plus: trays on the prep day; the box weighed first (36 g), every stack graded before its tip; the hatchery called; thermostat row + 1 °C days 0–3; the crop check at 48 h | every level passes · brooding week ratio 4.1–4.6, deaths + floor culls 1.0–2.2 %, claimed 3.5–4.5 % · day 14 weighed ≥ 95 % of the target, uniformity 55–64 % · harvest 2,750–2,950 g, mortality 2.3–3.5 % of the chicks placed (the claimed chicks were never placed), EPEF 350–420 |
| `badNoGrade` | Phase 2's ideal only (no grading, no trays, no warmer brooding) | the brooding week **fails** (deaths + culls > 2.5 %: the weak chicks die on the floor; or the ratio under 4.0) |
| `badNoTrays` | `bad:ideal` without the trays | passes; ratio 0.1–0.3 under `bad:ideal` |

### 4.4 A water problem (`water`) — iron in the well water and an old well pump
**Weather and levels** as the normal season. The water test kit (Phase 3's `waterTest` unlock) is at the water supply
for this run.
**Model (sim).** *Iron* 1.2 mg/L in the well water from the prep day (`water.test` → `{ ph, chlorinePpm, ironMgL }`);
with it the main filter blocks again on days 13 and 31 (`iron-filter`, Phase 2's blocked filter, flow factor 0.6: the
same symptom by a flow test under 0.8 × the target or the filter gauges, fixed by `water.clearFilter`), and on day 18
line 4's nipples clog (`iron-nipples`: that line's flow × 0.7 until a flush of it of 2 farm min or more). *The tank*
(`WATER_TANK`: 6 m³) feeds the drinker lines and the pads (the pads evaporate about 0.49 g per m³ of air per °C they cool,
plus 10 % bleed, model: on a hot afternoon about as much as the birds drink, or more); the well pump fills it at
1.2 m³/h × `farm.waterTank.pumpShare` while it is under 95 %. Under 20 % the line pressure falls (flow × clamp(level ÷
20 %, 0.3, 1)); under 15 % the pad runs dry from the far end (`env.padWorking` × clamp(level ÷ 15 %, 0, 1)). *The worn
pump* (`pump-wear`, day 26 06:00): `pumpShare` −0.1 a day (0.4 by day 32): in the heat wave the tank runs down every
afternoon. `water.tank` reads `{ levelPct, pumpBar, pumpA }` (pressure low and current high when worn); `pump.fix` stops the
pump for 2 farm hours (`WATER_TANK.repairH`; the tank alone feeds the house), then `pumpShare` 1 and `{ fixed: true }`
when it was worn.

| Level | Problem | Symptom (farm) | Fixed when | Job |
| --- | --- | --- | --- | --- |
| brooding week | `iron-water` (prep day 07:00, no event) | `water.test` reads it (the record) | — | `w-test` (day 1) |
| week 2 | `iron-filter` day 13 10:00 | a flow test under 0.8 × the target; the filter gauges out under 0.8 × in | `water.clearFilter` | `p-filter-again` |
| week 3 | `iron-nipples` day 18 06:00 (line 4) | a flow test of line 4 under 0.8 × the target | a flush of line 4 of 2 farm min, then its flow test within ±3 ml/min | `p-nipples` |
| weeks 4–5 | `pump-wear` day 26 06:00; `iron-filter` day 31 10:00 | `water.tank` under 30 % (`WATER_TANK.lowPct`); a flow test after 15:00 under 0.8 × the target with the tank under 20 %; `water.meter` 24 h litres per 1,000 birds ≥ 5 % under yesterday's; a listen after 15:00 with the tank under 20 % ("birds crowding along the drinker lines") | `pump.fix` (fixed) | `p-pump` (pinned) · `p-filter-again` |

| Job | When | Where | Done when | Branch |
| --- | --- | --- | --- | --- |
| `w-test` *Test the well water* | day 1, 08:00–18:00 | water supply | `water.test` | water |
| `w-tank` *Read the water tank gauge* | days 22–41 am | water tank (north-west of the house) | `water.tank` | water |
| `p-filter-again` *Low water flow again: find the cause* | problem `iron-filter` | water supply | `water.clearFilter` → fixed | water |
| `p-nipples` *One drinker line gives little water* | problem `iron-nipples` | drinker line 4 | all: `water.flush { line: 3, on: true }`, live `line-flow-ok { line: 3 }` | water |
| `p-pump` *The water tank runs low in the afternoon* | problem `pump-wear` | water tank | `pump.fix` → fixed | water |
Signs: `BOARD_COND_ITEMS.water` (water-supply, sign-water), the `water-tank` plate. Records: the iron reading, the tank
readings ("Tank 24 % at 17:30"), the repair. Milestones: `iron-found`, `pump-found`, `tank-read`.

| Profile | Play | Expect |
| --- | --- | --- |
| `water:ideal` | the Phase 4 ideal plus: the water test on day 1; each filter found at the next flow test and cleaned; line 4 flushed and tested on day 18; the tank read every morning from day 22; the pump repaired the first morning the tank reads under 60 % at 06:15 or the meter falls (about day 29–30) | every level passes · weeks 4–5 deaths + culls ≤ 0.9 %, day 35 within 2 % of the normal ideal · the tank never under 20 % |
| `waterPumpUnfixed` | the pump never repaired | weeks 4–5 **fails** (the heat wave with the pad dry from the far end and the lines low: heat and dehydration deaths > 2 %, or day 35 under 90 %) |
| `waterFilterLate` | each iron filter found a day late | passes; day 14 weight 1–3 % under `water:ideal`; `iron-found` not earned |

## 5. The daily rounds by condition (PHASE3.md §3.3, every day)
The routine of PHASE3.md §3.3 holds in every condition, with these changes (`routineDays` and `JOBS_COND`):

| Condition | Morning | Afternoon | Evening / night |
| --- | --- | --- | --- |
| hot | — | days 1–7 `h-brood-air`; `r-fans-pm` from day 8; days 22–41 `h-flush` (12:00–15:00) | `r-vent-night` from day 8 |
| rainy | `rn-gen-test` on days 8, 15, 22, 29, 36 | — (storm days: the flaps, §4.2) | — |
| badChicks | — | — | — |
| water | day 1 `w-test`; days 22–41 `w-tank` | — | — |
Budget: a day stays under PHASE3.md's 4.5 real minutes (the hot season's flush is one panel visit, about 30 s; the tank
gauge one walk to the tower, about 40 s on the morning walk west).

## 6. The clarity leftovers (the last check)
| # | Leftover | Fix | Package · files | Test |
| --- | --- | --- | --- | --- |
| 1 | The blue "on" toggle looks like the primary *Send this setting* key | A toggle that is on is a **lit switch**: pressed in, a dark face, its lamp lit, the state word in lamp yellow (`.key[aria-pressed="true"]`, `--switch-face`, `--switch-lamp`: in code in index.template.html); primary actions keep the blue (`key--apply`, `btn--go`). Remove `.fan-sw .key[aria-pressed="true"]` (blue) from ui-cycle-style.js; every toggle key sets `aria-pressed` | panels · ui-cycle-style.js, every panel with toggles | `p4-panels-clarity.json`: the computed background of a pressed toggle differs from `.key--apply`'s, and it has the lamp (`::before`) |
| 2 | At 960 × 600 the vent keys and the need are not on screen together | "This setting ≈ 960 m³/h = 103 % of the need (vent sign: 928 m³/h)" beside the keys (ui-climate.js `tAir`), from `job-figures ventNeed` | panels · ui-climate.js | `p4-panels-clarity.json` at 960 × 600: the line, the timer keys and *Send this setting* inside the viewport together |
| 3 | The Sign / Yours bar stops at full above the need | The vent row's bar is `{ v: share, band: VENT_BAND, max: 1.6 }` (90–130 % marked on the track; over 160 % an arrow) — the bar shape is in code (ui-jobstrip.js); the row's text adds "over the sign's 90–130 %" / "under the sign's 90–130 %" when outside it | run (job-strips.js ventRows) · panels (ui-jobstrip.js drawing) | test-jobs: the vent row's bar object at 70 / 110 / 170 %; the steps file shows the band marks |
| 4 | The ±3 ml/min flow band and the ±3 cm line-height band of the done rules are on no plate | Drinker and feeder plates: "give or take 3 ml/min" / "give or take 3 cm" (`BOARD_P4_ITEMS`, general, in code) merged by boardsForDay | run · content-signs*.js | test-contracts (in code): the lines exist and are general |
| 5 | The prep-day vent row shows 928 m³/h beside the sign's "about 900" | The Sign column reads "about 900 m³/h (the sign's example: 6,000 chicks of 42 g)"; a line under it: "928 m³/h worked out: 155 per 1,000 at 42 g (the table's 150 at 40 g, a little more at 42 g); 90–130 % is 835–1,210 m³/h" | run · job-strips.js | test-jobs: the prep-vent strip rows hold "about 900" and "835–1,210" |
| 6 | `r-fans-pm` can show DONE over an unticked step | A strip shows as steps only the parts of its own job's rule; other jobs' parts (the afternoon walk of `r-walk-pm`) are plain lines; ui-jobstrip.js marks a strip done only when the engine says done **and** every step row is ticked | run · job-strips-cycle.js; panels · ui-jobstrip.js | test-jobs: the done `r-fans-pm` strip has no unticked step |
| 7 | `f-withdraw` taken before its window leaves the job stuck | Done on the outcome: state `feed-withdrawn` (`DONE_P4`, in code): the feed off when the window opens completes it (an early withdrawal shows in the harvest's withdrawal hours and weight) | run · content-jobs-cycle.js, job-engine.js | test-jobs: `feed.withdraw` at catch − 16 h, the job done at catch − 13 h |
| 8 | The feeder strip does not state the finished outcome per line | Each line row: "Line 1 · rim 5 cm · flood windows open · auger … · pans 96 % full", then "finished when: rim about 5 cm (7 at most), flood windows open, pans 95 % full" (prep-feeders; r-feeders from day 4: "rim at the plate's figure ± 3 cm, auger on, feed in the pans") | run · job-strips.js | test-jobs: the rows hold "finished when" with the three figures |
| 9 | `w3-change` / `w45-change` complete without the half-and-half day | Done all: state `blend-24h` (the augers drew 20–80 % new for at least 20 h of the change; `farm.stats.blendH` grower, new `blendFinH` finisher) and the pans 90 % new (`DONE_P4`, in code) | run · content-jobs-cycle.js, job-engine.js · sim · `farm.stats.blendFinH` | test-jobs (both feeds); test-cycle: the ideal's `blendFinH` ≥ 20 |
| 10 | `p-blood` does not count the medicine course | Done all: the vet, the medicine on, state `medicine-course` (medicine in the water on 3 calendar days counting the first: `farm.health.medication.daysOn` ≥ 3); the strip and job card read "medicine day 2 of 3" | run · content-jobs-cycle.js, job-engine.js · sim · `medication.daysOn` | test-jobs; test-cycle: the ideal's p-blood done on day 21 |
| 11 | ARCHITECTURE.md and ui-climate.js say the target temperature is only on the brooder sign | Corrected in this commit: the target is the brooder sign's row, shown as the sign's figure in the job strips, the job card readings, "Your week", the records' target column (unlock) and the summary's dashed line; never on the HUD or the LCD | integrator (done) | — |

## 7. Skill milestones (`src/skills-cond.js MILESTONES_COND`, in code)
Each condition adds milestones to the existing branches; they are evaluated only in a run of that condition (the run's
condition rides on `EV.RUN level-start` and every checkpoint as `condition`; `skills.evaluate(checkpoint, ctx)` drops a
milestone whose `condition` differs), only rise, and show on the skill tree under their branch with the condition's name.
No new unlocks (every branch level already unlocks a tool or view, `config.UNLOCKS`). Points available:

| Condition | Milestones (branch, points) |
| --- | --- |
| hot | `hot-brood-air` (comfort 2) · `hot-nights` (comfort 2 / 3) · `hot-wave` (ventilation 2 / 3) · `cool-water` (water 1) |
| rainy | `gen-tested` (ventilation 1) · `gen-fast` (ventilation 2 / 3) · `storm-flaps` (moisture 2) · `rain-litter` (moisture 2 / 3) |
| badChicks | `weak-graded` (brooding 2 / 3) · `crop48` (brooding 1) · `hatchery-told` (planning 1) · `bad-ratio` (growth 2 / 3) |
| water | `iron-found` (water 2) · `pump-found` (water 2) · `tank-read` (water 1) |
Every threshold a tier names is a measured outcome its text states or a figure on the sign its job links. A normal-season
milestone whose checkpoint does not come in a condition (the heat wave in the rainy season) is simply not evaluated.
**Each condition's ideal reaches level 2 (9 points) in every branch** (`test-cond.mjs`, as Phase 3's `minBranchPoints`).
`skills profile.cyclesDone` (and `conditionsDone: { [id]: n }`) are profile fields the run raises at a cycle's end.

## 8. New 3D content (package "scene")
All procedural, flat-shaded, merged where repeated, no external files; everything new is hidden in the sandbox and in a
run without its condition (`farm.condition`), so every Phase 1–3 view looks exactly as before.
1. **Rain and storms** while `farm.weatherNow.rain > 0`: instanced rain streaks in a box that follows the camera (one
   draw call, ≤ 3,000 instances), the sky, fog and sun dimmer and greyer, the ground and roofs a darker wet albedo,
   puddles on the farm road and the concrete pads, a lightning flash about every 40 s of real time (none under
   `prefers-reduced-motion`); the rainy season's grass a deeper green.
2. **The power cut** while `farm.power.on` is false: the house lights off (the night look, the shade roof's dimness by
   day), the tunnel and timer fan blades spin down over 3 s, the pad's water sheet stops, the controller's LCD blank with
   a red alarm lamp blinking (steady under reduced motion), the yard lamps off at night; all back on with the power
   (`EV.POWER`).
3. **The generator** in the existing shed (world-buildings.js `generatorShed`): its control panel and a transfer switch
   box on the shed's back wall, the exhaust puffing (a few instanced puffs) and the set shaking a little while
   `farm.generator.running`; the `sign-power` board at `SPOTS4.signPower`; interactable `generator` at
   `SPOTS4.generator` (in code: the stub registers it; scene keeps the id, priority 10, `enabled` in the rainy season).
4. **The water tank and the well pump** at the existing water tower: a sight-gauge strip on the tank showing
   `farm.waterTank.levelPct`, a pump box with a pressure gauge at the tower's foot (the needle low when worn, still while
   `fixing`), interactable `water-tank` at `SPOTS4.waterTank` (in code); rust-brown stains on line 4's nipples while
   `iron-nipples` is active (`farm.problems`).
5. **Storm flaps** on the south side-wall inlets (hinged plates; closed while `farm.house.flapsClosed`); the wet strip
   along the south wall reads from the litter grid as Phase 3's wet patches do (props-floor).
6. **The hot season's look**: browner grass and paler, dry paddies (palette shifted by `farm.condition === 'hot'`), a
   harder midday sun; no full-screen effect (performance).
7. **A bad batch**: more chicks lying still in the boxes at the truck and the stacks; the drawn chicks' sizes follow the
   batch's spread (the flock's weight quantile already does); weak chicks drawn as Phase 2's sick birds; **feed trays and
   chick paper** under the brooders while `farm.brood.trays` (shallow round trays, white paper sheets); a cull box at the
   chick table filling as stacks are graded (one drawn chick per 20 graded out).
8. **The flock** crowds the drinker lines when the water access is low (`farm.water.access` under 0.8: the water
   condition's afternoons, a blocked filter), as it crowds the dry lines while the vaccine's thirst lasts (Phase 3).
Budgets (as Phase 3): ≤ +1 ms per frame at 1,800 birds with the rain on; ≤ 40 extra draw calls and ≤ 60 k extra
triangles in the house view; every new material compiled in the warm-up (`renderer.info.programs.length` unchanged after
a tour of the four conditions).

## 9. The model work of Phase 4 (package "sim"; constants model unless general)
### 9.1 The tuning (§2.3) in the farm
`farm-tuning.js` (contract code, in code) wired in: `sim.js derive()` takes `windChillP4` while `env.cycleClimate` (keep
Phase 2's formula otherwise, so the sandbox digest and test-sim are unchanged); `farm-house.js houseComfort` uses
`pantShareP4`, `heatDeathRateP4`, `heatIntakeP4`, `coldDeathRateP4` and exports `farm.comfort.pantFrom` (first birds) /
`pantAll` beside `hotFrom` (the scene's comfort view and the legend read `pantFrom`); `flockLoadsP4` for the flock's heat
and breath from Week 2; `waterPerKgP4` for the water drunk (`farm.cyc.waterPerKg`); `dehydrationAllowed` in the flock's
dehydration rate; `TUNING.cvGrowthAfter14` in the CV growth. Then test-cycle runs `scripts/tuning-refs.mjs`'s references
(the Phase 3 ones retire) and CYCLE_TARGETS take §2.6's bands; every change goes in §2.7 (the tuning log).
### 9.2 The conditions in the farm (`src/farm-cond.js`, replacing the stub; same state and actions, §10.4)
- `farm.start(def, { condition })` sets `farm.condition` (kept by `keepClock`, saved); the farm installs
  `config.conditionLevel(def, farm.condition)` everywhere it used `def.problems` / `farm.cycleLevel.problems` (problem
  states, weather events, the radio, zones, symptoms), sets the weather, and the cycle climate by `cycleClimate` (the hot
  and rainy seasons from the prep day: `env.setCycleClimate(true)` at `farm.start`). Every `=== LEVEL1` /
  `=== PLAN_LEVEL` a condition run can reach becomes an id comparison (the level defs are never copied as new objects;
  the farm keeps `farm.level` / `farm.cycleLevel` as the config defs and reads the merged parts from `farm.levelFor(def)`).
- The Phase 2 problems (farm-problems.js) skip the ones the condition drops (`warm-afternoon` in the hot season).
- §4's models: the line water (hot), storms and the rain-in strip, the flaps, `env.powerOn` (sim.js: a new env field and
  `env.setPower(on)`; while false the env counts no fans, timer or pad and the lights are off; `heaterLevel` 0), the
  generator, the delivery of a bad batch (`LEVEL1` fields read through the condition: chick weight, CV, weak share, red
  hocks, truck hour, box hours, late-starter base, weak death share), grading, trays, the target shift, the iron, the
  tank and the pump; each problem's symptoms and fixes of §4 through `farm.act` results, `EV.NEAR` zones, listens and its
  own state (only the farm decides a symptom, PHASE2.md §7); `alarm` problems emit their symptom at once.
- `observe()` words (neutral): "rain drumming on the roof", "rain blowing in at the inlets", "the house is dark and
  still: no fans", "birds crowding along the drinker lines", "dry, firm droppings", "small chicks, many lying still";
  the radio's storm and hot-spell forecasts.
### 9.3 Records (`records*.js`)
Rows: `condition`; notes of §3.3; the harvest page's and the cycle summary's `condition` and `compare` (§3.3);
`timeline()` rows add `outsideMaxC` (the hottest outside reading he took) and `powerOffMin` (minutes without power that
day). The profile store keeps `cyclesDone` and `conditionsDone` (`save.js`, the profile key).
### 9.4 Skills
`skills.js`: `ALL_MILESTONES` adds `MILESTONES_COND`; `evaluate()` keeps the level filter and drops a milestone whose
`condition` is not the checkpoint's `ctx.condition` (the run's, carried by `EV.RUN` / `EV.LEVEL`); new rules in
`skills-rules-cond.js` for every `MILESTONES_COND` id.
### 9.5 Speed and save sizes
`farm.step` ≤ 0.5 ms, a 24 h skip ≤ 200 ms in every condition; a whole condition cycle ≤ 15 s in node; run saves and
level starts ≤ 250 KB (as Phase 3).
### 9.6 Profiles (`src/farm-profiles-cond.js`, new; `farm-profiles-cycle.js` keeps the normal ones)
`cycleProfileOf(name, { condition })` and `runCycle(name, { seed, from, to, condition })` play a condition's ideal and
mistakes (§4) — the ideal's additions per condition are written in §4's profile tables, every one through `farm.act`
and the env setters at `cycleStops(fromDay, toDay, condition)` (the run's goto(auto) and standard starts call the same).
The Phase 4 ideal of the normal season adds the evening rule (§2.6).
### 9.7 The tuning log
The sim package records in §2.7 every model constant it changes from §2.3 / §4 to reach the bands, with the reason (as
PHASE3.md §6.16). Design values already in code: `farm-tuning.js TUNING` (§2.3), `config.HEAT_P4`, `GENERATOR`,
`WATER_TANK`, `OUTSIDE_WATER_GM3.hot` 22 (was 24: the hot season's dawn 80 %, not 88 %), the condition problems.

## 10. Contracts between packages (in code now)
Shared, integrator-owned and **frozen** for the packages: `src/config.js` (the Phase 4 section after the third banner,
and `OUTSIDE_WATER_GM3`), `src/events.js`, `src/interact.js`, `src/main.js` (wiring, `__game` hooks), `build.mjs`,
`scripts/shoot.mjs`, `scripts/test-contracts.mjs`, `scripts/tuning-refs.mjs`'s bands, `scripts/test-tuning.mjs`'s checks.
Need a change in a frozen file? Put it in your report; the integrator makes it.

### 10.1 What is in code now
| File | Owner | What it is now |
| --- | --- | --- |
| `src/config.js` (Phase 4) | integrator | `SPOTS4`, `HEAT_P4`, `GENERATOR`, `WATER_TANK`, `CONDITIONS` (four, `available: false`), `CONDITION_IDS`, `conditionLabel`, `conditionLevel(def, id)`, `SIGN_FIGURES`; `OUTSIDE_WATER_GM3.hot` 22 |
| `src/farm-tuning.js` | sim (contract code) | `TUNING` and the Phase 4 responses (§2.3), `heatStateP4`, `flockLoadsP4`; not wired into the farm yet |
| `scripts/tuning-refs.mjs`, `scripts/test-tuning.mjs` | sim (code) · integrator (bands) | the Phase 4 climate references on the env alone and the sign figures' model side; pass now, in `npm test` |
| `scripts/tuning-audit.mjs` | sim | the audit of §2.2 (`npm run audit`) |
| `src/farm-cond.js` | sim | STUB: the state of §10.4, `farm.levelFor(def)`, `farm.debug.power(mainsOn)`, the actions of §10.3 with minimal answers (the power cut acts on the env setters; storms set `farm.weatherNow` from the condition's problems); `farm.act` routes here first (farm.js) |
| `src/content-jobs-cond.js` | run | `JOBS_COND`, `JOB_WHERE_COND`, `STATE_TEST_IDS_P4`, `DONE_P4` (the clarity rules); not in the engine yet |
| `src/content-signs-cond.js` | run | `BOARD_P4_ITEMS`, `BOARD_COND_ITEMS`, `BOARDS_COND`, `BOARD_IDS_COND`; not merged yet |
| `src/skills-cond.js` | sim | `MILESTONES_COND`, `condMaxPoints`; not evaluated yet |
| `src/ui-cond-panels.js` | panels | STUB: `registerCondPanels(api)` (called by ui.js after the Phase 3 panels) registers placeholders for `generator`, `water-tank`, `chick-grading` that call the farm's actions |
| `src/props-cond.js` | scene | STUB: `buildCondScene(ctx)` (main.js builds it after the props, updates it each frame) registers the interactables `generator` and `water-tank` (enabled in their condition) |
| `src/run.js` (small) | run | `condition` in the run's state, serialize / restore and `startRun({ condition })` (not passed on to the farm yet) |
| `src/index.template.html` (small) | run | the lit-switch toggle style (`.key[aria-pressed="true"]`, `--switch-face`, `--switch-lamp`) |
| `src/ui-jobstrip.js` (small) | panels | a row's `bar` may be `{ v, band, max }` (the band marked, over-scale arrow) |
| `src/main.js` | integrator | `buildCondScene`, `__game.conditions()`, `__game.setCondition(id)` |
| `scripts/test-contracts.mjs` | integrator | the Phase 4 checks: conditions and the merge, condition jobs resolve (actions, states, spots, signs, problems), every Phase 4 sign line general and verdict-free, every sign figure on its board, condition milestones well formed |

### 10.2 Events (`EV`, `src/events.js`)
New: `POWER` 'power' `{ on, source: 'mains' | 'generator' | null, mains }` (farm: the house's power changed). Changed
payloads: `EV.RUN` and every `EV.LEVEL` checkpoint carry `condition` (string | null) from the run; `EV.FARM_PROBLEM`
for `alarm` problems comes at once with `{ alarm: true }`; `EV.FARM_DELIVERY { kind: 'chicks' }` carries `truckHour` and
`note` (the delivery ticket: "parent flock 25 weeks, 7 h on the road").

### 10.3 Actions (Phase 4; `ACTION_IDS` in code)
| id | args | result | called by |
| --- | --- | --- | --- |
| `gen.start` | `{}` | `{ running, fuelL }` (running after `GENERATOR.startMin`; false with no fuel) | generator panel (panels) |
| `gen.stop` | `{}` | `{ running: false, fuelL }` | generator panel |
| `gen.switch` | `{ to: 'generator' \| 'mains' }` | `{ on, source }` | generator panel (the transfer switch) |
| `gen.test` | `{}` | `{ ok, fuelL, minutes }` | generator panel |
| `gen.fuel` | `{}` | `{ fuelL }` (filled from the drum) | generator panel |
| `inlets.storm` | `{ closed }` | true | controller, Ventilation tab (panels) |
| `water.tank` | `{}` | `{ levelPct, pumpBar, pumpA }` | water-tank panel (panels) |
| `pump.fix` | `{}` | `{ fixed, hours }` (the repair takes `WATER_TANK.repairH` farm hours) | water-tank panel |
| `chicks.grade` | `{ stack }` | `{ stack, looked, weak, culled, minutes }` | chick table, *Grade the stacks* tab (panels) |
| `brood.trays` | `{ on }` | true | feeder box (panels) |
| `phone.hatchery` (ui) | `{ chickWeightG, weakPct }` | — | records book, Phone page (run) |
| `water.test` (Phase 3) | `{}` | adds `ironMgL` (the water condition) | water supply (panels) |
| `litter.patch` (Phase 2) | `{ x, z }` | adds `onRain` (on the rain-in strip) | scene `patch` provider |

### 10.4 State other packages read
- `farm.condition`; `farm.power { mains, on, source }`; `farm.generator { running, fuelL, hours, testedDay, startedAt }`;
  `farm.weatherNow { rain, storm, id }`; `farm.house.flapsClosed`; `farm.waterTank { levelPct, pumpShare, fixing,
  fixedAt }`; `farm.brood { trays }`; `farm.flock.claimed`; `farm.water.lineTempC` (hot season, per line array);
  `farm.comfort.pantFrom`, `pantAll` (beside `hotFrom`); `farm.health.medication.daysOn`; `farm.stats.blendFinH`;
  `farm.levelFor(def)` (= `conditionLevel(def, farm.condition)`).
- `env.powerOn` (sim, from the farm's power); `env.windChill` is the Phase 4 one while the cycle climate runs.
- `run.state().condition`; `skills.profile` `cyclesDone`, `conditionsDone`.

### 10.5 One owner, one signature (the hand-over points)
| Point | Owner | Signature / meaning |
| --- | --- | --- |
| A level as a condition plays it | integrator (config) | `conditionLevel(def, id)` → `{ condition, problems, weather, target, fail, routineDays, cycleClimate, delivery }`; levels compared by `id` |
| The run's condition onto the farm | run calls, sim answers | `farm.start(def, { condition })`; `farm.condition` |
| Condition jobs into the engine | run | `JOBS_COND` filtered by `run.state().condition`; `routineDays`; the merged problems |
| The power | sim | `farm.power`, `env.powerOn`, `EV.POWER`; the actions `gen.*` |
| The alarm stops a skip | run (level.js skip) reads, sim emits | `EV.FARM_PROBLEM { phase: 'symptom', alarm: true }` |
| Condition panels | panels builds, run registers (ui.js) | `registerCondPanels(api)`, the PHASE3.md §13.9 api |
| Condition machines | scene registers, panels builds the panels | interactables `generator`, `water-tank` (`SPOTS4`) |
| Grading a bad batch | panels (tab), sim (action), scene (cull box) | `chicks.grade { stack }`; `farm.flock.claimed` |
| Signs of a condition | run | `boardsForDay(day, condition)` (the only merge) |
| Sign figures | integrator (data), run (text), sim (model) | `SIGN_FIGURES` |
| The strip bar | run (data), panels (drawing) | `bar: number \| { v, band, max }` (ui-jobstrip.js) |
| The lit switch | run (template CSS), panels (uses it) | `.key[aria-pressed="true"]` |
| Condition milestones | sim | `MILESTONES_COND`, `ctx.condition` |
| Cycles done | run raises, sim stores | `skills profile.cyclesDone`, `conditionsDone` |

## 11. Save format, test hooks and harness scenarios
### 11.1 Save format
- Keys unchanged (`config.RUN_SAVE` v3, the level starts by id and day, the profile `chickenFarm.profile.v1`). New
  optional fields, read as null / 0 when absent (so every Phase 3 save loads unchanged): `run.serialize().condition`;
  `farm.serialize().cond` (`{ condition, power, generator, waterTank, brood, flapsClosed, claimed }` in code; the sim adds
  the line water, the iron state and the pump's history); `env` save adds `powerOn`; records rows `condition`; the
  skill profile `cyclesDone`, `conditionsDone`.
- A level start saved under a condition replays under it (the blob's farm carries it). A standard start under a
  condition clears the later starts as Phase 3's standard start does.
### 11.2 `window.__game` hooks
Phase 1–3 hooks, plus (in code now): `conditions()` (`{ id, label, available, summary, … }`), `setCondition(id)` (sets
`farm.condition` on the running farm: the other packages' harness runs only; the run sets it at a start). Run package:
`startRun({ seed, at, condition })`, `startLevel({ level, from, seed, condition })`. Sim: `farm.debug.power(mainsOn)` (in
code), `farm.debug.trigger(id)` for a condition problem, `farm.debug.set(path, value)`.
### 11.3 Harness scenarios
The design run of this phase: `node scripts/shoot.mjs --scenario cold-hot --size 960x600` (no errors), `npm test`, and
`scripts/p4-design-stubs.json` (integrator, runs on the stubs now: the hooks, Phase 2's prep day unchanged, a rainy
storm window, a power cut by `farm.debug.power(false)`, the generator placeholder's *Start* and *House on the generator*
bringing the fans back).
Package steps files: `scripts/p4-run-*.json`, `scripts/p4-panels-*.json`, `scripts/p4-scene-*.json` (§12). Integrator
play-throughs (generated by `scripts/p4-cycle-steps.mjs`, built on `p3-cycle-steps.mjs`): `p4-hot.json` (the hot
season from the brooding week's standard start: day 3 afternoon by real input — the timer and one tunnel fan —, day 31
by real input — the heat wave at the fan panel and the pad pump, the evening rule at 18:00, the midday flush —, then
`goto(auto)` to the cycle summary with "Hot season" on it), `p4-rainy.json` (weeks 4–5's day-29 start: day 33 by real
input — the storm, the flaps, the power cut at 15:10 met by walking to the generator, started and switched, the mains
back at 18:10 —, the result of weeks 4–5), `p4-bad.json` (the brooding week: the prep day's trays, day 0 by real input —
the box weighed, four stacks graded, the hatchery called, the thermostat at row + 1 °C —, `goto(7, 21, auto)`, the
result against 36 g), `p4-water.json` (weeks 4–5 from day 22: the tank read each morning, day 29 the tank low, the pump
repaired by real input, the week's result) and `p4-clarity.json` (the clarity items of §6 at 960 × 600).

## 12. Work packages (four, disjoint files, parallel worktrees)
Each engineer works in `git worktree add ../cf4-<key> -b phase4/<key> main`, edits **only the files listed** (new
files with the listed prefixes are theirs too), codes against the stubs and §10 (§10.5 has one owner and one signature
for every hand-over point), writes in chunks of ≤ 250 lines and commits after each working milestone, and keeps these
passing on the branch: `npm run build`, `npm test` (incl. `test-tuning.mjs`; the new `test-cond.mjs` once sim adds it),
`node scripts/shoot.mjs --scenario cold-hot --size 960x600`, `--scenario p2-hooks`, `--steps scripts/phase1-jobs.json`,
`--steps scripts/p2-level1.json`, `--steps scripts/p3-design-stubs.json` and `--steps scripts/p4-design-stubs.json`. Files no package lists stay frozen
(`src/config.js`, `src/events.js`, `src/interact.js`, `src/main.js`, `src/clock.js`, `src/round.js`, `build.mjs`,
`scripts/shoot.mjs`, `scripts/test-contracts.mjs`, `scripts/p3-cycle-steps.mjs`, the `p2-*` / `p3-*` steps files). The machine renders WebGL in software
(about 1–2 fps for the full game): keep harness runs short (`--size 960x600`, `settle` / `advance`, `__game` hooks),
reach any day in level mode with `__game.cycleAt(day, hour)`, put a condition on the running farm with
`__game.setCondition(id)`, cut the power with `__game.farm.debug.power(false)`, and prefer node tests for logic.

### 12.1 `sim` — the tuned model, the conditions' model, records, skills, profiles (branch `phase4/sim`)
**Owns:** `src/sim.js`, `src/farm.js`, `src/farm-*.js` (incl. `farm-tuning.js`, `farm-cond.js`, new
`farm-profiles-cond.js`, `farm-cond-*.js`), `src/records.js`, `src/records-*.js`, `src/skills.js`, `src/skills-*.js`
(incl. `skills-cond.js`, new `skills-rules-cond.js`), `src/save.js`, `scripts/test-sim.mjs`, `scripts/test-cycle.mjs`,
`scripts/cycle-refs.mjs`, `scripts/tuning-refs.mjs` (code; bands with the integrator), `scripts/tuning-audit.mjs`,
new `scripts/test-cond.mjs`. Pure logic: no three.js, no DOM.
**Contract:** §2 (the tuning and the bands of §2.3 / §2.6), §4 (each condition's model, problems, symptoms, fixes and
profile bands), §9, §10.2 (`EV.POWER`, the payload additions), §10.3 (every farm action's result shape), §10.4 (the
state others read), §10.5, §11.1.
**Builds:** §9.1 the tuning wired in (Phase 2's brooding week of a normal run byte-identical: test-sim's digest and
profiles); §9.2 the conditions (replacing the farm-cond.js stub with the same state and actions; the level-identity
comparisons in sim's files by id); §9.3 records; §9.4 skills (`ALL_MILESTONES` with `MILESTONES_COND`, the condition
filter, `cyclesDone`); §9.6 profiles; test-cycle on the Phase 4 references with §2.6's bands and new snaps / profiles
(`eveningPant37At19`, `dehydrationFinishPct`, `waterFeedHotDay`, `intake33UnderIdealPct`, `gasKgTo21`, `eveningFans3`,
`padYoung1`); the clarity state the run package's rules read (`stats.blendFinH`, `medication.daysOn`); the audit table
re-run after tuning (`npm run audit`, numbers into §2.7).
**Acceptance:** `node scripts/test-sim.mjs` (Phase 2 unchanged); `node scripts/test-tuning.mjs` (unchanged bands);
`node scripts/test-cycle.mjs` with the Phase 4 references and bands (every normal profile; the ideal: every level, the
evening, uniformity 68–76 %, no dehydration in finishing, water : feed 1.9–2.4 on day 25, gas to day 21 200–300 kg, every
branch ≥ 9); new `node scripts/test-cond.mjs`: for each condition its ideal passes every level and reaches level 2 in
every branch, each named mistake of §4 fails its level (or passes with its band), determinism (two seed-7 runs of
`hot:ideal` identical), speed and save sizes (§9.5), restore → serialize identical for a level start under each
condition, every Phase 4 action answers with its result shape, a power cut by `farm.debug.power(false)` stops the fans
and `gen.start` + `gen.switch` bring them back, the storms' rain on their days, the tank under 30 % in the afternoon of
day 31 with the pump never fixed; `grep -iE "correct|wrong|well done|good job|mistake|perfect|excellent"` in the
player-facing texts of `src/records*.js src/skills*.js` finds nothing; §2.7 filled.

### 12.2 `run` — conditions in the run, jobs, signs, the core UI, the clarity rules (branch `phase4/run`)
**Owns:** `src/level.js`, `src/run.js`, `src/job-engine.js`, `src/job-figures.js`, `src/job-strips.js`,
`src/job-strips-cycle.js`, `src/content.js`, `src/content-jobs.js`, `src/content-jobs-cycle.js`,
`src/content-jobs-cond.js`, `src/content-signs.js`, `src/content-signs-cycle.js`, `src/content-signs-cond.js`, `src/ui.js`,
`src/ui-title.js`, `src/ui-jobs.js`, `src/ui-hud.js`, `src/ui-result.js`, `src/ui-records.js`, `src/ui-notebook.js`,
`src/ui-skilltree.js`, `src/ui-format.js`, `src/ui-caption.js`, `src/ui-marker.js`, `src/ui-help.js`, `src/ui-panels.js`,
`src/ui-boards.js`, `src/ui-dom.js`, `src/ui-icons.js`, `src/ui-run.js`, `src/ui-summary.js`, `src/ui-letters.js`,
`src/index.template.html`, `scripts/test-jobs.mjs`, `scripts/test-level.mjs`, `scripts/test-run.mjs`,
`scripts/p4-run-*.json`. The sandbox files `ui-tasks.js`, `ui-testtools.js`, `ui-controller.js` stay untouched.
**Contract:** §3 (offering, choosing, the merge, records and result labels, pass / fail), §4's job tables and signs,
§5, §6 items 3–10 (the run's parts), §7 (checkpoints carry `condition`; the skill tree shows condition milestones),
§10.5, §11.2 hooks.
**Builds:** `run.startRun({ condition })` / `startLevel(id, { from, condition })` / replays carrying the condition;
`farm.start(def, { condition })` through `level.start` / `level.enter`; standard starts under a condition (sim's
`cycleStops(…, condition)` + `applyCycleRound` with the condition's ideal); the gate (`cyclesDone`) and raising it at the
cycle's end; level.js and job-engine.js reading `conditionLevel` (problem ids, routine days, target / fail) and every
`=== LEVEL1` / `=== PLAN_LEVEL` in its files by id; `JOBS_COND` (by condition) and `DONE_P4` into the content, the new
state tests `STATE_TEST_IDS_P4` (incl. the re-defined `night-comfort` of §2.4 and `rh-under { max }`); the skip stopping
at an `alarm` symptom; `boardsForDay(day, condition)` with `BOARD_P4_ITEMS`, `BOARD_COND_ITEMS`, `BOARDS_COND` (the
`sign-power` board's sign panel); the strips of §6 (3, 5, 6, 7, 8, 9, 10) and the condition jobs' strips; the UI of
§1.2 / §3.3 (title and run card *Harder flocks*, the level rows' condition select, the HUD tag, the records book and
result headers, the cycle summary's condition and compare columns, the phone's *Call the hatchery*, the alarm banner on
`EV.POWER { on: false }`); the skill tree's condition milestones; at the merge ask the integrator to set every
`CONDITIONS[id].available` true.
**Acceptance:** `node scripts/test-jobs.mjs` (Phase 2 / 3 cases unchanged except the four `DONE_P4` jobs; new: a
condition job made only in its condition, `routineDays`, a dropped problem makes no job, the `alarm` stops a skip, each
new state test on a farm with fields set, `f-withdraw` early, the half-and-half, the medicine course, `r-fans-pm`'s strip
has no unticked step when done, the vent bar objects, the prep vent row's "about 900", the feeder rows' "finished
when"); `node scripts/test-run.mjs` (Phase 3 cases; new: `startRun({ condition: 'hot' })` puts it on the farm and the run
save, a replay keeps it, a standard start of `weeks45` in the rainy season reaches day 22 06:00 in ≤ 8 s with
`farm.condition === 'rainy'`, the gate shut before a full cycle and open after, `conditionsDone` raised); `node
scripts/test-level.mjs`; `grep` of verdict words in `src/ui*.js src/content*.js` finds nothing. Harness:
`p4-run-conditions.json` (the run card before and after a cycle — `__game.skills` profile `cyclesDone` set — the four
cards, *Start a new flock in the hot season* → planning day 07:00 with "Hot season" on the HUD; a level row's condition
select → a standard start), `p4-run-power.json` (`cycleAt(33, 15)` + `setCondition('rainy')` + `farm.debug.power(false)`:
the alarm banner, `p-power` pinned once the run's jobs run), `p4-run-ui.json` (records header, result title and summary
with the condition at 960 × 600, no sideways scroll).

### 12.3 `panels` — the conditions' panels and the clarity of the machine panels (branch `phase4/panels`)
**Owns:** `src/ui-climate.js`, `src/ui-water.js`, `src/ui-equipment.js`, `src/ui-inspect.js`, `src/ui-jobstrip.js`,
`src/ui-cycle-*.js`, `src/ui-cond-panels.js`, new `src/ui-cond-*.js`, `scripts/p4-panels-*.json`.
**Contract:** the panels api (PHASE3.md §13.9; `registerCondPanels` called by ui.js), §10.3 (the actions it calls with
their args), §10.4 (the state it shows), §6 items 1, 2, 3 (drawing), 6 (the done mark), the plates of `BOARDS_COND` with
sources in small text, clock classes as Phase 2 (`sign` while a plate is unfolded, `panel` otherwise).
**Builds:** panels `generator` (the fuel gauge, hours, *Start the generator* (a 2-minute bar), the transfer switch
*House on: mains / generator* as one lit switch pair, *Stop*, *Test run* (a 10-minute bar), *Fill the fuel tank*; the
mains' state; the plate), `water-tank` (the tank's level as a sight gauge, the pump's pressure and current, run hours;
*Read the gauges* (`water.tank`), *Repair the pump* (a 2-hour bar; the panel may close while it runs); the plate),
`chick-grading` (the stacks still in their boxes, *Grade this stack* (6 farm minutes), the weak counted per stack, the
total graded out and claimed; the plate) opened from the chick table panel's *Grade the stacks* tab (ui-inspect.js) in a
bad batch; the controller's Ventilation tab *Storm flaps on the south inlets* (a lit switch; rainy season); the feeder
box's *Feed trays and chick paper* (a bad batch, days −1..3); the water supply's test kit for the water condition and
`ironMgL`; the clarity of §6: the lit switch on every toggle (remove the blue `.fan-sw` override), the vent line with
the need (§6.2), the strip bar's band and the done mark (§6.3, §6.6).
**Acceptance:** harness steps with `expect`: `p4-panels-cond.json` (`cycleAt(33, 15)`, `setCondition('rainy')`,
`farm.debug.power(false)`, open `generator` → *Start* → the bar → *House on the generator* → `farm.power.on === true`,
the fans set before the cut running again (`env.fansManual` as before); `setCondition('water')`, open `water-tank` → *Read the gauges* → the bus
saw `water.tank`; *Repair the pump* → `pump.fix`; `startLevel({ seed: 1 })` + `setCondition('badChicks')` at the truck:
the chick table's *Grade the stacks* → `chicks.grade { stack: 0 }`), `p4-panels-clarity.json` (at 960 × 600: a pressed
toggle's computed background differs from the apply key's and has its lamp; the controller's Ventilation tab shows the
timer keys, *Send this setting* and "% of the need" inside the viewport; a strip bar with `{ v: 1.7, band, max: 1.6 }`
draws the band and the arrow), shots of every new panel reviewed (no sideways scroll, plate sources readable, no verdict
colours); `grep` of verdict words in `src/ui*.js` finds nothing.

### 12.4 `scene` — rain, the power cut, the machines, the conditions' looks (branch `phase4/scene`)
**Owns:** `src/props.js`, `src/props-*.js` (incl. `props-cond.js`), `src/house.js`, `src/house-*.js`, `src/world.js`,
`src/world-*.js`, `src/player.js`, `src/player-*.js`, `src/flock.js`, `src/flock-*.js`, `scripts/p4-scene-*.json`.
**Contract:** §8; the interactables `generator`, `water-tank` (ids, `SPOTS4`, priority 10, enabled in their condition);
reads the state of §10.4 and `EV.POWER`; the `sign-power` board painted from `BOARDS_COND` (as Phase 3's boards);
`farm.comfort.pantFrom` for the comfort view's warm side (replacing `hotFrom`, PHASE3.md review fix) once sim exports it
(fall back to `hotFrom − 1.5`).
**Builds:** §8 items 1–8.
**Acceptance:** against the stubs (`cycleAt`, `setCondition`, `farm.debug.power`; rain: `cycleAt(26, 15)` with
`setCondition('rainy')` (the stub rains in storm-26's window), or `farm.debug.set('weatherNow.rain', 1)` with no condition;
`farm.debug.set('waterTank.levelPct', 20)`, `farm.debug.set('brood.trays', true)`): `p4-scene-look.json` shots reviewed —
rain over the farm and inside the house view, a lightning frame, the dark house in a power cut with the alarm lamp, the
generator running, the tank's gauge at 20 %, the storm flaps closed, the hot season's dry look, a bad batch's boxes and
trays — and `p4-scene-events.json` with `expect`: power off → every fan rotor still within 4 s, the house lights off;
power on → rotors turning; E at `SPOTS4.generator` in a rainy run opens `generator`, nowhere in a normal run; rain off →
no rain instances drawn; perf with the rain on ≤ +1 ms a frame at 1,800 birds; ≤ 40 extra draw calls and ≤ 60 k
triangles in the house view; `renderer.info.programs.length` unchanged after a tour of the four conditions; the Phase 1
`tour` shots unchanged in the sandbox.

## 13. Integration order
1. `sim` (pure; test-cycle and test-cond run on main). 2. `scene` and `panels` (either order). 3. `run` last (it puts the
condition on the farm, makes the jobs, merges the signs). After each merge: `npm run build`, `npm test`, `cold-hot`,
`tour`, `phase1-jobs`, `p2-hooks`, `p2-level1.json`, `p3-cycle.json`, `p3-replay.json` and the merged packages' steps
files. Then the integrator sets `CONDITIONS[id].available` true, writes `scripts/p4-cycle-steps.mjs` and runs the four
condition play-throughs of §11.3 and `p4-clarity.json` by real input, re-times the real-input days (≤ 4.5 minutes each),
updates `p3-cycle.json`'s day-37 night round for the evening rule (§2.6) and writes ARCHITECTURE.md ("Phase 4 — as
integrated").

## 14. Open questions for the farmer
1. **Moving air (§2.2 row 7):** we now say birds of 5 weeks feel about 5–6 °C cooler at 2.5 m/s and birds of 2 weeks
   about 7 °C, and that moving air helps little once the house is near 40 °C. Does that match your houses? Do your big
   birds start to pant at about 24 °C felt (the house less the wind chill) and all pant by about 28 °C?
2. **Warm evenings (§2.4):** do you keep the pads running into the evening for big birds, and until when (we say every
   fan and the pads while the outside air is over about 30 °C, until about 21:00, then tunnel air all night)?
3. **The temperature + humidity limit:** still one number, the pads off over about 90 % house humidity (PHASE3.md
   question 6)? Or do you use a sum of temperature and humidity?
4. **Water in the heat:** do your meters show about 1.8 L of water per kg of feed in comfort, 2–2.5 on hot days and up
   to about 3 in a heat wave? Do you flush the warm water out of the lines at midday in April and May?
5. **The hot season (§4.1):** are 37–38 °C afternoons, nights hardly under 28 °C and a heat wave to about 41 °C right for
   April–May where you farm? Do you place chicks then, and do the brooders run only at night?
6. **The rainy season (§4.2):** storms about once a week? Do your side-wall inlets have storm flaps? How often does the
   power go, and for how long? Is your generator switched by hand or by an automatic transfer switch? How long do big
   birds last without fans (we say the first die after about half an hour, a few in every hundred after two hours)?
7. **A bad batch (§4.3):** what tells you a batch is weak (we say under about 38 g, many open navels and slow
   reflexes)? Do you grade and cull at placement, and does the hatchery credit the culled chicks (we count them apart)?
   Is 2.5 % the right first-week limit for such a batch, and 1 °C warmer for 3 days your practice?
8. **Water (§4.4):** is iron in well water a problem in your area (we say about 1.2 mg/L; over about 0.3 clogs the
   filter and the nipples)? Do the pads and the drinker lines draw on one tank? How big is your tank and pump, and how
   do you first notice a pump that is wearing out?
9. **The flock's own heat (§2.2 row 19):** a closed house of 5-week birds on minimum ventilation reaches about 29 °C at
   05:00 in our model. Does a house of big birds warm that much at night without tunnel air?
10. **Uniformity (§2.2 row 16):** about 68–74 % of the birds within ±10 % of the mean at 40 days for a well-run
    as-hatched flock: your numbers?
11. **Playing the conditions:** each condition can be a whole new flock or one level from the run card. Is that the way
    you want to practise them, and should a condition be offered before the first full cycle?
12. **Guide tags** stay provisional (PHASE3.md question 1): every Phase 4 line is general practice. May any of them carry
    a guide name?
