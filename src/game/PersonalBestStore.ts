import type { RaceTelemetry } from "./SimcadeRaceModel";
import type { SessionConfig } from "../world/FictionalGpWorld";

const STORAGE_PREFIX = "apex-formula:pb:";

export type SessionResult = {
  totalTime: number;
  bestLap: number | null;
  flowScore: number;
  position: number;
  overtakes: number;
  cleanLap: boolean;
};

export type PersonalBest = {
  bestTotalTime: number | null;
  bestLap: number | null;
  bestFlowScore: number;
  bestPosition: number;
  bestOvertakes: number;
  cleanFinishes: number;
  runs: number;
  grade: string;
  updatedAt: string;
};

export type PersonalBestUpdate = {
  best: PersonalBest;
  grade: string;
  isNewTotalBest: boolean;
  isNewLapBest: boolean;
  isNewFlowBest: boolean;
};

export function sessionKey(session: SessionConfig) {
  return `${STORAGE_PREFIX}${session.track.id}:${session.weather.id}:${session.assist.id}`;
}

export function resultFromTelemetry(telemetry: RaceTelemetry): SessionResult {
  return {
    totalTime: telemetry.totalTime,
    bestLap: telemetry.bestLap,
    flowScore: telemetry.flowScore,
    position: telemetry.position,
    overtakes: telemetry.overtakeStreak,
    cleanLap: telemetry.cleanLap
  };
}

export function gradeResult(result: SessionResult) {
  if (!result.cleanLap) return "Scrappy";
  if (result.position <= 3 && result.flowScore >= 0.76) return "Apex";
  if (result.position <= 3 && result.flowScore >= 0.62) return "Podium";
  if (result.position <= 5 && result.flowScore >= 0.48) return "Points";
  if (result.cleanLap) return "Clean";
  return "Scrappy";
}

export function resultHeadline(result: SessionResult) {
  if (result.position > 3) return `Finished P${result.position}`;
  if (!result.cleanLap) return "Podium With Warnings";
  if (result.flowScore >= 0.76) return "Apex Podium Run";
  if (result.flowScore >= 0.62) return "Clean Podium Run";
  return "Podium, Rhythm Needed";
}

export function mergePersonalBest(previous: PersonalBest | null, result: SessionResult, now = new Date()) {
  const grade = gradeResult(result);
  const isNewTotalBest = previous?.bestTotalTime == null || result.totalTime < previous.bestTotalTime;
  const isNewLapBest = result.bestLap !== null && (previous?.bestLap == null || result.bestLap < previous.bestLap);
  const isNewFlowBest = previous == null || result.flowScore > previous.bestFlowScore;
  const best: PersonalBest = {
    bestTotalTime: isNewTotalBest ? result.totalTime : (previous?.bestTotalTime ?? result.totalTime),
    bestLap: isNewLapBest ? result.bestLap : (previous?.bestLap ?? result.bestLap),
    bestFlowScore: isNewFlowBest ? result.flowScore : (previous?.bestFlowScore ?? result.flowScore),
    bestPosition: previous == null ? result.position : Math.min(previous.bestPosition, result.position),
    bestOvertakes: previous == null ? result.overtakes : Math.max(previous.bestOvertakes, result.overtakes),
    cleanFinishes: (previous?.cleanFinishes ?? 0) + (result.cleanLap ? 1 : 0),
    runs: (previous?.runs ?? 0) + 1,
    grade,
    updatedAt: now.toISOString()
  };

  return { best, grade, isNewTotalBest, isNewLapBest, isNewFlowBest };
}

export function readPersonalBest(session: SessionConfig): PersonalBest | null {
  try {
    const stored = window.localStorage.getItem(sessionKey(session));
    return stored ? (JSON.parse(stored) as PersonalBest) : null;
  } catch {
    return null;
  }
}

export function savePersonalBest(session: SessionConfig, best: PersonalBest) {
  try {
    window.localStorage.setItem(sessionKey(session), JSON.stringify(best));
  } catch {
    // Browsers can block storage. The game remains playable without persistence.
  }
}
