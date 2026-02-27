import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistsController } from './artists.controller.js';
import { ArtistsService } from './artists.service.js';
import { ArtistProfile } from './entities/artist-profile.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([ArtistProfile])],
  controllers: [ArtistsController],
  providers: [ArtistsService],
  exports: [ArtistsService],
})
export class ArtistsModule {}
