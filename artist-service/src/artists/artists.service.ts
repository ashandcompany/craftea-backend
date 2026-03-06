import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { existsSync, readFileSync } from 'node:fs';
import { ArtistProfile } from './entities/artist-profile.entity.js';
import { MinioService } from '../minio/minio.service.js';
import { CreateArtistDto } from './dto/create-artist.dto.js';
import { UpdateArtistDto } from './dto/update-artist.dto.js';

export interface UserIdentity {
  id: number;
  firstname: string;
  lastname: string;
}

@Injectable()
export class ArtistsService {
  private userServiceUrl: string;
  private frontendUrl: string;
  private stripe: Stripe;
  private readonly stripeSecretConfigured: boolean;

  constructor(
    @InjectRepository(ArtistProfile) private artistsRepo: Repository<ArtistProfile>,
    private minioService: MinioService,
    private configService: ConfigService,
  ) {
    this.userServiceUrl =
      this.configService.get('USER_SERVICE_URL') || 'http://user-service:3001';
    this.frontendUrl =
      this.configService.get('FRONTEND_URL') || 'http://localhost:3000';

    let secretKey = this.configService.get<string>('STRIPE_SECRET_KEY', '').trim();
    if (!secretKey) {
      const secretKeyFile = this.configService.get<string>(
        'STRIPE_SECRET_KEY_FILE',
        '/run/secrets/stripe_secret_key',
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
    return Promise.all(
      profiles.map(async (p) => ({
        ...p,
        user: await this.fetchUser(p.user_id),
      })),
    );
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
        const account = await this.stripe.accounts.create({
          type: 'express',
          controller: {
            fees: { payer: 'application' },
            losses: { payments: 'application' },
            requirement_collection: 'application',
            stripe_dashboard: { type: 'express' },
          },
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
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
    await this.artistsRepo.save(profile);
    return { id: profile.id, validated: profile.validated };
  }

  async adminGetAll() {
    return this.artistsRepo.find({ relations: ['shops'] });
  }
}
