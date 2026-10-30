import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReportReason } from '../generated/prisma/client';
import { visiblePostsWhere } from '../posts/post-visibility';
import { visibleGamesWhere } from '../games/game-visibility';
import { PrismaService } from '../prisma/prisma.service';
import { GoraPointsService } from '../gora-points/gora-points.service';
import { visibleReelsWhere } from '../reels/reel-visibility';
import { canSendFriendRequest, messageAccessFor, type RelationshipState } from '../social/relationship';
import { RelationshipService } from '../social/relationship.service';
import type { UserSportView } from '../sports/sport.types';
import { UserSportsService } from '../sports/user-sports.service';
import { visibleStoriesWhere } from '../stories/story-visibility';
import { formatDisplayName } from '../users/display-name';
import { PROFILE_USER_SELECT } from '../users/user.types';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import { ProfileCoverService } from './profile-cover.service';
import type { OwnProfileView, ProfileSections, ProfileStats, PublicProfileView } from './profile.types';

export const PROFILE_NOT_FOUND_MESSAGE = 'User not found.';

type ProfileUser = Prisma.UserGetPayload<{
  select: typeof PROFILE_USER_SELECT;
}>;

/** A date-only column comes back as midnight UTC. */
function toDateOnly(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly relationships: RelationshipService,
    private readonly userSports: UserSportsService,
    private readonly covers: ProfileCoverService,
    private readonly points: GoraPointsService,
  ) {}

  async getSettings(userId: string) {
    return this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: {
        notifyFriends: true,
        notifyGames: true,
        notifyMessages: true,
        notifyContent: true,
        profileVisibility: true,
        defaultDistanceKm: true,
        useDeviceLocation: true,
      },
    });
  }

  async updateSettings(userId: string, dto: UpdateUserSettingsDto) {
    return this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
      select: {
        notifyFriends: true,
        notifyGames: true,
        notifyMessages: true,
        notifyContent: true,
        profileVisibility: true,
        defaultDistanceKm: true,
        useDeviceLocation: true,
      },
    });
  }

  async reportUser(viewerId: string, username: string, reason: ReportReason, description?: string) {
    const reportedUser = await this.prisma.user.findFirst({
      where: { username: username.trim().toLowerCase(), isActive: true },
      select: { id: true },
    });
    if (!reportedUser) throw new NotFoundException(PROFILE_NOT_FOUND_MESSAGE);
    if (reportedUser.id === viewerId) throw new BadRequestException('You cannot report your own account.');

    const relationship = await this.relationships.between(viewerId, reportedUser.id);
    if (relationship === 'BLOCKED_BY_THEM') throw new NotFoundException(PROFILE_NOT_FOUND_MESSAGE);

    const existing = await this.prisma.report.findFirst({
      where: {
        reporterId: viewerId,
        reportedUserId: reportedUser.id,
        postId: null,
        reelId: null,
        postCommentId: null,
        reelCommentId: null,
        gameId: null,
        storyId: null,
        messageId: null,
        clubId: null,
        status: { in: ['PENDING', 'REVIEWING'] },
      },
      select: { id: true },
    });
    if (existing) return { reported: true, id: existing.id };

    const report = await this.prisma.report.create({
      data: { reporterId: viewerId, reportedUserId: reportedUser.id, reason, description },
      select: { id: true },
    });
    return { reported: true, id: report.id };
  }

  async sendHelpRequest(viewerId: string, message: string) {
    const content = message.trim();
    if (!content) throw new BadRequestException('Write a message before sending.');
    const request = await this.prisma.$transaction(async (tx) => {
      const report = await tx.report.create({
        data: { reporterId: viewerId, reason: 'HELP_REQUEST', description: content },
        select: { id: true, createdAt: true },
      });
      const admins = await tx.user.findMany({
        where: { role: 'SUPER_ADMIN', isActive: true },
        select: { id: true },
      });
      if (admins.length) {
        await tx.notification.createMany({
          data: admins.map(({ id }) => ({
            userId: id,
            type: 'HELP_REQUEST_RECEIVED' as const,
            reportId: report.id,
            reportStatus: 'PENDING' as const,
          })),
        });
      }
      return report;
    });
    return { sent: true, id: request.id, createdAt: request.createdAt.toISOString() };
  }

  async listMyHelpRequests(userId: string) {
    const items = await this.prisma.report.findMany({
      where: { reporterId: userId, reason: 'HELP_REQUEST' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: { id: true, description: true, status: true, createdAt: true, resolvedAt: true },
    });
    return {
      items: items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        resolvedAt: item.resolvedAt?.toISOString() ?? null,
      })),
    };
  }

  async getOwn(userId: string): Promise<OwnProfileView> {
    const user = await this.findActiveUser({ id: userId });

    if (!user) {
      throw new NotFoundException(PROFILE_NOT_FOUND_MESSAGE);
    }

    const [sports, stats, sections] = await Promise.all([
      this.listSports(userId),
      this.countStats(userId),
      this.countSections(userId, userId, 'SELF'),
    ]);

    return {
      ...this.toBase(user, sports),
      isOwnProfile: true,
      dateOfBirth: toDateOnly(user.dateOfBirth),
      stats,
      sections,
    };
  }

  /**
   * Read-only. A user who blocked the viewer answers 404, exactly like a missing or
   * deactivated account, so the block is never revealed.
   */
  async getByUsername(viewerId: string, username: string): Promise<OwnProfileView | PublicProfileView> {
    const user = await this.findActiveUser({
      username: username.trim().toLowerCase(),
    });

    if (!user) {
      throw new NotFoundException(PROFILE_NOT_FOUND_MESSAGE);
    }

    if (user.id === viewerId) {
      return this.getOwn(viewerId);
    }

    const state = await this.relationships.between(viewerId, user.id);

    if (state === 'BLOCKED_BY_THEM' || state === 'SELF') {
      throw new NotFoundException(PROFILE_NOT_FOUND_MESSAGE);
    }

    const privacy = await this.prisma.userSettings.findUnique({
      where: { userId: user.id },
      select: { profileVisibility: true },
    });
    if (privacy?.profileVisibility === 'FRIENDS' && state !== 'FRIENDS') {
      throw new NotFoundException(PROFILE_NOT_FOUND_MESSAGE);
    }

    const relationship = {
      state,
      messageAccess: messageAccessFor(state),
      canSendFriendRequest: canSendFriendRequest(state),
    };

    if (state === 'BLOCKED') {
      return {
        ...this.toBase({ ...user, bio: null, city: null }, [], viewerId),
        isOwnProfile: false,
        relationship,
        stats: null,
        sections: null,
      };
    }

    const [sports, stats, sections] = await Promise.all([
      this.listSports(user.id),
      this.countStats(user.id),
      this.countSections(viewerId, user.id, state),
    ]);

    return {
      ...this.toBase(user, sports, viewerId),
      isOwnProfile: false,
      relationship,
      stats,
      sections,
    };
  }

  async update(userId: string, dto: UpdateProfileDto): Promise<OwnProfileView> {
    const data: Prisma.UserUpdateInput = {};

    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.bio !== undefined) data.bio = dto.bio;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.profileImageUrl !== undefined) {
      data.profileImageUrl = dto.profileImageUrl;
      data.profilePhotoRevision = null;
      data.profilePhotoData = null;
      data.profilePhotoType = null;
    }
    if (dto.coverImageUrl !== undefined) {
      data.coverImageUrl = dto.coverImageUrl;
      data.coverPhotoData = null;
      data.coverPhotoType = null;
      data.coverPhotoRevision = null;
    }
    if (dto.dateOfBirth !== undefined) {
      data.dateOfBirth = dto.dateOfBirth === null ? null : new Date(`${dto.dateOfBirth}T00:00:00.000Z`);
    }

    if (Object.keys(data).length > 0) {
      const updated = await this.prisma.user.updateMany({
        where: { id: userId, isActive: true },
        data,
      });

      if (updated.count === 0) {
        throw new NotFoundException(PROFILE_NOT_FOUND_MESSAGE);
      }
    }

    return this.getOwn(userId);
  }

  async setFollowing(viewerId: string, targetId: string, following: boolean) {
    const target = await this.findActiveUser({ id: targetId });
    if (!target || target.id === viewerId) throw new NotFoundException(PROFILE_NOT_FOUND_MESSAGE);
    const relation = await this.relationships.between(viewerId, target.id);
    if (relation === 'BLOCKED' || relation === 'BLOCKED_BY_THEM') throw new NotFoundException(PROFILE_NOT_FOUND_MESSAGE);

    if (following) {
      await this.prisma.$transaction(async (tx) => {
        const inserted = await tx.userFollow.createMany({
          data: [{ followerId: viewerId, followingId: target.id }],
          skipDuplicates: true,
        });
        if (inserted.count) await this.points.awardInTransaction(tx, target.id, 'FOLLOWER_GAINED', viewerId, 1);
      });
    } else {
      await this.prisma.userFollow.deleteMany({ where: { followerId: viewerId, followingId: target.id } });
    }
    return { following };
  }

  private listSports(userId: string): Promise<UserSportView[]> {
    return this.userSports.list(userId);
  }

  private findActiveUser(where: Prisma.UserWhereInput): Promise<ProfileUser | null> {
    return this.prisma.user.findFirst({
      where: { ...where, isActive: true },
      select: PROFILE_USER_SELECT,
    });
  }

  private async countStats(userId: string): Promise<ProfileStats> {
    const [friends, followers, following] = await Promise.all([
      this.prisma.friendship.count({
        where: {
          status: 'ACCEPTED',
          OR: [
            { requesterId: userId, receiver: { isActive: true } },
            { receiverId: userId, requester: { isActive: true } },
          ],
        },
      }),
      this.prisma.userFollow.count({
        where: { followingId: userId, follower: { isActive: true } },
      }),
      this.prisma.userFollow.count({
        where: { followerId: userId, following: { isActive: true } },
      }),
    ]);

    return { friends, followers, following };
  }

  /** Every count applies the same visibility the viewer would get from the lists themselves. */
  private async countSections(viewerId: string, userId: string, state: RelationshipState): Promise<ProfileSections> {
    const isOwner = state === 'SELF';
    const clubVisibleToViewer: Prisma.ClubWhereInput = {
      OR: [{ isPublic: true }, { members: { some: { userId: viewerId, status: 'ACTIVE' } } }],
    };
    const now = new Date();

    const [posts, games, reels, stories, clubs, activity, badges] = await Promise.all([
      this.prisma.post.count({
        where: { AND: [{ userId }, visiblePostsWhere(viewerId)] },
      }),
      this.prisma.game.count({
        where: {
          AND: [visibleGamesWhere(viewerId)],
          status: { not: 'CANCELLED' },
          OR: [
            { hostId: userId },
            {
              participants: {
                some: { userId, status: { in: ['ACTIVE', 'COMPLETED'] } },
              },
            },
          ],
        },
      }),
      this.prisma.reel.count({
        where: { AND: [{ userId }, visibleReelsWhere(viewerId)] },
      }),
      this.prisma.story.count({
        where: {
          AND: [{ userId, expiresAt: { gt: now } }, visibleStoriesWhere(viewerId, now)],
        },
      }),
      this.prisma.clubMember.count({
        where: {
          userId,
          status: 'ACTIVE',
          club: isOwner ? { isActive: true } : { isActive: true, ...clubVisibleToViewer },
        },
      }),
      this.prisma.gameParticipant.count({
        where: { userId, status: 'COMPLETED', game: { status: 'COMPLETED' } },
      }),
      this.prisma.userBadge.count({ where: { userId, unlocked: true } }),
    ]);

    return { posts, games, reels, stories, clubs, activity, badges };
  }

  private toBase(user: ProfileUser, sports: UserSportView[], viewerId = user.id) {
    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: formatDisplayName(user),
      profileImageUrl: user.profileImageUrl,
      coverImageUrl: this.covers.url(user.coverImageUrl, user.coverPhotoRevision, user.id, viewerId),
      bio: user.bio,
      city: user.city,
      sports,
      createdAt: user.createdAt.toISOString(),
      goraPoints: user.goraPoints,
    };
  }
}
