import { Module } from '@nestjs/common';
import { ClubChatController } from './club-chat.controller';
import { ClubChatService } from './club-chat.service';
import { ClubsController } from './clubs.controller';
import { ClubsService } from './clubs.service';

@Module({
  controllers: [ClubsController, ClubChatController],
  providers: [ClubsService, ClubChatService],
})
export class ClubsModule {}
