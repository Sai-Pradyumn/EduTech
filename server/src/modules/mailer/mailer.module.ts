import { Global, Module } from '@nestjs/common';
import { MailerService } from './mailer.service';

/** Email delivery (SMTP/nodemailer). Global so any module can inject MailerService. */
@Global()
@Module({
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}
