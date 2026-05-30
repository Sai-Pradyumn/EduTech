import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Public } from './common/decorators/public.decorator';

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

/** Health + observability (Phase 4 · B11). Liveness + a detailed readiness probe. */
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  @Public()
  @Get()
  check() {
    return { status: 'ok', service: 'asta-api', time: new Date().toISOString() };
  }

  /** Readiness probe: process + dependency health for monitors / admin platform-health. */
  @Public()
  @Get('detailed')
  detailed() {
    const db = DB_STATES[this.conn.readyState] ?? 'unknown';
    const mem = process.memoryUsage();
    return {
      status: db === 'connected' ? 'ok' : 'degraded',
      service: 'asta-api',
      uptimeSec: Math.round(process.uptime()),
      checks: {
        db: { status: db === 'connected' ? 'up' : 'down', state: db },
        process: { status: 'up', rssMb: Math.round(mem.rss / 1048576), heapUsedMb: Math.round(mem.heapUsed / 1048576) },
      },
      node: process.version,
      time: new Date().toISOString(),
    };
  }
}
