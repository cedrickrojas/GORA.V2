import { Module } from '@nestjs/common';
import { SocialModule } from '../social/social.module';
import { SportsModule } from '../sports/sports.module';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { UsersModule } from '../users/users.module';
import { ProfileCoverController } from './profile-cover.controller';
import { ProfileCoverService } from './profile-cover.service';
import { ProfilePhotoController } from './profile-photo.controller';
import { ProfilePhotoService } from './profile-photo.service';
import { GoraPointsModule } from '../gora-points/gora-points.module';

@Module({
  imports: [SocialModule, SportsModule, UsersModule, GoraPointsModule],
  controllers: [ProfilesController, ProfileCoverController, ProfilePhotoController],
  providers: [ProfilesService, ProfileCoverService, ProfilePhotoService],
})
export class ProfilesModule {}
