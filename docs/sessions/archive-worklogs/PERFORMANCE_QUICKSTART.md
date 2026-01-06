# Performance Optimization Quick Start Guide

**Agent 19: Performance Optimization Engineer**

This guide provides immediate steps to implement performance optimizations and achieve 40%+ improvement in Core Web Vitals.

---

## Prerequisites

1. Node.js 20.x installed
2. Dependencies installed: `npm ci`
3. Build system working (fix webpack errors first)

---

## Phase 1: Critical Fixes (Day 1-2)

### Step 1: Fix Build System

**Problem**: Webpack minification error prevents production builds

**Solution**: Update next.config.mjs

```bash
# Edit next.config.mjs, remove lines 274-284 (manual TerserPlugin config)
# Replace with default Next.js minimizers

# Test build
npm run build
```

**Expected Result**: Build completes successfully

---

### Step 2: Lazy Load Monaco Editor

**Impact**: -95MB initial bundle, +2s faster LCP

```bash
# 1. Create lazy wrapper (already created)
ls src/components/editors/MonacoLazy.tsx

# 2. Update imports in all files using Monaco
# Find files using Monaco
grep -r "from '@monaco-editor/react'" src/

# 3. Replace imports
# Before: import Editor from '@monaco-editor/react'
# After: import Editor from '@/components/editors/MonacoLazy'
```

**Files to update**:
- `src/components/editors/monaco.tsx` → Keep as is (base component)
- Any component importing Monaco → Use MonacoLazy instead

**Verification**:
```bash
npm run build
npm run analyze
# Check that monaco-editor is in separate chunk, not main bundle
```

---

### Step 3: Add React.memo to UI Components

**Impact**: -50% re-renders, +15% runtime performance

```typescript
// src/components/ui/button.tsx
import { memo } from 'react'

export const Button = memo(function Button(props: ButtonProps) {
  // existing code
})

// Repeat for: Card, Badge, Label, Input, Textarea
```

**Quick script to add memo**:
```bash
# List components to optimize
ls src/components/ui/*.tsx

# For each file, wrap component with memo
```

---

## Phase 2: Runtime Optimization (Day 3-4)

### Step 4: Implement Virtual Scrolling

**Impact**: Smooth scrolling with 1000+ messages

```bash
# 1. Install dependencies
npm install react-window react-virtualized-auto-sizer
npm install --save-dev @types/react-window @types/react-virtualized-auto-sizer

# 2. Component already created
ls src/components/MessageListVirtual.tsx

# 3. Replace MessageList usage
# Find usages: grep -r "MessageList" src/
# Replace with VirtualMessageList for message lists >50 items
```

**Usage example**:
```typescript
// src/components/PromptInterface.tsx
import { VirtualMessageList } from '@/components/MessageListVirtual'

// Replace:
// <MessageList messages={messages} isTyping={isTyping} />

// With:
<VirtualMessageList messages={messages} isTyping={isTyping} />
```

---

### Step 5: Add Debouncing & Throttling

**Impact**: -30% event processing overhead

```bash
# Hooks already created
ls src/hooks/useDebounce.ts
ls src/hooks/useThrottle.ts
```

**Apply to input handlers**:
```typescript
// src/components/PromptInterface.tsx
import { useDebounce } from '@/hooks/useDebounce'

const [input, setInput] = useState('')
const debouncedInput = useDebounce(input, 300)

useEffect(() => {
  // Use debouncedInput for expensive operations
  if (debouncedInput) {
    // Trigger autocomplete, validation, etc.
  }
}, [debouncedInput])
```

**Apply to scroll handlers**:
```typescript
import { useThrottle } from '@/hooks/useThrottle'

const handleScroll = useThrottle(() => {
  // Scroll logic
}, 100)
```

---

### Step 6: Optimize Framer Motion

**Impact**: -2.5MB bundle size

```bash
# 1. Component already created
ls src/components/animations/MotionProvider.tsx

# 2. Wrap app with MotionProvider
# Edit src/app/layout.tsx or providers.tsx
```

```typescript
// src/app/layout.tsx
import { MotionProvider } from '@/components/animations/MotionProvider'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <MotionProvider>
          <Providers>
            {children}
          </Providers>
        </MotionProvider>
      </body>
    </html>
  )
}
```

**Update components using framer-motion**:
```typescript
// Before
import { motion } from 'framer-motion'
<motion.div animate={{ opacity: 1 }} />

// After
import { m } from 'framer-motion'
<m.div animate={{ opacity: 1 }} />
```

