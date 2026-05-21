# 3D GP Feel Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first playable Three.js feel prototype for the stylized GP racer: a 3D Formula car proxy, purpose-built GP track, simcade handling, chase camera, and quiet race HUD.

**Architecture:** Keep simulation state independent from Three.js. Three.js renders car, track, camera, lights, and effects as a view over simulation telemetry. DOM remains responsible for HUD, start/results panels, and input prompts.

**Tech Stack:** Vite, TypeScript, Three.js, Vitest, Playwright smoke tests, GLB/glTF-ready asset policy.

---

## File Structure

- `package.json`: add `three`, `vitest`, and a `test` script.
- `src/main.ts`: replace Phaser boot with the Three.js app bootstrap.
- `src/app/createRaceApp.ts`: own app lifecycle, DOM wiring, input polling, update loop, and cleanup.
- `src/game/InputState.ts`: map keyboard/touch/gamepad-ready inputs into smoothed race actions.
- `src/game/SimcadeRaceModel.ts`: renderer-independent handling, race phase, lap timing, rivals, and telemetry.
- `src/game/SimcadeRaceModel.test.ts`: Vitest coverage for launch, throttle/brake, steering, ERS, lap flow, and off-track grip.
- `src/render/ThreeRaceRenderer.ts`: Three.js renderer, scene, lights, camera, car proxy, track, rival proxies, and telemetry-driven updates.
- `src/render/buildGpCircuit.ts`: generate the first fictional European technical GP circuit mesh, kerbs, runoff, and boundaries.
- `src/render/buildFormulaCarProxy.ts`: create a stylized generic Formula car proxy from primitive meshes until a GLB asset is ready.
- `src/ui/HudController.ts`: centralize DOM updates for telemetry, start, results, and transient messages.
- `src/styles.css`: revise HUD toward low-chrome broadcast telemetry and WebGL canvas layout.
- `scripts/smoke.mjs`: update smoke expectations for the Three.js scene and new HUD behavior.
- `public/assets/ASSET_CREDITS.md`: add a “3D rebuild” section noting generated/procedural assets and future GLB credit rules.

---

## Task 1: Dependencies And Test Harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install runtime and test dependencies**

Run:

```bash
npm install three
npm install -D vitest
```

Expected: `package.json` includes `three` in `dependencies` and `vitest` in `devDependencies`.

- [ ] **Step 2: Add the test script**

Edit `package.json` scripts to include:

```json
{
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc && vite build",
    "preview": "vite preview --host 0.0.0.0",
    "test": "vitest run",
    "test:smoke": "node scripts/smoke.mjs"
  }
}
```

- [ ] **Step 3: Verify baseline commands**

Run:

```bash
npm run build
npm test -- --passWithNoTests
```

Expected: build passes; Vitest exits successfully before tests exist.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add threejs test stack"
```

---

## Task 2: Renderer-Independent Simcade Model

**Files:**
- Create: `src/game/SimcadeRaceModel.ts`
- Create: `src/game/SimcadeRaceModel.test.ts`

- [ ] **Step 1: Write failing tests for race phase and driving feel**

Create `src/game/SimcadeRaceModel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SimcadeRaceModel, type RaceActions } from "./SimcadeRaceModel";

const idle: RaceActions = {
  steer: 0,
  throttle: 0,
  brake: 0,
  ers: false,
  launch: false,
  restart: false
};

function run(model: SimcadeRaceModel, seconds: number, input: Partial<RaceActions> = {}) {
  let telemetry = model.telemetry();
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) {
    telemetry = model.update(1 / 60, { ...idle, ...input });
  }
  return telemetry;
}

