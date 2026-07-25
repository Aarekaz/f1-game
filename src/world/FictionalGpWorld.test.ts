import { describe, expect, it } from "vitest";
import { FICTIONAL_DRIVERS, FICTIONAL_TEAMS, findTeam } from "./FictionalGpWorld";

describe("FictionalGpWorld roster", () => {
  it("keeps one authored driver for every constructor", () => {
    expect(FICTIONAL_TEAMS).toHaveLength(8);
    expect(new Set(FICTIONAL_TEAMS.map((team) => team.id)).size).toBe(FICTIONAL_TEAMS.length);
    expect(FICTIONAL_DRIVERS).toHaveLength(FICTIONAL_TEAMS.length);

    for (const team of FICTIONAL_TEAMS) {
      expect(FICTIONAL_DRIVERS.filter((driver) => driver.teamId === team.id)).toHaveLength(1);
      expect(team.colors).toHaveLength(2);
    }
  });

  it("falls back to the player constructor for unknown selections", () => {
    expect(findTeam("missing").id).toBe("apex");
  });
});
