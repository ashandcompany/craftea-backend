jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { connect } from 'amqplib';
import { OrderEventsPublisher } from './order-events.publisher';

const mockConnect = connect as jest.MockedFunction<typeof connect>;

describe('OrderEventsPublisher', () => {
  let publisher: OrderEventsPublisher;

  const mockChannel = {
    assertQueue: jest.fn().mockResolvedValue(undefined),
    sendToQueue: jest.fn().mockReturnValue(true),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const mockConnection = {
    createChannel: jest.fn().mockResolvedValue(mockChannel),
    close: jest.fn().mockResolvedValue(undefined),
  };

  const buildModule = async (): Promise<TestingModule> =>
    Test.createTestingModule({
      providers: [
        OrderEventsPublisher,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((_key: string, defaultValue: string) => defaultValue),
          },
        },
      ],
    }).compile();

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(mockConnection as any);

    const module = await buildModule();
    publisher = module.get<OrderEventsPublisher>(OrderEventsPublisher);
    await publisher.onModuleInit();
  });

  describe('onModuleInit', () => {
    it('should connect to RabbitMQ and set up channel', () => {
      expect(mockConnect).toHaveBeenCalled();
      expect(mockConnection.createChannel).toHaveBeenCalled();
      expect(mockChannel.assertQueue).toHaveBeenCalledWith('notifications', {
        durable: true,
      });
    });
  });

  describe('onModuleDestroy', () => {
    it('should close channel and connection', async () => {
      await publisher.onModuleDestroy();

      expect(mockChannel.close).toHaveBeenCalled();
      expect(mockConnection.close).toHaveBeenCalled();
    });

    it('should handle close errors gracefully', async () => {
      mockChannel.close.mockRejectedValueOnce(new Error('Close failed'));

      await expect(publisher.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('publish', () => {
    it('should send serialized message to the notifications queue', async () => {
      const data = { orderNumber: '1', buyerEmail: 'a@b.com' };

      await publisher.publish('order.confirmed', data);

      expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
        'notifications',
        expect.any(Buffer),
        { persistent: true, contentType: 'application/json' },
      );

      const [, bufArg] = mockChannel.sendToQueue.mock.calls[0];
      const parsed = JSON.parse((bufArg as Buffer).toString());
      expect(parsed).toEqual({ pattern: 'order.confirmed', data });
    });

    it('should handle sendToQueue errors gracefully', async () => {
      mockChannel.sendToQueue.mockImplementationOnce(() => {
        throw new Error('Queue error');
      });

      await expect(
        publisher.publish('order.confirmed', { key: 'value' }),
      ).resolves.not.toThrow();
    });
  });

  describe('publish without channel', () => {
    it('should log warn and return early when channel is null', async () => {
      // Create publisher without calling onModuleInit (channel stays null)
      mockConnect.mockRejectedValue(new Error('Connection refused'));
      const module = await buildModule();
      const freshPublisher = module.get<OrderEventsPublisher>(OrderEventsPublisher);
      // onModuleInit NOT called → channel is null

      await expect(
        freshPublisher.publish('order.confirmed', { key: 'value' }),
      ).resolves.not.toThrow();

      expect(mockChannel.sendToQueue).not.toHaveBeenCalled();
    });
  });

  describe('connect with retries', () => {
    afterEach(() => jest.useRealTimers());

    it('should log error when all connection attempts fail', async () => {
      // Build module before enabling fake timers to avoid NestJS timing issues
      const module = await buildModule();
      const freshPublisher = module.get<OrderEventsPublisher>(OrderEventsPublisher);

      jest.useFakeTimers();
      mockConnect.mockRejectedValue(new Error('Connection refused'));

      const initPromise = freshPublisher.onModuleInit();
      // runAllTimersAsync advances all pending fake timers including retries
      await jest.runAllTimersAsync();
      await initPromise;

      jest.useRealTimers();

      // Channel is still null after all retries failed → publish logs warn, no queue call
      await freshPublisher.publish('test.event', {});
      expect(mockChannel.sendToQueue).not.toHaveBeenCalled();
    }, 15000);
  });
});
