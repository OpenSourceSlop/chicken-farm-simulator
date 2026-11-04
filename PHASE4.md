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
the stubs `src/farm-cond.js`, `src/ui-cond-panels.js`, `src/props-cond.js`, the one merge of the signs
`content-signs-cond.js mergeBoardsP4`, the checks `scripts/tuning-refs.mjs`, `scripts/tuning-refs-cond.mjs`,
`scripts/test-tuning.mjs`, `scripts/test-perf.mjs`, the audit tool `scripts/tuning-audit.mjs`) and the four work packages
(§12). Each package section of §12 stands alone.

**Review round (this revision).** The design review found that the conditions' expected results had never been computed
and four of them did not hold (the hot brooding week worked backwards; the hot ideal failed week 2; the power-cut sign was
measured in the wrong weather; the tank could not give the warning the ideal waited for), that several bad-play profiles
would not fail as claimed, and contract holes (who waits a timed action; the stubs could not raise condition problems;
two holders of the condition; the new plates crashed on the panels branch). Every §4 band now comes from a measurement:
the env-only references of `scripts/tuning-refs-cond.mjs` (in `npm test`) or a rough farm check (marked "rough"). The
hot season gained the afternoon sun on the roof and the pad with one fan from day 1; the rainy cut is measured in its
storm; the water condition's clue is the pump's gauges and the tank's low marker; the contracts have one rule for timed
actions, one holder of the condition (`farm.condition`), a stub that raises every condition problem, and the sign merge on
main.

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
  figure, the sim package's model gives it (`scripts/test-tuning.mjs`, in the weather the sign is read in),
  test-contracts finds its whole text on its board.
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
  40 °C: then only the pads cool the birds. The heat sign and the fan panel's *Birds feel* readout say so. The brooding
  week keeps Phase 2's wind chill and chick comfort in every condition.
- **Panting** spreads over about 4 °C of felt temperature instead of 1 °C: from day 35 the first birds pant at about
  24 °C felt, half at 26 °C, all at 28 °C. "Felt" is the fan panel's *Birds feel* reading: the house less the wind
  chill, plus the damp (about 1 °C at 87 % house humidity, 2 °C at 90 %, 4 °C at 95 %; the heat sign prints all three).
  The flock no longer jumps from none to all panting within a degree, so "about 3 in 10 birds panting" is a real
  reading on the job strip and the comfort view.
