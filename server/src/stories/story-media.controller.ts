import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { sendPrivateMedia } from '../common/media/send-private-media';
import { UsersService } from '../users/users.service';
import { StoriesService } from './stories.service';
import { StoryMediaStorage } from './story-media.storage';

@Controller('stories')
export class StoryMediaController {
  constructor(
    private readonly media: StoryMediaStorage,
    private readonly stories: StoriesService,
    private readonly users: UsersService,
  ) {}

  @Get(':storyId/media')
  async play(
    @Param('storyId', new ParseUUIDPipe()) storyId: string,
    @Query('token') token: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const viewerId = this.media.viewer(storyId, token);
    if (!(await this.users.findActiveById(viewerId)))
      throw new NotFoundException('Story not found.');
    await sendPrivateMedia(
      response,
      await this.stories.uploadedMedia(viewerId, storyId),
    );
  }
}
