# Chicken Farm — Phase 5 spec: polish (sound, saves, settings, the farm map, the final quality pass)

**Goal (approved plan, build phase 5):** the game feels finished to a broiler farmer who plays it for hours. The subtle
sound layer covers every Phase 3–4 situation and stays quiet and varied over an hour; the farm is kept in **three save
slots** beside the autosave, with **Continue**, in-page delete, and **backups as text** (copy / paste) that survive a
republish of the page; a **settings menu** (title card and in game) sets sound, time, graphics, camera, interface,
keys and reduced motion, applied at once and remembered; a **farm overview map** shows the farm from above and walks
the farmer to any place; and a **final quality pass** gives a first-play introduction, a player guide, clear loading and
error messages, consistent HUD and panels, a performance check for real GPUs, keyboard use of every panel, the
phone note, and the four Phase 4 leftovers.

Read with `ARCHITECTURE.md` (Phases 1–4 as integrated, the farmer's requests, the sound layer), `PHASE2.md`,
`PHASE3.md` and `PHASE4.md` (the contracts this file extends). The shared contracts of this phase are **in code now**
(§8): the Phase 5 section of `src/config.js` (`BUILD`, `SAVE_SLOTS`, `SETTINGS_STORE`, `GFX`, `MAP`), four events in
`src/events.js`, the settings store `src/settings.js`, reduced motion `src/motion.js`, the key table `src/keys.js`, the
graphics quality `src/gfx-quality.js` (Phase 1's governor moved out of `main.js` unchanged), the loading card
`src/boot-screen.js`, the game menu `src/ui-menu.js`, the title card's `addAction`, the panel host's `busyIds()`, and
working stubs for every new screen (`src/ui-settings.js`, `src/ui-guide.js` + `src/content-guide.js`, `src/saves.js`,
`src/save-slots.js`, `src/save-codec.js`, `src/ui-saves.js`, `src/ui-map.js` + `src/map-plan.js`, `src/ui-intro.js`),
checked by `scripts/test-contracts.mjs` (Phase 5 cases) and `scripts/p5-design-stubs.json`. §10 splits the work into
four packages with disjoint files — **sound**, **saves**, **settings**, **experience** — each section standing alone.

**Review round** (after the design critic; marked *review round* where it changed the text): the backup reader counts the
payload and reads parts (§3.5, in code); the hot season's appetite keys on the house air, measured (§6.8.4); keys reach a
panel, a rebind or the intro before ui.js closes anything (§8.6, in code); the map is on **O** and Tab stays the focus key,
with keys for pause, 1×, 4× and Next job (§4.3, §5.3, in code); the panel host has a return path (§8.6, in code); the steps
files drive frozen DOM hooks (§8.10) and each package styles its own screens (§8.11, in code); plus the smaller fixes
listed in ARCHITECTURE.md's *Phase 5 design — the review round*.

## 0. Rules that hold everywhere (approved design, do not break)

- **No lessons, no quizzes, no hidden-answer scoring.** Facts sit on signs at the place they are used; the job list walks
  the farmer through each job and points to its sign. The first-play introduction (§6.1) only says *where* something is
  and *what it shows* (the job card, a sign, the time bar, the flock watch); the guide (§6.2) only says how the *game*
  works and holds **no farming fact** (test-contracts checks it holds no °C, L/kg, m/s, lux or ppm figure).
- **No "correct" / "wrong" messages anywhere**, no praise, ticks or crosses. Every new text (menu, settings, saves
  messages, the guide, the intro, sound captions, map names) is checked by test-contracts' `VERDICT` words.
- **Every sign fact shows its source** in small text: a guide name only for the facts listed in PHASE2.md §6.1 /
  PHASE3.md §5.1, otherwise "general practice"; no page numbers. Phase 5 adds **one** sign line, the hot season's
  appetite (§6.8.4, general), whose figure the model gives (test-cond).
- **Missing a level's key target fails the level and you replay it.** No target, pass / fail rule, job, milestone or
  unlock changes in Phase 5 (§7). The skill tree's eleven branches and their unlocks stay as they are; the map and the
  settings are available from the start (they are aids, not unlocks).
- **Days pass in a few minutes of play** (1× = `LEVEL1.clock.work` 90 game s per real s: a farm day in 16 minutes;
  *Next job* skips). Desktop browser, English, low-poly flat-shaded procedural art, one self-contained page (three
  0.160.0 from jsDelivr), ARCHITECTURE.md's publishing constraints: no `alert` / `confirm` / `prompt`, no
  `window.open`, **no downloads** (a backup is text copied in the click handler, with a select-the-text fallback),
  `localStorage` only inside try/catch, nothing sideways at phone width, `prefers-reduced-motion` respected.
- **Earlier phases keep working**: the Phase 1 sandbox and its scenarios (`tour`, `cold-hot`, `walk`, `p2-hooks`,
  `phase1-jobs`), Phase 2's lone brooding week (`__game.startLevel({ seed: 1 })`, `scripts/test-sim.mjs` byte-identical),
  Phase 3's cycle, Phase 4's conditions and the farmer's requests, every node test and every steps file and
  play-through (§9.3 lists them). **Every default setting is the Phase 4 game**: with the settings untouched every
  clock speed, key, view, sound level and quality step is as on main before Phase 5.

## 1. Player experience walkthrough

### 1.1 First visit
The page opens on the loading card (the hen, *Chicken Farm*, a line that names the step: *Building the farm…*,
*Bringing in the flock…*, *Warming up the graphics…*). On a slow line or a filtered CDN the card says so in plain words
after 20 s (§6.3). The title card stands over the farm at dawn: **Start a new flock**, **Start at the brooding week**,
and below them the quiet keys **Walk the Phase 1 farm**, **Skill tree**, **Load a saved farm**, **Settings**, **How to
play** (and *Harder flocks* after a first cycle). A first-time player (no save, no settings stored) sees one line under
the buttons: *New here? Start a new flock: the first morning points out the job card, the signs and the clock.*

He presses *Start a new flock*. Outside the gate on the planning day the first pointer card appears beside the **job
card** (*Your jobs for today…*), the farm clock standing still while it shows. *Next* moves the card to the **gate
sign** in view (*Signs stand where you use their facts…*), then to the **time bar** (*The farm clock: pause (P), 1× and 4×
(1, 4). Next job (J)… Esc opens the menu; O opens the farm map* — the keys as bound now). *Got it* ends it; *Skip the
introduction* ends it at any card. On the morning of day 0, when the
flock watch first shows, one more card points at it (*The flock watch measures the birds every farm hour…*). None of
the cards comes back unless the guide's *Show the introduction again* is pressed.

### 1.2 An hour on the farm
The sound stays quiet and changes with what happens (§2): rain drums on the metal roof and thunder rolls a few seconds
after each flash; in the hot season cicadas swell through the hot middle of the day; in a power cut the controller beeps
(fast for two minutes, then slower) until the generator takes the load, its diesel thrumming beside the farm road;
on the catching night the crew murmur, crates clack and the truck idles at the loading bay; at the wash bay the
pressure washer whines; on the office porch a desk fan hums and the phone rings softly when a letter comes. Sound
captions (*[Thunder, far off]*, *[Alarm in the house]*, *[Chicks peeping loudly]*) can be switched on for a player who
plays without sound.

**O** (overview; any rebound key shows instead) or the **map key** on the time bar opens the **farm map**: the farm from above in the
game's flat colours, the house with its lines, brooders, pad and fans, the buildings, every sign, the farmer's arrow, the
open jobs' places with their orange markers, the dead birds on the floor, the bucket where he set it down, and the
flock's spread inside the house (each drawn bird a dot). A **House** tab shows the house alone, larger. Hovering a
place names it with its walk ("Feed silos · about 64 m, 16 s walking"); a click closes the map and walks him there by
the route finder (round the end walls, in at the door). The clock stands still while the map is open. **Tab** stays the
browser's focus key everywhere: with the keyboard alone the farmer reaches every key on the screen, and **P** (pause),
**1** and **4** (the clock's speed) and **J** (Next job) work from the farm view.

**Esc** with no panel open (or the **gear key** on the time bar) opens the **game menu** with the clock stopped: *Back to
the farm*, *Farm map*, *Save or load*, *Settings*, *How to play*, *Back to the title card*. What the menu opens comes back
to the menu when it closes (Esc in Settings shows the menu again, on *Settings*); a second Esc returns to the farm.

### 1.3 Saving, loading, backups
The game still saves by itself (the autosave of Phase 3, every level start kept for a replay). *Save or load* shows the
autosave and three slots, each named by condition, level, day and time — *Hot season · Level 5 – Weeks 4 and 5 · Day 30,
14:20* — with the date it was saved. *Save here* keeps the farm as it is now in a slot (asking inside the panel before
it replaces a slot that holds a farm); *Load* puts a slot's farm in play (asking first, naming the farm now in play that
the autosave holds); *Delete* asks inside the panel (*Delete Slot 2 (Week 2 · Day 12, 08:40)? This cannot be undone.*).
*Back up* opens a box under the row with the backup ready: *The whole run* (every level start, for every Replay: about
210,000 characters at the end of a cycle) or *This farm only* (the farm as it is now, no level starts: about a quarter
of that); a long backup comes in numbered **parts** of at most 9,000 characters each (*Part 2 of 25*), each with its own
*Copy* key, so each fits one chat message or note. *Copy* puts the text on the clipboard inside the click — where the
browser refuses, the text shows selected in a box with *Press Ctrl+C (⌘C) to copy*. *Restore* takes the pasted parts, in
any order, into a slot. A slot that cannot be read says so on its row and offers only *Delete*. **Continue** on the title card always resumes the newest
readable save (the autosave or a slot, by the time it was saved).

### 1.4 Settings
*Settings* (title card, menu, gear) has six tabs: **Sound** (master volume, sound off, yard and house, the flock, your
actions and the machines), **Time** (the clock speed a level starts at, the clock stopping at signs, the ⅔ speed at a
job's place, jobs held open while he works at them), **Graphics** (automatic or high / medium / low; sharpness, shadows,
flock detail by hand; the frame rate shown), **Camera** (turn and zoom speed, either the other way), **Interface** (HUD
size, the flock watch shown / folded / hidden, sound captions, how long messages stay, the controls legend, reduce
motion) and **Keys** (every key, each changeable by pressing a new one; a key another action uses swaps with it). Every
change works at once and is remembered in this browser; *Reset this tab* gives the defaults back.

### 1.5 Coming back, a new version of the page
A player who played the Phase 4 build finds his autosave (`chickenFarm.run.v3`) and skill profile as he left them:
Continue resumes it. A Phase 2 player's brooding-week save continues as a run at the brooding week (as since Phase 3).
A slot or backup saved by this build keeps loading in later builds (versioned envelope, migrations up the list of known
formats, §3.6); a backup made by a newer build says so instead of failing.

### 1.6 Harder flocks
Nothing in the conditions changes except the hot season's appetite (§6.8.4): in April–May heat the house air behind the
pads still stands above 28 °C through the hot hours, and birds of three weeks and older eat a little less then, so even a
well-cooled flock finishes 2–5 % lighter than the normal season's (the heat sign's hot-season line says so, general
practice; the normal season does not change at all). The water condition's flock watch no longer shows its Supply row amber on day 33 with a full
tank (§6.8.1); a bad batch's fail line names 24:00 of day 0 when the hatchery claim closed then (§6.8.2).

## 2. Sound polish (package "sound")
The sound layer of ARCHITECTURE.md "Sound" stays as it is (procedural Web Audio, no files; the context made only on a
user activation; pooled voices, no node made after start-up; Poisson events, never a fixed beat; the U key). Phase 5
fills the situations Phases 3–4 added, makes an hour of play pleasant, moves the controls into the settings menu and adds
sound captions. Levels are dBFS at the default volume (slider 0.7), measured offline by `debug.measure` as now.

### 2.1 What is new, situation by situation
| Situation (state the sound reads) | What plays | Where it is heard | Level (RMS while it plays) | Rules |
| --- | --- | --- | --- | --- |
| **Rain** (`farm.weatherNow.rain` 0..1, as now) | the roof drum (exists) scaled with the rain; **drips** off the eaves for 20 farm minutes after the rain stops (`world.weather.wet` > 0.3, rain 0) | drum inside and on the apron; drips outside within 6 m of a wall | drum −36 (exists); drips −48 each, 0.2–0.6 a second (12–36 a minute, under the cap of 40), falling with the wetness | drips Poisson, 4 variants, never the same twice |
| **Storm** (`stormOf(farm)`: rain with `weatherNow.storm` or rain ≥ 0.5) | **thunder** after each lightning flash (`world.weather.flashes` rises): delay = distance / 343 m/s, distance 0.5–2.7 km at random (1.5–7.9 s), a 3–7 s rumble; stronger gusts in the breeze (+4 dB, gust rate × 2) | outside; inside −6 dB and low-passed at 400 Hz (the roof) | rumble −38 ± 3 over its first 2 s, peak ≤ −20 (near), far ones −44 | **flash-driven**: one rumble per flash (world-rain's flashes come on their own 30–50 s timer), at most 3 a real minute; under reduced motion (no flashes) on its own **exponential** timer, mean 40 s with a 20 s floor, while the storm lasts |
| **Power cut** (`farm.power.on === false`) | the controller's alarm (exists): two-tone beeps every 6 s for the first 120 real seconds of a dark house, then every 15 s; the fans run down (exists: `env.fansOn`) | the house and the apron (fainter with distance, exists) | loudest 100 ms −38 | the gap grows, the alarm never stops while dark; the caption names it once |
| **Generator** (`farm.generator.running`; `gen.start` / `gen.stop` / `gen.switch` / `gen.test` actions) | a diesel bed: a 24–30 Hz firing thrum and a 600–1,800 Hz mechanical rattle band, slow ±1.5 dB wander; **start**: the starter cranks 1.2 s, catches; **stop**: runs down 2 s; the transfer switch: one heavy clunk | at `FARM.generator`, fading `exp(−d / 20)`; inside the house −8 dB | −36 at 4 m outside, −44 inside the house | the bed only while running; start / stop / clunk cues rate-limited (2 s) |
| **Hot season by day** (`farm.condition === 'hot'`, 10:00–16:00) | a **cicada chorus** swelling and fading in waves of 20–60 s, peaking about 13:00; the dusk swell (exists) +2 dB | outside (through the walls as the other outdoor beds) | −42 at the peak | its own bed (not the dusk one), off in every other condition |
| **Catching night** (`farm.harvest.started` and not `endedAt`) | the crew's **murmur** (pink noise through 3 moving formant bands with a slow random syllable envelope: voices, never words); **crate clacks** near the crates and the catching panels (Poisson 0.2–0.5 a second); the catch truck **idling** at the loading bay; the birds' flutter as they are penned (exists) | murmur within 15 m of the crew (`props` catch crew positions or `SPOTS3.catchPanels`); idle at `SPOTS3.loadingBay`, `exp(−d / 18)` | murmur −40, clacks −38, idle −40 at 5 m | from EV.CATCH start to end; the murmur's level falls 3 dB after 2 real minutes in one place (habituation) |
| **Wash bay and clean-out** (`ui.busyPanels()` includes `wash-bay`; `props.carrying` `washer` / `sprayer` / `scraper`) | the **pressure washer**: a 100–150 Hz motor hum and a 2–6 kHz spray hiss; the hiss pulses with the farmer's steps while he carries the washer inside; the **sprayer**: a softer hiss pulsing about 1 Hz (the hand pump); the **scraper**: a scrape on each step on the litter | at the wash bay, or at the farmer (his own sound: centred) | washer −36 at 2 m, sprayer −42, scrape −44 | only while the machine job runs or the tool is in his hands and he is inside |
| **Planning office** (within 6 m of `SPOTS2.officeDesk`, 06:00–19:00) | a **desk fan** hum; the **phone** rings twice softly when a letter comes (EV.LETTER) and he is within 30 m; a short dial and line tone for every phone action (`phone.*`, `feed.order`); a **pen** scratch while he types into the planning sheet (input events in its panel, at most 4 a second) | the porch | fan −46, ring −40, pen −48 | ring once per letter; pen rate-limited |
| **Machines of Phase 3–4** (the pad pump, the curtain winch, the feeder valves, the gas tank, the tank pump) | the existing cues (valves, winch, augers); the **well pump** hums while it runs (`farm.waterTank` pump on, the water condition) | at `SPOTS4.waterTank` | −44 at 3 m | only in the water condition |

Every new bed is built at start-up with the others (the node count is fixed after start-up: at most 230 nodes in all,
test-audio counts them; **177 today** on the fake context). Ten new beds at 4–9 nodes each would reach the ceiling, so
the beds share: **one noise source** feeds every new noise band (drips, the murmur, the spray hiss, the desk fan, the
gusts) through its own filter and gain; **one machine bed** (an oscillator pair, a noise band, a gain, a panner) plays
the generator, the pressure washer, the well pump and the idling truck, which never sound at the same time (the
generator runs only in a cut, the washer only at the wash bay in the clean-out, the well pump only in the water
condition's days, the truck only on the catching night; when two would overlap the nearer one takes the bed). Expected
total about 205 nodes; every new cue is a recipe on the pooled voices.

### 2.2 Nothing loud or repetitive over an hour
- Every repeating event source is a Poisson process with variants (`pick()`: never the same twice in a row); no cue is
  heard on a fixed beat except the alarm, whose gap grows (§2.1). **Thunder is flash-driven**, not Poisson: one rumble per
  lightning flash after its distance delay (the flashes' own timer is world-rain's), so the hour check checks its delays
  (1.5–7.9 s after each flash) and its cap instead of a CV.
- **Caps per real minute** (rate limits on the audio clock; a burst of game steps in one task cannot stack sounds): job tick
  6 · key click 30 · paper 12 · alarm 10 (4 after its first 2 minutes) · thunder 3 · crate clack 30 · drip 40 · phone ring 2 ·
  generator start / stop / clunk 6 · truck 3.
- Beds wander slowly (±1–2 dB over 20–90 s); the ear's habituation (exists for the flock and the steps) also covers the
  murmur of the crew and the generator (−3 dB after 2 real minutes standing near it, back at once when it changes).
- **The checked bound stays**: every layer of every rendered scene, and every pool at once, peaks at or under −16 dBFS at
  the default volume; the soft clipper starts at −6. The background (beds) stays at −30..−38 RMS wherever he stands.
- A **long-session check** in node (`scripts/test-audio-hour.mjs`, §10.1) drives the scheduler and the cue limiter
  through a scripted hour (yard by day 10 min, the house with six fans 10 min, a storm 8 min, a power cut with the
  generator 6 min, the catching night 10 min, the wash bay 6 min, the office 4 min, a 4× skip 6 min) on the fake context and
  checks the caps, that the gaps between events of every Poisson source (thunder excepted: flash-driven, its delays and
  its 3-a-minute cap are checked; under reduced motion its exponential timer is Poisson and checked) have a coefficient
  of variation ≥ 0.6, that no variant repeats back to back, that nothing is created after start-up, and that the sum of
  the level table's loudest layers in any second stays under the checked bound.

### 2.3 Sound captions (accessibility)
With *Interface → Sound captions* on, a meaningful sound shows as a short caption in brackets (ui.js shows it when no
other caption shows; EV.SOUND_CAPTION is raised **also while the sound is off**, so a player without sound reads them):
*[Alarm in the house]* (a dark house; again when the gap grows), *[Thunder, far off]* / *[Thunder close by]*, *[Rain on
the roof]* (once per shower), *[Generator starting]*, *[Generator running]*, *[Generator stops]*, *[Truck arriving]*,
*[Truck leaving]*, *[The catching crew at work]*, *[Pressure washer]*, *[Phone ringing]*, and the flock as a farmer hears
it on entering the house or when it changes: *[Chicks peeping loudly]* (distress), *[Birds panting]*, *[Snicks and
rattles in the flock]* (a breathing problem), *[The flock is quiet]* (lights out). These are the same words the look notes
use (farm-problems `observe`); no caption is a verdict. Each key at most once per change and at most one caption every
8 real seconds (audio-captions.js).

### 2.4 Levels and checks (expected numbers)
`scripts/p5-sound.json` (updated by the sound package: the volume now lives in Settings → Sound, reached through
`__game.ui.openSettings('sound')` and `settings.set('sound.volume', 0.4)`, plus one DOM step on the frozen hook
`[data-setting="sound.volume"] input` (§8.10: its value is the stored 0..1 value); still every Phase 4 check, 44 or more
PASS) and the new `scripts/p5-sound-scenes.json` render each new scene offline with `debug.measure` and assert:
storm with thunder in the yard — RMS −30..−37, peak ≤ −18; thunder from inside the house — peak ≤ −24; generator at 4 m —
RMS −34..−39; the generator from inside the house — RMS of its layer −42..−48; catching night at the door — RMS −32..−38;
wash bay at 2 m with the washer running — −33..−38; the office desk by day — the fan's layer −42..−48; hot season 13:00 in
the yard — RMS −34..−39 (the cicadas included); every new layer at once with a burning brooder and cold chicks — peak ≤ −16;
no clipping. With captions on and the sound off: the cut at `farm.debug.power(false)` shows *[Alarm in the house]* within
1 real second.

### 2.5 The controls move into the settings menu
The speaker key on the time bar becomes a **one-click sound on / off** (its icon and aria-label say the state; U still
toggles); **Shift+click** on it opens the *Sound* tab of Settings, which holds the volume and the three layer sliders.
The small sound card of Phase 4 (`#sound-pop`) is removed; the legend rows for U come from keys.js (`sound`): the sound
package stops injecting them and the experience package draws the legend from `keys.rows`.
`audio-settings.js createSoundSettings` stays for test-audio; the game runs on `settings.js soundView(settings)` (in code:
main.js passes it), which keeps the Phase 4 key `chicken-farm.sound` in step.

### 2.6 The sound group of the settings
`sound.volume` (0..1, master: the squared curve of audio-settings `volumeToGain`), `sound.muted`, and three layer sliders
`sound.background`, `sound.flock`, `sound.cues` (0..1, default 1). The engine's layer gains (audio-engine `layer.*`) are:
outside and house × `background²`, flock × `flock²`, cues (and footfalls) × `cues²`, applied with `setTargetAtTime`
(0.05 s) on every change. At 0 a layer's voices stop being scheduled (no work for a silent layer).

## 3. Save and load (package "saves")

### 3.1 What is saved where
| Key (localStorage, every access in try/catch) | Holds | Written by | Since |
| --- | --- | --- | --- |
| `chickenFarm.run.v3` | **the autosave**: `{ version: 3, savedAt, run, blob }` (run.js `saveRun`; the level's autosave moments, each level start and end) | run.js (createRunStore) | Phase 3 — **never renamed** |
| `chickenFarm.run.v3.start.<level>[.<day>]` | the autosave's level starts (`{ version 3, levelId, day, savedAt, run, blob }`: weeks 4–5 `.22`, `.29`) | run.js | Phase 3 |
| `chickenFarm.level1.v1` | a Phase 2 player's brooding-week save (read once by `run.continueSave`, then replaced by the run key) | — | Phase 2 |
| `chickenFarm.profile.v1` | the skill profile (points, details, `cyclesDone`, `conditionsDone`): **one per browser, not per slot** | level.js | Phase 2 |
| `chickenFarm.slot.v5.1` … `.3` | **a slot**: the stored envelope (§3.2) | saves.js | Phase 5 |
| `chickenFarm.settings.v1` | every setting (§4), `{ v: 1, values: { group: { key: value } } }` | settings.js | Phase 5 |
| `chicken-farm.sound` | Phase 4's sound store, kept in step with `sound.volume` / `sound.muted` | settings.js | Phase 4 |
| `chicken-farm.help-dismissed`, `chicken-farm.level-help-dismissed` | the controls legends' "Got it" | ui-help.js | Phase 1–2 |

### 3.2 The envelope (format 5)
A slot and a backup hold the **whole run**: the run key and every level start, so every *Replay* of the run card works
after a load.
```js
// in memory (save-slots.js makeEnvelope)
{ format: 'chicken-farm-save', v: 5, build: 'phase5', savedAt,           // config SAVE_SLOTS / BUILD
  meta: { name, condition, conditionLabel, levelId, levelN, levelShort, levelTitle, day, hour, time },  // metaOf({ run, blob })
  run: <run.serialize()>, blob: <lean level.saveBlob()>,                 // exactly the run key's run and blob
  starts: [{ levelId, day, savedAt, run, blob }],                         // every stored level start of the run
  profile: <the skill profile> | null }                                   // backups only (§3.5)
// stored in a slot key (meta outside, so the list is drawn without unpacking a whole run)
{ format: 'chicken-farm-save', v: 5, build, savedAt, meta, enc: 'gz64' | 'json64', crc: '<8 hex>', data: '<base64>', chars }
```
`enc` **gz64** = gzip (CompressionStream) then base64; **json64** = base64 of the UTF-8 JSON (the fallback where the browser
has no CompressionStream). `crc` is the CRC-32 (IEEE) of the encoded bytes before base64 (save-codec.js `crc32`).

### 3.3 Slots
- **Name** (save-slots.js `metaOf` / `slotName`, in code): `<condition or "Normal season"> · <level title> · <day words>,
  <hh:mm>` — *Normal season · Level 3 – Week 2 · Day 12, 08:40*, *Hot season · Level 1 – Plan the farm · Planning day,
  07:00*, *Rainy season · Level 7 – Clean-out and rest · Rest day 5, 06:00*. The row adds *saved 4 Nov, 15:02* (the
  browser's date, en-GB short form) and the stored size (*168 KB*).
- **Save here** (in a level, or on its result screen — the result panel gets a *Save or load* key (experience, ui-result.js)
  that opens the saves panel over it; the result is always a parent (§8.6), so closing the saves panel shows the result
  again with its Replay and Next level keys; on the title card it copies the autosave): `run.exportSave()` writes
  the autosave first, then returns `{ run, blob, starts }`; wrap (`makeEnvelope`), encode, write. A slot
  holding a farm is replaced only after the in-panel question *Save over Slot 2 (Week 2 · Day 12, 08:40)?* [Save over it]
  [Keep it]. The sandbox has no slots (its keys are hidden).
- **Load**: the in-panel question *Load Slot 2 (…)? The farm in play now (Day 30, 14:20) stays only if it is saved in a
  slot.* [Load it] [Cancel] (on the title card with no game in play, no question). Then decode → migrate → `checkEnvelope`
  → `run.importSave(envelope)`, which **(a)** clears every live level start of the run in play (memory and storage, from
  `plan` on: no start of the replaced run may answer `loadStart` / `hasStart` / `store.info().starts` afterwards, the
  `def.starts` fallback included), **(b)** writes the envelope's starts and its run key, **(c)** stamps the run key's
  `savedAt` with now (so Continue, which takes the newest save, resumes the farm just loaded and not an older slot), and
  **(d)** resumes it (`continueSave`). An envelope with `run: null` (a Phase 2 save: `migrate` sets its
  `blob.level.levelId` to `'level1'`, in code) resumes as `continueSave`'s Phase 2 branch does (a run at the brooding
  week, `joinRun`, no plan). The skill profile is not touched.
- **Delete**: *Delete Slot 2 (…)? This cannot be undone.* [Delete] [Keep it] — never `confirm()` (test: the steps file
  replaces `window.confirm` by a function that throws).
- A slot whose key does not parse, whose crc does not match or whose format is newer shows on its row the message of its
  code (§3.7) with *Delete* only; the other slots and the autosave are unaffected.

### 3.4 Continue
`saves.latest()` = the readable entry with the largest `savedAt` among the autosave and the slots (after a load the
autosave holds the loaded farm with `savedAt` now, §3.3). The autosave row's own *Continue* resumes the autosave itself
(`saves.continueAuto()`, in code), never a slot. Continue (title card)
resumes it: the autosave directly; a slot by loading it into the autosave first (no question: nothing is in play on the
title card). The Continue line names it: *Continue — Week 2, day 12, 08:40* (the autosave, as now) or *Continue — Slot 2:
Week 2, day 12, 08:40*. With no readable save the key is hidden, as now.

### 3.5 Backup as text and restore
- **What a backup holds**: *The whole run* (the envelope with every level start and the skill profile: every *Replay* of
  the run card works after a restore; about 210 K characters at day 67) or *This farm only* (the envelope with `starts: []`
  and the profile: the farm as it is now; after a restore a *Replay* of an earlier level of that run starts from that
  level's standard start, as `run.startLevel` does for a level with no saved start since Phase 3 (the cycle summary then
  marks the levels before it as from a standard start); the box says so in words; about a quarter of the size, ≈ 50 K characters
  at day 67 — the saves package measures both and puts them in its report).
- **The text** (save-codec.js, **complete in code**, review round): two header lines for the player, a marker line, the
  base64 payload wrapped at 76 characters, `END`:
  ```
  CHICKEN FARM SAVE · format 5
  Hot season · Level 5 – Weeks 4 and 5 · Day 30, 14:20 · saved 2026-11-04 15:02
  CF5.gz64.1a2b3c4d.214532.
  H4sIAAAAAAAAA+y9a3PbyJIo+FcQ...            (wrapped at 76 characters)
  ...
  END
  ```
  The marker `CF5.<enc>.<crc>.<chars>.` carries the payload's **length**: `parseText` finds every marker anywhere in the
  paste and **counts** that many base64 characters after it, skipping whitespace and line breaks — it never looks for END
  (the letters E N D occur in random base64 about once in 262 K characters, which cut 56 % of whole-run backups in the
  design round's reader). Fewer characters than the marker says → `incomplete`; the crc decides the rest.
- **Parts**: a backup longer than `SAVE_SLOTS.partChars` (**9,000** characters, in code: a LINE message or a note holds
  about 10,000) comes as numbered parts (`composeParts`, in code): each part has the header line *CHICKEN FARM SAVE · format 5
  · part 2 of 25 (paste all 25 parts, in any order)*, the name line, the marker `CF5.<enc>.<crc>.<chars>.p2of25.` and its
  slice of the payload, at most 9,000 characters in all. Restore accepts every part pasted together, **in any order**, or
  the whole text; a part missing → `missing-parts` (the panel names which: *parts 3, 5 of 25*), parts of two different
  backups → `mixed`. The whole run at day 67 (about 214,000 characters) is 25 parts of at most 8,850 characters, the farm alone (about
  50,000) 6 parts (`composeParts`, measured).
- **Back up** (any slot or the autosave) opens the backup box under the row and **builds the text then** (the async gzip
  runs when the box opens, with *Preparing the backup…*), shows the two choices (*The whole run* / *This farm only*), the
  length in plain words (*About 214,000 characters: 25 parts of up to 9,000 characters each*) and one *Copy part k* key
  per part (or one *Copy* key). Each Copy key calls `navigator.clipboard.writeText(text)` **synchronously inside its
  click** with the text already built (Safari refuses a write after an `await`); when that is missing or rejects (the
  artifact viewer's iframe may not allow clipboard writes) the part's text shows in a read-only `<textarea>`, focused and
  selected, with *Press Ctrl+C (⌘C on a Mac) to copy, then keep it somewhere safe* (and tries `document.execCommand('copy')`
  once). No download, no `window.open`.
- **Restore**: a `<textarea>` *Paste a backup here (every part, in any order)*, a slot choice (an empty slot first) and
  [Restore]. `parseText` reads the markers (the header lines may be missing; whitespace inside the payload is ignored),
  checks the crc, decodes, migrates (§3.6) and checks the envelope; then the slot is written (asking first if it holds a
  farm). When the backup carries a skill profile with more points than this browser's, *Also bring its skill points (the
  larger of each)* is offered (`mergeProfiles`, in code). **With storage blocked** (no slot can be written) the restore box
  offers *Restore and play now* instead: the envelope goes into the run's memory copies (`run.importSave(envelope, {
  memoryOnly: true })`) and plays, with the `blocked` message saying it is gone when the page closes.
- A pasted **raw JSON** of the Phase 3–4 run key (`{"version":3,…}`) or of the Phase 2 level save (`{"version":1,…}`) is
  accepted too (a player who copied his localStorage by hand), as a format-3 / format-1 save (§3.6): `importText` tries
  `JSON.parse` of the trimmed paste first when it starts with `{`.

### 3.6 Formats and migrations (a republish of the page)
`SAVE_SLOTS.known`: **1** — Phase 2's brooding-week level save (`{ version: 1, level, env, farm, records, props, flock,
player }`); **3** — Phase 3–4's run save (`{ version: 3, savedAt, run, blob }`); **5** — the Phase 5 envelope.
`migrate(obj)` (in code, review round) turns each into a format-5 envelope: v1 → `{ run: null, blob, starts: [], meta }`
with `blob.level.levelId` set to `'level1'` (Phase 2's `level.serialize()` had no level id, so `checkEnvelope` would
refuse it; `run.importSave` makes it a run at the brooding week, as `run.continueSave` does since Phase 3); v3 → `{ run,
blob, starts: [] }`; 5 → itself. A
format above `SAVE_SLOTS.version` is refused with **newer**. The blob inside keeps its own Phase 2–4 fields: every restore
reads an absent field as null / 0 (as since Phase 3), so a Phase 3 blob loads in Phase 5 (test-saves plays one). The
live keys are never renamed and never rewritten by a migration (a republish keeps every autosave and slot; the artifact's
localStorage survives republishes to the same URL). A later build adds its migration (6 → …) at the end of the list and
keeps every earlier one.

### 3.7 Errors and messages (save-codec.js `SAVE_MESSAGES`, in code; no verdict words)
| Code | When | The panel says |
| --- | --- | --- |
| `not-a-save` | a paste with no `CF<n>.` marker and no JSON save | *This text is not a Chicken Farm save. Copy the whole backup, from its first line to END.* |
| `incomplete` | the crc does not match, or fewer payload characters than the marker says | *Part of the save is missing. Copy the whole backup again, from its first line to END, and paste all of it.* |
| `missing-parts` | a backup in parts with a part not pasted (the panel adds which: *parts 3, 5 of 25*) | *Some parts of this backup are missing. A backup in parts says “part 2 of 6” on its first line: paste every part, in any order, into the box.* |
| `mixed` | markers of two different backups in one paste | *These parts come from different backups. Paste the parts of one backup only.* |
| `damaged` | the bytes decode but do not unpack or parse | *This save is damaged and cannot be read.* |
| `newer` | format above 5 | *This save was made by a newer version of the game. Reload the page to get the newest version, then try again.* |
| `invalid` | `checkEnvelope`: no level / env / farm, an unknown level id, a day outside −2..71 | *This save does not hold a farm this version can load.* |
| `full` | a write threw (quota) or the slot would pass `SAVE_SLOTS.maxSlotChars` | *The browser's storage for this game is full. Delete a slot (back it up first if you want to keep it), then save again.* The old slot is kept as it was. |
| `blocked` | storage missing or throwing | *Saving is off in this browser (site storage is blocked or this is a private window). Back up your game as text instead.* (slots drawn disabled; Back up of the game in play still works; Restore offers *Restore and play now*, §3.5) |
| `load-failed` | `level.resume` threw or returned false | *This save could not be loaded. The farm you had is unchanged; the save is kept as it is.* |

A **load that fails after the resume began** (an exception inside `level.resume`) goes back to the title card
(`level.toTitle()`) with the message in the title card's note (`title.note(text)`, in code: a `role="status"` line under the
title's keys); nothing is deleted. The autosave that fails to write (quota) raises EV.SAVE `{ kind: 'auto-failed',
message }` once per level (saves.js decides; `run.saveRun`'s false is its signal): **ui.js shows it** (in code) as a HUD
caption, or at the top of the open panel — *The game could not save just now: the browser's storage is full. Open Save
or load to make room.* (add the code `auto-failed` to `SAVE_MESSAGES`). Any other EV.SAVE with `ok: false` and a message
shows the same way when the saves panel is not open (the panel shows its own). **The autosave row** whose key exists but
does not read (unparsable JSON, another version) gets the error code (`damaged` / `newer`) on its row like a slot, with
its message and *Delete*; the title card's Continue then skips it and the title's note says *The autosave could not be
read: Continue uses your newest slot.* when a slot is readable.

### 3.8 Sizes and quota (measured at the design round, node, the ideal cycle, seed 1)
The run key 72 KB after the brooding week, 190 KB at day 35, 171 KB at day 67; the starts 12 (level1) · 53 (week2) · 77
(week3) · 99 / 147 (weeks 4–5 days 22 / 29) · 152 (finish) · 148 KB (clean-out). A whole run at day 67: **857 KB** raw
JSON, **157 KB** gzip, **210 KB** base64 — a gz64 slot ≈ 0.21 M characters (three slots and the live keys ≈ 1.5 M), a json64
slot ≈ 1.15 M (`maxSlotChars` 1.6 M). test-saves asserts the day-67 slot at **≤ 300 KB** gz64 and **≤ 1.2 MB** json64, and a
backup text of it ≤ 300 K characters.

### 3.9 The saves panel (ui-saves.js; kind 'paused')
Four rows: *Autosave* (the game in play, or the last one) and *Slot 1–3*; each row: the name, the saved date and size, its
keys (Continue on the autosave; Save here · Load · Delete · Back up · Restore on a slot; disabled keys say why in their
title). The in-panel question replaces the row's keys with the question and its two answers, the first answer focused; Esc
answers the safe one (*Keep it* / *Cancel*) through the panel's `onKey(e)` (§8.6, in code: the panel host offers the open
panel every key before ui.js closes it on Esc or E), so the panel stays open. The backup box and the restore box open
under the row; their styles are the package's own (`injectStyle('saves-style', …)`, in code). At 960 × 600 the panel
fits without a scroll (four rows, one open box scrolls inside the panel). Every key is a `<button>` in the tab order; the
messages are `role="status"`.

## 4. The settings menu (package "settings"; the store is in code)

### 4.1 Every setting (`settings.js SETTINGS_SCHEMA`, in code; every one applied live through `settings.subscribe`)
| Path | Values (default **bold**) | Applied by | How |
| --- | --- | --- | --- |
| `sound.volume` | 0..1 (**0.7**) | sound (audio.js) | master gain `volumeToGain` (as Phase 4); the slider's `value` is the stored 0..1 value, its `<output>` shows the percent (*40 %*) |
| `sound.muted` | **false** / true | sound | the context sleeps 0.4 s after (as Phase 4) |
| `sound.background` / `sound.flock` / `sound.cues` | 0..1 (**1**) | sound | layer gains × value² (§2.6) |
| `time.defaultSpeed` | **1x** / 4x | experience (level.js) | the clock a level starts and resumes at (`fast`); the 1× / 4× keys still change it |
| `time.signStops` | **true** / false | experience (level.js `clock()`) | false: a sign or an unfolded plate runs the panel clock (`LEVEL1.clock.panel` 24) instead of 0 |
| `time.atJobSlow` | **true** / false | experience (level.js) | false: no ⅔ speed (`clock.atJob` 60) at an open job's place |
| `time.holdJobs` | **true** / false | experience (level.js `setHold`) | false: a job closes at its window even while he works at it (the farmer's request stays the default) |
| `graphics.quality` | **auto** / high / medium / low / custom | settings (ui-settings.js) | a preset of the three below: high = 1.5 · high · full; medium = 1 · low · full; low = 0.85 · off · reduced; auto = auto · auto · auto; changing one of the three by hand reads *custom* |
| `graphics.pixelRatio` | **auto** / 1.5 / 1.25 / 1 / 0.85 | settings (gfx-quality.js) | the cap of `min(devicePixelRatio, cap)`; auto: 1.5 and the governor |
| `graphics.shadows` | **auto** / high / low / off | settings (gfx-quality.js, in code) | high: 2048 PCF soft; low: 1024, the same soft filter; off: a 256 map drawn once with no caster and then never again (`shadowMap.autoUpdate = false`). `renderer.shadowMap.enabled` and `.type` never change (three 0.160 keys every program on both: a change would compile every lit material in the middle of play) |
| `graphics.flockDetail` | **auto** / full / reduced | settings (flock-render.js `setDetail`) | reduced: the low bird mesh (§4.4) |
| `graphics.showFps` | **false** / true | settings | a small *NN fps* readout on the time bar (perf.fps) |
| `camera.rotateSpeed` | 0.5..2 (**1**) | settings (player.js) | × `ORBIT_PER_PX` and `KEY_TURN` |
| `camera.zoomSpeed` | 0.5..2 (**1**) | settings (player.js) | × `WHEEL_ZOOM` and `KEY_ZOOM` |
| `camera.invertRotate` / `camera.invertZoom` | **false** / true | settings (player.js) | the drag and the arrow keys / the wheel turn the other way |
| `interface.hudScale` | 0.9 / **1** / 1.15 / 1.3 | experience (ui.js) | `--hud-scale` on `#hud`: the HUD cards scale from their corners (`transform: scale`), the left column re-stacked by `layoutLeft`; panels keep their size; under 1100 px wide at most 1.15 |
| `interface.watch` | **shown** / folded / hidden | experience (ui-watch.js) | folded: the four or five dots; hidden: no card (its warnings still come as captions and notebook lines) |
| `interface.soundCaptions` | **false** / true | experience (ui.js) shows, sound raises | §2.3 |
| `interface.captionTime` | **1** / 1.5 / 2 | experience (ui-caption.js) | every caption's seconds × value |
| `interface.helpLegend` | **first** / always / never | experience (ui-help.js) | first: as now (shown until *Got it*); always: at each level start; never: only on H |
| `interface.reducedMotion` | **system** / on | in code (motion.js) | on: `html.reduce-motion` and `reducedMotion()` true everywhere (no lightning flash, steady alarm lamp, no bobbing marker or pulsing chip, no generator shake, no CSS animation) |
| `keys.bindings` | `{ [action id]: code }` (**{}**) | settings (keys.js) | §4.3 |
| `intro.done` / `intro.seen` (hidden) | false / [] | experience (ui-intro.js) | §6.1 |

The store (in code): one key `chickenFarm.settings.v1`; values are validated and clamped on every read and write
(`coerce`); unknown keys are dropped; unreadable JSON gives the defaults; a blocked storage keeps the session's values
without throwing; the Phase 4 sound key is read once when no settings are stored and kept in step after. EV.SETTINGS
`{ group, key, value, prev }` follows every change.

### 4.2 The menu
A panel (`settings`, kind 'paused': the clock stands still) with six tabs (`role="tablist"`, arrow keys move between
tabs), each a list of labelled native controls (range with its value shown, check box, select). Opened from: the title
card (*Settings*), the game menu (*Settings*: opened with `{ returnTo: 'menu' }`, so Esc in Settings shows the menu again,
§8.6), the gear key on the time bar (the menu, then Settings), the speaker key's *Sound settings* (the Sound tab), and
`ui.openSettings(tab, via?)`. A *Reset this tab* key per tab. At 960 × 600 every tab fits
without a scroll except Keys (it scrolls inside the panel, never sideways). Settings hold for every mode (title, sandbox,
level). A short line under each tab says what it changes in plain words; nothing in it is a farming fact.

### 4.3 Keys and rebinding (keys.js, in code)
`KEY_ACTIONS` names every key with its default (the Phase 1–4 keys exactly; new: `map` **O** (overview), `pause` **P**,
`speed1` **1**, `speed4` **4**, `nextJob` **J** — review round: Tab stays the browser's focus key, so a keyboard player
reaches every HUD key, and the time bar's keys have keys of their own; `menu` Esc). In the Keys tab each action shows
its key(s); *Change* calls `ui.captureNextKey(fn)` (§8.6, in code) and waits for the next key press (*Press a key for
Squeeze a handful of litter… Esc cancels*): the capture comes before every other key listener, so W, E, the arrows and
Esc reach it (fn sees Escape and cancels). `keys.rebind(id, code)`: a key held by another action's **main** key **swaps**
with this action's main key (both rows show it at once); an action's **alternates** (zoomIn's Numpad +, the Numpad digits)
stay unless another action's main key takes one; `run` (Shift), `useDead` (Shift+E: follows `use`) and `menu` (Esc) are
fixed; reserved codes (Esc, the modifiers, Caps Lock, F5, F11, F12, Print Screen) are refused with *That key belongs to
the browser* and **Tab, Enter, Numpad Enter and Space** with *Tab, Enter and Space move through and press the game's
buttons* (`UI_CODES`, `REBIND_WORDS`, in code). `actionOf` checks the actions with a Shift rule first (Shift+E is
`useDead`, plain E is `use`). *Reset all keys* gives the defaults. Every key check moves onto `keys.matches(e, id)`:
**ui.js** (experience: use, useDead, bucket, squeeze, probe, lux, air, notebook, skills, floorView, comfortView,
moistureView, help, menu; map, pause, speed1, speed4 and nextJob are in code), **player-input.js** (settings: forward,
back, left, right, run, turnLeft, turnRight, zoomIn, zoomOut), **audio.js** (sound: sound). The controls legend
(ui-help.js), the guide (§6.2), the title card's key line and the prompt pills read `keys.labels(id)`, so a rebound key
shows everywhere (test: Q → B; B squeezes, Q does nothing, the legend reads *B Squeeze a handful of litter*).

### 4.4 Graphics: the governor's steps, flock detail
`gfx-quality.js` (in code) holds Phase 1's governor unchanged for **auto**: every 2 s the median frame; over 36 ms (about
28 fps) one step down, 3 s apart: (1) a high-DPI screen to pixel ratio 1.0; (2) the simple shadow (1024 PCF); (3) under
20 fps (50 ms) the 0.85 render scale. Phase 5 adds two steps at the end, only for settings left on auto: (4) flock detail
reduced; (5) shadows off; then it stops. Review round (in code): step 2 keeps the soft filter on a 1024 map and step 5 keeps
`shadowMap.enabled` (an empty map, no longer drawn) — Phase 1's step 2 switched PCF soft to PCF, which compiled every lit
material again mid-play on exactly the slow machines the governor serves; three 0.160's program key holds
`shadowMapEnabled` and `shadowMapType`, so neither ever changes after the warm-up. A setting set by hand pins that part (the governor skips its steps); setting one
back to auto starts that part from the top (`restart`). Under automation the governor stays off (`navigator.webdriver`),
as since Phase 1; `quality.debug.feed(dt, n)` drives it in tests.
**Flock detail reduced** (flock-render.js `setDetail('reduced')`): the same instances, the same colours and poses, a bird
mesh with at least 40 % fewer triangles than the 113 of `buildBirdGeometry`'s LOD 0 (the body a lower-segment shape, no
separate wing tips; measured on the flock's own meshes: index count ÷ 3 × drawn instances of `flock.meshes`, not the
view's total, of which the birds are only about 200 K of 312–553 K), and the pose update of birds
more than 25 m from the camera every second frame. At the default zoom its look matches full detail (p5-gfx's screenshot
pair); the flock's metrics and behaviour do not change (they are not drawn).

### 4.5 Camera
`camera.rotateSpeed` and `camera.zoomSpeed` multiply the drag / arrow-key turn and the wheel / +− zoom (player.js
`ORBIT_PER_PX` 0.0055 rad/px, `KEY_TURN` 1.7 rad/s, `WHEEL_ZOOM` 0.0015, `KEY_ZOOM` 1.3); the inverts flip the sign. The
follow, the pitch and the zoom limits (6–45 m) are unchanged. Under reduced motion the follow has no look-ahead lead
(`LEAD` 0) and the view turns by the arrow keys at a steady rate (as now).

## 5. The farm overview map (package "experience")

### 5.1 What it shows (two views: **Farm** and **House**, tabs at the top)
- **Farm** (config `MAP.farm`: the fence and the farm road's first metres outside the gate; north up): the grass inside the
  fence, the fence and the gate, the farm road and the concrete paths, the rice fields' edge, the trees as dark rounds, the
  **house** (its roof cut away: the pad at the west end, the six fans at the east end, the four drinker lines, the three
  feeder lines, the eight brooders, the brooding curtain while it is down), and every building in its own flat colour
  (`config.COLORS`): office, guard hut, silos with the auger, water tank, generator house, gas tank, wash bay, loading bay,
  litter heap, dead bin, chick table and boxes (while they stand), the catching truck at night of day 41–42.
- **House** (`MAP.house`): the house alone at about 2.5 × the Farm scale: the equipment above, every north-wall board and
  machine, the water supply, the regulators, the bird scale, and the flock.
- **Live things** (drawn when it opens; the clock stands still while it is open, so nothing moves under it): the
  **farmer** — an orange arrow at his position pointing where he faces (facing = (−sin yaw, −cos yaw), as `interact`
  reads it); the **open jobs' places** — an orange marker with the job's number from the job card at each place
  `jobCard.spots()` gives (the same `spotFor` the 3D marker uses; the current job's marker larger, a multi-place job's
  unfinished places each); **dead birds** on the floor — small dark crosses at each drawn dead bird (`flock.dead`'s
  positions) with the count beside the house (*3 dead birds*, the farm's `deadOnFloor`); the **bucket** set down
  (`props.bucketDown`) with its count; the **flock's spread** — every drawn bird as a 2 px (Farm) or 3 px (House) dot in its
  colour (chick yellow to broiler white), so a huddle under the brooders, birds along the walls or an empty end read at a
  glance (`flock.positions()`, in code: `{ n, x, z, size, morph }`, read-only views of the flock's arrays, read when the map
  opens); a power cut — the house drawn dark with *No power* on it; rain — a soft blue wash with *Raining*; **the house
  resting** (`farm.house.closed`, the rest days: props' `doorShut` collider makes every inside place unreachable) — the
  house drawn shut with *The house is shut while it rests* on it, its inside places faint and not walkable (their tags
  say the same words; a click does nothing but show them).
- **Signs** as small numbered posts; their names on hover and focus, and in the side list.

### 5.2 Places (`map-plan.js MAP_PLACES`, in code: 44 places)
Buildings and areas (labels always shown): Chicken house, Office, Guard hut, Farm gate, Feed silos, Water tank,
Generator, Wash bay, Loading bay. Machines and spots: Gas tank, Cooling pad pump, Rice husk heap, Chick sample table, Dead
bird bin, Foot dip at the gate. Signs outside: gate, production planning, chick arrival, flock health, catching and loading,
clean-out, feed program, power cut. Inside: climate controller, brooder sign, feeder control box, water lines sign,
minimum ventilation sign, litter sign, light program sign, curtain winch, opening-up sign, legs and feathers sign, air
quality sign, droppings sign, heat sign, fan panel, water supply, drinker lines 1–4, bird scale, catching panels.
Each place: `{ id, name, kind, at, inside, rect?, label, panel? }`; `standOf(place)` is where a click walks him (in front
of a north-wall board at z −4.6; else its spot, moved off any collider by the route finder's `freeSpot`). The conditions'
places (generator, water tank, power sign) are drawn in every run (the buildings stand in every run); a place whose thing
is not on the farm now (the chick boxes after placement, the catching panels before day 41) is drawn faint and still walks.

### 5.3 Using it
- **Open**: **O** (keys.js `map`, rebindable; in code) with no panel open and the focus outside a text box, in a level and
  in the sandbox; the map key on the time bar; the menu's *Farm map* (with `{ returnTo: 'menu' }`: Esc on the map shows the
  menu again). Tab always moves the focus (accessibility, §6.6).
- **Close**: Esc or the close key (back to the menu when it was opened from there), or a place picked (the whole chain
  closes and he walks: `closePanel({ all: true })`, in code).
- **Names**: hover or focus a place → a tag with its name and the walk: *Feed silos · about 64 m · 16 s walking (about
  24 farm minutes at 1×)* — the route's length from `findPath` (player-path.js; the farmer's radius 0.35 m, the colliders,
  `FARM.walk`), walking at 4 m/s, farm minutes at `LEVEL1.clock.work`. An open job's marker tags its job (*1 · Read the
  water meter · the water supply*).
- **Walk**: click (or Enter / Space on a focused place, or a click on open ground inside the fence in the Farm view, or on
  the floor in the House view) → the map closes, then `player.walkTo(stand.x, stand.z)` (a double click or Shift runs). The
  route is the 3D game's own: round the house, in at the door; the target ring shows where he goes. **In the Farm view the
  house is one target**: its inside places are about 5 px apart there (the water supply and drinker line 4 less), so a
  click on the house opens the House view (the inside places are picked there, or from the side list); the *Chicken
  house* place (its stand point is the door, `SPOTS.houseDoor`) in the side list walks him to the door.
- **Keyboard**: the side list holds *Jobs now* (each open job's place, nearest first) and *Places* (grouped: buildings,
  machines outside, signs outside, inside the house); Tab / Shift+Tab move through the view tabs, the list and the close
  key; arrow keys move within the list; the focused place is outlined on the map.
- The house tab and the Farm view read the same data; switching keeps the focused place.

### 5.4 Layout
Readable at **1280 × 800** and **960 × 600** (the harness sizes): the panel uses up to 1100 px × (the window − 32 px); the
map box at 960 × 600 is at least 600 × 380 px (Farm: about 5.2 px a metre; House: about 13 px a metre), the side list 220
px (under 860 px wide it goes under the map). Labels are 12 px Chakra Petch at least (`MAP.minLabelPx`) with a dark halo;
the always-shown labels never overlap (map-plan.js places each label north, south, east or west of its building, chosen
so the boxes are clear at both sizes; test-map checks it with the font's measured widths, at the map boxes of 1280 × 800,
960 × 600 and a **600 px** wide box, the smallest the layout allows — *Feed silos* and *Water tank* are the pair that
overlaps first). Colours: the game palette
(config `COLORS`, index.template.html variables); the markers orange as in 3D; the farmer's arrow orange with a dark edge;
every state also in words (the tag, the side list), never colour alone.

## 6. The final quality pass

### 6.1 First play (package "experience": ui-title.js, ui-intro.js)
- **Title card**: the Phase 4 card with the Phase 5 keys added by `title.addAction` (in code): *Load a saved farm*
  (saves), *Settings* (settings), *How to play* (settings). With no save and no stored settings (`settings.stored` false)
  a first-run line under the buttons: *New here? Start a new flock: the first morning points out the job card, the signs and
  the clock.* The focus starts on Continue when there is a save, else on *Start a new flock*. The key line under the
  buttons reads its keys from keys.js.
- **The introduction** (`ui-intro.js`, `INTRO_CARDS` in code): four cards, one at a time, each a small card with an arrow to
  its anchor's on-screen box: **jobs** (the job card, at the first level start), **signs** (the nearest sign interactable
  within 25 m that is on screen; on the planning day the gate sign, in the brooding week the chick arrival sign),
  **time** (the time bar), **watch** (the flock watch card, the first time it shows). Keys: *Next* (*Got it* on the last
  of a group), *Skip the introduction*; Enter and Esc work on the focused card: while a card shows the intro holds
  `ui.claimKeys(fn)` (§8.6, in code), so Enter and Esc reach the card first and Esc never opens the menu behind it. The
  cards' words name the keys as `{key:<id>}` tokens (in code), filled with the live bindings by `fillGuide`. While a card
  shows, `ui.panelKind` reads 'paused' (in code), the farmer can still turn the view. Remembered in `intro.seen` / `intro.done`; reset by the guide's
  *Show the introduction again*. A player who opened any panel before the first card skips nothing: the card waits until
  no panel is open. No card on a replay, a Continue or a standard start once `intro.done`.
- **Under automation** (`navigator.webdriver`, as `level.boot` keeps the sandbox there since Phase 2) the introduction never
  starts by itself, so every earlier steps file (most clear the storage first) plays as before; `p5-first-play.json` calls
  `__game.ui.intro.allow(true)` first and then plays the real first run.

### 6.2 How to play (package "settings": ui-guide.js, content-guide.js — working stub in code)
A paused panel with the sections of `GUIDE` (getting around — the live key bindings —, your day, signs and plates,
reading the flock, records, levels, skill tree, time, saving, sound and settings), opened from the title card, the menu,
the controls legend (*Full guide* link) and `ui.openGuide(section)`. It says how the **game** works; every farming fact
stays on the signs (test-contracts: no verdict word, no farming figure). The package writes the final words (short,
plain English a Thai farmer reads easily: one idea a sentence, the HUD's own names in bold), adds a small labelled picture
of the HUD (the cards' positions as boxes with their names) and *Show the introduction again*. Review round (in code):
the words name keys and the Time settings by tokens — `{key:squeeze}` is `keys.label('squeeze')` (*B* after a rebind),
`{time:signs}` / `{time:atJob}` / `{time:hold}` the sentence for the Time setting now — filled by `fillGuide(text, { keys,
settings })` each time the guide opens; the clock's sentence says signs **stop** the clock (the default); the skill tree's
says *Points come from what happens on your farm when you do a branch's jobs in play* (no praise).

### 6.3 Loading and error messages (package "experience": boot-screen.js, index.template.html; main.js wiring in code)
- The loading card names its step (in code: `await bootScreen.step('Building the farm')`, *Bringing in the flock*,
  *Warming up the graphics*; each step lets the page paint). The bar keeps moving (no bar animation under reduced motion:
  the steps' words carry it).
- `BOOT_ERRORS` (in code): **webgl** (no WebGL), **library** (three.js never loaded: the module script's `onerror`, or the
  template's 20 s timer while `window.__bootStarted` is unset — main.js sets it as the module starts), **slow** (the 20 s
  timer while the module runs: the farm is still building on a slow connection or computer — *Still loading… a slow
  connection or computer can take a minute.* goes under the step words and the card stays, review round, in code),
  **load** (start threw), **stopped** (three thrown frames in a row), **context-lost** (`webglcontextlost`: the game
  saves now — `level.saveNow()` to expose, experience — and the words follow its answer, in code: saved → *The graphics
  stopped… The game was saved just now: reload the page and press Continue*; not saved (the title card, the sandbox, a
  result) → *…Reload the page; Continue goes on from the last time the game saved*). Each message: what happened and what to do, 16 px, centred, a *Reload the page* key where reloading helps
  (a `<button>` calling `location.reload()`).
- The saves' messages (§3.7) and the autosave-failed caption.

### 6.4 Visual polish across levels and conditions (package "experience"; scripts/p5-look.json)
A look pass with a checklist, shot at **1280 × 800** and **960 × 600** for each view below, and fixed where it fails:
the title card (first run and with a save) · the planning day at the office and the planning sheet · the prep day in the
house · day 0 placement with the chick table · day 3 by night · week 2 day 10 (the curtain) · week 3 day 16 afternoon ·
weeks 4–5 day 30 (heat wave) · the rainy day 33 storm and the power cut (dark house, alarm banner) · the bad batch's grading
tab · the water condition's tank panel · the catching night · the wash bay and the clean house · a rest day · each result
screen and the cycle summary · the menu, settings (every tab), saves (with a question open), map (both views), guide.
Checklist: **(a)** HUD cards in one style (the feed-sack card, stitched seam), one type scale (labels 11 px caps, values
the display face, running text 12 px or more: §6.6's floors), aligned to the 16 px gutter at both sizes, no card covering another (the job card, the flock watch, the
alarm, the captions, the prompt, the dead-bird chip, the intro card); **(b)** every panel's close key in the same place and
style, headings in the display face, the same paddings; **(c)** no clipped or cut text anywhere (the flock watch's warning,
§6.8.3; long condition names in the clock card; the job titles); **(d)** 3D: no z-fighting or flicker on the boards, the
house's cut-away clean in every condition, the rain hidden over the cut-away house, the night readable, the power cut dark
but the farmer and the generator path visible, the catching crew and crates fading where they block the farmer; **(e)** no
console warning or error in any view. **Who fixes what** (review round): the HUD and the experience package's panels —
experience; the **3D items of (d)** — package **settings**, which owns `world*`, `house*`, `props*` for the performance
pass (experience's p5-look shots list them in its report, settings fixes them); the look of the settings, guide, saves
screens — their packages, in their own injected styles; the **cross-panel look and a11y pass** over every screen together
(one type scale, the close keys, the focus rings across ui-settings, ui-saves, ui-guide, ui-map) — the **integrator,
after all four merges**, with p5-look and p5-a11y's checklist results in the report.

### 6.5 Performance on real GPUs (package "settings": gfx-quality.js and the 3D files it owns; scripts/p5-gfx.json)
- **Budgets** (config `GFX.budget`, checked by `__game.renderInfo()` at named views, 960 × 600, pixel ratio 1): draw calls
  ≤ **110** and triangles ≤ **650 K** in every view of p5-gfx.json (the yard by day and night, inside at days 3 / 30 / 41, the
  apron, zoom 45, the rainy storm, the power cut, the catching night with the crew and crates, the wash bay, the map and the
  settings open); **shader programs**: no program compiled after the warm-up — counted by `renderInfo().linked` (in code:
  main.js wraps `gl.linkProgram`; `renderInfo().programs` cannot see a recompile, a replaced program is released and the
  count stays 66) — **zero links after the warm-up** across every view and condition, the governor's steps
  (`quality.debug.feed`) and the *Low* and *High* presets, so nothing compiles in the middle of play on a real GPU (the
  design stubs check the four shadow settings: 66 linked before and after).
  Measured at the design run: draw calls 66 (sandbox spawn) · 76 (day 3 yard) · 87 (day 3 inside) · 70 (day 30 inside) · 90
  (day 30 apron, 14:00 and 22:00) · 93 (day 30 yard at zoom 45, 22:00); triangles 312–553 K; 66 programs.
- **The flock's cost**: reduced detail −40 % of **the flock meshes' own** triangles or more (index count ÷ 3 × drawn
  instances, summed over `flock.meshes`; the view's total stays under `GFX.budget` as its own check); `flock.update` at
  1,800 drawn birds stays at a median ≤ **4 ms** over 300 frames (p5-gfx times it with `performance.now()`; measured at the design run in headless
  Chrome on this machine: 1.8 ms on day 3, 2.6 ms on day 30, p90 6.1 / 3.6 ms).
- **The governor's steps** (§4.4) with `quality.debug.feed`: frames of 60 ms → the simple shadow, then 0.85, then reduced
  flock, then shadows off, 3 s apart; frames of 30 ms → no step; a manual setting pins its part.
- **What the farmer's tester looks at on a real laptop**: *Graphics → Show the frame rate*; the settings' Graphics tab
  shows the steps the governor took (*Automatic: shadows simple, sharpness 1*).

### 6.6 Accessibility (package "experience"; the panels' ui-*.js files; scripts/p5-a11y.json)
- **Keyboard for everything**: every HUD key, menu entry, panel control, tab and map place is a native `<button>`, input,
  select or link in a logical tab order (title: Continue, Start, Start at the brooding week, the quiet keys, the run card;
  HUD: the job card, the time bar; panels: their content top to bottom, the close key last); Tab stays inside an open panel
  (exists); Esc closes it and the focus returns to what opened it (exists); tab lists move with the arrow keys; the map's
  places with Tab and the arrows. **Tab is the focus key everywhere** (review round: the map is on O). A player can play a
  whole day with the keyboard alone: walking (WASD), E, the panels, the clock (**P** pause, **1** / **4** the speed, **J**
  Next job — keys.js, wired in ui.js in code: each presses the time bar's own key), the menu (Esc), the map (**O**), or
  Tab to any HUD key and Enter — p5-a11y plays the prep day's first job and a sign read without the mouse, and presses
  Next job and the map by key. **A mouse click leaves no focus on a time-bar key** (in code: ui-hud.js blurs a key after a
  pointer click, `e.detail > 0`, as audio-ui.js does), so the farm's keys keep working after a click.
- **Visible focus**: every focusable element shows a 2 px `--focus` (#ffd447) outline offset 2 px (`:focus-visible`), never
  removed; checked by p5-a11y on every focusable element of the title, menu, settings, saves, map and one machine panel.
- **Readable sizes** (review round: two floors, as the template's type scale has them): **11 px** for uppercase labels
  (`.label`, the card kickers, the watch's row names) and the sign **source lines** (`.src`: the approved rules want them
  small), each with a contrast of at least **4.5 : 1** against its background; **12 px** for every other (running) text in
  the HUD and the panels, at the default HUD size (computed font size; p5-a11y checks the two classes separately). The
  template has about 60 rules at 10–11.5 px today: the ones under the floors go up (the job card and the 288 px watch card
  keep their width at 960 × 600: their running text wraps, never clips — §6.8.3); larger text comes from the HUD size
  setting (§4.1); captions and messages stay `interface.captionTime` × their time.
- **Colour plus text**: every state shown by colour also shows a word or a shape: the flock watch dots (their row's word:
  steady / watch / alert, `aria-label`), the fan pips (*6 / 6*), the brooder flame (*On* / *Off*), the lit switch keys (their
  state text, Phase 4), the floor views' legends (words under the ramp), the map's markers (numbers and tags), the save rows
  (messages), the alarm (the word *Alarm* and its banner).
- **Screen readers** (light touch): the caption and the panel notice are `aria-live` status (exists); the sound captions
  too; every icon key has an `aria-label`; the 3D view keeps its label.
- **Reduced motion** (§4.1): the class, the 3D stills, the camera lead.

### 6.7 Narrow screens and phones (package "experience": ui-help.js `createNarrowNotice`, index.template.html)
At 390 × 844 and 412 × 915 (and any window under 700 px wide, or a coarse pointer) the note shows as now; its words say
what works: *Chicken Farm is played on a desktop or laptop with a keyboard and a mouse. You can look at the farm here, but
the jobs need a keyboard.* *Look anyway* is remembered for the session. Nothing scrolls sideways
(`document.scrollingElement.scrollWidth ≤ innerWidth`, p5-a11y at both sizes), its keys are at least 44 px high, and the
title card, the menu and the settings are usable at that width (one column).

### 6.8 The Phase 4 leftovers
1. **The water condition's Supply row amber on day 33 with a full tank** (package "saves": flock-watch.js `supplyRow`).
   The meter's litres per 1,000 birds of the last 3 hours were compared with the same clock hours of day 32, the heat
   wave's last day (more drinking), so day 33's meter read under 85 % with the tank at 95 % and the pump at its plate.
   **Fix**: the meter makes the row amber only together with a supply cause — the tank under 90 % or falling at least
   `supplyFallMin` (1 %) an hour, the pump worn (≤ `wornBar`) or stopped — and the comparison uses lit hours only on both
   days, leaving out any hour of the heat-wave lift, the withdrawal, a cut or the main valve shut (as now). **Test**
   (test-watch, new case): the water condition's ideal on day 33 at 12:00 and 15:00 reads Supply **green** with the tank ≥ 90
   %; `waterPumpUnfixed` still warns on day 30 about 6.8 farm hours (≥ 6) before the tank is under 20 %; the ideal's warning
   list (test-watch's allow-list) is unchanged. **The iron filter still shows** (review round: with the meter alone no longer
   raising the Supply row, a clogged filter — day 24 04:00, flow × 0.6, the tank full, the pump at its plate — reaches the
   watch only through the intake row): a second new case runs `waterFilterLate` (the filter left until its flow test on
   day 24 is skipped) and asserts a warning on the intake or the Supply row whose cause names the filter (*the water
   supply's filter*, its plate and place) within the same farm hours of day 24–25 as on main before the change (the
   package measures main's hours first and writes both in its report).
2. **A bad batch's fail line says "day 1" for the claim closed at 24:00 of day 0** (package "experience": level.js
   `claimClosedCheck`, `computeResult`). The env stepper that ends the level at the claim's close runs just after midnight,
   so `env.dayNumber` is 1 and the result reads *deaths and culls reached 2.6 % on day 1* and *ended day 1, 00:00*. **Fix**:
   the check passes its day to the result (`failAt { day: 0, hour: 24 }`): *deaths and culls reached 2.6 % by 24:00 of day
   0, when the hatchery claim closed (the 166 chicks graded out count as culls: the hatchery was not told on day 0)*;
   *Ended day 0, 24:00*; `failDay` 0 (the run's replays start from the level's own start, as now). **Test** (test-fixes, new
   case): a bad batch graded at the table, the record signed at 20:00, no call → the result's text contains "day 0" and
   "24:00" and not "day 1"; `failDay === 0`.
3. **The flock watch's warning box cut at 5 lines** (package "experience": ui-watch.js, index.template.html
   `.fw-warn-in { -webkit-line-clamp: 5 }`). The supply and the cut warnings run 7–9 lines on the 288 px card. **Fix**: no
   clamp; the box shows the whole warning; when the card would reach the time bar (its bottom within 12 px of `.hud-bl`'s top)
   the box gets a `max-height` of the room left and scrolls inside, with a fade and *more below* while it is not at its end;
   the notebook keeps the whole text (as now). **Test** (`scripts/p5-hud.json`): at 960 × 600 and 1280 × 800 the water
   condition's supply warning (the longest, about 520 characters) — its last word is visible after scrolling the box
   (`scrollHeight − clientHeight ≤ 1` or the box scrolls to its end), the card never overlaps the time bar or the job card.
4. **The hot season's ideal loses no weight** (package "saves": farm-tuning.js, farm-cycle-step.js, flock-watch.js,
   content-signs-cond.js, test-cond / test-cycle / test-watch). Thai April–May heat costs a flock appetite even when the
   pads and fans keep it out of panting: the air behind the pads still stands above 28 °C through the hot hours, the
   birds eat less then and do not fully make it up at night. Now the intake falls only above the panting reference
   (`heatIntakeP4`: 4 % a °C over `hotFrom`), which a well-cooled flock never reaches, so the hot ideal ended at 2,875 g
   against the normal 2,887 g (0.4 % lighter; finish `liveG`, seed 1, measured at the review round).
   **Why not a comfort term** (review round): the design round's `appetiteP5(e, age)` keyed on e = felt − target cut the
   normal season as much as the hot one (mean factor 0.966 against 0.957 over days 15–35 of the two ideals): both seasons
   run the same e when they are well managed. What differs in April is the **absolute air** behind the pads: the hot
   ideal's house mean is 28.9–30.0 °C over days 21–41 (daily highs 32.8–33.0 °C), the normal ideal's 26.8–29.4 °C.
   **Fix** (model, the hot season only): one more intake factor in `cycleFactors` (farm-cycle-step.js, beside `fHeat`),
   `fx.fHot = appetiteHot(farm.condition, env.houseTemp, age)` with
   `appetiteHot = condition === 'hot' && age ≥ 21 ? max(0.85, 1 − 0.025 × max(0, houseC − 28)) : 1` (farm-tuning.js
   `TUNING.hotAppetite { fromAge: 21, aboveC: 28, perC: 0.025, floor: 0.85 }`, constants **model**), and
   `fx.f = fSpace × fForm × fHeat × fHot × fHealth × shock × lame`. **Measured at the review round** (the term patched into a
   scratch copy, `runCycle('hot:ideal')` against `runCycle('ideal')`, to `finish`): the hot ideal **2,788 g against 2,887 g:
   3.4 % lighter** (seeds 2 and 3: 3.4 % too), FCR 1.569, EPEF 416, weeks 4–5 passed (day-35 2,230 g), the harvest passed;
   the slope's range: 0.02 → 2.8 %, 0.03 → 4.0 %, 0.04 → 5.1 %, and 27 °C at 0.03 → 5.8 %. **Bands** (test-cond, test-cycle):
   the hot ideal **2–5 % lighter** than the normal ideal of the same seed, FCR ≤ 1.62, EPEF ≥ 390, every level passes
   (weeks 4–5's day-35 weight ≥ 95 % of the target), every branch reaches level 2; the hot season's named mistakes fail as
   before; **the normal season does not change at all** (the term is 1 outside the hot season: test-cycle's ideal digest and
   every band byte-identical — a new normal-season digest check in test-cycle compares the ideal's day-42 row with main's;
   test-sim byte-identical; the Phase 3 play-throughs unchanged). The heat sign's hot-season line (content-signs-cond.js,
   **general practice**): *In April–May heat the birds eat less in the hottest hours, even with the pads and fans running:
   a hot-season flock often finishes a little lighter, about 2–5 % (general practice).* — its figure is what test-cond
   measures (the hot ideal against the normal ideal). **The flock watch** (flock-watch.js): the intake row's standard is
   the expected intake — each sample keeps `hotK` (the hour's `farm.cyc.fx.fHot`, 1 outside the hot season) and the row's
   `want` is multiplied by it — so the expected dip of a hot afternoon reads green and sends no amber *likely cause: heat*
   that would send the farmer to add fans to well-cooled birds; the row's detail adds *(hot season: the birds eat a little
   less in the hottest hours)* while `hotK` < 1; an intake under even that expectation warns as before. test-watch: the hot
   ideal's warning list (the allow-list) unchanged and no intake amber on days 21–41 caused by `fHot` alone.

### 6.9 Docs
ARCHITECTURE.md gets a **Phase 5 — as integrated** section at the merge (the integrator) and each package's notes in its
report; PHASE5.md §6.8 and §9 get the measured numbers at integration; the in-game guide (§6.2) is the player guide.

## 7. What Phase 5 does not change
- **Jobs, rounds, levels, targets, pass / fail**: none added, none changed (the daily jobs table of PHASE2.md applies every
  day as before). The Time settings (§4.1) can switch off the clock's stops, the ⅔ speed at a job's place and the held jobs;
  their defaults are the farmer's requests and no window, close or rule of the job engine changes.
- **Skill milestones and unlocks**: none added, none changed; the map, the settings and the guide are not unlocks.
- **Sign facts**: one new line (the hot season's appetite, §6.8.4, general practice, its figure measured). No guide-tagged
  fact; no page numbers.
- **Records**: the daily flock records are as in Phase 4 (the hot season's lighter weights show in them; the watch's
  notebook lines unchanged). A save, load or backup writes no record line.
- **3D content**: no new model; the reduced-detail bird mesh (§4.4); the 3D marker's and chips' reduced-motion stills; the
  performance merges of §6.5 keep every look (p4-scene-look's and p3-scene-look's pixel checks still pass).
- **The farm model**: only the appetite term (§6.8.4) and the supply row's rule (§6.8.1); test-sim's Phase 2 digest is
  byte-identical, every other test band holds.

## 8. Contracts between packages (in code now)
Shared, integrator-owned and **frozen** for the packages: `src/config.js` (the Phase 5 section after the fourth banner),
`src/events.js`, `src/motion.js`, `src/main.js` (wiring, `__game` hooks), `src/interact.js`, `src/clock.js`, `build.mjs`,
`scripts/shoot.mjs`, `scripts/test-contracts.mjs`, `scripts/test-perf.mjs`, every earlier steps file and
`scripts/p5-design-stubs.json` (review round: it drives only the frozen DOM hooks of §8.10 and the hooks of §9.2, so the
packages can rebuild every screen under it; a package whose work changes one of its expectations says so in its report
and the integrator edits the file). A file a package owns keeps its **contract** (the exported names, signatures and shapes
below) frozen: the package may add to it, never change it. Need a change in a frozen file? Put it in your report.

### 8.1 What is in code now
| File | Owner after the design round | What it is now |
| --- | --- | --- |
| `src/config.js` (Phase 5) | integrator | `BUILD`, `SAVE_SLOTS` (count 3, keys, format 5, `known`, `maxSlotChars`, `partChars` 9,000), `SETTINGS_STORE`, `GFX` (governor, shadows 2048 / 1024 / 256, budget), `MAP` (views, stand points) |
| `src/events.js` | integrator | `EV.SETTINGS`, `EV.SAVE`, `EV.SOUND_CAPTION`, `EV.MENU` (§8.2) |
| `src/motion.js` | integrator | `reducedMotion()` (the system or the setting), `setMotionOverride`, the `reduce-motion` class; `ui-dom.js` and `world-cond.js` re-export it |
| `src/settings.js` | settings | the store (complete): `SETTINGS_SCHEMA`, `createSettings`, `coerce`, `defaults`, `soundView` |
| `src/keys.js` | settings | the key table and matching (complete; review round: map O, pause P, speed1 1, speed4 4, nextJob J; main key and alternates; `UI_CODES`, `REBIND_WORDS`; Shift rules first in `actionOf`) |
| `src/gfx-quality.js` | settings | Phase 1's governor moved out of main.js (unchanged under auto but for step 2's filter, §4.4), manual pixel ratio / shadows (no shader link: §4.4, in code) / flock detail, `debug.feed` |
| `src/flock.js` | settings | `positions()` added (review round, for the map) |
| `src/ui-settings.js` | settings | a working stub: one generic control per setting, tabs, *Reset this tab*; the Keys tab read-only |
| `src/ui-guide.js`, `src/content-guide.js` | settings | a working stub: the guide's sections with the live keys; `fillGuide` and the `{key:…}` / `{time:…}` tokens (complete) |
| `src/saves.js` | saves | a stub: Continue / the Continue line on Phase 4's autosave, `continueAuto`; slot calls answer `not-built` |
| `src/save-slots.js` | saves | `metaOf`, `slotName`, `makeEnvelope`, `checkEnvelope`, `mergeProfiles` (complete); `migrate` (v1 with `levelId 'level1'`, v3, v5), `createSlotStore` (stub) |
| `src/save-codec.js` | saves | `crc32`, `SaveError`, `SAVE_MESSAGES` (+ `missing-parts`, `mixed`), `composeText`, `composeParts`, `partRanges`, `parseText` (complete, review round: the marker carries the length, the reader counts, parts in any order; checked by 300 random whole-run-sized backups in test-contracts); `encodePayload` / `decodePayload` json64 only (gz64 to add) |
| `src/ui-saves.js` | saves | a stub panel: the autosave row with Continue, three slot rows with disabled keys; the menu and title entries |
| `src/ui-menu.js` | experience | the game menu: `createGameMenu`, `add`, `open`, `entries` (complete; look to polish); entries get `via` (§8.6); the arrows through `onKey`; the focus back on the entry picked |
| `src/ui-map.js`, `src/map-plan.js` | experience | a working stub: an SVG farm (fence, road, buildings, labels, the farmer's arrow) and every place as a key that walks him there; `MAP_PLACES`, `standOf`, `projector` |
| `src/ui-intro.js` | experience | `INTRO_CARDS` (their words with `{key:…}` tokens); a stub that never shows a card |
| `src/boot-screen.js` | experience | `BOOT_ERRORS` (+ `slow`; `context-lost` by the save's answer), `createBootScreen` (`step`, `error`, `hide`) used by main.js |
| `src/ui-title.js` | experience | `addAction`, `refresh`, `note(text)` added |
| `src/ui-panels.js` | experience | `busyIds()`; review round: `open(id, { returnTo })`, `register(…, { parent: true })`, `closeAll()`, `parentIds`, the panel's `onKey` (§8.6) |
| `src/ui-hud.js` | experience | review round: a time-bar key is blurred after a pointer click; `buttons` { pause, speed1, speed4 } for the time keys |
| `src/ui-dom.js` | experience | review round: `injectStyle(id, css)` (§8.11) |
| `src/ui.js` | experience | the hubs wired: the menu (Esc with its guard, the gear key), the map (O and the map key), the time keys (P, 1, 4, J), the key hooks (`captureNextKey`, `claimKeys`, the panel's `onKey`), the return path (`openPanel(id, via)`, `closePanel({ all })`, the result and summary as parents), the settings / guide / saves panels registered, the intro, sound captions and EV.SAVE messages shown, `ui.menu`, `ui.title`, `ui.map`, `ui.intro`, `openSettings`, `openGuide`, `openSaves`, `busyPanels`, `parentPanels`; Continue through `ctx.saves` |
| `src/ui-icons.js` | experience | `map`, `gear`, `save`, `help` icons (a package needing another icon defines it in its own file, §8.11) |
| `src/index.template.html` | experience | the `reduce-motion` class rule; the shared frame of the new panels (the settings, saves and guide rules moved into their modules); the boot timer's *still loading* line; `.title-note` |
| `src/main.js` | integrator | settings and keys first; `ctx.world`; quality; saves after the run; audio on `soundView(settings)`; the staged loading card and `window.__bootStarted`; `webglcontextlost` with `saveNow`'s answer; the `gl.linkProgram` counter; `__game.settings / keys / quality / saves / perf / renderInfo()` |
| `scripts/test-contracts.mjs` | integrator | Phase 5 cases: settings, keys (+ the review round's rebind rules), codec (+ 300 random backups, parts, END planted) and names, migrate v1, guide (`fillGuide`) / map plan / motion, the governor (+ shadows without a link) |
| `scripts/p5-design-stubs.json` | integrator | the stubs in the browser on the frozen hooks (§8.10, §9.3) |

### 8.2 Events (`EV`, events.js)
- `EV.SETTINGS` `{ group, key, value, prev }` — settings.js after every stored change (main.js attaches the bus).
- `EV.SAVE` `{ kind: 'slot'|'load'|'delete'|'restore'|'backup'|'error'|'auto-failed', slot, ok, message? }` — saves.js;
  ui.js shows `message` (in code): `auto-failed` always, any other `ok: false` when the saves panel is not open (a caption,
  or the open panel's notice).
- `EV.SOUND_CAPTION` `{ key, text, x?, z? }` — the sound package (audio-captions.js), raised while muted too; ui.js shows
  `[text]` when `interface.soundCaptions` (in code).
- `EV.MENU` `{ open, from: 'esc'|'gear'|'title'|'hook' }` — ui-menu.js.
Existing events the new work reads: `EV.CATCH`, `EV.POWER`, `EV.LETTER`, `EV.ACTION` (`gen.*`, `phone.*`, `clean.*`,
`feed.order`), `EV.PANEL_CLOSE` (the Esc guard), `EV.FARM_DELIVERY`, `EV.WATCH`.

### 8.3 The settings store (settings.js)
`createSettings({ storage?, events? })` → `{ schema, available, stored, get(path), group(g), all(), set(path, v),
setMany(patch), reset(g?), attachEvents(ev), subscribe(fn, filter?) }`; `soundView(settings)` → the audio-settings API
(`volume`, `muted`, `gain()`, `state()`, `set()`, `toggleMute()`, `subscribe()`, `levels()`). Paths are
`<group>.<key>` of `SETTINGS_SCHEMA` (§4.1). A package may **add** a key to a group it applies (with its default = the
Phase 4 behaviour, a label, a type) and must add its test-contracts default check in its report for the integrator.

### 8.4 The keys (keys.js)
`KEY_ACTIONS` `[{ id, group, codes, what, fixed?, shift?, follows?, extra?, alsoKeys? }]` (`codes[0]` the main key, the
rest its alternates); `createKeys(settings)` → `{ actions, codes(id), matches(e, id), actionOf(e, ids?), label(id),
labels(id), rows(mode), rebind(id, code) → { ok, swapped?, reason? }, reset(id?), subscribe(fn) }`; `codeLabel(code)`;
`RESERVED_CODES`, `UI_CODES` (Tab, Enter, Numpad Enter, Space), `REBIND_WORDS` (the Keys tab's words per `reason`:
`fixed`, `reserved`, `ui`, `unknown`). Bindings live in `settings 'keys.bindings'` (`{ id: main code }`).

### 8.5 Graphics quality (gfx-quality.js)
`createQuality({ THREE, renderer, scene, world, perf, settings, flock, onResize })` → `{ pixelRatio(), frame(rawDt),
apply(), restart(), state(), debug.feed(dt, n) }`; `state()` = `{ auto: { ratio, shadows, flock }, ratioCap, shadows,
flockDetail, step, governing, fps }`. It calls `flock.setDetail?.('full' | 'reduced')` (the settings package adds it to
flock.js). `__game.renderInfo()` → `{ calls, triangles, programs, geometries, textures, pixelRatio, shadows, linked }`
(`linked`: every shader program linked since start, main.js's `gl.linkProgram` counter). No quality change may set
`renderer.shadowMap.enabled`, `renderer.shadowMap.type` or a light's `castShadow` (all in three 0.160's program key).

### 8.6 The UI hubs (ui.js, ui-menu.js, ui-title.js, ui-panels.js)
- Panels: every new screen is a panel of the host (`register(id, build, { kind: 'paused' })`): ids **`menu`**,
  **`settings`**, **`guide`**, **`saves`**, **`map`**. The registration functions (`registerSettingsPanel`,
  `registerGuidePanel`, `registerSavesPanel`, `createMap`) take `{ register, openPanel, closePanel, ctx, menu, title }`
  and are called by ui.js in try/catch (in code).
- **The return path** (review round, in code, frozen): `openPanel(id, { returnTo })` with `returnTo` the open panel's id
  keeps that panel as the **parent**: closing the child (Esc, its close key, E, the scrim, `closePanel()`) opens the
  parent again with the focus on the key that opened the child; parents stack (menu → settings → …). A panel registered
  with `{ parent: true }` is the parent of whatever opens over it: **`result` and `summary`** (ui.js, in code), so the
  result's *Skill tree*, *See the cycle summary* and the new *Save or load* key come back to the result with its Replay and
  Next level keys. `closePanel({ all: true })` (= the host's `closeAll()`) and every `close(false)` (a mode change, a new
  run) close the whole chain; a place picked on the map uses it, as does *Back to the farm*. `ui.parentPanels` lists the
  waiting parents (tests). Opening a panel without `returnTo` over a non-parent replaces it (as before).
- `menu.add({ id, label, icon?, hint?, order, onSelect(via), visible?(mode) })` — `hint` an action id of keys.js (the
  menu shows its live key) or plain words; `via` = `{ returnTo: 'menu' }`, passed on by an entry that opens a panel
  (`openPanel(id, via)`, `settingsUI.open(tab, via)`, `map.open(via)`); the menu closes itself after `onSelect` when it is
  still the open panel. Entries in code: resume 0, map 20, saves 30, settings 40, guide 60, title 90.
- `title.addAction({ id, label, icon?, order, onClick(), visible?() })`, `title.refresh()`, `title.note(text | null)` (a
  status line under the title's keys: a load that failed, an unreadable autosave) — in code: saves 10, settings 20,
  guide 30.
- `ui.openSettings(tab?, via?)`, `ui.openGuide(section?, via?)`, `ui.openSaves(via?)`, `ui.map.open(via?)`,
  `ui.menu.open(from)`, `ui.intro`, `ui.busyPanels()` (panel ids whose `busy()` is true, open or in the background),
  `ui.parentPanels`.
- **Keys before everything** (review round, in code, frozen): ui.js's window capture listener runs first and, in order,
  (1) gives the key to **`ui.captureNextKey(fn)`** when one is armed (the next keydown only, any key — W, E, the arrows,
  Esc, Tab — with `preventDefault` and `stopImmediatePropagation`; it returns a cancel function): the Keys tab's *Change*;
  (2) offers it to every **`ui.claimKeys(fn)`** claim, newest first (fn returns `true` to use it; the claim returns its
  release): the intro while a card shows (Enter and Esc on the card, never the menu behind it); (3) with a panel open,
  offers it to the panel's **`onKey(e)`** (a built panel's own method; `true` = used, nothing else sees it): a saves
  question's Esc (its safe answer, the panel stays), the menu's up and down arrows (in code), a settings slider's arrows;
  (4) then the Phase 1–4 handling (Esc and E close the panel; typed WASD never walks the farmer; the farm's keys).
- The time bar holds, in order: pause · 1× · 4× · Next job · ? · **map** · **gear** · the speaker (audio-ui.js mounts last).
  A pointer click on any of its keys leaves no focus there (ui-hud.js, in code).
- **Esc** in a level with nothing open opens the menu, except within 600 ms (the input clock, `clock.js`) of a panel
  closing (`ESC_GUARD_MS`, in code): an earlier steps file's Escape after a panel that closed itself stays harmless.
  **O** (keys.js `map`) opens the map and **P / 1 / 4 / J** press pause, 1×, 4× and Next job, in a level or the sandbox,
  with no panel open and the focus outside a text box (in code). **Tab is never a game key**: it moves the focus.

### 8.7 Saves (saves.js, save-slots.js, save-codec.js, run.js)
`createSaves({ run, level, save, events, settings, ui })` → `{ available, list(), latest(), latestInfo(), continueLatest(),
continueAuto(), saveSlot(n), loadSlot(n), deleteSlot(n), exportText(n|'auto', { farmOnly? }) → { ok, text, parts: [text],
chars, meta }, importText(text, n | 'play'), message(code) }` (async where §3 says; results `{ ok, code?, message?, meta?
}`; `list()`'s autosave entry carries `error` when its key exists but does not read). The saves package adds to **run.js**:
`exportSave()` → `{ run, blob, starts }` (the run key's lean blob and every start the run knows, memory or storage) and
`importSave(envelope, { memoryOnly? })` → clears the live starts of the run in play from `plan` on (memory and storage),
writes the envelope's starts and its run key with `savedAt` now, and resumes (`continueSave`; `run: null` as the Phase 2
branch), true / false (§3.3); and to **level.js** (through experience,
§8.9) `saveNow()` exposed. ui.js's Continue calls `ctx.saves.continueLatest()` and the Continue line `ctx.saves.latestInfo()`
(in code).

### 8.8 Boot screen and motion
`createBootScreen()` → `{ shown, step(text) (a promise: resolves after two frames), error(kind, detail), hide() }`;
`BOOT_ERRORS` keys `webgl`, `library`, `load`, `stopped`, `context-lost` (a function of `{ saved }`), `slow` (in code:
the template's 20 s line while `window.__bootStarted`). `reducedMotion()`, `setMotionOverride('system' |
'on')` (motion.js; settings.js calls it on load and on every change of `interface.reducedMotion`).

### 8.9 One owner, one signature (the hand-over points)
| Hand-over | Provider (package) | Reader (package) | Signature |
| --- | --- | --- | --- |
| the sound settings | settings.js (in code) | sound | `soundView(settings)`; `settings.subscribe(fn, 'sound')` |
| a machine job running | ui-panels.js `busyIds` (in code) | sound | `ui.busyPanels()` → `['wash-bay', …]` |
| lightning | world.js `weather` (exists) | sound | `ctx.world.weather.flashes` (a counter), `.rain`, `.wet` |
| sound captions | sound (audio-captions.js) | experience (ui.js shows, in code) | `EV.SOUND_CAPTION { key, text }` |
| the speaker key's settings | experience (`ui.openSettings('sound')`, in code) | sound (audio-ui.js) | `ctx.ui.openSettings('sound')` |
| key checks | settings (keys.js) | experience (ui.js), sound (audio.js), settings (player-input.js) | `ctx.keys.matches(e, id)` |
| the legend's rows | settings (keys.js `rows`) | experience (ui-help.js) | `ctx.keys.rows(mode)` |
| the time settings | settings.js | experience (level.js) | `settings.get('time.*')` |
| the interface settings | settings.js | experience (ui.js, ui-watch.js, ui-caption.js, ui-help.js) | `settings.get('interface.*')`, `subscribe` |
| camera settings | settings.js | settings (player.js) | `settings.get('camera.*')` |
| flock detail | settings (flock.js `setDetail`) | settings (gfx-quality.js) | `flock.setDetail('full' | 'reduced')` |
| the job places on the map | experience (ui-jobs.js `spots()`) | experience (ui-map.js) | `jobCard.spots()` → `[{ key, n, title, x, z, inside, current }]` |
| dead birds on the map | flock-dead.js (exists) | experience | `flock.dead.near(x, z, r)` → positions (r 200: every bird) |
| the flock's spread on the map | settings (flock.js `positions`, in code) | experience (ui-map.js) | `flock.positions()` → `{ n, x, z, size, morph }` (read-only typed arrays) |
| the house resting | farm (exists) | experience (ui-map.js) | `farm.house.closed` → inside places unreachable |
| the flock meshes' triangles | settings (flock.js `meshes`, exists) | settings (p5-gfx) | `flock.meshes` → index count × `mesh.count` |
| the result's Save or load key | experience (ui-result.js) | saves (the panel) | `ctx.ui.openSaves()` over the result (a parent) |
| the route on the map | player-path.js (settings owns the file; the function is frozen) | experience | `findPath(ax, az, bx, bz, r, colliders, bounds)`, `freeSpot(x, z, r, colliders, bounds)`; `player.walkTo(x, z, run)` |
| the run's whole save | saves (run.js) | saves (saves.js) | `run.exportSave()`, `run.importSave(envelope)` |
| the level saving now | experience (level.js `saveNow`) | saves, main.js | `level.saveNow()` → true / false |
| the save hooks in the title | saves (saves.js, in code) | experience (ui.js, ui-title.js) | `saves.latestInfo()`, `saves.continueLatest()`, `saves.continueAuto()`; `title.note(text)` for the saves' title messages |
| the rebind capture | experience (ui.js `captureNextKey`, in code) | settings (ui-settings.js Keys tab) | `ctx.ui.captureNextKey(fn)` → cancel |
| the intro's keys | experience (ui.js `claimKeys`, in code) | experience (ui-intro.js) | `ctx.ui.claimKeys(fn)` → release |
| a panel's own keys | each panel (`onKey(e)` on its built object) | experience (ui.js, in code) | `panel.onKey(e)` → true when used |
| the autosave failing | saves (saves.js) | experience (ui.js shows, in code) | `EV.SAVE { kind: 'auto-failed', message }` |
| the hot appetite sign line | saves (content-signs-cond.js) | test-contracts (integrator) | the line on `sign-heat` in the hot season, `source: 'general'` |

### 8.10 Frozen DOM hooks (review round)
The steps files of every package and `p5-design-stubs.json` drive the screens only through these attributes (and the §9.2
hooks), never through a class, a text or a position, so each owner can rebuild its screens freely. Each owner keeps them on
its rebuilt screens:

| Hook | On | Owner | Value |
| --- | --- | --- | --- |
| `data-menu="<entry id>"` | each game-menu entry's `<button>` | experience (ui-menu.js, in code) | `resume`, `map`, `saves`, `settings`, `guide`, `title` |
| `data-title-action="<id>"` | each title action's `<button>` | experience (ui-title.js, in code) | `saves`, `settings`, `guide` (others may join: tests check *includes*) |
| `data-tab="<group>"` | each settings tab (`role="tab"`) | settings (in code) | `sound`, `time`, `graphics`, `camera`, `interface`, `keys` |
| `data-group="<group>"` | each settings tab's panel (`role="tabpanel"`) | settings (in code) | as above |
| `data-setting="<group>.<key>"` | one setting's row; its **one** native control inside (`input[type=range]`, `input[type=checkbox]` or `select`) | settings (in code) | the control's `value` is the **stored** value (a volume of 40 % is `value="0.4"`; a choice its stored string); an `input` / `change` event applies it |
| `data-key-action="<action id>"`, `data-key-change` | a Keys-tab row, and its *Change* `<button>` | settings | `KEY_ACTIONS` ids |
| `data-guide="<section id>"` | each guide section | settings (in code) | `GUIDE.sections` ids; `controls` holds the live key list |
| `data-slot="auto" \| "1" \| "2" \| "3"` | each saves row | saves (in code) | — |
| `data-save-key="continue \| save \| load \| delete \| backup \| restore"` | each row's keys | saves | — |
| `data-answer="yes \| no"` | the in-panel question's two answers | saves | `no` is the safe one (Esc) |
| `data-copy-part="<k>"`, `data-restore-box` | the backup box's Copy keys, the restore `<textarea>` | saves | — |
| `data-place="<place id>"` | each place's `<button>` in the map's side list (`data-place-shape` on its SVG shape) | experience (in code) | `MAP_PLACES` ids |
| `data-map-view="farm \| house"` | the map's two view tabs | experience | — |
| `.menu`, `.settings`, `.saves`, `.guide`, `.map` | each panel's root `<section>` (dialogShell's class) | each owner (in code) | — |

### 8.11 Styles and icons (review round)
Every package styles its own screens from its own module: `injectStyle(id, css)` (ui-dom.js, in code) adds one `<style
id>` to `<head>` once. Settings: `#settings-style` from ui-settings.js (`.set-*`: the six tabs' content, the Keys rows with
*Change*, the governor line, the fps readout) and `#guide-style` from ui-guide.js (`.guide-*`, the HUD picture); saves:
`#saves-style` from ui-saves.js (`.saves-*`: rows, questions, the backup and restore boxes, messages); sound:
`#sound-ui-style` (exists, audio-ui.js: the speaker toggle's states). The design round's rules for these screens moved into
those modules (in code). Class names carry the package's prefix and no rule styles another package's classes.
index.template.html (experience) keeps the shared look: the variables, cards, buttons (`.btn*`), the panel frame
(`.panel`, `.panel-close`, the five panels' `-case` / `-head` frame), `.kbd`, `.label`, `.src`, `.cyc-tabs`, the focus
ring. An icon a package needs is an SVG string in its own file, not an addition to ui-icons.js.

## 9. Save format changes, test hooks and harness scenarios

### 9.1 Save format
- **Unchanged**: the autosave keys (`RUN_SAVE` v3, the level starts), the Phase 2 level save, the skill profile; every
  blob field. A Phase 3 or Phase 4 save loads unchanged (test-saves plays one of each from fixtures it writes).
- **New**: the slot keys `chickenFarm.slot.v5.<1..3>` holding the stored envelope (§3.2); the backup text (the marker
  `CF5.<enc>.<crc>.<chars>.` with the payload's length, `p<k>of<n>.` on a part, §3.5); the settings key `chickenFarm.settings.v1` (§4.1). `level.serialize()` adds nothing; `run.exportSave()` /
  `importSave()` read and write the existing keys only.
- **The budget**: a gz64 slot of a whole cycle ≤ 300 KB (measured 210 KB at the design round), json64 ≤ 1.2 MB; the run key
  at day 67 stays ≤ 250 KB (test-run, unchanged).

### 9.2 `window.__game` hooks
Phase 1–4 hooks, plus (in code): `settings` (the store), `keys`, `quality` (`state()`, `debug.feed`), `saves`, `perf`
(`fps`, `pixelRatio`, `shadowMap`), `renderInfo()` (one rendered frame's `renderer.info`, and `linked`: the shader programs
linked since start); `flock.positions()`; through `__game.ui`: `menu` (`open`, `entries`), `title` (`addAction`,
`refresh`, `note`), `map` (`open`, `places()`, `walkTo(id)`), `intro`, `openSettings(tab, via)`, `openGuide(section, via)`,
`openSaves(via)`, `busyPanels()`, `parentPanels`, `captureNextKey(fn)`, `claimKeys(fn)`, `openPanel(id, { returnTo })`,
`closePanel({ all })`. Packages add: sound — `audio.captions()` (the captions raised, with their
real time) and `audio.debug.hour(script)` (the long-session counter on the live engine); saves — `saves.debug.slotChars(n)`,
`saves.debug.corrupt(n)` (writes a damaged slot for the steps files); settings — `quality.debug.feed`, `keys.rebind`;
experience — `ui.map.state()` (`{ view, places: [{ id, x, y, w, h, label }], markers, dead, bucket, birds, farmer: { x, y, deg } }`
in map pixels), `ui.intro.state()` (`{ active, card, anchorBox, cardBox }`, in code as a stub), `ui.intro.allow(true)` (the cards under
automation, in code as a stub), `level.saveNow()`.

### 9.3 Harness scenarios
- **The design run** (this round): `npm run build`; `node scripts/shoot.mjs --scenario cold-hot --size 960x600 --out
  /tmp/phase5-design` (no console or page errors); `npm test` (373 ok, test-contracts with the five Phase 5 cases);
  `node scripts/shoot.mjs --steps scripts/p5-design-stubs.json --size 960x600` — **15 PASS**: the hooks; the defaults are
  Phase 4's; the sandbox view inside the budget (66 calls, 312 K triangles, 66 programs); Phase 2's prep day; Esc → the menu
  with the clock stopped; the menu → Settings; a volume of 0.4 applied and stored in both keys; Esc closes; the Esc guard;
  Tab → the map with 44 places; a place → the map closes and he walks, arriving at the silo gauge from the gate; the saves
  panel's four rows; the guide's live keys; the title card's three new keys. Earlier files re-run on the design wiring at
  960 × 600, all without console or page errors: `rv-hud.json` 16 PASS, `p4-design-stubs.json` 10, `hotfix-steps.json` 21,
  `req-clock.json` 13, `phase1-jobs.json` (4 of 4 jobs), the `p2-hooks` scenario.
- **The review round's run** (after the critic's fixes, in code): `npm run build`; `npm test` — 373 ok (test-contracts' Phase
  5 cases now also round-trip 300 random 50–250 K backups with END planted and parts shuffled, the Phase 2 migration, the
  review round's rebind rules, `fillGuide`, and shadows without a recompile); `node scripts/shoot.mjs --scenario cold-hot
  --size 960x600 --out /tmp/phase5-design2` — no console or page errors; `p5-design-stubs.json` (rewritten on the §8.10
  hooks) — **20 PASS, 0 FAIL**: the hooks; the defaults (the map on O); the sandbox budget (66 calls, 312 K triangles, 66
  programs); **the four shadow settings link no shader** (66 linked before and after); Phase 2's prep day; Esc → the menu;
  the menu's arrows through its `onKey`; `[data-menu="settings"]` → Settings with the menu as its parent; the volume
  through `[data-setting="sound.volume"]`; **Esc in Settings → the menu again, on Settings**; Esc → the farm; the Esc
  guard; **`captureNextKey` takes W** (the farmer does not walk); **O → the map** (44 places); **Tab moves the focus and
  the map stays**; `[data-place="silos"]` → he walks to the silo gauge; `[data-slot]` auto, 1, 2, 3; `[data-guide=
  "controls"]` with the live keys (*O opens the farm map*); `[data-title-action]` saves, settings, guide. Earlier files on
  the review-round wiring at 960 × 600, all without console or page errors: `p4-design-stubs.json` 10 PASS, `rv-hud.json`
  16, `hotfix-steps.json` 21, `req-clock.json` 13 (its one *Plate* click not found, as on main), `phase1-jobs.json` (4 of 4
  jobs), the `p2-hooks` scenario, `p2-level-end.json` (the result as a parent: the skill tree's close shows the result
  again, its Replay as before), `p3-design-stubs.json` (5 PASS).
- **Every earlier file keeps passing on every branch** (each package runs those its files touch, the integrator all of
  them at the merge): the Phase 1 `tour`, `cold-hot`, `walk`, `p2-hooks` scenarios and `phase1-jobs.json`, `systems-*.json`;
  `p2-level1.json` (58), `p2-level1-find.json` (18), `hotfix-steps.json` (21), `p2-flock-events.json`, `p2-review2*.json`;
  `p3-cycle.json` (140), `p3-replay.json` (16), the `p3-*` package files; `p4-hot` (43), `p4-rainy` (17), `p4-bad` (17),
  `p4-water` (15), `p4-clarity` (14), the `p4-*` package files, `p4-design-stubs.json`, `p3-design-stubs.json`;
  `req-watch` (13), `req-clock` (13), `req-bucket` (18), `req-deadmark` (6), `rv-hud` (16); `p5-sound.json` (44, updated
  by the sound package for the settings menu).
- **Package files** (§10): `p5-sound.json`, `p5-sound-scenes.json` (sound); `p5-saves.json`, `p5-saves-migrate.json`
  (saves); `p5-settings.json`, `p5-gfx.json`, `p5-guide.json` (settings); `p5-map.json`, `p5-first-play.json`,
  `p5-a11y.json`, `p5-hud.json`, `p5-look.json`, `p5-boot.json` (experience). Node: `test-audio.mjs` (+ cases),
  `test-audio-hour.mjs` (sound); `test-saves.mjs`, `test-watch.mjs` (+ the supply case), `test-cond.mjs` / `test-cycle.mjs`
  (the appetite bands) (saves); `test-settings.mjs` (settings); `test-map.mjs`, `test-fixes.mjs` (+ the bad-batch day, the
  time settings) (experience). Each new node test goes into `npm test` at the merge (the integrator edits package.json).
- **Integrator play-through at the merge** (generated on the helpers of `p3-cycle-steps.mjs`, file `scripts/p5-play.json`):
  the title on a first run → Start a new flock → the intro's three cards by real clicks → the planning day's gate sign and
  sign by E → the map (O) to the office → Save in slot 1 from the menu (Esc in the saves panel shows the menu again) → `goto(7, 21, auto)` → the brooding week's result →
  Save in slot 2 from the result's *Save or load* key (closing it shows the result again) → Back up slot 1, the whole run
  in parts (the select fallback) → clear storage, reload → Restore into slot 1 by pasting the parts in reverse order →
  Continue (the newest: slot 1's planning day) → Settings: Keys Q → B through *Change* (and W → I and back: the capture
  takes W), B squeezes on day 0 (after a goto) → HUD Large, the
  watch folded → reduced motion on → the map's House view with the flock dots → the hot season day 30 at 13:00 (a standard
  start) with sound captions on and the sound off → the power cut of the rainy day 33 with *[Alarm in the house]* → no
  console or page errors; a real-input day of play under 6 minutes (the Phase 4 ceiling) with the menu and the map used.

## 10. Work packages (four, disjoint files, parallel worktrees)
Each engineer works in `git worktree add ../cf5-<key> -b phase5/<key> main`, edits **only the files listed** (new files
with the listed prefixes are theirs too), codes against the contracts in code (§8; §8.9 has one owner and one signature
for every hand-over), writes in chunks of ≤ 250 lines and commits after each working milestone, and keeps these passing
on the branch: `npm run build`, `npm test`, `node scripts/shoot.mjs --scenario cold-hot --size 960x600`, `--scenario
p2-hooks`, `--steps scripts/phase1-jobs.json`, `--steps scripts/p2-level1.json`, `--steps scripts/p4-design-stubs.json`,
`--steps scripts/p5-design-stubs.json`, `--steps scripts/hotfix-steps.json`, plus the earlier files its own files touch
(listed in its section). `npm run perf` runs alone (never beside a browser or another branch's tests). **Frozen** for every
package: `src/config.js`, `src/events.js`, `src/motion.js`, `src/main.js`, `src/interact.js`, `src/clock.js`,
`src/round.js`, `src/sim.js`, `src/records*.js`, `src/skills*.js`, `src/content-jobs*.js`, `src/content-signs.js`,
`src/content-signs-cycle.js`, `build.mjs`, `package.json`, `scripts/shoot.mjs`, `scripts/test-contracts.mjs`,
`scripts/test-perf.mjs`, `scripts/test-sim.mjs`, `scripts/p3-cycle-steps.mjs`, `scripts/p4-cycle-steps.mjs`,
`scripts/req-steps.mjs`, `scripts/rv-hud-steps.mjs`, every earlier steps file and `p5-design-stubs.json`. The machine
renders WebGL in software (about 1–2 fps): keep harness runs short (`--size 960x600`, `settle` / `advance`, `__game` hooks;
`__game.cycleAt(day, hour)` reaches any day, `__game.setCondition(id)` any condition, `__game.farm.debug.power(false)` a cut)
and prefer node tests for logic. What every package must know in one paragraph: **every default setting is the Phase 4
game** (the new keys O, P, 1, 4, J add to it; no Phase 1–4 key changed); settings are read with `ctx.settings.get(path)`
and followed with `subscribe` (never cached at start only); keys with `ctx.keys.matches(e, id)`; a screen that needs a key
before ui.js closes the panel gives its built panel an `onKey(e)` (true = used), a rebind uses `ctx.ui.captureNextKey`,
a card over the farm `ctx.ui.claimKeys` (§8.6); every new screen is a host panel of kind 'paused' registered by its own
function, and a panel opened from the menu or over the result passes `via` / comes back to its parent (§8.6); each
package styles its own screens with `injectStyle` under its own class prefix and keeps the frozen DOM hooks of §8.10;
nothing calls `alert`, `confirm`, `prompt`, `window.open` or downloads a file; every text is plain English with no verdict
word and no farming fact outside a sign.

### 10.1 `sound` — the sound for every situation, an hour of quiet variety, captions, the controls in the settings (branch `phase5/sound`)
**Owns:** `src/audio.js`, `src/audio-engine.js`, `src/audio-beds.js`, `src/audio-voices.js`, `src/audio-sched.js`,
`src/audio-mix.js`, `src/audio-synth.js`, `src/audio-ui.js`, `src/audio-measure.js`, `src/audio-settings.js`, new
`src/audio-captions.js` (and any new `src/audio-*.js`), `scripts/test-audio.mjs`, `scripts/fake-audio.mjs`,
`scripts/p5-sound.json`, new `scripts/test-audio-hour.mjs`, new `scripts/p5-sound-scenes.json`.
**Contract:** §2 entirely; reads `soundView(settings)` (passed by main.js as `deps.settings`, in code) and
`settings.subscribe(fn, 'sound')` for the three layer sliders; `deps.world.weather` (`flashes`, `rain`, `wet`);
`ui.busyPanels()`; `farm.generator.running`, `farm.power`, `farm.harvest` (`started`, `endedAt`), `farm.condition`,
`farm.waterTank`, `props.carrying`, `env`; `EV.CATCH`, `EV.LETTER`, `EV.ACTION` (`gen.*`, `phone.*`, `feed.order`, `clean.*`),
`EV.FARM_DELIVERY`, `EV.POWER`. Raises `EV.SOUND_CAPTION { key, text }` (also while muted). The speaker key calls
`ctx.ui.openSettings('sound')` for its settings. The U key through `ctx.keys.matches(e, 'sound')`. The speaker toggle's
looks in `#sound-ui-style` (audio-ui.js, exists), never in index.template.html.
**Builds:** the beds and cues of §2.1 (thunder — flash-driven, one rumble per flash, an exponential 40 s timer with a 20 s
floor under reduced motion —, drips at 0.2–0.6 a second, storm gusts, the alarm's growing gap, the generator bed and its
start / stop / clunk, the hot season's day cicadas, the catching crew's murmur, crates and the idling truck, the pressure
washer, sprayer and scraper, the office's desk fan, phone ring, dial and pen, the well pump), all built at start-up (≤ 230
nodes, none after: 177 today; one shared noise source for the new noise bands and one machine bed shared by the generator,
the washer, the well pump and the truck, §2.1, for about 205 in all); the caps and habituation of §2.2; `audio-captions.js` (§2.3: the keys and words, once per change, ≤ 1
every 8 s, from the game state so it runs muted); the layer gains of §2.6; the speaker key as a one-click toggle with its
state in icon and label, its settings in the Sound tab (the `#sound-pop` card removed; the legend rows come from keys.js);
`audio.captions()` and `audio.debug.hour(script)` hooks; p5-sound.json moved onto the Settings menu (its Phase 4 checks kept).
**Acceptance:**
- `node scripts/test-audio.mjs` — every Phase 4 case, plus: the generator bed's target is 0 unless `running`, and at 20 m
  0.37 ± 0.02 of its value at the generator; 200 flashes → thunder delays all within 1.5–7.9 s and at most 3 in any real
  minute; the alarm's gaps 6 s for the first 120 s of a dark house, then 15 s, none while the power is on; the day cicadas 0
  outside 10:00–16:00 and in every condition but `hot`, highest at 13:00; the crew's beds 0 before EV.CATCH start and after
  its end; the washer bed only while `busyPanels()` has `wash-bay` or he carries the washer inside; the desk fan only within
  6 m of the desk 06:00–19:00; the layer gains equal value² (0.5 → 0.25) and a slider at 0 schedules no event of its layer;
  captions: each key once per change, at most one in any 8 s, raised with the sound muted; the node count ≤ 230 and
  unchanged after 10 minutes of fake play; the shared machine bed: the generator, the washer, the well pump and the truck
  never two at once, the nearer one taking it.
- `node scripts/test-audio-hour.mjs` (added to npm test at the merge) — the scripted hour of §2.2: every cap of §2.2 holds
  in every real minute (drips ≤ 40, thunder ≤ 3); every Poisson source's gaps have a CV ≥ 0.6 (thunder is flash-driven:
  its delays after each flash 1.5–7.9 s instead; its reduced-motion timer is Poisson and checked); no variant twice in a
  row; no node created; the summed loudest layers in every second ≤ −16 dBFS.
- `node scripts/shoot.mjs --steps scripts/p5-sound.json --size 960x600` — ≥ 44 PASS, 0 FAIL (the speaker toggles the
  sound; the volume through `__game.ui.openSettings('sound')` and `__game.settings.set('sound.volume', 0.4)`, and once
  through the frozen hook `[data-setting="sound.volume"] input` with `value = '0.4'` and an `input` event (§8.10: the
  slider holds the stored 0..1 value, its output shows *40*), sets `audio.settings.volume` 0.4, stored in
  `chickenFarm.settings.v1` and `chicken-farm.sound`; no step depends on the settings panel's classes or texts, which the
  settings package rebuilds in parallel; every Phase 4 level and rule check as before).
- `--steps scripts/p5-sound-scenes.json` — every band of §2.4 PASS (storm RMS −30..−37, peak ≤ −18; thunder inside peak ≤
  −24; generator 4 m −34..−39, inside −42..−48; catching −32..−38; wash bay −33..−38; office −42..−48; hot noon −34..−39;
  everything ≤ −16; the alarm caption within 1 s with the sound off).
- Earlier files its work touches: `p4-rainy.json` (17), `p4-design-stubs.json`, the `p3-cycle.json` clean-out day (via
  `--dev`-free run of the whole file at the merge), `p2-level1.json` — no console or page errors.

### 10.2 `saves` — slots, Continue, backups, migrations, messages; the model's two leftovers (branch `phase5/saves`)
**Owns:** `src/saves.js`, `src/save-slots.js`, `src/save-codec.js`, `src/ui-saves.js`, `src/save.js`, `src/run.js`; for the
Phase 4 leftovers §6.8.1 and §6.8.4: `src/flock-watch.js`, `src/farm.js` and every `src/farm-*.js` (the appetite term sits in
`farm-tuning.js` / `farm-cycle-step.js`; the profiles in `farm-profiles*.js`), `src/content-signs-cond.js` (the appetite line
only); scripts `test-watch.mjs`, `test-cond.mjs`, `test-cycle.mjs`, `cycle-refs.mjs`, `test-run.mjs`, `test-tuning.mjs` and
`tuning-refs*.mjs` (code; a band change goes in the report), `tuning-audit.mjs`, new `test-saves.mjs`, new `p5-saves.json`,
new `p5-saves-migrate.json`.
**Contract:** §3 entirely, §6.8.1, §6.8.4, §8.7, §8.9 (`run.exportSave` / `importSave`; reads `level.saveNow()` once the
experience package exposes it — until then `run.saveRun` through the level's autosave is enough; `saves.latestInfo` /
`continueLatest` / `continueAuto` keep their shapes, ui.js calls them). The saves panel registers itself
(`registerSavesPanel`, kind 'paused'), its menu entry (order 30, `via` passed on) and title action (order 10), as in code;
its built panel's `onKey(e)` answers Esc in a question (§8.6); its styles in `#saves-style` (in code, §8.11); the DOM
hooks of §8.10 (`data-slot`, `data-save-key`, `data-answer`, `data-copy-part`, `data-restore-box`). Every message is
`SAVE_MESSAGES`' (add codes there, never change a text's meaning). **`composeText`, `composeParts`, `partRanges` and
`parseText` are complete in code** (review round: the reader counts the payload, parts in any order); the package may
change them only with test-contracts' 300-backup case still passing.
**Builds:** gz64 in `encodePayload` / `decodePayload` (CompressionStream; json64 where it is missing); `migrate` for v1
(the Phase 2 level save: in code), v3 and v5, raw-JSON pastes; `createSlotStore` (read / write / remove / list over the slot keys,
the quota and blocked rules, `maxSlotChars`); `saves.js` complete (list, latest, Continue, save / load / delete, export /
import, EV.SAVE, the autosave-failed message through EV.SAVE — ui.js shows it, in code — the autosave row's error code);
`run.exportSave()` / `run.importSave(envelope, { memoryOnly })` with §3.3's four steps (clear the live starts, write the
envelope's, stamp `savedAt`, resume; `run: null` as the Phase 2 branch); the panel of §3.9 (rows, the in-panel questions
with Esc through `onKey`, the backup box built when it opens — *The whole run* / *This farm only*, the length in words,
one *Copy* key per part copying synchronously inside its click, the select fallback —, the restore box taking parts in any
order, *Restore and play now* when storage is blocked, the messages, the size and date, keyboard and focus); the result
screen's way in is `ui.openSaves()` over the result (a parent: closing the panel shows the result again; experience adds
the result's key); the title card's Continue line from `latestInfo`
(*Continue — Slot 2: …*); the hooks `saves.debug.slotChars(n)`, `saves.debug.corrupt(n)`. The supply row's rule (§6.8.1)
and the appetite term with its sign line and bands (§6.8.4).
**Acceptance:**
- `node scripts/test-saves.mjs` (the real sim, level.js and run.js in node with a fake storage, as test-run): the day-67 run
  of the ideal (seed 1) in a slot: gz64 ≤ 300 KB, json64 (CompressionStream removed) ≤ 1.2 MB, its backup text ≤ 300 K
  characters; decode(encode(x)) identical (`firstDiff` null) for both; one flipped payload character → `incomplete`; the text
  cut 40 characters short → `incomplete`; `CF6.` → `newer`; `hello` → `not-a-save`; a raw v3 JSON paste and a raw v1 JSON paste
  accepted (the v1 continues as a run at the brooding week); names exactly: after entering week 2 *Normal season · Level 3 –
  Week 2 · Day 8, 06:00*, a hot run at day 30 14:20 *Hot season · Level 5 – Weeks 4 and 5 · Day 30, 14:20*; load a slot →
  `run.state()` (levels, plan, condition, startedAt) equal to the saved, `level.def.id`, day and hour equal, every saved start
  back (`run.hasStart`), a *Replay Week 2* after the load restores day 8 06:00; delete → empty; a storage that throws above
  400 K characters → `full` with the old slot unchanged; a blocked storage → `available` false, rows `blocked`, `exportText
  ('auto')` still works from the game in play; the autosave older than slot 2 → `continueLatest()` loads slot 2; a slot of
  garbage JSON and one with a wrong crc → their rows' codes, `loadSlot` refused, the other slots fine; a Phase 3 blob
  (Phase 4 fields removed: `farm.cond`, `env.powerOn`, `env.targetShift`) loads and plays a day; a hot-season backup
  restored into slot 3 loads with `farm.condition === 'hot'`; `mergeProfiles` keeps the larger of each;
  `importSave(exportSave())` leaves the run key and every start byte-identical; review round: loading slot 1 (a week-2
  run) over a run in play at weeks 4–5 leaves **no** start of the replaced run (`run.hasStart('weeks45', 29)` false,
  `store.info().starts` only the loaded run's) and the run key's `savedAt` newer than every slot (Continue then resumes
  the loaded farm); a v1 envelope (`migrate`'s `levelId 'level1'`) loads as a run at the brooding week; the autosave key
  holding garbage → its row's `error` `damaged`, Continue takes the newest slot; *This farm only* of the day-67 run ≤ 30 %
  of the whole run's characters and its restore plays (a Replay of week 2 then a standard start); the whole run as parts
  pasted in reverse order restores byte-identical, one part left out → `missing-parts` naming it; a blocked storage →
  `importText(text, 'play')` plays the backup from memory.
- `node scripts/test-watch.mjs` — the new supply case of §6.8.1 (day 33 12:00 and 15:00 green, the tank ≥ 90 %;
  `waterPumpUnfixed` warned ≥ 6 farm hours before 20 %); the iron filter's case (`waterFilterLate` warns on the intake or
  Supply row with the filter as its cause within main's hours of day 24–25); the hot ideal's intake row never amber from
  `fHot` alone (§6.8.4); every Phase 4 case as before.
- `node scripts/test-cond.mjs` (full and `--quick`) and `node scripts/test-cycle.mjs` — the bands of §6.8.4 (hot ideal 2–5 %
  under the normal ideal — measured at the review round with the term as specified: 3.4 % —, FCR ≤ 1.62, EPEF ≥ 390,
  every level passes, every branch ≥ 2); the normal season byte-identical (a new digest check of the normal ideal's
  day-42 row against main's) and every Phase 4 band; `node scripts/test-sim.mjs` unchanged; `npm run perf` alone within
  budget.
- `--steps scripts/p5-saves.json` (960 × 600) — PASS: in a level, Esc → Save or load → Save here in slot 1 names the farm;
  Esc → the menu again (the return path), Esc → the farm; `advance` a farm hour, Save here in slot 2 (the in-panel
  question on a full slot; **Esc answers *Keep it* and the panel stays open**, `ui.openPanelId === 'saves'`); Load slot 1 →
  the day and hour of slot 1; Delete slot 2 by its in-panel question with `window.confirm` replaced by a function that
  throws (never called); with a result shown (`level.debug.result(true)`), `ui.openSaves()` → Save here → Esc → the result
  again; Back up slot 1 → the clipboard holds `CF5.gz64.` or the fallback box is shown selected with it; clear storage, reload, Restore into slot
  1 by pasting (an `input` event on the box) → its name back; Continue from the title → slot 1's day; `saves.debug.corrupt(3)`
  → slot 3's row says the save is damaged and offers Delete only; a reload keeps the slots; no console or page errors.
- `--steps scripts/p5-saves-migrate.json` — a v3 run key written by eval (from a standard start's `run.serialize()` and
  `level.saveBlob()`) and reloaded: Continue resumes it; a v1 Phase 2 save written and reloaded: Continue → the brooding week
  as a run.
- Earlier files its files touch: `p3-run-title / chain / replay / ui.json`, `p3-replay.json` (16), `p4-run-*.json`,
  `p4-water.json` (15), `p4-hot.json` (43, the lighter hot season: its numbers re-read, every check still PASS),
  `req-watch.json`, `rv-hud.json`; `test-run.mjs`.

### 10.3 `settings` — the settings menu, keys, graphics and performance, camera, the guide (branch `phase5/settings`)
**Owns:** `src/settings.js` (the API and existing keys frozen; keys may be added), `src/keys.js` (the same),
`src/gfx-quality.js`, `src/ui-settings.js`, `src/ui-guide.js`, `src/content-guide.js`, `src/player.js`,
`src/player-camera.js`, `src/player-input.js`, `src/player-path.js` (`findPath` / `freeSpot` signatures frozen: the map
reads them), `src/player-*.js`, `src/flock.js`, `src/flock-*.js` except `flock-watch.js`, and for the performance pass
(§6.5; looks and behaviour unchanged) `src/world*.js`, `src/house*.js`, `src/props*.js`; scripts: new `test-settings.mjs`,
new `p5-settings.json`, new `p5-gfx.json`, new `p5-guide.json`.
**Contract:** §4 entirely, §6.2, §6.5, §8.3–§8.5, §8.9 (`soundView` stays the sound's door; `keys.rows` / `labels` for the
legend and the guide; `flock.setDetail`; `flock.positions()` stays as in code, the map reads it). The settings panel, the
guide and their menu entries (orders 40, 60, `via` passed on) and title actions (20, 30) register themselves as in code
(`registerSettingsPanel`, `registerGuidePanel`, `{ open(tab | section, via) }` returned; ui.js wires `ui.openSettings` /
`ui.openGuide` to them); their styles in `#settings-style` / `#guide-style` (in code, §8.11); the DOM hooks of §8.10
(`data-tab`, `data-group`, `data-setting` with the stored value, `data-key-action`, `data-key-change`, `data-guide`). The
Keys tab's *Change* uses `ctx.ui.captureNextKey(fn)` (in code), the words of a refused key are `REBIND_WORDS`' (in code).
**No quality change may compile a shader** (§4.4): `renderer.shadowMap.enabled` / `.type` and a light's `castShadow` stay
as main.js set them (the shadow steps are in code and must keep `renderInfo().linked` unchanged).
**Builds:** the menu of §4.2 (six tabs, native labelled controls with their values, a line of plain words under each tab,
*Reset this tab*, the Graphics presets of §4.1 with *custom*, the governor's state on the Graphics tab, the frame-rate
readout); the Keys tab with *Change* (the next key press through `captureNextKey`, so W, E, the arrows reach it; Esc
cancels; a taken key swaps and both rows show it; fixed, reserved and Tab / Enter / Space refused with `REBIND_WORDS`) and
*Reset all keys*; player-input.js and player.js on `keys.matches` for every move,
turn and zoom key and on the camera settings (§4.5, live); gfx-quality.js's steps 4 and 5 and `restart` (§4.4);
`flock.setDetail('full' | 'reduced')` with the reduced bird mesh and the far birds' half-rate pose (§4.4); the performance
pass of §6.5 (find what costs draw calls or programs in each named view; merge or instance repeated static meshes, share
materials; compile everything in the warm-up; every look unchanged: the earlier look files' pixel checks pass); **the 3D
items of the look pass** (§6.4 (d): z-fighting or flicker on the boards, the cut-away in every condition, the rain over
the cut-away house, the crew and crates fading) — experience's p5-look lists what fails, this package fixes it in
`world*` / `house*` / `props*`; the guide's final words (keys and the Time settings through `fillGuide`'s tokens, in code),
the HUD picture and *Show the introduction again* (it calls `ctx.ui.intro.reset()` then closes; the intro package owns
the cards).
**Acceptance:**
- `node scripts/test-settings.mjs` (added to npm test at the merge): every schema item's `coerce` (out-of-range numbers
  clamped, unknown choices to the default, wrong types to the default); `reset(group)`; the presets (high → 1.5 · high · full;
  medium → 1 · low · full; low → 0.85 · off · reduced; one changed by hand → `graphics.quality` reads `custom`); keys: the
  Phase 1–4 defaults and the new O / P / 1 / 4 / J, a rebind and its swap, `useDead` following `use` (E → R: Shift+R picks
  up the dead bird; `actionOf` Shift+R → `useDead`), reserved, fixed and Tab / Enter / Numpad Enter / Space refused,
  zoomIn keeping Numpad + across a swap, `rows()` showing a rebind, `matches` by `key` when `code` is empty (letters and
  digits); quality with a fake renderer: frames of
  60 ms on a 2× screen → pixel ratio 1, then the simple shadow (1024, the type unchanged), then 0.85, then reduced flock,
  then shadows off (`shadowMap.enabled` still true, `autoUpdate` false), then no more steps, each 3 s apart; frames of 30 ms → no step; a manual pixel ratio pins it through every step; `restart` from the
  top; the camera: rotate speed 2 → the yaw change of a 200 px drag doubles (± 1 %), invert flips its sign, zoom speed 0.5
  halves the wheel's zoom factor's logarithm.
- `--steps scripts/p5-settings.json` (960 × 600) — PASS: Settings opens from the title card, the game menu, the gear key and
  `ui.openSettings('sound')` (the Sound tab shown); every tab drawn without a horizontal scroll; volume 40 → `audio.settings.
  volume` 0.4 (the slider at `value = '0.4'`, its output *40*); Graphics *Low* → `quality.state()` `{ ratioCap 0.85,
  shadows 'off', flockDetail 'reduced' }`, `renderer.shadowMap.autoUpdate === false` and `renderInfo().linked` unchanged,
  the picture renders with no shadow, then *Automatic* back; Camera turn speed 2 → a 200 px right-drag turns the view
  twice as far as at 1 (± 5 %), *the other way* flips it; Keys: *Change* on *Walk forward*, press I → holding I walks him
  forward (the distance over 1 s ≥ 3 m), W does nothing; *Change* on *Squeeze* and press W (it swaps with Walk forward),
  then E (swaps with Use), then ArrowUp — each taken by the tab, the settings panel still open after E — then *Reset all
  keys*; Esc during *Change* cancels it and the panel stays open; *Change* and Tab → the words of `REBIND_WORDS.ui`;
  a reload keeps every
  changed value; *Reset this tab* restores the defaults; no console or page errors.
- `--steps scripts/p5-gfx.json` (960 × 600) — every named view of §6.5 within `GFX.budget` (calls ≤ 110, triangles ≤ 650 K;
  each view's numbers printed); **`renderInfo().linked` the same after the last view, the governor's steps
  (`quality.debug.feed`) and the *Low* and *High* presets as right after the warm-up** (zero links in play); flock detail
  reduced → the flock meshes' own triangles (index count ÷ 3 × drawn instances over `flock.meshes`) at least 40 % fewer
  than full, with a screenshot pair, and the view's total under the budget; `flock.update`'s median ≤ 4 ms over
  300 frames on days 3 and 30; *Low* and *High* presets render with no error; the governor's order with `quality.debug.feed`.
- `--steps scripts/p5-guide.json` — the guide opens from the title, the menu and the legend's *Full guide*; its keys list
  shows a rebound key (Q → B: *B Squeeze a handful of litter*); every section heading present; `openGuide('saving')`
  scrolls to it; no farming figure in its text (the test-contracts rule).
- Earlier files its files touch: the Phase 1 `tour`, `walk`, `phase1-jobs`; `p2-flock-look / perf.json`, `p2-props-look.json`,
  `p3-scene-look / events / perf.json`, `p4-scene-look / events.json` (the pixel checks), `req-deadmark.json`,
  `p2-level1.json` (walking, carrying), `p3-cycle.json` at the merge — no console or page errors.

### 10.4 `experience` — the menu, first play, the map, the HUD and panels, accessibility, loading, the leftovers (branch `phase5/experience`)
**Owns:** `src/ui.js`, `src/ui-title.js`, `src/ui-menu.js`, `src/ui-map.js`, `src/map-plan.js`, `src/ui-intro.js`,
`src/boot-screen.js`, `src/ui-help.js`, `src/ui-hud.js`, `src/ui-watch.js`, `src/ui-caption.js`, `src/ui-jobs.js`,
`src/ui-marker.js`, `src/ui-deadmarks.js`, `src/ui-panels.js`, `src/ui-dom.js`, `src/ui-icons.js`, every other `src/ui-*.js`
not listed for another package (the panels — `ui-equipment`, `ui-water`, `ui-climate`, `ui-controller`, `ui-inspect`,
`ui-boards`, `ui-jobstrip`, `ui-farmtime`, `ui-format`, `ui-records`, `ui-notebook`, `ui-skilltree`, `ui-result`,
`ui-summary`, `ui-run`, `ui-letters`, `ui-tasks`, `ui-testtools`, `ui-cycle-*`, `ui-cond-*` — for accessibility and the look
pass only), `src/index.template.html`, `src/content.js`, `src/level.js`, `src/job-*.js` (not `src/run.js`: package saves);
scripts: `test-fixes.mjs`, `test-jobs.mjs`, `test-level.mjs`, new `test-map.mjs`, new `p5-map.json`, `p5-first-play.json`,
`p5-a11y.json`, `p5-hud.json`, `p5-look.json`, `p5-boot.json`.
**Contract:** §5, §6.1, §6.3, §6.4, §6.6, §6.7, §6.8.2, §6.8.3, the Time and Interface rows of §4.1, §8.6, §8.8, §8.9
(`jobCard.spots()`, `level.saveNow()`; reads `keys.matches` / `rows`, `settings.get('time.*' | 'interface.*')`,
`flock.dead.near`, `flock.positions()`, `farm.house.closed`, `props.bucketDown`, `findPath` / `freeSpot`, `player.walkTo`).
The hubs (`menu.add` with `via`, `title.addAction`, `title.note`, the panel ids, `ui.open*` with `via`, `busyPanels`,
`parentPanels`, the Esc guard, the map on O and the time keys, the return path of the panel host, `captureNextKey`,
`claimKeys` and the panels' `onKey`, `injectStyle`) keep their in-code shape: the other packages call them. The frozen DOM
hooks of §8.10 it owns (`data-menu`, `data-title-action`, `data-place`, `data-map-view`) stay on its rebuilt screens.
**Builds:** the game menu's look and focus order; the title card's first-run line, focus and key line from keys.js; the
introduction (§6.1) with `ui.intro.state()`, its keys through `ctx.ui.claimKeys` and its words through `fillGuide`; the farm
map of §5 (both views, every live layer — the flock from `flock.positions()`, the resting house shut —, labels placed
clear, the house in the Farm view opening the House view, hover / focus tags with the route's length and time, click and
keyboard walking, the side list) with `ui.map.state()`; the result panel's *Save or load* key (`ctx.ui.openSaves()`: the
result is a parent, so it comes back);
`jobCard.spots()`; ui.js, ui-help.js and ui-jobs.js on `keys.matches` / `labels` (every key check of ui.js; the legend; the
prompt pills); the Interface settings applied live (HUD size, the watch shown / folded / hidden, caption time, the legend,
the sound captions' line) and the Time settings in level.js (`defaultSpeed`, `signStops`, `atJobSlow`, `holdJobs`);
`level.saveNow()`; the loading card's look and the error messages with their *Reload the page* key (§6.3; the slow line
and the context-lost words are in code); the visual pass (§6.4: the HUD and its own panels; it lists the 3D items for the
settings package and the settings / saves / guide screens' items for their packages) and the accessibility pass (§6.6)
over every panel it owns, with the two text-size floors; the phone note (§6.7); the bad batch's fail day (§6.8.2) and the
flock watch's whole warning (§6.8.3).
**Acceptance:**
- `node scripts/test-map.mjs` (added to npm test at the merge): `MAP_PLACES` unique and complete (every `SPOTS*` entry a
  player can use has a place); `projector` round trips; the always-shown labels' boxes (the font's widths from a fixed
  Chakra Petch 12 px table) do not overlap at the map boxes of 960 × 600, 1280 × 800 and a 600 px wide box (*Feed silos*
  and *Water tank* first); `jobCard.spots()`'s shape from a job engine in node (open jobs with places, the current one
  first).
- `node scripts/test-fixes.mjs` — every Phase 4 case, plus: the bad batch's day-0 claim close (§6.8.2: "day 0" and "24:00" in
  the fail text, no "day 1", `failDay` 0); `time.atJobSlow` false → the work clock (90) at an open job's place; `time.holdJobs`
  false → a job closes at its window with its panel open; `time.defaultSpeed` '4x' → a level starts at 4×; `time.signStops`
  false → a sign runs the panel clock (24). `test-jobs.mjs` and `test-level.mjs` unchanged and passing.
- `--steps scripts/p5-map.json` at 1280 × 800 and 960 × 600 — PASS: O opens the map from the farm view and with the focus
  on a HUD key (a mouse click there leaves no focus); Tab inside the map moves the focus and the map stays; from the menu,
  *Farm map* then Esc → the menu again; in the Farm view a click on the house → the House view; `ui.map.state()`: no two always-shown labels overlap (rect intersections 0) at both sizes; the
  farmer's arrow at his position (± 1 map px) and facing (± 5°); one marker for each open job with a place, the current one
  marked; three dead birds laid with `flock.dead.layAt` → three crosses and *3 dead birds*; the bucket set down with G → its
  mark; the flock's dots all inside the house's box (1,800 on day 3); hovering *Feed silos* → a tag with *m* and *s walking*;
  a click on it → the map closes and he arrives within 1.5 m of its stand point; the House view: a click on the floor at
  x 5, z 0 → he walks in through the door to within 1 m; Tab / Enter on a place in the side list walks; Esc closes; from the
  gate, `findPath` to every place's stand point is not null **with the house open**; on a rest day (`farm.house.closed`)
  every inside place reads *The house is shut while it rests* and a click on one does not walk.
- `--steps scripts/p5-first-play.json` — cleared storage, reload: the title's first-run line; *Start a new flock* → the
  *jobs* card anchored on the job card (`ui.intro.state()`: the arrow's box touches the card's box), the clock still over 2 s
  of `advance` (`env.day` unchanged), *Next* → the *signs* card on the gate sign's screen point, *Next* → the *time* card on
  the time bar (its words show the live keys: *O opens the farm map*), *Got it* → no card and the clock runs; with a card
  shown, **Esc answers the card (skips) and the menu does not open** (`ui.openPanelId` null); day 0 08:00 → the *watch*
  card on the flock watch; reload → no card; the guide's *Show the introduction again* → the cards again; nothing in the
  cards a verdict.
- `--steps scripts/p5-a11y.json` — the title's tab order (Continue or Start, Start at the brooding week, the quiet keys, the
  run card); Esc → the menu, every entry by Tab and Enter; a sign, a machine panel, the records book, the skill tree and a
  result opened and used by the keyboard, Esc closing each with the focus back where it was; every focusable element of the
  title, menu, settings, saves, map and the controller shows a visible focus ring (`outline-style` not `none` or a
  box-shadow) when focused; the two text floors (computed): uppercase labels and `.src` source lines ≥ 11 px with a
  contrast ≥ 4.5 : 1, every other text ≥ 12 px, in the HUD and those panels; at 390 × 844 and 412 × 915 the phone note
  shows, `scrollWidth ≤ innerWidth`, its keys ≥ 44 px high; the prep day's first job (the gate dip, the gate sign) done
  with the keyboard alone, and **Next job (J), pause (P), 4× (4) and the map (O) by their keys**, then Tab to the time bar's
  Next job key and Enter.
- `--steps scripts/p5-hud.json` — at 960 × 600 and 1280 × 800: the water condition's supply warning (day 30, `waterPumpUnfixed`
  set by `farm.debug`) shown whole (its last word reachable in the box), the card never over the time bar or the job card;
  HUD size 0.9 / 1.15 / 1.3 → the card widths × the size ± 0.02 (1.3 shows as 1.15 at 960 px), no two HUD cards overlap; the
  watch folded and hidden; caption time 2 → a 4.5 s caption shows 9 s; the legend *always* / *never*; with sound captions on
  an `EV.SOUND_CAPTION` from eval shows `[text]`; no console or page errors.
- `--steps scripts/p5-look.json` — the shots of §6.4 at both sizes, reviewed against its checklist (the report lists what was
  fixed, and the items it handed to the settings / saves packages), no console or page errors. `--steps
  scripts/p5-boot.json` — the loading card's step words seen during boot; `WEBGL_lose_context.loseContext()` in a level →
  the *graphics stopped… saved just now* message with its Reload key, the autosave's `savedAt` newer than before; on the
  title card → the *…Continue goes on from the last time the game saved* words.
- Earlier files (its files touch everything on screen): **every** steps file and play-through of §9.3 with its PASS count;
  the real-input days of `p3-cycle.json` still under 6 minutes of play.

## 11. Integration order
Merge with `--no-ff`, the tests after each: **saves** (the model's two leftovers move numbers first: re-read the hot
season's results in p4-hot and test-cond), **settings** (keys and the camera under everything else; the performance pass),
**sound**, **experience** (it touches every screen: last, with every steps file and play-through run after it). Then the
integrator: adds the new node tests to `npm test` (`test-audio-hour`, `test-saves`, `test-settings`, `test-map`) in
package.json; checks every default against the Phase 4 game (`p5-design-stubs.json`, test-contracts' defaults); removes the
design-round stub notes (`stub: true` in saves.js and ui-intro.js, the disabled slot keys); updates `p5-design-stubs.json`
for any expectation a package's report names (it drives only the §8.10 hooks); runs **the cross-panel look and a11y pass**
after all four merges (one type scale and the two text floors, the close keys, the focus rings and the paddings across
the menu, settings, saves, guide and map together; p5-look's and p5-a11y's checklists, the results in the report);
writes `scripts/p5-play.json` (§9.3) and runs every steps file and play-through of §9.3 at 960 × 600 (and the map, a11y,
hud and look files at 1280 × 800 too); runs `npm run perf` alone; fills PHASE5.md §6.8 / §9 with the measured numbers and ARCHITECTURE.md's **Phase 5 — as
integrated** section (the modules, the contracts as merged, the tests and their counts, the open items).

## 12. Open questions for the farmer
1. **Esc for the menu.** Esc with nothing open now opens the menu (the clock stops). Is that what you expect, or would you
   rather Esc only close panels and the menu sit on the gear key alone?
2. **The map on O.** The map opens with O (for *overview*) and the map key on the time bar; Tab stays the key that moves
   between the buttons on the screen. P pauses the clock, 1 and 4 set its speed and J skips to the next job. Are these easy
   for you to reach and remember, or would you like other keys (M is already the litter moisture view)? Any key can be
   changed in Settings → Keys.
3. **The map stops the clock.** While the map is open the farm stands still, as with the records book. Would you rather watch
   the flock's dots move on the map with the clock running?
4. **Three slots** named by season, level, day and time: enough? Would you like to type your own name for a slot?
5. **Backups as text** (copy, paste back). A whole run is about 210,000 characters, so it comes in about 25 parts of up to
   9,000 characters each (one chat message holds about 10,000); *This farm only* (the farm now, without the level starts
   for replays) is about 6 parts. Would you keep backups in LINE (Keep, or a chat with yourself), in e-mail, or not at
   all? Is copying several parts workable, or is *This farm only* enough for you?
6. **The hot season costs a little weight now**: in April–May the air behind the pads still stands above 28 °C in the hot
   hours, and birds of three weeks and older eat a little less then, so a well-cooled flock finishes about 3–4 % lighter
   at the catch than in the normal season (2,788 g against 2,887 g in our test flock). Does that match your April–May
   flocks? What do you see at the catch in the hot months against the cool months, and from what house temperature do
   your birds eat less?
7. **The sounds.** The catching crew is a murmur of voices without words, the office has a desk fan and a soft phone ring:
   do these sound like your farm? Anything that should be there (a radio in the office, the feed truck's horn, dogs at the
   gate)? And the power-cut alarm: keep beeping every 6 s, or thin out after two minutes as planned?
8. **Sound captions** ([Alarm in the house], [Chicks peeping loudly] …) are off unless you switch them on. On by default?
9. **Screen and text size.** At what screen size do you play? Is the HUD's text big enough at *Normal*, or should *Large* be
   the default?
10. **The first-play pointers** (four cards: the jobs, the signs, the clock, the flock watch): too many, too few? Should a
    harder flock (the hot season, a bad batch…) show one card that says what is different?
11. **Time settings.** You asked for the slower clock and for jobs to stay open while you work on them. These stay on; may we
    let a player switch them off in Settings → Time (for someone who wants a faster game)?
12. **Reduced flock detail** on a slow laptop: the birds stay the same in number and colour but are drawn with simpler shapes.
    If you try *Graphics → Low*, does the flock still read right to you (huddles, panting, spread)?
13. **Coming back to the menu.** What the game menu opens (Settings, Save or load, the map, How to play) now goes back to the
    menu when you close it, and a second Esc returns to the farm. Do you like that, or should closing go straight back to
    the farm?
