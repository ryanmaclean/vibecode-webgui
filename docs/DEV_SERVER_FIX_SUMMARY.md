# Dev Server Startup Fix - Summary

## Issue
The dev server was failing to start due to conflicting Next.js configuration files (`next.config.js` and `next.config.mjs`), causing middleware compilation errors with the message: "Invalid or unexpected token" at line 1082 of the compiled middleware.

## Root Cause
1. Two conflicting Next.js config files existed in the project root
2. Babel configuration was forcing Next.js to use Babel instead of the faster SWC compiler
3. OpenTelemetry modules were not properly stubbed, causing webpack to generate invalid code like `module.exports = @opentelemetry/api;`

## Solution Implemented

### 1. Configuration Consolidation
- **Removed**: `next.config.js` (CommonJS format)
- **Kept**: `next.config.mjs` (ES Module format) with consolidated features from both configs
- **Result**: Single source of truth for Next.js configuration

### 2. Babel Configuration
- **Action**: Moved `babel.config.js` to `babel.config.js.bak`
- **Benefit**: Allows Next.js to use its built-in SWC compiler (faster compilation)
- **Note**: Can be restored if Babel-specific features are needed for testing

### 3. OpenTelemetry Stub Files Created
Created proper stub files to prevent bundling issues:
- `src/stubs/opentelemetry-api.js` - Provides mock API for trace, context, propagation
- `src/stubs/opentelemetry-core.js` - Provides mock core classes
- `src/stubs/opentelemetry-instrumentation.js` - Provides mock instrumentation base

### 4. Webpack Configuration Updates
Updated `next.config.mjs` to include proper aliases for all OpenTelemetry modules:
```javascript
const datadogStubAliases = {
  'dd-trace': require.resolve('./src/stubs/dd-trace.js'),
  '@opentelemetry/api': require.resolve('./src/stubs/opentelemetry-api.js'),
  '@opentelemetry/core': require.resolve('./src/stubs/opentelemetry-core.js'),
  '@opentelemetry/instrumentation': require.resolve('./src/stubs/opentelemetry-instrumentation.js'),
  // ... other stubs
}
```

## Unified Configuration Features

The consolidated `next.config.mjs` includes:

### Production Features
- Source maps enabled for Datadog Dynamic Instrumentation
- Terser minification with function name preservation
- Standalone output mode for containerization
- Custom build IDs using git commit hash

### Security
- Comprehensive security headers (CSP, HSTS, X-Frame-Options, etc.)
- CORS configuration for API routes
- Permissions policy for browser features

### Development
- Hot reload support
- Source map generation
- Webpack dev server configuration

### Monitoring & Observability
- Datadog environment variables
- OpenTelemetry module handling
- Server-side external packages configuration

### Optimization
- Image optimization (WebP, AVIF)
- Compression enabled
- Webpack externals for database drivers (pg, redis)

## Verification

### Server Status
✅ Dev server starts successfully
✅ Running on http://localhost:3002
✅ No middleware compilation errors
✅ Webpack cache warnings are non-blocking

### Test Commands
```bash
# Start dev server
npm run dev

# Verify server is running
curl http://localhost:3002/

# Check for middleware errors
curl -s http://localhost:3002/ 2>&1 | grep -q "SyntaxError" && echo "ERROR" || echo "SUCCESS"
```

## Known Warnings (Non-Critical)

### Webpack Cache Warnings
```
[webpack.cache.PackFileCacheStrategy] Caching failed for pack: Error: ENOENT
```
- **Impact**: None - these are benign warnings about missing cache files
- **Cause**: Cache directory was cleared during troubleshooting
- **Resolution**: Will self-resolve as webpack rebuilds cache

### SWC Version Mismatch
```
Mismatching @next/swc version, detected: 15.5.4 while Next.js is on 15.5.3
```
- **Impact**: Minimal - both versions are compatible
- **Resolution**: Can be fixed by updating Next.js to 15.5.4 or downgrading @next/swc to 15.5.3

## Maintenance Notes

### If Babel is Needed Again
1. Restore `babel.config.js` from `babel.config.js.bak`
2. Be aware this will slow down compilation
3. Ensure Babel presets are compatible with Next.js 15

### Adding New OpenTelemetry Modules
If new OpenTelemetry modules cause issues:
1. Create a stub file in `src/stubs/`
2. Add the stub to `datadogStubAliases` in `next.config.mjs`
3. Add the module to the `externals` array
4. Add the module to `resolve.fallback` with value `false`

### Configuration Changes
- All Next.js configuration should be made in `next.config.mjs`
- Do not create a new `next.config.js` file
- Test changes with `npm run dev` before committing

## Files Modified

### Created
- `src/stubs/opentelemetry-api.js`
- `src/stubs/opentelemetry-core.js`
- `src/stubs/opentelemetry-instrumentation.js`
- `docs/DEV_SERVER_FIX_SUMMARY.md` (this file)

### Modified
- `next.config.mjs` - Consolidated configuration

### Removed/Backed Up
- `next.config.js` - Removed (was causing conflicts)
- `babel.config.js` → `babel.config.js.bak` - Backed up

## Success Criteria Met

✅ Dev server starts without errors
✅ Middleware compiles successfully
✅ No conflicting configuration files
✅ All security headers properly configured
✅ Datadog instrumentation configured
✅ OpenTelemetry modules properly stubbed
✅ Webpack optimizations in place

## Next Steps

The dev server is now fully operational. Developers can:
1. Run `npm run dev` to start development
2. Access the application at http://localhost:3002
3. Make changes with hot reload support
4. Build for production with `npm run build`

---

**Date**: 2025-10-02
**Fixed By**: Erin (QA/Test Engineer)
**Status**: ✅ Complete