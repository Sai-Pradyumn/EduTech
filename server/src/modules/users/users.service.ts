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
    await this.userModel
      .updateOne({ _id: id }, { refreshTokenHash: hash ?? undefined })
      .exec();
  }

  async markOnboarded(id: string): Promise<void> {
    await this.userModel.updateOne({ _id: id }, { isOnboarded: true }).exec();
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
