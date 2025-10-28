'use client';

import { datadogRum } from '@datadog/browser-rum';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { getRUMPublicConfig } from '@/lib/monitoring/datadog-env';

// This component initializes Datadog RUM for client-side monitoring.
const DatadogRUM = () => {
  const pathname = usePathname();

  useEffect(() => {
    // Check if RUM is already initialized to prevent re-initialization on navigation.
    if (datadogRum.getInternalContext()?.application_id) {
      return;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const enableDev = process.env.NEXT_PUBLIC_ENABLE_RUM_IN_DEV === 'true';

    // Resolve public RUM config via centralized helper (prefers NEXT_PUBLIC_DD_*; legacy fallback)
    const { applicationId, clientToken, site, env, version } = getRUMPublicConfig();

    // Initialize in production or when explicitly enabled for development, if the client token is available.
    if ((isProduction || enableDev) && clientToken && applicationId) {
      // Debug log removed
      type DatadogSite = 'datadoghq.com' | 'us3.datadoghq.com' | 'us5.datadoghq.com' | 'datadoghq.eu' | 'ddog-gov.com' | 'ap1.datadoghq.com';
      const ddSite: DatadogSite = (site as DatadogSite) || 'datadoghq.com';
      datadogRum.init({
        applicationId: applicationId || 'vibecode-rum',
        clientToken,
        site: ddSite,
        service: 'vibecode-webgui',
        env,
        version: version || process.env.npm_package_version,
        sessionSampleRate: 100,
        sessionReplaySampleRate: isProduction ? 20 : 100, // 20% for prod, 100% for dev
        trackUserInteractions: true,
        trackResources: true,
        trackLongTasks: true,
        defaultPrivacyLevel: 'mask-user-input',
      });

      datadogRum.startSessionReplayRecording();
      // Debug log removed
    }
  }, []);

  // This effect tracks route changes as RUM views.
  useEffect(() => {
    if (pathname) {
      datadogRum.startView({
        name: pathname,
      });
    }
  }, [pathname]);

  return null;
};

export default DatadogRUM;
