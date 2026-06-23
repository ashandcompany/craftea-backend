import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service.js';
import { NotificationConsumer } from './notification.consumer.js';
import { TemplatesController } from './templates.controller.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [NotificationConsumer, TemplatesController],
  providers: [EmailService],
})
export class NotificationModule {}
