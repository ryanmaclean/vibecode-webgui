# WCAG 2.1 AA Accessibility Testing Guide

## Overview

This guide provides comprehensive instructions for testing VibeCode's accessibility compliance with WCAG 2.1 AA standards. Our accessibility testing approach combines automated tools with manual testing procedures to ensure the platform is usable by people with disabilities.

## 🎯 Accessibility Standards

VibeCode targets **WCAG 2.1 AA compliance**, which includes:

### Level A Requirements
- Text alternatives for images
- Captions for videos
- Keyboard accessibility
- Color independence
- Proper heading structure

### Level AA Requirements (Additional)
- Color contrast ratios ≥ 4.5:1 for normal text
- Color contrast ratios ≥ 3:1 for large text
- Text can be resized up to 200%
- No content flashes more than 3 times per second
- Pages have titles that describe their purpose

## 🛠 Testing Tools

### 1. Automated Testing Tools

#### axe-core
- **Purpose**: Automated accessibility scanning
- **Coverage**: ~60% of WCAG issues
- **Usage**: `npm run test:accessibility:axe`

#### Lighthouse
- **Purpose**: Performance and accessibility auditing
- **Coverage**: Core accessibility metrics
- **Usage**: `npm run test:accessibility:lighthouse`

#### jest-axe
- **Purpose**: Unit testing accessibility in React components
- **Coverage**: Component-level accessibility
- **Usage**: `npm run test:accessibility:unit`

#### Playwright with axe
- **Purpose**: End-to-end accessibility testing
- **Coverage**: Full user flows
- **Usage**: `npm run test:accessibility:e2e`

### 2. Manual Testing Tools

#### Screen Readers
- **NVDA** (Windows) - Free
- **JAWS** (Windows) - Commercial
- **VoiceOver** (macOS/iOS) - Built-in
- **Orca** (Linux) - Free

#### Browser Tools
- **Chrome DevTools**: Accessibility audit
- **Firefox Inspector**: Accessibility panel
- **Edge DevTools**: Accessibility insights

## 🚀 Running Accessibility Tests

### Quick Start
```bash
# Run all accessibility tests
npm run test:accessibility

# Run specific test types
npm run test:accessibility:unit      # Jest unit tests
npm run test:accessibility:e2e       # Playwright E2E tests
npm run test:accessibility:lighthouse # Lighthouse audit
npm run test:accessibility:axe       # axe-core CLI tests
```

### Comprehensive Testing
```bash
# Start the development server
npm run dev

# In another terminal, run comprehensive tests
./scripts/run-accessibility-tests.sh

# For CI/CD
npm run test:accessibility:ci
```

### Test Configuration

#### Custom Test URL
```bash
TEST_URL=https://staging.vibecode.com ./scripts/run-accessibility-tests.sh
```

#### Extended Timeout
```bash
./scripts/run-accessibility-tests.sh --timeout 60
```

## 📋 Test Coverage

### Pages Tested
- **Main Page** (`/`) - Landing page and navigation
- **Projects** (`/projects`) - Project management interface
- **HuggingFace Chat** (`/chat/huggingface`) - AI chat interface
- **Collaborative Chat** (`/chat/collaborative`) - Real-time collaboration
- **Monitoring Dashboard** (`/monitoring/dashboard`) - System monitoring

### Components Tested
- **AI Project Generator** - Project creation workflow
- **Chat Interface** - Message input and history
- **Model Selection** - AI model picker
- **File Upload** - Attachment handling
- **Progress Indicators** - Loading states
- **Form Controls** - Input validation
- **Data Tables** - Monitoring data display

### WCAG Principles Covered

#### 1. Perceivable
- ✅ Text alternatives for images
- ✅ Color contrast ratios
- ✅ Resizable text
- ✅ Audio controls

#### 2. Operable
- ✅ Keyboard navigation
- ✅ No seizure-inducing content
- ✅ Sufficient time limits
- ✅ Skip links

#### 3. Understandable
- ✅ Readable text
- ✅ Predictable navigation
- ✅ Input assistance
- ✅ Error identification

#### 4. Robust
- ✅ Valid HTML
- ✅ Compatible with assistive technologies
- ✅ Progressive enhancement

## 🔍 Manual Testing Procedures

### Keyboard Navigation Testing
1. **Tab through all interactive elements**
   - Verify focus indicators are visible
   - Check tab order is logical
   - Ensure all functionality is keyboard accessible

2. **Test keyboard shortcuts**
   - Enter/Space for buttons
   - Arrow keys for radio buttons
   - Escape to close modals

### Screen Reader Testing
1. **Navigate with headings** (H key in NVDA/JAWS)
2. **Browse by landmarks** (D key for landmarks)
3. **Review form fields** (F key for form fields)
4. **Check ARIA labels** and descriptions

### Color and Visual Testing
1. **High contrast mode** testing
2. **Color blindness** simulation
3. **200% zoom** functionality
4. **Reduced motion** preferences

### Mobile Accessibility
1. **Touch target sizes** (minimum 44x44 pixels)
2. **Screen reader** support on mobile
3. **Orientation** independence
4. **Gesture** alternatives

## 📊 Test Reports

### Report Locations
```
tests/accessibility/reports/
├── accessibility-summary.md      # Overall summary
├── playwright/                   # Playwright HTML reports
├── lighthouse-*.json            # Lighthouse audit results
├── axe-*.json                   # axe-core violation reports
└── jest-results.json            # Jest test results
```

