import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateReviewDto {
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  product_id: number;

  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
