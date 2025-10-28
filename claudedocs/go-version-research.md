# Go Version Research

## Executive Summary

**Problem**: Go 1.22.4 checksum download failing - URL returns HTML redirect instead of plain checksum text.

**Root Cause**: Go changed their checksum distribution method. The old `.sha256` file endpoint now returns HTML redirects, not raw checksums.

**Solution**: Use Go's JSON API (`https://go.dev/dl/?mode=json`) to retrieve checksums programmatically.

---

## Current Status

### Go 1.22.4 (Target Version)
- **Status**: EXISTS but checksum endpoint BROKEN
- **Download URL**: `https://go.dev/dl/go1.22.4.linux-amd64.tar.gz` (works - redirects to dl.google.com)
- **Old Checksum URL**: `https://go.dev/dl/go1.22.4.linux-amd64.tar.gz.sha256` (BROKEN - returns HTML)
- **Actual SHA256**: `ba79d4526102575196273416239cca418a651e049c2b099f3159db85e7bade7d`
- **File Size**: 66MB

### Latest Stable Go Versions
1. **Go 1.25.1** (Latest Overall - August 2025)
   - SHA256: `7716a0d940a0f6ae8e1f3b3f4f36299dc53e31b16840dbd171254312c41ca12e`
   - Size: 59.7MB
   - Status: Stable, recommended

2. **Go 1.24.7** (Previous Stable)
   - SHA256: `da18191ddb7db8a9339816f3e2b54bdded8047cdc2a5d67059478f8d1595c43f`
   - Size: 78.6MB
   - Status: Stable

3. **Go 1.22.x Series** (Available up to 1.22.9)
   - Go 1.22.4: Target version (checksum endpoint broken)
   - Go 1.22.9: Latest in 1.22 series
   - Status: Older stable branch, still available

---

## Problem Analysis

### What Changed

**Old Method (BROKEN)**:
```bash
curl -fsSL https://go.dev/dl/go1.22.4.linux-amd64.tar.gz.sha256
# Returns: HTML redirect page, not checksum
```

**Response**:
```html
<!DOCTYPE html>
<html>
<head>
<meta http-equiv="refresh" content="0; url=/dl/#go1.22.4.linux-amd64.tar.gz.sha256">
</head>
<body>
<a href="/dl/#go1.22.4.linux-amd64.tar.gz.sha256">Redirecting to documentation...</a>
</body>
</html>
```

**Why It Fails**:
- Go.dev changed their static file serving
- `.sha256` files now redirect to HTML pages with anchor tags
- The checksum is embedded in the HTML table, not served as plain text
- This breaks any script expecting raw checksum output

---

## Correct URLs & Methods

### Method 1: JSON API (RECOMMENDED)

**Endpoint**: `https://go.dev/dl/?mode=json`

**Response Structure**:
```json
[
  {
    "version": "go1.25.1",
    "stable": true,
    "files": [
      {
        "filename": "go1.25.1.linux-amd64.tar.gz",
        "os": "linux",
        "arch": "amd64",
        "version": "go1.25.1",
        "sha256": "7716a0d940a0f6ae8e1f3b3f4f36299dc53e31b16840dbd171254312c41ca12e",
        "size": 59660846,
        "kind": "archive"
      }
    ]
  }
]
```

**Usage Example**:
```bash
# Get checksum for specific version
GO_VERSION="1.25.1"
GO_SHA256=$(curl -fsSL "https://go.dev/dl/?mode=json" | \
  jq -r ".[] | select(.version == \"go${GO_VERSION}\") | \
  .files[] | select(.os == \"linux\" and .arch == \"amd64\" and .kind == \"archive\") | \
  .sha256")

echo "Go ${GO_VERSION} SHA256: ${GO_SHA256}"
```

### Method 2: HTML Scraping (FALLBACK)

**Endpoint**: `https://go.dev/dl/`

**Usage**:
```bash
# Extract from HTML table
curl -fsSL https://go.dev/dl/ | \
  grep -A 5 "go1.22.4.linux-amd64" | \
  grep -o "[a-f0-9]\{64\}"
```

**Checksum Location**: Embedded in HTML `<tt>` tags within download table

### Method 3: Download & Verify (RELIABLE)

