import {
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderCompletedSplitDto {
  @IsInt()
  @IsPositive()
  artistId: number;

  @IsInt()
  @IsPositive()
  grossAmount: number;
}

export class OrderCompletedEventDto {
  @IsInt()
  @IsPositive()
  orderId: number;

  @IsInt()
  @IsPositive()
  @IsOptional()
  artistId?: number;

  @IsInt()
  @IsPositive()
  amount: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderCompletedSplitDto)
  @IsOptional()
  splits?: OrderCompletedSplitDto[];
}
