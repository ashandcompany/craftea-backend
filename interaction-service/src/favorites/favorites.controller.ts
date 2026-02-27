import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { FavoritesService } from './favorites.service.js';
import { AddFavoriteDto } from './dto/add-favorite.dto.js';

@Controller('api/favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  getMyFavorites(
    @Request() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.favoritesService.getMyFavorites(req.user.id, page, limit);
  }

  @Get('check/:productId')
  check(
    @Request() req: any,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.favoritesService.check(req.user.id, productId);
  }

  @Post()
  add(@Request() req: any, @Body() dto: AddFavoriteDto) {
    return this.favoritesService.add(req.user.id, dto.product_id);
  }

  @Delete(':productId')
  remove(
    @Request() req: any,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.favoritesService.remove(req.user.id, productId);
  }
}
