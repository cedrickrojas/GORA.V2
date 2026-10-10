import { Module } from '@nestjs/common';
import { SocialModule } from '../social/social.module';
import { DirectChatController } from './direct-chat.controller';
import { DirectChatService } from './direct-chat.service';

@Module({
  imports: [SocialModule],
  controllers: [DirectChatController],
  providers: [DirectChatService],
})
export class DirectChatModule {}
