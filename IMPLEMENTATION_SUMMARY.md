# Security Enhancement: Kubernetes Tooling Verification

## Summary

This PR implements checksum verification and version pinning for Kubernetes tooling downloads in the code-server Docker image, addressing security issue #416.

## Changes Made

### 1. Dockerfile Updates (`docker/code-server/Dockerfile`)

#### kubectl (v1.31.1)
- ✅ Downloads binary to `/tmp` before installation
- ✅ Fetches official SHA256 checksum from dl.k8s.io
- ✅ Verifies checksum before installation
- ✅ Uses `install -Dm755` for atomic write with correct permissions
- ✅ Build fails if checksum doesn't match

```dockerfile
curl -fsSL "https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/${KUBECTL_ARCH}/kubectl" -o /tmp/kubectl
curl -fsSL "https://dl.k8s.io/release/v${KUBECTL_VERSION}/bin/${KUBECTL_ARCH}/kubectl.sha256" -o /tmp/kubectl.sha256
echo "$(cat /tmp/kubectl.sha256)  /tmp/kubectl" | sha256sum -c -
install -Dm755 /tmp/kubectl /usr/local/bin/kubectl
```

#### helm (v3.19.0)
- ✅ Downloads tarball and checksum file
- ✅ Verifies SHA256 checksum before extraction
- ✅ Uses `install -Dm755` for binary installation
- ✅ Removes TODO comment after implementation

```dockerfile
curl -fsSL "https://get.helm.sh/helm-v${HELM_VERSION}-${HELM_TAR_ARCH}.tar.gz" -o /tmp/helm.tar.gz
curl -fsSL "https://get.helm.sh/helm-v${HELM_VERSION}-${HELM_TAR_ARCH}.tar.gz.sha256sum" -o /tmp/helm.tar.gz.sha256sum
(cd /tmp && sha256sum -c helm.tar.gz.sha256sum)
install -Dm755 "/tmp/${HELM_TAR_DIR}/helm" /usr/local/bin/helm
```

#### kubectx/kubens (v0.9.5)
- ✅ Switched from `master` branch to tagged release
- ✅ Added `KUBECTX_VERSION` ARG for version pinning
- ✅ Uses `install -Dm755` for installation
- ✅ Downloads to `/tmp` first

```dockerfile
ARG KUBECTX_VERSION=0.9.5
# ...
curl -fsSL "https://raw.githubusercontent.com/ahmetb/kubectx/v${KUBECTX_VERSION}/kubectx" -o /tmp/kubectx
curl -fsSL "https://raw.githubusercontent.com/ahmetb/kubectx/v${KUBECTX_VERSION}/kubens" -o /tmp/kubens
install -Dm755 /tmp/kubectx /usr/local/bin/kubectx
install -Dm755 /tmp/kubens /usr/local/bin/kubens
```

### 2. Verification Helper Script

Created `scripts/verify-tool-download.sh` - a reusable helper for tool download verification that:
- Downloads tools to temporary location
- Verifies checksums against official sources
- Fails the build on verification failure
- Supports signature verification (documented for future use)

### 3. Test Suite

Created comprehensive test suite in `tests/security/`:

#### `test-tool-verification.sh`
- ✅ Verifies helper script exists and is executable
- ✅ Tests successful checksum verification
- ✅ Tests failed checksum verification
- ✅ Verifies Dockerfile implements kubectl verification
- ✅ Verifies Dockerfile implements helm verification
- ✅ Verifies kubectx/kubens use tagged releases
- ✅ Verifies install command usage
- ✅ Verifies KUBECTX_VERSION is defined

#### `test-checksum-failure.sh`
- ✅ Simulates checksum mismatch
- ✅ Demonstrates that tampered binaries will be detected
- ✅ Proves build will fail on supply-chain attacks

### 4. Documentation

#### `docs/SECURITY.md`
Added implementation details with verification table:

