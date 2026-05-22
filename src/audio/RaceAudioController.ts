import type { RaceTelemetry } from "../game/SimcadeRaceModel";

type BrowserAudioContext = typeof AudioContext;

function getAudioContextConstructor(): BrowserAudioContext | undefined {
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: BrowserAudioContext }).webkitAudioContext;
}

export class RaceAudioController {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private tire: OscillatorNode | null = null;
  private tireGain: GainNode | null = null;
  private ers: OscillatorNode | null = null;
  private ersGain: GainNode | null = null;
  private unlocked = false;
  private readonly unlock = () => void this.ensureStarted();

  attach() {
    window.addEventListener("pointerdown", this.unlock, { passive: true });
    window.addEventListener("keydown", this.unlock);
  }

  update(telemetry: RaceTelemetry) {
    if (!this.context || !this.engine || !this.master || !this.engineGain || !this.tire || !this.tireGain || !this.ers || !this.ersGain) {
      return;
    }

    const now = this.context.currentTime;
    const racing = telemetry.phase === "racing";
    const speed = Math.min(1, telemetry.speedKph / 310);
    const rpm = telemetry.rpm / 10000;
    const slip = Math.max(telemetry.car.slip, telemetry.car.braking * 0.28);
    const ersActive = racing && telemetry.speedKph > 130 && telemetry.ers < 0.85;

    this.master.gain.setTargetAtTime(racing ? 0.42 : 0.12, now, 0.08);
    this.engine.frequency.setTargetAtTime(70 + rpm * 560 + speed * 80, now, 0.04);
    this.engineGain.gain.setTargetAtTime(racing ? 0.045 + speed * 0.075 : 0.018, now, 0.05);
    this.tire.frequency.setTargetAtTime(280 + speed * 620, now, 0.04);
    this.tireGain.gain.setTargetAtTime(racing ? slip * 0.045 : 0, now, 0.035);
    this.ers.frequency.setTargetAtTime(760 + speed * 520, now, 0.04);
    this.ersGain.gain.setTargetAtTime(ersActive ? 0.018 : 0, now, 0.05);
  }

  dispose() {
    window.removeEventListener("pointerdown", this.unlock);
    window.removeEventListener("keydown", this.unlock);
    this.engine?.stop();
    this.tire?.stop();
    this.ers?.stop();
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
    const tireGain = context.createGain();
    const ersGain = context.createGain();
    const engine = context.createOscillator();
    const tire = context.createOscillator();
    const ers = context.createOscillator();

    engine.type = "sawtooth";
    tire.type = "triangle";
    ers.type = "sine";
    master.gain.value = 0;
    engineGain.gain.value = 0;
    tireGain.gain.value = 0;
    ersGain.gain.value = 0;

    engine.connect(engineGain).connect(master);
    tire.connect(tireGain).connect(master);
    ers.connect(ersGain).connect(master);
    master.connect(context.destination);
    engine.start();
    tire.start();
    ers.start();

    this.context = context;
    this.master = master;
    this.engine = engine;
    this.engineGain = engineGain;
    this.tire = tire;
    this.tireGain = tireGain;
    this.ers = ers;
    this.ersGain = ersGain;
    this.unlocked = true;
    void context.resume();
  }
}
