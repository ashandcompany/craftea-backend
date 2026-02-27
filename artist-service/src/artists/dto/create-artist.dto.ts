import { IsOptional, IsString } from 'class-validator';

export class CreateArtistDto {
  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  social_links?: string;
}
