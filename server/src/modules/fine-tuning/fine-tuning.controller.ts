import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { FineTuningService } from './fine-tuning.service';

class CreateJobDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(60) baseModel?: string;
  @IsOptional() @IsString() @MaxLength(80) datasetName?: string;
  @IsOptional() @IsInt() @Min(10) @Max(100000) datasetSize?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10) epochs?: number;
}

/** Fine-Tuning Lab surface (Phase 3 · A8). Role.Admin; gated by ENABLE_FINE_TUNING. */
@Controller('fine-tuning')
@Roles(Role.Admin)
export class FineTuningController {
  constructor(private readonly fineTuning: FineTuningService) {}

  @Get('status')
  status() {
    return this.fineTuning.status();
  }

  @Get('jobs')
  list(@CurrentUser() user: AuthUser) {
    return this.fineTuning.list(user.id);
  }

  @Post('jobs')
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateJobDto) {
    return this.fineTuning.create(user.id, dto);
  }

  @Get('jobs/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fineTuning.get(user.id, id);
  }

  @Post('jobs/:id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fineTuning.cancel(user.id, id);
  }
}
