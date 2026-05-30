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
    expect(names.has("sculpted-monocoque-shoulder")).toBe(true);
    expect(names.has("airbox-intake")).toBe(true);
    expect(names.has("driver-helmet")).toBe(true);
    expect(names.has("driver-visor")).toBe(true);
    expect(names.has("beam-wing")).toBe(true);
    expect(names.has("needle-nose-tip")).toBe(true);
    expect(names.has("nose-number-panel")).toBe(true);
    expect(names.has("sidepod-undercut-left")).toBe(true);
    expect(names.has("cooling-gill-right-3")).toBe(true);
    expect(names.has("floor-vortex-rail-left")).toBe(true);
    expect(names.has("diffuser-strake-1")).toBe(true);
    expect(names.has("race-control-t-camera")).toBe(true);
    expect(names.has("rear-rain-light")).toBe(true);
    expect(names.has("rear-rain-light-glow")).toBe(true);
    expect(names.has("ers-deploy-glow")).toBe(true);
    expect(names.has("ers-flow-left")).toBe(true);
    expect(names.has("ers-flow-right")).toBe(true);
    expect(names.has("sidepod-inlet-left")).toBe(true);
    expect(names.has("sidepod-livery-slash-right")).toBe(true);
    expect(names.has("front-left-wheel")).toBe(true);
    expect(names.has("front-left-wheel-brake-glow")).toBe(true);
    expect(names.has("front-left-wheel-wheel-blur")).toBe(true);
    expect(names.has("front-left-wheel-sidewall-ring")).toBe(true);
    expect(names.has("front-left-wheel-sidewall-letter-block")).toBe(true);
    expect(names.has("front-left-wheel-brake-duct")).toBe(true);
    expect(names.has("front-left-wheel-wheel-nut")).toBe(true);
    expect(Array.from(names).filter((name) => name.includes("wheel")).length).toBeGreaterThanOrEqual(28);
    expect(car.userData.disposableMaterials.length).toBeGreaterThanOrEqual(15);
  });
});
