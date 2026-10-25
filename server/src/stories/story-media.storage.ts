import { Injectable, Optional } from '@nestjs/common';
import { CloudMediaService } from '../common/media/cloud-media.service';
import { ConfigService } from '@nestjs/config';
import { PrivateMediaStorage } from '../common/media/private-media.storage';

@Injectable()
export class StoryMediaStorage extends PrivateMediaStorage {
  constructor(config: ConfigService, @Optional() cloud?: CloudMediaService) {
    super(config, 'STORY_UPLOAD_DIR', 'stories', 'media', cloud);
  }
}
