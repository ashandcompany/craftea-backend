import { IsInt, IsOptional, IsString, Min, Max, MinLength } from 'class-validator';

export class CreateReviewDto {
  @IsInt()
  @Min(1)
  product_id: number;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
