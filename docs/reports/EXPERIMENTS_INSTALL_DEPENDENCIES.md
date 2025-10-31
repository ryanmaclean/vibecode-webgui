# Experiments Dashboard - Required Dependencies

## Installation Required

The experiment dashboard uses Recharts for data visualization. Install it with:

```bash
npm install recharts
# or
yarn add recharts
# or
pnpm add recharts
```

## All Dependencies Used

The dashboard leverages these existing dependencies (already installed):

### Core Framework
- `next` - Next.js 14 with App Router
- `react` - React 18
- `react-dom` - React DOM

### UI Components (shadcn/ui)
- `@radix-ui/react-*` - Radix UI primitives
- `class-variance-authority` - CVA for variant styles
- `tailwindcss` - Utility-first CSS

### Authentication
- `next-auth` - Authentication (already configured)

### Type Safety
- `typescript` - TypeScript compiler
- `@types/react` - React types
- `@types/node` - Node.js types

## New Dependency Added

### Recharts
```json
{
  "dependencies": {
    "recharts": "^2.10.0"
  }
}
```

**Purpose**: Data visualization library for React
**Used in**: `/src/components/experiments/MetricsChart.tsx`
**Features used**:
- LineChart
- BarChart
- AreaChart
- XAxis, YAxis
- CartesianGrid
- Tooltip
- Legend
- ResponsiveContainer

## Installation Command

Run this before starting the development server:

```bash
npm install recharts
```

Then start the dev server:

```bash
npm run dev
```

## Verification

After installation, verify Recharts is available:

```bash
npm list recharts
```

Expected output:
```
vibecode-webgui@1.0.0 /path/to/vibecode-webgui
└── recharts@2.10.0
```

## Alternative: Chart Libraries

If you prefer not to use Recharts, you can replace it with:

### Option 1: Chart.js + react-chartjs-2
```bash
npm install chart.js react-chartjs-2
```

### Option 2: Victory
```bash
npm install victory
```

### Option 3: Nivo
```bash
npm install @nivo/line @nivo/bar
```

However, the current implementation is optimized for Recharts. Using an alternative would require modifying `/src/components/experiments/MetricsChart.tsx`.

## Why Recharts?

1. **React-first**: Built specifically for React
2. **Declarative**: Component-based API
3. **Responsive**: Built-in responsive container
4. **Customizable**: Full control over appearance
5. **Performance**: Optimized for large datasets
6. **TypeScript**: Full TypeScript support
7. **Bundle size**: ~120KB gzipped (reasonable)
8. **Active maintenance**: Regular updates

## Build Size Impact

Adding Recharts will increase bundle size by approximately:
- **Development**: ~500KB (uncompressed)
- **Production**: ~120KB (gzipped)

This is acceptable for a data visualization dashboard and can be further optimized with:
- Code splitting (already implemented via Next.js routes)
- Dynamic imports (if needed)
- Tree shaking (automatic with modern bundlers)

## No Other Dependencies Required

All other components use existing dependencies:
- shadcn/ui components (already installed)
- Tailwind CSS (already configured)
- Next.js App Router (already set up)
- TypeScript (already configured)

## Summary

**Action Required**: Install Recharts
```bash
npm install recharts
```

**Then**: Start development server
```bash
npm run dev
```

**Navigate to**: http://localhost:3000/experiments

The dashboard will be fully functional after this single installation.
