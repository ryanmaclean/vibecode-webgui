/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  experimental: {
    outputFileTracingRoot: __dirname,
  },
}

module.exports = nextConfig
