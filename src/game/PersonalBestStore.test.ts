import { describe, expect, it } from "vitest";
import { findAssist, findTrack, findWeather } from "../world/FictionalGpWorld";
import { gradeResult, mergePersonalBest, resultHeadline, sessionKey, type SessionResult } from "./PersonalBestStore";

const cleanPodium: SessionResult = {
  totalTime: 182.4,
  bestLap: 59.8,
  flowScore: 0.79,
  position: 3,
  overtakes: 5,
  cleanLap: true
};

describe("PersonalBestStore", () => {
  it("grades runs by position, cleanliness, and flow", () => {
    expect(gradeResult(cleanPodium)).toBe("Apex");
    expect(gradeResult({ ...cleanPodium, flowScore: 0.65 })).toBe("Podium");
    expect(gradeResult({ ...cleanPodium, position: 5, flowScore: 0.5 })).toBe("Points");
    expect(gradeResult({ ...cleanPodium, position: 7, flowScore: 0.42 })).toBe("Clean");
    expect(gradeResult({ ...cleanPodium, cleanLap: false })).toBe("Scrappy");
  });

  it("labels podium results honestly when the driving rhythm was rough", () => {
    expect(resultHeadline({ ...cleanPodium, flowScore: 0.8 })).toBe("Apex Podium Run");
    expect(resultHeadline({ ...cleanPodium, flowScore: 0.66 })).toBe("Clean Podium Run");
    expect(resultHeadline({ ...cleanPodium, flowScore: 0.22 })).toBe("Podium, Rhythm Needed");
    expect(resultHeadline({ ...cleanPodium, cleanLap: false })).toBe("Podium With Warnings");
    expect(resultHeadline({ ...cleanPodium, position: 6, flowScore: 0.5 })).toBe("Finished P6");
  });

  it("merges new personal bests without losing stronger older marks", () => {
    const first = mergePersonalBest(null, cleanPodium, new Date("2026-05-29T10:00:00Z"));
    const second = mergePersonalBest(
      first.best,
      {
        totalTime: 188,
        bestLap: 58.9,
        flowScore: 0.72,
        position: 2,
        overtakes: 6,
        cleanLap: false
      },
      new Date("2026-05-29T10:05:00Z")
    );

    expect(first.isNewTotalBest).toBe(true);
    expect(second.best.bestTotalTime).toBe(cleanPodium.totalTime);
    expect(second.best.bestLap).toBe(58.9);
    expect(second.best.bestFlowScore).toBe(cleanPodium.flowScore);
    expect(second.best.bestPosition).toBe(2);
    expect(second.best.bestOvertakes).toBe(6);
    expect(second.best.runs).toBe(2);
    expect(second.best.cleanFinishes).toBe(1);
    expect(second.isNewLapBest).toBe(true);
    expect(second.isNewFlowBest).toBe(false);
  });

  it("keeps assisted and manual personal bests separate", () => {
    const baseSession = {
      track: findTrack("northstar"),
      weather: findWeather("storm")
    };

    expect(sessionKey({ ...baseSession, assist: findAssist("balanced") })).toBe("apex-formula:pb:northstar:storm:balanced");
    expect(sessionKey({ ...baseSession, assist: findAssist("manual") })).toBe("apex-formula:pb:northstar:storm:manual");
  });
});
