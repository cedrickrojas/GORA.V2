import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CurrentUser as Viewer } from '../users/user.types';
import { GoraRankingQuery } from './gora-ranking.dto';
import { GoraRankingService } from './gora-ranking.service';

@Controller('gora-points')
@UseGuards(JwtAuthGuard)
export class GoraRankingController {
  constructor(private readonly rankings: GoraRankingService) {}

  @Get('ranking')
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentUser() viewer: Viewer, @Query() query: GoraRankingQuery) {
    return this.rankings.list(viewer.id, query);
  }
}
