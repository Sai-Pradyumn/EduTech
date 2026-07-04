import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import {
  StudentProfile,
  StudentProfileDocument,
} from './schemas/student-profile.schema';
import { CreateStudentProfileDto } from './dto/create-student-profile.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';

@Injectable()
export class StudentProfileService {
  constructor(
    @InjectModel(StudentProfile.name)
    private readonly model: Model<StudentProfileDocument>,
    private readonly users: UsersService,
  ) {}

  findByUser(userId: string): Promise<StudentProfileDocument | null> {
    return this.model.findOne({ user: new Types.ObjectId(userId) }).exec();
  }

  async findByUserOrThrow(userId: string): Promise<StudentProfileDocument> {
    const profile = await this.findByUser(userId);
    if (!profile)
      throw new NotFoundException(
        'Student profile not found. Complete onboarding first.',
      );
    return profile;
  }

  async getOnboardingStatus(
    userId: string,
  ): Promise<{ onboardingCompleted: boolean }> {
    const profile = await this.findByUser(userId);
    return { onboardingCompleted: profile?.onboardingCompleted ?? false };
  }

  /** Create the profile once; completing it marks onboarding done on both profile and user. */
  async create(
    userId: string,
    dto: CreateStudentProfileDto,
  ): Promise<StudentProfileDocument> {
    const existing = await this.findByUser(userId);
    if (existing) {
      throw new ConflictException(
        'Profile already exists. Use PATCH to update it.',
      );
    }
    const profile = await this.model.create({
      ...dto,
      user: new Types.ObjectId(userId),
      onboardingCompleted: true,
    });
    await this.users.markOnboarded(userId);
    return profile;
  }

  /** Merge newly-detected weak areas into the profile (deduped, capped). Used by the
   *  assessment engine so quiz results feed the tutor/roadmap personalization. */
  async addWeakAreas(userId: string, topics: string[]): Promise<void> {
    const clean = topics.map((t) => t.trim()).filter(Boolean);
    if (clean.length === 0) return;
    const profile = await this.findByUser(userId);
    if (!profile) return;
    const existing = new Set(profile.weakAreas.map((w) => w.toLowerCase()));
    const additions = clean.filter((t) => !existing.has(t.toLowerCase()));
    if (additions.length === 0) return;
    profile.weakAreas = [...profile.weakAreas, ...additions].slice(0, 20);
    await profile.save();
  }

  /** Clear all flagged weak areas (Phase 8 · Skill Twin "reset learning memory"). */
  async clearWeakAreas(userId: string): Promise<void> {
    const profile = await this.findByUser(userId);
    if (!profile) return;
    profile.weakAreas = [];
    await profile.save();
  }

  async update(
    userId: string,
    dto: UpdateStudentProfileDto,
  ): Promise<StudentProfileDocument> {
    const profile = await this.model
      .findOneAndUpdate({ user: new Types.ObjectId(userId) }, dto, {
        new: true,
      })
      .exec();
    if (!profile)
      throw new NotFoundException(
        'Student profile not found. Complete onboarding first.',
      );
    // Keep the account identity (used by the header/sidebar) consistent with the
    // profile's full name so an edit isn't stale until the next full reload.
    if (typeof dto.fullName === 'string' && dto.fullName.trim())
      await this.users.setName(userId, dto.fullName.trim());
    return profile;
  }
}
