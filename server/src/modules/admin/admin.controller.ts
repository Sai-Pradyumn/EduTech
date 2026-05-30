import { Controller, Get } from '@nestjs/common';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';

/**
 * Admin Command Center surface (Phase 3 · A7). Role.Admin only — platform-operator
 * AI analytics + student roster for the legacy `/admin` shell.
 */
@Controller('admin')
@Roles(Role.Admin)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('analytics')
  analytics() {
    return this.admin.analytics();
  }

  @Get('students')
  students() {
    return this.admin.students();
  }

  @Get('documents')
  documents() {
    return this.admin.documentsBrowse();
  }

  @Get('roadmaps')
  roadmaps() {
    return this.admin.roadmapsBrowse();
  }

  @Get('assessments')
  assessments() {
    return this.admin.quizzesBrowse();
  }
}
