import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentEventsPublisher } from './payment-events.publisher';

const mockChannel = {
  assertQueue: jest.fn().mockResolvedValue(undefined),
  sendToQueue: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockConnection = {
  createChannel: jest.fn().mockResolvedValue(mockChannel),
  close: jest.fn().mockResolvedValue(undefined),
};

jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

import { connect as amqplibConnect } from 'amqplib';
const mockConnect = amqplibConnect as jest.MockedFunction<
  typeof amqplibConnect
>;

describe('PaymentEventsPublisher', () => {
  let publisher: PaymentEventsPublisher;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConnection.createChannel.mockResolvedValue(mockChannel);
    mockChannel.assertQueue.mockResolvedValue(undefined);
    mockChannel.close.mockResolvedValue(undefined);
    mockConnection.close.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentEventsPublisher,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (_key: string, defaultValue?: string) => defaultValue ?? '',
            ),
          },
        },
      ],
    }).compile();

    publisher = module.get<PaymentEventsPublisher>(PaymentEventsPublisher);
  });

  describe('onModuleInit / connect', () => {
    it('should connect to RabbitMQ and assert the notifications queue', async () => {
      mockConnect.mockResolvedValue(mockConnection as any);

      await publisher.onModuleInit();

      expect(mockConnect).toHaveBeenCalled();
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('notifications', {
        durable: true,
      });
    });

    it('should log error after all retries fail without throwing', async () => {
      jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
        fn();
        return null as any;
      });
      mockConnect.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(publisher.onModuleInit()).resolves.toBeUndefined();

      expect(mockConnect).toHaveBeenCalledTimes(5);
      jest.restoreAllMocks();
    });
  });

  describe('onModuleDestroy', () => {
    it('should close channel and connection gracefully', async () => {
      mockConnect.mockResolvedValue(mockConnection as any);
      await publisher.onModuleInit();

      await publisher.onModuleDestroy();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
    });

    it('should not throw when channel/connection close fails', async () => {
      mockChannel.close.mockRejectedValue(new Error('already closed'));
      (publisher as any).channel = mockChannel;

      await expect(publisher.onModuleDestroy()).resolves.toBeUndefined();
    });
  });

  describe('publish', () => {
    beforeEach(async () => {
      mockConnect.mockResolvedValue(mockConnection as any);
      await publisher.onModuleInit();
    });

    it('should send serialized message to notifications queue', async () => {
      await publisher.publish('payout.succeeded', {
        artistEmail: 'a@b.com',
        amount: 5000,
      });

      expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
        'notifications',
        expect.any(Buffer),
        { persistent: true, contentType: 'application/json' },
      );

      const [, buffer] = mockChannel.sendToQueue.mock.calls[0];
      const parsed = JSON.parse(buffer.toString());
      expect(parsed).toEqual({
        pattern: 'payout.succeeded',
        data: { artistEmail: 'a@b.com', amount: 5000 },
      });
    });

    it('should log warning and return early when channel is not available', async () => {
      (publisher as any).channel = null;

      await expect(
        publisher.publish('payout.succeeded', {}),
      ).resolves.toBeUndefined();

      expect(mockChannel.sendToQueue).not.toHaveBeenCalled();
    });

    it('should log error when sendToQueue throws', async () => {
      mockChannel.sendToQueue.mockImplementation(() => {
        throw new Error('queue full');
      });

      await expect(
        publisher.publish('payout.failed', {}),
      ).resolves.toBeUndefined();
    });
  });
});
