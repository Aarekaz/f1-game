# Apex Formula

A small browser racing game about getting into a fast rhythm on a fictional GP circuit.

This is not trying to be a licensed Formula 1 sim. The goal is a web game that feels sharp, readable, and a little stylish: a low camera, a quick car, clear braking references, simple race pressure, and enough feedback that you can feel when you are carrying speed well.

## Screenshots

| Clear practice | Runoff recovery |
| --- | --- |
| ![Aurelia GP front straight](readme-assets/screenshots/01-aurelia-front-straight.png) | ![Aurelia GP runoff recovery](readme-assets/screenshots/02-aurelia-kerb-recovery.png) |

| Wet storm | Dusk racing pack |
| --- | --- |
| ![Northstar Ring wet storm](readme-assets/screenshots/03-northstar-wet-storm.png) | ![Mirage Bay GP dusk pack](readme-assets/screenshots/04-mirage-dusk-pack.png) |

| Loose-surface crawl |
| --- |
| ![Aurelia GP loose-surface crawl](readme-assets/screenshots/05-aurelia-loose-surface-crawl.png) |

| Wet launch |
| --- |
| ![Northstar Ring physical wet launch](readme-assets/screenshots/06-northstar-physical-launch.png) |

| Progressive runoff drag |
| --- |
| ![Aurelia GP progressive runoff drag](readme-assets/screenshots/07-aurelia-progressive-runoff-drag.png) |

| Brake release load |
| --- |
| ![Aurelia GP brake release load](readme-assets/screenshots/08-aurelia-brake-release-load.png) |

| High-speed tire scrub |
| --- |
| ![Aurelia GP high-speed steering scrub](readme-assets/screenshots/09-aurelia-high-speed-steering-scrub.png) |

| Raised kerb contact |
| --- |
| ![Aurelia GP raised kerb contact](readme-assets/screenshots/10-aurelia-raised-kerb-contact.png) |

| Standing water grip loss |
| --- |
| ![Aurelia GP standing water grip loss](readme-assets/screenshots/11-aurelia-standing-water-grip-loss.png) |

| High-speed aero platform |
| --- |
| ![Aurelia GP high-speed aero platform](readme-assets/screenshots/12-aurelia-aero-platform-load.png) |

| Inertial chase camera |
| --- |
| ![Aurelia GP inertial chase camera](readme-assets/screenshots/13-aurelia-inertial-chase-camera.png) |

| Load-transfer braking |
| --- |
| ![Aurelia GP load-transfer braking](readme-assets/screenshots/14-aurelia-load-transfer-braking.png) |

| Tire relaxation recovery |
| --- |
| ![Aurelia GP tire relaxation recovery](readme-assets/screenshots/15-aurelia-tire-relaxation-recovery.png) |

| Lateral load cornering |
| --- |
| ![Aurelia GP lateral load cornering](readme-assets/screenshots/16-aurelia-lateral-load-cornering.png) |

| Lift-off engine braking |
| --- |
| ![Aurelia GP lift-off engine braking](readme-assets/screenshots/17-aurelia-lift-off-engine-braking.png) |

| Trail-braking turn-in |
| --- |
| ![Aurelia GP trail-braking turn-in](readme-assets/screenshots/18-aurelia-trail-braking-turn-in.png) |

| Threshold braking |
| --- |
| ![Aurelia GP threshold braking](readme-assets/screenshots/19-aurelia-threshold-braking.png) |

| Road-frame chase camera |
| --- |
| ![Aurelia GP road-frame camera drift](readme-assets/screenshots/20-aurelia-road-frame-camera-drift.png) |

| Tire-load feedback |
| --- |
| ![Aurelia GP tire-load feedback](readme-assets/screenshots/21-aurelia-tire-load-feedback.png) |

| Loaded car visuals |
| --- |
| ![Aurelia GP loaded car visuals](readme-assets/screenshots/22-aurelia-loaded-car-visuals.png) |

| Road-speed chase framing |
| --- |
| ![Aurelia GP road-speed chase framing](readme-assets/screenshots/23-aurelia-road-speed-framing.png) |

| Steering-load feedback |
| --- |
| ![Aurelia GP steering-load feedback](readme-assets/screenshots/24-aurelia-steering-load-feedback.png) |

| Road-feel feedback |
| --- |
| ![Northstar Ring road-feel feedback](readme-assets/screenshots/25-northstar-road-feel-feedback.png) |

| Split-surface contact |
| --- |
| ![Aurelia GP split-surface contact](readme-assets/screenshots/26-aurelia-split-surface-contact.png) |

| Crest contact load |
| --- |
| ![Aurelia GP crest contact load](readme-assets/screenshots/27-aurelia-crest-contact.png) |

