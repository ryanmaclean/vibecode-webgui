/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    appDir: true,
  },
  // Disable Next.js image optimization to avoid Sharp/LGPL dependencies
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/code-server/:path*',
        destination: 'http://localhost:8080/:path*',
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