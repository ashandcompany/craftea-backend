import { Global, Module } from '@nestjs/common';
import { ArtistEventsPublisher } from './artist-events.publisher.js';

@Global()
@Module({
  providers: [ArtistEventsPublisher],
  exports: [ArtistEventsPublisher],
})
export class ArtistEventsModule {}
