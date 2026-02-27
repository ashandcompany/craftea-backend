import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { FavoritesModule } from './favorites/favorites.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
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
        database: cfg.get<string>('DB_NAME', 'craftea_interactions'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    AuthModule,
    FavoritesModule,
    ReviewsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
