import type { LoginField, LoginInput, RegisterField, RegisterInput } from '@/types/auth';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 50;
export const DEFAULT_AUTHENTICATED_PATH = '/home';

/** Mirrors the server rule: 3-30 chars of a-z, 0-9, dot, underscore; alphanumeric ends; no repeated separators. */
export const USERNAME_PATTERN = /^(?!.*[._]{2})[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors the server list: names that would collide with routes like /profile/edit. */
export const RESERVED_USERNAMES: readonly string[] = [
  'activity',
  'admin',
  'api',
  'badges',
  'clubs',
  'edit',
  'followers',
  'following',
  'friends',
  'games',
  'gora',
  'help',
  'me',
  'reels',
  'settings',
  'sports',
  'stories',
  'support',
];

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

export function normalizeRegisterInput(input: RegisterInput): RegisterInput {
  return {
    username: input.username.trim().toLowerCase(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    confirmPassword: input.confirmPassword,
  };
}

export function normalizeLoginInput(input: LoginInput): LoginInput {
  return { email: input.email.trim().toLowerCase(), password: input.password };
}

export function validateRegisterInput(raw: RegisterInput): FieldErrors<RegisterField> {
  const input = normalizeRegisterInput(raw);
  const errors: FieldErrors<RegisterField> = {};

  if (!USERNAME_PATTERN.test(input.username)) {
    errors.username = '3–30 letters, numbers, dots, or underscores. Start and end with a letter or number.';
  } else if (RESERVED_USERNAMES.includes(input.username)) {
    errors.username = 'That username is reserved. Choose another one.';
  }

  if (!input.firstName) {
    errors.firstName = 'First name is required.';
  } else if (input.firstName.length > NAME_MAX_LENGTH) {
    errors.firstName = `First name must be at most ${NAME_MAX_LENGTH} characters.`;
  }

  if (!input.lastName) {
    errors.lastName = 'Last name is required.';
  } else if (input.lastName.length > NAME_MAX_LENGTH) {
    errors.lastName = `Last name must be at most ${NAME_MAX_LENGTH} characters.`;
  }

  const emailError = validateEmail(input.email);
  if (emailError) {
    errors.email = emailError;
  }

  if (input.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  } else if (input.password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  }

  if (!input.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.';
  } else if (input.confirmPassword !== input.password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

export function validateLoginInput(raw: LoginInput): FieldErrors<LoginField> {
  const input = normalizeLoginInput(raw);
  const errors: FieldErrors<LoginField> = {};
  const emailError = validateEmail(input.email);

  if (emailError) {
    errors.email = emailError;
  }

  if (!input.password) {
    errors.password = 'Password is required.';
  }

  return errors;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}

function validateEmail(email: string): string | null {
  if (!email) {
    return 'Email is required.';
  }

  return EMAIL_PATTERN.test(email) ? null : 'Enter a valid email address.';
}

/** Only same-app paths are allowed as post-login destinations. */
export function safeRedirectPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_AUTHENTICATED_PATH;
  }

  if (value === '/login' || value === '/register' || value.startsWith('/login?') || value.startsWith('/register?')) {
    return DEFAULT_AUTHENTICATED_PATH;
  }

  return value;
}

export interface GuardTarget {
  fullPath: string;
  requiresAuth: boolean;
  guestOnly: boolean;
}

export type GuardDecision = true | { path: string; query?: Record<string, string> };

export function resolveAuthNavigation(target: GuardTarget, isAuthenticated: boolean): GuardDecision {
  if (target.requiresAuth && !isAuthenticated) {
    const redirect = safeRedirectPath(target.fullPath);
    return redirect === DEFAULT_AUTHENTICATED_PATH ? { path: '/login' } : { path: '/login', query: { redirect } };
  }

  if (target.guestOnly && isAuthenticated) {
    return { path: DEFAULT_AUTHENTICATED_PATH };
  }

  return true;
}
