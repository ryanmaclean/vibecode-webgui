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

    // Add IgnorePlugin for browser builds to skip server-only modules
    if (!isServer) {
      const webpack = require('webpack')
      config.plugins = config.plugins || []
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^(dd-trace|@datadog\/libdatadog|@datadog\/native-appsec|@datadog\/native-metrics|ansi-color|@opentelemetry\/exporter-jaeger)$/,
        })
      )
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

    // Stub dd-trace and instrument.ts for browser builds
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'dd-trace': require.resolve('./src/stubs/dd-trace.js'),
        './instrument': require.resolve('./src/stubs/instrument-browser.js'),
        './instrument.ts': require.resolve('./src/stubs/instrument-browser.js'),
        '@opentelemetry/sdk-node': require.resolve('./src/stubs/opentelemetry-sdk-node.js'),
        '@opentelemetry/auto-instrumentations-node': require.resolve('./src/stubs/opentelemetry-auto.js'),
        '@opentelemetry/exporter-otlp-http': require.resolve('./src/stubs/opentelemetry-exporter-otlp-http.js'),
        '@opentelemetry/exporter-prometheus': require.resolve('./src/stubs/opentelemetry-exporter-prometheus.js'),
        '@opentelemetry/resources': require.resolve('./src/stubs/opentelemetry-resources.js'),
        '@opentelemetry/semantic-conventions': require.resolve('./src/stubs/opentelemetry-semantic-conventions.js'),
      }
    } else if (dev) {
      config.resolve.alias['dd-trace'] = require.resolve('./src/stubs/dd-trace.js')
    }

    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        os: false,
        path: false,
        tls: false,
        net: false,
        dns: false,
        child_process: false,
        stream: false,
        events: false,
      }

      // Externalize Datadog native modules and problematic deps from browser bundle
      config.externals = config.externals || []
      if (Array.isArray(config.externals)) {
        config.externals.push(
          '@datadog/libdatadog',
          '@datadog/native-appsec',
          '@datadog/native-metrics',
          'dd-trace',
          'ansi-color', // Legacy package with strict mode issues
          '@opentelemetry/exporter-jaeger' // Jaeger exporter not needed in browser
        )
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

    config.externals = config.externals || []
    config.externals.push({
      pg: 'commonjs pg',
      'pg-native': 'commonjs pg-native',
      'pg-connection-string': 'commonjs pg-connection-string',
    })

    return config
  },

  // Server external packages (moved from experimental)
  // These packages should not be bundled by webpack - kept as external requires
  serverExternalPackages: [
    '@datadog/browser-rum',
    'dd-trace',
    '@datadog/libdatadog',
    '@datadog/native-appsec',
    '@datadog/native-metrics',
    '@datadog/native-iast-taint-tracking',
    '@datadog/pprof',
    'ansi-color',
    '@opentelemetry/exporter-jaeger',
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
  
  // Security headers
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
