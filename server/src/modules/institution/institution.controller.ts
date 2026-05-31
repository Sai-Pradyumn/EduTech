import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthUser } from '../../common/interfaces';
import { InstitutionService } from './institution.service';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

class AssignDto {
  @IsIn(['flow', 'template']) kind!: 'flow' | 'template';
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
}

/** Institution analytics — admin/mentor only, scoped to their own org. */
@Controller('institution')
@Roles(Role.Admin, Role.Mentor)
export class InstitutionController {
  constructor(private readonly institution: InstitutionService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.institution.overview(user.id);
  }

  @Get('cohorts/:id/outcomes')
  cohortOutcomes(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.institution.cohortOutcomes(user.id, id);
  }

  @Post('cohorts/:id/assign-flow')
  assignFlow(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssignDto) {
    return this.institution.assign(user.id, id, 'flow', dto.title);
  }

  @Post('cohorts/:id/assign-template')
  assignTemplate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssignDto) {
    return this.institution.assign(user.id, id, 'template', dto.title);
  }

  @Get('reports/outcomes')
  reportsOutcomes(@CurrentUser() user: AuthUser) {
    return this.institution.overview(user.id);
  }

  @Get('reports/readiness')
  reportsReadiness(@CurrentUser() user: AuthUser) {
    return this.institution.overview(user.id);
  }
}
