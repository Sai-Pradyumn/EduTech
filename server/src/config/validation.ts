import * as Joi from 'joi';

/** Validates process.env at boot; fails fast on misconfiguration. */
export const validationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  CLIENT_ORIGIN: Joi.string().uri().default('http://localhost:4200'),

  // Optional: defaults to local standalone; replica-set URIs auto-fall-back to standalone.
  MONGO_URI: Joi.string().allow('').default('mongodb://127.0.0.1:27017/asta'),

  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),

  // 'auto' = first configured provider in LLM_PROVIDERS, else mock. Or pin a provider name.
  AI_PROVIDER: Joi.string().default('auto'),
  LLM_STRATEGY: Joi.string()
    .valid('fallback', 'parallel', 'refine')
    .default('fallback'),
  // Comma-separated priority order (auto-select + fallback chain).
  LLM_PROVIDERS: Joi.string().default(
    'groq,gemini,mistral,openrouter,deepseek,openai,claude,ollama',
  ),
  AI_REQUEST_TIMEOUT_MS: Joi.number().default(45000),
  AI_MAX_OUTPUT_TOKENS: Joi.number().default(2048),
  AI_USER_RATE_PER_MIN: Joi.number().default(20),
  // Provider keys (any/all optional). OpenAI-compatible: groq/mistral/openrouter/deepseek.
  OPENAI_API_KEY: Joi.string().allow('').default(''),
  GEMINI_API_KEY: Joi.string().allow('').default(''),
  GOOGLE_API_KEY: Joi.string().allow('').default(''),
  CLAUDE_API_KEY: Joi.string().allow('').default(''),
  GROQ_API_KEY: Joi.string().allow('').default(''),
  MISTRAL_API_KEY: Joi.string().allow('').default(''),
  OPENROUTER_API_KEY: Joi.string().allow('').default(''),
  DEEPSEEK_API_KEY: Joi.string().allow('').default(''),
  // Model + base-URL overrides (all optional; sensible defaults in configuration.ts).
  CLAUDE_MODEL: Joi.string().default('claude-sonnet-4-6'),
  OPENAI_MODEL: Joi.string().default('gpt-4o-mini'),
  GEMINI_MODEL: Joi.string().default('gemini-2.0-flash'),
  GROQ_MODEL: Joi.string().optional(),
  GROQ_BASE_URL: Joi.string().optional(),
  MISTRAL_MODEL: Joi.string().optional(),
  MISTRAL_BASE_URL: Joi.string().optional(),
  OPENROUTER_MODEL: Joi.string().optional(),
  OPENROUTER_BASE_URL: Joi.string().optional(),
  OPENROUTER_REFERER: Joi.string().optional(),
  OPENROUTER_TITLE: Joi.string().optional(),
  DEEPSEEK_MODEL: Joi.string().optional(),
  DEEPSEEK_BASE_URL: Joi.string().optional(),
  // Ollama — local, free, zero-key real AI. Opt-in via OLLAMA_ENABLED=true with a
  // running daemon (default http://localhost:11434/v1). The "key" is ignored.
  OLLAMA_ENABLED: Joi.string().valid('true', 'false').default('false'),
  OLLAMA_API_KEY: Joi.string().allow('').optional(),
  OLLAMA_MODEL: Joi.string().optional(),
  OLLAMA_BASE_URL: Joi.string().optional(),

  ENABLE_LANGGRAPH: Joi.string().valid('true', 'false').default('false'),
  ENABLE_REALTIME_VOICE: Joi.string().valid('true', 'false').default('false'),
  ENABLE_FINE_TUNING: Joi.string().valid('true', 'false').default('false'),

  VECTOR_BACKEND: Joi.string()
    .valid('keyword', 'atlas', 'qdrant')
    .default('keyword'),
  VECTOR_STORE_PROVIDER: Joi.string()
    .valid('keyword', 'atlas', 'qdrant')
    .default('keyword'),
  QDRANT_URL: Joi.string().uri().optional(),

  RAG_TOP_K: Joi.number().min(1).max(20).default(6),
  RAG_MIN_SCORE: Joi.number().min(0).max(1).default(0.15),
  RAG_HYBRID: Joi.string().valid('true', 'false').default('true'),

  STORAGE_PROVIDER: Joi.string().valid('local', 's3').default('local'),
  STORAGE_LOCAL_DIR: Joi.string().default('storage-data'),
  AWS_ACCESS_KEY_ID: Joi.string().allow('').default(''),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),
  AWS_REGION: Joi.string().allow('').default('ap-south-1'),
  S3_BUCKET: Joi.string().allow('').default(''),

  // Phase 10 — OAuth / payments / web-push / queue (all optional; mock when unset).
  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  ENABLE_PAYMENT_PROVIDER: Joi.string().valid('true', 'false').default('false'),
  PAYMENT_PROVIDER: Joi.string()
    .valid('mock', 'razorpay', 'stripe')
    .default('razorpay'),
  RAZORPAY_KEY_ID: Joi.string().allow('').default(''),
  RAZORPAY_KEY_SECRET: Joi.string().allow('').default(''),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().allow('').default(''),
  STRIPE_SECRET_KEY: Joi.string().allow('').default(''),
  VAPID_PUBLIC_KEY: Joi.string().allow('').default(''),
  VAPID_PRIVATE_KEY: Joi.string().allow('').default(''),
  VAPID_SUBJECT: Joi.string().allow('').default('mailto:support@asta.dev'),
  ENABLE_BULLMQ: Joi.string().valid('true', 'false').default('false'),
});
