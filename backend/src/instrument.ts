import * as Sentry from '@sentry/node';

// Must be imported before anything else so Sentry can patch http/express/prisma.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  });
}
