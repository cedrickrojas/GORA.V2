import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import type { ListPostsQueryDto } from '../posts/dto/post.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AudienceService } from '../social/audience.service';
import { RelationshipService } from '../social/relationship.service';
import { AUTHOR_SELECT } from '../users/user.types';
import { UsersService } from '../users/users.service';
import type {
  CreateReelDto,
  UpdateReelDto,
  UpdateReelVisibilityDto,
  UploadReelDto,
} from './dto/reel.dto';
import type { DeletedReelView, ReelPage, ReelView } from './reel.types';
import { visibleReelsWhere } from './reel-visibility';
import { ReelVideoStorage, type ReelVideoFile } from './reel-video.storage';

export const REEL_NOT_FOUND_MESSAGE = 'Reel not found.';
const DEFAULT_PAGE_SIZE = 20;
const REEL_ORDER = [
  { createdAt: 'desc' },
  { id: 'desc' },
] satisfies Prisma.ReelOrderByWithRelationInput[];

function reelSelect(viewerId: string) {
  return {
    id: true,
    userId: true,
    caption: true,
    videoUrl: true,
    thumbnailUrl: true,
    durationSeconds: true,
    visibility: true,
    viewCount: true,
    createdAt: true,
    updatedAt: true,
    user: { select: AUTHOR_SELECT },
    sport: { select: { id: true, name: true } },
    club: { select: { id: true, name: true } },
    _count: { select: { likes: true, comments: true, shares: true } },
    likes: { where: { userId: viewerId }, select: { id: true } },
    // Loaded only when the viewer posted the reel; for everyone else this is always empty.
    customViewers: {
      where: { reel: { userId: viewerId } },
      orderBy: { createdAt: 'asc' },
      select: { user: { select: AUTHOR_SELECT } },
    },
  } satisfies Prisma.ReelSelect;
}

type ReelRecord = Prisma.ReelGetPayload<{
  select: ReturnType<typeof reelSelect>;
}>;

@Injectable()
export class ReelsService {
  private readonly logger = new Logger(ReelsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly relationships: RelationshipService,
    private readonly audience: AudienceService,
    private readonly videos: ReelVideoStorage,
  ) {}

  async upload(
    authorId: string,
    dto: UploadReelDto,
    file: ReelVideoFile | undefined,
  ): Promise<ReelView> {
    const videoUrl = await this.videos.save(file);
    try {
      return await this.create(authorId, { ...dto, videoUrl });
    } catch (error) {
      await this.videos
        .remove(videoUrl)
        .catch((error: unknown) =>
          this.logger.error('Could not remove rejected video upload.', error),
        );
      throw error;
    }
  }

  async uploadedVideo(
    viewerId: string,
    reelId: string,
  ): Promise<{ path: string; contentType: string }> {
    const reel = await this.prisma.reel.findFirst({
      where: { AND: [{ id: reelId }, visibleReelsWhere(viewerId)] },
      select: { videoUrl: true },
    });
    if (!reel) throw new NotFoundException(REEL_NOT_FOUND_MESSAGE);
    return this.videos.file(reel.videoUrl);
  }

  async create(authorId: string, dto: CreateReelDto): Promise<ReelView> {
    const viewerIds = await this.audience.resolve(
      authorId,
      dto.visibility,
      dto.customViewerIds,
      'reel',
    );

    if (dto.sportId) {
      await this.assertActiveSport(dto.sportId);
    }

    const reel = await this.prisma.reel.create({
      data: {
        userId: authorId,
        videoUrl: dto.videoUrl,
        thumbnailUrl: dto.thumbnailUrl ?? null,
        caption: dto.caption ?? null,
        sportId: dto.sportId ?? null,
        durationSeconds: dto.durationSeconds ?? null,
        visibility: dto.visibility,
        customViewers: viewerIds
          ? { createMany: { data: viewerIds.map((userId) => ({ userId })) } }
          : undefined,
      },
      select: reelSelect(authorId),
    });

    return this.toView(reel, authorId);
  }

  /** The Reels feed: every reel this viewer may see, newest first. No ranking yet. */
  listFeed(viewerId: string, query: ListPostsQueryDto): Promise<ReelPage> {
    return this.page(viewerId, {}, query);
  }

  /** A profile's Highlights / My Reels: that user's reels this viewer may see, newest first. */
  async listByAuthor(
    viewerId: string,
    username: string,
    query: ListPostsQueryDto,
  ): Promise<ReelPage> {
    const author = await this.usersService.findActiveByUsername(username);
    const state = author
      ? await this.relationships.between(viewerId, author.id)
      : null;

    if (!author || state === 'BLOCKED_BY_THEM') {
      throw new NotFoundException('User not found.');
    }

    return this.page(viewerId, { userId: author.id }, query);
  }

  async setLike(
    viewerId: string,
    reelId: string,
    liked: boolean,
  ): Promise<ReelView> {
    await this.findVisible(viewerId, reelId);
    if (liked) {
      await this.prisma.reelLike.upsert({
        where: { reelId_userId: { reelId, userId: viewerId } },
        create: { reelId, userId: viewerId },
        update: {},
      });
    } else {
      await this.prisma.reelLike.deleteMany({
        where: { reelId, userId: viewerId },
      });
    }
    return this.findVisible(viewerId, reelId);
  }

  async findVisible(viewerId: string, reelId: string): Promise<ReelView> {
    const reel = await this.prisma.reel.findFirst({
      where: { AND: [{ id: reelId }, visibleReelsWhere(viewerId)] },
      select: reelSelect(viewerId),
    });

    if (!reel) {
      throw new NotFoundException(REEL_NOT_FOUND_MESSAGE);
    }

    return this.toView(reel, viewerId);
  }

