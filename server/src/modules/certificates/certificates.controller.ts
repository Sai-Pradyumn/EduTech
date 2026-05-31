import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Permission } from '../../common/enums';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/interfaces';
import { OrgContext } from '../tenancy/rbac.types';
import { CertificatesService } from './services/certificates.service';
import { IssueCertificateDto } from './dto/certificate.dto';

/** Certificates & credentials (Phase 4 · B7). Issue is gated by CertificateIssue; verify is public. */
@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certs: CertificatesService) {}

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.certs.listMine(user.id);
  }

  @Public()
  @Get('verify/:vid')
  verify(@Param('vid') vid: string) {
    return this.certs.verify(vid);
  }

  @Post('issue')
  @Permissions(Permission.CertificateIssue)
  issue(
    @CurrentUser() user: AuthUser,
    @CurrentOrg() ctx: OrgContext,
    @Body() dto: IssueCertificateDto,
  ) {
    return this.certs.issue(user.id, {
      ...dto,
      organizationId: ctx.organizationId,
    });
  }

  @Post(':id/revoke')
  @Permissions(Permission.CertificateIssue)
  revoke(@Param('id') id: string) {
    return this.certs.revoke(id);
  }
}
