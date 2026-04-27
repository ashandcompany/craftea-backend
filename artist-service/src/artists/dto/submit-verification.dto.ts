import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitVerificationDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  /** JSON-encoded string array of per-file names, e.g. '["Atelier WIP","Croquis"]' */
  @IsOptional()
  @IsString()
  names?: string;
}
