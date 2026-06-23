import {
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ShippingZone } from '../entities/shop-shipping-profile.entity.js';

export class ShippingProfileDto {
  @IsEnum(ShippingZone)
  zone: ShippingZone;

  @Transform(({ value }) => parseFloat(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  base_fee: number;

  @Transform(({ value }) => parseFloat(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  additional_item_fee: number;

  @IsOptional()
  @Transform(({ value }) => (value != null ? parseFloat(value) : null))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  free_shipping_threshold?: number | null;
}

export class UpdateShippingProfilesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShippingProfileDto)
  profiles: ShippingProfileDto[];
}
