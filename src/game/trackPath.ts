export const TRACK_NAME = "Aurelia GP";
export const TRACK_LOOP_LENGTH = 2200;

export type TrackSectionKind = "straight" | "hairpin" | "sweeper" | "chicane" | "esses";
export type CornerPhase = "flat" | "brake" | "turn-in" | "apex" | "exit";

export type TrackSection = {
  id: string;
  name: string;
  kind: TrackSectionKind;
  start: number;
  end: number;
  sector: 1 | 2 | 3;
  halfWidth: number;
  targetSpeedKph: number;
  difficulty: number;
  brakingStart?: number;
  apex?: number;
  exit?: number;
  instruction: string;
};

export type TrackSample = {
  distance: number;
  center: number;
  curve: number;
  halfWidth: number;
  section: TrackSection;
  sectionProgress: number;
  brakingZone: boolean;
  cornerPhase: CornerPhase;
  targetSpeedKph: number;
  racingLineOffset: number;
};

type CenterAnchor = {
  distance: number;
  center: number;
};

export const TRACK_SECTIONS: TrackSection[] = [
  {
    id: "front-straight",
    name: "Front Straight",
    kind: "straight",
    start: 0,
    end: 310,
    sector: 1,
    halfWidth: 5.9,
    targetSpeedKph: 310,
    difficulty: 0.08,
    instruction: "Build speed and open ERS"
  },
  {
    id: "basilica-hairpin",
    name: "Basilica Hairpin",
    kind: "hairpin",
    start: 310,
    end: 535,
    sector: 1,
    halfWidth: 6.5,
    targetSpeedKph: 88,
    difficulty: 0.92,
    brakingStart: 0.06,
    apex: 0.52,
    exit: 0.76,
    instruction: "Brake straight, rotate late"
  },
  {
    id: "orchard-sprint",
    name: "Orchard Sprint",
    kind: "straight",
    start: 535,
    end: 760,
    sector: 1,
    halfWidth: 5.7,
    targetSpeedKph: 292,
    difficulty: 0.12,
    instruction: "Use the full exit"
  },
  {
    id: "veloce-sweep",
    name: "Veloce Sweep",
    kind: "sweeper",
    start: 760,
    end: 1030,
    sector: 2,
    halfWidth: 6,
    targetSpeedKph: 214,
    difficulty: 0.56,
    apex: 0.47,
    exit: 0.8,
    instruction: "Breathe the throttle"
  },
  {
    id: "cava-chicane",
    name: "Cava Chicane",
    kind: "chicane",
    start: 1030,
    end: 1260,
    sector: 2,
    halfWidth: 6.7,
    targetSpeedKph: 136,
    difficulty: 0.82,
    brakingStart: 0.08,
    apex: 0.42,
    exit: 0.78,
    instruction: "Attack first kerb, settle second"
  },
  {
    id: "ridge-esses",
    name: "Ridge Esses",
    kind: "esses",
    start: 1260,
    end: 1580,
    sector: 2,
    halfWidth: 5.8,
    targetSpeedKph: 188,
    difficulty: 0.66,
    apex: 0.5,
    exit: 0.86,
    instruction: "Balance the car through rhythm"
  },
  {
    id: "station-hairpin",
    name: "Station Hairpin",
    kind: "hairpin",
    start: 1580,
    end: 1820,
    sector: 3,
    halfWidth: 6.6,
    targetSpeedKph: 82,
    difficulty: 0.96,
    brakingStart: 0.05,
    apex: 0.54,
    exit: 0.78,
    instruction: "Slow in, early hands straight"
  },
  {
    id: "parabolica",
    name: "Parabolica",
    kind: "sweeper",
    start: 1820,
    end: TRACK_LOOP_LENGTH,
    sector: 3,
    halfWidth: 6.2,
    targetSpeedKph: 238,
    difficulty: 0.5,
    apex: 0.42,
    exit: 0.88,
    instruction: "Commit to the long exit"
  }
];

const CENTER_ANCHORS: CenterAnchor[] = [
  { distance: 0, center: 0 },
  { distance: 240, center: 0 },
  { distance: 360, center: -13 },
  { distance: 535, center: -22 },
  { distance: 700, center: 8 },
  { distance: 880, center: 20 },
  { distance: 1030, center: 7 },
  { distance: 1150, center: -18 },
  { distance: 1260, center: -11 },
  { distance: 1400, center: 15 },
  { distance: 1580, center: 20 },
  { distance: 1700, center: -18 },
  { distance: 1820, center: -22 },
  { distance: 2020, center: -7 },
  { distance: TRACK_LOOP_LENGTH, center: 0 }
];

export function sampleTrack(distance: number): TrackSample {
  const d = wrapDistance(distance);
  const section = trackSectionAt(d);
  const sectionProgress = (d - section.start) / (section.end - section.start);
  const curve = trackCurveAt(d);

  return {
    distance: d,
    center: trackCenterAt(d),
    curve,
    halfWidth: section.halfWidth,
    section,
    sectionProgress,
    brakingZone: isBrakingZone(section, sectionProgress),
    cornerPhase: cornerPhase(section, sectionProgress),
    targetSpeedKph: section.targetSpeedKph,
    racingLineOffset: racingLineOffset(section, sectionProgress, curve)
  };
}

export function trackCenterAt(distance: number) {
  const d = wrapDistance(distance);
  const nextIndex = CENTER_ANCHORS.findIndex((anchor) => anchor.distance >= d);
  const rightIndex = nextIndex <= 0 ? 1 : nextIndex;
  const left = CENTER_ANCHORS[rightIndex - 1];
  const right = CENTER_ANCHORS[rightIndex];
  const t = smoothstep((d - left.distance) / (right.distance - left.distance));
  return left.center + (right.center - left.center) * t;
}

export function trackCurveAt(distance: number) {
  const sample = 10;
  return (trackCenterAt(distance + sample) - trackCenterAt(distance - sample)) / (sample * 2);
}

export function trackSectionAt(distance: number) {
  const d = wrapDistance(distance);
  return TRACK_SECTIONS.find((section) => d >= section.start && d < section.end) ?? TRACK_SECTIONS[0];
}

export function wrapDistance(distance: number) {
  return ((distance % TRACK_LOOP_LENGTH) + TRACK_LOOP_LENGTH) % TRACK_LOOP_LENGTH;
}

function isBrakingZone(section: TrackSection, sectionProgress: number) {
  if (section.brakingStart === undefined) return false;
  return sectionProgress >= section.brakingStart && sectionProgress < Math.min(0.5, section.apex ?? 0.5);
}

function cornerPhase(section: TrackSection, sectionProgress: number): CornerPhase {
  if (section.kind === "straight") return "flat";
  if (isBrakingZone(section, sectionProgress)) return "brake";
  if (sectionProgress < (section.apex ?? 0.5) - 0.14) return "turn-in";
  if (sectionProgress < (section.exit ?? 0.78)) return "apex";
  return "exit";
}

function racingLineOffset(section: TrackSection, sectionProgress: number, curve: number) {
  if (section.kind === "straight") return 0;

  const outside = -Math.sign(curve || 1) * 2.25;
  const inside = Math.sign(curve || 1) * 1.4;
  const exit = -Math.sign(curve || 1) * 2.05;
  if (sectionProgress < 0.34) return outside;
  if (sectionProgress < 0.68) return inside;
  return exit;
}

function smoothstep(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}
