/**
 * Application providers for VibeCode WebGUI
 * Wraps the app with necessary context providers
 */

'use client'

import { SessionProvider } from 'next-auth/react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { datadogLogs } from '@datadog/browser-logs'
import { ConsoleProvider } from '@/providers/ConsoleProvider'
import { UserPreferencesProvider } from '@/providers/UserPreferencesProvider'
import RUMMonitoring from '@/lib/monitoring/rum-client'
import { getRUMPublicConfig } from '@/lib/monitoring/datadog-env'

// Define Datadog Site type to match @datadog/browser-core
type DatadogSite = "datadoghq.com" | "us3.datadoghq.com" | "us5.datadoghq.com" | "datadoghq.eu" | "ddog-gov.com" | "ap1.datadoghq.com";

// Type guard for valid Datadog site values
const isValidDatadogSite = (site: string): site is DatadogSite => {
  return ["datadoghq.com", "us3.datadoghq.com", "us5.datadoghq.com", "datadoghq.eu", "ddog-gov.com", "ap1.datadoghq.com"].includes(site);
};

// Safely convert string to DatadogSite with fallback
const toDatadogSite = (site: string): DatadogSite => {
  return isValidDatadogSite(site) ? site : "datadoghq.com";
};

interface ProvidersProps {
  children: ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    // Initialize Datadog RUM/Logs on client
    if (typeof window !== 'undefined') {
      const isProd = process.env.NODE_ENV === 'production'
      const enableDev = process.env.NEXT_PUBLIC_ENABLE_RUM_IN_DEV === 'true'

      // Resolve public RUM config via centralized helper (prefers NEXT_PUBLIC_DD_*; legacy fallback)
      const { applicationId, clientToken, site, env, version } = getRUMPublicConfig()

      const shouldInit = (isProd || enableDev) && applicationId && clientToken

      if (shouldInit) {
        // Initialize enhanced RUM monitoring with automatic tracking
        RUMMonitoring.initializeWithTracking({
          applicationId,
          clientToken,
          site: toDatadogSite(site),
          service: 'vibecode-webgui',
          env,
          version,
          sessionSampleRate: 100,
          sessionReplaySampleRate: isProd ? 20 : 100,
          trackUserInteractions: true,
          trackResources: true,
          trackLongTasks: true,
          defaultPrivacyLevel: 'mask-user-input',
        })

        // Initialize Datadog Logs
        datadogLogs.init({
          clientToken,
          site: toDatadogSite(site),
          forwardErrorsToLogs: true,
          sessionSampleRate: 100,
          service: 'vibecode-webgui',
          env,
          version,
        })

        // Track application initialization
        RUMMonitoring.addAction('app.initialized', {
          timestamp: Date.now(),
          version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          category: 'app-lifecycle'
        })

        // Debug log removed
      } else {
        // Warning noted
      }
    }
  }, [])

  return (
    <SessionProvider>
      <UserPreferencesProvider>
        <ConsoleProvider>
          {children}
        </ConsoleProvider>
      </UserPreferencesProvider>
    </SessionProvider>
  )
}
