import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CurrentUser as Viewer } from '../users/user.types';
import { ListNotificationsDto } from './notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() viewer: Viewer, @Query() query: ListNotificationsDto) {
    return this.notifications.list(viewer.id, query);
  }
  @Patch('read-all')
  markAllRead(@CurrentUser() viewer: Viewer) {
    return this.notifications.markAllRead(viewer.id);
  }
  @Patch('help-requests/read-all')
  markHelpRequestsRead(@CurrentUser() viewer: Viewer) {
    return this.notifications.markHelpRequestsRead(viewer.id);
  }
  @Patch(':id/read')
  markRead(
    @CurrentUser() viewer: Viewer,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.notifications.markRead(viewer.id, id);
  }
}