### Understanding Results

#### Lighthouse Scores
- **90-100**: Excellent accessibility
- **50-89**: Needs improvement
- **0-49**: Poor accessibility

#### axe-core Violations
- **Critical**: Must fix immediately
- **Serious**: Should fix soon
- **Moderate**: Fix when possible
- **Minor**: Nice to fix

### Continuous Integration

#### GitHub Actions
```yaml
- name: Run Accessibility Tests
  run: |
    npm run dev &
    sleep 10
    npm run test:accessibility:ci
```

#### Pre-commit Hook
```bash
#!/bin/bash
npm run test:accessibility:unit
```

## 🛠 Fixing Common Issues

### Color Contrast Issues
```css
/* ❌ Insufficient contrast */
.text-gray-400 { color: #9CA3AF; } /* 2.8:1 ratio */

/* ✅ Sufficient contrast */
.text-gray-700 { color: #374151; } /* 4.6:1 ratio */
```

### Missing Labels
```tsx
// ❌ No label
<input type="text" placeholder="Search..." />

// ✅ Proper label
<label htmlFor="search">Search</label>
<input id="search" type="text" placeholder="Search..." />

// ✅ Alternative with aria-label
<input type="text" aria-label="Search" placeholder="Search..." />
```

### Heading Structure
```html
<!-- ❌ Skipped heading level -->
<h1>Main Title</h1>
<h3>Subsection</h3>

<!-- ✅ Proper heading order -->
<h1>Main Title</h1>
<h2>Section</h2>
<h3>Subsection</h3>
```

### Focus Management
```tsx
// ✅ Proper focus management
const Modal = ({ isOpen, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    }
  }, [isOpen]);
  
  return (
    <div 
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      {/* Modal content */}
    </div>
  );
};
```

### ARIA Implementation
```tsx
// ✅ Proper ARIA usage
<div role="status" aria-live="polite">
  {loading ? 'Loading...' : 'Loaded'}
</div>

<button 
  aria-expanded={isOpen}
  aria-controls="menu"
  aria-haspopup="true"
>
  Menu
</button>

<div id="menu" role="menu" hidden={!isOpen}>
  <div role="menuitem" tabIndex={0}>Item 1</div>
  <div role="menuitem" tabIndex={0}>Item 2</div>
</div>
```

## 📚 Resources

### WCAG Guidelines
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [Understanding WCAG 2.1](https://www.w3.org/WAI/WCAG21/Understanding/)
- [How to Meet WCAG](https://www.w3.org/WAI/WCAG21/quickref/)

### Testing Tools
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Web Accessibility Evaluator](https://wave.webaim.org/)
- [Colour Contrast Analyser](https://www.tpgi.com/color-contrast-checker/)

### Screen Readers
- [NVDA Download](https://www.nvaccess.org/download/)
- [VoiceOver User Guide](https://support.apple.com/guide/voiceover/)
- [JAWS Information](https://www.freedomscientific.com/products/software/jaws/)

### Best Practices
- [Inclusive Design Principles](https://inclusivedesignprinciples.org/)
- [A11y Project](https://www.a11yproject.com/)
- [WebAIM](https://webaim.org/)

## 🎯 Accessibility Checklist

### Development Phase
- [ ] Use semantic HTML elements
- [ ] Provide text alternatives for images
- [ ] Ensure sufficient color contrast
- [ ] Implement keyboard navigation
- [ ] Add proper ARIA labels
- [ ] Test with screen readers
- [ ] Validate HTML markup

### Testing Phase
- [ ] Run automated accessibility tests
- [ ] Perform manual keyboard testing
- [ ] Test with screen readers
- [ ] Validate color contrast
- [ ] Check responsive design
- [ ] Test with real users

### Deployment Phase
- [ ] Include accessibility tests in CI/CD
- [ ] Monitor accessibility metrics
- [ ] Set up error reporting
- [ ] Plan regular audits
- [ ] Maintain accessibility documentation

## 🚨 Emergency Accessibility Issues

If you discover critical accessibility issues in production:

1. **Immediate Response**
   - Document the issue
   - Assess user impact
   - Implement hotfix if possible

2. **Communication**
   - Notify stakeholders
   - Update users if needed
   - Plan proper fix

3. **Resolution**
   - Develop comprehensive fix
   - Test thoroughly
   - Deploy and verify

## 📈 Monitoring and Metrics

### Key Accessibility Metrics
- **Lighthouse Accessibility Score**: Target 95+
- **axe-core Violations**: Target 0 critical/serious
- **Keyboard Navigation Coverage**: Target 100%
- **Screen Reader Compatibility**: Target 100%

### Regular Audits
- **Weekly**: Automated test results
- **Monthly**: Manual testing review
- **Quarterly**: Comprehensive audit
- **Annually**: External accessibility review

## 🤝 Getting Help

### Internal Resources
- **Development Team**: Technical implementation
- **Design Team**: Visual and UX accessibility
- **QA Team**: Testing procedures

### External Resources
- **Accessibility Consultants**: Professional audits
- **User Testing**: Real user feedback
- **Community**: A11y Slack, forums

---

**Remember**: Accessibility is not a one-time task but an ongoing commitment to inclusive design. Every feature should be developed with accessibility in mind from the start.