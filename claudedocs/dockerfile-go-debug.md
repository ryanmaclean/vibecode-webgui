# Dockerfile Go Installation Debug

## Agent 2: Dockerfile Debugger Analysis
**Date**: 2025-10-02
**Scope**: Lines 177-190 of `docker/code-server/Dockerfile`

---

## Current Problematic Code (Lines 177-190)

```dockerfile
RUN set -eux; \
    case "$TARGETPLATFORM" in \
      "linux/amd64") GO_ARCH=amd64 ;; \
      "linux/arm64") GO_ARCH=arm64 ;; \
      *) echo "Unsupported platform for Go install: $TARGETPLATFORM"; exit 1 ;; \
    esac; \
    GO_TARBALL="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"; \
    cd /tmp; \
    wget "https://go.dev/dl/${GO_TARBALL}"; \
    wget "https://go.dev/dl/${GO_TARBALL}.sha256"; \
    sha256sum --check --strict "${GO_TARBALL}.sha256"; \
    tar -C /usr/local -xzf "${GO_TARBALL}"; \
    rm -f "${GO_TARBALL}" "${GO_TARBALL}.sha256"; \
    ln -sf /usr/local/go/bin/go /usr/local/bin/go
```

---

## Critical Issues Identified

### Issue 1: Invalid Checksum File Format
**Problem**: Line 187 attempts direct checksum verification
```dockerfile
sha256sum --check --strict "${GO_TARBALL}.sha256"
```

**Root Cause**: Go's checksum files contain **ONLY the hash**, not the filename.

**Example from go.dev**:
- File: `go1.22.4.linux-amd64.tar.gz.sha256`
- Content: `ba79d4526102575196273416239cca418a651e049c2b099f3159db85e7bade7d`
- Expected by sha256sum: `ba79d4526102575196273416239cca418a651e049c2b099f3159db85e7bade7d  go1.22.4.linux-amd64.tar.gz`

**Error Result**: `sha256sum` fails because it expects format `<hash>  <filename>`, but receives only `<hash>`.

### Issue 2: No Fallback or Validation
**Problem**: No validation that checksum file downloaded successfully or contains valid data.

**Missing Checks**:
- File size validation
- Content format validation
- Fallback mechanism if checksum unavailable

### Issue 3: No Error Context
**Problem**: When verification fails, error message doesn't indicate whether:
- Download failed
- Checksum file is malformed
- Hash mismatch occurred

---

## Comparison with Working Lazygit Fix (Lines 92-97)

### Lazygit Working Implementation
```dockerfile
curl -fsSL "https://github.com/jesseduffield/lazygit/releases/download/v${LAZYGIT_VERSION}/checksums.txt" -o /tmp/lazygit.checksums.txt; \
grep -i "${LAZYGIT_ARCHIVE}" /tmp/lazygit.checksums.txt | head -1 | awk '{print $1 "  /tmp/lazygit.tar.gz"}' > /tmp/lazygit.sha256; \
if [ ! -s /tmp/lazygit.sha256 ]; then \
  echo "WARNING: Checksum not found for ${LAZYGIT_ARCHIVE}, skipping verification"; \
else \
  sha256sum --check --strict /tmp/lazygit.sha256; \
fi;
```

### Key Success Factors

| Aspect | Lazygit (Working) | Go (Broken) |
|--------|-------------------|-------------|
| **Checksum Format** | Multi-line checksums.txt with filenames | Single hash in .sha256 file |
| **Parsing** | `grep + awk` extracts hash + filename | Direct use assumes correct format |
| **Validation** | `[ ! -s ]` checks file has content | No validation |
| **Fallback** | WARNING + skip verification | Hard fail, build stops |
| **Error Handling** | Graceful degradation | No error context |

