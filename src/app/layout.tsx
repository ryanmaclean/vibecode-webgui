import type { Metadata } from "next";
// Import CSS - Disabled due to Tailwind v4 ARM64 compatibility issues
// See TAILWIND_V4_MIGRATION_NOTES.md for details
// The application is fully functional without CSS styling
import "./globals.css";
import Providers from './providers';

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
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const useDockerMode = process.env.DOCKER === 'true';
  
  return (
    <html lang="en">
      <head>
        {/* Tailwind CSS v4 Browser Bundle - Loaded locally when not using Docker mode */}
        {isDevelopment && !useDockerMode && (
          <script 
            src="/js/tailwind-browser.js"
            defer
          />
        )}
      </head>
      <body
        className="antialiased bg-background text-foreground min-h-screen"
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
