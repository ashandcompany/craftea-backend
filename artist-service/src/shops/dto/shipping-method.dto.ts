import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  IsArray,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ShippingMethodDto {
  @IsOptional()
  @Transform(({ value }) => (value != null ? parseInt(value, 10) : undefined))
  @IsInt()
  id?: number;

  @IsString()
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['france', 'europe', 'world'], { each: true })
  zones: string[];

  @IsOptional()
  @Transform(({ value }) => (value != null ? parseInt(value, 10) : null))
  @IsInt()
  @Min(0)
  delivery_time_min?: number | null;

  @IsOptional()
  @Transform(({ value }) => (value != null ? parseInt(value, 10) : null))
  @IsInt()
  @Min(0)
  delivery_time_max?: number | null;

  @IsOptional()
  @IsIn(['days', 'weeks'])
  delivery_time_unit?: 'days' | 'weeks';
}

export class UpdateShippingMethodsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShippingMethodDto)
  methods: ShippingMethodDto[];
}
