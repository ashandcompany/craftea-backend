import { IsIn, IsNotEmpty } from 'class-validator';

export class ChangeRoleDto {
  @IsNotEmpty()
  @IsIn(['buyer', 'artist', 'admin'], { message: 'Rôle invalide' })
  role: string;
}