describe("SimcadeRaceModel", () => {
  it("starts with a countdown and moves into racing", () => {
    const model = new SimcadeRaceModel();
    let telemetry = model.update(1 / 60, { ...idle, launch: true });
    expect(telemetry.phase).toBe("countdown");

    telemetry = run(model, 3.2, { throttle: 1 });
    expect(telemetry.phase).toBe("racing");
    expect(telemetry.speedKph).toBeGreaterThan(40);
  });

  it("accelerates, brakes, and spends ERS only under throttle", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });
    const fast = run(model, 4, { throttle: 1, ers: true });
    expect(fast.speedKph).toBeGreaterThan(120);
    expect(fast.ers).toBeLessThan(0.95);

    const slowed = run(model, 1, { brake: 1 });
    expect(slowed.speedKph).toBeLessThan(fast.speedKph);
    expect(slowed.ers).toBeGreaterThan(fast.ers);
  });

  it("steers with grip limits and loses grip off track", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4, { throttle: 1 });
    const turned = run(model, 1.5, { throttle: 1, steer: 1 });
    expect(turned.car.x).toBeGreaterThan(0.15);

    const offTrack = run(model, 2, { throttle: 1, steer: 1 });
    expect(offTrack.grip).toBeLessThan(0.9);
    expect(offTrack.onTrack).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/game/SimcadeRaceModel.test.ts
```

Expected: failure because `SimcadeRaceModel` does not exist.

- [ ] **Step 3: Implement the model**

Create `src/game/SimcadeRaceModel.ts`:

```ts
export type RacePhase = "ready" | "countdown" | "racing" | "finished";

export type RaceActions = {
  steer: number;
  throttle: number;
  brake: number;
  ers: boolean;
  launch: boolean;
  restart: boolean;
};

export type RaceTelemetry = {
  phase: RacePhase;
  lap: number;
  laps: number;
  countdown: number;
  position: number;
  targetPosition: number;
  speedKph: number;
  ers: number;
  grip: number;
  onTrack: boolean;
  lapTime: number;
  bestLap: number | null;
  totalTime: number;
  lapProgress: number;
  raceProgress: number;
  objective: string;
  message: string;
  car: {
    x: number;
    z: number;
    heading: number;
    yawRate: number;
    slip: number;
    braking: number;
  };
  rivals: Array<{
    id: number;
    x: number;
    z: number;
    heading: number;
    color: string;
    gap: number;
  }>;
};

const LAP_LENGTH = 1800;
const LAPS = 3;
const TRACK_HALF_WIDTH = 5.6;
const MAX_SPEED = 310;
const MIN_RACE_SPEED = 16;
const RIVAL_COLORS = ["#24c7ff", "#f4d35e", "#f7f7f2", "#ff7a2d", "#b88cff", "#1fd17f", "#ff4f83"];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function approach(current: number, target: number, amount: number) {
  return current + (target - current) * clamp(amount, 0, 1);
}

export class SimcadeRaceModel {
  private phase: RacePhase = "ready";
  private countdown = 0;
  private lap = 1;
  private position = 8;
  private speed = 0;
  private x = 0;
  private z = 0;
  private heading = 0;
  private yawRate = 0;
  private slip = 0;
  private grip = 1;
  private ers = 1;
  private lapTime = 0;
  private bestLap: number | null = null;
  private totalTime = 0;
  private message = "Hold throttle to launch";
  private messageTimer = 0;
  private rivals = RIVAL_COLORS.map((color, index) => ({
    id: index + 1,
    lane: (index % 3 - 1) * 2.4,
    distance: 90 + index * 48,
    speed: 142 + index * 8,
    color
  }));

  update(dt: number, actions: RaceActions): RaceTelemetry {
    if (this.phase === "ready" && (actions.launch || actions.throttle > 0.1)) {
      this.phase = "countdown";
      this.countdown = 2.8;
      this.message = "Formation ready";
      this.messageTimer = 1.4;
    }

    if (this.phase === "finished" && actions.restart) {
      this.reset();
      return this.telemetry();
    }

    if (this.phase === "countdown") {
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown === 0) {
        this.phase = "racing";
        this.speed = 64;
        this.message = "Lights out";
        this.messageTimer = 1.2;
      }
    }

    if (this.phase === "racing") {
      this.updateDriving(dt, actions);
      this.updateRivals(dt);
      this.updateLapFlow();
    }

