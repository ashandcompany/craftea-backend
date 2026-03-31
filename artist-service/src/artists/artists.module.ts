import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistsController } from './artists.controller.js';
import { ArtistsService } from './artists.service.js';
import { ArtistProfile } from './entities/artist-profile.entity.js';
import { ArtistEventsModule } from '../rabbitmq/artist-events.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([ArtistProfile]), ArtistEventsModule],
  controllers: [ArtistsController],
  providers: [ArtistsService],
  exports: [ArtistsService],
})
export class ArtistsModule {}
