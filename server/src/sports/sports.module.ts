import { Module } from '@nestjs/common';
import { SportsController } from './sports.controller';
import { SportsService } from './sports.service';
import { UserSportsController } from './user-sports.controller';
import { UserSportsService } from './user-sports.service';

@Module({
  controllers: [SportsController, UserSportsController],
  providers: [SportsService, UserSportsService],
  exports: [UserSportsService],
})
export class SportsModule {}
