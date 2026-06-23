import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import {
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
} from './entities/wallet-transaction.entity.js';
import { StripeService } from './stripe.service.js';

interface ArtistProfileSnapshot {
  id: number;
  stripe_account_id?: string | null;
  stripe_onboarded?: boolean;
  wallet_balance?: number;
  pending_balance?: number;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private artistUrl: string;
  private internalServiceToken: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
    @InjectRepository(WalletTransaction)
    private readonly walletTxRepo: Repository<WalletTransaction>,
  ) {
    this.artistUrl = this.configService.get<string>('ARTIST_URL', 'http://artist-service:3002');
    this.internalServiceToken = this.configService.get<string>('INTERNAL_SERVICE_TOKEN', '');
  }

  private async getArtistProfileByAuth(authHeader: string | undefined) {
    if (!authHeader) {
      throw new ForbiddenException('Jeton manquant');
    }

    const { data } = await firstValueFrom(
      this.httpService.get<ArtistProfileSnapshot>(`${this.artistUrl}/api/artists/profile/me`, {
        headers: { Authorization: authHeader },
      }),
    );

    if (!data?.id) {
      throw new BadRequestException('Profil artiste introuvable');
    }

    return data;
  }

  async creditPending(artistId: number, amountCents: number, orderId: number) {
    const existing = await this.walletTxRepo.findOne({
      where: {
        artist_id: artistId,
        order_id: orderId,
        type: WalletTransactionType.CREDIT,
      },
    });

    if (existing) {
      return existing;
    }

    await firstValueFrom(
      this.httpService.patch(
        `${this.artistUrl}/api/artists/internal/${artistId}/wallet/add-pending`,
        { amount_cents: amountCents, description: `Commande #${orderId} confirmée` },
        { headers: { 'x-service-token': this.internalServiceToken } },
      ),
    );

    return this.walletTxRepo.save(
      this.walletTxRepo.create({
        artist_id: artistId,
        order_id: orderId,
        amount_cents: amountCents,
        type: WalletTransactionType.CREDIT,
        status: WalletTransactionStatus.PENDING,
        description: `Commande #${orderId} confirmée`,
      }),
    );
  }

  async credit(artistId: number, amountCents: number, orderId: number) {
    const existing = await this.walletTxRepo.findOne({
      where: {
        artist_id: artistId,
        order_id: orderId,
        type: WalletTransactionType.CREDIT,
      },
    });

    if (existing?.status === WalletTransactionStatus.AVAILABLE) {
      return existing;
    }

    await firstValueFrom(
      this.httpService.patch(
        `${this.artistUrl}/api/artists/internal/${artistId}/wallet/credit`,
        { amount_cents: amountCents, description: `Commande #${orderId} validée` },
        { headers: { 'x-service-token': this.internalServiceToken } },
      ),
    );

    // Best-effort: subtract from pending_balance (amount moves from pending → available)
    try {
      await firstValueFrom(
        this.httpService.patch(
          `${this.artistUrl}/api/artists/internal/${artistId}/wallet/subtract-pending`,
          { amount_cents: amountCents },
          { headers: { 'x-service-token': this.internalServiceToken } },
        ),
      );
    } catch {
      // best-effort, pending_balance may not have been set if order skipped CONFIRMED
    }

    if (existing) {
      // Upgrade PENDING → AVAILABLE
      existing.status = WalletTransactionStatus.AVAILABLE;
      existing.description = `Commande #${orderId} validée`;
      return this.walletTxRepo.save(existing);
    }

    return this.walletTxRepo.save(
      this.walletTxRepo.create({
        artist_id: artistId,
        order_id: orderId,
        amount_cents: amountCents,
        type: WalletTransactionType.CREDIT,
        status: WalletTransactionStatus.AVAILABLE,
        description: `Commande #${orderId} validée`,
      }),
    );
  }

  async cancelPending(artistId: number, amountCents: number, orderId: number) {
    const existing = await this.walletTxRepo.findOne({
      where: {
        artist_id: artistId,
        order_id: orderId,
        type: WalletTransactionType.CREDIT,
        status: WalletTransactionStatus.PENDING,
      },
    });

    if (!existing) return { skipped: true };

    await firstValueFrom(
      this.httpService.patch(
        `${this.artistUrl}/api/artists/internal/${artistId}/wallet/subtract-pending`,
        { amount_cents: amountCents },
        { headers: { 'x-service-token': this.internalServiceToken } },
      ),
    );

    await this.walletTxRepo.remove(existing);
    return { cancelled: true, orderId };
  }

  async getMyWallet(authHeader: string | undefined) {
    const artist = await this.getArtistProfileByAuth(authHeader);

    // Fetch Stripe balance for the connected account (source of truth for funds)
    let stripeAvailable = 0;
    let stripePending = 0;
    if (artist.stripe_account_id && artist.stripe_onboarded) {
      try {
        const stripeBalance = await this.stripeService.retrieveConnectedBalance(
          artist.stripe_account_id,
        );
        stripeAvailable = stripeBalance.available;
        stripePending = stripeBalance.pending;
      } catch (error) {
        this.logger.warn(`Could not fetch Stripe balance for artist ${artist.id}: ${error}`);
      }
    }

    return {
      artistId: artist.id,
      stripeAccountId: artist.stripe_account_id ?? null,
      stripeOnboarded: Boolean(artist.stripe_onboarded),
      walletBalance: Number(artist.wallet_balance ?? 0),
      pendingBalance: Number(artist.pending_balance ?? 0),
      stripeAvailable,
      stripePending,
    };
  }

  async listMyTransactions(authHeader: string | undefined) {
    const artist = await this.getArtistProfileByAuth(authHeader);
    return this.walletTxRepo.find({
      where: { artist_id: artist.id },
      order: { created_at: 'DESC' },
      take: 100,
    });
  }

  async listTransactionsByArtist(artistId: number) {
    if (!Number.isFinite(artistId) || artistId <= 0) {
      throw new BadRequestException('artist_id invalide');
    }

    return this.walletTxRepo.find({
      where: { artist_id: artistId },
      order: { created_at: 'DESC' },
      take: 200,
    });
  }

  async listAllTransactions() {
    return this.walletTxRepo.find({
      order: { created_at: 'DESC' },
      take: 500,
    });
  }

  async requestPayout(userId: number, authHeader: string | undefined, amountCents: number) {
    const artist = await this.getArtistProfileByAuth(authHeader);
    if (!artist.stripe_onboarded || !artist.stripe_account_id) {
      throw new BadRequestException('Compte Stripe non configuré');
    }

    if (amountCents < 100) {
      throw new BadRequestException('Minimum de retrait : 1€');
    }

    // Check the actual Stripe balance (source of truth)
    let stripeAvailable = 0;
    try {
      const stripeBalance = await this.stripeService.retrieveConnectedBalance(
        artist.stripe_account_id,
      );
      stripeAvailable = stripeBalance.available;
    } catch (error) {
      this.logger.error(`Cannot retrieve Stripe balance for payout: ${error}`);
      throw new BadRequestException('Impossible de vérifier le solde Stripe');
    }

    if (amountCents > stripeAvailable) {
      throw new BadRequestException(
        `Solde Stripe insuffisant (${(stripeAvailable / 100).toFixed(2)}€ disponible)`,
      );
    }

    // Create a payout from the connected account's Stripe balance to their bank
    const payout = await this.stripeService.createPayout({
      amount: amountCents,
      currency: 'eur',
      stripeAccountId: artist.stripe_account_id,
      description: `Retrait artiste ${artist.id}`,
    });

    // Debit the local wallet balance to keep it in sync
    await firstValueFrom(
      this.httpService.patch(
        `${this.artistUrl}/api/artists/internal/${artist.id}/wallet/debit`,
        { amount_cents: amountCents, description: 'Retrait vers compte bancaire' },
        { headers: { 'x-service-token': this.internalServiceToken } },
      ),
    );

    const tx = await this.walletTxRepo.save(
      this.walletTxRepo.create({
        artist_id: artist.id,
        amount_cents: amountCents,
        type: WalletTransactionType.DEBIT,
        status: WalletTransactionStatus.PAID,
        description: 'Retrait vers compte bancaire',
        stripe_transfer_id: payout.id,
      }),
    );

    return { success: true, payoutId: payout.id, transactionId: tx.id, userId };
  }

  async markArtistStripeReady(stripeAccountId: string) {
    await firstValueFrom(
      this.httpService.patch(
        `${this.artistUrl}/api/artists/internal/stripe/mark-ready`,
        { stripe_account_id: stripeAccountId },
        { headers: { 'x-service-token': this.internalServiceToken } },
      ),
    );
    this.logger.log(`Artist Stripe account ${stripeAccountId} marked ready`);
  }

  async markArtistStripeNotReady(stripeAccountId: string) {
    await firstValueFrom(
      this.httpService.patch(
        `${this.artistUrl}/api/artists/internal/stripe/mark-not-ready`,
        { stripe_account_id: stripeAccountId },
        { headers: { 'x-service-token': this.internalServiceToken } },
      ),
    );
    this.logger.log(`Artist Stripe account ${stripeAccountId} marked not ready`);
  }

  async handleTransferFailed(transfer: { id: string }) {
    if (!transfer?.id) {
      throw new BadRequestException('Transfer Stripe invalide');
    }

    const tx = await this.walletTxRepo.findOne({
      where: {
        stripe_transfer_id: transfer.id,
        type: WalletTransactionType.DEBIT,
      },
    });

    if (!tx) {
      this.logger.warn(`Aucune transaction locale trouvée pour transfer.failed ${transfer.id}`);
      return { recovered: false, reason: 'not_found' };
    }

    // Idempotence webhook: rollback déjà traité.
    if (tx.status !== WalletTransactionStatus.PAID) {
      return { recovered: false, reason: 'already_handled', transactionId: tx.id };
    }

    await firstValueFrom(
      this.httpService.patch(
        `${this.artistUrl}/api/artists/internal/${tx.artist_id}/wallet/credit`,
        {
          amount_cents: tx.amount_cents,
          description: `Rollback retrait échoué (${transfer.id})`,
        },
        { headers: { 'x-service-token': this.internalServiceToken } },
      ),
    );

    tx.status = WalletTransactionStatus.PENDING;
    tx.description = `${tx.description} (échec Stripe: ${transfer.id})`;
    await this.walletTxRepo.save(tx);

    return { recovered: true, transactionId: tx.id };
  }

  /**
   * Handle a failed Stripe Payout (po_...).
   * Restores the artist's wallet balance when a payout to their bank fails.
   */
  async handlePayoutFailed(payout: { id: string }) {
    if (!payout?.id) {
      throw new BadRequestException('Payout Stripe invalide');
    }

    const tx = await this.walletTxRepo.findOne({
      where: {
        stripe_transfer_id: payout.id,
        type: WalletTransactionType.DEBIT,
      },
    });

    if (!tx) {
      this.logger.warn(`Aucune transaction locale trouvée pour payout.failed ${payout.id}`);
      return { recovered: false, reason: 'not_found' };
    }

    if (tx.status !== WalletTransactionStatus.PAID) {
      return { recovered: false, reason: 'already_handled', transactionId: tx.id };
    }

    // Restore the artist's wallet balance
    await firstValueFrom(
      this.httpService.patch(
        `${this.artistUrl}/api/artists/internal/${tx.artist_id}/wallet/credit`,
        {
          amount_cents: tx.amount_cents,
          description: `Rollback retrait échoué (${payout.id})`,
        },
        { headers: { 'x-service-token': this.internalServiceToken } },
      ),
    );

    tx.status = WalletTransactionStatus.PENDING;
    tx.description = `${tx.description} (échec payout: ${payout.id})`;
    await this.walletTxRepo.save(tx);

    return { recovered: true, transactionId: tx.id };
  }
}
