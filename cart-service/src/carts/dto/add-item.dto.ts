import { IsInt, Min } from 'class-validator';

export class AddItemDto {
  @IsInt()
  product_id: number;

  @IsInt()
  @Min(1)
  quantity: number;
}
