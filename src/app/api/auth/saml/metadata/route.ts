/**
 * SAML Metadata API
 * Provides SAML service provider metadata for identity provider configuration
 *
 * SECURITY: Provider parameter validation prevents injection attacks
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSAMLProvider } from '@/lib/auth/saml-provider'
import { validateQueryParams } from '@/lib/api/validation/middleware'
import { samlMetadataQuerySchema } from '@/lib/api/validation/schemas'
import { createServiceLogger } from '@/lib/logging'

const logger = createServiceLogger({ service: 'vibecode-webgui', component: 'auth-saml-metadata' });

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/saml/metadata - Get SAML SP metadata
 *
 * SECURITY: Critical provider validation
 * - Validates provider name format (lowercase alphanumeric + hyphens only)
 * - Restricts to allowlist of known SAML providers
 * - Prevents XML injection and SSRF attacks
 */
export async function GET(req: NextRequest) {
  try {
    // SECURITY: Validate query parameters
    const validation = validateQueryParams(req, samlMetadataQuerySchema)
    if (!validation.success) {
      return validation.error
    }

    const { provider } = validation.data

    // SECURITY: Provider is already validated by Zod schema against allowlist
    const samlProvider = createSAMLProvider(provider)

    if (!samlProvider) {
      logger.error('SAML provider not configured', { provider });
      return NextResponse.json(
        {
          error: `SAML provider '${provider}' not configured`,
        },
        { status: 404 }
      )
    }

    const metadata = samlProvider.getServiceProviderMetadata()

    // SECURITY: Validate metadata is valid XML before returning
    if (!metadata || typeof metadata !== 'string' || !metadata.includes('<?xml')) {
      logger.error('Invalid SAML metadata generated');
      return NextResponse.json(
        {
          error: 'Invalid SAML metadata',
        },
        { status: 500 }
      )
    }

    return new NextResponse(metadata, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'X-Content-Type-Options': 'nosniff', // Prevent MIME sniffing
      },
    })
  } catch (error) {
    logger.error('SAML metadata generation error', { error });

    return NextResponse.json(
      {
        error: 'Failed to generate SAML metadata',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}