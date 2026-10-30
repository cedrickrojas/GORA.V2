import type { UserRole } from '../generated/prisma/client';

/** Fields returned by register and login. Never includes passwordHash. */
export const SAFE_USER_SELECT = {
  id: true,
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
} as const;

/** Fields returned by GET /auth/me. Never includes passwordHash. */
export const CURRENT_USER_SELECT = {
  ...SAFE_USER_SELECT,
  profileImageUrl: true,
  bio: true,
  city: true,
} as const;

export interface SafeUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface CurrentUser extends SafeUser {
  profileImageUrl: string | null;
  bio: string | null;
  city: string | null;
}

export interface UserReference {
  id: string;
  username: string;
}

/** Public author fields shown on posts. */
export const AUTHOR_SELECT = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
} as const;

/** Profile fields. Never includes email or passwordHash; dateOfBirth is shown to the owner only. */
export const PROFILE_USER_SELECT = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  coverImageUrl: true,
  coverPhotoRevision: true,
  bio: true,
  city: true,
  dateOfBirth: true,
  createdAt: true,
  goraPoints: true,
} as const;

/** Internal only: used to verify a login. Must never leave AuthService. */
export interface UserCredentials extends SafeUser {
  passwordHash: string;
  isActive: boolean;
}

export interface CreateUserData {
  username: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  city?: string;
  dateOfBirth?: Date;
}
