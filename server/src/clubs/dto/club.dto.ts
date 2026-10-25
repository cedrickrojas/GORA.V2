import { applyDecorators } from '@nestjs/common';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type {
  ClubActivityDay,
  ClubMembershipType,
} from '../../generated/prisma/client';
import { trim, trimToNull } from '../../common/validation/transforms';
import { CLUB_MAX_MEMBERS_CEILING } from '../../config/env.validation';
import {
  CLUB_ABOUT_MAX_LENGTH,
  CLUB_ACTIVITY_DAYS,
  CLUB_ADDITIONAL_SPORTS_MAX,
  CLUB_DESCRIPTION_MAX_LENGTH,
  CLUB_EMAIL_MAX_LENGTH,
  CLUB_MEMBERSHIP_TYPES,
  CLUB_NAME_MAX_LENGTH,
  CLUB_NAME_MIN_LENGTH,
  CLUB_PLACE_MAX_LENGTH,
  CLUB_REGION_MAX_LENGTH,
  CLUB_RULE_MAX_LENGTH,
  CLUB_RULES_MAX,
  CLUB_SOCIAL_HOSTS,
  CLUB_TAG_PATTERN,
  CLUB_TAGS_MAX,
  CLUB_TIME_PATTERN,
  CLUB_TRAINING_SCHEDULE_MAX_LENGTH,
  CLUB_URL_MAX_LENGTH,
  CLUB_USERNAME_MAX_LENGTH,
  CLUB_USERNAME_MIN_LENGTH,
  CLUB_USERNAME_PATTERN,
  normalizeClubTag,
  normalizeClubUsername,
} from '../club-fields';

const whenPresent = () => ValidateIf((_, value) => value !== undefined);

function toUsername({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? normalizeClubUsername(value) : value;
}

function toLowerEmail(params: TransformFnParams): unknown {
  const value = trimToNull(params);
  return typeof value === 'string' ? value.toLowerCase() : value;
}

function toTagList({ value }: TransformFnParams): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  const normalized = value.map((tag: unknown) =>
    typeof tag === 'string' ? normalizeClubTag(tag) : tag,
  );
  return normalized.filter(
    (tag, index) =>
      typeof tag !== 'string' || normalized.indexOf(tag) === index,
  );
}

function toTrimmedList({ value }: TransformFnParams): unknown {
  return Array.isArray(value)
    ? value.map((item: unknown) =>
        typeof item === 'string' ? item.trim() : item,
      )
    : value;
}

function toUniqueList({ value }: TransformFnParams): unknown {
  return Array.isArray(value) ? [...new Set(value)] : value;
}

const HTTP_URL = { protocols: ['http', 'https'], require_protocol: true };

const NameRules = () =>
  applyDecorators(
    Transform(trim),
    IsString({ message: 'Club name must be text.' }),
    MinLength(CLUB_NAME_MIN_LENGTH, {
      message: `Club name must be at least ${CLUB_NAME_MIN_LENGTH} characters.`,
    }),
    MaxLength(CLUB_NAME_MAX_LENGTH, {
      message: `Club name must be at most ${CLUB_NAME_MAX_LENGTH} characters.`,
    }),
  );

const UsernameRules = () =>
  applyDecorators(
    Transform(toUsername),
    IsString({ message: 'Club username must be text.' }),
    MinLength(CLUB_USERNAME_MIN_LENGTH, {
      message: `Club username must be at least ${CLUB_USERNAME_MIN_LENGTH} characters.`,
    }),
    MaxLength(CLUB_USERNAME_MAX_LENGTH, {
      message: `Club username must be at most ${CLUB_USERNAME_MAX_LENGTH} characters.`,
    }),
    Matches(CLUB_USERNAME_PATTERN, {
      message:
        'Club username can use lowercase letters, numbers, and single hyphens between them.',
    }),
  );

const DescriptionRules = () =>
  applyDecorators(
    Transform(trim),
    IsString({ message: 'Short description must be text.' }),
    IsNotEmpty({ message: 'Add a short description.' }),
    MaxLength(CLUB_DESCRIPTION_MAX_LENGTH, {
      message: `Short description must be at most ${CLUB_DESCRIPTION_MAX_LENGTH} characters.`,
    }),
  );

const PrimarySportRules = () =>
  applyDecorators(IsUUID('all', { message: 'Choose a primary sport.' }));

const MaxMembersRules = () =>
  applyDecorators(
    IsDefined({ message: 'Maximum members is required.' }),
    IsInt({ message: 'Maximum members must be a whole number.' }),
    Min(1, { message: 'Maximum members must be at least 1.' }),
    Max(CLUB_MAX_MEMBERS_CEILING, {
      message: `Maximum members cannot be more than ${CLUB_MAX_MEMBERS_CEILING}.`,
    }),
  );

const MembershipTypeRules = () =>
  applyDecorators(
    IsIn(CLUB_MEMBERSHIP_TYPES, {
      message: `Who can join must be one of ${CLUB_MEMBERSHIP_TYPES.join(', ')}.`,
    }),
  );

