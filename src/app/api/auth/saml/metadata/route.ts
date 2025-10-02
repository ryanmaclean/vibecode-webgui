/**
 * SAML Metadata API
 * Provides SAML service provider metadata for identity provider configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSAMLProvider } from '@/lib/auth/saml-provider'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/saml/metadata - Get SAML SP metadata
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const provider = searchParams.get('provider') || 'okta'

    logger.debug('SAML metadata requested', {
      provider,
      url: req.url
    })

    const samlProvider = createSAMLProvider(provider)

    if (!samlProvider) {
      logger.warn('SAML provider not configured', {
        provider,
        requestedUrl: req.url
      })

      return NextResponse.json({
        error: `SAML provider '${provider}' not configured`
      }, { status: 404 })
    }

    const metadata = samlProvider.getServiceProviderMetadata()

    logger.info('SAML metadata generated successfully', {
      provider,
      metadataLength: metadata.length
    })

    return new NextResponse(metadata, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    })
  } catch (error) {
    logger.error('SAML metadata generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      url: req.url
    })

    return NextResponse.json({
      error: 'Failed to generate SAML metadata',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
