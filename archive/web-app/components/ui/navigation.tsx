/**
 * Navigation component with marketplace integration
 */

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  HomeIcon,
  MagnifyingGlassIcon,
  CodeBracketIcon,
  DocumentPlusIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline'

const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: HomeIcon,
    description: 'AI-powered development workspace'
  },
  {
    name: 'AI Chat',
    href: '/chat',
    icon: ChatBubbleLeftRightIcon,
    description: 'Chat with AI assistant'
  },
  {
    name: 'File Upload',
    href: '/upload',
    icon: ArrowUpTrayIcon,
    description: 'Upload and manage files'
  },
  {
    name: 'Templates',
    href: '/marketplace',
    icon: MagnifyingGlassIcon,
    description: 'Browse and discover project templates'
  },
  {
    name: 'My Projects',
    href: '/projects',
    icon: CodeBracketIcon,
    description: 'View your generated projects'
  },
  {
    name: 'Submit Template',
    href: '/marketplace?tab=submit',
    icon: DocumentPlusIcon,
    description: 'Share your template with the community'
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Cog6ToothIcon,
    description: 'Configure your preferences'
  }
]

interface NavigationProps {
  className?: string
  variant?: 'sidebar' | 'header'
}

export function Navigation({ className, variant = 'sidebar' }: NavigationProps) {
  const pathname = usePathname()

  if (variant === 'header') {
    return (
      <nav className={cn('flex items-center gap-6', className)}>
        {navigation.slice(0, 3).map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {item.name}
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <nav className={cn('space-y-2', className)}>
      {navigation.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon

        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Icon className="h-4 w-4" />
            <div className="flex-1">
              <div>{item.name}</div>
              <div className="text-xs opacity-70">{item.description}</div>
            </div>
          </Link>
        )
      })}
    </nav>
  )
}