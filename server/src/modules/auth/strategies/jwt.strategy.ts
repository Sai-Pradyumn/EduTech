import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../../../config/configuration';
import { AuthUser, JwtPayload } from '../../../common/interfaces';
import { JWT_AUDIENCE, JWT_ISSUER } from '../../../common/security/jwt-claims';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<AppConfig, true>) {
    // Tokens are always signed with iss/aud; enforce them here once JWT_STRICT_CLAIMS=true
    // (flip after one refresh lifetime so pre-claim tokens have rotated out).
    const strict = config.get('security.jwtStrictClaims', { infer: true });
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt.secret', { infer: true }),
      ...(strict ? { issuer: JWT_ISSUER, audience: JWT_AUDIENCE } : {}),
    });
  }

  /** Return value is attached to request.user. */
  validate(payload: JwtPayload): AuthUser {
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
