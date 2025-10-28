/**
 * Accessibility Usage Examples for Enhanced Button and Input Components
 *
 * This file demonstrates proper ARIA attribute usage for WCAG 2.1 AA compliance.
 * These examples can be used as templates for implementing accessible forms.
 */

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Search, Save, Trash } from 'lucide-react'

// ============================================================================
// BUTTON EXAMPLES
// ============================================================================

/**
 * Example 1: Icon-Only Button with aria-label
 * WCAG: Icon buttons MUST have accessible labels
 */
export function IconButtonExample() {
  return (
    <div className="flex gap-2">
      <Button
        aria-label="Close dialog"
        size="icon"
        variant="ghost"
        onClick={() => console.log('Dialog closed')}
      >
        <X className="h-4 w-4" />
      </Button>

      <Button
        aria-label="Search items"
        size="icon"
        variant="outline"
      >
        <Search className="h-4 w-4" />
      </Button>

      <Button
        aria-label="Delete item"
        size="icon"
        variant="destructive"
      >
        <Trash className="h-4 w-4" />
      </Button>
    </div>
  )
}

/**
 * Example 2: Loading Button with aria-busy
 * WCAG: Async operations should indicate busy state to screen readers
 */
export function LoadingButtonExample() {
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsSaving(false)
  }

  return (
    <div className="space-y-4">
      {/* Loading state automatically sets aria-busy="true" and disabled */}
      <Button
        loading={isSaving}
        onClick={handleSave}
      >
        {isSaving ? 'Saving...' : 'Save Changes'}
      </Button>

      {/* With icon */}
      <Button
        loading={isSaving}
        onClick={handleSave}
      >
        <Save className="mr-2 h-4 w-4" />
        {isSaving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  )
}

/**
 * Example 3: Toggle Button with aria-pressed
 * WCAG: Toggle buttons must indicate their pressed state
 */
export function ToggleButtonExample() {
  const [isActive, setIsActive] = useState(false)
  const [notifications, setNotifications] = useState(true)

  return (
    <div className="space-y-4">
      {/* Simple toggle */}
      <Button
        pressed={isActive}
        onClick={() => setIsActive(!isActive)}
        variant={isActive ? 'default' : 'outline'}
      >
        {isActive ? 'Active' : 'Inactive'}
      </Button>

      {/* Toggle with description */}
      <Button
        pressed={notifications}
        onClick={() => setNotifications(!notifications)}
        variant={notifications ? 'default' : 'outline'}
        aria-label={`Notifications ${notifications ? 'enabled' : 'disabled'}`}
      >
        Notifications {notifications ? 'On' : 'Off'}
      </Button>
    </div>
  )
}

/**
 * Example 4: Button Types and Form Submission
 * WCAG: Prevent unintended form submission with type="button"
 */
export function FormButtonExample() {
  const [data, setData] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submitted:', data)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        value={data}
        onChange={(e) => setData(e.target.value)}
        placeholder="Enter data"
      />

      <div className="flex gap-2">
        {/* This button submits the form */}
        <Button type="submit">
          Submit Form
        </Button>

        {/* This button does NOT submit (default type="button") */}
        <Button onClick={() => console.log('Preview')}>
          Preview
        </Button>

        {/* Reset button */}
        <Button
          type="reset"
          variant="outline"
          onClick={() => setData('')}
        >
          Reset
        </Button>
      </div>
    </form>
  )
}

/**
 * Example 5: Disabled Button States
 * WCAG: Disabled elements should be clearly indicated
 */
export function DisabledButtonExample() {
  const [agreed, setAgreed] = useState(false)

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        I agree to the terms
      </label>

      <Button
        disabled={!agreed}
        aria-disabled={!agreed}
      >
        {!agreed ? 'Please agree to terms' : 'Continue'}
      </Button>
    </div>
  )
}

// ============================================================================
// INPUT EXAMPLES
// ============================================================================

/**
 * Example 6: Basic Input with Label
 * WCAG: All inputs MUST have associated labels
 */
export function BasicInputExample() {
  return (
    <div className="space-y-2">
      <Label htmlFor="email">Email Address</Label>
      <Input
        id="email"
        type="email"
        placeholder="you@example.com"
        aria-label="Email address"
        required
      />
    </div>
  )
}

/**
 * Example 7: Input with Error State
 * WCAG: Error messages must be programmatically associated with inputs
 */
export function InputErrorExample() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | undefined>()

  const validateEmail = (value: string) => {
    if (!value) {
      setError('Email is required')
    } else if (!/\S+@\S+\.\S+/.test(value)) {
      setError('Please enter a valid email address')
    } else {
      setError(undefined)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="email-error">Email Address</Label>
      <Input
        id="email-error"
        type="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value)
          validateEmail(e.target.value)
        }}
        error={error}
        required
        placeholder="you@example.com"
      />
      {error && (
        <span
          id="email-error-error"
          className="text-sm text-red-500"
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  )
}

/**
 * Example 8: Input with Help Text
 * WCAG: Provide instructions for complex inputs
 */
