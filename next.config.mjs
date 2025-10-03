/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
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

  // Skip static analysis of API routes to prevent ERR_INVALID_URL during build
  skipTrailingSlashRedirect: true,
  skipMiddlewareUrlNormalize: true,
  


  // Force app router and disable problematic features
  experimental: {
    // Disable ISR completely
    isrFlushToDisk: false,
  },

  
  trailingSlash: false,
  generateBuildId: () => 'build',

  // Disable basePath for now to fix routing issues
  // basePath: process.env.BUILDING === 'true' ? '' : (process.env.NODE_ENV === 'production' ? '/vibecode-webgui' : ''),

  // Security headers configuration
  async headers() {
    const securityHeaders = [
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on'
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload'
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block'
      },
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN'
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff'
      },
      {
        key: 'Referrer-Policy',
        value: 'origin-when-cross-origin'
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
      },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.datadoghq-browser-agent.com https://cdn.jsdelivr.net https://unpkg.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: https: blob:",
          "connect-src 'self' https://api.openrouter.ai https://api.openai.com https://api.anthropic.com https://browser-intake-datadoghq.com wss: ws:",
          "worker-src 'self' blob:",
          "frame-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'self'",
          "upgrade-insecure-requests"
        ].join('; ')
      }
    ];

    return [
      {
        source: '/(.*)',
        headers: securityHeaders
      },
      {
        source: '/api/(.*)',
        headers: [
          ...securityHeaders,
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'development' ? '*' : 'https://vibecode.dev'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With'
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400'
          }
        ]
      }
    ];
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
    // Disable minification to fix webpack error with zod v4
    config.optimization = {
      ...config.optimization,
      minimize: false,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      fsevents: false,
      // OpenTelemetry modules causing static build issues
      '@opentelemetry/sdk-node': false,
      '@opentelemetry/auto-instrumentations-node': false,
      '@opentelemetry/exporter-otlp-http': false,
      '@opentelemetry/exporter-prometheus': false,
      '@opentelemetry/resources': false,
      '@opentelemetry/semantic-conventions': false,
      '@opentelemetry/core': false,
      '@opentelemetry/api': false,
      '@opentelemetry/instrumentation': false,
      '@opentelemetry/sdk-trace-web': false,
      '@opentelemetry/auto-instrumentations-web': false,
      '@opentelemetry/sdk-trace-base': false,
      '@opentelemetry/sdk-metrics': false,
    };

    // Explicitly handle path aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.join(__dirname, 'src'),
      pg: false,
      redis: false,
    };

    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        pg: false,
        redis: false,
      };
    }

    // Exclude OpenTelemetry modules from bundling entirely
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push(
        '@opentelemetry/sdk-node',
        '@opentelemetry/auto-instrumentations-node',
        '@opentelemetry/exporter-otlp-http',
        '@opentelemetry/exporter-prometheus',
        '@opentelemetry/resources',
        '@opentelemetry/semantic-conventions',
        '@opentelemetry/core',
        '@opentelemetry/api',
        '@opentelemetry/instrumentation',
        '@opentelemetry/sdk-trace-web',
        '@opentelemetry/auto-instrumentations-web',
        '@opentelemetry/sdk-trace-base',
        '@opentelemetry/sdk-metrics'
      );
    }

    // Fix for camelcase module causing webpack errors
    config.module.rules.push({
      test: /node_modules\/camelcase/,
      use: 'null-loader'
    });

    // Ignore OpenTelemetry vendor chunks
    config.module.rules.push({
      test: /vendor-chunks\/@opentelemetry/,
      use: 'null-loader'
    });

    return config;
  },
};

export default nextConfig;
