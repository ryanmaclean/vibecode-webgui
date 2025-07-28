import type { Metadata } from "next";
// Import CSS based on environment
import "./globals.css";
import Providers from './providers';
import DatadogRUM from '@/components/monitoring/DatadogRUM';

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
        {/* Tailwind CSS v4 CDN for local development only */}
        {process.env.DOCKER !== 'true' && (
          <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4" defer></script>
        )}
      </head>
      <body
        className="antialiased"
      >
        <DatadogRUM />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
