import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { Session, SessionSchema } from './schemas/session.schema';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

/** Sessions / device management (Phase 10 · M6). Global so the auth flow can record a
 *  session on login without a circular dependency. */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
    UsersModule,
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
