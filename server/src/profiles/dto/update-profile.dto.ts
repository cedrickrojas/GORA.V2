import { Transform } from 'class-transformer';
import {
  IsEmpty,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { trim, trimToNull } from '../../common/validation/transforms';
import { IsPastDate } from '../../common/validation/validators';

export const PROFILE_NAME_MAX_LENGTH = 50;
export const PROFILE_BIO_MAX_LENGTH = 160;
export const PROFILE_CITY_MAX_LENGTH = 100;
export const IMAGE_URL_MAX_LENGTH = 2048;

const IMAGE_URL_OPTIONS = {
  protocols: ['http', 'https'],
  require_protocol: true,
};

/**
 * The owner's editable profile fields. Omitted fields stay as they are; null (or a blank
 * string) clears an optional field. Anything else, such as role or passwordHash, is rejected
 * by the global ValidationPipe.
 */
export class UpdateProfileDto {
  @IsEmpty({ message: 'Username cannot be changed from your profile.' })
  username?: never;

  @IsEmpty({ message: 'Email cannot be changed from your profile.' })
  email?: never;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString({ message: 'First name must be text.' })
  @IsNotEmpty({ message: 'First name cannot be empty.' })
  @MaxLength(PROFILE_NAME_MAX_LENGTH, {
    message: `First name must be at most ${PROFILE_NAME_MAX_LENGTH} characters.`,
  })
  firstName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Last name must be text.' })
  @IsNotEmpty({ message: 'Last name cannot be empty.' })
  @MaxLength(PROFILE_NAME_MAX_LENGTH, {
    message: `Last name must be at most ${PROFILE_NAME_MAX_LENGTH} characters.`,
  })
  lastName?: string;

  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: 'Bio must be text.' })
  @MaxLength(PROFILE_BIO_MAX_LENGTH, {
    message: `Bio must be at most ${PROFILE_BIO_MAX_LENGTH} characters.`,
  })
  bio?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString({ message: 'City must be text.' })
  @MaxLength(PROFILE_CITY_MAX_LENGTH, {
    message: `City must be at most ${PROFILE_CITY_MAX_LENGTH} characters.`,
  })
  city?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsPastDate({
    message: 'Date of birth must be a valid past date (YYYY-MM-DD).',
  })
  dateOfBirth?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsUrl(IMAGE_URL_OPTIONS, {
    message: 'Profile photo must be a valid http(s) image URL.',
  })
  @MaxLength(IMAGE_URL_MAX_LENGTH, {
    message: 'Profile photo URL is too long.',
  })
  profileImageUrl?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsUrl(IMAGE_URL_OPTIONS, {
    message: 'Cover photo must be a valid http(s) image URL.',
  })
  @MaxLength(IMAGE_URL_MAX_LENGTH, { message: 'Cover photo URL is too long.' })
  coverImageUrl?: string | null;
}
