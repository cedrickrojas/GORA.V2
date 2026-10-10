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
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AddUserSportDto,
  UpdateUserSportDto,
} from '../sports/dto/user-sport.dto';
import type { UserSportView } from '../sports/sport.types';
import { userSportIdPipe } from '../sports/user-sports.controller';
import { UserSportsService } from '../sports/user-sports.service';
import type { CurrentUser as CurrentUserContext } from '../users/user.types';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { OwnProfileView, PublicProfileView } from './profile.types';
import { ProfilesService } from './profiles.service';

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
  ) {}

  @Get('me')
  getMe(@CurrentUser() viewer: CurrentUserContext): Promise<OwnProfileView> {
    return this.profiles.getOwn(viewer.id);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() viewer: CurrentUserContext,
    @Body() dto: UpdateProfileDto,
  ): Promise<OwnProfileView> {
    return this.profiles.update(viewer.id, dto);
  }

  @Get('me/sports')
  listMySports(
    @CurrentUser() viewer: CurrentUserContext,
  ): Promise<UserSportView[]> {
    return this.userSports.list(viewer.id);
  }

  @Post('me/sports')
  addMySport(
    @CurrentUser() viewer: CurrentUserContext,
    @Body() dto: AddUserSportDto,
  ): Promise<UserSportView> {
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
}
