import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CurrentUser as Viewer } from '../users/user.types';
import { FriendsService } from './friends.service';
import { SearchPlayersDto } from './dto/search-players.dto';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Get()
  list(@CurrentUser() viewer: Viewer) {
    return this.friends.list(viewer.id);
  }

  @Get('players')
  search(@CurrentUser() viewer: Viewer, @Query() query: SearchPlayersDto) {
    return this.friends.search(viewer.id, query.q ?? '');
  }

  @Post('requests/:username')
  send(@CurrentUser() viewer: Viewer, @Param('username') username: string) {
    return this.friends.send(viewer.id, username);
  }

  @Post('requests/:id/accept')
  accept(@CurrentUser() viewer: Viewer, @Param('id', ParseUUIDPipe) id: string) {
    return this.friends.accept(viewer.id, id);
  }

  @Delete('requests/:id')
  dismiss(@CurrentUser() viewer: Viewer, @Param('id', ParseUUIDPipe) id: string) {
    return this.friends.dismiss(viewer.id, id);
  }

  @Delete('blocks/:username')
  unblock(@CurrentUser() viewer: Viewer, @Param('username') username: string) {
    return this.friends.remove(viewer.id, username, true);
  }

  @Post('blocks/:username')
  block(@CurrentUser() viewer: Viewer, @Param('username') username: string) {
    return this.friends.block(viewer.id, username);
  }

  @Delete(':username')
  remove(@CurrentUser() viewer: Viewer, @Param('username') username: string) {
    return this.friends.remove(viewer.id, username);
  }
}
