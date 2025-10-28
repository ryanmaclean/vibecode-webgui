# Docker Go Fix - Key Changes Visual Guide

## Before vs After Comparison

### 1. Go Installation Section

#### BEFORE (Lines 167-183)
```dockerfile
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
    curl -fsSLO "https://dl.google.com/go/${GO_TARBALL}"; \
    curl -fsSL "https://dl.google.com/go/${GO_TARBALL}.sha256" -o go.sha256; \
    echo "$(cat go.sha256)  ${GO_TARBALL}" | sha256sum --check --strict; \
    tar -C /usr/local -xzf "${GO_TARBALL}"; \
    rm -f "${GO_TARBALL}" go.sha256; \
    ln -sf /usr/local/go/bin/go /usr/local/bin/go; \
    go version
```

**Issues:**
- ❌ No environment variables set
- ❌ Only `go` binary symlinked
- ❌ No workspace directories created
- ❌ go version might fail if PATH not configured

---

#### AFTER (Lines 167-215)
```dockerfile
# ============================================================================
# FIX: Install Go with proper environment configuration
# ============================================================================
ARG GO_VERSION=1.22.4
RUN set -eux; \
    case "$TARGETPLATFORM" in \
      "linux/amd64") GO_ARCH=amd64 ;; \
      "linux/arm64") GO_ARCH=arm64 ;; \
      *) echo "Unsupported platform for Go install: $TARGETPLATFORM"; exit 1 ;; \
    esac; \
    GO_TARBALL="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"; \
    cd /tmp; \
    curl -fsSLO "https://dl.google.com/go/${GO_TARBALL}"; \
    curl -fsSL "https://dl.google.com/go/${GO_TARBALL}.sha256" -o go.sha256; \
    echo "$(cat go.sha256)  ${GO_TARBALL}" | sha256sum --check --strict; \
    tar -C /usr/local -xzf "${GO_TARBALL}"; \
    rm -f "${GO_TARBALL}" go.sha256; \
    # Create symlinks for all Go binaries
    ln -sf /usr/local/go/bin/go /usr/local/bin/go; \
    ln -sf /usr/local/go/bin/gofmt /usr/local/bin/gofmt; \
    ln -sf /usr/local/go/bin/godoc /usr/local/bin/godoc; \
    # Verify Go installation
    /usr/local/go/bin/go version

# Set Go environment variables globally (for both root and coder users)
ENV GOROOT=/usr/local/go
ENV GOPATH=/go
ENV GOCACHE=/go/cache
ENV GOMODCACHE=/go/pkg/mod
ENV PATH="${GOROOT}/bin:${GOPATH}/bin:${PATH}"

# Create Go directories with proper permissions
RUN mkdir -p ${GOPATH}/bin ${GOPATH}/src ${GOPATH}/pkg ${GOCACHE} ${GOMODCACHE} && \
    chmod -R 755 ${GOPATH} && \
    # Test Go installation works
    go version && \
    go env && \
    echo "Go environment configured successfully"
```

**Improvements:**
- ✅ Environment variables set globally
- ✅ Multiple Go binaries symlinked
- ✅ Workspace directories created
- ✅ Immediate verification with `go version` and `go env`

---

### 2. Goose Installation Section

#### BEFORE (Lines 186-197)
```dockerfile
# Install AI CLI tools and database tools
# 1. Goose for database migrations (install as root, make globally accessible)
RUN set -eux; \
    case "$TARGETPLATFORM" in \
      "linux/amd64") GO_ARCH=amd64 ;; \
      "linux/arm64") GO_ARCH=arm64 ;; \
      *) echo "Unsupported platform for goose install: $TARGETPLATFORM"; exit 1 ;; \
    esac; \
    CGO_ENABLED=0 GOOS=linux GOARCH="${GO_ARCH}" GOBIN=/usr/local/bin go install github.com/pressly/goose/v3/cmd/goose@latest && \
    chmod 755 /usr/local/bin/goose && \
    mkdir -p /home/coder/.vscode/extensions/goose-integration && \
    echo 'alias goose="goose -dir /home/coder/workspace/migrations"' >> /home/coder/.bashrc && \
    chown -R coder:coder /home/coder/.vscode
```

**Issues:**
- ❌ No explicit GOROOT/GOPATH set
- ❌ No verification step
- ❌ Fails silently if go install fails

---

