import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, type ChannelModel, type Channel } from 'amqplib';

export const EXCHANGE_NAME = 'catalog.events';

export enum ProductEvent {
  CREATED = 'product.created',
  UPDATED = 'product.updated',
  DELETED = 'product.deleted',
}

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly cfg: ConfigService) {}

  async onModuleInit() {
    await this.connectToBroker();
  }

  async onModuleDestroy() {
    await this.close();
  }

  private async connectToBroker(retries = 5): Promise<void> {
    const url = this.cfg.get<string>(
      'RABBITMQ_URL',
      'amqp://craftea:craftea_pass@localhost:5672',
    );

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.connection = await connect(url);
        this.channel = await this.connection.createChannel();

        // Declare a topic exchange so consumers can bind with routing keys
        await this.channel.assertExchange(EXCHANGE_NAME, 'topic', {
          durable: true,
        });

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
    this.logger.error('Could not connect to RabbitMQ after retries');
  }

  /**
   * Publish a message to the catalog exchange with a routing key.
   */
  async publish(routingKey: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.channel) {
      this.logger.warn('RabbitMQ channel not available, message dropped');
      return;
    }

    const message = Buffer.from(JSON.stringify(payload));
    this.channel.publish(EXCHANGE_NAME, routingKey, message, {
      persistent: true,
      contentType: 'application/json',
      timestamp: Date.now(),
    });

    this.logger.debug(`Published [${routingKey}]: ${JSON.stringify(payload)}`);
  }

  private async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
      this.logger.log('RabbitMQ connection closed');
    } catch (err) {
      this.logger.error(`Error closing RabbitMQ: ${(err as Error).message}`);
    }
  }
}
