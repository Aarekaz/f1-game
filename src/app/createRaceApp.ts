import { RaceAudioController } from "../audio/RaceAudioController";
import { InputState } from "../game/InputState";
import {
  mergePersonalBest,
  readPersonalBest,
  resultFromTelemetry,
  savePersonalBest,
  type PersonalBest
} from "../game/PersonalBestStore";
import { SimcadeRaceModel, type RaceActions } from "../game/SimcadeRaceModel";
import { ThreeRaceRenderer } from "../render/ThreeRaceRenderer";
import { HudController } from "../ui/HudController";
import { DEFAULT_SESSION, findAssist, findTrack, findWeather, type SessionConfig } from "../world/FictionalGpWorld";

type ControlName = "left" | "right" | "throttle" | "brake" | "boost";

const MAX_DT = 1 / 20;

function readSessionConfig(): SessionConfig {
  const trackSelect = document.getElementById("track-select") as HTMLSelectElement | null;
  const weatherSelect = document.getElementById("weather-select") as HTMLSelectElement | null;
  const assistSelect = document.getElementById("assist-select") as HTMLSelectElement | null;
  return {
    track: findTrack(trackSelect?.value),
    weather: findWeather(weatherSelect?.value),
    assist: findAssist(assistSelect?.value)
  };
}

function syncSessionBrief(config: SessionConfig) {
  const brief = document.getElementById("session-brief");
  if (brief) {
    brief.textContent = `${config.track.region}. ${config.weather.mood}. ${config.track.character}. ${config.assist.description}.`;
  }
}

function formatTime(seconds: number | null) {
  if (seconds === null) return "--.--";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return minutes > 0 ? `${minutes}:${rest.toFixed(2).padStart(5, "0")}` : rest.toFixed(2);
}

function syncSessionBest(best: PersonalBest | null) {
  const bestReadout = document.getElementById("session-best");
  if (!bestReadout) return;

  bestReadout.textContent = best
    ? `Best ${formatTime(best.bestTotalTime)} / lap ${formatTime(best.bestLap)} / ${Math.round(best.bestFlowScore * 100)}% flow`
    : "No personal best yet.";
}

function createTouchBridge() {
  const activeControls = new Set<ControlName>();
  const cleanups: Array<() => void> = [];
  let launchPulse = false;

  document.querySelectorAll<HTMLButtonElement>("[data-control]").forEach((button) => {
    const control = button.dataset.control;
    if (!isControlName(control)) return;

    const activate = (event: Event) => {
      event.preventDefault();
      activeControls.add(control);
      if (control === "throttle") launchPulse = true;
    };
    const deactivate = (event: Event) => {
      event.preventDefault();
      activeControls.delete(control);
    };

    button.addEventListener("pointerdown", activate);
    button.addEventListener("pointerup", deactivate);
    button.addEventListener("pointercancel", deactivate);
    button.addEventListener("pointerleave", deactivate);

    cleanups.push(() => {
      button.removeEventListener("pointerdown", activate);
      button.removeEventListener("pointerup", deactivate);
      button.removeEventListener("pointercancel", deactivate);
      button.removeEventListener("pointerleave", deactivate);
    });
  });

  return {
    merge(actions: RaceActions): RaceActions {
      const touchSteer = (activeControls.has("right") ? 1 : 0) - (activeControls.has("left") ? 1 : 0);
      const merged = {
        ...actions,
        steer: touchSteer !== 0 ? touchSteer : actions.steer,
        throttle: activeControls.has("throttle") ? 1 : actions.throttle,
        brake: activeControls.has("brake") ? 1 : actions.brake,
        ers: actions.ers || activeControls.has("boost"),
        launch: actions.launch || launchPulse || activeControls.has("throttle")
      };
      launchPulse = false;
      return merged;
    },
    destroy() {
      for (const cleanup of cleanups) cleanup();
      cleanups.length = 0;
      activeControls.clear();
    }
  };
}

function isControlName(value: string | undefined): value is ControlName {
  return value === "left" || value === "right" || value === "throttle" || value === "brake" || value === "boost";
}

export function createRaceApp() {
  const container = document.getElementById("game");
  if (!container) throw new Error("Missing #game container");

  const input = new InputState();
  const touch = createTouchBridge();
  const model = new SimcadeRaceModel(DEFAULT_SESSION);
  const renderer = new ThreeRaceRenderer(container);
  const hud = new HudController();
  const audio = new RaceAudioController();
  let last = performance.now();
  let frame = 0;
  let session = readSessionConfig();
  let lastPhase = model.telemetry().phase;

  const refreshSession = () => {
    session = readSessionConfig();
    const best = readPersonalBest(session);
    syncSessionBrief(session);
    syncSessionBest(best);
    hud.setPersonalBest(best);
    hud.setPersonalBestUpdate(null);
    model.configure(session);
    renderer.configure(session);
    lastPhase = model.telemetry().phase;
  };

  document.getElementById("track-select")?.addEventListener("change", refreshSession);
  document.getElementById("weather-select")?.addEventListener("change", refreshSession);
  document.getElementById("assist-select")?.addEventListener("change", refreshSession);
  refreshSession();
  input.attach();
  audio.attach();

  function tick(now: number) {
    const dt = Math.min(MAX_DT, (now - last) / 1000);
    last = now;

    const actions = touch.merge(input.update(dt));
    const telemetry = model.update(dt, actions);
    if (telemetry.phase === "finished" && lastPhase !== "finished") {
      const update = mergePersonalBest(readPersonalBest(session), resultFromTelemetry(telemetry));
      savePersonalBest(session, update.best);
      syncSessionBest(update.best);
      hud.setPersonalBest(update.best);
      hud.setPersonalBestUpdate(update);
    }

    renderer.update(telemetry);
    hud.update(telemetry);
    audio.update(telemetry);
    lastPhase = telemetry.phase;
    frame = requestAnimationFrame(tick);
  }

  function resize() {
    renderer.resize();
  }

  window.addEventListener("resize", resize);
  resize();
  frame = requestAnimationFrame(tick);

  return {
    destroy() {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.getElementById("track-select")?.removeEventListener("change", refreshSession);
      document.getElementById("weather-select")?.removeEventListener("change", refreshSession);
      document.getElementById("assist-select")?.removeEventListener("change", refreshSession);
      input.detach();
      touch.destroy();
      audio.dispose();
      renderer.dispose();
    }
  };
}
