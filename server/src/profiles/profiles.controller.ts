import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddUserSportDto, UpdateUserSportDto } from '../sports/dto/user-sport.dto';
import type { UserSportView } from '../sports/sport.types';
import { userSportIdPipe } from '../sports/user-sports.controller';
import { UserSportsService } from '../sports/user-sports.service';
import type { CurrentUser as CurrentUserContext } from '../users/user.types';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { OwnProfileView, PublicProfileView } from './profile.types';
import { ProfilesService } from './profiles.service';
import { ProfileCoverService } from './profile-cover.service';
import { UploadCoverDto } from './dto/upload-cover.dto';
import { ReportProfileDto } from './dto/report-profile.dto';
import { HelpRequestDto } from './dto/help-request.dto';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';

/**
 * Every write targets the signed-in user ("me"), so nobody can edit another profile:
 * there is no route that accepts someone else's id. The me/sports routes are aliases of
 * /users/me/sports (same service, same rules), kept for existing clients.
 */
@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly userSports: UserSportsService,
    private readonly covers: ProfileCoverService,
  ) {}

  @Post('help')
  sendHelpRequest(@CurrentUser() viewer: CurrentUserContext, @Body() dto: HelpRequestDto) {
    return this.profiles.sendHelpRequest(viewer.id, dto.message);
  }

  @Get('me/settings')
  getMySettings(@CurrentUser() viewer: CurrentUserContext) {
    return this.profiles.getSettings(viewer.id);
  }

  @Patch('me/settings')
  updateMySettings(@CurrentUser() viewer: CurrentUserContext, @Body() dto: UpdateUserSettingsDto) {
    return this.profiles.updateSettings(viewer.id, dto);
  }

  @Put('me/cover')
  async uploadCover(@CurrentUser() viewer: CurrentUserContext, @Body() dto: UploadCoverDto): Promise<OwnProfileView> {
    await this.covers.save(viewer.id, dto.photo);
    return this.profiles.getOwn(viewer.id);
  }

  @Delete('me/cover')
  async removeCover(@CurrentUser() viewer: CurrentUserContext): Promise<OwnProfileView> {
    await this.covers.remove(viewer.id);
    return this.profiles.getOwn(viewer.id);
  }

  @Get('me')
  getMe(@CurrentUser() viewer: CurrentUserContext): Promise<OwnProfileView> {
    return this.profiles.getOwn(viewer.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() viewer: CurrentUserContext, @Body() dto: UpdateProfileDto): Promise<OwnProfileView> {
    return this.profiles.update(viewer.id, dto);
  }

  @Get('me/sports')
  listMySports(@CurrentUser() viewer: CurrentUserContext): Promise<UserSportView[]> {
    return this.userSports.list(viewer.id);
  }

  @Post('me/sports')
  addMySport(@CurrentUser() viewer: CurrentUserContext, @Body() dto: AddUserSportDto): Promise<UserSportView> {
    return this.userSports.add(viewer.id, dto);
  }

  @Patch('me/sports/:sportId')
  updateMySport(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('sportId', userSportIdPipe) sportId: string,
    @Body() dto: UpdateUserSportDto,
  ): Promise<UserSportView> {
    return this.userSports.update(viewer.id, sportId, dto);
  }

  @Delete('me/sports/:sportId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMySport(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('sportId', userSportIdPipe) sportId: string,
  ): Promise<void> {
    return this.userSports.remove(viewer.id, sportId);
  }

  @Get(':username')
  getByUsername(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('username') username: string,
  ): Promise<OwnProfileView | PublicProfileView> {
    return this.profiles.getByUsername(viewer.id, username);
  }

  @Post(':username/report')
  reportUser(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('username') username: string,
    @Body() dto: ReportProfileDto,
  ) {
    return this.profiles.reportUser(viewer.id, username, dto.reason, dto.description);
  }
}