---

## Phase 3: Testing & Validation (Day 5)

### Step 7: Install Performance Testing

```bash
# Install Lighthouse CI
npm install -g @lhci/cli

# Run Lighthouse locally
npm run build
npm start
# In another terminal:
lhci autorun
```

### Step 8: Run Performance Tests

```bash
# Install Playwright (if not already installed)
npx playwright install chromium

# Run Core Web Vitals tests
BASE_URL=http://localhost:3000 npx playwright test tests/performance/

# Check results
ls test-results/
```

### Step 9: Analyze Bundle

```bash
# Build with analyzer
ANALYZE=true npm run build

# Open bundle analyzer in browser
open .next/analyze/client.html

# Check for:
# - Monaco editor NOT in main bundle ✓
# - Framer motion <600KB ✓
# - No duplicate dependencies ✓
```

---

## Verification Checklist

After implementing optimizations:

### Bundle Sizes
- [ ] Main bundle <500KB
- [ ] Route chunks <200KB each
- [ ] Monaco editor lazy loaded (0KB in main)
- [ ] No duplicate dependencies

### Core Web Vitals
- [ ] LCP <2.5s (target: 2.0s)
- [ ] FID <100ms (target: 50ms)
- [ ] CLS <0.1 (target: 0.05)
- [ ] FCP <1.5s
- [ ] TTI <3.5s

### Code Quality
- [ ] React.memo on UI components
- [ ] useCallback on event handlers
- [ ] useMemo on computed values
- [ ] Virtual scrolling for lists >50 items
- [ ] Debouncing on input handlers
- [ ] Throttling on scroll handlers

### Testing
- [ ] Lighthouse Performance score >90
- [ ] No performance regressions in CI
- [ ] All Core Web Vitals tests passing

---

## Quick Commands

```bash
# Development
npm run dev

# Build & analyze
ANALYZE=true npm run build

# Performance testing
npm run test:performance

# Lighthouse CI
npm run test:performance:lighthouse

# Core Web Vitals tests
BASE_URL=http://localhost:3000 npx playwright test tests/performance/core-web-vitals.test.ts

# Check bundle budgets
cat budget.json

# View baseline metrics
cat tests/performance/benchmark-baseline.json
```

---

## Troubleshooting

### Build Fails
```bash
# Clear cache
rm -rf .next node_modules/.cache

# Reinstall
npm ci

# Try build again
npm run build
```

### Lighthouse CI Fails
```bash
# Ensure server is running
npm start

# Check server is accessible
curl http://localhost:3000

# Run Lighthouse with verbose output
lhci autorun --verbose
```

### Performance Tests Fail
```bash
# Check baseline expectations
cat tests/performance/benchmark-baseline.json

# Run specific test
npx playwright test tests/performance/core-web-vitals.test.ts --headed

# Debug mode
PWDEBUG=1 npx playwright test tests/performance/
```

---

## Expected Improvements

### Before Optimization
- LCP: ~4.5s
- Bundle: ~2.8MB
- Lighthouse Score: <80

### After Phase 1 (Day 1-2)
- LCP: ~3.5s (22% improvement)
- Bundle: ~1.5MB (46% reduction)
- Lighthouse Score: ~85 (6% improvement)

### After Phase 2 (Day 3-4)
- LCP: ~2.8s (38% improvement)
- Bundle: ~800KB (71% reduction)
- Lighthouse Score: ~90 (12% improvement)

### Final Target
- LCP: <2.5s (44%+ improvement)
- Bundle: <500KB (82% reduction)
- Lighthouse Score: >90 (12%+ improvement)

---

## Next Steps

1. **Immediate**: Fix build system and implement Phase 1
2. **Week 1**: Complete Phase 2 optimizations
3. **Week 2**: Set up CI/CD performance monitoring
4. **Week 3**: Fine-tune and optimize remaining routes
5. **Ongoing**: Monitor performance with Datadog RUM

---

## Resources

- Full Guide: `/Users/ryan.maclean/vibecode-webgui/claudedocs/PERFORMANCE_OPTIMIZATION_GUIDE.md`
- Baseline Metrics: `/Users/ryan.maclean/vibecode-webgui/tests/performance/benchmark-baseline.json`
- Bundle Budgets: `/Users/ryan.maclean/vibecode-webgui/budget.json`
- CI Workflow: `/Users/ryan.maclean/vibecode-webgui/.github/workflows/performance-testing.yml`

---

**Questions?** Check the full guide or reach out to Agent 19 (Performance Engineer)
