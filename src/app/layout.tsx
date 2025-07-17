import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from './providers';
import DatadogRUM from '@/components/monitoring/DatadogRUM';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DatadogRUM />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
