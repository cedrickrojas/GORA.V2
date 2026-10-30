import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CurrentUser as CurrentUserContext } from '../users/user.types';
import { CLUB_NOT_FOUND_MESSAGE } from './club-chat.service';
import { ClubsService } from './clubs.service';
import type {
  ClubInviteView,
  ClubJoinRequestView,
  ClubJoinResult,
  ClubMemberView,
  ClubView,
} from './clubs.types';
import {
  CreateClubDto,
  InviteClubMemberDto,
  UpdateClubDto,
} from './dto/club.dto';

const clubIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException(CLUB_NOT_FOUND_MESSAGE),
});
const userIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException('User not found.'),
});

/** Clubs, their settings, and membership. The official club chat lives in ClubChatController. */
@Controller('clubs')
@UseGuards(JwtAuthGuard)
export class ClubsController {
  constructor(private readonly clubs: ClubsService) {}

  @Post()
  create(
    @CurrentUser() viewer: CurrentUserContext,
    @Body() dto: CreateClubDto,
  ): Promise<ClubView> {
    return this.clubs.create(viewer.id, dto);
  }

  @Get('mine')
  listMine(@CurrentUser() viewer: CurrentUserContext): Promise<ClubView[]> {
    return this.clubs.listMine(viewer.id);
  }

  /** Recent clubs visible to the viewer for Home and Discover feeds. */
  @Get('feed')
  listFeed(@CurrentUser() viewer: CurrentUserContext): Promise<ClubView[]> {
    return this.clubs.listFeed(viewer.id);
  }

  @Get(':clubId')
  get(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('clubId', clubIdPipe) clubId: string,
  ): Promise<ClubView> {
    return this.clubs.get(viewer.id, clubId);
  }

  @Patch(':clubId')
  update(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('clubId', clubIdPipe) clubId: string,
    @Body() dto: UpdateClubDto,
  ): Promise<ClubView> {
    return this.clubs.update(viewer.id, clubId, dto);
  }

  @Post(':clubId/join')
  @HttpCode(HttpStatus.OK)
  join(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('clubId', clubIdPipe) clubId: string,
  ): Promise<ClubJoinResult> {
    return this.clubs.join(viewer.id, clubId);
  }

  @Post(':clubId/leave')
  @HttpCode(HttpStatus.OK)
  leave(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('clubId', clubIdPipe) clubId: string,
  ): Promise<ClubView> {
    return this.clubs.leave(viewer.id, clubId);
  }

  @Get(':clubId/members')
  listMembers(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('clubId', clubIdPipe) clubId: string,
  ): Promise<ClubMemberView[]> {
    return this.clubs.listMembers(viewer.id, clubId);
  }

  @Get(':clubId/members/requests')
  listRequests(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('clubId', clubIdPipe) clubId: string,
  ): Promise<ClubJoinRequestView[]> {
    return this.clubs.listRequests(viewer.id, clubId);
  }

  @Post(':clubId/members/:userId/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('clubId', clubIdPipe) clubId: string,
    @Param('userId', userIdPipe) userId: string,
  ): Promise<ClubMemberView> {
    return this.clubs.approve(viewer.id, clubId, userId);
  }

  @Post(':clubId/members/:userId/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('clubId', clubIdPipe) clubId: string,
    @Param('userId', userIdPipe) userId: string,
  ): Promise<{ userId: string; status: 'REJECTED' }> {
    return this.clubs.reject(viewer.id, clubId, userId);
  }

  @Post(':clubId/members/:userId/remove')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('clubId', clubIdPipe) clubId: string,
    @Param('userId', userIdPipe) userId: string,
  ): Promise<{ userId: string; status: 'REMOVED' }> {
    return this.clubs.remove(viewer.id, clubId, userId);
  }

  @Get(':clubId/invites')
  listInvites(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('clubId', clubIdPipe) clubId: string,
  ): Promise<ClubInviteView[]> {
    return this.clubs.listInvites(viewer.id, clubId);
  }

  @Post(':clubId/invites')
  invite(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('clubId', clubIdPipe) clubId: string,
    @Body() dto: InviteClubMemberDto,
  ): Promise<ClubInviteView> {
    return this.clubs.invite(viewer.id, clubId, dto);
  }
}
