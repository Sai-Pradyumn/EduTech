import * as Joi from 'joi';

/** Validates process.env at boot; fails fast on misconfiguration. */
export const validationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  CLIENT_ORIGIN: Joi.string().uri().default('http://localhost:4200'),

  MONGO_URI: Joi.string().required(),

  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),

  AI_PROVIDER: Joi.string().valid('mock', 'openai', 'gemini', 'claude').default('mock'),
  OPENAI_API_KEY: Joi.string().allow('').default(''),
  GEMINI_API_KEY: Joi.string().allow('').default(''),
  CLAUDE_API_KEY: Joi.string().allow('').default(''),

  ENABLE_LANGGRAPH: Joi.string().valid('true', 'false').default('false'),
  ENABLE_REALTIME_VOICE: Joi.string().valid('true', 'false').default('false'),
  ENABLE_FINE_TUNING: Joi.string().valid('true', 'false').default('false'),

  VECTOR_BACKEND: Joi.string().valid('keyword', 'atlas').default('keyword'),
  VECTOR_STORE_PROVIDER: Joi.string().valid('keyword', 'atlas').default('keyword'),

  RAG_TOP_K: Joi.number().min(1).max(20).default(6),
  RAG_MIN_SCORE: Joi.number().min(0).max(1).default(0.15),
  RAG_HYBRID: Joi.string().valid('true', 'false').default('true'),

  STORAGE_PROVIDER: Joi.string().valid('local', 's3').default('local'),
  STORAGE_LOCAL_DIR: Joi.string().default('storage-data'),
  AWS_ACCESS_KEY_ID: Joi.string().allow('').default(''),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),
  AWS_REGION: Joi.string().allow('').default('ap-south-1'),
  S3_BUCKET: Joi.string().allow('').default(''),
});
