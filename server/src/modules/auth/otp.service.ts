import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { MailerService } from '../mailer/mailer.service';
import { EmailOtp, EmailOtpDocument } from './schemas/email-otp.schema';

const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000;

/** Issues, sends, and verifies one-time email codes for signup verification. */
@Injectable()
export class OtpService {
  constructor(
    @InjectModel(EmailOtp.name)
    private readonly otps: Model<EmailOtpDocument>,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  private get ttlMinutes(): number {
    return parseInt(this.config.get<string>('OTP_TTL_MIN') ?? '10', 10);
  }

  /** Generate + store + email a fresh code for an email (enforces a resend cooldown). */
  async issue(email: string, purpose = 'signup'): Promise<void> {
    const lower = email.toLowerCase();
    const existing = await this.otps.findOne({ email: lower, purpose }).exec();
    if (
      existing?.lastSentAt &&
      Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      throw new HttpException(
        'Please wait a moment before requesting another code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 8);
    const expiresAt = new Date(Date.now() + this.ttlMinutes * 60_000);
    await this.otps.findOneAndUpdate(
      { email: lower, purpose },
      {
        $set: {
          email: lower,
          purpose,
          codeHash,
          expiresAt,
          lastSentAt: new Date(),
          attempts: 0,
        },
      },
      { upsert: true },
    );
    await this.mailer.sendOtp(lower, code, this.ttlMinutes);
  }

  /** Verify a submitted code. Throws on missing/expired/wrong/too-many-attempts. */
  async verify(email: string, code: string, purpose = 'signup'): Promise<void> {
    const lower = email.toLowerCase();
    const otp = await this.otps.findOne({ email: lower, purpose }).exec();
    if (!otp) {
      throw new BadRequestException('No code found — request a new one.');
    }
    if (otp.expiresAt.getTime() < Date.now()) {
      await otp.deleteOne();
      throw new BadRequestException('Code expired — request a new one.');
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      await otp.deleteOne();
      throw new BadRequestException('Too many attempts — request a new code.');
    }
    const ok = await bcrypt.compare(code, otp.codeHash);
    if (!ok) {
      otp.attempts += 1;
      await otp.save();
      throw new BadRequestException('Incorrect code.');
    }
    await otp.deleteOne();
  }
}
