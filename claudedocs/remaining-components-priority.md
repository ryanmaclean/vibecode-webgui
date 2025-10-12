# Remaining Components Priority List

**Current Status**: 2/129 components fully accessible (Button, Input)
**Target**: 100% WCAG 2.1 AA compliance across all components
**Timeline**: 6 weeks for 15 high-impact components

---

## High Priority Components (Week 1-2)

### 1. Select Component
**File**: `/src/components/ui/select.tsx`
**Current Status**: Uses Radix UI (good foundation)
**Usage**: ~15% of all forms
**Impact**: HIGH

**Required ARIA Enhancements**:
- ✅ Already has: role="combobox" (from Radix)
- ✅ Already has: aria-expanded (from Radix)
- ⚠️ Add: aria-required for required selects
- ⚠️ Add: aria-invalid for error states
- ⚠️ Add: aria-describedby for error/help text
- ⚠️ Add: Support for error prop (similar to Input)

**Estimated Effort**: 3 hours
**Priority Score**: 9/10

**Implementation Notes**:
```typescript
interface SelectProps {
  error?: string
  errorId?: string
  helpTextId?: string
  required?: boolean
}
```

---

### 2. Textarea Component
**File**: `/src/components/ui/textarea.tsx`
**Current Status**: Basic HTML textarea
**Usage**: ~10% of all forms
**Impact**: HIGH

**Required ARIA Enhancements**:
- ⚠️ Add: All enhancements from Input component
- ⚠️ Add: aria-label and aria-labelledby support
- ⚠️ Add: aria-required for required fields
- ⚠️ Add: aria-invalid for error states
- ⚠️ Add: aria-describedby for error/help text
- ⚠️ Add: Character count support with aria-live

**Estimated Effort**: 2 hours
**Priority Score**: 9/10

**Implementation Notes**:
```typescript
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
  errorId?: string
  helpTextId?: string
  maxLength?: number
  showCount?: boolean
}
```

---

### 3. Switch Component
**File**: `/src/components/ui/switch.tsx`
**Current Status**: Uses Radix UI
**Usage**: Common in settings, preferences
**Impact**: MEDIUM-HIGH

**Required ARIA Enhancements**:
- ✅ Already has: role="switch" (from Radix)
- ✅ Already has: aria-checked (from Radix)
- ⚠️ Add: aria-label support for switches without visible labels
- ⚠️ Add: aria-labelledby support
- ⚠️ Add: aria-describedby for help text
- ⚠️ Ensure: Proper disabled state handling

**Estimated Effort**: 2 hours
**Priority Score**: 8/10

**Implementation Notes**:
```typescript
interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  "aria-label"?: string
  "aria-labelledby"?: string
  "aria-describedby"?: string
}
```

---

### 4. Alert Component
**File**: `/src/components/ui/alert.tsx`
**Current Status**: Basic styled div
**Usage**: Critical for notifications, errors, warnings
**Impact**: HIGH

**Required ARIA Enhancements**:
- ⚠️ Add: role="alert" for critical messages
- ⚠️ Add: role="status" for non-critical messages
- ⚠️ Add: aria-live="assertive" for alerts
- ⚠️ Add: aria-live="polite" for status messages
- ⚠️ Add: Proper semantic structure (title, description)

**Estimated Effort**: 2 hours
**Priority Score**: 9/10

**Implementation Notes**:
```typescript
interface AlertProps {
  variant?: 'default' | 'destructive' | 'warning' | 'success'
  role?: 'alert' | 'status'
  ariaLive?: 'assertive' | 'polite' | 'off'
}

// Default: variant="destructive" → role="alert", aria-live="assertive"
// Default: variant="default" → role="status", aria-live="polite"
```

---

### 5. Card Component
**File**: `/src/components/ui/card.tsx`
**Current Status**: Styled div containers
**Usage**: Widespread layout component
**Impact**: MEDIUM

