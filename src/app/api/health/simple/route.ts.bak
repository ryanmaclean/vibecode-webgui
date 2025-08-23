import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic' // Ensure we get fresh data on every request

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  })
}
