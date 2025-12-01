# Quick Start: VibeCode Test Scripts

Fast reference guide for running VibeCode automated tests.

## Run All Tests

```bash
/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-all-apps.sh
```

This runs complete test suite for both applications and generates reports.

## Run Individual Tests

**BasicVibeCode only:**
```bash
/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-basicvibecode.sh
```

**VibeCode MultiVM only:**
```bash
/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-vibecode-multivm.sh
```

## View Results

**Latest text report:**
```bash
ls -t /tmp/vibecode-tests/test-report-*.txt | head -1 | xargs cat
```

**Latest JSON report:**
```bash
ls -t /tmp/vibecode-tests/test-report-*.json | head -1 | xargs cat | python3 -m json.tool
```

**Live log monitoring:**
```bash
tail -f /tmp/vibecode-tests/test-results-*.log
```

## Test Coverage

### BasicVibeCode (11 tests)
- App existence and executable validation
- Launch without crash
- Entitlements verification
- VM boot detection
- DHCP networking capability
- Network configuration
- OpenVSCode URL generation
- Console output capture
- Graceful shutdown
- Error handling

### VibeCode MultiVM (23 tests)
- Build configuration and syntax
- Observability framework integration
- VM discovery implementation
- Multi-VM management support
- UI components and functionality
- Error handling and resilience
- Code signing and entitlements
- Application launch

## Exit Codes

- `0` = All tests passed
- `1` = Some tests failed

Use in scripts:
```bash
/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-all-apps.sh
if [ $? -eq 0 ]; then
  echo "Success"
else
  echo "Tests failed"
fi
```

## Output Location

All test results saved to: `/tmp/vibecode-tests/`

Files generated:
- `test-results-TIMESTAMP.log` - Main log
- `test-report-TIMESTAMP.txt` - Text report
- `test-report-TIMESTAMP.json` - JSON report

## Common Tasks

### Check if app exists
```bash
ls -d /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/*.app
```

### Make scripts executable
```bash
chmod +x /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-*.sh
```

### Clean up old logs (keep last 5)
```bash
cd /tmp/vibecode-tests && ls -t | tail -n +6 | xargs rm -f
```

### Run with custom timeout
Edit the test script and adjust:
```bash
TIMEOUT_APP_LAUNCH=60
TIMEOUT_VM_BOOT=120
```

## Script Details

| Script | Purpose | Tests | Duration |
|--------|---------|-------|----------|
| test-basicvibecode.sh | Basic app testing | 11 | 30-45s |
| test-vibecode-multivm.sh | MultiVM app testing | 23 | 40-60s |
| test-all-apps.sh | Master runner | 34 | 80-120s |

## Troubleshooting

**Scripts won't run:**
```bash
chmod +x /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/test-*.sh
```

**Can't write logs:**
```bash
mkdir -p /tmp/vibecode-tests && chmod 777 /tmp/vibecode-tests
```

**Apps not found:**
```bash
# Verify apps exist
file /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/BasicVibeCode.app
file /Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/LiquidGlassVibeCode.app
```

**Need help:**
See full documentation in: `TEST-SCRIPTS-README.md`

---

Quick reference | Full docs: `TEST-SCRIPTS-README.md`
