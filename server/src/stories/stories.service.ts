import {
  ForbiddenException,
  Injectable,
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
} from './dto/story.dto';
import type { DeletedStoryView, StoryView } from './story.types';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audience: AudienceService,
  ) {}

  async create(authorId: string, dto: CreateStoryDto): Promise<StoryView> {
    const viewerIds = await this.audience.resolve(
      authorId,
      dto.visibility,
      dto.customViewerIds,
      'story',
    );
    const now = new Date();

    const story = await this.prisma.story.create({
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
    await this.findOwnStory(
      viewerId,
      storyId,
      'Only the author can delete this story.',
    );
    await this.updateOwn(viewerId, storyId, { deletedAt: new Date() });

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
      select: { userId: true, _count: { select: { customViewers: true } } },
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
      mediaUrl: story.mediaUrl,
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
    };

    if (story.userId === viewerId) {
      view.customViewers = story.customViewers.map((viewer) => viewer.user);
    }

    return view;
  }
}
