import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, type ChannelModel, type Channel } from 'amqplib';

const NOTIFICATIONS_QUEUE = 'notifications';

@Injectable()
export class MessagingEventsPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagingEventsPublisher.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly cfg: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // ignore on shutdown
    }
  }

  private async connect(retries = 5): Promise<void> {
    const url = this.cfg.get<string>(
      'RABBITMQ_URL',
      'amqp://craftea:craftea_pass@rabbitmq:5672',
    );

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.connection = await connect(url);
        this.channel = await this.connection.createChannel();
        await this.channel.assertQueue(NOTIFICATIONS_QUEUE, { durable: true });
        this.logger.log('Connected to RabbitMQ');
        return;
      } catch (err) {
        this.logger.warn(
          `RabbitMQ connection attempt ${attempt}/${retries} failed: ${(err as Error).message}`,
        );
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }
    this.logger.error('Could not connect to RabbitMQ after retries — email notifications disabled');
  }

  async publish(pattern: string, data: Record<string, unknown>): Promise<void> {
    if (!this.channel) {
      this.logger.warn(`RabbitMQ not available, dropping [${pattern}]`);
      return;
    }
    try {
      const message = Buffer.from(JSON.stringify({ pattern, data }));
      this.channel.sendToQueue(NOTIFICATIONS_QUEUE, message, {
        persistent: true,
        contentType: 'application/json',
      });
    } catch (err) {
      this.logger.error(`Failed to publish [${pattern}]: ${(err as Error).message}`);
    }
  }
}
