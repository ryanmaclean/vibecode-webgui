# CLI Plugin Installation Verification

This directory contains tests and scripts to verify the plugin installation workflow via the vibecode CLI.

## Files

- **`plugin-installation-cli.spec.ts`** - Automated Playwright E2E test
- **`verify-plugin-cli.sh`** - Manual verification script
- **`README-CLI-VERIFICATION.md`** - This file

## Quick Start

### Automated Testing (Recommended)

Run the automated E2E test using Playwright:

```bash
# Run all E2E tests including CLI plugin tests
npm run test:e2e

# Run only the CLI plugin installation tests
npx playwright test tests/e2e/plugin-installation-cli.spec.ts

# Run with UI to see the tests in action
npx playwright test tests/e2e/plugin-installation-cli.spec.ts --headed
```

### Manual Verification

Run the manual verification script to test the workflow step-by-step:

```bash
# Make sure the dev server is running
npm run dev

# In another terminal, run the verification script
./tests/e2e/verify-plugin-cli.sh
```

## Verification Steps

The verification process tests the complete plugin lifecycle:

### 1. Install Plugin via CLI
```bash
vibecode plugin install ./plugins/examples/custom-model
```

**Expected Result:**
- Command exits with code 0
- Output contains "Plugin installed successfully"
- Plugin ID is displayed

### 2. List Plugins
```bash
vibecode plugin list
```

**Expected Result:**
- Command exits with code 0
- custom-model appears in the list
- Version, status, and description are shown

### 3. Verify via API
```bash
curl http://localhost:3000/api/plugins
```

**Expected Result:**
- HTTP 200 response
- custom-model plugin in response
- Status is "installed" or "enabled"
- Type is "ai-model"

### 4. Check Plugin Details
```bash
curl http://localhost:3000/api/plugins/custom-model
```

**Expected Result:**
- HTTP 200 response
- Full plugin metadata returned
- capabilities.providesAIModel is true
- Permissions include "ai-models:access"

### 5. Verify Custom Model Availability

**Expected Result:**
- Plugin type is "ai-model"
- Plugin has providesAIModel capability set to true
- Plugin has required AI model permissions

### 6. Uninstall Plugin
```bash
vibecode plugin uninstall custom-model
```

**Expected Result:**
- Command exits with code 0
- Output contains "Plugin uninstalled successfully"

### 7. Verify Removal
```bash
vibecode plugin list
```

**Expected Result:**
- custom-model does not appear in the list
- Either "No plugins installed" or empty list is shown
- API no longer returns the plugin

## Test Coverage

The automated test suite (`plugin-installation-cli.spec.ts`) includes:

### Main Workflow Tests
1. ✅ Complete plugin lifecycle (install → verify → uninstall)
2. ✅ Plugin help message display
3. ✅ Handling non-existent plugin paths
4. ✅ Handling uninstall of non-existent plugins
5. ✅ Listing plugins when none are installed
6. ✅ Showing plugin metadata after installation

### Custom Model Specific Tests
1. ✅ Verifying custom model plugin provides AI models
2. ✅ Verifying custom models are registered after installation
3. ✅ Checking AI model permissions
4. ✅ Validating plugin capabilities

## Prerequisites

Before running the tests:

1. **Development Server Running:**
   ```bash
   npm run dev
   ```

2. **Required Tools Installed:**
   - `curl` - For API calls
   - `jq` - For JSON parsing (optional but recommended)
   - `zip` - For packaging plugins

3. **Example Plugin Available:**
   - The custom-model plugin must exist at `./plugins/examples/custom-model/`

## Troubleshooting

### Test Fails: Server Not Accessible
**Problem:** Cannot connect to http://localhost:3000

**Solution:**
```bash
# Make sure the dev server is running
npm run dev

# Wait for the server to be ready
# You should see "ready" in the console output
```

### Test Fails: Plugin Not Found
**Problem:** custom-model plugin not found

**Solution:**
```bash
# Verify the plugin exists
ls -la ./plugins/examples/custom-model/

# Should show: plugin.json, index.ts, README.md
```

### Test Fails: CLI Not Found
**Problem:** vibecode command not found

**Solution:**
```bash
# Make sure the CLI exists
ls -la ./vibecode

# Make it executable if needed
chmod +x ./vibecode
```

### Test Fails: Permission Denied
**Problem:** Cannot execute the verification script

**Solution:**
```bash
# Make the script executable
chmod +x ./tests/e2e/verify-plugin-cli.sh
```

### API Returns 404
**Problem:** API endpoints return 404

**Solution:**
This may be expected for unauthenticated requests. The CLI handles authentication internally. If tests fail, check:
- Server is running on correct port (3000)
- API routes exist in `src/app/api/plugins/`
- No TypeScript compilation errors

## Success Criteria

All tests pass when:

- ✅ Plugin can be installed from a local directory
- ✅ Plugin appears in the list after installation
- ✅ Plugin details are accessible via API
- ✅ Plugin has correct type (ai-model) and capabilities
- ✅ Plugin has required permissions
- ✅ Plugin can be uninstalled
- ✅ Plugin is removed from list after uninstall
- ✅ Error handling works correctly (non-existent plugins, etc.)

## Integration with CI/CD

These tests are part of the E2E test suite and will run automatically in CI:

```bash
npm run test:e2e
```

To run only plugin-related tests in CI:

```bash
npx playwright test tests/e2e/plugin-installation-*.spec.ts
```

## Related Documentation

- [Plugin API Documentation](../../docs/PLUGIN_API.md)
- [Custom Model Plugin README](../../plugins/examples/custom-model/README.md)
- [vibecode CLI Source](../../vibecode)
- [Plugin Manager Implementation](../../src/lib/plugins/plugin-manager.ts)
