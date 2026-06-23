import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsNotEmpty({ message: 'Credential Google requis' })
  @IsString()
  credential: string;
}
