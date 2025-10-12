# Accessibility Testing Checklist

## Manual Keyboard Testing

### Button Component Tests

#### Basic Keyboard Navigation
- [ ] **Tab to Button**: Press Tab key to focus button
  - Expected: Visible focus ring appears (2px solid ring)
  - Expected: Focus indicator meets WCAG 2.1 AA contrast requirements

- [ ] **Activate with Enter**: Press Enter while button is focused
  - Expected: Button onClick handler fires
  - Expected: Button visual feedback (if applicable)

- [ ] **Activate with Space**: Press Space while button is focused
  - Expected: Button onClick handler fires
  - Expected: Same behavior as Enter key

- [ ] **Tab Away**: Press Tab to move to next element
  - Expected: Focus moves to next focusable element
  - Expected: Button focus ring disappears

- [ ] **Shift+Tab**: Press Shift+Tab to move backward
  - Expected: Focus returns to previous element

#### Disabled Button States
- [ ] **Disabled Button Focus**: Try to Tab to disabled button
  - Expected: Button is skipped in tab order
  - Expected: Cannot activate button with Enter or Space
  - Expected: Visual indicator shows disabled state (opacity-50)
  - Expected: aria-disabled="true" attribute present

#### Loading Button States
- [ ] **Loading Button**: Button with loading={true}
  - Expected: Button shows aria-busy="true"
  - Expected: Button is disabled during loading
  - Expected: Cannot activate with keyboard
  - Expected: Screen reader announces "busy"

#### Toggle Button States
- [ ] **Toggle Button**: Button with pressed prop
  - Expected: aria-pressed reflects current state
  - Expected: Screen reader announces "pressed" or "not pressed"
  - Expected: Visual indicator shows pressed state

#### Icon-Only Buttons
- [ ] **Icon Button with aria-label**: Button containing only icon
  - Expected: Screen reader announces the aria-label text
  - Expected: No missing or generic labels like "button"

### Input Component Tests

#### Basic Input Navigation
- [ ] **Tab to Input**: Press Tab to focus input field
  - Expected: Visible focus ring appears
  - Expected: Cursor appears in input field

- [ ] **Type Text**: Type characters
  - Expected: Characters appear in input
  - Expected: No keyboard lag or issues

- [ ] **Arrow Keys**: Press Left/Right arrow keys
  - Expected: Cursor moves within text
  - Expected: Text selection works properly

- [ ] **Home/End Keys**: Press Home and End
  - Expected: Home moves cursor to start
  - Expected: End moves cursor to end

- [ ] **Select All**: Press Ctrl+A (Cmd+A on Mac)
  - Expected: All text is selected

- [ ] **Backspace/Delete**: Delete text
  - Expected: Characters are removed correctly

#### Required Field States
- [ ] **Required Input**: Input with required={true}
  - Expected: aria-required="true" attribute present
  - Expected: Screen reader announces "required"

#### Error States
- [ ] **Input with Error**: Input with error prop set
  - Expected: aria-invalid="true" attribute present
  - Expected: aria-describedby links to error message element
  - Expected: Screen reader announces error when focused
  - Expected: Red border appears (border-red-500)

#### Help Text
- [ ] **Input with Help Text**: Input with helpTextId prop
  - Expected: aria-describedby links to help text element
  - Expected: Screen reader announces help text when focused

#### Combined States
- [ ] **Input with Help Text AND Error**: Both helpTextId and error props
  - Expected: aria-describedby includes both IDs (space-separated)
  - Expected: Screen reader announces both help text and error

#### Disabled Input
- [ ] **Disabled Input**: Input with disabled={true}
  - Expected: Input is skipped in tab order
  - Expected: Cannot type in field
  - Expected: Cursor shows not-allowed
  - Expected: Visual indicator shows disabled state

### Form Navigation Tests

#### Tab Order
- [ ] **Forward Tab Order**: Tab through entire form
  - Expected: Logical order (top to bottom, left to right)
  - Expected: All interactive elements are reachable

- [ ] **Reverse Tab Order**: Shift+Tab through form backward
  - Expected: Reverse of forward order
  - Expected: No focus traps

#### Submit Behavior
- [ ] **Enter on Submit Button**: Press Enter on type="submit" button
  - Expected: Form submits

- [ ] **Enter on Regular Button**: Press Enter on type="button"
  - Expected: Button action fires, form does NOT submit

- [ ] **Enter in Text Input**: Press Enter while focused on input
  - Expected: Form submits (if single input) OR moves to next field

## Screen Reader Testing

