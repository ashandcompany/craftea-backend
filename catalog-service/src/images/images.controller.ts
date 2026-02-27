import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { MinioService } from '../minio/minio.service.js';
import { RedisService } from '../redis/redis.service.js';

@Controller('images')
export class ImagesController {
  private readonly logger = new Logger(ImagesController.name);

  constructor(
    private readonly minio: MinioService,
    private readonly redis: RedisService,
  ) {}

  @Get(':objectName')
  async serve(
    @Param('objectName') objectName: string,
    @Res() res: Response,
  ) {
    const cacheKey = `img:${objectName}`;

    // 1. Try Redis cache
    const cached = await this.redis.getImageCache(cacheKey);
    if (cached) {
      res.set('Content-Type', cached.contentType);
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('X-Cache', 'HIT');
      return res.send(cached.buffer);
    }

    // 2. Fetch from MinIO
    try {
      const stat = await this.minio.statObject(objectName);
      const contentType = (stat.metaData as Record<string, string>)['content-type'] || 'application/octet-stream';

      const stream = await this.minio.getObjectStream(objectName);
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve());
        stream.on('error', (err: Error) => reject(err));
      });

      const buffer = Buffer.concat(chunks);

      // 3. Store in Redis (fire-and-forget)
      this.redis.setImageCache(cacheKey, buffer, contentType).catch((err) =>
        this.logger.error(`setImageCache error: ${err.message}`),
      );

      // 4. Respond
      res.set('Content-Type', contentType);
      res.set('Content-Length', String(buffer.length));
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('X-Cache', 'MISS');
      return res.send(buffer);
    } catch (err: any) {
      if (err?.code === 'NotFound' || err?.code === 'NoSuchKey') {
        throw new NotFoundException('Image introuvable');
      }
      throw err;
    }
  }
}
