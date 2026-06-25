import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { MessagingService } from './messaging.service.js';
import { CreateMessageDto } from './dto/create-message.dto.js';

@Controller('api/messages')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('unread-count')
  getUnreadCount(@Request() req: any) {
    return this.messagingService.getUnreadCount(req.user.id);
  }

  @Get('conversations')
  listConversations(@Request() req: any) {
    return this.messagingService.listConversations(req.user.id);
  }

  @Post('conversations')
  getOrCreate(
    @Request() req: any,
    @Body('artist_user_id', ParseIntPipe) artistUserId: number,
  ) {
    return this.messagingService.getOrCreate(req.user.id, artistUserId);
  }

  @Get('conversations/:id')
  getMessages(
    @Request() req: any,
    @Param('id', ParseIntPipe) conversationId: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.messagingService.getMessages(
      req.user.id,
      conversationId,
      page,
      limit,
    );
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @Request() req: any,
    @Param('id', ParseIntPipe) conversationId: number,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagingService.sendMessage(
      req.user.id,
      conversationId,
      dto.content,
    );
  }

  @Patch('conversations/:id/read')
  markRead(
    @Request() req: any,
    @Param('id', ParseIntPipe) conversationId: number,
  ) {
    return this.messagingService.markRead(req.user.id, conversationId);
  }
}
