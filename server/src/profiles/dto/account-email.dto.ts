import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { trim } from '../../common/validation/transforms';

export class AccountEmailDto {
  @Transform(trim)
  @IsString()
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  currentPassword!: string;
}
