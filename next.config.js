/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable source maps in production for Datadog Dynamic Instrumentation
  productionBrowserSourceMaps: true,

  // Webpack configuration for source maps
  webpack: (config, { dev, isServer }) => {
    // Enable source maps in production
    if (!dev) {
      config.devtool = 'source-map'
    }

    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@langchain/openai': require.resolve('./src/lib/ai/stubs/langchain-openai.ts'),
      '@langchain/core/prompts': require.resolve('./src/lib/ai/stubs/langchain-prompts.ts'),
      '@langchain/core/output_parsers': require.resolve('./src/lib/ai/stubs/langchain-output-parsers.ts'),
      '@langchain/core/runnables': require.resolve('./src/lib/ai/stubs/langchain-runnables.ts'),
      '@langchain/core/messages': require.resolve('./src/lib/ai/stubs/langchain-messages.ts'),
      '@langchain/core/documents': require.resolve('./src/lib/ai/stubs/langchain-documents.ts'),
    }

    // Configure fallbacks for client-side bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        tls: false,
        net: false,
        dns: false,
        child_process: false,
        os: false,
        path: false,
        crypto: false,
        monacopilot: false,
      }
    }

    // Optimize for production
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        // Keep source maps readable
        minimize: true,
      }

      // Preserve function names for better debugging via minimizer
      if (config.optimization.minimizer) {
        config.optimization.minimizer.forEach((minimizer) => {
          if (minimizer.constructor.name === 'TerserPlugin') {
            minimizer.options.terserOptions = {
              ...minimizer.options.terserOptions,
              keep_fnames: true,
            }
          }
        })
      }
    }

    // Exclude monaco-editor from Babel transpilation (it has complex regex that Babel can't process)
    if (!dev && !isServer) {
      const oneOfRule = config.module.rules.find((rule) => typeof rule.oneOf === 'object');

      if (oneOfRule) {
        const babelRule = oneOfRule.oneOf.find((rule) => {
          return rule.use && rule.use.loader && rule.use.loader.includes('babel-loader');
        });

        if (babelRule) {
          babelRule.exclude = [
            /node_modules\/monaco-editor/,
            ...(Array.isArray(babelRule.exclude) ? babelRule.exclude : [babelRule.exclude]).filter(Boolean)
          ];
        }
      }
    }

    config.externals = config.externals || []

    if (isServer) {
      // Server-only externals
      config.externals.push({
        pg: 'commonjs pg',
        'pg-native': 'commonjs pg-native',
        'pg-connection-string': 'commonjs pg-connection-string',
        'dd-trace': 'commonjs dd-trace',
        '@datadog/libdatadog': 'commonjs @datadog/libdatadog',
      })
    }

    return config
  },

  // Server external packages (moved from experimental)
  serverExternalPackages: [
    '@datadog/browser-rum',
    'dd-trace',
    '@datadog/libdatadog',
  ],

  // Environment variables for Datadog
  env: {
    DD_DYNAMIC_INSTRUMENTATION_ENABLED: process.env.DD_DYNAMIC_INSTRUMENTATION_ENABLED || 'false',
    DD_PROFILING_ENABLED: process.env.DD_PROFILING_ENABLED || 'false',
    DD_LOGS_INJECTION: process.env.DD_LOGS_INJECTION || 'false',
    DD_TRACE_ENABLED: process.env.DD_TRACE_ENABLED || 'false',
    DD_ENV: process.env.DD_ENV || 'development',
    DD_SERVICE: process.env.DD_SERVICE || 'vibecode-webgui',
    DD_VERSION: process.env.DD_VERSION || '1.0.0',
  },

  // Output configuration for standalone deployment
  output: 'standalone',

  // Security headers - Enhanced with HSTS and CSP
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
          // HSTS - Force HTTPS for 1 year
          ...(process.env.NODE_ENV === 'production' ? [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          }] : []),
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.openai.com https://api.anthropic.com https://openrouter.ai wss: ws:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests"
            ].join('; ')
          }
        ]
      }
    ]
  },

  // Redirect configuration
  async redirects() {
    return [
      {
        source: '/health',
        destination: '/api/health',
        permanent: true
      }
    ]
  },

  // Image optimization
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },

  // Compression
  compress: true,

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  // Power-ups for production (swcMinify is now default)

  // Disable x-powered-by header
  poweredByHeader: false,

  // Custom build ID for better caching
  generateBuildId: async () => {
    // Use git commit hash if available, otherwise timestamp
    if (process.env.GIT_COMMIT) {
      return process.env.GIT_COMMIT
    }
    return `build-${Date.now()}`
  },
}

module.exports = nextConfig
