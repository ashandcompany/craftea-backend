import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private readonly cacheTtl: number;
  private readonly imageCacheTtl: number;

  constructor(private cfg: ConfigService) {
    this.client = new Redis({
      host: this.cfg.get('REDIS_HOST', 'localhost'),
      port: parseInt(this.cfg.get('REDIS_PORT', '6379'), 10),
      password: this.cfg.get('REDIS_PASSWORD') || undefined,
      retryStrategy(times: number) {
        return Math.min(times * 200, 5000);
      },
    });
    this.client.on('connect', () => this.logger.log('connected'));
    this.client.on('error', (err) => this.logger.error(`error: ${err.message}`));

    this.cacheTtl = parseInt(this.cfg.get('REDIS_CACHE_TTL', '3600'), 10);
    this.imageCacheTtl = parseInt(this.cfg.get('REDIS_IMAGE_CACHE_TTL', '86400'), 10);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  // ---- JSON cache ----
  async getCache(key: string): Promise<any | null> {
    const data = await this.client.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async setCache(key: string, value: any, ttl?: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttl ?? this.cacheTtl);
  }

  // ---- Image cache ----
  async getImageCache(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const meta = await this.client.get(`${key}:meta`);
    const buf = await this.client.getBuffer(key);
    if (!buf || !meta) return null;
    try {
      return { buffer: buf, contentType: JSON.parse(meta).contentType };
    } catch {
      return null;
    }
  }

  async setImageCache(key: string, buffer: Buffer, contentType: string, ttl?: number): Promise<void> {
    const t = ttl ?? this.imageCacheTtl;
    const pipeline = this.client.pipeline();
    pipeline.set(key, buffer, 'EX', t);
    pipeline.set(`${key}:meta`, JSON.stringify({ contentType }), 'EX', t);
    await pipeline.exec();
  }

  get defaultImageCacheTtl() {
    return this.imageCacheTtl;
  }

  // ---- Invalidation ----
  async invalidateCache(pattern: string): Promise<void> {
    if (!pattern.includes('*')) {
      await this.client.del(pattern);
      return;
    }
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = nextCursor;
      if (keys.length) await this.client.del(...keys);
    } while (cursor !== '0');
  }
}
