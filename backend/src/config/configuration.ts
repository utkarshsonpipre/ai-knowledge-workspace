import { EmbeddingProviderName } from './env.validation';

/**
 * Namespaced, typed view over process.env. Services inject ConfigService and
 * read `config.get('ai.grokApiKey')` instead of touching process.env directly,
 * which keeps them testable with a stub config.
 */
export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',

  jwt: {
    secret: process.env.JWT_SECRET as string,
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },

  github: {
    clientId: process.env.GITHUB_CLIENT_ID as string,
    clientSecret: process.env.GITHUB_SECRET as string,
    callbackUrl:
      process.env.GITHUB_CALLBACK_URL ?? 'http://localhost:4000/api/auth/github/callback',
  },

  cookie: {
    domain: process.env.COOKIE_DOMAIN || undefined,
    secure: process.env.NODE_ENV === 'production',
  },

  redis: {
    url: process.env.REDIS_URL as string,
  },

  ai: {
    grokApiKey: process.env.GROK_API_KEY ?? '',
    grokBaseUrl: process.env.GROK_BASE_URL ?? 'https://api.x.ai/v1',
    grokModel: process.env.GROK_MODEL ?? 'grok-4-fast',
  },

  embedding: {
    provider: (process.env.EMBEDDING_PROVIDER ?? 'local') as EmbeddingProviderName,
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS ?? '384', 10),
    localModel: 'Xenova/all-MiniLM-L6-v2',
  },

  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY ?? '',
    bucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'knowledge-files',
  },

  sentry: {
    dsn: process.env.SENTRY_DSN ?? '',
  },
});

export type AppConfig = ReturnType<typeof configuration>;
