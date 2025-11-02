import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

// Disable Next.js telemetry globally for every runtime invocation
process.env.NEXT_TELEMETRY_DISABLED = process.env.NEXT_TELEMETRY_DISABLED || '1'

const require = createRequire(import.meta.url)
const webpack = require('webpack')
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
  '@datadog/libdatadog',
  '@datadog/native-appsec',
  '@datadog/native-metrics',
  '@datadog/native-iast-taint-tracking',
  '@datadog/pprof',
  'ansi-color',
  '@opentelemetry/exporter-jaeger',
  'child_process',
  'fs',
  'path',
  'os',
]

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
  // Use standalone for Tauri (includes server)
  output: 'standalone',
  outputFileTracingRoot: __dirname,

  compiler: {
    removeConsole: {
      exclude: ['error', 'warn'],
    },
  },

  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  compress: true,
  skipTrailingSlashRedirect: true,
  skipMiddlewareUrlNormalize: true,
  experimental: {
    isrFlushToDisk: false,
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
      'date-fns',
      'lodash-es',
      '@monaco-editor/react',
    ],
  },
  trailingSlash: false,
  env: {
    DD_DYNAMIC_INSTRUMENTATION_ENABLED: 'false',
    DD_PROFILING_ENABLED: 'false',
    DD_LOGS_INJECTION: 'false',
    DD_TRACE_ENABLED: 'false',
    DD_ENV: 'production',
    DD_SERVICE: 'vibecode-desktop',
    DD_VERSION: '0.1.0',
  },
  poweredByHeader: false,
  turbopack: {},
  serverExternalPackages,

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

    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        minimize: false,
      }
    }

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
