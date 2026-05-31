import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule, MongooseModuleFactoryOptions } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppConfig } from '../config/configuration';

const logger = new Logger('DatabaseModule');

const DEFAULT_LOCAL_URI = 'mongodb://127.0.0.1:27017/asta';

/**
 * Strips replica-set-only params so a replica-set URI can be retried against a
 * standalone mongod (the common local/dev case: brew mongo on :27017, no rs0).
 */
function toStandaloneUri(uri: string): string {
  try {
    const url = new URL(uri);
    url.searchParams.delete('replicaSet');
    url.searchParams.delete('directConnection');
    // URL keeps a trailing '?' if all params were removed — clean it up.
    const out = url.toString().replace(/\?$/, '');
    return out;
  } catch {
    // Not a parseable URL (e.g. multi-host seed list) — fall back to a string strip.
    return uri
      .replace(/([?&])replicaSet=[^&]*/g, '$1')
      .replace(/([?&])directConnection=[^&]*/g, '$1')
      .replace(/[?&]$/, '');
  }
}

function hasReplicaSet(uri: string): boolean {
  return /[?&]replicaSet=/.test(uri);
}

/**
 * Builds Mongoose options that first try the configured URI, then transparently
 * retry as a standalone connection if the replica-set handshake fails. Mongoose's
 * own buffering means models still work; we just pick the URI that actually connects.
 */
async function buildMongooseOptions(
  config: ConfigService<AppConfig, true>,
): Promise<MongooseModuleFactoryOptions> {
  const configured =
    config.get('mongoUri', { infer: true }) || DEFAULT_LOCAL_URI;
  const base: MongooseModuleFactoryOptions = {
    serverSelectionTimeoutMS: 5000,
    connectionFactory: (connection: Connection) => {
      connection.on('connected', () =>
        logger.log(`MongoDB connected → ${redact(connection.host ?? '')}`),
      );
      connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
      connection.on('error', (err: Error) =>
        logger.error(`MongoDB error: ${err.message}`),
      );
      return connection;
    },
  };

  // If the URI requests a replica set, probe it; on failure, fall back to standalone.
  if (hasReplicaSet(configured)) {
    const reachable = await canConnect(configured);
    if (reachable) {
      logger.log('Using configured MongoDB URI (replica set).');
      return { uri: configured, ...base };
    }
    const standalone = toStandaloneUri(configured);
    logger.warn(
      'Replica-set MongoDB not reachable — falling back to standalone connection ' +
        `(${redact(standalone)}). Start the replica set or set MONGO_URI for prod.`,
    );
    return { uri: standalone, ...base };
  }

  logger.log(`Using MongoDB URI ${redact(configured)}.`);
  return { uri: configured, ...base };
}

/** Quick connectivity probe so we choose the right URI before Nest wires models. */
async function canConnect(uri: string): Promise<boolean> {
  // Lazy import keeps the driver out of the module's static surface.
  const mongoose = await import('mongoose');
  try {
    const conn = await mongoose
      .createConnection(uri, {
        serverSelectionTimeoutMS: 4000,
      })
      .asPromise();
    await conn.close();
    return true;
  } catch {
    return false;
  }
}

/** Hide credentials in logs. */
function redact(uri: string): string {
  return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:***@');
}

/** Connects Mongoose with a smart replica-set → standalone fallback. */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        buildMongooseOptions(config),
    }),
  ],
})
export class DatabaseModule {}
