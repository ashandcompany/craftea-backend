import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty({ message: 'Prénom requis' })
  @IsString()
  firstname: string;

  @IsNotEmpty({ message: 'Nom requis' })
  @IsString()
  lastname: string;

  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @MinLength(6, { message: 'Mot de passe min 6 caractères' })
  password: string;

  @IsOptional()
  @IsString()
  role?: string;
}
