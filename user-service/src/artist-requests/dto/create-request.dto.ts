import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Le message de motivation est obligatoire' })
  @MaxLength(2000)
  content: string;
}
