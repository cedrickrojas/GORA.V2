import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { CurrentUser as CurrentUserContext } from '../../users/user.types';

/** The user loaded by JwtStrategy. Only valid behind JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserContext => {
    const request = context.switchToHttp().getRequest<Request>();
    return request.user as CurrentUserContext;
  },
);
