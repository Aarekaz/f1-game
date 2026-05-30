import { findAssist, findTrack, findWeather, type FictionalAssistId, type FictionalTrackId, type FictionalWeatherId, type SessionConfig } from "../world/FictionalGpWorld";
import type { PersonalBest } from "./PersonalBestStore";

export type ApexSeriesEvent = {
  id: string;
  round: string;
  title: string;
  trackId: FictionalTrackId;
  weatherId: FictionalWeatherId;
  assistId: FictionalAssistId;
  target: string;
};

export type ApexSeriesEventSummary = ApexSeriesEvent & {
  session: SessionConfig;
  best: PersonalBest | null;
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
    target: "Clean podium flow"
  },
  {
    id: "mirage-dusk",
    round: "R2",
    title: "Dusk Street Fight",
    trackId: "mirage",
    weatherId: "dusk",
    assistId: "balanced",
    target: "Hold the walls"
  },
  {
    id: "northstar-storm",
    round: "R3",
    title: "Storm Charge",
    trackId: "northstar",
    weatherId: "storm",
    assistId: "balanced",
    target: "Survive low grip"
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

export function summarizeApexSeries(readBest: (session: SessionConfig) => PersonalBest | null) {
  const events = APEX_SERIES_EVENTS.map((event): ApexSeriesEventSummary => {
    const session = sessionForSeriesEvent(event);
    const best = readBest(session);
    const score = scorePersonalBest(best);
    return {
      ...event,
      session,
      best,
      score,
      status: best ? `${best.grade} / P${best.bestPosition}` : "Open"
    };
  });

  return {
    events,
    completed: events.filter((event) => event.best).length,
    apexes: events.filter((event) => event.best?.grade === "Apex").length,
    score: events.reduce((total, event) => total + event.score, 0),
    maxScore: events.length * 4
  };
}
