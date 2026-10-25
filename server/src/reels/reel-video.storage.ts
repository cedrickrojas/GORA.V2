import { Injectable, Optional } from '@nestjs/common';
import { CloudMediaService } from '../common/media/cloud-media.service';
import { ConfigService } from '@nestjs/config';
import { PrivateMediaStorage } from '../common/media/private-media.storage';
export { VIDEO_MAX_BYTES as REEL_VIDEO_MAX_BYTES } from '../common/media/private-media.storage';
export type { MediaUploadFile as ReelVideoFile } from '../common/media/private-media.storage';

@Injectable()
export class ReelVideoStorage extends PrivateMediaStorage {
  constructor(config: ConfigService, @Optional() cloud?: CloudMediaService) {
    super(config, 'REEL_UPLOAD_DIR', 'reels', 'video', cloud);
  }
}
