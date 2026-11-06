# Chicken Farm

A browser game that teaches broiler farming by running one flock through a whole cycle on a Thai tunnel-ventilated (EVAP) farm: planning the farm, preparing the house, the chicks' first week, weeks 2 to 5, harvest and clean-out.

There are no lessons or quizzes. Facts sit on signs at the place on the farm where you use them, a job list walks you through each day's work, and the flock shows the result: chicks huddle when they are cold, pant along the walls when they are hot, and grow on target when the house is right.

**Play it:** [Chicken Farm](https://claude.ai/artifact/6THB4Yg5V7hQ3KPGDjQQjm) (desktop browser, keyboard and mouse).

## What is in the game

- **The full flock cycle**: 7 levels from planning to an empty, rested house, with daily rounds, problem events and a pass or fail at each level's key target.
- **A flock that reacts**: 1,800 drawn birds, from yellow chicks to white broilers, driven by a climate and growth model (house air, brooders, minimum ventilation, tunnel fans, cooling pad, wind chill, litter moisture, feed, water and weight).
- **Signs with sources**: each fact names its guide, or says "general" for general broiler practice.
- **Flock watch and night check**: early warnings with the likely cause and where to look, before a level is lost.
- **Daily records**: weight against target, feed, water, deaths, FCR and litter.
- **Skill tree**: 11 branches. Level 1 shows more, level 2 makes that area's jobs faster, and level 3 hands routine work to the equipment, which can sometimes fail.
- **Harder flocks** after the first cycle: hot season, rainy season with a power cut, a bad batch of chicks, and a water problem.
- **Save slots**, a settings menu, a farm map and quiet farm sounds.

## Controls

| Key | Action |
| --- | --- |
| W A S D, or click | Walk (Shift or double-click to run) |
| Right-drag, arrow keys | Turn the camera |
| Mouse wheel, + / − | Zoom |
| E | Use a machine, read a sign, pick up a bird |
| O | Farm map |
| Esc | Close a panel, open the menu |
| H | Show or hide the controls legend |

All keys can be changed in the settings menu.

## Run it locally

You need Node.js 18 or newer.

```bash
npm install
```

```bash
npm run build
```

The build writes one self-contained page to `dist/index.html`. It loads three.js from the jsDelivr CDN, so open it in a browser while online.

## Tests

```bash
npm test
```

This runs the node test suites for the simulation, job engine, levels, skills, saves and sound. `scripts/shoot.mjs` drives the built game in headless Chromium (Playwright) for screenshots and scripted play-throughs, for example:

```bash
node scripts/shoot.mjs --scenario cold-hot --size 960x600
```

## Code layout

- `src/` holds the game modules: `sim.js` and `farm*.js` are the climate and flock model, `job-engine.js`, `level.js` and `run.js` the jobs and levels, `ui*.js` the HUD and panels, and `house*.js`, `world*.js`, `props*.js`, `flock*.js` and `player*.js` the 3D scene.
- `scripts/` holds the tests, scripted play-throughs and tools.
- `ARCHITECTURE.md` describes how the parts fit together. `PHASE2.md` to `PHASE5.md` and `SKILLS.md` are the design specs for each stage of the build.

Built with [three.js](https://threejs.org/) and [esbuild](https://esbuild.github.io/).
