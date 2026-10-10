import { Module } from '@nestjs/common';
import { GameDiscoveryService } from './game-discovery.service';
import { GamePlayersController } from './game-players.controller';
import { GamePlayersService } from './game-players.service';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { JoinRequestsController } from './join-requests.controller';
import { JoinRequestsService } from './join-requests.service';

@Module({
  controllers: [GamesController, JoinRequestsController, GamePlayersController],
  providers: [
    GamesService,
    GameDiscoveryService,
    JoinRequestsService,
    GamePlayersService,
  ],
  exports: [
    GamesService,
    GameDiscoveryService,
    JoinRequestsService,
    GamePlayersService,
  ],
})
export class GamesModule {}