  /** Edit reel (author only): caption and sport; null removes either. */
  async update(
    viewerId: string,
    reelId: string,
    dto: UpdateReelDto,
  ): Promise<ReelView> {
    await this.findOwnReel(
      viewerId,
      reelId,
      'Only the author can edit this reel.',
    );

    if (dto.sportId) {
      await this.assertActiveSport(dto.sportId);
    }

    const data: Prisma.ReelUncheckedUpdateManyInput = {};

    if (dto.caption !== undefined) {
      data.caption = dto.caption;
    }

    if (dto.sportId !== undefined) {
      data.sportId = dto.sportId;
    }

    if (Object.keys(data).length > 0) {
      await this.updateOwn(viewerId, reelId, data);
    }

    return this.findVisible(viewerId, reelId);
  }

  /** Author only; the new audience applies to the very next read. */
  async updateVisibility(
    viewerId: string,
    reelId: string,
    dto: UpdateReelVisibilityDto,
  ): Promise<ReelView> {
    const reel = await this.findOwnReel(
      viewerId,
      reelId,
      'Only the author can change who can see this reel.',
    );
    const keepsSavedAudience =
      dto.visibility === 'CUSTOM' &&
      dto.customViewerIds === undefined &&
      reel._count.customViewers > 0;
    const viewerIds = keepsSavedAudience
      ? null
      : await this.audience.resolve(
          viewerId,
          dto.visibility,
          dto.customViewerIds,
          'reel',
        );

    await this.prisma.$transaction(async (tx) => {
      if (viewerIds) {
        await tx.reelCustomViewer.deleteMany({ where: { reelId } });
        await tx.reelCustomViewer.createMany({
          data: viewerIds.map((userId) => ({ reelId, userId })),
        });
      }

      await tx.reel.update({
        where: { id: reelId },
        data: { visibility: dto.visibility },
      });
    });

    return this.findVisible(viewerId, reelId);
  }

  /** Delete reel (author only): a soft delete; likes, comments, and views stay. */
  async remove(viewerId: string, reelId: string): Promise<DeletedReelView> {
    const reel = await this.findOwnReel(
      viewerId,
      reelId,
      'Only the author can delete this reel.',
    );
    await this.updateOwn(viewerId, reelId, { deletedAt: new Date() });
    await this.videos
      .remove(reel.videoUrl)
      .catch((error: unknown) =>
        this.logger.error('Could not remove deleted reel video.', error),
      );

    return { id: reelId, deleted: true };
  }

  private async page(
    viewerId: string,
    where: Prisma.ReelWhereInput,
    query: ListPostsQueryDto,
  ): Promise<ReelPage> {
    const take = query.limit ?? DEFAULT_PAGE_SIZE;
    const reels = await this.prisma.reel.findMany({
      where: { AND: [where, visibleReelsWhere(viewerId)] },
      orderBy: REEL_ORDER,
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: reelSelect(viewerId),
    });

    const page = reels.slice(0, take);

    return {
      reels: page.map((reel) => this.toView(reel, viewerId)),
      nextCursor: reels.length > take ? page[page.length - 1].id : null,
    };
  }

  private async updateOwn(
    viewerId: string,
    reelId: string,
    data: Prisma.ReelUncheckedUpdateManyInput,
  ): Promise<void> {
    const { count } = await this.prisma.reel.updateMany({
      where: { id: reelId, userId: viewerId, deletedAt: null },
      data,
    });

    if (count === 0) {
      throw new NotFoundException(REEL_NOT_FOUND_MESSAGE);
    }
  }

  /** 404 when the viewer cannot see the reel (or it is deleted), 403 when it is not theirs. */
  private async findOwnReel(
    viewerId: string,
    reelId: string,
    forbiddenMessage: string,
  ) {
    const reel = await this.prisma.reel.findFirst({
      where: { AND: [{ id: reelId }, visibleReelsWhere(viewerId)] },
      select: {
        userId: true,
        videoUrl: true,
        _count: { select: { customViewers: true } },
      },
    });

    if (!reel) {
      throw new NotFoundException(REEL_NOT_FOUND_MESSAGE);
    }

    if (reel.userId !== viewerId) {
      throw new ForbiddenException(forbiddenMessage);
    }

    return reel;
  }

  private async assertActiveSport(sportId: string): Promise<void> {
    const sport = await this.prisma.sport.findFirst({
      where: { id: sportId, isActive: true },
      select: { id: true },
    });

    if (!sport) {
      throw new BadRequestException('Unknown sport.');
    }
  }

  private toView(reel: ReelRecord, viewerId: string): ReelView {
    const view: ReelView = {
      id: reel.id,
      author: reel.user,
      caption: reel.caption,
      videoUrl: this.videos.isUpload(reel.videoUrl)
        ? this.videos.playbackUrl(reel.id, viewerId)
        : reel.videoUrl,
      thumbnailUrl: reel.thumbnailUrl,
      durationSeconds: reel.durationSeconds,
      sport: reel.sport,
      club: reel.club,
      visibility: reel.visibility,
      viewCount: reel.viewCount,
      likeCount: reel._count.likes,
      commentCount: reel._count.comments,
      shareCount: reel._count.shares,
      likedByViewer: reel.likes.length > 0,
      createdAt: reel.createdAt,
      updatedAt: reel.updatedAt,
    };

    if (reel.userId === viewerId) {
      view.customViewers = reel.customViewers.map((viewer) => viewer.user);
    }

    return view;
  }
}
