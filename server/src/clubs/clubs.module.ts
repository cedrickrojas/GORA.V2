import { Module } from '@nestjs/common';
import { GoraPointsModule } from '../gora-points/gora-points.module';
import { ClubChatController } from './club-chat.controller';
import { ClubChatService } from './club-chat.service';
import { ClubsController } from './clubs.controller';
import { ClubsService } from './clubs.service';

@Module({
  imports: [GoraPointsModule],
  controllers: [ClubsController, ClubChatController],
  providers: [ClubsService, ClubChatService],
})
export class ClubsModule {}