**Required ARIA Enhancements**:
- ⚠️ Add: Optional role="article" or role="region"
- ⚠️ Add: aria-label support for regions
- ⚠️ Add: aria-labelledby support (link to CardTitle)
- ⚠️ Ensure: Proper heading hierarchy in CardTitle
- ⚠️ Add: Optional interactive card support (when clickable)

**Estimated Effort**: 1.5 hours
**Priority Score**: 7/10

**Implementation Notes**:
```typescript
interface CardProps {
  role?: 'article' | 'region' | 'none'
  "aria-label"?: string
  "aria-labelledby"?: string
  interactive?: boolean // adds role="button" and keyboard handling
}
```

---

## Medium Priority Components (Week 3-4)

### 6. Tabs Component
**File**: `/src/components/ui/tabs.tsx`
**Current Status**: Uses Radix UI (excellent foundation)
**Usage**: Common navigation pattern
**Impact**: MEDIUM

**Required Enhancements**:
- ✅ Already has: role="tablist", role="tab", role="tabpanel" (from Radix)
- ✅ Already has: aria-selected, aria-controls (from Radix)
- ✓ Review: Verify ARIA implementation is correct
- ✓ Test: Keyboard navigation (Arrow keys, Home, End)

**Estimated Effort**: 1 hour (mostly verification)
**Priority Score**: 6/10

---

### 7. Navigation Component
**File**: `/src/components/ui/navigation.tsx`
**Current Status**: Custom navigation implementation
**Usage**: Site-wide navigation
**Impact**: MEDIUM

**Required ARIA Enhancements**:
- ⚠️ Add: role="navigation" with aria-label
- ⚠️ Add: aria-current="page" for current route
- ⚠️ Add: Proper landmark structure
- ⚠️ Add: Mobile menu button with aria-expanded
- ⚠️ Ensure: Keyboard navigation support

**Estimated Effort**: 3 hours
**Priority Score**: 7/10

**Implementation Notes**:
```typescript
interface NavigationProps {
  "aria-label": string // e.g., "Main navigation"
  currentPath?: string
}

interface NavigationItemProps {
  href: string
  current?: boolean // sets aria-current="page"
}
```

---

### 8. Tooltip Component
**File**: `/src/components/ui/tooltip.tsx`
**Current Status**: Uses Radix UI
**Usage**: Common for additional context
**Impact**: LOW-MEDIUM

**Required Enhancements**:
- ✅ Already has: role="tooltip" (from Radix)
- ✅ Already has: aria-describedby link (from Radix)
- ✓ Review: Verify implementation
- ⚠️ Ensure: Keyboard trigger support (not just hover)
- ⚠️ Add: ESC key to dismiss

**Estimated Effort**: 1 hour
**Priority Score**: 5/10

---

### 9. Progress Component
**File**: `/src/components/ui/progress.tsx`
**Current Status**: Uses Radix UI
**Usage**: Loading indicators, upload progress
**Impact**: MEDIUM

**Required ARIA Enhancements**:
- ✅ Already has: role="progressbar" (from Radix)
- ⚠️ Add: aria-valuenow for current value
- ⚠️ Add: aria-valuemin (default 0)
- ⚠️ Add: aria-valuemax (default 100)
- ⚠️ Add: aria-label or aria-labelledby
- ⚠️ Add: Optional aria-live for screen reader updates

**Estimated Effort**: 2 hours
**Priority Score**: 6/10

**Implementation Notes**:
```typescript
interface ProgressProps {
  value: number
  max?: number
  "aria-label"?: string
  "aria-labelledby"?: string
  announceUpdates?: boolean // enables aria-live="polite"
}
```

---

### 10. Slider Component
**File**: `/src/components/ui/slider.tsx`
**Current Status**: Uses Radix UI
**Usage**: Settings, filters, volume controls
**Impact**: LOW-MEDIUM

