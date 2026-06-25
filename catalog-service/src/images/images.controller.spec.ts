import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PassThrough } from 'stream';
import { ImagesController } from './images.controller';
import { MinioService } from '../minio/minio.service';
import { RedisService } from '../redis/redis.service';

describe('ImagesController', () => {
  let controller: ImagesController;
  let minio: jest.Mocked<Pick<MinioService, 'statObject' | 'getObjectStream'>>;
  let redis: jest.Mocked<Pick<RedisService, 'getImageCache' | 'setImageCache'>>;

  const mockRes = () => ({
    set: jest.fn(),
    send: jest.fn().mockReturnThis(),
  });

  beforeEach(async () => {
    minio = {
      statObject: jest.fn(),
      getObjectStream: jest.fn(),
    };
    redis = {
      getImageCache: jest.fn(),
      setImageCache: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImagesController],
      providers: [
        { provide: MinioService, useValue: minio },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    controller = module.get<ImagesController>(ImagesController);
  });

  describe('serve', () => {
    it('should serve image from Redis cache when available', async () => {
      const res = mockRes();
      const cached = {
        buffer: Buffer.from('imgdata'),
        contentType: 'image/jpeg',
      };
      redis.getImageCache.mockResolvedValue(cached as any);

      await controller.serve('test.jpg', res as any);

      expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(res.set).toHaveBeenCalledWith('X-Cache', 'HIT');
      expect(res.send).toHaveBeenCalledWith(cached.buffer);
      expect(minio.statObject).not.toHaveBeenCalled();
    });

    it('should fetch from MinIO on cache miss and cache the result', async () => {
      const res = mockRes();
      redis.getImageCache.mockResolvedValue(null);
      minio.statObject.mockResolvedValue({
        metaData: { 'content-type': 'image/png' },
      } as any);

      const stream = new PassThrough();
      minio.getObjectStream.mockResolvedValue(stream as any);

      const servePromise = controller.serve('test.png', res as any);

      stream.push(Buffer.from('imagedata'));
      stream.end();

      await servePromise;

      expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(res.set).toHaveBeenCalledWith('X-Cache', 'MISS');
      expect(redis.setImageCache).toHaveBeenCalled();
    });

    it('should use application/octet-stream when no content-type in meta', async () => {
      const res = mockRes();
      redis.getImageCache.mockResolvedValue(null);
      minio.statObject.mockResolvedValue({ metaData: {} } as any);

      const stream = new PassThrough();
      minio.getObjectStream.mockResolvedValue(stream as any);

      const servePromise = controller.serve('file.bin', res as any);
      stream.end();

      await servePromise;

      expect(res.set).toHaveBeenCalledWith(
        'Content-Type',
        'application/octet-stream',
      );
    });

    it('should throw NotFoundException when object not found in MinIO', async () => {
      const res = mockRes();
      redis.getImageCache.mockResolvedValue(null);
      minio.statObject.mockRejectedValue({ code: 'NotFound' });

      await expect(
        controller.serve('notfound.jpg', res as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should rethrow unexpected MinIO errors', async () => {
      const res = mockRes();
      redis.getImageCache.mockResolvedValue(null);
      minio.statObject.mockRejectedValue(new Error('Connection refused'));

      await expect(controller.serve('test.jpg', res as any)).rejects.toThrow(
        'Connection refused',
      );
    });
  });
});