    this.messageTimer = Math.max(0, this.messageTimer - dt);
    return this.telemetry();
  }

  telemetry(): RaceTelemetry {
    const lapDistance = this.z % LAP_LENGTH;
    return {
      phase: this.phase,
      lap: this.lap,
      laps: LAPS,
      countdown: this.countdown,
      position: this.position,
      targetPosition: 3,
      speedKph: Math.round(this.speed),
      ers: this.ers,
      grip: this.grip,
      onTrack: Math.abs(this.x) <= TRACK_HALF_WIDTH,
      lapTime: this.lapTime,
      bestLap: this.bestLap,
      totalTime: this.totalTime,
      lapProgress: clamp(lapDistance / LAP_LENGTH, 0, 1),
      raceProgress: clamp((this.lap - 1 + lapDistance / LAP_LENGTH) / LAPS, 0, 1),
      objective: this.position <= 3 ? "Hold podium pace" : `Catch P${Math.max(3, this.position - 1)}`,
      message: this.messageTimer > 0 ? this.message : "",
      car: {
        x: this.x,
        z: this.z,
        heading: this.heading,
        yawRate: this.yawRate,
        slip: this.slip,
        braking: this.phase === "racing" ? this.lastBrake : 0
      },
      rivals: this.rivals.map((rival) => ({
        id: rival.id,
        x: rival.lane,
        z: rival.distance - this.z,
        heading: 0,
        color: rival.color,
        gap: (rival.distance - this.z) / 42
      }))
    };
  }

  reset() {
    this.phase = "ready";
    this.countdown = 0;
    this.lap = 1;
    this.position = 8;
    this.speed = 0;
    this.x = 0;
    this.z = 0;
    this.heading = 0;
    this.yawRate = 0;
    this.slip = 0;
    this.grip = 1;
    this.ers = 1;
    this.lapTime = 0;
    this.bestLap = null;
    this.totalTime = 0;
    this.message = "Hold throttle to launch";
    this.messageTimer = 0;
  }

  private lastBrake = 0;

  private updateDriving(dt: number, actions: RaceActions) {
    const throttle = clamp(actions.throttle, 0, 1);
    const brake = clamp(actions.brake, 0, 1);
    const steer = clamp(actions.steer, -1, 1);
    this.lastBrake = brake;

    const onTrack = Math.abs(this.x) <= TRACK_HALF_WIDTH;
    const speedRatio = clamp(this.speed / MAX_SPEED, 0, 1);
    const boost = actions.ers && throttle > 0.1 && brake < 0.1 && this.ers > 0.03 ? 1 : 0;
    const acceleration = throttle * (118 - speedRatio * 54);
    const braking = brake * 230;
    const boostPower = boost * 72;
    const drag = 0.045 * this.speed + speedRatio * speedRatio * 38;
    const offTrackDrag = onTrack ? 0 : 82;

    this.speed += (acceleration + boostPower - braking - drag - offTrackDrag) * dt;
    this.speed = clamp(this.speed, this.speed > 0 ? MIN_RACE_SPEED : 0, MAX_SPEED);
    this.ers = clamp(this.ers + brake * 0.28 * dt + 0.025 * dt - boost * 0.38 * dt, 0, 1);

    const gripTarget = onTrack ? clamp(1 - brake * 0.12 - speedRatio * Math.abs(steer) * 0.18, 0.62, 1) : 0.46;
    this.grip = approach(this.grip, gripTarget, dt * 5.5);

    const steerAuthority = (0.8 - speedRatio * 0.42) * this.grip;
    const targetYawRate = steer * steerAuthority;
    this.yawRate = approach(this.yawRate, targetYawRate, dt * 6.5);
    this.heading += this.yawRate * dt;
    this.slip = clamp(Math.abs(this.yawRate) * speedRatio * (1.25 - this.grip), 0, 1);

    const metersPerSecond = this.speed * (1000 / 3600);
    this.z += metersPerSecond * dt * 1.55;
    this.x += Math.sin(this.heading) * metersPerSecond * dt * 0.28 + steer * speedRatio * dt * 2.3;
    this.x = clamp(this.x, -9, 9);
    this.lapTime += dt;
    this.totalTime += dt;
  }

  private updateRivals(dt: number) {
    for (const rival of this.rivals) {
      rival.distance += (rival.speed * (1000 / 3600)) * dt * 1.48;
      if (rival.distance < this.z - 60 && this.position > 1) {
        this.position -= 1;
        rival.distance = this.z + 420;
        rival.lane = ((rival.id + this.position) % 3 - 1) * 2.4;
        this.message = `Passed for P${this.position}`;
        this.messageTimer = 1.2;
      }
    }
  }

  private updateLapFlow() {
    const completedLap = Math.floor(this.z / LAP_LENGTH) + 1;
    if (completedLap > this.lap) {
      if (this.bestLap === null || this.lapTime < this.bestLap) {
        this.bestLap = this.lapTime;
      }
      this.lapTime = 0;
      this.lap = completedLap;
      if (this.lap > LAPS) {
        this.phase = "finished";
        this.lap = LAPS;
        this.message = this.position <= 3 ? "Podium secured" : "Race complete";
        this.messageTimer = 8;
      }
    }
  }
}
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npm test -- src/game/SimcadeRaceModel.test.ts
npm run build
```

Expected: both pass.

Commit:

```bash
git add src/game/SimcadeRaceModel.ts src/game/SimcadeRaceModel.test.ts
git commit -m "feat: add simcade race model"
```

---

## Task 3: Input And HUD Controllers

**Files:**
- Create: `src/game/InputState.ts`
- Create: `src/ui/HudController.ts`
- Modify: `index.html`

- [ ] **Step 1: Create smoothed input state**

Create `src/game/InputState.ts`:

```ts
import type { RaceActions } from "./SimcadeRaceModel";

