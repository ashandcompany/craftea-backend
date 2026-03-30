import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { User } from './entities/user.entity.js';
import { Log } from '../logs/entities/log.entity.js';
import { MinioModule } from '../minio/minio.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Log]), MinioModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