### NVDA (Windows) - Free
Download: https://www.nvaccess.org/download/

#### Button Tests
- [ ] **Basic Button**: Focus button and listen
  - Expected: "Button name, button"
  - Expected: No generic labels

- [ ] **Disabled Button**: Focus disabled button
  - Expected: "Button name, button, disabled"

- [ ] **Loading Button**: Focus button with loading state
  - Expected: "Button name, button, busy"

- [ ] **Toggle Button (Pressed)**: Focus pressed toggle
  - Expected: "Button name, toggle button, pressed"

- [ ] **Toggle Button (Not Pressed)**: Focus unpressed toggle
  - Expected: "Button name, toggle button, not pressed"

- [ ] **Icon Button**: Focus icon-only button
  - Expected: Announces aria-label text, not "button" alone

#### Input Tests
- [ ] **Basic Input**: Focus input field
  - Expected: "Label text, edit, blank" (or "edit" with content)

- [ ] **Required Input**: Focus required field
  - Expected: "Label text, required, edit"

- [ ] **Input with Error**: Focus input with error
  - Expected: "Label text, invalid entry, edit"
  - Expected: Error message is announced

- [ ] **Input with Help Text**: Focus input with help text
  - Expected: Help text is announced after label

- [ ] **Input with Both**: Focus input with help text AND error
  - Expected: Both help text and error are announced

### VoiceOver (macOS) - Built-in
Enable: System Preferences > Accessibility > VoiceOver

#### Keyboard Shortcuts
- Cmd+F5: Toggle VoiceOver on/off
- VO keys: Control+Option
- VO+Right Arrow: Next element
- VO+Left Arrow: Previous element

#### Button Tests
- [ ] **Basic Button**: Navigate to button
  - Expected: "Button name, button"

- [ ] **Disabled Button**
  - Expected: "Button name, dimmed, button"

- [ ] **Loading Button**
  - Expected: "Button name, busy, button"

- [ ] **Toggle Button (Pressed)**
  - Expected: "Button name, toggle button, pressed"

#### Input Tests
- [ ] **Basic Input**
  - Expected: "Label text, edit text"

- [ ] **Required Input**
  - Expected: "Label text, required, edit text"

- [ ] **Input with Error**
  - Expected: "Label text, invalid data, edit text"
  - Expected: Error message announced

### JAWS (Windows) - Commercial
Trial: https://www.freedomscientific.com/

#### Tests
- [ ] Run same tests as NVDA
- [ ] Verify consistent announcements across screen readers

### TalkBack (Android) - Built-in
Enable: Settings > Accessibility > TalkBack

#### Tests
- [ ] Run same tests as desktop screen readers
- [ ] Test touch exploration (touch and hold to hear)

## Automated Testing

### Using axe DevTools Browser Extension

#### Installation
1. Install axe DevTools extension for Chrome/Firefox/Edge
2. Open developer tools (F12)
3. Find "axe DevTools" tab

#### Tests
- [ ] **Run Full Page Scan**: Click "Scan ALL of my page"
  - Expected: 0 violations for WCAG 2.1 AA
  - Fix any critical or serious issues

- [ ] **Check Form Elements**: Select individual form
  - Expected: All inputs have labels
  - Expected: All buttons have accessible names
  - Expected: No missing ARIA attributes

- [ ] **Check Color Contrast**: Review contrast issues
  - Expected: All text meets 4.5:1 ratio (normal text)
  - Expected: Large text meets 3:1 ratio

### Using jest-axe (Unit Tests)

```typescript
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

expect.extend(toHaveNoViolations)

describe('Button Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<Button>Click me</Button>)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('icon button should have accessible name', async () => {
    const { container } = render(
      <Button aria-label="Close" size="icon">
        <span>X</span>
      </Button>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})

describe('Input Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(
      <div>
        <label htmlFor="test">Test</label>
        <Input id="test" />
      </div>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('input with error should be accessible', async () => {
    const { container } = render(
      <div>
        <label htmlFor="test">Test</label>
        <Input id="test" error="Required field" />
        <span id="test-error">Required field</span>
      </div>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
```

### Using @axe-core/playwright (E2E Tests)

```typescript
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility Tests', () => {
  test('button component should be accessible', async ({ page }) => {
    await page.goto('/components/button')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('input component should be accessible', async ({ page }) => {
    await page.goto('/components/input')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('form should be keyboard navigable', async ({ page }) => {
    await page.goto('/forms/example')

    // Tab through form
    await page.keyboard.press('Tab')
    await expect(page.locator('input[name="name"]')).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.locator('input[name="email"]')).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.locator('button[type="submit"]')).toBeFocused()

    // Submit with Enter
    await page.keyboard.press('Enter')
    // Verify form submission
  })
})
```