type KeyMap = {
  left: boolean;
  right: boolean;
  throttle: boolean;
  brake: boolean;
  ers: boolean;
  launch: boolean;
  restart: boolean;
};

function approach(current: number, target: number, amount: number) {
  return current + (target - current) * Math.max(0, Math.min(1, amount));
}

export class InputState {
  private keys: KeyMap = {
    left: false,
    right: false,
    throttle: false,
    brake: false,
    ers: false,
    launch: false,
    restart: false
  };

  private steer = 0;
  private throttle = 0;
  private brake = 0;

  attach(target: Window = window) {
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
  }

  detach(target: Window = window) {
    target.removeEventListener("keydown", this.onKeyDown);
    target.removeEventListener("keyup", this.onKeyUp);
  }

  update(dt: number): RaceActions {
    const steerTarget = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    this.steer = approach(this.steer, steerTarget, dt * (steerTarget === 0 ? 9 : 6));
    this.throttle = approach(this.throttle, this.keys.throttle ? 1 : 0, dt * 7);
    this.brake = approach(this.brake, this.keys.brake ? 1 : 0, dt * 10);

    return {
      steer: this.steer,
      throttle: this.throttle,
      brake: this.brake,
      ers: this.keys.ers,
      launch: this.keys.launch || this.keys.throttle,
      restart: this.keys.restart
    };
  }

  private onKeyDown = (event: KeyboardEvent) => {
    this.setKey(event.code, true);
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.setKey(event.code, false);
  };

  private setKey(code: string, active: boolean) {
    if (code === "ArrowLeft" || code === "KeyA") this.keys.left = active;
    if (code === "ArrowRight" || code === "KeyD") this.keys.right = active;
    if (code === "ArrowUp" || code === "KeyW") this.keys.throttle = active;
    if (code === "ArrowDown" || code === "KeyS") this.keys.brake = active;
    if (code === "ShiftLeft" || code === "ShiftRight") this.keys.ers = active;
    if (code === "Enter" || code === "Space") this.keys.launch = active;
    if (code === "KeyR") this.keys.restart = active;
  }
}
```

- [ ] **Step 2: Create HUD controller**

Create `src/ui/HudController.ts`:

```ts
import type { RaceTelemetry } from "../game/SimcadeRaceModel";