**Process**:
```bash
# Download tarball
wget https://go.dev/dl/go1.25.1.linux-amd64.tar.gz

# Compute checksum
COMPUTED_SHA=$(sha256sum go1.25.1.linux-amd64.tar.gz | awk '{print $1}')

# Compare with known good checksum (from JSON API or docs)
EXPECTED_SHA="7716a0d940a0f6ae8e1f3b3f4f36299dc53e31b16840dbd171254312c41ca12e"

if [ "$COMPUTED_SHA" == "$EXPECTED_SHA" ]; then
  echo "Checksum verified!"
else
  echo "Checksum mismatch!"
  exit 1
fi
```

---

## Checksum Method Comparison

| Method | Reliability | Performance | Dependencies | Recommendation |
|--------|-------------|-------------|--------------|----------------|
| JSON API | HIGH | Fast | jq | **PRIMARY** |
| HTML Scraping | MEDIUM | Medium | grep/sed | **FALLBACK** |
| Download & Verify | HIGHEST | Slow | None | **VALIDATION** |
| Old .sha256 URL | BROKEN | N/A | N/A | **DO NOT USE** |

---

## Recommendation

### For Docker/CI Builds

**Option A: Upgrade to Go 1.25.1** (RECOMMENDED)
```dockerfile
ENV GO_VERSION=1.25.1
ENV GO_SHA256=7716a0d940a0f6ae8e1f3b3f4f36299dc53e31b16840dbd171254312c41ca12e
ENV GO_TARBALL=go${GO_VERSION}.linux-amd64.tar.gz

# Download and verify
RUN set -eux && \
    curl -fsSL "https://go.dev/dl/${GO_TARBALL}" -o go.tar.gz && \
    echo "${GO_SHA256} go.tar.gz" | sha256sum -c - && \
    tar -C /usr/local -xzf go.tar.gz && \
    rm go.tar.gz
```

**Benefits**:
- Latest stable version with security fixes
- Smaller download size (59.7MB vs 66MB)
- Modern Go features and performance improvements
- No JSON API dependency (hardcoded checksum)

**Option B: Keep Go 1.22.4 with JSON API**
```dockerfile
ENV GO_VERSION=1.22.4
ENV GO_TARBALL=go${GO_VERSION}.linux-amd64.tar.gz

# Retrieve checksum dynamically
RUN set -eux && \
    apk add --no-cache jq && \
    GO_SHA256=$(curl -fsSL "https://go.dev/dl/?mode=json" | \
      jq -r ".[] | select(.version == \"go${GO_VERSION}\") | \
      .files[] | select(.os == \"linux\" and .arch == \"amd64\" and .kind == \"archive\") | \
      .sha256") && \
    curl -fsSL "https://go.dev/dl/${GO_TARBALL}" -o go.tar.gz && \
    echo "${GO_SHA256} go.tar.gz" | sha256sum -c - && \
    tar -C /usr/local -xzf go.tar.gz && \
    rm go.tar.gz && \
    apk del jq
```

**Benefits**:
- Maintains Go 1.22.4 version requirement
- Dynamic checksum retrieval
- Automated version management

**Drawbacks**:
- Requires `jq` installation
- Additional API call during build
- Slightly more complex

### For Manual Installation

**Process**:
1. Visit `https://go.dev/dl/`
2. Locate desired version in download table
3. Copy checksum from table (embedded in `<tt>` tags)
4. Download tarball: `wget https://go.dev/dl/go1.25.1.linux-amd64.tar.gz`
5. Verify: `echo "7716a0d940a0f6ae8e1f3b3f4f36299dc53e31b16840dbd171254312c41ca12e go1.25.1.linux-amd64.tar.gz" | sha256sum -c -`
6. Extract: `sudo tar -C /usr/local -xzf go1.25.1.linux-amd64.tar.gz`

---

## Version Selection Matrix

| Scenario | Recommended Version | Reason |
|----------|---------------------|--------|
| New projects | **Go 1.25.1** | Latest features, security patches |
| Production apps | **Go 1.24.7** or **1.25.1** | Stable with long-term support |
| Legacy compatibility | **Go 1.22.9** | Latest in 1.22 series |
| Strict version requirement | **Go 1.22.4** (with JSON API) | Specific dependency needs |

---

## Implementation Changes Required

