import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  site: 'https://vibecode.github.io',
  base: '/vibecode-webgui',
  integrations: [
    starlight({
      title: 'VibeCode Platform',
      description: 'Cloud-Native Development Platform with AI-Powered Workflows',
      logo: {
        src: './src/assets/logo.svg',
        replacesTitle: true,
      },
      social: {
        github: 'https://github.com/vibecode/vibecode-webgui',
      },
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', link: '/guides/introduction/' },
            { label: 'Quick Start', link: '/guides/quick-start/' },
            { label: 'Installation', link: '/guides/installation/' },
          ],
        },
        {
          label: 'Architecture',
          items: [
            { label: 'System Overview', link: '/architecture/overview/' },
            { label: 'AI Integration', link: '/architecture/ai-integration/' },
            { label: 'Kubernetes Stack', link: '/architecture/kubernetes/' },
          ],
        },
        {
          label: 'Monitoring & Observability',
          items: [
            { label: 'Overview', link: '/monitoring/overview/' },
            { label: 'Datadog Setup', link: '/monitoring/datadog/' },
            { label: 'Prometheus Stack', link: '/monitoring/prometheus/' },
            { label: 'Vector Pipeline', link: '/monitoring/vector/' },
            { label: 'OpenTelemetry', link: '/monitoring/opentelemetry/' },
          ],
        },
        {
          label: 'Deployment',
          items: [
            { label: 'Local Development', link: '/deployment/local/' },
            { label: 'Azure Deployment', link: '/deployment/azure/' },
            { label: 'Production Setup', link: '/deployment/production/' },
          ],
        },
        {
          label: 'Development',
          items: [
            { label: 'Contributing', link: '/development/contributing/' },
            { label: 'Testing', link: '/development/testing/' },
            { label: 'API Reference', link: '/development/api/' },
          ],
        },
      ],
      customCss: [
        './src/styles/custom.css',
      ],
      head: [
        {
          tag: 'script',
          attrs: {
            src: 'https://www.datadoghq-browser-agent.com/us5/v5/datadog-rum.js',
            type: 'text/javascript',
          },
        },
        {
          tag: 'script',
          content: `
            if (import.meta.env.PROD && import.meta.env.PUBLIC_DATADOG_CLIENT_TOKEN) {
              window.DD_RUM.init({
                clientToken: import.meta.env.PUBLIC_DATADOG_CLIENT_TOKEN,
                applicationId: import.meta.env.PUBLIC_DATADOG_APP_ID || 'vibecode-docs-rum',
                site: 'datadoghq.com',
                service: 'vibecode-docs',
                env: 'production',
                version: '1.0.0', // Replace with a dynamic version if needed
                sessionSampleRate: 100,
                sessionReplaySampleRate: 20,
                trackUserInteractions: true,
                trackResources: true,
                trackLongTasks: true,
                defaultPrivacyLevel: 'mask-user-input',
              });
              window.DD_RUM.startSessionReplayRecording();
            }
          `,
        },
      ],
    }),
  ],
});