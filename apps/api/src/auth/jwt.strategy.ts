import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

const cookieExtractor = (req: any): string | null => {
  return req?.cookies?.access_token ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey:
        configService.get('JWT_SECRET') ||
        process.env.JWT_SECRET ||
        (() => {
          throw new Error('FATAL: JWT_SECRET is not defined in .env');
        })(),
    });
  }

  async validate(payload: any) {
    return {
      id: payload.sub,
      userId: payload.sub, // Alias for controllers using req.user.userId
      username: payload.username,
      userOrganisations: payload.organisations,
      isSuperAdmin: payload.isSuperAdmin || false,
      systemRole: payload.systemRole,
      isEmailVerified: payload.isEmailVerified || false,
    };
  }
}
