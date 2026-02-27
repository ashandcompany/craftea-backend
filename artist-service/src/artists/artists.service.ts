import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  constructor(
    @InjectRepository(ArtistProfile) private artistsRepo: Repository<ArtistProfile>,
    private minioService: MinioService,
    private configService: ConfigService,
  ) {
    this.userServiceUrl =
      this.configService.get('USER_SERVICE_URL') || 'http://user-service:3001';
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
