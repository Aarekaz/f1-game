import type { RaceTelemetry } from "../game/SimcadeRaceModel";
import { trackCenterAt, TRACK_LOOP_LENGTH, wrapDistance } from "../game/trackPath";

function requireElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing HUD element #${id}`);
  return element as T;
}

function optionalElement<T extends Element = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function formatTime(seconds: number | null) {
  if (seconds === null) return "--.--";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return minutes > 0 ? `${minutes}:${rest.toFixed(2).padStart(5, "0")}` : rest.toFixed(2);
}

function formatDelta(seconds: number | null) {
  if (seconds === null) return "--.--";
  return `${seconds >= 0 ? "+" : ""}${seconds.toFixed(2)}`;
}

function setMeter(element: HTMLElement, value: number) {
  const percent = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
  element.style.setProperty("--value", percent);
}

export class HudController {
  private hud = document.querySelector<HTMLElement>(".hud");
  private startPanel = requireElement("start-panel");
  private resultsPanel = requireElement("results-panel");
  private position = requireElement("position");
  private lap = requireElement("lap");
  private best = requireElement("best");
  private delta = requireElement("delta");
  private speed = requireElement("speed");
  private gear = optionalElement("gear");
  private rpm = optionalElement("rpm");
  private objective = requireElement("objective");
  private sessionTrack = optionalElement("session-track");
  private sessionWeather = optionalElement("session-weather");
  private sectionName = optionalElement("section-name");
  private sectionMeta = optionalElement("section-meta");
  private trackCue = optionalElement("track-cue");
  private trackInstruction = optionalElement("track-instruction");
  private paceTarget = optionalElement("pace-target");
  private checkpoint = optionalElement("checkpoint");
  private penalty = optionalElement("penalty");
  private mapPath = optionalElement<SVGPathElement>("track-map-path");
  private mapCar = optionalElement<SVGCircleElement>("map-car");
  private raceProgress = requireElement("race-progress");
  private ers = requireElement("ers");
  private grip = requireElement("grip");
  private message = requireElement("message");
  private startLights = optionalElement("start-lights");
  private messageTitle = this.message.querySelector("strong");
  private messageBody = this.message.querySelector("span");
  private currentLapTime = requireElement("current-lap-time");
  private splitDelta = optionalElement("split-delta");
  private streak = optionalElement("streak");
  private resultTitle = requireElement("result-title");
  private resultTotal = requireElement("result-total");
  private resultBest = requireElement("result-best");
  private resultOvertakes = optionalElement("result-overtakes");
  private renderedTrackName = "";

  constructor() {
    this.buildMiniMap();
  }

  update(telemetry: RaceTelemetry) {
    if (this.hud) {
      this.hud.dataset.phase = telemetry.phase;
    }

    if (this.renderedTrackName !== telemetry.trackName) {
      this.renderedTrackName = telemetry.trackName;
      this.buildMiniMap();
    }

    this.startPanel.classList.toggle("hidden", telemetry.phase !== "ready");
    this.resultsPanel.classList.toggle("hidden", telemetry.phase !== "finished");

    this.position.textContent = String(telemetry.position).padStart(2, "0");
    this.lap.textContent = `${telemetry.lap}/${telemetry.laps}`;
    this.best.textContent = formatTime(telemetry.bestLap);
    this.delta.textContent = telemetry.bestLap === null ? "+0.00" : formatDelta(telemetry.delta);
    this.speed.textContent = String(telemetry.speedKph);
    this.updatePowertrain(telemetry);
    this.objective.textContent =
      telemetry.phase === "countdown" ? `Launch ${(telemetry.launchCharge * 100).toFixed(0)}%` : telemetry.objective;
    this.updateSessionReadout(telemetry);
    this.updateTrackReadout(telemetry);
    this.updateMiniMap(telemetry);
    setMeter(this.raceProgress, telemetry.raceProgress);
    setMeter(this.ers, telemetry.ers);
    setMeter(this.grip, telemetry.grip);
    this.currentLapTime.textContent = formatTime(telemetry.lapTime);

    if (this.splitDelta) {
      this.splitDelta.textContent = formatDelta(telemetry.splitDelta);
      this.splitDelta.classList.toggle("positive", (telemetry.splitDelta ?? 0) > 0);
      this.splitDelta.classList.toggle("negative", (telemetry.splitDelta ?? 0) < 0);
    }

    if (this.streak) {
      this.streak.textContent = this.racecraftText(telemetry);
    }

    this.updateMessage(telemetry);
    this.updateResults(telemetry);
  }

  private buildMiniMap() {
    if (!this.mapPath) return;

    const points = this.mapPoints();
    this.mapPath.setAttribute(
      "d",
      points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ") +
        " Z"
    );
  }

  private updateMiniMap(telemetry: RaceTelemetry) {
    if (!this.mapCar) return;

    const point = this.mapPointAt(telemetry.trackOffset);
    this.mapCar.setAttribute("cx", point.x.toFixed(1));
    this.mapCar.setAttribute("cy", point.y.toFixed(1));
  }

  private mapPoints() {
    return Array.from({ length: 96 }, (_, index) => this.mapPointAt((index / 96) * TRACK_LOOP_LENGTH));
  }

  private mapPointAt(distance: number) {
    const progress = wrapDistance(distance) / TRACK_LOOP_LENGTH;
    const x = 90 + trackCenterAt(distance) * 2.4;
    const y = 10 + progress * 96;
    return { x, y };
  }

