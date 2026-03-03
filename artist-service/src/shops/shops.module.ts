import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopsController } from './shops.controller.js';
import { ShopsService } from './shops.service.js';
import { Shop } from './entities/shop.entity.js';
import { ShopShippingProfile } from './entities/shop-shipping-profile.entity.js';
import { ArtistProfile } from '../artists/entities/artist-profile.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Shop, ShopShippingProfile, ArtistProfile])],
  controllers: [ShopsController],
  providers: [ShopsService],
})
export class ShopsModule {}