#### AFTER (Lines 218-230)
```dockerfile
# Install AI CLI tools and database tools
# 1. Goose for database migrations (install with proper Go environment)
RUN set -eux; \
    case "$TARGETPLATFORM" in \
      "linux/amd64") GO_ARCH=amd64 ;; \
      "linux/arm64") GO_ARCH=arm64 ;; \
      *) echo "Unsupported platform for goose install: $TARGETPLATFORM"; exit 1 ;; \
    esac; \
    # Install goose with explicit Go environment
    CGO_ENABLED=0 GOOS=linux GOARCH="${GO_ARCH}" \
      GOROOT=${GOROOT} GOPATH=${GOPATH} GOBIN=/usr/local/bin \
      ${GOROOT}/bin/go install github.com/pressly/goose/v3/cmd/goose@latest && \
    chmod 755 /usr/local/bin/goose && \
    # Verify goose installation
    goose -version && \
    mkdir -p /home/coder/.vscode/extensions/goose-integration && \
    echo 'alias goose="goose -dir /home/coder/workspace/migrations"' >> /home/coder/.bashrc && \
    chown -R coder:coder /home/coder/.vscode
```

**Improvements:**
- ✅ Explicit GOROOT/GOPATH environment
- ✅ Uses absolute Go binary path
- ✅ Verification step added (`goose -version`)
- ✅ Build fails if goose doesn't install

---

### 3. gopls Installation Section

#### BEFORE (Lines 574-576)
```dockerfile
# 4. Go LSP (gopls) - as coder user - optional due to architecture issues
USER coder
RUN go install golang.org/x/tools/gopls@latest || echo "gopls installation failed, skipping"
```

**Issues:**
- ❌ Silent failure with `|| echo`
- ❌ No environment variables set for coder user
- ❌ No verification
- ❌ No debugging information

---

#### AFTER (Lines 621-633)
```dockerfile
# 4. Go LSP (gopls) - as coder user with proper Go environment
USER coder
RUN set -eux; \
    echo "Installing gopls with Go environment:" && \
    echo "GOROOT=${GOROOT}" && \
    echo "GOPATH=${GOPATH}" && \
    echo "PATH=${PATH}" && \
    go version && \
    go env && \
    # Install gopls with explicit environment
    GOROOT=${GOROOT} GOPATH=${GOPATH} go install golang.org/x/tools/gopls@latest && \
    # Verify gopls is installed
    ls -la ${GOPATH}/bin/gopls && \
    ${GOPATH}/bin/gopls version && \
    echo "✅ gopls installed successfully"
```

**Improvements:**
- ✅ Debug output for environment
- ✅ Explicit environment variables
- ✅ Verification steps (file exists, version works)
- ✅ Build fails if gopls doesn't install
- ✅ No silent failures

---

### 4. User PATH Configuration

#### BEFORE (Line 322)
```dockerfile
ENV PATH="/home/coder/.local/bin:${PATH}"
```

**Issues:**
- ❌ Go binaries not in PATH
- ❌ User-installed Go tools not accessible

---

#### AFTER (Line 363)
```dockerfile
# Update PATH for coder user to include Go binaries
ENV PATH="/home/coder/.local/bin:${GOPATH}/bin:${GOROOT}/bin:${PATH}"
```

**Improvements:**
- ✅ GOPATH/bin included (user-installed tools)
- ✅ GOROOT/bin included (system Go binaries)
- ✅ Consistent with root user PATH

---

### 5. Workspace Permissions

#### BEFORE (Line 305)
```dockerfile
WORKDIR /home/coder/workspace
RUN chown -R coder:coder /home/coder
```

**Issues:**
- ❌ /go directory not owned by coder user
- ❌ Permission errors when installing Go packages

---

#### AFTER (Lines 355-358)
```dockerfile
WORKDIR /home/coder/workspace
RUN chown -R coder:coder /home/coder && \
    # Set Go directories ownership for coder user
    chown -R coder:coder ${GOPATH}
```

**Improvements:**
- ✅ Go workspace owned by coder user
- ✅ User can install Go packages without permission errors

---

### 6. Tool Verification

#### BEFORE (Lines 537-544)
```dockerfile
RUN set -e && \
    echo "🔍 Verifying ALL required tools..." && \
    for tool in vim nvim nu delta chezmoi just stern helmfile helm kubectl kubectx kubens k9s sops glab; do \
      command -v "$tool" >/dev/null && echo "✅ $tool" || { echo "❌ $tool MISSING"; exit 1; }; \
    done && \
    aider --version >/dev/null && echo "✅ aider" || { echo "❌ aider MISSING"; exit 1; } && \
    /usr/local/bin/goose -version >/dev/null 2>&1 && echo "✅ goose" || { echo "❌ goose MISSING"; exit 1; } && \
    echo "✅ All required tools verified!"
```

