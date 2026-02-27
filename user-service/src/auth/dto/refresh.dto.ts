import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
  @IsNotEmpty({ message: 'Refresh token requis' })
  @IsString()
  refreshToken: string;
}
