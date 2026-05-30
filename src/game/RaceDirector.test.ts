import { describe, expect, it } from "vitest";
import { RaceDirector, RACE_CHECKPOINTS } from "./RaceDirector";
import { TRACK_LOOP_LENGTH } from "./trackPath";

describe("RaceDirector", () => {
  it("requires ordered checkpoints before a lap can be valid", () => {
    const director = new RaceDirector(3);
    let events = director.update(120, 1);
    expect(events).toEqual([]);

    for (const checkpoint of RACE_CHECKPOINTS) {
      events = director.update(checkpoint.distance + 2, checkpoint.distance / 100);
      expect(events.some((event) => event.type === "checkpoint")).toBe(true);
    }

    events = director.update(TRACK_LOOP_LENGTH + 3, 22);
    const lap = events.find((event) => event.type === "lap");
    expect(lap).toMatchObject({ type: "lap", lap: 1, valid: true });
  });

  it("keeps a lap invalid after penalties", () => {
    const director = new RaceDirector(3);
    director.addPenalty(5);
    for (const checkpoint of RACE_CHECKPOINTS) {
      director.update(checkpoint.distance + 2, checkpoint.distance / 100);
    }

    const events = director.update(TRACK_LOOP_LENGTH + 3, 20);
    const lap = events.find((event) => event.type === "lap");

    expect(lap).toMatchObject({ type: "lap", valid: false });
    const snapshot = director.snapshot(TRACK_LOOP_LENGTH + 3);
    expect(snapshot.penaltySeconds).toBe(5);
    expect(snapshot.lapValid).toBe(true);
    expect(snapshot.lap).toBe(2);
  });

  it("finishes only after the requested race distance", () => {
    const director = new RaceDirector(2);
    director.update(TRACK_LOOP_LENGTH + 1, 20);
    expect(director.snapshot(TRACK_LOOP_LENGTH + 1).finished).toBe(false);

    const events = director.update(TRACK_LOOP_LENGTH * 2 + 1, 42);
    expect(events.some((event) => event.type === "finish")).toBe(true);
    expect(director.snapshot(TRACK_LOOP_LENGTH * 2 + 1).raceProgress).toBe(1);
  });

  it("keeps final sector splits available after finish", () => {
    const director = new RaceDirector(1);
    const events = director.update(TRACK_LOOP_LENGTH + 1, 72);
    const sectorEvents = events.filter((event) => event.type === "sector");
    const snapshot = director.snapshot(TRACK_LOOP_LENGTH + 1);

    expect(sectorEvents).toHaveLength(3);
    expect(snapshot.finished).toBe(true);
    expect(snapshot.sectorSplits.every((split) => split !== null && split > 0)).toBe(true);
  });
});
