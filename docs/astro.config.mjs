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
          label: 'Latest Features',
          link: '/new-features/',
          badge: 'New'
        },
        {
          label: 'Documentation',
          items: [
            { label: 'Complete Wiki Index', link: '/wiki-index/' },
            { label: 'Getting Started', link: '/getting-started/' },
            { label: 'Developer Guide', link: '/developer-guide/' },
            { label: 'Consolidated Docs', link: '/consolidated-documentation/' },
          ]
        },
        {
          label: 'Production Deployment',
          collapsed: false,
          items: [
            { label: 'Production Deployment Guide', link: '/production-deployment-guide/' },
            { label: 'Kubernetes Secrets Automation', link: '/kubernetes-secrets-automation/' },
            { label: 'Helm Deployment Guide', link: '/helm-deployment-guide/' },
          ]
        },
        {
          label: 'Database & Storage',
          items: [
            { label: 'PostgreSQL + pgvector', link: '/prisma-pgvector/' },
            { label: 'PostgreSQL Test Results', link: '/PRISMA_PGVECTOR_TEST_RESULTS/' },
            { label: 'PostgreSQL GenAI Demo', link: '/postgresql-genai-demo-guide/' },
            { label: 'PostgreSQL Sample Queries', link: '/postgresql-sample-queries/' },
          ]
        },
        {
          label: 'API Reference',
          link: '/api-reference/',
          badge: 'Enhanced'
        },
        {
          label: 'Monitoring & Observability',
          items: [
            { label: 'Overview', link: '/monitoring/overview/' },
            { label: 'Azure OpenAI Monitoring', link: '/azure-openai-monitoring/' },
            { label: 'Deploy Azure OpenAI Monitoring', link: '/deploy-azure-openai-monitoring/' },
            { label: 'Datadog Configuration', link: '/DATADOG_MONITORING_CONFIGURATION/' },
            { label: 'Datadog Local Development', link: '/DATADOG_LOCAL_DEVELOPMENT/' },
            { label: 'Datadog Compatibility', link: '/datadog-compatibility/' },
          ]
        },
        {
          label: 'AI Integration',
          collapsed: false,
          items: [
            { label: 'Enhanced AI Features', link: '/enhanced-ai-features/' },
            { label: 'AI CLI Tools', link: '/ai-cli-tools/' },
            { label: 'GenAI Integration', link: '/genai-integration/' },
            { label: 'Missing AI Libraries', link: '/missing-ai-libraries/' },
          ]
        },
        {
          label: 'Deployment',
          collapsed: true,
          autogenerate: { directory: 'deployment' }
        },
        {
          label: 'Security',
          collapsed: true,
          autogenerate: { directory: 'security' }
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
