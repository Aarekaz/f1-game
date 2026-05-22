import type { RaceTelemetry } from "../game/SimcadeRaceModel";

function requireElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing HUD element #${id}`);
  return element as T;
}

function optionalElement<T extends HTMLElement = HTMLElement>(id: string): T | null {
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
  private sectionName = optionalElement("section-name");
  private sectionMeta = optionalElement("section-meta");
  private trackCue = optionalElement("track-cue");
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

  update(telemetry: RaceTelemetry) {
    this.startPanel.classList.toggle("hidden", telemetry.phase !== "ready");
    this.resultsPanel.classList.toggle("hidden", telemetry.phase !== "finished");

    this.position.textContent = String(telemetry.position).padStart(2, "0");
    this.lap.textContent = `${telemetry.lap}/${telemetry.laps}`;
    this.best.textContent = formatTime(telemetry.bestLap);
    this.delta.textContent = telemetry.bestLap === null ? "+0.00" : formatDelta(telemetry.delta);
    this.speed.textContent = String(telemetry.speedKph);
    this.updatePowertrain(telemetry);
    this.objective.textContent = telemetry.objective;
    this.updateTrackReadout(telemetry);
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
      this.streak.textContent =
        telemetry.overtakeStreak > 0 ? `${telemetry.overtakeStreak} overtakes banked` : "Clean air";
    }

    this.updateMessage(telemetry);
    this.updateResults(telemetry);
  }

  private updatePowertrain(telemetry: RaceTelemetry) {
    if (this.gear) {
      this.gear.textContent = String(telemetry.gear);
    }

    if (this.rpm) {
      setMeter(this.rpm, telemetry.rpm / 10000);
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
      this.trackCue.textContent = telemetry.trackCue;
      this.trackCue.classList.toggle("brake", telemetry.brakingZone);
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
      this.messageBody.textContent = showCountdown ? Math.ceil(telemetry.countdown).toString() : telemetry.message || " ";
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
      telemetry.position <= telemetry.targetPosition ? "Podium Target Hit" : `Finished P${telemetry.position}`;
    this.resultTotal.textContent = formatTime(telemetry.totalTime);
    this.resultBest.textContent = formatTime(telemetry.bestLap);

    if (this.resultOvertakes) {
      this.resultOvertakes.textContent = String(telemetry.overtakeStreak);
    }
  }
}
