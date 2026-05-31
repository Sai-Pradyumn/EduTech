import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AppConfig } from '../../config/configuration';
import { JwtPayload } from '../../common/interfaces';
import { OrgRole, Role } from '../../common/enums';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isOnboarded: boolean;
  platformRole?: OrgRole;
  primaryOrganization?: string;
  isPlatformAdmin: boolean;
}

export interface AuthResult extends AuthTokens {
  user: PublicUser;
}

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing)
      throw new ConflictException('An account with this email already exists');

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.users.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
    });
    return this.issueSession(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findByEmailWithSecret(dto.email);
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid email or password');

    await this.users.touchLastActive(user.id);
    return this.issueSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get('jwt.refreshSecret', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.users.findByIdWithRefresh(payload.sub);
    if (!user || !user.refreshTokenHash)
      throw new UnauthorizedException('Session expired');

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) throw new UnauthorizedException('Session expired');

    return this.rotateTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.users.setRefreshTokenHash(userId, null);
  }

  async getPublicUser(userId: string): Promise<PublicUser> {
    const user = await this.users.findByIdOrThrow(userId);
    return this.toPublicUser(user);
  }

  private async issueSession(user: UserDocument): Promise<AuthResult> {
    const tokens = await this.rotateTokens(user);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  private async rotateTokens(user: UserDocument): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('jwt.secret', { infer: true }),
      expiresIn: this.config.get('jwt.expiresIn', { infer: true }),
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('jwt.refreshSecret', { infer: true }),
      expiresIn: this.config.get('jwt.refreshExpiresIn', { infer: true }),
    });

    await this.users.setRefreshTokenHash(
      user.id,
      await bcrypt.hash(refreshToken, SALT_ROUNDS),
    );
    return { accessToken, refreshToken };
  }

  private toPublicUser(user: UserDocument): PublicUser {
    const isPlatformAdmin =
      user.role === Role.Admin ||
      user.platformRole === OrgRole.PlatformAdmin ||
      user.platformRole === OrgRole.SuperAdmin;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isOnboarded: user.isOnboarded,
      platformRole: user.platformRole,
      primaryOrganization: user.primaryOrganization
        ? String(user.primaryOrganization)
        : undefined,
      isPlatformAdmin,
    };
  }
}
