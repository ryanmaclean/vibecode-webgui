# Musl Build System - Quick Reference Card

## 🚀 One-Line Commands

```bash
# Build BusyBox with musl
./scripts/benchmarks/build-busybox-musl.sh

# Compare Docker musl vs glibc
./scripts/benchmarks/docker-musl-vs-glibc.sh

# Validate all builds
./scripts/benchmarks/test-musl-builds.sh

# Import Datadog dashboard
datadog-ci dashboard import configs/datadog/musl-build-dashboard.json
```

---

## 📊 Expected Results

| What | musl | glibc | Win |
|------|------|-------|-----|
| Image | 300MB | 800MB | **62%** |
| Build | 6min | 10min | **40%** |
| Boot | 1.0s | 2.5s | **60%** |
| RAM | 90MB | 150MB | **40%** |

---

## 📈 Datadog Metrics

### BusyBox
- `busybox.build.duration` - Build time (s)
- `busybox.binary.size` - Binary size (bytes)
- `busybox.initramfs.size` - Initramfs (bytes)

### Docker
- `docker.build.duration` - Build time (s)
- `docker.image.size` - Image size (bytes)
- `docker.coldstart.duration` - Startup (s)
- `docker.memory.usage` - RAM (MB)
- `docker.layers.count` - Layers

**Tags**: `variant:musl/glibc`, `platform:linux/macos`, `ci:true/false`

---

## 🔧 Environment Variables

```bash
# BusyBox build
export BUSYBOX_VERSION="1.36.1"

# Datadog
export DD_API_KEY="your-key"
export DD_SITE="datadoghq.com"
```

---

## 📁 Key Files

```
scripts/benchmarks/
├── build-busybox-musl.sh    ← Build BusyBox
├── docker-musl-vs-glibc.sh  ← Compare Docker
└── test-musl-builds.sh      ← Validate

.github/workflows/
└── musl-benchmarks.yml      ← CI automation

configs/datadog/
└── musl-build-dashboard.json ← Dashboard

docker/
└── Dockerfile.prod.alpine   ← Alpine image

docs/
└── musl-build-system.md     ← Full docs
```

---

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails on macOS | `brew install filosottile/musl-cross/musl-cross` |
| Native modules fail | Add `python3 make g++ linux-headers` to Dockerfile |
| Prisma not found | Add `binaryTargets: ["linux-musl"]` to schema |
| No Datadog metrics | Set `DD_API_KEY` environment variable |

---

## 🎯 CI/CD Integration

```yaml
# .github/workflows/your-workflow.yml
jobs:
  musl-benchmarks:
    uses: ./.github/workflows/musl-benchmarks.yml
    secrets: inherit
```

---

## 📞 Help

- **Full docs**: `docs/musl-build-system.md`
- **Summary**: `MUSL_BUILD_SUMMARY.md`
- **This card**: `MUSL_QUICK_REFERENCE.md`

---

**Version**: 1.0.0 | **Updated**: 2025-10-22
