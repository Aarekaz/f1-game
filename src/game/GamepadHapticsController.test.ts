import { describe, expect, it } from "vitest";
import { raceHapticEffect } from "./GamepadHapticsController";

const baseTelemetry = {
  phase: "racing" as const,
  speedKph: 140,
  surfaceName: "Asphalt" as const,
  surfaceRumble: 0,
  splitSurfaceLoad: 0,
  roadWetness: 0,
  hydroplaneLoad: 0,
  draft: 0,
  dirtyAir: 0,
  contactRisk: 0,
  tireLoadFeedback: 0,
  axleLoadSaturation: 0,
  combinedSlipLoad: 0,
  tireGripReserve: 1,
  tirePressure: 1,
  tireContactPatch: 1,
  tirePressureLoad: 0,
  tireResponseLoad: 0,
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
  pedalPressureLoad: 0,
  steeringRatio: 1,
  selfAlignTorque: 0,
  yawInertiaLoad: 0,
  yawDamping: 1,
  counterSteerLoad: 0,
  slipRecovery: 0,
  chassisStability: 1,
  roadFeelFeedback: 0,
  roadCamberLoad: 0,
  roadTextureLoad: 0,
  chassisHeave: 0,
  rideSettling: 0,
  tireGroundContact: 1,
  longitudinalSlipLoad: 0,
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
    wheelspin: 0,
    understeer: 0,
    lockup: 0
  }
};

