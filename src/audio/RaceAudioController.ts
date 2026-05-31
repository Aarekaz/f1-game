import type { RaceTelemetry } from "../game/SimcadeRaceModel";

type BrowserAudioContext = typeof AudioContext;
type AudioTelemetry = Pick<
  RaceTelemetry,
  | "phase"
  | "speedKph"
  | "rpm"
  | "surfaceName"
  | "surfaceRumble"
  | "splitSurfaceLoad"
  | "rainIntensity"
  | "roadWetness"
  | "ers"
  | "gear"
  | "tireLoadFeedback"
  | "steeringLoadFeedback"
  | "steeringRackLoad"
  | "selfAlignTorque"
  | "yawInertiaLoad"
  | "yawDamping"
  | "roadFeelFeedback"
  | "tireGroundContact"
  | "rearTractionRotation"
  | "aeroBalance"
  | "aeroWashout"
  | "suspensionVelocity"
  | "damperImpulse"
> & {
  car: Pick<RaceTelemetry["car"], "slip" | "braking" | "throttle" | "wheelspin" | "understeer" | "lockup">;
};

export type RaceAudioMix = {
  masterGain: number;
  engineFrequency: number;
  engineGain: number;
  harmonicFrequency: number;
  harmonicGain: number;
  intakeFrequency: number;
  intakeGain: number;
  tireFrequency: number;
  tireGain: number;
  windFrequency: number;
  windGain: number;
  rainFrequency: number;
  rainGain: number;
  ersFrequency: number;
  ersGain: number;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function getAudioContextConstructor(): BrowserAudioContext | undefined {
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: BrowserAudioContext }).webkitAudioContext;
}

export function raceAudioMix(telemetry: AudioTelemetry): RaceAudioMix {
  const racing = telemetry.phase === "racing";
  const speed = clamp01(telemetry.speedKph / 310);
  const rpm = clamp01(telemetry.rpm / 10000);
  const throttle = clamp01(telemetry.car.throttle);
  const slip = clamp01(
    Math.max(
      telemetry.car.slip,
      telemetry.car.braking * 0.28,
      telemetry.car.wheelspin * 0.72,
      telemetry.car.lockup * 0.9,
      telemetry.car.understeer * 0.5,
      telemetry.tireLoadFeedback * 0.84,
      telemetry.steeringLoadFeedback * 0.62,
      telemetry.steeringRackLoad * 0.5,
      Math.abs(telemetry.selfAlignTorque) * 0.34,
      telemetry.yawInertiaLoad * 0.44,
      telemetry.roadFeelFeedback * 0.54,
      telemetry.damperImpulse * 0.68,
      Math.max(0, 1 - telemetry.tireGroundContact) * 0.56,
      Math.abs(telemetry.splitSurfaceLoad) * 0.5,
      Math.abs(telemetry.rearTractionRotation) * 0.7,
      telemetry.aeroWashout * 0.48,
      Math.abs(telemetry.aeroBalance) * 0.24,
      telemetry.surfaceRumble * 0.62
    )
  );
  const looseSurface = telemetry.surfaceName === "Gravel" ? 1 : telemetry.surfaceName === "Runoff" ? 0.62 : telemetry.surfaceName === "Kerb" ? 0.34 : 0;
  const wetness = clamp01(telemetry.roadWetness);
  const ersActive = racing && telemetry.speedKph > 130 && telemetry.ers < 0.85 && throttle > 0.35;

  const engineFrequency = 74 + rpm * 610 + speed * 86;
  return {
    masterGain: racing ? 0.46 + speed * 0.12 : 0.1,
    engineFrequency,
    engineGain: racing ? 0.04 + speed * 0.065 + throttle * 0.025 : 0.016,
    harmonicFrequency: engineFrequency * 1.96 + telemetry.gear * 6,
    harmonicGain: racing ? 0.012 + rpm * 0.032 + throttle * 0.018 : 0.003,
    intakeFrequency: 440 + rpm * 1260 + throttle * 170,
    intakeGain: racing ? throttle * (0.012 + rpm * 0.026) : 0,
    tireFrequency:
      260 +
      speed * 740 +
      telemetry.tireLoadFeedback * 160 +
      telemetry.steeringLoadFeedback * 90 +
      telemetry.steeringRackLoad * 74 +
      Math.abs(telemetry.selfAlignTorque) * 46 +
      telemetry.yawInertiaLoad * 58 +
      Math.max(0, 1 - telemetry.yawDamping) * 42 +
      telemetry.roadFeelFeedback * 70 +
      telemetry.damperImpulse * 135 +
      Math.abs(telemetry.suspensionVelocity) * 80 +
      Math.max(0, 1 - telemetry.tireGroundContact) * 110 +
      Math.abs(telemetry.splitSurfaceLoad) * 95 +
      Math.abs(telemetry.rearTractionRotation) * 120 +
      telemetry.aeroWashout * 80 +
      Math.abs(telemetry.aeroBalance) * 38 +
      looseSurface * 90,
    tireGain: racing
      ? slip * 0.055 +
        telemetry.tireLoadFeedback * 0.018 +
        telemetry.steeringLoadFeedback * 0.012 +
        telemetry.steeringRackLoad * 0.01 +
        Math.abs(telemetry.selfAlignTorque) * 0.006 +
        telemetry.yawInertiaLoad * 0.008 +
        telemetry.roadFeelFeedback * 0.012 +
        telemetry.damperImpulse * 0.017 +
        Math.max(0, 1 - telemetry.tireGroundContact) * 0.016 +
        Math.abs(telemetry.splitSurfaceLoad) * 0.014 +
        Math.abs(telemetry.rearTractionRotation) * 0.016 +
        telemetry.aeroWashout * 0.01 +
        Math.abs(telemetry.aeroBalance) * 0.004 +
        telemetry.surfaceRumble * 0.018 +
        looseSurface * speed * 0.014
      : 0,
    windFrequency: 520 + speed * 1800,
    windGain: racing ? Math.pow(speed, 1.65) * 0.052 : 0,
    rainFrequency: 1800 + speed * 1800,
    rainGain: racing ? telemetry.rainIntensity * (0.012 + speed * 0.028 + wetness * 0.01) : telemetry.rainIntensity * 0.006,
    ersFrequency: 760 + speed * 620 + rpm * 220,
    ersGain: ersActive ? 0.014 + speed * 0.018 : 0
  };
}

