import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ClubsModule } from './clubs/clubs.module';
import { AppConfigModule } from './config/app-config.module';
import { GamesModule } from './games/games.module';
import { HealthModule } from './health/health.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfilesModule } from './profiles/profiles.module';
import { ReelsModule } from './reels/reels.module';
import { SocialModule } from './social/social.module';
import { SportsModule } from './sports/sports.module';
import { StoriesModule } from './stories/stories.module';
import { UsersModule } from './users/users.module';
import { DirectChatModule } from './chat/direct-chat.module';
import { LiveModule } from './live/live.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    SocialModule,
    PostsModule,
    SportsModule,
    ProfilesModule,
    ClubsModule,
    GamesModule,
    StoriesModule,
    ReelsModule,
    DirectChatModule,
    LiveModule,
    NotificationsModule,
  ],
})
export class AppModule {}
