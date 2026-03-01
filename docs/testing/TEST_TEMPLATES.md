# Test Templates

This guide provides templates for common test patterns used in the Harness project. These templates follow our established conventions and best practices.

## Table of Contents

1. [Component Test Template](#component-test-template)
2. [Hook Test Template](#hook-test-template)
3. [API Route Test Template](#api-route-test-template)
4. [E2E Test Template](#e2e-test-template)
5. [Utility Function Test Template](#utility-function-test-template)

---

## Component Test Template

Use this template for testing React components with React Testing Library and Jest.

```typescript
// Unit tests for [ComponentName]
// Tests core functionality, state management, and user interactions

import React from 'react'
import { screen, fireEvent, waitFor, renderWithProviders } from '@/../tests/test-utils'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import ComponentName from '@/components/path/to/ComponentName'

// Mock global APIs if needed
// global.URL.createObjectURL = jest.fn((file: Blob) => `blob:${(file as File).name}`);

describe('ComponentName', () => {
  const defaultProps = {
    // Define default props here
    exampleProp: 'test-value',
    onExampleCallback: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock fetch or other global APIs
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
    }) as any;
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('renders with default state', async () => {
      renderWithProviders(<ComponentName {...defaultProps} />)

      expect(screen.getByText('Expected Text')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Expected Placeholder')).toBeInTheDocument()
    })

    it('applies custom className', async () => {
      renderWithProviders(<ComponentName {...defaultProps} className="custom-class" />)

      const element = screen.getByRole('region', { name: /component name/i })
      expect(element).toHaveClass('custom-class')
    })

    it('renders with conditional props', async () => {
      renderWithProviders(<ComponentName {...defaultProps} showExtra={true} />)

      expect(screen.getByText('Extra Content')).toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('handles button click', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ComponentName {...defaultProps} />)

      const button = screen.getByRole('button', { name: /click me/i })
      await user.click(button)

      expect(defaultProps.onExampleCallback).toHaveBeenCalledWith(/* expected args */)
    })

    it('handles input change', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ComponentName {...defaultProps} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'test input')

      expect(input).toHaveValue('test input')
    })

    it('handles keyboard shortcuts', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ComponentName {...defaultProps} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'test{Enter}')

      expect(defaultProps.onExampleCallback).toHaveBeenCalled()
    })
  })

  describe('State Management', () => {
    it('updates state on user action', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ComponentName {...defaultProps} />)

      const button = screen.getByRole('button', { name: /toggle/i })
      await user.click(button)

      expect(screen.getByText('Updated State')).toBeInTheDocument()
    })

    it('loads data on mount', async () => {
      const mockData = [{ id: '1', name: 'Test' }];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockData })
      });

      renderWithProviders(<ComponentName {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('handles API errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      renderWithProviders(<ComponentName {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument()
      })
    })

    it('handles invalid prop gracefully', async () => {
      renderWithProviders(<ComponentName {...defaultProps} invalidProp={null} />)

      // Should not crash
      expect(screen.getByRole('region')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', async () => {
      renderWithProviders(<ComponentName {...defaultProps} />)

      expect(screen.getByRole('button', { name: /accessible name/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/form label/i)).toBeInTheDocument()
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ComponentName {...defaultProps} />)

      const button = screen.getByRole('button')
      await user.tab()

      expect(button).toHaveFocus()
    })
  })

  describe('Responsive Design', () => {
    it('adapts to different screen sizes', async () => {
      renderWithProviders(<ComponentName {...defaultProps} />)

      const container = screen.getByRole('region')
      expect(container).toHaveClass('flex', 'flex-col')
    })
  })
})
```

---

## Hook Test Template

Use this template for testing custom React hooks.

```typescript
// Unit tests for [useHookName]
// Tests hook behavior, state updates, and side effects

import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import useHookName from '@/hooks/useHookName'

describe('useHookName', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Mock dependencies
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    }) as any;
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Initialization', () => {
    it('initializes with default values', () => {
      const { result } = renderHook(() => useHookName())

      expect(result.current.value).toBe(null)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('initializes with provided options', () => {
      const { result } = renderHook(() => useHookName({ initialValue: 'test' }))

      expect(result.current.value).toBe('test')
    })
  })

  describe('State Updates', () => {
    it('updates state when action is called', async () => {
      const { result } = renderHook(() => useHookName())

      act(() => {
        result.current.updateValue('new value')
      })

      expect(result.current.value).toBe('new value')
    })

    it('handles async operations', async () => {
      const mockData = { id: '1', name: 'Test' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData)
      });

      const { result } = renderHook(() => useHookName())

      await act(async () => {
        await result.current.fetchData()
      })

      await waitFor(() => {
        expect(result.current.data).toEqual(mockData)
        expect(result.current.isLoading).toBe(false)
      })
    })
  })

  describe('Side Effects', () => {
    it('calls cleanup on unmount', () => {
      const cleanup = jest.fn()

      const { unmount } = renderHook(() => useHookName({ onCleanup: cleanup }))

      unmount()

      expect(cleanup).toHaveBeenCalled()
    })

    it('re-runs effect when dependency changes', () => {
      const effectFn = jest.fn()
      const { rerender } = renderHook(
        ({ dep }) => useHookName({ dependency: dep, onEffect: effectFn }),
        { initialProps: { dep: 'initial' } }
      )

      expect(effectFn).toHaveBeenCalledTimes(1)

      rerender({ dep: 'updated' })

      expect(effectFn).toHaveBeenCalledTimes(2)
    })
  })

  describe('Error Handling', () => {
    it('handles errors in async operations', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderHook(() => useHookName())

      await act(async () => {
        await result.current.fetchData()
      })

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
        expect(result.current.isLoading).toBe(false)
      })
    })
  })
})
```

---

## API Route Test Template

Use this template for testing Next.js API routes.

```typescript
// Unit tests for [API Route Name]
// Tests request handling, validation, and error responses

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NextRequest } from 'next/server'
import { GET, POST, PUT, DELETE } from '@/app/api/path/to/route'

describe('API Route: /api/path/to/route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('GET', () => {
    it('returns data successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/path')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('data')
    })

    it('handles query parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/path?id=123')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.id).toBe('123')
    })

    it('returns 404 when resource not found', async () => {
      const request = new NextRequest('http://localhost:3000/api/path?id=nonexistent')

      const response = await GET(request)

      expect(response.status).toBe(404)
    })
  })

  describe('POST', () => {
    it('creates resource successfully', async () => {
      const body = { name: 'Test', value: 'test-value' }
      const request = new NextRequest('http://localhost:3000/api/path', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toHaveProperty('id')
      expect(data.name).toBe('Test')
    })

    it('validates request body', async () => {
      const invalidBody = { name: '' }
      const request = new NextRequest('http://localhost:3000/api/path', {
        method: 'POST',
        body: JSON.stringify(invalidBody),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeTruthy()
    })

    it('handles malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/path', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
    })
  })

  describe('PUT', () => {
    it('updates resource successfully', async () => {
      const body = { name: 'Updated' }
      const request = new NextRequest('http://localhost:3000/api/path/123', {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(request, { params: { id: '123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.name).toBe('Updated')
    })

    it('returns 404 when updating non-existent resource', async () => {
      const body = { name: 'Updated' }
      const request = new NextRequest('http://localhost:3000/api/path/999', {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(request, { params: { id: '999' } })

      expect(response.status).toBe(404)
    })
  })

  describe('DELETE', () => {
    it('deletes resource successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/path/123', {
        method: 'DELETE'
      })

      const response = await DELETE(request, { params: { id: '123' } })

      expect(response.status).toBe(204)
    })

    it('returns 404 when deleting non-existent resource', async () => {
      const request = new NextRequest('http://localhost:3000/api/path/999', {
        method: 'DELETE'
      })

      const response = await DELETE(request, { params: { id: '999' } })

      expect(response.status).toBe(404)
    })
  })

  describe('Error Handling', () => {
    it('handles server errors gracefully', async () => {
      // Mock a database error or similar
      jest.spyOn(console, 'error').mockImplementation(() => {})

      const request = new NextRequest('http://localhost:3000/api/path')

      const response = await GET(request)

      expect(response.status).toBe(500)
    })
  })

  describe('Authentication', () => {
    it('requires authentication', async () => {
      const request = new NextRequest('http://localhost:3000/api/path', {
        headers: {} // No auth header
      })

      const response = await GET(request)

      expect(response.status).toBe(401)
    })

    it('validates authentication token', async () => {
      const request = new NextRequest('http://localhost:3000/api/path', {
        headers: { 'Authorization': 'Bearer invalid-token' }
      })

      const response = await GET(request)

      expect(response.status).toBe(401)
    })
  })
})
```

---

## E2E Test Template

Use this template for end-to-end tests with Playwright.

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the page before each test
    await page.goto('/path/to/page');
  });

  describe('Page Navigation and Rendering', () => {
    test('should navigate to page and render component', async ({ page }) => {
      // Verify URL
      await expect(page).toHaveURL(/.*\/path/);

      // Verify page title
      await expect(page.locator('h1')).toContainText('Expected Title');

      // Verify main component is rendered
      await expect(page.locator('[data-testid="main-component"]')).toBeVisible();

      // Verify key UI elements
      await expect(page.locator('[data-testid="element-1"]')).toBeVisible();
      await expect(page.locator('[data-testid="element-2"]')).toBeVisible();
    });

    test('should display empty state when no data', async ({ page }) => {
      await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
      await expect(page.locator('[data-testid="empty-state"]')).toContainText('No data available');
    });
  });

  describe('User Interactions', () => {
    test('should handle form input', async ({ page }) => {
      const input = page.locator('[data-testid="text-input"]');
      const submitButton = page.locator('[data-testid="submit-button"]');

      // Initially button should be disabled
      await expect(submitButton).toBeDisabled();

      // Type in input
      await input.fill('Test input');

      // Verify input value
      await expect(input).toHaveValue('Test input');

      // Button should now be enabled
      await expect(submitButton).toBeEnabled();
    });

    test('should submit form and display result', async ({ page }) => {
      const input = page.locator('[data-testid="text-input"]');
      const submitButton = page.locator('[data-testid="submit-button"]');

      // Fill and submit form
      await input.fill('Test data');
      await submitButton.click();

      // Wait for result to appear
      await expect(page.locator('[data-testid="result"]')).toBeVisible({ timeout: 5000 });

      // Verify result content
      await expect(page.locator('[data-testid="result"]')).toContainText('Test data');

      // Verify input is cleared
      await expect(input).toHaveValue('');
    });

    test('should handle keyboard shortcuts', async ({ page }) => {
      const input = page.locator('[data-testid="text-input"]');

      // Type and press Enter
      await input.fill('Keyboard test');
      await input.press('Enter');

      // Verify action was triggered
      await expect(page.locator('[data-testid="result"]')).toBeVisible({ timeout: 5000 });
    });

    test('should handle multi-line input with Shift+Enter', async ({ page }) => {
      const textarea = page.locator('[data-testid="textarea"]');

      // Type and press Shift+Enter
      await textarea.fill('Line 1');
      await textarea.press('Shift+Enter');
      await textarea.type('Line 2');

      // Verify newline was added
      const value = await textarea.inputValue();
      expect(value).toContain('\n');

      // Verify form was not submitted
      await expect(page.locator('[data-testid="result"]')).not.toBeVisible();
    });
  });

  describe('Async Operations', () => {
    test('should display loading indicator during async operation', async ({ page }) => {
      const submitButton = page.locator('[data-testid="submit-button"]');

      await submitButton.click();

      // Check for loading indicator
      await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible({ timeout: 5000 });
    });

    test('should handle async operation completion', async ({ page }) => {
      const submitButton = page.locator('[data-testid="submit-button"]');

      await submitButton.click();

      // Wait for result
      await expect(page.locator('[data-testid="result"]')).toBeVisible({ timeout: 30000 });

      // Verify loading indicator is gone
      await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible();
    });
  });

  describe('State Management', () => {
    test('should maintain state across multiple actions', async ({ page }) => {
      const input = page.locator('[data-testid="text-input"]');
      const submitButton = page.locator('[data-testid="submit-button"]');

      // First action
      await input.fill('First action');
      await submitButton.click();
      await expect(page.locator('[data-testid="item"]')).toHaveCount(1);

      // Wait to avoid race condition
      await page.waitForTimeout(1000);

      // Second action
      await input.fill('Second action');
      await submitButton.click();

      // Verify both items exist
      await expect(page.locator('[data-testid="item"]')).toHaveCount(2, { timeout: 5000 });
    });

    test('should clear state when clear button is clicked', async ({ page }) => {
      const clearButton = page.locator('[data-testid="clear-button"]');

      // Initially disabled
      await expect(clearButton).toBeDisabled();

      // Add some data
      await page.locator('[data-testid="submit-button"]').click();
      await expect(page.locator('[data-testid="item"]')).toHaveCount(1);

      // Clear should be enabled
      await expect(clearButton).toBeEnabled();

      // Click clear
      await clearButton.click();

      // Verify data is cleared
      await expect(page.locator('[data-testid="item"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
    });
  });

  describe('Selections and Options', () => {
    test('should allow option selection', async ({ page }) => {
      const selector = page.locator('[data-testid="option-selector"]');

      // Verify default selection
      await expect(selector).toHaveValue('default-option');

      // Change selection
      await selector.selectOption('new-option');

      // Verify selection changed
      await expect(selector).toHaveValue('new-option');
    });
  });

  describe('Error Handling', () => {
    test('should display error message on failure', async ({ page }) => {
      // Trigger an error condition
      await page.locator('[data-testid="error-trigger"]').click();

      // Verify error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Error');
    });
  });

  describe('Responsive Behavior', () => {
    test('should adapt to mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Verify mobile-specific elements
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    });

    test('should adapt to desktop viewport', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });

      // Verify desktop-specific elements
      await expect(page.locator('[data-testid="desktop-sidebar"]')).toBeVisible();
    });
  });
});
```

---

## Utility Function Test Template

Use this template for testing utility functions and helper modules.

```typescript
// Unit tests for [utilityName]
// Tests function behavior, edge cases, and error handling

