import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service.js';
import { NotificationConsumer } from './notification.consumer.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [NotificationConsumer],
  providers: [EmailService],
})
export class NotificationModule {}
