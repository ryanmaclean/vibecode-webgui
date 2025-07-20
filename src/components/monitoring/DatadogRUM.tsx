/* eslint-disable no-console */
'use client';

import { datadogRum } from '@datadog/browser-rum';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

// This component initializes Datadog RUM for client-side monitoring.
const DatadogRUM = () => {
  const pathname = usePathname();

  useEffect(() => {
    // Check if RUM is already initialized to prevent re-initialization on navigation.
    if (datadogRum.getInternalContext()?.application_id) {
      return;
    }

    // Only initialize in production environment and if the client token is available.
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN) {
      console.log('Initializing Datadog RUM...');
      datadogRum.init({
        applicationId: process.env.NEXT_PUBLIC_DATADOG_APP_ID || 'vibecode-rum',
        clientToken: process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN,
        site: 'datadoghq.com',
        service: process.env.NEXT_PUBLIC_DATADOG_SERVICE || 'vibecode-webgui',
        env: 'production',
        version: process.env.NEXT_PUBLIC_DATADOG_VERSION || process.env.npm_package_version,
        sessionSampleRate: 100,
        sessionReplaySampleRate: 20,
        trackUserInteractions: true,
        trackResources: true,
        trackLongTasks: true,
        defaultPrivacyLevel: 'mask-user-input',
      });

      datadogRum.startSessionReplayRecording();
      console.log('Datadog RUM initialized.');
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
