import { Controller, Get, Header } from '@nestjs/common';
import { resetPasswordTemplate } from './email/templates/reset-password.template.js';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'user-service' };
  }

  @Get('users/templates/reset-password')
  @Header('Content-Type', 'text/html; charset=utf-8')
  resetPasswordPreview(): string {
    return resetPasswordTemplate({
      resetUrl: 'http://localhost:3000/reset-password?token=preview-token-abc123',
    });
  }
}
