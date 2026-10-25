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
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  VIDEO_MAX_BYTES,
  type MediaUploadFile,
} from '../common/media/private-media.storage';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CurrentUser as CurrentUserContext } from '../users/user.types';
import {
  CreateStoryDto,
  UpdateStoryDto,
  UpdateStoryVisibilityDto,
  UploadStoryDto,
  CompleteStoryUploadDto,
} from './dto/story.dto';
import { STORY_NOT_FOUND_MESSAGE, StoriesService } from './stories.service';
import type { DeletedStoryView, StoryView } from './story.types';

const storyIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException(STORY_NOT_FOUND_MESSAGE),
});

@Controller('stories')
@UseGuards(JwtAuthGuard)
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Post('upload/complete')
  complete(
    @CurrentUser() viewer: CurrentUserContext,
    @Body() dto: CompleteStoryUploadDto,
  ) {
    return this.storiesService.complete(viewer.id, dto);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('media', {
      limits: {
        fileSize: VIDEO_MAX_BYTES,
        files: 1,
        fields: 4,
        fieldSize: 16 * 1024,
      },
    }),
  )
  upload(
    @CurrentUser() viewer: CurrentUserContext,
    @Body() dto: UploadStoryDto,
    @UploadedFile() file: MediaUploadFile | undefined,
  ): Promise<StoryView> {
    return this.storiesService.upload(viewer.id, dto, file);
  }

  @Post()
  create(
    @CurrentUser() viewer: CurrentUserContext,
    @Body() dto: CreateStoryDto,
  ): Promise<StoryView> {
    return this.storiesService.create(viewer.id, dto);
  }

  @Get()
  listActive(@CurrentUser() viewer: CurrentUserContext): Promise<StoryView[]> {
    return this.storiesService.listActive(viewer.id);
  }

  @Get('mine')
  listMine(@CurrentUser() viewer: CurrentUserContext): Promise<StoryView[]> {
    return this.storiesService.listMine(viewer.id);
  }

  @Get(':storyId')
  findOne(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('storyId', storyIdPipe) storyId: string,
  ): Promise<StoryView> {
    return this.storiesService.findVisible(viewer.id, storyId);
  }

  @Patch(':storyId')
  update(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('storyId', storyIdPipe) storyId: string,
    @Body() dto: UpdateStoryDto,
  ): Promise<StoryView> {
    return this.storiesService.update(viewer.id, storyId, dto);
  }

  @Patch(':storyId/visibility')
  updateVisibility(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('storyId', storyIdPipe) storyId: string,
    @Body() dto: UpdateStoryVisibilityDto,
  ): Promise<StoryView> {
    return this.storiesService.updateVisibility(viewer.id, storyId, dto);
  }

  @Delete(':storyId')
  remove(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('storyId', storyIdPipe) storyId: string,
  ): Promise<DeletedStoryView> {
    return this.storiesService.remove(viewer.id, storyId);
  }
}
