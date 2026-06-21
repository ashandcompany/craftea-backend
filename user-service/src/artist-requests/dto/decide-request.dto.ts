import { IsIn, IsNotEmpty } from 'class-validator';

export class DecideRequestDto {
  @IsNotEmpty()
  @IsIn(['approve', 'reject'])
  action: 'approve' | 'reject';
}
