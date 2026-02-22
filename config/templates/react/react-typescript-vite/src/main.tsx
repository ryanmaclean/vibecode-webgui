import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

// Optional: Initialize Datadog RUM (Real User Monitoring)
// Uncomment and configure if you want to enable monitoring
/*
import { datadogRum } from '@datadog/browser-rum'

if (import.meta.env.VITE_ENABLE_MONITORING === 'true') {
  datadogRum.init({
    applicationId: import.meta.env.DD_RUM_APPLICATION_ID || '',
    clientToken: import.meta.env.DD_RUM_CLIENT_TOKEN || '',
    site: import.meta.env.DD_SITE || 'datadoghq.com',
    service: import.meta.env.DD_SERVICE || 'my-react-app',
    env: import.meta.env.DD_ENV || 'development',
    version: import.meta.env.DD_VERSION || '1.0.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
  })

  datadogRum.startSessionReplayRecording()
}
*/

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
