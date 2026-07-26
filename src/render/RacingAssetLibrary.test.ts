import { describe, expect, it } from "vitest";
import { FORMULA_CAR_MODEL_YAW_OFFSET, formulaCarAssetYaw } from "./RacingAssetLibrary";

describe("RacingAssetLibrary vehicle axis contract", () => {
  it("turns the imported car onto the renderer's -Z forward axis", () => {
    expect(FORMULA_CAR_MODEL_YAW_OFFSET).toBe(Math.PI);
    expect(formulaCarAssetYaw(0)).toBe(Math.PI);
    expect(formulaCarAssetYaw(0.02)).toBeCloseTo(Math.PI + 0.02);
  });
});
