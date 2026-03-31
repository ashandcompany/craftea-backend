import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null = null;
  private readonly from: string;

  constructor(private readonly cfg: ConfigService) {
    const apiKey = this.cfg.get<string>('RESEND_API_KEY', 'placeholder');
    this.from = this.cfg.get<string>('EMAIL_FROM', 'noreply@localhost');

    if (apiKey && apiKey !== 'placeholder') {
      this.resend = new Resend(apiKey);
    }
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.resend) {
      this.logger.log(`[EMAIL DEV] To: ${to} Subject: ${subject}`);
      return;
    }

    try {
      await this.resend.emails.send({ from: this.from, to, subject, html });
    } catch (err) {
      this.logger.error(
        `Failed to send email to ${to}: ${(err as Error).message}`,
      );
    }
  }
}
