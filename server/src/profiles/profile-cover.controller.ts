import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ProfileCoverService } from './profile-cover.service';

@Controller('profiles')
export class ProfileCoverController {
  constructor(private readonly covers: ProfileCoverService) {}

  @Get(':userId/cover/:revision')
  async read(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Param('revision', new ParseUUIDPipe()) revision: string,
    @Query('token') token: unknown,
    @Res() response: Response,
  ): Promise<void> {
    const photo = await this.covers.read(userId, revision, token);
    response.set({
      'Content-Type': photo.contentType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.send(photo.data);
  }
}