const PrivacyRules = () =>
  applyDecorators(
    IsBoolean({ message: 'Privacy must be true (public) or false (private).' }),
  );

/** Optional text; a blank string or null clears it. */
const OptionalText = (label: string, max: number) =>
  applyDecorators(
    Transform(trimToNull),
    IsOptional(),
    IsString({ message: `${label} must be text.` }),
    MaxLength(max, { message: `${label} must be at most ${max} characters.` }),
  );

const OptionalUrl = (label: string) =>
  applyDecorators(
    Transform(trimToNull),
    IsOptional(),
    IsUrl(HTTP_URL, { message: `${label} must be a valid http(s) URL.` }),
    MaxLength(CLUB_URL_MAX_LENGTH, { message: `${label} URL is too long.` }),
  );

const OptionalSocialUrl = (
  label: string,
  hosts: readonly RegExp[],
  site: string,
) =>
  applyDecorators(
    Transform(trimToNull),
    IsOptional(),
    IsUrl(
      { ...HTTP_URL, host_whitelist: [...hosts] },
      { message: `${label} link must be an https://${site}/ address.` },
    ),
    MaxLength(CLUB_URL_MAX_LENGTH, { message: `${label} URL is too long.` }),
  );

const OptionalCoordinate = (label: string, limit: number) =>
  applyDecorators(
    IsOptional(),
    IsNumber(
      { allowNaN: false, allowInfinity: false },
      { message: `${label} must be a number.` },
    ),
    Min(-limit, {
      message: `${label} must be between -${limit} and ${limit}.`,
    }),
    Max(limit, { message: `${label} must be between -${limit} and ${limit}.` }),
  );

const OptionalTime = (label: string) =>
  applyDecorators(
    Transform(trimToNull),
    IsOptional(),
    Matches(CLUB_TIME_PATTERN, {
      message: `${label} must be a time like 18:30.`,
    }),
  );

const OptionalActivityDay = () =>
  applyDecorators(
    Transform(trimToNull),
    IsOptional(),
    IsIn(CLUB_ACTIVITY_DAYS, {
      message: 'Activity day must be a day of the week.',
    }),
  );

const OptionalEmail = () =>
  applyDecorators(
    Transform(toLowerEmail),
    IsOptional(),
    IsEmail({}, { message: 'Contact email must be a valid email address.' }),
    MaxLength(CLUB_EMAIL_MAX_LENGTH, { message: 'Contact email is too long.' }),
  );

const AdditionalSportsRules = () =>
  applyDecorators(
    Transform(toUniqueList),
    IsArray({ message: 'Additional sports must be a list.' }),
    ArrayMaxSize(CLUB_ADDITIONAL_SPORTS_MAX, {
      message: `Choose at most ${CLUB_ADDITIONAL_SPORTS_MAX} additional sports.`,
    }),
    IsUUID('all', {
      each: true,
      message: 'Each additional sport must be a sport id.',
    }),
  );

const RulesRules = () =>
  applyDecorators(
    Transform(toTrimmedList),
    IsArray({ message: 'Rules must be a list.' }),
    ArrayMaxSize(CLUB_RULES_MAX, {
      message: `A club can have at most ${CLUB_RULES_MAX} rules.`,
    }),
    IsString({ each: true, message: 'Each rule must be text.' }),
    IsNotEmpty({ each: true, message: 'Rules cannot be empty.' }),
    MaxLength(CLUB_RULE_MAX_LENGTH, {
      each: true,
      message: `Each rule must be at most ${CLUB_RULE_MAX_LENGTH} characters.`,
    }),
  );

const TagsRules = () =>
  applyDecorators(
    Transform(toTagList),
    IsArray({ message: 'Tags must be a list.' }),
    ArrayMaxSize(CLUB_TAGS_MAX, {
      message: `A club can have at most ${CLUB_TAGS_MAX} tags.`,
    }),
    IsString({ each: true, message: 'Each tag must be text.' }),
    Matches(CLUB_TAG_PATTERN, {
      each: true,
      message: 'Tags must be 2 to 30 letters or numbers.',
    }),
  );

/**
 * Everything the creator fills in. The owner, member count, chat, and timestamps are
 * never accepted from the client: the global ValidationPipe rejects unknown fields.
 */
export class CreateClubDto {
  @NameRules()
  name!: string;

  /** The club's @handle, stored as Club.slug. */
  @UsernameRules()
  username!: string;

  @DescriptionRules()
  description!: string;

  @OptionalText('About the club', CLUB_ABOUT_MAX_LENGTH)
  about?: string | null;

  @OptionalUrl('Profile photo')
  profileImageUrl?: string | null;

  @OptionalUrl('Cover photo')
  coverImageUrl?: string | null;

  @PrimarySportRules()
  primarySportId!: string;

  @IsOptional()
  @AdditionalSportsRules()
  additionalSportIds?: string[];

  @OptionalText('Country', CLUB_REGION_MAX_LENGTH)
  country?: string | null;

  @OptionalText('City / Municipality', CLUB_REGION_MAX_LENGTH)
  city?: string | null;

