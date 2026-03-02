import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Order, OrderStatus } from './entities/order.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';

@Injectable()
export class OrdersService {
  private catalogUrl: string;

  constructor(
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem) private itemsRepo: Repository<OrderItem>,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.catalogUrl = this.configService.get<string>('CATALOG_URL', 'http://catalog-service:3003');
  }

  async create(dto: CreateOrderDto, userId: number): Promise<Order> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('La commande doit contenir au moins un article');
    }

    // Vérifier et décrémenter le stock pour chaque article
    const decremented: { product_id: number; quantity: number }[] = [];
    try {
      for (const item of dto.items) {
        await firstValueFrom(
          this.httpService.patch(
            `${this.catalogUrl}/api/products/${item.product_id}/decrement-stock`,
            { quantity: item.quantity },
          ),
        );
        decremented.push({ product_id: item.product_id, quantity: item.quantity });
      }
    } catch (error: any) {
      // Rollback : restaurer le stock des produits déjà décrémentés
      for (const d of decremented) {
        try {
          await firstValueFrom(
            this.httpService.patch(
              `${this.catalogUrl}/api/products/${d.product_id}/decrement-stock`,
              { quantity: -d.quantity },
            ),
          );
        } catch {
          // best-effort rollback
        }
      }

      const msg = error?.response?.data?.message || 'Erreur lors de la vérification du stock';
      throw new BadRequestException(msg);
    }

    const total = dto.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const order = this.ordersRepo.create({
      user_id: userId,
      status: OrderStatus.PENDING,
      total: parseFloat(total.toFixed(2)),
      items: dto.items.map((item) =>
        this.itemsRepo.create({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
        }),
      ),
    });

    return this.ordersRepo.save(order);
  }

  async findByUser(userId: number): Promise<Order[]> {
    return this.ordersRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number, currentUser: { id: number; role: string }): Promise<Order> {
    const order = await this.ordersRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Commande introuvable');

    if (currentUser.role !== 'admin' && order.user_id !== currentUser.id) {
      throw new ForbiddenException('Accès interdit');
    }

    return order;
  }

  async updateStatus(
    id: number,
    dto: UpdateOrderStatusDto,
    currentUser: { id: number; role: string },
  ): Promise<Order> {
    const order = await this.ordersRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Commande introuvable');

    if (currentUser.role !== 'admin' && order.user_id !== currentUser.id) {
      throw new ForbiddenException('Accès interdit');
    }

    // Only admin can set certain statuses
    const adminOnlyStatuses: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    if (adminOnlyStatuses.includes(dto.status) && currentUser.role !== 'admin') {
      throw new ForbiddenException('Seul un admin peut définir ce statut');
    }

    order.status = dto.status;
    return this.ordersRepo.save(order);
  }

  async findAll(): Promise<Order[]> {
    return this.ordersRepo.find({ order: { created_at: 'DESC' } });
  }
}
