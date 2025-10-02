---
name: Code-Server Extension Build Monitoring
about: Track code-server extension update builds
title: '[Code-Server] Monitor Extension Update Builds - <Extension Names> <Versions>'
labels: ['code-server', 'build-monitoring', 'extensions']
assignees: ''

---

## 🔄 Code-Server Extension Update - Build Monitoring

**Triggered:** YYYY-MM-DD
**Workflow:** `codeserver-multiarch.yml`
**Status:** ⏳ Monitoring

---

## 📦 Extensions Updated

### Extension 1
- **Extension ID:** `publisher.extension-name`
- **Version:** X.Y.Z
- **Marketplace:** https://marketplace.visualstudio.com/items?itemName=publisher.extension-name

### Extension 2
- **Extension ID:** `publisher.extension-name`
- **Version:** X.Y.Z
- **Marketplace:** https://marketplace.visualstudio.com/items?itemName=publisher.extension-name

---

## 🎯 Build Targets

### Multi-Arch Workflow (Primary)
**Workflow:** `codeserver-multiarch.yml`
**Architectures:** linux/amd64, linux/arm64

**Tags:**
- `latest`
- `stable`
- `{SHA}`
- `ci-{RUN_ID}-{SHA}`
- `amd64-canary`
- `arm64-canary`

**Build Steps:**
1. ⏳ Validation job (lint, typecheck, unit tests)
2. ⏳ Multi-arch build
3. ⏳ KinD smoke test
4. ⏳ Build-push job
5. ⏳ SBOM generation
6. ⏳ Datadog metrics

---

## ✅ Validation Checklist

### Build Verification
- [ ] Multi-arch workflow completes successfully
- [ ] All validation tests pass (lint, typecheck, unit)
- [ ] KinD smoke test passes
- [ ] SBOM generated successfully
- [ ] Images pushed to GHCR

### Extension Verification
```bash
# Pull latest image
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:latest

# Verify extension versions
docker run --rm ghcr.io/ryanmaclean/vibecode-codeserver:latest \
  code-server --list-extensions --show-versions | grep -E "extension1|extension2"
```

### Multi-Arch Verification
```bash
# Test AMD64
docker run --rm --platform linux/amd64 \
  ghcr.io/ryanmaclean/vibecode-codeserver:latest \
  code-server --list-extensions | grep -E "extension1|extension2"

# Test ARM64
docker run --rm --platform linux/arm64 \
  ghcr.io/ryanmaclean/vibecode-codeserver:latest \
  code-server --list-extensions | grep -E "extension1|extension2"
```

### Functional Testing
- [ ] Start code-server container
- [ ] Access UI at http://localhost:8765
- [ ] Open Command Palette (Cmd/Ctrl+Shift+P)
- [ ] Verify extensions load correctly
- [ ] Test basic extension functionality

---

## 📊 Monitoring

### GitHub Actions
```bash
# Watch workflow progress
gh run watch

# List recent runs
gh run list --workflow=codeserver-multiarch.yml --limit 5

# View specific run
gh run view <RUN_ID> --log

# Automated monitoring
./scripts/monitor-codeserver-build.sh
```

### Automated Verification
```bash
# Run verification script
./scripts/verify-codeserver-extensions.sh
```

### Datadog Metrics
Check metrics at: https://app.datadoghq.com/dashboard/code-server-builds

Expected metrics:
- `codeserver.build.duration` - Build time (15-25 minutes)
- `codeserver.build.status` - Success/failure (1/0)
- `codeserver.build.image_size` - Image size per arch
- `codeserver.build.layers` - Layer count

---

## 🚨 Failure Scenarios

### Build Fails
**Action:** Check build logs with `gh run view <RUN_ID> --log`

**Common Issues:**
- Extension marketplace timeout
- Multi-arch compilation failure
- KinD cluster setup failure

### Extensions Not Installing
**Action:** Check extension installation logs

**Common Issues:**
- Invalid extension ID
- Marketplace API rate limit
- Network timeout

### KinD Smoke Test Fails
**Action:** Review KinD diagnostics artifacts

**Common Issues:**
- Container startup timeout
- Port binding conflicts
- Extension compatibility

---

## 📚 Documentation

- **Monitoring Guide:** `claudedocs/CODE_SERVER_BUILD_MONITORING_<DATE>.md`
- **Quick Reference:** `docs/CODE_SERVER_BUILD_MONITORING_QUICK_REF.md`
- **Extension Update Details:** `claudedocs/CODE_SERVER_EXTENSIONS_UPDATE_<DATE>.md`
- **Workflows:**
  - `.github/workflows/codeserver-multiarch.yml`
  - `.github/workflows/codeserver-profiles.yml`

---

## 🎯 Next Steps

### Immediate (Auto)
1. Monitor workflow completion (~15-25 minutes)
2. Check for build failures
3. Review SBOM artifacts

### Post-Build (Manual)
1. Run verification: `./scripts/verify-codeserver-extensions.sh`
2. Verify extension versions in built images
3. Test extension functionality
4. Update CHANGELOG.md
5. Close this issue

### Follow-up
1. Trigger profile builds if needed
2. Test multi-arch manifests
3. Update documentation
4. Announce updates

---

## 🤖 Automation Status

- ✅ Workflow triggered automatically
- ✅ Build validation configured
- ✅ SBOM generation enabled
- ✅ Datadog metrics instrumented
- ⏳ Awaiting build completion

**Estimated Completion:** ~20 minutes from trigger
**Monitor Progress:** `gh run watch` or `./scripts/monitor-codeserver-build.sh --watch`
