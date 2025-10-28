# WCAG 2.1 AA Compliance Checklist
## VibeCode WebGUI Accessibility Verification

**Version:** 1.0
**Date:** October 2, 2025
**Standard:** WCAG 2.1 Level AA

---

## Overview

This checklist ensures complete WCAG 2.1 Level AA compliance for the VibeCode WebGUI multi-agent interface. Use this document during development, code review, and quality assurance testing.

**Compliance Target:** 100% WCAG 2.1 AA
**Testing Frequency:** Every PR + Weekly manual testing
**Responsibility:** All developers + dedicated QA pass

---

## Principle 1: Perceivable

Information and user interface components must be presentable to users in ways they can perceive.

### 1.1 Text Alternatives (Level A)

#### 1.1.1 Non-text Content
- [ ] All images have appropriate alt text
- [ ] Decorative images use `alt=""` or `aria-hidden="true"`
- [ ] Functional images describe their purpose
- [ ] Icons paired with text have `aria-hidden="true"`
- [ ] Icon-only buttons have `aria-label`
- [ ] SVG images have `role="img"` and `aria-label` when functional
- [ ] Charts and graphs have text alternatives or data tables

**Test:**
```bash
# Automated test
npm run test -- tests/accessibility/alt-text.test.ts

# Manual check
grep -r '<img' src/ | grep -v 'alt='
```

---

### 1.2 Time-based Media (Level A)

#### 1.2.1 Audio-only and Video-only (Prerecorded)
- [ ] Audio files have transcripts
- [ ] Video-only content has audio descriptions or transcripts

#### 1.2.2 Captions (Prerecorded)
- [ ] All prerecorded video has captions

#### 1.2.3 Audio Description or Media Alternative (Prerecorded)
- [ ] Videos have audio descriptions or text transcripts

**Note:** Currently not applicable (no video content in VibeCode WebGUI)

---

### 1.3 Adaptable (Level A)

#### 1.3.1 Info and Relationships
- [ ] Semantic HTML used throughout (`<header>`, `<nav>`, `<main>`, `<footer>`)
- [ ] Heading hierarchy is logical (h1 → h2 → h3)
- [ ] Lists use `<ul>`, `<ol>`, `<li>` elements
- [ ] Tables use `<th>`, `<caption>`, `scope` attributes
- [ ] Forms use `<label>`, `<fieldset>`, `<legend>` elements
- [ ] ARIA landmarks used where HTML5 elements aren't suitable

**Test:**
```typescript
// Run semantic HTML checker
import { SemanticHTMLChecker } from '@/lib/accessibility/wcag-checker'

const container = document.body
const landmarksCheck = SemanticHTMLChecker.hasProperLandmarks(container)
const headingsCheck = SemanticHTMLChecker.hasProperHeadingHierarchy(container)
```

#### 1.3.2 Meaningful Sequence
- [ ] Content order makes sense when linearized
- [ ] Tab order follows visual order
- [ ] CSS positioning doesn't disrupt reading order
- [ ] Modal/dialog content maintains logical sequence

**Test:**
```bash
# Test with keyboard navigation
# Tab through entire page and verify order
```

#### 1.3.3 Sensory Characteristics
- [ ] Instructions don't rely solely on shape ("click the round button")
- [ ] Instructions don't rely solely on size ("use the large field")
- [ ] Instructions don't rely solely on location ("menu on the right")
- [ ] Instructions don't rely solely on sound cues

---

### 1.4 Distinguishable (Level AA)

#### 1.4.1 Use of Color
- [ ] Color isn't the only visual means of conveying information
- [ ] Links are distinguishable without color (underline, icon, etc.)
- [ ] Form validation errors use text + color
- [ ] Status indicators use text/icon + color

**Example:**
```typescript
// Good: Error with icon and text
<div role="alert" className="text-red-600">
  <AlertCircle className="w-4 h-4" aria-hidden="true" />
  <span>Email is required</span>
</div>

// Bad: Error with only color
<div className="text-red-600">Email is required</div>
```

