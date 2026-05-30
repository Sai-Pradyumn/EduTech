import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { UsersService } from '../../users/users.service';
import { Certificate, CertificateDocument } from '../schemas/certificate.schema';

export interface CertificateView {
  id: string;
  title: string;
  skill: string;
  score: number;
  issuerName: string;
  verificationId: string;
  revoked: boolean;
  issuedAt: string;
}

export interface VerificationResult {
  valid: boolean;
  holderName?: string;
  title?: string;
  skill?: string;
  score?: number;
  issuerName?: string;
  issuedAt?: string;
  verificationId?: string;
}

@Injectable()
export class CertificatesService {
  constructor(
    @InjectModel(Certificate.name) private readonly certs: Model<CertificateDocument>,
    private readonly users: UsersService,
  ) {}

  async issue(
    issuerId: string,
    input: { userId: string; title: string; skill?: string; score?: number; projectId?: string; organizationId?: string | null },
  ): Promise<CertificateView> {
    const issuer = await this.users.findByIdOrThrow(issuerId);
    const cert = await this.certs.create({
      user: new Types.ObjectId(input.userId),
      title: input.title,
      skill: input.skill ?? '',
      score: input.score ?? 0,
      project: input.projectId ? new Types.ObjectId(input.projectId) : undefined,
      organization: input.organizationId ? new Types.ObjectId(input.organizationId) : undefined,
      issuerName: issuer.name,
      verificationId: `ASTA-${randomUUID().slice(0, 8).toUpperCase()}`,
      revoked: false,
    });
    return this.toView(cert);
  }

  async listMine(userId: string): Promise<CertificateView[]> {
    const list = await this.certs.find({ user: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).lean<CertificateDocument[]>().exec();
    return list.map((c) => this.toView(c));
  }

  /** Public verification by id — no auth. */
  async verify(verificationId: string): Promise<VerificationResult> {
    const cert = await this.certs
      .findOne({ verificationId })
      .populate<{ user: { name: string } }>('user', 'name')
      .lean()
      .exec();
    if (!cert || cert.revoked) return { valid: false };
    return {
      valid: true,
      holderName: (cert.user as { name?: string } | undefined)?.name ?? 'A learner',
      title: cert.title,
      skill: cert.skill,
      score: cert.score,
      issuerName: cert.issuerName,
      issuedAt: (cert as { createdAt?: Date }).createdAt?.toISOString() ?? '',
      verificationId: cert.verificationId,
    };
  }

  async revoke(id: string): Promise<{ ok: true }> {
    const res = await this.certs.updateOne({ _id: id }, { $set: { revoked: true } }).exec();
    if (res.matchedCount === 0) throw new NotFoundException('Certificate not found');
    return { ok: true };
  }

  private toView(c: CertificateDocument): CertificateView {
    return {
      id: String(c._id),
      title: c.title,
      skill: c.skill,
      score: c.score,
      issuerName: c.issuerName,
      verificationId: c.verificationId,
      revoked: c.revoked,
      issuedAt: (c as { createdAt?: Date }).createdAt?.toISOString() ?? new Date().toISOString(),
    };
  }
}
