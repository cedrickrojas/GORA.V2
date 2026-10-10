import type { UserRole } from '../../generated/prisma/client';

export interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
}
