import { describe, expect, it } from "vitest";
import { SimcadeRaceModel, type RaceActions } from "./SimcadeRaceModel";
import { TRACK_NAME, sampleTrack, trackCenterAt } from "./trackPath";
import { findAssist, findTrack, findWeather } from "../world/FictionalGpWorld";

const idle: RaceActions = {
  steer: 0,
  throttle: 0,
  brake: 0,
  ers: false,
  launch: false,
  recover: false,
  restart: false
};

function run(model: SimcadeRaceModel, seconds: number, input: Partial<RaceActions> = {}) {
  let telemetry = model.telemetry();
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) {
    telemetry = model.update(1 / 60, { ...idle, ...input });
  }
  return telemetry;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function testSurfaceRelief(track: ReturnType<typeof sampleTrack>, lateral: number) {
  const absoluteLateral = Math.abs(lateral);
  const kerbInnerEdge = track.halfWidth - 0.55;
  const kerbOuterEdge = track.halfWidth + 0.35;
  const kerbRampIn = clamp((absoluteLateral - kerbInnerEdge) / 0.32, 0, 1);
  const kerbRampOut = 1 - clamp((absoluteLateral - (kerbOuterEdge - 0.18)) / 0.52, 0, 1);
  const kerbCrown = Math.min(kerbRampIn, kerbRampOut) * 0.052;
  const shoulderDrop = -clamp((absoluteLateral - kerbOuterEdge) / 2.25, 0, 1) * 0.038;
  return kerbCrown + shoulderDrop;
}

function runGuided(model: SimcadeRaceModel, seconds: number) {
  let telemetry = model.telemetry();
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) {
    const steer = clamp(-telemetry.carX / 3.8, -0.8, 0.8);
    telemetry = model.update(1 / 60, { ...idle, throttle: 1, ers: true, steer });
  }
  return telemetry;
}

function runRubberedLine(model: SimcadeRaceModel, seconds: number) {
  let telemetry = model.telemetry();
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) {
    const track = sampleTrack(telemetry.trackOffset);
    const lineError = telemetry.carX - track.racingLineOffset;
    const steer = clamp(-lineError / 2.3 - telemetry.car.heading * 1.2 - telemetry.car.yawRate * 0.45, -0.86, 0.86);
    telemetry = model.update(1 / 60, { ...idle, throttle: 1, ers: true, steer });
  }
  return telemetry;
}