export function InputHelpTextExample() {
  const [password, setPassword] = useState('')

  return (
    <div className="space-y-2">
      <Label htmlFor="password">Password</Label>
      <Input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        helpTextId="password-help"
        required
        aria-label="Password"
      />
      <span
        id="password-help"
        className="text-sm text-muted-foreground"
      >
        Must be at least 8 characters with uppercase, lowercase, and numbers
      </span>
    </div>
  )
}

/**
 * Example 9: Input with Combined Help Text and Error
 * WCAG: Multiple descriptions can be associated with aria-describedby
 */
export function InputCombinedExample() {
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | undefined>()

  const validateUsername = (value: string) => {
    if (!value) {
      setError('Username is required')
    } else if (value.length < 3) {
      setError('Username must be at least 3 characters')
    } else if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      setError('Username can only contain letters, numbers, and underscores')
    } else {
      setError(undefined)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="username">Username</Label>
      <Input
        id="username"
        type="text"
        value={username}
        onChange={(e) => {
          setUsername(e.target.value)
          validateUsername(e.target.value)
        }}
        helpTextId="username-help"
        error={error}
        required
        aria-label="Username"
      />
      <span
        id="username-help"
        className="text-sm text-muted-foreground"
      >
        Choose a unique username for your account
      </span>
      {error && (
        <span
          id="username-error"
          className="text-sm text-red-500"
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  )
}

/**
 * Example 10: Search Input with Custom Label
 * WCAG: Search inputs should be clearly labeled
 */
export function SearchInputExample() {
  const [query, setQuery] = useState('')

  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        placeholder="Search products..."
        aria-label="Search products"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pl-10"
      />
    </div>
  )
}

/**
 * Example 11: Complete Accessible Form
 * WCAG: Demonstrates all best practices together
 */
export function CompleteAccessibleForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate
    const newErrors: Record<string, string> = {}
    if (!formData.name) newErrors.name = 'Name is required'
    if (!formData.email) newErrors.email = 'Email is required'
    if (!formData.password) newErrors.password = 'Password is required'

    setErrors(newErrors)

    if (Object.keys(newErrors).length === 0) {
      setIsSubmitting(true)
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      setIsSubmitting(false)
      console.log('Form submitted:', formData)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name field */}
      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <Input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          error={errors.name}
          required
          aria-label="Full name"
        />
        {errors.name && (
          <span id="name-error" className="text-sm text-red-500" role="alert">
            {errors.name}
          </span>
        )}
      </div>

      {/* Email field */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          error={errors.email}
          required
          aria-label="Email address"
        />
        {errors.email && (
          <span id="email-error" className="text-sm text-red-500" role="alert">
            {errors.email}
          </span>
        )}
      </div>

      {/* Password field with help text */}
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          helpTextId="password-help"
          error={errors.password}
          required
          aria-label="Password"
        />
        <span id="password-help" className="text-sm text-muted-foreground">
          Must be at least 8 characters
        </span>
        {errors.password && (
          <span id="password-error" className="text-sm text-red-500" role="alert">
            {errors.password}
          </span>
        )}
      </div>

      {/* Submit button with loading state */}
      <div className="flex gap-2">
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating Account...' : 'Create Account'}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setFormData({ name: '', email: '', password: '' })
            setErrors({})
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

// ============================================================================
// MANUAL KEYBOARD TESTING CHECKLIST
// ============================================================================

/**
 * Keyboard Testing Guide
 *
 * Test each component with the following keyboard interactions:
 *
 * BUTTON COMPONENT:
 * [ ] Tab: Focus moves to button (visible focus ring should appear)
 * [ ] Enter: Activates button (triggers onClick)
 * [ ] Space: Activates button (triggers onClick)
 * [ ] Tab again: Focus moves to next focusable element
 * [ ] Disabled button: Should not be focusable
 * [ ] Loading button: Should not be activatable
 *
 * INPUT COMPONENT:
 * [ ] Tab: Focus moves to input (visible focus ring should appear)
 * [ ] Type: Can enter text normally
 * [ ] Arrow keys: Move cursor within text
 * [ ] Home/End: Jump to start/end of text
 * [ ] Ctrl+A: Select all text
 * [ ] Disabled input: Should not be focusable or editable
 *
 * FORM NAVIGATION:
 * [ ] Tab: Move forward through form fields
 * [ ] Shift+Tab: Move backward through form fields
 * [ ] Enter on submit button: Submits form
 * [ ] Enter on regular button: Does NOT submit form (type="button")
 *
 * SCREEN READER TESTING:
 * [ ] Button: Announces role, label, and state (pressed, busy, disabled)
 * [ ] Input: Announces label, required state, error state
 * [ ] Error messages: Announced when input becomes invalid
 * [ ] Help text: Announced when input receives focus
 * [ ] Loading state: Announces "busy" while processing
 *
 * VISUAL TESTING:
 * [ ] Focus indicators: Clear and visible (ring-2 ring-ring)
 * [ ] Error states: Red border and text for invalid inputs
 * [ ] Disabled states: Reduced opacity (opacity-50)
 * [ ] Color contrast: All text meets WCAG AA standards (4.5:1 minimum)
 */
