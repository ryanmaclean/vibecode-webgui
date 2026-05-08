import type { Metadata } from "next";
// Import CSS - Disabled due to Tailwind v4 ARM64 compatibility issues
// See TAILWIND_V4_MIGRATION_NOTES.md for details
// The application is fully functional without CSS styling
import "./globals.css";
import Providers from './providers';
import Script from 'next/script';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import BrowserTelemetryInit from '@/components/monitoring/BrowserTelemetryInit';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { GlobalCommandPalette } from '@/components/command-palette/GlobalCommandPalette';
import { ModelSwitcher } from '@/components/ai/ModelSwitcher';
import { GlobalCostAlerts } from '@/components/ai/GlobalCostAlerts';
import { EnvironmentBadge } from '@/components/environment/EnvironmentBadge';
import { UnifiedStatusBar } from '@/components/status-bar/UnifiedStatusBar';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

export const metadata: Metadata = {
  title: "VibeCode WebGUI - AI-Powered Development Platform",
  description: "Modern web-based development environment with AI assistance",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0f172a" />
        {/* Tailwind CSS v4 is now handled via PostCSS in Docker mode */}
        {/* Datadog RUM Browser SDK (enabled when NEXT_PUBLIC_DD_* env vars are set) */}
        {process.env.NEXT_PUBLIC_DD_APPLICATION_ID && process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN && (
          <>
            <Script
              src={`https://www.datadoghq-browser-agent.com/datadog-rum.js`}
              strategy="afterInteractive"
            />
            <Script id="dd-rum-init" strategy="afterInteractive">
              {`
              if (window.DD_RUM) {
                DD_RUM.init({
                  applicationId: '${process.env.NEXT_PUBLIC_DD_APPLICATION_ID}',
                  clientToken: '${process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN}',
                  site: '${process.env.NEXT_PUBLIC_DD_SITE || 'datadoghq.com'}',
                  service: '${process.env.NEXT_PUBLIC_DD_SERVICE || 'vibecode-webgui'}',
                  env: '${process.env.NEXT_PUBLIC_DD_ENV || 'production'}',
                  sampleRate: 100,
                  trackInteractions: true
                });
              }
            `}
            </Script>
          </>
        )}
        <Script id="sw-register" strategy="afterInteractive">
          {`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function () {
              navigator.serviceWorker.register('/sw.js').catch(() => {});
            });
          }
          `}
        </Script>
      </head>
      <body
        className="antialiased"
      >
        {/* Skip link for keyboard accessibility - WCAG 2.4.1 */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Skip to main content
        </a>
        {/* Offline indicator - fixed position to avoid layout shift */}
        <OfflineIndicator className="fixed top-4 right-4 z-50" />
        {/* Environment badge - displays current environment with color coding */}
        <EnvironmentBadge className="fixed top-4 left-4 z-50" showIcon={true} />
        <NextIntlClientProvider locale={locale} messages={messages}>
        <Providers>
          {/* Initialize OpenTelemetry browser instrumentation */}
          {process.env.NEXT_PUBLIC_OTEL_ENABLED !== 'false' && process.env.NEXT_PUBLIC_SKIP_MONITORING !== 'true' && (
            <BrowserTelemetryInit />
          )}
          {/* Model switcher - fixed position for global access, keyboard shortcut: Cmd+M */}
          <ModelSwitcher className="fixed top-4 right-56 z-50" />
          {/* Language switcher */}
          <LocaleSwitcher className="fixed top-4 right-72 z-50 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground" />
          <ErrorBoundary>
            <main id="main-content">
              {children}
            </main>
          </ErrorBoundary>
          {/* Global command palette accessible from any page via Cmd+Shift+P or Cmd+K */}
          <GlobalCommandPalette />
          {/* Global cost alert notifications */}
          <GlobalCostAlerts />
          {/* Unified status bar - fixed bottom bar showing real-time service health, keyboard shortcut: Cmd+Shift+H */}
          <UnifiedStatusBar />
        </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