- **Warm evenings of big birds** (the Phase 3 check's day-37 item, §2.4): at 19:00 the outside air is still about
  31 °C; with three fans most birds pant (about 9 in 10), with six fans about 3 in 10, with six fans and the pads none.
  The heat sign's evening line says what to do: from day 28 every fan and the pads while the outside air is over
  about 30 °C, until about 21:00, then tunnel air all night. *Set the ventilation for the night* is done when no more
  than about a quarter of the birds pant (or every fan is on with the pads while the air is that warm).
- **Young birds on a hot afternoon** (week 3): six fans still bring them back; the pad with one or two fans does too
  (a new sign line). Six fans and the pad chill them, and the heat job does not count it.
- **Big birds make their own heat**: a closed house of 5-week birds on minimum ventilation at night warms to about
  29 °C at 05:00 and most birds pant; tunnel air all night keeps them comfortable (the heat sign's night line).
- **Water**: birds drink about 1.8 L of water a kg of feed while they are comfortable, and more while they are hot and
  panting (2–2.5, up to about 3 in a heat wave without cooling). A well-cooled flock stays near 1.8–2.0 on hot days:
  the drinker plate says it is the birds' heat that raises it, and a rising ratio on the records reads "the birds were
  hot", not "the day was hot".
- **Older birds chilled** huddle and eat less before they die: 16-day-olds under six fans and the pad lose a few birds
  in the afternoon, not dozens.
- **The catch**: big birds no longer die of thirst in the three hours the lines are up for the crew.
- **Uniformity**: a well-run flock weighs 68–74 % within ±10 % at the day-40 weighing (Phase 3: 66 %).

### 1.2 After the first cycle: harder flocks
The cycle summary of a finished cycle (and the title card from then on, `skills profile.cyclesDone ≥ 1`) shows
**Harder flocks**: four cards side by side, each with its name, its months (where it is a season) and one line —
*Hot season · April–May: afternoons of 37–38 °C with the sun on the roof, nights hardly under 28 °C, a heat wave to about
41 °C in week 5*; *Rainy season · August–September: damp air day and night, storms every week, a power cut in week 5*;
*A bad batch of chicks: small, uneven, many weak*; *A water problem: iron in the well water and an old pump*. Each card has
*Start a new flock in the hot season* (Plan the farm under that condition). The **run card** gives every reached level a
condition choice (*Normal season* · the four) beside *Play from a standard start*; a condition chosen on a level row starts
**a new run** under that condition from that level (§3.1). Before the first full cycle the choice reads "Harder flocks:
after your first full cycle" and nothing in it can be pressed. The HUD's clock card carries the condition's name under the
day ("Day 25 · Hot season"); the records book, the result screens and the cycle summary name it in their headers
("Level 5 – Weeks 4 and 5 · Hot season").

### 1.3 The hot season (April–May; §4.1)
Every afternoon the sun on the roof heats the house (about 1.5 °C an hour from 11:00 to 17:00) in 37–38 °C air, so a
closed house runs 3–6 °C over the chicks' row by 15:00, and more air from outside only brings in hotter air. From day 1
*Keep the chicks' afternoon heat down* (14:00–18:00): the brooder sign's hot-season line says the pad with **one** tunnel
fan from about 11:00 to 18:00, the timer on the sign's setting, the brooders on their thermostat (they burn only in the
cool hours); the chicks then feel about 1 °C under their row, inside the band. Two fans and the pad chill them; the
closed house loses 1–2 % of the chicks to heat in the week and fails it on deaths (2.6 % in all on a rough farm check). In weeks 2–3
*Keep the young birds' afternoon heat down*: the pad from about 11:00 into the evening with one tunnel fan in week 2 and
two or three in week 3 (Phase 3's plan of no tunnel fans before day 14 loses 3–15 % of the birds in the heat); the fan
panel's afternoon check and the night ventilation start on day 8. Week 3's warm afternoon is 40 °C. In weeks 4–5 every
afternoon wants the pads and all fans from about 11:00, the heat wave reaches about 41 °C (a stopped fan or a dry pad
section costs birds), and the pads stay on while the outside air is over about 30 °C, often all night (days 33–35 bring
30 °C nights). On even afternoons from day 22 *Flush the warm water out of the drinker lines* (13:00–15:00): the water
supply shows each line's water temperature; over about 30 °C the birds drink less. Days 36–42 as Phase 3, with a 40 °C
finishing afternoon; the catch is booked after midnight.

### 1.4 The rainy season (August–September; §4.2)
The house air is damp day and night: the litter dries slowly and the minimum ventilation decides the litter and the
ammonia from week 1 (the vent sign's rainy line: every morning, about a quarter over the table while the house reads
over 80 % at dawn). Storms come on days 5, 12, 19, 26, 33 and 39 (four hours of rain, about 4 °C cooler, 98 %). On day 19
the storm drives rain in through the south side-wall inlets: *Wet litter along the south wall after the storm: find
what wets it* (the storm flaps on the controller's Ventilation tab) and *Put fresh litter on the wet strip*. The pads cool
only 2–4 °C in the damp air (the pad plate says so) and the hot afternoons of the normal season do not come. Days 29–31
are a damp spell (*The air in the house feels damp again*). Every week from day 8 *Test-run the generator*. On day 33 at
15:10, in the storm, **the power goes off**: the alarm sounds, the house goes dark, the fans and the pad stop, the farm
clock slows to the carrying speed (every farm minute counts), any *Next job* skip stops, and *The power is off: start the
generator* opens pinned. Big birds in the 98 % storm air start dying within minutes: about 1 in 1,000 by 10 minutes, 4 in
1,000 by half an hour, one or two in every hundred by two hours (the power sign). He walks to the generator west of the
house (about 5 farm minutes from the controller by the door, 9–11 from the fan panel), starts it (a 2-minute bar) and
switches the house over. At 18:10 the mains is back: *The mains is back: switch over and stop the generator* (pinned);
left on, the generator's 150 L last about 10 hours and the house goes dark again in the night with the alarm (*The house
is dark again: the generator stopped*).

### 1.5 A bad batch of chicks (§4.3)
The prep day has one more job: *Put feed trays and chick paper by the brooders*. The chick truck comes two hours late
with chicks from a young parent flock (the delivery ticket says so). The box weighing reads about 36 g and the grading
sample shows three or four weak chicks in ten: *Many weak chicks in the boxes* opens. At the chick table the new
*Grade the stacks* tab grades a stack in about 6 farm minutes (the weak ones go into the cull box), then the phone to the
hatchery: chicks graded out on day 0 are counted apart and claimed once the hatchery is told the same day. Weak chicks
left in the flock carry yolk-sac infection: most of them die in the first week and they take some of the others with
them (the chick sign says so): ungraded, the week's deaths reach about 3.5 % and fail it. *Brood the small chicks 1 °C
warmer* (days 0–3: the sign's row + 1 °C everywhere the target shows) and *Check the crops again at 48 hours* (day 2).
The day 7 weigh-in is against his measured 36 g: 4.0 × is still the line (the small chicks reach about 180–200 g, about
4.6–5.4 ×), and the week's deaths and floor culls may reach 2.5 % of the chicks placed. Later weeks show the batch as a
lower uniformity and a little less weight, within the targets with good care.

### 1.6 A water problem (§4.4)
On day 1 *Test the well water* (the water supply's test kit, given with this condition): iron about 1.2 mg/L (the water
supply plate: over about 0.3 mg/L clogs the filter and the nipples). The filter blocks on day 3 (Phase 2) and again in the
nights before the flow-test mornings of days 12 and 24 (*Low water flow again: find the cause*); on day 18 line 4's
nipples clog (*One drinker line gives little water*: flush it, then a flow test). From day 22 *Read the water tank and
the well pump's gauges* every morning: the sight gauge with its marker (the lowest level since the last reading), the
pump's pressure and current against the plate's 2.4 bar and 6 A. From day 26 the old well pump wears: on day 27 it reads
about 2.1 bar and 6.4 A, and *The well pump gives less water* opens → *Repair the pump* (2 farm hours, best in the
morning). Left alone it gives about an eighth less each day; the heat wave's afternoons (the pads draw 700–1,200 L an
hour, the birds 100–150) empty the tank: the marker reads under 30 %, the meter's litres per 1,000 birds fall, the birds
crowd the drinker lines after 15:00 and the pad dries from the far end.

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
| 4 | Water : feed | 1.80–1.87 L/kg on every weigh day, flat; + 0.03 per °C of house air over 30 °C | about 1.6–2.0 in comfort (sign-water, general); birds that are hot drink about 5–7 % more water per °C of heat (general): about 2–2.5 while they are hot and panting, up to about 3 in a heat wave without cooling | **Off** (flat in the heat). Fix: from Week 2 r = 1.8 × (1 + 0.05 × max(0, mean e)), at most 3.2 (`waterPerKgP4`): it follows the birds' heat, not the weather. On the env alone the ideal reads 1.87 on day 25, 1.87 on a hot-season day and 1.96 in the heat wave; fans without pads in the heat wave 2.57. The drinker plate prints it that way (§2.5) |
| 5 | Target temperature | 34 °C day 1 → 20 °C day 35, a straight line | the ends: Week 1 guide / Broiler Ventilation; general tables about 29–30 °C at day 7, 27 at 14, 24–25 at 21, 22 at 28 | OK (the guide's ends; the line between runs 1–2 °C warmer than general tables in weeks 1–2 and is what the brooder sign prints) |
| 6 | Comfort zones, panting | cold under −1.5 °C; panting from hotFrom 1.5 (day 7) … 6.0 (day 35) °C over the target, 0 → 100 % of the birds within 1 °C | panting starts as the felt temperature passes about 31 °C at 2 weeks, 28–29 °C at 3 weeks, 24–26 °C for 5–6 week birds and spreads over several degrees as birds differ (general) | **Off** (1 °C ramp). Fix: a 4 °C ramp from hotFrom − 1.5; hotFrom 1.5 / 2.0 / 3.0 / 4.5 / 5.5 / 5.5 on days 7–42 (`pantShareP4`): big birds first pant at 24 °C felt, all at 28 °C |
| 7 | Wind chill | speed × (3.0 − 1.6 × clamp((age − 7)/28)): at 2.5 m/s 7.45 / 6.45 / 5.45 / 4.45 / 3.5 °C on days 7 / 14 / 21 / 28 / 35+; straight in speed; the same in any air | market-age birds about 5–7 °C at 2.5 m/s, young birds more; most of it in the first 1.5 m/s; it fades as the air nears body temperature, little left near 40 °C (general) | **Off** for big birds and hot air. Fix (`windChillP4`): K(age) × v^0.8 × 2.5^0.2 × τ(house °C), K 3.0 / 2.8 / 2.6 / 2.4 / 2.2 °C per m/s (days 7 / 14 / 21 / 28 / 35+), τ 1 up to 35 °C falling to 0.15 at 40 °C: 7.5 / 7.0 / 6.5 / 6.0 / 5.5 °C at 2.5 m/s, 30 °C |
| 8 | Temperature + humidity limit | pads off over 90 % house RH (`HEAT.padOffAboveRH`); felt + 0.08 °C per % RH over 75, + 0.35 over 88, faded in 24–28 °C | the plan's temperature + humidity limit; general: over about 90 % the pad adds more damp than cool | OK (one number on the plate; open question §14.3) |
| 9 | Pad cooling | 0.8 × (outside − wet bulb) × tunnel share: 6.2 / 7.7 / 9.6 °C at 33 °C 54 %, 36 °C 47 %, 39 °C 40 % = 67 / 73 / 82 % of the rule's 9.2 / 10.6 / 12 °C | about 1 °C per 5 % RH the air can still take up (Broiler Ventilation); a pad in good order gives most of it (general) | OK. The plate's "most of that, never all of it" is now a checked figure (60–95 %); the rainy season's 2–4 °C a new one |
| 10 | Minimum ventilation by weight | the sign table: 150 m³/h per 1,000 at 40 g … 3,650 at 3 kg = 0.16 → 3.65 m³/h a bird, 3.7 → 1.2 m³/h per kg | minimum ventilation per 1,000 birds by weight (Broiler Ventilation; numbers general): rates rise about as weight^0.75 | OK (the table rises 23 × from 40 g to 3 kg, weight^0.75 gives 25 ×; at the high end, fit for a humid house) |
| 11 | Too little minimum ventilation | `noStep` (the day-8 timer to day 21, cool season): night RH +4 points, litter +3, NH3 +2.5 ppm, −0.4 % at day 21 | in a heated house in dry cool air the moisture leaves with less air; in damp air it does not (general physics of the house) | OK for the cool season (the water balance holds). In the rainy season (rough check: Phase 3's model with the rainy weather and storms forced into weeks 2–3) it costs more but does not fail week 3: noStep day 21 931 g (98 % of the target), litter 34.6 %, NH3 up to 33 ppm at night, against the rainy ideal's 975 g, 32.8 %, 14 ppm (§4.2: `rainyNoStep` passes with those costs) |
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
| 23 | Young birds in the warm afternoon (day 16, 35 °C) | four fans 50 % panting; six fans none; the pad with six fans chills (e −5.8) | young birds: as few fans as the heat allows; the pad with few fans (general) | OK; Phase 3's "never by the pad under 21 days" rule (farm-cycle-problems.js `heatHandled`: `young && env.padOn` refused) is replaced by "never with the birds chilled": the pad with one fan keeps 16-day-olds at e +0.2 (§2.3). The change is in the sim package's Builds (§12.1) with a test-cond case; the job engine's `heat-handled` reads the same function. It is the hot season's own remedy in weeks 2–3 (§4.1) |

### 2.3 The Phase 4 responses (`src/farm-tuning.js`, model unless `SIGN_FIGURES` lists them)
- **Wind chill** `windChillP4(v, age, airC) = K(age) · v^0.8 · 2.5^0.2 · τ(airC)`; K [[7, 3.0], [14, 2.8], [21, 2.6], [28, 2.4],
  [35, 2.2], [42, 2.2]] °C per m/s; τ = clamp((41 − airC)/6, 0.15, 1). From Week 2 in every run it replaces sim.js's Phase 2
  formula; the brooding week keeps Phase 2's wind chill and chick comfort (farm-comfort.js) in every condition, and the
  sandbox keeps Phase 1's (the hot season's brooding references, §2.3 below, run on Phase 2's).
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
- **The hot season's sun** (`config.CONDITIONS.hot.sun`, model): 1.5 °C an hour into the house air from 11:00 to 17:00
  (2 h ramps: full sun 13:00–15:00) on every day of every level, as Phase 2's warm afternoon; the hot season's own events
  carry no sun of their own (the heat wave 0.5). With six fans it moves the house air about 0.3 °C; in a closed brooding
  house it decides (§4.1).

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
| hot season d25 15:00 (with the sun) | ideal / fans, no pad | 38 °C 48 % | 30.3 · 84 / 38.0 · 48 | 6.2 / 3.1 | 24.7 / 34.8 | 0 / 1 | 0 / 0.36 |
| hot season d37 19:00 (with the sun) | 6 + pad / 6 fans | 35.5 °C 54 % | 29.4 · 86 / 35.6 · 54 | 5.5 / 5.0 | 24.6 / 30.4 | 0.16 / 1 | 0 / 0.04 |
| rainy season d33 15:00 | ideal | 30 °C 69 % | 30.3 · 68 | 5.6 | 24.5 | 0.05 | 0 |

Windows (deaths % of the birds · panting bird-hours per bird): week 3 ideal 0 · 6.6, minimum ventilation 0.07 · 88; the
pad with six fans on day 16 0.2 % (cold, 7.6 cold bird-hours); weeks 4–5 normal days ideal 0 · 7.9, fans without pads
0 · 30, minimum ventilation 22 %; heat wave ideal 0 · 2.0, fan 4 broken 0 · 4.6 (2.3 × the ideal), a third of the pad
dry 0 · 10.2 (5.1 ×), fans without pads 20 %, minimum ventilation 59 %; humid day pads on 0.03 % (intake 1.6 % under
the ideal); hot finishing day fans without pads 0.9 %; the hot season's heat wave (with the sun) ideal 0 · 5.0, fans
without pads 42 %. The power cut is measured where it happens, in the rainy season's storm (below).

**The conditions' references** (`scripts/tuning-refs-cond.mjs`, run by `scripts/test-tuning.mjs` now; every band is in the file). Hot
brooding week (5,950 chicks, brooders and timer by the sign, Phase 2's chick comfort e at the 0.3 quantile; 11:00–18:00
plans; deaths are Phase 2's heat deaths over days 0–7):

| Plan (hot season, with the sun) | e day 1 / 3 / 6 at 15:00 | Heat deaths % (week) | 14:00–18:00 within ±1.5 °C | Note |
| --- | --- | --- | --- | --- |
| the sign's timer only (`hotNoBroodAir`) | +3.1 / +4.8 / +6.2 (house 37.4 / 38.2 / 38.4 °C) | 1.08 | 5 % | rough farm check: deaths + culls 2.6 % (heat 2.0 %), ratio 4.4–4.5, 4 seeds |
| Phase 2's warm timer (2 fans, 120 s in 300 s) | — / — / +6.1 | 0.89 | 0 % | more 38 °C air: no better |
| **the pad with one tunnel fan** (`hot:ideal`) | −1.0 / −1.3 / −1.1 (house 33.6 / 33.0 / 32.2 °C) | 0 | 100 % | rough farm check: ratio 4.67–4.83, deaths + culls 0.60–0.62 %, gas 60 kg (normal ideal 135) |
| the pad with two tunnel fans | — / −2.5 / — | 0 | 0 % | chills the chicks |

Hot weeks 2–6 (the Phase 4 responses, the check flock): day 9 / 12 at 15:00 Phase 3's plan (no tunnel fans before day 14)
e +5.7 / +7.1; the young birds' pad (one fan to day 11, two to 17, three to 20; 11:00–20:00) e −0.8 / −1.2 / −0.2 on days
9 / 12 / 14, +1.6 on day 16 (40 °C), +0.4 on day 18, −0.6 at 19:00. Days 8–15: Phase 3's plan 7.4 % dead, six fans without
the pad 0.7 %, the young birds' pad 0.002 %; days 15–22: 6.7 % / 0.03 %. Weeks 4–5 with the hot season's events: the ideal
0 · 24.7 (the pads stay on at night while the outside is over 30 °C), no pads 65 %, three fans and no pads from 18:30
5.6 %, the pads off at 21:00 0.015 % · 47.7 (1.9 × the ideal's panting).

Rainy season, the power cut from 15:10 of day 33 inside storm-33 (28 °C, 98 %), the ideal before and after, heat deaths
from 06:00 day 33 to 06:00 day 34: 0 min 0 · 10 min 0.10 % · 30 min 0.42 % · 60 min 0.70 % · 120 min 1.60 % · 180 min
(never started; the mains back at 18:10) 2.77 %. Deaths start within minutes: without the 5.5 °C of wind chill and with
the 98 % air's +5 °C, the felt e jumps from about 3 to about 13 within 5 minutes.

Water condition, the tank (6 m³, pump 1.2 m³/h × pumpShare, the Phase 4 ideal of the normal season in weeks 4–5): the
pads draw 934 L an hour on day 25 at 15:00 and 1,141 in the heat wave, the birds 110–131. The pump's pressure at 06:15:
2.40 bar on day 26, 2.11 on day 27 (pumpShare 0.88). Repaired on day 27 08:00–10:00: the tank never under 89 %, no deaths.
Never repaired: the tank 85 % at its lowest on day 29, under 2 % on days 30–32, 57 hours under 20 % (the lines low), 3.4 %
heat deaths. Repaired the morning after the marker first read under 30 % (day 31): the tank 8 % on day 30 and 46 % on day
32, 26 hours under 20 %, no heat deaths.

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
evening line (§2.5) says: big birds (from day 28) on warm evenings every fan, and the pads while the outside air is over
about 30 °C (the controller's *Outside* reading), until about 21:00; then tunnel air all night (`config.HEAT_P4`; the hot
season's line adds: keep the pads on while the outside air stays over about 30 °C, often all night). The
job *Set the ventilation for the night* (state `night-comfort`, re-defined): for 30 farm minutes after 18:00 no more
than a quarter of the birds pant and none are chilled (felt comfort ≥ −1.5 °C), or every working fan runs with the pad
on while the outside air is at or over 29.5 °C (or the house RH is over 90 %). Its strip shows the outside air, the
panting share the farmer sees ("about 9 in 10 birds panting"), the fans and the pad against the sign's evening line.
The ideal profile runs every fan and the pads from 18:00 to 21:00 from day 28 while the outside is at or over 29.5 °C.
**Three fans on day 37** after 18:00 is therefore a choice with a visible cost: the job stays open until about 22:00,
the birds pant 4–5 hours longer than the ideal's and eat a little less (about 2 % a day: `eveningFans3` §2.6), no bird
dies of it in the normal season. In the hot season the same choice kills (§4.1 `hotNight3`: 3.3 % by day 31), and the
normal season's evening line followed there (the pads off at 21:00) doubles the panting (`hotPadsTo21`).

### 2.5 Every sign figure matches the model (`config.SIGN_FIGURES`, `content-signs-cond.js`)
`SIGN_FIGURES` lists each figure a Phase 4 sign prints, the board it is on, and the check of the model
(`scripts/test-tuning.mjs`, the model side, each in the weather the sign is read in; `scripts/test-contracts.mjs`, the text
side: the figure's whole text is inside one line of its board). All general practice.

| Figure (as printed) | Board | Model check (now) |
| --- | --- | --- |
| at 2.5 m/s birds of 5 weeks feel about 5–6 °C cooler, birds of 2 weeks about 7 °C | sign-heat (replaces "3–4 °C … 6–7 °C") | windChillP4(2.5, 35) 5.5 · (2.5, 14) 7.0 |
| moving air cools less once the air is over about 35 °C; near 40 °C it gives little: then the pads cool the birds | sign-heat (new) | τ(39 °C) 0.33 |
| All six fans give about 2.5 m/s at bird height, each fan about 0.4 m/s | sign-heat (Phase 3) | 0.417 m/s a fan |
| birds of 5 weeks start to pant when they feel about 24 °C, all of them by about 28 °C (felt: the fan panel's Birds feel reading) | sign-heat (new) | 24.0 / 28.0 °C; the *Birds feel* readout is the model's felt temperature, the damp included (§6.12) |
| in damp air the birds feel warmer still: about 1 °C at 87 % humidity, about 2 °C at 90 %, about 4 °C at 95 % | sign-heat (new) | humidityTerm(87 / 90 / 95 %, 30 °C) 0.96 / 1.9 / 4.05 |
| big birds (from day 28) on warm evenings want every fan, and the pads while the outside air is over about 30 °C, until about 21:00 | sign-heat (replaces the evening line) | `HEAT_P4` day 28, 29.5 °C, 21:00 (the ideal and `night-comfort`) |
| hot season: … keep the pads on while the outside air stays over about 30 °C, often all night | sign-heat (hot season) | the hot ideal's pads all night: weeks 4–5 0 · 24.7 vs the pads off at 21:00 0.015 % · 47.7 |
| young birds on a hot afternoon: the pad with one or two tunnel fans; six fans and the pad chill them | sign-heat (new) | d16 pad + 1 fan e +0.2; pad + 6 fans e −5.8 |
| hot season: every afternoon the closed house runs over the chicks' row … the pad with one tunnel fan | sign-brooder (hot season) | the sign's timer e +4.8 on day 3; the pad with one fan e −1.1 on day 6 (BROOD_REFS_P4) |
| water : feed about 1.8 L/kg while the birds are comfortable; while they are hot and panting they drink more: about 2–2.5 L/kg; in a heat wave without cooling up to about 3 L/kg | drinker (new, from day 8) | waterPerKgP4(0 / 6 / 14) 1.80 / 2.34 / 3.06 (e 6 and 14: birds left hot) |
| set each line to age + 20 ml/min, give or take 3 ml/min; nipple height and pan rim: the figure for the day, give or take 3 cm | drinker, feeder-box (new; the done rules' bands `FLOW_BAND`, `HEIGHT_BAND_CM`) | job-figures.js (run) |
| a pad in good order gives most of that, never all of it | pad-pump (Phase 3's line, content-signs-cycle.js; now checked, not added again) | 0.69–0.82 of the 5 %-per-°C rule |
| in the damp air of the rainy season a pad cools only about 2–4 °C | pad-pump (rainy season) | 3.8 °C at 30 °C, 69 % |
| without fans big birds overheat at once: within minutes the first die; after half an hour about 4 in 1,000; after two hours one or two in every hundred | sign-power (rainy season) | the cut in storm-33 from 15:10: 10 / 30 / 120 min 0.10 / 0.42 / 1.60 % (CUT_REFS_P4) |
| Fuel: 150 L, about 10 hours at full load | generator plate | 150 L ÷ 15 L/h |
| a pump in good order: about 2.4 bar and 6 A | water-tank plate | `WATER_TANK.pumpBar`, `pumpA` (the gauges: bar × pumpShare, A + 3 × (1 − pumpShare)) |
| on a hot afternoon the pads draw about 700–1,200 L an hour; the birds drink about 100–150 L an hour | water-tank plate | TANK_REFS_P4: pads 934 / 1,141 L/h on days 25 / 31, the birds 110 / 131 |

Also checked against the model by the packages' own tests (unchanged figures): the vent sign's table and its worked
example (6,000 chicks of 42 g: "about 900 m³/h", the timer's 8 s = 960 m³/h; the strips show 928 m³/h as the figure worked
out for 6,000 chicks of 42 g, §6.5); the feed sign's 75 / 130 / 160 / 185 / 200 g (`feedStdGAt`); the bird-scale plate's
targets (`weightAt`); the light sign's 20 lux (60 × 0.35 = 21); the catch sign's 2 % shrink (the ideal's 10 h withdrawal:
0.98); the gas plate's 200–300 kg to day 21 (the ideal, test-cycle).

**When the lines show.** `content-signs-cycle.js boardsForDay(day, condition)` is the one merge (frozen contract code on
main: `content-signs-cond.js mergeBoardsP4`). A condition's lines and boards show only in its run (`farm.condition`);
`BOARD_P4_ITEMS` (the tuned model's lines and the ±3 bands) show in every run once `config.PHASE4.tunedSigns` is true: the
integrator sets it at the sim merge, when the model the lines describe goes live (a harness may set
`__game.config.PHASE4.tunedSigns = true` before). With no condition and the switch off every board reads exactly as in
Phase 3 (test-contracts checks it, and that no board holds a line twice in any condition and day).

### 2.6 What the tuning changes in the farm, the profiles, the targets and the play-throughs
The sim package wires `farm-tuning.js` into the farm from Week 2 (`farm.cyc.on`) in every run; the brooding week keeps
Phase 2's model in every condition (a condition changes its weather, sun, delivery and problems, not its responses), and
Phase 2's brooding week of a normal run is untouched (`test-sim.mjs` byte-identical). Then
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
| ideal · new `waterFeedHotDay` (the records row of day 25, water ÷ feed) | — | [1.8, 2.0] (well-cooled birds drink near the comfort ratio; env: 1.87) |
| fansNoPad · new `waterFeedHotDay` | — | [2.1, 2.7] (birds left hot; env: 2.57 in the heat wave) |
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
(the integrator agrees a band change). Filled by the sim package (branch `phase4/sim`); every Phase 2 number of the lone
brooding week is byte-identical (the 17 profiles' farm, records and skills).

**Wired as §2.3 / §9.1 say** (no constant changed): `windChillP4` from Week 2 through `env.setWindChillP4` (the farm's
`syncEnv` with the cycle model); panting, heat deaths, intake and the cold deaths from day 14 in `farm-house.js
houseComfort` (the per-cell arithmetic inlined with the age's thresholds read once per call, checked equal to the functions);
the flock's sensible heat x `sensibleHeatK`; water by `waterPerKgP4(mean e)`; `dehydrationAllowed` on the hours with water
access under 0.5; `farm.comfort.pantFrom / pantAll / feltMean` (also in the brooding week: Phase 2's mean + the damp).

| # | Change | Why | Effect / bands |
| --- | --- | --- | --- |
| 1 | `TUNING.cvGrowthAfter14` 0.8 → **0.5** | the base CV growth (0.0002 a day, not scaled by `cvCycleK`) dominates after day 14: at 0.8 the ideal's flock read 67.0 % at day 40 | model 69.1 %, weighed 68 % at day 40 (band 68–76); 72 % at day 35 |
| 2 | New model rule (farm.js): from Week 2 the droppings carry half the water at the comfort ratio (1.8 L/kg); the water drunk over it leaves as breath (panting) | with the hot ratio in the droppings and the evening pads (house 88–91 % RH, 18:00–21:00) the litter under the drinker lines passed 40 % from day 37 and caked a third of the floor (uniformity 64 %) | ideal litter 31.0 % at day 41 15:00, no cake; the records' water : feed 1.97 / 1.99 on the rows of days 25 / 26 |
| 3 | `heatHandled` (farm-cycle-problems.js): never chilled; birds under 21 days may have the pad with **at most three** tunnel fans (`YOUNG_PAD_MAX_FANS`) | §2.2 row 23's "the pad with few fans allowed" read literally keeps test-jobs' Phase 3 case (16-day-olds, six fans and the pad: not handled) while the hot season's week-3 plan (two or three fans) and `padYoung1` are handled | test-cond: pad + 1 fan on day 16 e +0.46 handled, pad + 6 fans e −5.3 not |
| 4 | The hot season's line water: the drinking factor (× (1 − 0.015 × (line °C − 30))) for birds of **21 days and older** (`LINE_WATER_FROM_AGE`); the line temperature is tracked from the prep day | the brooding house runs at 32–34 °C by design (lines 34–36 °C): chicks lost 7 % of their water access and 5 % of their day-7 weight (ratio 4.58); the flush job exists from day 22 | hot brooding ratio 4.83, day 14 497 g |
| 5 | The tank (water condition): the pads draw their evaporation on the wet share **plus `padBleed` × the full pad's flow** (the pad pump sends it whatever the sheet's wetness) | with the bleed on the actual draw the farm's tank settled at 3–8 % in the unrepaired heat wave (the farm's birds drink less once the lines lose pressure): waterPumpUnfixed passed | tank 1.7 % on days 30–32 (env < 2 %); the level fails on day 32 |
| 6 | Bad batch details (model, §4.3 gives none): the grading sample of ten shows weak chicks at 7.5 × the weak share (3–4 of 10); a weak chick's hazard × −ln(1 − 0.45) / 0.444 (Phase 2's week-1 hazard of the weak gives 35 %); yolk-sac deaths as cause `infection`; the claimed chicks out of the harvest's and the summary's mortality and base | §4.3's numbers | bad:ideal ratio 5.11, deaths + floor culls 0.58 %, 239 claimed (4.0 %), day 7 uniformity in 42–54 % |
| 7 | Storm flaps: the timer air × 0.7 while closed (`env.setInletShare`); the rain-in strip x −12..12, the two southmost cell rows; the generator's test burns 10 minutes of fuel | §4.2's model values | rainyNoFlaps: the strip 45.9 % after the storms |

**The profiles' plans** (farm-profiles-cond.js; the ideal farmer reads the fan panel's *Birds feel*): the hot ideal's
tunnel fans with and without the pad come from the house balance the env integrates (`feelWith`: the pad on the tunnel air's
share, the timer, the sun, the flock, the slab, the damp) — needed for week 2's own rainy spell (92 % outside RH in 36 °C
air: the pad cannot cool) and weeks 4–5's dry spell (RH − 30 points: the pad with six fans chilled 23-day-olds to e −8);
the young birds' pad stays to 20:00 and their hot nights get up to three fans by feel; a stop at 18:00 and 20:00 from day
28 carries the evening line (all profiles); `eveningFans3` keeps the found heat wave's answer on days 30–32 (three fans in
37 °C evenings killed 2 %); `rainyGenLeftOn` does the pinned *mains is back* job on the morning round after the restart.

**Bands moved by the sim package** (the measured value; for the integrator to agree):

| File · profile · band | §2.6 / §4 | Measured | Now |
| --- | --- | --- | --- |
| test-cycle · minVentW3 · `day21WeightUnderIdealPct` | [1, 4] | 4.1 (the closed week-3 house with the flock's heat × 2.5) | [1, 5] |
| test-cycle · eveningFans3 · `day35WeightUnderIdealPct` | [0.5, 3] | 0.03 (`heatIntakeP4` costs feed only over hotFrom: the ramp's lower half is free; panting 18 × the ideal's) | [0, 3] |
| test-cycle · ideal · `waterFeedHotDay` | row of day 25 | the meters are read at 06:15: the hot afternoon of day 25 is on the row of day 26 (ideal 1.99, fansNoPad 2.10) | row of day 26, bands as §2.6 |
| test-cond · hot:ideal · finish `fcr` / `epef` | [1.6, 1.8] / [330, 420] | 1.574 / 428 (well cooled, the birds lose nothing to the heat; harvest 2,875 g) | [1.55, 1.8] / [330, 440] |
| test-cond · bad:ideal · finish `mortalityPct` / `epef` | [2.3, 3.5] / [350, 420] | 2.21 / 425 (grading takes 90 % of the weak out: fewer weak deaths than a normal flock) | [2.0, 3.5] / [350, 440] |
| test-cond · rainyNoStep · `day21UnderIdealPct` | [3, 6] | 7.96 (passes week 3; litter 34 %+, NH3 25 ppm+) | [3, 9] |
| test-cond · waterPumpUnfixed · heat deaths | ≥ 2 % | 1.7 % by day 32; the level fails on its deaths 2.2 % (margin 0.2, not 0.5) | ≥ 1.5 % and the level's deaths ≥ 2.0 % |
| test-cond · waterPumpLate · `day35UnderIdealPct` | [0.5, 4] | 0.38 | [0.2, 4] |

**The audit re-run** (`npm run audit`, the normal ideal, seed 1): 199.8 / 497.6 / 985.1 / 1,625 / 2,307 / 2,919 g on days
7 / 14 / 21 / 28 / 35 / 41 (1.03–1.057 × the table); water : feed 1.87 / 1.88 / 1.96 / 2.08 / 2.01 / 2.02 (the rows); uniformity
73 / 70 / 72 / 70 / 72 %, 68 % at the day-40 weighing; litter 21.9 / 24.2 / 26.4 / 26.6 / 29.8 / 31.0 %; NH3 at most 7.2 ppm;
day 18 15:00 panting 0.02; day 37 19:00 panting 0 (the evening line); heat-wave panting 2.4 bird-hours; gas to day 21 207 kg;
`blendFinH` 21 h; deaths by level 0.63 / 0.25 / 0.44 / 0.57 / 0.39 %, no dehydration at the catch; harvest 2,883 g live,
FCR 1.585, mortality 2.27 %, EPEF 426, DOA 0.10 %, withdrawal 10.9 h. The env's day-37 evening: three fans 96 / 78 / 53 /
27 % panting at 19 / 20 / 21 / 22:00, six fans 37 % at 19:00 and none by 21:00, six fans with the pads none.
**The conditions' ideals** (test-cond): hot ratio 4.83, day 14 497 g, day 35 2,292 g, harvest 2,875 g, no heat or cold death;
rainy day 21 964 g, the cut 0.05 % (10 min), harvest 2,868 g, EPEF 422; bad batch ratio 5.11, harvest 2,884 g; water tank
never under 90.6 %, the pump 2.40 / 2.11 bar at 06:15 on days 26 / 27, harvest 2,876 g. Speed (node, alone): a whole
cycle 2.5–3.1 s in every condition, a 24 h skip 62–91 ms, `farm.step` 0.02–0.07 ms.

**Integrator at the merge** (agreed: every band move above). Changes of its own, each measured:

| Change | Why | Effect / bands |
| --- | --- | --- |
| The hot season drops week 2's rainy spell (`CONDITIONS.hot.levels.week2.drop`) | 92 % outside air at 33–36 °C (the normal season's spell in the hot weather) is no April–May afternoon; the pad could not cool it and the play-through's 10-day-olds panted all day under the pad with one fan (felt 37.9 °C) | the pad with one fan holds them at their row (felt 30.2 °C, none panting, `h-young-heat` done); test-cond `hotYoungAsNormal` · `heatW2Pct` [3, ∞] → **[1, ∞]** (week 2 still fails: the level ends the day its deaths pass 1 %, at 1.2 % heat deaths) |
| The ideal re-checks the droppings of ten birds when abnormal deaths are found on days 19–21 and no cause is seen yet | the day-19 check can come before the blood shows (a dry floor): the water condition's standard start through level.js failed week 3 at 1.13 % | every condition's whole run passes through level.js goto(auto) (new test-run case); the normal ideal's trace unchanged (test-cycle) |
| The brooding week of goto(auto) plays the sim's `broodStopsCond` rounds with the condition's Phase 2 profile | the hot season's standard starts played the brooding week without the 11:00 pad | the level path's hot brooding week: the house 33.6 / 33.0 / 32.2 °C at 15:00 on days 1 / 3 / 6, ratio 4.87 |
| The young birds' panting threshold (2–3 weeks) | 1.5–2 °C under general practice (§2.8 row 6); raising it hides the week-3 warm afternoon's panting that the listen finds (three test-tuning references and Phase 3's day-16 play-through would move) | kept; open question 14.1 |

### 2.8 The audit as integrated (main after the Phase 4 merge)
`npm run audit` on the merged model (the normal ideal, seed 1), the conditions from `scripts/test-cond.mjs` and the env
references of `scripts/tuning-refs*.mjs`. Sources: a guide name for the facts of PHASE2.md §6.1 / PHASE3.md §5.1, else
general broiler practice for Ross / Cobb-type broilers in a Thai EVAP house (ranges, no page numbers). The integrator
agrees every band move of §2.7 (each is a measured value of the tuned model the sign lines describe).

| # | Quantity | The game (Phase 4, by age) | Reference (source) | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Body weight | 200 / 498 / 985 / 1,625 / 2,307 / 2,919 g on days 7 / 14 / 21 / 28 / 35 / 41 (1.03–1.057 × the table); day 7 4.87 × chick weight | the target table 190 / 480 / 950 / 1,550 / 2,200 / 2,850 g (general); day 7 4–5 × chick weight (Week 1 guide) | OK |
| 2 | FCR (cumulative) | 0.87 / 1.12 / 1.26 / 1.36 / 1.45 / 1.54; harvest 1.585 (paid kg) | about 0.85–0.9 / 1.05–1.15 / 1.25–1.3 / 1.4 / 1.5–1.55; 1.6–1.75 at 42 days (general) | OK |
| 3 | Feed intake | 37 / 70 / 120 / 152 / 177 / 194 g a bird a day = 96–98 % of the feed sign's figure for the age | the feed sign's table (general) | OK |
| 4 | Water : feed | 1.87 / 1.88 / 1.96 / 2.08 / 2.01 / 2.02 on the weigh rows; the hot day's row 1.99 well cooled, 2.10 with fans and no pads; the hot season's ideal 1.8–2.0 | about 1.8 while comfortable (drinker plate, general); 2–2.5 hot and panting, up to about 3 in a heat wave without cooling (general) | OK (follows the birds' heat, `waterPerKgP4`) |
| 5 | Target temperature | 34 °C day 1 → 20 °C day 35, the brooder sign's row; a bad batch's row + 1 °C on days 0–3 | the ends (Week 1 guide / Broiler Ventilation); +1 °C for small chicks (general) | OK |
| 6 | Panting (felt °C) | first birds / all: 24 / 28 °C at 5 weeks; about 26 / 30 °C at 4 weeks; about 27 / 31 °C at 3 weeks; about 29 / 33 °C at 2 weeks | about 24–26 °C for 5–6 week birds (the heat sign's 24 / 28 °C, general); 28–29 °C at 3 weeks and about 31 °C at 2 weeks (general) | OK for big birds (the sign's figures); **1.5–2 °C low at 2–3 weeks: kept** (the week-3 warm afternoon's problem, job and references rest on it; a raised threshold hides the panting the listen finds; open question 14.1) |
| 7 | Wind chill at 2.5 m/s | 7.5 / 7.0 / 6.5 / 6.0 / 5.5 °C on days 7 / 14 / 21 / 28 / 35 (30 °C air); 4.3 / 4.0 / 3.7 / 3.5 / 3.2 °C at 1.25 m/s; × 0.33 at 39 °C | 5–7 °C for market-age birds, more for young ones, little near 40 °C (general; the heat sign: 5–6 °C at 5 weeks, about 7 °C at 2 weeks) | OK (the sign's figures are the model's) |
| 8 | Temperature + humidity | the pads off over 90 % house RH; felt + about 1 / 2 / 4 °C at 87 / 90 / 95 % | the plan's limit; general | OK |
| 9 | Pad cooling | 0.69–0.82 of the rule; 3.8 °C at 30 °C 69 % (rainy) | about 1 °C per 5 % RH the air can still take up (Broiler Ventilation); most of it, never all (general) | OK |
| 10 | Minimum ventilation | 0.155 → 3.65 m³/h a bird (42 g → 3 kg); 3.7 → 1.2 m³/h per kg | the vent sign's table (Broiler Ventilation; numbers general) | OK |
| 11 | Litter moisture | 21.9 / 24.2 / 26.4 / 26.6 / 29.8 / 31.0 % on days 7–41; rainy day 21 about 33 %, the south strip 46 % with the flaps open | at or under 30 % (Broiler Ventilation) | OK (at the line on day 41 after the evening pads; no cake); the rainy season's wetter litter is its cost |
| 12 | Ammonia | at most 7.2 ppm (normal); rainy NH3 ≤ 18 ppm on the nights of week 3, `rainyNoStep` ≥ 25 | under 20–25 ppm, 5–15 in a well-run house (general) | OK |
| 13 | Deaths by level | 0.63 / 0.25 / 0.44 / 0.57 / 0.39 %; cycle 2.27 %; DOA 0.10 % | 2–4 % to 42 days, week 1 0.5–1.2 %, DOA 0.1–0.3 % (general) | OK |
| 14 | Dehydration at the catch | none (6 h without water before it counts, from day 21) | big birds do not die of thirst while the lines are up for the crew (general) | OK |
| 15 | Cold of older birds | 16-day-olds under the pad and six fans: a few deaths and a huddle (`padWeek3` 1–15 cold deaths) | chilled birds huddle and eat less before they die (general) | OK |
| 16 | Uniformity (±10 %) | 73 / 70 / 72 / 70 / 72 % on days 7–35, 68 % at the day-40 weighing; a bad batch 42–54 % on day 7 | 70–80 % as hatched with good care, lower at the end (general) | OK (low end) |
| 17 | Sudden death, legs | SDS 0.07 / 0.08 / 0.15 / 0.08 % by level with 4–6 h dark; leg culls 0.08–0.29 % | SDS 0.5–1.5 % without a dark period, much less with one; leg culls under 1 % (general) | OK |
| 18 | Harvest | 2,883 g live, FCR 1.585, mortality 2.27 %, EPEF 426, withdrawal 10.9 h; hot 2,875 g / 428; rainy 2,868 g / 422; bad batch 2,884 g / 425; water 2,876 g | Thai EVAP at 42 days: 2.6–3.0 kg, FCR 1.6–1.75, mortality 2–4 %, EPEF 350–450, the pans empty 8–12 h before the catch (general) | OK |
| 19 | The flock's own heat | a closed house of 5-week birds 28.8 °C at 05:00 on day 41 (minimum ventilation), the tunnel-air ideal 25.2 °C | about 5–6 W per kg of sensible heat at 2–3 kg (general) | OK |
| 20 | Gas to day 21 | 207 kg (normal); the hot season's brooding week about 60 % of the normal's | the gas plate's 200–300 kg (general) | OK |
| 21 | Day 37 evening | 3 fans 96 / 78 / 53 / 27 % panting at 19 / 20 / 21 / 22:00; 6 fans 37 % at 19:00, none by 21:00; 6 fans and the pads none (the ideal) | §2.4 | **Fixed**: the model (wind chill, ramp, flock heat) and the job (`night-comfort`: a quarter panting at most, or every fan and the pad while the outside is over 29.5 °C) with the heat sign's evening line |
| 22 | Heat-wave mistakes | fans without pads 20 % dead over the heat wave; minimum ventilation 59 % (env) | without evaporative cooling a 39 °C heat wave kills many big birds (general) | OK |
| 23 | Young birds, hot afternoon | day 16: the pad with one fan e +0.46 (handled), the pad with six fans e −5.3 (chilled, not handled) | as few fans as the heat allows; the pad with few fans (general) | OK |
| 24 | Hot season, brooding | the house 33.6 / 33.0 / 32.2 °C at 15:00 on days 1 / 3 / 6 under the pad and one fan (38 °C outside); the sign's timer alone 37.4–38.4 °C; ratio 4.83 | the chicks' row (the brooder sign); general | OK |
| 25 | Rainy season, the cut | 0.10 / 0.42 / 1.60 % dead after 10 / 30 / 120 min without fans in the storm (env); the ideal (10 min) 0.05 %; the play-through's walk from the fan panel inside the 11 farm minutes | the power sign's figures (general) | OK |
| 26 | Water problem, the tank | the pads 934 / 1,141 L an hour at 15:00 (days 25 / 31), the birds 110–131; the pump 2.40 / 2.11 bar at 06:15 on days 26 / 27; repaired: the tank never under 90 % | the water-tank plate's 700–1,200 / 100–150 L/h and 2.4 bar, 6 A (general) | OK |
| 27 | Bad batch | 36 g chicks, 4.5 % weak; graded and claimed: deaths + floor culls 0.58 %, ratio 5.11 × the measured weight; ungraded about 3.5 % | small chicks start slower; weak chicks left in the flock die and take others with them (general) | OK |

## 3. The conditions system

### 3.1 Offering and choosing (package "run")
- **Gate:** `skills profile.cyclesDone` (new field of the skill profile `chickenFarm.profile.v1`, kept across runs and
  replays, raised by 1 when a run reaches the cycle summary with every level passed; a Phase 3 profile without the field
  reads 0, or 1 if its stored `lastCycle` exists). `config.CONDITIONS[id].available` is the build switch (false until
  the run merge, then the integrator sets it true, as `earnable` in Phase 3).
- **Where:** the cycle summary and the title card's run card (*Harder flocks*, §1.2); every reached level row of the run
  card has a condition select and *Play from a standard start* (`run.startLevel(id, { from: 'standard', condition })`).
  A saved start replays with the condition it was saved under (the select shows it and is fixed for *Replay from day N*).
- **One condition per run, one place that holds it.** `run.startRun({ seed, at, condition })` (`condition` null = the
  normal season) and `farm.start(def, { condition })` put it on the farm: **`farm.condition` is the only holder** (saved
  with the farm, kept by `keepClock`, read by the job engine, `boardsForDay`, the HUD, the records and level.js).
  `run.state().condition` is a read-only mirror of `farm.condition` (the run save writes it so the run card can show a
  saved run's condition without loading the farm); nothing filters on the mirror.
- **A condition chosen on a level row is a new run.** `run.startLevel(id, { from: 'standard', condition })` with a
  condition other than the current run's starts a new run (a new run save, the old one is replaced as *New flock* does)
  whose earlier levels are the condition ideal's standard-start trace: the cycle summary marks them "from a standard start
  at Level N" and shows no compare column for them. The same condition as the run's keeps the run (Phase 3's standard
  start: the later starts are cleared). **`conditionsDone[id]`** rises only for a run played under one condition from the
  level the farmer started it at through the clean-out, every level passed; `cyclesDone` rises for any finished run.
  test-run: a weeks45 standard start in the rainy season from a normal run's run card makes a new run with
  `farm.condition === 'rainy'`, the summary marks levels 1–4 as a standard start, and `conditionsDone.rainy` rises at its end.
- **Standard starts under a condition** play the condition's ideal (`cycleProfileOf('ideal', { condition })`, §9.6) to
  the level's start, behind the busy card ("Getting the flock to day 22 in the hot season …").

### 3.2 How a condition changes a level (one function: `config.conditionLevel(def, condition)`)
`conditionLevel(def, id)` → `{ condition, problems, weather, target, fail, routineDays, cycleClimate, delivery }` (pure, in code):
the level def's problems with the condition's `drop`ped, `replace`d (fields merged) and added; its weather; target and
fail rules merged; the routine days the condition moves (e.g. `r-fans-pm` from day 8 in the hot season, carried into the
later levels); `cycleClimate` true from the condition's `cycleClimateFrom` level (the hot and rainy seasons: the
brooding week too: the outside air by its water content and the wet-bulb pad; the chicks' comfort stays Phase 2's);
`delivery` the brooding week's chick delivery of a bad batch (null = Phase 2's). The condition's daily sun is
`CONDITIONS[id].sun`. **Level defs are never changed and never compared by object**: the sim and run packages replace
every `def === LEVEL1` / `def === PLAN_LEVEL` that a condition can reach by `def.id === …` (43 places today, §12).
- The **farm** installs `conditionLevel(def, farm.condition).problems` (pending; the dropped ones end) with their weather
  events and the daily sun at `farm.start` / `farm.enterLevel` / `farm.setCondition`, sets the weather, and the cycle
  climate by `cycleClimate`. The stub does this now (src/farm-cond.js: the other packages can trigger and meet every
  condition problem on their branches: `farm.debug.trigger(id)`, `farm.debug.symptom(id)`).
- The **job engine** makes the level's jobs plus `JOBS_COND` whose `condition` is `farm.condition`; its problem ids are
  the merged ones (`problemIds()`), and the routine days follow `routineDays`. Phase 2's `warm-afternoon` problem job
  (`p-warm`) is not made where the condition drops the problem. `level.rebuildJobs()` (run) makes the level's jobs again
  for the farm's condition (`__game.setCondition` calls it).
- The **signs**: `boardsForDay(day, condition)` (content-signs-cycle.js; on main now, frozen) merges through
  `content-signs-cond.js mergeBoardsP4`: `BOARDS_COND` boards and plates and `BOARD_COND_ITEMS[condition]` lines in a run of
  that condition, and `BOARD_P4_ITEMS` in every run once `config.PHASE4.tunedSigns` (§2.5). `ui-boards.js` passes
  `farm.condition` to every plate and sign dialog (`setPlateCondition`, set by ui.js); a condition plate built with no
  condition on the farm reads its own board (the panels' harness runs). The 3D boards are repainted from the same merge
  (scene, §8.9).
- The **level end** uses the merged `target` / `fail`.

### 3.3 Records, notes and result screens
- The records book's header, each result screen's title and the cycle summary name the condition
  (`config.conditionLabel(id)`: "Hot season", … "Normal season" when null, shown only for a condition).
- `records` adds a row field `condition` (the farm's, on every row) and condition notes on the day's row (plain facts, from
  `EV.FARM_PROBLEM`, `EV.POWER`, `EV.ACTION`): "Storm 14:00–18:00", "Power cut 15:10–18:10; generator on at 15:20; mains
  back 18:10, generator stopped 18:16", "Rain in at the south inlets; storm flaps closed 15:40", "Heat wave: 41 °C at
  15:00", "Hot night: 30.5 °C at 23:00", "Chicks: 36.2 g, 4.4 % weak at grading; 238 graded out (claimed)", "Chick
  quality reported to the hatchery", "Well water: iron 1.2 mg/L", "Pump 2.1 bar, 6.4 A at 06:20; tank lowest 88 % at
  17:30", "Pump repaired 08:10–10:10".
- `records.cycleSummary({ plan, levels, condition, compare })` adds `condition` and, when the profile holds the farmer's
  last normal-season summary (`lastCycle` of a run without a condition), `compare: { sold, meanLiveG, fcr, epef,
  mortalityPct, deathsByLevel }` drawn beside the cycle's own numbers (plain numbers, no verdict); levels from a standard
  start carry `fromStandard: true` and no compare.

### 3.4 Pass and fail
The key targets of PHASE3.md §2.1 hold in every condition. Merged into the level by the condition (`fail`):
**a bad batch's brooding week** counts deaths and floor culls ≤ 2.5 % of the chicks placed, and the chicks culled on day 0
(at the grading table, or on the floor before 24:00) apart **when the hatchery is told on day 0** (`phone.hatchery`):
they are the hatchery's claim (`farm.flock.claimed`; the chick-grading plate and the chick sign say so). Without the call
by 24:00 of day 0 they count as culls of the level. The day 7 ratio is against the measured chick weight as in Phase 2
(≥ 4.0 ×). Every other limit is unchanged. Each condition is **winnable by good play** (its ideal passes every level, §4)
and **lost by poor play for a reason the records show** (each condition has at least one named mistake that fails a named
level on a measured number, §4).

## 4. The four conditions
Problems are `config.CONDITIONS[id].levels` (in code); jobs `content-jobs-cond.js JOBS_COND` (in code); sign lines
`content-signs-cond.js` (in code); milestones `skills-cond.js` (in code); the model is the sim package's (§9). Each
condition's **ideal** and **named mistakes** are profiles of `farm-profiles-cond.js` (sim, §9.6) with target bands in
`scripts/test-cond.mjs` (sim, §12.1). **Where the bands come from:** the climate and window numbers are measured now on
the env alone (`scripts/tuning-refs-cond.mjs`, in `npm test` through test-tuning: "env"); the farm-level numbers marked
"rough" were measured on the Phase 2 / 3 farm with the condition's weather, delivery or problems patched in for a design
check (`node scripts/design-rough-checks.mjs`, integrator, not in npm test; not the final model: the sim package confirms
them on its model and records any move in §2.7 with the integrator).
A band of a named mistake that fails keeps at least 0.5 points of margin on the limit it fails.

### 4.1 Hot season (`hot`) — April–May
**Weather.** Every level `hot`: 28–38 °C (Phase 1's `WEATHER.hot`), the day's water 22 g/m³ (about 80 % at 05:00, 47 % at
15:00, `OUTSIDE_WATER_GM3.hot`); the cycle climate from the prep day (the outside RH by its water content, the wet-bulb
pad); **the afternoon sun on the roof every day** (`CONDITIONS.hot.sun`: 1.5 °C an hour into the house air 11:00–17:00,
full 13:00–15:00, model), so a closed house runs 3–6 °C over the chicks' row by 15:00 and more outside air (38 °C)
only makes it hotter. The brooding week keeps Phase 2's chick comfort and wind chill.
**Model (sim).** *Line water*: each drinker line's water warms toward the house air + 2 °C (the lines hang under the
roof; time constant 2 h); a flush of that line of 2 farm minutes or more puts tank water in it (27 °C); the birds drink
× (1 − 0.015 × max(0, line °C − 30)) (model; the threshold is the drinker line's 30 °C); `farm.water.lineTempC` per line
(the water supply panel shows it). Box time costs 1.5 × in the brooding week's heat (the truck stands in 35 °C, model).
`heatHandled` never with the birds chilled, the pad with few fans allowed for young birds (§2.2 row 23). Everything else
is the Phase 4 model under hotter air.

| Level | Problem (config) | What changes | Job |
| --- | --- | --- | --- |
| brooding week | `warm-afternoon` dropped | the daily sun: every afternoon the closed house 3–6 °C over the row (env: e +3.1 / +4.8 / +6.2 at 15:00 on days 1 / 3 / 6) | `h-brood-air` days 1–7, 14:00–18:00 |
| week 2 | — (routine days) | `r-fans-pm` and `r-vent-night` from day 8 (`routineDays`); Phase 3's plan (no tunnel fans before day 14) leaves e +5.7 / +7.1 at 15:00 on days 9 / 12 | `h-young-heat` days 8–20; the fan panel check and the night ventilation from day 8 |
| week 3 | `warm-afternoon3` +2.5 °C, no sun of its own | about 40 °C on day 16 | `p-heat3` (the pad with two or three fans) |
| weeks 4–5 | `hot-afternoon` +1.5, `heat-wave` +3 (sun 0.5), `humid-heat` dropped, `hot-spell` d33 18:00 → d35 18:00 +2 °C | 39.5 °C on day 25; 41 °C days 30–32; 40 °C afternoons and 30 °C nights days 33–35 | `p-panting`, `p-heatwave`, the evening rule (`r-vent-night`) |
| finishing | `hot-finish` +2, no sun of its own | about 40 °C on day 38 | `p-panting-fin` |

| Job | When | Where | Done when | Branch |
| --- | --- | --- | --- | --- |
| `h-brood-air` *Keep the chicks' afternoon heat down* | days 1–7, 14:00–18:00 (pm round) | pad pump, then the fan panel | all: a `vent.pad` / `vent.fans` change, state `house-near-target` (Phase 2's: the chicks' comfort e within ±1.5 °C of the row for 30 farm min; with the pad and one fan e −1.0…−1.3) | comfort |
| `h-young-heat` *Keep the young birds' afternoon heat down* | days 8–20 pm | fan panel | all: a `vent.pad` / `vent.fans` change, state `heat-handled` (≤ 10 % panting, none chilled, 30 farm min) | ventilation |
| `h-flush` *Flush the warm water out of the drinker lines* | even days 22–40, 13:00–15:00 | water supply | all: `each water.flush` lines 0–3 with `on: true`, live `lines-cool` (every line ≤ 30 °C) | water |

Signs: `BOARD_COND_ITEMS.hot` (sign-brooder: the pad with one fan from day 1; sign-vent: the exception to "tunnel fans off
for young chicks"; sign-heat: young birds' pad and fans, the pads on while the outside is over about 30 °C, often all night;
drinker, pad-pump, sign-catch; all general). Records notes: the day's hottest outside reading the farmer took ("Outside
40.6 °C at 15:10, controller"), "Heat wave", "Hot night", the lines' water at the flush. Milestones: `hot-brood-air`,
`hot-nights`, `hot-wave`, `cool-water` (§7).

| Profile (sim) | Play | Expect |
| --- | --- | --- |
| `hot:ideal` | the Phase 4 ideal, plus: days 1–7 from 11:00 to 18:00 the pad with one tunnel fan (the timer on the sign's setting, the brooders by the sign: they burn only in the cool hours); days 8–20 from 11:00 to 20:00 the pad with one fan to day 11, two to day 17, three to day 20; from day 21 the fan plan (six fans, the pads while the outside is 10 °C over the target: in the hot season all night) with the evening rule; the flush at 13:30 on even days 22–40; catch booked for day 42 01:00 | every level passes · brooding week: ratio 4.5–4.95 (rough 4.68–4.83 over 4 seeds), deaths + culls ≤ 1.0 % (rough 0.60–0.62), heat deaths ≤ 0.05 % (env 0), gas to day 7 ≤ 60 % of the normal ideal's (rough 60 vs 135 kg) · week 2 heat deaths ≤ 0.05 % (env 0.002), day 14 ≥ 100 % of the target · week 3 heat deaths ≤ 0.1 % (env 0.03) · weeks 4–5 heat deaths ≤ 0.1 % (env 0), day 35 2,100–2,350 g · harvest 2,650–2,950 g, FCR 1.6–1.8, EPEF 330–420 |
| `hotNoBroodAir` | days 1–7 on the sign's timer only (no pad) | the brooding week **fails** on deaths: deaths + culls ≥ 2.0 % (rough 2.60–2.62 %, heat 2.0 %; env: heat deaths 1.08 %, e +4.8 / +6.2 at 15:00 on days 3 / 6), ratio 0.2–0.5 under `hot:ideal` (rough 4.40–4.53); `hot-brood-air` not earned |
| `hotYoungAsNormal` | days 8–20 Phase 3's plan (no tunnel fans before day 14, four fans and no pad after) | week 2 **fails** on deaths (heat deaths ≥ 3 % by day 14; env 7.4 % over days 8–15) |
| `hotNoPad` | the pads never from day 21 | weeks 4–5 **fails** by day 25 (heat deaths ≥ 2 %; env 2.3 % by day 24, 65 % over the level) |
| `hotNight3` | three fans and no pads from 18:30, days 28–41 | weeks 4–5 **fails** by day 31 (heat deaths ≥ 2 %; env 3.3 % by day 31, 5.6 % over the level) |
| `hotPadsTo21` | the normal season's evening line: the pads off at 21:00 from day 21 | passes; panting bird-hours of weeks 4–5 1.5–4 × `hot:ideal`'s (env 1.9 ×); heat deaths ≤ 0.1 % (env 0.015); `hot-nights` 2 points at most |
| `hotNoFlush` | no flush | passes; day 35 weight 0–2 % under `hot:ideal` (good cooling keeps the lines near 30–33 °C: the flush is worth little when the pads run, much when they do not); `cool-water` not earned |

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
*The generator* (`GENERATOR`): `gen.start` answers at once (the panel waited its 2-minute bar, §10.3): running if it has
fuel; it burns 15 L/h from 150 L (`farm.generator.hoursLeft` on the panel); empty, it stops; `gen.switch { to }` puts the
house on it or back on the mains; `gen.stop`; `gen.test` (the panel's 10-minute bar) `ok` when it starts with fuel. *The
house dark again* while the mains is off and the cut has been met (the generator ran dry or was stopped): the problem
`gen-dry` starts with its alarm (the job *The house is dark again*). *The clock*: while the house has no power the level
clock runs at `LEVEL1.clock.carry` (30; `GENERATOR.clockWhileDark`), and **every `EV.POWER { on: false }`** stops a
*Next job* skip and sounds the alarm banner, whatever the cause. *The pads* cool 2–4 °C in the damp air (physics,
unchanged); the normal season's heat problems do not come. *The minimum ventilation* (the vent sign's rainy line, the
ideal): every morning by the table, a quarter over it while the house reads over 80 % at dawn.

| Level | Problem | What changes | Symptom (farm) | Fixed when | Job |
| --- | --- | --- | --- | --- | --- |
| brooding week | `storm-5` | −4 °C, 98 % 14:00–18:00 | — (weather; the radio) | — | — |
| week 2 | `rainy-spell` rh 97, `storm-12` | damper spell; storm on the vaccine day (afternoon) | Phase 3's | Phase 3's | `p-damp` |
| week 3 | `storm-19`, `rain-in` | rain through the south inlets from 13:30 | `EV.NEAR` in the wet strip (zone x −12..12, z 5, dwell 2 s, minMoisture 35); a squeeze ≥ 35 % within it; a listen there ("rain blowing in at the inlets") | `inlets.storm { closed: true }` | `p-rain-in` → `p-rain-patch` |
| weeks 4–5 | `dusty-air`, `hot-afternoon`, `heat-wave`, `humid-heat` dropped; `storm-26`; `damp-spell` d29 07:00 → d31 18:00 (−2 °C, 97 %); `storm-33`; `power-cut` d33 15:10, mains back 18:10 (`alarm`); `mains-back` (only while the generator carries the house); `gen-dry` (`alarm`, any time the house goes dark again with the mains off) | the house dark at 15:10 | the cut itself (at once: the alarm, `EV.POWER { on: false }`; the skip stops) · `mains-back`: the mains returning while on the generator (the transfer switch's mains lamp) · `gen-dry`: at once | `power-on` · switched to the mains and the generator stopped · `power-on` | `p-power` (pinned), `p-power-back` (pinned), `p-gen-dry` (pinned), `p-damp2` |
| finishing | `hot-finish` dropped, `storm-39` | — | — | — | — |

| Job | When | Where | Done when | Branch |
| --- | --- | --- | --- | --- |
| `rn-gen-test` *Test-run the generator* | days 8, 15, 22, 29, 36 am | generator | `gen.test` → `{ ok: true }` | ventilation |
| `p-power` *The power is off: start the generator* | problem `power-cut` | generator | all: `gen.start` → `{ running: true }`, `gen.switch { to: 'generator' }`, live state `power-on` | ventilation |
| `p-power-back` *The mains is back: switch over and stop the generator* | problem `mains-back` (pinned) | generator | all: `gen.switch { to: 'mains' }`, `gen.stop` | ventilation |
| `p-gen-dry` *The house is dark again: the generator stopped* | problem `gen-dry` (pinned) | generator | all: `gen.start` → `{ running: true }` (after `gen.fuel` when empty), live `power-on` | ventilation |
| `p-rain-in` *Wet litter along the south wall after the storm: find what wets it* | problem `rain-in` | controller (Ventilation: the storm flaps) | `inlets.storm { closed: true }` | moisture |
| `p-rain-patch` *Put fresh litter on the wet strip by the south wall* | after `p-rain-in` | husk heap | `count litter.patch` n 3 with `result.onRain` (on the strip) | moisture |
| `p-damp2` *The air in the house feels damp again* | problem `damp-spell` | controller | all: a `vent.timer` / `vent.fans` change, `rh-under { max: 85 }` | moisture |
Signs: `BOARDS_COND['sign-power']` (3D board by the generator; the figures are the model's in the storm: §2.5), the
`generator` plate (fuel and hours), `BOARD_COND_ITEMS.rainy` (sign-vent, sign-litter, pad-pump, sign-health). Records
notes: storms, the power cut with its times, the flaps. Milestones: `gen-tested`, `gen-fast` (≤ 15 / ≤ 8 farm minutes from
the cut to the power back: at the dark-house clock the walk from the controller by the door, the 2-minute start and the
switch take about 5 farm minutes, from the fan panel 9–11), `storm-flaps`, `rain-litter`.

| Profile | Play | Expect |
| --- | --- | --- |
| `rainy:ideal` | the Phase 4 ideal; the timer by the table every morning of days 8–21 and × 1.25 while the house reads over 80 % at 06:00; the flaps closed at each storm's start and opened at its end; the generator tested weekly; on the cut: started and switched 10 farm minutes after it (from the controller), back to the mains at 18:15 | every level passes · day 21 ≥ 100 % of the target (rough 975 g, 102.7 %), litter mean at 15:00 on day 21 ≤ 33.5 % (rough 32.8), NH3 ≤ 18 ppm on the nights of days 15–21 (rough 14) and ≤ 20 on days 22–41 (rough 16) · power-cut deaths 0.05–0.3 % (env 0.10) · weeks 4–5 deaths + culls 0.5–1.3 % · harvest 2,750–3,000 g, EPEF 370–440 |
| `rainyNoGenerator` | the generator never started: the house dark from 15:10 until the mains at 18:10 | weeks 4–5 **fails** on day 33 (power-cut deaths ≥ 2.3 %, env 2.77; with the level's other deaths about 3.4 %, against 2.0 %); the record: "Power cut 15:10–18:10, no generator" |
| `rainyGenLate` | the generator started and switched 60 farm minutes after the cut | passes; power-cut deaths 0.5–1.0 % (env 0.70); `gen-fast` not earned |
| `rainyGenLeftOn` | after the mains returns the generator left running (p-power-back not done); it runs dry at about 01:20 of day 34; started again 20 farm minutes after the alarm | passes; the night cut's deaths ≤ 0.05 % (env: 30 min at night 0, 4 h 2.1 %: the alarm and the stopped skip are what save the flock) |
| `rainyNoStep` | the timer left at the day-8 setting, days 8–21 | passes week 3 with its costs on the records: litter ≥ 34 % at day 21 (rough 34.6), NH3 ≥ 25 ppm on the nights of days 17–21 (rough 33), day 21 3–6 % under `rainy:ideal` (rough 4.6 %); `minvent-w2`, `minvent-w3` and `litter-w3` not earned. The model has no wet-litter death strong enough to fail week 3 (§2.2 row 11) and none is added: the cost is the ammonia's intake and the weight |
| `rainyNoFlaps` | the storm flaps never closed | passes; the south strip ≥ 40 % after each storm (model); `storm-flaps` and `rain-litter` not earned |

### 4.3 A bad batch of chicks (`badChicks`)
**Weather and levels** as the normal season; the brooding week changes (the later levels carry the batch).
**Model (sim, all model values; `CONDITIONS.badChicks.levels.level1.delivery`).** The delivery: mean 36 g (± 1.5 g
between boxes, seeded; Phase 2: 41.5), CV 14 % (8 %), weak 4.5 % (0.8 %), red hocks 10 % (4 %); the truck comes at 10:00
(2 h late: `delivery.arrivalHour`; the job engine's `truck` anchor follows the delivery; the flock's age still counts from
08:00 day 0, `PLACEMENT_DAY`), the chicks 7 h on the road (the box hazard rises from 1 h after the truck stops, Phase 2: 3 h).
Late starters L from 0.05 (Phase 2: 0.02); a weak chick not culled dies with 45 % (35 %). *The small chicks start slower*:
their gain in their first 72 h on the floor × 0.85 (`gainK72h`). *Yolk-sac infection* (`infectionPerPctH`): while weak
chicks are in the flock (days 0–7) the others die at 0.0012 % an hour per 1 % of the flock that is weak (4.5 % ungraded:
about +0.9 % in the week; graded at the table, about +0.1 %) — the measured effect of grading beyond the count. *Grading*
(`chicks.grade { stack }`, at the chick table, a stack still in its boxes; the panel waits 6 farm minutes at the panel
clock, box time running on, then calls it): culls 90 % of that stack's weak chicks (seeded) into the cull box and answers
`{ stack, looked, weak, culled, minutes }`. *The claim*: chicks culled on day 0 (graded out, or culled on the floor before
24:00) go to `farm.flock.claimed` once `phone.hatchery` is made on day 0 (the hatchery's claim, not a death or cull of
the level); without the call by 24:00 they are culls of the level. *Feed trays and chick paper* (`brood.trays { on }`): to
day 4 the late-starter term −0.03 and the feed reach of the first 72 h +0.1. *Brooding 1 °C warmer*: `env.targetTemp` is
the sign's row + 1 °C on days 0–3 (`targetShiftC`, `shiftDays`; sim.js `env.setTargetShift(c)`), so the comfort, the job
strips, the readings and the comfort view agree; every place that prints the target labels it "the sign's row + 1 °C
(weak batch)" on those days. *The hatchery call* (ui `phone.hatchery { chickWeightG, weakPct }`): a record note and the claim.
Later: the batch's CV carries on (day 14 uniformity about 55–62 %), the small chicks a little lighter to the end.

| Level | Problem | Symptom (farm) | Fixed when | Job |
| --- | --- | --- | --- | --- |
| brooding week | `weak-batch` (day 0 10:00, starts with the delivery) | `sample.box` mean under 38 g; `sample.grade` with 2 or more weak of 10; a look at the chick table | 4 stacks graded and the hatchery told | `p-weak-batch` (pinned) |

| Job | When | Where | Done when | Branch |
| --- | --- | --- | --- | --- |
| `b-trays` *Put feed trays and chick paper by the brooders* | prep day | feeder box | `brood.trays { on: true }` | brooding |
| `p-weak-batch` *Many weak chicks in the boxes* | problem `weak-batch` | chick table (*Grade the stacks* tab) | all: `count chicks.grade` n 4, `phone.hatchery` | brooding |
| `b-warm` *Brood the small chicks 1 °C warmer* | day 0 06:00 → day 3 06:00 (window [6, 78]) | controller | live state `brood-warmer` (the thermostat 0.5–1.5 °C over the brooder sign's row) | heating |
| `b-crop48` *Check the crops again at 48 hours* | day 2 08:00–12:00 | any chicks | `count sample.crop` n 10, 3 sectors (Phase 2's crop rule) | brooding |
Signs: `BOARD_COND_ITEMS.badChicks` (sign-chicks: grade, the infection, warmer, the claim; sign-brooder), the
`chick-grading` plate. Records: the delivery note ("Chicks: parent flock 25 weeks, 7 h on the road"), the grading ("238
graded out, claimed from the hatchery" or "… not claimed: the hatchery was not told on day 0"), the call. Pass / fail:
§3.4. Milestones: `weak-graded`, `crop48`, `hatchery-told`, `bad-ratio` (≥ 4.4 / ≥ 4.7 ×).

| Profile | Play | Expect |
| --- | --- | --- |
| `bad:ideal` | Phase 2's ideal plus: trays on the prep day; the box weighed first (about 36 g); every stack graded before its tip; the hatchery called on day 0; thermostat at row + 1 °C days 0–3; the crop check at 48 h | every level passes · brooding week deaths + floor culls 0.4–1.4 % of the chicks placed (rough 0.54–0.59 % over 4 seeds before the infection term, which adds about 0.1), claimed 3.5–4.5 % of the delivery (rough 4.0–4.1), ratio 4.6–5.4 × the measured 36 g (rough 4.7 with the gain × 0.85 all week, 5.26–5.38 with none; the 72 h term lies between), day 7 uniformity 42–54 % (rough 48) · day 14 ≥ 95 % of the target · harvest 2,750–2,950 g, mortality 2.3–3.5 % of the chicks placed, EPEF 350–420 |
| `badNoGrade` | Phase 2's ideal only (no grading, trays or warmer brooding; the hatchery not told) | the brooding week **fails**: deaths + floor culls ≥ 3.0 % (rough 2.57–2.60 % before the infection term, about 3.5 % with it; weak deaths about 2 %, starve-outs 0.5 %) |
| `badNoCall` | `bad:ideal` without the call to the hatchery | the brooding week **fails**: the graded-out 4 % count as culls (deaths + culls 4–5.5 %); the result and the record name the missing call |
| `badNoTrays` | `bad:ideal` without the trays | passes; starve-outs 0.15–0.4 points over `bad:ideal` (rough 28–29 against 12–13 chicks: +0.25), ratio within 0.1 of it |

### 4.4 A water problem (`water`) — iron in the well water and an old well pump
**Weather and levels** as the normal season. The water test kit (Phase 3's `waterTest` unlock) is at the water supply
for this run.
**Model (sim).** *Iron* 1.2 mg/L in the well water from the prep day (`water.test` → `{ ph, chlorinePpm, ironMgL }`);
with it the main filter blocks again in the night before the flow-test mornings of days 12 and 24 (`iron-filter` 04:00,
Phase 2's blocked filter, flow factor 0.6: the same symptom by a flow test under 0.8 × the target or the filter gauges,
fixed by `water.clearFilter`), and at 04:00 on day 18 line 4's nipples clog (`iron-nipples`: that line's flow × 0.7 until
a flush of it of 2 farm min or more). The flow tests run on even mornings (content-jobs.js `FLOW_DAYS`), so each block is
found the morning it happens, away from the pump's days. *The tank* (`WATER_TANK`: 6 m³) feeds the drinker lines and the
pads: the pads draw 0.49 g per m³ of tunnel air per °C they cool, plus 10 % bleed (about 930 L an hour at 15:00 on day 25,
1,140 in the heat wave), the birds about 110–130 L an hour; the well pump fills it at 1.2 m³/h × `pumpShare` while it is
under 95 %. Under 20 % the line pressure falls (flow × clamp(level ÷ 20 %, 0.3, 1)); under 15 % the pad runs dry from the
far end (`env.padWorking` × clamp(level ÷ 15 %, 0, 1)). *The worn pump* (`pump-wear`, day 26 06:00): `pumpShare` −0.12 a
day, never under 0.25; its gauges read `WATER_TANK.pumpBar` × pumpShare bar and `pumpA` + 3 × (1 − pumpShare) A (2.11 bar,
6.4 A at 06:15 on day 27). `water.tank` reads `{ levelPct, lowPct, lowAt, pumpBar, pumpA, pumpOn }`: the marker (`lowPct`,
the lowest level since the last reading, and when) goes back to the level at each reading. *Symptoms* (the farm decides):
a `water.tank` reading with the pump at or under `WATER_TANK.wornBar` (2.2 bar: the plate's 2.4 less 0.2); the marker
under 30 % (`lowPct`); a flow test after 15:00 under 0.8 × the target with the tank under 20 %; `water.meter` 24 h litres
per 1,000 birds ≥ 5 % under yesterday's; a listen after 15:00 with the tank under 20 % ("birds crowding along the drinker
lines"). *The repair* (`pump.fix`): a farm process: it answers `{ started: true, worn, hours: 2 }` at once, the pump stops
for `WATER_TANK.repairH` (the tank alone feeds the house; `farm.waterTank.fixing`), then `pumpShare` 1 and the problem fixed.

| Level | Problem | Symptom (farm) | Fixed when | Job |
| --- | --- | --- | --- | --- |
| brooding week | `iron-water` (prep day 07:00, no event) | `water.test` reads it (the record) | — | `w-test` (day 1) |
| week 2 | `iron-filter` day 12 04:00 | a flow test under 0.8 × the target; the filter gauges out under 0.8 × in | `water.clearFilter` | `p-filter-again` |
| week 3 | `iron-nipples` day 18 04:00 (line 4) | a flow test of line 4 under 0.8 × the target | a flush of line 4 of 2 farm min, then its flow test within ±3 ml/min | `p-nipples` |
| weeks 4–5 | `iron-filter` day 24 04:00; `pump-wear` day 26 06:00 | the filter as week 2's · the pump's symptoms above | `water.clearFilter` · the repair done (live `pump-ok`) | `p-filter-again` · `p-pump` (pinned) |

| Job | When | Where | Done when | Branch |
| --- | --- | --- | --- | --- |
| `w-test` *Test the well water* | day 1, 08:00–18:00 | water supply | `water.test` | water |
| `w-tank` *Read the water tank and the well pump's gauges* | days 22–41 am | water tank (north-west of the house) | `water.tank` | water |
| `p-filter-again` *Low water flow again: find the cause* | problem `iron-filter` | water supply | `water.clearFilter` → fixed | water |
| `p-nipples` *One drinker line gives little water* | problem `iron-nipples` | drinker line 4 | all: `water.flush { line: 3, on: true }`, live `line-flow-ok { line: 3 }` | water |
| `p-pump` *The well pump gives less water* | problem `pump-wear` | water tank | all: `pump.fix` → `{ started: true }`, live `pump-ok` | water |
Signs: `BOARD_COND_ITEMS.water` (water-supply, sign-water), the `water-tank` plate (the pump in good order, the pads' and
the birds' draw, the marker). Records: the iron reading, the morning gauges ("Pump 2.1 bar, 6.4 A; tank lowest 88 % at
17:30"), the repair. Milestones: `iron-found`, `pump-found` (started before the marker first reads under 30 %), `tank-read`.

| Profile | Play | Expect |
| --- | --- | --- |
| `water:ideal` | the Phase 4 ideal plus: the water test on day 1; each filter found at the flow tests of days 12 and 24 and cleared that morning; line 4 flushed and tested on day 18; the tank and the pump read every morning from day 22; the pump repaired the first morning it reads 2.2 bar or less (day 27, 08:00–10:00) | every level passes · the tank never under 85 % (env 88.6) · weeks 4–5 heat deaths ≤ 0.05 % (env 0), deaths + culls ≤ 0.9 %, day 35 within 2 % of the normal ideal · `iron-found`, `pump-found`, `tank-read` earned |
| `waterPumpUnfixed` | the pump never repaired | weeks 4–5 **fails**: heat deaths ≥ 2 % by day 32 (env 3.4 % over the level, the tank under 2 % on days 30–32 and 57 hours under 20 %: the pad dry from the far end, the lines low); the records show the marker, the meter's fall and the crowding |
| `waterPumpLate` | no morning reading of the gauges; repaired the morning after the marker first reads under 30 % (day 31) | passes; the tank 8 % on day 30, 46 % on day 32, 26 hours under 20 %; heat deaths ≤ 0.3 % (env 0); day 35 0.5–4 % under `water:ideal` (the lines low); `pump-found` not earned |
| `waterFilterLate` | each iron filter found a day late | passes; day 14 weight 0.5–3 % under `water:ideal`; `iron-found` not earned |

## 5. The daily rounds by condition (PHASE3.md §3.3, every day)
The routine of PHASE3.md §3.3 holds in every condition, with these changes (`routineDays` and `JOBS_COND`):

| Condition | Morning | Afternoon | Evening / night |
| --- | --- | --- | --- |
| hot | — | days 1–7 `h-brood-air` (14:00–18:00); days 8–20 `h-young-heat`; `r-fans-pm` from day 8; even days 22–40 `h-flush` (13:00–15:00) | `r-vent-night` from day 8 |
| rainy | `rn-gen-test` on days 8, 15, 22, 29, 36 | — (storm days: the flaps, §4.2) | — |
| badChicks | — (day 0: the grading, the call, the warmer thermostat; day 2: the crops) | — | — |
| water | day 1 `w-test`; days 22–41 `w-tank` (the tank and the pump's gauges) | — | — |
Budget: a day stays under PHASE3.md's 4.5 real minutes (the hot season's pad visit on the brooding and young birds'
afternoons is one walk to the pad pump and the fan panel, about 40 s, and replaces the normal season's p-warm / r-fans-pm
visits; the flush is one panel visit, about 30 s, on every other day; the tank gauges one walk to the tower, about 40 s
on the morning walk west).

## 6. The clarity leftovers (the last check)
| # | Leftover | Fix | Package · files | Test |
| --- | --- | --- | --- | --- |
| 1 | The blue "on" toggle looks like the primary *Send this setting* key | A toggle that is on is a **lit switch**: pressed in, a dark face, its lamp lit, the state word in lamp yellow (`.key[aria-pressed="true"]`, `--switch-face`, `--switch-lamp`: in code in index.template.html); primary actions keep the blue (`key--apply`, `btn--go`). Remove `.fan-sw .key[aria-pressed="true"]` (blue) from ui-cycle-style.js; every toggle key sets `aria-pressed` | panels · ui-cycle-style.js, every panel with toggles | `p4-panels-clarity.json`: the computed background of a pressed toggle differs from `.key--apply`'s, and it has the lamp (`::before`) |
| 2 | At 960 × 600 the vent keys and the need are not on screen together | "This setting ≈ 960 m³/h = 103 % of the need (vent sign: about 900; 928 worked out for today's flock)" beside the keys (ui-climate.js `tAir`), from `job-figures ventNeed` | panels · ui-climate.js | `p4-panels-clarity.json` at 960 × 600: the line, the timer keys and *Send this setting* inside the viewport together |
| 3 | The Sign / Yours bar stops at full above the need | The vent row's bar is `{ v: share, band: VENT_BAND, max: 1.6 }` (90–130 % marked on the track; over 160 % an arrow) — the bar shape is in code (ui-jobstrip.js); the row's text adds "over the sign's 90–130 %" / "under the sign's 90–130 %" when outside it | run (job-strips.js ventRows) · panels (ui-jobstrip.js drawing) | test-jobs: the vent row's bar object at 70 / 110 / 170 %; the steps file shows the band marks |
| 4 | The ±3 ml/min flow band and the ±3 cm line-height band of the done rules are on no plate | Drinker and feeder plates: "give or take 3 ml/min" / "give or take 3 cm" (`BOARD_P4_ITEMS`, general, in code), merged by boardsForDay (on main) once `config.PHASE4.tunedSigns` | run · content-signs-cond.js (texts) | test-contracts (in code): the lines exist, are general, and show once each with the switch on |
| 5 | The prep-day vent row shows 928 m³/h beside the sign's "about 900" | The Sign column reads "about 900 m³/h (the sign's example: 6,000 chicks of 42 g)"; a line under it: "928 m³/h worked out: 155 per 1,000 at 42 g (the table's 150 at 40 g, a little more at 42 g); 90–130 % is 835–1,210 m³/h" | run · job-strips.js | test-jobs: the prep-vent strip rows hold "about 900" and "835–1,210" |
| 6 | `r-fans-pm` can show DONE over an unticked step | A strip shows as steps only the parts of its own job's rule; other jobs' parts (the afternoon walk of `r-walk-pm`) are plain lines; ui-jobstrip.js marks a strip done only when the engine says done **and** every step row is ticked | run · job-strips-cycle.js; panels · ui-jobstrip.js | test-jobs: the done `r-fans-pm` strip has no unticked step |
| 7 | `f-withdraw` taken before its window leaves the job stuck | Done on the outcome: state `feed-withdrawn` (`DONE_P4`, in code): the feed off when the window opens completes it (an early withdrawal shows in the harvest's withdrawal hours and weight) | run · content-jobs-cycle.js, job-engine.js | test-jobs: `feed.withdraw` at catch − 16 h, the job done at catch − 13 h |
| 8 | The feeder strip does not state the finished outcome per line | Each line row: "Line 1 · rim 5 cm · flood windows open · auger … · pans 96 % full", then "finished when: rim about 5 cm (7 at most), flood windows open, pans 95 % full" (prep-feeders; r-feeders from day 4: "rim at the plate's figure ± 3 cm, auger on, feed in the pans") | run · job-strips.js | test-jobs: the rows hold "finished when" with the three figures |
| 9 | `w3-change` / `w45-change` complete without the half-and-half day | Done all: state `blend-24h` (the augers drew 20–80 % new for at least 20 h of the change; `farm.stats.blendH` grower, new `blendFinH` finisher) and the pans 90 % new (`DONE_P4`, in code) | run · content-jobs-cycle.js, job-engine.js · sim · `farm.stats.blendFinH` | test-jobs (both feeds); test-cycle: the ideal's `blendFinH` ≥ 20 |
| 10 | `p-blood` does not count the medicine course | Done all: the vet, the medicine on, state `medicine-course` (medicine in the water on 3 calendar days counting the first: `farm.health.medication.daysOn` ≥ 3); the strip and job card read "medicine day 2 of 3" | run · content-jobs-cycle.js, job-engine.js · sim · `medication.daysOn` | test-jobs; test-cycle: the ideal's p-blood done on day 21 |
| 11 | ARCHITECTURE.md and ui-climate.js say the target temperature is only on the brooder sign | Corrected in this commit: the target is the brooder sign's row, shown as the sign's figure in the job strips, the job card readings, "Your week", the records' target column (unlock) and the summary's dashed line; never on the HUD or the LCD | integrator (done) | — |
| 12 | The heat sign's "felt" left out the damp (the review: about 1 °C off under the pads, several degrees in a power cut) | The fan panel's *Birds feel* readout is the model's felt temperature (`farm.comfort.feltMean`: the house less the wind chill plus the damp); the heat sign says "felt: the fan panel's Birds feel reading" and prints the damp part (about 1 / 2 / 4 °C at 87 / 90 / 95 %, `SIGN_FIGURES` damp-felt-*) | panels · ui-cycle-fans.js (the readout); run · the sign text (in code) | `p4-panels-clarity.json`: the readout equals `farm.comfort.feltMean` to 0.1 °C at 87 % RH |

## 7. Skill milestones (`src/skills-cond.js MILESTONES_COND`, in code)
Each condition adds milestones to the existing branches; they are evaluated only in a run of that condition (the farm's
condition rides on `EV.RUN level-start` and every checkpoint as `condition`; `skills.evaluate(checkpoint, ctx)` drops a
milestone whose `condition` differs), only rise, and show on the skill tree under their branch with the condition's name.
No new unlocks (every branch level already unlocks a tool or view, `config.UNLOCKS`). Points available:

| Condition | Milestones (branch, points) |
| --- | --- |
| hot | `hot-brood-air` (comfort 2) · `hot-nights` (comfort 2 / 3) · `hot-wave` (ventilation 2 / 3) · `cool-water` (water 1) |
| rainy | `gen-tested` (ventilation 1) · `gen-fast` (ventilation 2 / 3) · `storm-flaps` (moisture 2) · `rain-litter` (moisture 2 / 3) |
| badChicks | `weak-graded` (brooding 2 / 3) · `crop48` (brooding 1) · `hatchery-told` (planning 1) · `bad-ratio` (growth 2 / 3) |
| water | `iron-found` (water 2) · `pump-found` (water 2) · `tank-read` (water 1) |
Every threshold a tier names is a measured outcome its text states or a figure on the sign its job links (`gen-fast`
≤ 15 / ≤ 8 farm minutes at the dark-house clock; `bad-ratio` ≥ 4.4 / 4.7 ×; `pump-found` before the marker first reads
under 30 %; `iron-found` the filter cleared the day it blocked; `cool-water` 8 of the 10 flush days; `rain-litter`
≤ 34 / ≤ 32 %; `hot-brood-air` the chicks within ±1.5 °C of the row for ≥ 75 % of the 14:00–18:00 hours).
**A milestone that measures one problem is not evaluated where the level as the condition plays it lacks that problem**:
`needsProblem` (`skills-cycle.js NEEDS_PROBLEM` and `needsProblemOf(m)`, in code: `warm-timer` and `thermostat-off` need
`warm-afternoon`, dropped in the hot season; `heat-finish` `hot-finish` and `hot-first` `hot-afternoon` and
`dust-cleared` `dusty-air`, dropped in the rainy season; `pads-limit` `humid-heat`, dropped in both; every checkpoint
`heatwave` milestone needs `heat-wave`; and the rest of the single-problem milestones), so a dropped problem earns
nothing and costs nothing. `scripts/test-contracts.mjs` computes every branch's maximum in every condition from the merged
problems (in code now: the lowest is 13, rainy comfort and ventilation; level 2 is 9). **Each condition's ideal reaches
level 2 (9 points) in every branch** (`test-cond.mjs`, as Phase 3's `minBranchPoints`).
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
9. **The 3D boards' faces** are painted from `boardsForDay(day, farm.condition)` (the one merge, §3.2), not from the fixed
   `BOARDS_CYCLE`: repainted at every level start, at `farm.setCondition` (`EV.LEVEL { phase: 'condition' }`) and when
   `config.PHASE4.tunedSigns` changes, so a replaced line and the "N more facts" count follow the merge; `sign-power` only
   in the rainy season. The faces of a normal run with the switch off are byte-for-byte Phase 3's.
Budgets (as Phase 3): ≤ +1 ms per frame at 1,800 birds with the rain on; ≤ 40 extra draw calls and ≤ 60 k extra
triangles in the house view; every new material compiled in the warm-up (`renderer.info.programs.length` unchanged after
a tour of the four conditions).

## 9. The model work of Phase 4 (package "sim"; constants model unless general)
### 9.1 The tuning (§2.3) in the farm
`farm-tuning.js` (contract code, in code) wired in: `sim.js derive()` takes `windChillP4` from Week 2 (a new env flag the
farm sets with `farm.cyc.on`, e.g. `env.setWindChillP4(on)`; Phase 2's formula otherwise: the brooding week of every
condition, the sandbox digest and test-sim unchanged); `farm-house.js houseComfort` uses `pantShareP4`, `heatDeathRateP4`,
`heatIntakeP4`, `coldDeathRateP4` and exports `farm.comfort.pantFrom` (first birds) / `pantAll` beside `hotFrom` (the
scene's comfort view and the legend read `pantFrom`) and `feltMean` (the fan panel's *Birds feel*, the damp included);
`flockLoadsP4` for the flock's heat and breath from Week 2; `waterPerKgP4` for the water drunk (`farm.cyc.waterPerKg`);
`dehydrationAllowed` in the flock's dehydration rate; `TUNING.cvGrowthAfter14` in the CV growth. `heatHandled`
(farm-cycle-problems.js): never with the birds chilled (mean comfort under −1.5 °C); the `young && env.padOn` refusal goes
(test-cond: a 16-day-old flock with the pad and one fan on the hot afternoon is heat-handled, with the pad and six fans it
is not). Then test-cycle runs `scripts/tuning-refs.mjs`'s references (the Phase 3 ones retire) and CYCLE_TARGETS take
§2.6's bands; every change goes in §2.7 (the tuning log).
### 9.2 The conditions in the farm (`src/farm-cond.js`, replacing the stub; same state, actions and hooks, §10.4)
- `farm.start(def, { condition })` sets `farm.condition` (kept by `keepClock`, saved) and `farm.setCondition(id)` changes
  it on a running farm (the stub has both); the farm installs `config.conditionLevel(def, farm.condition)` everywhere it
  used `def.problems` / `farm.cycleLevel.problems` (problem states, weather events, the radio, zones, symptoms), sets the
  weather, the daily sun (`CONDITIONS[id].sun`: one weather event `sun-<day>` a day, heat only), and the cycle climate by
  `cycleClimate` (the hot and rainy seasons from the prep day: `env.setCycleClimate(true)`; the brooding week keeps Phase
  2's chick comfort and wind chill). Every `=== LEVEL1` / `=== PLAN_LEVEL` a condition run can reach becomes an id
  comparison (the level defs are never copied as new objects; the farm keeps `farm.level` / `farm.cycleLevel` as the
  config defs and reads the merged parts from `farm.levelFor(def)`).
- The Phase 2 problems (farm-problems.js) skip the ones the condition drops (`warm-afternoon` in the hot season).
- §4's models: the hot season's sun and line water (+2 °C under the roof, the 30 °C threshold), storms and the rain-in
  strip, the flaps, `env.powerOn` (sim.js: a new env field and `env.setPower(on)`; while false the env counts no fans,
  timer or pad and the lights are off; `heaterLevel` 0), the generator (fuel, `hoursLeft`, running dry → `gen-dry`), the
  delivery of a bad batch (`LEVEL1` fields read through `delivery`: chick weight, CV, weak share, red hocks, truck hour,
  box hours, late-starter base, weak death share, `gainK72h`, `infectionPerPctH`), grading, the claim with the call,
  trays, the target shift (`env.setTargetShift(c)`: `env.targetTemp` = the row + c on days 0–3), the iron, the tank, the
  pump, its gauges and the marker; each problem's symptoms and fixes of §4 through `farm.act` results, `EV.NEAR` zones,
  listens and its own state (only the farm decides a symptom, PHASE2.md §7); `alarm` problems emit their symptom at once
  with `alarm: true`; every `EV.POWER { on: false }` comes from the farm (the cut, the generator dry or stopped).
- `observe()` words (neutral): "rain drumming on the roof", "rain blowing in at the inlets", "the house is dark and
  still: no fans", "birds crowding along the drinker lines", "dry, firm droppings", "small chicks, many lying still";
  the radio's storm and hot-spell forecasts.
- Hooks (kept from the stub): `farm.debug.power(mainsOn)` (in a rainy run a cut is also the power-cut alarm symptom),
  `farm.debug.trigger(id)` for any merged problem, `farm.debug.symptom(id)` (EV.FARM_PROBLEM symptom, `alarm` for alarm
  problems), `farm.debug.set(path, value)`.
### 9.3 Records (`records*.js`)
Rows: `condition`; notes of §3.3; the harvest page's and the cycle summary's `condition`, `compare` and `fromStandard`
(§3.1, §3.3); `timeline()` rows add `outsideMaxC` (the hottest outside reading he took) and `powerOffMin` (minutes
without power that day). The profile store keeps `cyclesDone` and `conditionsDone` (`save.js`, the profile key).
### 9.4 Skills
`skills.js`: `ALL_MILESTONES` adds `MILESTONES_COND`; `evaluate()` keeps the level filter, drops a milestone whose
`condition` is not the checkpoint's `ctx.condition` (the farm's, carried by `EV.RUN` / `EV.LEVEL`) and skips one whose
`needsProblemOf(m)` is not among the merged problems of its level (`conditionLevel(levelById(m.level), ctx.condition)`);
new rules in `skills-rules-cond.js` for every `MILESTONES_COND` id.
### 9.5 Speed and save sizes
`farm.step` ≤ 0.5 ms, a 24 h skip ≤ 200 ms in every condition; a whole condition cycle ≤ 15 s in node; run saves and
level starts ≤ 250 KB (as Phase 3). **The time budgets are checked alone**: `npm run perf` (`scripts/test-perf.mjs`, in
code now: best of three, a calibration loop printed beside them; the sim package adds the four condition cycles and a
24 h skip in each); `npm test` measures and prints but does not fail on time (test-cycle asserts them only with
`--perf`), because a run that shares the 4 CPUs with Chromium or another branch's tests fails them by chance. test-cond
caches each condition's standard starts (as Phase 3's RANGE) and runs each named mistake from its own level only;
`node scripts/test-cond.mjs --quick` (what `npm test` runs) plays each ideal and one failing mistake per condition, the
full file the rest (the sim package's acceptance and the integrator's merge run).
### 9.6 Profiles (`src/farm-profiles-cond.js`, new; `farm-profiles-cycle.js` keeps the normal ones)
`cycleProfileOf(name, { condition })` and `runCycle(name, { seed, from, to, condition })` play a condition's ideal and
mistakes (§4) — the ideal's additions per condition are written in §4's profile tables, every one through `farm.act`
and the env setters at `cycleStops(fromDay, toDay, condition)` (the run's goto(auto) and standard starts call the same;
the hot season adds stops at 11:00, 13:30 and 20:00, the rainy season at each storm's start and end and at the cut).
The Phase 4 ideal of the normal season adds the evening rule (§2.6).
### 9.7 The tuning log
The sim package records in §2.7 every model constant it changes from §2.3 / §4 to reach the bands, with the reason (as
PHASE3.md §6.16). Design values already in code: `farm-tuning.js TUNING` (§2.3), `config.HEAT_P4`, `GENERATOR`,
`WATER_TANK`, `CONDITIONS` (the sun, the problems, the delivery), `OUTSIDE_WATER_GM3.hot` 22 (was 24: the hot season's
dawn 80 %, not 88 %).

## 10. Contracts between packages (in code now)
Shared, integrator-owned and **frozen** for the packages: `src/config.js` (the Phase 4 section after the third banner,
and `OUTSIDE_WATER_GM3`), `src/events.js`, `src/interact.js`, `src/main.js` (wiring, `__game` hooks), `build.mjs`,
`scripts/shoot.mjs`, `scripts/test-contracts.mjs`, `scripts/test-perf.mjs`, the bands of `scripts/tuning-refs.mjs` and
`scripts/tuning-refs-cond.mjs`, `scripts/test-tuning.mjs`'s checks, and the merge code of the signs
(`content-signs-cond.js mergeBoardsP4`, `content-signs-cycle.js boardsForDay`, `ui-boards.js` plate condition). Need a
change in a frozen file? Put it in your report; the integrator makes it.

### 10.1 What is in code now
| File | Owner | What it is now |
| --- | --- | --- |
| `src/config.js` (Phase 4) | integrator | `SPOTS4`, `HEAT_P4`, `GENERATOR` (with `clockWhileDark`), `WATER_TANK` (the tank, the pump's gauges, `wornBar`), `PHASE4` (`tunedSigns` build switch), `CONDITIONS` (four, `available: false`; the hot season's `sun`; the bad batch's `delivery` with `gainK72h`, `infectionPerPctH`, `targetShiftC`; the water condition's days), `CONDITION_IDS`, `conditionLabel`, `conditionLevel(def, id)`, `SIGN_FIGURES`; `OUTSIDE_WATER_GM3.hot` 22 |
| `src/farm-tuning.js` | sim (contract code) | `TUNING` and the Phase 4 responses (§2.3), `heatStateP4`, `flockLoadsP4`; not wired into the farm yet |
| `scripts/tuning-refs.mjs`, `scripts/tuning-refs-cond.mjs`, `scripts/test-tuning.mjs` | sim (code) · integrator (bands) | the Phase 4 climate references on the env alone (the normal season; the hot brooding week, the hot weeks 2–6, the rainy power cut, the water tank) and the sign figures' model side; pass now, in `npm test` |
| `scripts/tuning-audit.mjs` | sim | the audit of §2.2 (`npm run audit`) |
| `scripts/test-perf.mjs` | integrator | the time budgets, run alone (`npm run perf`, §9.5) |
| `scripts/design-rough-checks.mjs` | integrator | the rough farm checks behind §4's "rough" numbers (the hot brooding week, the rainy weeks 2–3, a bad batch), each part in its own process; not in npm test |
| `src/farm-cond.js` | sim | STUB: the state of §10.4, `farm.levelFor(def)`, `farm.setCondition(id)`, the merged problems installed at start / enterLevel / setCondition (dropped end, added wait, their weather and the sun), condition problems started at their hour, alarm ones with their symptom at once, the cut and the mains' return of the rainy season, the generator's fuel and `gen-dry`, the worn pump and its repair process, `farm.debug.power`, `farm.debug.symptom`; the actions of §10.3 with their final result shapes; `farm.act` routes here first (farm.js) |
| `src/content-jobs-cond.js` | run | `JOBS_COND`, `JOB_WHERE_COND`, `STATE_TEST_IDS_P4`, `DONE_P4` (the clarity rules); not in the engine yet |
| `src/content-signs-cond.js` | run (texts) · integrator (`mergeBoardsP4`) | `BOARD_P4_ITEMS`, `BOARD_COND_ITEMS`, `BOARDS_COND`, `BOARD_IDS_COND`; `mergeBoardsP4` (frozen), called by `boardsForDay` on main |
| `src/content-signs-cycle.js` (small) | run · integrator (`boardsForDay`) | `boardsForDay(day, condition)` merges the Phase 4 lines (condition lines in its run; tuned lines while `PHASE4.tunedSigns`) |
| `src/ui-boards.js` (small) | run | `setPlateCondition(fn)`, `plateCondition()`; plates and sign dialogs read the farm's condition; a condition plate with no condition reads its own board |
| `src/skills-cond.js` | sim | `MILESTONES_COND`, `condMaxPoints`; not evaluated yet |
| `src/skills-cycle.js` (small) | sim | `NEEDS_PROBLEM`, `needsProblemOf(m)` (data; skills.evaluate applies it from the sim merge) |
| `src/ui-cond-panels.js` | panels | STUB: `registerCondPanels(api)` (called by ui.js after the Phase 3 panels) registers placeholders for `generator`, `water-tank`, `chick-grading` that call the farm's actions |
| `src/props-cond.js` | scene | STUB: `buildCondScene(ctx)` (main.js builds it after the props, updates it each frame) registers the interactables `generator` and `water-tank` (enabled in their condition) |
| `src/run.js` (small) | run | `condition` in the run's state, serialize / restore and `startRun({ condition })` (not passed on to the farm yet) |
| `src/index.template.html` (small) | run | the lit-switch toggle style (`.key[aria-pressed="true"]`, `--switch-face`, `--switch-lamp`) |
| `src/ui-jobstrip.js` (small) | panels | a row's `bar` may be `{ v, band, max }` (the band marked, over-scale arrow) |
| `src/main.js` | integrator | `buildCondScene`, `__game.conditions()`, `__game.setCondition(id)` (farm.setCondition, then `level.rebuildJobs?.()`) |
| `scripts/test-contracts.mjs` | integrator | the Phase 4 checks: conditions and the merge, condition jobs resolve (actions, states, spots, signs, problems), every Phase 4 sign line general and verdict-free, every sign figure's whole text on its board, the merged boards without a line twice in any condition and day (and Phase 3's exactly with no condition and the switch off), `needsProblem` names real problems and every branch reaches level 2 in every condition, condition milestones well formed |

### 10.2 Events (`EV`, `src/events.js`)
New: `POWER` 'power' `{ on, source: 'mains' | 'generator' | null, mains }` (farm: the house's power changed; every `on:
false` stops a skip and sounds the alarm banner, §4.2). Changed payloads: `EV.RUN` and every `EV.LEVEL` checkpoint carry
`condition` (string | null) = `farm.condition`; `EV.FARM_PROBLEM` for `alarm` problems (`power-cut`, `gen-dry`) comes at
once with `{ phase: 'symptom', alarm: true }`; `EV.LEVEL { phase: 'condition', condition }` when `farm.setCondition` runs;
`EV.FARM_DELIVERY { kind: 'chicks' }` carries `truckHour` and `note` (the delivery ticket: "parent flock 25 weeks, 7 h on
the road").

### 10.3 Actions (Phase 4; `ACTION_IDS` in code)
**One rule for actions that take farm time.** Every farm action answers at once with its final result. A short wait
belongs to the panel: `gen.start` (2 farm min, `GENERATOR.startMin`), `gen.test` (10, `testMin`) and `chicks.grade` (6)
are a bar the panel runs at the panel clock with Phase 3's `machineJob` (ui-cycle-kit.js) and the steps hotfix's
`farmTimeNote` (ui-farmtime.js: a paused clock runs again, the bar finishes with the panel closed); at the bar's end the
panel calls the action and the farm acts at once. A long one is a farm process: `pump.fix` answers `{ started, worn, hours }`
at once, the farm keeps `farm.waterTank.fixing` for `WATER_TANK.repairH` farm hours, then fixes the problem; its job is
done on the live state `pump-ok`, never on a result that only the future knows.

| id | args | result | called by |
| --- | --- | --- | --- |
| `gen.start` | `{}` | `{ running, fuelL, hoursLeft }` (running at once if there is fuel; the panel waited its 2-minute bar) | generator panel (panels) |
| `gen.stop` | `{}` | `{ running: false, fuelL }` | generator panel |
| `gen.switch` | `{ to: 'generator' \| 'mains' }` | `{ on, source }` | generator panel (the transfer switch) |
| `gen.test` | `{}` | `{ ok, fuelL, minutes }` (after the panel's 10-minute bar) | generator panel |
| `gen.fuel` | `{}` | `{ fuelL }` (filled from the drum) | generator panel |
| `inlets.storm` | `{ closed }` | true | controller, Ventilation tab (panels) |
| `water.tank` | `{}` | `{ levelPct, lowPct, lowAt, pumpBar, pumpA, pumpOn }` (the marker back to the level after it) | water-tank panel (panels) |
| `pump.fix` | `{}` | `{ started, worn, hours }` (the repair: a farm process of `WATER_TANK.repairH` hours) | water-tank panel |
| `chicks.grade` | `{ stack }` | `{ stack, looked, weak, culled, minutes }` (after the panel's 6-minute bar) | chick table, *Grade the stacks* tab (panels) |
| `brood.trays` | `{ on }` | true | feeder box (panels) |
| `phone.hatchery` (ui) | `{ chickWeightG, weakPct }` | — | records book, Phone page (run) |
| `water.test` (Phase 3) | `{}` | adds `ironMgL` (the water condition) | water supply (panels) |
| `water.flowtest` (Phase 2) | `{ line }` | adds `waterC` (the line's water, the hot season) | drinker regulators (panels) |
| `litter.patch` (Phase 2) | `{ x, z }` | adds `onRain` (on the rain-in strip) | scene `patch` provider |

### 10.4 State other packages read
- `farm.condition` (the only holder); `farm.power { mains, on, source }`; `farm.generator { running, fuelL, hours,
  testedDay, startedAt, hoursLeft }`; `farm.weatherNow { rain, storm, id }`; `farm.house.flapsClosed`; `farm.waterTank {
  levelPct, lowPct, lowAt, pumpShare, fixing, fixUntil, fixedAt }`; `farm.brood { trays }`; `farm.flock.claimed`;
  `farm.water.lineTempC` (hot season, per line array); `farm.comfort.pantFrom`, `pantAll` (beside `hotFrom`),
  `feltMean`; `farm.health.medication.daysOn`; `farm.stats.blendFinH`; `farm.levelFor(def)` (= `conditionLevel(def,
  farm.condition)`).
- `env.powerOn` (sim, from the farm's power); `env.windChill` is the Phase 4 one from Week 2; `env.targetTemp` carries a
  bad batch's +1 °C on days 0–3.
- `run.state().condition` (a mirror of `farm.condition` for the run card); `skills.profile` `cyclesDone`, `conditionsDone`.

### 10.5 One owner, one signature (the hand-over points)
| Point | Owner | Signature / meaning |
| --- | --- | --- |
| A level as a condition plays it | integrator (config) | `conditionLevel(def, id)` → `{ condition, problems, weather, target, fail, routineDays, cycleClimate, delivery }`; levels compared by `id` |
| The condition | sim holds, run sets | `farm.condition` only: `farm.start(def, { condition })` (the run), `farm.setCondition(id)` (harness); everything reads it |
| Condition jobs into the engine | run | `JOBS_COND` filtered by `farm.condition`; `routineDays`; the merged problems; `level.rebuildJobs()` |
| The power | sim | `farm.power`, `env.powerOn`, `EV.POWER`; the actions `gen.*` (final results at once) |
| The alarm stops a skip | run (level.js skip) reads, sim emits | every `EV.POWER { on: false }` and every `EV.FARM_PROBLEM { phase: 'symptom', alarm: true }` |
| The dark-house clock | run (level.js) | `LEVEL1.clock[GENERATOR.clockWhileDark]` while `farm.power.on` is false |
| Timed actions | panels wait, sim acts | §10.3: the panel's bar, then the action; `pump.fix` a farm process with `pump-ok` |
| Condition panels | panels builds, run registers (ui.js) | `registerCondPanels(api)`, the PHASE3.md §13.9 api |
| Condition machines | scene registers, panels builds the panels | interactables `generator`, `water-tank` (`SPOTS4`) |
| Grading a bad batch | panels (tab), sim (action, claim), scene (cull box) | `chicks.grade { stack }`; `farm.flock.claimed` |
| Signs of a condition | integrator (merge code, on main), run (texts) | `boardsForDay(day, condition)` → `mergeBoardsP4` (the only merge); scene repaints from it |
| Sign figures | integrator (data), run (text), sim (model) | `SIGN_FIGURES` |
| The strip bar | run (data), panels (drawing) | `bar: number \| { v, band, max }` (ui-jobstrip.js) |
| The lit switch | run (template CSS), panels (uses it) | `.key[aria-pressed="true"]` |
| Condition milestones | sim | `MILESTONES_COND`, `ctx.condition`, `needsProblemOf` |
| Cycles done | run raises, sim stores | `skills profile.cyclesDone`, `conditionsDone` (§3.1) |

## 11. Save format, test hooks and harness scenarios
### 11.1 Save format
- Keys unchanged (`config.RUN_SAVE` v3, the level starts by id and day, the profile `chickenFarm.profile.v1`). New
  optional fields, read as null / 0 when absent (so every Phase 3 save loads unchanged): `run.serialize().condition` (the
  mirror); `farm.serialize().cond` (`{ condition, power, generator, waterTank, brood, flapsClosed, claimed }` in code; the
  sim adds the line water, the iron state and the pump's history); `env` save adds `powerOn` and the target shift;
  records rows `condition`; the skill profile `cyclesDone`, `conditionsDone`.
- A level start saved under a condition replays under it (the blob's farm carries it). A standard start under a
  condition clears the later starts as Phase 3's standard start does; a standard start under another condition is a new
  run (§3.1).
### 11.2 `window.__game` hooks
Phase 1–3 hooks, plus (in code now): `conditions()` (`{ id, label, available, summary, … }`), `setCondition(id)`
(`farm.setCondition`: the condition's problems, weather and sun on the running farm, problems whose hour has passed start
at once; then `level.rebuildJobs?.()`; for the other packages' harness runs: the run sets the condition at a start). Sim
(in code in the stub): `farm.debug.power(mainsOn)` (a rainy run's cut is the power-cut alarm), `farm.debug.trigger(id)`
(any merged problem), `farm.debug.symptom(id)` (`EV.FARM_PROBLEM` symptom, `alarm: true` for alarm problems),
`farm.debug.set(path, value)`. Run package: `startRun({ seed, at, condition })`, `startLevel({ level, from, seed,
condition })`, `level.rebuildJobs()`. A harness can show the tuned sign lines before the sim merge with
`__game.config.PHASE4.tunedSigns = true`.
### 11.3 Harness scenarios
The design run of this phase: `node scripts/shoot.mjs --scenario cold-hot --size 960x600` (no errors), `npm test`,
`npm run perf` (alone), `node scripts/design-rough-checks.mjs`, and `scripts/p4-design-stubs.json` (integrator, runs on the stubs now: the hooks, Phase 2's prep
day unchanged, a rainy storm window, a power cut by `farm.debug.power(false)` with its alarm symptom, the generator
placeholder's *Start* and *House on the generator* bringing the fans back, `setCondition('hot')` putting the sun on).
Package steps files: `scripts/p4-run-*.json`, `scripts/p4-panels-*.json`, `scripts/p4-scene-*.json` (§12). Integrator
play-throughs (generated by `scripts/p4-cycle-steps.mjs`, built on `p3-cycle-steps.mjs`): `p4-hot.json` (the hot
season from the brooding week's standard start: day 3 afternoon by real input — the pad pump on, one tunnel fan, the
chicks near their row —, day 10 afternoon — the young birds' pad —, day 31 by real input — the heat wave at the fan panel
and the pad pump, the evening rule at 18:00, the flush —, then `goto(auto)` to the cycle summary with "Hot season" on it),
`p4-rainy.json` (weeks 4–5's day-29 start: day 33 by real input — the storm, the flaps, the power cut at 15:10 met by
walking from the fan panel to the generator (the walk timed: ≤ 11 farm minutes to the power back at the dark-house
clock), started and switched, the mains back at 18:10, switched back and stopped —, the result of weeks 4–5),
`p4-bad.json` (the brooding week: the prep day's trays, day 0 by real input — the box weighed, four stacks graded, the
hatchery called, the thermostat at row + 1 °C —, `goto(7, 21, auto)`, the result against 36 g), `p4-water.json` (weeks
4–5 from day 22: the tank and the pump read each morning, day 27's 2.1 bar, the pump repaired by real input, the week's
result) and `p4-clarity.json` (the clarity items of §6 at 960 × 600).

## 12. Work packages (four, disjoint files, parallel worktrees)
Each engineer works in `git worktree add ../cf4-<key> -b phase4/<key> main`, edits **only the files listed** (new
files with the listed prefixes are theirs too), codes against the stubs and §10 (§10.5 has one owner and one signature
for every hand-over point), writes in chunks of ≤ 250 lines and commits after each working milestone, and keeps these
passing on the branch: `npm run build`, `npm test` (incl. `test-tuning.mjs`; the new `test-cond.mjs --quick` once sim
adds it), `node scripts/shoot.mjs --scenario cold-hot --size 960x600`, `--scenario p2-hooks`, `--steps
scripts/phase1-jobs.json`, `--steps scripts/p2-level1.json`, `--steps scripts/p3-design-stubs.json`, `--steps
scripts/p4-design-stubs.json` and `--steps scripts/hotfix-steps.json`. `npm run perf` runs alone (never beside a
browser or another branch's tests). Files no package lists stay frozen (`src/config.js`, `src/events.js`,
`src/interact.js`, `src/main.js`, `src/clock.js`, `src/round.js`, `build.mjs`, `scripts/shoot.mjs`,
`scripts/test-contracts.mjs`, `scripts/test-perf.mjs`, `scripts/p3-cycle-steps.mjs`, the `p2-*` / `p3-*` / `hotfix-*`
steps files, and the merge code named in §10). The machine renders WebGL in software (about 1–2 fps for the full game):
keep harness runs short (`--size 960x600`, `settle` / `advance`, `__game` hooks), reach any day in level mode with
`__game.cycleAt(day, hour)`, put a condition on the running farm with `__game.setCondition(id)` (the stub installs its
problems, weather and sun), meet a condition problem with `__game.farm.debug.symptom(id)`, cut the power with
`__game.farm.debug.power(false)`, show the tuned sign lines with `__game.config.PHASE4.tunedSigns = true`, and prefer
node tests for logic. What every package must know in one paragraph: **`farm.condition` is the only holder of the
condition** (null = the normal season); a level as a condition plays it is `config.conditionLevel(def, condition)`; no
condition means every Phase 1–3 number, board and view exactly as now; every Phase 4 sign line is general practice and
no text anywhere says correct / wrong.

### 12.1 `sim` — the tuned model, the conditions' model, records, skills, profiles (branch `phase4/sim`)
**Owns:** `src/sim.js`, `src/farm.js`, `src/farm-*.js` (incl. `farm-tuning.js`, `farm-cond.js`, new
`farm-profiles-cond.js`, `farm-cond-*.js`), `src/records.js`, `src/records-*.js`, `src/skills.js`, `src/skills-*.js`
(incl. `skills-cond.js`, `skills-cycle.js`'s `NEEDS_PROBLEM`, new `skills-rules-cond.js`), `src/save.js`,
`scripts/test-sim.mjs`, `scripts/test-cycle.mjs`, `scripts/cycle-refs.mjs`, `scripts/tuning-refs.mjs` and
`scripts/tuning-refs-cond.mjs` (code; bands with the integrator), `scripts/tuning-audit.mjs`, new `scripts/test-cond.mjs`.
Pure logic: no three.js, no DOM.
**Contract:** §2 (the tuning and the bands of §2.3 / §2.6), §4 (each condition's model, problems, symptoms, fixes and
profile bands, measured on the env alone in `tuning-refs-cond.mjs` and, where marked, by rough farm checks), §9, §10.2
(`EV.POWER` from the farm on every change; `alarm: true` on the symptoms of `power-cut` and `gen-dry`; `EV.LEVEL
{ phase: 'condition' }`), §10.3 (every farm action answers at once with its final result; `pump.fix` a farm process),
§10.4 (the state others read), §10.5, §11.1, §11.2 (the stub's hooks kept).
**Builds:** §9.1 the tuning wired in (`windChillP4` from Week 2 only; the brooding week keeps Phase 2's chick comfort and
wind chill in every condition; Phase 2's brooding week of a normal run byte-identical: test-sim's digest and profiles);
the `heatHandled` change (never with the birds chilled; the pad with few fans allowed for young birds; a test-cond case);
`farm.comfort.feltMean` (the damp included) and `pantFrom` / `pantAll`; §9.2 the conditions (replacing the farm-cond.js
stub with the same state, actions and hooks: `farm.setCondition`, `farm.debug.symptom`, the merged problems at start /
enterLevel / setCondition, the daily sun, `env.setPower`, `env.setTargetShift`, the generator's fuel and `gen-dry`, the
tank and the pump's gauges and marker, the claim with the call, the yolk-sac infection, `gainK72h`, the line water with
`waterC` on `water.flowtest`; every level-identity comparison in sim's files by id); §9.3 records (rows `condition`, the
notes of §3.3, `fromStandard`, `compare`); §9.4 skills (`ALL_MILESTONES` with `MILESTONES_COND`, the condition filter,
`needsProblemOf`, `cyclesDone`, `conditionsDone`); §9.6 profiles (every profile of §4's tables); test-cycle on the Phase 4
references with §2.6's bands and new snaps / profiles (`eveningPant37At19`, `dehydrationFinishPct`, `waterFeedHotDay`
[1.8, 2.0] for the ideal and [2.1, 2.7] for fansNoPad, `intake33UnderIdealPct`, `gasKgTo21`, `eveningFans3`, `padYoung1`);
the clarity state the run package's rules read (`stats.blendFinH`, `medication.daysOn`); the condition cycles and a 24 h
skip in each added to `npm run perf`'s list (report them; the integrator adds them to the frozen test-perf.mjs); the audit
table re-run after tuning (`npm run audit`, numbers into §2.7). Ask the integrator at the merge to set
`config.PHASE4.tunedSigns = true` (the tuned model and its sign lines go live together).
**Acceptance:** `node scripts/test-sim.mjs` (Phase 2 unchanged); `node scripts/test-tuning.mjs` (unchanged bands);
`node scripts/test-cycle.mjs` with the Phase 4 references and bands (every normal profile; the ideal: every level, the
evening, uniformity 68–76 %, no dehydration in finishing, water : feed 1.8–2.0 on day 25, gas to day 21 200–300 kg, every
branch ≥ 9); new `node scripts/test-cond.mjs` (and `--quick`): for each condition its ideal passes every level and
reaches level 2 in every branch with `needsProblem` applied, each named mistake of §4 fails its level with its margin (or
passes with its band), the farm's numbers at the reference hours inside `tuning-refs-cond.mjs`'s bands (the hot brooding
week's e at 15:00 days 1 / 3 / 6, the hot week 2 / week 3 windows, the rainy cut's deaths by minutes, the tank's minima
and the pump's 06:15 pressure on days 26 / 27), determinism (two seed-7 runs of `hot:ideal` identical), restore →
serialize identical for a level start under each condition, every Phase 4 action answers with its §10.3 result shape at
once, a power cut by `farm.debug.power(false)` stops the fans and `gen.start` + `gen.switch` bring them back, the
generator left on runs dry about 10 h after its start and `gen-dry` comes with its alarm, the storms' rain on their days,
`pump.fix` → `fixing` for 2 farm hours then `pumpShare` 1 and the problem fixed, a bad batch's grading counted as claimed
only with a day-0 call, `heatHandled` true for 16-day-olds with the pad and one fan on the hot afternoon; `npm run perf`
alone within its budgets; `grep -iE "correct|wrong|well done|good job|mistake|perfect|excellent"` in the player-facing
texts of `src/records*.js src/skills*.js` finds nothing; §2.7 filled.

### 12.2 `run` — conditions in the run, jobs, signs, the core UI, the clarity rules (branch `phase4/run`)
**Owns:** `src/level.js`, `src/run.js`, `src/job-engine.js`, `src/job-figures.js`, `src/job-strips.js`,
`src/job-strips-cycle.js`, `src/job-next.js`, `src/content.js`, `src/content-jobs.js`, `src/content-jobs-cycle.js`,
`src/content-jobs-cond.js`, `src/content-signs.js`, the texts of `src/content-signs-cycle.js` and
`src/content-signs-cond.js` (not `boardsForDay` / `mergeBoardsP4`), `src/ui.js`, `src/ui-title.js`, `src/ui-jobs.js`,
`src/ui-hud.js`, `src/ui-result.js`, `src/ui-records.js`, `src/ui-notebook.js`, `src/ui-skilltree.js`, `src/ui-format.js`,
`src/ui-caption.js`, `src/ui-marker.js`, `src/ui-help.js`, `src/ui-panels.js`, `src/ui-boards.js` (not the plate
condition code), `src/ui-farmtime.js`, `src/ui-dom.js`, `src/ui-icons.js`, `src/ui-run.js`, `src/ui-summary.js`,
`src/ui-letters.js`, `src/index.template.html`, `scripts/test-jobs.mjs`, `scripts/test-level.mjs`, `scripts/test-run.mjs`,
`scripts/p4-run-*.json`. The sandbox files `ui-tasks.js`, `ui-testtools.js`, `ui-controller.js` stay untouched.
**Contract:** §3 (offering, choosing, a condition from a level row is a new run, the merge, records and result labels,
pass / fail with the day-0 claim), §4's job tables and signs, §5, §6 items 3–10 and 12 (the sign text), §7 (checkpoints
carry `condition` = `farm.condition`; the skill tree shows condition milestones), §10.3 (the timed-action rule: the
panel waits, the job reads the result or `pump-ok`), §10.5, §11.2 hooks.
**Builds:** `run.startRun({ condition })` / `startLevel(id, { from, condition })` / replays carrying the condition through
`farm.start(def, { condition })` (never a second holder: `run.state().condition` mirrors `farm.condition`); a condition
start from a level row of another condition's run as a new run (§3.1, `fromStandard` on the summary, `conditionsDone`
only for a run played under one condition from its start level); standard starts under a condition (sim's
`cycleStops(…, condition)` + `applyCycleRound` with the condition's ideal); the gate (`cyclesDone`) and raising it at the
cycle's end; level.js and job-engine.js reading `conditionLevel(def, farm.condition)` (problem ids, routine days,
target / fail) and every `=== LEVEL1` / `=== PLAN_LEVEL` in its files by id; `level.rebuildJobs()` (the jobs again for
the farm's condition: `__game.setCondition` calls it); `JOBS_COND` (by `farm.condition`) and `DONE_P4` into the content,
the new state tests `STATE_TEST_IDS_P4` (incl. the re-defined `night-comfort` of §2.4, `rh-under { max }`, `pump-ok`,
`lines-cool`); **the skip stops at every `EV.POWER { on: false }` and every `alarm` symptom**, and the alarm banner shows
then; **the dark-house clock** (`LEVEL1.clock[GENERATOR.clockWhileDark]` while `farm.power.on` is false); the strips of
§6 (3, 5, 6, 7, 8, 9, 10) and the condition jobs' strips (the pump's reading against the plate's 2.4 bar / 6 A, the
marker, the line water against 30 °C, "the sign's row + 1 °C (weak batch)" on days 0–3 of a bad batch, the generator's
hours of fuel); the sign texts of `content-signs-cond.js` may be reworded (every `SIGN_FIGURES` text kept whole); the UI
of §1.2 / §3.3 (title and run card *Harder flocks*, the level rows' condition select, the HUD tag, the records book and
result headers, the cycle summary's condition, compare and standard-start marks, the phone's *Call the hatchery*); the
skill tree's condition milestones; at the merge ask the integrator to set every `CONDITIONS[id].available` true.
**Acceptance:** `node scripts/test-jobs.mjs` (Phase 2 / 3 cases unchanged except the four `DONE_P4` jobs; new: a
condition job made only in its condition, `routineDays`, a dropped problem makes no job, a skip stopped by an
`EV.POWER { on: false }` with no alarm problem (the generator left on all night: the skip stops at its cut), each new
state test on a farm with fields set (`pump-ok` false while `fixing`), `p-pump` done only once the repair has ended,
`p-power` done on the immediate `gen.start` result, `h-brood-air` not done by a timer change with the chicks still hot,
`f-withdraw` early, the half-and-half, the medicine course, `r-fans-pm`'s strip has no unticked step when done, the vent
bar objects, the prep vent row's "about 900", the feeder rows' "finished when"); `node scripts/test-run.mjs` (Phase 3
cases; new: `startRun({ condition: 'hot' })` puts it on the farm and the run save, a replay keeps it, a standard start
of `weeks45` in the rainy season reaches day 22 06:00 in ≤ 8 s with `farm.condition === 'rainy'`, the same from a normal
run's level row makes a new run (summary marks, `conditionsDone`), the gate shut before a full cycle and open after);
`node scripts/test-level.mjs`; `grep` of verdict words in `src/ui*.js src/content*.js` finds nothing. Harness:
`p4-run-conditions.json` (the run card before and after a cycle — `__game.skills` profile `cyclesDone` set — the four
cards, *Start a new flock in the hot season* → planning day 07:00 with "Hot season" on the HUD; a level row's condition
select → a new run's standard start), `p4-run-power.json` (`cycleAt(33, 15)` + `setCondition('rainy')` +
`farm.debug.power(false)`: the alarm banner, the clock at carry speed, `p-power` pinned, a *Next job* skip refused while
dark), `p4-run-ui.json` (records header, result title and summary with the condition at 960 × 600, no sideways scroll).

### 12.3 `panels` — the conditions' panels and the clarity of the machine panels (branch `phase4/panels`)
**Owns:** `src/ui-climate.js`, `src/ui-water.js`, `src/ui-equipment.js`, `src/ui-inspect.js`, `src/ui-jobstrip.js`,
`src/ui-cycle-*.js`, `src/ui-cond-panels.js`, new `src/ui-cond-*.js`, `scripts/p4-panels-*.json`.
**Contract:** the panels api (PHASE3.md §13.9; `registerCondPanels` called by ui.js), §10.3 (the actions it calls with
their args, and the timed-action rule: **the panel runs the short waits** — `gen.start` 2 farm minutes, `gen.test` 10,
`chicks.grade` 6 — as a bar at the panel clock with `machineJob` (ui-cycle-kit.js) and `farmTimeNote` (ui-farmtime.js),
then calls the action, which answers at once; `pump.fix` starts a 2-hour farm process the panel shows from
`farm.waterTank.fixing` / `fixUntil`), §10.4 (the state it shows), §6 items 1, 2, 3 (drawing), 6 (the done mark), 12 (the
*Birds feel* readout), the plates of `BOARDS_COND` with sources in small text (`api.plate(id)` / `buildPlate(id)` read the
merged board for `farm.condition`; with no condition a condition plate reads its own board, so a panel built in a
harness never throws), clock classes as Phase 2 (`sign` while a plate is unfolded, `panel` otherwise).
**Builds:** panels `generator` (the fuel gauge and the hours of fuel left (`farm.generator.hoursLeft`), *Start the
generator* (the 2-minute bar, then `gen.start`), the transfer switch *House on: mains / generator* as one lit switch pair,
*Stop*, *Test run* (the 10-minute bar, then `gen.test`), *Fill the fuel tank*; the mains' state lamp; the plate),
`water-tank` (the tank's level as a sight gauge with its low marker (`lowPct`, `lowAt`), the pump's pressure and current
beside the plate's 2.4 bar / 6 A, run hours; *Read the gauges* (`water.tank`), *Repair the pump* (`pump.fix`; the repair's
2 farm hours shown from `fixing` / `fixUntil`; the panel may close while it runs); the plate), `chick-grading` (the
stacks still in their boxes, *Grade this stack* (the 6-minute bar, then `chicks.grade`), the weak counted per stack, the
total graded out and whether it is claimed (the hatchery told today); the plate) opened from the chick table panel's
*Grade the stacks* tab (ui-inspect.js) in a bad batch; the controller's Ventilation tab *Storm flaps on the south inlets*
(a lit switch; rainy season); the feeder box's *Feed trays and chick paper* (a bad batch, days −1..3); the water supply's
test kit for the water condition and `ironMgL`, and each line's water temperature (`farm.water.lineTempC`, the hot
season); the fan panel's *Birds feel* readout = `farm.comfort.feltMean` (the damp included; until the sim merge
`env.feelsLike` + `humidityTerm`); the clarity of §6: the lit switch on every toggle (remove the blue `.fan-sw` override),
the vent line with the need ("vent sign: about 900; 928 worked out for today's flock", §6.2), the strip bar's band and
the done mark (§6.3, §6.6).
**Acceptance:** harness steps with `expect`: `p4-panels-cond.json` (`cycleAt(33, 15)`, `setCondition('rainy')`,
`farm.debug.power(false)`, open `generator` → *Start* → the bar → `gen.start` on the bus after it → *House on the
generator* → `farm.power.on === true`, the fans set before the cut running again (`env.fansManual` as before), the hours
of fuel shown; `setCondition('water')`, open `water-tank` → *Read the gauges* → the bus saw `water.tank` and the gauge
shows the marker; *Repair the pump* → `pump.fix` → the panel shows the repair running; `startLevel({ seed: 1 })` +
`setCondition('badChicks')` at the truck: the chick table's *Grade the stacks* → the bar → `chicks.grade { stack: 0 }`),
`p4-panels-clarity.json` (at 960 × 600: a pressed toggle's computed background differs from the apply key's and has its
lamp; the controller's Ventilation tab shows the timer keys, *Send this setting* and "% of the need" inside the viewport;
a strip bar with `{ v: 1.7, band, max: 1.6 }` draws the band and the arrow; the *Birds feel* readout at 87 % house RH
within 0.1 °C of the model's), shots of every new panel reviewed (no sideways scroll, plate sources readable, no verdict
colours); `grep` of verdict words in `src/ui*.js` finds nothing.

### 12.4 `scene` — rain, the power cut, the machines, the conditions' looks (branch `phase4/scene`)
**Owns:** `src/props.js`, `src/props-*.js` (incl. `props-cond.js`), `src/house.js`, `src/house-*.js`, `src/world.js`,
`src/world-*.js`, `src/player.js`, `src/player-*.js`, `src/flock.js`, `src/flock-*.js`, `scripts/p4-scene-*.json`.
**Contract:** §8 (items 1–9); the interactables `generator`, `water-tank` (ids, `SPOTS4`, priority 10, enabled in their
condition: `farm.condition`); reads the state of §10.4, `EV.POWER` and `EV.LEVEL { phase: 'condition' }`; the 3D boards
painted from `boardsForDay(day, farm.condition)` (the one merge; `sign-power` only in the rainy season);
`farm.comfort.pantFrom` for the comfort view's warm side (replacing `hotFrom`, PHASE3.md review fix) once sim exports it
(fall back to `hotFrom − 1.5`).
**Builds:** §8 items 1–9 (item 9: the board faces repainted from the merge at every level start, at a condition change
and when `config.PHASE4.tunedSigns` changes; a normal run with the switch off byte-for-byte Phase 3's faces).
**Acceptance:** against the stubs (`cycleAt`, `setCondition`, `farm.debug.power`; rain: `cycleAt(26, 15)` with
`setCondition('rainy')` (the stub rains in storm-26's window), or `farm.debug.set('weatherNow.rain', 1)` with no condition;
`farm.debug.set('waterTank.levelPct', 20)`, `farm.debug.set('waterTank.lowPct', 12)`, `farm.debug.set('brood.trays', true)`):
`p4-scene-look.json` shots reviewed — rain over the farm and inside the house view, a lightning frame, the dark house in a
power cut with the alarm lamp, the generator running, the tank's gauge at 20 % with its marker, the storm flaps closed,
the hot season's dry look, a bad batch's boxes and trays, the sign-power board — and `p4-scene-events.json` with
`expect`: power off → every fan rotor still within 4 s, the house lights off; power on → rotors turning; E at
`SPOTS4.generator` in a rainy run opens `generator`, nowhere in a normal run; rain off → no rain instances drawn; the
sign-heat board's face text changes when `__game.config.PHASE4.tunedSigns` is set and the level restarts; perf with the
rain on ≤ +1 ms a frame at 1,800 birds; ≤ 40 extra draw calls and ≤ 60 k triangles in the house view;
`renderer.info.programs.length` unchanged after a tour of the four conditions; the Phase 1 `tour` shots unchanged in the
sandbox.

## 13. Integration order
1. `sim` (pure; test-cycle and test-cond run on main); the integrator sets `config.PHASE4.tunedSigns = true` with it and
adds the condition cycles to `scripts/test-perf.mjs`. 2. `scene` and `panels` (either order). 3. `run` last (it starts
runs under a condition, makes the jobs, stops the skips at the power). After each merge: `npm run build`, `npm test`,
`npm run perf` (alone), `cold-hot`, `tour`, `phase1-jobs`, `p2-hooks`, `p2-level1.json`, `p3-cycle.json`,
`p3-replay.json`, `hotfix-steps.json` and the merged packages' steps files. Then the integrator sets
`CONDITIONS[id].available` true, writes `scripts/p4-cycle-steps.mjs` and runs the four condition play-throughs of §11.3
and `p4-clarity.json` by real input, re-times the real-input days (≤ 4.5 minutes each), updates `p3-cycle.json`'s day-37
night round for the evening rule (§2.6) and writes ARCHITECTURE.md ("Phase 4 — as integrated").

## 14. Open questions for the farmer
1. **Moving air (§2.2 row 7):** we now say birds of 5 weeks feel about 5–6 °C cooler at 2.5 m/s and birds of 2 weeks
   about 7 °C, and that moving air helps little once the house is near 40 °C. Does that match your houses? Do your big
   birds start to pant at about 24 °C felt (the fan panel's *Birds feel*: the house less the wind chill, plus about 1 °C
   in damp air at 87 % humidity) and all pant by about 28 °C?
2. **Warm evenings (§2.4):** do you keep the pads running into the evening for big birds, and until when (we say every
   fan and the pads while the outside air is over about 30 °C, until about 21:00, then tunnel air all night; in the hot
   season often all night)?
3. **The temperature + humidity limit:** still one number, the pads off over about 90 % house humidity (PHASE3.md
   question 6)? Or do you use a sum of temperature and humidity?
4. **Water in the heat:** do your meters show about 1.8 L of water per kg of feed while the birds are comfortable, even
   on hot days when the pads keep them cool, and 2–2.5 only when they are hot and panting? Do you flush the warm water out
   of the lines in April and May, and does the water in your lines pass 30 °C?
5. **The hot season's brooding (§4.1):** with 37–38 °C afternoons and the sun on the roof, do you run the cooling pad with
   one tunnel fan for chicks from the first day (the brooders then burn only at night)? We say two fans chill them, and
   that from day 8 the young birds want the pad with one fan, then two or three in week 3. Is that your practice, or do
   you cool the brooding end another way (fogging, a part of the pad, curtains)?
6. **The rainy season (§4.2):** storms about once a week? Do your side-wall inlets have storm flaps? How often does the
   power go, and for how long? Is your generator switched by hand or by an automatic transfer switch (an automatic one
   would make the generator job a check, not a walk)? In the storm's damp air our big birds start dying within minutes
   without fans (about 1 in 1,000 in 10 minutes, 4 in 1,000 in half an hour, one or two in every hundred in two hours): is
   that what you have seen? Should the cut come in the storm (as now) or in a dry hot hour?
7. **A bad batch (§4.3):** what tells you a batch is weak (we say under about 38 g, many open navels and slow
   reflexes)? Do you grade and cull at placement, and does the hatchery credit the culled chicks only when you call the
   same day (we count them apart only then)? Is 2.5 % the right first-week limit for such a batch, and 1 °C warmer for 3
   days your practice? Do weak chicks left in the flock take others with them (we model yolk-sac infection)?
8. **Water (§4.4):** is iron in well water a problem in your area (we say about 1.2 mg/L; over about 0.3 clogs the
   filter and the nipples)? Do the pads and the drinker lines draw on one tank? How big is your tank and pump, what do its
   gauges read in good order (we say 2.4 bar, 6 A), and how do you first notice a pump that is wearing out?
9. **The flock's own heat (§2.2 row 19):** a closed house of 5-week birds on minimum ventilation reaches about 29 °C at
   05:00 in our model. Does a house of big birds warm that much at night without tunnel air?
10. **Uniformity (§2.2 row 16):** about 68–74 % of the birds within ±10 % of the mean at 40 days for a well-run
    as-hatched flock: your numbers?
11. **Playing the conditions:** each condition can be a whole new flock or one level from the run card (a level started
    under a condition is a new run). Is that the way you want to practise them, and should a condition be offered before
    the first full cycle?
12. **Minimum ventilation in the rainy season (§4.2):** we say every morning by the table and about a quarter over it
    while the house reads over 80 % at dawn; even so the litter ends week 3 at about 33 %. Is wetter litter in August–
    September normal for you, and what do you do about it (more air, more husk, lime)?
13. **Guide tags** stay provisional (PHASE3.md question 1): every Phase 4 line is general practice. May any of them carry
    a guide name?

## 15. The farmer's requests during Phase 4 (after playing the Phase 3 build)

The farmer played the published Phase 3 build and asked for four changes. **They override any earlier rule they
conflict with** (here: the no-verdict rule for the flock watch's warnings, and the 4.5-minute day ceiling). Everything
else in §0 holds: no lessons or quizzes, no "correct" / "wrong" words, no scores, facts on signs with their sources,
earlier phases working. Each part below says what the farmer sees, the rules (model values are marked "model"; none of
them is a sign fact), the modules, and how it is tested. Harness proofs by real input: `scripts/req-watch.json`,
`req-clock.json`, `req-bucket.json`, `req-deadmark.json` (§15.5); node: `scripts/test-watch.mjs` (in `npm test`) and new
cases in test-jobs and test-contracts.

### 15.1 Early warning: the flock watch (request 1)
*"Some way of understanding if we are doing something wrong, instead of just failing at the end."*

**What he sees.** A small **Flock watch** card in the HUD, under the clock card, in every level with birds in the
house (from the first tipped stack to the catch). Four rows, each with a calm dot — green *steady*, amber *watch*, red
*alert* (the dot's word is its aria-label and tooltip) — and the measured value beside the level's line:

| Row | Value shown | Green / amber / red (model) |
| --- | --- | --- |
| Weight | the bird scale now (it reads about 2 % high, as the level result's fallback) and today's point on the level's line; "on course for N g at the day D weigh-in (line L g)" | projected weigh-in weight P against the line L: P ≥ 1.04 L / 1.00–1.04 L / P < L |
| Deaths | deaths and culls of the level as the level counts them, % of its limit; "on course for X %" | projected % at the level's end: under 75 % of the limit / 75–100 % / at or over the limit (or 80 % of it reached) |
| Comfort | "Right", "Cold" or "Hot" with the hours of the last 8 farm hours and the felt °C | 0–1 / 2–3 / 4 or more of the last 8 hours cold or hot |
| Intake | feed eaten and water drunk in the last 6 lit hours as % of what birds of this age and number take | both ≥ 88 % / 75–88 % / under 75 % |

**Projections (model, `src/flock-watch.js`).** The watch keeps one sample per farm hour (an env stepper, so skips and
goto(auto) count): age, scale weight, alive, deaths and culls (the level's own count), deaths by cause, comfort
(`farm.comfort`: cold share, panting share, felt mean, the model's cold and heat death rates), feed eaten
(`farm.flock.cumFeedKg`), the water meter odometer, the lights, the growth factors (`farm.flock.factors`: temperature,
light, feed reach, water reach, air).
- *Weight*: the level's line is Phase 2's `weightRatioMin × chick weight` on day 7, a week level's `minShare ×
  weightAt(day)` on its weigh day, and the last week's harvest line `minShare × weightAt × shrink` at the booked
  catch. Its curve runs along the model's ideal growth path ref(age) = weightAt(age) × the ideal's share of it in the
  brooding week (0.99 at placement, 0.88 on days 1–2, 0.90 on days 3–4, 1.06 on day 7: the chicks start on their yolk
  and catch up; 1.0 from day 8). The share s = scale / ref(age) is projected with half its change over the last 24 farm
  hours (a whole day, so the lights' daily rhythm cancels) for up to 72 hours ahead: P = ref(D) × (s + ½ Δs₂₄ × min(h
  left, 72) / 24).
- *Deaths*: the level's % now + the last 24 hours' rate × the hours left in the level (capped at 72 hours).
- *Comfort*: an hour is **cold** when half the birds feel 2 °C or more under their target (age under 14 days; older
  birds: the model's cold deaths have started), **hot** when half the birds pant or the model's heat deaths have
  started. Before the first tip and in an empty house the row is blank.
- *Intake*: from 24 hours after the first tip (the chicks' first day of learning to eat is the crop check's job);
  expected feed per lit hour = alive × the feed standard for the age (`config.feedStdGAt`) ÷ the lit hours of the light
  program; water expected = that × 1.8 L/kg (the water sign's general figure); hours of the feed withdrawal and of the
  heat-wave feeder lift are left out.

**Warnings.** When a row turns red (weight on course under the line, deaths on course for the limit, 4 of 8 hours cold or
hot, intake under 75 %), the watch raises one notice: a **caption** and a **notebook line** (kind `watch`, which the
day's record row also shows under its notes), and the card keeps the last one under its rows. The same kind warns again
only after it was green or amber for 6 farm hours, at most once per 12 farm hours. The notice says **what is happening,
the likely cause from the model, and where to look** (the sign and the place), in plain words, e.g. *"Chicks felt cold
for 5 of the last 8 hours (felt 30.4 °C, brooder sign row 33.0 °C): weight is on course for 158 g at the day 7 weigh-in
(line 165 g). See the brooder sign; check the thermostat at the climate controller."* The likely cause is the model's
weakest growth factor or the main cause of the last day's deaths, worded by `WATCH_CAUSES` (cold → brooder sign and
the thermostat; heat → the brooder sign and thermostat in the brooding week, the heat sign, fan panel and pad pump
later; water → the water lines sign, a flow test at the regulators and the water supply's filter; feed → the feeder
lines plate at the feeder box and the pans' height; light → the light program sign or plate and the controller's lights;
air → the minimum ventilation or air quality sign and the controller's ventilation; leg deaths → the legs sign;
disease → the droppings sign and a bird check; sudden deaths → the light sign). Tone: factual, no "wrong", no scores
(test-contracts checks every template). The watch is a reading of the model like a gauge; it never grades the farmer.
Measured: the ideal brooding week raises one warning (intake on day 3 at 16:00: the blocked filter's low water flow, which the
ideal's day-4 morning round finds); the ideal cycle three in all, each at a level's problem (that one, day 33's humid heat;
the conditions add their heat days and week 3's coccidiosis); a bad batch's graded-out chicks before the hatchery call read
as deaths and culls over the limit with the cause "the chicks graded out at the table count as culls until the hatchery is
told the same day". The deaths trend is the last day's deaths alone (culls are the farmer's own decisions). Hours with the
main valve shut (the vaccine's thirst) are left out of the intake.

**Contract.** `createFlockWatch({ env, farm, events, records })` → `{ attach(ctxFn), reset(), status(), warnings,
serialize(), restore(d), step }`; level.js attaches `() => ({ active, def: lv(), deaths: levelDeaths(), chickG,
catchAt })`, resets it at every level start, saves it with the level (`level.watch`). It emits `EV.WATCH { kind, state,
text, cause, sign, place, day, hour }`; the ui shows the caption, records note it. `ui-watch.js` draws the card from
`status()` every 0.5 s. **Test** (`scripts/test-watch.mjs`): the ideal brooding week through level.js raises no weight,
deaths or comfort warning and passes; the brooding week with the thermostat 4 °C under the sign's row all week fails on
deaths (day 4–5) and its first warning comes at least one farm day before; the same week with the thermostat put back
to the sign's row at its first warning passes; a week-2 neglect (`noCare`) and a week-3 coccidiosis left untreated
(`cocciUntreated`) warn at least a day before their ends; serialize → restore keeps the samples and the warning memory.

### 15.2 Slower time; no job closes while the farmer is doing it (request 2)
*"We should also slow down time progression a little since I find myself failing tasks while trying to accomplish them."*

- **The default clock is 25 % slower**: `LEVEL1.clock` (every level) `work` 120 → **90** game s per real s (one farm
  hour = 40 s instead of 30 s), `fast` 480 → **360** (still 4× the default). **Slower still at the job**: `panel` 30 →
  **24** (an equipment or inspection panel open), `carry` 30 → **24** (boxes, barrow, sack, frame; the truck until the last
  tip; the dark house), and a new **`atJob` 60** while the farmer stands at an open job's place (within 2.5 m of the
  place the job marker would point to for that job, on the same side of the wall) and has not pressed 4×. Signs and
  plates still stop the clock. The HUD's rate slot reads *1×*, *4×*, *⅔ speed* (at a job), *¼ speed* (panel, carrying,
  dark house), *Stopped*.
- **A job never closes while its panel is open or while he is doing it.** The job engine asks `hold(inst)` (level.js)
  when an open job reaches its close: held while (a) the open panel shows that job's strip (`stripsAt`), (b) he stands
  at the job's place, (c) he holds a bird for an open sampling job or carries the job's tool (the frame for a weigh
  job, the barrow for the litter, the boxes while placing, the washer or sprayer), or (d) the panel finishes a machine
  job of it in the background. A held job's close moves to now + **20 farm minutes** (`JOB_HOLD.graceMin`, model) each
  time it comes, so after he stops he still has up to 20 farm minutes; then it is missed as before (the panel's strip says
  *"Its window closed at 12:00: it stays open while you work here, and about 20 farm minutes after you stop."*). Never during a
  Next job skip or goto(auto) (no hold: test-level, test-sim, test-cycle and the profiles are unchanged).
- **Warned ahead.** From 30 farm minutes before its close (`JOB_HOLD.warnMin`) an open job's line on the job card
  carries a chip *"closes in 25 farm minutes"* (*"held open while you work · 20 farm minutes after"* when held); once,
  as it crosses the 30-minute mark, a soft cue: the chip pulses (reduced motion: no pulse), a quiet click sounds and a
  caption names it (*"Take vent temperatures of the chicks: closes in 30 farm minutes (11:36)."*; the jobs of a round that all
  close together make one caption, *"… and 6 more jobs: close in 30 farm minutes (12:00)."*, and one click).
  `EV.JOB_SOON { key, keys }`; a skip never cues inside it (a skip that lands within 30 minutes of a close cues once after).
- **Pacing.** The real-input days are re-timed with the slower clock (§15.6): the per-day ceiling of PHASE3.md (4.5
  minutes) becomes **6 minutes** (4.5 × 120 / 90: the same farm hours at the farmer's slower clock), measured as before.

### 15.3 The dead-bird bucket (request 3)
*"I should be able to do tasks even if I'm picking up dead birds." "Can we set it down where we are?"*

- **(a) The bucket blocks nothing that one hand can do**: panels, signs, plates, machines, more dead birds, the bin.
  `props.handsBusy(kind)` = carrying something other than the bucket (and other than `kind`); every panel's *Take …*
  key and every provider that asked for empty hands asks it instead (chick and sick-bird providers, box stacks, the
  brushes, the tools, the barrow, the sack, the frame, the tape).
- **(b) G sets it down at his feet** (`props.setBucketDown()`: a bucket on the litter, 0.4 m in front of him, with its
  birds and causes); **E picks it up there** (the `bucket` interactable: *"Pick up the bucket (3 dead birds)"*, priority
  7, 16 within 0.9 m). A small blue-grey marker floats over it and an edge chip *"Bucket · 3 birds · 12 m"* points to it
  when it is off screen; G is in the help legend and a second prompt pill (*"G Set the bucket down"*) shows while he
  carries it. A dead bird picked up while the bucket stands on the floor goes into that bucket (caption *"Dead bird into
  the bucket you set down (4 in it)"*); the bin counts only a bucket in his hand. `dead-cleared` also needs no bucket
  with birds on the floor; the dead job's marker and *Next* line point to it. The bucket on the floor is saved.
- **(c) A two-handed task sets it down by itself**: every `props.startCarry(kind)` of another kind (a chick or bird for
  the vent, crop, weighing or bird check, the catching frame, chick boxes, the barrow, a sack, a tool) and opening the
  chick table's grading or the bird scale while carrying the bucket set it down at his feet first, with the caption
  *"Bucket set down here"*. He is never locked out.
- **(d) E acts on the chick job first.** While a job that needs birds in the hand is open (`level.chickJob`: the
  sampling jobs — vent temperatures, crop check, weighing, the bird and droppings checks — the grading at the chick
  table, a lame-bird job), **E never picks up a dead bird or the bucket**: it acts on the chick (or the panel, board or
  machine) even with a dead bird closer. **Shift+E** picks up the dead bird (or the bucket) then, and the prompt shows it
  as a second pill (*"Shift+E Pick up the dead bird"*). Outside chick jobs E picks up dead birds as before.

### 15.4 Dead birds you can find (request 4)
*"Dead birds should be more visible by including the distance pointer arrow to them, at least to the nearest dead bird."*

Whenever dead birds lie on the floor (in a level, no panel open), an edge chip points to the **nearest** one with the
count and its distance — *"3 dead birds · 12 m"* (*"· at your feet"* under 1 m) — at the screen edge while it is off screen
and as a tag over it while it is on screen (moved sideways off a HUD card, still by its bird); it keeps clear of the job
marker's pointer (both stay visible) and of the HUD cards. Every dead bird
within **15 m** of the farmer gets a small floating marker (a muted red inverted pyramid 0.7 m over it, gently bobbing;
one instanced mesh, at most 64). `src/ui-deadmarks.js` owns the chips and the markers; it reads `flock.dead.list`
(positions) and `farm.flock.deadOnFloor` (the count).

### 15.5 Harness proofs by real input (960 × 600)
- `scripts/req-watch.json` — the brooding week at placement; at the climate controller the thermostat is turned 4 °C
  under the brooder sign's row by real clicks; the clock runs; the Flock watch card turns amber then red, the warning
  caption and its notebook line appear (cold hours, the cause and where to look) while the level is still running and
  at least a farm day before a fail; the thermostat put back by real clicks; the card's comfort row returns to green.
- `scripts/req-clock.json` — the default clock 90 and ⅔ speed at a job's place; a panel 24; a morning job opened at
  11:45 at its panel stays open past 12:00 while the panel is open (held), closes 20 farm minutes after the panel
  closes unless done; the *"closes in … farm minutes"* chip and caption from 11:30.
- `scripts/req-bucket.json` — a chick job (vent temperatures) with a dead bird closer than the chick: E takes the chick;
  Shift+E takes the dead bird; carrying the bucket, E on a chick sets the bucket down with its caption and takes the
  chick; G sets the bucket down, its marker shows; E picks it up there (no chick job open); the bin counts it.
- `scripts/req-deadmark.json` — dead birds on the floor: the chip shows the count and the nearest one's distance (checked
  against the page's own sum), the markers float over the birds within 15 m and none farther, the job marker's pointer
  still shows beside it.

### 15.6 What it changes elsewhere
- Steps files and play-throughs: fixed `advance` waits after timed panel actions are re-checked for the panel clock 24;
  checks of `timeScale === 30` read `LEVEL1.clock.carry`; the real-input days are re-timed against the 6-minute ceiling.
- test-jobs: the hold (a job held while its panel is open closes 20 farm minutes after; never in a skip), the closes-soon
  event, `dead-cleared` with a bucket on the floor. test-contracts: the watch's texts and the new legend keys
  verdict-free; G and Shift+E free of every other binding.

### 15.7 Results on main (960 × 600, seed 1)
- **Request 1**: test-watch — the ideal brooding week passes (4.87 ×) with one warning (day 3 16:00, intake: the blocked
  filter's low flow); the thermostat 4 °C under the sign fails on deaths on day 4 at 20:00 and its first warning ("Chicks felt
  cold for 4 of the last 8 hours …") came on day 0 at 12:00, **4.3 farm days before**; put back at that warning, the week passes
  (4.71 ×, 1.62 %); week 2 `noCare` first warned on day 11, week 3 `cocciUntreated` on day 20 14:00 (it ends on day 21 20:00).
  `req-watch.json` 11 PASS by real clicks at the controller (the warning 4.4 farm hours after the change, at 14:00 on day 0).
- **Request 2**: `req-clock.json` 13 PASS; test-jobs (the hold, the grace, no hold in a skip, one cue). The real-input days
  of `p3-cycle.json` (140 PASS): planning day 2.6 min · day 8 4.4 · day 16 4.7 · day 25 4.1 · day 37 4.2 · day 44 4.1 (all under
  the 6-minute ceiling; day 16 was 4.4 at the old clock); the hot season's days 1.2 / 1.3 / 2.7 min.
- **Request 3**: `req-bucket.json` 17 PASS (the E prompt on the chick with a dead bird 0.30 m away and the chick 1.08 m, the
  Shift+E and G pills, the auto set-down caption, the bucket's chip and marker, E picks it up, the bin counts it).
- **Request 4**: `req-deadmark.json` 6 PASS (the count and the nearest distance, the markers within 15 m, the chip clear of
  the job pointer and the HUD cards).
- Every earlier steps file and play-through passes (ARCHITECTURE.md lists the counts); `npm test` 356 ok; perf within budget.


### 15.8 Review round (the fixer, after the farmer's requests)
The reviewers' findings on the requests and the conditions, each confirmed first; what changed (model values marked model,
sign lines general):
- **The HUD's left column** (`ui.js layoutLeft`, every 0.1 s): the flock watch card and the alarm banner are placed under the
  real bottom of the clock and gauge row (it wrapped under the longer condition labels at 960 × 600 and hid House, Outside
  and Humidity); the alarm sits under the gauges in that column, never in the gauge row; the clock card names the hour's
  weather under a season condition (`hudHooks.weatherText`: Storm, Rain, Heat wave, Hot sun, Damp air) instead of the season
  twice, so the row fits at 960 px; the help legend (`.hud-bl`, z-index 8) lies over the watch card and the captions. Up
  to 1100 px wide the watch card is a compact strip of the four dots while every row is steady and no warning is new; it
  opens by itself on an amber or red row, or on a click. The warning box starts with where to look (bold), the clamp on an
  inner span (5 lines, no leaked half line). `scripts/rv-hud.json` (from `rv-hud-steps.mjs`): every condition, the normal
  season and the power cut at 960 × 600 and 1280 × 800: no gauge under the watch card or the alarm; the help's G row on
  top (elementFromPoint); the alarm back after a reload inside the cut.
- **Notices inside the open panel** (`ui.js panelNotice`): the HUD's captions sit under the panel scrim, so the automatic
  "Bucket set down at your feet (N dead birds) …" is written at the top of the panel that opens (the chick in hand, the
  grading table, the weigh frame), and a flock watch warning raised while a panel is open goes at the top of that panel,
  its caption queued for the moment the panel closes. req-bucket and req-watch check the notice and the caption are seen
  (elementFromPoint at their centre), not only present in the DOM.
- **The flock watch** (`flock-watch.js`): the comfort row's "now" word and felt °C are read live from `farm.comfort` every
  time the card asks (a green window with the birds hot or cold now reads amber "· hot now"); the card shows a new warning
  at once (`status.last` after the warnings pass); `causeOf(kind, age, watchState(env, farm))` follows the house's state:
  the power off names the power cut sign and the generator, the water condition's low tank or worn pump the water tank
  plate and the well pump, the hot season's brooding heat the brooder sign's hot-season line and the pad pump with one
  fan, young birds' heat the pad with one or two fans, damp air (house over 85 %) the tunnel fans with "the pad gives little
  cooling", cold from moving air (wind chill over 1.5 °C or air over 0.5 m/s) the fan panel at any age, a bad batch's weak
  deaths in days 0–1 the chick grading plate; a deaths warning keeps its own cause (disease, sudden deaths, legs, thirst,
  breathing, the claim) over the comfort. A standard start's auto play is quiet (`watch.quiet`: no notebook line, no
  caption). Save: `t` and `age` to 1e-5 day, `lastHour` saved; `level.resume` restores the watch after the mode is
  `level` (the card shows at once after Continue).
- **Heat handled** (`heatHandled`, `pad-few-fans`): young birds (under 21 days) under every fan without the pad count only
  while the pad cannot work (outside 75 % or more, or the house over the pad plate's 90 %) and with at most a quarter of
  them panting (`YOUNG_PANT_MAX` 0.25, model); `h-young-heat`'s first part is now the state "the pad on with 1–3 tunnel
  fans" (a press of the fan switches no longer ticks it). Big birds keep "every fan with the pad" whatever the panting: the
  hot season's day 38 leaves about 44 % panting under every fan and the pads, all the house can do. The heat strips say
  the tuned heat sign's line for the age (`heatSignLine`: young birds the pad with one or two fans, three in week 3; big
  birds every fan and the pads); test-jobs checks it against the sign's text.
- **The ideal** (the reference play): the week-3 warm afternoon (day 16) with the fewest tunnel fans that bring what the
  birds feel to the target + 1 °C (`fansForFeel`, read again at 15:30 and at a new 17:00 stop) instead of six (they chilled
  3–5.6 °C under the target for about five hours); the rainy season's damp hours (house over 85 %) with tunnel fans by
  feel (young birds by day, at most two in week 2 and four in week 3; big birds up to every fan), with the new rainy heat
  sign line (general); a bad batch's warmer brooding ends at 22:00 on day 3 (the thermostat to day 4's row: the target
  drops 1.4 °C at midnight). Results: the rainy ideal week 3 963.5 → 973.8 g, harvest 2,868 → 2,891 g, EPEF 422 → 426 (the
  other conditions' cycles as before within 1 EPEF); test-cond 30 of 30 with the bands unchanged.
- **Every warning of the ideal is a documented problem event** (test-watch, the whole cycle under each condition): normal
  day 3 intake (the blocked filter) and day 33 humid heat; hot day 3; rainy day 3 and day 19 (coccidiosis, at the droppings
  sign); water day 3, day 20 (coccidiosis), day 33; bad batch day 0 (the culls before the hatchery call), day 3, day 33.
- **A new run after an abandoned bad batch** (found while testing): its delivery and its slow start (`farm.delivery`,
  `gainK72`, `lateK`, `traysReach`) stayed on the farm, so the next run's brooding week grew 12 % slower and a standard
  start failed week 2; `farm.start` now clears them (test-run).
- **Smaller fixes**: rain streaks whose ray from the camera meets the floor inside the house are culled while the farmer is
  inside (a pixel check in p4-scene-look); the storm flaps open as hoods over the dark inlet gap with a wet stain under
  them in rain, closed as a light painted plate (a pixel check), line 4's rust as a 16 cm sleeve at each nipple and brown
  drip cups; the controller's alarm glow a soft round glow on the lamp; the generator panel's engine and transfer switch
  rows above the job strip, the transfer switch's thrown side marked and its lamp lit only while that source is live; a
  lit toggle key shows its state ("Pad pump · running"), the action in its aria-label and title (test-contracts); the
  alarm banner comes back after a reload inside a cut; the storm flaps shut count 70 % of the timer air in the vent need
  (the controller says so); the feeder plate prints the brooding days' 7 cm; `heldText` drops the comma before "for N farm
  minutes"; the result screen's brooding week shows the hot season's house at 15:00 with the pad and fans and the deaths
  by cause, and the hot season's record rows note the afternoon; the dead-bird tag sits over the bird's marker, keeps off
  the farmer's figure, moves one way past the visible clock and gauge cards and turns its arrow to the bird; the
  bucket's marker draws over walls; the level speed tooltip says a farm hour takes 40 s.
- **Not changed**: `b-warm` still counts on the first tick at row + 1 °C (a held three-day outcome would need a new held
  rule and a re-cut of p4-bad); the hot season still costs the ideal flock work, not weight (a hot-night intake term would
  move every hot band and COND_TARGETS; PHASE4.md §2.8 row 18 stands as an open tuning item).
- **Results of the review round** (960 × 600, seed 1, no console or page errors anywhere): `npm test` 362 ok (test-watch 9,
  with the per-condition allow-list; new test-jobs, test-run and test-contracts cases); test-cond 30 of 30; `npm run perf`
  alone within every budget (whole cycles 2.6–2.9 s, a weeks 4–5 24 h skip 40–70 ms). `rv-hud` 16 PASS, `req-bucket` 18,
  `req-watch` 13, `req-clock` 13, `req-deadmark` 6, `p4-scene-look` 2 (no rain pixel over the litter; the inlets' mean
  luminance 88 closed, 46 open), `p4-hot` 43, `p4-rainy` 17, `p4-bad` 16, `p4-water` 15, `p4-clarity` 14, `p4-panels-cond`
  27, `p4-panels-clarity` 6, `p4-panels-additions` 9, `p4-run-power` 7, `p4-run-ui` 11, `p4-run-conditions` 11,
  `p4-scene-events` 30, `hotfix-steps` 21, `p3-panels-week2 / harvest / clean / heat` 12 / 7 / 15 / 12 (the harvest ticket
  now adds up in whole kilograms), `p5-sound` 44, `p2-level1` 58, `p3-replay` 16, `p3-cycle` 140 (brooding week 4.87 ×,
  week 2 492 g, week 3 985 g, weeks 4–5 2,318 g, harvest 2,882 g, FCR 1.58, EPEF 426; play time planning day 2.6 min, day 8
  4.4, day 16 4.6, day 25 4.1, day 37 4.1, day 44 4.1), the Phase 1 tour and `phase1-jobs` (4 of 4).
