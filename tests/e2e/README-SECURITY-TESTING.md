# Plugin Security Testing

This document describes the security testing approach for the plugin sandboxing system.

## Overview

The plugin security tests verify that the sandbox properly isolates and restricts plugin execution to prevent malicious behavior.

## Test Files

- `plugin-sandboxing-security.spec.ts` - Comprehensive E2E security tests

## Security Features Tested

### 1. Permission Enforcement

**What it tests:**
- Plugins without filesystem permissions cannot access the filesystem
- Plugins must declare permissions in their manifest
- Permission prerequisites are enforced (e.g., `filesystem:write` requires `filesystem:read`)

**How it works:**
- Creates a malicious plugin without `filesystem:read` or `filesystem:write` permissions
- Attempts to read/write files from the plugin code
- Verifies that the `fs` module is unavailable in the sandbox context

**Expected behavior:**
```javascript
// In sandbox without filesystem permissions:
typeof fs === 'undefined'  // fs module not provided
```

### 2. Path Restriction

**What it tests:**
- Plugins can only access their designated data directory
- Attempts to access system files are blocked
- Directory traversal attacks are prevented

**How it works:**
- Plugin attempts to read `/etc/passwd`
- Plugin attempts to use `../../` path traversal
- Plugin attempts to write to `/tmp`

**Expected behavior:**
```
Access denied: /etc/passwd is not in allowed paths
Access denied: /tmp/malicious.txt is not in allowed paths
```

### 3. Sandbox Isolation

**What it tests:**
- Plugin code runs in an isolated VM context
- Dangerous Node.js modules are not accessible
- Timeout and memory limits are enforced

**Security boundaries:**
- ✅ Safe: `console`, `setTimeout`, `Promise`, `JSON`, etc.
- ✅ Conditional: `fs` (only with permission), `fetch` (only with permission)
- ❌ Blocked: `require('child_process')`, `require('fs')`, `process.exit()`, etc.

### 4. Error Messages

**What it tests:**
- Clear error messages explain why operations are blocked
- Users understand permission requirements
- Security denials are logged appropriately

**Expected messages:**
- "fs module not available (no filesystem permission)"
- "Access denied: [path] is not in allowed paths"
- "Permission 'filesystem:write' requires 'filesystem:read'"

## Test Scenarios

### Scenario 1: Malicious Plugin Without Permissions

**Setup:**
- Plugin manifest: `permissions: ["commands:register"]` (no filesystem)
- Plugin code: Attempts to read `/etc/passwd`, write to `/tmp`, directory traversal

**Expected result:**
- ✅ All filesystem operations are blocked
- ✅ `fs` module is `undefined` in sandbox
- ✅ Plugin can still execute safe operations (logging, etc.)
- ✅ No security breaches occur

**Test command:**
```bash
npx playwright test tests/e2e/plugin-sandboxing-security.spec.ts -g "should block malicious plugin"
```

### Scenario 2: Safe Plugin With Permissions

**Setup:**
- Plugin manifest: `permissions: ["filesystem:read", "filesystem:write"]`
- Plugin code: Writes to own data directory

**Expected result:**
- ✅ Plugin CAN access its data directory
- ✅ Plugin CANNOT access paths outside data directory
- ✅ Demonstrates permission system works correctly

### Scenario 3: Invalid Permission Prerequisites

**Setup:**
- Plugin manifest: `permissions: ["filesystem:write"]` (missing prerequisite)

**Expected result:**
- ✅ Validation catches missing prerequisite
- ✅ Error message: "Permission 'filesystem:write' requires 'filesystem:read'"
- ✅ Installation fails or shows warning

**Test command:**
```bash
npx playwright test tests/e2e/plugin-sandboxing-security.spec.ts -g "should validate permissions"
```

## Attack Vectors Tested

### 1. System File Access
```javascript
// ATTACK: Read sensitive system files
await fs.readFile('/etc/passwd')
// BLOCKED: "Access denied: /etc/passwd is not in allowed paths"
```

### 2. Unauthorized Write Operations
```javascript
// ATTACK: Write to system directories
await fs.writeFile('/tmp/malicious.txt', 'data')
// BLOCKED: "Access denied: /tmp/malicious.txt is not in allowed paths"
```

### 3. Directory Traversal
```javascript
// ATTACK: Access parent directories
await fs.readFile('../../package.json')
// BLOCKED: "Access denied: ../../package.json is not in allowed paths"
```

### 4. Module Injection
```javascript
// ATTACK: Require dangerous modules
require('child_process')
// BLOCKED: "Module 'child_process' is not allowed in sandbox"
```

## Running the Tests

### Run all security tests:
```bash
npx playwright test tests/e2e/plugin-sandboxing-security.spec.ts
```

