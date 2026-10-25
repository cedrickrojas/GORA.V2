import { Module } from '@nestjs/common';
import { SocialModule } from '../social/social.module';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';
import { UsersModule } from '../users/users.module';
import { StoryMediaStorage } from './story-media.storage';
import { StoryMediaController } from './story-media.controller';

@Module({
  imports: [SocialModule, UsersModule],
  controllers: [StoriesController, StoryMediaController],
  providers: [StoriesService, StoryMediaStorage],
})
export class StoriesModule {}
