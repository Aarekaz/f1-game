import type { FictionalTrackId } from "../world/FictionalGpWorld";

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
  elevation: number;
  bank: number;
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

type ProfileAnchor = {
  distance: number;
  value: number;
};

type PlanAnchor = {
  distance: number;
  x: number;
  z: number;
};

export type TrackWorldPoint = {
  x: number;
  z: number;
};

export type TrackCheckpoint = {
  id: string;
  name: string;
  distance: number;
  sector: 1 | 2 | 3;
};

export type TrackLayout = {
  id: FictionalTrackId;
  name: string;
  loopLength: number;
  sections: TrackSection[];
  centerAnchors: CenterAnchor[];
  planAnchors: PlanAnchor[];
  elevationAnchors: ProfileAnchor[];
  bankAnchors: ProfileAnchor[];
  terrainColor: string;
  runoffColor: string;
  treeColor: string;
  checkpoints: TrackCheckpoint[];
  sectorEnds: readonly [number, number, number];
};

const AURELIA_SECTIONS: TrackSection[] = [
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

const MIRAGE_SECTIONS: TrackSection[] = [
  {
    id: "harbor-straight",
    name: "Harbor Straight",
    kind: "straight",
    start: 0,
    end: 390,
    sector: 1,
    halfWidth: 5.6,
    targetSpeedKph: 315,
    difficulty: 0.1,
    instruction: "Pin the throttle by the marina"
  },
  {
    id: "souq-hairpin",
    name: "Souq Hairpin",
    kind: "hairpin",
    start: 390,
    end: 610,
    sector: 1,
    halfWidth: 6,
    targetSpeedKph: 76,
    difficulty: 0.98,
    brakingStart: 0.04,
    apex: 0.56,
    exit: 0.8,
    instruction: "Brake deep, square the exit"
  },
  {
    id: "palm-blvd",
    name: "Palm Boulevard",
    kind: "straight",
    start: 610,
    end: 920,
    sector: 1,
    halfWidth: 5.8,
    targetSpeedKph: 302,
    difficulty: 0.16,
    instruction: "Open the steering for top speed"
  },
  {
    id: "marina-switchback",
    name: "Marina Switchback",
    kind: "chicane",
    start: 920,
    end: 1190,
    sector: 2,
    halfWidth: 6.3,
    targetSpeedKph: 128,
    difficulty: 0.86,
    brakingStart: 0.08,
    apex: 0.46,
    exit: 0.78,
    instruction: "Clip left, wait, clip right"
  },
  {
    id: "hotel-arc",
    name: "Hotel Arc",
    kind: "sweeper",
    start: 1190,
    end: 1510,
    sector: 2,
    halfWidth: 5.9,
    targetSpeedKph: 232,
    difficulty: 0.58,
    apex: 0.48,
    exit: 0.84,
    instruction: "Float the car through the arc"
  },
  {
    id: "pier-esses",
    name: "Pier Esses",
    kind: "esses",
    start: 1510,
    end: 1780,
    sector: 3,
    halfWidth: 5.8,
    targetSpeedKph: 178,
    difficulty: 0.74,
    apex: 0.5,
    exit: 0.86,
    instruction: "Keep rhythm over the painted kerbs"
  },
  {
    id: "lagoon-kink",
    name: "Lagoon Kink",
    kind: "sweeper",
    start: 1780,
    end: TRACK_LOOP_LENGTH,
    sector: 3,
    halfWidth: 5.9,
    targetSpeedKph: 256,
    difficulty: 0.48,
    apex: 0.4,
    exit: 0.84,
    instruction: "Trust the downforce back to start"
  }
];

const NORTHSTAR_SECTIONS: TrackSection[] = [
  {
    id: "summit-straight",
    name: "Summit Straight",
    kind: "straight",
    start: 0,
    end: 270,
    sector: 1,
    halfWidth: 5.8,
    targetSpeedKph: 304,
    difficulty: 0.12,
    instruction: "Build speed over the crest"
  },
  {
    id: "pine-sweep",
    name: "Pine Sweep",
    kind: "sweeper",
    start: 270,
    end: 560,
    sector: 1,
    halfWidth: 6.1,
    targetSpeedKph: 224,
    difficulty: 0.62,
    apex: 0.44,
    exit: 0.82,
    instruction: "Hold a brave partial throttle"
  },
  {
    id: "glacier-hairpin",
    name: "Glacier Hairpin",
    kind: "hairpin",
    start: 560,
    end: 810,
    sector: 1,
    halfWidth: 6.8,
    targetSpeedKph: 72,
    difficulty: 1,
    brakingStart: 0.05,
    apex: 0.58,
    exit: 0.82,
    instruction: "Brake early, no heroics"
  },
  {
    id: "ravine-run",
    name: "Ravine Run",
    kind: "straight",
    start: 810,
    end: 1110,
    sector: 2,
    halfWidth: 5.7,
    targetSpeedKph: 296,
    difficulty: 0.2,
    instruction: "Let the car breathe downhill"
  },
  {
    id: "cabin-esses",
    name: "Cabin Esses",
    kind: "esses",
    start: 1110,
    end: 1430,
    sector: 2,
    halfWidth: 5.7,
    targetSpeedKph: 168,
    difficulty: 0.82,
    apex: 0.52,
    exit: 0.88,
    instruction: "Small inputs, keep the platform flat"
  },
  {
    id: "timber-chicane",
    name: "Timber Chicane",
    kind: "chicane",
    start: 1430,
    end: 1660,
    sector: 2,
    halfWidth: 6.4,
    targetSpeedKph: 118,
    difficulty: 0.9,
    brakingStart: 0.06,
    apex: 0.44,
    exit: 0.78,
    instruction: "Sacrifice entry for clean traction"
  },
  {
    id: "north-bowl",
    name: "North Bowl",
    kind: "sweeper",
    start: 1660,
    end: TRACK_LOOP_LENGTH,
    sector: 3,
    halfWidth: 6.2,
    targetSpeedKph: 238,
    difficulty: 0.66,
    apex: 0.46,
    exit: 0.86,
    instruction: "Commit, then unwind onto the hill"
  }
];

const TRACK_LAYOUTS: Record<FictionalTrackId, TrackLayout> = {
  aurelia: {
    id: "aurelia",
    name: TRACK_NAME,
    loopLength: TRACK_LOOP_LENGTH,
    sections: AURELIA_SECTIONS,
    sectorEnds: [760, 1580, TRACK_LOOP_LENGTH],
    checkpoints: checkpointsFromSections(AURELIA_SECTIONS),
    terrainColor: "#496f45",
    runoffColor: "#7d8e78",
    treeColor: "#385f38",
    centerAnchors: [
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
    ],
    planAnchors: [
      { distance: 0, x: 0, z: 0 },
      { distance: 310, x: 4, z: -184 },
      { distance: 535, x: -132, z: -236 },
      { distance: 760, x: -260, z: -112 },
      { distance: 1030, x: -216, z: 92 },
      { distance: 1260, x: -46, z: 174 },
      { distance: 1580, x: 162, z: 114 },
      { distance: 1820, x: 232, z: -54 },
      { distance: TRACK_LOOP_LENGTH, x: 0, z: 0 }
    ],
    elevationAnchors: [
      { distance: 0, value: 0.4 },
      { distance: 240, value: 0.9 },
      { distance: 535, value: 2.6 },
      { distance: 760, value: 1.3 },
      { distance: 1030, value: 3.2 },
      { distance: 1260, value: 2.1 },
      { distance: 1580, value: 4.2 },
      { distance: 1820, value: 1.6 },
      { distance: TRACK_LOOP_LENGTH, value: 0.4 }
    ],
    bankAnchors: [
      { distance: 0, value: 0 },
      { distance: 310, value: -0.18 },
      { distance: 535, value: -0.05 },
      { distance: 880, value: 0.16 },
      { distance: 1150, value: -0.22 },
      { distance: 1400, value: 0.2 },
      { distance: 1700, value: -0.24 },
      { distance: 2020, value: 0.12 },
      { distance: TRACK_LOOP_LENGTH, value: 0 }
    ]
  },
  mirage: {
    id: "mirage",
    name: "Mirage Bay GP",
    loopLength: TRACK_LOOP_LENGTH,
    sections: MIRAGE_SECTIONS,
    sectorEnds: [920, 1510, TRACK_LOOP_LENGTH],
    checkpoints: checkpointsFromSections(MIRAGE_SECTIONS),
    terrainColor: "#637b67",
    runoffColor: "#8d9588",
    treeColor: "#4d7352",
    centerAnchors: [
      { distance: 0, center: 0 },
      { distance: 320, center: 2 },
      { distance: 470, center: 23 },
      { distance: 610, center: 24 },
      { distance: 780, center: -12 },
      { distance: 920, center: -22 },
      { distance: 1040, center: 13 },
      { distance: 1190, center: -8 },
      { distance: 1350, center: -24 },
      { distance: 1510, center: -6 },
      { distance: 1640, center: 20 },
      { distance: 1780, center: 6 },
      { distance: 1980, center: -18 },
      { distance: TRACK_LOOP_LENGTH, center: 0 }
    ],
    planAnchors: [
      { distance: 0, x: 0, z: 0 },
      { distance: 390, x: 96, z: -266 },
      { distance: 610, x: 292, z: -216 },
      { distance: 920, x: 304, z: 42 },
      { distance: 1190, x: 124, z: 202 },
      { distance: 1510, x: -156, z: 144 },
      { distance: 1780, x: -268, z: -42 },
      { distance: TRACK_LOOP_LENGTH, x: 0, z: 0 }
    ],
    elevationAnchors: [
      { distance: 0, value: 0.15 },
      { distance: 390, value: 0.28 },
      { distance: 610, value: 0.55 },
      { distance: 920, value: 0.32 },
      { distance: 1190, value: 0.88 },
      { distance: 1510, value: 0.5 },
      { distance: 1780, value: 0.22 },
      { distance: TRACK_LOOP_LENGTH, value: 0.15 }
    ],
    bankAnchors: [
      { distance: 0, value: 0 },
      { distance: 470, value: 0.06 },
      { distance: 920, value: -0.08 },
      { distance: 1190, value: 0.1 },
      { distance: 1640, value: -0.1 },
      { distance: 1980, value: 0.06 },
      { distance: TRACK_LOOP_LENGTH, value: 0 }
    ]
  },
  northstar: {
    id: "northstar",
    name: "Northstar Ring",
    loopLength: TRACK_LOOP_LENGTH,
    sections: NORTHSTAR_SECTIONS,
    sectorEnds: [810, 1660, TRACK_LOOP_LENGTH],
    checkpoints: checkpointsFromSections(NORTHSTAR_SECTIONS),
    terrainColor: "#415f4d",
    runoffColor: "#748178",
    treeColor: "#2f4f3f",
    centerAnchors: [
      { distance: 0, center: 0 },
      { distance: 200, center: 0 },
      { distance: 360, center: -18 },
      { distance: 560, center: -25 },
      { distance: 700, center: 16 },
      { distance: 810, center: 24 },
      { distance: 980, center: 4 },
      { distance: 1110, center: -10 },
      { distance: 1240, center: 19 },
      { distance: 1430, center: -18 },
      { distance: 1540, center: 12 },
      { distance: 1660, center: 22 },
      { distance: 1900, center: 10 },
      { distance: 2080, center: -16 },
      { distance: TRACK_LOOP_LENGTH, center: 0 }
    ],
    planAnchors: [
      { distance: 0, x: 0, z: 0 },
      { distance: 270, x: -76, z: -196 },
      { distance: 560, x: -280, z: -158 },
      { distance: 810, x: -248, z: 72 },
      { distance: 1110, x: -62, z: 246 },
      { distance: 1430, x: 174, z: 188 },
      { distance: 1660, x: 292, z: 8 },
      { distance: TRACK_LOOP_LENGTH, x: 0, z: 0 }
    ],
    elevationAnchors: [
      { distance: 0, value: 5.8 },
      { distance: 200, value: 10.2 },
      { distance: 360, value: 13.4 },
      { distance: 560, value: 5.1 },
      { distance: 810, value: 1.4 },
      { distance: 1110, value: 7.6 },
      { distance: 1430, value: 12.8 },
      { distance: 1660, value: 6.2 },
      { distance: 1900, value: 3.4 },
      { distance: TRACK_LOOP_LENGTH, value: 5.8 }
    ],
    bankAnchors: [
      { distance: 0, value: 0 },
      { distance: 270, value: -0.18 },
      { distance: 560, value: -0.3 },
      { distance: 810, value: 0.1 },
      { distance: 1110, value: 0.22 },
      { distance: 1430, value: -0.26 },
      { distance: 1660, value: 0.25 },
      { distance: 2080, value: -0.12 },
      { distance: TRACK_LOOP_LENGTH, value: 0 }
    ]
  }
};

let activeLayout: TrackLayout = TRACK_LAYOUTS.aurelia;

export function setActiveTrackLayout(trackId: FictionalTrackId) {
  activeLayout = TRACK_LAYOUTS[trackId] ?? TRACK_LAYOUTS.aurelia;
}

export function getActiveTrackLayout() {
  return activeLayout;
}

export function getTrackCheckpoints() {
  return activeLayout.checkpoints;
}

export function getTrackSectorEnds() {
  return activeLayout.sectorEnds;
}

export const TRACK_SECTIONS = AURELIA_SECTIONS;

export function sampleTrack(distance: number): TrackSample {
  const d = wrapDistance(distance);
  const section = trackSectionAt(d);
  const sectionProgress = (d - section.start) / (section.end - section.start);
  const curve = trackCurveAt(d);
  const elevation = trackElevationAt(d);
  const bank = trackBankAt(d);

  return {
    distance: d,
    center: trackCenterAt(d),
    curve,
    elevation,
    bank,
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
  const anchors = activeLayout.centerAnchors;
  const nextIndex = anchors.findIndex((anchor) => anchor.distance >= d);
  const rightIndex = nextIndex <= 0 ? 1 : nextIndex;
  const left = anchors[rightIndex - 1];
  const right = anchors[rightIndex];
  const t = smoothstep((d - left.distance) / (right.distance - left.distance));
  return left.center + (right.center - left.center) * t;
}

export function trackCurveAt(distance: number) {
  const sample = 10;
  return (trackCenterAt(distance + sample) - trackCenterAt(distance - sample)) / (sample * 2);
}

export function trackWorldPointAt(distance: number, lateral = 0): TrackWorldPoint {
  const center = planPointAt(distance);
  const tangent = trackWorldTangentAt(distance);
  const normal = { x: -tangent.z, z: tangent.x };
  return {
    x: center.x + normal.x * lateral,
    z: center.z + normal.z * lateral
  };
}

export function trackWorldHeadingAt(distance: number) {
  const tangent = trackWorldTangentAt(distance);
  return Math.atan2(-tangent.x, -tangent.z);
}

export function trackWorldTangentAt(distance: number) {
  const sample = 8;
  const before = planPointAt(distance - sample);
  const after = planPointAt(distance + sample);
  const x = after.x - before.x;
  const z = after.z - before.z;
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

export function trackElevationAt(distance: number) {
  return profileAt(activeLayout.elevationAnchors, distance);
}

export function trackBankAt(distance: number) {
  return profileAt(activeLayout.bankAnchors, distance);
}

export function terrainHeightAt(distance: number, lateral: number) {
  const base = trackElevationAt(distance);
  const shoulder = Math.max(0, Math.abs(lateral) - 8);
  const falloff = Math.min(5.2, shoulder * 0.055);
  return base - falloff;
}

export function trackSectionAt(distance: number) {
  const d = wrapDistance(distance);
  return activeLayout.sections.find((section) => d >= section.start && d < section.end) ?? activeLayout.sections[0];
}

export function wrapDistance(distance: number) {
  return ((distance % activeLayout.loopLength) + activeLayout.loopLength) % activeLayout.loopLength;
}

function checkpointsFromSections(sections: TrackSection[]): TrackCheckpoint[] {
  return sections.slice(1).map((section) => ({
    id: `${section.id}-entry`,
    name: `${section.name} Entry`,
    distance: section.start,
    sector: section.sector
  }));
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

function profileAt(anchors: ProfileAnchor[], distance: number) {
  const d = wrapDistance(distance);
  const nextIndex = anchors.findIndex((anchor) => anchor.distance >= d);
  const rightIndex = nextIndex <= 0 ? 1 : nextIndex;
  const left = anchors[rightIndex - 1];
  const right = anchors[rightIndex];
  const t = smoothstep((d - left.distance) / (right.distance - left.distance));
  return left.value + (right.value - left.value) * t;
}

function planPointAt(distance: number): TrackWorldPoint {
  const d = wrapDistance(distance);
  const anchors = activeLayout.planAnchors;
  const nextIndex = anchors.findIndex((anchor) => anchor.distance >= d);
  const rightIndex = nextIndex <= 0 ? 1 : nextIndex;
  const left = anchors[rightIndex - 1];
  const right = anchors[rightIndex];
  const t = smoothstep((d - left.distance) / (right.distance - left.distance));
  return {
    x: left.x + (right.x - left.x) * t,
    z: left.z + (right.z - left.z) * t
  };
}

function smoothstep(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}
