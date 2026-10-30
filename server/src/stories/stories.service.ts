import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AudienceService } from '../social/audience.service';
import { AUTHOR_SELECT } from '../users/user.types';
import type {
  CreateStoryDto,
  UpdateStoryDto,
  UpdateStoryVisibilityDto,
  UploadStoryDto,
  CompleteStoryUploadDto,
} from './dto/story.dto';
import { StoryMediaStorage } from './story-media.storage';
import type {
  MediaUploadFile,
  PrivateMediaFile,
} from '../common/media/private-media.storage';
import type { DeletedStoryView, StoryView, StoryViewerView } from './story.types';
import { visibleStoriesWhere } from './story-visibility';

export const STORY_NOT_FOUND_MESSAGE = 'Story not found.';
export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
const STORY_LIST_LIMIT = 200;

function storySelect(viewerId: string) {
  return {
    id: true,
    userId: true,
    mediaType: true,
    mediaUrl: true,
    thumbnailUrl: true,
    caption: true,
    visibility: true,
    musicTitle: true,
    musicArtist: true,
    musicStartTime: true,
    musicDuration: true,
    createdAt: true,
    expiresAt: true,
    views: { where: { userId: viewerId }, select: { id: true } },
    user: { select: AUTHOR_SELECT },
    // Loaded only when the viewer posted the story; for everyone else this is always empty.
    customViewers: {
      where: { story: { userId: viewerId } },
      orderBy: { createdAt: 'asc' },
      select: { user: { select: AUTHOR_SELECT } },
    },
  } satisfies Prisma.StorySelect;
}

type StoryRecord = Prisma.StoryGetPayload<{
  select: ReturnType<typeof storySelect>;
}>;

@Injectable()
export class StoriesService {
  private readonly logger = new Logger(StoriesService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly audience: AudienceService,
    private readonly media: StoryMediaStorage,
  ) {}

  async upload(
    authorId: string,
    dto: UploadStoryDto,
    file: MediaUploadFile | undefined,
  ): Promise<StoryView> {
    const mediaUrl = await this.media.save(file, dto.mediaType, authorId);
    try {
      return await this.create(authorId, { ...dto, mediaUrl });
    } catch (error) {
      await this.media.remove(mediaUrl).catch(() => undefined);
      throw error;
    }
  }

  /** Every file request rechecks current audience, blocks, expiration and deletion. */
  async uploadedMedia(
    viewerId: string,
    storyId: string,
  ): Promise<PrivateMediaFile> {
    const story = await this.prisma.story.findFirst({
      where: {
        AND: [{ id: storyId }, visibleStoriesWhere(viewerId, new Date())],
      },
      select: { mediaUrl: true },
    });
    if (!story || !this.media.isUpload(story.mediaUrl))
      throw new NotFoundException(STORY_NOT_FOUND_MESSAGE);
    return this.media.file(story.mediaUrl);
  }

  complete(authorId: string, dto: CompleteStoryUploadDto): Promise<StoryView> {
    return this.media.complete(
      authorId,
      dto.uploadId,
      dto.mediaType,
      (mediaUrl, tx) => this.create(authorId, { ...dto, mediaUrl }, tx),
    );
  }

  async create(
    authorId: string,
    dto: CreateStoryDto,
    database: Prisma.TransactionClient = this.prisma,
  ): Promise<StoryView> {
    const viewerIds = await this.audience.resolve(
      authorId,
      dto.visibility,
      dto.customViewerIds,
      'story',
    );
    const now = new Date();

    const story = await database.story.create({
      data: {
        userId: authorId,
        mediaType: dto.mediaType,
        mediaUrl: dto.mediaUrl,
        thumbnailUrl: dto.thumbnailUrl ?? null,
        caption: dto.caption ?? null,
        visibility: dto.visibility,
        createdAt: now,
        expiresAt: new Date(now.getTime() + STORY_LIFETIME_MS),
        customViewers: viewerIds
          ? { createMany: { data: viewerIds.map((userId) => ({ userId })) } }
          : undefined,
      },
      select: storySelect(authorId),
    });

    return this.toView(story, authorId);
  }

