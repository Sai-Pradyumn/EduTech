import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MembershipStatus, OrgRole } from '../../../common/enums';
import { UsersService } from '../../users/users.service';
import { Membership, MembershipDocument } from '../schemas/membership.schema';
import { OrganizationsService } from './organizations.service';

export interface MemberView {
  userId: string;
  name: string;
  email: string;
  orgRole: OrgRole;
  status: MembershipStatus;
  joinedAt: string;
}

export interface AssignedStudent {
  userId: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
}

const MENTORING_ROLES: OrgRole[] = [
  OrgRole.Mentor,
  OrgRole.Instructor,
  OrgRole.OrgAdmin,
];

@Injectable()
export class MembershipService {
  constructor(
    @InjectModel(Membership.name)
    private readonly memberships: Model<MembershipDocument>,
    private readonly users: UsersService,
    private readonly orgs: OrganizationsService,
  ) {}

  /** Adds (or re-activates) a member by email with the given org role. */
  async addMember(
    orgId: string,
    email: string,
    orgRole: OrgRole,
    invitedBy: string,
  ): Promise<MemberView> {
    const user = await this.users.findByEmail(email);
    if (!user)
      throw new NotFoundException(
        `No user with email ${email}. They must register first.`,
      );

    const existing = await this.memberships.findOne({
      user: user._id,
      organization: new Types.ObjectId(orgId),
    });
    if (existing) {
      existing.orgRole = orgRole;
      existing.status = MembershipStatus.Active;
      await existing.save();
    } else {
      await this.memberships.create({
        user: user._id,
        organization: new Types.ObjectId(orgId),
        orgRole,
        status: MembershipStatus.Active,
        invitedBy: new Types.ObjectId(invitedBy),
      });
      if (!user.primaryOrganization)
        await this.users.setPrimaryOrganization(String(user._id), orgId);
    }
    await this.orgs.recountMembers(orgId);
    return {
      userId: String(user._id),
      name: user.name,
      email: user.email,
      orgRole,
      status: MembershipStatus.Active,
      joinedAt: new Date().toISOString(),
    };
  }

  async listMembers(orgId: string): Promise<MemberView[]> {
    const members = await this.memberships
      .find({ organization: new Types.ObjectId(orgId) })
      .populate<{ user: { _id: Types.ObjectId; name: string; email: string } }>(
        'user',
        'name email',
      )
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    return members
      .filter((m) => m.user)
      .map((m) => ({
        userId: String(m.user._id),
        name: m.user.name,
        email: m.user.email,
        orgRole: m.orgRole,
        status: m.status,
        joinedAt: (m as { createdAt?: Date }).createdAt?.toISOString() ?? '',
      }));
  }

  async updateRole(
    orgId: string,
    userId: string,
    orgRole: OrgRole,
  ): Promise<void> {
    const res = await this.memberships
      .updateOne(
        {
          organization: new Types.ObjectId(orgId),
          user: new Types.ObjectId(userId),
        },
        { orgRole },
      )
      .exec();
    if (res.matchedCount === 0)
      throw new NotFoundException('Membership not found');
  }

  /** Students in the orgs where the user mentors/instructs/admins (org-scoped assignment). */
  async studentsForMentor(mentorUserId: string): Promise<AssignedStudent[]> {
    const mentoring = await this.memberships
      .find({
        user: new Types.ObjectId(mentorUserId),
        status: MembershipStatus.Active,
        orgRole: { $in: MENTORING_ROLES },
      })
      .lean<MembershipDocument[]>()
      .exec();
    const orgIds = mentoring.map((m) => m.organization);
    if (orgIds.length === 0) return [];

    const students = await this.memberships
      .find({
        organization: { $in: orgIds },
        orgRole: OrgRole.Student,
        status: MembershipStatus.Active,
      })
      .populate<{ user: { _id: Types.ObjectId; name: string; email: string } }>(
        'user',
        'name email',
      )
      .populate<{ organization: { _id: Types.ObjectId; name: string } }>(
        'organization',
        'name',
      )
      .lean()
      .exec();

    const seen = new Set<string>();
    const out: AssignedStudent[] = [];
    for (const m of students) {
      if (!m.user || seen.has(String(m.user._id))) continue;
      seen.add(String(m.user._id));
      out.push({
        userId: String(m.user._id),
        name: m.user.name,
        email: m.user.email,
        organizationId: String(m.organization?._id ?? ''),
        organizationName: m.organization?.name ?? '',
      });
    }
    return out;
  }

  async removeMember(
    orgId: string,
    userId: string,
    actingUserId: string,
  ): Promise<void> {
    if (userId === actingUserId)
      throw new BadRequestException('You cannot remove yourself.');
    await this.memberships
      .deleteOne({
        organization: new Types.ObjectId(orgId),
        user: new Types.ObjectId(userId),
      })
      .exec();
    await this.orgs.recountMembers(orgId);
  }
}