### Why Lazygit Works
1. **Extracts checksum**: `grep` finds line matching archive name
2. **Formats correctly**: `awk '{print $1 "  /tmp/lazygit.tar.gz"}'` creates valid sha256sum format
3. **Validates extraction**: `[ ! -s ]` ensures output file has content
4. **Fails gracefully**: Continues with warning instead of breaking build

---

## Proposed Fix

### Option A: Match Lazygit Pattern (Recommended)

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
    wget "https://go.dev/dl/${GO_TARBALL}"; \
    wget "https://go.dev/dl/${GO_TARBALL}.sha256"; \
    # Format checksum file for sha256sum compatibility
    cat "${GO_TARBALL}.sha256" | awk -v tarball="${GO_TARBALL}" '{print $1 "  " tarball}' > go.checksum; \
    if [ ! -s go.checksum ]; then \
      echo "WARNING: Checksum formatting failed for ${GO_TARBALL}, skipping verification"; \
    else \
      sha256sum --check --strict go.checksum; \
    fi; \
    tar -C /usr/local -xzf "${GO_TARBALL}"; \
    rm -f "${GO_TARBALL}" "${GO_TARBALL}.sha256" go.checksum; \
    ln -sf /usr/local/go/bin/go /usr/local/bin/go
```

**Changes**:
1. Parse downloaded `.sha256` file to extract hash
2. Format as `<hash>  <filename>` for sha256sum
3. Validate formatted checksum file exists
4. Fallback with warning if formatting fails
5. Clean up checksum file after verification

### Option B: Alternative Verification Method

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
    wget "https://go.dev/dl/${GO_TARBALL}"; \
    wget "https://go.dev/dl/${GO_TARBALL}.sha256"; \
    # Extract expected hash and compare with computed hash
    EXPECTED_HASH=$(cat "${GO_TARBALL}.sha256" | tr -d '\n'); \
    COMPUTED_HASH=$(sha256sum "${GO_TARBALL}" | awk '{print $1}'); \
    if [ "${EXPECTED_HASH}" != "${COMPUTED_HASH}" ]; then \
      echo "ERROR: Checksum mismatch for ${GO_TARBALL}"; \
      echo "Expected: ${EXPECTED_HASH}"; \
      echo "Computed: ${COMPUTED_HASH}"; \
      exit 1; \
    fi; \
    tar -C /usr/local -xzf "${GO_TARBALL}"; \
    rm -f "${GO_TARBALL}" "${GO_TARBALL}.sha256"; \
    ln -sf /usr/local/go/bin/go /usr/local/bin/go
```

**Changes**:
1. Extract expected hash from `.sha256` file
2. Compute actual hash of downloaded tarball
3. Direct string comparison
4. Detailed error message showing both hashes
5. Exit if mismatch detected

---

## Recommendation

**Use Option A**: Matches proven Lazygit pattern, provides fallback mechanism, maintains consistency with existing working code.

**Rationale**:
- Consistency with existing Docker patterns
- Graceful degradation if checksum unavailable
- Clear error messaging
- Minimal code change
- Battle-tested approach

---

## Testing Strategy

1. **Test both architectures**:
   ```bash
   docker buildx build --platform linux/amd64 -f docker/code-server/Dockerfile .
   docker buildx build --platform linux/arm64 -f docker/code-server/Dockerfile .
   ```

2. **Verify Go installation**:
   ```bash
   docker run <image> go version
   # Expected: go version go1.22.4 linux/amd64
   ```

3. **Test checksum validation**:
   - Modify tarball after download (should fail)
   - Test with invalid checksum file (should warn and skip)

---

## Related Files

- Main Dockerfile: `/Users/ryan.maclean/vibecode-webgui/docker/code-server/Dockerfile`
- Working reference: Lines 92-97 (Lazygit installation)
- Problem location: Lines 177-190 (Go installation)

---

## Status

- **Analysis**: Complete
- **Root Cause**: Identified (invalid checksum format)
- **Fix Proposed**: Option A recommended
- **Testing**: Pending implementation
