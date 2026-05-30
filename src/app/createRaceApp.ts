import { RaceAudioController } from "../audio/RaceAudioController";
import { summarizeApexSeries, type ApexSeriesEventSummary } from "../game/ApexSeries";
import { InputState, type InputActions } from "../game/InputState";
import {
  mergePersonalBest,
  readPersonalBest,
  resultFromTelemetry,
  savePersonalBest,
  type PersonalBest
} from "../game/PersonalBestStore";
import { SimcadeRaceModel } from "../game/SimcadeRaceModel";
import { ThreeRaceRenderer } from "../render/ThreeRaceRenderer";
import { HudController } from "../ui/HudController";
import { DEFAULT_SESSION, findAssist, findTrack, findWeather, type SessionConfig } from "../world/FictionalGpWorld";

type ControlName = "left" | "right" | "throttle" | "brake" | "boost" | "recover";

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

function setSelectValue(id: string, value: string) {
  const select = document.getElementById(id) as HTMLSelectElement | null;
  if (select) select.value = value;
}

function appendTextElement<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tagName: K,
  text: string,
  className?: string
) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function syncSeriesProgress(activeSession: SessionConfig, onSelect: (event: ApexSeriesEventSummary) => void) {
  const progress = document.getElementById("series-progress");
  if (!progress) return;

  const summary = summarizeApexSeries(readPersonalBest);
  const header = document.createElement("div");
  header.className = "series-summary";
  appendTextElement(header, "span", "Apex Series");
  appendTextElement(header, "strong", `${summary.completed}/${summary.events.length}`);
  appendTextElement(header, "em", `${summary.score}/${summary.maxScore} pts`);

  const rows = summary.events.map((event) => {
    const button = document.createElement("button");
    const isActive =
      event.session.track.id === activeSession.track.id &&
      event.session.weather.id === activeSession.weather.id &&
      event.session.assist.id === activeSession.assist.id;

    button.type = "button";
    button.className = isActive ? "active" : "";
    button.dataset.seriesEvent = event.id;
    button.setAttribute("aria-current", isActive ? "true" : "false");
    appendTextElement(button, "span", event.round, "series-round");
    const eventCopy = document.createElement("span");
    eventCopy.className = "series-event-copy";
    appendTextElement(eventCopy, "strong", event.title);
    appendTextElement(eventCopy, "em", `${event.session.track.name} / ${event.session.weather.name}`);
    button.append(eventCopy);
    appendTextElement(button, "small", event.target);
    appendTextElement(button, "b", event.status);
    button.addEventListener("click", () => onSelect(event));
    return button;
  });

  progress.replaceChildren(header, ...rows);
}

