import { findAssist, findTrack, findWeather, type FictionalAssistId, type FictionalTrackId, type FictionalWeatherId, type SessionConfig } from "../world/FictionalGpWorld";
import type { PersonalBest, SessionResult } from "./PersonalBestStore";

export type ApexSeriesTargetCriteria = {
  maxPosition: number;
  minFlowScore: number;
  cleanLapRequired: boolean;
  maxPenaltySeconds: number;
};

export type ApexSeriesEvent = {
  id: string;
  round: string;
  title: string;
  trackId: FictionalTrackId;
  weatherId: FictionalWeatherId;
  assistId: FictionalAssistId;
  target: string;
  criteria: ApexSeriesTargetCriteria;
};

export type ApexSeriesEventSummary = ApexSeriesEvent & {
  session: SessionConfig;
  best: PersonalBest | null;
  targetMet: boolean;
  score: number;
  status: string;
};

export const APEX_SERIES_EVENTS: ApexSeriesEvent[] = [
  {
    id: "aurelia-rhythm",
    round: "R1",
    title: "Rhythm Run",
    trackId: "aurelia",
    weatherId: "clear",
    assistId: "balanced",
    target: "Clean podium flow",
    criteria: {
      maxPosition: 3,
      minFlowScore: 0.76,
      cleanLapRequired: true,
      maxPenaltySeconds: 0
    }
  },
  {
    id: "mirage-dusk",
    round: "R2",
    title: "Dusk Street Fight",
    trackId: "mirage",
    weatherId: "dusk",
    assistId: "balanced",
    target: "Hold the walls",
    criteria: {
      maxPosition: 5,
      minFlowScore: 0.56,
      cleanLapRequired: true,
      maxPenaltySeconds: 0
    }
  },
  {
    id: "northstar-storm",
    round: "R3",
    title: "Storm Charge",
    trackId: "northstar",
    weatherId: "storm",
    assistId: "balanced",
    target: "Survive low grip",
    criteria: {
      maxPosition: 5,
      minFlowScore: 0.48,
      cleanLapRequired: false,
      maxPenaltySeconds: 3
    }
  }
];

export function sessionForSeriesEvent(event: ApexSeriesEvent): SessionConfig {
  return {
    track: findTrack(event.trackId),
    weather: findWeather(event.weatherId),
    assist: findAssist(event.assistId)
  };
}

export function findApexSeriesEvent(session: SessionConfig) {
  return (
    APEX_SERIES_EVENTS.find(
      (event) => event.trackId === session.track.id && event.weatherId === session.weather.id && event.assistId === session.assist.id
    ) ?? null
  );
}

export function nextApexSeriesEvent(current: ApexSeriesEvent | null) {
  if (!current) return APEX_SERIES_EVENTS[0] ?? null;

  const index = APEX_SERIES_EVENTS.findIndex((event) => event.id === current.id);
  if (index < 0) return APEX_SERIES_EVENTS[0] ?? null;
  return APEX_SERIES_EVENTS[index + 1] ?? null;
}

export function scorePersonalBest(best: PersonalBest | null) {
  if (!best) return 0;
  if (best.grade === "Apex") return 4;
  if (best.grade === "Podium") return 3;
  if (best.grade === "Points" || best.grade === "Clean") return 2;
  return 1;
}

export function evaluateApexSeriesTarget(event: ApexSeriesEvent, result: SessionResult) {
  const misses: string[] = [];
  const criteria = event.criteria;

  if (result.position > criteria.maxPosition) {
    misses.push(`finish P${criteria.maxPosition} or better`);
  }
  if (result.flowScore < criteria.minFlowScore) {
    misses.push(`${Math.round(criteria.minFlowScore * 100)}% flow`);
  }
  if (criteria.cleanLapRequired && (!result.cleanLap || !result.lapValid)) {
    misses.push("clean valid run");
  }
  if (result.penaltySeconds > criteria.maxPenaltySeconds) {
    misses.push(`${criteria.maxPenaltySeconds}s penalty max`);
  }

  return {
    passed: misses.length === 0,
    summary: `P${criteria.maxPosition} / ${Math.round(criteria.minFlowScore * 100)}% flow / ${criteria.maxPenaltySeconds}s max`,
    misses
  };
}

export function summarizeApexSeries(readBest: (session: SessionConfig) => PersonalBest | null) {
  const events = APEX_SERIES_EVENTS.map((event): ApexSeriesEventSummary => {
    const session = sessionForSeriesEvent(event);
    const best = readBest(session);
    const targetMet = best?.seriesTargetMet === true;
    const score = targetMet ? scorePersonalBest(best) : 0;
    return {
      ...event,
      session,
      best,
      targetMet,
      score,
      status: targetMet ? `Target met / ${best.grade}` : best ? `Best ${best.grade} / P${best.bestPosition}` : "Open"
    };
  });

  return {
    events,
    completed: events.filter((event) => event.targetMet).length,
    apexes: events.filter((event) => event.targetMet && event.best?.grade === "Apex").length,
    score: events.reduce((total, event) => total + event.score, 0),
    maxScore: events.length * 4
  };
}
