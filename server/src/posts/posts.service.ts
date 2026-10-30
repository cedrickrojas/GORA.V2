import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PostFeedback, type PostVisibility, type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AudienceService } from '../social/audience.service';
import { RelationshipService } from '../social/relationship.service';
import { AUTHOR_SELECT } from '../users/user.types';
import { UsersService } from '../users/users.service';
import { PostPhotosService } from './post-photos.service';
import type {
  CreatePostDto,
  ListPostsQueryDto,
  UpdatePostDto,
  UpdatePostTagsDto,
  UpdatePostVisibilityDto,
} from './dto/post.dto';
import type { ReportPostDto } from './dto/post-actions.dto';
import type { DeletedPostView, PostPage, PostView } from './post.types';
import { friendshipWithViewer, visiblePostsWhere, visibleTaggedUserWhere } from './post-visibility';

export const POST_NOT_FOUND_MESSAGE = 'Post not found.';
const DEFAULT_PAGE_SIZE = 20;
const POST_ORDER = [{ createdAt: 'desc' }, { id: 'desc' }] satisfies Prisma.PostOrderByWithRelationInput[];

function postSelect(viewerId: string) {
  return {
    id: true,
    userId: true,
    caption: true,
    visibility: true,
    sportId: true,
    clubId: true,
    isAnnouncement: true,
    locationName: true,
    latitude: true,
    longitude: true,
    editedAt: true,
    archivedAt: true,
    createdAt: true,
    updatedAt: true,
    user: { select: AUTHOR_SELECT },
    sport: { select: { id: true, name: true } },
    _count: {
      select: {
        likes: true,
        comments: { where: { user: visibleTaggedUserWhere(viewerId) } },
        shares: true,
      },
    },
    likes: { where: { userId: viewerId }, select: { id: true } },
    preferences: { where: { userId: viewerId }, select: { feedback: true, savedAt: true } },
    media: {
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        mediaType: true,
        mediaUrl: true,
        thumbnailUrl: true,
        contentType: true,
      },
    },
    tags: {
      where: { user: visibleTaggedUserWhere(viewerId) },
      orderBy: { createdAt: 'asc' },
      select: { user: { select: AUTHOR_SELECT } },
    },
    // Loaded only when the viewer wrote the post; for everyone else this is always empty.
    customViewers: {
      where: { post: { userId: viewerId } },
      orderBy: { createdAt: 'asc' },
      select: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
      },
    },
  } satisfies Prisma.PostSelect;
}