function text(id: string) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing HUD element: ${id}`);
  return element;
}

function formatTime(seconds: number | null) {
  if (seconds === null) return "--.--";
  return seconds.toFixed(2);
}

export class HudController {
  private startPanel = text("start-panel");
  private resultsPanel = text("results-panel");
  private position = text("position");
  private lap = text("lap");
  private best = text("best");
  private delta = text("delta");
  private speed = text("speed");
  private objective = text("objective");
  private raceProgress = text("race-progress") as HTMLElement;
  private ers = text("ers") as HTMLElement;
  private grip = text("grip") as HTMLElement;
  private message = text("message");
  private currentLapTime = text("current-lap-time");
  private resultTitle = text("result-title");
  private resultTotal = text("result-total");
  private resultBest = text("result-best");

  update(telemetry: RaceTelemetry) {
    this.startPanel.classList.toggle("hidden", telemetry.phase !== "ready");
    this.resultsPanel.classList.toggle("hidden", telemetry.phase !== "finished");
    this.position.textContent = String(telemetry.position).padStart(2, "0");
    this.lap.textContent = `${telemetry.lap}/${telemetry.laps}`;
    this.best.textContent = formatTime(telemetry.bestLap);
    this.delta.textContent = telemetry.bestLap === null ? "+0.00" : `+${Math.max(0, telemetry.lapTime - telemetry.bestLap).toFixed(2)}`;
    this.speed.textContent = String(telemetry.speedKph);
    this.objective.textContent = telemetry.objective;
    this.raceProgress.style.transform = `scaleX(${telemetry.raceProgress})`;
    this.ers.style.transform = `scaleX(${telemetry.ers})`;
    this.grip.style.transform = `scaleX(${telemetry.grip})`;
    this.currentLapTime.textContent = formatTime(telemetry.lapTime);
    this.message.classList.toggle("hidden", telemetry.message.length === 0);
    this.message.querySelector("span")!.textContent = telemetry.message || " ";

    if (telemetry.phase === "countdown") {
      this.message.classList.remove("hidden");
      this.message.querySelector("span")!.textContent = Math.ceil(telemetry.countdown).toString();
    }

    if (telemetry.phase === "finished") {
      this.resultTitle.textContent = telemetry.position <= telemetry.targetPosition ? "Podium Target Hit" : "Race Complete";
      this.resultTotal.textContent = formatTime(telemetry.totalTime);
      this.resultBest.textContent = formatTime(telemetry.bestLap);
    }
  }
}
```

- [ ] **Step 3: Keep existing DOM ids**

Do not remove the existing IDs in `index.html` during this task. The controller above expects:

```html
<section class="game-panel start-panel" id="start-panel">
<section class="game-panel results-panel hidden" id="results-panel">
<strong id="position">08</strong>
<strong id="lap">1/3</strong>
<strong id="best">--.--</strong>
<strong id="delta">+0.00</strong>
<span id="speed">0</span>
<div class="objective-chip" id="objective">Gain 5 places</div>
<i id="race-progress"></i>
<i id="ers"></i>
<i id="grip"></i>
<section class="race-message" id="message">
<strong id="current-lap-time">0.00</strong>
<strong id="result-title">Finished</strong>
<dd id="result-total">--.--</dd>
<dd id="result-best">--.--</dd>
```

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm run build
```

Expected: TypeScript compiles.

Commit:

```bash
git add src/game/InputState.ts src/ui/HudController.ts index.html
git commit -m "feat: add race input and hud controllers"
```

---

## Task 4: Three.js Scene, Car Proxy, And GP Circuit

**Files:**
- Create: `src/render/buildFormulaCarProxy.ts`
- Create: `src/render/buildGpCircuit.ts`
- Create: `src/render/ThreeRaceRenderer.ts`

- [ ] **Step 1: Create the Formula car proxy**

Create `src/render/buildFormulaCarProxy.ts`:

```ts
import * as THREE from "three";

export function buildFormulaCarProxy(color = "#e72436") {
  const car = new THREE.Group();
  car.name = "formula-car-proxy";

  const bodyMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.18 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: "#101317", roughness: 0.55, metalness: 0.12 });
  const tireMaterial = new THREE.MeshStandardMaterial({ color: "#060708", roughness: 0.82 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.34, 2.8), bodyMaterial);
  body.position.y = 0.34;
  car.add(body);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 1.45), bodyMaterial);
  nose.position.set(0, 0.34, -1.85);
  car.add(nose);

  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.62), darkMaterial);
  cockpit.position.set(0, 0.64, -0.28);
  car.add(cockpit);

  const frontWing = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.1, 0.32), darkMaterial);
  frontWing.position.set(0, 0.2, -2.72);
  car.add(frontWing);

  const rearWing = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.48, 0.16), darkMaterial);
  rearWing.position.set(0, 0.72, 1.42);
  car.add(rearWing);

  for (const x of [-0.86, 0.86]) {
    for (const z of [-1.56, 1.04]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.26, 18), tireMaterial);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(x, 0.22, z);
      car.add(tire);
    }
  }

  return car;
}
```

- [ ] **Step 2: Create the GP circuit scene pieces**

Create `src/render/buildGpCircuit.ts`:

```ts
import * as THREE from "three";