| Rear traction rotation |
| --- |
| ![Aurelia GP rear traction rotation](readme-assets/screenshots/28-aurelia-rear-traction-rotation.png) |

| Damper rebound |
| --- |
| ![Northstar Ring damper rebound](readme-assets/screenshots/29-northstar-damper-rebound.png) |

| Aero balance in traffic |
| --- |
| ![Aurelia GP aero balance in traffic](readme-assets/screenshots/30-aurelia-aero-balance-washout.png) |

## What is here

- A Three.js race view with a closed, world-space procedural GP-style circuit.
- The renderer uses an explicit sRGB/filmic pipeline with soft shadows, so lighting and car contact read more like a finished browser game.
- A lightweight simcade handling model: throttle, brake, steering, ERS, grip, slip, asphalt/kerb/runoff/gravel surface feel, adaptive race traffic, and overtakes.
- Track sections, braking zones, chevron-style racing-line assist, boards, a real circuit minimap, rhythm scoring, and HUD cues.
- The active checkpoint gate is highlighted with a low-chrome in-world marker, so the next objective is readable without swallowing the driving view.
- A pre-race circuit briefing with selected-track outline, difficulty, grip, weather, and assist status.
- A more readable track surface with a rubbered racing groove, wet sheen, standing water, painted grid slots, and braking marks.
- Track-following runoff and gravel zones replace old rectangular dressing planes, so escape areas read like part of the circuit instead of flat scenery cards.
- Layered GP-style safety barriers add rails, joints, and accent panels so track edges stop looking like plain repeated blocks.
- A full-bleed sky dome plus camera-safe runoff and terrain bands keep the circuit broad without turning elevated side scenery into a foreground wall.
- The racing surface now evolves during a run: clean laps build rubber, damp sessions form a drying line, and both feed grip and wet-surface visuals.
- Visible standing-water patches now share data with the physics model, so wet puddles locally reduce adhesion, add wheelspin/lockup risk, and strengthen spray.
- Running the rubbered line now gives a small grip reward, while wandering offline can pick up marbles and make the tires feel dirty for the next few corners.
- A fictional timing tower with named rival drivers, team codes, player row, and live gap readouts.
- Nearby rival cars carry compact in-world driver/team/gap plates, so traffic is readable without staring at the timing tower.
- Rival plates now shrink and fade around close traffic, keeping race information present without covering the braking reference.
- Racing-style gear, RPM, shift-cut, traction-bite, and shift-light feedback in the HUD and handling model.
- Lift-off engine braking now loads the nose and slows the car through the powertrain instead of making throttle release feel like a neutral coast.
- Trail braking now has its own handling state: partial brake plus steering loads the nose, helps the car rotate, and still carries lockup risk if you overdo it.
- Threshold braking now rewards measured brake pressure before lockup, so easing off after a panic stop can recover longitudinal grip instead of dragging flat tires forever.
- Tire-load feedback now comes from one shared physics signal and feeds the HUD, tire audio, gamepad haptics, and renderer telemetry together.
- Steering-load feedback now rises from tire force, saturation, slip angle, front axle load, and driver steering, then feeds the HUD, tire audio, and gamepad haptics together.
- Road-feel feedback now turns road compression, suspension load, travel, camber, and surface edge load into one shared signal for the HUD, tire audio, haptics, car body, and camera.
- Split-surface contact now notices when the left and right side of the car are on different grip or height, then tugs yaw, lateral motion, tire scrub, sound, haptics, and camera feel together.
- Vertical tire contact now drops over light crests and recovers under compression/downforce, feeding traction, braking, steering authority, tire noise, haptics, camera float, and chassis motion.
- Suspension damper impulses now track compression and rebound speed, feeding tire contact, grip, road feel, haptics, tire audio, camera lift, and car body pitch.
- Aero balance now splits downforce across front and rear load, with ride height, traffic wash, wing damage, and surface disruption changing high-speed steering, braking, camera motion, sound, and rumble.
- Powered corner exits now add rear-traction rotation, so throttle plus steering can nudge yaw, wheelspin, scrub, tire chatter, camera drift, and car body load from one shared signal.
- The formula car now visibly leans, pitches, steers, and squashes its loaded tires from the same physics signals, so grip loss reads through the car instead of only the HUD.
- The pod camera adds a lightweight cockpit frame with halo, nose, mirrors, and a steering wheel so the alternate camera feels like a formula-car view.
- The chase camera looks through the upcoming racing line with subtle corner roll, so fast bends read earlier instead of feeling like a fixed rear mount.
- The default chase camera sits closer in clean air, keeping the car present in frame while still opening up for rejoin moments.
- The chase camera now has a small inertial rig, so acceleration, braking, aero load, and lateral slip tug the view instead of leaving the car screen-pinned.
- The chase camera now has road-frame drift, letting slip angle and lateral load move the car inside the view while the road stays readable as the reference.
- The chase camera now opens up with speed, tire load, traffic, and braking zones, giving the road more room when the car is moving quickly through a pack.
- A chase-frame guard now pulls the look target back toward the car when hard cornering or rejoin motion tries to push it out of frame.
- Off-track recovery keeps the road in frame instead of letting the view become a giant car over empty grass.
- Portrait screens get a backed-off chase camera, so mobile play shows the road instead of filling the screen with the rear wing.
- Camera-safe GP gate logic gives the chase view a small lift under bridges and timing structures, keeping the fictional formula car readable at speed.
- Trackside posts near the chase camera are culled when they would cut across the car, which keeps the view usable in dense circuit sections.
- Foreground safety barriers now yield to the chase camera during kerb and runoff moments, keeping the car and road readable.
- Overhead gate pieces also respect the chase camera, so checkpoint signage does not slap across the road when the player arrives at speed.
- Close braking and chevron boards also yield when they would cover the player car in the chase view.
- The chase camera now lifts and pulls back during runoff or gravel mistakes, keeping rejoin moments readable instead of letting foreground geometry swallow the car.
- Rejoin framing now recenters on the actual car when it runs wide, instead of letting the ideal racing line pull the player into the HUD.
- A tiny Apex Series ladder that turns the fictional tracks into three authored events with local progress.
- The pre-race briefing shows the active series contract before launch, including position, flow, cleanliness, and penalty requirements.
- The live HUD tracks the active series target during the run, including current position, flow, and penalty state.
- Sector timing now gives live pace ratings, so the engineer can call out purple, green, solid, or lost sectors during the run.
- Apex Series targets are judged at the flag, and the next event unlocks only after the current scenario target is met.
- Race results explain the contract outcome so missed targets point to the next thing to improve.
- The primary result action changes to retry a missed target or rerun a cleared session.
- Replays of already-cleared series events keep the unlock, but the result verdict still describes the current run honestly.
- Race results can advance straight into the next Apex Series event, so a session feels like part of a ladder instead of a one-off run.
- Race results show steward status and penalties, not just pace numbers.
- Denser circuit dressing: catch fencing, pit wall modules, marshal posts, fictional paddock blocks, and venue-specific hero structures.
- Selectable balanced/manual assists so keyboard and touch players can drive cleanly without hiding the simcade handling.
- Steering input is shaped for finer center control and quicker opposite-lock recovery, so keyboard and gamepad corrections feel less twitchy.
- Committed steering now travels more through chassis heading and tire scrub instead of a direct sideways lane shift, so the car's rotation better explains its path through the corner.
- A driver-aid HUD chip that shows when balanced assist is actively steering, braking, or trimming throttle.
- Race radio and control messages use different visual tones for launch, sector, overtake, and warning events.
- The racing HUD collapses into a lighter instrument cluster once the car is moving, leaving more of the circuit visible.
- The HUD now yields when the chase camera drifts toward an edge, so the car and rejoin line win over the instrument cluster.
- Mobile racing uses a smaller, softer instrument cluster so portrait play keeps more road visible.
- Fuel load burns down during a run, making the car gradually lighter and sharper instead of keeping identical handling for every lap.
- Keyboard steering now ramps from a softer initial angle to full lock, so quick taps make line corrections instead of instantly punching in maximum steering.
- Road adhesion and lateral scrub now share the tire budget, so heavy steering, dirty tires, kerbs, and runoff change speed and grip instead of feeling like a flat lateral script.
- The handling model samples four tire contact patches, so brushing a kerb or dropping the outside tires onto runoff changes grip before the car center has fully left the asphalt.
- Track-edge load now turns asphalt-to-kerb/runoff crossings into suspension, rumble, and contact-patch events instead of simple surface-label swaps.
- Raised kerbs and shoulder drops now live in the road height model, so the chassis lifts, rolls, and loads over edge contact instead of only changing grip numbers.
- Balanced recovery keeps forced-wide moments on the visible runoff apron, so the car does not spend the camera view floating through empty grass.
- The outer recovery apron now slows the car through drag, scrub, rumble, and tire saturation instead of snapping speed down with an invisible cap.
- Longitudinal grip now gates throttle and braking, so running wide over kerbs/runoff costs drive and stopping power instead of only changing the scenery label.
- Loose-surface mistakes now crawl back when the driver releases full-lock steering, so runoff and gravel cost time without turning the car into a dead stop.
- Stranded runoff recovery now rewards steering back toward the circuit while steering away still bogs the car, making low-speed rejoin control feel intentional instead of stuck.
- Stopped runoff and gravel recoveries now respond to partial throttle when the driver points back at the circuit, so rejoining feels like crawling through a surface instead of toggling between stuck and launched.
- High-speed full-lock steering now eats into the same tire budget before the car leaves the track, so the front tires scrub and the engine stops pulling like it is still on a straight.
- Steering now needs rolling speed before it can yaw or sidestep the car, so turning the wheel at a full stop no longer rotates the chassis in place.
- Road centering, camber, and rejoin pull now need rolling speed or active throttle, so a stopped off-line car stays planted instead of being dragged sideways by invisible forces.
- Steering, throttle, and braking now share one tire-force budget, so asking for full power, brake, and rotation together creates saturation, understeer, lockup, and weaker drive instead of three independent arcade inputs.
- Forward bite and road alignment now reduce track progress when the car is crossed up or sliding, so speed only becomes useful when the car is actually pointed and planted.
- Road-relative slip angle now compares where the car is pointing with where the tires are actually traveling, so a crossed-up car scrubs speed and loses bite while normal small tire angles still feel clean.
- Elevation changes now alter road load, so crests lighten the tire contact patch and compressions add suspension load instead of grade acting only like an uphill/downhill speed term.
- Suspension load, road grade, chassis pitch, and chassis roll are now part of the sim state, so braking, banking, rough surfaces, and runoff visibly and physically load the car.
- Car and rival ride height now follows the lateral surface, so banking and runoff edges move the chassis instead of rendering every vehicle at the centerline elevation.
- Road camber now feeds the handling model, giving banked surfaces a subtle downhill pull and chassis response instead of being only visual scenery.
- Predictive balanced-assist behavior that looks ahead to wet fast bends and trims steering/brake/throttle before casual players run wide.
- Slipstream and dirty air are visible and physical, with wake ribbons and light camera buffet when traffic disturbs the car.
- High-speed runs now get peripheral ground-rush streaks and stronger player spray, so speed reads through the world instead of only through the speedometer.
- Heavy braking builds brake temperature, fade risk, pressure trails, and heat feedback so slowing the car has the same tactile weight as accelerating it.
- Clean high-speed running now builds aero platform load, adding planted grip and suspension compression while water, kerbs, runoff, dirty air, and wing damage take it away.
- Braking, lift-off, throttle, and aero now move load between the front and rear axles, changing turn-in, lockup, traction, and chassis pitch.
- Sustained cornering now moves load across the car, changing chassis roll, tire relaxation, and scrub instead of treating left/right grip as perfectly flat.
- Overdriven tires now recover over a short relaxation window, so grip comes back through the contact patch instead of snapping instantly clean.
- Panic braking now bleeds steering authority through lockup and tire saturation, so full brake plus full lock scrubs forward instead of rotating like an arcade handbrake.
- Hard brake release now leaves a short unsettled load-transfer window, so grip recovers through suspension movement instead of snapping instantly clean.
- Full braking can now bring the car all the way to rest, and throttle has to build speed back up instead of snapping to a hidden rolling minimum.
- Race launches now start from tire bite instead of injecting a big hidden speed jump, while full keyboard throttle still gets the car moving through visible wheelspin.
- Standing starts and post-stop restarts now build through available traction, so wet asphalt crawls away with wheelspin instead of launching like dry pavement.
- Full-lock restarts now scrub front grip and give up launch drive, so throttle plus maximum steering feels like overloaded tires instead of a sideways snap.
- Wheel-to-wheel contact can now leave persistent front-wing damage, costing downforce and making the car harder to place until the run ends.
- A richer fictional formula car with a sculpted monocoque, cockpit/driver details, tire sidewalls, aero inlets, spinning wheels, wheel-speed blur, brake glow, and active rear-wing movement.
- The car now carries a soft dynamic contact shadow, which helps it feel planted on the circuit instead of floating above the procedural surface.
- Local personal bests per fictional track and weather pairing.
- A first external asset pass using a small CC0 Kenney Racing Kit subset.
- Engine, ERS, and tire-scrub audio generated with browser Web Audio.
- ERS deployment is visible on the car through a cyan rear glow and sidepod energy traces, so boost has visual feedback as well as speed and audio.
- A fictional aero-boost flap opens on fast straights during committed ERS runs, trimming drag and making the rear wing visibly come alive.
- Tire temperature and wear now build from wheelspin, lockups, surface abuse, and wet cooling, with a live tire meter in the race HUD.
- A small persistent audio toggle for quiet play sessions.
- Wet sessions pulse rear rain lights and soft red glows on the fictional formula cars, with rival spray plumes and lens droplets so storm traffic has clearer depth and race presence.
- Storm sessions now add distant lightning forks and a restrained sky flash, giving wet weather its own atmosphere without hiding braking references.
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