describe("raceHapticEffect", () => {
  it("stays quiet outside the racing phase", () => {
    expect(raceHapticEffect({ ...baseTelemetry, phase: "ready" })).toBeNull();
    expect(raceHapticEffect({ ...baseTelemetry, phase: "finished" })).toBeNull();
  });

  it("adds low texture for wet high-speed asphalt", () => {
    const dry = raceHapticEffect(baseTelemetry);
    const wet = raceHapticEffect({
      ...baseTelemetry,
      speedKph: 260,
      roadWetness: 0.9
    });

    expect(wet?.weakMagnitude).toBeGreaterThan(dry?.weakMagnitude ?? 0);
    expect(wet?.durationMs).toBe(70);
  });

  it("adds tire rumble when the car hydroplanes", () => {
    const planted = raceHapticEffect(baseTelemetry);
    const skating = raceHapticEffect({
      ...baseTelemetry,
      speedKph: 245,
      roadWetness: 0.9,
      hydroplaneLoad: 0.46
    });

    expect(skating?.strongMagnitude).toBeGreaterThan(planted?.strongMagnitude ?? 0);
    expect(skating?.weakMagnitude).toBeGreaterThan(planted?.weakMagnitude ?? 0);
  });

  it("makes kerbs and gravel stronger than clean asphalt", () => {
    const asphalt = raceHapticEffect(baseTelemetry);
    const kerb = raceHapticEffect({
      ...baseTelemetry,
      surfaceName: "Kerb",
      surfaceRumble: 0.45
    });
    const gravel = raceHapticEffect({
      ...baseTelemetry,
      surfaceName: "Gravel",
      surfaceRumble: 0.82
    });

    expect(kerb?.strongMagnitude).toBeGreaterThan(asphalt?.strongMagnitude ?? 0);
    expect(gravel?.strongMagnitude).toBeGreaterThan(kerb?.strongMagnitude ?? 0);
    expect(gravel?.weakMagnitude).toBeGreaterThan(kerb?.weakMagnitude ?? 0);
  });

  it("turns traction mistakes into stronger rumble", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const lockup = raceHapticEffect({
      ...baseTelemetry,
      car: { ...baseTelemetry.car, braking: 1, lockup: 0.7 }
    });
    const wheelspin = raceHapticEffect({
      ...baseTelemetry,
      car: { ...baseTelemetry.car, wheelspin: 0.72, slip: 0.42 }
    });

    expect(lockup?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(wheelspin?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
  });

  it("turns tire load feedback into subtle steering texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      tireLoadFeedback: 0.7
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns steering load feedback into wheel weight texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      steeringLoadFeedback: 0.68
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns combined slip reserve into tire texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      speedKph: 205,
      combinedSlipLoad: 0.54,
      tireGripReserve: 0.68
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns axle load saturation into tire texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      axleLoadSaturation: 0.4
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns tire pressure load into contact-patch texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      speedKph: 220,
      tirePressure: 1.1,
      tireContactPatch: 0.88,
      tirePressureLoad: 0.42
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns brake balance instability into tire texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      speedKph: 205,
      brakeBalanceLoad: 0.5,
      frontLockRisk: 0.36,
      rearBrakeStability: 0.72,
      car: { ...baseTelemetry.car, braking: 0.72 }
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns differential corner-exit load into tire texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      speedKph: 205,
      driveTorqueLoad: 0.52,
      differentialLock: 0.34,
      insideRearSlip: 0.28,
      car: { ...baseTelemetry.car, wheelspin: 0.14 }
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns pedal overlap bind into drivetrain texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      speedKph: 205,
      pedalOverlapLoad: 0.42,
      car: { ...baseTelemetry.car, braking: 0.52 }
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns steering rack load into wheel weight texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      steeringRackLoad: 0.56,
      selfAlignTorque: -0.3
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns steering rack impulse into quick wheel texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      steeringVelocity: 0.48,
      steeringImpulse: 0.36
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns control actuation load into quick input texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      controlActuationLoad: 0.42
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns speed-sensitive steering ratio into high-speed wheel texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      speedKph: 225,
      steeringRatio: 0.82
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns yaw inertia into rotation texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      speedKph: 205,
      yawInertiaLoad: 0.52,
      yawDamping: 0.58
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns countersteer recovery into catch texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      speedKph: 210,
      counterSteerLoad: 0.46,
      slipRecovery: 0.32,
      chassisStability: 0.72
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns road feel feedback into surface texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      roadFeelFeedback: 0.62
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns ride settling into fine surface texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      roadTextureLoad: 0.46,
      chassisHeave: 0.07,
      rideSettling: 0.3
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns damper impulses into suspension chatter", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      suspensionVelocity: 0.38,
      damperImpulse: 0.44
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns floor strikes into chassis scrape texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const struck = raceHapticEffect({
      ...baseTelemetry,
      speedKph: 220,
      floorStrikeLoad: 0.42
    });

    expect(struck?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(struck?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns split surface contact into edge texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      splitSurfaceLoad: -0.56
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns road camber load into banking texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      speedKph: 205,
      roadCamberLoad: 0.34
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns tire response load into steering texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      speedKph: 215,
      tireResponseLoad: 0.42
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns pedal pressure load into pedal texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      speedKph: 210,
      pedalPressureLoad: 0.46
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns longitudinal slip into tire texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      speedKph: 205,
      longitudinalSlipLoad: 0.5
    });

    expect(loaded?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(loaded?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns rear traction rotation into tire chatter", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const rotating = raceHapticEffect({
      ...baseTelemetry,
      rearTractionRotation: -0.34
    });

    expect(rotating?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(rotating?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns lift-off rotation into catch texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const rotating = raceHapticEffect({
      ...baseTelemetry,
      liftOffRotationLoad: 0.38
    });

    expect(rotating?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(rotating?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns throttle pickup into rear bite texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const pickingUp = raceHapticEffect({
      ...baseTelemetry,
      throttlePickupLoad: 0.36
    });

    expect(pickingUp?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(pickingUp?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns power understeer into front tire texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const pushing = raceHapticEffect({
      ...baseTelemetry,
      powerUndersteerLoad: 0.38
    });

    expect(pushing?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(pushing?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns light crest contact into fine texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const light = raceHapticEffect({
      ...baseTelemetry,
      tireGroundContact: 0.78
    });

    expect(light?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(light?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });

  it("turns aero washout into high-speed wheel texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const washed = raceHapticEffect({
      ...baseTelemetry,
      speedKph: 245,
      aeroBalance: -0.34,
      aeroWashout: 0.44
    });

    expect(washed?.strongMagnitude).toBeGreaterThan(tidy?.strongMagnitude ?? 0);
    expect(washed?.weakMagnitude).toBeGreaterThan(tidy?.weakMagnitude ?? 0);
  });
});
