import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistRequest } from './entities/artist-request.entity.js';
import { ArtistRequestMessage } from './entities/artist-request-message.entity.js';
import { User } from '../users/entities/user.entity.js';
import { ArtistRequestsService } from './artist-requests.service.js';
import { ArtistRequestsController } from './artist-requests.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([ArtistRequest, ArtistRequestMessage, User])],
  controllers: [ArtistRequestsController],
  providers: [ArtistRequestsService],
})
export class ArtistRequestsModule {}
