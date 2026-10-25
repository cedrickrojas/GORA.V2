import type { SkillLevel } from '../generated/prisma/client';

/** A row of the central Sport table as clients see it; timestamps stay internal. */
export interface SportView {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  isActive: boolean;
}

/** One sport on a user's profile (a UserSport row joined with its Sport). */
export interface UserSportView {
  sportId: string;
  name: string;
  iconUrl: string | null;
  skillLevel: SkillLevel;
  position: string | null;
  createdAt: string;
  updatedAt: string;
}
