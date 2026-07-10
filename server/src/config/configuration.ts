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
      openrouter: {
        apiKey: string;
        model: string;
        baseURL: string;
        headers: Record<string, string>;
      };
      deepseek: { apiKey: string; model: string; baseURL: string };
      gemini: { apiKey: string; model: string };
      /** Local, free, zero-key provider (Ollama's OpenAI-compatible API). Opt-in. */
      ollama: {
        enabled: boolean;
        apiKey: string;
        model: string;
        baseURL: string;
      };
    };
  };
  flags: {
    langgraph: boolean;
    realtimeVoice: boolean;
    fineTuning: boolean;
    /** Phase 8 · Flow Studio (visual learning graphs). On by default; set ENABLE_FLOW_STUDIO=false to disable. */
    flowStudio: boolean;
    /** Phase 8 · Visual Intelligence Studio. On by default. */
    visualStudio: boolean;
    /** Phase 8 · real image generation (OpenAI/Gemini/Stability). Off by default — mock SVG used. */
    imageGeneration: boolean;
    /** Phase 8 · Voice Room (browser STT/TTS). On by default; ENABLE_VOICE=false to disable. */
    voice: boolean;
    /** Phase 8 · Study Spaces. On by default. */
    studySpaces: boolean;
    /** Phase 8 · Simulation Labs. On by default. */
    simulations: boolean;
    /** Phase 8 · Course Builder. On by default. */
    courseBuilder: boolean;
    /** Phase 8 · Peer Rooms. On by default. */
    peerRooms: boolean;
  };
  vector: { backend: 'keyword' | 'atlas' | 'qdrant'; qdrantUrl: string };
  rag: { topK: number; minScore: number; hybrid: boolean };
  storage: {
    provider: 'local' | 's3';
    localDir: string;
    aws: {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
      bucket: string;
    };
  };
  security: {
    /** When true, accounts with an admin/platform role must have MFA enrolled to use
     *  routes marked @RequireMfa (SECURITY_IMPLEMENTATION.md §17 · AU-03). Off by default so
     *  a rollout can enroll admins first, then flip it on without locking anyone out. */
    requireAdminMfa: boolean;
    /** When true, new passwords are screened against public breach corpora via the HIBP
     *  k-anonymity range API (AU-05). Fails open on network trouble. Off by default so dev
     *  boxes without egress pay zero signup latency. */
    passwordBreachCheck: boolean;
    /** Enforce JWT issuer/audience on verification (§8). Tokens are always signed with
     *  the claims; flip this on after one refresh lifetime so old tokens have rotated. */
    jwtStrictClaims: boolean;
    /** CSRF backstop: reject state-changing browser requests whose Origin is neither the
     *  SPA origin nor the API host itself. On by default; server-to-server unaffected. */
    strictOriginCheck: boolean;
    /** Load shedding: max in-flight requests before responding 503 (0 = disabled). */
    maxInflight: number;
    /** Versioned AES-256-GCM key ring for field-level encryption (DP-03), e.g.
     *  "1:<base64-32B>" or "1:old,2:new". Empty = store fields as-is. */
    fieldEncryptionKeys: string;
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
    strategy:
      (process.env.LLM_STRATEGY as AppConfig['ai']['strategy']) ?? 'fallback',
    order: (
      process.env.LLM_PROVIDERS ??
      'groq,gemini,mistral,openrouter,deepseek,openai,claude,ollama'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    requestTimeoutMs: parseInt(
      process.env.AI_REQUEST_TIMEOUT_MS ?? '45000',
      10,
    ),
    maxOutputTokens: parseInt(process.env.AI_MAX_OUTPUT_TOKENS ?? '2048', 10),
    userRatePerMin: parseInt(process.env.AI_USER_RATE_PER_MIN ?? '20', 10),
    providers: {
      claude: {
        apiKey: process.env.CLAUDE_API_KEY ?? '',
        model: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY ?? '',
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      },
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
        model:
          process.env.OPENROUTER_MODEL ??
          'meta-llama/llama-3.3-70b-instruct:free',
        baseURL:
          process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
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
      ollama: {
        // Local, free, zero-key. Opt-in: set OLLAMA_ENABLED=true and run a daemon
        // (`ollama serve` after `ollama pull llama3.2`). It joins the chain as the
        // last real provider before mock, so real AI answers work with no cloud keys.
        enabled: process.env.OLLAMA_ENABLED === 'true',
        // Ollama ignores the key, but the OpenAI SDK needs a non-empty string.
        apiKey: process.env.OLLAMA_API_KEY ?? 'ollama',
        model: process.env.OLLAMA_MODEL ?? 'llama3.2',
        baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
      },
    },
  },
  flags: {
    langgraph: process.env.ENABLE_LANGGRAPH === 'true',
    realtimeVoice: process.env.ENABLE_REALTIME_VOICE === 'true',
    fineTuning: process.env.ENABLE_FINE_TUNING === 'true',
    flowStudio: process.env.ENABLE_FLOW_STUDIO !== 'false',
    visualStudio: process.env.ENABLE_VISUAL_STUDIO !== 'false',
    imageGeneration: process.env.ENABLE_IMAGE_GENERATION === 'true',
    voice: process.env.ENABLE_VOICE !== 'false',
    studySpaces: process.env.ENABLE_STUDY_SPACES !== 'false',
    simulations: process.env.ENABLE_SIMULATIONS !== 'false',
    courseBuilder: process.env.ENABLE_COURSE_BUILDER !== 'false',
    peerRooms: process.env.ENABLE_PEER_ROOMS !== 'false',
  },
  vector: {
    backend: (process.env.VECTOR_STORE_PROVIDER ??
      process.env.VECTOR_BACKEND ??
      'keyword') as AppConfig['vector']['backend'],
    qdrantUrl: process.env.QDRANT_URL ?? 'http://localhost:6333',
  },
  rag: {
    topK: parseInt(process.env.RAG_TOP_K ?? '6', 10),
    minScore: parseFloat(process.env.RAG_MIN_SCORE ?? '0.15'),
    hybrid: process.env.RAG_HYBRID !== 'false',
  },
  storage: {
    provider:
      (process.env.STORAGE_PROVIDER as AppConfig['storage']['provider']) ??
      'local',
    localDir: process.env.STORAGE_LOCAL_DIR ?? 'storage-data',
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      region: process.env.AWS_REGION ?? 'ap-south-1',
      bucket: process.env.S3_BUCKET ?? '',
    },
  },
  security: {
    requireAdminMfa: process.env.REQUIRE_ADMIN_MFA === 'true',
    passwordBreachCheck: process.env.PASSWORD_BREACH_CHECK === 'true',
    jwtStrictClaims: process.env.JWT_STRICT_CLAIMS === 'true',
    strictOriginCheck: process.env.STRICT_ORIGIN_CHECK !== 'false',
    maxInflight: parseInt(process.env.MAX_INFLIGHT ?? '0', 10),
    fieldEncryptionKeys: process.env.FIELD_ENCRYPTION_KEYS ?? '',
  },
});