function runUntilFinished(model: SimcadeRaceModel, maxSeconds: number) {
  let telemetry = model.telemetry();
  for (let elapsed = 0; elapsed < maxSeconds && telemetry.phase !== "finished"; elapsed += 1 / 60) {
    const track = sampleTrack(telemetry.trackOffset);
    const lineError = telemetry.carX - track.racingLineOffset;
    const steer = clamp(-lineError / 2.2 - telemetry.car.heading * 1.1 - telemetry.car.yawRate * 0.42, -0.92, 0.92);
    const speedSurplus = telemetry.speedKph - track.targetSpeedKph;
    const brake = telemetry.speedKph < 38 ? 0 : clamp((speedSurplus - 12) / 72 + Math.abs(steer) * 0.1, 0, 0.82);
    const throttle = telemetry.speedKph < 38 ? 0.72 : brake > 0.08 ? 0.18 : 1;
    telemetry = model.update(1 / 60, { ...idle, throttle, brake, ers: brake < 0.08, steer });
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
    expect(telemetry.scenarioName).toContain(TRACK_NAME);
    expect(telemetry.trackName).toBe(TRACK_NAME);
    expect(telemetry.weatherName).toBe("Clear Practice");
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

  it("turns the countdown into a throttle-controlled launch", () => {
    const disciplined = new SimcadeRaceModel({
      track: findTrack("northstar"),
      weather: findWeather("storm"),
      assist: findAssist("balanced")
    });
    disciplined.update(1 / 60, { ...idle, launch: true });
    const controlled = run(disciplined, 3.2, { throttle: 0.6 });

    const overRevved = new SimcadeRaceModel({
      track: findTrack("northstar"),
      weather: findWeather("storm"),
      assist: findAssist("balanced")
    });
    overRevved.update(1 / 60, { ...idle, launch: true });
    const messy = run(overRevved, 3.2, { throttle: 1 });

    expect(controlled.launchQuality).toBeGreaterThan(messy.launchQuality);
    expect(controlled.speedKph).toBeGreaterThan(messy.speedKph);
    expect(messy.car.wheelspin).toBeGreaterThan(controlled.car.wheelspin);
  });

  it("starts the race launch from tire bite instead of a hidden speed jump", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("northstar"),
      weather: findWeather("storm"),
      assist: findAssist("balanced")
    });
    model.update(1 / 60, { ...idle, launch: true });

    let firstRacing = model.telemetry();
    for (let elapsed = 0; elapsed < 3.4 && firstRacing.phase !== "racing"; elapsed += 1 / 60) {
      firstRacing = model.update(1 / 60, { ...idle, throttle: 0.62 });
    }
    const rolling = run(model, 1.2, { throttle: 0.62 });

    expect(firstRacing.phase).toBe("racing");
    expect(firstRacing.speedKph).toBeLessThan(68);
    expect(firstRacing.trackOffset).toBeLessThan(1);
    expect(rolling.speedKph).toBeGreaterThan(firstRacing.speedKph + 45);
    expect(rolling.trackOffset).toBeGreaterThan(firstRacing.trackOffset + 24);
  });

  it("keeps full keyboard throttle launches moving even in storm conditions", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("northstar"),
      weather: findWeather("storm"),
      assist: findAssist("balanced")
    });
    model.update(1 / 60, { ...idle, launch: true });

    let firstRacing = model.telemetry();
    for (let elapsed = 0; elapsed < 3.4 && firstRacing.phase !== "racing"; elapsed += 1 / 60) {
      firstRacing = model.update(1 / 60, { ...idle, throttle: 1 });
    }
    const rolling = run(model, 1.2, { throttle: 1 });

    expect(firstRacing.launchQuality).toBeGreaterThan(0.3);
    expect(firstRacing.car.wheelspin).toBeGreaterThan(0.5);
    expect(firstRacing.speedKph).toBeGreaterThan(24);
    expect(rolling.speedKph).toBeGreaterThan(firstRacing.speedKph + 42);
  });

  it("requests a camera snap when the race launches", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });

    let launched = model.telemetry();
    for (let elapsed = 0; elapsed < 3.4 && launched.phase !== "racing"; elapsed += 1 / 60) {
      launched = model.update(1 / 60, { ...idle, throttle: 0.7 });
    }

    expect(launched.phase).toBe("racing");
    expect(launched.cameraSnap).toBe(true);
  });

  it("configures fictional GP tracks and weather as session state", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("northstar"),
      weather: findWeather("storm"),
      assist: findAssist("balanced")
    });

    const telemetry = model.telemetry();

    expect(telemetry.scenarioName).toBe("Northstar Ring Sprint");
    expect(telemetry.trackName).toBe("Northstar Ring");
    expect(telemetry.weatherName).toBe("Wet Storm");
    expect(telemetry.surfaceGrip).toBeLessThan(0.9);
    expect(telemetry.roadWetness).toBeGreaterThan(0.8);
    expect(telemetry.rainIntensity).toBeGreaterThan(0.8);
    expect(telemetry.trackEvolutionState).toBe("Wet track");
    expect(telemetry.assistName).toBe("Balanced Assist");
  });

  it("rubbers in the racing line during a clean dry stint", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("balanced")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 3.2, { throttle: 0.72 });

    const evolved = runGuided(model, 14);

    expect(evolved.trackRubber).toBeGreaterThan(0.025);
    expect(evolved.surfaceGrip).toBeGreaterThan(1);
    expect(["Green track", "Rubber building"]).toContain(evolved.trackEvolutionState);
  });

  it("rewards the rubbered line and punishes dirty offline marbles", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 3.2, { throttle: 0.72 });

    const rubbered = runRubberedLine(model, 20);
    expect(rubbered.trackRubber).toBeGreaterThan(0.025);
    expect(rubbered.rubberedLineGrip).toBeGreaterThanOrEqual(0);

    const offLine = run(model, 4.2, { throttle: 1, steer: 1 });
    expect(offLine.marbles).toBeGreaterThan(rubbered.marbles);
    expect(offLine.dirtyTirePickup).toBeGreaterThan(rubbered.dirtyTirePickup);
    expect(["Marbles offline", "Dirty tires", "Runoff", "Gravel"]).toContain(offLine.gripState);
  });

  it("builds a drying line in a damp non-rainy session", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("mirage"),
      weather: findWeather("overcast"),
      assist: findAssist("balanced")
    });
    const initialWetness = model.telemetry().roadWetness;
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 3.2, { throttle: 0.72 });

    const evolved = runGuided(model, 10);

    expect(evolved.dryingLine).toBeGreaterThan(0);
    expect(evolved.roadWetness).toBeLessThan(initialWetness);
    expect(evolved.surfaceGrip).toBeGreaterThan(findWeather("overcast").gripMultiplier);
  });

  it("burns fuel and makes the car lighter during a committed run", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("balanced")
    });
    const initial = model.telemetry();
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 3.2, { throttle: 0.72 });

    const evolved = runGuided(model, 18);

    expect(evolved.fuelLoad).toBeLessThan(initial.fuelLoad);
    expect(evolved.fuelMassKg).toBeLessThan(initial.fuelMassKg);
    expect(["Heavy fuel", "Fuel coming down", "Light car"]).toContain(evolved.fuelState);
  });

  it("heats brakes under repeated heavy braking and exposes fade risk", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("northstar"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    const initial = model.telemetry();
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 3.2, { throttle: 1 });
    run(model, 3.2, { throttle: 1, brake: 1 });

    const heated = model.telemetry();

    expect(heated.brakeTemp).toBeGreaterThan(initial.brakeTemp);
    expect(heated.brakeFade).toBeGreaterThanOrEqual(0);
    expect(["Brakes ready", "Brakes hot", "Brake fade"]).toContain(heated.brakeState);
    expect(heated.speedKph).toBeLessThan(260);
  });

  it("makes panic braking shed steering authority instead of adding rotation", () => {
    const trail = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    trail.update(1 / 60, { ...idle, launch: true });
    run(trail, 4.6, { throttle: 1, ers: true });
    const controlled = run(trail, 1.05, { brake: 0.72, steer: 0.55 });

    const panic = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    panic.update(1 / 60, { ...idle, launch: true });
    run(panic, 4.6, { throttle: 1, ers: true });
    const locked = run(panic, 1.05, { brake: 1, steer: 1 });

    expect(locked.speedKph).toBeLessThan(controlled.speedKph);
    expect(Math.abs(locked.car.heading)).toBeLessThan(Math.abs(controlled.car.heading));
    expect(Math.abs(locked.carX)).toBeLessThan(Math.abs(controlled.carX) + 0.8);
    expect(locked.car.lockup).toBeGreaterThan(controlled.car.lockup);
    expect(locked.car.understeer).toBeGreaterThan(controlled.car.understeer);
    expect(locked.lateralScrub).toBeGreaterThan(controlled.lateralScrub);
    expect(locked.forwardBite).toBeLessThan(controlled.forwardBite);
  });

  it("rewards threshold braking before the tires lock", () => {
    const threshold = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    threshold.update(1 / 60, { ...idle, launch: true });
    run(threshold, 4.6, { throttle: 1, ers: true });
    const modulated = run(threshold, 0.95, { brake: 0.72 });

    const panic = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    panic.update(1 / 60, { ...idle, launch: true });
    run(panic, 4.6, { throttle: 1, ers: true });
    const locked = run(panic, 0.95, { brake: 1 });

    expect(modulated.thresholdBraking).toBeGreaterThan(0.18);
    expect(locked.thresholdBraking).toBeLessThan(modulated.thresholdBraking);
    expect(locked.car.lockup).toBeGreaterThan(modulated.car.lockup);
    expect(modulated.longitudinalGrip).toBeGreaterThan(locked.longitudinalGrip);
    expect(modulated.forwardBite).toBeGreaterThan(locked.forwardBite);
  });

  it("separates front lock risk from rear brake stability", () => {
    const panicModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    panicModel.update(1 / 60, { ...idle, launch: true });
    run(panicModel, 4.8, { throttle: 1, ers: true });
    const panic = run(panicModel, 0.82, { brake: 1 });

    const trailModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    trailModel.update(1 / 60, { ...idle, launch: true });
    run(trailModel, 4.8, { throttle: 1, ers: true });
    const trail = run(trailModel, 0.82, { brake: 0.46, steer: 0.68 });

    const powerModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    powerModel.update(1 / 60, { ...idle, launch: true });
    run(powerModel, 4.8, { throttle: 1, ers: true });
    const power = run(powerModel, 0.82, { throttle: 0.7, steer: 0.68 });

    expect(panic.brakeBalanceLoad).toBeGreaterThan(0.18);
    expect(panic.frontLockRisk).toBeGreaterThan(trail.frontLockRisk + 0.04);
    expect(panic.car.lockup).toBeGreaterThan(trail.car.lockup);
    expect(trail.rearBrakeStability).toBeLessThan(power.rearBrakeStability - 0.04);
    expect(trail.brakeBalanceLoad).toBeGreaterThan(power.brakeBalanceLoad + 0.08);
    expect(Math.abs(trail.car.yawRate)).toBeGreaterThan(Math.abs(panic.car.yawRate));
  });

  it("lets easing brake pressure recover grip after an initial lockup", () => {
    const eased = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    eased.update(1 / 60, { ...idle, launch: true });
    run(eased, 4.6, { throttle: 1, ers: true });
    run(eased, 0.42, { brake: 1 });
    const recovered = run(eased, 0.75, { brake: 0.52 });

    const held = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    held.update(1 / 60, { ...idle, launch: true });
    run(held, 4.6, { throttle: 1, ers: true });
    run(held, 0.42, { brake: 1 });
    const dragged = run(held, 0.75, { brake: 1 });

    expect(recovered.thresholdBraking).toBeGreaterThan(dragged.thresholdBraking);
    expect(recovered.car.lockup).toBeLessThan(dragged.car.lockup);
    expect(recovered.longitudinalGrip).toBeGreaterThan(dragged.longitudinalGrip);
    expect(recovered.tireRelaxation).toBeLessThan(dragged.tireRelaxation);
  });

  it("lets full braking bring the car to a real stop", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    const fast = run(model, 4.2, { throttle: 1 });
    const stopped = run(model, 2.4, { brake: 1 });

    expect(fast.speedKph).toBeGreaterThan(150);
    expect(stopped.speedKph).toBeLessThan(3);
    expect(stopped.trackOffset).toBeLessThan(fast.trackOffset + 45);
  });

  it("accelerates out of rest instead of jumping to a hidden speed floor", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4.2, { throttle: 1 });
    const stopped = run(model, 2.4, { brake: 1 });
    const firstThrottleFrame = model.update(1 / 60, { ...idle, throttle: 1 });
    const rolling = run(model, 0.7, { throttle: 1 });

    expect(stopped.speedKph).toBeLessThan(3);
    expect(firstThrottleFrame.speedKph).toBeLessThan(8);
    expect(rolling.speedKph).toBeGreaterThan(firstThrottleFrame.speedKph + 20);
    expect(rolling.speedKph).toBeLessThan(60);
  });

  it("makes wet restarts build speed through available traction", () => {
    const dry = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    dry.update(1 / 60, { ...idle, launch: true });
    run(dry, 4.2, { throttle: 1 });
    run(dry, 2.4, { brake: 1 });
    const dryRestart = run(dry, 0.8, { throttle: 1 });

    const wet = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("storm"),
      assist: findAssist("manual")
    });
    wet.update(1 / 60, { ...idle, launch: true });
    run(wet, 4.2, { throttle: 1 });
    run(wet, 2.4, { brake: 1 });
    const wetRestart = run(wet, 0.8, { throttle: 1 });

    expect(dryRestart.speedKph).toBeGreaterThan(20);
    expect(wetRestart.speedKph).toBeLessThan(dryRestart.speedKph);
    expect(wetRestart.car.wheelspin).toBeGreaterThan(dryRestart.car.wheelspin);
  });

  it("turns visible standing water into local wet grip loss", () => {
    const driveThroughFirstPuddle = (weatherId: "clear" | "storm") => {
      const model = new SimcadeRaceModel({
        track: findTrack("aurelia"),
        weather: findWeather(weatherId),
        assist: findAssist("manual")
      });
      model.update(1 / 60, { ...idle, launch: true });
      run(model, 3.7, { throttle: 1, ers: true });

      let peakWater = model.telemetry();
      for (let elapsed = 0; elapsed < 8; elapsed += 1 / 60) {
        const telemetry = model.telemetry();
        const steer = telemetry.trackOffset > 215 ? (telemetry.carX < 5.8 ? 0.7 : 0.2) : 0;
        const brake = telemetry.trackOffset > 250 && telemetry.trackOffset < 315 ? 0.55 : 0;
        const throttle = brake > 0 ? 0.4 : 1;
        const next = model.update(1 / 60, { ...idle, throttle, brake, steer, ers: true });
        if (next.standingWater > peakWater.standingWater) peakWater = next;
        if (next.trackOffset > 318) break;
      }

      return peakWater;
    };

    const dry = driveThroughFirstPuddle("clear");
    const wet = driveThroughFirstPuddle("storm");

    expect(dry.standingWater).toBe(0);
    expect(wet.standingWater).toBeGreaterThan(0.24);
    expect(wet.roadAdhesion).toBeLessThan(0.24);
    expect(wet.car.lockup).toBeGreaterThan(0.35);
    expect(wet.car.understeer).toBeGreaterThan(0.35);
    expect(wet.longitudinalGrip).toBeLessThan(0.45);
  });

  it("does not rotate or sidestep the car from steering input at a standstill", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4.2, { throttle: 1 });
    const stopped = run(model, 2.4, { brake: 1 });
    const steered = run(model, 2, { steer: 1 });

    expect(stopped.speedKph).toBeLessThan(3);
    expect(steered.speedKph).toBe(0);
    expect(Math.abs(steered.car.heading - stopped.car.heading)).toBeLessThan(0.05);
    expect(Math.abs(steered.carX - stopped.carX)).toBeLessThan(0.2);
    expect(Math.abs(steered.car.yawRate)).toBeLessThan(0.05);
  });

  it("makes full-lock restarts trade launch drive for front-tire scrub", () => {
    const makeStoppedCar = () => {
      const model = new SimcadeRaceModel({
        track: findTrack("aurelia"),
        weather: findWeather("clear"),
        assist: findAssist("manual")
      });
      model.update(1 / 60, { ...idle, launch: true });
      run(model, 4.2, { throttle: 1 });
      const stopped = run(model, 2.4, { brake: 1 });

      return { model, stopped };
    };

    const straightCase = makeStoppedCar();
    const fullLockCase = makeStoppedCar();

    const straight = run(straightCase.model, 1, { throttle: 1 });
    const fullLock = run(fullLockCase.model, 1, { throttle: 1, steer: 1 });
    const straightLateralTravel = Math.abs(straight.carX - straightCase.stopped.carX);
    const fullLockLateralTravel = Math.abs(fullLock.carX - fullLockCase.stopped.carX);

    expect(straightCase.stopped.speedKph).toBeLessThan(3);
    expect(fullLockCase.stopped.speedKph).toBeLessThan(3);
    expect(fullLock.speedKph).toBeLessThan(straight.speedKph - 8);
    expect(fullLockLateralTravel).toBeLessThan(straightLateralTravel + 1.45);
    expect(fullLock.tireSaturation).toBeGreaterThan(straight.tireSaturation);
    expect(fullLock.forwardBite).toBeLessThan(straight.forwardBite);
  });

  it("does not slide a stopped off-line car back toward the road center", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4.2, { throttle: 1 });
    run(model, 0.9, { throttle: 1, steer: 0.85 });
    const stopped = run(model, 2.8, { brake: 1 });
    const rested = run(model, 3, {});

    expect(stopped.speedKph).toBe(0);
    expect(Math.abs(stopped.carX)).toBeGreaterThan(1);
    expect(Math.abs(rested.carX - stopped.carX)).toBeLessThan(0.2);
    expect(rested.speedKph).toBe(0);
  });

  it("shifts through gears with a momentary power cut and traction bite", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("mirage"),
      weather: findWeather("storm"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 3.2, { throttle: 1 });

    let peakShiftCut = 0;
    let peakTractionBite = 0;
    let highestGear = 1;
    for (let elapsed = 0; elapsed < 7; elapsed += 1 / 60) {
      const telemetry = model.update(1 / 60, { ...idle, throttle: 1, ers: true });
      peakShiftCut = Math.max(peakShiftCut, telemetry.shiftCut);
      peakTractionBite = Math.max(peakTractionBite, telemetry.tractionBite);
      highestGear = Math.max(highestGear, telemetry.gear);
    }

    const telemetry = model.telemetry();
    expect(highestGear).toBeGreaterThan(1);
    expect(peakShiftCut).toBeGreaterThan(0.2);
    expect(peakTractionBite).toBeGreaterThan(0.2);
    expect(telemetry.rpm).toBeGreaterThan(4200);
    expect(["Power hooked", "Near redline", "Shift cut", "Traction limited", "Engine braking", "Trail braking", "Threshold braking"]).toContain(telemetry.powerState);
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
    expect(offTrack.surfaceName).not.toBe("Asphalt");
    expect(offTrack.surfaceGripModifier).toBeLessThan(1);
    expect(offTrack.surfaceRumble).toBeGreaterThan(0.1);
  });

  it("self-aligns the car when steering is released", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("balanced")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4, { throttle: 1 });

    const loaded = run(model, 0.85, { throttle: 1, steer: 0.78 });
    const loadedHeading = Math.abs(loaded.car.heading);
    const settled = run(model, 1.4, { throttle: 1, steer: 0 });

    expect(loadedHeading).toBeGreaterThan(0.08);
    expect(Math.abs(settled.car.heading)).toBeLessThan(loadedHeading * 0.82);
    expect(Math.abs(settled.car.yawRate)).toBeLessThan(Math.abs(loaded.car.yawRate));
  });

  it("builds steering rack load and self-aligning torque from front tire slip", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4.8, { throttle: 1, ers: true });
    const loaded = run(model, 0.85, { throttle: 0.82, steer: 0.72 });
    const released = run(model, 0.42, { throttle: 0.5 });

    expect(loaded.steeringRackLoad).toBeGreaterThan(0.08);
    expect(Math.abs(loaded.selfAlignTorque)).toBeGreaterThan(0.01);
    expect(released.steeringRackLoad).toBeGreaterThan(0.02);
    expect(Math.abs(released.car.steering)).toBeLessThan(Math.abs(loaded.car.steering));
    expect(Math.abs(released.car.yawRate)).toBeLessThan(Math.abs(loaded.car.yawRate));
    expect(released.steeringLoadFeedback).toBeGreaterThan(0.02);
  });

  it("carries yaw inertia through turn-in and damps it on release", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4.8, { throttle: 1, ers: true });
    const turnIn = run(model, 0.7, { throttle: 0.78, steer: 0.74 });
    const released = run(model, 0.34, { throttle: 0.42 });
    const settled = run(model, 1.2, { throttle: 0.35 });

    expect(turnIn.yawInertiaLoad).toBeGreaterThan(0.05);
    expect(turnIn.yawDamping).toBeGreaterThan(0.3);
    expect(Math.abs(released.car.yawRate)).toBeGreaterThan(0.01);
    expect(released.yawInertiaLoad).toBeGreaterThan(0.01);
    expect(Math.abs(settled.car.yawRate)).toBeLessThan(Math.abs(released.car.yawRate));
    expect(settled.yawInertiaLoad).toBeLessThan(turnIn.yawInertiaLoad);
  });

  it("rewards countersteer catches during rear slip recovery", () => {
    const catchModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    catchModel.update(1 / 60, { ...idle, launch: true });
    run(catchModel, 4.8, { throttle: 1, ers: true });
    const loose = run(catchModel, 0.9, { throttle: 1, steer: 0.88, ers: true });
    const looseCounterSteerLoad = loose.counterSteerLoad;
    const catchSteer = -Math.sign(loose.slipAngle || loose.car.yawRate || 1) * 0.56;
    let caught = loose;
    let caughtFirstCounter = 0;
    let caughtPeakCounter = 0;
    let caughtPeakRecovery = 0;
    for (let elapsed = 0; elapsed < 0.85; elapsed += 1 / 60) {
      caught = catchModel.update(1 / 60, { ...idle, throttle: 0.28, steer: catchSteer });
      if (elapsed === 0) {
        caughtFirstCounter = caught.counterSteerLoad;
      }
      caughtPeakCounter = Math.max(caughtPeakCounter, caught.counterSteerLoad);
      caughtPeakRecovery = Math.max(caughtPeakRecovery, caught.slipRecovery);
    }

    const crossedModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    crossedModel.update(1 / 60, { ...idle, launch: true });
    run(crossedModel, 4.8, { throttle: 1, ers: true });
    const crossedLoose = run(crossedModel, 0.9, { throttle: 1, steer: 0.88, ers: true });
    const crossedLooseCounterSteerLoad = crossedLoose.counterSteerLoad;
    let crossed = crossedLoose;
    let crossedFirstCounter = 0;
    for (let elapsed = 0; elapsed < 0.85; elapsed += 1 / 60) {
      crossed = crossedModel.update(1 / 60, { ...idle, throttle: 0.28, steer: -catchSteer });
      if (elapsed === 0) {
        crossedFirstCounter = crossed.counterSteerLoad;
      }
    }

    expect(loose.chassisStability).toBeLessThan(0.95);
    expect(caughtFirstCounter - looseCounterSteerLoad).toBeGreaterThan(crossedFirstCounter - crossedLooseCounterSteerLoad + 0.002);
    expect(caughtPeakCounter).toBeGreaterThan(0.08);
    expect(caughtPeakRecovery).toBeGreaterThan(0.03);
    expect(Math.abs(caught.slipAngle)).toBeLessThan(Math.abs(crossed.slipAngle));
    expect(caught.chassisStability).toBeGreaterThan(loose.chassisStability);
  });

  it("makes committed steering travel through chassis heading instead of a sideways lane shift", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4.2, { throttle: 1 });

    const turnIn = run(model, 0.85, { throttle: 1, steer: 0.78 });
    const track = sampleTrack(turnIn.trackOffset);

    expect(turnIn.onTrack).toBe(true);
    expect(Math.abs(turnIn.car.heading)).toBeGreaterThan(0.1);
    expect(Math.abs(turnIn.car.yawRate)).toBeGreaterThan(0.12);
    expect(Math.abs(turnIn.carX)).toBeGreaterThan(2);
    expect(Math.abs(turnIn.carX)).toBeLessThan(track.halfWidth - 0.55);
    expect(turnIn.lateralScrub).toBeGreaterThan(0.095);
    expect(turnIn.roadAlignment).toBeLessThan(0.94);
  });

  it("turns kerbs and runoff into tactile surface feedback", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4, { throttle: 1 });

    const sampledSurfaces = new Set<string>();
    let peakRumble = 0;
    let peakEdgeLoad = 0;
    let lowestSurfaceGrip = 1;

    for (let elapsed = 0; elapsed < 3; elapsed += 1 / 60) {
      const telemetry = model.update(1 / 60, { ...idle, throttle: 1, steer: 1 });
      sampledSurfaces.add(telemetry.surfaceName);
      peakRumble = Math.max(peakRumble, telemetry.surfaceRumble);
      peakEdgeLoad = Math.max(peakEdgeLoad, telemetry.surfaceEdgeLoad);
      lowestSurfaceGrip = Math.min(lowestSurfaceGrip, telemetry.surfaceGripModifier);
    }

    expect([...sampledSurfaces]).toEqual(expect.arrayContaining(["Kerb"]));
    expect([...sampledSurfaces].some((surface) => surface === "Runoff" || surface === "Gravel")).toBe(true);
    expect(peakRumble).toBeGreaterThan(0.25);
    expect(peakEdgeLoad).toBeGreaterThan(0.08);
    expect(lowestSurfaceGrip).toBeLessThan(0.8);
  });

  it("loads the tire contact patch when crossing the asphalt edge", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    const cruise = run(model, 4.6, { throttle: 1 });

    let peakEdgeLoad = 0;
    let lowestAdhesion = 1;
    let loaded = cruise;
    for (let elapsed = 0; elapsed < 1.8; elapsed += 1 / 60) {
      loaded = model.update(1 / 60, { ...idle, throttle: 1, steer: 0.95 });
      peakEdgeLoad = Math.max(peakEdgeLoad, loaded.surfaceEdgeLoad);
      lowestAdhesion = Math.min(lowestAdhesion, loaded.roadAdhesion);
    }

    expect(peakEdgeLoad).toBeGreaterThan(0.12);
    expect(lowestAdhesion).toBeLessThan(cruise.roadAdhesion);
    expect(loaded.suspensionTravel).toBeGreaterThan(cruise.suspensionTravel);
  });

  it("samples wheel contact before the car center leaves the asphalt", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    const cruise = run(model, 4.6, { throttle: 1 });

    let edgeContact = cruise;
    let foundSplitContact = false;
    for (let elapsed = 0; elapsed < 2.4; elapsed += 1 / 60) {
      const telemetry = model.update(1 / 60, { ...idle, throttle: 1, steer: 0.9 });
      if (telemetry.surfaceName === "Asphalt" && telemetry.tireContactGrip < telemetry.surfaceGripModifier && telemetry.tireRunoffShare > 0) {
        edgeContact = telemetry;
        foundSplitContact = true;
        break;
      }
    }

    expect(foundSplitContact).toBe(true);
    expect(edgeContact.surfaceName).toBe("Asphalt");
    expect(edgeContact.tireContactGrip).toBeLessThan(edgeContact.surfaceGripModifier);
    expect(edgeContact.tireRunoffShare).toBeGreaterThan(0);
    expect(edgeContact.surfaceEdgeLoad).toBeGreaterThan(cruise.surfaceEdgeLoad);
  });

  it("keeps split surface contact quiet on clean cambered asphalt", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("northstar"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4.8, { throttle: 1 });

    let cleanCamber = model.telemetry();
    for (let elapsed = 0; elapsed < 1.2; elapsed += 1 / 60) {
      const telemetry = model.update(1 / 60, { ...idle, throttle: 1 });
      if (Math.abs(telemetry.roadCamber) > Math.abs(cleanCamber.roadCamber)) cleanCamber = telemetry;
    }

    expect(Math.abs(cleanCamber.roadCamber)).toBeGreaterThan(0.02);
    expect(Math.abs(cleanCamber.splitSurfaceLoad)).toBeLessThan(0.08);
  });

  it("tugs the chassis when one side crosses a kerb or runoff edge", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    const cruise = run(model, 4.6, { throttle: 1 });

    let splitContact = cruise;
    for (let elapsed = 0; elapsed < 2.4; elapsed += 1 / 60) {
      const telemetry = model.update(1 / 60, { ...idle, throttle: 1, steer: 0.92 });
      if (Math.abs(telemetry.splitSurfaceLoad) > Math.abs(splitContact.splitSurfaceLoad)) splitContact = telemetry;
    }

    expect(Math.abs(splitContact.splitSurfaceLoad)).toBeGreaterThan(0.12);
    expect(splitContact.surfaceEdgeLoad).toBeGreaterThan(cruise.surfaceEdgeLoad);
    expect(splitContact.roadFeelFeedback).toBeGreaterThan(cruise.roadFeelFeedback);
    expect(splitContact.lateralScrub).toBeGreaterThan(cruise.lateralScrub);
    expect(splitContact.roadAdhesion).toBeLessThan(cruise.roadAdhesion);
    expect(Math.abs(splitContact.car.yawRate)).toBeGreaterThan(Math.abs(cruise.car.yawRate) + 0.035);
  });

  it("smooths keyboard steering into a recoverable tire response", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 5, { throttle: 1 });

    const correction = run(model, 0.65, { throttle: 1, steer: 1 });
    expect(correction.carX).toBeGreaterThan(0.1);
    expect(correction.onTrack).toBe(true);
    expect(correction.car.slip).toBeLessThan(0.7);

    const overdriven = run(model, 3, { throttle: 1, steer: 1 });
    expect(overdriven.onTrack).toBe(false);
    expect(overdriven.surfaceName).not.toBe("Asphalt");
  });

  it("filters abrupt driver commands through physical control response", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    const cruise = run(model, 4.8, { throttle: 1 });
    const lifted = model.update(1 / 60, { ...idle });
    const firstTurn = model.update(1 / 60, { ...idle, throttle: 1, steer: 1 });
    const committedTurn = run(model, 0.55, { throttle: 1, steer: 1 });

    expect(cruise.car.throttle).toBeGreaterThan(0.82);
    expect(lifted.car.throttle).toBeLessThan(cruise.car.throttle);
    expect(lifted.car.throttle).toBeGreaterThan(0.68);
    expect(firstTurn.car.steering).toBeGreaterThan(0);
    expect(firstTurn.car.steering).toBeLessThan(0.22);
    expect(committedTurn.car.steering).toBeGreaterThan(firstTurn.car.steering + 0.18);
    expect(committedTurn.tireForceLoad).toBeGreaterThan(firstTurn.tireForceLoad);
  });

  it("loads the steering rack when the driver throws abrupt opposite lock", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4.8, { throttle: 1, ers: true });
    const right = run(model, 0.42, { throttle: 1, steer: 0.82 });
    const opposite = model.update(1 / 60, { ...idle, throttle: 1, steer: -0.82 });
    const settled = run(model, 0.9, { throttle: 1, steer: -0.82 });

    expect(right.steeringVelocity).toBeGreaterThan(0);
    expect(opposite.steeringVelocity).toBeLessThan(-0.08);
    expect(opposite.steeringImpulse).toBeGreaterThan(right.steeringImpulse);
    expect(opposite.steeringRackLoad).toBeGreaterThan(0.45);
    expect(opposite.steeringLoadFeedback).toBeGreaterThan(0.2);
    expect(opposite.car.steering).toBeGreaterThan(-0.82);
    expect(settled.steeringImpulse).toBeLessThan(opposite.steeringImpulse);
    expect(settled.tireRelaxation).toBeLessThan(1);
  });

  it("spends tire contact on hard steering instead of sliding without scrub", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });
    const settled = run(model, 5, { throttle: 1 });

    let peakScrub = 0;
    let lowestAdhesion = 1;
    let telemetry = settled;
    for (let elapsed = 0; elapsed < 1.4; elapsed += 1 / 60) {
      telemetry = model.update(1 / 60, { ...idle, throttle: 1, steer: 1 });
      peakScrub = Math.max(peakScrub, telemetry.lateralScrub);
      lowestAdhesion = Math.min(lowestAdhesion, telemetry.roadAdhesion);
    }

    expect(peakScrub).toBeGreaterThan(0.05);
    expect(lowestAdhesion).toBeLessThan(settled.roadAdhesion);
    expect(telemetry.speedKph).toBeLessThan(settled.speedKph + 35);
    expect(Math.abs(telemetry.carX)).toBeLessThan(sampleTrack(telemetry.trackOffset).halfWidth + 2.7);
  });

  it("keeps balanced recovery inside the visible runoff apron", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("balanced")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4, { throttle: 1 });

    const forcedWide = run(model, 3.2, { throttle: 1, steer: 1 });
    const track = sampleTrack(forcedWide.trackOffset);

    expect(Math.abs(forcedWide.carX)).toBeLessThanOrEqual(track.halfWidth + 1.1);
    expect(["Asphalt", "Kerb", "Runoff"]).toContain(forcedWide.surfaceName);
  });

  it("pulls a manual car back toward visible runoff after it runs wide", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4, { throttle: 1 });

    const wide = run(model, 3.2, { throttle: 1, steer: 1 });
    const recovering = run(model, 1.2, { throttle: 0.45 });
    const track = sampleTrack(recovering.trackOffset);

    expect(wide.onTrack).toBe(false);
    expect(Math.abs(recovering.carX)).toBeLessThan(Math.abs(wide.carX));
    expect(Math.abs(recovering.carX)).toBeLessThanOrEqual(track.halfWidth + 2.7);
    expect(["Kerb", "Runoff", "Gravel"]).toContain(recovering.surfaceName);
  });

  it("lets loose-surface mistakes crawl back once the driver releases full lock", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 3.8, { throttle: 1 });

    const wide = run(model, 1.5, { throttle: 1, steer: 1 });
    const bottomed = run(model, 1.1, { throttle: 0 });
    const crawled = run(model, 2.2, { throttle: 1 });

    expect(["Runoff", "Gravel"]).toContain(wide.surfaceName);
    expect(bottomed.speedKph).toBeLessThan(45);
    expect(crawled.speedKph).toBeGreaterThan(bottomed.speedKph + 8);
    expect(Math.abs(crawled.carX)).toBeLessThan(Math.abs(bottomed.carX));
    expect(crawled.speedKph).toBeGreaterThan(28);
  });

  it("lets stranded drivers crawl forward when steering toward the circuit", () => {
    const toward = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    toward.update(1 / 60, { ...idle, launch: true });
    run(toward, 3.8, { throttle: 1 });
    run(toward, 1.5, { throttle: 1, steer: 1 });
    const towardBottomed = run(toward, 1.2, { throttle: 0 });
    const recovered = run(toward, 1.4, { throttle: 1, steer: -0.55 });

    const away = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    away.update(1 / 60, { ...idle, launch: true });
    run(away, 3.8, { throttle: 1 });
    run(away, 1.5, { throttle: 1, steer: 1 });
    const awayBottomed = run(away, 1.2, { throttle: 0 });
    const bogged = run(away, 1.4, { throttle: 1, steer: 0.55 });

    expect(["Runoff", "Gravel"]).toContain(towardBottomed.surfaceName);
    expect(["Runoff", "Gravel"]).toContain(awayBottomed.surfaceName);
    expect(recovered.speedKph).toBeGreaterThan(bogged.speedKph + 6);
    expect(recovered.trackOffset).toBeGreaterThan(towardBottomed.trackOffset + 0.2);
    expect(Math.abs(recovered.carX)).toBeLessThan(Math.abs(towardBottomed.carX));
    expect(bogged.trackOffset).toBeCloseTo(awayBottomed.trackOffset, 1);
  });

  it("lets gentle throttle crawl a stopped loose-surface car toward the circuit", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4.2, { throttle: 1, ers: true });
    run(model, 2.8, { throttle: 1, steer: 1 });
    const stranded = run(model, 1.6, { throttle: 0 });
    const steerTowardRoad = stranded.carX > 0 ? -0.58 : 0.58;
    const crawling = run(model, 2.4, { throttle: 0.55, steer: steerTowardRoad });

    expect(stranded.speedKph).toBeLessThan(3);
    expect(["Runoff", "Gravel"]).toContain(stranded.surfaceName);
    expect(crawling.speedKph).toBeGreaterThan(8);
    expect(crawling.trackOffset).toBeGreaterThan(stranded.trackOffset + 1.5);
    expect(Math.abs(crawling.carX)).toBeLessThan(Math.abs(stranded.carX));
  });

  it("bleeds speed through apron drag instead of an invisible runoff speed cap", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    const fast = run(model, 4.5, { throttle: 1, ers: true });
    let previous = fast;
    let maxChunkLoss = 0;
    let touchedLooseSurface = false;
    let apronScrub = 0;

    for (let index = 0; index < 12; index += 1) {
      const telemetry = run(model, 1 / 6, { throttle: 1, steer: 1, ers: true });
      maxChunkLoss = Math.max(maxChunkLoss, previous.speedKph - telemetry.speedKph);
      touchedLooseSurface = touchedLooseSurface || telemetry.surfaceName === "Runoff" || telemetry.surfaceName === "Gravel";
      apronScrub = Math.max(apronScrub, telemetry.lateralScrub);
      previous = telemetry;
    }

    expect(touchedLooseSurface).toBe(true);
    expect(maxChunkLoss).toBeLessThan(90);
    expect(previous.speedKph).toBeLessThan(fast.speedKph - 110);
    expect(apronScrub).toBeGreaterThan(0.2);
  });

  it("spends tire budget when the driver asks for full steering at high speed", () => {
    const straightLine = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    straightLine.update(1 / 60, { ...idle, launch: true });
    run(straightLine, 4, { throttle: 1 });
    const straight = run(straightLine, 0.9, { throttle: 1 });

    const overdriven = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    overdriven.update(1 / 60, { ...idle, launch: true });
    run(overdriven, 4, { throttle: 1 });
    const loaded = run(overdriven, 0.9, { throttle: 1, steer: 1 });

    expect(loaded.tireSaturation).toBeGreaterThan(0.35);
    expect(loaded.lateralScrub).toBeGreaterThan(0.18);
    expect(loaded.tireLoadFeedback).toBeGreaterThan(straight.tireLoadFeedback + 0.2);
    expect(loaded.steeringLoadFeedback).toBeGreaterThan(straight.steeringLoadFeedback + 0.18);
    expect(loaded.forwardBite).toBeLessThan(straight.forwardBite - 0.35);
    expect(loaded.speedKph).toBeLessThan(straight.speedKph);
  });

  it("sheds speed on asphalt when high-speed steering saturates the front tires", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    const fast = run(model, 4.5, { throttle: 1, ers: true });
    let loaded = fast;

    for (let index = 0; index < 4; index += 1) {
      loaded = run(model, 1 / 6, { throttle: 1, steer: 1, ers: true });
    }

    expect(loaded.surfaceName).toBe("Asphalt");
    expect(loaded.tireSaturation).toBeGreaterThan(0.85);
    expect(loaded.lateralScrub).toBeGreaterThan(0.22);
    expect(loaded.tireLoadFeedback).toBeGreaterThan(0.45);
    expect(loaded.steeringLoadFeedback).toBeGreaterThan(0.32);
    expect(loaded.speedKph).toBeLessThan(fast.speedKph - 8);
  });

  it("rides the lateral road surface instead of the centerline height", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("northstar"),
      weather: findWeather("clear"),
      assist: findAssist("balanced")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 5.2, { throttle: 1 });

    const loaded = run(model, 1.8, { throttle: 1, steer: 0.9 });
    const track = sampleTrack(loaded.trackOffset);
    const normalized = clamp(loaded.carX / Math.max(1, track.halfWidth), -1.35, 1.35);
    const bankedHeight = track.elevation + track.bank * normalized + testSurfaceRelief(track, loaded.carX) + 0.065;

    expect(Math.abs(loaded.carX)).toBeGreaterThan(0.65);
    expect(loaded.car.y).toBeCloseTo(bankedHeight, 4);
    expect(Math.abs(loaded.car.y - (track.elevation + 0.065))).toBeGreaterThan(0.002);
  });

  it("lifts and rolls the chassis over raised kerb contact", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    const cruise = run(model, 4.6, { throttle: 1 });
    let kerbRide = cruise;
    let kerbRelief = 0;

    for (let elapsed = 0; elapsed < 2.2; elapsed += 1 / 60) {
      const telemetry = model.update(1 / 60, { ...idle, throttle: 1, steer: 0.84 });
      const relief = testSurfaceRelief(sampleTrack(telemetry.trackOffset), telemetry.carX);
      if (relief > kerbRelief) {
        kerbRide = telemetry;
        kerbRelief = relief;
      }
    }

    const track = sampleTrack(kerbRide.trackOffset);
    const normalized = clamp(kerbRide.carX / Math.max(1, track.halfWidth), -1.35, 1.35);
    const flatBankedHeight = track.elevation + track.bank * normalized + 0.065;

    expect(kerbRide.surfaceName).toBe("Kerb");
    expect(kerbRide.car.y).toBeGreaterThan(flatBankedHeight + 0.018);
    expect(kerbRelief).toBeGreaterThan(0.035);
    expect(kerbRide.suspensionTravel).toBeGreaterThan(cruise.suspensionTravel + 0.025);
    expect(Math.abs(kerbRide.car.roll)).toBeGreaterThan(Math.abs(cruise.car.roll) + 0.01);
  });

  it("lets road camber influence hands-off lateral motion", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("northstar"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4.8, { throttle: 1 });

    const before = run(model, 0.2, { throttle: 1 });
    const bankSign = Math.sign(before.roadCamber);
    const after = run(model, 1.2, { throttle: 1 });

    expect(Math.abs(before.roadCamber)).toBeGreaterThan(0.02);
    expect(Math.sign(after.carX - before.carX)).toBe(-bankSign);
    expect(Math.abs(after.car.roll)).toBeGreaterThan(0.005);
  });

  it("changes tire load over crests and compressions in the road profile", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("northstar"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4.5, { throttle: 1 });

    let lightest = model.telemetry();
    let heaviest = model.telemetry();
    for (let elapsed = 0; elapsed < 18; elapsed += 1 / 60) {
      const telemetry = model.update(1 / 60, { ...idle, throttle: 1, ers: true });
      if (telemetry.roadLoad < lightest.roadLoad) lightest = telemetry;
      if (telemetry.roadLoad > heaviest.roadLoad) heaviest = telemetry;
    }

    expect(lightest.roadLoad).toBeLessThan(0.995);
    expect(heaviest.roadLoad).toBeGreaterThan(1.005);
    expect(heaviest.suspensionLoad).toBeGreaterThan(lightest.suspensionLoad);
    expect(lightest.tireGroundContact).toBeLessThan(0.99);
    expect(heaviest.tireGroundContact).toBeGreaterThan(lightest.tireGroundContact);
    expect(Math.abs(lightest.roadCompression)).toBeGreaterThan(0.002);
    expect(Math.abs(heaviest.car.pitch - lightest.car.pitch)).toBeGreaterThan(0.004);
    expect(Math.max(lightest.roadFeelFeedback, heaviest.roadFeelFeedback)).toBeGreaterThan(0.04);
  });

  it("unloads contact over crests without turning normal road camber into a surface split", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("northstar"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4.5, { throttle: 1 });

    let lightest = model.telemetry();
    let compressed = model.telemetry();
    let telemetry = model.telemetry();
    for (let elapsed = 0; elapsed < 18; elapsed += 1 / 60) {
      const track = sampleTrack(telemetry.trackOffset);
      const steer = clamp(-(telemetry.carX - track.racingLineOffset) / 3.2 - telemetry.car.heading * 0.9, -0.7, 0.7);
      telemetry = model.update(1 / 60, { ...idle, throttle: 1, ers: true, steer });
      if (telemetry.tireGroundContact < lightest.tireGroundContact) lightest = telemetry;
      if (telemetry.tireGroundContact > compressed.tireGroundContact) compressed = telemetry;
    }

    expect(lightest.roadLoad).toBeLessThan(0.995);
    expect(lightest.tireGroundContact).toBeLessThan(0.98);
    expect(lightest.roadFeelFeedback).toBeGreaterThan(0.04);
    expect(Math.abs(lightest.splitSurfaceLoad)).toBeLessThan(0.1);
    expect(compressed.tireGroundContact).toBeGreaterThan(lightest.tireGroundContact);
    expect(compressed.roadLoad).toBeGreaterThan(lightest.roadLoad);
    expect(lightest.floorStrikeLoad).toBeLessThan(0.16);
  });

  it("turns road profile changes into damper impulse and rebound", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("northstar"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4.5, { throttle: 1 });

    let maxImpulse = 0;
    let reboundVelocity = 0;
    let compressionVelocity = 0;
    let impulseSample = model.telemetry();
    for (let elapsed = 0; elapsed < 18; elapsed += 1 / 60) {
      const telemetry = model.update(1 / 60, { ...idle, throttle: 1, ers: true });
      if (telemetry.damperImpulse > maxImpulse) {
        maxImpulse = telemetry.damperImpulse;
        impulseSample = telemetry;
      }
      reboundVelocity = Math.min(reboundVelocity, telemetry.suspensionVelocity);
      compressionVelocity = Math.max(compressionVelocity, telemetry.suspensionVelocity);
    }

    expect(maxImpulse).toBeGreaterThan(0.035);
    expect(reboundVelocity).toBeLessThan(-0.01);
    expect(compressionVelocity).toBeGreaterThan(0.01);
    expect(impulseSample.roadFeelFeedback).toBeGreaterThan(0.05);
    expect(impulseSample.tireLoadFeedback).toBeGreaterThan(0.015);
  });

  it("builds ride texture memory over repeated rough surface hits", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    const cruise = run(model, 5, { throttle: 1, ers: true });

    let roughest = cruise;
    let peakHeave = Math.abs(cruise.chassisHeave);
    for (let elapsed = 0; elapsed < 3.2; elapsed += 1 / 60) {
      const telemetry = model.update(1 / 60, { ...idle, throttle: 1, steer: 0.95, ers: true });
      peakHeave = Math.max(peakHeave, Math.abs(telemetry.chassisHeave));
      if (telemetry.roadTextureLoad + telemetry.rideSettling > roughest.roadTextureLoad + roughest.rideSettling) roughest = telemetry;
    }

    expect(["Kerb", "Runoff", "Gravel"]).toContain(roughest.surfaceName);
    expect(roughest.roadTextureLoad).toBeGreaterThan(cruise.roadTextureLoad + 0.06);
    expect(roughest.rideSettling).toBeGreaterThan(cruise.rideSettling + 0.035);
    expect(peakHeave).toBeGreaterThan(Math.abs(cruise.chassisHeave) + 0.004);
    expect(roughest.roadFeelFeedback).toBeGreaterThan(cruise.roadFeelFeedback);
    expect(roughest.damperImpulse).toBeGreaterThan(cruise.damperImpulse);
    expect(roughest.tireGroundContact).toBeLessThan(1.08);
  });

  it("loads and sheds the aero platform through clean and disrupted contact", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });

    const planted = run(model, 5.4, { throttle: 1, ers: true });
    const disrupted = run(model, 1.35, { throttle: 0.65, steer: 1 });

    expect(planted.speedKph).toBeGreaterThan(130);
    expect(planted.aeroPlatformLoad).toBeGreaterThan(0.18);
    expect(planted.frontAeroLoad).toBeGreaterThan(0.08);
    expect(planted.rearAeroLoad).toBeGreaterThan(0.08);
    expect(Math.abs(planted.aeroBalance)).toBeLessThan(0.35);
    expect(planted.suspensionLoad).toBeGreaterThan(1.02);
    expect(disrupted.tireRunoffShare + disrupted.surfaceEdgeLoad).toBeGreaterThan(0.1);
    expect(disrupted.aeroPlatformLoad).toBeLessThan(planted.aeroPlatformLoad);
    expect(disrupted.aeroWashout).toBeGreaterThan(planted.aeroWashout);
    expect(disrupted.roadAdhesion).toBeLessThan(planted.roadAdhesion);
  });

  it("bottoms the floor under high-speed platform compression", () => {
    const plantedModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    plantedModel.update(1 / 60, { ...idle, launch: true });
    const planted = run(plantedModel, 5.4, { throttle: 1, ers: true });
    let cleanCoast = planted;
    for (let elapsed = 0; elapsed < 0.8; elapsed += 1 / 60) {
      const track = sampleTrack(cleanCoast.trackOffset);
      const steer = clamp(-(cleanCoast.carX - track.racingLineOffset) / 3.2 - cleanCoast.car.heading * 0.9, -0.72, 0.72);
      cleanCoast = plantedModel.update(1 / 60, { ...idle, throttle: 0.65, steer });
    }

    const bottomingModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    bottomingModel.update(1 / 60, { ...idle, launch: true });
    run(bottomingModel, 5.4, { throttle: 1, ers: true });
    const struck = run(bottomingModel, 0.8, { throttle: 0.65, steer: 1 });

    expect(planted.aeroPlatformLoad).toBeGreaterThan(0.18);
    expect(struck.floorStrikeLoad).toBeGreaterThan(planted.floorStrikeLoad + 0.08);
    expect(struck.surfaceEdgeLoad).toBeGreaterThan(planted.surfaceEdgeLoad + 0.3);
    expect(struck.roadFeelFeedback).toBeGreaterThan(planted.roadFeelFeedback);
    expect(struck.aeroWashout).toBeGreaterThan(planted.aeroWashout);
    expect(struck.speedKph).toBeLessThan(cleanCoast.speedKph);
  });

  it("uses front aero balance for high-speed turn-in and washout", () => {
    const clean = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    clean.update(1 / 60, { ...idle, launch: true });
    run(clean, 5.2, { throttle: 1, ers: true });
    const loadedAero = run(clean, 0.75, { throttle: 0.72, steer: 0.55 });

    const disrupted = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    disrupted.update(1 / 60, { ...idle, launch: true });
    run(disrupted, 5.2, { throttle: 1, ers: true });
    const washedOut = run(disrupted, 1.4, { throttle: 0.75, steer: 1 });

    expect(loadedAero.frontAeroLoad).toBeGreaterThan(0.08);
    expect(loadedAero.rearAeroLoad).toBeGreaterThan(0.08);
    expect(loadedAero.aeroWashout).toBeLessThan(washedOut.aeroWashout);
    expect(washedOut.car.understeer).toBeGreaterThan(loadedAero.car.understeer);
    expect(washedOut.grip).toBeLessThan(loadedAero.grip);
  });

  it("reduces forward bite when the car is not aligned with the road", () => {
    const misaligned = new SimcadeRaceModel();
    misaligned.update(1 / 60, { ...idle, launch: true });
    const settled = run(misaligned, 5, { throttle: 1, ers: true });
    const crossedUp = run(misaligned, 1.4, { throttle: 1, steer: 1 });

    expect(crossedUp.forwardBite).toBeLessThan(settled.forwardBite);
    expect(crossedUp.longitudinalGrip).toBeLessThan(settled.longitudinalGrip);
    expect(crossedUp.roadAlignment).toBeLessThan(settled.roadAlignment);
    expect(crossedUp.trackOffset - settled.trackOffset).toBeLessThan(settled.trackOffset);
  });

  it("turns road-relative velocity into slip angle and tire scrub", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    const settled = run(model, 5, { throttle: 1, ers: true });

    let peakSlipAngle = 0;
    let peakVelocityYaw = 0;
    let peakScrub = 0;
    let weakestBite = settled.forwardBite;
    let telemetry = settled;
    for (let elapsed = 0; elapsed < 1.6; elapsed += 1 / 60) {
      telemetry = model.update(1 / 60, { ...idle, throttle: 1, steer: 1 });
      peakSlipAngle = Math.max(peakSlipAngle, Math.abs(telemetry.slipAngle));
      peakVelocityYaw = Math.max(peakVelocityYaw, Math.abs(telemetry.velocityYaw));
      peakScrub = Math.max(peakScrub, telemetry.lateralScrub);
      weakestBite = Math.min(weakestBite, telemetry.forwardBite);
    }

    expect(peakSlipAngle).toBeGreaterThan(0.025);
    expect(peakVelocityYaw).toBeGreaterThan(0.01);
    expect(peakScrub).toBeGreaterThan(0.04);
    expect(weakestBite).toBeLessThan(settled.forwardBite);
    expect(telemetry.car.slip).toBeGreaterThan(settled.car.slip);
  });

  it("limits drive and braking when the tires are loaded over the track edge", () => {
    const clean = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    clean.update(1 / 60, { ...idle, launch: true });
    run(clean, 4.6, { throttle: 1 });
    const cleanBeforePower = clean.telemetry();
    const cleanPower = run(clean, 0.9, { throttle: 1, ers: true });
    const cleanPowerGain = cleanPower.speedKph - cleanBeforePower.speedKph;
    const cleanBeforeBrake = clean.telemetry();
    const cleanBrake = run(clean, 0.7, { brake: 1 });
    const cleanBrakeDrop = cleanBeforeBrake.speedKph - cleanBrake.speedKph;

    const edge = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    edge.update(1 / 60, { ...idle, launch: true });
    run(edge, 4.6, { throttle: 1 });
    const edgeBeforePower = run(edge, 1.4, { throttle: 1, steer: 1 });
    const edgePower = run(edge, 0.9, { throttle: 1, ers: true });
    const edgePowerGain = edgePower.speedKph - edgeBeforePower.speedKph;
    const edgeBeforeBrake = edge.telemetry();
    const edgeBrake = run(edge, 0.7, { brake: 1 });
    const edgeBrakeDrop = edgeBeforeBrake.speedKph - edgeBrake.speedKph;

    expect(edgeBeforePower.surfaceEdgeLoad).toBeGreaterThan(0.08);
    expect(edgeBeforePower.longitudinalGrip).toBeLessThan(cleanBeforePower.longitudinalGrip);
    expect(edgePowerGain).toBeLessThan(cleanPowerGain);
    expect(edgeBrakeDrop).toBeLessThan(cleanBrakeDrop);
    expect(edgeBrake.car.lockup).toBeGreaterThan(cleanBrake.car.lockup);
  });

  it("spends one shared tire force budget across steering throttle and brake", () => {
    const balanced = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    balanced.update(1 / 60, { ...idle, launch: true });
    run(balanced, 4.8, { throttle: 1 });
    const measured = run(balanced, 1.1, { throttle: 0.55, steer: 0.36 });

    const overloaded = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    overloaded.update(1 / 60, { ...idle, launch: true });
    run(overloaded, 4.8, { throttle: 1 });
    const saturated = run(overloaded, 1.1, { throttle: 1, brake: 0.52, steer: 0.86 });

    expect(saturated.tireForceLoad).toBeGreaterThan(measured.tireForceLoad);
    expect(saturated.combinedSlipLoad).toBeGreaterThan(measured.combinedSlipLoad + 0.08);
    expect(saturated.tireGripReserve).toBeLessThan(measured.tireGripReserve - 0.04);
    expect(saturated.tireSaturation).toBeGreaterThan(measured.tireSaturation);
    expect(saturated.roadAdhesion).toBeLessThan(measured.roadAdhesion);
    expect(saturated.car.understeer + saturated.car.lockup).toBeGreaterThan(measured.car.understeer + measured.car.lockup);
    expect(saturated.longitudinalGrip).toBeLessThan(measured.longitudinalGrip);
  });

  it("turns throttle and brake overlap into drivetrain bind instead of free drive", () => {
    const powerModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    powerModel.update(1 / 60, { ...idle, launch: true });
    const fast = run(powerModel, 4.8, { throttle: 1, ers: true });
    const powered = run(powerModel, 0.75, { throttle: 1, steer: 0.18 });

    const brakeModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    brakeModel.update(1 / 60, { ...idle, launch: true });
    run(brakeModel, 4.8, { throttle: 1, ers: true });
    const braked = run(brakeModel, 0.75, { brake: 0.52, steer: 0.18 });

    const overlapModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    overlapModel.update(1 / 60, { ...idle, launch: true });
    run(overlapModel, 4.8, { throttle: 1, ers: true });
    const overlapped = run(overlapModel, 0.75, { throttle: 0.86, brake: 0.52, steer: 0.18 });

    expect(overlapped.pedalOverlapLoad).toBeGreaterThan(0.16);
    expect(powered.pedalOverlapLoad).toBeLessThan(0.01);
    expect(braked.pedalOverlapLoad).toBeLessThan(0.01);
    expect(overlapped.speedKph).toBeLessThan(powered.speedKph);
    expect(overlapped.speedKph).toBeGreaterThan(braked.speedKph);
    expect(overlapped.tireForceLoad).toBeGreaterThan(braked.tireForceLoad);
    expect(overlapped.tireRelaxation).toBeGreaterThan(braked.tireRelaxation);
    expect(overlapped.longitudinalGrip).toBeLessThan(fast.longitudinalGrip);
    expect(overlapped.powerState).toBe("Pedal overlap");
  });

  it("builds tire pressure and shrinks the contact patch under sustained load", () => {
    const tidyModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    tidyModel.update(1 / 60, { ...idle, launch: true });
    run(tidyModel, 4.8, { throttle: 1 });
    const tidy = run(tidyModel, 1.25, { throttle: 0.62, steer: 0.28 });

    const loadedModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    loadedModel.update(1 / 60, { ...idle, launch: true });
    run(loadedModel, 4.8, { throttle: 1 });
    const loaded = run(loadedModel, 1.25, { throttle: 1, steer: 0.86, brake: 0.24, ers: true });

    expect(loaded.tirePressure).toBeGreaterThan(tidy.tirePressure + 0.01);
    expect(loaded.tirePressureLoad).toBeGreaterThan(tidy.tirePressureLoad + 0.02);
    expect(loaded.tireContactPatch).toBeLessThan(tidy.tireContactPatch);
    expect(loaded.tireGripReserve).toBeLessThan(tidy.tireGripReserve);
    expect(loaded.tireLoadFeedback).toBeGreaterThan(tidy.tireLoadFeedback);
  });

  it("keeps tire relaxation after an abrupt overdriven steering release", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    const settled = run(model, 5, { throttle: 1, ers: true });
    const overloaded = run(model, 0.9, { throttle: 1, steer: 1 });
    const released = run(model, 0.28, { throttle: 0.55 });

    expect(overloaded.tireRelaxation).toBeGreaterThan(0.08);
    expect(released.tireRelaxation).toBeGreaterThan(settled.tireRelaxation + 0.04);
    expect(released.roadAdhesion).toBeLessThan(settled.roadAdhesion);
    expect(released.forwardBite).toBeLessThan(settled.forwardBite);
  });

  it("loads the nose and slows the car through lift-off engine braking", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    const powered = run(model, 5, { throttle: 1, ers: true });
    const lifted = run(model, 0.75, { throttle: 0, steer: 0.42 });

    expect(powered.engineBraking).toBeLessThan(0.08);
    expect(lifted.engineBraking).toBeGreaterThan(0.08);
    expect(lifted.frontAxleLoad).toBeGreaterThan(powered.frontAxleLoad);
    expect(lifted.rearAxleLoad).toBeLessThan(powered.rearAxleLoad);
    expect(lifted.speedKph).toBeLessThan(powered.speedKph);
    expect(lifted.car.pitch).toBeGreaterThan(powered.car.pitch);
    expect(lifted.tireRelaxation).toBeGreaterThan(powered.tireRelaxation);
  });

  it("rotates the chassis on lift-off without snapping into an unrecoverable slide", () => {
    const sampleRotationWindow = (model: SimcadeRaceModel, input: Partial<RaceActions>) => {
      let telemetry = model.telemetry();
      let peakYaw = 0;
      let peakLiftLoad = 0;
      let peakRelaxation = 0;
      let peakSlip = 0;
      let minStability = 1;

      for (let elapsed = 0; elapsed < 0.62; elapsed += 1 / 60) {
        telemetry = model.update(1 / 60, { ...idle, ...input });
        peakYaw = Math.max(peakYaw, Math.abs(telemetry.car.yawRate));
        peakLiftLoad = Math.max(peakLiftLoad, telemetry.liftOffRotationLoad);
        peakRelaxation = Math.max(peakRelaxation, telemetry.tireRelaxation);
        peakSlip = Math.max(peakSlip, telemetry.car.slip);
        minStability = Math.min(minStability, telemetry.chassisStability);
      }

      return { telemetry, peakYaw, peakLiftLoad, peakRelaxation, peakSlip, minStability };
    };

    const partialModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    partialModel.update(1 / 60, { ...idle, launch: true });
    run(partialModel, 4.8, { throttle: 1, ers: true });
    run(partialModel, 0.38, { throttle: 0.9, steer: 0.62 });
    const partial = sampleRotationWindow(partialModel, { throttle: 0.42, steer: 0.62 });

    const liftModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    liftModel.update(1 / 60, { ...idle, launch: true });
    run(liftModel, 4.8, { throttle: 1, ers: true });
    run(liftModel, 0.38, { throttle: 0.9, steer: 0.62 });
    const lifted = sampleRotationWindow(liftModel, { throttle: 0, steer: 0.62 });

    expect(lifted.peakLiftLoad).toBeGreaterThan(0.05);
    expect(partial.peakLiftLoad).toBeLessThan(lifted.peakLiftLoad * 0.55);
    expect(lifted.peakYaw).toBeGreaterThan(partial.peakYaw + 0.015);
    expect(lifted.minStability).toBeLessThan(partial.minStability);
    expect(lifted.peakRelaxation).toBeGreaterThan(0.72);
    expect(lifted.peakSlip).toBeLessThan(0.72);
  });

  it("uses trail braking to rotate the car without turning it into a lockup", () => {
    const trailModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    trailModel.update(1 / 60, { ...idle, launch: true });
    run(trailModel, 4.8, { throttle: 1, ers: true });
    const trail = run(trailModel, 0.65, { brake: 0.38, steer: 0.62 });

    const powerModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    powerModel.update(1 / 60, { ...idle, launch: true });
    run(powerModel, 4.8, { throttle: 1, ers: true });
    const power = run(powerModel, 0.65, { throttle: 0.5, steer: 0.62 });

    const straightBrakeModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    straightBrakeModel.update(1 / 60, { ...idle, launch: true });
    run(straightBrakeModel, 4.8, { throttle: 1, ers: true });
    const straightBrake = run(straightBrakeModel, 0.65, { brake: 0.38 });

    expect(trail.trailBraking).toBeGreaterThan(0.06);
    expect(power.trailBraking).toBeLessThan(0.01);
    expect(trail.frontAxleLoad).toBeGreaterThan(power.frontAxleLoad);
    expect(Math.abs(trail.car.yawRate)).toBeGreaterThan(Math.abs(power.car.yawRate) * 0.8);
    expect(trail.tireRelaxation).toBeGreaterThan(straightBrake.tireRelaxation + 0.04);
    expect(trail.car.lockup).toBeLessThan(0.45);
    expect(trail.speedKph).toBeLessThan(power.speedKph);
  });

  it("lets tire relaxation decay instead of staying permanently damaged", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 5, { throttle: 1, ers: true });
    const overloaded = run(model, 0.95, { throttle: 1, steer: 1 });
    const recovering = run(model, 1.6, { throttle: 0.35, steer: -0.25 });

    expect(overloaded.tireRelaxation).toBeGreaterThan(0.08);
    expect(recovering.tireRelaxation).toBeLessThan(overloaded.tireRelaxation);
    expect(recovering.car.slip).toBeLessThanOrEqual(overloaded.car.slip);
  });

  it("keeps the car unsettled for a moment after hard brake release", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    const fast = run(model, 4.6, { throttle: 1, ers: true });
    const braking = run(model, 0.9, { brake: 1 });
    const released = run(model, 0.25, {});

    expect(braking.longitudinalGrip).toBeLessThan(fast.longitudinalGrip);
    expect(released.longitudinalGrip).toBeLessThan(fast.longitudinalGrip);
    expect(released.car.pitch).toBeGreaterThan(0.01);
    expect(released.suspensionTravel).toBeGreaterThan(0.045);
  });

  it("moves axle load forward under braking and rearward under throttle", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    const powered = run(model, 4.8, { throttle: 1, ers: true });
    const braking = run(model, 0.75, { brake: 1 });
    const relaunched = run(model, 0.9, { throttle: 1 });

    expect(powered.rearAxleLoad).toBeGreaterThan(powered.frontAxleLoad);
    expect(powered.longitudinalLoadTransfer).toBeLessThan(0);
    expect(braking.frontAxleLoad).toBeGreaterThan(powered.frontAxleLoad + 0.08);
    expect(braking.frontAxleLoad).toBeGreaterThan(braking.rearAxleLoad);
    expect(braking.longitudinalLoadTransfer).toBeGreaterThan(0.12);
    expect(relaunched.rearAxleLoad).toBeGreaterThan(braking.rearAxleLoad);
    expect(relaunched.longitudinalLoadTransfer).toBeLessThan(braking.longitudinalLoadTransfer);
  });

  it("uses forward load transfer to support turn-in without free rear traction", () => {
    const brakeTurn = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    brakeTurn.update(1 / 60, { ...idle, launch: true });
    run(brakeTurn, 4.8, { throttle: 1, ers: true });
    const loadedFront = run(brakeTurn, 0.55, { brake: 0.48, steer: 0.66 });

    const powerTurn = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    powerTurn.update(1 / 60, { ...idle, launch: true });
    run(powerTurn, 4.8, { throttle: 1, ers: true });
    const loadedRear = run(powerTurn, 0.55, { throttle: 1, steer: 0.66 });

    expect(loadedFront.frontAxleLoad).toBeGreaterThan(loadedRear.frontAxleLoad);
    expect(loadedFront.rearAxleLoad).toBeLessThan(loadedRear.rearAxleLoad);
    expect(loadedFront.longitudinalLoadTransfer).toBeGreaterThan(loadedRear.longitudinalLoadTransfer);
    expect(Math.abs(loadedFront.car.yawRate)).toBeGreaterThan(Math.abs(loadedRear.car.yawRate) * 0.82);
    expect(loadedFront.car.lockup).toBeGreaterThanOrEqual(loadedRear.car.lockup);
  });

  it("rotates the rear only when throttle is applied through corner exit", () => {
    const coasting = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    coasting.update(1 / 60, { ...idle, launch: true });
    run(coasting, 4.8, { throttle: 1, ers: true });
    const tidyTurn = run(coasting, 0.9, { throttle: 0.12, steer: 0.72 });

    const powered = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    powered.update(1 / 60, { ...idle, launch: true });
    run(powered, 4.8, { throttle: 1, ers: true });
    const exitTurn = run(powered, 0.9, { throttle: 1, steer: 0.72 });

    expect(Math.abs(exitTurn.rearTractionRotation)).toBeGreaterThan(Math.abs(tidyTurn.rearTractionRotation) + 0.012);
    expect(exitTurn.car.wheelspin).toBeGreaterThan(tidyTurn.car.wheelspin);
    expect(exitTurn.tireLoadFeedback).toBeGreaterThan(tidyTurn.tireLoadFeedback);
    expect(exitTurn.longitudinalGrip).toBeLessThan(tidyTurn.longitudinalGrip);
  });

  it("uses differential lock to shape corner-exit traction", () => {
    const straightModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    straightModel.update(1 / 60, { ...idle, launch: true });
    run(straightModel, 4.8, { throttle: 1, ers: true });
    const straight = run(straightModel, 0.82, { throttle: 1, ers: true });

    const partialModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    partialModel.update(1 / 60, { ...idle, launch: true });
    run(partialModel, 4.8, { throttle: 1, ers: true });
    const partial = run(partialModel, 0.82, { throttle: 0.42, steer: 0.72 });

    const exitModel = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    exitModel.update(1 / 60, { ...idle, launch: true });
    run(exitModel, 4.8, { throttle: 1, ers: true });
    const exit = run(exitModel, 0.82, { throttle: 1, steer: 0.72, ers: true });

    expect(straight.driveTorqueLoad).toBeGreaterThan(0.08);
    expect(straight.insideRearSlip).toBeLessThan(exit.insideRearSlip);
    expect(exit.driveTorqueLoad).toBeGreaterThan(partial.driveTorqueLoad + 0.04);
    expect(exit.differentialLock).toBeGreaterThan(partial.differentialLock + 0.04);
    expect(exit.insideRearSlip).toBeGreaterThan(partial.insideRearSlip + 0.03);
    expect(Math.abs(exit.rearTractionRotation)).toBeGreaterThan(Math.abs(partial.rearTractionRotation) + 0.01);
    expect(exit.car.wheelspin).toBeGreaterThan(partial.car.wheelspin);
  });

  it("loads the outside tires during sustained cornering", () => {
    const right = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    right.update(1 / 60, { ...idle, launch: true });
    const rightCruise = run(right, 4.8, { throttle: 1, ers: true });
    const rightLoaded = run(right, 0.8, { throttle: 1, steer: 0.85 });

    const left = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    left.update(1 / 60, { ...idle, launch: true });
    run(left, 4.8, { throttle: 1, ers: true });
    const leftLoaded = run(left, 0.8, { throttle: 1, steer: -0.85 });

    expect(Math.abs(rightCruise.lateralLoadTransfer)).toBeLessThan(0.12);
    expect(rightLoaded.lateralLoadTransfer).toBeGreaterThan(0.12);
    expect(leftLoaded.lateralLoadTransfer).toBeLessThan(-0.12);
    expect(Math.sign(rightLoaded.car.roll)).not.toBe(Math.sign(leftLoaded.car.roll));
    expect(Math.abs(rightLoaded.car.roll)).toBeGreaterThan(0.015);
    expect(rightLoaded.tireRelaxation).toBeGreaterThan(rightCruise.tireRelaxation);
  });

  it("loads the suspension under braking and rough road contact", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });
    const cruise = run(model, 5, { throttle: 1 });
    const braking = run(model, 0.8, { brake: 1 });

    expect(braking.suspensionLoad).toBeGreaterThan(cruise.suspensionLoad);
    expect(braking.suspensionTravel).toBeGreaterThan(cruise.suspensionTravel);
    expect(braking.car.pitch).toBeGreaterThan(cruise.car.pitch);

    let roughest = braking;
    for (let elapsed = 0; elapsed < 2.5; elapsed += 1 / 60) {
      const telemetry = model.update(1 / 60, { ...idle, throttle: 1, steer: 1 });
      if (telemetry.surfaceRumble > roughest.surfaceRumble) roughest = telemetry;
    }

    expect(["Kerb", "Runoff", "Gravel"]).toContain(roughest.surfaceName);
    expect(roughest.suspensionTravel).toBeGreaterThan(cruise.suspensionTravel);
    expect(Math.abs(roughest.car.roll)).toBeGreaterThan(0.005);
  });

  it("keeps compatibility telemetry fields available", () => {
    const model = new SimcadeRaceModel();
    const telemetry = model.telemetry();

    expect(telemetry.carX).toBeCloseTo(telemetry.car.x - trackCenterAt(telemetry.car.z), 4);
    expect(telemetry.trackOffset).toBe(telemetry.car.z);
    expect(telemetry.delta).toBe(0);
    expect(telemetry.splitDelta).toBeNull();
    expect(telemetry.overtakeStreak).toBe(0);
    expect(typeof telemetry.curve).toBe("number");
    expect(telemetry.trackSection).toBe(sampleTrack(telemetry.car.z).section.name);
    expect(telemetry.trackSector).toBe(sampleTrack(telemetry.car.z).section.sector);
    expect(telemetry.trackCue.length).toBeGreaterThan(0);
    expect(telemetry.trackInstruction.length).toBeGreaterThan(0);
    expect(telemetry.targetSpeedKph).toBeGreaterThan(0);
    expect(telemetry.surfaceGrip).toBe(1);
    expect(telemetry.surfaceName).toBe("Asphalt");
    expect(telemetry.surfaceGripModifier).toBe(1);
    expect(telemetry.surfaceRumble).toBe(0);
    expect(telemetry.surfaceEdgeLoad).toBe(0);
    expect(telemetry.splitSurfaceLoad).toBe(0);
    expect(telemetry.roadAdhesion).toBe(1);
    expect(telemetry.lateralScrub).toBe(0);
    expect(telemetry.slipAngle).toBe(0);
    expect(telemetry.velocityYaw).toBe(0);
    expect(telemetry.forwardBite).toBe(1);
    expect(telemetry.longitudinalGrip).toBe(1);
    expect(telemetry.tireContactGrip).toBe(1);
    expect(telemetry.tireRunoffShare).toBe(0);
    expect(telemetry.tireGroundContact).toBe(1);
    expect(telemetry.tireForceLoad).toBe(0);
    expect(telemetry.combinedSlipLoad).toBe(0);
    expect(telemetry.tireGripReserve).toBe(1);
    expect(telemetry.tirePressure).toBe(1);
    expect(telemetry.tireContactPatch).toBe(1);
    expect(telemetry.tirePressureLoad).toBe(0);
    expect(telemetry.tireSaturation).toBe(0);
    expect(telemetry.tireRelaxation).toBe(0);
    expect(telemetry.tireLoadFeedback).toBe(0);
    expect(telemetry.steeringLoadFeedback).toBe(0);
    expect(telemetry.steeringRackLoad).toBe(0);
    expect(telemetry.steeringVelocity).toBe(0);
    expect(telemetry.steeringImpulse).toBe(0);
    expect(telemetry.selfAlignTorque).toBe(0);
    expect(telemetry.yawInertiaLoad).toBe(0);
    expect(telemetry.yawDamping).toBe(1);
    expect(telemetry.counterSteerLoad).toBe(0);
    expect(telemetry.slipRecovery).toBe(0);
    expect(telemetry.chassisStability).toBe(1);
    expect(telemetry.roadAlignment).toBe(1);
    expect(telemetry.roadCamber).toBe(0);
    expect(telemetry.roadGrade).toBe(0);
    expect(telemetry.roadLoad).toBe(1);
    expect(telemetry.roadCompression).toBe(0);
    expect(telemetry.roadFeelFeedback).toBe(0);
    expect(telemetry.roadTextureLoad).toBe(0);
    expect(telemetry.chassisHeave).toBe(0);
    expect(telemetry.rideSettling).toBe(0);
    expect(telemetry.suspensionLoad).toBe(1);
    expect(telemetry.suspensionTravel).toBe(0);
    expect(telemetry.suspensionVelocity).toBe(0);
    expect(telemetry.damperImpulse).toBe(0);
    expect(telemetry.aeroPlatformLoad).toBe(0);
    expect(telemetry.floorStrikeLoad).toBe(0);
    expect(telemetry.frontAeroLoad).toBe(0);
    expect(telemetry.rearAeroLoad).toBe(0);
    expect(telemetry.aeroBalance).toBe(0);
    expect(telemetry.aeroWashout).toBe(0);
    expect(telemetry.frontAxleLoad).toBe(1);
    expect(telemetry.rearAxleLoad).toBe(1);
    expect(telemetry.longitudinalLoadTransfer).toBe(0);
    expect(telemetry.lateralLoadTransfer).toBe(0);
    expect(telemetry.brakeBalanceLoad).toBe(0);
    expect(telemetry.frontLockRisk).toBe(0);
    expect(telemetry.rearBrakeStability).toBe(1);
    expect(telemetry.roadWetness).toBe(0);
    expect(telemetry.rainIntensity).toBe(0);
    expect(telemetry.trackRubber).toBe(0);
    expect(telemetry.dryingLine).toBe(0);
    expect(telemetry.trackEvolutionState).toBe("Green track");
    expect(telemetry.rubberedLineGrip).toBe(0);
    expect(telemetry.marbles).toBe(0);
    expect(telemetry.dirtyTirePickup).toBe(0);
    expect(telemetry.gripState).toBe("Green track");
    expect(telemetry.launchCharge).toBe(0);
    expect(telemetry.launchQuality).toBe(0);
    expect(telemetry.assistName).toBe("Balanced Assist");
    expect(telemetry.assistSteer).toBe(0);
    expect(telemetry.assistBrake).toBe(0);
    expect(telemetry.assistThrottleTrim).toBe(0);
    expect(telemetry.draft).toBe(0);
    expect(telemetry.dirtyAir).toBe(0);
    expect(telemetry.airState).toBe("Clean air");
    expect(telemetry.racecraftState).toBe("Clean air");
    expect(telemetry.rivalProximity).toBe(0);
    expect(telemetry.sideBySide).toBe(0);
    expect(telemetry.contactRisk).toBe(0);
    expect(telemetry.frontWingDamage).toBe(0);
    expect(telemetry.downforceLoss).toBe(0);
    expect(telemetry.damageState).toBe("Wing clean");
    expect(telemetry.defensiveRivals).toBe(0);
    expect(telemetry.nearestRivalGapMeters).toBeGreaterThan(0);
    expect(telemetry.skyColor).toBe("#c7d8df");
    expect(typeof telemetry.cornerPhase).toBe("string");
    expect(telemetry.cleanLap).toBe(true);
    expect(telemetry.lapValid).toBe(true);
    expect(telemetry.penaltySeconds).toBe(0);
    expect(telemetry.nextCheckpoint).toBe("Basilica Hairpin Entry");
    expect(telemetry.nextCheckpointDistance).toBeGreaterThan(0);
    expect(telemetry.nextCheckpointIndex).toBe(0);
    expect(telemetry.checkpointCount).toBe(7);
    expect(telemetry.checkpointProgress).toBe("1/7");
    expect(telemetry.sectorSplits).toEqual([null, null, null]);
    expect(telemetry.lastSector).toBeNull();
    expect(telemetry.lastSectorTime).toBeNull();
    expect(telemetry.lastSectorDelta).toBeNull();
    expect(telemetry.sectorPaceScore).toBe(0);
    expect(telemetry.sectorPaceState).toBe("Build sector");
    expect(telemetry.gear).toBeGreaterThanOrEqual(1);
    expect(telemetry.rpm).toBeGreaterThan(0);
    expect(telemetry.aeroBoostAvailable).toBe(false);
    expect(telemetry.aeroBoostActive).toBe(0);
    expect(telemetry.aeroDragReduction).toBe(0);
    expect(telemetry.shiftCut).toBe(0);
    expect(telemetry.tractionBite).toBe(0);
    expect(telemetry.rearTractionRotation).toBe(0);
    expect(telemetry.driveTorqueLoad).toBe(0);
    expect(telemetry.differentialLock).toBe(0);
    expect(telemetry.insideRearSlip).toBe(0);
    expect(telemetry.engineBraking).toBe(0);
    expect(telemetry.trailBraking).toBe(0);
    expect(telemetry.thresholdBraking).toBe(0);
    expect(telemetry.liftOffRotationLoad).toBe(0);
    expect(telemetry.pedalOverlapLoad).toBe(0);
    expect(telemetry.powerState).toBe("Power hooked");
    expect(telemetry.tireTemp).toBeGreaterThan(0);
    expect(telemetry.tireWear).toBe(0);
    expect(telemetry.tireState.length).toBeGreaterThan(0);
    expect(telemetry.fuelLoad).toBe(1);
    expect(telemetry.fuelMassKg).toBeGreaterThan(50);
    expect(telemetry.fuelState).toBe("Heavy fuel");
    expect(telemetry.brakeTemp).toBeGreaterThan(0);
    expect(telemetry.brakeFade).toBe(0);
    expect(telemetry.brakeState).toBe("Brakes ready");
    expect(telemetry.flowScore).toBeGreaterThan(0);
    expect(telemetry.flowState).toBe("Good rhythm");
    expect(telemetry.cameraSnap).toBe(false);
    expect(typeof telemetry.brakingZone).toBe("boolean");
    expect(telemetry.car.throttle).toBe(0);
    expect(Number.isFinite(telemetry.car.y)).toBe(true);
    expect(Number.isFinite(telemetry.car.bank)).toBe(true);
    expect(telemetry.car.pitch).toBe(0);
    expect(telemetry.car.roll).toBe(0);
    expect(telemetry.car.steering).toBe(0);
    expect(telemetry.car.wheelspin).toBe(0);
    expect(telemetry.car.understeer).toBe(0);
    expect(telemetry.car.lockup).toBe(0);
    expect(Number.isFinite(telemetry.rivals[0].y)).toBe(true);
    expect(Number.isFinite(telemetry.rivals[0].bank)).toBe(true);
    expect(telemetry.rivals[0].speedKph).toBeGreaterThan(0);
    expect(telemetry.rivals[0].driver.length).toBeGreaterThan(0);
    expect(telemetry.rivals[0].team.length).toBeGreaterThan(0);
    expect(telemetry.leaderboard.some((entry) => entry.isPlayer && entry.driver === "You")).toBe(true);
    expect(telemetry.leaderboard[0]).toMatchObject({ position: 1, driver: "Vega", team: "NOVA" });
  });

  it("updates the timing tower identity when the player passes a rival", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });

    let telemetry = model.telemetry();
    for (let elapsed = 0; elapsed < 20 && telemetry.position >= 8; elapsed += 1 / 60) {
      telemetry = model.update(1 / 60, { ...idle, throttle: 1, ers: true });
    }

    expect(telemetry.position).toBeLessThan(8);
    expect(telemetry.overtakeStreak).toBeGreaterThan(0);
    expect(telemetry.leaderboard.some((entry) => entry.isPlayer && entry.position === telemetry.position)).toBe(true);
    expect(telemetry.leaderboard.some((entry) => entry.driver !== "You" && entry.position > telemetry.position)).toBe(true);
  });

  it("keeps the leaders up the road during the opening stint", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("mirage"),
      weather: findWeather("dusk"),
      assist: findAssist("balanced")
    });
    model.update(1 / 60, { ...idle, launch: true });

    const telemetry = run(model, 15, { throttle: 1, ers: true });

    expect(telemetry.position).toBeGreaterThan(3);
    expect(telemetry.overtakeStreak).toBeLessThan(5);
    expect(telemetry.leaderboard[0]).toMatchObject({ position: 1, driver: "Vega" });
  });

  it("surfaces braking-zone cues before heavy corners", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });
    let telemetry = model.telemetry();
    for (let elapsed = 0; elapsed < 8 && !telemetry.brakingZone; elapsed += 1 / 60) {
      telemetry = model.update(1 / 60, { ...idle, throttle: 1, ers: true });
    }

    expect(telemetry.brakingZone).toBe(true);
    expect(telemetry.trackCue).toMatch(/Brake|apex/);
  });

  it("reports non-zero circuit curve while driving the GP layout", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });

    const telemetry = run(model, 8, { throttle: 1 });

    expect(Math.abs(telemetry.curve)).toBeGreaterThan(0.005);
  });

  it("rates completed sectors with live pace feedback", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("balanced")
    });
    model.update(1 / 60, { ...idle, launch: true });
    const telemetry = runGuided(model, 16);

    expect(telemetry.lastSector).not.toBeNull();
    expect(telemetry.lastSectorTime).toBeGreaterThan(0);
    expect(telemetry.lastSectorDelta).not.toBeNull();
    expect(telemetry.sectorPaceScore).toBeGreaterThanOrEqual(0);
    expect(telemetry.sectorPaceScore).toBeLessThanOrEqual(1);
    expect(["Purple sector", "Green sector", "Solid sector", "Sector time lost", "Sector invalid"]).toContain(telemetry.sectorPaceState);
  });

  it("moves through named circuit sections", () => {
    const samples = [sampleTrack(20), sampleTrack(360), sampleTrack(1120), sampleTrack(1700)];

    expect(samples.map((sample) => sample.section.id)).toEqual([
      "front-straight",
      "basilica-hairpin",
      "cava-chicane",
      "station-hairpin"
    ]);
    expect(samples[1].brakingZone).toBe(true);
    expect(samples[2].section.kind).toBe("chicane");
  });

  it("defines authored target speeds and corner phases for Aurelia GP", () => {
    const hairpin = sampleTrack(390);
    const chicane = sampleTrack(1110);
    const parabolica = sampleTrack(1900);

    expect(hairpin.section.name).toBe("Basilica Hairpin");
    expect(hairpin.targetSpeedKph).toBeLessThan(100);
    expect(hairpin.cornerPhase).not.toBe("flat");
    expect(chicane.section.instruction).toMatch(/kerb/);
    expect(parabolica.section.name).toBe("Parabolica");
    expect(parabolica.targetSpeedKph).toBeGreaterThan(200);
  });

  it("preserves final lap timing when the race finishes", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });

    const finished = runUntilFinished(model, 900);
    expect(finished.phase).toBe("finished");
    expect(finished.lap).toBe(finished.laps);
    expect(finished.lapProgress).toBe(1);
    expect(finished.raceProgress).toBe(1);
    expect(finished.lapTime).toBeGreaterThan(0);
    expect(finished.bestLap === null || finished.bestLap > 0).toBe(true);
    expect(finished.totalTime).toBeGreaterThan(finished.lapTime);
    expect(finished.penaltySeconds).toBeGreaterThanOrEqual(0);
    expect(finished.sectorSplits.every((split) => split !== null && split > 0)).toBe(true);
  });

  it("resets after finishing when restart is requested", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });
    runUntilFinished(model, 900);

    const reset = model.update(1 / 60, { ...idle, restart: true });

    expect(reset.phase).toBe("ready");
    expect(reset.speedKph).toBe(0);
    expect(reset.lap).toBe(1);
    expect(reset.bestLap).toBeNull();
  });

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
    expect(controlledTurn.car.understeer).toBeLessThan(lateTurn.car.understeer);
  });

  it("opens the aero boost flap on committed straight-line ERS runs", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });

    let peakAero = 0;
    let peakDragReduction = 0;
    let aeroCue = "";
    for (let elapsed = 0; elapsed < 7; elapsed += 1 / 60) {
      const telemetry = model.update(1 / 60, { ...idle, throttle: 1, ers: true });
      peakAero = Math.max(peakAero, telemetry.aeroBoostActive);
      peakDragReduction = Math.max(peakDragReduction, telemetry.aeroDragReduction);
      if (/Aero/.test(telemetry.trackCue)) aeroCue = telemetry.trackCue;
    }

    expect(peakAero).toBeGreaterThan(0.45);
    expect(peakDragReduction).toBeGreaterThan(0);
    expect(aeroCue).toMatch(/Aero/);
  });

  it("builds tire temperature and wear when the car is overdriven", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });
    const settled = run(model, 3, { throttle: 1 });
    const abused = run(model, 4.4, { throttle: 1, steer: 1, brake: 0.22 });

    expect(abused.tireTemp).toBeGreaterThan(settled.tireTemp);
    expect(abused.tireWear).toBeGreaterThan(settled.tireWear);
    expect(abused.grip).toBeLessThanOrEqual(1);
    expect(abused.tireState.length).toBeGreaterThan(0);
  });

  it("settles casual throttle driving better with balanced assists than manual inputs", () => {
    const assisted = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("balanced")
    });
    assisted.update(1 / 60, { ...idle, launch: true });
    const assistedState = run(assisted, 7.4, { throttle: 1, ers: true });

    const manual = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    manual.update(1 / 60, { ...idle, launch: true });
    const manualState = run(manual, 7.4, { throttle: 1, ers: true });

    expect(assistedState.assistName).toBe("Balanced Assist");
    expect(Math.abs(assistedState.assistSteer) + assistedState.assistBrake + assistedState.assistThrottleTrim).toBeGreaterThan(0);
    expect(assistedState.flowScore).toBeGreaterThan(manualState.flowScore);
    expect(assistedState.onTrack).toBe(true);
    expect(Math.abs(assistedState.carX)).toBeLessThan(sampleTrack(assistedState.trackOffset).halfWidth - 0.5);
  });

  it("anticipates wet fast bends in balanced assist for throttle-only players", () => {
    const assisted = new SimcadeRaceModel({
      track: findTrack("northstar"),
      weather: findWeather("storm"),
      assist: findAssist("balanced")
    });
    assisted.update(1 / 60, { ...idle, launch: true });

    const state = run(assisted, 10, { throttle: 1 });

    expect(["Pine Sweep", "Glacier Hairpin"]).toContain(state.trackSection);
    expect(["Asphalt", "Kerb"]).toContain(state.surfaceName);
    expect(state.surfaceName).not.toBe("Runoff");
    expect(state.surfaceName).not.toBe("Gravel");
    expect(Math.abs(state.carX)).toBeLessThan(sampleTrack(state.trackOffset).halfWidth + 0.35);
    expect(Math.abs(state.assistSteer) + state.assistBrake + state.assistThrottleTrim).toBeGreaterThan(0.05);
  });

  it("keeps a wet throttle-only stint from becoming an off-track shortcut", () => {
    const assisted = new SimcadeRaceModel({
      track: findTrack("northstar"),
      weather: findWeather("storm"),
      assist: findAssist("balanced")
    });
    assisted.update(1 / 60, { ...idle, launch: true });

    const state = run(assisted, 25, { throttle: 1, ers: true });

    expect(state.surfaceName).not.toBe("Gravel");
    expect(state.position).toBeGreaterThan(1);
    expect(state.flowScore).toBeGreaterThan(0.16);
  });

  it("does not award race positions from gravel or runoff shortcuts", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("northstar"),
      weather: findWeather("storm"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });

    const state = run(model, 26, { throttle: 1, steer: 1, ers: true });
    const track = sampleTrack(state.trackOffset);

    expect(state.trackLimitWarnings).toBeGreaterThan(0);
    expect(state.position).toBeGreaterThan(1);
    expect(state.penaltySeconds).toBeGreaterThan(0);
    expect(Math.abs(state.carX)).toBeLessThanOrEqual(track.halfWidth + 2.7);
  });

  it("lets stranded manual drivers recover to the circuit with a penalty", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("northstar"),
      weather: findWeather("storm"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    const stranded = run(model, 18, { throttle: 1, steer: 1 });
    const track = sampleTrack(stranded.trackOffset);

    expect(["Runoff", "Gravel"]).toContain(stranded.surfaceName);
    expect(stranded.speedKph).toBeLessThanOrEqual(20);
    expect(Math.abs(stranded.carX)).toBeLessThanOrEqual(track.halfWidth + 2.7);

    const recovered = model.update(1 / 60, { ...idle, recover: true });

    expect(["Asphalt", "Kerb"]).toContain(recovered.surfaceName);
    expect(recovered.speedKph).toBeGreaterThan(stranded.speedKph);
    expect(recovered.penaltySeconds).toBeGreaterThan(stranded.penaltySeconds);
    expect(recovered.cleanLap).toBe(false);
    expect(recovered.message).toMatch(/Recovered/);
    expect(recovered.cameraSnap).toBe(true);
  });

  it("scores smooth corner rhythm higher than messy inputs", () => {
    const smooth = new SimcadeRaceModel();
    smooth.update(1 / 60, { ...idle, launch: true });
    run(smooth, 4, { throttle: 1 });
    run(smooth, 0.7, { brake: 0.86 });
    const tidy = run(smooth, 1.5, { throttle: 0.42, steer: 0.52 });

    const messy = new SimcadeRaceModel();
    messy.update(1 / 60, { ...idle, launch: true });
    run(messy, 4, { throttle: 1 });
    const ragged = run(messy, 1.5, { throttle: 1, steer: 1 });

    expect(tidy.flowScore).toBeGreaterThan(ragged.flowScore);
    expect(tidy.car.slip).toBeLessThan(ragged.car.slip);
    expect(["Good rhythm", "In the zone"]).toContain(tidy.flowState);
  });

  it("turns traction mistakes into readable car states", () => {
    const hot = new SimcadeRaceModel();
    hot.update(1 / 60, { ...idle, launch: true });
    run(hot, 5.8, { throttle: 1, ers: true });
    const oversped = run(hot, 1, { throttle: 1, steer: 1 });

    const settled = new SimcadeRaceModel();
    settled.update(1 / 60, { ...idle, launch: true });
    run(settled, 5.8, { throttle: 1, ers: true });
    run(settled, 0.6, { brake: 1 });
    const controlled = run(settled, 1, { throttle: 0.35, steer: 0.65 });

    expect(oversped.car.understeer).toBeGreaterThan(controlled.car.understeer);
    expect(oversped.car.wheelspin).toBeGreaterThan(controlled.car.wheelspin);
    expect(oversped.car.slip).toBeGreaterThan(controlled.car.slip);
  });

  it("paces rivals from circuit target speeds", () => {
    const model = new SimcadeRaceModel();
    const startingRivalSpeed = model.telemetry().rivals[0].speedKph;
    model.update(1 / 60, { ...idle, launch: true });

    const telemetry = run(model, 8, { throttle: 1, ers: true });

    expect(telemetry.rivals[0].speedKph).not.toBe(startingRivalSpeed);
    expect(telemetry.rivals.every((rival) => rival.speedKph >= 76 && rival.speedKph <= 292)).toBe(true);
  });

  it("makes rivals defend and leave racing room under pressure", () => {
    const model = new SimcadeRaceModel();
    const startingRivalX = model.telemetry().rivals[0].x;
    model.update(1 / 60, { ...idle, launch: true });

    let peakDefenders = 0;
    let nearestGap = Infinity;
    let largestLaneShift = 0;

    for (let elapsed = 0; elapsed < 7; elapsed += 1 / 60) {
      const telemetry = model.update(1 / 60, { ...idle, throttle: 1, steer: -0.08, ers: true });
      peakDefenders = Math.max(peakDefenders, telemetry.defensiveRivals);
      nearestGap = Math.min(nearestGap, Math.abs(telemetry.nearestRivalGapMeters ?? Infinity));
      largestLaneShift = Math.max(largestLaneShift, Math.abs(telemetry.rivals[0].x - startingRivalX));
    }

    expect(peakDefenders).toBeGreaterThan(0);
    expect(nearestGap).toBeLessThan(90);
    expect(largestLaneShift).toBeGreaterThan(0.15);
  });

  it("models slipstream and dirty air around rivals", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });
    const straightTow = run(model, 4.4, { throttle: 1 });

    expect(straightTow.draft).toBeGreaterThan(0);
    expect(["Slipstream", "Dirty air", "Clean air"]).toContain(straightTow.airState);

    const tuckedIn = run(model, 2, { throttle: 1, steer: 0.15 });

    expect(tuckedIn.draft + tuckedIn.dirtyAir).toBeGreaterThan(0);
    expect(tuckedIn.car.slip).toBeGreaterThanOrEqual(0);
  });

  it("turns nearby rivals into readable racecraft pressure", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });

    let peakProximity = 0;
    let peakSideBySide = 0;
    let peakContactRisk = 0;
    let peakDamage = 0;
    let state = run(model, 18, { throttle: 1, ers: true });

    for (let elapsed = 0; elapsed < 30; elapsed += 1 / 60) {
      const rival = state.rivals.find((candidate) => Math.abs(candidate.gap) < 90);
      const steer = rival ? clamp((rival.x - state.car.x) / 1.4, -0.86, 0.86) : 0;
      state = model.update(1 / 60, { ...idle, throttle: 1, steer, ers: true });
      peakProximity = Math.max(peakProximity, state.rivalProximity);
      peakSideBySide = Math.max(peakSideBySide, state.sideBySide);
      peakContactRisk = Math.max(peakContactRisk, state.contactRisk);
      peakDamage = Math.max(peakDamage, state.frontWingDamage);
    }

    expect(peakProximity).toBeGreaterThan(0.2);
    expect(peakSideBySide).toBeGreaterThan(0.1);
    expect(Number.isFinite(peakContactRisk)).toBe(true);
    expect(Number.isFinite(peakDamage)).toBe(true);
    expect(["Wing damage", "Closing rival", "Wheel to wheel", "Contact risk", "Slipstream", "Dirty air", "Clean air"]).toContain(state.racecraftState);
    expect(Number.isFinite(state.downforceLoss)).toBe(true);
  });

  it("invalidates the clean lap after sustained track limits abuse", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("aurelia"),
      weather: findWeather("clear"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4, { throttle: 1 });

    const telemetry = run(model, 4, { throttle: 1, steer: 1 });

    expect(telemetry.cleanLap).toBe(false);
    expect(telemetry.lapValid).toBe(false);
    expect(telemetry.trackLimitWarnings).toBeGreaterThan(0);
    expect(telemetry.penaltySeconds).toBeGreaterThan(0);
  });
});
