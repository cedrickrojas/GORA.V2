import { Module } from '@nestjs/common';
import { SocialModule } from '../social/social.module';
import { LiveController } from './live.controller';
import { LiveService } from './live.service';

@Module({
  imports: [SocialModule],
  controllers: [LiveController],
  providers: [LiveService],
})
export class LiveModule {}
