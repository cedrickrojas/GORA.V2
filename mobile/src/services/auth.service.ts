import type { AuthResponse, CurrentAuthUser, LoginInput, RegisterInput } from '@/types/auth';
import { apiRequest } from './api-client';

export function registerAccount(input: RegisterInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: input });
}

export function loginAccount(input: LoginInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: input });
}

export function fetchAuthenticatedUser(token: string): Promise<CurrentAuthUser> {
  return apiRequest<CurrentAuthUser>('/auth/me', { token });
}
