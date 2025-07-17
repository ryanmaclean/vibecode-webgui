import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/code-server/:path*',
        destination:
          process.env.NODE_ENV === 'development' && process.env.DOCKER === 'true'
            ? 'http://code-server:8080/:path*'
            : 'http://localhost:8080/:path*',
      },
    ];
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        pg: false,
        redis: false,
      };
    }

    return config;
  },
};

export default nextConfig;
