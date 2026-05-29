import { describe, expect, it } from "vitest";
import { getTrackCheckpoints, sampleTrack, setActiveTrackLayout, trackBankAt, trackCenterAt, trackElevationAt } from "./trackPath";

describe("trackPath layouts", () => {
  it("switches the sampled circuit identity by fictional venue", () => {
    setActiveTrackLayout("aurelia");
    const aurelia = {
      center: trackCenterAt(470),
      section: sampleTrack(470).section.name,
      checkpoint: getTrackCheckpoints()[0].name
    };

    setActiveTrackLayout("mirage");
    const mirage = {
      center: trackCenterAt(470),
      section: sampleTrack(470).section.name,
      checkpoint: getTrackCheckpoints()[0].name
    };

    setActiveTrackLayout("northstar");
    const northstar = {
      center: trackCenterAt(470),
      section: sampleTrack(470).section.name,
      checkpoint: getTrackCheckpoints()[0].name
    };

    expect(aurelia.section).toBe("Basilica Hairpin");
    expect(mirage.section).toBe("Souq Hairpin");
    expect(northstar.section).toBe("Pine Sweep");
    expect(new Set([aurelia.center, mirage.center, northstar.center]).size).toBe(3);
    expect(mirage.checkpoint).toBe("Souq Hairpin Entry");
    expect(northstar.checkpoint).toBe("Pine Sweep Entry");
    setActiveTrackLayout("aurelia");
  });

  it("gives each fictional venue a distinct elevation and banking profile", () => {
    setActiveTrackLayout("mirage");
    const mirageElevations = [0, 560, 1190, 1780].map(trackElevationAt);
    const mirageRange = Math.max(...mirageElevations) - Math.min(...mirageElevations);

    setActiveTrackLayout("northstar");
    const northstarElevations = [0, 360, 810, 1430].map(trackElevationAt);
    const northstarRange = Math.max(...northstarElevations) - Math.min(...northstarElevations);
    const alpineSample = sampleTrack(560);

    expect(northstarRange).toBeGreaterThan(mirageRange + 5);
    expect(Math.abs(trackBankAt(560))).toBeGreaterThan(0.1);
    expect(alpineSample.elevation).toBeGreaterThan(4);
    expect(typeof alpineSample.bank).toBe("number");
    setActiveTrackLayout("aurelia");
  });
});
