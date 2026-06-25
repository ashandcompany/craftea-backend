import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { AppModule } from './app.module.js';

/** Charge les Docker secrets dans process.env si les fichiers existent. */
function loadSecrets() {
  const secrets = [
    {
      envKey: 'STRIPE_SECRET_KEY',
      fileKey: 'STRIPE_SECRET_KEY_FILE',
      fallbackPath: '/run/secrets/stripe_secret_key_v2',
    },
    {
      envKey: 'STRIPE_WEBHOOK_SECRET',
      fileKey: 'STRIPE_WEBHOOK_SECRET_FILE',
      fallbackPath: '/run/secrets/stripe_webhook_secret_v2',
    },
  ];

  for (const { envKey, fileKey, fallbackPath } of secrets) {
    const filePath = process.env[fileKey] ?? fallbackPath;
    if (!process.env[envKey] && existsSync(filePath)) {
      process.env[envKey] = readFileSync(filePath, 'utf8').trim();
    }
  }
}

async function bootstrap() {
  loadSecrets();
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT ?? 3007;
  await app.listen(port);
  console.log(`[payment-service] running on port ${port}`);
}
void bootstrap();
