import { plainToInstance, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MinLength, validateSync } from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export enum EmbeddingProviderName {
  Local = 'local',
  OpenAI = 'openai',
}

/**
 * Fail fast on boot rather than 500-ing on the first request that needs a
 * missing secret. Only genuinely required vars are non-optional — optional
 * integrations (Sentry, Supabase in unit tests) degrade instead of crashing.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.Development;

  // Env values are always strings; @Type is what actually coerces them.
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  PORT = 4000;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  @IsOptional()
  DIRECT_URL?: string;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
  JWT_SECRET: string;

  @IsString()
  @MinLength(32, { message: 'JWT_REFRESH_SECRET must be at least 32 characters' })
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_TTL = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_TTL = '7d';

  @IsString()
  GITHUB_CLIENT_ID: string;

  @IsString()
  GITHUB_SECRET: string;

  @IsString()
  @IsOptional()
  GITHUB_CALLBACK_URL = 'http://localhost:4000/api/auth/github/callback';

  @IsString()
  @IsOptional()
  FRONTEND_URL = 'http://localhost:3000';

  @IsString()
  @IsOptional()
  COOKIE_DOMAIN?: string;

  @IsString()
  REDIS_URL: string;

  @IsString()
  @IsOptional()
  GROK_API_KEY?: string;

  @IsString()
  @IsOptional()
  GROK_BASE_URL = 'https://api.x.ai/v1';

  @IsString()
  @IsOptional()
  GROK_MODEL = 'grok-4-fast';

  @IsEnum(EmbeddingProviderName)
  @IsOptional()
  EMBEDDING_PROVIDER: EmbeddingProviderName = EmbeddingProviderName.Local;

  @IsString()
  @IsOptional()
  OPENAI_API_KEY?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  EMBEDDING_DIMENSIONS = 384;

  @IsString()
  @IsOptional()
  SUPABASE_URL?: string;

  @IsString()
  @IsOptional()
  SUPABASE_SERVICE_KEY?: string;

  @IsString()
  @IsOptional()
  SUPABASE_STORAGE_BUCKET = 'knowledge-files';

  @IsString()
  @IsOptional()
  SENTRY_DSN?: string;
}

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const config = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });

  const errors = validateSync(config, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return config;
}
