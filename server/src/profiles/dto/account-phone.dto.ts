import { Transform } from 'class-transformer';
import { IsString, Matches, MinLength } from 'class-validator';
import { trim } from '../../common/validation/transforms';

export class AccountPhoneDto {
  @Transform(trim)
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'Enter a phone number with country code, such as +639123456789.' })
  phoneNumber!: string;

  @IsString()
  @MinLength(1)
  currentPassword!: string;
}