  @OptionalText('Barangay', CLUB_REGION_MAX_LENGTH)
  barangay?: string | null;

  @OptionalText('Home court / venue', CLUB_PLACE_MAX_LENGTH)
  homeCourt?: string | null;

  @OptionalText('Location name', CLUB_PLACE_MAX_LENGTH)
  locationName?: string | null;

  @OptionalCoordinate('Latitude', 90)
  latitude?: number | null;

  @OptionalCoordinate('Longitude', 180)
  longitude?: number | null;

  @MaxMembersRules()
  maxMembers!: number;

  @IsOptional()
  @MembershipTypeRules()
  membershipType?: ClubMembershipType;

  @IsOptional()
  @PrivacyRules()
  isPublic?: boolean;

  @IsOptional()
  @RulesRules()
  rules?: string[];

  @IsOptional()
  @TagsRules()
  tags?: string[];

  @OptionalActivityDay()
  activityDay?: ClubActivityDay | null;

  @OptionalTime('Start time')
  activityStartTime?: string | null;

  @OptionalTime('End time')
  activityEndTime?: string | null;

  @OptionalText('Training schedule', CLUB_TRAINING_SCHEDULE_MAX_LENGTH)
  trainingSchedule?: string | null;

  @OptionalEmail()
  contactEmail?: string | null;

  @OptionalUrl('Website')
  websiteUrl?: string | null;

  @OptionalSocialUrl('Facebook', CLUB_SOCIAL_HOSTS.facebookUrl, 'facebook.com')
  facebookUrl?: string | null;

  @OptionalSocialUrl(
    'Instagram',
    CLUB_SOCIAL_HOSTS.instagramUrl,
    'instagram.com',
  )
  instagramUrl?: string | null;

  @OptionalSocialUrl('TikTok', CLUB_SOCIAL_HOSTS.tiktokUrl, 'tiktok.com')
  tiktokUrl?: string | null;
}

/**
 * Club settings (owner only). Omitted fields stay as they are; null or a blank string
 * clears an optional field; a list replaces the whole list ([] clears it).
 */
export class UpdateClubDto {
  @whenPresent()
  @NameRules()
  name?: string;

  @whenPresent()
  @UsernameRules()
  username?: string;

  @whenPresent()
  @DescriptionRules()
  description?: string;

  @OptionalText('About the club', CLUB_ABOUT_MAX_LENGTH)
  about?: string | null;

  @OptionalUrl('Profile photo')
  profileImageUrl?: string | null;

  @OptionalUrl('Cover photo')
  coverImageUrl?: string | null;

  @whenPresent()
  @PrimarySportRules()
  primarySportId?: string;

  @whenPresent()
  @AdditionalSportsRules()
  additionalSportIds?: string[];

  @OptionalText('Country', CLUB_REGION_MAX_LENGTH)
  country?: string | null;

  @OptionalText('City / Municipality', CLUB_REGION_MAX_LENGTH)
  city?: string | null;

  @OptionalText('Barangay', CLUB_REGION_MAX_LENGTH)
  barangay?: string | null;

  @OptionalText('Home court / venue', CLUB_PLACE_MAX_LENGTH)
  homeCourt?: string | null;

  @OptionalText('Location name', CLUB_PLACE_MAX_LENGTH)
  locationName?: string | null;

  @OptionalCoordinate('Latitude', 90)
  latitude?: number | null;

  @OptionalCoordinate('Longitude', 180)
  longitude?: number | null;

  @whenPresent()
  @MaxMembersRules()
  maxMembers?: number;

  @whenPresent()
  @MembershipTypeRules()
  membershipType?: ClubMembershipType;

  @whenPresent()
  @PrivacyRules()
  isPublic?: boolean;

  @whenPresent()
  @RulesRules()
  rules?: string[];

  @whenPresent()
  @TagsRules()
  tags?: string[];

  @OptionalActivityDay()
  activityDay?: ClubActivityDay | null;

  @OptionalTime('Start time')
  activityStartTime?: string | null;

  @OptionalTime('End time')
  activityEndTime?: string | null;

  @OptionalText('Training schedule', CLUB_TRAINING_SCHEDULE_MAX_LENGTH)
  trainingSchedule?: string | null;

  @OptionalEmail()
  contactEmail?: string | null;

  @OptionalUrl('Website')
  websiteUrl?: string | null;

  @OptionalSocialUrl('Facebook', CLUB_SOCIAL_HOSTS.facebookUrl, 'facebook.com')
  facebookUrl?: string | null;

  @OptionalSocialUrl(
    'Instagram',
    CLUB_SOCIAL_HOSTS.instagramUrl,
    'instagram.com',
  )
  instagramUrl?: string | null;

  @OptionalSocialUrl('TikTok', CLUB_SOCIAL_HOSTS.tiktokUrl, 'tiktok.com')
  tiktokUrl?: string | null;
}

export class InviteClubMemberDto {
  @Transform(trim)
  @IsString({ message: 'Username must be text.' })
  @IsNotEmpty({ message: 'Enter the username of the person to invite.' })
  @MaxLength(50)
  username!: string;
}
