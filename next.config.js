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
    
    // Optimize for production
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        // Keep source maps readable
        minimize: true,
        // Preserve function names for better debugging
        keep_fnames: true,
      }
    }

    return config
  },

  // Enable experimental features for better performance
  experimental: {
    // Server components for better performance
    serverComponentsExternalPackages: ['@datadog/browser-rum'],
    
    // Optimize images
    optimizeImages: true,
  },

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
  
  // Power-ups for production
  swcMinify: true,
  
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