### Current Code (BROKEN)
```dockerfile
# FROM: docker/code-server/Dockerfile.optimized
RUN set -eux && \
    GO_TARBALL="go${GO_VERSION}.linux-amd64.tar.gz" && \
    curl -fsSL "https://go.dev/dl/${GO_TARBALL}" -o go.tar.gz && \
    curl -fsSL "https://go.dev/dl/${GO_TARBALL}.sha256" -o go.tar.gz.sha256 && \  # FAILS HERE
    cat go.tar.gz.sha256 && \
    sha256sum -c go.tar.gz.sha256 && \
    tar -C /usr/local -xzf go.tar.gz && \
    rm go.tar.gz go.tar.gz.sha256
```

### Fixed Code (Option A - Upgrade)
```dockerfile
ENV GO_VERSION=1.25.1
ENV GO_SHA256=7716a0d940a0f6ae8e1f3b3f4f36299dc53e31b16840dbd171254312c41ca12e

RUN set -eux && \
    GO_TARBALL="go${GO_VERSION}.linux-amd64.tar.gz" && \
    curl -fsSL "https://go.dev/dl/${GO_TARBALL}" -o go.tar.gz && \
    echo "${GO_SHA256} go.tar.gz" | sha256sum -c - && \
    tar -C /usr/local -xzf go.tar.gz && \
    rm go.tar.gz
```

### Fixed Code (Option B - Keep 1.22.4)
```dockerfile
ENV GO_VERSION=1.22.4

RUN set -eux && \
    apk add --no-cache jq && \
    GO_TARBALL="go${GO_VERSION}.linux-amd64.tar.gz" && \
    GO_SHA256=$(curl -fsSL "https://go.dev/dl/?mode=json" | \
      jq -r ".[] | select(.version == \"go${GO_VERSION}\") | \
      .files[] | select(.os == \"linux\" and .arch == \"amd64\" and .kind == \"archive\") | \
      .sha256") && \
    echo "Go ${GO_VERSION} SHA256: ${GO_SHA256}" && \
    curl -fsSL "https://go.dev/dl/${GO_TARBALL}" -o go.tar.gz && \
    echo "${GO_SHA256} go.tar.gz" | sha256sum -c - && \
    tar -C /usr/local -xzf go.tar.gz && \
    rm go.tar.gz && \
    apk del jq
```

---

## Testing Verification

### Test 1: JSON API Access
```bash
# Verify JSON API is accessible
curl -fsSL "https://go.dev/dl/?mode=json" | jq '.[0].version'
# Expected: "go1.25.1"
```

### Test 2: Checksum Retrieval
```bash
# Retrieve Go 1.25.1 checksum
curl -fsSL "https://go.dev/dl/?mode=json" | \
  jq -r '.[] | select(.version == "go1.25.1") | .files[] | select(.os == "linux" and .arch == "amd64" and .kind == "archive") | .sha256'
# Expected: 7716a0d940a0f6ae8e1f3b3f4f36299dc53e31b16840dbd171254312c41ca12e
```

### Test 3: Download Verification
```bash
# Download and verify Go 1.25.1
wget https://go.dev/dl/go1.25.1.linux-amd64.tar.gz
echo "7716a0d940a0f6ae8e1f3b3f4f36299dc53e31b16840dbd171254312c41ca12e go1.25.1.linux-amd64.tar.gz" | sha256sum -c -
# Expected: go1.25.1.linux-amd64.tar.gz: OK
```

---

## Final Recommendation

**PRIMARY RECOMMENDATION**: Upgrade to Go 1.25.1 with hardcoded checksum

**Justification**:
1. **Simplest Fix**: No JSON API or jq dependency
2. **Most Secure**: Latest security patches and bug fixes
3. **Best Performance**: Smaller binary size, improved runtime
4. **Future-Proof**: Supported version with active maintenance
5. **Build Speed**: No additional API calls during build

**Implementation**: Use Option A fixed code above

**Rollback Plan**: If Go 1.25.1 introduces incompatibilities, use Option B to maintain Go 1.22.4 with JSON API verification

---

## Additional Resources

- Go Downloads: https://go.dev/dl/
- Go JSON API: https://go.dev/dl/?mode=json
- Go Release History: https://go.dev/doc/devel/release
- Go Version Policy: https://go.dev/doc/devel/release#policy

---

**Research Completed**: 2025-10-02
**Researcher**: Agent 3 (Go Version Researcher)
**Status**: Complete - Ready for implementation
