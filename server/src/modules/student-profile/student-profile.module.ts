import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import {
  StudentProfile,
  StudentProfileSchema,
} from './schemas/student-profile.schema';
import { StudentProfileController } from './student-profile.controller';
import { StudentProfileService } from './student-profile.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StudentProfile.name, schema: StudentProfileSchema },
    ]),
    UsersModule,
  ],
  controllers: [StudentProfileController],
  providers: [StudentProfileService],
  exports: [StudentProfileService],
})
export class StudentProfileModule {}
