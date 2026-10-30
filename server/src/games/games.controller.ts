import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CurrentUser as CurrentUserContext } from '../users/user.types';
import {
  CreateGameDto,
  ListGamesQueryDto,
  UpdateGameDto,
} from './dto/game.dto';
import { DiscoverGamesQueryDto } from './dto/discover-games.dto';
import { GameDiscoveryService } from './game-discovery.service';
import type {
  GameDiscoveryResult,
  GameView,
  JoinedGameView,
} from './game.types';
import { GAME_NOT_FOUND_MESSAGE, GamesService } from './games.service';

const gameIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException(GAME_NOT_FOUND_MESSAGE),
});

/** Game creation and the basic lifecycle. Join requests and players have their own controllers. */
@Controller('games')
@UseGuards(JwtAuthGuard)
export class GamesController {
  constructor(
    private readonly games: GamesService,
    private readonly discovery: GameDiscoveryService,
  ) {}

  @Post()
  create(
    @CurrentUser() viewer: CurrentUserContext,
    @Body() dto: CreateGameDto,
  ): Promise<GameView> {
    return this.games.create(viewer.id, dto);
  }

  @Get()
  list(
    @CurrentUser() viewer: CurrentUserContext,
    @Query() query: ListGamesQueryDto,
  ): Promise<GameView[]> {
    return this.games.list(viewer.id, query);
  }

  @Get('mine')
  listHosted(@CurrentUser() viewer: CurrentUserContext): Promise<GameView[]> {
    return this.games.listHosted(viewer.id);
  }

  @Get('playing')
  listPlaying(@CurrentUser() viewer: CurrentUserContext): Promise<GameView[]> {
    return this.games.listPlaying(viewer.id);
  }

  @Get('joined')
  listJoined(
    @CurrentUser() viewer: CurrentUserContext,
  ): Promise<JoinedGameView[]> {
    return this.games.listJoined(viewer.id);
  }

  /** Map and list discovery of real GORA games. Declared before :gameId on purpose. */
  @Get('discover')
  discover(
    @CurrentUser() viewer: CurrentUserContext,
    @Query() query: DiscoverGamesQueryDto,
  ): Promise<GameDiscoveryResult> {
    return this.discovery.discover(viewer.id, query);
  }

  @Get(':gameId')
  get(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('gameId', gameIdPipe) gameId: string,
  ): Promise<GameView> {
    return this.games.get(viewer.id, gameId);
  }

  @Patch(':gameId')
  update(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('gameId', gameIdPipe) gameId: string,
    @Body() dto: UpdateGameDto,
  ): Promise<GameView> {
    return this.games.update(viewer.id, gameId, dto);
  }

  @Patch(':gameId/cancel')
  cancel(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('gameId', gameIdPipe) gameId: string,
  ): Promise<GameView> {
    return this.games.cancel(viewer.id, gameId);
  }
}
