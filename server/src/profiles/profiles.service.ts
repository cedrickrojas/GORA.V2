import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { visiblePostsWhere } from '../posts/post-visibility';
import { visibleGamesWhere } from '../games/game-visibility';
import { PrismaService } from '../prisma/prisma.service';
import { visibleReelsWhere } from '../reels/reel-visibility';
import {
  canSendFriendRequest,
  messageAccessFor,
  type RelationshipState,
} from '../social/relationship';
import { RelationshipService } from '../social/relationship.service';
import type { UserSportView } from '../sports/sport.types';
import { UserSportsService } from '../sports/user-sports.service';
import { visibleStoriesWhere } from '../stories/story-visibility';
import { formatDisplayName } from '../users/display-name';
import { PROFILE_USER_SELECT } from '../users/user.types';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileCoverService } from './profile-cover.service';
import type {
  OwnProfileView,
  ProfileSections,
  ProfileStats,
  PublicProfileView,
} from './profile.types';

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
  ) {}

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
  async getByUsername(
    viewerId: string,
    username: string,
  ): Promise<OwnProfileView | PublicProfileView> {
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
    }
    if (dto.coverImageUrl !== undefined) {
      data.coverImageUrl = dto.coverImageUrl;
      data.coverPhotoData = null;
      data.coverPhotoType = null;
      data.coverPhotoRevision = null;
    }
    if (dto.dateOfBirth !== undefined) {
      data.dateOfBirth =
        dto.dateOfBirth === null
          ? null
          : new Date(`${dto.dateOfBirth}T00:00:00.000Z`);
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

  private listSports(userId: string): Promise<UserSportView[]> {
    return this.userSports.list(userId);
  }

  private findActiveUser(
    where: Prisma.UserWhereInput,
  ): Promise<ProfileUser | null> {
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
  private async countSections(
    viewerId: string,
    userId: string,
    state: RelationshipState,
  ): Promise<ProfileSections> {
    const isOwner = state === 'SELF';
    const clubVisibleToViewer: Prisma.ClubWhereInput = {
      OR: [
        { isPublic: true },
        { members: { some: { userId: viewerId, status: 'ACTIVE' } } },
      ],
    };
    const now = new Date();

    const [posts, games, reels, stories, clubs, activity, badges] =
      await Promise.all([
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
            AND: [
              { userId, expiresAt: { gt: now } },
              visibleStoriesWhere(viewerId, now),
            ],
          },
        }),
        this.prisma.clubMember.count({
          where: {
            userId,
            status: 'ACTIVE',
            club: isOwner
              ? { isActive: true }
              : { isActive: true, ...clubVisibleToViewer },
          },
        }),
        this.prisma.gameParticipant.count({
          where: { userId, status: 'COMPLETED', game: { status: 'COMPLETED' } },
        }),
        this.prisma.userBadge.count({ where: { userId, unlocked: true } }),
      ]);

    return { posts, games, reels, stories, clubs, activity, badges };
  }

  private toBase(
    user: ProfileUser,
    sports: UserSportView[],
    viewerId = user.id,
  ) {
    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: formatDisplayName(user),
      profileImageUrl: user.profileImageUrl,
      coverImageUrl: this.covers.url(
        user.coverImageUrl,
        user.coverPhotoRevision,
        user.id,
        viewerId,
      ),
      bio: user.bio,
      city: user.city,
      sports,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
