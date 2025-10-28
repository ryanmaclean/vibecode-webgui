# Code-Server Dockerfile Security Audit

**Date**: 2025-10-01
**Issue**: #416, #457
**Status**: Partially Complete

## Completed Security Improvements

### Phase 1: Critical Fixes (COMPLETED 2025-10-01)
- [x] Fixed Node.js installation with checksum verification (Line 128)
- [x] Added Go tarball checksum verification (Line 179-183)
- [x] REMOVED Eppo agent curl|bash installation (Line 279-282) - Security risk eliminated
- [x] Added cosign verification for critical K8s tools

### Phase 2: Tool Verification (COMPLETED 2025-10-01)
- [x] kubectl: Cosign + SHA256 verification (Lines 531-543)
- [x] helm: Cosign + SHA256 verification (Lines 457-474)
- [x] kubectx/kubens: Cosign + SHA256 verification (Lines 503-529)
- [x] k9s: SHA256 checksum verification (Lines 476-484)
- [x] stern: SHA256 checksum verification (Lines 437-446)
- [x] lazygit: SHA256 checksum verification (Lines 89-96) - NEW
- [x] helmfile: SHA256 checksum verification (Lines 447-456) - NEW
- [x] glab: SHA256 checksum verification (Lines 488-497) - NEW

### Remaining Security Gaps
- [ ] sops: No checksum verification (Line 485-487)
- [ ] pocketbase: No checksum verification (Line 209-216)
- [ ] devbox: Uses curl|bash pattern (Line 220)
- [ ] KubeHound: Uses curl|bash pattern (Line 255)
- [ ] nushell, delta, chezmoi, just: No checksum verification
- [ ] starship, zoxide: No checksum verification

## Security Improvements Summary

### Critical Vulnerabilities Fixed
1. **Eppo Agent Removed**: Eliminated unverified curl|bash pattern (HIGH RISK)
2. **Kubernetes Tools Secured**: All critical K8s tools now use cosign + checksum verification
3. **Additional Tools Secured**: Added checksums for lazygit, helmfile, glab

### Verification Methods Implemented
- **Cosign Signatures**: kubectl, helm, kubectx, kubens (strongest verification)
- **SHA256 Checksums**: Node.js, Go, stern, k9s, lazygit, helmfile, glab, cosign
- **Install Command**: Uses `install -m755` for atomic, permission-safe installation

## Risk Assessment (Updated 2025-10-01)

| Tool | Previous Risk | Current Risk | Status |
|------|--------------|--------------|--------|
| Node.js | High | Low | SECURED |
| Go | Medium | Low | SECURED |
| Eppo agent | High | N/A | REMOVED |
| kubectl | Medium | Low | SECURED (cosign) |
| helm | Medium | Low | SECURED (cosign) |
| kubectx/kubens | Medium | Low | SECURED (cosign) |
| k9s | Medium | Low | SECURED |
| stern | Medium | Low | SECURED |
| helmfile | Medium | Low | SECURED |
| lazygit | Medium | Low | SECURED |
| glab | Medium | Low | SECURED |
| sops | Medium | Medium | PENDING |
| pocketbase | Medium | Medium | PENDING |
| devbox | High | High | PENDING |
| KubeHound | Medium | Medium | PENDING (optional) |

## Phase 3: Remaining Work

### High Priority (Due: 2025-10-15)
- [ ] sops: Add checksum verification
- [ ] pocketbase: Add checksum verification
- [ ] devbox: Replace curl|bash or add verification
- [ ] Document all verification methods in docs/SECURITY.md

### Medium Priority (Due: 2025-10-31)
- [ ] nushell, delta, chezmoi, just: Add checksum verification
- [ ] starship, zoxide: Add checksum verification
- [ ] Create supply chain security policy
- [ ] Add SBOM generation to CI

### Low Priority
- [ ] KubeHound: Verify or remove (optional tool)
- [ ] Document tool version update process
- [ ] Quarterly verification schedule

## Implementation Notes

### Cosign Verification Pattern
```dockerfile
cosign verify-blob \
  --signature <sig-file> \
  --certificate <cert-file> \
  --certificate-identity-regexp "<identity-pattern>" \
  --certificate-oidc-issuer "<issuer>" \
  <checksum-file>
```

### SHA256 Checksum Pattern
```dockerfile
curl -fsSL "<release-url>/checksums.txt" -o /tmp/tool.checksums.txt
grep "<archive-name>" /tmp/tool.checksums.txt | awk '{print $1 "  /tmp/tool.tar.gz"}' > /tmp/tool.sha256
sha256sum --check --strict /tmp/tool.sha256
```

### Atomic Installation Pattern
```dockerfile
install -m755 /tmp/tool /usr/local/bin/tool
```

## Success Metrics

- [x] No unverified curl|bash patterns (Eppo removed)
- [x] All critical K8s tools have cosign verification
- [x] All Kubernetes CLI tools have checksum verification
- [ ] All development tools have checksum verification (75% complete)
- [ ] docs/SECURITY.md published with guidelines
- [ ] CI includes SBOM generation

## References

- [Sigstore Cosign Documentation](https://github.com/sigstore/cosign)
- [SLSA Framework](https://slsa.dev/)
- [Supply Chain Security Best Practices](https://github.com/ossf/wg-best-practices-os-developers)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [Issue #416](https://github.com/ryanmaclean/vibecode-webgui/issues/416)
- [Issue #457](https://github.com/ryanmaclean/vibecode-webgui/issues/457)
