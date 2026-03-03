import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ShopsService } from './shops.service.js';
import { CreateShopDto } from './dto/create-shop.dto.js';
import { UpdateShopDto } from './dto/update-shop.dto.js';
import { UpdateShippingProfilesDto } from './dto/shipping-profile.dto.js';
import { UpdateShippingMethodsDto } from './dto/shipping-method.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

const shopUpload = FileFieldsInterceptor([
  { name: 'banner', maxCount: 1 },
  { name: 'logo', maxCount: 1 },
]);

@Controller('shops')
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  /**
   * Récupérer les profils d'expédition de plusieurs boutiques en une requête.
   * GET /shops/shipping/bulk?ids=1,2,3
   * ⚠️  Doit être déclaré AVANT :id pour éviter que "shipping" soit capturé par le wildcard.
   */
  @Get('shipping/bulk')
  getShippingBulk(@Query('ids') ids: string) {
    const shopIds = (ids || '')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    return this.shopsService.getShippingProfilesBulk(shopIds);
  }

  /**
   * Bulk fetch shipping methods for multiple shops.
   * GET /shops/shipping-methods/bulk?ids=1,2,3
   */
  @Get('shipping-methods/bulk')
  getShippingMethodsBulk(@Query('ids') ids: string) {
    const shopIds = (ids || '')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    return this.shopsService.getShippingMethodsBulk(shopIds);
  }

  @Get('artist/:artistId')
  findByArtist(@Param('artistId', ParseIntPipe) artistId: number) {
    return this.shopsService.findByArtist(artistId);
  }

  @Get('user/:userId')
  findByUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.shopsService.findByUserId(userId);
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.shopsService.findById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Post()
  @UseInterceptors(shopUpload)
  create(
    @Request() req,
    @Body() dto: CreateShopDto,
    @UploadedFiles() files: { banner?: Express.Multer.File[]; logo?: Express.Multer.File[] },
  ) {
    return this.shopsService.create(dto, req.user.id, files || {});
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Put(':id')
  @UseInterceptors(shopUpload)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() dto: UpdateShopDto,
    @UploadedFiles() files: { banner?: Express.Multer.File[]; logo?: Express.Multer.File[] },
  ) {
    return this.shopsService.update(id, dto, req.user.id, files || {});
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.shopsService.remove(id, req.user.id);
  }

  // ─── Shipping profiles ──────────────────────────────────────────────

  @Get(':id/shipping')
  getShipping(@Param('id', ParseIntPipe) id: number) {
    return this.shopsService.getShippingProfiles(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Put(':id/shipping')
  updateShipping(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShippingProfilesDto,
    @Request() req,
  ) {
    return this.shopsService.updateShippingProfiles(id, dto, req.user.id);
  }

  // ─── Shipping methods (modes de livraison) ──────────────────────────

  @Get(':id/shipping-methods')
  getShippingMethods(@Param('id', ParseIntPipe) id: number) {
    return this.shopsService.getShippingMethods(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Put(':id/shipping-methods')
  updateShippingMethods(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShippingMethodsDto,
    @Request() req,
  ) {
    return this.shopsService.updateShippingMethods(id, dto, req.user.id);
  }
}