import { describe, it, expect } from '@jest/globals'
import { utilityFunction } from '@/lib/utils/utilityName'

describe('utilityFunction', () => {
  describe('Basic Functionality', () => {
    it('returns expected result for valid input', () => {
      const result = utilityFunction('valid-input')

      expect(result).toBe('expected-output')
    })

    it('handles different input types', () => {
      expect(utilityFunction('string')).toBe('result1')
      expect(utilityFunction(123)).toBe('result2')
      expect(utilityFunction(true)).toBe('result3')
    })

    it('processes arrays correctly', () => {
      const input = ['a', 'b', 'c']
      const result = utilityFunction(input)

      expect(result).toEqual(['processed-a', 'processed-b', 'processed-c'])
    })

    it('processes objects correctly', () => {
      const input = { key: 'value' }
      const result = utilityFunction(input)

      expect(result).toEqual({ key: 'processed-value' })
    })
  })

  describe('Edge Cases', () => {
    it('handles empty input', () => {
      expect(utilityFunction('')).toBe('')
      expect(utilityFunction([])).toEqual([])
      expect(utilityFunction({})).toEqual({})
    })

    it('handles null and undefined', () => {
      expect(utilityFunction(null)).toBe(null)
      expect(utilityFunction(undefined)).toBe(undefined)
    })

    it('handles very large input', () => {
      const largeInput = 'x'.repeat(10000)
      const result = utilityFunction(largeInput)

      expect(result).toBeDefined()
    })

    it('handles special characters', () => {
      const specialInput = '!@#$%^&*()'
      const result = utilityFunction(specialInput)

      expect(result).toBeTruthy()
    })
  })

  describe('Error Handling', () => {
    it('throws error for invalid input', () => {
      expect(() => utilityFunction('invalid')).toThrow('Invalid input')
    })

    it('throws specific error type', () => {
      expect(() => utilityFunction('invalid')).toThrow(TypeError)
    })

    it('handles errors gracefully with fallback', () => {
      const result = utilityFunction('risky-input', { fallback: 'default' })

      expect(result).toBe('default')
    })
  })

  describe('Options and Configuration', () => {
    it('respects configuration options', () => {
      const result = utilityFunction('input', { option: true })

      expect(result).toBe('option-enabled-result')
    })

    it('uses default options when not provided', () => {
      const result = utilityFunction('input')

      expect(result).toBe('default-option-result')
    })

    it('overrides default options', () => {
      const result = utilityFunction('input', { override: 'custom' })

      expect(result).toContain('custom')
    })
  })

  describe('Performance', () => {
    it('completes within reasonable time', () => {
      const start = Date.now()

      utilityFunction('performance-test')

      const duration = Date.now() - start
      expect(duration).toBeLessThan(100) // Should complete in <100ms
    })

    it('handles concurrent calls', () => {
      const promises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve(utilityFunction(`input-${i}`))
      )

      return Promise.all(promises).then(results => {
        expect(results).toHaveLength(100)
      })
    })
  })

  describe('Type Safety', () => {
    it('maintains type consistency', () => {
      const result = utilityFunction('typed-input')

      expect(typeof result).toBe('string')
    })

    it('validates input types', () => {
      expect(() => utilityFunction(123 as any)).toThrow('Expected string')
    })
  })
})
```

---

## Best Practices

### General Testing Principles

1. **Descriptive Test Names**: Use clear, descriptive names that explain what is being tested
2. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification phases
3. **Single Responsibility**: Each test should verify one specific behavior
4. **No Console Logs**: Remove all debugging console.log statements before committing
5. **Proper Cleanup**: Always clean up mocks and state in afterEach hooks

### Component Testing

1. **Use renderWithProviders**: Always use the custom render function for components that need context
2. **User Events**: Prefer `userEvent` over `fireEvent` for more realistic user interactions
3. **Async Operations**: Use `waitFor` for async operations and state updates
4. **Accessibility**: Include tests for ARIA labels, roles, and keyboard navigation
5. **Data Test IDs**: Use data-testid attributes for stable element selection

### E2E Testing

1. **Stable Selectors**: Use data-testid attributes instead of CSS classes or text content
2. **Explicit Waits**: Use explicit waits with timeouts instead of arbitrary delays
3. **Timeout Configuration**: Set appropriate timeouts for different operation types
4. **Independent Tests**: Each test should be independent and not rely on other tests
5. **Realistic Scenarios**: Test complete user workflows, not just isolated features

### API Testing

1. **Test All Methods**: Cover GET, POST, PUT, DELETE operations
2. **Validate Inputs**: Test request validation and error responses
3. **Error Scenarios**: Test error handling and edge cases
4. **Status Codes**: Verify correct HTTP status codes are returned
5. **Authentication**: Test both authenticated and unauthenticated scenarios

### Maintenance

1. **Keep Templates Updated**: Update these templates when patterns change
2. **Review Regularly**: Periodically review and refactor tests
3. **Remove Obsolete Tests**: Delete tests for removed features
4. **Update Mocks**: Keep mock data realistic and representative
5. **Document Gotchas**: Document any quirks or special considerations

---

## Related Documentation

- [Testing Strategy](./TESTING_STRATEGY.md)
- [Testing Guide](./TESTING_GUIDE.md)
- [Coverage Standards](./COVERAGE.md)

---

*Last Updated: 2026-02-28*
