import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  ParseUUIDPipe,
  Body,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CurrentUser as Viewer } from '../users/user.types';
import { DirectCallService } from './direct-call.service';
import {
  StartCallDto,
  AnswerCallDto,
  CallCandidateDto,
} from './direct-call.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class DirectCallController {
  constructor(private readonly calls: DirectCallService) {}
  @Post('direct/:id/calls') start(
    @CurrentUser() user: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StartCallDto,
  ) {
    return this.calls.start(user.id, id, dto.mode, dto.offer);
  }
  @Get('calls/incoming') incoming(@CurrentUser() user: Viewer) {
    return this.calls.incoming(user.id);
  }
  @Get('calls/:id') get(
    @CurrentUser() user: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calls.get(user.id, id);
  }
  @Put('calls/:id/answer') answer(
    @CurrentUser() user: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AnswerCallDto,
  ) {
    return this.calls.answer(user.id, id, dto.answer);
  }
  @Post('calls/:id/candidates') candidate(
    @CurrentUser() user: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CallCandidateDto,
  ) {
    return this.calls.candidate(user.id, id, dto);
  }
  @Delete('calls/:id') end(
    @CurrentUser() user: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calls.end(user.id, id);
  }
}
