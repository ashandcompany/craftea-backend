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
  DefaultValuePipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ReviewsService } from './reviews.service.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { UpdateReviewDto } from './dto/update-review.dto.js';

@Controller('api/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // --- Public ---

  @Get('product/:productId')
  getByProduct(
    @Param('productId', ParseIntPipe) productId: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.reviewsService.getByProduct(productId, page, limit);
  }

  @Get('product/:productId/average')
  getAverageRating(@Param('productId', ParseIntPipe) productId: number) {
    return this.reviewsService.getAverageRating(productId);
  }

  // --- Authenticated ---

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyReviews(
    @Request() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.reviewsService.getMyReviews(req.user.id, page, limit);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 5, { storage: memoryStorage() }))
  create(
    @Request() req: any,
    @Body() dto: CreateReviewDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.reviewsService.create(req.user.id, dto, files);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 5, { storage: memoryStorage() }))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
    @Body() dto: UpdateReviewDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.reviewsService.update(
      id,
      req.user.id,
      req.user.role,
      dto,
      files,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.reviewsService.remove(id, req.user.id, req.user.role);
  }
}