#### 1.4.3 Contrast (Minimum) - **Level AA**
- [ ] Normal text (< 18pt) has 4.5:1 contrast ratio minimum
- [ ] Large text (≥ 18pt or ≥ 14pt bold) has 3:1 contrast ratio minimum
- [ ] UI components have 3:1 contrast against background
- [ ] Focus indicators have 3:1 contrast
- [ ] Gradients meet minimum contrast throughout

**Test:**
```bash
# Run contrast checker
npm run test -- tests/accessibility/contrast.test.ts

# Manual check with browser DevTools
# Or use: https://webaim.org/resources/contrastchecker/
```

**Color Palette Compliance:**
```typescript
// Verified combinations (all pass WCAG AA)
const accessibleCombinations = [
  { fg: '#111827', bg: '#ffffff', ratio: 16.1 }, // gray-900 on white
  { fg: '#374151', bg: '#ffffff', ratio: 11.7 }, // gray-700 on white
  { fg: '#4b5563', bg: '#ffffff', ratio: 8.6 },  // gray-600 on white
  { fg: '#ffffff', bg: '#2563eb', ratio: 8.3 },  // white on blue-600
  { fg: '#ffffff', bg: '#9333ea', ratio: 7.0 },  // white on purple-600
]
```

#### 1.4.4 Resize Text - **Level AA**
- [ ] Text can be resized up to 200% without loss of functionality
- [ ] Content reflows appropriately when zoomed
- [ ] No horizontal scrolling at 200% zoom (except data tables)
- [ ] All interactive elements remain accessible when zoomed

**Test:**
```bash
# Manual test in browser
# 1. Open application
# 2. Zoom to 200% (Ctrl/Cmd + or browser settings)
# 3. Verify all content is accessible
# 4. Test all interactive features
```

#### 1.4.5 Images of Text - **Level AA**
- [ ] Text is actual text, not images of text
- [ ] Logos can use images of text (exception)
- [ ] Decorative images of text have text alternatives

#### 1.4.10 Reflow - **Level AA** (WCAG 2.1)
- [ ] Content reflows at 320px viewport width
- [ ] No two-dimensional scrolling required
- [ ] All functionality available in mobile viewport

**Test:**
```bash
# Playwright test for responsive design
npm run test:e2e -- tests/e2e/responsive.test.ts
```

#### 1.4.11 Non-text Contrast - **Level AA** (WCAG 2.1)
- [ ] UI components have 3:1 contrast
- [ ] Input borders have 3:1 contrast
- [ ] Button borders have 3:1 contrast
- [ ] Focus indicators have 3:1 contrast

#### 1.4.12 Text Spacing - **Level AA** (WCAG 2.1)
- [ ] Content adapts when user increases text spacing
- [ ] Line height 1.5x font size minimum
- [ ] Paragraph spacing 2x font size minimum
- [ ] Letter spacing 0.12x font size minimum
- [ ] Word spacing 0.16x font size minimum

#### 1.4.13 Content on Hover or Focus - **Level AA** (WCAG 2.1)
- [ ] Tooltips are dismissible (Escape key)
- [ ] Tooltips are hoverable (can move pointer over them)
- [ ] Tooltips persist until dismissed or hover removed

---

## Principle 2: Operable

User interface components and navigation must be operable.

### 2.1 Keyboard Accessible (Level A)

#### 2.1.1 Keyboard
- [ ] All functionality available via keyboard
- [ ] No keyboard traps (can navigate away from all elements)
- [ ] Tab key moves forward through focusable elements
- [ ] Shift+Tab moves backward through focusable elements
- [ ] Enter/Space activates buttons and links
- [ ] Arrow keys work in custom controls (tabs, menus, etc.)
- [ ] Escape closes modals and dismisses popups

