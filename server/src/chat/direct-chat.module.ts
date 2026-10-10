import { Module } from '@nestjs/common';
import { SocialModule } from '../social/social.module';
import { DirectChatController } from './direct-chat.controller';
import { DirectChatService } from './direct-chat.service';
import { ChatMediaController } from './chat-media.controller';
import { DirectCallController } from './direct-call.controller';
import { DirectCallService } from './direct-call.service';

@Module({
  imports: [SocialModule],
  controllers: [
    DirectChatController,
    ChatMediaController,
    DirectCallController,
  ],
  providers: [DirectChatService, DirectCallService],
})
export class DirectChatModule {}