**Required Enhancements**:
- ✅ Already has: role="slider" (from Radix)
- ✅ Already has: aria-valuenow, aria-valuemin, aria-valuemax (from Radix)
- ✓ Review: Verify keyboard controls (Arrow keys, Home, End, Page Up/Down)
- ✓ Test: Screen reader value announcements

**Estimated Effort**: 1 hour (mostly verification)
**Priority Score**: 5/10

---

## Lower Priority Components (Week 5-6)

### 11. Badge Component
**File**: `/src/components/ui/badge.tsx`
**Current Status**: Styled span
**Usage**: Status indicators, tags, labels
**Impact**: LOW

**Required ARIA Enhancements**:
- ⚠️ Add: Optional aria-label for non-text content
- ⚠️ Add: role="status" for live updates (optional)
- ⚠️ Consider: aria-hidden="true" for purely decorative badges

**Estimated Effort**: 1 hour
**Priority Score**: 3/10

---

### 12. Avatar Component
**File**: `/src/components/ui/avatar.tsx`
**Current Status**: Uses Radix UI
**Usage**: User profiles, comments
**Impact**: LOW

**Required Enhancements**:
- ✅ Already has: Image with alt text support (from Radix)
- ⚠️ Add: Ensure fallback has proper aria-label
- ⚠️ Review: Image vs decorative handling

**Estimated Effort**: 1 hour
**Priority Score**: 3/10

**Implementation Notes**:
```typescript
interface AvatarProps {
  src?: string
  alt: string // Required for accessibility
  fallback?: string
}
```

---

### 13. Separator Component
**File**: `/src/components/ui/separator.tsx`
**Current Status**: Uses Radix UI
**Usage**: Visual dividers
**Impact**: LOW

**Required Enhancements**:
- ✅ Already has: role="separator" (from Radix)
- ✓ Review: Verify decorative vs semantic usage
- ⚠️ Consider: aria-orientation for vertical separators

**Estimated Effort**: 0.5 hours
**Priority Score**: 2/10

---

### 14. Scroll Area Component
**File**: `/src/components/ui/scroll-area.tsx`
**Current Status**: Uses Radix UI
**Usage**: Custom scrollbars
**Impact**: LOW

**Required Enhancements**:
- ✅ Already has: Proper scrollbar ARIA (from Radix)
- ✓ Review: Keyboard scrolling support
- ✓ Test: Screen reader compatibility

**Estimated Effort**: 1 hour (mostly testing)
**Priority Score**: 3/10

---

### 15. Resizable Component
**File**: `/src/components/ui/resizable.tsx`
**Current Status**: Custom implementation
**Usage**: Split panes, adjustable layouts
**Impact**: LOW (specialized use case)

**Required ARIA Enhancements**:
- ⚠️ Add: role="separator" for resize handles
- ⚠️ Add: aria-label for resize handles
- ⚠️ Add: aria-valuenow, aria-valuemin, aria-valuemax
- ⚠️ Add: aria-orientation
- ⚠️ Ensure: Keyboard resize support (Arrow keys)

**Estimated Effort**: 3 hours
**Priority Score**: 4/10

**Implementation Notes**:
```typescript
interface ResizableHandleProps {
  "aria-label": string // e.g., "Resize panel"
  orientation?: 'horizontal' | 'vertical'
  onKeyDown?: (e: KeyboardEvent) => void // For keyboard control
}
```

---

## Additional Components Requiring Review

### Already Using Radix UI (Lower Priority)
These components use Radix UI which provides good accessibility out of the box, but should be verified:

16. **Dialog/Modal** - Verify focus trap, ESC key, ARIA attributes
17. **Dropdown Menu** - Verify keyboard navigation, ARIA attributes
18. **Popover** - Verify keyboard controls, focus management
19. **Radio Group** - Verify ARIA attributes, keyboard navigation
20. **Checkbox** - Verify ARIA attributes, states
21. **Label** - Verify htmlFor associations
22. **Accordion** - Verify ARIA attributes, keyboard controls
23. **Context Menu** - Verify keyboard navigation
24. **Hover Card** - Verify keyboard accessibility
25. **Menubar** - Verify keyboard navigation