### Run specific test:
```bash
npx playwright test tests/e2e/plugin-sandboxing-security.spec.ts -g "malicious plugin"
```

### Run with UI (helpful for debugging):
```bash
npx playwright test tests/e2e/plugin-sandboxing-security.spec.ts --ui
```

### Run with debugging:
```bash
npx playwright test tests/e2e/plugin-sandboxing-security.spec.ts --debug
```

## Prerequisites

1. **Development server running:**
   ```bash
   npm run dev
   ```

2. **Database setup:**
   ```bash
   npx prisma db push
   ```

3. **Playwright installed:**
   ```bash
   npx playwright install
   ```

## Test Output

### Successful Test Output

```
📍 Step 1: Navigating to /plugins page
✅ Plugin Manager page loaded

📍 Step 2: Installing malicious plugin (should succeed)
✅ Install dialog opened
✅ Malicious plugin file selected
✅ Install initiated
✅ Plugin installation completed (with or without warnings)

📍 Step 3: Verifying plugin in list
ℹ️ Plugin was installed - testing sandbox execution...

📍 Step 4: Enabling plugin to test sandbox
✅ Clicked enable button

📍 Step 5: Verifying sandbox blocked attacks
✅ Sandbox blocked 3 malicious operations
  - BLOCKED: fs module not available
  - BLOCKED: fs module not available
  - BLOCKED: fs module not available
✅ No security breaches detected

📍 Step 6: Checking error messages
✅ Clear permission error messages displayed

📍 Step 7: Cleaning up malicious plugin
✅ Malicious plugin uninstalled
✅ Security test completed successfully
```

### Failed Test (Security Breach Detected)

```
❌ CRITICAL: Security breaches detected!
  - SECURITY BREACH: Successfully read /etc/passwd!
Error: SECURITY VULNERABILITY: Malicious plugin bypassed sandbox!
```

## Security Best Practices

### For Plugin Developers

1. **Request minimum permissions:**
   ```json
   {
     "permissions": ["commands:register"]  // Only what you need
   }
   ```

2. **Declare permission prerequisites:**
   ```json
   {
     "permissions": [
       "filesystem:read",    // Prerequisite
       "filesystem:write"    // Requires filesystem:read
     ]
   }
   ```

3. **Use plugin data directory:**
   ```javascript
   // GOOD: Use provided data path
   await fs.writeFile(`${context.dataPath}/config.json`, data)

   // BAD: Don't try to access system paths
   await fs.writeFile('/tmp/config.json', data)  // BLOCKED
   ```

### For Security Reviewers

1. **Check manifest permissions:**
   - Are they minimal and necessary?
   - Are prerequisites declared?
   - Are there any high-risk permissions?

2. **Review plugin code:**
   - Does it attempt to access system resources?
   - Are there any suspicious dependencies?
   - Does it use allowed APIs correctly?

3. **Test with security suite:**
   - Run sandbox security tests
   - Verify error handling
   - Check permission validation

## Known Limitations

### Current Implementation (Node.js `vm` module)

⚠️ **Note:** The current sandbox uses Node.js's built-in `vm` module, which provides context isolation but is NOT a complete security boundary.

**Recommended for production:**
- Upgrade to `VM2` (better isolation)
- Or use `isolated-vm` (V8 isolate-based)
- Implement process-level isolation (separate processes)

### Future Improvements

1. **Process isolation:** Run plugins in separate processes
2. **Resource limits:** CPU, memory, network bandwidth quotas
3. **Audit logging:** Track all plugin operations for security review
4. **Runtime monitoring:** Detect anomalous behavior
5. **Code signing:** Verify plugin authenticity and integrity

## Troubleshooting

### Test hangs on installation

**Solution:** Increase timeout or check dev server is running
```bash
# Verify server is running
curl http://localhost:3000/api/plugins

# Restart dev server
npm run dev
```

### Plugin zip creation fails

**Solution:** Ensure `zip` command is available
```bash
# macOS/Linux
which zip

# Install if missing (macOS)
brew install zip
```

### Permission errors in logs

**Solution:** This is expected! The test verifies permissions are enforced.
Check that errors say "BLOCKED" not "SECURITY BREACH"

## References

- [Plugin Architecture Documentation](../../docs/PLUGIN_API.md)
- [Sandbox Implementation](../../src/lib/plugins/plugin-sandbox.ts)
- [Permission Validator](../../src/lib/plugins/plugin-permissions.ts)
- [Playwright Testing](https://playwright.dev)

## Security Reporting

If you discover a security vulnerability in the plugin system:

1. **DO NOT** create a public issue
2. **DO** report it privately to the security team
3. **DO** provide detailed reproduction steps
4. **DO** include your test code if applicable

---

**Last Updated:** 2026-02-19
**Test Coverage:** Filesystem access, Permission validation, Sandbox isolation
