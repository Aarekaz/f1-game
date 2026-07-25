import { describe, expect, it } from "vitest";
import { DEFAULT_PLAYER } from "../world/FictionalGpWorld";
import { normalizePlayerName } from "./PlayerProfileStore";

describe("PlayerProfileStore", () => {
  it("normalizes a display name without losing its personality", () => {
    expect(normalizePlayerName("  Nova   Driver  ")).toBe("Nova Driver");
    expect(normalizePlayerName(" ")).toBe(DEFAULT_PLAYER.name);
  });

  it("keeps display names inside the HUD-friendly limit", () => {
    expect(normalizePlayerName("A very long championship name")).toHaveLength(18);
  });
});
