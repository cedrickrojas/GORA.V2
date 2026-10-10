import { Module } from '@nestjs/common';
import { SocialModule } from '../social/social.module';
import { UsersModule } from '../users/users.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [UsersModule, SocialModule],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
