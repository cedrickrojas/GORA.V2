import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client';
import type { ClubMemberRole } from '../generated/prisma/client';
import { readClubMaxMembersLimit } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { formatDisplayName } from '../users/display-name';
import { AUTHOR_SELECT } from '../users/user.types';
import { CLUB_NOT_FOUND_MESSAGE } from './club-chat.service';
import { minutesOfDay } from './club-fields';
import {
  canManageMember,
  hasClubPermission,
  type ClubPermission,
} from './club-permissions';
import type {
  ClubInviteView,
  ClubJoinRequestView,
  ClubJoinResult,
  ClubMemberView,
  ClubPersonView,
  ClubView,
} from './clubs.types';
import type {
  CreateClubDto,
  InviteClubMemberDto,
  UpdateClubDto,
} from './dto/club.dto';

export const CLUB_FULL_MESSAGE = 'Club is currently full.';
export const CLUB_USERNAME_TAKEN_MESSAGE =
  'That club username is already taken.';
export const CLUB_INACTIVE_MESSAGE = 'This club is no longer active.';
export const CLUB_INVITE_ONLY_MESSAGE =
  'This club is invite only. You need an invitation to join.';
export const CLUB_PRIVATE_MEMBERS_MESSAGE =
  'This club is private. Only members can see who is in it.';
export const CLUB_OWNER_ONLY_MESSAGE =
  'Only the club owner can change club settings.';
export const CLUB_MANAGE_MEMBERS_MESSAGE =
  'Only club owners and admins can manage members.';

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

const CLUB_DETAIL_SELECT = {
  id: true,
  ownerId: true,
  name: true,
  slug: true,
  description: true,
  about: true,
  profileImageUrl: true,
  coverImageUrl: true,
  country: true,
  city: true,
  barangay: true,
  homeCourt: true,
  locationName: true,
  latitude: true,
  longitude: true,
  maxMembers: true,
  membershipType: true,
  activityDay: true,
  activityStartTime: true,
  activityEndTime: true,
  trainingSchedule: true,
  contactEmail: true,
  websiteUrl: true,
  facebookUrl: true,
  instagramUrl: true,
  tiktokUrl: true,
  isPublic: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  sport: { select: { id: true, name: true } },
  additionalSports: {
    select: { sport: { select: { id: true, name: true } } },
    orderBy: { sport: { name: 'asc' } },
  },
  tags: { select: { tag: true }, orderBy: { tag: 'asc' } },
  rules: { select: { text: true }, orderBy: { position: 'asc' } },
  owner: { select: AUTHOR_SELECT },
} as const satisfies Prisma.ClubSelect;

const CLUB_ACCESS_SELECT = {
  id: true,
  ownerId: true,
  maxMembers: true,
  membershipType: true,
  isPublic: true,
  isActive: true,
} as const satisfies Prisma.ClubSelect;

type ClubDetailRow = Prisma.ClubGetPayload<{
  select: typeof CLUB_DETAIL_SELECT;
}>;
type ClubAccessRow = Prisma.ClubGetPayload<{
  select: typeof CLUB_ACCESS_SELECT;
}>;
type PersonRow = Prisma.UserGetPayload<{ select: typeof AUTHOR_SELECT }>;
type Membership = { role: ClubMemberRole; status: ClubAccessStatus };
type ClubAccessStatus = 'PENDING' | 'ACTIVE' | 'REMOVED' | 'BANNED';

const ROLE_ORDER: Record<ClubMemberRole, number> = {
  OWNER: 0,
  ADMIN: 1,
  MODERATOR: 2,
  MEMBER: 3,
};

/**
 * Club creation, settings, and membership. Capacity is enforced twice: every write that
 * makes a membership ACTIVE first locks the club row and counts ACTIVE members inside a
 * transaction, and the ClubMember_capacity_guard trigger refuses the write if it would
 * still overflow. PENDING, REMOVED, and BANNED rows never take a slot.
 */
