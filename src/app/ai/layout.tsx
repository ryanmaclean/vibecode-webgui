'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ErrorBoundary } from '@/components/error/ErrorBoundary'
import { logger } from '@/lib/logger'
import {
  MessageSquare,
  Bot,
  Cpu,
  DollarSign,
  BookOpen,
  History,
  FolderKanban,
  Store,
  Code,
} from 'lucide-react'

const NAV_ITEMS = [
  {
    title: 'Chat',
    href: '/ai/chat',
    icon: MessageSquare,
  },
  {
    title: 'Agents',
    href: '/ai/agents',
    icon: Bot,
  },
  {
    title: 'Models',
    href: '/ai/models',
    icon: Cpu,
  },
  {
    title: 'Costs',
    href: '/ai/costs',
    icon: DollarSign,
  },
  {
    title: 'Prompts',
    href: '/ai/prompts',
    icon: BookOpen,
  },
  {
    title: 'History',
    href: '/ai/conversations',
    icon: History,
  },
  {
    title: 'Projects',
    href: '/projects',
    icon: FolderKanban,
  },
  {
    title: 'Marketplace',
    href: '/marketplace',
    icon: Store,
  },
  {
    title: 'Editor',
    href: '/editor',
    icon: Code,
  },
]

export default function AILayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row md:space-x-8">
          {/* Sidebar */}
          <div className="w-full md:w-64 mb-6 md:mb-0">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-lg font-medium text-gray-900 mb-4">AI</h2>
              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={(e) => {
                        e.preventDefault()
                        router.push(item.href)
                      }}
                      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="mr-3 flex-shrink-0 h-5 w-5" />
                      {item.title}
                    </Link>
                  )
                })}
              </nav>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1">
            <ErrorBoundary
              onError={(error, errorInfo) => {
                logger.error('AI page error', { error, errorInfo })
              }}
              fallback={
                <div className="bg-white rounded-lg shadow-sm border border-red-200 p-8 text-center">
                  <div className="mb-4">
                    <svg
                      className="mx-auto h-16 w-16 text-red-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                    AI Dashboard Error
                  </h2>
                  <p className="text-gray-600 mb-6">
                    The AI dashboard encountered an unexpected error.
                    This could be due to a connection issue or data loading problem.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Reload Dashboard
                  </button>
                </div>
              }
            >
              {children}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  )
}
