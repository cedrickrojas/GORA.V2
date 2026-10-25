import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseUUIDPipe,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUser as Viewer } from '../../users/user.types';
import { CloudMediaService } from './cloud-media.service';
import { StartMediaUploadDto } from './cloud-media.dto';

@Controller('media/uploads')
@UseGuards(JwtAuthGuard)
export class CloudMediaController {
  constructor(private readonly media: CloudMediaService) {}
  @Get('config') config() {
    return { provider: this.media.provider() };
  }
  @Post() start(@CurrentUser() user: Viewer, @Body() dto: StartMediaUploadDto) {
    return this.media.start(user.id, dto);
  }
  @Delete(':id')
  @HttpCode(204)
  async cancel(
    @CurrentUser() user: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.media.cancel(user.id, id);
  }
}
