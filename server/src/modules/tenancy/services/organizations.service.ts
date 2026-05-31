import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MembershipStatus, OrgRole, OrgType } from '../../../common/enums';
import { UsersService } from '../../users/users.service';
import {
  Organization,
  OrganizationDocument,
} from '../schemas/organization.schema';
import { Membership, MembershipDocument } from '../schemas/membership.schema';

export interface CreateOrgInput {
  name: string;
  type?: OrgType;
  description?: string;
}

export interface OrgView {
  id: string;
  name: string;
  slug: string;
  type: string;
  description: string;
  plan: string;
  status: string;
  memberCount: number;
  branding: { logoUrl?: string; primaryColor: string; tagline: string };
  createdAt: string;
}

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name)
    private readonly orgs: Model<OrganizationDocument>,
    @InjectModel(Membership.name)
    private readonly memberships: Model<MembershipDocument>,
    private readonly users: UsersService,
  ) {}

  /** Creates an org and makes the creator its ORG_ADMIN. */
  async create(
    creatorId: string,
    input: CreateOrgInput,
  ): Promise<OrganizationDocument> {
    const slug = await this.uniqueSlug(input.name);
    const org = await this.orgs.create({
      name: input.name.trim(),
      slug,
      type: input.type ?? OrgType.College,
      description: input.description ?? '',
      owner: new Types.ObjectId(creatorId),
      memberCount: 1,
    });
    await this.memberships.create({
      user: new Types.ObjectId(creatorId),
      organization: org._id,
      orgRole: OrgRole.OrgAdmin,
      status: MembershipStatus.Active,
    });
    // Set as primary org if the user has none.
    const user = await this.users.findById(creatorId);
    if (user && !user.primaryOrganization) {
      await this.users.setPrimaryOrganization(creatorId, String(org._id));
    }
    return org;
  }

  /** Platform-wide list (platform admins only — enforced at the controller). */
  async listAll(): Promise<OrgView[]> {
    const orgs = await this.orgs
      .find()
      .sort({ createdAt: -1 })
      .lean<OrganizationDocument[]>()
      .exec();
    return orgs.map((o) => this.toView(o));
  }

  /** Orgs the user is an active member of. */
  async listMine(userId: string): Promise<(OrgView & { orgRole: OrgRole })[]> {
    const memberships = await this.memberships
      .find({
        user: new Types.ObjectId(userId),
        status: MembershipStatus.Active,
      })
      .lean<MembershipDocument[]>()
      .exec();
    const orgIds = memberships.map((m) => m.organization);
    const orgs = await this.orgs
      .find({ _id: { $in: orgIds } })
      .lean<OrganizationDocument[]>()
      .exec();
    const roleByOrg = new Map(
      memberships.map((m) => [String(m.organization), m.orgRole]),
    );
    return orgs.map((o) => ({
      ...this.toView(o),
      orgRole: roleByOrg.get(String(o._id)) ?? OrgRole.Student,
    }));
  }

  async getById(id: string): Promise<OrganizationDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('Organization not found');
    const org = await this.orgs.findById(id);
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(
    id: string,
    patch: {
      name?: string;
      description?: string;
      type?: OrgType;
      branding?: Partial<OrgView['branding']>;
    },
  ): Promise<OrganizationDocument> {
    const org = await this.getById(id);
    if (patch.name) org.name = patch.name.trim();
    if (patch.description !== undefined) org.description = patch.description;
    if (patch.type) org.type = patch.type;
    if (patch.branding) {
      org.branding.logoUrl = patch.branding.logoUrl ?? org.branding.logoUrl;
      org.branding.primaryColor =
        patch.branding.primaryColor ?? org.branding.primaryColor;
      org.branding.tagline = patch.branding.tagline ?? org.branding.tagline;
    }
    await org.save();
    return org;
  }

  async recountMembers(orgId: string): Promise<void> {
    const count = await this.memberships.countDocuments({
      organization: new Types.ObjectId(orgId),
      status: MembershipStatus.Active,
    });
    await this.orgs.updateOne({ _id: orgId }, { memberCount: count }).exec();
  }

  toView(o: OrganizationDocument): OrgView {
    return {
      id: String(o._id),
      name: o.name,
      slug: o.slug,
      type: o.type,
      description: o.description,
      plan: o.plan,
      status: o.status,
      memberCount: o.memberCount,
      branding: {
        logoUrl: o.branding?.logoUrl,
        primaryColor: o.branding?.primaryColor ?? '#16a34a',
        tagline: o.branding?.tagline ?? '',
      },
      createdAt:
        (
          o as OrganizationDocument & { createdAt?: Date }
        ).createdAt?.toISOString() ?? '',
    };
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'org';
    let slug = base;
    let n = 1;
    while (await this.orgs.exists({ slug })) slug = `${base}-${++n}`;
    return slug;
  }
}
