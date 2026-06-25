import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity.js';
import { Log } from '../logs/entities/log.entity.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { MinioService } from '../minio/minio.service.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Log) private logsRepo: Repository<Log>,
    private minioService: MinioService,
  ) {}

  async findAll() {
    return this.usersRepo.find();
  }

  async findById(id: number) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async findPublicById(id: number) {
    const user = await this.usersRepo.findOne({
      where: { id },
      select: ['id', 'firstname', 'lastname'],
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async update(
    id: number,
    dto: UpdateUserDto,
    currentUser: { id: number; role: string },
  ) {
    if (currentUser.role !== 'admin' && currentUser.id !== id) {
      throw new ForbiddenException('Accès interdit');
    }

    await this.usersRepo.update(id, dto);

    await this.logsRepo.save(
      this.logsRepo.create({
        user_id: currentUser.id,
        action: 'update_user',
        entity: 'user',
        entity_id: id,
      }),
    );

    return this.findById(id);
  }

  async toggleActive(id: number, currentUserId: number) {
    const user = await this.findById(id);
    user.is_active = !user.is_active;
    await this.usersRepo.save(user);

    await this.logsRepo.save(
      this.logsRepo.create({
        user_id: currentUserId,
        action: user.is_active ? 'activate_user' : 'deactivate_user',
        entity: 'user',
        entity_id: user.id,
      }),
    );

    return { id: user.id, is_active: user.is_active };
  }

  async changeRole(id: number, role: string, currentUserId: number) {
    const user = await this.findById(id);
    user.role = role as UserRole;
    await this.usersRepo.save(user);

    await this.logsRepo.save(
      this.logsRepo.create({
        user_id: currentUserId,
        action: 'change_role',
        entity: 'user',
        entity_id: user.id,
      }),
    );

    return { id: user.id, role: user.role };
  }

  async updateAvatar(
    id: number,
    file: Express.Multer.File,
    currentUser: { id: number; role: string },
  ) {
    if (currentUser.role !== 'admin' && currentUser.id !== id) {
      throw new ForbiddenException('Accès interdit');
    }
    if (!file) throw new BadRequestException('Fichier manquant');

    const user = await this.findById(id);
    if (user.avatar_url) await this.minioService.deleteFile(user.avatar_url);
    user.avatar_url = await this.minioService.uploadFile(file);
    return this.usersRepo.save(user);
  }

  async selfDeactivate(userId: number): Promise<void> {
    await this.usersRepo.update(userId, { is_active: false });

    await this.logsRepo.save(
      this.logsRepo.create({
        user_id: userId,
        action: 'deactivate_user',
        entity: 'user',
        entity_id: userId,
      }),
    );
  }
}
