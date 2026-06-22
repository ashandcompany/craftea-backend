import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity.js';
import { Message } from './entities/message.entity.js';
import { MessagingService } from './messaging.service.js';
import { MessagingController } from './messaging.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message])],
  controllers: [MessagingController],
  providers: [MessagingService],
})
export class MessagingModule {}
