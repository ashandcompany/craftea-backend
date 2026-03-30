import { IsInt, Min } from 'class-validator';

export class RequestPayoutDto {
  @IsInt()
  @Min(100)
  amount_cents: number;
}
