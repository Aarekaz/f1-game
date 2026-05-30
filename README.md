# Apex Formula

A small browser racing game about getting into a fast rhythm on a fictional GP circuit.

This is not trying to be a licensed Formula 1 sim. The goal is a web game that feels sharp, readable, and a little stylish: a low camera, a quick car, clear braking references, simple race pressure, and enough feedback that you can feel when you are carrying speed well.

## What is here

- A Three.js race view with a closed, world-space procedural GP-style circuit.
- A lightweight simcade handling model: throttle, brake, steering, ERS, grip, slip, asphalt/kerb/runoff/gravel surface feel, adaptive race traffic, and overtakes.
- Track sections, braking zones, chevron-style racing-line assist, boards, a real circuit minimap, rhythm scoring, and HUD cues.
- The active checkpoint gate is highlighted in-world, so the next objective is readable through the circuit instead of only through the HUD.
- A pre-race circuit briefing with selected-track outline, difficulty, grip, weather, and assist status.
- A more readable track surface with a rubbered racing groove, wet sheen, standing water, painted grid slots, and braking marks.
- A fictional timing tower with named rival drivers, team codes, player row, and live gap readouts.
- Nearby rival cars carry compact in-world driver/team/gap plates, so traffic is readable without staring at the timing tower.
- Racing-style gear, RPM, and shift-light feedback in the HUD.
- The pod camera adds a lightweight cockpit frame with halo, nose, mirrors, and a steering wheel so the alternate camera feels like a formula-car view.
- The chase camera looks through the upcoming racing line with subtle corner roll, so fast bends read earlier instead of feeling like a fixed rear mount.
- A tiny Apex Series ladder that turns the fictional tracks into three authored events with local progress.
- The pre-race briefing shows the active series contract before launch, including position, flow, cleanliness, and penalty requirements.
- The live HUD tracks the active series target during the run, including current position, flow, and penalty state.
- Apex Series targets are judged at the flag, and the next event unlocks only after the current scenario target is met.
- Race results explain the contract outcome so missed targets point to the next thing to improve.
- The primary result action changes to retry a missed target or rerun a cleared session.
- Replays of already-cleared series events keep the unlock, but the result verdict still describes the current run honestly.
- Race results can advance straight into the next Apex Series event, so a session feels like part of a ladder instead of a one-off run.
- Race results show steward status and penalties, not just pace numbers.
- Denser circuit dressing: catch fencing, pit wall modules, marshal posts, fictional paddock blocks, and venue-specific hero structures.
- Selectable balanced/manual assists so keyboard and touch players can drive cleanly without hiding the simcade handling.
- Steering input is shaped for finer center control and quicker opposite-lock recovery, so keyboard and gamepad corrections feel less twitchy.
- A driver-aid HUD chip that shows when balanced assist is actively steering, braking, or trimming throttle.
- Race radio and control messages use different visual tones for launch, sector, overtake, and warning events.
- Predictive balanced-assist behavior that looks ahead to wet fast bends and trims steering/brake/throttle before casual players run wide.
- Slipstream and dirty air are visible and physical, with wake ribbons and light camera buffet when traffic disturbs the car.
- Heavy braking shows pressure trails and heat feedback so slowing the car has the same tactile weight as accelerating it.
- Wheel-to-wheel contact can now leave persistent front-wing damage, costing downforce and making the car harder to place until the run ends.
- A richer fictional formula car with a sculpted monocoque, cockpit/driver details, tire sidewalls, aero inlets, spinning wheels, wheel-speed blur, brake glow, and active rear-wing movement.
- Local personal bests per fictional track and weather pairing.
- A first external asset pass using a small CC0 Kenney Racing Kit subset.
- Engine, ERS, and tire-scrub audio generated with browser Web Audio.
- ERS deployment is visible on the car through a cyan rear glow and sidepod energy traces, so boost has visual feedback as well as speed and audio.
- A fictional aero-boost flap opens on fast straights during committed ERS runs, trimming drag and making the rear wing visibly come alive.
- Tire temperature and wear now build from wheelspin, lockups, surface abuse, and wet cooling, with a live tire meter in the race HUD.
- A small persistent audio toggle for quiet play sessions.
- Wet sessions pulse rear rain lights and soft red glows on the fictional formula cars, with rival spray plumes and lens droplets so storm traffic has clearer depth and race presence.
- Keyboard, touch, and gamepad controls, with held pedals, edge-safe command inputs, and browser-safe controller rumble for kerbs, wet road, and traction mistakes.
- Unit tests for the race model and a Playwright smoke test for the playable browser build.

## Controls

- `W` or `ArrowUp`: throttle
- `S` or `ArrowDown`: brake
- `A/D` or `ArrowLeft/ArrowRight`: steer
- `Shift`: ERS
- `C`: switch camera
- `Enter` or `Space`: start
- `Esc` or `P`: pause and resume
- `R`: restart after the race

Touch controls appear on mobile-sized screens, with camera, recover, ERS, throttle, brake, steer, and a small pause button kept away from the driving controls.

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

The next big improvement is a cleaner GLB/glTF asset pipeline for objects that should stop being procedural, especially higher-fidelity venue dressing and car/circuit materials.

For now, the game uses a mix of procedural geometry and a small CC0 asset subset. That is intentional: it keeps the game fast to iterate on while the handling, camera, HUD, sound, and track language settle.
