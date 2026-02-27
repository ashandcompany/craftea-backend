import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { ProductsModule } from './products/products.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { TagsModule } from './tags/tags.module.js';
import { ImagesModule } from './images/images.module.js';
import { MinioModule } from './minio/minio.module.js';
import { RedisModule } from './redis/redis.module.js';
import { AppController } from './app.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres' as const,
        host: cfg.get<string>('DB_HOST', 'localhost'),
        port: parseInt(cfg.get<string>('DB_PORT', '5432'), 10),
        username: cfg.get<string>('DB_USER', 'craftea'),
        password: cfg.get<string>('DB_PASS', 'craftea_pass'),
        database: cfg.get<string>('DB_NAME', 'craftea_catalog'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    AuthModule,
    MinioModule,
    RedisModule,
    ProductsModule,
    CategoriesModule,
    TagsModule,
    ImagesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
