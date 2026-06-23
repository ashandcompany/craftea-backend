import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import Stripe from 'stripe';
import { existsSync, readFileSync } from 'node:fs';
import { ArtistProfile } from './entities/artist-profile.entity.js';
import { ArtistVerificationDocument } from './entities/artist-verification-document.entity.js';
import { MinioService } from '../minio/minio.service.js';
import { CreateArtistDto } from './dto/create-artist.dto.js';
import { UpdateArtistDto } from './dto/update-artist.dto.js';
import { ReviewVerificationDto } from './dto/review-verification.dto.js';
import { ArtistEventsPublisher } from '../rabbitmq/artist-events.publisher.js';

export interface UserIdentity {
  id: number;
  firstname: string;
  lastname: string;
}

interface UserWithEmail extends UserIdentity {
  email: string;
}

@Injectable()
export class ArtistsService {
  private userServiceUrl: string;
  private frontendUrl: string;
  private stripe: Stripe;
  private readonly stripeSecretConfigured: boolean;

  constructor(
    @InjectRepository(ArtistProfile) private artistsRepo: Repository<ArtistProfile>,
    @InjectRepository(ArtistVerificationDocument)
    private verificationDocsRepo: Repository<ArtistVerificationDocument>,
    private minioService: MinioService,
    private configService: ConfigService,
    private eventsPublisher: ArtistEventsPublisher,
  ) {
    this.userServiceUrl =
      this.configService.get('USER_SERVICE_URL') || 'http://user-service:3001';
    this.frontendUrl =
      this.configService.get('FRONTEND_URL') || 'http://localhost:3000';

    let secretKey = this.configService.get<string>('STRIPE_SECRET_KEY', '').trim();
    if (!secretKey) {
      const secretKeyFile = this.configService.get<string>(
        'STRIPE_SECRET_KEY_FILE',
        '/run/secrets/stripe_secret_key_v2',
      );
      if (secretKeyFile && existsSync(secretKeyFile)) {
        secretKey = readFileSync(secretKeyFile, 'utf8').trim();
      }
    }

    this.stripeSecretConfigured = Boolean(secretKey);
    this.stripe = new Stripe(secretKey || 'sk_test_placeholder');
  }

  private assertStripeConfigured() {
    if (this.stripeSecretConfigured) return;
    throw new ServiceUnavailableException(
      'Configuration Stripe manquante. Vérifiez STRIPE_SECRET_KEY ou STRIPE_SECRET_KEY_FILE.',
    );
  }

  private mapStripeError(error: unknown): never {
    if (error instanceof Stripe.errors.StripeError) {
      const message = error.message || 'Erreur Stripe';
      const lowered = message.toLowerCase();

      if (lowered.includes('signed up for connect')) {
        throw new BadRequestException(
          "Stripe Connect n'est pas activé sur ce compte Stripe. Activez Connect dans le dashboard Stripe: https://dashboard.stripe.com/connect.",
        );
      }

      if (
        lowered.includes('review and acknowledge your responsibilities') ||
        lowered.includes('you\'ll be responsible for refunds') ||
        lowered.includes('chargebacks')
      ) {
        throw new BadRequestException(
          "Votre plateforme Stripe doit d'abord valider les responsabilités Connect (refunds, chargebacks, conformité, support vendeur) dans le dashboard Stripe avant de créer des comptes connectés.",
        );
      }

      throw new BadRequestException(`Stripe: ${message}`);
    }

    throw error;
  }

