import {
  Body,
  Controller,
  Delete,
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
import { AddUserSportDto, UpdateUserSportDto } from './dto/user-sport.dto';
import type { UserSportView } from './sport.types';
import {
  USER_SPORT_NOT_FOUND_MESSAGE,
  UserSportsService,
} from './user-sports.service';

export const userSportIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException(USER_SPORT_NOT_FOUND_MESSAGE),
});

/**
 * The signed-in user's sports. "me" is a reserved username, so these routes never clash
 * with /users/:username/*, and there is no route that accepts another user's id.
 */
@Controller('users/me/sports')
@UseGuards(JwtAuthGuard)
export class UserSportsController {
  constructor(private readonly userSports: UserSportsService) {}

  @Get()
  list(@CurrentUser() viewer: CurrentUserContext): Promise<UserSportView[]> {
    return this.userSports.list(viewer.id);
  }

  @Post()
  add(
    @CurrentUser() viewer: CurrentUserContext,
    @Body() dto: AddUserSportDto,
  ): Promise<UserSportView> {
    return this.userSports.add(viewer.id, dto);
  }

  @Patch(':sportId')
  update(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('sportId', userSportIdPipe) sportId: string,
    @Body() dto: UpdateUserSportDto,
  ): Promise<UserSportView> {
    return this.userSports.update(viewer.id, sportId, dto);
  }

  @Delete(':sportId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('sportId', userSportIdPipe) sportId: string,
  ): Promise<void> {
    return this.userSports.remove(viewer.id, sportId);
  }
}
