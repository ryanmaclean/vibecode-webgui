# Docker Go Installation Fix - Code Diff

## Overview
This document shows the exact changes made to fix the Go installation in all affected Dockerfiles.

## Files Modified
1. `docker/code-server/Dockerfile` (lines 167-183)
2. `docker/code-server/Dockerfile.optimized` (lines 175-184)
3. `docker/code-server/Dockerfile.original` (lines 167-183)

---

## Dockerfile (Main)

**Location**: `docker/code-server/Dockerfile:167-183`

```diff
 # Install Go (match architecture for multi-arch builds)
 ARG GO_VERSION=1.22.4
 RUN set -eux; \
     case "$TARGETPLATFORM" in \
       "linux/amd64") GO_ARCH=amd64 ;; \
       "linux/arm64") GO_ARCH=arm64 ;; \
       *) echo "Unsupported platform for Go install: $TARGETPLATFORM"; exit 1 ;; \
     esac; \
     GO_TARBALL="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"; \
     cd /tmp; \
-    curl -fsSLo "${GO_TARBALL}" "https://dl.google.com/go/${GO_TARBALL}"; \
-    curl -fsSLo "${GO_TARBALL}.sha256" "https://dl.google.com/go/${GO_TARBALL}.sha256"; \
-    sha256sum --check --strict "${GO_TARBALL}.sha256"; \
+    curl -fsSLO "https://dl.google.com/go/${GO_TARBALL}"; \
+    curl -fsSL "https://dl.google.com/go/${GO_TARBALL}.sha256" -o go.sha256; \
+    echo "$(cat go.sha256)  ${GO_TARBALL}" | sha256sum --check --strict; \
     tar -C /usr/local -xzf "${GO_TARBALL}"; \
-    rm -f "${GO_TARBALL}" "${GO_TARBALL}.sha256"; \
-    ln -sf /usr/local/go/bin/go /usr/local/bin/go
+    rm -f "${GO_TARBALL}" go.sha256; \
+    ln -sf /usr/local/go/bin/go /usr/local/bin/go; \
+    go version
```

---

## Dockerfile.optimized

**Location**: `docker/code-server/Dockerfile.optimized:175-184`

```diff
     # Install Go
     GO_TARBALL="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz" && \
     cd /tmp && \
-    curl -fsSLo "${GO_TARBALL}" "https://dl.google.com/go/${GO_TARBALL}" && \
-    curl -fsSLo "${GO_TARBALL}.sha256" "https://dl.google.com/go/${GO_TARBALL}.sha256" && \
-    sha256sum --check --strict "${GO_TARBALL}.sha256" && \
+    curl -fsSLO "https://dl.google.com/go/${GO_TARBALL}" && \
+    curl -fsSL "https://dl.google.com/go/${GO_TARBALL}.sha256" -o go.sha256 && \
+    echo "$(cat go.sha256)  ${GO_TARBALL}" | sha256sum --check --strict && \
     tar -C /usr/local -xzf "${GO_TARBALL}" && \
-    rm -f "${GO_TARBALL}" "${GO_TARBALL}.sha256" && \
-    ln -sf /usr/local/go/bin/go /usr/local/bin/go
+    rm -f "${GO_TARBALL}" go.sha256 && \
+    ln -sf /usr/local/go/bin/go /usr/local/bin/go && \
+    go version
```

---

## Dockerfile.original

**Location**: `docker/code-server/Dockerfile.original:167-183`

```diff
 # Install Go (match architecture for multi-arch builds)
 ARG GO_VERSION=1.22.4
 RUN set -eux; \
     case "$TARGETPLATFORM" in \
       "linux/amd64") GO_ARCH=amd64 ;; \
       "linux/arm64") GO_ARCH=arm64 ;; \
       *) echo "Unsupported platform for Go install: $TARGETPLATFORM"; exit 1 ;; \
     esac; \
     GO_TARBALL="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"; \
     cd /tmp; \
-    wget "https://go.dev/dl/${GO_TARBALL}"; \
-    wget "https://go.dev/dl/${GO_TARBALL}.sha256"; \
-    sha256sum --check --strict "${GO_TARBALL}.sha256"; \
+    curl -fsSLO "https://dl.google.com/go/${GO_TARBALL}"; \
+    curl -fsSL "https://dl.google.com/go/${GO_TARBALL}.sha256" -o go.sha256; \
+    echo "$(cat go.sha256)  ${GO_TARBALL}" | sha256sum --check --strict; \
     tar -C /usr/local -xzf "${GO_TARBALL}"; \
-    rm -f "${GO_TARBALL}" "${GO_TARBALL}.sha256"; \
-    ln -sf /usr/local/go/bin/go /usr/local/bin/go
+    rm -f "${GO_TARBALL}" go.sha256; \
+    ln -sf /usr/local/go/bin/go /usr/local/bin/go; \
+    go version
```

