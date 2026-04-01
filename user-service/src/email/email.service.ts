import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null = null;
  private readonly smtpTransport: nodemailer.Transporter | null = null;
  private readonly from: string;

  constructor(private readonly cfg: ConfigService) {
    const apiKey = this.cfg.get<string>('RESEND_API_KEY', 'placeholder');
    this.from = this.cfg.get<string>('EMAIL_FROM', 'noreply@craftea.local');

    if (apiKey && apiKey !== 'placeholder') {
      this.resend = new Resend(apiKey);
    } else {
      // Dev fallback: use SMTP (Mailhog or similar)
      const smtpHost = this.cfg.get<string>('SMTP_HOST');
      const smtpPort = this.cfg.get<number>('SMTP_PORT', 1025);
      if (smtpHost) {
        this.smtpTransport = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: false,
          ignoreTLS: true,
        });
        this.logger.log(`Email: using SMTP fallback → ${smtpHost}:${smtpPort}`);
      }
    }
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (this.resend) {
      try {
        await this.resend.emails.send({ from: this.from, to, subject, html });
      } catch (err) {
        this.logger.error(
          `Failed to send email to ${to}: ${(err as Error).message}`,
        );
      }
      return;
    }

    if (this.smtpTransport) {
      try {
        await this.smtpTransport.sendMail({ from: this.from, to, subject, html });
      } catch (err) {
        this.logger.error(
          `Failed to send SMTP email to ${to}: ${(err as Error).message}`,
        );
      }
      return;
    }

    // Last resort: console log
    this.logger.log(`[EMAIL DEV] To: ${to} | Subject: ${subject}`);
  }
}
