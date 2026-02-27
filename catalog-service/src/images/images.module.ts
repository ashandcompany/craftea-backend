import { Module } from '@nestjs/common';
import { ImagesController } from './images.controller.js';

@Module({
  controllers: [ImagesController],
})
export class ImagesModule {}
