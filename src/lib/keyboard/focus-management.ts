/**
 * Focus Management Utilities
 * Provides utilities for keyboard navigation, focus trapping, and accessibility
 * WCAG 2.1 AA compliant focus management
 */

/**
 * Selector for all focusable elements
 */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'iframe',
  'object',
  'embed',
  '[contenteditable]',
  'audio[controls]',
  'video[controls]',
].join(', ')

/**
 * Focus trap configuration
 */
export interface FocusTrapConfig {
  /**
   * Whether to focus the first element when the trap is activated
   */
  autoFocus?: boolean
  /**
   * Whether to return focus to the previously focused element when the trap is deactivated
   */
  returnFocus?: boolean
  /**
   * Callback when focus trap is activated
   */
  onActivate?: () => void
  /**
   * Callback when focus trap is deactivated
   */
  onDeactivate?: () => void
}

/**
 * Focus trap state
 */
export interface FocusTrap {
  /**
   * Activate the focus trap
   */
  activate: () => void
  /**
   * Deactivate the focus trap
   */
  deactivate: () => void
  /**
   * Whether the focus trap is currently active
   */
  isActive: boolean
}

/**
 * Roving tabindex configuration
 */
export interface RovingTabIndexConfig {
  /**
   * Initial index to focus
   */
  initialIndex?: number
  /**
   * Whether to wrap around when reaching the end
   */
  wrap?: boolean
  /**
   * Direction of navigation (horizontal or vertical)
   */
  direction?: 'horizontal' | 'vertical'
}

/**
 * Check if an element is visible in the viewport
 */
export function isElementVisible(element: HTMLElement): boolean {
  if (!element) {
    return false
  }

  // Check if element has display: none or visibility: hidden
  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false
  }

  // Check if element has zero dimensions
  const rect = element.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    return false
  }

  // Check if element is hidden by parent
  let parent = element.parentElement
  while (parent) {
    const parentStyle = window.getComputedStyle(parent)
    if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
      return false
    }
    parent = parent.parentElement
  }

  return true
}

/**
 * Check if an element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  if (!element) {
    return false
  }

  // Check if element matches focusable selector
  if (!element.matches(FOCUSABLE_SELECTOR)) {
    return false
  }

  // Check if element is visible
  if (!isElementVisible(element)) {
    return false
  }

  // Check for disabled attribute
  if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') {
    return false
  }

  return true
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  if (!container) {
    return []
  }

  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  )

  return elements.filter(isFocusable)
}

/**
 * Get the first focusable element within a container
 */
export function getFirstFocusableElement(container: HTMLElement): HTMLElement | null {
  const elements = getFocusableElements(container)
  return elements[0] || null
}

/**
 * Get the last focusable element within a container
 */
export function getLastFocusableElement(container: HTMLElement): HTMLElement | null {
  const elements = getFocusableElements(container)
  return elements[elements.length - 1] || null
}

/**
 * Safely focus an element
 */
export function focusElement(element: HTMLElement | null): boolean {
  if (!element || !isFocusable(element)) {
    return false
  }

  try {
    element.focus()
    return document.activeElement === element
  } catch (error) {
    console.error('Failed to focus element:', error)
    return false
  }
}

/**
 * Create a focus trap for a container element
 */
export function createFocusTrap(
  container: HTMLElement,
  config: FocusTrapConfig = {}
): FocusTrap {
  const {
    autoFocus = true,
    returnFocus = true,
    onActivate,
    onDeactivate,
  } = config

  let previouslyFocusedElement: HTMLElement | null = null
  let isActive = false

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (!isActive || event.key !== 'Tab') {
      return
    }

    const focusableElements = getFocusableElements(container)
    if (focusableElements.length === 0) {
      event.preventDefault()
      return
    }

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    const currentElement = document.activeElement as HTMLElement

    if (event.shiftKey) {
      // Shift + Tab: move backwards
      if (currentElement === firstElement) {
        event.preventDefault()
        focusElement(lastElement)
      }
    } else {
      // Tab: move forwards
      if (currentElement === lastElement) {
        event.preventDefault()
        focusElement(firstElement)
      }
    }
  }

  const activate = (): void => {
    if (isActive) {
      return
    }

    // Store previously focused element
    previouslyFocusedElement = document.activeElement as HTMLElement

    // Add event listener
    container.addEventListener('keydown', handleKeyDown)

    // Focus first element if autoFocus is enabled
    if (autoFocus) {
      const firstElement = getFirstFocusableElement(container)
      if (firstElement) {
        focusElement(firstElement)
      }
    }

    isActive = true
    onActivate?.()
  }

  const deactivate = (): void => {
    if (!isActive) {
      return
    }

    // Remove event listener
    container.removeEventListener('keydown', handleKeyDown)

    // Restore focus to previously focused element
    if (returnFocus && previouslyFocusedElement) {
      focusElement(previouslyFocusedElement)
      previouslyFocusedElement = null
    }

    isActive = false
    onDeactivate?.()
  }

  return {
    activate,
    deactivate,
    get isActive() {
      return isActive
    },
  }
}