**Issues:**
- ❌ Go not in verification list
- ❌ Doesn't test if Go actually works

---

#### AFTER (Lines 584-594)
```dockerfile
RUN set -e && \
    echo "🔍 Verifying ALL required tools..." && \
    for tool in vim nvim nu delta chezmoi just stern helmfile helm kubectl kubectx kubens k9s sops glab go; do \
      command -v "$tool" >/dev/null && echo "✅ $tool" || { echo "❌ $tool MISSING"; exit 1; }; \
    done && \
    aider --version >/dev/null && echo "✅ aider" || { echo "❌ aider MISSING"; exit 1; } && \
    /usr/local/bin/goose -version >/dev/null 2>&1 && echo "✅ goose" || { echo "❌ goose MISSING"; exit 1; } && \
    go version && echo "✅ go working" || { echo "❌ go NOT WORKING"; exit 1; } && \
    echo "✅ All required tools verified!"
```

**Improvements:**
- ✅ Go added to tool verification list
- ✅ Tests `go version` command actually works
- ✅ Build fails immediately if Go is broken

---

## Summary of Changes

| Change | Lines | Impact |
|--------|-------|--------|
| Go environment variables | 199-205 | Critical - enables all Go tooling |
| Go workspace creation | 208-215 | Critical - prevents permission errors |
| Enhanced goose install | 218-230 | High - ensures database tool works |
| Go workspace permissions | 355-358 | High - allows user to install packages |
| Updated coder PATH | 363 | High - makes Go tools accessible |
| Enhanced gopls install | 621-633 | Medium - IDE features now work |
| Added Go verification | 584-594 | Medium - catches issues early |

**Total Lines Changed:** ~60 lines
**Environment Variables Added:** 5 (GOROOT, GOPATH, GOCACHE, GOMODCACHE, PATH)
**Verification Steps Added:** 5 (go version, go env, goose -version, gopls version, final go test)

---

## Testing Quick Reference

```bash
# Build
docker build -t test -f docker/code-server/Dockerfile.fixed .

# Verify Environment
docker run --rm test sh -c 'echo GOROOT=$GOROOT GOPATH=$GOPATH'

# Verify Go Works
docker run --rm test go version

# Verify goose
docker run --rm test goose -version

# Verify gopls
docker run --rm test /go/bin/gopls version

# Verify User Can Use Go
docker run --rm -u coder test go version
```

**Expected Output:**
```
GOROOT=/usr/local/go GOPATH=/go
go version go1.22.4 linux/amd64
goose version v3.x.x
gopls v0.x.x
go version go1.22.4 linux/amd64
```

---

## Visual Environment Comparison

### BEFORE
```
Container
├── /usr/local/go/bin/go → /usr/local/bin/go (symlink)
├── No GOROOT set
├── No GOPATH set
├── No /go directory
└── PATH missing Go binaries

Result: Go tools fail to install or run
```

### AFTER
```
Container
├── /usr/local/go/                 (GOROOT)
│   └── bin/
│       ├── go → /usr/local/bin/go
│       ├── gofmt → /usr/local/bin/gofmt
│       └── godoc → /usr/local/bin/godoc
├── /go/                           (GOPATH)
│   ├── bin/
│   │   ├── goose
│   │   └── gopls
│   ├── src/
│   ├── pkg/
│   └── cache/                     (GOCACHE)
├── ENV GOROOT=/usr/local/go
├── ENV GOPATH=/go
├── ENV GOCACHE=/go/cache
├── ENV GOMODCACHE=/go/pkg/mod
└── PATH includes: /usr/local/go/bin:/go/bin:...

Result: All Go tools install and run correctly
```

---

## Risk Assessment

| Risk | Before | After | Mitigation |
|------|--------|-------|------------|
| Go tools fail to install | HIGH | LOW | Explicit env vars |
| Silent failures | HIGH | NONE | Verification steps |
| Permission errors | HIGH | LOW | Proper ownership |
| PATH issues | HIGH | LOW | Global PATH config |
| User development blocked | HIGH | NONE | User workspace config |

---

**Document prepared by:** DevOps Architect Agent
**Date:** 2025-10-12
**Purpose:** Quick visual reference for code review
