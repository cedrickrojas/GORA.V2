import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ClubPhotosService } from './club-photos.service';

/** Club identity photos are visible wherever the club's name/avatar is listed. */
@Controller('clubs')
export class ClubPhotosController {
  constructor(private readonly photos: ClubPhotosService) {}

  @Get(':clubId/photos/:kind/:revision')
  async read(
    @Param('clubId', new ParseUUIDPipe()) clubId: string,
    @Param('kind') kind: string,
    @Param('revision', new ParseUUIDPipe()) revision: string,
    @Res() response: Response,
  ): Promise<void> {
    const photo = await this.photos.read(clubId, kind, revision);
    response.set({
      'Content-Type': photo.contentType,
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    response.send(photo.data);
  }
}
