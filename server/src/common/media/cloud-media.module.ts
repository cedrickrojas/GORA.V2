import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { BlobGateway } from './blob.gateway';
import { CloudMediaController } from './cloud-media.controller';
import { CloudMediaService } from './cloud-media.service';
@Global()
@Module({
  imports: [AuthModule],
  controllers: [CloudMediaController],
  providers: [BlobGateway, CloudMediaService],
  exports: [CloudMediaService],
})
export class CloudMediaModule {}
