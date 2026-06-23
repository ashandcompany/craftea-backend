import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class WalletAdjustDto {
  @IsInt()
  @IsPositive()
  amount_cents: number;

  @IsOptional()
  @IsString()
  description?: string;
}
