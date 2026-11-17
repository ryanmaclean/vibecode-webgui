const path = require('path')

/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...(config.experiments || {}),
      asyncWebAssembly: true,
    }

    config.module = config.module || {}
    config.module.rules = config.module.rules || []
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    })

    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.join(__dirname, 'src'),
    }
    if (!isServer) {
      // Server-only tracing/profiling packages are reachable from client
      // pages through lib/monitoring -> lib/prisma. They are never used in
      // the static export, so keep them out of the browser bundle.
      config.resolve.alias["dd-trace"] = false
      config.resolve.alias["@datadog/pprof"] = false
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        net: false,
        tls: false,
        worker_threads: false,
      }
    }
    return config
  },
}
