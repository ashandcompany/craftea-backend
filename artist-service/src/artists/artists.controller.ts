import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ArtistsService } from './artists.service.js';
import { CreateArtistDto } from './dto/create-artist.dto.js';
import { UpdateArtistDto } from './dto/update-artist.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

const imageUpload = FileFieldsInterceptor([
  { name: 'banner', maxCount: 1 },
  { name: 'logo', maxCount: 1 },
]);

@Controller('artists')
export class ArtistsController {
  constructor(private readonly artistsService: ArtistsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Get('profile/me')
  me(@Request() req) {
    return this.artistsService.me(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Put('profile/me')
  @UseInterceptors(imageUpload)
  update(
    @Request() req,
    @Body() dto: UpdateArtistDto,
    @UploadedFiles() files: { banner?: Express.Multer.File[]; logo?: Express.Multer.File[] },
  ) {
    return this.artistsService.update(req.user.id, dto, files || {});
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Post('profile/me/stripe/onboarding')
  createStripeAccount(@Request() req) {
    return this.artistsService.createStripeAccount(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Get('profile/me/stripe/status')
  stripeStatus(@Request() req) {
    return this.artistsService.syncStripeOnboardingStatus(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Post()
  @UseInterceptors(imageUpload)
  create(
    @Request() req,
    @Body() dto: CreateArtistDto,
    @UploadedFiles() files: { banner?: Express.Multer.File[]; logo?: Express.Multer.File[] },
  ) {
    return this.artistsService.create(dto, req.user.id, files || {});
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/all')
  adminGetAll() {
    return this.artistsService.adminGetAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch(':id/toggle-validation')
  toggleValidation(@Param('id', ParseIntPipe) id: number) {
    return this.artistsService.toggleValidation(id);
  }

  @Get()
  findAll() {
    return this.artistsService.findAll();
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.artistsService.findById(id);
  }
}
