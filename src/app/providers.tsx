/**
 * Application providers for VibeCode WebGUI
 * Wraps the app with necessary context providers
 */

'use client'

import { SessionProvider } from 'next-auth/react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { datadogRum } from '@datadog/browser-rum'
import { datadogLogs } from '@datadog/browser-logs'
import { ConsoleProvider } from '@/providers/ConsoleProvider'

interface ProvidersProps {
  children: ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    // Initialize Datadog RUM/Logs on client
    if (typeof window !== 'undefined') {
      const isProd = process.env.NODE_ENV === 'production'
      const enableDev = process.env.NEXT_PUBLIC_ENABLE_RUM_IN_DEV === 'true'

      // Prefer standardized env vars; fall back to legacy RUM names for compatibility
      const applicationId =
        process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID ||
        process.env.NEXT_PUBLIC_DATADOG_RUM_APPLICATION_ID ||
        ''
      const clientToken =
        process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN ||
        process.env.NEXT_PUBLIC_DATADOG_RUM_CLIENT_TOKEN ||
        ''
      const site = process.env.NEXT_PUBLIC_DATADOG_SITE || 'datadoghq.com'

      const shouldInit = (isProd || enableDev) && applicationId && clientToken

      if (shouldInit) {
        datadogRum.init({
          applicationId,
          clientToken,
          site: site as any,
          service: 'vibecode-webgui',
          env: process.env.NODE_ENV || 'development',
          version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
          sessionSampleRate: 100,
          sessionReplaySampleRate: isProd ? 20 : 100,
          trackUserInteractions: true,
          trackResources: true,
          trackLongTasks: true,
          defaultPrivacyLevel: 'mask-user-input',
        })

        datadogLogs.init({
          clientToken,
          site: site as any,
          forwardErrorsToLogs: true,
          sessionSampleRate: 100,
          service: 'vibecode-webgui',
          env: process.env.NODE_ENV || 'development',
          version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
        })
      }
    }
  }, [])

  return (
    <SessionProvider>
      <ConsoleProvider>
        {children}
      </ConsoleProvider>
    </SessionProvider>
  )
}
