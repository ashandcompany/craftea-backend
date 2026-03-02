import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { AppModule } from './app.module.js';

/** Charge les Docker secrets dans process.env si les fichiers existent. */
function loadSecrets() {
  const secrets: Record<string, string> = {
    SQUARE_ACCESS_TOKEN: '/run/secrets/square_access_token',
    SQUARE_LOCATION_ID: '/run/secrets/square_location_id',
  };

  for (const [envKey, filePath] of Object.entries(secrets)) {
    if (!process.env[envKey] && existsSync(filePath)) {
      process.env[envKey] = readFileSync(filePath, 'utf8').trim();
    }
  }
}

async function bootstrap() {
  loadSecrets();
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const port = process.env.PORT ?? 3007;
  await app.listen(port);
  console.log(`[payment-service] running on port ${port}`);
}
void bootstrap();
