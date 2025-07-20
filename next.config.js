/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // To deploy to a static host like GitHub Pages, set output to 'export'.
  // For a Node.js server deployment, use 'standalone'.
  output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  // Required for GitHub Pages deployment.
  basePath: process.env.NODE_ENV === 'production' ? '/vibecode-webgui' : '',
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

module.exports = nextConfig;