**Total Estimated Effort for Review**: 10-12 hours

---

## Summary

### Effort Distribution

| Priority | Components | New Development | Review/Testing | Total Hours |
|----------|-----------|-----------------|----------------|-------------|
| High | 5 | 8.5 hours | 2 hours | 10.5 hours |
| Medium | 5 | 5 hours | 4 hours | 9 hours |
| Low | 5 | 5.5 hours | 2 hours | 7.5 hours |
| Radix Review | 10 | 0 hours | 10 hours | 10 hours |
| **TOTAL** | **25** | **19 hours** | **18 hours** | **37 hours** |

### Timeline

- **Week 1-2**: High priority (10.5 hours)
- **Week 3-4**: Medium priority (9 hours)
- **Week 5-6**: Low priority (7.5 hours)
- **Week 7-8**: Radix component review (10 hours)

### Success Metrics

**Current**:
- ARIA Coverage: 35% (2 fully compliant + 35 partial from Radix)
- Fully Accessible: 2/129 components

**After Week 2**:
- ARIA Coverage: 50%
- Fully Accessible: 7/129 components

**After Week 4**:
- ARIA Coverage: 65%
- Fully Accessible: 12/129 components

**After Week 6**:
- ARIA Coverage: 80%
- Fully Accessible: 17/129 components

**After Week 8** (Target):
- ARIA Coverage: 100%
- Fully Accessible: All interactive components
- WCAG 2.1 AA Compliant: Entire component library

---

## Recommended Next Steps

### Immediate (This Week)
1. ✅ **COMPLETED**: Button and Input components
2. **START**: Select component (high usage, high impact)
3. **SETUP**: Automated accessibility testing in CI/CD

### Short-term (Next 2 Weeks)
4. Complete Textarea component
5. Complete Switch component
6. Complete Alert component
7. Complete Card component
8. Run full accessibility audit on completed components

### Medium-term (Weeks 3-4)
9. Complete medium priority components (Tabs, Navigation, etc.)
10. Document accessibility patterns for developers
11. Create Storybook accessibility addon integration

### Long-term (Weeks 5-8)
12. Complete lower priority components
13. Review and verify Radix UI components
14. Conduct comprehensive E2E accessibility testing
15. Create accessibility training materials
16. Schedule external accessibility audit

---

## Dependencies and Blockers

### Dependencies
- **Testing Infrastructure**: Need @axe-core/playwright integration in CI/CD
- **Documentation**: Need component usage guidelines published
- **Design System**: Need design approval for error states, focus indicators

### Potential Blockers
- **Radix UI Updates**: Monitor for breaking changes in dependencies
- **Browser Support**: Test across all supported browsers
- **Screen Reader Versions**: Ensure compatibility with latest SR versions

### Required Resources
- **Development Time**: 37 hours total (~5 hours/week for 8 weeks)
- **Testing Time**: Manual screen reader testing for each component
- **QA Support**: Agent 5 for automated testing setup and validation

---

## Risk Mitigation

### High Risk
- **Breaking Changes**: All enhancements maintain backward compatibility
- **Performance Impact**: ARIA attributes have minimal performance overhead
- **Regression**: Comprehensive test coverage prevents accessibility regressions

### Medium Risk
- **Learning Curve**: Developers need training on ARIA best practices
- **Maintenance**: Keep up with WCAG updates and browser changes

### Low Risk
- **Browser Support**: Modern ARIA well-supported across browsers
- **Screen Reader Support**: Standard ARIA patterns widely supported

---

## Conclusion

With systematic implementation of ARIA enhancements across 25 interactive components over 8 weeks, the vibecode-webgui component library will achieve full WCAG 2.1 AA compliance. The prioritization ensures high-impact components are addressed first, providing immediate value to users with accessibility needs.

**Next Action**: Begin Select component implementation (Week 1)