**Test:**
```bash
# Automated keyboard navigation test
npm run test:e2e -- tests/e2e/keyboard-navigation.test.ts

# Manual test
# 1. Unplug mouse
# 2. Navigate entire application using only keyboard
# 3. Test all interactive features
# 4. Verify no keyboard traps
```

**Keyboard Shortcuts:**
```typescript
// Documented shortcuts for VibeCode WebGUI
const shortcuts = [
  { key: 'Enter', action: 'Send message' },
  { key: 'Shift+Enter', action: 'New line in message' },
  { key: 'Escape', action: 'Close modal/drawer' },
  { key: 'Ctrl+/', action: 'Show keyboard shortcuts' },
  { key: 'Ctrl+N', action: 'New chat' },
  { key: 'Ctrl+K', action: 'Focus search/command palette' },
  { key: 'Tab', action: 'Next focusable element' },
  { key: 'Shift+Tab', action: 'Previous focusable element' },
]
```

#### 2.1.2 No Keyboard Trap
- [ ] Focus can be moved away from every component
- [ ] Modal focus traps are intentional and documented
- [ ] Instructions provided for escaping modal focus traps

#### 2.1.4 Character Key Shortcuts - **Level A** (WCAG 2.1)
- [ ] Single character shortcuts can be disabled
- [ ] Single character shortcuts only work when component has focus
- [ ] Shortcuts can be remapped to use non-printable keys

---

### 2.2 Enough Time (Level A)

#### 2.2.1 Timing Adjustable
- [ ] Time limits can be turned off, adjusted, or extended
- [ ] Users warned before time expires
- [ ] At least 20 seconds to extend timeout

#### 2.2.2 Pause, Stop, Hide
- [ ] Auto-updating content can be paused, stopped, or hidden
- [ ] Carousels have pause button
- [ ] Live regions can be paused

**Note:** AI response streaming should be pausable

---

### 2.3 Seizures and Physical Reactions (Level A)

#### 2.3.1 Three Flashes or Below Threshold
- [ ] No content flashes more than 3 times per second
- [ ] Animations can be disabled
- [ ] `prefers-reduced-motion` media query respected

```css
/* Respect user motion preferences */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

### 2.4 Navigable (Level AA)

#### 2.4.1 Bypass Blocks - **Level A**
- [ ] Skip link provided ("Skip to main content")
- [ ] Skip link visible on focus
- [ ] Landmark regions allow easy navigation

**Implementation:**
```typescript
<a href="#main-content" className="skip-link sr-only focus:not-sr-only">
  Skip to main content
</a>
<main id="main-content">{/* content */}</main>
```

#### 2.4.2 Page Titled - **Level A**
- [ ] Every page has descriptive title
- [ ] Title describes page purpose
- [ ] Title updates when route changes (SPA)

```typescript
// page.tsx
export const metadata: Metadata = {
  title: "VibeCode WebGUI - AI-Powered Development Platform",
  description: "Modern web-based development environment with AI assistance",
};
```

#### 2.4.3 Focus Order - **Level A**
- [ ] Focus order is logical and intuitive
- [ ] Tab order matches visual order
- [ ] Focus doesn't jump unexpectedly

#### 2.4.4 Link Purpose (In Context) - **Level A**
- [ ] Link purpose clear from link text alone or context
- [ ] Avoid "click here" or "read more" without context

```typescript
// Good
<a href="/docs">Read accessibility documentation</a>

