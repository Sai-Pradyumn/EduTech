import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { StudentProfileService } from './student-profile.service';
import { CreateStudentProfileDto } from './dto/create-student-profile.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { StudentProfileResponse, toStudentProfileResponse } from './dto/student-profile-response.dto';

@Controller('student-profile')
export class StudentProfileController {
  constructor(private readonly profiles: StudentProfileService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser): Promise<StudentProfileResponse | null> {
    const profile = await this.profiles.findByUser(user.id);
    return profile ? toStudentProfileResponse(profile) : null;
  }

  @Get('onboarding-status')
  onboardingStatus(@CurrentUser() user: AuthUser): Promise<{ onboardingCompleted: boolean }> {
    return this.profiles.getOnboardingStatus(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateStudentProfileDto,
  ): Promise<StudentProfileResponse> {
    const profile = await this.profiles.create(user.id, dto);
    return toStudentProfileResponse(profile);
  }

  @Patch('me')
  async update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateStudentProfileDto,
  ): Promise<StudentProfileResponse> {
    const profile = await this.profiles.update(user.id, dto);
    return toStudentProfileResponse(profile);
  }
}
