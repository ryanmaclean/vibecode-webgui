/**
 * Skeleton Component Accessibility Demo
 * Demonstrates WCAG 2.1 AA compliant loading states
 *
 * This file showcases all skeleton variants with proper accessibility features:
 * - ARIA attributes for screen reader support
 * - Reduced motion support (prefers-reduced-motion)
 * - Semantic HTML structure
 * - Proper contrast ratios
 *
 * @example
 * // Basic usage
 * <Skeleton className="h-4 w-full" />
 *
 * @example
 * // Multi-line text loading
 * <SkeletonText lines={3} />
 *
 * @example
 * // Card layout loading
 * <SkeletonCard />
 */

'use client'

import { useState } from 'react'
import { Skeleton, SkeletonWithFade, SkeletonText, SkeletonCard } from './skeleton'

export function SkeletonDemo() {
  const [showContent, setShowContent] = useState(false)

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-12">
      <header>
        <h1 className="text-3xl font-bold mb-2">Accessible Skeleton Components</h1>
        <p className="text-gray-600 dark:text-gray-400">
          WCAG 2.1 AA compliant loading states with reduced motion support
        </p>
      </header>

      {/* Basic Skeleton Examples */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Basic Skeleton Shapes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Rectangle */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Rectangle
            </h3>
            <Skeleton className="h-20 w-full" aria-label="Loading rectangle content" />
            <p className="text-xs text-gray-500">
              Used for images, cards, or content blocks
            </p>
          </div>

          {/* Circle */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Circle (Avatar)
            </h3>
            <Skeleton
              className="h-20 w-20 rounded-full"
              aria-label="Loading user avatar"
            />
            <p className="text-xs text-gray-500">
              Used for profile pictures and circular icons
            </p>
          </div>

          {/* Line */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Line (Text)
            </h3>
            <Skeleton className="h-4 w-full" aria-label="Loading text line" />
            <p className="text-xs text-gray-500">
              Used for single lines of text
            </p>
          </div>
        </div>
      </section>

      {/* Text Loading States */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Text Content Loading</h2>
        <div className="space-y-6">
          {/* Single Line */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Single Line
            </h3>
            <SkeletonText lines={1} aria-label="Loading heading" />
          </div>

          {/* Paragraph */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Paragraph (3 lines)
            </h3>
            <SkeletonText lines={3} aria-label="Loading paragraph content" />
          </div>

          {/* Long Content */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Long Content (5 lines)
            </h3>
            <SkeletonText lines={5} aria-label="Loading article content" />
          </div>
        </div>
      </section>

      {/* Card Loading States */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Card Layout Loading</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard aria-label="Loading product card" />
          <SkeletonCard aria-label="Loading user profile card" />
          <SkeletonCard aria-label="Loading article card" />
        </div>
      </section>

      {/* Custom Layout Example */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Custom Layout: User Profile</h2>
        <div
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-6"
          role="status"
          aria-label="Loading user profile"
          aria-busy="true"
        >
          <div className="flex items-start space-x-4">
            {/* Avatar */}
            <Skeleton
              className="h-16 w-16 rounded-full flex-shrink-0"
              aria-label="Loading profile picture"
            />

            {/* User Info */}
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-48" aria-label="Loading name" />
              <Skeleton className="h-4 w-64" aria-label="Loading bio" />

              {/* Stats */}
              <div className="flex space-x-6 pt-2">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" aria-label="Loading followers count" />
                  <Skeleton className="h-3 w-16" aria-label="Loading followers label" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" aria-label="Loading following count" />
                  <Skeleton className="h-3 w-16" aria-label="Loading following label" />
                </div>
              </div>
            </div>

            {/* Action Button */}
            <Skeleton className="h-10 w-24" aria-label="Loading action button" />
          </div>
        </div>
      </section>

      {/* Fade Transition Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Fade Transition Demo</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Click the button to see the smooth transition from loading to content
        </p>

        <div className="space-y-4">
          <button
            onClick={() => setShowContent(!showContent)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {showContent ? 'Show Loading State' : 'Load Content'}
          </button>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            {!showContent ? (
              <div className="space-y-4">
                <SkeletonWithFade className="h-8 w-3/4" aria-label="Loading title" />
                <SkeletonWithFade className="h-4 w-full" />
                <SkeletonWithFade className="h-4 w-full" />
                <SkeletonWithFade className="h-4 w-2/3" />
              </div>
            ) : (
              <div className="space-y-4 animate-fadeIn">
                <h3 className="text-2xl font-bold">Content Loaded!</h3>
                <p>This content appeared with a smooth fade transition.</p>
                <p>The skeleton component supports graceful loading states that enhance user experience.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Reduced Motion Support */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Reduced Motion Support</h2>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            All skeleton components respect the <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">prefers-reduced-motion</code> media query.
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            To test: Enable &quot;Reduce motion&quot; in your operating system&apos;s accessibility settings.
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>macOS: System Preferences → Accessibility → Display → Reduce motion</li>
            <li>Windows: Settings → Ease of Access → Display → Show animations</li>
            <li>Linux: Varies by desktop environment</li>
          </ul>
          <div className="pt-4 space-y-2">
            <h3 className="text-sm font-medium">With reduced motion enabled:</h3>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" aria-label="Loading with reduced motion" />
              <Skeleton className="h-4 w-3/4" aria-label="Loading with reduced motion" />
              <p className="text-xs text-gray-500">
                Animation is disabled, but visual feedback remains through opacity
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Accessibility Features */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Accessibility Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-green-600 dark:text-green-400">
              ✓ ARIA Attributes
            </h3>
            <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
              <li><code>role=&quot;status&quot;</code> - Identifies loading region</li>
              <li><code>aria-busy=&quot;true&quot;</code> - Indicates active loading</li>
              <li><code>aria-label</code> - Provides context for screen readers</li>
              <li><code>aria-live=&quot;polite&quot;</code> - Announces updates</li>
            </ul>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-green-600 dark:text-green-400">
              ✓ Reduced Motion
            </h3>
            <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
              <li>Respects <code>prefers-reduced-motion</code></li>
              <li>Disables animations when requested</li>
              <li>Maintains visual feedback via opacity</li>
              <li>Prevents motion-triggered discomfort</li>
            </ul>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-green-600 dark:text-green-400">
              ✓ Semantic HTML
            </h3>
            <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
              <li>Uses appropriate HTML elements</li>
              <li>Proper heading hierarchy</li>
              <li>Meaningful element structure</li>
              <li>Screen reader friendly markup</li>
            </ul>
          </div>

          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-green-600 dark:text-green-400">
              ✓ Visual Contrast
            </h3>
            <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
              <li>Meets WCAG 2.1 AA standards</li>
              <li>Light and dark theme support</li>
              <li>Sufficient contrast ratios</li>
              <li>Visible in various conditions</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Testing Recommendations */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Testing Recommendations</h2>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-4">
          <h3 className="font-semibold">Manual Testing</h3>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>
              <strong>Screen Reader:</strong> Test with NVDA (Windows), JAWS (Windows), or VoiceOver (macOS/iOS)
              <ul className="ml-4 mt-1 list-disc list-inside text-gray-600 dark:text-gray-400">
                <li>Verify loading states are announced</li>
                <li>Check aria-label descriptions are clear</li>
                <li>Ensure proper role and status communication</li>
              </ul>
            </li>
            <li>
              <strong>Reduced Motion:</strong> Enable system preference and verify animations disable
            </li>
            <li>
              <strong>Keyboard Navigation:</strong> Ensure loading states don&apos;t trap focus</li>
            <li>
              <strong>Color Contrast:</strong> Use browser DevTools to verify contrast ratios</li>
          </ul>

          <h3 className="font-semibold pt-4">Automated Testing</h3>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto text-xs">
{`// Jest + Testing Library Example
import { render, screen } from '@testing-library/react'
import { Skeleton } from './skeleton'

test('skeleton has proper accessibility attributes', () => {
  render(<Skeleton aria-label="Loading content" />)

  const skeleton = screen.getByRole('status')
  expect(skeleton).toHaveAttribute('aria-busy', 'true')
  expect(skeleton).toHaveAttribute('aria-label', 'Loading content')
})

test('skeleton respects reduced motion', () => {
  const { container } = render(<Skeleton />)
  const skeleton = container.firstChild

  expect(skeleton).toHaveClass('motion-reduce:animate-none')
  expect(skeleton).toHaveClass('motion-reduce:opacity-70')
})

// Playwright E2E Example
test('loading states are accessible', async ({ page }) => {
  await page.goto('/workspaces')

  // Wait for skeleton to appear
  const skeleton = page.getByRole('status', { name: 'Loading workspaces' })
  await expect(skeleton).toBeVisible()

  // Verify aria-busy
  await expect(skeleton).toHaveAttribute('aria-busy', 'true')

  // Wait for content to load
  await expect(skeleton).toBeHidden({ timeout: 5000 })
})`}
          </pre>
        </div>
      </section>
    </div>
  )
}
