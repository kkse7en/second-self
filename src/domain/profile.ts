export const DEFAULT_AVATAR = "/avatar.svg";
export interface Profile { name: string; avatar: string }
export const DEFAULT_PROFILE: Profile = { name: "今天的我", avatar: DEFAULT_AVATAR };

export function normalizeProfile(value: unknown): Profile {
  const saved = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const name = typeof saved.name === "string" ? saved.name.trim().slice(0, 24) : "";
  return { name: name || DEFAULT_PROFILE.name, avatar: DEFAULT_AVATAR };
}
