import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { OrdersModule } from './orders/orders.module.js';

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
        database: cfg.get<string>('DB_NAME', 'craftea_orders'),
        autoLoadEntities: true,
        synchronize: true, // dev only
      }),
    }),
    AuthModule,
    OrdersModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