@Injectable()
export class ClubsService {
  private readonly maxMembersLimit: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.maxMembersLimit = readClubMaxMembersLimit(
      config.get<unknown>('CLUB_MAX_MEMBERS_LIMIT'),
    );
  }

  /**
   * One transaction: the club with its sports, tags, and rules. The Club_sync_owner and
   * Club_create_chat triggers add the OWNER/ACTIVE membership and the official CLUB chat
   * in the same transaction; both are verified before commit, so a club never exists
   * without its owner membership and chat.
   */
  async create(viewerId: string, dto: CreateClubDto): Promise<ClubView> {
    this.assertWithinLimit(dto.maxMembers);
    assertCoordinates(dto.latitude ?? null, dto.longitude ?? null);
    assertActivityTimes(
      dto.activityStartTime ?? null,
      dto.activityEndTime ?? null,
    );
    const additionalSportIds = await this.resolveSports(
      dto.primarySportId,
      dto.additionalSportIds ?? [],
    );

    const clubId = await this.withUsernameGuard(() =>
      this.prisma.$transaction(async (tx) => {
        const club = await tx.club.create({
          data: {
            ownerId: viewerId,
            name: dto.name,
            slug: dto.username,
            description: dto.description,
            about: dto.about ?? null,
            profileImageUrl: dto.profileImageUrl ?? null,
            coverImageUrl: dto.coverImageUrl ?? null,
            sportId: dto.primarySportId,
            country: dto.country ?? null,
            city: dto.city ?? null,
            barangay: dto.barangay ?? null,
            homeCourt: dto.homeCourt ?? null,
            locationName: dto.locationName ?? null,
            latitude: dto.latitude ?? null,
            longitude: dto.longitude ?? null,
            maxMembers: dto.maxMembers,
            membershipType: dto.membershipType ?? 'OPEN',
            isPublic: dto.isPublic ?? true,
            activityDay: dto.activityDay ?? null,
            activityStartTime: dto.activityStartTime ?? null,
            activityEndTime: dto.activityEndTime ?? null,
            trainingSchedule: dto.trainingSchedule ?? null,
            contactEmail: dto.contactEmail ?? null,
            websiteUrl: dto.websiteUrl ?? null,
            facebookUrl: dto.facebookUrl ?? null,
            instagramUrl: dto.instagramUrl ?? null,
            tiktokUrl: dto.tiktokUrl ?? null,
            additionalSports: {
              create: additionalSportIds.map((sportId) => ({ sportId })),
            },
            tags: { create: (dto.tags ?? []).map((tag) => ({ tag })) },
            rules: {
              create: (dto.rules ?? []).map((text, index) => ({
                text,
                position: index + 1,
              })),
            },
          },
          select: { id: true },
        });

        const ownerMembership = await tx.clubMember.findUnique({
          where: { clubId_userId: { clubId: club.id, userId: viewerId } },
          select: { role: true, status: true },
        });
        const chat = await tx.conversation.findUnique({
          where: { clubId: club.id },
          select: { type: true },
        });

        if (
          ownerMembership?.role !== 'OWNER' ||
          ownerMembership.status !== 'ACTIVE' ||
          chat?.type !== 'CLUB'
        ) {
          throw new InternalServerErrorException('Could not create the club.');
        }

        return club.id;
      }, TRANSACTION_OPTIONS),
    );

    return this.get(viewerId, clubId);
  }

  /** Clubs the viewer belongs to (ACTIVE), has asked to join (PENDING), or follows. */
  async listMine(viewerId: string): Promise<ClubView[]> {
    const clubs = await this.prisma.club.findMany({
      where: {
        OR: [
          { ownerId: viewerId },
          {
            isActive: true,
            members: {
              some: { userId: viewerId, status: { in: ['ACTIVE', 'PENDING'] } },
            },
          },
          { isActive: true, follows: { some: { userId: viewerId } } },
        ],
      },
      select: CLUB_DETAIL_SELECT,
      orderBy: { name: 'asc' },
    });

    return Promise.all(clubs.map((club) => this.buildView(viewerId, club)));
  }

  /** Any active club; a disabled club is only visible to its owner. */
  async get(viewerId: string, clubId: string): Promise<ClubView> {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: CLUB_DETAIL_SELECT,
    });

    if (!club || (!club.isActive && club.ownerId !== viewerId)) {
      throw new NotFoundException(CLUB_NOT_FOUND_MESSAGE);
    }

    return this.buildView(viewerId, club);
  }

  /** Owner only (MANAGE_CLUB). Capacity may grow, but never below the ACTIVE members. */
  async update(
    viewerId: string,
    clubId: string,
    dto: UpdateClubDto,
  ): Promise<ClubView> {
    const { club } = await this.requirePermission(
      viewerId,
      clubId,
      'MANAGE_CLUB',
      CLUB_OWNER_ONLY_MESSAGE,
    );
    const current = await this.prisma.club.findUniqueOrThrow({
      where: { id: clubId },
      select: {
        sportId: true,
        latitude: true,
        longitude: true,
        activityStartTime: true,
        activityEndTime: true,
      },
    });

    if (dto.maxMembers !== undefined && dto.maxMembers !== club.maxMembers) {
      this.assertWithinLimit(dto.maxMembers);
    }

    assertCoordinates(
      dto.latitude !== undefined ? dto.latitude : current.latitude,
      dto.longitude !== undefined ? dto.longitude : current.longitude,
    );
    assertActivityTimes(
      dto.activityStartTime !== undefined
        ? dto.activityStartTime
        : current.activityStartTime,
      dto.activityEndTime !== undefined
        ? dto.activityEndTime
        : current.activityEndTime,
    );

    const primarySportId = dto.primarySportId ?? current.sportId;
    const additionalSportIds =
      dto.additionalSportIds !== undefined || dto.primarySportId !== undefined
        ? await this.resolveSports(
            primarySportId,
            dto.additionalSportIds ??
              (await this.currentAdditionalSports(clubId)),
          )
        : undefined;

    await this.withUsernameGuard(() =>
      this.withCapacityGuard(clubId, () =>
        this.prisma.$transaction(async (tx) => {
          const maxMembers = await lockClub(tx, clubId);

          if (dto.maxMembers !== undefined && dto.maxMembers < maxMembers) {
            const active = await countActive(tx, clubId);

            if (dto.maxMembers < active) {
              throw new ConflictException(
                `Maximum members cannot be lower than the current ${active} active members.`,
              );
            }
          }

          if (additionalSportIds) {
            await tx.clubSport.deleteMany({ where: { clubId } });
            await tx.clubSport.createMany({
              data: additionalSportIds.map((sportId) => ({ clubId, sportId })),
            });
          }

          if (dto.tags) {
            await tx.clubTag.deleteMany({ where: { clubId } });
            await tx.clubTag.createMany({
              data: dto.tags.map((tag) => ({ clubId, tag })),
            });
          }

          if (dto.rules) {
            await tx.clubRule.deleteMany({ where: { clubId } });
            await tx.clubRule.createMany({
              data: dto.rules.map((text, index) => ({
                clubId,
                text,
                position: index + 1,
              })),
            });
          }

          await tx.club.update({
            where: { id: clubId },
            data: {
              name: dto.name,
              slug: dto.username,
              description: dto.description,
              about: dto.about,
              profileImageUrl: dto.profileImageUrl,
              coverImageUrl: dto.coverImageUrl,
              sportId: dto.primarySportId,
              country: dto.country,
              city: dto.city,
              barangay: dto.barangay,
              homeCourt: dto.homeCourt,
              locationName: dto.locationName,
              latitude: dto.latitude,
              longitude: dto.longitude,
              maxMembers: dto.maxMembers,
              membershipType: dto.membershipType,
              isPublic: dto.isPublic,
              activityDay: dto.activityDay,
              activityStartTime: dto.activityStartTime,
              activityEndTime: dto.activityEndTime,
              trainingSchedule: dto.trainingSchedule,
              contactEmail: dto.contactEmail,
              websiteUrl: dto.websiteUrl,
              facebookUrl: dto.facebookUrl,
              instagramUrl: dto.instagramUrl,
              tiktokUrl: dto.tiktokUrl,
            },
            select: { id: true },
          });
        }, TRANSACTION_OPTIONS),
      ),
    );

    return this.get(viewerId, clubId);
  }

  /**
   * OPEN: in straight away while there is room. APPROVAL_REQUIRED: a PENDING request
   * (no slot used). INVITE_ONLY: only with a PENDING invitation. A PENDING invitation
   * also lets the invitee straight into an OPEN or APPROVAL_REQUIRED club.
   */
  async join(viewerId: string, clubId: string): Promise<ClubJoinResult> {
    const club = await this.findAccessRow(clubId);

    if (!club.isActive) {
      throw new ForbiddenException(CLUB_INACTIVE_MESSAGE);
    }

    const [membership, invite] = await Promise.all([
      this.prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId, userId: viewerId } },
        select: { status: true },
      }),
      this.prisma.clubInvite.findUnique({
        where: { clubId_inviteeId: { clubId, inviteeId: viewerId } },
        select: { id: true, status: true },
      }),
    ]);

    if (membership?.status === 'ACTIVE') {
      throw new ConflictException('You are already a member of this club.');
    }

    if (membership?.status === 'BANNED') {
      throw new ForbiddenException('You cannot join this club.');
    }

    const invited = invite?.status === 'PENDING';

    if (club.membershipType === 'INVITE_ONLY' && !invited) {
      throw new ForbiddenException(CLUB_INVITE_ONLY_MESSAGE);
    }

    if (club.membershipType === 'APPROVAL_REQUIRED' && !invited) {
      if (membership?.status === 'PENDING') {
        throw new ConflictException(
          'Your request to join is waiting for approval.',
        );
      }

      if ((await countActive(this.prisma, clubId)) >= club.maxMembers) {
        throw new ConflictException(CLUB_FULL_MESSAGE);
      }

      const now = new Date();
      await this.prisma.clubMember.upsert({
        where: { clubId_userId: { clubId, userId: viewerId } },
        create: { clubId, userId: viewerId, status: 'PENDING', joinedAt: now },
        update: { status: 'PENDING', role: 'MEMBER', joinedAt: now },
        select: { id: true },
      });

      return { status: 'REQUESTED', club: await this.get(viewerId, clubId) };
    }

    await this.withCapacityGuard(clubId, () =>
      this.prisma.$transaction(async (tx) => {
        const maxMembers = await lockClub(tx, clubId);

        if ((await countActive(tx, clubId)) >= maxMembers) {
          throw new ConflictException(CLUB_FULL_MESSAGE);
        }

        const now = new Date();
        await tx.clubMember.upsert({
          where: { clubId_userId: { clubId, userId: viewerId } },
          create: { clubId, userId: viewerId, status: 'ACTIVE', joinedAt: now },
          update: { status: 'ACTIVE', role: 'MEMBER', joinedAt: now },
          select: { id: true },
        });

        if (invited) {
          await tx.clubInvite.update({
            where: { id: invite.id },
            data: { status: 'ACCEPTED', respondedAt: now },
            select: { id: true },
          });
        }
      }, TRANSACTION_OPTIONS),
    );

    return { status: 'JOINED', club: await this.get(viewerId, clubId) };
  }

  /** Leave the club, or cancel a PENDING request. The owner transfers ownership first. */
  async leave(viewerId: string, clubId: string): Promise<ClubView> {
    const club = await this.findAccessRow(clubId);

    if (club.ownerId === viewerId) {
      throw new ConflictException(
        'Transfer ownership before leaving your club.',
      );
    }

    const { count } = await this.prisma.clubMember.deleteMany({
      where: {
        clubId,
        userId: viewerId,
        status: { in: ['ACTIVE', 'PENDING'] },
      },
    });

    if (count === 0) {
      throw new NotFoundException('You are not a member of this club.');
    }

    return this.get(viewerId, clubId);
  }

  /** ACTIVE members, owner first. Private clubs show them to ACTIVE members only. */
  async listMembers(
    viewerId: string,
    clubId: string,
  ): Promise<ClubMemberView[]> {
    const club = await this.findAccessRow(clubId);
    const membership = await this.findMembership(clubId, viewerId);

    if (!club.isActive && club.ownerId !== viewerId) {
      throw new NotFoundException(CLUB_NOT_FOUND_MESSAGE);
    }

    if (!club.isPublic && membership?.status !== 'ACTIVE') {
      throw new ForbiddenException(CLUB_PRIVATE_MEMBERS_MESSAGE);
    }

    const members = await this.prisma.clubMember.findMany({
      where: { clubId, status: 'ACTIVE' },
      select: { role: true, joinedAt: true, user: { select: AUTHOR_SELECT } },
      orderBy: { joinedAt: 'asc' },
    });

    return members
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])
      .map((member) => ({
        user: toPerson(member.user),
        role: member.role,
        joinedAt: member.joinedAt,
      }));
  }

  async listRequests(
    viewerId: string,
    clubId: string,
  ): Promise<ClubJoinRequestView[]> {
    await this.requirePermission(
      viewerId,
      clubId,
      'MANAGE_MEMBERS',
      CLUB_MANAGE_MEMBERS_MESSAGE,
    );
    const requests = await this.prisma.clubMember.findMany({
      where: { clubId, status: 'PENDING', user: { isActive: true } },
      select: { joinedAt: true, user: { select: AUTHOR_SELECT } },
      orderBy: { joinedAt: 'asc' },
    });

    return requests.map((request) => ({
      user: toPerson(request.user),
      requestedAt: request.joinedAt,
    }));
  }

  /** Re-checks capacity under the club lock, so concurrent approvals never overflow it. */
  async approve(
    viewerId: string,
    clubId: string,
    userId: string,
  ): Promise<ClubMemberView> {
    await this.requirePermission(
      viewerId,
      clubId,
      'MANAGE_MEMBERS',
      CLUB_MANAGE_MEMBERS_MESSAGE,
    );

    return this.withCapacityGuard(clubId, () =>
      this.prisma.$transaction(async (tx) => {
        const maxMembers = await lockClub(tx, clubId);
        const pending = await tx.clubMember.findUnique({
          where: { clubId_userId: { clubId, userId } },
          select: { status: true, user: { select: { isActive: true } } },
        });

        if (pending?.status !== 'PENDING' || !pending.user.isActive) {
          throw new NotFoundException('No pending request from this user.');
        }

        if ((await countActive(tx, clubId)) >= maxMembers) {
          throw new ConflictException(CLUB_FULL_MESSAGE);
        }

        const member = await tx.clubMember.update({
          where: { clubId_userId: { clubId, userId } },
          data: { status: 'ACTIVE', joinedAt: new Date() },
          select: {
            role: true,
            joinedAt: true,
            user: { select: AUTHOR_SELECT },
          },
        });

        return {
          user: toPerson(member.user),
          role: member.role,
          joinedAt: member.joinedAt,
        };
      }, TRANSACTION_OPTIONS),
    );
  }

  async reject(
    viewerId: string,
    clubId: string,
    userId: string,
  ): Promise<{ userId: string; status: 'REJECTED' }> {
    await this.requirePermission(
      viewerId,
      clubId,
      'MANAGE_MEMBERS',
      CLUB_MANAGE_MEMBERS_MESSAGE,
    );
    const { count } = await this.prisma.clubMember.deleteMany({
      where: { clubId, userId, status: 'PENDING' },
    });

    if (count === 0) {
      throw new NotFoundException('No pending request from this user.');
    }

    return { userId, status: 'REJECTED' };
  }

  /** Marks an ACTIVE member REMOVED, which frees their slot and ends their chat access. */
  async remove(
    viewerId: string,
    clubId: string,
    userId: string,
  ): Promise<{ userId: string; status: 'REMOVED' }> {
    const { membership: actor } = await this.requirePermission(
      viewerId,
      clubId,
      'MANAGE_MEMBERS',
      CLUB_MANAGE_MEMBERS_MESSAGE,
    );
    const target = await this.findMembership(clubId, userId);

    if (target?.status !== 'ACTIVE') {
      throw new NotFoundException('This person is not an active member.');
    }

    if (!canManageMember(actor, target)) {
      throw new ForbiddenException('You cannot remove this member.');
    }

    await this.prisma.clubMember.update({
      where: { clubId_userId: { clubId, userId } },
      data: { status: 'REMOVED' },
      select: { id: true },
    });

    return { userId, status: 'REMOVED' };
  }

  /** Owners and admins invite by username; inviting again resets the invitation. */
  async invite(
    viewerId: string,
    clubId: string,
    dto: InviteClubMemberDto,
  ): Promise<ClubInviteView> {
    await this.requirePermission(
      viewerId,
      clubId,
      'MANAGE_MEMBERS',
      CLUB_MANAGE_MEMBERS_MESSAGE,
    );
    const invitee = await this.prisma.user.findFirst({
      where: {
        username: {
          equals: dto.username.replace(/^@+/, ''),
          mode: 'insensitive',
        },
        isActive: true,
      },
      select: AUTHOR_SELECT,
    });

    if (!invitee) {
      throw new NotFoundException('No user with that username.');
    }

    if (invitee.id === viewerId) {
      throw new BadRequestException('You cannot invite yourself.');
    }

    const membership = await this.findMembership(clubId, invitee.id);

    if (membership?.status === 'ACTIVE') {
      throw new ConflictException('This person is already a member.');
    }

    if (membership?.status === 'BANNED') {
      throw new ConflictException('This person cannot be invited.');
    }

    const now = new Date();
    const invite = await this.prisma.clubInvite.upsert({
      where: { clubId_inviteeId: { clubId, inviteeId: invitee.id } },
      create: { clubId, inviterId: viewerId, inviteeId: invitee.id },
      update: {
        inviterId: viewerId,
        status: 'PENDING',
        createdAt: now,
        respondedAt: null,
      },
      select: { id: true, status: true, createdAt: true },
    });

    return { ...invite, invitee: toPerson(invitee) };
  }

  async listInvites(
    viewerId: string,
    clubId: string,
  ): Promise<ClubInviteView[]> {
    await this.requirePermission(
      viewerId,
      clubId,
      'MANAGE_MEMBERS',
      CLUB_MANAGE_MEMBERS_MESSAGE,
    );
    const invites = await this.prisma.clubInvite.findMany({
      where: { clubId, status: 'PENDING', invitee: { isActive: true } },
      select: {
        id: true,
        status: true,
        createdAt: true,
        invitee: { select: AUTHOR_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invites.map(({ invitee, ...invite }) => ({
      ...invite,
      invitee: toPerson(invitee),
    }));
  }

  private async buildView(
    viewerId: string,
    club: ClubDetailRow,
  ): Promise<ClubView> {
    const [currentMembers, membership, invite, follow] = await Promise.all([
      countActive(this.prisma, club.id),
      this.findMembership(club.id, viewerId),
      this.prisma.clubInvite.findUnique({
        where: { clubId_inviteeId: { clubId: club.id, inviteeId: viewerId } },
        select: { status: true },
      }),
      this.prisma.clubFollow.findUnique({
        where: { clubId_userId: { clubId: club.id, userId: viewerId } },
        select: { id: true },
      }),
    ]);
    const isActiveMember = membership?.status === 'ACTIVE';
    const contentVisible = club.isPublic || isActiveMember;
    const availableSlots = Math.max(0, club.maxMembers - currentMembers);

    return {
      id: club.id,
      name: club.name,
      username: club.slug,
      description: club.description,
      about: contentVisible ? club.about : null,
      profileImageUrl: club.profileImageUrl,
      coverImageUrl: club.coverImageUrl,
      primarySport: club.sport,
      additionalSports: club.additionalSports.map(({ sport }) => sport),
      location: {
        country: club.country,
        city: club.city,
        barangay: contentVisible ? club.barangay : null,
        homeCourt: contentVisible ? club.homeCourt : null,
        locationName: club.locationName,
        latitude: contentVisible ? club.latitude : null,
        longitude: contentVisible ? club.longitude : null,
      },
      maxMembers: club.maxMembers,
      currentMembers,
      availableSlots,
      isFull: availableSlots === 0,
      membershipType: club.membershipType,
      isPublic: club.isPublic,
      isActive: club.isActive,
      rules: contentVisible ? club.rules.map((rule) => rule.text) : [],
      tags: club.tags.map((tag) => tag.tag),
      schedule: {
        day: contentVisible ? club.activityDay : null,
        startTime: contentVisible ? club.activityStartTime : null,
        endTime: contentVisible ? club.activityEndTime : null,
        trainingSchedule: contentVisible ? club.trainingSchedule : null,
      },
      contact: {
        email: isActiveMember ? club.contactEmail : null,
        websiteUrl: contentVisible ? club.websiteUrl : null,
        facebookUrl: contentVisible ? club.facebookUrl : null,
        instagramUrl: contentVisible ? club.instagramUrl : null,
        tiktokUrl: contentVisible ? club.tiktokUrl : null,
      },
      owner: toPerson(club.owner),
      viewer: {
        membership,
        hasInvite: invite?.status === 'PENDING' && !isActiveMember,
        follows: follow !== null,
        canManageClub: hasClubPermission(membership, 'MANAGE_CLUB', club),
        canManageMembers: hasClubPermission(membership, 'MANAGE_MEMBERS', club),
        canChat: isActiveMember && club.isActive,
      },
      contentVisible,
      createdAt: club.createdAt,
      updatedAt: club.updatedAt,
    };
  }

  private async findAccessRow(clubId: string): Promise<ClubAccessRow> {
    const club = await this.prisma.club.findUnique({
      where: { id: clubId },
      select: CLUB_ACCESS_SELECT,
    });

    if (!club) {
      throw new NotFoundException(CLUB_NOT_FOUND_MESSAGE);
    }

    return club;
  }

  private findMembership(
    clubId: string,
    userId: string,
  ): Promise<Membership | null> {
    return this.prisma.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
      select: { role: true, status: true },
    });
  }

  private async requirePermission(
    viewerId: string,
    clubId: string,
    permission: ClubPermission,
    message: string,
  ): Promise<{ club: ClubAccessRow; membership: Membership }> {
    const club = await this.findAccessRow(clubId);

    if (!club.isActive && club.ownerId !== viewerId) {
      throw new NotFoundException(CLUB_NOT_FOUND_MESSAGE);
    }

    const membership = await this.findMembership(clubId, viewerId);

    if (!membership || !hasClubPermission(membership, permission, club)) {
      throw new ForbiddenException(
        club.isActive ? message : CLUB_INACTIVE_MESSAGE,
      );
    }

    return { club, membership };
  }

  private assertWithinLimit(maxMembers: number): void {
    if (maxMembers > this.maxMembersLimit) {
      throw new BadRequestException(
        `Maximum members cannot be more than ${this.maxMembersLimit}.`,
      );
    }
  }

  /** Checks the sports exist and are active; returns the additional ones minus the primary. */
  private async resolveSports(
    primarySportId: string | null,
    additionalSportIds: readonly string[],
  ): Promise<string[]> {
    const additional = [...new Set(additionalSportIds)].filter(
      (id) => id !== primarySportId,
    );
    const wanted = primarySportId
      ? [primarySportId, ...additional]
      : additional;
    const found = await this.prisma.sport.findMany({
      where: { id: { in: wanted }, isActive: true },
      select: { id: true },
    });
    const foundIds = new Set(found.map((sport) => sport.id));

    if (primarySportId && !foundIds.has(primarySportId)) {
      throw new BadRequestException('Choose a valid primary sport.');
    }

    if (additional.some((id) => !foundIds.has(id))) {
      throw new BadRequestException('Choose valid additional sports.');
    }

    return additional;
  }

  private async currentAdditionalSports(clubId: string): Promise<string[]> {
    const rows = await this.prisma.clubSport.findMany({
      where: { clubId },
      select: { sportId: true },
    });
    return rows.map((row) => row.sportId);
  }

  private async withUsernameGuard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(CLUB_USERNAME_TAKEN_MESSAGE);
      }

      throw error;
    }
  }

  /** The database capacity triggers are the last line of defence; answer them with a 409. */
  private async withCapacityGuard<T>(
    clubId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (isDatabaseError(error, 'ClubMember_capacity_check')) {
        throw new ConflictException(CLUB_FULL_MESSAGE);
      }

      if (isDatabaseError(error, 'Club_max_members_roster_check')) {
        const active = await countActive(this.prisma, clubId);
        throw new ConflictException(
          `Maximum members cannot be lower than the current ${active} active members.`,
        );
      }

      throw error;
    }
  }
}

