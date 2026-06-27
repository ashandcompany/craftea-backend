import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { User, UserRole } from '../users/entities/user.entity.js';
import { Log } from '../logs/entities/log.entity.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { EmailService } from '../email/email.service.js';
import { resetPasswordTemplate } from '../email/templates/reset-password.template.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client;

  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Log) private logsRepo: Repository<Log>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (clientId) {
      this.googleClient = new OAuth2Client(clientId);
    }
  }

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
      avatar_url: user.avatar_url,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  async register(dto: RegisterDto) {
    const exists = await this.usersRepo.findOne({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Email déjà utilisé');

    const hash = await bcrypt.hash(dto.password, 12);
    const user = this.usersRepo.create({
      firstname: dto.firstname,
      lastname: dto.lastname,
      email: dto.email,
      password: hash,
      role: (dto.role as UserRole) || UserRole.BUYER,
    });
    await this.usersRepo.save(user);

    await this.logsRepo.save(
      this.logsRepo.create({
        user_id: user.id,
        action: 'register',
        entity: 'user',
        entity_id: user.id,
      }),
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
      this.logsRepo.create({
        user_id: user.id,
        action: 'login',
        entity: 'user',
        entity_id: user.id,
      }),
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
      if (!user || !user.is_active)
        throw new UnauthorizedException('Utilisateur invalide');

      return { accessToken: this.generateAccessToken(user) };
    } catch {
      throw new UnauthorizedException('Refresh token invalide');
    }
  }

  async me(userId: number) {
    return this.usersRepo.findOne({ where: { id: userId } });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { email } });
    // Always return 200 — do not expose whether the account exists
    if (!user) return;

    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // +1h

    await this.usersRepo.update(user.id, {
      reset_password_token: hashedToken,
      reset_password_expires: expires,
    });

    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
    const html = resetPasswordTemplate({ resetUrl });

    // In development (no real Resend key), log the URL so it can be tested directly
    const resendKey = this.configService.get<string>(
      'RESEND_API_KEY',
      'placeholder',
    );
    if (!resendKey || resendKey === 'placeholder') {
      this.logger.log(
        `[DEV] Lien de réinitialisation pour ${email} :\n  ${resetUrl}`,
      );
    }

    await this.emailService.send(
      email,
      'Réinitialisation de votre mot de passe Craftea',
      html,
    );
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');

    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.reset_password_token')
      .addSelect('user.reset_password_expires')
      .where('user.reset_password_token = :token', { token: hashedToken })
      .getOne();

    if (
      !user ||
      !user.reset_password_expires ||
      user.reset_password_expires < new Date()
    ) {
      throw new BadRequestException(
        'Lien de réinitialisation invalide ou expiré',
      );
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await this.usersRepo.update(user.id, {
      password: hash,
      reset_password_token: null,
      reset_password_expires: null,
    });
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user) throw new UnauthorizedException('Utilisateur introuvable');

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match)
      throw new UnauthorizedException('Mot de passe actuel incorrect');

    if (newPassword.length < 8) {
      throw new BadRequestException(
        'Le nouveau mot de passe doit contenir au moins 8 caractères',
      );
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await this.usersRepo.update(userId, { password: hash });

    await this.logsRepo.save(
      this.logsRepo.create({
        user_id: userId,
        action: 'change_password',
        entity: 'user',
        entity_id: userId,
      }),
    );
  }

  async loginWithGoogle(credential: string) {
    if (!this.googleClient) {
      throw new BadRequestException('Google OAuth non configuré');
    }

    try {
      // Verify the Google token
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new UnauthorizedException('Token Google invalide');
      }

      const { email, given_name, family_name, picture } = payload;

      // Check if user exists
      let user = await this.usersRepo.findOne({ where: { email } });

      if (!user) {
        // Create new user from Google account
        user = this.usersRepo.create({
          firstname: given_name || 'Utilisateur',
          lastname: family_name || 'Google',
          email,
          password: await bcrypt.hash(randomBytes(32).toString('hex'), 12), // Random password
          role: UserRole.BUYER,
          avatar_url: picture,
        });
        await this.usersRepo.save(user);

        await this.logsRepo.save(
          this.logsRepo.create({
            user_id: user.id,
            action: 'register_google',
            entity: 'user',
            entity_id: user.id,
          }),
        );
      } else {
        // Update avatar if provided
        if (picture && !user.avatar_url) {
          await this.usersRepo.update(user.id, { avatar_url: picture });
          user.avatar_url = picture;
        }

        if (!user.is_active) {
          throw new ForbiddenException('Compte désactivé');
        }

        await this.logsRepo.save(
          this.logsRepo.create({
            user_id: user.id,
            action: 'login_google',
            entity: 'user',
            entity_id: user.id,
          }),
        );
      }

      return {
        accessToken: this.generateAccessToken(user),
        refreshToken: this.generateRefreshToken(user),
        user: this.sanitizeUser(user),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Google OAuth error [${error?.constructor?.name ?? 'unknown'}]: ${msg}`,
      );
      throw new UnauthorizedException('Authentification Google échouée');
    }
  }
}
