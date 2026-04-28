import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AddItemDto {
  @IsInt()
  product_id: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  selected_options?: string;
}
