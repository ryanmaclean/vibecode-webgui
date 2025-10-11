/**
 * SAML SSO Authentication API
 * Handles SAML authentication requests and responses
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSAMLProvider } from '@/lib/auth/saml-provider'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const authRequestSchema = z.object({
  provider: z.string().default('okta'),
  relayState: z.string().optional(),
  forceAuthn: z.boolean().default(false)
})

const authResponseSchema = z.object({
  SAMLResponse: z.string(),
  RelayState: z.string().optional()
})

/**
 * POST /api/auth/saml/sso - Initiate SAML authentication
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { provider, relayState, forceAuthn } = authRequestSchema.parse(body)

    const samlProvider = createSAMLProvider(provider)
    
    if (!samlProvider) {
      return NextResponse.json({
        error: `SAML provider '${provider}' not configured`
      }, { status: 404 })
    }

    const authRequest = samlProvider.generateAuthRequest({
      relayState,
      forceAuthn,
      allowCreate: true
    })

    return NextResponse.json({
      status: 'success',
      data: {
        redirectUrl: authRequest.url,
        samlRequest: authRequest.samlRequest,
        relayState: authRequest.relayState
      },
      message: 'SAML authentication request generated'
    })
  } catch (error) {
    // Server error logged
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request parameters',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      error: 'SAML SSO initiation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * POST /api/auth/saml/acs - SAML Assertion Consumer Service
 */
export async function PUT(req: NextRequest) {
  try {
    let body
    const contentType = req.headers.get('content-type')

    if (contentType?.includes('application/x-www-form-urlencoded')) {
      // Handle form-encoded SAML response (typical)
      const formData = await req.formData()
      body = {
        SAMLResponse: formData.get('SAMLResponse') as string,
        RelayState: formData.get('RelayState') as string | undefined
      }
    } else {
      // Handle JSON request
      body = await req.json()
    }

    const { SAMLResponse, RelayState } = authResponseSchema.parse(body)

    // Determine provider from relay state or default
    const provider = 'okta' // Could be extracted from RelayState
    const samlProvider = createSAMLProvider(provider)
    
    if (!samlProvider) {
      return NextResponse.json({
        error: `SAML provider '${provider}' not configured`
      }, { status: 404 })
    }

    // Process SAML response
    const user = await samlProvider.processResponse(SAMLResponse, RelayState)

    // In a real implementation, you would:
    // 1. Create or update user in database
    // 2. Create session token
    // 3. Redirect to application

    return NextResponse.json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          provider: user.provider,
          groups: user.groups,
          roles: user.roles
        },
        sessionId: `saml_session_${Date.now()}`, // Generate proper session
        relayState: RelayState
      },
      message: 'SAML authentication successful'
    })
  } catch (error) {
    // Server error logged
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid SAML response format',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      error: 'SAML authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET /api/auth/saml/sso - Get SAML SSO configuration
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const provider = searchParams.get('provider') || 'okta'

    // Return configuration info (no sensitive data)
    const config = {
      provider,
      available: !!process.env[`SAML_${provider.toUpperCase()}_ENTITY_ID`],
      entityId: process.env[`SAML_${provider.toUpperCase()}_ENTITY_ID`],
      endpoints: {
        metadata: `/api/auth/saml/metadata?provider=${provider}`,
        sso: `/api/auth/saml/sso`,
        acs: `/api/auth/saml/acs`,
        sls: `/api/auth/saml/sls`
      }
    }

    return NextResponse.json({
      status: 'success',
      data: config
    })
  } catch (error) {
    // Server error logged
    
    return NextResponse.json({
      error: 'Failed to get SAML configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}