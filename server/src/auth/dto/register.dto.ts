import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsNotIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  trim,
  trimLowercase,
  trimOptional,
} from '../../common/validation/transforms';
import { IsPastDate, Match } from '../../common/validation/validators';
import { RESERVED_USERNAMES } from '../../users/reserved-usernames';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** 3-30 chars of a-z, 0-9, dot, underscore; starts and ends alphanumeric; no repeated separators. */
export const USERNAME_PATTERN =
  /^(?!.*[._]{2})[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$/;

export class RegisterDto {
  @Transform(trimLowercase)
  @IsString()
  @Matches(USERNAME_PATTERN, {
    message:
      'Username must be 3-30 characters using letters, numbers, dots, or underscores, and must start and end with a letter or number.',
  })
  @IsNotIn(RESERVED_USERNAMES, {
    message: 'That username is reserved. Choose another one.',
  })
  username!: string;

  @Transform(trimLowercase)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`,
  })
  password!: string;

  /** Checked against password, never stored. */
  @IsOptional()
  @IsString()
  @Match('password', { message: 'Passwords do not match.' })
  confirmPassword?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'First name is required.' })
  @MaxLength(50)
  firstName!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Last name is required.' })
  @MaxLength(50)
  lastName!: string;

  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @Transform(trimOptional)
  @IsOptional()
  @IsPastDate({
    message: 'Date of birth must be a valid past date (YYYY-MM-DD).',
  })
  dateOfBirth?: string;
}
