import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsPositive,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemDto {
  @IsInt()
  product_id: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