function makeNoiseBuffer(context: AudioContext) {
  const length = context.sampleRate * 2;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 1337;

  for (let index = 0; index < length; index += 1) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    data[index] = (seed / 4294967296) * 2 - 1;
  }

  return buffer;
}

export class RaceAudioController {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private harmonic: OscillatorNode | null = null;
  private harmonicGain: GainNode | null = null;
  private intake: OscillatorNode | null = null;
  private intakeGain: GainNode | null = null;
  private tire: OscillatorNode | null = null;
  private tireGain: GainNode | null = null;
  private ers: OscillatorNode | null = null;
  private ersGain: GainNode | null = null;
  private windNoise: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private rainNoise: AudioBufferSourceNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;
  private lastGear = 1;
  private lastShiftTime = -1;
  private unlocked = false;
  private muted = false;
  private readonly unlock = () => void this.ensureStarted();

  attach() {
    window.addEventListener("pointerdown", this.unlock, { passive: true });
    window.addEventListener("keydown", this.unlock);
  }

  update(telemetry: RaceTelemetry) {
    if (
      !this.context ||
      !this.engine ||
      !this.master ||
      !this.engineGain ||
      !this.harmonic ||
      !this.harmonicGain ||
      !this.intake ||
      !this.intakeGain ||
      !this.tire ||
      !this.tireGain ||
      !this.ers ||
      !this.ersGain ||
      !this.windFilter ||
      !this.windGain ||
      !this.rainFilter ||
      !this.rainGain
    ) {
      return;
    }

    const now = this.context.currentTime;
    const mix = raceAudioMix(telemetry);

    if (telemetry.phase === "racing" && telemetry.gear !== this.lastGear && now - this.lastShiftTime > 0.18) {
      this.playShiftClick(now, telemetry.gear > this.lastGear);
      this.lastGear = telemetry.gear;
      this.lastShiftTime = now;
    }

    this.master.gain.setTargetAtTime(this.muted ? 0 : mix.masterGain, now, 0.08);
    this.engine.frequency.setTargetAtTime(mix.engineFrequency, now, 0.035);
    this.engineGain.gain.setTargetAtTime(mix.engineGain, now, 0.045);
    this.harmonic.frequency.setTargetAtTime(mix.harmonicFrequency, now, 0.032);
    this.harmonicGain.gain.setTargetAtTime(mix.harmonicGain, now, 0.045);
    this.intake.frequency.setTargetAtTime(mix.intakeFrequency, now, 0.035);
    this.intakeGain.gain.setTargetAtTime(mix.intakeGain, now, 0.04);
    this.tire.frequency.setTargetAtTime(mix.tireFrequency, now, 0.04);
    this.tireGain.gain.setTargetAtTime(mix.tireGain, now, 0.032);
    this.windFilter.frequency.setTargetAtTime(mix.windFrequency, now, 0.08);
    this.windGain.gain.setTargetAtTime(mix.windGain, now, 0.08);
    this.rainFilter.frequency.setTargetAtTime(mix.rainFrequency, now, 0.08);
    this.rainGain.gain.setTargetAtTime(mix.rainGain, now, 0.12);
    this.ers.frequency.setTargetAtTime(mix.ersFrequency, now, 0.035);
    this.ersGain.gain.setTargetAtTime(mix.ersGain, now, 0.05);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (!muted && this.unlocked) {
      this.ensureStarted();
    }

    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.master.gain.value, this.context.currentTime, 0.04);
    }
  }

  isMuted() {
    return this.muted;
  }

  dispose() {
    window.removeEventListener("pointerdown", this.unlock);
    window.removeEventListener("keydown", this.unlock);
    this.engine?.stop();
    this.harmonic?.stop();
    this.intake?.stop();
    this.tire?.stop();
    this.ers?.stop();
    this.windNoise?.stop();
    this.rainNoise?.stop();
    void this.context?.close();
    this.context = null;
  }

  private ensureStarted() {
    if (this.unlocked) {
      void this.context?.resume();
      return;
    }

    const AudioCtor = getAudioContextConstructor();
    if (!AudioCtor) return;

    const context = new AudioCtor();
    const master = context.createGain();
    const engineGain = context.createGain();
    const harmonicGain = context.createGain();
    const intakeGain = context.createGain();
    const tireGain = context.createGain();
    const ersGain = context.createGain();
    const windGain = context.createGain();
    const rainGain = context.createGain();
    const windFilter = context.createBiquadFilter();
    const rainFilter = context.createBiquadFilter();
    const engine = context.createOscillator();
    const harmonic = context.createOscillator();
    const intake = context.createOscillator();
    const tire = context.createOscillator();
    const ers = context.createOscillator();
    const noiseBuffer = makeNoiseBuffer(context);
    const windNoise = context.createBufferSource();
    const rainNoise = context.createBufferSource();

    engine.type = "sawtooth";
    harmonic.type = "square";
    intake.type = "triangle";
    tire.type = "triangle";
    ers.type = "sine";
    windNoise.buffer = noiseBuffer;
    windNoise.loop = true;
    rainNoise.buffer = noiseBuffer;
    rainNoise.loop = true;
    windFilter.type = "highpass";
    windFilter.frequency.value = 520;
    rainFilter.type = "bandpass";
    rainFilter.frequency.value = 1800;
    rainFilter.Q.value = 0.72;
    master.gain.value = 0;
    engineGain.gain.value = 0;
    harmonicGain.gain.value = 0;
    intakeGain.gain.value = 0;
    tireGain.gain.value = 0;
    ersGain.gain.value = 0;
    windGain.gain.value = 0;
    rainGain.gain.value = 0;

    engine.connect(engineGain).connect(master);
    harmonic.connect(harmonicGain).connect(master);
    intake.connect(intakeGain).connect(master);
    tire.connect(tireGain).connect(master);
    ers.connect(ersGain).connect(master);
    windNoise.connect(windFilter).connect(windGain).connect(master);
    rainNoise.connect(rainFilter).connect(rainGain).connect(master);
    master.connect(context.destination);
    engine.start();
    harmonic.start();
    intake.start();
    tire.start();
    ers.start();
    windNoise.start();
    rainNoise.start();

    this.context = context;
    this.master = master;
    this.engine = engine;
    this.engineGain = engineGain;
    this.harmonic = harmonic;
    this.harmonicGain = harmonicGain;
    this.intake = intake;
    this.intakeGain = intakeGain;
    this.tire = tire;
    this.tireGain = tireGain;
    this.ers = ers;
    this.ersGain = ersGain;
    this.windNoise = windNoise;
    this.windFilter = windFilter;
    this.windGain = windGain;
    this.rainNoise = rainNoise;
    this.rainFilter = rainFilter;
    this.rainGain = rainGain;
    this.unlocked = true;
    void context.resume();
  }

  private playShiftClick(now: number, upshift: boolean) {
    if (!this.context || !this.master) return;

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(upshift ? 92 : 122, now);
    oscillator.frequency.exponentialRampToValueAtTime(upshift ? 58 : 72, now + 0.09);
    gain.gain.setValueAtTime(upshift ? 0.035 : 0.026, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.13);
  }
}
