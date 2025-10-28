# Performance Optimization Guide
## Next.js Application Performance Strategy

**Agent**: Performance Optimization Engineer (Agent 19)
**Date**: 2025-10-02
**Status**: Implementation Guide

---

## Executive Summary

This guide provides a comprehensive performance optimization strategy for the VibeCode WebGUI Next.js application, targeting Core Web Vitals excellence and 40%+ performance improvement.

**Current State Analysis**:
- Build failures preventing production optimization
- Monaco Editor consuming 95MB (needs lazy loading)
- Limited React optimization patterns (memo, useCallback, useMemo)
- No virtual scrolling for message lists
- Heavy dependencies: langchain (7.7MB), framer-motion (3MB)
- 39 routes with mixed optimization levels
- Lighthouse CI configured but minimal enforcement

**Performance Targets**:
- LCP (Largest Contentful Paint): <2.5s (currently ~3s target)
- FID (First Input Delay): <100ms
- CLS (Cumulative Layout Shift): <0.1 (currently 0.1 target)
- INP (Interaction to Next Paint): <200ms
- Initial Bundle: <500KB (currently unoptimized)
- Route Chunks: <200KB per route

---

## 1. Bundle Optimization Strategy

### 1.1 Critical Issue: Build Failures

**Root Cause**: Webpack minification error with Next.js 15.5.4
```
TypeError: _webpack.WebpackError is not a constructor
```

**Immediate Fix Required**:
```javascript
// next.config.mjs - Update webpack configuration
config.optimization = {
  ...config.optimization,
  minimize: !dev,
  minimizer: dev ? [] : ['...'], // Use default Next.js minimizers
}

// Remove manual TerserPlugin configuration (lines 274-284)
```

### 1.2 Code Splitting Implementation

**Priority 1: Monaco Editor (95MB)**

Create lazy-loaded wrapper:
```typescript
// src/components/editors/MonacoLazy.tsx
'use client'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'

const MonacoEditor = dynamic(() => import('./monaco').then(mod => ({ default: mod.Monaco })), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-card animate-pulse">
      <Skeleton className="h-full w-full" />
    </div>
  )
})

export default MonacoEditor
```

**Priority 2: Heavy Components**

Identify components for lazy loading:
```typescript
// src/app/page.tsx - Apply lazy loading
import dynamic from 'next/dynamic'

const OnboardingDrawer = dynamic(() =>
  import('@/components/onboarding/OnboardingDrawer').then(m => ({ default: m.OnboardingDrawer })),
  { ssr: false }
)

const PromptInterface = dynamic(() =>
  import('@/components/PromptInterface'),
  {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  }
)
```

**Priority 3: Route-Based Splitting**

Already implemented via Next.js App Router, but optimize imports:
```typescript
// Example: src/app/monitoring/page.tsx
import dynamic from 'next/dynamic'

const MonitoringDashboard = dynamic(() =>
  import('@/components/monitoring/MonitoringDashboard'),
  { ssr: false }
)
```

### 1.3 Tree Shaking Analysis

**Heavy Dependencies to Optimize**:

1. **Langchain (7.7MB)** - Create minimal stubs
```typescript
// src/lib/ai/langchain-minimal.ts
// Only import needed modules, not entire package
import { ChatOpenAI } from '@langchain/openai'
// Avoid: import { ... } from 'langchain' (pulls entire 7.7MB)
```

2. **Framer Motion (3MB)** - Use LazyMotion
```typescript
// src/components/animations/MotionProvider.tsx
'use client'
import { LazyMotion, domAnimation } from 'framer-motion'

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  )
}

// In components, use m.div instead of motion.div
import { m } from 'framer-motion'
```

3. **Lucide Icons** - Import individually
```typescript
// Bad: import * as Icons from 'lucide-react'
// Good: import { Code, Globe, Sparkles } from 'lucide-react'
```

### 1.4 Bundle Analysis Setup

```json
// package.json - Add bundle analyzer
{
  "scripts": {
    "analyze": "ANALYZE=true next build",
    "analyze:server": "BUNDLE_ANALYZE=server next build",
    "analyze:browser": "BUNDLE_ANALYZE=browser next build"
  },
  "devDependencies": {
    "@next/bundle-analyzer": "^15.5.4"
  }
}
```