function createTouchBridge() {
  const activeControls = new Set<ControlName>();
  const cleanups: Array<() => void> = [];
  let launchPulse = false;
  let recoverPulse = false;

  document.querySelectorAll<HTMLButtonElement>("[data-control]").forEach((button) => {
    const control = button.dataset.control;
    if (!isControlName(control)) return;

    const activate = (event: Event) => {
      event.preventDefault();
      activeControls.add(control);
      if (control === "throttle") launchPulse = true;
      if (control === "recover") recoverPulse = true;
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
    merge(actions: InputActions): InputActions {
      const touchSteer = (activeControls.has("right") ? 1 : 0) - (activeControls.has("left") ? 1 : 0);
      const merged = {
        ...actions,
        steer: touchSteer !== 0 ? touchSteer : actions.steer,
        throttle: activeControls.has("throttle") ? 1 : actions.throttle,
        brake: activeControls.has("brake") ? 1 : actions.brake,
        ers: actions.ers || activeControls.has("boost"),
        launch: actions.launch || launchPulse || activeControls.has("throttle"),
        recover: actions.recover || recoverPulse,
        cameraToggle: actions.cameraToggle
      };
      launchPulse = false;
      recoverPulse = false;
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
  return value === "left" || value === "right" || value === "throttle" || value === "brake" || value === "boost" || value === "recover";
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
  const hudRoot = document.querySelector<HTMLElement>(".hud");
  const pausePanel = document.getElementById("pause-panel");
  const pauseButton = document.getElementById("pause-race");
  const pausePosition = document.getElementById("pause-position");
  const pauseLap = document.getElementById("pause-lap");
  const pauseSection = document.getElementById("pause-section");
  const restartSessionButton = document.getElementById("restart-session");
  let last = performance.now();
  let frame = 0;
  let session = readSessionConfig();
  let latestTelemetry = model.telemetry();
  let lastPhase = latestTelemetry.phase;
  let paused = false;

  function syncPauseSummary() {
    if (pausePosition) pausePosition.textContent = `P${latestTelemetry.position}`;
    if (pauseLap) pauseLap.textContent = `${latestTelemetry.lap}/${latestTelemetry.laps}`;
    if (pauseSection) pauseSection.textContent = latestTelemetry.trackSection;
  }

  function setPaused(nextPaused: boolean) {
    paused = nextPaused;
    if (hudRoot) {
      hudRoot.dataset.paused = paused ? "true" : "false";
    }
    if (paused) syncPauseSummary();
    pausePanel?.classList.toggle("hidden", !paused);
    pauseButton?.setAttribute("aria-pressed", paused ? "true" : "false");
  }

  function restartCurrentRun() {
    model.reset();
    latestTelemetry = model.telemetry();
    lastPhase = latestTelemetry.phase;
    hud.setPersonalBestUpdate(null);
    setPaused(false);
    renderer.update(latestTelemetry);
    hud.update(latestTelemetry);
    audio.update(pausedAudioTelemetry(latestTelemetry));
  }

  function pausedAudioTelemetry(telemetry: typeof latestTelemetry) {
    return {
      ...telemetry,
      phase: "ready" as const,
      speedKph: 0,
      car: {
        ...telemetry.car,
        braking: 0,
        throttle: 0,
        wheelspin: 0,
        understeer: 0,
        lockup: 0
      }
    };
  }

  function selectSeriesEvent(event: ApexSeriesEventSummary) {
    setSelectValue("track-select", event.trackId);
    setSelectValue("weather-select", event.weatherId);
    setSelectValue("assist-select", event.assistId);
    refreshSession();
  }

  const refreshSession = () => {
    session = readSessionConfig();
    const best = readPersonalBest(session);
    syncSessionBrief(session);
    syncSessionBest(best);
    syncSeriesProgress(session, selectSeriesEvent);
    hud.setPersonalBest(best);
    hud.setPersonalBestUpdate(null);
    model.configure(session);
    renderer.configure(session);
    latestTelemetry = model.telemetry();
    lastPhase = latestTelemetry.phase;
    setPaused(false);
  };

  document.getElementById("track-select")?.addEventListener("change", refreshSession);
  document.getElementById("weather-select")?.addEventListener("change", refreshSession);
  document.getElementById("assist-select")?.addEventListener("change", refreshSession);
  restartSessionButton?.addEventListener("click", restartCurrentRun);
  refreshSession();
  input.attach();
  audio.attach();

  function tick(now: number) {
    const dt = Math.min(MAX_DT, (now - last) / 1000);
    last = now;

    const actions = touch.merge(input.update(dt));
    if (actions.cameraToggle) {
      renderer.toggleCameraMode();
    }
    if (actions.pauseToggle && (latestTelemetry.phase === "countdown" || latestTelemetry.phase === "racing")) {
      setPaused(!paused);
    }

    if (paused) {
      audio.update(pausedAudioTelemetry(latestTelemetry));
      frame = requestAnimationFrame(tick);
      return;
    }

    const telemetry = model.update(dt, actions);
    latestTelemetry = telemetry;
    if (telemetry.phase === "finished") {
      setPaused(false);
    }
    if (telemetry.phase === "finished" && lastPhase !== "finished") {
      const update = mergePersonalBest(readPersonalBest(session), resultFromTelemetry(telemetry));
      savePersonalBest(session, update.best);
      syncSessionBest(update.best);
      syncSeriesProgress(session, selectSeriesEvent);
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
      restartSessionButton?.removeEventListener("click", restartCurrentRun);
      input.detach();
      touch.destroy();
      audio.dispose();
      renderer.dispose();
    }
  };
}
