import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { DirectChatService } from './direct-chat.service';

@Controller('chat/direct')
export class ChatMediaController {
  constructor(private readonly chat: DirectChatService) {}
  @Get(':id/messages/:messageId/media')
  async read(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Query('token') token: unknown,
    @Res() res: Response,
  ) {
    const media = await this.chat.media(id, messageId, token);
    res
      .set({
        'Content-Type': media.contentType,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(media.data);
  }
}
