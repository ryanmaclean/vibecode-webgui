/**
 * Application providers for VibeCode WebGUI
 * Wraps the app with necessary context providers
 */

'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode, useEffect } from 'react'
import { datadogRum } from '@datadog/browser-rum'
import { datadogLogs } from '@datadog/browser-logs'

interface ProvidersProps {
  children: ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    // Initialize Datadog RUM monitoring
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DATADOG_RUM_APPLICATION_ID) {
      datadogRum.init({
        applicationId: process.env.NEXT_PUBLIC_DATADOG_RUM_APPLICATION_ID,
        clientToken: process.env.NEXT_PUBLIC_DATADOG_RUM_CLIENT_TOKEN || '',
        site: process.env.NEXT_PUBLIC_DATADOG_SITE || 'datadoghq.com',
        service: 'vibecode-webgui',
        env: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        sessionSampleRate: 100,
        sessionReplaySampleRate: 20,
        trackUserInteractions: true,
        trackResources: true,
        trackLongTasks: true,
        defaultPrivacyLevel: 'mask-user-input',
      })

      // Initialize Datadog Logs
      datadogLogs.init({
        clientToken: process.env.NEXT_PUBLIC_DATADOG_RUM_CLIENT_TOKEN || '',
        site: process.env.NEXT_PUBLIC_DATADOG_SITE || 'datadoghq.com',
        forwardErrorsToLogs: true,
        sessionSampleRate: 100,
        service: 'vibecode-webgui',
        env: process.env.NODE_ENV || 'development',
        version: '1.0.0',
      })

      console.log('✅ Datadog RUM and Logs initialized successfully')
    } else {
      console.warn('⚠️ Datadog RUM not initialized - missing environment variables')
    }
  }, [])

  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  )
}