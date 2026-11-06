import { Module } from '@nestjs/common';
import { GoraPointsService } from './gora-points.service';
import { GoraRankingController } from './gora-ranking.controller';
import { GoraRankingService } from './gora-ranking.service';

@Module({
  controllers: [GoraRankingController],
  providers: [GoraPointsService, GoraRankingService],
  exports: [GoraPointsService],
})
export class GoraPointsModule {}
