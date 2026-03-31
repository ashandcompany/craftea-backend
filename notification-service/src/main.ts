import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NotificationModule } from './notification.module.js';

async function bootstrap() {
  const app = await NestFactory.create(NotificationModule);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL ?? 'amqp://rabbitmq:5672'],
      queue: 'notifications',
      queueOptions: { durable: true },
      noAck: false,
      prefetchCount: 1,
    },
  });

  await app.startAllMicroservices();

  const port = process.env.PORT ?? 3008;
  await app.listen(port);
  console.log(`[notification-service] running on port ${port}`);
}

void bootstrap();