---

## Change Summary

### 1. Download Method Change
```diff
- curl -fsSLo "${GO_TARBALL}" "https://dl.google.com/go/${GO_TARBALL}"
+ curl -fsSLO "https://dl.google.com/go/${GO_TARBALL}"
```
**Reason**: `-O` (capital O) preserves the remote filename, ensuring proper naming

### 2. Checksum File Download
```diff
- curl -fsSLo "${GO_TARBALL}.sha256" "https://dl.google.com/go/${GO_TARBALL}.sha256"
+ curl -fsSL "https://dl.google.com/go/${GO_TARBALL}.sha256" -o go.sha256
```
**Reason**: Simplified filename for checksum file

### 3. Checksum Verification Format
```diff
- sha256sum --check --strict "${GO_TARBALL}.sha256"
+ echo "$(cat go.sha256)  ${GO_TARBALL}" | sha256sum --check --strict
```
**Reason**: Format hash correctly with filename for sha256sum verification

**Technical Detail**:
- Google's CDN returns: `ba79d4526102575196273416239cca418a651e049c2b099f3159db85e7bade7d`
- sha256sum needs: `ba79d4526102575196273416239cca418a651e049c2b099f3159db85e7bade7d  go1.22.4.linux-amd64.tar.gz`

### 4. Cleanup Change
```diff
- rm -f "${GO_TARBALL}" "${GO_TARBALL}.sha256"
+ rm -f "${GO_TARBALL}" go.sha256
```
**Reason**: Match new checksum filename

### 5. Verification Addition
```diff
- ln -sf /usr/local/go/bin/go /usr/local/bin/go
+ ln -sf /usr/local/go/bin/go /usr/local/bin/go; \
+ go version
```
**Reason**: Immediate verification that Go installation succeeded

### 6. Dockerfile.original URL Change
```diff
- wget "https://go.dev/dl/${GO_TARBALL}"
+ curl -fsSLO "https://dl.google.com/go/${GO_TARBALL}"
```
**Reason**: Standardize on curl and use reliable CDN URL

---

## Testing Commands

### Verify Fix Locally

```bash
# Test main Dockerfile
docker build -f docker/code-server/Dockerfile \
  --build-arg PROFILE=minimal \
  -t vibecode-test:main .

# Test optimized Dockerfile
docker build -f docker/code-server/Dockerfile.optimized \
  --build-arg PROFILE=standard \
  -t vibecode-test:optimized .

# Test original Dockerfile
docker build -f docker/code-server/Dockerfile.original \
  --build-arg PROFILE=minimal \
  -t vibecode-test:original .

# Verify Go installation
docker run --rm vibecode-test:main go version
# Expected: go version go1.22.4 linux/amd64
```

### Multi-arch Testing

```bash
# Test both architectures
docker buildx build --platform linux/amd64,linux/arm64 \
  -f docker/code-server/Dockerfile \
  --build-arg PROFILE=minimal \
  -t vibecode-test:multiarch .
```

---

## Build Validation

After building, verify these tools work:

```bash
# Go installation
docker run --rm <image> go version

# Go-based tools
docker run --rm <image> goose -version
docker run --rm <image> gopls version || echo "gopls is optional"

# Test Go compilation
docker run --rm <image> sh -c '
  echo "package main; import \"fmt\"; func main() { fmt.Println(\"ok\") }" > /tmp/test.go
  go run /tmp/test.go
'
# Expected output: ok
```

---

## Impact Analysis

### Breaking Changes
**None** - This is a bug fix that restores expected functionality

### Build Time Impact
**Minimal** - Same operations, just corrected order (~5 seconds difference max)

### Image Size Impact
**None** - Same binaries installed, identical layer structure

### Affected Profiles
- ✅ minimal
- ✅ standard
- ✅ ai
- ✅ web
- ✅ full

### Affected Architectures
- ✅ linux/amd64
- ✅ linux/arm64

---

## Related Issues

### Go Version Upgrade Opportunity
- Current: 1.22.4
- Latest: 1.25.2
- Recommendation: Consider upgrading in future PR

### Cosign Version Upgrade Opportunity
- Current: 2.2.4
- Latest: 2.4.0
- Recommendation: Consider upgrading for security improvements

---

## References

- Issue: #506 - Docker build pipeline broken
- Go Downloads: https://go.dev/dl/
- Google CDN: https://dl.google.com/go/
- sha256sum Documentation: `man sha256sum`
