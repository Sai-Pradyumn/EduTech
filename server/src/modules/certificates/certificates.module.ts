import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { Certificate, CertificateSchema } from './schemas/certificate.schema';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './services/certificates.service';

/** Certificates & credentials (Phase 4 · B7): issue → publicly verifiable credentials. */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Certificate.name, schema: CertificateSchema },
    ]),
    UsersModule,
  ],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
