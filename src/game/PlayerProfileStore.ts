import { DEFAULT_PLAYER, findTeam, type PlayerProfile } from "../world/FictionalGpWorld";

const STORAGE_KEY = "apex-formula:player-profile";
export const PLAYER_NAME_LIMIT = 18;

export function normalizePlayerName(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, PLAYER_NAME_LIMIT);
  return normalized || DEFAULT_PLAYER.name;
}

export function readPlayerProfile() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLAYER;
    const stored = JSON.parse(raw) as { name?: unknown; teamId?: unknown };
    return {
      name: normalizePlayerName(typeof stored.name === "string" ? stored.name : DEFAULT_PLAYER.name),
      team: findTeam(typeof stored.teamId === "string" ? stored.teamId : DEFAULT_PLAYER.team.id)
    } satisfies PlayerProfile;
  } catch {
    return DEFAULT_PLAYER;
  }
}

export function savePlayerProfile(profile: PlayerProfile) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ name: normalizePlayerName(profile.name), teamId: profile.team.id })
    );
  } catch {
    // The race remains playable when browser storage is unavailable.
  }
}