```javascript
// next.config.mjs - Add analyzer
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

export default withBundleAnalyzer(nextConfig)
```

---

## 2. Runtime Performance Optimization

### 2.1 React.memo Implementation

**Current State**: Limited use (MessageList.tsx uses it)

**High-Priority Components for Memoization**:

```typescript
// src/components/ui/button.tsx
import { memo } from 'react'

export const Button = memo(function Button({ children, onClick, ...props }: ButtonProps) {
  return <button onClick={onClick} {...props}>{children}</button>
})

// src/components/MessageList.tsx - Already optimized ✓
// Keep existing React.memo implementation

// src/components/ai/AIChatInterface.tsx
export const AIChatInterface = memo(function AIChatInterface(props: AIChatInterfaceProps) {
  // Component logic
})
```

**Memoization Strategy**:
- UI components with frequent re-renders
- Components with expensive computations
- List item components
- Form controls

### 2.2 useCallback & useMemo Optimization

**Pattern for Event Handlers**:
```typescript
// src/components/PromptInterface.tsx
import { useCallback, useMemo } from 'react'

export function PromptInterface() {
  // Memoize event handlers
  const handleSubmit = useCallback((input: string) => {
    // Submit logic
  }, []) // Empty deps if no external dependencies

  const handleFileUpload = useCallback((files: FileList) => {
    // Upload logic
  }, [])

  // Memoize computed values
  const filteredMessages = useMemo(() =>
    messages.filter(m => m.type !== 'system'),
    [messages]
  )

  const messageStats = useMemo(() => ({
    total: messages.length,
    tokens: messages.reduce((sum, m) => sum + (m.metadata?.tokens || 0), 0)
  }), [messages])

  return (
    <div>
      <MessageList messages={filteredMessages} />
      <InputArea onSubmit={handleSubmit} onFileUpload={handleFileUpload} />
    </div>
  )
}
```

**Critical Optimization Points**:
1. Form submission handlers
2. WebSocket event handlers
3. Filtered/sorted data
4. Complex calculations (token counts, statistics)

### 2.3 Virtual Scrolling for Message Lists

**Problem**: Current MessageList renders all messages (performance degrades >100 messages)

**Solution**: Implement react-window or react-virtual

```typescript
// src/components/MessageListVirtual.tsx
'use client'
import { memo, useMemo } from 'react'
import { FixedSizeList as List } from 'react-window'
import AutoSizer from 'react-virtualized-auto-sizer'

interface VirtualMessageListProps {
  messages: Message[]
  isTyping: boolean
}

const MessageRow = memo(({ index, style, data }: any) => {
  const message = data.messages[index]

  return (
    <div style={style} className="px-4">
      {/* Existing message rendering logic */}
    </div>
  )
})

export const VirtualMessageList = memo(({ messages, isTyping }: VirtualMessageListProps) => {
  const itemData = useMemo(() => ({ messages }), [messages])

  return (
    <AutoSizer>
      {({ height, width }) => (
        <List
          height={height}
          itemCount={messages.length}
          itemSize={120} // Average message height
          width={width}
          itemData={itemData}
        >
          {MessageRow}
        </List>
      )}
    </AutoSizer>
  )
})
```

**Package Required**:
```bash
npm install react-window react-virtualized-auto-sizer
npm install --save-dev @types/react-window @types/react-virtualized-auto-sizer
```

**Benchmark Target**:
- Current: ~100 messages before lag
- Target: >1000 messages smooth scrolling

### 2.4 Debouncing & Throttling

**Input Debouncing**:
```typescript
// src/hooks/useDebounce.ts
import { useEffect, useState } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

// Usage in PromptInterface
const [input, setInput] = useState('')
const debouncedInput = useDebounce(input, 300)

useEffect(() => {
  // Trigger autocomplete/suggestions with debounced input
  if (debouncedInput.length > 2) {
    fetchSuggestions(debouncedInput)
  }
}, [debouncedInput])
```