  /** The story rail: every active story this viewer may see, oldest first within the list. */
  async listActive(viewerId: string): Promise<StoryView[]> {
    const now = new Date();
    const stories = await this.prisma.story.findMany({
      where: {
        AND: [{ expiresAt: { gt: now } }, visibleStoriesWhere(viewerId, now)],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: STORY_LIST_LIMIT,
      select: storySelect(viewerId),
    });

    return stories.map((story) => this.toView(story, viewerId));
  }

  /** My Stories: the viewer's own active and expired stories (not deleted), newest first. */
  async listMine(viewerId: string): Promise<StoryView[]> {
    const stories = await this.prisma.story.findMany({
      where: { userId: viewerId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: STORY_LIST_LIMIT,
      select: storySelect(viewerId),
    });

    return stories.map((story) => this.toView(story, viewerId));
  }

  async findVisible(viewerId: string, storyId: string): Promise<StoryView> {
    const story = await this.prisma.story.findFirst({
      where: {
        AND: [{ id: storyId }, visibleStoriesWhere(viewerId, new Date())],
      },
      select: storySelect(viewerId),
    });

    if (!story) {
      throw new NotFoundException(STORY_NOT_FOUND_MESSAGE);
    }

    return this.toView(story, viewerId);
  }

  /** Records that the viewer opened a visible story; repeated views remain one record. */
  async markViewed(viewerId: string, storyId: string): Promise<StoryView> {
    const story = await this.findVisible(viewerId, storyId);
    await this.prisma.storyView.upsert({
      where: { storyId_userId: { storyId, userId: viewerId } },
      create: { storyId, userId: viewerId },
      update: {},
    });
    return { ...story, viewedByViewer: true };
  }

  /** Only the story owner can see the audience who opened their story. */
  async listViewers(viewerId: string, storyId: string): Promise<StoryViewerView[]> {
    const story = await this.prisma.story.findFirst({
      where: { id: storyId, userId: viewerId, deletedAt: null },
      select: {
        views: {
          where: { userId: { not: viewerId } },
          orderBy: { viewedAt: 'desc' },
          select: { viewedAt: true, user: { select: AUTHOR_SELECT } },
        },
      },
    });
    if (!story) throw new NotFoundException(STORY_NOT_FOUND_MESSAGE);
    return story.views.map(({ user, viewedAt }) => ({ user, viewedAt }));
  }

  /** Edit story (author only): the caption; null or blank removes it. */
  async update(
    viewerId: string,
    storyId: string,
    dto: UpdateStoryDto,
  ): Promise<StoryView> {
    await this.findOwnStory(
      viewerId,
      storyId,
      'Only the author can edit this story.',
    );

    if (dto.caption !== undefined) {
      await this.updateOwn(viewerId, storyId, { caption: dto.caption });
    }

    return this.findVisible(viewerId, storyId);
  }

  /** Author only; the new audience applies to the very next read. */
  async updateVisibility(
    viewerId: string,
    storyId: string,
    dto: UpdateStoryVisibilityDto,
  ): Promise<StoryView> {
    const story = await this.findOwnStory(
      viewerId,
      storyId,
      'Only the author can change who can see this story.',
    );
    const keepsSavedAudience =
      dto.visibility === 'CUSTOM' &&
      dto.customViewerIds === undefined &&
      story._count.customViewers > 0;
    const viewerIds = keepsSavedAudience
      ? null
      : await this.audience.resolve(
          viewerId,
          dto.visibility,
          dto.customViewerIds,
          'story',
        );

    await this.prisma.$transaction(async (tx) => {
      if (viewerIds) {
        await tx.storyCustomViewer.deleteMany({ where: { storyId } });
        await tx.storyCustomViewer.createMany({
          data: viewerIds.map((userId) => ({ storyId, userId })),
        });
      }

      await tx.story.update({
        where: { id: storyId },
        data: { visibility: dto.visibility },
      });
    });

    return this.findVisible(viewerId, storyId);
  }

  /** Delete story (author only): a soft delete; the row and its views stay in the database. */
  async remove(viewerId: string, storyId: string): Promise<DeletedStoryView> {
    const story = await this.findOwnStory(
      viewerId,
      storyId,
      'Only the author can delete this story.',
    );
    await this.updateOwn(viewerId, storyId, { deletedAt: new Date() });
    await this.media
      .remove(story.mediaUrl)
      .catch((error: unknown) =>
        this.logger.error('Could not remove deleted story media.', error),
      );

    return { id: storyId, deleted: true };
  }

  private async updateOwn(
    viewerId: string,
    storyId: string,
    data: Prisma.StoryUpdateManyMutationInput,
  ): Promise<void> {
    const { count } = await this.prisma.story.updateMany({
      where: { id: storyId, userId: viewerId, deletedAt: null },
      data,
    });

    if (count === 0) {
      throw new NotFoundException(STORY_NOT_FOUND_MESSAGE);
    }
  }

  /** 404 when the viewer cannot see the story (or it is deleted), 403 when it is not theirs. */
  private async findOwnStory(
    viewerId: string,
    storyId: string,
    forbiddenMessage: string,
  ) {
    const story = await this.prisma.story.findFirst({
      where: {
        AND: [{ id: storyId }, visibleStoriesWhere(viewerId, new Date())],
      },
      select: {
        userId: true,
        mediaUrl: true,
        _count: { select: { customViewers: true } },
      },
    });

    if (!story) {
      throw new NotFoundException(STORY_NOT_FOUND_MESSAGE);
    }

    if (story.userId !== viewerId) {
      throw new ForbiddenException(forbiddenMessage);
    }

    return story;
  }

  private toView(story: StoryRecord, viewerId: string): StoryView {
    const view: StoryView = {
      id: story.id,
      author: story.user,
      mediaType: story.mediaType,
      mediaUrl: this.media.isUpload(story.mediaUrl)
        ? this.media.playbackUrl(story.id, viewerId)
        : story.mediaUrl,
      thumbnailUrl: story.thumbnailUrl,
      caption: story.caption,
      visibility: story.visibility,
      music: story.musicTitle
        ? {
            title: story.musicTitle,
            artist: story.musicArtist,
            startTime: story.musicStartTime,
            duration: story.musicDuration,
          }
        : null,
      createdAt: story.createdAt,
      expiresAt: story.expiresAt,
      viewedByViewer: story.views.length > 0,
    };

    if (story.userId === viewerId) {
      view.customViewers = story.customViewers.map((viewer) => viewer.user);
    }

    return view;
  }
}
