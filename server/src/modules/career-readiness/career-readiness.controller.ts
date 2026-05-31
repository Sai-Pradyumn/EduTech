import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { CareerReadinessService } from './career-readiness.service';
import { SetTargetRoleDto } from './dto/career-readiness.dto';
import { findRole } from './career-roles';

@Controller('career-readiness')
export class CareerReadinessController {
  constructor(private readonly readiness: CareerReadinessService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.readiness.getMe(user.id);
  }

  @Post('analyze')
  analyze(@CurrentUser() user: AuthUser) {
    return this.readiness.analyze(user.id);
  }

  @Get('roles')
  roles() {
    return this.readiness.listRoles();
  }

  @Get('roles/:id')
  role(@Param('id') id: string) {
    const r = findRole(id);
    if (!r) throw new NotFoundException('Unknown role');
    return r;
  }

  @Post('set-target-role')
  setTargetRole(@CurrentUser() user: AuthUser, @Body() dto: SetTargetRoleDto) {
    return this.readiness.setTargetRole(user.id, dto.roleId);
  }

  @Post('generate-gap-plan')
  async gapPlan(@CurrentUser() user: AuthUser) {
    const a = await this.readiness.analyze(user.id);
    return { blockers: a.blockers, weekPlan: a.weekPlan, recommendations: a.recommendations };
  }
}
