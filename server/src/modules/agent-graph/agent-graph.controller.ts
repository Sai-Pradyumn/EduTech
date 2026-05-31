import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/interfaces';
import { GraphExecutorService } from './graph-executor.service';

class RunGraphDto {
  @IsString() @MinLength(1) @MaxLength(80) graph!: string;
  @IsString() @MinLength(2) @MaxLength(200) input!: string;
}

/** Agent-graph surface (Phase 3 · A9). Gated by ENABLE_LANGGRAPH in the service. */
@Controller('agent-graph')
export class AgentGraphController {
  constructor(private readonly executor: GraphExecutorService) {}

  @Get('status')
  status() {
    return this.executor.status();
  }

  @Get('graphs')
  graphs() {
    return this.executor.listGraphs();
  }

  @Get('runs')
  runs(@CurrentUser() user: AuthUser) {
    return this.executor.list(user.id);
  }

  @Post('runs')
  @HttpCode(HttpStatus.CREATED)
  run(@CurrentUser() user: AuthUser, @Body() dto: RunGraphDto) {
    return this.executor.run(user.id, user.role, dto.graph, dto.input);
  }

  @Get('runs/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.executor.get(user.id, id);
  }
}
