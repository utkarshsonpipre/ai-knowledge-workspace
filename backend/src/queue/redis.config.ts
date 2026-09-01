import type { RedisOptions } from 'ioredis';

/**
 * BullMQ needs blocking commands (BRPOPLPUSH/BZPOPMIN), so this must be a real
 * Redis TCP connection — Upstash's REST client cannot serve it. Feed the
 * `rediss://` string from the Upstash console into REDIS_URL.
 *
 * We expand the URL into RedisOptions rather than sharing one ioredis instance:
 * BullMQ opens dedicated blocking connections per worker and mutates client
 * options, which corrupts a shared client.
 */
export function redisOptionsFromUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  const isTls = parsed.protocol === 'rediss:';

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    ...(isTls ? { tls: { servername: parsed.hostname } } : {}),
    // Both required by BullMQ; the second also avoids Upstash INFO restrictions.
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}
