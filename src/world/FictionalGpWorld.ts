export type FictionalTrackId = "aurelia" | "mirage" | "northstar";
export type FictionalWeatherId = "clear" | "overcast" | "storm" | "dusk";
export type FictionalAssistId = "balanced" | "manual";

export type FictionalTrack = {
  id: FictionalTrackId;
  name: string;
  region: string;
  character: string;
  difficulty: number;
  accent: string;
};

export type FictionalWeather = {
  id: FictionalWeatherId;
  name: string;
  mood: string;
  gripMultiplier: number;
  rainIntensity: number;
  roadWetness: number;
  skyColor: string;
  fogColor: string;
  grassColor: string;
  lightIntensity: number;
};

export type FictionalAssist = {
  id: FictionalAssistId;
  name: string;
  description: string;
  steeringHelp: number;
  throttleHelp: number;
  brakeHelp: number;
};

export type SessionConfig = {
  track: FictionalTrack;
  weather: FictionalWeather;
  assist: FictionalAssist;
};

export const FICTIONAL_TRACKS: FictionalTrack[] = [
  {
    id: "aurelia",
    name: "Aurelia GP",
    region: "Ligurian foothills",
    character: "technical permanent circuit",
    difficulty: 0.72,
    accent: "#e20e3b"
  },
  {
    id: "mirage",
    name: "Mirage Bay GP",
    region: "fictional gulf coast",
    character: "fast marina street course",
    difficulty: 0.84,
    accent: "#20b7ff"
  },
  {
    id: "northstar",
    name: "Northstar Ring",
    region: "alpine forest plateau",
    character: "high-speed elevation circuit",
    difficulty: 0.9,
    accent: "#f3d348"
  }
];

export const FICTIONAL_WEATHERS: FictionalWeather[] = [
  {
    id: "clear",
    name: "Clear Practice",
    mood: "warm track, clean visibility",
    gripMultiplier: 1,
    rainIntensity: 0,
    roadWetness: 0,
    skyColor: "#c7d8df",
    fogColor: "#c7d8df",
    grassColor: "#496f45",
    lightIntensity: 2.7
  },
  {
    id: "overcast",
    name: "Heavy Cloud",
    mood: "cooler air, muted contrast",
    gripMultiplier: 0.96,
    rainIntensity: 0,
    roadWetness: 0.08,
    skyColor: "#aebdc2",
    fogColor: "#b9c6c6",
    grassColor: "#455f43",
    lightIntensity: 2.15
  },
  {
    id: "storm",
    name: "Wet Storm",
    mood: "low grip, spray, late braking risk",
    gripMultiplier: 0.78,
    rainIntensity: 0.85,
    roadWetness: 0.92,
    skyColor: "#65737d",
    fogColor: "#879196",
    grassColor: "#38503b",
    lightIntensity: 1.55
  },
  {
    id: "dusk",
    name: "Dusk Qualifying",
    mood: "gold light, cooling surface",
    gripMultiplier: 0.93,
    rainIntensity: 0,
    roadWetness: 0.04,
    skyColor: "#d4b39a",
    fogColor: "#c58e75",
    grassColor: "#4d6542",
    lightIntensity: 2.0
  }
];

export const FICTIONAL_ASSISTS: FictionalAssist[] = [
  {
    id: "balanced",
    name: "Balanced Assist",
    description: "settles the car toward the racing line",
    steeringHelp: 0.46,
    throttleHelp: 0.38,
    brakeHelp: 0.28
  },
  {
    id: "manual",
    name: "Manual",
    description: "raw inputs, no driving assist",
    steeringHelp: 0,
    throttleHelp: 0,
    brakeHelp: 0
  }
];

export const DEFAULT_SESSION: SessionConfig = {
  track: FICTIONAL_TRACKS[0],
  weather: FICTIONAL_WEATHERS[0],
  assist: FICTIONAL_ASSISTS[0]
};

export function findTrack(id: string | null | undefined) {
  return FICTIONAL_TRACKS.find((track) => track.id === id) ?? DEFAULT_SESSION.track;
}

export function findWeather(id: string | null | undefined) {
  return FICTIONAL_WEATHERS.find((weather) => weather.id === id) ?? DEFAULT_SESSION.weather;
}

export function findAssist(id: string | null | undefined) {
  return FICTIONAL_ASSISTS.find((assist) => assist.id === id) ?? DEFAULT_SESSION.assist;
}
