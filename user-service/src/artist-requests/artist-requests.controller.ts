import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { ArtistRequestsService } from './artist-requests.service.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { DecideRequestDto } from './dto/decide-request.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('artist-requests')
export class ArtistRequestsController {
  constructor(private readonly artistRequestsService: ArtistRequestsService) {}

  /** Buyer: submit a new request */
  @UseGuards(JwtAuthGuard)
  @Post()
  submit(@Request() req, @Body() dto: CreateRequestDto) {
    return this.artistRequestsService.submit(req.user.id, dto.content);
  }

  /** Buyer: get my own request (most recent) */
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  getMyRequest(@Request() req) {
    return this.artistRequestsService.getMyRequest(req.user.id);
  }

  /** Buyer: send a message in my active request */
  @UseGuards(JwtAuthGuard)
  @Post('mine/messages')
  addUserMessage(@Request() req, @Body() dto: SendMessageDto) {
    return this.artistRequestsService.addUserMessage(req.user.id, dto.content);
  }

  /** Admin: list all requests */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get()
  adminList() {
    return this.artistRequestsService.adminList();
  }

  /** Admin: get a specific request with full thread */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get(':id')
  adminGetById(@Param('id', ParseIntPipe) id: number) {
    return this.artistRequestsService.getById(id);
  }

  /** Admin: send a message (sets status to info_requested) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post(':id/messages')
  adminAddMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendMessageDto,
    @Request() req,
  ) {
    return this.artistRequestsService.adminAddMessage(
      id,
      req.user.id,
      dto.content,
    );
  }

  /** Admin: approve or reject */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/decide')
  adminDecide(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecideRequestDto,
    @Request() req,
  ) {
    return this.artistRequestsService.adminDecide(id, req.user.id, dto.action);
  }
}
