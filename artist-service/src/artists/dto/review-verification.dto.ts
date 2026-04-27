import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewVerificationDto {
  @IsEnum(['approve', 'reject'])
  action: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
