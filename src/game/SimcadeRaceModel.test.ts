import { describe, expect, it } from "vitest";
import { SimcadeRaceModel, type RaceActions } from "./SimcadeRaceModel";
import { sampleTrack, trackCenterAt } from "./trackPath";

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
    expect(telemetry.gear).toBeGreaterThanOrEqual(1);
    expect(telemetry.rpm).toBeGreaterThan(0);
    expect(typeof telemetry.brakingZone).toBe("boolean");
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
    const samples = [sampleTrack(20), sampleTrack(280), sampleTrack(840), sampleTrack(1370)];

    expect(samples.map((sample) => sample.section.id)).toEqual([
      "pit-straight",
      "turn-one-hairpin",
      "technical-chicane",
      "final-hairpin"
    ]);
    expect(samples[1].brakingZone).toBe(true);
    expect(samples[2].section.kind).toBe("chicane");
  });

  it("preserves final lap timing when the race finishes", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });

    const finished = run(model, 90, { throttle: 1, ers: true });

    expect(finished.phase).toBe("finished");
    expect(finished.lap).toBe(finished.laps);
    expect(finished.lapProgress).toBe(1);
    expect(finished.raceProgress).toBe(1);
    expect(finished.lapTime).toBeGreaterThan(0);
    expect(finished.bestLap).not.toBeNull();
    expect(finished.totalTime).toBeGreaterThan(finished.lapTime);
  });

  it("resets after finishing when restart is requested", () => {
    const model = new SimcadeRaceModel();
    model.update(1 / 60, { ...idle, launch: true });
    run(model, 90, { throttle: 1, ers: true });

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
  });
});
