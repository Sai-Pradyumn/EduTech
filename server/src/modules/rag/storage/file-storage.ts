import { Injectable, Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
 * S3-backed storage (STORAGE_PROVIDER=s3). PLACEHOLDER: the @aws-sdk client is not a
 * dependency in this build, so this throws a clear "configure S3" error until wired —
 * the interface is identical, so swapping it in requires no caller changes.
 */
@Injectable()
export class S3FileStorage implements IFileStorage {
  readonly name = 's3';
  async save(): Promise<void> {
    throw new Error('S3 storage selected but not configured. Use STORAGE_PROVIDER=local for local dev.');
  }
  async read(): Promise<Buffer> {
    throw new Error('S3 storage selected but not configured.');
  }
  async delete(): Promise<void> {
    throw new Error('S3 storage selected but not configured.');
  }
}

export const fileStorageFactory: Provider = {
  provide: FILE_STORAGE_TOKEN,
  inject: [ConfigService],
  useFactory: (config: ConfigService<AppConfig, true>): IFileStorage => {
    const provider = config.get('storage.provider', { infer: true });
    if (provider === 's3') return new S3FileStorage();
    const dir = config.get('storage.localDir', { infer: true });
    return new LocalFileStorage(join(process.cwd(), dir));
  },
};
