import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { Organization, OrganizationSchema } from './schemas/organization.schema';
import { Membership, MembershipSchema } from './schemas/membership.schema';
import { OrganizationsController } from './organizations.controller';
import { PlatformController } from './platform.controller';
import { OrganizationsService } from './services/organizations.service';
import { MembershipService } from './services/membership.service';
import { TenantService } from './services/tenant.service';

/**
 * Multi-tenant SaaS spine (Phase 4 · B1): organizations, memberships and the RBAC engine.
 * Exports TenantService so the global PermissionsGuard can resolve effective permissions,
 * and MembershipService/OrganizationsService for downstream org-scoped features.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
      { name: Membership.name, schema: MembershipSchema },
    ]),
    UsersModule,
  ],
  controllers: [OrganizationsController, PlatformController],
  providers: [OrganizationsService, MembershipService, TenantService],
  exports: [TenantService, MembershipService, OrganizationsService],
})
export class TenancyModule {}
