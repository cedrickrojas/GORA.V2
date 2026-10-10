import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CurrentUser as CurrentUserContext } from '../users/user.types';
import {
  ClubChatMessagesQueryDto,
  SendClubChatMessageDto,
} from './dto/club-chat.dto';
import type {
  ClubChatMessagePage,
  ClubChatMessageView,
  ClubChatView,
} from './club-chat.types';
import { CLUB_NOT_FOUND_MESSAGE, ClubChatService } from './club-chat.service';

const clubIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException(CLUB_NOT_FOUND_MESSAGE),
});

/**
 * Club group chats only. There is no route that creates a group chat or adds people
 * to one: each club's chat is created with the club, and membership decides access.
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class ClubChatController {
  constructor(private readonly clubChat: ClubChatService) {}

  @Get('chat/clubs')
  list(@CurrentUser() viewer: CurrentUserContext): Promise<ClubChatView[]> {
    return this.clubChat.listForViewer(viewer.id);
  }

  @Get('clubs/:clubId/chat')
  getChat(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('clubId', clubIdPipe) clubId: string,
  ): Promise<ClubChatView> {
    return this.clubChat.getChat(viewer.id, clubId);
  }

  @Get('clubs/:clubId/chat/messages')
  listMessages(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('clubId', clubIdPipe) clubId: string,
    @Query() query: ClubChatMessagesQueryDto,
  ): Promise<ClubChatMessagePage> {
    return this.clubChat.listMessages(viewer.id, clubId, query);
  }

  @Post('clubs/:clubId/chat/messages')
  send(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('clubId', clubIdPipe) clubId: string,
    @Body() dto: SendClubChatMessageDto,
  ): Promise<ClubChatMessageView> {
    return this.clubChat.send(viewer.id, clubId, dto);
  }
}
