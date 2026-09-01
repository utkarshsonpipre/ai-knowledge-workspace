import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Docker target: emits a self-contained server bundle instead of shipping node_modules.
  output: process.env.DOCKER_BUILD === 'true' ? 'standalone' : undefined,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  eslint: { ignoreDuringBuilds: false },
  // Sentry's OpenTelemetry loader resolves instrumentation via dynamic
  // require(), which webpack cannot trace. Harmless, but scoped to that one
  // module so genuine warnings stay visible.
  webpack: (config) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /require-in-the-middle/ },
    ];
    return config;
  },
};

export default nextConfig;
