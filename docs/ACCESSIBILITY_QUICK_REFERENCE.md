# Accessibility Quick Reference Card
## For VibeCode WebGUI Developers

**WCAG 2.1 AA Compliance - Essential Patterns**

---

## The Golden Rules

1. **Semantic HTML First** - Use proper HTML elements before ARIA
2. **Keyboard Accessible** - All features work with keyboard only
3. **Clear Labels** - Every interactive element has a label
4. **Color + Text** - Never rely on color alone
5. **Test with Tools** - Run automated tests before every commit

---

## Common Patterns

### Buttons

```typescript
// ✅ Good - Accessible button
<button
  onClick={handleClick}
  aria-label="Close dialog"
  disabled={isLoading}
>
  <X className="w-4 h-4" aria-hidden="true" />
</button>

// ❌ Bad - Non-semantic click handler
<div onClick={handleClick}>
  <X />
</div>
```

---

### Form Inputs

```typescript
// ✅ Good - Proper label association
<label htmlFor="email">Email address</label>
<input
  id="email"
  type="email"
  required
  aria-required="true"
  aria-invalid={hasError}
  aria-describedby="email-error email-help"
/>
<div id="email-help">We'll never share your email</div>
{hasError && (
  <div id="email-error" role="alert">
    Please enter a valid email address
  </div>
)}

// ❌ Bad - No label, no error association
<input type="email" placeholder="Email" />
{hasError && <div>Error!</div>}
```

---

### Links vs Buttons

```typescript
// ✅ Good - Link for navigation
<Link href="/docs">View documentation</Link>

// ✅ Good - Button for actions
<button onClick={handleSubmit}>Submit form</button>

// ❌ Bad - Button for navigation
<button onClick={() => router.push('/docs')}>Docs</button>

// ❌ Bad - Link for actions
<a href="#" onClick={handleSubmit}>Submit</a>
```

**Rule:** Links navigate, buttons perform actions

---

### Headings

```typescript
// ✅ Good - Logical hierarchy
<h1>VibeCode Dashboard</h1>
<h2>Recent Projects</h2>
<h3>Project Alpha</h3>
<h3>Project Beta</h3>
<h2>Quick Actions</h2>

// ❌ Bad - Skipped levels
<h1>Dashboard</h1>
<h3>Projects</h3> {/* Skipped h2 */}
<div className="text-2xl font-bold">Actions</div> {/* Not a heading */}
```

**Rule:** Start with h1, never skip levels

---

### Images

```typescript
// ✅ Good - Descriptive alt text
<img src="chart.png" alt="Revenue growth chart showing 25% increase in Q3" />

// ✅ Good - Decorative image
<img src="decoration.png" alt="" aria-hidden="true" />

// ✅ Good - Icon with label
<button aria-label="Delete project">
  <Trash className="w-4 h-4" aria-hidden="true" />
</button>

// ❌ Bad - Missing alt text
<img src="chart.png" />

// ❌ Bad - Generic alt text
<img src="chart.png" alt="Chart" />
```

**Rule:** Functional images need descriptive alt text, decorative images need alt=""

---

### Modals/Dialogs

```typescript
// ✅ Good - Accessible modal
function Modal({ open, onClose, title, children }) {
  const modalRef = useFocusTrap(open);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div ref={modalRef} className="bg-white p-6">
        <h2 id="modal-title">{title}</h2>
        {children}
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// ❌ Bad - No focus trap, no ARIA
<div className="modal">
  <h2>{title}</h2>
  {children}
</div>
```

**Requirements:**
1. `role="dialog"` and `aria-modal="true"`
2. Focus trap (Tab cycles within modal)
3. Close on Escape key
4. Return focus to trigger element

---

### Dynamic Content (ARIA Live Regions)

