import { RaceAudioController } from "../audio/RaceAudioController";
import {
  evaluateApexSeriesTarget,
  findApexSeriesEvent,
  formatApexSeriesCriteria,
  nextApexSeriesEvent,
  scorePersonalBest,
  summarizeApexSeries,
  type ApexSeriesEvent
} from "../game/ApexSeries";
import { InputState, type InputActions } from "../game/InputState";
import {
  mergePersonalBest,
  readPersonalBest,
  resultFromTelemetry,
  savePersonalBest,
  type PersonalBest
} from "../game/PersonalBestStore";
import { SimcadeRaceModel } from "../game/SimcadeRaceModel";
import { TRACK_LOOP_LENGTH, trackWorldPointAt } from "../game/trackPath";
import { ThreeRaceRenderer } from "../render/ThreeRaceRenderer";
import { HudController } from "../ui/HudController";
import { DEFAULT_SESSION, findAssist, findTrack, findWeather, type SessionConfig } from "../world/FictionalGpWorld";

type ControlName = "left" | "right" | "throttle" | "brake" | "boost" | "recover" | "camera";

const MAX_DT = 1 / 20;
const AUDIO_MUTED_KEY = "apex-formula:audio-muted";

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

function syncSessionDossier(config: SessionConfig) {
  const trackName = document.getElementById("brief-track-name");
  const difficulty = document.getElementById("brief-difficulty");
  const grip = document.getElementById("brief-grip");
  const weather = document.getElementById("brief-weather");
  const assist = document.getElementById("brief-assist");
  const path = document.getElementById("brief-track-path");
  const start = document.getElementById("brief-track-start");

  if (trackName) trackName.textContent = config.track.name;
  if (difficulty) difficulty.textContent = `${Math.round(config.track.difficulty * 100)}%`;
  if (grip) grip.textContent = `${Math.round(config.weather.gripMultiplier * 100)}%`;
  if (weather) weather.textContent = config.weather.name.replace(" Practice", "").replace(" Qualifying", "");
  if (assist) assist.textContent = config.assist.id === "balanced" ? "Balanced" : "Manual";
  if (!(path instanceof SVGPathElement)) return;

  const rawPoints = Array.from({ length: 96 }, (_, index) => trackWorldPointAt((index / 96) * TRACK_LOOP_LENGTH));
  const bounds = rawPoints.reduce(
    (next, point) => ({
      minX: Math.min(next.minX, point.x),
      maxX: Math.max(next.maxX, point.x),
      minZ: Math.min(next.minZ, point.z),
      maxZ: Math.max(next.maxZ, point.z)
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
  );
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxZ - bounds.minZ);
  const scale = Math.min(142 / width, 72 / height);
  const points = rawPoints.map((point) => ({
    x: 90 + (point.x - (bounds.minX + width / 2)) * scale,
    y: 52 + (point.z - (bounds.minZ + height / 2)) * scale
  }));

  path.setAttribute(
    "d",
    points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ") + " Z"
  );
  path.setAttribute("style", `--track-accent: ${config.track.accent}`);

  if (start instanceof SVGCircleElement) {
    const [startPoint] = points;
    start.setAttribute("cx", startPoint.x.toFixed(1));
    start.setAttribute("cy", startPoint.y.toFixed(1));
    start.setAttribute("style", `--track-accent: ${config.track.accent}`);
  }
}

function readAudioMuted() {
  try {
    return window.localStorage.getItem(AUDIO_MUTED_KEY) === "true";
  } catch {
    return false;
  }
}

function saveAudioMuted(muted: boolean) {
  try {
    window.localStorage.setItem(AUDIO_MUTED_KEY, String(muted));
  } catch {
    // The game should keep running when browser storage is unavailable.
  }
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

function syncSeriesProgress(activeSession: SessionConfig, onSelect: (event: ApexSeriesEvent) => void) {
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
    button.dataset.seriesStatus = event.targetMet ? "met" : event.best ? "attempt" : "open";
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

function syncSeriesTarget(activeSession: SessionConfig) {
  const target = document.getElementById("series-target-chip");
  const contract = document.getElementById("target-contract");
  const contractTitle = document.getElementById("target-contract-title");
  const contractGoal = document.getElementById("target-contract-goal");
  const contractCriteria = document.getElementById("target-contract-criteria");

  const event = findApexSeriesEvent(activeSession);
  if (target) {
    target.textContent = event ? `${event.round} target: ${event.target}` : "Free run";
    target.dataset.mode = event ? "series" : "free";
  }
  if (contract) contract.dataset.mode = event ? "series" : "free";
  if (contractTitle) contractTitle.textContent = event ? `${event.round} ${event.title}` : "Free Run";
  if (contractGoal) contractGoal.textContent = event ? event.target : "No series target";
  if (contractCriteria) {
    contractCriteria.textContent = event ? formatApexSeriesCriteria(event) : "Pick an Apex Series round for a scored contract.";
  }
}

function createTouchBridge() {
  const activeControls = new Set<ControlName>();
  const cleanups: Array<() => void> = [];
  let launchPulse = false;
  let recoverPulse = false;
  let cameraPulse = false;

  document.querySelectorAll<HTMLButtonElement>("[data-control]").forEach((button) => {
    const control = button.dataset.control;
    if (!isControlName(control)) return;

    const activate = (event: Event) => {
      event.preventDefault();
      activeControls.add(control);
      if (control === "throttle") launchPulse = true;
      if (control === "recover") recoverPulse = true;
      if (control === "camera") cameraPulse = true;
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
        cameraToggle: actions.cameraToggle || cameraPulse
      };
      launchPulse = false;
      recoverPulse = false;
      cameraPulse = false;
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
  return (
    value === "left" ||
    value === "right" ||
    value === "throttle" ||
    value === "brake" ||
    value === "boost" ||
    value === "recover" ||
    value === "camera"
  );
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
  const resultNextEventButton = document.getElementById("result-next-event");
  const audioToggleButton = document.getElementById("audio-toggle");
  let last = performance.now();
  let frame = 0;
  let session = readSessionConfig();
  let latestTelemetry = model.telemetry();
  let lastPhase = latestTelemetry.phase;
  let paused = false;
  let audioMuted = readAudioMuted();
  let queuedNextSeriesEvent: ApexSeriesEvent | null = null;

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

  function syncAudioToggle() {
    audio.setMuted(audioMuted);
    audioToggleButton?.setAttribute("aria-pressed", audioMuted ? "true" : "false");
    audioToggleButton?.setAttribute("aria-label", audioMuted ? "Unmute audio" : "Mute audio");
    if (audioToggleButton) audioToggleButton.textContent = audioMuted ? "OFF" : "SND";
  }

  function toggleAudioMuted() {
    audioMuted = !audioMuted;
    saveAudioMuted(audioMuted);
    syncAudioToggle();
  }

  function restartCurrentRun() {
    model.reset();
    latestTelemetry = model.telemetry();
    lastPhase = latestTelemetry.phase;
    queuedNextSeriesEvent = null;
    syncNextSeriesEventButton(null);
    hud.setPersonalBestUpdate(null);
    hud.setSeriesResult(null);
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

  function syncNextSeriesEventButton(event: ApexSeriesEvent | null) {
    resultNextEventButton?.classList.toggle("hidden", !event);
    if (resultNextEventButton) {
      resultNextEventButton.textContent = event ? `Next: ${event.round}` : "Next Event";
      resultNextEventButton.setAttribute("aria-label", event ? `Load ${event.round} ${event.title}` : "Next event");
    }
  }

  function selectSeriesEvent(event: ApexSeriesEvent) {
    setSelectValue("track-select", event.trackId);
    setSelectValue("weather-select", event.weatherId);
    setSelectValue("assist-select", event.assistId);
    refreshSession();
  }

  function selectQueuedNextSeriesEvent() {
    if (queuedNextSeriesEvent) {
      selectSeriesEvent(queuedNextSeriesEvent);
    }
  }

  const refreshSession = () => {
    session = readSessionConfig();
    const best = readPersonalBest(session);
    syncSessionBrief(session);
    syncSessionBest(best);
    syncSeriesProgress(session, selectSeriesEvent);
    syncSeriesTarget(session);
    queuedNextSeriesEvent = null;
    syncNextSeriesEventButton(null);
    hud.setPersonalBest(best);
    hud.setPersonalBestUpdate(null);
    hud.setSeriesResult(null);
    model.configure(session);
    renderer.configure(session);
    syncSessionDossier(session);
    latestTelemetry = model.telemetry();
    lastPhase = latestTelemetry.phase;
    setPaused(false);
  };

  document.getElementById("track-select")?.addEventListener("change", refreshSession);
  document.getElementById("weather-select")?.addEventListener("change", refreshSession);
  document.getElementById("assist-select")?.addEventListener("change", refreshSession);
  restartSessionButton?.addEventListener("click", restartCurrentRun);
  resultNextEventButton?.addEventListener("click", selectQueuedNextSeriesEvent);
  audioToggleButton?.addEventListener("click", toggleAudioMuted);
  refreshSession();
  input.attach();
  audio.attach();
  syncAudioToggle();

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
      const previousBest = readPersonalBest(session);
      const result = resultFromTelemetry(telemetry);
      const update = mergePersonalBest(previousBest, result);
      const seriesEvent = findApexSeriesEvent(session);
      const targetEvaluation = seriesEvent ? evaluateApexSeriesTarget(seriesEvent, result) : null;
      const previousTargetMet = previousBest?.seriesTargetMet === true;
      const targetMet = previousTargetMet || (targetEvaluation?.passed ?? false);
      const bestToSave: PersonalBest = seriesEvent
        ? {
            ...update.best,
            seriesTargetMet: targetMet,
            seriesTargetMetAt: previousBest?.seriesTargetMetAt ?? (targetEvaluation?.passed ? update.best.updatedAt : undefined)
          }
        : update.best;
      const previousSeriesScore = previousTargetMet ? scorePersonalBest(previousBest) : 0;
      const seriesScore = targetMet ? scorePersonalBest(bestToSave) : 0;
      const adjustedUpdate = { ...update, best: bestToSave };
      queuedNextSeriesEvent = seriesEvent && targetMet ? nextApexSeriesEvent(seriesEvent) : null;
      savePersonalBest(session, bestToSave);
      syncSessionBest(bestToSave);
      syncSeriesProgress(session, selectSeriesEvent);
      syncNextSeriesEventButton(queuedNextSeriesEvent);
      hud.setPersonalBest(bestToSave);
      hud.setPersonalBestUpdate(adjustedUpdate);
      hud.setSeriesResult(
        seriesEvent
          ? {
              title: `${seriesEvent.round} ${seriesEvent.title}`,
              target: seriesEvent.target,
              targetMet,
              targetDetail: targetMet ? (targetEvaluation?.summary ?? "already cleared") : (targetEvaluation?.misses[0] ?? ""),
              score: seriesScore,
              scoreDelta: Math.max(0, seriesScore - previousSeriesScore)
            }
          : null
      );
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
      resultNextEventButton?.removeEventListener("click", selectQueuedNextSeriesEvent);
      audioToggleButton?.removeEventListener("click", toggleAudioMuted);
      input.detach();
      touch.destroy();
      audio.dispose();
      renderer.dispose();
    }
  };
}
