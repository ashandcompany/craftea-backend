import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
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

  /**
   * Zone de livraison : 'france' | 'europe' | 'world'
   * Utilisé pour calculer les frais de port par boutique.
   */
  @IsOptional()
  @IsString()
  shipping_zone?: string;

  /**
   * IDs des boutiques pour lesquelles passer commande (optionnel).
   * Si absent, commande pour toutes les boutiques du panier.
   */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  shop_ids?: number[];
}