**Scroll Throttling**:
```typescript
// src/hooks/useThrottle.ts
import { useCallback, useRef } from 'react'

export function useThrottle<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const lastRan = useRef(Date.now())

  return useCallback((...args: Parameters<T>) => {
    if (Date.now() - lastRan.current >= delay) {
      callback(...args)
      lastRan.current = Date.now()
    }
  }, [callback, delay]) as T
}

// Usage for scroll events
const handleScroll = useThrottle(() => {
  // Expensive scroll logic
}, 100)
```

### 2.5 Web Workers for Heavy Computation

**Use Cases**:
- Token counting (tiktoken)
- Large file parsing
- Syntax highlighting
- Diff computation

```typescript
// src/workers/tokenCounter.worker.ts
import { encoding_for_model } from 'tiktoken'

self.onmessage = (e: MessageEvent<{ text: string; model: string }>) => {
  const { text, model } = e.data
  const encoding = encoding_for_model(model as any)
  const tokens = encoding.encode(text)

  self.postMessage({ tokenCount: tokens.length })
  encoding.free()
}

// src/hooks/useTokenCounter.ts
import { useEffect, useState } from 'react'

export function useTokenCounter(text: string, model: string) {
  const [tokenCount, setTokenCount] = useState(0)

  useEffect(() => {
    const worker = new Worker(new URL('../workers/tokenCounter.worker.ts', import.meta.url))

    worker.postMessage({ text, model })
    worker.onmessage = (e) => {
      setTokenCount(e.data.tokenCount)
    }

    return () => worker.terminate()
  }, [text, model])

  return tokenCount
}
```

---

## 3. Asset Optimization

### 3.1 Image Optimization with next/image

**Replace all <img> tags**:
```typescript
// Before
<img src="/logo.png" alt="Logo" />

// After
import Image from 'next/image'
<Image
  src="/logo.png"
  alt="Logo"
  width={100}
  height={100}
  priority // For above-fold images
/>
```

**Configuration already optimal**:
```javascript
// next.config.mjs ✓
images: {
  formats: ['image/webp', 'image/avif'],
  unoptimized: false,
}
```

### 3.2 Font Loading Strategy

**Current**: Fonts disabled due to Babel/SWC conflict

**Recommended Fix**:
```typescript
// src/app/layout.tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Ensures text visible during font load
  variable: '--font-inter',
  preload: true,
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
```

**CSS Configuration**:
```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    font-family: var(--font-inter), system-ui, sans-serif;
  }
}
```

### 3.3 SVG Sprite Sheets

