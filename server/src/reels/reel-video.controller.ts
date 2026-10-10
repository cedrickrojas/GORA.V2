import {
  Controller,
  Get,
  HttpException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
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
    await new Promise<void>((resolve, reject) =>
      response.sendFile(
        file.path,
        {
          headers: {
            'Content-Type': file.contentType,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
          },
        },
        (error: Error | undefined) => {
          if (!error) {
            resolve();
            return;
          }
          if (response.headersSent) {
            response.destroy(error);
            resolve();
            return;
          }
          if ('statusCode' in error && error.statusCode === 416)
            reject(new HttpException('Video range is not satisfiable.', 416));
          else if ('code' in error && error.code === 'ENOENT')
            reject(new NotFoundException('Video not found.'));
          else reject(error);
        },
      ),
    );
  }
}
