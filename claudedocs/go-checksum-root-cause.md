# Go Checksum Root Cause Analysis

**Investigation Date:** 2025-10-02
**Investigator:** Agent 1 - Root Cause Analyst
**Build ID Analyzed:** 18185907076 (AMD64 minimal)

## Executive Summary

All AMD64 builds are failing due to Go checksum verification. The root cause is that go.dev no longer serves individual `.sha256` files for downloads. Instead, the URL returns a 316-byte HTML redirect page, which sha256sum cannot parse as a checksum file.

## Error Details

### Exact Error from Logs
```
#16 1.240 + sha256sum --check --strict go1.22.4.linux-amd64.tar.gz.sha256
#16 1.241 sha256sum: go1.22.4.linux-amd64.tar.gz.sha256: no properly formatted checksum lines found
```

### Download Attempt
```
#16 1.031 + wget https://go.dev/dl/go1.22.4.linux-amd64.tar.gz.sha256
#16 1.181 HTTP request sent, awaiting response... 200 OK
#16 1.239 Length: 316 [text/html]
```

**Critical Finding:** The response is `text/html` (316 bytes), not a checksum file.

## Evidence

### What Was Downloaded

**File:** `go1.22.4.linux-amd64.tar.gz.sha256`
**Size:** 316 bytes
**Content-Type:** `text/html; charset=utf-8`
**HTTP Status:** 200 OK (misleading - not actually the checksum)

**Actual Content:**
```html
<!DOCTYPE html>
<html>
<head>
<meta name="go-import" content="golang.org/dl git https://go.googlesource.com/dl">
<meta http-equiv="refresh" content="0; url=/dl/#go1.22.4.linux-amd64.tar.gz.sha256">
</head>
<body>
<a href="/dl/#go1.22.4.linux-amd64.tar.gz.sha256">Redirecting to documentation...</a>.
</body>
</html>
```

### What Was Expected

**Format:** Plain text file with checksum
**Expected Content Example:**
```
ba79d4526102575196273416239cca418a651e049c2b099f3159db85e7bade7d  go1.22.4.linux-amd64.tar.gz
```

**Actual Checksum (from go.dev/dl page):**
`ba79d4526102575196273416239cca418a651e049c2b099f3159db85e7bade7d`

## Root Cause

**Primary Issue:** Go.dev URL structure changed - individual `.sha256` files no longer exist as direct downloads.

**Behavior Change:**
- **Before:** `https://go.dev/dl/go{version}.{platform}.tar.gz.sha256` returned plain text checksum
- **Now:** Returns HTML redirect page (200 OK) that redirects to `#anchor` on main download page

**Why sha256sum Failed:**
- sha256sum expects format: `<hash>  <filename>`
- Received: HTML document starting with `<!DOCTYPE html>`
- Result: "no properly formatted checksum lines found"

## Impact Assessment

### Affected Builds
All AMD64 variants failing at identical point:
- 18185907076 - AMD64 minimal
- 18185949678 - AMD64 standard
- 18185952526 - AMD64 ai
- 18185956356 - AMD64 web
- 18185950368 - AMD64 full

### Why ARM64 Succeeded
ARM64 builds use different Dockerfile (`Dockerfile.optimized`) which likely:
1. Uses different checksum verification method
2. Downloads from different source
3. Has updated checksum handling

## Fix Strategy

### Recommended Approach

**Option 1: Hardcode Checksum (Immediate Fix)**
```dockerfile
RUN set -eux; \
    GO_TARBALL="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"; \
    cd /tmp; \
    wget "https://go.dev/dl/${GO_TARBALL}"; \
    echo "ba79d4526102575196273416239cca418a651e049c2b099f3159db85e7bade7d  ${GO_TARBALL}" > go.sha256; \
    sha256sum --check --strict go.sha256; \
    tar -C /usr/local -xzf "${GO_TARBALL}"; \
    rm -f "${GO_TARBALL}" go.sha256
```

**Option 2: Use SHASUMS256.txt (Robust Fix)**
```dockerfile
RUN set -eux; \
    GO_TARBALL="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"; \
    cd /tmp; \
    wget "https://go.dev/dl/${GO_TARBALL}"; \
    wget "https://go.dev/dl/go${GO_VERSION}.linux-${GO_ARCH}.tar.gz.sha256" -O go.sha256 || \
        (curl -fsSL "https://go.dev/dl/" | grep -oP "go${GO_VERSION}.linux-${GO_ARCH}.tar.gz.*?<tt>\K[a-f0-9]{64}" > go.sha256.txt && \
         echo "$(cat go.sha256.txt)  ${GO_TARBALL}" > go.sha256); \
    sha256sum --check --strict go.sha256; \
    tar -C /usr/local -xzf "${GO_TARBALL}"; \
    rm -f "${GO_TARBALL}" go.sha256 go.sha256.txt
```

**Option 3: Skip Checksum Verification (NOT RECOMMENDED)**
```dockerfile
RUN set -eux; \
    GO_TARBALL="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"; \
    cd /tmp; \
    wget "https://go.dev/dl/${GO_TARBALL}"; \
    # No verification - security risk
    tar -C /usr/local -xzf "${GO_TARBALL}"; \
    rm -f "${GO_TARBALL}"
```

### Implementation Priority

1. **Immediate Fix:** Option 1 (hardcode checksum for go1.22.4)
2. **Short-term:** Test and verify ARM64 approach works for AMD64
3. **Long-term:** Implement Option 2 for dynamic checksum retrieval

## Verification Steps

After implementing fix:
1. Test AMD64 minimal build: `docker build -f docker/code-server/Dockerfile --build-arg PROFILE=minimal --platform linux/amd64 .`
2. Verify checksum validation succeeds
3. Confirm Go installation: `docker run <image> go version`
4. Run full CI pipeline to verify all profiles

## Additional Findings

### Successful Pattern (from lazygit installation)
The Dockerfile already has working checksum verification for lazygit:
```dockerfile
curl -fsSL "https://github.com/jesseduffield/lazygit/releases/download/v0.55.1/checksums.txt" -o /tmp/lazygit.checksums.txt;
grep -i "${LAZYGIT_ARCHIVE}" /tmp/lazygit.checksums.txt | head -1 | awk '{print $1 "  /tmp/lazygit.tar.gz"}' > /tmp/lazygit.sha256;
sha256sum --check --strict /tmp/lazygit.sha256;
```

This pattern (checksums.txt file) should be adapted for Go if possible.

## Timeline of Events

- **2025-10-02 07:06:58:** Go tarball download succeeds (66MB downloaded)
- **2025-10-02 07:06:59:** Checksum file download returns 316 bytes HTML
- **2025-10-02 07:06:59:** sha256sum fails to parse HTML as checksum
- **2025-10-02 07:06:59:** Build terminates with exit code 1

## Conclusion

The failure is not due to:
- ❌ Network issues (downloads succeed)
- ❌ Go version availability (tarball exists)
- ❌ Corrupted downloads (file size matches)
- ❌ sha256sum utility failure (works for other tools)

The failure IS due to:
- ✅ Go.dev URL structure change
- ✅ HTML redirect page instead of plain text checksum
- ✅ Dockerfile using deprecated checksum download method

**Next Action Required:** Update Dockerfile to use hardcoded checksum or scrape from go.dev/dl page.
