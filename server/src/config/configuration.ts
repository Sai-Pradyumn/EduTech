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
    /** 'auto' (first configured in `order`), 'mock', or a specific provider name. */
    provider: string;
    strategy: 'fallback' | 'parallel' | 'refine';
    /** Priority order for auto-selection + the fallback chain. */
    order: string[];
    requestTimeoutMs: number;
    maxOutputTokens: number;
    userRatePerMin: number;
    providers: {
      claude: { apiKey: string; model: string };
      openai: { apiKey: string; model: string };
      groq: { apiKey: string; model: string; baseURL: string };
      mistral: { apiKey: string; model: string; baseURL: string };
      openrouter: { apiKey: string; model: string; baseURL: string; headers: Record<string, string> };
      deepseek: { apiKey: string; model: string; baseURL: string };
      gemini: { apiKey: string; model: string };
    };
  };
  flags: {
    langgraph: boolean;
    realtimeVoice: boolean;
    fineTuning: boolean;
    /** Phase 8 · Flow Studio (visual learning graphs). On by default; set ENABLE_FLOW_STUDIO=false to disable. */
    flowStudio: boolean;
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
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/asta',
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
    provider: process.env.AI_PROVIDER ?? 'auto',
    strategy: (process.env.LLM_STRATEGY as AppConfig['ai']['strategy']) ?? 'fallback',
    order: (process.env.LLM_PROVIDERS ?? 'groq,gemini,mistral,openrouter,deepseek,openai,claude')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    requestTimeoutMs: parseInt(process.env.AI_REQUEST_TIMEOUT_MS ?? '45000', 10),
    maxOutputTokens: parseInt(process.env.AI_MAX_OUTPUT_TOKENS ?? '2048', 10),
    userRatePerMin: parseInt(process.env.AI_USER_RATE_PER_MIN ?? '20', 10),
    providers: {
      claude: { apiKey: process.env.CLAUDE_API_KEY ?? '', model: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6' },
      openai: { apiKey: process.env.OPENAI_API_KEY ?? '', model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini' },
      groq: {
        apiKey: process.env.GROQ_API_KEY ?? '',
        model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
        baseURL: process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
      },
      mistral: {
        apiKey: process.env.MISTRAL_API_KEY ?? '',
        model: process.env.MISTRAL_MODEL ?? 'mistral-small-latest',
        baseURL: process.env.MISTRAL_BASE_URL ?? 'https://api.mistral.ai/v1',
      },
      openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY ?? '',
        model: process.env.OPENROUTER_MODEL ?? 'meta-llama/llama-3.3-70b-instruct:free',
        baseURL: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
        headers: {
          'HTTP-Referer': process.env.OPENROUTER_REFERER ?? 'https://asta.ai',
          'X-Title': process.env.OPENROUTER_TITLE ?? 'Asta AI',
        },
      },
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY ?? '',
        model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
        baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
      },
      gemini: {
        apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '',
        model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
      },
    },
  },
  flags: {
    langgraph: process.env.ENABLE_LANGGRAPH === 'true',
    realtimeVoice: process.env.ENABLE_REALTIME_VOICE === 'true',
    fineTuning: process.env.ENABLE_FINE_TUNING === 'true',
    flowStudio: process.env.ENABLE_FLOW_STUDIO !== 'false',
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
