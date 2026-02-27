import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: Minio.Client;
  private bucket: string;

  constructor(private cfg: ConfigService) {
    this.client = new Minio.Client({
      endPoint: this.cfg.get('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(this.cfg.get('MINIO_PORT', '9000'), 10),
      useSSL: this.cfg.get('MINIO_USE_SSL') === 'true',
      accessKey: this.cfg.get('MINIO_ACCESS_KEY', 'craftea_minio'),
      secretKey: this.cfg.get('MINIO_SECRET_KEY', 'craftea_minio_secret'),
    });
    this.bucket = this.cfg.get('MINIO_BUCKET', 'product-images');
  }

  async onModuleInit() {
    await this.ensureBucket();
  }

  private async ensureBucket() {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/*`],
          },
        ],
      };
      await this.client.setBucketPolicy(this.bucket, JSON.stringify(policy));
      this.logger.log(`Bucket "${this.bucket}" created with public read policy`);
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const ext = path.extname(file.originalname) || '.jpg';
    const objectName = `${uuidv4()}${ext}`;
    await this.client.putObject(this.bucket, objectName, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });
    return objectName;
  }

  async deleteFile(objectNameOrUrl: string): Promise<void> {
    const key = this.objectNameFromUrl(objectNameOrUrl);
    if (key) {
      try {
        await this.client.removeObject(this.bucket, key);
      } catch (e) {
        this.logger.error(`delete error: ${(e as Error).message}`);
      }
    }
  }

  async statObject(objectName: string) {
    return this.client.statObject(this.bucket, objectName);
  }

  async getObjectStream(objectName: string) {
    return this.client.getObject(this.bucket, objectName);
  }

  objectNameFromUrl(url: string): string | null {
    if (!url) return null;
    if (!url.includes('://')) return url;
    try {
      const u = new URL(url);
      const p = u.pathname.replace(/^\//, '');
      if (p.startsWith(`${this.bucket}/`)) {
        return p.replace(`${this.bucket}/`, '');
      }
      return p || null;
    } catch {
      return null;
    }
  }
}
