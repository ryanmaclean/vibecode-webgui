'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import {
  LayoutDashboard,
  Monitor,
  Camera,
  MessageSquare,
  Cpu,
  DollarSign,
  BookOpen,
  HeartPulse,
  Activity,
  Settings,
  Menu,
  X,
  ChevronDown,
  Bot,
  Keyboard,
  FlaskConical,
  Layers,
  GraduationCap,
} from 'lucide-react'
import { KeyboardShortcuts } from '@/design-system/components/KeyboardShortcuts'
import { useKeyboardShortcuts, shortcutCategories } from '@/hooks/useKeyboardShortcuts'

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  children?: { title: string; href: string; icon: React.ElementType }[]
}

const NAV_ITEMS: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'VM',
    href: '/vm',
    icon: Monitor,
    children: [
      { title: 'Dashboard', href: '/vm', icon: Monitor },
      { title: 'Snapshots', href: '/vm/snapshots', icon: Camera },
    ],
  },
  {
    title: 'AI',
    href: '/ai',
    icon: Bot,
    children: [
      { title: 'Chat', href: '/chat', icon: MessageSquare },
      { title: 'Models', href: '/ai/models', icon: Cpu },
      { title: 'Costs', href: '/ai/costs', icon: DollarSign },
      { title: 'Prompts', href: '/ai/prompts', icon: BookOpen },
    ],
  },
  {
    title: 'Health',
    href: '/health',
    icon: HeartPulse,
  },
  {
    title: 'Monitoring',
    href: '/monitoring',
    icon: Activity,
  },
  {
    title: 'Workspaces',
    href: '/workspaces',
    icon: Layers,
  },
  {
    title: 'Experiments',
    href: '/experiments',
    icon: FlaskConical,
  },
  {
    title: 'Tutorials',
    href: '/tutorials',
    icon: GraduationCap,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

function isChildActive(pathname: string, children: NavItem['children']): boolean {
  if (!children) return false
  return children.some((child) => isActive(pathname, child.href))
}

function DropdownMenu({
  item,
  pathname,
}: {
  item: NavItem
  pathname: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const Icon = item.icon
  const active = isActive(pathname, item.href) || isChildActive(pathname, item.children)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        }`}
      >
        <Icon className="h-4 w-4" />
        {item.title}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-48 rounded-md border border-border bg-card shadow-lg z-50">
          <div className="py-1">
            {item.children?.map((child) => {
              const ChildIcon = child.icon
              const childActive = isActive(pathname, child.href)
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    childActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <ChildIcon className="h-4 w-4" />
                  {child.title}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function AppNavigation() {
  const pathname = usePathname() ?? '/'
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isShortcutsOpen, setIsShortcutsOpen } = useKeyboardShortcuts()

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3">
        {/* Branding */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
            </div>
            <span className="text-lg font-bold text-foreground">VibeCode</span>
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            if (item.children) {
              return <DropdownMenu key={item.title} item={item} pathname={pathname} />
            }

            const Icon = item.icon
            const active = isActive(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </Link>
            )
          })}
        </nav>

        {/* Right side: shortcuts + user info + mobile toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsShortcutsOpen(true)}
            className="hidden md:flex items-center gap-1.5 p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Show keyboard shortcuts"
            title="Keyboard shortcuts (⌘/)"
          >
            <Keyboard className="h-4 w-4" />
          </button>
          {user && (
            <div className="hidden sm:flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {user.name || user.email}
              </span>
              <button
                onClick={() => logout()}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
          <button
            className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-border bg-card px-4 py-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon

            if (item.children) {
              const groupActive = isActive(pathname, item.href) || isChildActive(pathname, item.children)
              return (
                <div key={item.title}>
                  <div
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md ${
                      groupActive ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </div>
                  <div className="ml-6 space-y-1">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon
                      const childActive = isActive(pathname, child.href)
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                            childActive
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          }`}
                        >
                          <ChildIcon className="h-4 w-4" />
                          {child.title}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            }

            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </Link>
            )
          })}

          {user && (
            <div className="border-t border-border pt-3 mt-3 px-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{user.name || user.email}</span>
              <button
                onClick={() => logout()}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </nav>
      )}

      <KeyboardShortcuts
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
        shortcuts={shortcutCategories}
      />
    </header>
  )
}
