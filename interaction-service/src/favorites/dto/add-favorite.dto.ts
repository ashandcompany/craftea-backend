import { IsInt, Min } from 'class-validator';

export class AddFavoriteDto {
  @IsInt()
  @Min(1)
  product_id: number;
}
