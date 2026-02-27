import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/entities/user.entity.js';
import { Log } from '../logs/entities/log.entity.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Log) private logsRepo: Repository<Log>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private generateAccessToken(user: User) {
    return this.jwtService.sign(
      { id: user.id, role: user.role },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
      },
    );
  }

  private generateRefreshToken(user: User) {
    return this.jwtService.sign(
      { id: user.id },
      {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );
  }

  private sanitizeUser(user: User) {
    return {
      id: user.id,
      role: user.role,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  async register(dto: RegisterDto) {
    const exists = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email déjà utilisé');

    const hash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepo.create({
      firstname: dto.firstname,
      lastname: dto.lastname,
      email: dto.email,
      password: hash,
      role: (dto.role as UserRole) || UserRole.BUYER,
    });
    await this.usersRepo.save(user);

    await this.logsRepo.save(
      this.logsRepo.create({ user_id: user.id, action: 'register', entity: 'user', entity_id: user.id }),
    );

    return {
      accessToken: this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken(user),
      user: this.sanitizeUser(user),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: dto.email })
      .getOne();

    if (!user) throw new UnauthorizedException('Identifiants invalides');
    if (!user.is_active) throw new ForbiddenException('Compte désactivé');

    const match = await bcrypt.compare(dto.password, user.password);
    if (!match) throw new UnauthorizedException('Identifiants invalides');

    await this.logsRepo.save(
      this.logsRepo.create({ user_id: user.id, action: 'login', entity: 'user', entity_id: user.id }),
    );

    return {
      accessToken: this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken(user),
      user: this.sanitizeUser(user),
    };
  }

  async refresh(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });
      const user = await this.usersRepo.findOne({ where: { id: decoded.id } });
      if (!user || !user.is_active) throw new UnauthorizedException('Utilisateur invalide');

      return { accessToken: this.generateAccessToken(user) };
    } catch {
      throw new UnauthorizedException('Refresh token invalide');
    }
  }

  async me(userId: number) {
    return this.usersRepo.findOne({ where: { id: userId } });
  }
}
