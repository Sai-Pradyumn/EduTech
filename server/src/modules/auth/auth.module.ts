import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { OtpService } from './otp.service';
import { MfaService } from './mfa.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { EmailOtp, EmailOtpSchema } from './schemas/email-otp.schema';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: EmailOtp.name, schema: EmailOtpSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleAuthService,
    OtpService,
    MfaService,
    JwtStrategy,
  ],
  exports: [AuthService, MfaService],
})
export class AuthModule {}
