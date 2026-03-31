import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

export interface JwtPayload {
  id: number;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req as any)?.cookies?.accessToken ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: cfg.get<string>('JWT_SECRET', 'craftea_jwt_secret_dev'),
    });
  }

  validate(payload: JwtPayload) {
    return { id: payload.id, role: payload.role };
  }
}
