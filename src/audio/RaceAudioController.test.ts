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
  splitSurfaceLoad: 0,
  rainIntensity: 0,
  roadWetness: 0,
  tireLoadFeedback: 0,
  axleLoadSaturation: 0,
  combinedSlipLoad: 0,
  tireGripReserve: 1,
  tirePressure: 1,
  tireContactPatch: 1,
  tirePressureLoad: 0,
  brakeBalanceLoad: 0,
  frontLockRisk: 0,
  rearBrakeStability: 1,
  driveTorqueLoad: 0,
  pedalOverlapLoad: 0,
  differentialLock: 0,
  insideRearSlip: 0,
  steeringLoadFeedback: 0,
  steeringRackLoad: 0,
  steeringVelocity: 0,
  steeringImpulse: 0,
  controlActuationLoad: 0,
  steeringRatio: 1,
  selfAlignTorque: 0,
  yawInertiaLoad: 0,
  yawDamping: 1,
  counterSteerLoad: 0,
  slipRecovery: 0,
  chassisStability: 1,
  roadFeelFeedback: 0,
  roadTextureLoad: 0,
  chassisHeave: 0,
  rideSettling: 0,
  tireGroundContact: 1,
  rearTractionRotation: 0,
  liftOffRotationLoad: 0,
  throttlePickupLoad: 0,
  powerUndersteerLoad: 0,
  aeroBalance: 0,
  aeroWashout: 0,
  suspensionVelocity: 0,
  damperImpulse: 0,
  floorStrikeLoad: 0,
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

  it("adds tire texture from steering load feedback", () => {
    const clean = raceAudioMix(baseTelemetry);
    const loaded = raceAudioMix({
      ...baseTelemetry,
      speedKph: 190,
      steeringLoadFeedback: 0.68
    });

    expect(loaded.tireGain).toBeGreaterThan(clean.tireGain);
    expect(loaded.tireFrequency).toBeGreaterThan(clean.tireFrequency);
  });

  it("adds tire texture from combined slip reserve", () => {
    const clean = raceAudioMix(baseTelemetry);
    const loaded = raceAudioMix({
      ...baseTelemetry,
      speedKph: 205,
      combinedSlipLoad: 0.54,
      tireGripReserve: 0.68
    });

    expect(loaded.tireGain).toBeGreaterThan(clean.tireGain);
    expect(loaded.tireFrequency).toBeGreaterThan(clean.tireFrequency);
  });

  it("adds tire texture from axle load saturation", () => {
    const tidy = raceAudioMix(baseTelemetry);
    const loaded = raceAudioMix({
      ...baseTelemetry,
      speedKph: 205,
      axleLoadSaturation: 0.38
    });

    expect(loaded.tireGain).toBeGreaterThan(tidy.tireGain);
    expect(loaded.tireFrequency).toBeGreaterThan(tidy.tireFrequency);
  });

  it("adds tire texture from pressure load", () => {
    const clean = raceAudioMix(baseTelemetry);
    const loaded = raceAudioMix({
      ...baseTelemetry,
      speedKph: 220,
      tirePressure: 1.1,
      tireContactPatch: 0.88,
      tirePressureLoad: 0.42
    });

    expect(loaded.tireGain).toBeGreaterThan(clean.tireGain);
    expect(loaded.tireFrequency).toBeGreaterThan(clean.tireFrequency);
  });

  it("adds tire texture from brake balance instability", () => {
    const clean = raceAudioMix(baseTelemetry);
    const loaded = raceAudioMix({
      ...baseTelemetry,
      speedKph: 205,
      brakeBalanceLoad: 0.48,
      frontLockRisk: 0.34,
      rearBrakeStability: 0.72,
      car: { ...baseTelemetry.car, braking: 0.72 }
    });

    expect(loaded.tireGain).toBeGreaterThan(clean.tireGain);
    expect(loaded.tireFrequency).toBeGreaterThan(clean.tireFrequency);
  });

  it("adds tire texture from differential corner-exit load", () => {
    const clean = raceAudioMix(baseTelemetry);
    const loaded = raceAudioMix({
      ...baseTelemetry,
      speedKph: 195,
      driveTorqueLoad: 0.5,
      differentialLock: 0.32,
      insideRearSlip: 0.28,
      car: { ...baseTelemetry.car, throttle: 1, wheelspin: 0.12 }
    });

    expect(loaded.tireGain).toBeGreaterThan(clean.tireGain);
    expect(loaded.tireFrequency).toBeGreaterThan(clean.tireFrequency);
  });

  it("adds tire texture from pedal overlap bind", () => {
    const clean = raceAudioMix(baseTelemetry);
    const loaded = raceAudioMix({
      ...baseTelemetry,
      speedKph: 205,
      pedalOverlapLoad: 0.46,
      car: { ...baseTelemetry.car, throttle: 0.75, braking: 0.52 }
    });

    expect(loaded.tireGain).toBeGreaterThan(clean.tireGain);
    expect(loaded.tireFrequency).toBeGreaterThan(clean.tireFrequency);
  });

  it("adds tire texture from steering rack load and self alignment", () => {
    const clean = raceAudioMix(baseTelemetry);
    const loaded = raceAudioMix({
      ...baseTelemetry,
      speedKph: 190,
      steeringRackLoad: 0.52,
      selfAlignTorque: -0.28
    });

    expect(loaded.tireGain).toBeGreaterThan(clean.tireGain);
    expect(loaded.tireFrequency).toBeGreaterThan(clean.tireFrequency);
  });

  it("adds tire texture from steering rack impulse", () => {
    const clean = raceAudioMix(baseTelemetry);
    const loaded = raceAudioMix({
      ...baseTelemetry,
      speedKph: 205,
      steeringVelocity: -0.46,
      steeringImpulse: 0.38
    });

    expect(loaded.tireGain).toBeGreaterThan(clean.tireGain);
    expect(loaded.tireFrequency).toBeGreaterThan(clean.tireFrequency);
  });

  it("adds tire texture from control actuation load", () => {
    const clean = raceAudioMix(baseTelemetry);
    const loaded = raceAudioMix({
      ...baseTelemetry,
      speedKph: 195,
      controlActuationLoad: 0.42
    });

    expect(loaded.tireGain).toBeGreaterThan(clean.tireGain);
    expect(loaded.tireFrequency).toBeGreaterThan(clean.tireFrequency);
  });

  it("adds tire texture from speed-sensitive steering ratio", () => {
    const clean = raceAudioMix(baseTelemetry);
    const loaded = raceAudioMix({
      ...baseTelemetry,
      speedKph: 225,
      steeringRatio: 0.82
    });

    expect(loaded.tireGain).toBeGreaterThan(clean.tireGain);
    expect(loaded.tireFrequency).toBeGreaterThan(clean.tireFrequency);
  });

  it("adds tire texture from yaw inertia load", () => {
    const clean = raceAudioMix(baseTelemetry);
    const loaded = raceAudioMix({
      ...baseTelemetry,
      speedKph: 205,
      yawInertiaLoad: 0.48,
      yawDamping: 0.62
    });

    expect(loaded.tireGain).toBeGreaterThan(clean.tireGain);
    expect(loaded.tireFrequency).toBeGreaterThan(clean.tireFrequency);
  });

  it("adds tire texture from countersteer recovery", () => {
    const clean = raceAudioMix(baseTelemetry);
    const loaded = raceAudioMix({
      ...baseTelemetry,
      speedKph: 210,
      counterSteerLoad: 0.48,
      slipRecovery: 0.34,
      chassisStability: 0.74
    });

    expect(loaded.tireGain).toBeGreaterThan(clean.tireGain);
    expect(loaded.tireFrequency).toBeGreaterThan(clean.tireFrequency);
  });

  it("adds tire texture from road feel feedback", () => {
    const clean = raceAudioMix(baseTelemetry);
    const loaded = raceAudioMix({
      ...baseTelemetry,
      speedKph: 190,
      roadFeelFeedback: 0.62
    });

    expect(loaded.tireGain).toBeGreaterThan(clean.tireGain);
    expect(loaded.tireFrequency).toBeGreaterThan(clean.tireFrequency);
  });

  it("adds tire texture from ride settling over road texture", () => {
    const clean = raceAudioMix(baseTelemetry);
    const loaded = raceAudioMix({
      ...baseTelemetry,
      speedKph: 210,
      roadTextureLoad: 0.48,
      chassisHeave: -0.08,
      rideSettling: 0.28
    });

    expect(loaded.tireGain).toBeGreaterThan(clean.tireGain);
    expect(loaded.tireFrequency).toBeGreaterThan(clean.tireFrequency);
  });

  it("adds tire texture from damper impulses", () => {
    const clean = raceAudioMix(baseTelemetry);
    const loaded = raceAudioMix({
      ...baseTelemetry,
      speedKph: 190,
      suspensionVelocity: -0.36,
      damperImpulse: 0.42
    });

    expect(loaded.tireGain).toBeGreaterThan(clean.tireGain);
    expect(loaded.tireFrequency).toBeGreaterThan(clean.tireFrequency);
  });

  it("adds tire texture from floor strikes", () => {
    const clean = raceAudioMix(baseTelemetry);
    const struck = raceAudioMix({
      ...baseTelemetry,
      speedKph: 220,
      floorStrikeLoad: 0.42
    });

    expect(struck.tireGain).toBeGreaterThan(clean.tireGain);
    expect(struck.tireFrequency).toBeGreaterThan(clean.tireFrequency);
  });

  it("adds tire texture from split surface contact", () => {
    const clean = raceAudioMix(baseTelemetry);
    const loaded = raceAudioMix({
      ...baseTelemetry,
      speedKph: 190,
      splitSurfaceLoad: 0.58
    });

    expect(loaded.tireGain).toBeGreaterThan(clean.tireGain);
    expect(loaded.tireFrequency).toBeGreaterThan(clean.tireFrequency);
  });

  it("adds tire texture from rear traction rotation", () => {
    const tidy = raceAudioMix(baseTelemetry);
    const rotating = raceAudioMix({
      ...baseTelemetry,
      speedKph: 190,
      rearTractionRotation: 0.32
    });

    expect(rotating.tireGain).toBeGreaterThan(tidy.tireGain);
    expect(rotating.tireFrequency).toBeGreaterThan(tidy.tireFrequency);
  });

  it("adds tire texture from lift-off rotation", () => {
    const tidy = raceAudioMix(baseTelemetry);
    const rotating = raceAudioMix({
      ...baseTelemetry,
      speedKph: 190,
      liftOffRotationLoad: 0.36
    });

    expect(rotating.tireGain).toBeGreaterThan(tidy.tireGain);
    expect(rotating.tireFrequency).toBeGreaterThan(tidy.tireFrequency);
  });

  it("adds tire texture from throttle pickup", () => {
    const tidy = raceAudioMix(baseTelemetry);
    const pickingUp = raceAudioMix({
      ...baseTelemetry,
      speedKph: 190,
      throttlePickupLoad: 0.34
    });

    expect(pickingUp.tireGain).toBeGreaterThan(tidy.tireGain);
    expect(pickingUp.tireFrequency).toBeGreaterThan(tidy.tireFrequency);
  });

  it("adds tire texture from power understeer", () => {
    const tidy = raceAudioMix(baseTelemetry);
    const pushing = raceAudioMix({
      ...baseTelemetry,
      speedKph: 190,
      powerUndersteerLoad: 0.36
    });

    expect(pushing.tireGain).toBeGreaterThan(tidy.tireGain);
    expect(pushing.tireFrequency).toBeGreaterThan(tidy.tireFrequency);
  });

  it("adds tire texture when crest contact gets light", () => {
    const planted = raceAudioMix(baseTelemetry);
    const light = raceAudioMix({
      ...baseTelemetry,
      speedKph: 190,
      tireGroundContact: 0.78
    });

    expect(light.tireGain).toBeGreaterThan(planted.tireGain);
    expect(light.tireFrequency).toBeGreaterThan(planted.tireFrequency);
  });

  it("adds tire texture from aero washout and balance", () => {
    const tidy = raceAudioMix(baseTelemetry);
    const washed = raceAudioMix({
      ...baseTelemetry,
      speedKph: 220,
      aeroBalance: -0.32,
      aeroWashout: 0.42
    });

    expect(washed.tireGain).toBeGreaterThan(tidy.tireGain);
    expect(washed.tireFrequency).toBeGreaterThan(tidy.tireFrequency);
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
