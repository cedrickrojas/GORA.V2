import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CurrentUser as CurrentUserContext } from '../users/user.types';
import { UsersService } from '../users/users.service';
import {
  canSendFriendRequest,
  messageAccessFor,
  type MessageAccess,
  type RelationshipState,
} from './relationship';
import { RelationshipService } from './relationship.service';

export interface RelationshipResponse {
  user: { id: string; username: string };
  state: Exclude<RelationshipState, 'BLOCKED_BY_THEM'>;
  messageAccess: MessageAccess;
  canSendFriendRequest: boolean;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class RelationshipController {
  constructor(
    private readonly usersService: UsersService,
    private readonly relationships: RelationshipService,
  ) {}

  /** Read-only: the profile buttons come from this state, never from the client. */
  @Get(':username/relationship')
  async relationship(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('username') username: string,
  ): Promise<RelationshipResponse> {
    const target = await this.usersService.findActiveByUsername(username);
    const state = target
      ? await this.relationships.between(viewer.id, target.id)
      : null;

    if (!target || !state || state === 'BLOCKED_BY_THEM') {
      throw new NotFoundException('User not found.');
    }

    return {
      user: target,
      state,
      messageAccess: messageAccessFor(state),
      canSendFriendRequest: canSendFriendRequest(state),
    };
  }
}
