import {
  Controller,
  Body,
  BadRequestException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CurrentUser as CurrentUserContext } from '../users/user.types';
import type { GameLeaveRequestView, GameRosterView, MyParticipationView } from './game-player.types';
import {
  GamePlayersService,
  PLAYER_NOT_FOUND_MESSAGE,
} from './game-players.service';
import { GAME_NOT_FOUND_MESSAGE } from './games.service';

const gameIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException(GAME_NOT_FOUND_MESSAGE),
});

const userIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException(PLAYER_NOT_FOUND_MESSAGE),
});

/** The acting user always comes from the token; no body is read on any route. */
@Controller('games/:gameId/players')
@UseGuards(JwtAuthGuard)
export class GamePlayersController {
  constructor(private readonly players: GamePlayersService) {}

  @Get()
  roster(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('gameId', gameIdPipe) gameId: string,
  ): Promise<GameRosterView> {
    return this.players.roster(viewer.id, gameId);
  }

  @Get('me')
  mine(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('gameId', gameIdPipe) gameId: string,
  ): Promise<MyParticipationView> {
    return this.players.mine(viewer.id, gameId);
  }

  @Patch('me/leave')
  requestLeave(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('gameId', gameIdPipe) gameId: string,
  ): Promise<GameLeaveRequestView> {
    return this.players.requestLeave(viewer.id, gameId);
  }

  @Get('me/leave-request')
  myLeaveRequest(@CurrentUser() viewer: CurrentUserContext, @Param('gameId', gameIdPipe) gameId: string): Promise<GameLeaveRequestView | null> {
    return this.players.myLeaveRequest(viewer.id, gameId);
  }

  @Patch('me/leave-request/cancel')
  cancelLeaveRequest(@CurrentUser() viewer: CurrentUserContext, @Param('gameId', gameIdPipe) gameId: string): Promise<GameLeaveRequestView> {
    return this.players.cancelLeaveRequest(viewer.id, gameId);
  }

  @Get('leave-requests')
  hostLeaveRequests(@CurrentUser() viewer: CurrentUserContext, @Param('gameId', gameIdPipe) gameId: string): Promise<GameLeaveRequestView[]> {
    return this.players.hostLeaveRequests(viewer.id, gameId);
  }

  @Patch(':userId/leave-request')
  respondLeaveRequest(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('gameId', gameIdPipe) gameId: string,
    @Param('userId', userIdPipe) userId: string,
    @Body() body: { action: 'approve' | 'reject' },
  ): Promise<GameLeaveRequestView> {
    if (body?.action !== 'approve' && body?.action !== 'reject') {
      throw new BadRequestException('Action must be approve or reject.');
    }
    return this.players.respondLeaveRequest(viewer.id, gameId, userId, body.action === 'approve');
  }

  @Patch(':userId/remove')
  remove(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('gameId', gameIdPipe) gameId: string,
    @Param('userId', userIdPipe) userId: string,
  ): Promise<GameRosterView> {
    return this.players.remove(viewer.id, gameId, userId);
  }

  @Patch(':userId/attendance')
  markAttendance(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('gameId', gameIdPipe) gameId: string,
    @Param('userId', userIdPipe) userId: string,
    @Body() body: { action: 'attended' | 'no_show' },
  ): Promise<GameRosterView> {
    if (body?.action !== 'attended' && body?.action !== 'no_show') {
      throw new BadRequestException('Action must be attended or no_show.');
    }
    return this.players.markAttendance(viewer.id, gameId, userId, body.action === 'attended');
  }
}