```typescript
// ✅ Good - Status announcement
<div role="status" aria-live="polite">
  File uploaded successfully
</div>

// ✅ Good - Critical alert
<div role="alert" aria-live="assertive">
  Connection lost. Please retry.
</div>

// ✅ Good - Chat messages
<div
  role="log"
  aria-live="polite"
  aria-atomic="false"
  aria-relevant="additions"
>
  {messages.map(msg => (
    <article key={msg.id}>{msg.content}</article>
  ))}
</div>

// ❌ Bad - No announcement
<div>{statusMessage}</div>
```

**Politeness Levels:**
- `polite` - Wait for break in speech (most common)
- `assertive` - Interrupt immediately (errors only)
- `off` - Don't announce

---

### Landmarks

```typescript
// ✅ Good - Semantic structure
<body>
  <a href="#main-content" className="skip-link">Skip to main content</a>

  <header role="banner">
    <nav role="navigation" aria-label="Main navigation">
      {/* Nav links */}
    </nav>
  </header>

  <main id="main-content" role="main">
    <h1>Page Title</h1>
    {/* Main content */}
  </main>

  <aside role="complementary" aria-label="Related content">
    {/* Sidebar */}
  </aside>

  <footer role="contentinfo">
    {/* Footer */}
  </footer>
</body>

// ❌ Bad - No landmarks
<div className="container">
  <div className="header">{/* Header */}</div>
  <div className="content">{/* Content */}</div>
  <div className="footer">{/* Footer */}</div>
</div>
```

**Required Landmarks:**
- `header` or `role="banner"`
- `nav` or `role="navigation"`
- `main` or `role="main"` (required, exactly one)
- `footer` or `role="contentinfo"`

---

### Lists

```typescript
// ✅ Good - Semantic lists
<ul>
  <li>Item 1</li>
  <li>Item 2</li>
  <li>Item 3</li>
</ul>

<ol>
  <li>Step 1</li>
  <li>Step 2</li>
  <li>Step 3</li>
</ol>

<dl>
  <dt>Term 1</dt>
  <dd>Definition 1</dd>
  <dt>Term 2</dt>
  <dd>Definition 2</dd>
</dl>

// ❌ Bad - Non-semantic lists
<div>
  <div>• Item 1</div>
  <div>• Item 2</div>
  <div>• Item 3</div>
</div>
```

**Rule:** Use `<ul>`, `<ol>`, or `<dl>` for lists

---

### Tables

```typescript
// ✅ Good - Accessible table
<table>
  <caption>Project status overview</caption>
  <thead>
    <tr>
      <th scope="col">Project</th>
      <th scope="col">Status</th>
      <th scope="col">Progress</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">Alpha</th>
      <td>Active</td>
      <td>75%</td>
    </tr>
  </tbody>
</table>

// ❌ Bad - No headers or caption
<table>
  <tr>
    <td>Project</td>
    <td>Status</td>
  </tr>
</table>
```

**Requirements:**
1. `<caption>` for table description
2. `<th scope="col">` for column headers
3. `<th scope="row">` for row headers

---

### Color Contrast

```typescript
// ✅ Good - Meets WCAG AA (4.5:1)
const colors = {
  text: '#111827',      // gray-900
  background: '#ffffff', // white
  // Contrast ratio: 16.1:1
};

// ✅ Good - Large text (3:1)
const headingColors = {
  text: '#4b5563',      // gray-600
  background: '#ffffff', // white
  // Contrast ratio: 8.6:1 (18pt+ or 14pt+ bold)
};

// ❌ Bad - Fails WCAG AA
const badColors = {
  text: '#9ca3af',      // gray-400
  background: '#ffffff', // white
  // Contrast ratio: 2.8:1 (fails 4.5:1 requirement)
};
```

**Minimum Ratios:**
- Normal text: 4.5:1
- Large text (18pt+ or 14pt+ bold): 3:1
- UI components: 3:1

**Test with:** https://webaim.org/resources/contrastchecker/

---

### Focus Indicators

```css
/* ✅ Good - Visible focus indicator */
:focus-visible {
  outline: 2px solid hsl(262 80% 50%);
  outline-offset: 2px;
}

button:focus-visible {
  outline: 2px solid hsl(262 80% 50%);
  outline-offset: 2px;
}

/* ❌ Bad - No focus indicator */
:focus {
  outline: none;
}
```

