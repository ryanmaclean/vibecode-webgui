import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request })
  const { pathname } = request.nextUrl

  // API routes protection
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  // Add CORS headers for API routes
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')
    return response
  }

  // Protect authenticated routes
  if (pathname.startsWith('/dashboard') && !token) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*']
}
