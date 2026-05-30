import type { RaceTelemetry } from "./SimcadeRaceModel";

type HapticTelemetry = Pick<
  RaceTelemetry,
  "phase" | "speedKph" | "surfaceName" | "surfaceRumble" | "roadWetness" | "draft" | "dirtyAir" | "contactRisk"
> & {
  car: Pick<RaceTelemetry["car"], "slip" | "braking" | "wheelspin" | "understeer" | "lockup">;
};

export type RaceHapticEffect = {
  durationMs: number;
  strongMagnitude: number;
  weakMagnitude: number;
};

type RumbleActuator = {
  playEffect?: (
    type: "dual-rumble",
    parameters: {
      duration: number;
      strongMagnitude: number;
      weakMagnitude: number;
    }
  ) => Promise<unknown>;
  reset?: () => Promise<unknown>;
};

type PulseActuator = {
  pulse?: (value: number, duration: number) => Promise<unknown>;
};

type HapticGamepad = Gamepad & {
  vibrationActuator?: RumbleActuator;
  hapticActuators?: PulseActuator[];
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function raceHapticEffect(telemetry: HapticTelemetry): RaceHapticEffect | null {
  if (telemetry.phase !== "racing" || telemetry.speedKph < 22) return null;

  const speed = clamp01(telemetry.speedKph / 310);
  const surface =
    telemetry.surfaceName === "Gravel" ? 0.92 : telemetry.surfaceName === "Runoff" ? 0.58 : telemetry.surfaceName === "Kerb" ? 0.42 : 0;
  const tractionStress = clamp01(
    Math.max(
      telemetry.car.slip * 0.68,
      telemetry.car.wheelspin * 0.78,
      telemetry.car.lockup * 0.9,
      telemetry.car.understeer * 0.48,
      telemetry.car.braking * 0.16
    )
  );
  const roadTexture = clamp01(telemetry.surfaceRumble * 0.64 + surface * 0.34 + telemetry.roadWetness * speed * 0.18);
  const airBuffet = clamp01(telemetry.draft * 0.1 + telemetry.dirtyAir * 0.18 + telemetry.contactRisk * 0.22);
  const strongMagnitude = clamp01(surface * 0.38 + tractionStress * 0.62 + telemetry.contactRisk * 0.5);
  const weakMagnitude = clamp01(speed * 0.07 + roadTexture * 0.58 + airBuffet);

  if (Math.max(strongMagnitude, weakMagnitude) < 0.045) return null;

  return {
    durationMs: 70,
    strongMagnitude,
    weakMagnitude
  };
}

export class GamepadHapticsController {
  private lastPulseAt = 0;

  update(telemetry: RaceTelemetry) {
    const effect = raceHapticEffect(telemetry);
    const now = performance.now();

    if (!effect || now - this.lastPulseAt < 85) return;

    const gamepad = navigator.getGamepads?.().find((pad): pad is HapticGamepad => Boolean(pad?.connected)) as HapticGamepad | undefined;
    if (!gamepad) return;

    this.lastPulseAt = now;
    const actuator = gamepad.vibrationActuator;
    if (actuator?.playEffect) {
      void actuator
        .playEffect("dual-rumble", {
          duration: effect.durationMs,
          strongMagnitude: effect.strongMagnitude,
          weakMagnitude: effect.weakMagnitude
        })
        .catch(() => undefined);
      return;
    }

    const pulse = gamepad.hapticActuators?.find((item) => item.pulse)?.pulse;
    if (pulse) {
      void pulse(Math.max(effect.strongMagnitude, effect.weakMagnitude), effect.durationMs).catch(() => undefined);
    }
  }

  stop() {
    const gamepad = navigator.getGamepads?.().find((pad): pad is HapticGamepad => Boolean(pad?.connected)) as HapticGamepad | undefined;
    if (gamepad?.vibrationActuator?.reset) {
      void gamepad.vibrationActuator.reset().catch(() => undefined);
    }
  }
}
