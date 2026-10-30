import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { CurrentUser } from '../users/user.types';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: CurrentUser }>();
    // JwtStrategy reloads this role from the database on every request.
    if (user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super admin access is required.');
    }
    return true;
  }
}
