# Solvara — a sun-soaked open city

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/xr-liantong/gta6-witness/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/xr-liantong/gta6-witness/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A single-page 3D crime sandbox set in **Solvara**, an invented Mediterranean city of
pastel blocks, palm-lined streets and a long beach. You walk, steal cars, take a job
from a local fixer, attract police attention and try to shake it. Everything is built
from code at load time: no downloaded models, textures, fonts or audio.

Keyboard and mouse, third person. Start at the title card, press **PLAY**, then walk
into the city.

## Controls

| Action | Key |
| --- | --- |
| Move | W A S D |
| Sprint | Shift |
| Jump / handbrake | Space |
| Look / aim | Mouse (click to capture the pointer; if the browser refuses, hold a button and drag) |
| Enter or leave a car | E |
| Fire pistol | Left mouse button |
| Horn | H |
| Pause / menu | Esc |

## What is in the box

| Path | Responsibility |
| --- | --- |
| `game/index.html` | The page: two canvases, the import map, the title and pause cards. |
| `game/src/config.js` | City identity, tuning numbers, palette, law, save key. |
| `game/src/input.js` | Keyboard, mouse and pointer lock; intent only, no game rules. |
| `game/src/loop.js` | Fixed-step clock and the frame budget. |
| `game/src/world.js` | Procedural city data: roads, lots, buildings, palms, markers. |
| `game/src/render.js` | That data as a three.js scene: sun, sky, sea, facades, props. |
| `game/src/camera.js` | Third-person rig with mouse look and wall avoidance. |
| `game/src/player.js` | Dani Cruz on foot, the body, and entering or leaving a car. |
| `game/src/vehicle-mesh.js` | Low-poly car bodies, wheels and police lights. |
| `game/src/vehicles.js` | Arcade car physics, the fleet, collisions and the job car. |
| `game/src/traffic.js` | Civilian cars looping along the road grid. |
| `game/src/crowd.js` | Pedestrians on the pavements, and how they react to guns. |
| `game/src/police.js` | Wanted stars, responding cruisers, sirens and their fire. |
| `game/src/missions.js` | The three-step job: markers, dialogue, rewards, retry. |
| `game/src/combat.js` | Hitscan pistol, tracers, sparks and the consequences. |
| `game/src/hud.js` | Health, cash, stars, mission card, minimap and speedometer. |
| `game/src/audio.js` | Synthesised engine, siren, gunshot and footsteps. |
| `game/src/main.js` | Wiring: build once, then update and draw each frame; save/load. |
| `main.ts` | Build entry the grader runs: stages `game/` and `screenshots/`, writes `dossier.json`. |
| `screenshots/` | The four contact-sheet pictures, rendered from `?shot=…` by a headless browser. |
| `vendor/makefun-game.ts` | The kit's dossier builder, vendored unchanged. |

`game/vendor/three.module.min.js` is the only third-party file: three.js r159, kept
byte-for-byte as published, loaded through the import map. No CDN, no fetch, no
network reference of any kind — the page runs entirely from this folder.

## Opening it locally

ES modules need a server rather than a `file://` open. Any static server rooted at the
repository works, for example:

```
python -m http.server 8080
```

then open `http://127.0.0.1:8080/game/`. The game starts at `game/index.html`.
`?shot=street|chase|mission|downtown` puts the world in a fixed, reproducible pose for
screenshots; `?demo=drive|chase` drops you straight into a moving car (the chase demo
already has three wanted stars and two cruisers on your tail); `?seed=<n>` changes the
city's random pattern.

## Screenshots

`screenshots/` holds the pictures the judge sees, three or four of them, sorted by file
name: the first one is the cover. They are rendered from the page by a headless Chrome,
never painted by hand, and each one is at most 256 KiB and 1280 px on its long edge.
`main.ts` copies the folder into the dossier, so a picture that is missing breaks the
build instead of shipping empty.

## Building the submission

```
MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies `game/` and `screenshots/` into `out/`, hands both to the kit's
`buildDossier`, and writes `out/dossier.json`. The script refuses to run when the game
entry, the pictures or a size cap is missing.

## The job

Reina Sosa runs the marina. She needs a specific emerald coupé moved off the hotel
forecourt before sunrise, and she does not care how. Meet her at the marina for forty
dollars up front, take the car from Hotel Miramar, drive it to Pier Nine, and stay clean
long enough to collect the other two hundred and fifty. The hand-over is real: the coupé
leaves the world, and the beacon moves on. Get wasted mid-job and the car reappears on
the forecourt so the theft can be tried again. Cash, ammunition, health and mission
progress survive a reload through `localStorage`.

## Heat

Crime raises stars, cruisers spawn on the nearest avenue and drive at the player — siren
on, both bars flashing, shots fired inside thirty metres. Stars are tinted from white
through orange to deep red, so a still frame reads the heat before the number. Distance
is the way out: hold three hundred metres for three seconds and a star drops, or stay
out of sight for eight and the city calms down by itself.

## Design notes

- **One file, one job.** The modules above only import downward: `main` wires, `render`
  and `hud` display, `world` and `config` are data, `vehicles` owns physics.
- **Deterministic.** A small seeded PRNG builds the city; the same seed always yields
  the same streets, so the screenshot poses are stable.
- **All original.** Solvara, Dani Cruz, Reina Sosa, the Emerald Coupé, SOL 92.7 and the
  districts are invented for this project; nothing is traced from an existing game.
- **Zero assets.** Facade, asphalt and water textures are painted into offscreen
  canvases at startup; the engine and siren are oscillators.