/**
 * Create a roving tabindex manager for a list or grid
 * Allows arrow key navigation through items
 */
export function createRovingTabIndex(
  container: HTMLElement,
  items: HTMLElement[],
  config: RovingTabIndexConfig = {}
): {
  currentIndex: number
  setCurrentIndex: (index: number) => void
  handleKeyDown: (event: KeyboardEvent) => void
  destroy: () => void
} {
  const {
    initialIndex = 0,
    wrap = true,
    direction = 'vertical',
  } = config

  let currentIndex = initialIndex

  const updateTabIndex = (index: number): void => {
    items.forEach((item, i) => {
      if (i === index) {
        item.setAttribute('tabindex', '0')
        item.focus()
      } else {
        item.setAttribute('tabindex', '-1')
      }
    })
  }

  const setCurrentIndex = (index: number): void => {
    if (index < 0 || index >= items.length) {
      return
    }
    currentIndex = index
    updateTabIndex(index)
  }

  const handleKeyDown = (event: KeyboardEvent): void => {
    const isVertical = direction === 'vertical'
    const nextKey = isVertical ? 'ArrowDown' : 'ArrowRight'
    const prevKey = isVertical ? 'ArrowUp' : 'ArrowLeft'

    switch (event.key) {
      case nextKey:
        event.preventDefault()
        if (currentIndex < items.length - 1) {
          setCurrentIndex(currentIndex + 1)
        } else if (wrap) {
          setCurrentIndex(0)
        }
        break

      case prevKey:
        event.preventDefault()
        if (currentIndex > 0) {
          setCurrentIndex(currentIndex - 1)
        } else if (wrap) {
          setCurrentIndex(items.length - 1)
        }
        break

      case 'Home':
        event.preventDefault()
        setCurrentIndex(0)
        break

      case 'End':
        event.preventDefault()
        setCurrentIndex(items.length - 1)
        break

      default:
        break
    }
  }

  // Initialize tabindex
  updateTabIndex(currentIndex)

  // Cleanup function
  const destroy = (): void => {
    items.forEach((item) => {
      item.removeAttribute('tabindex')
    })
  }

  return {
    get currentIndex() {
      return currentIndex
    },
    setCurrentIndex,
    handleKeyDown,
    destroy,
  }
}

/**
 * Restore focus to a previously focused element
 */
export function restoreFocus(element: HTMLElement | null): boolean {
  if (!element) {
    return false
  }

  return focusElement(element)
}

/**
 * Get the next focusable element in the document
 */
export function getNextFocusableElement(currentElement: HTMLElement): HTMLElement | null {
  const allFocusable = getFocusableElements(document.body)
  const currentIndex = allFocusable.indexOf(currentElement)

  if (currentIndex === -1) {
    return allFocusable[0] || null
  }

  return allFocusable[currentIndex + 1] || allFocusable[0] || null
}

/**
 * Get the previous focusable element in the document
 */
export function getPreviousFocusableElement(currentElement: HTMLElement): HTMLElement | null {
  const allFocusable = getFocusableElements(document.body)
  const currentIndex = allFocusable.indexOf(currentElement)

  if (currentIndex === -1) {
    return allFocusable[allFocusable.length - 1] || null
  }

  return allFocusable[currentIndex - 1] || allFocusable[allFocusable.length - 1] || null
}

/**
 * Trap focus within a modal or dialog
 * Returns a cleanup function
 */
export function trapFocus(
  container: HTMLElement,
  options: FocusTrapConfig = {}
): () => void {
  const focusTrap = createFocusTrap(container, options)
  focusTrap.activate()

  return () => {
    focusTrap.deactivate()
  }
}