export function buildGpCircuit() {
  const circuit = new THREE.Group();
  circuit.name = "fictional-european-gp-circuit";

  const asphalt = new THREE.MeshStandardMaterial({ color: "#2f3538", roughness: 0.68, metalness: 0.02 });
  const runoff = new THREE.MeshStandardMaterial({ color: "#6f9866", roughness: 0.88 });
  const kerbRed = new THREE.MeshStandardMaterial({ color: "#d92635", roughness: 0.52 });
  const kerbWhite = new THREE.MeshStandardMaterial({ color: "#f3f5f2", roughness: 0.48 });
  const barrierMaterial = new THREE.MeshStandardMaterial({ color: "#dfe4e8", roughness: 0.6 });

  const grass = new THREE.Mesh(new THREE.PlaneGeometry(80, 2200), runoff);
  grass.rotation.x = -Math.PI / 2;
  grass.position.z = 620;
  circuit.add(grass);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(12, 2200, 1, 40), asphalt);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.012;
  road.position.z = 620;
  circuit.add(road);

  for (let index = 0; index < 80; index += 1) {
    const z = -480 + index * 28;
    for (const side of [-1, 1]) {
      const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 10), index % 2 === 0 ? kerbRed : kerbWhite);
      kerb.position.set(side * 6.28, 0.055, z);
      circuit.add(kerb);

      const barrier = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.8, 16), barrierMaterial);
      barrier.position.set(side * 10.2, 0.42, z);
      circuit.add(barrier);
    }
  }

  const timingBridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.8, 0.5), barrierMaterial);
  timingBridge.position.set(0, 5.2, -38);
  circuit.add(timingBridge);

  const bridgeLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), barrierMaterial);
  bridgeLeft.position.set(-8.8, 2.5, -38);
  circuit.add(bridgeLeft);

  const bridgeRight = bridgeLeft.clone();
  bridgeRight.position.x = 8.8;
  circuit.add(bridgeRight);

  return circuit;
}
```

- [ ] **Step 3: Create the renderer**

Create `src/render/ThreeRaceRenderer.ts`:

```ts
import * as THREE from "three";
import type { RaceTelemetry } from "../game/SimcadeRaceModel";
import { buildFormulaCarProxy } from "./buildFormulaCarProxy";
import { buildGpCircuit } from "./buildGpCircuit";

