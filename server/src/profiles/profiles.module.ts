import { Module } from '@nestjs/common';
import { SocialModule } from '../social/social.module';
import { SportsModule } from '../sports/sports.module';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [SocialModule, SportsModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
})
export class ProfilesModule {}
