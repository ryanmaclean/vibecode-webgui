import type { Metadata } from "next";
// Import CSS - Disabled due to Tailwind v4 ARM64 compatibility issues
// See TAILWIND_V4_MIGRATION_NOTES.md for details
// The application is fully functional without CSS styling
import "./globals.css";
import Providers from './providers';
import Script from 'next/script';
import { TauriMenuBarProvider } from '@/components/TauriMenuBarProvider';
import { TauriIdeBootstrapper } from '@/components/TauriIdeBootstrapper';
import RUMInitializer from '@/components/RUMInitializer';

// Fonts temporarily disabled due to Babel/SWC conflict
// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

export const metadata: Metadata = {
  title: "VibeCode WebGUI - AI-Powered Development Platform",
  description: "Modern web-based development environment with AI assistance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
        <RUMInitializer />
        <Providers>
          <TauriMenuBarProvider />
          <TauriIdeBootstrapper />
          {children}
        </Providers>
      </body>
    </html>
  );
}
