import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppConfig } from '../../../config/configuration';
import {
  DocumentChunk,
  DocumentChunkDocument,
} from '../schemas/document-chunk.schema';
import { KeywordVectorStore } from './keyword-vector-store';
import { MongoDbVectorStore } from './mongodb-vector-store';
import { VECTOR_STORE_TOKEN, IVectorStore } from './vector-store.interface';

/** Selects the IVectorStore implementation from VECTOR_STORE_PROVIDER (default keyword). */
export const vectorStoreFactory: Provider = {
  provide: VECTOR_STORE_TOKEN,
  inject: [ConfigService, getModelToken(DocumentChunk.name)],
  useFactory: (
    config: ConfigService<AppConfig, true>,
    chunks: Model<DocumentChunkDocument>,
  ): IVectorStore => {
    const backend = config.get('vector.backend', { infer: true });
    return backend === 'atlas'
      ? new MongoDbVectorStore(chunks)
      : new KeywordVectorStore(chunks);
  },
};
