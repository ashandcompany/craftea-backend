import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
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

  @Get('artist/:artistId')
  findByArtist(@Param('artistId', ParseIntPipe) artistId: number) {
    return this.shopsService.findByArtist(artistId);
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
}