**Rule:** Never use `outline: none` without alternative focus indicator

---

### Keyboard Navigation

```typescript
// ✅ Good - Keyboard accessible
<button
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
  Click me
</button>

// ✅ Good - Native button (Enter/Space built-in)
<button onClick={handleClick}>Click me</button>

// ❌ Bad - Div with onClick
<div onClick={handleClick}>Click me</div>
```

**Keyboard Requirements:**
- Tab/Shift+Tab - Navigate through focusable elements
- Enter/Space - Activate buttons and links
- Escape - Close modals/menus
- Arrow keys - Navigate custom controls

---

### Screen Reader Only Content

```css
/* Utility class for screen reader only content */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* Show on focus */
.focus\:not-sr-only:focus {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

```typescript
// Usage
<h1 className="sr-only">Dashboard Overview</h1>
<button aria-label="Close dialog">
  <span className="sr-only">Close</span>
  <X aria-hidden="true" />
</button>
```

---

## Testing Checklist

### Before Every Commit
- [ ] Run `npm run test:accessibility`
- [ ] Tab through new features (keyboard only)
- [ ] Check focus indicators are visible
- [ ] Verify ARIA attributes are correct

### Before Every PR
- [ ] Full keyboard navigation test
- [ ] Screen reader spot-check (VoiceOver/NVDA)
- [ ] Contrast check for new colors
- [ ] Semantic HTML validated

### Weekly
- [ ] Full screen reader testing (3+ combinations)
- [ ] Cross-browser testing
- [ ] Mobile device testing
- [ ] WCAG 2.1 AA compliance verification

---

## Common Mistakes

### ❌ Don't Do This

1. **Using divs for buttons**
   ```typescript
   <div onClick={handleClick}>Click me</div>
   ```

2. **Hiding content from screen readers unnecessarily**
   ```typescript
   <div aria-hidden="true">Important information</div>
   ```

3. **Using placeholder as label**
   ```typescript
   <input type="email" placeholder="Email" />
   ```

4. **Skipping heading levels**
   ```typescript
   <h1>Title</h1>
   <h3>Subtitle</h3> {/* Skipped h2 */}
   ```

5. **Removing focus outline without replacement**
   ```css
   :focus { outline: none; }
   ```

6. **Click handlers on non-interactive elements**
   ```typescript
   <span onClick={handleClick}>Click</span>
   ```

7. **Empty links or buttons**
   ```typescript
   <button><Icon /></button> {/* No accessible name */}
   ```

8. **Generic link text**
   ```typescript
   <a href="/docs">Click here</a>
   ```

---

## Quick Commands

```bash
# Run all accessibility tests
npm run test:accessibility

# Run E2E accessibility tests
npm run test:e2e -- tests/e2e/accessibility.test.ts

# Run contrast tests
npm run test -- tests/accessibility/contrast.test.ts

# Lint for accessibility issues
npx eslint src/ --ext .tsx,.ts

# Generate accessibility report
npm run test:e2e -- --reporter=html
```

---

## Resources

- **WCAG Quick Reference:** https://www.w3.org/WAI/WCAG21/quickref/
- **ARIA Patterns:** https://www.w3.org/WAI/ARIA/apg/
- **WebAIM Contrast Checker:** https://webaim.org/resources/contrastchecker/
- **axe DevTools:** https://www.deque.com/axe/devtools/
- **A11y Project Checklist:** https://www.a11yproject.com/checklist/

---

## Need Help?

- Check `claudedocs/ACCESSIBILITY_REMEDIATION_GUIDE.md` for detailed examples
- Review `claudedocs/WCAG_2.1_AA_COMPLIANCE_CHECKLIST.md` for complete requirements
- Use `src/lib/accessibility/wcag-checker.ts` for automated validation
- Ask in #accessibility Slack channel

---

**Remember:** Accessibility is not optional - it's a fundamental requirement for all features.

**Last Updated:** October 2, 2025
**Version:** 1.0
