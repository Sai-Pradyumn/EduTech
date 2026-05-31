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
