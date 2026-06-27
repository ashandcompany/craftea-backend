import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
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
import { OrderEventsPublisher } from '../rabbitmq/order-events.publisher.js';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private catalogUrl: string;
  private catalogPublicUrl: string;
  private artistUrl: string;
  private paymentUrl: string;
  private userUrl: string;
  private internalServiceToken: string;
  private appUrl: string;

  constructor(
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem) private itemsRepo: Repository<OrderItem>,
    private httpService: HttpService,
    private configService: ConfigService,
    private orderEventsPublisher: OrderEventsPublisher,
  ) {
    this.catalogUrl = this.configService.get<string>(
      'CATALOG_URL',
      'http://catalog-service:3003',
    );
    this.artistUrl = this.configService.get<string>(
      'ARTIST_URL',
      'http://artist-service:3002',
    );
    this.paymentUrl = this.configService.get<string>(
      'PAYMENT_URL',
      'http://payment-service:3007',
    );
    this.userUrl = this.configService.get<string>(
      'USER_SERVICE_URL',
      'http://user-service:3010',
    );
    this.internalServiceToken = this.configService.get<string>(
      'INTERNAL_SERVICE_TOKEN',
      '',
    );
    this.appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    this.catalogPublicUrl = this.configService.get<string>(
      'CATALOG_PUBLIC_URL',
      'http://localhost:3003',
    );
  }

  async create(dto: CreateOrderDto, userId: number): Promise<Order> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'La commande doit contenir au moins un article',
      );
    }

    const shippingZone = dto.shipping_zone || 'france';

    // Récupérer les métadonnées produit (shop_id, frais de port) sans toucher au stock
    const productShopMap = new Map<number, number>();
    const productShippingFeeMap = new Map<number, number | null>();
    try {
      for (const item of dto.items) {
        const { data: product } = await firstValueFrom(
          this.httpService.get(
            `${this.catalogUrl}/api/products/${item.product_id}`,
          ),
        );
        if (product?.shop_id) {
          productShopMap.set(item.product_id, product.shop_id);
        }
        productShippingFeeMap.set(
          item.product_id,
          product?.shipping_fee != null ? Number(product.shipping_fee) : null,
        );
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        'Erreur lors de la récupération du produit';
      throw new BadRequestException(msg);
    }

    // ── Calculer les frais de port par boutique ────────────────────────
    const shopIds = [...new Set(productShopMap.values())];
    let shopShippingProfiles: Record<number, any[]> = {};

    if (shopIds.length > 0) {
      try {
        const { data } = await firstValueFrom(
          this.httpService.get(
            `${this.artistUrl}/api/shops/shipping/bulk?ids=${shopIds.join(',')}`,
          ),
        );
        shopShippingProfiles = data || {};
      } catch {
        // Si on ne peut pas récupérer les profils, on continue avec 0€ de frais
      }
    }

    const shippingTotal = this.computeShipping(
      dto.items,
      productShopMap,
      productShippingFeeMap,
      shopShippingProfiles,
      shippingZone,
    );

    const itemsTotal = dto.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const total = itemsTotal + shippingTotal;

    const order = this.ordersRepo.create({
      user_id: userId,
      status: OrderStatus.PENDING,
      total: parseFloat(total.toFixed(2)),
      shipping_total: parseFloat(shippingTotal.toFixed(2)),
      shipping_zone: shippingZone,
      items: dto.items.map((item) =>
        this.itemsRepo.create({
          product_id: item.product_id,
          shop_id: productShopMap.get(item.product_id) ?? undefined,
          quantity: item.quantity,
          price: item.price,
        }),
      ),
    });

    return await this.ordersRepo.save(order);
  }

  async findByUser(userId: number): Promise<Order[]> {
    return this.ordersRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(
    id: number,
    currentUser: { id: number; role: string },
  ): Promise<Order> {
    const order = await this.ordersRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Commande introuvable');

    if (currentUser.role !== 'admin' && order.user_id !== currentUser.id) {
      throw new ForbiddenException('Accès interdit');
    }

    return order;
  }

  /** Internal service-to-service call — no user ownership check */
  async findOneInternal(id: number): Promise<Order | null> {
    return this.ordersRepo.findOne({ where: { id } });
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
    const isInternal = (currentUser as any).role === 'internal';
    const isOwner = order.user_id === currentUser.id;
    const isAdmin = currentUser.role === 'admin';
    const isArtist = currentUser.role === 'artist';
    let isShopOwner = false;

    if (isArtist && !isOwner) {
      isShopOwner = await this.isArtistOwnerOfOrder(currentUser.id, order);
    }

    if (!isInternal && !isAdmin && !isOwner && !isShopOwner) {
      throw new ForbiddenException('Accès interdit');
    }

    // Les artistes (propriétaires de la boutique) et admins peuvent gérer les statuts
    const artistOrAdminStatuses: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    if (
      artistOrAdminStatuses.includes(dto.status) &&
      !isInternal &&
      !isAdmin &&
      !isShopOwner
    ) {
      throw new ForbiddenException(
        "Seul l'artiste ou un admin peut définir ce statut",
      );
    }

    // Le client ne peut qu'annuler
    if (
      isOwner &&
      !isInternal &&
      !isAdmin &&
      !isShopOwner &&
      dto.status !== OrderStatus.CANCELLED
    ) {
      throw new ForbiddenException("Vous ne pouvez qu'annuler votre commande");
    }

    // Si annulation : restaurer le stock et refund le paiement
    if (
      dto.status === OrderStatus.CANCELLED &&
      order.status !== OrderStatus.CANCELLED
    ) {
      await this.handleOrderCancellation(order);
    }

    const wasConfirmed = order.status === OrderStatus.CONFIRMED;
    const wasDelivered = order.status === OrderStatus.DELIVERED;
    const preStatus = order.status;
    order.status = dto.status;
    const saved = await this.ordersRepo.save(order);

    if (!wasDelivered && dto.status === OrderStatus.DELIVERED) {
      await this.emitOrderCompleted(saved);
    }

    if (!wasConfirmed && dto.status === OrderStatus.CONFIRMED) {
      await this.decrementStockForOrder(order);
      await this.emitOrderConfirmed(saved);
    }

    // Annulation d'une commande déjà confirmée : on retire le montant en attente du wallet
    const postConfirmStatuses: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.SHIPPED,
    ];
    if (
      dto.status === OrderStatus.CANCELLED &&
      postConfirmStatuses.includes(preStatus)
    ) {
      await this.emitOrderCancelled(saved);
    }

    return saved;
  }

  private async emitOrderCompleted(order: Order): Promise<void> {
    const splits = await this.buildArtistGrossSplits(order);
    if (splits.length === 0) return;

    const amountCents = Math.round(Number(order.total ?? 0) * 100);
    if (amountCents <= 0) return;

    const fallbackArtistId = splits[0]?.artistId;

    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.paymentUrl}/api/payments/events/order-completed`,
          {
            orderId: order.id,
            artistId: fallbackArtistId,
            amount: amountCents,
            splits,
          },
          {
            headers: {
              'x-service-token': this.internalServiceToken,
            },
          },
        ),
      );
    } catch (error) {
      console.error(
        `Failed to emit order.completed for order ${order.id}:`,
        error,
      );
    }
  }

  private async emitOrderConfirmed(order: Order): Promise<void> {
    const splits = await this.buildArtistGrossSplits(order);
    if (splits.length === 0) return;

    const amountCents = Math.round(Number(order.total ?? 0) * 100);
    if (amountCents <= 0) return;

    const fallbackArtistId = splits[0]?.artistId;

    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.paymentUrl}/api/payments/events/order-confirmed`,
          {
            orderId: order.id,
            artistId: fallbackArtistId,
            amount: amountCents,
            splits,
          },
          {
            headers: {
              'x-service-token': this.internalServiceToken,
            },
          },
        ),
      );
    } catch (error) {
      console.error(
        `Failed to emit order.confirmed for order ${order.id}:`,
        error,
      );
    }

    // Publish notification event (best-effort)
    void this.publishOrderConfirmedNotification(order);
  }

  private async publishOrderConfirmedNotification(order: Order): Promise<void> {
    try {
      const { data: user } = await firstValueFrom(
        this.httpService.get(
          `${this.userUrl}/api/users/internal/${order.user_id}`,
          {
            headers: { 'x-service-token': this.internalServiceToken },
          },
        ),
      );

      // Enrich items with product details (names, images)
      const enrichedItems = await Promise.all(
        (order.items ?? []).map(async (item) => {
          try {
            const { data: product } = await firstValueFrom(
              this.httpService.get(
                `${this.catalogUrl}/api/products/${item.product_id}`,
              ),
            );
            const firstImage =
              Array.isArray(product.images) && product.images.length > 0
                ? `${this.catalogPublicUrl}/api/images/${product.images[0].image_url}`
                : null;
            return {
              name: product.title || `Produit #${item.product_id}`,
              image_url: firstImage,
              qty: item.quantity,
              unitPrice: Math.round(Number(item.price) * 100),
            };
          } catch {
            this.logger.warn(
              `Could not fetch product ${item.product_id}: using fallback name`,
            );
            return {
              name: `Produit #${item.product_id}`,
              image_url: null,
              qty: item.quantity,
              unitPrice: Math.round(Number(item.price) * 100),
            };
          }
        }),
      );

      const orderUrl = `${this.appUrl}/account/orders/${order.id}`;
      const totalCents = Math.round(Number(order.total ?? 0) * 100);
      const shippingTotalCents = Math.round(
        Number(order.shipping_total ?? 0) * 100,
      );
      const commission = await this.computeCommissionCents(order);

      await this.orderEventsPublisher.publish('order.confirmed', {
        buyerEmail: user.email as string,
        orderNumber: String(order.id),
        items: enrichedItems,
        shippingTotal: shippingTotalCents,
        total: totalCents,
        commissionAmount: commission,
        orderUrl,
      });
    } catch (err) {
      console.error(
        `Failed to publish order.confirmed notification for order ${order.id}:`,
        err,
      );
    }
  }

  private async computeCommissionCents(order: Order): Promise<number> {
    try {
      const { data: payments } = await firstValueFrom(
        this.httpService.get(
          `${this.paymentUrl}/api/payments/order/${order.id}`,
          {
            headers: { 'x-service-token': this.internalServiceToken },
          },
        ),
      );
      const confirmed = (payments as any[]).find(
        (p: any) => p.commission_amount != null,
      );
      if (confirmed)
        return Math.round(Number(confirmed.commission_amount) * 100);
    } catch {
      // best-effort
    }
    return 0;
  }

  private async emitOrderCancelled(order: Order): Promise<void> {
    const splits = await this.buildArtistGrossSplits(order);
    if (splits.length === 0) return;

    const amountCents = Math.round(Number(order.total ?? 0) * 100);
    if (amountCents <= 0) return;

    const fallbackArtistId = splits[0]?.artistId;

    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.paymentUrl}/api/payments/events/order-cancelled`,
          {
            orderId: order.id,
            artistId: fallbackArtistId,
            amount: amountCents,
            splits,
          },
          {
            headers: {
              'x-service-token': this.internalServiceToken,
            },
          },
        ),
      );
    } catch (error) {
      console.error(
        `Failed to emit order.cancelled for order ${order.id}:`,
        error,
      );
    }
  }

  private async buildArtistGrossSplits(
    order: Order,
  ): Promise<Array<{ artistId: number; grossAmount: number }>> {
    const shopIds = [
      ...new Set(
        (order.items || [])
          .map((item) => item.shop_id)
          .filter((id): id is number => id != null),
      ),
    ];

    if (shopIds.length === 0) return [];

    const shopArtistMap = new Map<number, number>();
    for (const shopId of shopIds) {
      try {
        const { data: shop } = await firstValueFrom(
          this.httpService.get(`${this.artistUrl}/api/shops/${shopId}`),
        );
        if (shop?.artist_id) {
          shopArtistMap.set(shopId, Number(shop.artist_id));
        }
      } catch {
        // ignore failed shop lookup
      }
    }

    const artistGrossMap = new Map<number, number>();
    for (const item of order.items || []) {
      if (!item.shop_id) continue;
      const artistId = shopArtistMap.get(item.shop_id);
      if (!artistId) continue;

      const lineAmountCents =
        Math.round(Number(item.price) * 100) * item.quantity;
      artistGrossMap.set(
        artistId,
        (artistGrossMap.get(artistId) ?? 0) + lineAmountCents,
      );
    }

    return [...artistGrossMap.entries()]
      .map(([artistId, grossAmount]) => ({ artistId, grossAmount }))
      .filter((s) => s.grossAmount > 0);
  }

  private async decrementStockForOrder(order: Order): Promise<void> {
    for (const item of order.items || []) {
      try {
        await firstValueFrom(
          this.httpService.patch(
            `${this.catalogUrl}/api/products/${item.product_id}/decrement-stock`,
            { quantity: item.quantity },
          ),
        );
      } catch (error) {
        this.logger.error(
          `Failed to decrement stock for product ${item.product_id} on order ${order.id}: ${error}`,
        );
      }
    }
  }

  private async handleOrderCancellation(order: Order): Promise<void> {
    // 1. Restaurer le stock uniquement si la commande avait été confirmée
    // (le stock n'est décrémenté qu'à la confirmation, pas à la création)
    const stockWasDecremented = [
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ].includes(order.status);

    if (stockWasDecremented) {
      for (const item of order.items || []) {
        try {
          await firstValueFrom(
            this.httpService.patch(
              `${this.catalogUrl}/api/products/${item.product_id}/decrement-stock`,
              { quantity: -item.quantity },
            ),
          );
        } catch (error) {
          console.error(
            `Failed to refund stock for product ${item.product_id}:`,
            error,
          );
        }
      }
    }

    // 2. Refund le paiement associé à cette commande
    try {
      const payments = await firstValueFrom(
        this.httpService.get(
          `${this.paymentUrl}/api/payments/order/${order.id}`,
          {
            headers: { 'x-service-token': this.internalServiceToken },
          },
        ),
      );

      const completedPayment = payments.data?.find(
        (p: any) => p.status === 'completed',
      );

      if (completedPayment) {
        await firstValueFrom(
          this.httpService.post(
            `${this.paymentUrl}/api/payments/${completedPayment.id}/refund`,
            { reason: 'Commande annulée' },
            { headers: { 'x-service-token': this.internalServiceToken } },
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
  private async isArtistOwnerOfOrder(
    userId: number,
    order: Order,
  ): Promise<boolean> {
    const shopIds = await this.getArtistShopIds(userId);
    if (shopIds.length === 0) return false;
    return order.items.some(
      (item) => item.shop_id != null && shopIds.includes(item.shop_id),
    );
  }

  /**
   * Calcule les frais de port en tenant compte : shop profiles + product overrides.
   *
   * Logique par boutique :
   * 1. Grouper les articles par shop_id
   * 2. Pour chaque boutique, chercher le profil d'expédition de la zone
   * 3. Pour chaque article :
   *    - S'il a un shipping_fee propre → l'utiliser (× quantité)
   *    - Sinon → base_fee pour le 1er + additional_item_fee pour les suivants
   * 4. Si le sous-total de la boutique ≥ free_shipping_threshold → frais = 0
   */
  private computeShipping(
    items: { product_id: number; quantity: number; price: number }[],
    productShopMap: Map<number, number>,
    productShippingFeeMap: Map<number, number | null>,
    shopShippingProfiles: Record<number, any[]>,
    zone: string,
  ): number {
    // Grouper par shop_id
    const shopGroups = new Map<number, typeof items>();
    for (const item of items) {
      const shopId = productShopMap.get(item.product_id) ?? 0;
      if (!shopGroups.has(shopId)) shopGroups.set(shopId, []);
      shopGroups.get(shopId)!.push(item);
    }

    let totalShipping = 0;

    for (const [shopId, shopItems] of shopGroups) {
      // Sous-total de la boutique (pour le seuil de gratuité)
      const shopSubtotal = shopItems.reduce(
        (sum, i) => sum + i.price * i.quantity,
        0,
      );

      // Chercher le profil pour la zone
      const profiles = shopShippingProfiles[shopId] || [];
      const profile = profiles.find((p: any) => p.zone === zone);
      const baseFee = profile ? Number(profile.base_fee) : 0;
      const additionalFee = profile ? Number(profile.additional_item_fee) : 0;
      const freeThreshold =
        profile?.free_shipping_threshold != null
          ? Number(profile.free_shipping_threshold)
          : null;

      // Si seuil de gratuité atteint → frais = 0 pour cette boutique
      if (freeThreshold !== null && shopSubtotal >= freeThreshold) {
        continue;
      }

      let shopShipping = 0;
      let isFirstItem = true;

      for (const item of shopItems) {
        const productOverride = productShippingFeeMap.get(item.product_id);

        if (productOverride !== null && productOverride !== undefined) {
          // Override produit : frais × quantité
          shopShipping += productOverride * item.quantity;
        } else {
          // Profil boutique : base_fee pour le 1er article, additional pour les suivants
          for (let q = 0; q < item.quantity; q++) {
            if (isFirstItem) {
              shopShipping += baseFee;
              isFirstItem = false;
            } else {
              shopShipping += additionalFee;
            }
          }
        }
      }

      totalShipping += shopShipping;
    }

    return totalShipping;
  }
}
