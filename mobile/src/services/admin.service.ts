import { apiRequest } from './api-client';
import type { UserRole } from '@/types/auth';

export type ReportStatus = 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
export interface AdminPerson {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
}
export interface AdminUser extends AdminPerson {
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  city: string | null;
}
export interface AdminOverview {
  users: number;
  activeUsers: number;
  posts: number;
  games: number;
  clubs: number;
  reels: number;
  pendingReports: number;
  reviewingReports: number;
  pendingHelpMessages: number;
  dailyRegistrations: { day: string; total: number }[];
}
export interface AdminReport {
  id: string;
  reason: string;
  description: string | null;
  status: ReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  reporter: AdminPerson;
  reportedUser: AdminPerson | null;
  resolvedBy: AdminPerson | null;
  postId: string | null;
  reelId: string | null;
  postCommentId: string | null;
  reelCommentId: string | null;
  gameId: string | null;
  storyId: string | null;
  messageId: string | null;
  clubId: string | null;
  post: { caption: string | null } | null;
  reel: { caption: string | null } | null;
  postComment: { content: string } | null;
  reelComment: { content: string } | null;
  message: { content: string; deletedAt: string | null } | null;
  game: { title: string } | null;
  club: { name: string } | null;
}
export interface AdminSport {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count: { players: number; games: number };
}
export interface AdminAudit {
  id: string;
  action: string;
  targetId: string;
  details: Record<string, unknown>;
  createdAt: string;
  actor: AdminPerson;
}
export interface AdminPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const adminApi = {
  overview: (token: string) =>
    apiRequest<AdminOverview>('/admin/overview', { token }),
  users: (token: string, params: URLSearchParams) =>
    apiRequest<AdminPage<AdminUser>>(`/admin/users?${params}`, { token }),
  updateUser: (
    token: string,
    id: string,
    body: { role?: UserRole; isActive?: boolean },
  ) =>
    apiRequest<AdminUser>(`/admin/users/${id}`, {
      token,
      method: 'PATCH',
      body,
    }),
  reports: (token: string, params: URLSearchParams) =>
    apiRequest<AdminPage<AdminReport>>(`/admin/reports?${params}`, { token }),
  updateReport: (
    token: string,
    id: string,
    status: ReportStatus,
    expectedStatus: ReportStatus,
  ) =>
    apiRequest(`/admin/reports/${id}`, {
      token,
      method: 'PATCH',
      body: { status, expectedStatus },
    }),
  sports: (token: string) =>
    apiRequest<AdminSport[]>('/admin/sports', { token }),
  updateSport: (token: string, id: string, isActive: boolean) =>
    apiRequest(`/admin/sports/${id}`, {
      token,
      method: 'PATCH',
      body: { isActive },
    }),
  audit: (token: string, page: number) =>
    apiRequest<AdminPage<AdminAudit>>(`/admin/audit?page=${page}`, { token }),
};