// Bad
<a href="/docs">Click here</a>
```

#### 2.4.5 Multiple Ways - **Level AA**
- [ ] Multiple ways to find pages (search, navigation, sitemap)
- [ ] Main navigation available on all pages
- [ ] Search functionality provided

#### 2.4.6 Headings and Labels - **Level AA**
- [ ] Headings describe topic or purpose
- [ ] Labels describe purpose of input fields
- [ ] Headings and labels are clear and descriptive

#### 2.4.7 Focus Visible - **Level AA**
- [ ] Keyboard focus indicator is visible
- [ ] Focus indicator has sufficient contrast (3:1)
- [ ] Focus indicator is consistent across site

```css
/* Focus indicators in globals.css */
:focus-visible {
  outline: 2px solid hsl(262 80% 50%);
  outline-offset: 2px;
}
```

---

### 2.5 Input Modalities (Level A) - **WCAG 2.1**

#### 2.5.1 Pointer Gestures
- [ ] All multi-point gestures have single-point alternative
- [ ] Path-based gestures have alternative

#### 2.5.2 Pointer Cancellation
- [ ] Down event doesn't trigger action
- [ ] Action triggered on up event
- [ ] Ability to abort or undo

#### 2.5.3 Label in Name
- [ ] Accessible name includes visible label text
- [ ] Speech input users can activate controls

```typescript
// Good: visible text matches aria-label
<button aria-label="Send message">Send message</button>

// Bad: visible text doesn't match aria-label
<button aria-label="Submit form">Send</button>
```

#### 2.5.4 Motion Actuation
- [ ] Motion-triggered actions have UI alternative
- [ ] Shake gestures have button alternative

---

## Principle 3: Understandable

Information and the operation of user interface must be understandable.

### 3.1 Readable (Level A)

#### 3.1.1 Language of Page
- [ ] Page language declared in HTML lang attribute
- [ ] Language changes within page marked with lang attribute

```html
<html lang="en">
  <span lang="fr">Bonjour</span>
</html>
```

#### 3.1.2 Language of Parts - **Level AA**
- [ ] Language changes within content marked
- [ ] Foreign phrases have lang attribute

---

### 3.2 Predictable (Level A)

#### 3.2.1 On Focus
- [ ] Focus doesn't automatically trigger change of context
- [ ] Focusing element doesn't open modal/navigate
- [ ] Focus behavior is predictable

#### 3.2.2 On Input
- [ ] Input doesn't automatically trigger change of context
- [ ] Typing doesn't navigate away
- [ ] Form submission requires explicit action

#### 3.2.3 Consistent Navigation - **Level AA**
- [ ] Navigation is consistent across pages
- [ ] Navigation order doesn't change
- [ ] Common elements in same location

#### 3.2.4 Consistent Identification - **Level AA**
- [ ] Components with same functionality labeled consistently
- [ ] Icons used consistently throughout
- [ ] Buttons with same function have same label

---

### 3.3 Input Assistance (Level A)

#### 3.3.1 Error Identification
- [ ] Errors identified in text
- [ ] Errors described to user
- [ ] Invalid fields marked with aria-invalid

```typescript
<input
  aria-invalid="true"
  aria-describedby="email-error"
/>
<div id="email-error" role="alert">
  Email address is required
</div>
```

#### 3.3.2 Labels or Instructions - **Level A**
- [ ] All inputs have labels
- [ ] Labels describe purpose
- [ ] Instructions provided when needed

#### 3.3.3 Error Suggestion - **Level AA**
- [ ] Errors include suggestions for correction
- [ ] Format requirements explained
- [ ] Valid examples provided

```typescript
<div role="alert">
  Invalid date format. Please use MM/DD/YYYY (e.g., 10/02/2025)
</div>
```

#### 3.3.4 Error Prevention (Legal, Financial, Data) - **Level AA**
- [ ] Submissions are reversible
- [ ] Data is validated before submission
- [ ] Confirmation step for important actions

---

## Principle 4: Robust

Content must be robust enough to be interpreted by a wide variety of user agents, including assistive technologies.

### 4.1 Compatible (Level A)

#### 4.1.1 Parsing
- [ ] HTML validates (no duplicate IDs, proper nesting)
- [ ] Tags are properly closed
- [ ] Attributes are properly quoted

**Test:**
```bash
# HTML validation
npx html-validate src/**/*.tsx
```

#### 4.1.2 Name, Role, Value - **Level A**
- [ ] All UI components have accessible name
- [ ] Components have appropriate role
- [ ] States and properties communicated

```typescript
// Button with proper name, role, state
<button
  aria-label="Toggle dark mode"
  aria-pressed={isDarkMode}
  onClick={toggleDarkMode}
