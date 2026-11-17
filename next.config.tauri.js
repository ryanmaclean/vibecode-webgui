const path = require('path')
const createNextIntlPlugin = require('next-intl/plugin')

// layout.tsx calls getLocale/getMessages, so the plugin is required. The static
// request config avoids cookies()/headers(), which output: 'export' cannot prerender.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.static.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
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
    return config
  },
}

module.exports = withNextIntl(nextConfig)
