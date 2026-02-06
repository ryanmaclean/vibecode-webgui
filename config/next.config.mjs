import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

// Disable Next.js telemetry globally for every runtime invocation
process.env.NEXT_TELEMETRY_DISABLED = process.env.NEXT_TELEMETRY_DISABLED || '1'

const require = createRequire(import.meta.url)
const webpack = require('webpack')
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Set output mode: standalone for Docker containers, export for static sites, or default for standard builds
const outputMode = process.env.NEXT_OUTPUT_MODE === 'export'
  ? 'export'
  : (process.env.NODE_ENV === 'production' && !process.env.NEXT_OUTPUT_MODE)
    ? 'standalone'
    : undefined
if (outputMode) {
  console.info(`[next.config] output mode: ${outputMode}`)
}

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
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
      'upgrade-insecure-requests',
    ].join('; '),
  },
]

const apiHeaders = [
  ...securityHeaders,
  {
    key: 'Access-Control-Allow-Origin',
    value: process.env.NODE_ENV === 'development' ? '*' : 'https://vibecode.dev',
  },
  { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
  { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With' },
  { key: 'Access-Control-Max-Age', value: '86400' },
]

const datadogStubAliases = {
  'dd-trace': require.resolve('./src/stubs/dd-trace.js'),
  './instrument': require.resolve('./src/stubs/instrument-browser.js'),
  './instrument.ts': require.resolve('./src/stubs/instrument-browser.js'),
  '@opentelemetry/sdk-node': require.resolve('./src/stubs/opentelemetry-sdk-node.js'),
  '@opentelemetry/auto-instrumentations-node': require.resolve('./src/stubs/opentelemetry-auto.js'),
  '@opentelemetry/exporter-otlp-http': require.resolve('./src/stubs/opentelemetry-exporter-otlp-http.js'),
  '@opentelemetry/exporter-prometheus': require.resolve('./src/stubs/opentelemetry-exporter-prometheus.js'),
  '@opentelemetry/resources': require.resolve('./src/stubs/opentelemetry-resources.js'),
  '@opentelemetry/semantic-conventions': require.resolve('./src/stubs/opentelemetry-semantic-conventions.js'),
  '@opentelemetry/api': require.resolve('./src/stubs/opentelemetry-api.js'),
  '@opentelemetry/core': require.resolve('./src/stubs/opentelemetry-core.js'),
  '@opentelemetry/instrumentation': require.resolve('./src/stubs/opentelemetry-instrumentation.js'),
}

const serverExternalPackages = [
  '@datadog/browser-rum',
  // dd-trace is stubbed via webpack alias, not externalized
  '@datadog/libdatadog',
  '@datadog/native-appsec',
  '@datadog/native-metrics',
  '@datadog/native-iast-taint-tracking',
  '@datadog/pprof',
  'ansi-color',
  '@opentelemetry/exporter-jaeger',
  // Native modules that need special handling
  'node-pty',
  // Exclude Node.js built-ins from client bundles
  'child_process',
  'fs',
  'path',
  'os',
]

// Exclude dd-trace from ignore plugin since we're aliasing it to a stub
const datadogResourceRegExp = /^(@datadog\/libdatadog|@datadog\/native-appsec|@datadog\/native-metrics|ansi-color|@opentelemetry\/exporter-jaeger)$/

const ensureArray = (value) => {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

const addUniqueStrings = (target, values) => {
  values.forEach((value) => {
    if (!target.includes(value)) {
      target.push(value)
    }
  })
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  output: outputMode,
  // Avoid Next inferring workspace root; speeds tracing and prevents pulling unrelated files
  outputFileTracingRoot: __dirname,

  // Compiler optimizations (SWC minification is default in Next.js 15)
  compiler: {
    // Remove console logs in production except errors and warnings
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
    unoptimized: true,
  },
  // Enable compression for production builds
  compress: true,
  skipTrailingSlashRedirect: true,
  experimental: {
    isrFlushToDisk: false,
    // Enable optimized package imports for better tree shaking
    optimizePackageImports: [
      '@heroicons/react',
      '@radix-ui/react-label',
      '@radix-ui/react-progress',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      'lucide-react',
      'framer-motion',
      // common utilities; safely modularize when present
      'date-fns',
      'lodash-es',
      // Monaco Editor - ensure proper code splitting
      '@monaco-editor/react',
    ],
  },
  trailingSlash: false,
  env: {
    DD_DYNAMIC_INSTRUMENTATION_ENABLED: process.env.DD_DYNAMIC_INSTRUMENTATION_ENABLED || 'false',
    DD_PROFILING_ENABLED: process.env.DD_PROFILING_ENABLED || 'false',
    DD_LOGS_INJECTION: process.env.DD_LOGS_INJECTION || 'false',
    DD_TRACE_ENABLED: process.env.DD_TRACE_ENABLED || 'false',
    DD_ENV: process.env.DD_ENV || 'development',
    DD_SERVICE: process.env.DD_SERVICE || 'vibecode-webgui',
    DD_VERSION: process.env.DD_VERSION || '1.0.0',
  },
  poweredByHeader: false,
  // Disable Turbopack - use Webpack for all builds for reliable behavior
  // Turbopack in Next.js 16 has tree-shaking issues with worker threads
  serverExternalPackages,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        source: '/api/(.*)',
        headers: apiHeaders,
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/health',
        destination: '/api/health',
        permanent: true,
      },
    ]
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
    ]
  },
  generateBuildId: async () => {
    if (process.env.GIT_COMMIT) {
      return process.env.GIT_COMMIT
    }
    return `build-${Date.now()}`
  },
  webpack: (config, { dev, isServer }) => {
    if (!dev) {
      config.devtool = false
    }

    // Remove Next.js MinifyPlugin to work around webpack.WebpackError bug
    if (!dev && !isServer) {
      config.plugins = (config.plugins || []).filter(
        (plugin) => plugin?.constructor?.name !== 'MinifyPlugin'
      )
    }

    config.plugins = config.plugins || []
    const hasIgnorePlugin = config.plugins.some(
      (plugin) =>
        plugin?.constructor?.name === 'IgnorePlugin' &&
        plugin.options?.resourceRegExp?.toString() === datadogResourceRegExp.toString()
    )
    if (!hasIgnorePlugin) {
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: datadogResourceRegExp,
        })
      )
    }

    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.join(__dirname, 'src'),
      '@langchain/openai': require.resolve('./src/lib/ai/stubs/langchain-openai.ts'),
      '@langchain/core/prompts': require.resolve('./src/lib/ai/stubs/langchain-prompts.ts'),
      '@langchain/core/output_parsers': require.resolve('./src/lib/ai/stubs/langchain-output-parsers.ts'),
      '@langchain/core/runnables': require.resolve('./src/lib/ai/stubs/langchain-runnables.ts'),
      '@langchain/core/messages': require.resolve('./src/lib/ai/stubs/langchain-messages.ts'),
      '@langchain/core/documents': require.resolve('./src/lib/ai/stubs/langchain-documents.ts'),
    }

    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        ...datadogStubAliases,
        '@opentelemetry/api': require.resolve('./src/stubs/opentelemetry-api.js'),
        '@opentelemetry/core': require.resolve('./src/stubs/opentelemetry-core.js'),
        '@opentelemetry/instrumentation': require.resolve('./src/stubs/opentelemetry-instrumentation.js'),
        pg: false,
        redis: false,
      }
    } else {
      // For all server builds, stub dd-trace and opentelemetry to avoid bundling native modules
      config.resolve.alias = {
        ...config.resolve.alias,
        'dd-trace': datadogStubAliases['dd-trace'],
        '@opentelemetry/api': require.resolve('./src/stubs/opentelemetry-api.js'),
        '@opentelemetry/core': require.resolve('./src/stubs/opentelemetry-core.js'),
        '@opentelemetry/instrumentation': require.resolve('./src/stubs/opentelemetry-instrumentation.js'),
      }
    }

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
      fsevents: false,
    }

    // For server builds, configure externals but NOT dd-trace or opentelemetry (they're stubbed via alias)
    if (isServer) {
      const externals = ensureArray(config.externals)
      addUniqueStrings(externals, [
        '@datadog/libdatadog',
        '@datadog/native-appsec',
        '@datadog/native-metrics',
        'ansi-color',
        '@opentelemetry/exporter-jaeger',
        '@opentelemetry/sdk-node',
        '@opentelemetry/auto-instrumentations-node',
        '@opentelemetry/exporter-otlp-http',
        '@opentelemetry/exporter-prometheus',
        '@opentelemetry/resources',
        '@opentelemetry/semantic-conventions',
        '@opentelemetry/sdk-trace-web',
        '@opentelemetry/auto-instrumentations-web',
        '@opentelemetry/sdk-trace-base',
        '@opentelemetry/sdk-metrics',
      ])
      externals.push({
        pg: 'commonjs pg',
        'pg-native': 'commonjs pg-native',
        'pg-connection-string': 'commonjs pg-connection-string',
      })
      config.externals = externals
    }

    // Re-enable minification now that MinifyPlugin is removed
    // SWC minifier handles this automatically in Next.js
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        minimize: true,
      }
    }

    // Drop all Moment.js locales if Moment is used anywhere
    const hasMomentLocaleDrop = config.plugins.some(
      (p) => p?.constructor?.name === 'ContextReplacementPlugin'
    )
    if (!hasMomentLocaleDrop) {
      config.plugins.push(new webpack.ContextReplacementPlugin(/moment[\\/\\]locale$/, /^$/))
    }

    config.module = config.module || {}
    config.module.rules = config.module.rules || []
    config.module.rules.push(
      {
        test: /node_modules\/camelcase/,
        use: 'null-loader',
      },
      {
        test: /vendor-chunks\/@opentelemetry/,
        use: 'null-loader',
      }
    )

    return config
  },
}

export default nextConfig