  private updatePowertrain(telemetry: RaceTelemetry) {
    if (this.gear) {
      this.gear.textContent = String(telemetry.gear);
    }

    if (this.rpm) {
      setMeter(this.rpm, telemetry.rpm / 10000);
    }
  }

  private racecraftText(telemetry: RaceTelemetry) {
    if (telemetry.contactRisk > 0.54) return `Contact risk ${(telemetry.contactRisk * 100).toFixed(0)}%`;
    if (telemetry.sideBySide > 0.22) return `Wheel to wheel ${(telemetry.sideBySide * 100).toFixed(0)}%`;
    if (telemetry.rivalProximity > 0.18) return `Rival close ${(telemetry.rivalProximity * 100).toFixed(0)}%`;
    if (telemetry.overtakeStreak > 0) return `${telemetry.overtakeStreak} overtakes banked`;
    if (telemetry.airState === "Slipstream") return `Slipstream ${(telemetry.draft * 100).toFixed(0)}%`;
    if (telemetry.airState === "Dirty air") return `Dirty air ${(telemetry.dirtyAir * 100).toFixed(0)}%`;
    return "Clean air";
  }

  private updateSessionReadout(telemetry: RaceTelemetry) {
    if (this.sessionTrack) {
      this.sessionTrack.textContent = telemetry.trackName;
    }

    if (this.sessionWeather) {
      this.sessionWeather.textContent = telemetry.weatherName;
    }
  }

  private updateTrackReadout(telemetry: RaceTelemetry) {
    if (this.sectionName) {
      this.sectionName.textContent = telemetry.trackSection;
    }

    if (this.sectionMeta) {
      this.sectionMeta.textContent = `S${telemetry.trackSector} / ${Math.round(telemetry.lapProgress * 100)}%`;
    }

    if (this.trackCue) {
      this.trackCue.textContent =
        telemetry.phase === "countdown"
          ? telemetry.launchQuality > 0.78
            ? "Launch sweet spot"
            : telemetry.launchCharge > 0.82
              ? "Ease throttle"
              : "Build revs"
          : telemetry.trackCue;
      this.trackCue.classList.toggle("brake", telemetry.brakingZone || (telemetry.phase === "countdown" && telemetry.launchCharge > 0.82));
    }

    if (this.trackInstruction) {
      this.trackInstruction.textContent =
        telemetry.phase === "countdown" ? "Hold near the sweet spot for a cleaner getaway" : telemetry.trackInstruction;
    }

    if (this.paceTarget) {
      const signedDelta = telemetry.paceDeltaKph > 0 ? `+${telemetry.paceDeltaKph}` : String(telemetry.paceDeltaKph);
      this.paceTarget.textContent =
        telemetry.phase === "countdown"
          ? `LAUNCH / ${(telemetry.launchQuality * 100).toFixed(0)}% quality`
          : `${telemetry.cornerPhase.toUpperCase()} / ${telemetry.targetSpeedKph} kph / ${signedDelta}`;
      this.paceTarget.classList.toggle("too-hot", telemetry.phase === "countdown" ? telemetry.launchCharge > 0.82 : telemetry.paceDeltaKph > 22);
    }

    if (this.checkpoint) {
      this.checkpoint.textContent = `${telemetry.checkpointProgress} ${telemetry.nextCheckpoint}`;
    }

    if (this.penalty) {
      this.penalty.textContent = telemetry.penaltySeconds > 0 ? `+${telemetry.penaltySeconds}s` : telemetry.lapValid ? "Clear" : "Invalid";
      this.penalty.classList.toggle("positive", telemetry.penaltySeconds > 0 || !telemetry.lapValid);
    }
  }

  private updateMessage(telemetry: RaceTelemetry) {
    const showCountdown = telemetry.phase === "countdown";
    const showMessage = telemetry.message.length > 0 && telemetry.phase !== "ready" && telemetry.phase !== "finished";
    this.message.classList.toggle("hidden", !showCountdown && !showMessage);

    if (this.messageTitle) {
      this.messageTitle.textContent = showCountdown ? "Formation ready" : "Apex Formula";
    }

    if (this.messageBody) {
      this.messageBody.textContent = showCountdown
        ? `${Math.ceil(telemetry.countdown)} | launch ${(telemetry.launchCharge * 100).toFixed(0)}%`
        : telemetry.message || " ";
    }

    this.updateStartLights(telemetry);
  }

  private updateStartLights(telemetry: RaceTelemetry) {
    if (!this.startLights) return;

    const lights = Array.from(this.startLights.querySelectorAll("i"));
    const litCount =
      telemetry.phase === "countdown" ? Math.max(1, Math.min(5, 5 - Math.floor(telemetry.countdown / 0.56))) : 0;

    this.startLights.classList.toggle("go", telemetry.phase === "racing" && telemetry.message === "Lights out");
    lights.forEach((light, index) => {
      light.classList.toggle("lit", index < litCount);
    });
  }

  private updateResults(telemetry: RaceTelemetry) {
    if (telemetry.phase !== "finished") return;

    this.resultTitle.textContent =
      telemetry.position <= telemetry.targetPosition
        ? telemetry.cleanLap
          ? "Clean Podium Run"
          : "Podium With Warnings"
        : `Finished P${telemetry.position}`;
    this.resultTotal.textContent = formatTime(telemetry.totalTime);
    this.resultBest.textContent = formatTime(telemetry.bestLap);

    if (this.resultOvertakes) {
      this.resultOvertakes.textContent = String(telemetry.overtakeStreak);
    }
  }
}
