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
  private objective = requireElement("objective");
  private raceProgress = requireElement("race-progress");
  private ers = requireElement("ers");
  private grip = requireElement("grip");
  private message = requireElement("message");
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
    this.objective.textContent = telemetry.objective;
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
