import { Injectable, Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import { dirname, join, resolve } from 'path';
import { AppConfig } from '../../../config/configuration';

export interface IFileStorage {
  readonly name: string;
  save(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export const FILE_STORAGE_TOKEN = 'FILE_STORAGE_TOKEN';

/** Writes files under a local directory. Default storage for dev/single-node. */
@Injectable()
export class LocalFileStorage implements IFileStorage {
  readonly name = 'local';
  private readonly log = new Logger(LocalFileStorage.name);

  constructor(private readonly baseDir: string) {}

  private path(key: string): string {
    // Prevent traversal outside the base dir.
    const target = resolve(this.baseDir, key);
    if (!target.startsWith(resolve(this.baseDir))) {
      throw new Error('Invalid storage key');
    }
    return target;
  }

  async save(key: string, data: Buffer): Promise<void> {
    const p = this.path(key);
    await fs.mkdir(dirname(p), { recursive: true });
    await fs.writeFile(p, data);
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.path(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.path(key));
    } catch (err) {
      this.log.warn(`Could not delete ${key}: ${(err as Error).message}`);
    }
  }
}

/**
 * S3-backed storage (STORAGE_PROVIDER=s3). Activated when a bucket + credentials are configured;
 * the interface is identical to LocalFileStorage, so callers need no changes.
 */
@Injectable()
export class S3FileStorage implements IFileStorage {
  readonly name = 's3';
  private readonly log = new Logger(S3FileStorage.name);
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
  ) {
    this.client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async save(key: string, data: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data }),
    );
  }

  async read(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      this.log.warn(`Could not delete ${key}: ${(err as Error).message}`);
    }
  }
}

export const fileStorageFactory: Provider = {
  provide: FILE_STORAGE_TOKEN,
  inject: [ConfigService],
  useFactory: (config: ConfigService<AppConfig, true>): IFileStorage => {
    const log = new Logger('FileStorage');
    const provider = config.get('storage.provider', { infer: true });
    if (provider === 's3') {
      const aws = config.get('storage.aws', { infer: true });
      if (aws?.bucket && aws.accessKeyId && aws.secretAccessKey) {
        return new S3FileStorage(
          aws.bucket,
          aws.region,
          aws.accessKeyId,
          aws.secretAccessKey,
        );
      }
      log.warn(
        'STORAGE_PROVIDER=s3 but AWS bucket/credentials are missing — falling back to local storage.',
      );
    }
    const dir = config.get('storage.localDir', { infer: true });
    return new LocalFileStorage(join(process.cwd(), dir));
  },
};
