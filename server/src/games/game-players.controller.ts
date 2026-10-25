import {
  Controller,
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
import type { GameRosterView, MyParticipationView } from './game-player.types';
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
  leave(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('gameId', gameIdPipe) gameId: string,
  ): Promise<MyParticipationView> {
    return this.players.leave(viewer.id, gameId);
  }

  @Patch(':userId/remove')
  remove(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('gameId', gameIdPipe) gameId: string,
    @Param('userId', userIdPipe) userId: string,
  ): Promise<GameRosterView> {
    return this.players.remove(viewer.id, gameId, userId);
  }
}
