export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

/** Returned by register and login. */
export interface AuthUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

/** Returned by GET /auth/me. */
export interface CurrentAuthUser extends AuthUser {
  profileImageUrl: string | null;
  bio: string | null;
  city: string | null;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export type RegisterField = keyof RegisterInput;
export type LoginField = keyof LoginInput;