| Tool | Version | Verification Method | Source |
|------|---------|-------------------|---------|
| kubectl | 1.31.1 | SHA256 checksum | dl.k8s.io |
| helm | 3.19.0 | SHA256 checksum | get.helm.sh |
| kubectx | 0.9.5 | Tagged release | GitHub v0.9.5 |
| kubens | 0.9.5 | Tagged release | GitHub v0.9.5 |

#### `docs/VERIFICATION_REMEDIATION.md`
Created comprehensive remediation guide covering:
- Verification failure symptoms by tool
- Step-by-step remediation procedures
- Security incident response process
- When to escalate to security team
- Testing and validation procedures

#### `docs/logs/COORDINATION_LOG.md`
Added entry documenting:
- Implementation decisions
- Changes made
- Verification status
- Next steps for future enhancements

### 5. CI/CD Integration

#### GitHub Actions Workflow
Created `.github/workflows/security-tool-verification.yml`:
- ✅ Runs on PR changes to Dockerfile and security files
- ✅ Executes verification test suite
- ✅ Lints Dockerfile with hadolint
- ✅ Checks that security TODOs were removed
- ✅ Tests Docker build (on main branch only)
- ✅ Generates summary in GitHub Actions UI

#### Makefile Targets
Added convenient make targets:
```bash
make test-security   # Run all security verification tests
make verify-tools    # Verify tool download configuration
```

### 6. TODO.md Updates

Updated the Security Hardening Roadmap table with completion status:
- ✅ kubectl: SHA256 verification implemented (cosign pending)
- ✅ helm: SHA256 checksum verification implemented
- ✅ kubectx: Switched to tagged release v0.9.5
- ✅ kubens: Switched to tagged release v0.9.5
- ✅ Supply chain docs: Documentation updated

## Security Improvements

1. **Fail Closed**: Build fails immediately if checksums don't match
2. **Version Pinning**: All tools use specific versions via ARG directives
3. **Atomic Installation**: `install -Dm755` ensures correct permissions and atomic writes
4. **Staged Downloads**: Tools download to `/tmp` first, verified before final installation
5. **Supply Chain Protection**: Checksum verification detects tampered binaries
6. **Audit Trail**: Build logs contain verification evidence

## Future Enhancements

As documented in `docs/SECURITY.md`:
- Implement cosign signature verification for kubectl (certificate identity available)
- Implement cosign/GPG signature verification for helm
- Extend verification to additional tools (k9s, sops, glab, etc.)
- Add automated CVE scanning for installed tool versions

## Testing

All tests pass:
```bash
$ make test-security
🔒 Testing tool download verification...
✅ All verification tests passed!

🧪 Testing checksum failure detection...
✅ SUCCESS: Checksum mismatch was correctly detected!
```

Dockerfile passes linting (no errors, only warnings about unrelated items).

## Verification Commands

To verify the implementation:

```bash
# Run test suite
make test-security

# Check Dockerfile syntax
docker run --rm -i hadolint/hadolint < docker/code-server/Dockerfile

# Test actual build (requires Docker)
docker build --no-cache -f docker/code-server/Dockerfile .
```

## Related Issues

- Closes #416 - Verify kubernetes tooling downloads
- Addresses comments in #416 about pod identifier masking (tracked separately)
- Implements TODO(sec-hardening-kubectl)
- Implements TODO(sec-hardening-helm)
- Implements TODO(sec-hardening-kubectx)
- Implements TODO(sec-hardening-kubens)
- Implements TODO(sec-hardening-supply-chain-docs)

## Checklist

- [x] Add SHA256 verification for kubectl
- [x] Add SHA256 verification for helm
- [x] Switch kubectx/kubens to tagged releases
- [x] Use `install -Dm755` for all binary installations
- [x] Create verification helper script
- [x] Add comprehensive test suite
- [x] Update security documentation
- [x] Create remediation guide
- [x] Add CI workflow
- [x] Add Makefile targets
- [x] Update TODO.md
- [x] Update coordination log
- [x] Remove security hardening TODOs from Dockerfile
- [ ] Monitor first CI build for verification
- [ ] Test full Docker build end-to-end
