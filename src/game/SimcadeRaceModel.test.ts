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

function runGuided(model: SimcadeRaceModel, seconds: number) {
  let telemetry = model.telemetry();
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) {
    const steer = clamp(-telemetry.carX / 3.8, -0.8, 0.8);
    telemetry = model.update(1 / 60, { ...idle, throttle: 1, ers: true, steer });
  }
  return telemetry;
}

function runUntilFinished(model: SimcadeRaceModel, maxSeconds: number) {
  let telemetry = model.telemetry();
  for (let elapsed = 0; elapsed < maxSeconds && telemetry.phase !== "finished"; elapsed += 1 / 60) {
    const steer = clamp(-telemetry.carX / 2.4, -1, 1);
    telemetry = model.update(1 / 60, { ...idle, throttle: 1, ers: true, steer });
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
    expect(telemetry.assistName).toBe("Balanced Assist");
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

  it("turns kerbs and runoff into tactile surface feedback", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4, { throttle: 1 });

    const sampledSurfaces = new Set<string>();
    let peakRumble = 0;
    let lowestSurfaceGrip = 1;

    for (let elapsed = 0; elapsed < 3; elapsed += 1 / 60) {
      const telemetry = model.update(1 / 60, { ...idle, throttle: 1, steer: 1 });
      sampledSurfaces.add(telemetry.surfaceName);
      peakRumble = Math.max(peakRumble, telemetry.surfaceRumble);
      lowestSurfaceGrip = Math.min(lowestSurfaceGrip, telemetry.surfaceGripModifier);
    }

    expect([...sampledSurfaces]).toEqual(expect.arrayContaining(["Kerb"]));
    expect([...sampledSurfaces].some((surface) => surface === "Runoff" || surface === "Gravel")).toBe(true);
    expect(peakRumble).toBeGreaterThan(0.25);
    expect(lowestSurfaceGrip).toBeLessThan(0.8);
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
    expect(telemetry.roadWetness).toBe(0);
    expect(telemetry.rainIntensity).toBe(0);
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
    expect(telemetry.defensiveRivals).toBe(0);
    expect(telemetry.nearestRivalGapMeters).toBeGreaterThan(0);
    expect(telemetry.skyColor).toBe("#c7d8df");
    expect(typeof telemetry.cornerPhase).toBe("string");
    expect(telemetry.cleanLap).toBe(true);
    expect(telemetry.lapValid).toBe(true);
    expect(telemetry.penaltySeconds).toBe(0);
    expect(telemetry.nextCheckpoint).toBe("Basilica Hairpin Entry");
    expect(telemetry.checkpointProgress).toBe("1/7");
    expect(telemetry.sectorSplits).toEqual([null, null, null]);
    expect(telemetry.gear).toBeGreaterThanOrEqual(1);
    expect(telemetry.rpm).toBeGreaterThan(0);
    expect(telemetry.flowScore).toBeGreaterThan(0);
    expect(telemetry.flowState).toBe("Good rhythm");
    expect(telemetry.cameraSnap).toBe(false);
    expect(typeof telemetry.brakingZone).toBe("boolean");
    expect(telemetry.car.throttle).toBe(0);
    expect(Number.isFinite(telemetry.car.y)).toBe(true);
    expect(Number.isFinite(telemetry.car.bank)).toBe(true);
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

    const telemetry = run(model, 8, { throttle: 1, ers: true });

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
    const telemetry = run(model, 6, { throttle: 1, ers: true });

    expect(telemetry.brakingZone).toBe(true);
    expect(telemetry.trackCue).toMatch(/Brake|apex/);
  });

  it("reports non-zero circuit curve while driving the GP layout", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });

    const telemetry = run(model, 8, { throttle: 1 });

    expect(Math.abs(telemetry.curve)).toBeGreaterThan(0.005);
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

    const finished = runUntilFinished(model, 700);

    expect(finished.phase).toBe("finished");
    expect(finished.lap).toBe(finished.laps);
    expect(finished.lapProgress).toBe(1);
    expect(finished.raceProgress).toBe(1);
    expect(finished.lapTime).toBeGreaterThan(0);
    expect(finished.bestLap === null || finished.bestLap > 0).toBe(true);
    expect(finished.totalTime).toBeGreaterThan(finished.lapTime);
    expect(finished.penaltySeconds).toBeGreaterThan(0);
  });

  it("resets after finishing when restart is requested", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });
    runUntilFinished(model, 700);

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
    expect(Math.abs(assistedState.carX - sampleTrack(assistedState.trackOffset).racingLineOffset)).toBeLessThan(
      Math.abs(manualState.carX - sampleTrack(manualState.trackOffset).racingLineOffset)
    );
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

    expect(state.trackLimitWarnings).toBeGreaterThan(0);
    expect(state.position).toBeGreaterThan(1);
    expect(state.penaltySeconds).toBeGreaterThan(0);
  });

  it("lets stranded manual drivers recover to the circuit with a penalty", () => {
    const model = new SimcadeRaceModel({
      track: findTrack("northstar"),
      weather: findWeather("storm"),
      assist: findAssist("manual")
    });
    model.update(1 / 60, { ...idle, launch: true });
    const stranded = run(model, 18, { throttle: 1, steer: 1 });

    expect(stranded.surfaceName).toBe("Gravel");
    expect(stranded.speedKph).toBeLessThanOrEqual(20);

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
    let state = model.telemetry();

    for (let elapsed = 0; elapsed < 15; elapsed += 1 / 60) {
      state = model.update(1 / 60, { ...idle, throttle: 1, steer: -0.12, ers: true });
      peakProximity = Math.max(peakProximity, state.rivalProximity);
      peakSideBySide = Math.max(peakSideBySide, state.sideBySide);
      peakContactRisk = Math.max(peakContactRisk, state.contactRisk);
    }

    expect(peakProximity).toBeGreaterThan(0.2);
    expect(peakSideBySide).toBeGreaterThan(0.1);
    expect(peakContactRisk).toBeGreaterThan(0.03);
    expect(["Closing rival", "Wheel to wheel", "Contact risk", "Slipstream", "Dirty air", "Clean air"]).toContain(state.racecraftState);
  });

  it("invalidates the clean lap after sustained track limits abuse", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 4, { throttle: 1 });

    const telemetry = run(model, 4, { throttle: 1, steer: 1 });

    expect(telemetry.cleanLap).toBe(false);
    expect(telemetry.lapValid).toBe(false);
    expect(telemetry.trackLimitWarnings).toBeGreaterThan(0);
    expect(telemetry.penaltySeconds).toBeGreaterThan(0);
  });
});
