import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClubChatMessagesQueryDto } from '../clubs/dto/club-chat.dto';
import type { CurrentUser as Viewer } from '../users/user.types';
import { DirectChatService } from './direct-chat.service';
import {
  ReactToMessageDto,
  SendDirectMessageDto,
  AttachMessageDto,
  ForwardMessageDto,
  PinMessageDto,
  ReportMessageDto,
} from './direct-chat.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class DirectChatController {
  constructor(private readonly chat: DirectChatService) {}

  @Post('direct/:id/attachments')
  attach(
    @CurrentUser() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachMessageDto,
  ) {
    return this.chat.attach(viewer.id, id, dto.data);
  }

  @Get('direct/:id/pins')
  pins(@CurrentUser() viewer: Viewer, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.pins(viewer.id, id);
  }

  @Delete('direct/:id/messages/:messageId')
  unsend(
    @CurrentUser() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.chat.unsend(viewer.id, id, messageId);
  }

  @Put('direct/:id/messages/:messageId/pin')
  pin(
    @CurrentUser() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: PinMessageDto,
  ) {
    return this.chat.pin(viewer.id, id, messageId, dto.pinned);
  }

  @Post('direct/:id/messages/:messageId/forward')
  forward(
    @CurrentUser() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: ForwardMessageDto,
  ) {
    return this.chat.forward(viewer.id, id, messageId, dto.conversationId);
  }

  @Post('direct/:id/messages/:messageId/report')
  report(
    @CurrentUser() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: ReportMessageDto,
  ) {
    return this.chat.report(
      viewer.id,
      id,
      messageId,
      dto.reason,
      dto.description,
    );
  }

  @Get('direct')
  list(@CurrentUser() viewer: Viewer) {
    return this.chat.list(viewer.id);
  }

  @Post('direct/:userId')
  open(
    @CurrentUser() viewer: Viewer,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.chat.open(viewer.id, userId);
  }

  @Get('direct/:id')
  get(@CurrentUser() viewer: Viewer, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.get(viewer.id, id);
  }

  @Get('direct/:id/messages')
  messages(
    @CurrentUser() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ClubChatMessagesQueryDto,
  ) {
    return this.chat.messages(viewer.id, id, query);
  }

  @Post('direct/:id/messages')
  send(
    @CurrentUser() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendDirectMessageDto,
  ) {
    return this.chat.send(viewer.id, id, dto.body);
  }

  @Put('direct/:id/read')
  read(@CurrentUser() viewer: Viewer, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.read(viewer.id, id);
  }

  @Put('direct/:id/messages/:messageId/reaction')
  react(
    @CurrentUser() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: ReactToMessageDto,
  ) {
    return this.chat.react(viewer.id, id, messageId, dto.emoji);
  }

  @Delete('direct/:id/messages/:messageId/reaction')
  removeReaction(
    @CurrentUser() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.chat.react(viewer.id, id, messageId, null);
  }

  @Get('requests')
  requests(@CurrentUser() viewer: Viewer) {
    return this.chat.requests(viewer.id);
  }

  @Get('recipients/:userId')
  recipient(
    @CurrentUser() viewer: Viewer,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.chat.recipient(viewer.id, userId);
  }

  @Post('requests/:userId')
  request(
    @CurrentUser() viewer: Viewer,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: SendDirectMessageDto,
  ) {
    return this.chat.request(viewer.id, userId, dto.body);
  }

  @Post('requests/:id/accept')
  accept(
    @CurrentUser() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chat.accept(viewer.id, id);
  }

  @Delete('requests/:id')
  reject(
    @CurrentUser() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.chat.reject(viewer.id, id);
  }
}
