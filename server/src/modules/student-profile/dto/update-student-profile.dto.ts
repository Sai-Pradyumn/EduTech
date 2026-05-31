import { PartialType } from '@nestjs/swagger';
import { CreateStudentProfileDto } from './create-student-profile.dto';

/** All onboarding fields, all optional — for PATCH /student-profile/me. */
export class UpdateStudentProfileDto extends PartialType(
  CreateStudentProfileDto,
) {}
