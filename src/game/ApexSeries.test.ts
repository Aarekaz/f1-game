import { describe, expect, it } from "vitest";
import { APEX_SERIES_EVENTS, findApexSeriesEvent, nextApexSeriesEvent, summarizeApexSeries } from "./ApexSeries";
import { findAssist, findTrack, findWeather } from "../world/FictionalGpWorld";
import type { PersonalBest } from "./PersonalBestStore";

const apexBest: PersonalBest = {
  bestTotalTime: 181.2,
  bestLap: 58.4,
  bestFlowScore: 0.82,
  bestPosition: 2,
  bestOvertakes: 6,
  cleanFinishes: 1,
  runs: 1,
  grade: "Apex",
  updatedAt: "2026-05-29T00:00:00.000Z"
};

describe("ApexSeries", () => {
  it("keeps the fictional series open before any saved run", () => {
    const summary = summarizeApexSeries(() => null);

    expect(summary.completed).toBe(0);
    expect(summary.apexes).toBe(0);
    expect(summary.score).toBe(0);
    expect(summary.events.map((event) => event.status)).toEqual(["Open", "Open", "Open"]);
  });

  it("summarizes the authored fictional GP event ladder", () => {
    const summary = summarizeApexSeries((session) => (session.track.id === "northstar" ? apexBest : null));

    expect(summary.events).toHaveLength(3);
    expect(summary.completed).toBe(1);
    expect(summary.apexes).toBe(1);
    expect(summary.score).toBe(4);
    expect(summary.maxScore).toBe(12);
    expect(summary.events[2]).toMatchObject({
      id: "northstar-storm",
      status: "Apex / P2"
    });
  });

  it("finds the authored series event for a selected session", () => {
    expect(
      findApexSeriesEvent({
        track: findTrack("mirage"),
        weather: findWeather("dusk"),
        assist: findAssist("balanced")
      })?.id
    ).toBe("mirage-dusk");

    expect(
      findApexSeriesEvent({
        track: findTrack("mirage"),
        weather: findWeather("dusk"),
        assist: findAssist("manual")
      })
    ).toBeNull();
  });

  it("advances through the authored event order", () => {
    expect(nextApexSeriesEvent(null)?.id).toBe("aurelia-rhythm");
    expect(nextApexSeriesEvent(APEX_SERIES_EVENTS[0])?.id).toBe("mirage-dusk");
    expect(nextApexSeriesEvent(APEX_SERIES_EVENTS[1])?.id).toBe("northstar-storm");
    expect(nextApexSeriesEvent(APEX_SERIES_EVENTS[2])).toBeNull();
  });
});
