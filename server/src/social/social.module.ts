import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AudienceService } from './audience.service';
import { RelationshipController } from './relationship.controller';
import { RelationshipService } from './relationship.service';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';

@Module({
  imports: [UsersModule],
  controllers: [RelationshipController, FriendsController],
  providers: [RelationshipService, AudienceService, FriendsService],
  exports: [RelationshipService, AudienceService],
})
export class SocialModule {}
