import { Module } from '@nestjs/common';
import { SocialModule } from '../social/social.module';
import { UsersModule } from '../users/users.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PostPhotosController } from './post-photos.controller';
import { PostPhotosService } from './post-photos.service';
import { GoraPointsModule } from '../gora-points/gora-points.module';

@Module({
  imports: [UsersModule, SocialModule, GoraPointsModule],
  controllers: [PostsController, PostPhotosController],
  providers: [PostsService, PostPhotosService],
})
export class PostsModule {}
