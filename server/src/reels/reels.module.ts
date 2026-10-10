import { Module } from '@nestjs/common';
import { SocialModule } from '../social/social.module';
import { UsersModule } from '../users/users.module';
import { ReelsController } from './reels.controller';
import { ReelsService } from './reels.service';
import { ReelVideoStorage } from './reel-video.storage';
import { ReelVideoController } from './reel-video.controller';

@Module({
  imports: [UsersModule, SocialModule],
  controllers: [ReelsController, ReelVideoController],
  providers: [ReelsService, ReelVideoStorage],
})
export class ReelsModule {}
