'use client'

import { useEffect } from 'react'
import { datadogRum } from '@datadog/browser-rum'

const DatadogRUM = () => {
  useEffect(() => {
    // Prevent re-initialization and run only in the browser
    if (typeof window === 'undefined' || (window as any).DD_RUM) {
      return
    }

    const applicationId = process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID
    const clientToken = process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN
    const site = process.env.NEXT_PUBLIC_DATADOG_SITE || 'datadoghq.com'
    const service = 'vibecode-webgui-frontend'
    const env = process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV
    const version = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'

    // Only initialize in production or if explicitly enabled
    if (clientToken && applicationId && env === 'production') {
      datadogRum.init({
        applicationId,
        clientToken,
        site,
        service,
        env,
        version,
        sessionSampleRate: 100,
        sessionReplaySampleRate: 20,
        trackUserInteractions: true,
        trackResources: true,
        trackLongTasks: true,
        defaultPrivacyLevel: 'mask-user-input',
      })

      datadogRum.startSessionReplayRecording()

      // Set a global flag to indicate initialization
      ;(window as any).DD_RUM = true
    }
  }, [])

  return null // This component does not render anything
}

export default DatadogRUM
