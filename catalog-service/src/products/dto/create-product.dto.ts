import {
  IsOptional,
  IsString,
  IsNumber,
  IsInt,
  IsBoolean,
  IsArray,
  IsIn,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateProductDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  price?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  stock?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  category_id?: number;

  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  shop_id: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  processing_time_min?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  processing_time_max?: number;

  @IsOptional()
  @IsString()
  @IsIn(['days', 'weeks'])
  processing_time_unit?: 'days' | 'weeks';

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  delivery_time?: number;

  @IsOptional()
  @Transform(({ value }) => (value != null ? parseFloat(value) : undefined))
  @IsNumber()
  shipping_fee?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  @IsArray()
  tags?: number[];
}
