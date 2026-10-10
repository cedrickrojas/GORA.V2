import { Module } from '@nestjs/common';
import { SocialModule } from '../social/social.module';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';

@Module({
  imports: [SocialModule],
  controllers: [StoriesController],
  providers: [StoriesService],
})
export class StoriesModule {}
