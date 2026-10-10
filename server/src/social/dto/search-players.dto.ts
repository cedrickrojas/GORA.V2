import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchPlayersDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}