  private async buildStripeOnboardingLink(stripeAccountId: string): Promise<string> {
    const accountLink = await this.stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${this.frontendUrl}/artist/stripe/refresh`,
      return_url: `${this.frontendUrl}/artist/stripe/success`,
      type: 'account_onboarding',
    });

    return accountLink.url;
  }

  private async fetchUser(userId: number): Promise<UserIdentity | null> {
    if (!userId) return null;
    try {
      const res = await fetch(`${this.userServiceUrl}/api/users/public/${userId}`);
      if (!res.ok) return null;
      const user = (await res.json()) as any;
      if (!user?.id) return null;
      return { id: user.id, firstname: user.firstname, lastname: user.lastname };
    } catch {
      return null;
    }
  }

  private async fetchUserWithEmail(userId: number): Promise<UserWithEmail | null> {
    if (!userId) return null;
    try {
      const token = this.configService.get<string>('INTERNAL_SERVICE_TOKEN', '');
      const res = await fetch(`${this.userServiceUrl}/api/users/internal/${userId}`, {
        headers: { 'x-service-token': token },
      });
      if (!res.ok) return null;
      const user = (await res.json()) as any;
      if (!user?.id || !user?.email) return null;
      return { id: user.id, email: user.email, firstname: user.firstname, lastname: user.lastname };
    } catch {
      return null;
    }
  }

  async create(
    dto: CreateArtistDto,
    userId: number,
    files: { banner?: Express.Multer.File[]; logo?: Express.Multer.File[] },
  ) {
    const exists = await this.artistsRepo.findOne({ where: { user_id: userId } });
    if (exists) throw new ConflictException('Profil artiste déjà existant');

    const banner_url = files.banner?.[0]
      ? await this.minioService.uploadFile(files.banner[0])
      : null;
    const logo_url = files.logo?.[0]
      ? await this.minioService.uploadFile(files.logo[0])
      : null;

    const profile = this.artistsRepo.create({
      user_id: userId,
      bio: dto.bio,
      banner_url: banner_url ?? undefined,
      logo_url: logo_url ?? undefined,
      social_links: dto.social_links,
    } as Partial<ArtistProfile>);
    return this.artistsRepo.save(profile);
  }

  async me(userId: number) {
    const profile = await this.artistsRepo.findOne({
      where: { user_id: userId },
      relations: ['shops'],
    });
    if (!profile) throw new NotFoundException('Profil artiste introuvable');
    const json = { ...profile, user: await this.fetchUser(profile.user_id) };
    return json;
  }

  async findById(id: number) {
    const profile = await this.artistsRepo.findOne({
      where: { id },
      relations: ['shops'],
    });
    if (!profile) throw new NotFoundException('Profil artiste introuvable');
    return { ...profile, user: await this.fetchUser(profile.user_id) };
  }

  async findAll() {
    const profiles = await this.artistsRepo.find({
      where: { validated: true },
      relations: ['shops'],
    });
    // Fetch all users in parallel instead of serially
    const users = await Promise.all(profiles.map((p) => this.fetchUser(p.user_id)));
    return profiles.map((p, i) => ({ ...p, user: users[i] }));
  }

  async update(
    userId: number,
    dto: UpdateArtistDto,
    files: { banner?: Express.Multer.File[]; logo?: Express.Multer.File[] },
  ) {
    const profile = await this.artistsRepo.findOne({ where: { user_id: userId } });
    if (!profile) throw new NotFoundException('Profil artiste introuvable');

    if (dto.bio !== undefined) profile.bio = dto.bio;
    if (dto.social_links !== undefined) profile.social_links = dto.social_links;

    if (files.banner?.[0]) {
      if (profile.banner_url) await this.minioService.deleteFile(profile.banner_url);
      profile.banner_url = await this.minioService.uploadFile(files.banner[0]);
    }
    if (files.logo?.[0]) {
      if (profile.logo_url) await this.minioService.deleteFile(profile.logo_url);
      profile.logo_url = await this.minioService.uploadFile(files.logo[0]);
    }

    return this.artistsRepo.save(profile);
  }

  async createStripeAccount(userId: number) {
    this.assertStripeConfigured();

    const profile = await this.artistsRepo.findOne({ where: { user_id: userId } });
    if (!profile) throw new NotFoundException('Profil artiste introuvable');

    try {
      if (!profile.stripe_account_id) {
        // Explicit platform-controlled responsibilities for connected accounts.
        // Manual payout schedule: funds stay in the artist's Stripe balance
        // until they explicitly request a payout (Vinted-style wallet).
        const account = await this.stripe.accounts.create({
          controller: {
            fees: { payer: 'application' },
            losses: { payments: 'application' },
            requirement_collection: 'application',
            stripe_dashboard: { type: 'none' },
          },
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          settings: {
            payouts: {
              schedule: { interval: 'manual' },
            },
          },
        });

        profile.stripe_account_id = account.id;
        profile.stripe_onboarded = false;
        await this.artistsRepo.save(profile);
      }

      if (!profile.stripe_account_id) {
        throw new NotFoundException('Compte Stripe artiste introuvable');
      }

      const url = await this.buildStripeOnboardingLink(profile.stripe_account_id);

      // Publish artist.kyc-invited event (best-effort)
      const user = await this.fetchUserWithEmail(profile.user_id);
      if (user) {
        void this.eventsPublisher.publish('artist.kyc-invited', {
          artistEmail: user.email,
          artistName: `${user.firstname} ${user.lastname}`,
          onboardingUrl: url,
        });
      }

      return { url, stripeAccountId: profile.stripe_account_id };
    } catch (error) {
      this.mapStripeError(error);
    }
  }

  async syncStripeOnboardingStatus(userId: number) {
    this.assertStripeConfigured();

    const profile = await this.artistsRepo.findOne({ where: { user_id: userId } });
    if (!profile) throw new NotFoundException('Profil artiste introuvable');

    if (!profile.stripe_account_id) {
      if (profile.stripe_onboarded) {
        profile.stripe_onboarded = false;
        await this.artistsRepo.save(profile);
      }

      return {
        stripeAccountId: null,
        stripeOnboarded: false,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      };
    }

    let account: Stripe.Account;
    try {
      account = await this.stripe.accounts.retrieve(profile.stripe_account_id);
    } catch (error) {
      this.mapStripeError(error);
    }
    const stripeOnboarded =
      Boolean(account.details_submitted) &&
      Boolean(account.charges_enabled) &&
      Boolean(account.payouts_enabled);

    if (profile.stripe_onboarded !== stripeOnboarded) {
      profile.stripe_onboarded = stripeOnboarded;
      await this.artistsRepo.save(profile);
    }

    return {
      stripeAccountId: profile.stripe_account_id,
      stripeOnboarded,
      detailsSubmitted: Boolean(account.details_submitted),
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
    };
  }

  async toggleValidation(id: number) {
    const profile = await this.artistsRepo.findOne({ where: { id } });
    if (!profile) throw new NotFoundException('Profil artiste introuvable');
    profile.validated = !profile.validated;
    // Keep validation_status in sync with the validated flag
    if (!profile.validated) {
      profile.validation_status = 'none';
      profile.validation_note = null;
      // Delete uploaded verification documents from MinIO and DB
      const oldDocs = await this.verificationDocsRepo.find({
        where: { artist_profile_id: profile.id },
      });
      for (const doc of oldDocs) {
        await this.minioService.deleteFile(doc.file_url).catch(() => {});
      }
      if (oldDocs.length > 0) {
        await this.verificationDocsRepo.delete({ artist_profile_id: profile.id });
      }
    } else {
      profile.validation_status = 'approved';
    }
    await this.artistsRepo.save(profile);
    return { id: profile.id, validated: profile.validated };
  }

  async creditWallet(artistId: number, amountCents: number) {
    // Atomic increment — no read-modify-write race condition
    const result = await this.artistsRepo.increment({ id: artistId }, 'wallet_balance', amountCents);
    if (!result.affected) throw new NotFoundException('Profil artiste introuvable');
    const profile = await this.artistsRepo.findOne({ where: { id: artistId } });
    return {
      artistId,
      walletBalance: Number(profile!.wallet_balance ?? 0),
      amountCredited: amountCents,
    };
  }

  async debitWallet(artistId: number, amountCents: number) {
    // Conditional atomic decrement: only updates if balance is sufficient
    const result = await this.artistsRepo
      .createQueryBuilder()
      .update(ArtistProfile)
      .set({ wallet_balance: () => `wallet_balance - ${amountCents}` })
      .where('id = :id AND wallet_balance >= :amount', { id: artistId, amount: amountCents })
      .execute();

    if (!result.affected) {
      const profile = await this.artistsRepo.findOne({ where: { id: artistId } });
      if (!profile) throw new NotFoundException('Profil artiste introuvable');
      throw new ConflictException('Solde insuffisant');
    }

    const profile = await this.artistsRepo.findOne({ where: { id: artistId } });
    return {
      artistId,
      walletBalance: Number(profile!.wallet_balance ?? 0),
      amountDebited: amountCents,
    };
  }

  async addPendingBalance(artistId: number, amountCents: number) {
    // Atomic increment
    const result = await this.artistsRepo.increment({ id: artistId }, 'pending_balance', amountCents);
    if (!result.affected) throw new NotFoundException('Profil artiste introuvable');
    const profile = await this.artistsRepo.findOne({ where: { id: artistId } });
    return {
      artistId,
      pendingBalance: Number(profile!.pending_balance ?? 0),
      amountAdded: amountCents,
    };
  }

  async subtractPendingBalance(artistId: number, amountCents: number) {
    // Atomic floor-at-zero decrement using GREATEST
    const result = await this.artistsRepo
      .createQueryBuilder()
      .update(ArtistProfile)
      .set({ pending_balance: () => `GREATEST(0, pending_balance - ${amountCents})` })
      .where('id = :id', { id: artistId })
      .execute();

    if (!result.affected) throw new NotFoundException('Profil artiste introuvable');
    const profile = await this.artistsRepo.findOne({ where: { id: artistId } });
    return {
      artistId,
      pendingBalance: Number(profile!.pending_balance ?? 0),
      amountSubtracted: amountCents,
    };
  }

  /**
   * Called from webhook account.updated — marks onboarding complete
   * only if charges_enabled AND payouts_enabled.
   */
  async markStripeReady(stripeAccountId: string) {
    const profile = await this.artistsRepo.findOne({
      where: { stripe_account_id: stripeAccountId },
    });
    if (!profile) return { updated: false, reason: 'not_found' };

    if (profile.stripe_onboarded) {
      return { updated: false, reason: 'already_onboarded' };
    }

    profile.stripe_onboarded = true;
    await this.artistsRepo.save(profile);

    // Publish artist.kyc-verified event (best-effort)
    const user = await this.fetchUserWithEmail(profile.user_id);
    if (user) {
      void this.eventsPublisher.publish('artist.kyc-verified', {
        artistEmail: user.email,
        artistName: `${user.firstname} ${user.lastname}`,
      });
    }

    return { updated: true, artistId: profile.id };
  }

  /**
   * Called from webhook account.updated when capabilities are NOT yet ready.
   * Ensures stripe_onboarded is false if account regresses.
   */
  async markStripeNotReady(stripeAccountId: string) {
    const profile = await this.artistsRepo.findOne({
      where: { stripe_account_id: stripeAccountId },
    });
    if (!profile) return { updated: false, reason: 'not_found' };
    if (!profile.stripe_onboarded) return { updated: false, reason: 'already_not_ready' };

    profile.stripe_onboarded = false;
    await this.artistsRepo.save(profile);
    return { updated: true, artistId: profile.id };
  }

  async adminGetAll() {
    const profiles = await this.artistsRepo.find({ relations: ['shops'] });
    // Fetch all users in parallel instead of serially
    const users = await Promise.all(profiles.map((p) => this.fetchUser(p.user_id)));
    return profiles.map((p, i) => ({ ...p, user: users[i] }));
  }

  async findByStripeAccountId(
    stripeAccountId: string,
  ): Promise<{ id: number; user_id: number; email: string; name: string } | null> {
    const profile = await this.artistsRepo.findOne({
      where: { stripe_account_id: stripeAccountId },
    });
    if (!profile) return null;
    const user = await this.fetchUserWithEmail(profile.user_id);
    if (!user) return null;
    return {
      id: profile.id,
      user_id: profile.user_id,
      email: user.email,
      name: `${user.firstname} ${user.lastname}`,
    };
  }

  // ---------------------------------------------------------------------------
  // Artist verification workflow
  // ---------------------------------------------------------------------------

  async submitVerification(
    userId: number,
    files: Express.Multer.File[],
    description?: string,
    namesJson?: string,
  ) {
    const profile = await this.artistsRepo.findOne({ where: { user_id: userId } });
    if (!profile) throw new NotFoundException('Profil artiste introuvable');
    if (profile.validation_status === 'approved') {
      throw new ConflictException('Votre compte est déjà validé');
    }
    if (!files || files.length === 0) {
      throw new BadRequestException('Au moins un fichier de preuve est requis');
    }

    // Delete previous documents if re-submitting after rejection
    if (profile.validation_status === 'rejected') {
      const oldDocs = await this.verificationDocsRepo.find({
        where: { artist_profile_id: profile.id },
      });
      for (const doc of oldDocs) {
        await this.minioService.deleteFile(doc.file_url).catch(() => {});
      }
      await this.verificationDocsRepo.delete({ artist_profile_id: profile.id });
    }

    // Upload and save documents — sequential to avoid MinIO connection exhaustion
    let namesArr: string[] = [];
    try { namesArr = namesJson ? (JSON.parse(namesJson) as string[]) : []; } catch { namesArr = []; }
    const savedDocs: ArtistVerificationDocument[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const file_url = await this.minioService.uploadVerificationFile(file);
        const doc = this.verificationDocsRepo.create({
          artist_profile_id: profile.id,
          file_url,
          name: (namesArr[i] ?? '').trim() || null,
          description: description ?? null,
        });
        savedDocs.push(await this.verificationDocsRepo.save(doc));
      }
    } catch (err: unknown) {
      // Clean up already-uploaded files on partial failure
      for (const doc of savedDocs) {
        await this.minioService.deleteFile(doc.file_url).catch(() => {});
      }
      if (savedDocs.length > 0) {
        await this.verificationDocsRepo
          .delete(savedDocs.map((d) => d.id))
          .catch(() => {});
      }
      const nodeErr = err as NodeJS.ErrnoException;
      if (
        nodeErr.code === 'EPIPE' ||
        nodeErr.code === 'ECONNRESET' ||
        nodeErr.code === 'ECONNREFUSED' ||
        nodeErr.code === 'ETIMEDOUT'
      ) {
        throw new ServiceUnavailableException(
          'Le service de stockage de fichiers est temporairement indisponible. Réessayez dans quelques instants.',
        );
      }
      throw new InternalServerErrorException(
        'Une erreur est survenue lors de l\'upload des fichiers.',
      );
    }

    profile.validation_status = 'pending';
    profile.validation_note = null;
    await this.artistsRepo.save(profile);

    // Notify admin via RabbitMQ (best-effort)
    const user = await this.fetchUserWithEmail(profile.user_id);
    if (user) {
      void this.eventsPublisher.publish('artist.verification-submitted', {
        artistName: `${user.firstname} ${user.lastname}`,
        artistEmail: user.email,
        artistId: profile.id,
      });
    }

    return { validation_status: profile.validation_status, documents: savedDocs };
  }

  async getMyVerification(userId: number) {
    const profile = await this.artistsRepo.findOne({ where: { user_id: userId } });
    if (!profile) throw new NotFoundException('Profil artiste introuvable');

    const documents = await this.verificationDocsRepo.find({
      where: { artist_profile_id: profile.id },
      order: { created_at: 'DESC' },
    });

    return {
      validation_status: profile.validation_status,
      validation_note: profile.validation_note,
      documents,
    };
  }

  async adminGetPendingVerifications() {
    const profiles = await this.artistsRepo.find({
      where: { validation_status: Not('none') },
      order: { updated_at: 'DESC' },
    });
    return Promise.all(
      profiles.map(async (p) => {
        const [user, docs] = await Promise.all([
          this.fetchUser(p.user_id),
          this.verificationDocsRepo.find({
            where: { artist_profile_id: p.id },
            order: { created_at: 'DESC' },
          }),
        ]);
        // Replace bare object names with pre-signed URLs so private
        // verification documents are never publicly accessible.
        const documents = await Promise.all(
          docs.map(async (doc) => ({
            ...doc,
            file_url: await this.minioService.getPresignedUrl(doc.file_url),
          })),
        );
        return { ...p, user, documents };
      }),
    );
  }

  async adminReviewVerification(artistId: number, dto: ReviewVerificationDto) {
    const profile = await this.artistsRepo.findOne({ where: { id: artistId } });
    if (!profile) throw new NotFoundException('Profil artiste introuvable');
    if (profile.validation_status !== 'pending') {
      throw new ConflictException(
        'Aucune demande de validation en attente pour cet artiste',
      );
    }

    if (dto.action === 'approve') {
      profile.validation_status = 'approved';
      profile.validated = true;
      profile.validation_note = null;
    } else {
      profile.validation_status = 'rejected';
      profile.validated = false;
      profile.validation_note = dto.note ?? null;
    }
    await this.artistsRepo.save(profile);

    const event =
      dto.action === 'approve'
        ? 'artist.verification-approved'
        : 'artist.verification-rejected';

    const user = await this.fetchUserWithEmail(profile.user_id);
    if (user) {
      void this.eventsPublisher.publish(event, {
        artistName: `${user.firstname} ${user.lastname}`,
        artistEmail: user.email,
        note: dto.note ?? null,
      });
    }

    return {
      id: profile.id,
      validated: profile.validated,
      validation_status: profile.validation_status,
      validation_note: profile.validation_note,
    };
  }
}
