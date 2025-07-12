/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable Next.js image optimization to avoid Sharp/LGPL dependencies
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/code-server/:path*',
        destination: process.env.NODE_ENV === 'development' && process.env.DOCKER === 'true'
          ? 'http://code-server:8080/:path*'
          : 'http://localhost:8080/:path*',
      },
    ];
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

module.exports = nextConfig;