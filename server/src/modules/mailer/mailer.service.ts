import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Email delivery via SMTP (nodemailer). Activates when SMTP_HOST + SMTP_USER + SMTP_PASS are
 * set; otherwise it's a dev-safe no-op that logs the message (so OTP flows work locally
 * without a mail server). Configure SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM.
 */
@Injectable()
export class MailerService {
  private readonly log = new Logger(MailerService.name);
  private readonly transport?: nodemailer.Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    const port = parseInt(config.get<string>('SMTP_PORT') ?? '587', 10);
    this.from =
      config.get<string>('SMTP_FROM') ?? user ?? 'Asta <no-reply@asta.dev>';

    if (host && user && pass) {
      this.transport = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.log.log(`SMTP mailer configured (${host}:${port})`);
    } else {
      this.log.warn(
        'SMTP not configured — emails will be logged to the console only.',
      );
    }
  }

  get live(): boolean {
    return !!this.transport;
  }

  async send(
    to: string,
    subject: string,
    html: string,
    text?: string,
  ): Promise<void> {
    if (!this.transport) {
      this.log.warn(
        `[email:dev] to=${to} subject="${subject}"\n${text ?? html}`,
      );
      return;
    }
    await this.transport.sendMail({ from: this.from, to, subject, html, text });
  }

  /** Send a one-time signup code. Falls back to a console log when SMTP is unset. */
  async sendOtp(to: string, code: string, ttlMinutes: number): Promise<void> {
    const subject = 'Your Asta verification code';
    const text = `Your Asta verification code is ${code}. It expires in ${ttlMinutes} minutes.`;
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:440px;margin:0 auto">
        <h2 style="color:#111">Verify your email</h2>
        <p style="color:#444">Enter this code to finish creating your Asta account:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0a7d33">${code}</p>
        <p style="color:#888;font-size:13px">This code expires in ${ttlMinutes} minutes. If you didn't request it, ignore this email.</p>
      </div>`;
    if (!this.transport) {
      this.log.warn(`[OTP for ${to}] ${code} (expires in ${ttlMinutes}m)`);
      return;
    }
    await this.send(to, subject, html, text);
  }
}
