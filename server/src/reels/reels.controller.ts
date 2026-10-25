import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { REEL_VIDEO_MAX_BYTES, type ReelVideoFile } from './reel-video.storage';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ListPostsQueryDto } from '../posts/dto/post.dto';
import type { CurrentUser as CurrentUserContext } from '../users/user.types';
import {
  CreateReelDto,
  UpdateReelDto,
  UpdateReelVisibilityDto,
  UploadReelDto,
  CompleteReelUploadDto,
} from './dto/reel.dto';
import type { DeletedReelView, ReelPage, ReelView } from './reel.types';
import { REEL_NOT_FOUND_MESSAGE, ReelsService } from './reels.service';

const reelIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException(REEL_NOT_FOUND_MESSAGE),
});

@Controller()
@UseGuards(JwtAuthGuard)
export class ReelsController {
  constructor(private readonly reelsService: ReelsService) {}

  @Post('reels/upload/complete')
  complete(
    @CurrentUser() viewer: CurrentUserContext,
    @Body() dto: CompleteReelUploadDto,
  ) {
    return this.reelsService.complete(viewer.id, dto);
  }

  @Post('reels/upload')
  @UseInterceptors(
    FileInterceptor('video', {
      limits: {
        fileSize: REEL_VIDEO_MAX_BYTES,
        files: 1,
        fields: 5,
        fieldSize: 16 * 1024,
      },
    }),
  )
  upload(
    @CurrentUser() viewer: CurrentUserContext,
    @Body() dto: UploadReelDto,
    @UploadedFile() file: ReelVideoFile | undefined,
  ): Promise<ReelView> {
    return this.reelsService.upload(viewer.id, dto, file);
  }

  @Post('reels')
  create(
    @CurrentUser() viewer: CurrentUserContext,
    @Body() dto: CreateReelDto,
  ): Promise<ReelView> {
    return this.reelsService.create(viewer.id, dto);
  }

  @Get('reels')
  listFeed(
    @CurrentUser() viewer: CurrentUserContext,
    @Query() query: ListPostsQueryDto,
  ): Promise<ReelPage> {
    return this.reelsService.listFeed(viewer.id, query);
  }

  @Get('reels/:reelId')
  findOne(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('reelId', reelIdPipe) reelId: string,
  ): Promise<ReelView> {
    return this.reelsService.findVisible(viewer.id, reelId);
  }

  @Patch('reels/:reelId')
  update(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('reelId', reelIdPipe) reelId: string,
    @Body() dto: UpdateReelDto,
  ): Promise<ReelView> {
    return this.reelsService.update(viewer.id, reelId, dto);
  }

  @Put('reels/:reelId/like')
  like(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('reelId', reelIdPipe) reelId: string,
  ): Promise<ReelView> {
    return this.reelsService.setLike(viewer.id, reelId, true);
  }

  @Delete('reels/:reelId/like')
  unlike(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('reelId', reelIdPipe) reelId: string,
  ): Promise<ReelView> {
    return this.reelsService.setLike(viewer.id, reelId, false);
  }

  @Patch('reels/:reelId/visibility')
  updateVisibility(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('reelId', reelIdPipe) reelId: string,
    @Body() dto: UpdateReelVisibilityDto,
  ): Promise<ReelView> {
    return this.reelsService.updateVisibility(viewer.id, reelId, dto);
  }

  @Delete('reels/:reelId')
  remove(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('reelId', reelIdPipe) reelId: string,
  ): Promise<DeletedReelView> {
    return this.reelsService.remove(viewer.id, reelId);
  }

  @Get('users/:username/reels')
  listByAuthor(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('username') username: string,
    @Query() query: ListPostsQueryDto,
  ): Promise<ReelPage> {
    return this.reelsService.listByAuthor(viewer.id, username, query);
  }
}
