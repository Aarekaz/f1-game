import { describe, expect, it } from "vitest";
import { buildFormulaCarProxy } from "./buildFormulaCarProxy";

describe("buildFormulaCarProxy", () => {
  it("builds a fictional formula silhouette with wings, halo, and exposed wheels", () => {
    const car = buildFormulaCarProxy("#e72436");
    const names = new Set<string>();
    car.traverse((object) => names.add(object.name));

    expect(car.name).toBe("apex-formula-car");
    expect(names.has("front-wing")).toBe(true);
    expect(names.has("rear-wing")).toBe(true);
    expect(names.has("fictional-halo")).toBe(true);
    expect(names.has("front-left-wheel")).toBe(true);
    expect(names.has("front-left-wheel-brake-glow")).toBe(true);
    expect(names.has("front-left-wheel-wheel-blur")).toBe(true);
    expect(Array.from(names).filter((name) => name.includes("wheel")).length).toBeGreaterThanOrEqual(12);
    expect(car.userData.disposableMaterials.length).toBeGreaterThanOrEqual(10);
  });
});
