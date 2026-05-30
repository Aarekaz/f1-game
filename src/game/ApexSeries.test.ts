import { describe, expect, it } from "vitest";
import { APEX_SERIES_EVENTS, evaluateApexSeriesTarget, findApexSeriesEvent, nextApexSeriesEvent, summarizeApexSeries } from "./ApexSeries";
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

  it("evaluates authored targets against the current run", () => {
    const northstar = APEX_SERIES_EVENTS[2];
    const pass = evaluateApexSeriesTarget(northstar, {
      totalTime: 190,
      bestLap: 61.2,
      flowScore: 0.58,
      position: 4,
      overtakes: 4,
      cleanLap: false,
      lapValid: true,
      penaltySeconds: 2
    });
    const fail = evaluateApexSeriesTarget(northstar, {
      totalTime: 196,
      bestLap: 64.4,
      flowScore: 0.41,
      position: 7,
      overtakes: 2,
      cleanLap: false,
      lapValid: false,
      penaltySeconds: 5
    });

    expect(pass.passed).toBe(true);
    expect(pass.summary).toBe("P5 / 48% flow / 3s max");
    expect(fail.passed).toBe(false);
    expect(fail.misses).toEqual(["finish P5 or better", "48% flow", "3s penalty max"]);
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
