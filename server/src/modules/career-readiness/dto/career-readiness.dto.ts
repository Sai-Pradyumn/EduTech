import { IsIn, IsString } from 'class-validator';
import { CAREER_ROLES } from '../career-roles';

export class SetTargetRoleDto {
  @IsString()
  @IsIn(CAREER_ROLES.map((r) => r.id))
  roleId!: string;
}
