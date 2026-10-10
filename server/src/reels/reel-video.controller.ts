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
import { ReelsService } from './reels.service';
import { ReelVideoStorage } from './reel-video.storage';

@Controller('reels')
export class ReelVideoController {
  constructor(
    private readonly videos: ReelVideoStorage,
    private readonly reels: ReelsService,
    private readonly users: UsersService,
  ) {}

  @Get(':reelId/video')
  async play(
    @Param('reelId', new ParseUUIDPipe()) reelId: string,
    @Query('token') token: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const viewerId = this.videos.viewer(reelId, token);
    if (!(await this.users.findActiveById(viewerId)))
      throw new NotFoundException('Video not found.');
    // Recheck current friendship, blocks, audience and deletion on every range request.
    const file = await this.reels.uploadedVideo(viewerId, reelId);
    await sendPrivateMedia(response, file);
  }
}
