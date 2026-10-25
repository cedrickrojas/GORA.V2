import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CurrentUser as Viewer } from '../users/user.types';
import { LiveService } from './live.service';
import { LiveDescriptionDto, StartLiveDto } from './live.dto';

@Controller('live')
@UseGuards(JwtAuthGuard)
export class LiveController {
  constructor(private readonly live: LiveService) {}

  @Get() list(@CurrentUser() viewer: Viewer) {
    return this.live.list(viewer.id);
  }
  @Get('config') config(@CurrentUser() viewer: Viewer) {
    return this.live.config(viewer.id);
  }
  @Get('mine') mine(@CurrentUser() viewer: Viewer) {
    return this.live.mine(viewer.id);
  }
  @Post() start(@CurrentUser() viewer: Viewer, @Body() dto: StartLiveDto) {
    return this.live.start(viewer.id, dto.title);
  }
  @Get(':id') get(
    @CurrentUser() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.live.get(viewer.id, id);
  }
  @Delete(':id') end(
    @CurrentUser() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.live.end(viewer.id, id);
  }
  @Get(':id/peers') peers(
    @CurrentUser() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.live.peers(viewer.id, id);
  }
  @Post(':id/viewers') join(
    @CurrentUser() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.live.join(viewer.id, id);
  }
  @Get(':id/viewers/:peerId') poll(
    @CurrentUser() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('peerId', ParseUUIDPipe) peerId: string,
  ) {
    return this.live.poll(viewer.id, id, peerId);
  }
  @Delete(':id/viewers/:peerId') leave(
    @CurrentUser() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('peerId', ParseUUIDPipe) peerId: string,
  ) {
    return this.live.leave(viewer.id, id, peerId);
  }
  @Put(':id/viewers/:peerId/offer') offer(
    @CurrentUser() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('peerId', ParseUUIDPipe) peerId: string,
    @Body() dto: LiveDescriptionDto,
  ) {
    return this.live.signal(viewer.id, id, peerId, 'offer', dto.sdp);
  }
  @Put(':id/viewers/:peerId/answer') answer(
    @CurrentUser() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('peerId', ParseUUIDPipe) peerId: string,
    @Body() dto: LiveDescriptionDto,
  ) {
    return this.live.signal(viewer.id, id, peerId, 'answer', dto.sdp);
  }
}