/** Locks the club row until the transaction ends and returns its capacity. */
async function lockClub(
  tx: Prisma.TransactionClient,
  clubId: string,
): Promise<number> {
  const rows = await tx.$queryRaw<{ maxMembers: number }[]>`
    SELECT "maxMembers" FROM "Club" WHERE "id" = ${clubId}::uuid FOR UPDATE
  `;

  if (rows.length === 0) {
    throw new NotFoundException(CLUB_NOT_FOUND_MESSAGE);
  }

  return rows[0].maxMembers;
}

function countActive(
  client: Prisma.TransactionClient,
  clubId: string,
): Promise<number> {
  return client.clubMember.count({ where: { clubId, status: 'ACTIVE' } });
}

function assertCoordinates(
  latitude: number | null,
  longitude: number | null,
): void {
  if ((latitude === null) !== (longitude === null)) {
    throw new BadRequestException(
      'Give both latitude and longitude, or neither.',
    );
  }
}

function assertActivityTimes(start: string | null, end: string | null): void {
  if (start && end && minutesOfDay(end) <= minutesOfDay(start)) {
    throw new BadRequestException('End time must be after the start time.');
  }
}

function isDatabaseError(error: unknown, constraint: string): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const details =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? `${error.message} ${JSON.stringify(error.meta ?? {})}`
      : error.message;
  return (
    details.includes(constraint) ||
    (constraint === 'ClubMember_capacity_check' &&
      details.includes('Club is currently full'))
  );
}

function toPerson(user: PersonRow): ClubPersonView {
  return {
    id: user.id,
    username: user.username,
    displayName: formatDisplayName(user),
    profileImageUrl: user.profileImageUrl,
  };
}
