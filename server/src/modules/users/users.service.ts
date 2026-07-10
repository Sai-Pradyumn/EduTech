import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums';
import { User, UserDocument } from './schemas/user.schema';

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
  role?: Role;
  emailVerified?: boolean;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(input: CreateUserInput): Promise<UserDocument> {
    return this.userModel.create({
      ...input,
      role: input.role ?? Role.Student,
    });
  }

  /** Cohort peer-leaderboard visibility (opt-in; hidden by default). */
  async setLeaderboardOptIn(userId: string, optIn: boolean): Promise<void> {
    await this.userModel
      .updateOne({ _id: userId }, { $set: { leaderboardOptIn: optIn } })
      .exec();
  }

  /** Find a Google-linked account by email and link/create as needed (Phase 10 · OAuth).
   *  Google has verified the email, so the account is always emailVerified. */
  async findOrCreateGoogle(profile: GoogleProfile): Promise<UserDocument> {
    const existing = await this.userModel
      .findOne({ email: profile.email.toLowerCase() })
      .exec();
    if (existing) {
      let dirty = false;
      if (!existing.googleId) {
        existing.googleId = profile.googleId;
        if (profile.avatarUrl && !existing.avatarUrl)
          existing.avatarUrl = profile.avatarUrl;
        dirty = true;
      }
      if (!existing.emailVerified) {
        existing.emailVerified = true;
        dirty = true;
      }
      if (dirty) await existing.save();
      return existing;
    }
    return this.userModel.create({
      email: profile.email.toLowerCase(),
      name: profile.name,
      googleId: profile.googleId,
      avatarUrl: profile.avatarUrl,
      role: Role.Student,
      emailVerified: true,
    });
  }

  /** Mark an account's email as verified (after a successful OTP). */
  async setEmailVerified(id: string): Promise<void> {
    await this.userModel.updateOne({ _id: id }, { emailVerified: true }).exec();
  }

  /** Update the password hash for an unverified account re-registering. */
  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.userModel.updateOne({ _id: id }, { passwordHash }).exec();
  }

  /** Includes passwordHash (normally select:false) for credential verification. */
  findByEmailWithSecret(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .exec();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  findById(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return this.userModel.findById(id).exec();
  }

  async findByIdOrThrow(id: string): Promise<UserDocument> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  findByIdWithRefresh(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+refreshTokenHash').exec();
  }

  async setRefreshTokenHash(id: string, hash: string | null): Promise<void> {
    // null must actually REMOVE the stored hash. The previous `hash ?? undefined` form was
    // silently dropped by Mongoose (undefined values are stripped from updates), which
    // meant logout never invalidated the refresh token — a real session-revocation bug.
    await this.userModel
      .updateOne(
        { _id: id },
        hash
          ? { $set: { refreshTokenHash: hash } }
          : { $unset: { refreshTokenHash: '' } },
      )
      .exec();
  }

  /** Revoke every outstanding refresh token for this user ("log out all devices"):
   *  bump the token version and drop the stored refresh hash. */
  async bumpTokenVersion(id: string): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: id },
        { $inc: { tokenVersion: 1 }, $unset: { refreshTokenHash: '' } },
      )
      .exec();
  }

  /** Persist the throttle state after a failed credential login (AU-04). */
  async applyLoginThrottle(
    id: string,
    attempts: number,
    lockedUntilMs: number | null,
  ): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: id },
        {
          $set: {
            failedLoginAttempts: attempts,
            loginLockedUntil: lockedUntilMs ? new Date(lockedUntilMs) : null,
          },
        },
      )
      .exec();
  }

  /** Clear the login throttle after a successful authentication. */
  async resetLoginThrottle(id: string): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: id },
        { $set: { failedLoginAttempts: 0, loginLockedUntil: null } },
      )
      .exec();
  }

  /* ── TOTP MFA (AU-03) — secret + recovery hashes are select:false ────────────────── */

  /** Load a user including their (normally hidden) MFA secret and recovery hashes. */
  findByIdWithMfa(id: string): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return this.userModel
      .findById(id)
      .select('+mfaSecret +mfaRecoveryHashes')
      .exec();
  }

  /** Stage a TOTP secret during enrollment (not yet enabled until the first code verifies). */
  async setMfaSecret(id: string, secret: string): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: id },
        { $set: { mfaSecret: secret, mfaEnabled: false } },
      )
      .exec();
  }

  /** Activate MFA after a verified code, storing the hashed single-use recovery codes. */
  async enableMfa(id: string, recoveryHashes: string[]): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: id },
        {
          $set: {
            mfaEnabled: true,
            mfaEnrolledAt: new Date(),
            mfaRecoveryHashes: recoveryHashes,
          },
        },
      )
      .exec();
  }

  /** Fully disable MFA and purge the secret + recovery codes. */
  async disableMfa(id: string): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: id },
        {
          $set: { mfaEnabled: false },
          $unset: { mfaSecret: '', mfaRecoveryHashes: '', mfaEnrolledAt: '' },
        },
      )
      .exec();
  }

  /** Persist the remaining recovery hashes after one is consumed at login. */
  async setRecoveryHashes(id: string, hashes: string[]): Promise<void> {
    await this.userModel
      .updateOne({ _id: id }, { $set: { mfaRecoveryHashes: hashes } })
      .exec();
  }

  async markOnboarded(id: string): Promise<void> {
    await this.userModel.updateOne({ _id: id }, { isOnboarded: true }).exec();
  }

  /** Keep the canonical account name in sync when the profile's full name changes. */
  async setName(id: string, name: string): Promise<void> {
    await this.userModel.updateOne({ _id: id }, { name }).exec();
  }

  async touchLastActive(id: string): Promise<void> {
    await this.userModel
      .updateOne({ _id: id }, { lastActiveAt: new Date() })
      .exec();
  }

  async setPrimaryOrganization(id: string, orgId: string): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: id },
        { primaryOrganization: new Types.ObjectId(orgId) },
      )
      .exec();
  }
}
