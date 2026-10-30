import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CurrentUser as User } from '../users/user.types';
import {
  AdminPageQuery,
  AdminReportsQuery,
  AdminUsersQuery,
  UpdateAdminUserDto,
  UpdateReportDto,
  UpdateSportStatusDto,
} from './admin.dto';
import { AdminService } from './admin.service';
import { SuperAdminGuard } from './super-admin.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  @Header('Cache-Control', 'no-store')
  overview() {
    return this.admin.overview();
  }

  @Get('users')
  @Header('Cache-Control', 'no-store')
  users(@Query() query: AdminUsersQuery) {
    return this.admin.users(query);
  }

  @Patch('users/:id')
  updateUser(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAdminUserDto,
  ) {
    return this.admin.updateUser(actor.id, id, body);
  }

  @Get('reports')
  @Header('Cache-Control', 'no-store')
  reports(@Query() query: AdminReportsQuery) {
    return this.admin.reports(query);
  }

  @Patch('reports/:id')
  updateReport(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateReportDto,
  ) {
    return this.admin.updateReport(actor.id, id, body);
  }

  @Get('sports')
  @Header('Cache-Control', 'no-store')
  sports() {
    return this.admin.sports();
  }

  @Patch('sports/:id')
  updateSport(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateSportStatusDto,
  ) {
    return this.admin.updateSport(actor.id, id, body.isActive);
  }

  @Get('audit')
  @Header('Cache-Control', 'no-store')
  audit(@Query() query: AdminPageQuery) {
    return this.admin.audit(query);
  }
}
