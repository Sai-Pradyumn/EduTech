import { IsEmail, IsEnum, IsHexColor, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { OrgRole, OrgType } from '../../../common/enums';

export class CreateOrgDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsEnum(OrgType)
  type?: OrgType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateOrgDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(OrgType)
  type?: OrgType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tagline?: string;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;
}

/** Org roles an admin may assign (platform roles are not assignable via this API). */
const ASSIGNABLE_ROLES = [OrgRole.OrgAdmin, OrgRole.Mentor, OrgRole.Instructor, OrgRole.Student, OrgRole.Guest];

export class AddMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(OrgRole)
  @IsIn(ASSIGNABLE_ROLES)
  orgRole!: OrgRole;
}

export class UpdateMemberRoleDto {
  @IsEnum(OrgRole)
  @IsIn(ASSIGNABLE_ROLES)
  orgRole!: OrgRole;
}
