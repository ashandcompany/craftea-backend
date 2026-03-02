import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './entities/cart.entity.js';
import { CartItem } from './entities/cart-item.entity.js';
import { AddItemDto } from './dto/add-item.dto.js';
import { UpdateItemDto } from './dto/update-item.dto.js';

@Injectable()
export class CartsService {
  constructor(
    @InjectRepository(Cart) private cartsRepo: Repository<Cart>,
    @InjectRepository(CartItem) private itemsRepo: Repository<CartItem>,
  ) {}

  /**
   * Récupère (ou crée) le panier actif de l'utilisateur.
   */
  async getOrCreateCart(userId: number): Promise<Cart> {
    let cart = await this.cartsRepo.findOne({ where: { user_id: userId } });
    if (!cart) {
      cart = this.cartsRepo.create({ user_id: userId, items: [] });
      cart = await this.cartsRepo.save(cart);
    }
    return cart;
  }

  /**
   * Retourne le panier de l'utilisateur connecté.
   */
  async findByUser(userId: number): Promise<Cart> {
    return this.getOrCreateCart(userId);
  }

  /**
   * Ajoute un produit au panier (ou incrémente la quantité si déjà présent).
   */
  async addItem(userId: number, dto: AddItemDto): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId);

    const existing = cart.items.find((i) => i.product_id === dto.product_id);
    if (existing) {
      existing.quantity += dto.quantity;
      await this.itemsRepo.save(existing);
    } else {
      const item = this.itemsRepo.create({
        cart_id: cart.id,
        product_id: dto.product_id,
        quantity: dto.quantity,
      });
      await this.itemsRepo.save(item);
    }

    return this.getOrCreateCart(userId);
  }

  /**
   * Met à jour la quantité d'un item du panier.
   */
  async updateItem(userId: number, itemId: number, dto: UpdateItemDto): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Article introuvable dans le panier');

    item.quantity = dto.quantity;
    await this.itemsRepo.save(item);

    return this.getOrCreateCart(userId);
  }

  /**
   * Supprime un item du panier.
   */
  async removeItem(userId: number, itemId: number): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Article introuvable dans le panier');

    await this.itemsRepo.remove(item);

    return this.getOrCreateCart(userId);
  }

  /**
   * Vide entièrement le panier.
   */
  async clear(userId: number): Promise<Cart> {
    const cart = await this.getOrCreateCart(userId);

    if (cart.items.length > 0) {
      await this.itemsRepo.remove(cart.items);
    }

    return this.getOrCreateCart(userId);
  }
}
