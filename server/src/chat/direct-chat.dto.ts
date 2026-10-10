import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { trim } from '../common/validation/transforms';
import { MESSAGE_REACTION_EMOJIS } from './message-reactions';
import { ReportReason } from '../generated/prisma/client';

export class AttachMessageDto {
  @IsString()
  @MaxLength(1_400_000)
  data!: string;
}
export class ForwardMessageDto {
  @IsUUID()
  conversationId!: string;
}
export class PinMessageDto {
  @IsBoolean()
  pinned!: boolean;
}
export class ReportMessageDto {
  @IsIn(Object.values(ReportReason))
  reason!: ReportReason;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class ReactToMessageDto {
  @IsIn(MESSAGE_REACTION_EMOJIS, {
    message: 'Choose one of the supported reactions.',
  })
  emoji!: (typeof MESSAGE_REACTION_EMOJIS)[number];
}

export class SendDirectMessageDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Write a message before sending.' })
  @MaxLength(1000, { message: 'Messages can be at most 1000 characters.' })
  body!: string;
}
