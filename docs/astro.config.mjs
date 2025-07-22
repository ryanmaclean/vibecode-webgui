import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  site: 'https://ryanmaclean.github.io',
  base: '/vibecode-webgui',
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'VibeCode Platform',
      description: 'Cloud-Native Development Platform with AI-Powered Workflows',
      social: [
        {
          label: 'GitHub',
          icon: 'github',
          href: 'https://github.com/ryanmaclean/vibecode-webgui',
        },
      ],
      sidebar: [
        {
          label: 'Home',
          link: '/'
        },
        {
          label: 'Wiki Index',
          link: '/wiki-index/'
        },
        {
          label: 'Quick Start Guide',
          link: '/guides/quick-start/'
        },
        {
          label: 'Documentation',
          autogenerate: { directory: '.' }
        }
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
            if (typeof window !== 'undefined' && (import.meta.env.PUBLIC_DATADOG_CLIENT_TOKEN || import.meta.env.PUBLIC_DATADOG_RUM_CLIENT_TOKEN)) {
              window.DD_RUM.init({
                clientToken: import.meta.env.PUBLIC_DATADOG_CLIENT_TOKEN || import.meta.env.PUBLIC_DATADOG_RUM_CLIENT_TOKEN,
                applicationId: import.meta.env.PUBLIC_DATADOG_APPLICATION_ID || import.meta.env.PUBLIC_DATADOG_APP_ID || 'vibecode-docs-rum',
                site: 'datadoghq.com',
                service: 'vibecode-docs',
                env: 'production',
                version: '1.0.0',
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
