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
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ArtistsService } from './artists.service.js';
import { CreateArtistDto } from './dto/create-artist.dto.js';
import { UpdateArtistDto } from './dto/update-artist.dto.js';
import { WalletAdjustDto } from './dto/wallet-adjust.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

const imageUpload = FileFieldsInterceptor([
  { name: 'banner', maxCount: 1 },
  { name: 'logo', maxCount: 1 },
]);

@Controller('artists')
export class ArtistsController {
  constructor(
    private readonly artistsService: ArtistsService,
    private readonly configService: ConfigService,
  ) {}

  private assertInternalToken(req: any) {
    const expected = this.configService.get<string>('INTERNAL_SERVICE_TOKEN', '');
    const provided = req.headers['x-service-token'];

    if (!expected || provided !== expected) {
      throw new ForbiddenException('Invalid service token');
    }
  }

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

  @Patch('internal/stripe/mark-ready')
  internalMarkStripeReady(
    @Body() body: { stripe_account_id: string },
    @Request() req,
  ) {
    this.assertInternalToken(req);
    return this.artistsService.markStripeReady(body.stripe_account_id);
  }

  @Patch('internal/stripe/mark-not-ready')
  internalMarkStripeNotReady(
    @Body() body: { stripe_account_id: string },
    @Request() req,
  ) {
    this.assertInternalToken(req);
    return this.artistsService.markStripeNotReady(body.stripe_account_id);
  }

  @Patch('internal/:id/wallet/credit')
  internalCreditWallet(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: WalletAdjustDto,
    @Request() req,
  ) {
    this.assertInternalToken(req);
    return this.artistsService.creditWallet(id, dto.amount_cents);
  }

  @Patch('internal/:id/wallet/debit')
  internalDebitWallet(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: WalletAdjustDto,
    @Request() req,
  ) {
    this.assertInternalToken(req);
    return this.artistsService.debitWallet(id, dto.amount_cents);
  }

  @Patch('internal/:id/wallet/add-pending')
  internalAddPendingBalance(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: WalletAdjustDto,
    @Request() req,
  ) {
    this.assertInternalToken(req);
    return this.artistsService.addPendingBalance(id, dto.amount_cents);
  }

  @Patch('internal/:id/wallet/subtract-pending')
  internalSubtractPendingBalance(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: WalletAdjustDto,
    @Request() req,
  ) {
    this.assertInternalToken(req);
    return this.artistsService.subtractPendingBalance(id, dto.amount_cents);
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
