import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @IsInt()
  @IsOptional()
  order_id?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsString()
  @Length(3, 3)
  @IsOptional()
  currency?: string = 'EUR';

  @IsString()
  source_id: string;
}
