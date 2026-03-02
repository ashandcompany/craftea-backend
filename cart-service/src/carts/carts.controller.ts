import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { CartsService } from './carts.service.js';
import { AddItemDto } from './dto/add-item.dto.js';
import { UpdateItemDto } from './dto/update-item.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  // Récupérer le panier de l'utilisateur connecté
  @Get()
  findMine(@Request() req) {
    return this.cartsService.findByUser(req.user.id);
  }

  // Ajouter un produit au panier
  @Post('items')
  addItem(@Body() dto: AddItemDto, @Request() req) {
    return this.cartsService.addItem(req.user.id, dto);
  }

  // Modifier la quantité d'un item
  @Patch('items/:itemId')
  updateItem(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateItemDto,
    @Request() req,
  ) {
    return this.cartsService.updateItem(req.user.id, itemId, dto);
  }

  // Supprimer un item du panier
  @Delete('items/:itemId')
  removeItem(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Request() req,
  ) {
    return this.cartsService.removeItem(req.user.id, itemId);
  }

  // Vider le panier
  @Delete()
  clear(@Request() req) {
    return this.cartsService.clear(req.user.id);
  }
}
