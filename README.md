# Apex Formula

A small browser racing game about getting into a fast rhythm on a fictional GP circuit.

This is not trying to be a licensed Formula 1 sim. The goal is a web game that feels sharp, readable, and a little stylish: a low camera, a quick car, clear braking references, simple race pressure, and enough feedback that you can feel when you are carrying speed well.

## What is here

- A Three.js race view with a procedural GP-style circuit.
- A lightweight simcade handling model: throttle, brake, steering, ERS, grip, slip, asphalt/kerb/runoff/gravel surface feel, adaptive race traffic, and overtakes.
- Track sections, braking zones, racing-line hints, boards, chevrons, rhythm scoring, and HUD cues.
- A first external asset pass using a small CC0 Kenney Racing Kit subset.
- Engine, ERS, and tire-scrub audio generated with browser Web Audio.
- Keyboard and touch controls.
- Unit tests for the race model and a Playwright smoke test for the playable browser build.

## Controls

- `W` or `ArrowUp`: throttle
- `S` or `ArrowDown`: brake
- `A/D` or `ArrowLeft/ArrowRight`: steer
- `Shift`: ERS
- `Enter` or `Space`: start
- `R`: restart after the race

Touch controls appear on mobile-sized screens.

## Run it

```sh
npm install
npm run dev
```

Then open the local URL Vite prints in the terminal.

## Check it

```sh
npm test
npm run build
npm run test:smoke
```

The smoke test launches the game in a browser, starts a race, drives for a few seconds, and checks that the WebGL canvas, HUD, controls, and motion are alive.

## Project shape

```text
src/app/                 browser app bootstrapping
src/game/                simulation, input, and track data
src/render/              Three.js scene and procedural geometry
src/audio/               Web Audio game-feel layer
src/ui/                  DOM HUD updates
scripts/smoke.mjs        Playwright browser smoke test
```

The main rule is simple: game state lives in `src/game`, rendering lives in `src/render`, and the HUD stays in normal HTML/CSS. That keeps the code easier to reason about while the game gets more ambitious.

## Current direction

The next big improvement is authored 3D assets: a better Formula-style car model, richer circuit furniture, grandstands, marshal posts, trees, lighting, and materials that make the track feel less like a prototype. The code is set up so those can come in as GLB or glTF assets later without changing the race model.

For now, the game uses a mix of procedural geometry and a small CC0 asset subset. That is intentional: it keeps the game fast to iterate on while the handling, camera, HUD, sound, and track language settle.
