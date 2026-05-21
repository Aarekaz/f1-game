export const TRACK_LOOP_LENGTH = 1800;

export type TrackSectionKind = "straight" | "hairpin" | "sweeper" | "chicane" | "esses";

export type TrackSection = {
  id: string;
  name: string;
  kind: TrackSectionKind;
  start: number;
  end: number;
  sector: 1 | 2 | 3;
  halfWidth: number;
  brakingZone: boolean;
};

export type TrackSample = {
  distance: number;
  center: number;
  curve: number;
  halfWidth: number;
  section: TrackSection;
  sectionProgress: number;
  brakingZone: boolean;
};

export const TRACK_SECTIONS: TrackSection[] = [
  {
    id: "pit-straight",
    name: "Pit Straight",
    kind: "straight",
    start: 0,
    end: 230,
    sector: 1,
    halfWidth: 5.8,
    brakingZone: false
  },
  {
    id: "turn-one-hairpin",
    name: "Turn 1 Hairpin",
    kind: "hairpin",
    start: 230,
    end: 430,
    sector: 1,
    halfWidth: 6.2,
    brakingZone: true
  },
  {
    id: "back-chute",
    name: "Back Chute",
    kind: "straight",
    start: 430,
    end: 570,
    sector: 1,
    halfWidth: 5.6,
    brakingZone: false
  },
  {
    id: "north-sweeper",
    name: "North Sweeper",
    kind: "sweeper",
    start: 570,
    end: 770,
    sector: 2,
    halfWidth: 5.8,
    brakingZone: false
  },
  {
    id: "technical-chicane",
    name: "Technical Chicane",
    kind: "chicane",
    start: 770,
    end: 980,
    sector: 2,
    halfWidth: 6.4,
    brakingZone: true
  },
  {
    id: "flowing-esses",
    name: "Flowing Esses",
    kind: "esses",
    start: 980,
    end: 1280,
    sector: 2,
    halfWidth: 5.7,
    brakingZone: false
  },
  {
    id: "final-hairpin",
    name: "Final Hairpin",
    kind: "hairpin",
    start: 1280,
    end: 1510,
    sector: 3,
    halfWidth: 6.3,
    brakingZone: true
  },
  {
    id: "final-corner",
    name: "Final Corner",
    kind: "sweeper",
    start: 1510,
    end: TRACK_LOOP_LENGTH,
    sector: 3,
    halfWidth: 5.9,
    brakingZone: false
  }
];

export function sampleTrack(distance: number): TrackSample {
  const d = wrapDistance(distance);
  const section = trackSectionAt(d);
  const sectionProgress = (d - section.start) / (section.end - section.start);

  return {
    distance: d,
    center: trackCenterAt(d),
    curve: trackCurveAt(d),
    halfWidth: section.halfWidth,
    section,
    sectionProgress,
    brakingZone: section.brakingZone && sectionProgress < 0.48
  };
}

export function trackCenterAt(distance: number) {
  const d = wrapDistance(distance);
  return rawTrackCenter(d) - rawTrackCenter(0);
}

export function trackCurveAt(distance: number) {
  const sample = 8;
  return (trackCenterAt(distance + sample) - trackCenterAt(distance - sample)) / (sample * 2);
}

export function trackSectionAt(distance: number) {
  const d = wrapDistance(distance);
  return TRACK_SECTIONS.find((section) => d >= section.start && d < section.end) ?? TRACK_SECTIONS[0];
}

function wrapDistance(distance: number) {
  return ((distance % TRACK_LOOP_LENGTH) + TRACK_LOOP_LENGTH) % TRACK_LOOP_LENGTH;
}

function rawTrackCenter(distance: number) {
  const lap = (distance / TRACK_LOOP_LENGTH) * Math.PI * 4;
  return Math.sin(distance / 115) * 5.8 + Math.sin((distance - 260) / 190) * 4.2 + Math.sin(lap) * 2;
}