**Create icon sprite sheet**:
```typescript
// src/components/icons/IconSprite.tsx
export function IconSprite() {
  return (
    <svg style={{ display: 'none' }} xmlns="http://www.w3.org/2000/svg">
      <symbol id="icon-code" viewBox="0 0 24 24">
        <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </symbol>
      {/* Add more icons */}
    </svg>
  )
}

// Usage
function Icon({ name }: { name: string }) {
  return (
    <svg className="w-6 h-6">
      <use href={`#icon-${name}`} />
    </svg>
  )
}
```

**Better Alternative**: Continue using lucide-react with proper tree shaking (current approach is good)

### 3.4 CSS-in-JS Optimization

**Current**: Tailwind CSS v4 (good choice)

**Recommendations**:
1. Enable JIT mode (already default in v4)
2. Purge unused styles in production
3. Use CSS modules for component-specific styles

```typescript
// next.config.mjs - Add CSS optimization
experimental: {
  optimizeCss: true, // Experimental CSS optimization
}
```

---

## 4. Performance Monitoring & Budgets

### 4.1 Enhanced Lighthouse CI Configuration

**Update lighthouse-ci.json**:
```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000",
        "http://localhost:3000/monitoring",
        "http://localhost:3000/workspace/123"
      ],
      "numberOfRuns": 5,
      "settings": {
        "preset": "desktop",
        "onlyCategories": ["performance", "accessibility", "best-practices", "seo"],
        "skipAudits": ["uses-http2"],
        "throttling": {
          "rttMs": 40,
          "throughputKbps": 10240,
          "cpuSlowdownMultiplier": 1
        }
      }
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.9}],
        "categories:accessibility": ["error", {"minScore": 0.95}],
        "first-contentful-paint": ["error", {"maxNumericValue": 1500}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "total-blocking-time": ["error", {"maxNumericValue": 200}],
        "interactive": ["error", {"maxNumericValue": 3500}],
        "speed-index": ["error", {"maxNumericValue": 3000}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

### 4.2 Bundle Size Budgets

**Create budget.json**:
```json
{
  "budgets": [
    {
      "path": "/_next/static/chunks/*.js",
      "resourceSizes": [
        {
          "resourceType": "script",
          "budget": 500
        }
      ]
    },
    {
      "path": "/_next/static/css/*.css",
      "resourceSizes": [
        {
          "resourceType": "stylesheet",
          "budget": 50
        }
      ]
    },
    {
      "path": "/",
      "resourceSizes": [
        {
          "resourceType": "document",
          "budget": 100
        },
        {
          "resourceType": "total",
          "budget": 1024
        }
      ]
    }
  ]
}
```

**Integrate with Lighthouse CI**:
```json
// lighthouse-ci.json
{
  "ci": {
    "collect": {
      "settings": {
        "budgets": "budget.json"
      }
    }
  }
}
```

### 4.3 Real User Monitoring with Datadog

**Current**: Datadog RUM configured in layout.tsx ✓

**Enhanced Configuration**:
```typescript
// src/lib/monitoring/rum.ts
export function initRUM() {
  if (typeof window === 'undefined') return

  if (window.DD_RUM) {
    window.DD_RUM.init({
      applicationId: process.env.NEXT_PUBLIC_DD_APPLICATION_ID!,
      clientToken: process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN!,
      site: 'datadoghq.com',
      service: 'vibecode-webgui',
      env: process.env.NEXT_PUBLIC_DD_ENV || 'production',
      version: '1.0.0',
      sampleRate: 100,
      premiumSampleRate: 100,
      trackInteractions: true,
      trackResources: true,
      trackLongTasks: true,
      defaultPrivacyLevel: 'mask-user-input',
      // Core Web Vitals tracking
      trackViewsManually: false,
      enableExperimentalFeatures: ['clickmap']
    })

    // Custom performance marks
    window.DD_RUM.startView({ name: 'home' })
  }
}

// Add custom performance tracking
export function trackPerformance(metric: string, value: number) {
  if (window.DD_RUM) {
    window.DD_RUM.addAction(metric, { value })
  }
}
```

### 4.4 Performance Regression Detection

**GitHub Actions Workflow**:
```yaml
# .github/workflows/performance.yml
name: Performance Testing

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build
        env:
          NEXT_PUBLIC_DD_APPLICATION_ID: ${{ secrets.DD_APPLICATION_ID }}
          NEXT_PUBLIC_DD_CLIENT_TOKEN: ${{ secrets.DD_CLIENT_TOKEN }}

      - name: Start server
        run: npm start &
        env:
          PORT: 3000

      - name: Wait for server
        run: npx wait-on http://localhost:3000

      - name: Run Lighthouse CI
        run: npm run test:performance:lighthouse

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: lighthouse-results
          path: .lighthouseci

      - name: Comment PR with results
        uses: treosh/lighthouse-ci-action@v10
        with:
          urls: |
            http://localhost:3000
            http://localhost:3000/monitoring
          uploadArtifacts: true
          temporaryPublicStorage: true
```

---

## 5. Implementation Roadmap

### Phase 1: Critical Fixes (Week 1)
**Priority**: CRITICAL
**Estimated Impact**: 15-20% improvement

1. **Fix Build System**
   - [ ] Resolve webpack minification error
   - [ ] Enable production builds
   - [ ] Verify bundle generation

2. **Lazy Load Monaco Editor**
   - [ ] Create MonacoLazy.tsx wrapper
   - [ ] Update all Monaco imports
   - [ ] Test editor loading performance
   - **Expected**: -90MB initial bundle, +2s faster LCP

3. **Implement React.memo**
   - [ ] Memoize Button component
   - [ ] Memoize Card components
   - [ ] Memoize Badge component
   - **Expected**: -50% re-renders

### Phase 2: Runtime Optimization (Week 2)
**Priority**: HIGH
**Estimated Impact**: 15-20% improvement

1. **useCallback & useMemo**
   - [ ] Optimize PromptInterface
   - [ ] Optimize AIChatInterface
   - [ ] Optimize MessageList filtering
   - **Expected**: -30% CPU usage

2. **Virtual Scrolling**
   - [ ] Install react-window
   - [ ] Implement VirtualMessageList
   - [ ] Replace current MessageList
   - [ ] Test with 1000+ messages
   - **Expected**: Smooth scrolling at 1000+ messages

3. **Debounce & Throttle**
   - [ ] Add useDebounce hook
   - [ ] Debounce input handlers
   - [ ] Throttle scroll handlers
   - **Expected**: -20% event processing overhead

### Phase 3: Asset Optimization (Week 3)
**Priority**: MEDIUM
**Estimated Impact**: 10-15% improvement

1. **Image Optimization**
   - [ ] Audit all image usage
   - [ ] Replace <img> with next/image
   - [ ] Add priority flags
   - **Expected**: -40% image bandwidth

2. **Font Loading**
   - [ ] Fix font loading issues
   - [ ] Implement font-display: swap
   - [ ] Preload critical fonts
   - **Expected**: -0.5s FCP

3. **Framer Motion Optimization**
   - [ ] Implement LazyMotion
   - [ ] Use m.div instead of motion.div
   - [ ] Remove unused animations
   - **Expected**: -2.5MB bundle

### Phase 4: Monitoring & Validation (Week 4)
**Priority**: MEDIUM
**Estimated Impact**: Detection & Prevention

1. **Enhanced Monitoring**
   - [ ] Configure Lighthouse CI
   - [ ] Set up bundle budgets
   - [ ] Configure RUM alerts
   - **Expected**: Regression prevention

2. **Performance Testing**
   - [ ] Create performance test suite
   - [ ] Set up GitHub Actions workflow
   - [ ] Document baselines
   - **Expected**: Continuous monitoring

3. **Web Workers**
   - [ ] Implement token counter worker
   - [ ] Move heavy computation off main thread
   - [ ] Test worker performance
   - **Expected**: +50% main thread availability

---

## 6. Measurement & Validation

### 6.1 Baseline Metrics (Current)

**Estimated Current Performance** (build not working):
- LCP: ~4-5s (unoptimized)
- FID: ~150ms
- CLS: ~0.15
- Initial Bundle: ~2-3MB (with Monaco)
- TTI: ~6-7s

### 6.2 Target Metrics (Post-Optimization)

**Core Web Vitals**:
- LCP: <2.5s (target: 2.0s)
- FID: <100ms (target: 50ms)
- CLS: <0.1 (target: 0.05)
- INP: <200ms (target: 150ms)

**Bundle Sizes**:
- Initial Bundle: <500KB (target: 400KB)
- Route Chunks: <200KB (target: 150KB per route)
- CSS: <50KB
- Monaco (lazy): Load on-demand

**Loading Performance**:
- FCP: <1.5s
- TTI: <3.5s
- Speed Index: <3.0s

### 6.3 Testing Strategy

**Automated Testing**:
```bash
# Run full performance suite
npm run test:performance

# Lighthouse CI
npm run test:performance:lighthouse

# Bundle analysis
npm run analyze

# Datadog Synthetics
npm run test:performance:synthetic
```

**Manual Testing**:
1. Chrome DevTools Performance panel
2. Network throttling (Fast 3G, Slow 3G)
3. CPU throttling (4x slowdown)
4. Memory profiling for leaks

**A/B Testing**:
```bash
# Compare before/after
npm run test:ab-compare
```

### 6.4 Success Criteria

**Minimum Requirements**:
- ✅ All Core Web Vitals in "Good" range
- ✅ Lighthouse Performance score >90
- ✅ Initial bundle <500KB
- ✅ LCP <2.5s on Fast 3G
- ✅ No performance regression in CI

**Stretch Goals**:
- 🎯 Lighthouse Performance score >95
- 🎯 Initial bundle <400KB
- 🎯 LCP <2.0s
- 🎯 Support 2000+ messages smoothly

---

## 7. Integration Points

### 7.1 Agent 11 (UI Component Engineer)
**Optimization Impact**: Component architecture

- Apply React.memo to all UI components
- Implement lazy loading for heavy components
- Optimize re-render cycles
- Use Skeleton components for loading states

**Deliverables**:
- Memoized component library
- Lazy-loaded component wrappers
- Performance-optimized Badge, Button, Card components

### 7.2 Agent 12 (State Management)
**Optimization Impact**: State update overhead

- Implement selector memoization
- Use shallow equality checks
- Batch state updates
- Optimize WebSocket state updates

**Deliverables**:
- Memoized selectors with reselect
- Batched update patterns
- Optimized context providers

### 7.3 Agent 15 (Workflow Editor)
**Optimization Impact**: Editor loading time

- Lazy load workflow editor
- Implement code splitting for editor modules
- Use dynamic imports for plugins
- Virtual scrolling for node lists

**Deliverables**:
- Lazy-loaded workflow editor
- Split editor bundles
- Optimized node rendering

---

## 8. Maintenance & Continuous Improvement

### 8.1 Performance Budget Enforcement

**CI/CD Integration**:
```yaml
# Fail builds that exceed budgets
- name: Check bundle size
  run: npm run analyze
  continue-on-error: false

- name: Lighthouse CI
  run: npm run test:performance:lighthouse
  continue-on-error: false
```

### 8.2 Regular Audits

**Monthly Tasks**:
- Review Datadog RUM metrics
- Analyze bundle size trends
- Check for dependency bloat
- Update performance baselines

**Quarterly Tasks**:
- Full performance audit
- Dependency updates
- Re-evaluate optimization strategies
- Update performance targets

### 8.3 Documentation

**Required Documentation**:
- Performance optimization playbook
- Bundle size guidelines
- Component performance patterns
- Monitoring dashboard setup

---

## 9. Quick Reference

### Performance Checklist

**Before Every PR**:
- [ ] Run Lighthouse locally
- [ ] Check bundle size impact
- [ ] Test on throttled network
- [ ] Profile component re-renders
- [ ] Verify no console errors

**Code Review Focus**:
- [ ] Large dependencies justified?
- [ ] Images using next/image?
- [ ] Heavy components lazy loaded?
- [ ] Event handlers memoized?
- [ ] Lists virtualized (if >50 items)?

**Deployment Checklist**:
- [ ] Lighthouse CI passed
- [ ] Bundle budgets met
- [ ] RUM baseline established
- [ ] Performance regression alerts configured

---

## 10. Troubleshooting

### Common Issues

**Issue**: Bundle size increased after adding dependency
**Solution**:
1. Check dependency size: `npm ls <package>`
2. Look for lighter alternatives
3. Use dynamic imports
4. Consider tree-shaking opportunities

**Issue**: LCP regression
**Solution**:
1. Check for above-fold lazy loading
2. Verify image optimization
3. Review critical CSS delivery
4. Check for render-blocking resources

**Issue**: CLS issues
**Solution**:
1. Set explicit width/height on images
2. Reserve space for dynamic content
3. Avoid inserting content above existing content
4. Use CSS containment

**Issue**: High INP/FID
**Solution**:
1. Debounce input handlers
2. Use requestIdleCallback for non-urgent work
3. Move heavy computation to Web Workers
4. Check for long tasks in DevTools

---

## Conclusion

This comprehensive performance optimization strategy targets 40%+ improvement across all Core Web Vitals metrics through systematic bundle optimization, runtime performance improvements, and robust monitoring.

**Expected Outcomes**:
- LCP: 4-5s → <2.5s (50% improvement)
- Initial Bundle: 2-3MB → <500KB (80% reduction)
- Message List: 100 messages → 1000+ messages smooth
- Overall Lighthouse Score: <80 → >90 (12%+ improvement)

**Next Steps**:
1. Fix build system (Critical)
2. Implement Phase 1 optimizations
3. Establish performance baselines
4. Configure CI/CD monitoring
5. Begin iterative optimization cycles

---

**Document Version**: 1.0
**Last Updated**: 2025-10-02
**Maintained By**: Agent 19 - Performance Optimization Engineer
