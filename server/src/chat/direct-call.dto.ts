import {
  IsIn,
  IsString,
  MaxLength,
  Matches,
  IsInt,
  Min,
  Max,
  IsOptional,
} from 'class-validator';

export class StartCallDto {
  @IsIn(['AUDIO', 'VIDEO']) mode!: 'AUDIO' | 'VIDEO';
  @IsString() @MaxLength(65536) @Matches(/^v=0\r?\n/) offer!: string;
}
export class AnswerCallDto {
  @IsString() @MaxLength(65536) @Matches(/^v=0\r?\n/) answer!: string;
}
export class CallCandidateDto {
  @IsString() @MaxLength(3000) @Matches(/^candidate:/) candidate!: string;
  @IsOptional() @IsString() @MaxLength(100) sdpMid?: string;
  @IsOptional() @IsInt() @Min(0) @Max(20) sdpMLineIndex?: number;
}
