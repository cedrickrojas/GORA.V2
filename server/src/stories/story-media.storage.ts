import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrivateMediaStorage } from '../common/media/private-media.storage';

@Injectable()
export class StoryMediaStorage extends PrivateMediaStorage {
  constructor(config: ConfigService) {
    super(config, 'STORY_UPLOAD_DIR', 'stories', 'media');
  }
}
