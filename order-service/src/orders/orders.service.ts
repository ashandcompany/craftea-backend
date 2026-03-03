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
  private artistUrl: string;

  constructor(
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem) private itemsRepo: Repository<OrderItem>,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.catalogUrl = this.configService.get<string>('CATALOG_URL', 'http://catalog-service:3003');
    this.artistUrl = this.configService.get<string>('ARTIST_URL', 'http://artist-service:3002');
  }

  async create(dto: CreateOrderDto, userId: number): Promise<Order> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('La commande doit contenir au moins un article');
    }

    // Vérifier et décrémenter le stock pour chaque article, récupérer le shop_id
    const decremented: { product_id: number; quantity: number }[] = [];
    const productShopMap = new Map<number, number>();
    try {
      for (const item of dto.items) {
        // Récupérer le produit pour obtenir le shop_id
        const { data: product } = await firstValueFrom(
          this.httpService.get(`${this.catalogUrl}/api/products/${item.product_id}`),
        );
        if (product?.shop_id) {
          productShopMap.set(item.product_id, product.shop_id);
        }

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
          shop_id: productShopMap.get(item.product_id) ?? undefined,
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
    const order = await this.ordersRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Commande introuvable');

    // Vérifier si l'utilisateur est le propriétaire, un admin, ou l'artiste de la boutique
    const isOwner = order.user_id === currentUser.id;
    const isAdmin = currentUser.role === 'admin';
    const isArtist = currentUser.role === 'artist';
    let isShopOwner = false;

    if (isArtist && !isOwner) {
      isShopOwner = await this.isArtistOwnerOfOrder(currentUser.id, order);
    }

    if (!isAdmin && !isOwner && !isShopOwner) {
      throw new ForbiddenException('Accès interdit');
    }

    // Les artistes (propriétaires de la boutique) et admins peuvent gérer les statuts
    const artistOrAdminStatuses: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    if (artistOrAdminStatuses.includes(dto.status) && !isAdmin && !isShopOwner) {
      throw new ForbiddenException('Seul l\'artiste ou un admin peut définir ce statut');
    }

    // Le client ne peut qu'annuler
    if (isOwner && !isAdmin && !isShopOwner && dto.status !== OrderStatus.CANCELLED) {
      throw new ForbiddenException('Vous ne pouvez qu\'annuler votre commande');
    }

    // Si annulation : restaurer le stock et refund le paiement
    if (dto.status === OrderStatus.CANCELLED && order.status !== OrderStatus.CANCELLED) {
      await this.handleOrderCancellation(order);
    }

    order.status = dto.status;
    return this.ordersRepo.save(order);
  }

  private async handleOrderCancellation(order: Order): Promise<void> {
    const paymentUrl = this.configService.get<string>(
      'PAYMENT_URL',
      'http://payment-service:3007',
    );

    // 1. Restaurer le stock pour chaque article
    for (const item of order.items || []) {
      try {
        await firstValueFrom(
          this.httpService.patch(
            `${this.catalogUrl}/api/products/${item.product_id}/decrement-stock`,
            { quantity: -item.quantity }, // Négatif pour augmenter le stock
          ),
        );
      } catch (error) {
        // Log l'erreur mais continue (best-effort)
        console.error(
          `Failed to refund stock for product ${item.product_id}:`,
          error,
        );
      }
    }

    // 2. Refund le paiement associé à cette commande
    try {
      const payments = await firstValueFrom(
        this.httpService.get(`${paymentUrl}/api/payments/order/${order.id}`),
      );

      const completedPayment = payments.data?.find(
        (p: any) => p.status === 'completed',
      );

      if (completedPayment) {
        await firstValueFrom(
          this.httpService.post(
            `${paymentUrl}/api/payments/${completedPayment.id}/refund`,
            { reason: 'Commande annulée' },
          ),
        );
      }
    } catch (error) {
      // Log l'erreur mais continue (best-effort)
      console.error('Failed to refund payment:', error);
    }
  }

  async findAll(): Promise<Order[]> {
    return this.ordersRepo.find({ order: { created_at: 'DESC' } });
  }

  /**
   * Récupère les commandes contenant des produits d'une boutique donnée
   */
  async findByShop(shopId: number): Promise<Order[]> {
    const orders = await this.ordersRepo
      .createQueryBuilder('order')
      .innerJoinAndSelect('order.items', 'item')
      .where('item.shop_id = :shopId', { shopId })
      .orderBy('order.created_at', 'DESC')
      .getMany();

    return orders;
  }

  /**
   * Récupère les shop IDs d'un artiste via artist-service
   */
  private async getArtistShopIds(userId: number): Promise<number[]> {
    try {
      const { data: shops } = await firstValueFrom(
        this.httpService.get(`${this.artistUrl}/api/shops/user/${userId}`),
      );
      return (shops || []).map((s: any) => s.id);
    } catch {
      return [];
    }
  }

  /**
   * Récupère toutes les commandes pour les boutiques d'un artiste
   */
  async findByArtist(userId: number): Promise<Order[]> {
    const shopIds = await this.getArtistShopIds(userId);
    if (shopIds.length === 0) return [];

    const orders = await this.ordersRepo
      .createQueryBuilder('order')
      .innerJoinAndSelect('order.items', 'item')
      .where('item.shop_id IN (:...shopIds)', { shopIds })
      .orderBy('order.created_at', 'DESC')
      .getMany();

    return orders;
  }

  /**
   * Vérifie si un artiste (via user_id) est propriétaire d'une des boutiques de la commande
   */
  private async isArtistOwnerOfOrder(userId: number, order: Order): Promise<boolean> {
    const shopIds = await this.getArtistShopIds(userId);
    if (shopIds.length === 0) return false;
    return order.items.some((item) => item.shop_id != null && shopIds.includes(item.shop_id));
  }
}