## Visual Testing

### Focus Indicators
- [ ] **Visible Focus Ring**: All interactive elements have visible focus
  - Expected: 2px solid ring around focused element
  - Expected: High contrast with background

- [ ] **Focus Order**: Logical visual order
  - Expected: Top to bottom, left to right (LTR languages)

### Color Contrast

#### Tools
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- Chrome DevTools: Lighthouse > Accessibility audit

#### Tests
- [ ] **Normal Text (< 18pt)**: 4.5:1 contrast ratio
  - Test: Body text, labels, input text
  - Tool: Chrome DevTools color picker shows contrast ratio

- [ ] **Large Text (>= 18pt)**: 3:1 contrast ratio
  - Test: Headings, large buttons

- [ ] **UI Components**: 3:1 contrast ratio
  - Test: Button borders, input borders, focus indicators

- [ ] **Error Text**: High contrast
  - Test: Red error text (#ef4444) on white meets 4.5:1

### Disabled States
- [ ] **Visual Indicator**: Disabled elements clearly indicated
  - Expected: Reduced opacity (opacity-50)
  - Expected: Not-allowed cursor

- [ ] **Sufficient Contrast**: Even at reduced opacity
  - Expected: Still readable (may be < 4.5:1, but identifiable as disabled)

## WCAG 2.1 AA Compliance Checklist

### Perceivable
- [ ] **1.1.1 Non-text Content**: All images/icons have alt text or aria-label
- [ ] **1.3.1 Info and Relationships**: Proper semantic HTML and ARIA
- [ ] **1.3.2 Meaningful Sequence**: Logical reading order
- [ ] **1.4.1 Use of Color**: Color not sole indicator of meaning
- [ ] **1.4.3 Contrast (Minimum)**: 4.5:1 for text, 3:1 for UI

### Operable
- [ ] **2.1.1 Keyboard**: All functionality via keyboard
- [ ] **2.1.2 No Keyboard Trap**: Can navigate away from all elements
- [ ] **2.4.3 Focus Order**: Logical and consistent
- [ ] **2.4.7 Focus Visible**: Clear focus indicators

### Understandable
- [ ] **3.2.1 On Focus**: No context change on focus
- [ ] **3.2.2 On Input**: No unexpected context changes
- [ ] **3.3.1 Error Identification**: Errors clearly identified
- [ ] **3.3.2 Labels or Instructions**: All inputs labeled
- [ ] **3.3.3 Error Suggestion**: Error correction suggestions provided

### Robust
- [ ] **4.1.2 Name, Role, Value**: Proper ARIA attributes
- [ ] **4.1.3 Status Messages**: ARIA live regions for updates

## Priority Component Testing Order

### Week 1-2 (High Priority)
1. [ ] Button component
2. [ ] Input component
3. [ ] Select component
4. [ ] Textarea component
5. [ ] Switch component

### Week 3-4 (Medium Priority)
6. [ ] Alert component
7. [ ] Card component
8. [ ] Tabs component
9. [ ] Navigation component
10. [ ] Progress component

### Week 5-6 (Lower Priority)
11. [ ] Badge component
12. [ ] Avatar component
13. [ ] Separator component
14. [ ] Tooltip component
15. [ ] Slider component

## Continuous Testing

### Pre-commit Hooks
```bash
# Add to .husky/pre-commit
npm run lint:a11y
```

### CI/CD Pipeline
```yaml
# Add to GitHub Actions
- name: Accessibility Tests
  run: |
    npm run test:a11y
    npm run test:playwright:a11y
```

### Regular Audits
- [ ] Monthly: Full accessibility audit with axe DevTools
- [ ] Quarterly: Manual screen reader testing
- [ ] Annually: External accessibility audit (if budget allows)

## Resources

### Documentation
- WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/
- ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/

### Tools
- axe DevTools: https://www.deque.com/axe/devtools/
- WAVE: https://wave.webaim.org/
- Lighthouse: Built into Chrome DevTools

### Screen Readers
- NVDA (Free): https://www.nvaccess.org/
- JAWS (Trial): https://www.freedomscientific.com/
- VoiceOver (Built-in macOS/iOS)
- TalkBack (Built-in Android)

### Training
- WebAIM: https://webaim.org/training/
- Deque University: https://dequeuniversity.com/
