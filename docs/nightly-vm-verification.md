# Nightly VM Verification Checklist

## Automated Verification Workflow

Runs every night at 3 AM UTC to verify OpenVSCode microVM health across all channels.

## Pre-flight Checks

- [ ] **Registry accessible**: Verify artifact registry is reachable
- [ ] **Credentials valid**: Check authentication tokens
- [ ] **Disk space**: Ensure >10GB free for downloads
- [ ] **Network**: Validate internet connectivity

## Stable Channel Verification

### Boot Performance
- [ ] Cold boot completes in <10 seconds
- [ ] Warm boot completes in <3 seconds
- [ ] Memory usage <512MB at idle
- [ ] CPU usage <5% at idle

### Functionality Tests
- [ ] Editor loads without errors
- [ ] File operations work (create, edit, save, delete)
- [ ] Extension marketplace accessible
- [ ] Terminal opens and executes commands
- [ ] Git operations functional
- [ ] Search/find works across workspace

### Integration Tests
- [ ] Language servers start correctly (TypeScript, Python, Go)
- [ ] Debugger attaches and hits breakpoints
- [ ] IntelliSense provides completions
- [ ] Code formatting works
- [ ] Linting shows diagnostics

### Security Checks
- [ ] No CVEs in dependencies (npm audit clean)
- [ ] Binary signatures verify
- [ ] No hardcoded secrets in image
- [ ] Firewall rules applied correctly

## Insiders Channel Verification

### Quick Smoke Tests
- [ ] VM boots successfully
- [ ] Editor UI renders
- [ ] Can open and edit a file
- [ ] Terminal works
- [ ] No critical console errors

### Regression Detection
- [ ] Compare boot time vs previous insiders
- [ ] Compare memory usage vs previous insiders
- [ ] Check for new errors in logs
- [ ] Validate new features if announced

## Multi-Architecture Verification

Run tests on all supported architectures:

### ARM64 (Apple Silicon)
- [ ] M1/M2/M3 native performance
- [ ] Rosetta not required
- [ ] <10s cold boot
- [ ] All functionality tests pass

### x86_64 (Intel)
- [ ] Standard Intel Macs
- [ ] Lima/Colima compatibility
- [ ] HyperKit support
- [ ] All functionality tests pass

### ARMv7 (Raspberry Pi)
- [ ] Boots on RPi 4+ (4GB RAM minimum)
- [ ] Acceptable performance (>20s boot acceptable)
- [ ] Basic editor functionality works

## Failure Handling

### Critical Failures (Block Release)
- Boot failure
- Data corruption
- Security vulnerability
- Core functionality broken (editor won't load)

**Action**: Rollback to previous stable, file incident report

### Major Failures (Investigate)
- Performance regression >20%
- New crashes in common workflows
- Extension compatibility issues
- Language server failures

**Action**: Create high-priority issue, consider hotfix

### Minor Failures (Track)
- UI glitches
- Non-critical warnings
- Edge case bugs
- Performance regression <10%

**Action**: Create issue for next release

## Reporting

### Success Report (Slack/Email)
```
✅ Nightly VM Verification PASSED
Channel: stable-v1.2.3
Architecture: arm64
Boot Time: 8.4s (target: <10s)
Memory: 387MB (target: <512MB)
All tests: 45/45 passed
```

### Failure Report (PagerDuty/Slack)
```
❌ Nightly VM Verification FAILED
Channel: insiders-20251004
Architecture: arm64
Failed: Boot timeout after 30s
Expected: <10s
Action: Rollback triggered, incident #1234 created
```

## Automation

The nightly verification runs via GitHub Actions:

```yaml
# .github/workflows/nightly-vm-verification.yml
on:
  schedule:
    - cron: '0 3 * * *'  # 3 AM UTC
  workflow_dispatch:

jobs:
  verify:
    strategy:
      matrix:
        channel: [stable, insiders]
        arch: [arm64, x86_64]
    runs-on: ${{ matrix.arch == 'arm64' && 'macos-14' || 'ubuntu-latest' }}
    steps:
      - name: Download VM artifact
        run: ./scripts/download-vm.sh ${{ matrix.channel }}
      
      - name: Run verification suite
        run: ./scripts/verify-vm.sh --channel ${{ matrix.channel }} --checklist
      
      - name: Report results
        run: ./scripts/report-verification.sh --slack --datadog
```

## Manual Verification

For manual testing during development:

```bash
# Run full checklist
./scripts/verify-vm.sh --channel stable --checklist --verbose

# Run specific checks
./scripts/verify-vm.sh --check boot-performance
./scripts/verify-vm.sh --check functionality
./scripts/verify-vm.sh --check security

# Generate report
./scripts/verify-vm.sh --report --output verification-report.html
```

## Metrics & Monitoring

Track verification results in Datadog:
- Success rate over time
- Boot time trends
- Memory usage trends
- Test duration
- Failure patterns

Dashboard: `https://app.datadoghq.com/dashboard/openvscode-vm-health`
