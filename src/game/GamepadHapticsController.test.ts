import { describe, expect, it } from "vitest";
import { raceHapticEffect } from "./GamepadHapticsController";

const baseTelemetry = {
  phase: "racing" as const,
  speedKph: 140,
  surfaceName: "Asphalt" as const,
  surfaceRumble: 0,
  splitSurfaceLoad: 0,
  roadWetness: 0,
  draft: 0,
  dirtyAir: 0,
  contactRisk: 0,
  tireLoadFeedback: 0,
  steeringLoadFeedback: 0,
  steeringRackLoad: 0,
  selfAlignTorque: 0,
  yawInertiaLoad: 0,
  yawDamping: 1,
  roadFeelFeedback: 0,
  tireGroundContact: 1,
  rearTractionRotation: 0,
  aeroBalance: 0,
  aeroWashout: 0,
  suspensionVelocity: 0,
  damperImpulse: 0,
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

  it("turns road feel feedback into surface texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      roadFeelFeedback: 0.62
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

  it("turns split surface contact into edge texture", () => {
    const tidy = raceHapticEffect(baseTelemetry);
    const loaded = raceHapticEffect({
      ...baseTelemetry,
      splitSurfaceLoad: -0.56
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
