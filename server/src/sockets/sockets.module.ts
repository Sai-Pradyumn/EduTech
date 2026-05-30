import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AgentsModule } from '../modules/agents/agents.module';
import { EventsGateway } from './events.gateway';

@Module({
  imports: [JwtModule.register({}), AgentsModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class SocketsModule {}