export class ThreeRaceRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1800);
  private car = buildFormulaCarProxy();
  private rivals = new Map<number, THREE.Group>();

  constructor(private readonly parent: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor("#091015");
    this.parent.appendChild(this.renderer.domElement);
    this.scene.fog = new THREE.Fog("#091015", 150, 820);

    const hemi = new THREE.HemisphereLight("#d7ecff", "#182410", 1.7);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight("#ffffff", 2.8);
    sun.position.set(-12, 28, -18);
    this.scene.add(sun);

    this.scene.add(buildGpCircuit());
    this.scene.add(this.car);
    this.resize();
  }

  resize() {
    const width = this.parent.clientWidth || window.innerWidth;
    const height = this.parent.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(telemetry: RaceTelemetry) {
    this.car.position.set(telemetry.car.x, 0, 0);
    this.car.rotation.y = -telemetry.car.heading;
    this.car.rotation.z = -telemetry.car.yawRate * 0.22;

    const speedRatio = telemetry.speedKph / 310;
    this.camera.fov = 58 + speedRatio * 10;
    this.camera.position.set(
      telemetry.car.x * 0.55,
      5.2 - telemetry.car.braking * 0.45 + telemetry.car.slip * 0.24,
      10.5 + speedRatio * 2.2
    );
    this.camera.lookAt(telemetry.car.x * 0.35, 0.6, -9 - speedRatio * 5);
    this.camera.updateProjectionMatrix();

    for (const rival of telemetry.rivals) {
      if (rival.z < -45 || rival.z > 280) {
        const mesh = this.rivals.get(rival.id);
        if (mesh) mesh.visible = false;
        continue;
      }

      let mesh = this.rivals.get(rival.id);
      if (!mesh) {
        mesh = buildFormulaCarProxy(rival.color);
        this.rivals.set(rival.id, mesh);
        this.scene.add(mesh);
      }
      mesh.visible = true;
      mesh.position.set(rival.x, 0, -rival.z);
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
```

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm run build
```

Expected: TypeScript compiles.

Commit:

```bash
git add src/render/buildFormulaCarProxy.ts src/render/buildGpCircuit.ts src/render/ThreeRaceRenderer.ts
git commit -m "feat: add threejs gp scene"
```

---

## Task 5: App Bootstrap And First Playable Loop

**Files:**
- Create: `src/app/createRaceApp.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Create app lifecycle**

Create `src/app/createRaceApp.ts`:

```ts
import { InputState } from "../game/InputState";
import { SimcadeRaceModel } from "../game/SimcadeRaceModel";
import { ThreeRaceRenderer } from "../render/ThreeRaceRenderer";
import { HudController } from "../ui/HudController";

export function createRaceApp() {
  const container = document.getElementById("game");
  if (!container) throw new Error("Missing #game container");

  const input = new InputState();
  const model = new SimcadeRaceModel();
  const renderer = new ThreeRaceRenderer(container);
  const hud = new HudController();
  let last = performance.now();
  let frame = 0;

  input.attach();

  function tick(now: number) {
    const dt = Math.min(1 / 20, (now - last) / 1000);
    last = now;
    const telemetry = model.update(dt, input.update(dt));
    renderer.update(telemetry);
    hud.update(telemetry);
    frame = requestAnimationFrame(tick);
  }

  function resize() {
    renderer.resize();
  }

  window.addEventListener("resize", resize);
  frame = requestAnimationFrame(tick);

  return {
    destroy() {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      input.detach();
      renderer.dispose();
    }
  };
}
```

- [ ] **Step 2: Replace Phaser boot**

Replace `src/main.ts` with:

```ts
import "./styles.css";
import { createRaceApp } from "./app/createRaceApp";

createRaceApp();
```

- [ ] **Step 3: Update critical CSS for WebGL canvas**

In `src/styles.css`, ensure these rules exist:

```css
html,
body,
#app,
#game {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

#game canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.hud {
  pointer-events: none;
}

.hud button,
.touch-controls,
.touch-controls * {
  pointer-events: auto;
}
```

Keep existing HUD ids and layout, but remove styling that assumes a Phaser canvas controls background color.

- [ ] **Step 4: Verify and commit**

Run:

```bash
npm test
npm run build
```

Expected: all tests and build pass.

Commit:

```bash
git add src/app/createRaceApp.ts src/main.ts src/styles.css
git commit -m "feat: boot playable threejs racer"
```

---

## Task 6: Smoke Test And Visual Verification

**Files:**
- Modify: `scripts/smoke.mjs`
- Modify: `public/assets/ASSET_CREDITS.md`

- [ ] **Step 1: Update smoke test expectations**

Modify `scripts/smoke.mjs` so it verifies:

```js
await page.goto(server.url);
await page.waitForSelector("#game canvas");
await page.waitForSelector("#start-panel:not(.hidden)");
await page.keyboard.down("ArrowUp");
await page.waitForTimeout(3800);
await expectVisibleText(page, "#message", /Lights out|Catch|Passed|Formation|[123]/);
const speed = Number(await page.locator("#speed").innerText());
if (speed <= 20) throw new Error(`Expected speed over 20 after launch, got ${speed}`);
const canvasBox = await page.locator("#game canvas").boundingBox();
if (!canvasBox || canvasBox.width < 300 || canvasBox.height < 300) {
  throw new Error("Expected WebGL canvas to fill the viewport");
}
```

Keep the existing server startup and screenshot capture behavior.

- [ ] **Step 2: Document asset status**

Append this section to `public/assets/ASSET_CREDITS.md`:

```md
## 3D GP Rebuild

- Initial Formula car and GP circuit are procedural/proxy geometry authored in code for this project.
- Future shipped 3D models must use GLB or glTF 2.0 and include source, license, author, URL, and conversion notes here.
- Do not add licensed Formula 1 team, circuit, sponsor, or car likeness assets.
```

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run build
npm run test:smoke
```

Expected: all pass and smoke screenshots show a nonblank 3D GP scene with readable HUD.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke.mjs public/assets/ASSET_CREDITS.md
git commit -m "test: verify threejs race prototype"
```

---

## Task 7: Feel Tuning Pass

**Files:**
- Modify: `src/game/SimcadeRaceModel.ts`
- Modify: `src/game/SimcadeRaceModel.test.ts`
- Modify: `src/render/ThreeRaceRenderer.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Add test coverage for braking discipline**

Add this test to `src/game/SimcadeRaceModel.test.ts`:

```ts
it("rewards braking before hard steering with better grip", () => {
  const model = new SimcadeRaceModel();
  model.update(1 / 60, { ...idle, launch: true });
  run(model, 4, { throttle: 1 });

  const lateTurn = run(model, 1, { throttle: 1, steer: 1 });

  const disciplined = new SimcadeRaceModel();
  disciplined.update(1 / 60, { ...idle, launch: true });
  run(disciplined, 4, { throttle: 1 });
  run(disciplined, 0.5, { brake: 1 });
  const controlledTurn = run(disciplined, 1, { throttle: 0.4, steer: 1 });

  expect(controlledTurn.grip).toBeGreaterThan(lateTurn.grip);
  expect(controlledTurn.car.slip).toBeLessThan(lateTurn.car.slip);
});
```

- [ ] **Step 2: Tune handling constants until the test passes**

Adjust only these constants and formulas in `src/game/SimcadeRaceModel.ts`:

```ts
const MAX_SPEED = 310;
const TRACK_HALF_WIDTH = 5.6;
const acceleration = throttle * (118 - speedRatio * 54);
const braking = brake * 230;
const gripTarget = onTrack ? clamp(1 - brake * 0.12 - speedRatio * Math.abs(steer) * 0.18, 0.62, 1) : 0.46;
const steerAuthority = (0.8 - speedRatio * 0.42) * this.grip;
```

Expected feel: full throttle is fast, brake meaningfully lowers speed, and sharp steering at high speed creates visible slip.

- [ ] **Step 3: Tune camera for speed and braking**

In `src/render/ThreeRaceRenderer.ts`, keep these camera ranges:

```ts
this.camera.fov = 58 + speedRatio * 10;
this.camera.position.set(
  telemetry.car.x * 0.55,
  5.2 - telemetry.car.braking * 0.45 + telemetry.car.slip * 0.24,
  10.5 + speedRatio * 2.2
);
this.camera.lookAt(telemetry.car.x * 0.35, 0.6, -9 - speedRatio * 5);
```

Only adjust within plus or minus 20 percent during tuning.

- [ ] **Step 4: Run verification and commit**

Run:

```bash
npm test
npm run build
npm run test:smoke
```

Expected: all pass; screenshots show a stable chase camera, readable car, and quiet HUD.

Commit:

```bash
git add src/game/SimcadeRaceModel.ts src/game/SimcadeRaceModel.test.ts src/render/ThreeRaceRenderer.ts src/styles.css
git commit -m "tune: improve simcade handling feel"
```

---

## Self-Review

Spec coverage:

- 3D runtime: covered by Tasks 1, 4, and 5.
- Renderer-independent simulation: covered by Task 2.
- Handling priority: covered by Tasks 2 and 7.
- Camera priority: covered by Tasks 4 and 7.
- Racecraft pressure: covered minimally by rival proxies in Task 2; deeper AI remains outside this first feel prototype.
- GP circuit taste: covered by Task 4.
- Asset policy: covered by Task 6.
- Testing and verification: covered by Tasks 1, 2, 6, and 7.

Intentional gaps for a later plan:

- GLB car sourcing or Blender-authored hero car.
- Real track mesh curves instead of straight/segmented first circuit pieces.
- Gamepad support.
- Audio.
- Deeper rival AI, drafting, and defensive lines.
- Multiple tracks and progression.
