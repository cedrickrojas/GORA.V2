import { Module } from '@nestjs/common';
import { GoraPointsModule } from '../gora-points/gora-points.module';
import { ClubChatController } from './club-chat.controller';
import { ClubChatService } from './club-chat.service';
import { ClubsController } from './clubs.controller';
import { ClubsService } from './clubs.service';
import { ClubPhotosService } from './club-photos.service';
import { ClubPhotosController } from './club-photos.controller';

@Module({
  imports: [GoraPointsModule],
  controllers: [ClubsController, ClubChatController, ClubPhotosController],
  providers: [ClubsService, ClubChatService, ClubPhotosService],
})
export class ClubsModule {}
