import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const preferences = await request.json()

    // TODO: Save to database
    // For now, store in session or localStorage on client
    
    // Install extensions if requested
    if (preferences.extensions?.length > 0) {
      // Queue extension installation
      console.log('Extensions to install:', preferences.extensions)
    }

    // Setup integrations if requested
    const integrations = preferences.integrations || {}
    const activeIntegrations = Object.entries(integrations)
      .filter(([_, enabled]) => enabled)
      .map(([name]) => name)

    console.log('Active integrations:', activeIntegrations)

    return NextResponse.json({
      success: true,
      message: 'Preferences saved successfully',
      preferences,
    })
  } catch (error) {
    console.error('Error saving preferences:', error)
    return NextResponse.json(
      { error: 'Failed to save preferences' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: Fetch from database
    const preferences = {
      theme: 'auto',
      cliEditor: 'none',
      extensions: [],
      integrations: {},
      onboardingCompleted: false,
    }

    return NextResponse.json(preferences)
  } catch (error) {
    console.error('Error fetching preferences:', error)
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    )
  }
}
