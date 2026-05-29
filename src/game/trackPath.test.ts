import { describe, expect, it } from "vitest";
import { getTrackCheckpoints, sampleTrack, setActiveTrackLayout, trackCenterAt } from "./trackPath";

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
});
