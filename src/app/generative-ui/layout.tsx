import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Generative UI Chat',
  description: 'AI-powered generative UI chat interface'
}

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default function GenerativeUILayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
