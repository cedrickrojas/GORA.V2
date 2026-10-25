import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PostPhotosService } from './post-photos.service';

@Controller('posts')
export class PostPhotosController {
  constructor(private readonly photos: PostPhotosService) {}

  @Get(':postId/media/:mediaId')
  async read(
    @Param('postId', new ParseUUIDPipe()) postId: string,
    @Param('mediaId', new ParseUUIDPipe()) mediaId: string,
    @Query('token') token: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const photo = await this.photos.read(postId, mediaId, token);
    response.set({
      'Content-Type': photo.contentType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.send(photo.data);
  }
}
