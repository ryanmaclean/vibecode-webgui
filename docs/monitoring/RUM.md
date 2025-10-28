# Real User Monitoring (RUM) Guide

## Overview

Real User Monitoring captures actual user experience data from browsers, tracking Core Web Vitals, page load performance, user journeys, and errors.

This implementation addresses **Issue #77, Section 2: Real User Monitoring (RUM)**

## Features

### 1. Core Web Vitals Tracking ✅

Automatically collects and reports:

- **FCP (First Contentful Paint)** - Time until first content renders (target: < 1.8s)
- **LCP (Largest Contentful Paint)** - Time until largest content renders (target: < 2.5s)
- **FID (First Input Delay)** - Time until first user interaction (target: < 100ms)
- **CLS (Cumulative Layout Shift)** - Visual stability score (target: < 0.1)
- **TTFB (Time to First Byte)** - Server response time (target: < 600ms)
- **INP (Interaction to Next Paint)** - Interaction responsiveness (target: < 200ms)

### 2. Page Load Performance ✅

Detailed page load metrics including:

- DNS lookup time
- TCP connection time
- Time to First Byte (TTFB)
- Download time
- DOM Interactive time
- DOM Complete time
- Load Complete time

### 3. User Journey Tracking ✅

Track user navigation patterns:

- Page transitions
- User interactions
- Feature usage
- Navigation paths

### 4. Error Rate Monitoring ✅

Comprehensive error monitoring:

- Unhandled JavaScript errors
- Unhandled promise rejections
- Error context with performance data
- User agent and environment info

## Setup

### 1. Enable RUM in Your Application

Add the PerformanceMonitor component to your layout:

\`\`\`typescript
// src/app/layout.tsx
import { PerformanceMonitor } from '@/components/PerformanceMonitor';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <PerformanceMonitor />
        {children}
      </body>
    </html>
  );
}
\`\`\`

### 2. Configure Datadog Integration (Optional)

Set environment variables:

\`\`\`bash
# Datadog API Key for server-side metrics
DD_API_KEY=your_api_key_here

# Datadog RUM Client Token (public, for browser)
NEXT_PUBLIC_DD_APPLICATION_ID=your_app_id
NEXT_PUBLIC_DD_CLIENT_TOKEN=your_client_token
NEXT_PUBLIC_DD_SITE=datadoghq.com
NEXT_PUBLIC_DD_SERVICE=vibecode-webgui
NEXT_PUBLIC_DD_ENV=production
\`\`\`

## Usage

### Track Custom User Journeys

\`\`\`typescript
import { trackUserJourney } from '@/lib/monitoring/rum';

// Track a user action
trackUserJourney('feature_used', {
  feature: 'code_editor',
  action: 'file_opened'
});
\`\`\`

### Track Custom Errors

\`\`\`typescript
import { trackError } from '@/lib/monitoring/rum';

try {
  // Your code
} catch (error) {
  trackError(error, {
    component: 'CodeEditor',
    action: 'save_file'
  });
}
\`\`\`

## API Endpoints

### Web Vitals

**POST /api/monitoring/web-vitals** - Collect Core Web Vitals
**GET /api/monitoring/web-vitals** - Retrieve metrics with aggregates

### User Journey  

**POST /api/monitoring/user-journey** - Track user navigation
**GET /api/monitoring/user-journey** - Retrieve journey statistics

### Page Load

**POST /api/monitoring/page-load** - Collect page load metrics
**GET /api/monitoring/page-load** - Retrieve performance data

## Performance Metrics Reference

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| FCP | ≤ 1.8s | 1.8s - 3.0s | > 3.0s |
| LCP | ≤ 2.5s | 2.5s - 4.0s | > 4.0s |
| FID | ≤ 100ms | 100ms - 300ms | > 300ms |
| CLS | ≤ 0.1 | 0.1 - 0.25 | > 0.25 |
| TTFB | ≤ 600ms | 600ms - 1800ms | > 1800ms |

## Related Documentation

- [Performance Testing Guide](../testing/PERFORMANCE_TESTING.md)
- [Performance Budget Configuration](../../performance-budget.json)
