import { describe, expect, it } from "vitest";
import { raceAudioMix } from "./RaceAudioController";

const baseTelemetry = {
  phase: "racing" as const,
  speedKph: 80,
  rpm: 5600,
  gear: 3,
  ers: 1,
  surfaceName: "Asphalt" as const,
  surfaceRumble: 0,
  rainIntensity: 0,
  roadWetness: 0,
  tireLoadFeedback: 0,
  car: {
    slip: 0,
    braking: 0,
    throttle: 0.35,
    wheelspin: 0,
    understeer: 0,
    lockup: 0
  }
};

describe("raceAudioMix", () => {
  it("builds more engine, intake, and wind presence with speed and throttle", () => {
    const slow = raceAudioMix(baseTelemetry);
    const fast = raceAudioMix({
      ...baseTelemetry,
      speedKph: 270,
      rpm: 9300,
      gear: 7,
      car: { ...baseTelemetry.car, throttle: 1 }
    });

    expect(fast.masterGain).toBeGreaterThan(slow.masterGain);
    expect(fast.engineFrequency).toBeGreaterThan(slow.engineFrequency);
    expect(fast.engineGain).toBeGreaterThan(slow.engineGain);
    expect(fast.harmonicGain).toBeGreaterThan(slow.harmonicGain);
    expect(fast.intakeGain).toBeGreaterThan(slow.intakeGain);
    expect(fast.windGain).toBeGreaterThan(slow.windGain);
  });

  it("adds tire scrub and rain layers from grip loss and weather", () => {
    const dry = raceAudioMix(baseTelemetry);
    const wetGravel = raceAudioMix({
      ...baseTelemetry,
      speedKph: 145,
      surfaceName: "Gravel",
      surfaceRumble: 0.7,
      rainIntensity: 0.86,
      roadWetness: 0.92,
      car: { ...baseTelemetry.car, slip: 0.54, wheelspin: 0.4, lockup: 0.2 }
    });

    expect(wetGravel.tireGain).toBeGreaterThan(dry.tireGain);
    expect(wetGravel.tireFrequency).toBeGreaterThan(dry.tireFrequency);
    expect(wetGravel.rainGain).toBeGreaterThan(dry.rainGain);
    expect(wetGravel.rainFrequency).toBeGreaterThan(dry.rainFrequency);
  });

  it("adds tire presence from shared tire load feedback", () => {
    const clean = raceAudioMix(baseTelemetry);
    const loaded = raceAudioMix({
      ...baseTelemetry,
      speedKph: 190,
      tireLoadFeedback: 0.72
    });

    expect(loaded.tireGain).toBeGreaterThan(clean.tireGain);
    expect(loaded.tireFrequency).toBeGreaterThan(clean.tireFrequency);
  });

  it("exposes ERS whine only when deployment is plausible", () => {
    const noDeployment = raceAudioMix(baseTelemetry);
    const deploying = raceAudioMix({
      ...baseTelemetry,
      speedKph: 220,
      ers: 0.4,
      car: { ...baseTelemetry.car, throttle: 0.8 }
    });

    expect(noDeployment.ersGain).toBe(0);
    expect(deploying.ersGain).toBeGreaterThan(0);
    expect(deploying.ersFrequency).toBeGreaterThan(noDeployment.ersFrequency);
  });
});
