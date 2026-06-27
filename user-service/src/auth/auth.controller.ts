import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Response,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { GoogleLoginDto } from './dto/google-login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import type {
  Response as ExpressResponse,
  Request as ExpressRequest,
} from 'express';

const ACCESS_TOKEN_TTL = 15 * 60 * 1000; // 15 min
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private cookieBase(_res: ExpressResponse) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: isProduction,
      path: '/',
    };
  }

  private setTokenCookies(
    res: ExpressResponse,
    accessToken: string,
    refreshToken: string,
  ) {
    const base = this.cookieBase(res);
    res.cookie('accessToken', accessToken, {
      ...base,
      maxAge: ACCESS_TOKEN_TTL,
    });
    res.cookie('refreshToken', refreshToken, {
      ...base,
      maxAge: REFRESH_TOKEN_TTL,
    });
  }

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const result = await this.authService.register(dto);
    this.setTokenCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const result = await this.authService.login(dto);
    this.setTokenCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Post('google')
  @HttpCode(200)
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const result = await this.authService.loginWithGoogle(dto.credential);
    this.setTokenCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const refreshToken = (req as any).cookies?.refreshToken as
      string | undefined;
    if (!refreshToken)
      throw new UnauthorizedException('Refresh token manquant');
    const result = await this.authService.refresh(refreshToken);
    const base = this.cookieBase(res);
    res.cookie('accessToken', result.accessToken, {
      ...base,
      maxAge: ACCESS_TOKEN_TTL,
    });
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Response({ passthrough: true }) res: ExpressResponse) {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Request() req) {
    const user = await this.authService.me(req.user.id);
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { ok: true };
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(200)
  async changePassword(@Body() dto: ChangePasswordDto, @Request() req) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Les mots de passe ne correspondent pas');
    }
    await this.authService.changePassword(
      req.user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    return { ok: true };
  }
}
