import { IsInt, Min } from 'class-validator';

export class RequestPayoutDto {
  @IsInt()
  @Min(1000)
  amount_cents: number;
}
