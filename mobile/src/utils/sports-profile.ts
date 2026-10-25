import type { SkillLevel, SportOption, UserSportEntry } from '@/types/profile';

/** Same limit as the API DTO and the UserSport_position_check constraint. */
export const POSITION_MAX_LENGTH = 40;

export const SKILL_LEVELS: readonly { value: SkillLevel; label: string }[] = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
  { value: 'PROFESSIONAL', label: 'Professional' },
];

/** Suggestions only: a position is always optional, and sports without one list none. */
const POSITION_SUGGESTIONS: Readonly<Record<string, readonly string[]>> = {
  basketball: ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'],
  volleyball: ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite', 'Libero'],
  football: ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'],
};

export function skillLevelLabel(level: SkillLevel): string {
  return SKILL_LEVELS.find((option) => option.value === level)?.label ?? level;
}

export function positionSuggestionsFor(sportName: string): readonly string[] {
  return POSITION_SUGGESTIONS[sportName.trim().toLowerCase()] ?? [];
}

/** Blank becomes null (no position). */
export function normalizePosition(text: string): string | null {
  const position = text.trim();

  return position.length > 0 ? position : null;
}

export function positionError(text: string): string | null {
  return text.trim().length > POSITION_MAX_LENGTH
    ? `Position must be at most ${POSITION_MAX_LENGTH} characters.`
    : null;
}

/** Active sports that are not on the profile yet, so the picker never offers a duplicate or a retired sport. */
export function addableSports(options: readonly SportOption[], added: readonly UserSportEntry[]): SportOption[] {
  const addedIds = new Set(added.map((sport) => sport.sportId));

  return options.filter((option) => option.isActive && !addedIds.has(option.id));
}

/** "Advanced · Point Guard", or just the level when there is no position. */
export function describeUserSport(sport: Pick<UserSportEntry, 'skillLevel' | 'position'>): string {
  const level = skillLevelLabel(sport.skillLevel);

  return sport.position ? `${level} · ${sport.position}` : level;
}
