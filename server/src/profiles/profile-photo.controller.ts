import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ProfilePhotoService } from './profile-photo.service';

@Controller('profiles')
export class ProfilePhotoController {
  constructor(private readonly photos: ProfilePhotoService) {}

  @Get(':userId/photo/:revision')
  async read(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('revision', new ParseUUIDPipe()) revision: string,
    @Res() response: Response,
  ): Promise<void> {
    const photo = await this.photos.read(userId, revision);
    response.set({ 'Content-Type': photo.contentType, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
    response.send(photo.data);
  }
}