type PostRecord = Prisma.PostGetPayload<{
  select: ReturnType<typeof postSelect>;
}>;

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly relationships: RelationshipService,
    private readonly audience: AudienceService,
    private readonly photos: PostPhotosService,
  ) {}

  async create(authorId: string, dto: CreatePostDto): Promise<PostView> {
    const media = (dto.photos ?? []).map((photo, index) => this.photos.decode(photo, index));
    if (!dto.caption?.trim() && media.length === 0)
      throw new BadRequestException('Write something or add a photo to post.');
    const viewerIds = await this.resolveAudience(authorId, dto.visibility, dto.customViewerIds);
    const taggedIds = await this.resolveTags(authorId, dto.taggedUserIds ?? []);

    if (dto.sportId) {
      await this.assertSportExists(dto.sportId);
    }

    const post = await this.prisma.post.create({
      data: {
        userId: authorId,
        caption: dto.caption?.trim() || null,
        media: media.length ? { create: media } : undefined,
        visibility: dto.visibility,
        sportId: dto.sportId,
        locationName: dto.location?.name,
        latitude: dto.location?.latitude,
        longitude: dto.location?.longitude,
        customViewers: viewerIds ? { createMany: { data: viewerIds.map((userId) => ({ userId })) } } : undefined,
        tags: taggedIds.length > 0 ? { createMany: { data: taggedIds.map((userId) => ({ userId })) } } : undefined,
      },
      select: postSelect(authorId),
    });

    return this.toView(post, authorId);
  }

  /** 404 for posts that do not exist and for posts the viewer may not see, so neither leaks. */
  async findVisible(viewerId: string, postId: string): Promise<PostView> {
    const post = await this.prisma.post.findFirst({
      where: { AND: [{ id: postId }, visiblePostsWhere(viewerId)] },
      select: postSelect(viewerId),
    });

    if (!post) {
      throw new NotFoundException(POST_NOT_FOUND_MESSAGE);
    }

    return this.toView(post, viewerId);
  }

  async listComments(viewerId: string, postId: string, query: ListPostsQueryDto) {
    await this.findVisible(viewerId, postId);
    const limit = query.limit ?? 30;
    const comments = await this.prisma.postComment.findMany({
      where: { postId, user: visibleTaggedUserWhere(viewerId) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: { select: AUTHOR_SELECT },
      },
    });
    return {
      comments: comments.slice(0, limit).map(({ user, ...comment }) => ({ ...comment, author: user })),
      nextCursor: comments.length > limit ? comments[limit - 1].id : null,
    };
  }

  async addComment(viewerId: string, postId: string, content: string) {
    await this.findVisible(viewerId, postId);
    const { user, ...comment } = await this.prisma.postComment.create({
      data: { postId, userId: viewerId, content },
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: { select: AUTHOR_SELECT },
      },
    });
    return {
      comment: { ...comment, author: user },
      post: await this.findVisible(viewerId, postId),
    };
  }

  async deleteComment(viewerId: string, postId: string, commentId: string): Promise<PostView> {
    const post = await this.findVisible(viewerId, postId);
    const comment = await this.prisma.postComment.findFirst({
      where: { id: commentId, postId, user: visibleTaggedUserWhere(viewerId) },
      select: { userId: true },
    });
    if (!comment) throw new NotFoundException('Comment not found.');
    if (comment.userId !== viewerId && post.author.id !== viewerId)
      throw new ForbiddenException('Only the comment or post author can delete this comment.');
    await this.prisma.postComment.deleteMany({
      where: { id: commentId, postId },
    });
    return this.findVisible(viewerId, postId);
  }

  /** A completed link share records an event without changing the post's audience. */
  async share(viewerId: string, postId: string): Promise<PostView> {
    await this.findVisible(viewerId, postId);
    await this.prisma.postShare.create({ data: { postId, userId: viewerId } });
    return this.findVisible(viewerId, postId);
  }

  /** Idempotent reactions; hidden and deleted posts use the same 404 as reads. */
  async setLike(viewerId: string, postId: string, liked: boolean): Promise<PostView> {
    await this.findVisible(viewerId, postId);
    if (liked) {
      await this.prisma.postLike.upsert({
        where: { postId_userId: { postId, userId: viewerId } },
        create: { postId, userId: viewerId },
        update: {},
      });
    } else {
      await this.prisma.postLike.deleteMany({
        where: { postId, userId: viewerId },
      });
    }
    return this.findVisible(viewerId, postId);
  }

  async setFeedback(viewerId: string, postId: string, feedback: PostFeedback | null): Promise<PostView> {
    await this.findVisible(viewerId, postId);
    const where = { userId_postId: { userId: viewerId, postId } };
    if (feedback) {
      await this.prisma.postPreference.upsert({
        where,
        create: { userId: viewerId, postId, feedback },
        update: { feedback },
      });
    } else {
      await this.prisma.postPreference.updateMany({ where: { userId: viewerId, postId }, data: { feedback: null } });
      await this.prisma.postPreference.deleteMany({
        where: { userId: viewerId, postId, feedback: null, savedAt: null },
      });
    }
    return this.findVisible(viewerId, postId);
  }

  async setSaved(viewerId: string, postId: string, saved: boolean): Promise<PostView> {
    await this.findVisible(viewerId, postId);
    const where = { userId_postId: { userId: viewerId, postId } };
    if (saved) {
      await this.prisma.postPreference.upsert({
        where,
        create: { userId: viewerId, postId, savedAt: new Date() },
        update: { savedAt: new Date() },
      });
    } else {
      await this.prisma.postPreference.updateMany({ where: { userId: viewerId, postId }, data: { savedAt: null } });
      await this.prisma.postPreference.deleteMany({
        where: { userId: viewerId, postId, feedback: null, savedAt: null },
      });
    }
    return this.findVisible(viewerId, postId);
  }

  async reportPost(viewerId: string, postId: string, dto: ReportPostDto) {
    const post = await this.findVisible(viewerId, postId);
    if (post.author.id === viewerId) throw new BadRequestException('You cannot report your own post.');
    const existing = await this.prisma.report.findFirst({
      where: { reporterId: viewerId, postId, status: { in: ['PENDING', 'REVIEWING'] } },
      select: { id: true },
    });
    const report =
      existing ??
      (await this.prisma.report.create({
        data: {
          reporterId: viewerId,
          reportedUserId: post.author.id,
          postId,
          reason: dto.reason,
          description: dto.description,
        },
        select: { id: true },
      }));
    return { reported: true, id: report.id };
  }

  async saved(viewerId: string) {
    const entries = await this.prisma.postPreference.findMany({
      where: { userId: viewerId, savedAt: { not: null }, post: visiblePostsWhere(viewerId) },
      orderBy: [{ savedAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: { post: { select: postSelect(viewerId) } },
    });
    return { posts: entries.map(({ post }) => this.toView(post, viewerId)), nextCursor: null };
  }

  async archived(viewerId: string) {
    const posts = await this.prisma.post.findMany({
      where: { userId: viewerId, archivedAt: { not: null }, deletedAt: null },
      orderBy: [{ archivedAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: postSelect(viewerId),
    });
    return { posts: posts.map((post) => this.toView(post, viewerId)), nextCursor: null };
  }

  async setArchived(viewerId: string, postId: string, archived: boolean): Promise<PostView> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, userId: viewerId, deletedAt: null },
      select: { id: true },
    });
    if (!post) throw new NotFoundException(POST_NOT_FOUND_MESSAGE);
    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: { archivedAt: archived ? new Date() : null },
      select: postSelect(viewerId),
    });
    return this.toView(updated, viewerId);
  }

  /** A profile feed: only the author's posts this viewer is allowed to see, newest first. */
  async listByAuthor(viewerId: string, username: string, query: ListPostsQueryDto): Promise<PostPage> {
    const author = await this.usersService.findActiveByUsername(username);
    const state = author ? await this.relationships.between(viewerId, author.id) : null;

    if (!author || state === 'BLOCKED_BY_THEM') {
      throw new NotFoundException('User not found.');
    }

    return this.page(viewerId, { userId: author.id }, query);
  }

  /** The Home feed: every post this viewer may see, newest first. No ranking. */
  listFeed(viewerId: string, query: ListPostsQueryDto): Promise<PostPage> {
    const where: Prisma.PostWhereInput =
      query.scope === 'FRIENDS'
        ? {
            OR: [{ userId: viewerId }, { user: friendshipWithViewer(viewerId, 'ACCEPTED') }],
          }
        : {};
    return this.page(
      viewerId,
      { AND: [where, { preferences: { none: { userId: viewerId, feedback: 'NOT_INTERESTED' } } }] },
      query,
    );
  }

  /**
   * Edit Post (author only). Only the fields that are sent change; editedAt is set when
   * something actually changed. Privacy and tags have their own routes.
   */
  async update(viewerId: string, postId: string, dto: UpdatePostDto): Promise<PostView> {
    const current = await this.findAuthoredPost(viewerId, postId, 'Only the author can edit this post.');

    if (dto.caption !== undefined && !dto.caption.trim() && current._count.media === 0) {
      throw new BadRequestException('Write something or add a photo to post.');
    }

    if (dto.sportId) {
      await this.assertSportExists(dto.sportId);
    }

    const data: Prisma.PostUncheckedUpdateManyInput = {};

    if (dto.caption !== undefined && dto.caption !== current.caption) {
      data.caption = dto.caption;
    }

    if (dto.sportId !== undefined && dto.sportId !== current.sportId) {
      data.sportId = dto.sportId;
    }

    if (dto.location !== undefined) {
      const next = dto.location ?? {
        name: null,
        latitude: null,
        longitude: null,
      };

      if (
        next.name !== current.locationName ||
        next.latitude !== current.latitude ||
        next.longitude !== current.longitude
      ) {
        data.locationName = next.name;
        data.latitude = next.latitude;
        data.longitude = next.longitude;
      }
    }

    if (Object.keys(data).length > 0) {
      data.editedAt = new Date();

      const { count } = await this.prisma.post.updateMany({
        where: { id: postId, userId: viewerId, deletedAt: null },
        data,
      });

      if (count === 0) {
        throw new NotFoundException(POST_NOT_FOUND_MESSAGE);
      }
    }

    return this.findVisible(viewerId, postId);
  }

  /**
   * Delete Post (author only) is a soft delete: deletedAt hides the post from every read,
   * while the row, its likes, comments, tags, and media stay in the database.
   */
  async remove(viewerId: string, postId: string): Promise<DeletedPostView> {
    await this.findAuthoredPost(viewerId, postId, 'Only the author can delete this post.');

    const { count } = await this.prisma.post.updateMany({
      where: { id: postId, userId: viewerId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    if (count === 0) {
      throw new NotFoundException(POST_NOT_FOUND_MESSAGE);
    }

    return { id: postId, deleted: true };
  }

  /** The new visibility applies to the very next read, because every read uses visiblePostsWhere. */
  async updateVisibility(viewerId: string, postId: string, dto: UpdatePostVisibilityDto): Promise<PostView> {
    const post = await this.findAuthoredPost(viewerId, postId, 'Only the author can change who can see this post.');

    const keepsSavedAudience =
      dto.visibility === 'CUSTOM' && dto.customViewerIds === undefined && post._count.customViewers > 0;
    const viewerIds = keepsSavedAudience
      ? null
      : await this.resolveAudience(viewerId, dto.visibility, dto.customViewerIds);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (viewerIds) {
        await tx.postCustomViewer.deleteMany({ where: { postId } });
        await tx.postCustomViewer.createMany({
          data: viewerIds.map((userId) => ({ postId, userId })),
        });
      }

      return tx.post.update({
        where: { id: postId },
        data: { visibility: dto.visibility },
        select: postSelect(viewerId),
      });
    });

    return this.toView(updated, viewerId);
  }

  /** Only the author manages tags. The list replaces the current tags; [] removes them all. */
  async updateTags(viewerId: string, postId: string, dto: UpdatePostTagsDto): Promise<PostView> {
    await this.findAuthoredPost(viewerId, postId, 'Only the author can change who is tagged.');

    const taggedIds = await this.resolveTags(viewerId, dto.userIds);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.postTag.deleteMany({
        where: { postId, userId: { notIn: taggedIds } },
      });
      await tx.postTag.createMany({
        data: taggedIds.map((userId) => ({ postId, userId })),
        skipDuplicates: true,
      });

      return tx.post.findUniqueOrThrow({
        where: { id: postId },
        select: postSelect(viewerId),
      });
    });

    return this.toView(updated, viewerId);
  }

  private async page(viewerId: string, where: Prisma.PostWhereInput, query: ListPostsQueryDto): Promise<PostPage> {
    const take = query.limit ?? DEFAULT_PAGE_SIZE;
    const posts = await this.prisma.post.findMany({
      where: { AND: [where, visiblePostsWhere(viewerId)] },
      orderBy: POST_ORDER,
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: postSelect(viewerId),
    });

    const page = posts.slice(0, take);

    return {
      posts: page.map((post) => this.toView(post, viewerId)),
      nextCursor: posts.length > take ? page[page.length - 1].id : null,
    };
  }

  /** 404 when the viewer cannot see the post (or it is deleted), 403 when they are not its author. */
  private async findAuthoredPost(viewerId: string, postId: string, forbiddenMessage: string) {
    const post = await this.prisma.post.findFirst({
      where: { AND: [{ id: postId }, visiblePostsWhere(viewerId)] },
      select: {
        userId: true,
        caption: true,
        sportId: true,
        locationName: true,
        latitude: true,
        longitude: true,
        _count: { select: { customViewers: true, media: true } },
      },
    });

    if (!post) {
      throw new NotFoundException(POST_NOT_FOUND_MESSAGE);
    }

    if (post.userId !== viewerId) {
      throw new ForbiddenException(forbiddenMessage);
    }

    return post;
  }

  /** Tagged people must be active, not the author, and not blocked in either direction. */
  private async resolveTags(authorId: string, ids: string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }

    if (ids.includes(authorId)) {
      throw new BadRequestException('You cannot tag yourself.');
    }

    const [activeIds, blockedIds] = await Promise.all([
      this.usersService.filterActiveIds(ids),
      this.relationships.blockedAmong(authorId, ids),
    ]);
    const allowed = new Set(activeIds.filter((id) => !blockedIds.includes(id)));

    if (ids.some((id) => !allowed.has(id))) {
      throw new BadRequestException('Some of these people cannot be tagged.');
    }

    return ids;
  }

  /** Custom viewer ids for CUSTOM, or null for the other visibilities (which must not send any). */
  private resolveAudience(
    authorId: string,
    visibility: PostVisibility,
    customViewerIds: string[] | undefined,
  ): Promise<string[] | null> {
    return this.audience.resolve(authorId, visibility, customViewerIds, 'post');
  }

  private async assertSportExists(sportId: string): Promise<void> {
    const sport = await this.prisma.sport.findUnique({
      where: { id: sportId },
      select: { id: true },
    });

    if (!sport) {
      throw new BadRequestException('Unknown sport.');
    }
  }

  private toView(post: PostRecord, viewerId: string): PostView {
    const { user, customViewers, userId, tags, locationName, latitude, longitude, _count, likes, ...fields } = post;
    const view: PostView = {
      ...fields,
      media: fields.media.map(({ contentType, ...item }) => ({
        ...item,
        mediaUrl: contentType ? this.photos.url(post.id, item.id, viewerId) : item.mediaUrl,
      })),
      author: user,
      likeCount: _count.likes,
      commentCount: _count.comments,
      shareCount: _count.shares,
      likedByViewer: likes.length > 0,
      interestedByViewer: post.preferences[0]?.feedback === 'INTERESTED',
      savedByViewer: Boolean(post.preferences[0]?.savedAt),
      notInterestedByViewer: post.preferences[0]?.feedback === 'NOT_INTERESTED',
      location:
        locationName !== null && latitude !== null && longitude !== null
          ? { name: locationName, latitude, longitude }
          : null,
      tags: tags.map((tag) => tag.user),
    };

    if (userId === viewerId) {
      view.customViewers = customViewers.map((viewer) => viewer.user);
    }

    return view;
  }
}
