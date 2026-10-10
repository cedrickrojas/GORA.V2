import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CurrentUser as CurrentUserContext } from '../users/user.types';
import { CreateJoinRequestDto } from './dto/join-request.dto';
import { GAME_NOT_FOUND_MESSAGE } from './games.service';
import type {
  HostJoinRequestView,
  JoinRequestView,
} from './join-request.types';
import {
  JOIN_REQUEST_NOT_FOUND_MESSAGE,
  JoinRequestsService,
} from './join-requests.service';

const gameIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException(GAME_NOT_FOUND_MESSAGE),
});

const requestIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException(JOIN_REQUEST_NOT_FOUND_MESSAGE),
});

/** The requester and the host always come from the token, never from the body. */
@Controller('games/:gameId/join-requests')
@UseGuards(JwtAuthGuard)
export class JoinRequestsController {
  constructor(private readonly joinRequests: JoinRequestsService) {}

  @Post()
  create(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('gameId', gameIdPipe) gameId: string,
    @Body() dto: CreateJoinRequestDto,
  ): Promise<JoinRequestView> {
    return this.joinRequests.create(viewer.id, gameId, dto);
  }

  @Get('me')
  async findMine(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('gameId', gameIdPipe) gameId: string,
  ): Promise<{ joinRequest: JoinRequestView | null }> {
    return {
      joinRequest: await this.joinRequests.findMine(viewer.id, gameId),
    };
  }

  @Patch('me/cancel')
  cancelMine(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('gameId', gameIdPipe) gameId: string,
  ): Promise<JoinRequestView> {
    return this.joinRequests.cancelMine(viewer.id, gameId);
  }

  @Get()
  listForHost(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('gameId', gameIdPipe) gameId: string,
  ): Promise<HostJoinRequestView[]> {
    return this.joinRequests.listForHost(viewer.id, gameId);
  }

  @Patch(':requestId/accept')
  accept(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('gameId', gameIdPipe) gameId: string,
    @Param('requestId', requestIdPipe) requestId: string,
  ): Promise<HostJoinRequestView> {
    return this.joinRequests.accept(viewer.id, gameId, requestId);
  }

  @Patch(':requestId/reject')
  reject(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('gameId', gameIdPipe) gameId: string,
    @Param('requestId', requestIdPipe) requestId: string,
  ): Promise<HostJoinRequestView> {
    return this.joinRequests.reject(viewer.id, gameId, requestId);
  }
}
