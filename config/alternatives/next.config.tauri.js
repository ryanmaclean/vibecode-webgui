/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for Tauri
  output: 'export',

  // Disable features not compatible with static export
  images: {
    unoptimized: true,
  },

  // Disable server-side features
  trailingSlash: true,
  
  // Skip problematic routes during build
  generateStaticParams: false,
  
  // Disable page data collection for API routes
  experimental: {
    skipTrailingSlashRedirect: true,
    skipMiddlewareUrlNormalize: true,
  },

  // Webpack configuration
  webpack: (config, { dev, isServer }) => {
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

    return config
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  // Disable x-powered-by header
  poweredByHeader: false,

  // Environment variables
  env: {
    TAURI_BUILD: 'true',
    DD_ENV: 'desktop',
    DD_SERVICE: 'vibecode-desktop',
  },
}

module.exports = nextConfig
