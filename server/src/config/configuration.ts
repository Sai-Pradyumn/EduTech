/** Typed, namespaced application configuration loaded from environment. */
export interface AppConfig {
  port: number;
  nodeEnv: string;
  clientOrigin: string;
  mongoUri: string;
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  redis: { host: string; port: number };
  ai: {
    provider: 'mock' | 'openai' | 'gemini' | 'claude';
    openaiApiKey: string;
    geminiApiKey: string;
    claudeApiKey: string;
  };
  flags: {
    langgraph: boolean;
    realtimeVoice: boolean;
    fineTuning: boolean;
  };
  vector: { backend: 'keyword' | 'atlas' };
  rag: { topK: number; minScore: number; hybrid: boolean };
  storage: {
    provider: 'local' | 's3';
    localDir: string;
    aws: { accessKeyId: string; secretAccessKey: string; region: string; bucket: string };
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:4200',
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/asta',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev_access_secret',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  ai: {
    provider: (process.env.AI_PROVIDER as AppConfig['ai']['provider']) ?? 'mock',
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    geminiApiKey: process.env.GEMINI_API_KEY ?? '',
    claudeApiKey: process.env.CLAUDE_API_KEY ?? '',
  },
  flags: {
    langgraph: process.env.ENABLE_LANGGRAPH === 'true',
    realtimeVoice: process.env.ENABLE_REALTIME_VOICE === 'true',
    fineTuning: process.env.ENABLE_FINE_TUNING === 'true',
  },
  vector: {
    backend: (process.env.VECTOR_STORE_PROVIDER ??
      process.env.VECTOR_BACKEND ??
      'keyword') as AppConfig['vector']['backend'],
  },
  rag: {
    topK: parseInt(process.env.RAG_TOP_K ?? '6', 10),
    minScore: parseFloat(process.env.RAG_MIN_SCORE ?? '0.15'),
    hybrid: process.env.RAG_HYBRID !== 'false',
  },
  storage: {
    provider: (process.env.STORAGE_PROVIDER as AppConfig['storage']['provider']) ?? 'local',
    localDir: process.env.STORAGE_LOCAL_DIR ?? 'storage-data',
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      region: process.env.AWS_REGION ?? 'ap-south-1',
      bucket: process.env.S3_BUCKET ?? '',
    },
  },
});
