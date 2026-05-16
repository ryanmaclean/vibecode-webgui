'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
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
import { CommandPalette } from '@/components/command-palette/CommandPalette'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import { KeyboardHint } from '@/components/ui/KeyboardHint'
import { createRovingTabIndex } from '@/lib/keyboard/focus-management'

interface NavItem {
  titleKey: string
  href: string
  icon: React.ElementType
  children?: { titleKey: string; href: string; icon: React.ElementType }[]
}

const NAV_ITEMS: NavItem[] = [
  {
    titleKey: 'dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    titleKey: 'vm',
    href: '/vm',
    icon: Monitor,
    children: [
      { titleKey: 'vmDashboard', href: '/vm', icon: Monitor },
      { titleKey: 'vmSnapshots', href: '/vm/snapshots', icon: Camera },
    ],
  },
  {
    titleKey: 'ai',
    href: '/ai',
    icon: Bot,
    children: [
      { titleKey: 'aiChat', href: '/chat', icon: MessageSquare },
      { titleKey: 'aiModels', href: '/ai/models', icon: Cpu },
      { titleKey: 'aiCosts', href: '/ai/costs', icon: DollarSign },
      { titleKey: 'aiPrompts', href: '/ai/prompts', icon: BookOpen },
    ],
  },
  {
    titleKey: 'health',
    href: '/health',
    icon: HeartPulse,
  },
  {
    titleKey: 'monitoring',
    href: '/monitoring',
    icon: Activity,
  },
  {
    titleKey: 'workspaces',
    href: '/workspaces',
    icon: Layers,
  },
  {
    titleKey: 'experiments',
    href: '/experiments',
    icon: FlaskConical,
  },
  {
    titleKey: 'tutorials',
    href: '/tutorials',
    icon: GraduationCap,
  },
  {
    titleKey: 'settings',
    href: '/settings',
    icon: Settings,
  },
]

// Keyboard shortcuts mapping for navigation items
const NAV_SHORTCUTS: Record<string, string[]> = {
  '/vm': ['⌘', 'T'],
  '/health': ['⌘', 'Shift', 'H'],
  '/settings': ['⌘', 'Shift', 'S'],
}

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
  t,
}: {
  item: NavItem
  pathname: string
  t: (key: string) => string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Setup roving tabindex when dropdown opens
  useEffect(() => {
    if (!open || !dropdownRef.current || !item.children) {
      return
    }

    // Filter out null refs
    const items = itemRefs.current.filter((el): el is HTMLAnchorElement => el !== null)
    if (items.length === 0) {
      return
    }

    // Create roving tabindex manager
    const rovingTabIndex = createRovingTabIndex(dropdownRef.current, items, {
      initialIndex: 0,
      wrap: true,
      direction: 'vertical',
    })

    // Custom keyboard handler for Enter and Escape
    const handleKeyDown = (event: KeyboardEvent) => {
      // Let roving tabindex handle arrow keys, Home, End
      rovingTabIndex.handleKeyDown(event)

      // Handle Enter key to activate link
      if (event.key === 'Enter') {
        event.preventDefault()
        const currentItem = items[rovingTabIndex.currentIndex]
        if (currentItem) {
          currentItem.click()
        }
      }

      // Handle Escape key to close dropdown
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        // Return focus to dropdown button
        const button = ref.current?.querySelector('button')
        button?.focus()
      }
    }

    dropdownRef.current.addEventListener('keydown', handleKeyDown)

    return () => {
      dropdownRef.current?.removeEventListener('keydown', handleKeyDown)
      rovingTabIndex.destroy()
    }
  }, [open, item.children])

  const Icon = item.icon
  const active = isActive(pathname, item.href) || isChildActive(pathname, item.children)
  const shortcut = NAV_SHORTCUTS[item.href]
  const itemTitle = t(`navigation.${item.titleKey}`)
  const ariaMenuLabel = item.titleKey === 'vm'
    ? t('navigation.ariaLabel.vmMenu')
    : item.titleKey === 'ai'
      ? t('navigation.ariaLabel.aiMenu')
      : `${itemTitle} menu`

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(e) => {
          // Open dropdown with Enter or Space
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
          // Close dropdown with Escape
          if (e.key === 'Escape' && open) {
            e.preventDefault()
            setOpen(false)
          }
        }}
        aria-expanded={open}
        aria-haspopup="true"
        className={`group relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        }`}
      >
        <Icon className="h-4 w-4" />
        {itemTitle}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        {shortcut && (
          <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <KeyboardHint keys={shortcut} size="sm" variant="muted" />
          </div>
        )}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="absolute left-0 top-full mt-1 w-48 rounded-md border border-border bg-card shadow-lg z-50"
          role="menu"
          aria-label={ariaMenuLabel}
        >
          <div className="py-1">
            {item.children?.map((child, index) => {
              const ChildIcon = child.icon
              const childActive = isActive(pathname, child.href)
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  ref={(el) => {
                    itemRefs.current[index] = el
                  }}
                  onClick={() => setOpen(false)}
                  role="menuitem"
                  tabIndex={-1}
                  className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    childActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <ChildIcon className="h-4 w-4" />
                  {t(`navigation.${child.titleKey}`)}
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
  const t = useTranslations()
  const pathname = usePathname() ?? '/'
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isShortcutsOpen, setIsShortcutsOpen } = useKeyboardShortcuts()
  const { isOpen: isCommandPaletteOpen, closeCommandPalette } = useCommandPalette()

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
            <span className="text-lg font-bold text-foreground">{t('common.appName')}</span>
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            if (item.children) {
              return <DropdownMenu key={item.titleKey} item={item} pathname={pathname} t={t} />
            }

            const Icon = item.icon
            const active = isActive(pathname, item.href)
            const shortcut = NAV_SHORTCUTS[item.href]

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t(`navigation.${item.titleKey}`)}
                {shortcut && (
                  <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <KeyboardHint keys={shortcut} size="sm" variant="muted" />
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Right side: shortcuts + user info + mobile toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsShortcutsOpen(true)}
            className="hidden md:flex items-center gap-1.5 p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label={t('navigation.showKeyboardShortcuts')}
            title={t('navigation.keyboardShortcutsHint')}
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
                {t('navigation.signOut')}
              </button>
            </div>
          )}
          <button
            className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? t('navigation.closeMenu') : t('navigation.openMenu')}
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
            const shortcut = NAV_SHORTCUTS[item.href]

            if (item.children) {
              const groupActive = isActive(pathname, item.href) || isChildActive(pathname, item.children)
              return (
                <div key={item.titleKey}>
                  <div
                    className={`flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md ${
                      groupActive ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {t(`navigation.${item.titleKey}`)}
                    </div>
                    {shortcut && (
                      <KeyboardHint keys={shortcut} size="sm" variant="muted" />
                    )}
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
                          {t(`navigation.${child.titleKey}`)}
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
                className={`flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {t(`navigation.${item.titleKey}`)}
                </div>
                {shortcut && (
                  <KeyboardHint keys={shortcut} size="sm" variant="muted" />
                )}
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
                {t('navigation.signOut')}
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
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={closeCommandPalette}
      />
    </header>
  )
}
