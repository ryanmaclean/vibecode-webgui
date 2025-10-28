# Next.js 15.5.4 Production Minification Bug Investigation

**Issue:** #442 - Enable Production Minification
**Date:** 2025-10-02
**Engineer:** Riley (Build Engineer)
**Status:** CRITICAL BLOCKER - Framework Bug Confirmed

## Quick Summary

Production builds with minification **FAIL** in Next.js 15.4.7 through 15.5.4 due to internal `minify-webpack-plugin` bug. Downgrading does NOT fix the issue. The bug spans the entire 15.4.x and 15.5.x series.

## Error Signature

```
TypeError: _webpack.WebpackError is not a constructor
  at buildError (node_modules/next/dist/build/webpack/plugins/minify-webpack-plugin/src/index.js:24:16)
```

## Version Test Results

| Version | Status | Notes |
|---------|--------|-------|
| 15.5.4 | FAIL | Current version |
| 15.5.3 | FAIL | Same bug |
| 15.5.1 | FAIL | Same bug |
| 15.5.0 | FAIL | Bug origin |
| 15.4.7 | FAIL | Bug extends to 15.4.x |

## Root Cause

The minify-webpack-plugin attempts to instantiate `_webpack.WebpackError` as a constructor, but this is either not exported or removed from Next.js's internal webpack bundle.

## Workaround (NOT RECOMMENDED)

Disabling minification allows builds to succeed but defeats the 40% bundle reduction goal:

```javascript
// next.config.mjs
config.optimization = {
  ...config.optimization,
  minimize: false, // WORKAROUND: Disables optimization
}
```

**Result with workaround:**
- Build succeeds
- Bundle size: 1.4GB (unminified)
- Expected with minification: ~560MB
- Performance impact: HIGH

## Recommendations

1. **DO:** Pin Next.js version to prevent accidental upgrades
2. **DO:** Monitor Next.js releases for fix (15.5.5+, 15.6.0)
3. **DO:** Keep current next.config.mjs settings (they are correct)
4. **DON'T:** Deploy with minification disabled (defeats optimization goals)
5. **DON'T:** Downgrade to older versions (high regression risk)

## Impact

- Production deployment with minification: BLOCKED
- 40% bundle reduction goal (issue #442): BLOCKED
- CI/CD pipelines: BLOCKED
- Performance optimization: BLOCKED

## Next Steps

1. Wait for Next.js framework fix in 15.5.5+ or 15.6.0
2. Test each new Next.js release as published
3. Monitor vercel/next.js GitHub for "minify" related fixes
4. Update team on deployment blocker status

## Configuration Status

Current next.config.mjs settings are **CORRECT** - do not modify. The issue is an internal Next.js bug, not a configuration problem.

## References

- GitHub Issue: #442
- Comment: https://github.com/ryanmaclean/vibecode-webgui/issues/442#issuecomment-3359305557
- Build logs: /tmp/build-15.*.log
