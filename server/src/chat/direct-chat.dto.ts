import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trim } from '../common/validation/transforms';

export class SendDirectMessageDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Write a message before sending.' })
  @MaxLength(1000, { message: 'Messages can be at most 1000 characters.' })
  body!: string;
}
