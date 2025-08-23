/**
 * SAML Metadata API
 * Provides SAML service provider metadata for identity provider configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSAMLProvider } from '@/lib/auth/saml-provider'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/saml/metadata - Get SAML SP metadata
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const provider = searchParams.get('provider') || 'okta'

    const samlProvider = createSAMLProvider(provider)
    
    if (!samlProvider) {
      return NextResponse.json({
        error: `SAML provider '${provider}' not configured`
      }, { status: 404 })
    }

    const metadata = samlProvider.getServiceProviderMetadata()

    return new NextResponse(metadata, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    })
  } catch (error) {
    console.error('SAML metadata error:', error)
    
    return NextResponse.json({
      error: 'Failed to generate SAML metadata',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}