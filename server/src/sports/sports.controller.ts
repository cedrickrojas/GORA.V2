import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { SportView } from './sport.types';
import { SportsService } from './sports.service';
import { SPORT_NOT_FOUND_MESSAGE } from './user-sports.service';

const sportIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException(SPORT_NOT_FOUND_MESSAGE),
});

/** GET only: there is deliberately no route to create, edit, activate, or delete a sport. */
@Controller('sports')
@UseGuards(JwtAuthGuard)
export class SportsController {
  constructor(private readonly sports: SportsService) {}

  /** The sports a user can pick (profile, games, posts, filters). */
  @Get()
  listActive(): Promise<SportView[]> {
    return this.sports.listActive();
  }

  @Get(':id')
  findOne(@Param('id', sportIdPipe) id: string): Promise<SportView> {
    return this.sports.findOne(id);
  }
}
