import { BadRequestException, Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { Permission } from '../../common/enums';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { OrgContext } from '../tenancy/rbac.types';
import { ReportsService } from './services/reports.service';

/**
 * Enterprise reports surface (Phase 4 · B16). All routes require ReportsView (org admins).
 * `*.csv` variants stream raw CSV via @Res (bypassing the JSON envelope) for download.
 */
@Controller('reports')
@Permissions(Permission.ReportsView)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('students')
  students(@CurrentOrg() ctx: OrgContext) {
    return this.reports.studentOutcomes(this.orgOrThrow(ctx));
  }

  @Get('students.csv')
  async studentsCsv(@CurrentOrg() ctx: OrgContext, @Res() res: Response) {
    const report = await this.reports.studentOutcomes(this.orgOrThrow(ctx));
    this.sendCsv(res, 'student-outcomes.csv', this.reports.studentsCsv(report));
  }

  @Get('weak-topics')
  weakTopics(@CurrentOrg() ctx: OrgContext) {
    return this.reports.weakTopics(this.orgOrThrow(ctx));
  }

  @Get('weak-topics.csv')
  async weakTopicsCsv(@CurrentOrg() ctx: OrgContext, @Res() res: Response) {
    const rows = await this.reports.weakTopics(this.orgOrThrow(ctx));
    this.sendCsv(res, 'weak-topics.csv', this.reports.weakTopicsCsv(rows));
  }

  @Get('ai-usage')
  aiUsage() {
    return this.reports.aiUsage();
  }

  @Get('ai-usage.csv')
  async aiUsageCsv(@Res() res: Response) {
    const report = await this.reports.aiUsage();
    this.sendCsv(res, 'ai-usage.csv', this.reports.aiUsageCsv(report));
  }

  private orgOrThrow(ctx: OrgContext): string {
    if (!ctx.organizationId)
      throw new BadRequestException('Select an organization (x-org-id) first.');
    return ctx.organizationId;
  }

  private sendCsv(res: Response, filename: string, csv: string): void {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
