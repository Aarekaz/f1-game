export type FictionalTrackId = "aurelia" | "mirage" | "northstar";
export type FictionalWeatherId = "clear" | "overcast" | "storm" | "dusk";
export type FictionalAssistId = "balanced" | "manual";
export type SessionMode = "drive" | "race";
export type FictionalTeamId = "apex" | "nova" | "oro" | "lynx" | "ember" | "vanta" | "atlas" | "pulse";

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

export type FictionalTeam = {
  id: FictionalTeamId;
  name: string;
  shortName: string;
  colors: [string, string];
  philosophy: string;
  character: string;
};

export type FictionalDriver = {
  id: string;
  name: string;
  teamId: FictionalTeamId;
  number: string;
  archetype: string;
  reputation: string;
};

export type PlayerProfile = {
  name: string;
  team: FictionalTeam;
};

export type SessionConfig = {
  track: FictionalTrack;
  weather: FictionalWeather;
  assist: FictionalAssist;
  player?: PlayerProfile;
  mode?: SessionMode;
};

export const FICTIONAL_TEAMS: FictionalTeam[] = [
  {
    id: "apex",
    name: "Apex Works",
    shortName: "APEX",
    colors: ["#e20e3b", "#f3d348"],
    philosophy: "Brave on entry. Precise on exit.",
    character: "the young factory team with nothing to protect"
  },
  {
    id: "nova",
    name: "Nova Dynamics",
    shortName: "NOVA",
    colors: ["#24c7ff", "#172b46"],
    philosophy: "Turn data into daylight.",
    character: "the ruthless, telemetry-led title machine"
  },
  {
    id: "oro",
    name: "Oro Corse",
    shortName: "ORO",
    colors: ["#f4d35e", "#25211a"],
    philosophy: "Brake later. Leave earlier.",
    character: "the glamorous old hand with a knife-edge race craft"
  },
  {
    id: "lynx",
    name: "Lynx Atelier",
    shortName: "LYNX",
    colors: ["#f7f7f2", "#23b6a6"],
    philosophy: "Protect the tire. Own the final lap.",
    character: "the quiet engineers who always arrive at the finish"
  },
  {
    id: "ember",
    name: "Ember Velocity",
    shortName: "EMBER",
    colors: ["#ff7a2d", "#6f1720"],
    philosophy: "Make the corner remember you.",
    character: "the bright, loud street racers built for late nights"
  },
  {
    id: "vanta",
    name: "Vanta Blackline",
    shortName: "VANTA",
    colors: ["#b88cff", "#17121f"],
    philosophy: "Find grip where nobody else looks.",
    character: "the storm specialists with an appetite for uncertainty"
  },
  {
    id: "atlas",
    name: "Atlas Grand Prix",
    shortName: "ATLAS",
    colors: ["#1fd17f", "#183b34"],
    philosophy: "Build the race one lap at a time.",
    character: "the disciplined long-run team that never panics"
  },
  {
    id: "pulse",
    name: "Pulse Racing Club",
    shortName: "PULSE",
    colors: ["#ff4f83", "#39224e"],
    philosophy: "One clean lap can change everything.",
    character: "the fearless qualifiers chasing a perfect moment"
  }
];

export const FICTIONAL_DRIVERS: FictionalDriver[] = [
  { id: "orion-hale", name: "Orion Hale", teamId: "apex", number: "08", archetype: "The prodigy", reputation: "Carries impossible speed into ordinary corners." },
  { id: "lio-vega", name: "Lio Vega", teamId: "nova", number: "07", archetype: "The metronome", reputation: "Never looks hurried, even when the gap is closing." },
  { id: "rami-kade", name: "Rami Kade", teamId: "oro", number: "14", archetype: "The late braker", reputation: "Treats every braking board as a suggestion." },
  { id: "mika-sato", name: "Mika Sato", teamId: "lynx", number: "22", archetype: "The tire whisperer", reputation: "Finds half a lap more life in every set." },
  { id: "noa-roux", name: "Noa Roux", teamId: "ember", number: "31", archetype: "The street fighter", reputation: "Turns narrow corners into personal territory." },
  { id: "ari-iven", name: "Ari Iven", teamId: "vanta", number: "66", archetype: "The weather hunter", reputation: "Gets faster when the forecast gets worse." },
  { id: "lena-mira", name: "Lena Mira", teamId: "atlas", number: "05", archetype: "The closer", reputation: "Does the quiet work, then takes everything late." },
  { id: "tess-vale", name: "Tess Vale", teamId: "pulse", number: "88", archetype: "The one-lap artist", reputation: "Can make a car look brave before the lights go out." }
];

export const DEFAULT_PLAYER: PlayerProfile = {
  name: "Avery Stone",
  team: FICTIONAL_TEAMS[0]
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
  assist: FICTIONAL_ASSISTS[0],
  player: DEFAULT_PLAYER,
  mode: "drive"
};

export function sessionMode(session: SessionConfig): SessionMode {
  return session.mode ?? "race";
}

export function findTrack(id: string | null | undefined) {
  return FICTIONAL_TRACKS.find((track) => track.id === id) ?? DEFAULT_SESSION.track;
}

export function findWeather(id: string | null | undefined) {
  return FICTIONAL_WEATHERS.find((weather) => weather.id === id) ?? DEFAULT_SESSION.weather;
}

export function findAssist(id: string | null | undefined) {
  return FICTIONAL_ASSISTS.find((assist) => assist.id === id) ?? DEFAULT_SESSION.assist;
}

export function findTeam(id: string | null | undefined) {
  return FICTIONAL_TEAMS.find((team) => team.id === id) ?? DEFAULT_PLAYER.team;
}

export function driverForTeam(teamId: FictionalTeamId) {
  return FICTIONAL_DRIVERS.find((driver) => driver.teamId === teamId) ?? FICTIONAL_DRIVERS[0];
}
