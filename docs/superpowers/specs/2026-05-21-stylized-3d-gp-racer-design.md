# Stylized 3D GP Racer Design

## Status

Approved for design by the user on 2026-05-21.

## Product Direction

Rebuild the current browser racer into a stylized 3D simcade Formula racing game. The game should feel serious, polished, and tactile rather than toy-like. The first playable target is a fictional purpose-built Grand Prix circuit with a European technical circuit mood: green runoff, clean kerbs, chicanes, medium-speed corners, subtle elevation hints, and racecraft built around braking discipline and corner exits.

The current Phaser prototype is useful as a gameplay sketch, but the next direction should not continue polishing the same 2D presentation. The target experience is a WebGL chase-camera racer with real 3D car presence, a readable GP circuit, and a restrained broadcast-style interface.

## Design Pillars

### 1. Handling First

Handling is the core feature. The car must feel like it has weight, grip limits, and consequences.

- Throttle and brake should be analog in the simulation even when keyboard input is digital.
- Steering should include speed-sensitive response, steering assist, tire slip, and recovery from overdriving.
- Braking should matter before corners. A player who brakes early, turns smoothly, and exits cleanly should gain time.
- ERS or boost should be tactical, not a constant arcade speed button.
- Collisions should cost momentum without instantly making the race feel broken.

### 2. Camera Sells Mass

The camera must make the car feel expensive before any HUD text explains the game.

- Use a low chase camera behind the car.
- Add speed-based field-of-view changes, braking compression, small road vibration, and subtle body roll.
- Keep the car readable at all times, especially during rivals, kerbs, and corner exits.
- Avoid camera drama that hides the racing line or causes motion sickness.

### 3. Racecraft Creates Pressure

The race should feel like a sprint, not a time-only toy.

- The first target mode is a 3-lap sprint against 5-8 rivals.
- Rivals should defend, attack, and make believable mistakes.
- The player should have a clear podium or target-position objective.
- Drafting, braking zones, and corner exits should create overtaking chances.
- Lap and sector timing should make progress legible.

### 4. GP Circuit Taste

The first track should be a fictional European technical GP circuit, not a street course and not a licensed replica.

- Use green runoff, red-white kerbs, sponsor-safe generic boards, pit-wall elements, marshal posts, fencing, grandstands, and trees or hills as distant context.
- The layout should include one main straight, one heavy braking zone, one chicane, one medium-speed flowing section, and one final corner that rewards exit speed.
- The visual direction should be clean and modern, with restrained color and clear track boundaries.

## First Playable Scope

The first production slice should produce one polished playable race, not a menu-heavy shell.

Included:

- One 3D player car with a consistent stylized Formula silhouette.
- One fictional GP circuit with collision boundaries and readable kerbs.
- Chase camera with speed, braking, and steering feedback.
- Simcade handling model with throttle, brake, steering, grip, tire slip, and ERS.
- 5-8 AI rivals with simple racing-line behavior and overtaking pressure.
- 3-lap sprint flow: ready, countdown, racing, finished.
- Broadcast-style HUD: position, lap, speed, ERS, sector/lap delta, target objective.
- Results screen with finish position, best lap, and objective result.
- Keyboard controls first, with gamepad support as a near-term follow-up.
- Smoke, sparks, tire marks, and trackside polish only when they improve feel and readability.

Excluded from the first slice:

- Real licensed teams, real circuit names, or real sponsor marks.
- Full career progression.
- Deep vehicle setup menus.
- Online multiplayer.
- Damage simulation beyond momentum and feedback effects.
- Multiple tracks before the first track feels good.

## Technical Direction

Move the runtime toward a plain TypeScript + Vite + Three.js architecture. Use GLB or glTF 2.0 for 3D assets. Keep simulation state outside the renderer so handling, race flow, timing, and AI can be tested without needing a WebGL scene.

Recommended module boundaries:

- `src/game`: simulation, race state, vehicle physics, inputs, AI, timing, and scoring.
- `src/render`: Three.js scene setup, camera, lighting, materials, car presentation, track presentation, particles, and effects.
- `src/assets`: asset manifest and loading policy.
- `src/ui`: DOM HUD, start/results panels, settings, and input prompts.

The existing `RaceModel` ideas can inform the new simulation, especially race phases, objective tracking, lap timing, and ERS. The current Phaser scene should be treated as a prototype reference, not as the future renderer.

## Input Model

Represent player intent as actions, not raw keys:

- `steer`
- `throttle`
- `brake`
- `ers`
- `pause`
- `restart`

Keyboard should map to these actions with smoothing so controls do not feel binary. Gamepad can feed the same action shape with analog values.

## Asset Policy

Use only free assets with clear licenses, or generated assets owned by the project. Prefer a small number of coherent assets over many mixed packs.

Asset targets:

- Stylized Formula car in GLB format.
- Track mesh or procedural track pieces with consistent materials.
- Kerbs, barriers, fencing, boards, cones, pit wall, timing bridge, and grandstand pieces.
- Particle textures for tire smoke, sparks, and dust.
- Simple audio set for engine, tire scrub, ERS, countdown, impact, and UI.

Every third-party asset must be credited in `public/assets/ASSET_CREDITS.md` or an equivalent tracked credits file.

## UI Direction

The HUD should feel like broadcast telemetry, not dashboard cards.

- Keep persistent UI at the edges.
- Avoid large floating cards during driving.
- Use position, lap, speed, ERS, grip, and timing deltas as compact telemetry.
- Let urgent messages appear briefly and disappear.
- Start and results panels can be richer, but they should still feel like racing software, not a landing page.

## Testing And Verification

Core simulation should have unit-level coverage where possible:

- input smoothing
- vehicle acceleration/braking
- grip and tire slip behavior
- race phase transitions
- lap/sector timing
- objective completion
- AI position/racecraft rules

Browser smoke tests should cover:

- game boots with the HUD visible
- countdown begins and transitions into racing
- keyboard throttle moves the car
- steering changes car heading
- lap/timing UI updates
- race can finish and show results

Visual verification should include desktop and mobile screenshots once the WebGL scene exists. The scene must be checked for nonblank canvas, readable car framing, non-overlapping HUD, and visible track boundaries.

## Implementation Strategy

Work in small commits and keep the game playable after each major slice.

Suggested order:

1. Add Three.js runtime alongside the current project shell.
2. Create a minimal 3D scene with a temporary car proxy, road plane, camera, and HUD bridge.
3. Port or rewrite the simulation as renderer-independent state.
4. Implement simcade vehicle handling and input smoothing.
5. Build the first GP circuit layout and track boundaries.
6. Add camera feel: follow, FOV, roll, braking compression, vibration.
7. Add rivals and racecraft pressure.
8. Add timing, objective, and results polish.
9. Replace temporary proxies with coherent free or generated assets.
10. Run playtests and tune handling before expanding content.

## Success Criteria

The rebuild is successful when the first 30 seconds communicate the new quality level without explanation:

- The car feels weighted and controllable.
- Braking and corner exits matter.
- The camera makes speed and mass visible.
- Rivals create pressure without feeling random.
- The HUD is useful but quiet.
- The GP circuit feels like a real racing place, not a random road.
- The game remains lightweight enough to load and run well in a browser.