>
  {isDarkMode ? <Moon /> : <Sun />}
</button>
```

#### 4.1.3 Status Messages - **Level AA** (WCAG 2.1)
- [ ] Status messages announced to screen readers
- [ ] aria-live regions for dynamic content
- [ ] role="status" for non-critical updates
- [ ] role="alert" for critical messages

```typescript
// Status message
<div role="status" aria-live="polite">
  File uploaded successfully
</div>

// Alert message
<div role="alert" aria-live="assertive">
  Error: Connection lost
</div>
```

---

## Testing Procedures

### Automated Testing

```bash
# Run all accessibility tests
npm run test:accessibility

# Run specific test suites
npm run test -- tests/accessibility/automated-a11y.test.ts
npm run test -- tests/accessibility/contrast.test.ts
npm run test:e2e -- tests/e2e/accessibility.test.ts

# Run accessibility linter
npx eslint src/ --ext .tsx,.ts --config .eslintrc.accessibility.js
```

### Manual Testing

#### Screen Reader Testing
- **Windows + NVDA:** Test with Firefox
- **Windows + JAWS:** Test with Chrome
- **macOS + VoiceOver:** Test with Safari
- **iOS + VoiceOver:** Test on real device
- **Android + TalkBack:** Test on real device

#### Browser Testing
- Chrome (latest + 2 versions back)
- Firefox (latest + 2 versions back)
- Safari (latest + 2 versions back)
- Edge (latest + 2 versions back)

#### Testing Checklist
- [ ] Navigate entire site with keyboard only
- [ ] Test with screen reader (3 different combinations minimum)
- [ ] Test at 200% zoom
- [ ] Test with high contrast mode
- [ ] Test with color blindness simulator
- [ ] Test with reduced motion preference
- [ ] Test on mobile devices
- [ ] Test with slow network

---

## Sign-off

### Developer Checklist (Per PR)
- [ ] All automated tests pass
- [ ] Manual keyboard testing complete
- [ ] Screen reader spot-check complete
- [ ] No new accessibility violations introduced
- [ ] Documentation updated if needed

**Developer Signature:** _________________
**Date:** _________________

### QA Checklist (Weekly)
- [ ] Full manual accessibility audit
- [ ] Screen reader testing (3+ combinations)
- [ ] Cross-browser testing
- [ ] Mobile device testing
- [ ] Contrast validation
- [ ] WCAG 2.1 AA compliance verified

**QA Signature:** _________________
**Date:** _________________

### External Audit (Quarterly)
- [ ] Third-party accessibility audit scheduled
- [ ] Audit findings documented
- [ ] Remediation plan created
- [ ] Compliance certification obtained

**Auditor:** _________________
**Date:** _________________
**Certification:** _________________

---

## Resources

### Tools
- [axe DevTools Browser Extension](https://www.deque.com/axe/devtools/)
- [WAVE Web Accessibility Evaluation Tool](https://wave.webaim.org/)
- [Color Contrast Analyzer](https://www.tpgi.com/color-contrast-checker/)
- [Lighthouse Accessibility Audit](https://developers.google.com/web/tools/lighthouse)
- [Pa11y Automated Testing](https://pa11y.org/)

### Documentation
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Resources](https://webaim.org/resources/)
- [Deque University](https://dequeuniversity.com/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

### Training
- [Web Accessibility by Google (Udacity)](https://www.udacity.com/course/web-accessibility--ud891)
- [Deque University Courses](https://dequeuniversity.com/)
- [IAAP CPACC Certification](https://www.accessibilityassociation.org/s/certified-professional)

---

**Document Version:** 1.0
**Last Updated:** October 2, 2025
**Next Review:** October 16, 2025
