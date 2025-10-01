# Tool Download Verification Remediation Guide

## Overview
This guide documents the remediation process for checksum/signature verification failures during the Docker image build process.

## Quick Reference

### If a Build Fails During Tool Verification

1. **Check the build logs** for the specific tool that failed verification
2. **Verify the expected checksum** from the official source
3. **Re-run the build** to rule out transient network issues
4. **Report to security team** if verification continues to fail

## Verification Failures by Tool

### kubectl Verification Failure

**Symptoms:**
```
sha256sum: WARNING: 1 computed checksum did NOT match
```

**Remediation Steps:**

1. **Verify the official checksum:**
   ```bash
   # Check the official Kubernetes release checksums
   curl -fsSL https://dl.k8s.io/release/v1.31.1/bin/linux/amd64/kubectl.sha256
   ```

2. **Compare with what was downloaded:**
   ```bash
   # If you have the downloaded binary
   sha256sum kubectl
   ```

3. **Possible causes:**
   - Network interception or man-in-the-middle attack
   - CDN corruption or cache poisoning
   - Version mismatch (check KUBECTL_VERSION in Dockerfile)
   - Kubernetes release infrastructure compromise (rare but serious)

4. **Resolution:**
   - If checksums match official source, rebuild with `--no-cache`
   - If checksums don't match, **DO NOT PROCEED** - report to security team
   - Check [Kubernetes Security Announcements](https://kubernetes.io/docs/reference/issues-security/security/)

### helm Verification Failure

**Symptoms:**
```
helm.tar.gz.sha256sum: FAILED
```

**Remediation Steps:**

1. **Verify the official checksum:**
   ```bash
   curl -fsSL https://get.helm.sh/helm-v3.19.0-linux-amd64.tar.gz.sha256sum
   ```

2. **Possible causes:**
   - CDN corruption at get.helm.sh
   - Network interception
   - Version mismatch (check HELM_VERSION in Dockerfile)

3. **Resolution:**
   - Rebuild with `--no-cache` to fetch fresh files
   - Check [Helm Security Policy](https://github.com/helm/helm/security/policy)
   - Report to security if persistent

### kubectx/kubens Verification Failure

**Symptoms:**
```
Failed to download kubectx from https://raw.githubusercontent.com/ahmetb/kubectx/v0.9.5/kubectx
```

**Remediation Steps:**

1. **Verify the release exists:**
   ```bash
   # Check GitHub releases
   curl -fsSL https://api.github.com/repos/ahmetb/kubectx/releases/tags/v0.9.5
   ```

2. **Possible causes:**
   - Release tag doesn't exist or was moved
   - GitHub raw content CDN issues
   - Version mismatch (check KUBECTX_VERSION in Dockerfile)

3. **Resolution:**
   - Check if release tag exists: https://github.com/ahmetb/kubectx/releases
   - Update KUBECTX_VERSION in Dockerfile if needed
   - Rebuild with `--no-cache`

## Security Incident Response

### When to Escalate

Escalate to the security team immediately if:

1. ✅ **Checksum verification fails multiple times** with the same tool
2. ✅ **Official checksums differ** from what's documented in our Dockerfile
3. ✅ **Multiple tools fail verification** simultaneously
4. ✅ **Network traffic analysis** shows suspicious activity

### Incident Response Steps

1. **Stop the build pipeline** - Don't deploy potentially compromised images
2. **Document the failure:**
   - Tool name and version
   - Expected vs actual checksum
   - Build timestamp and environment
   - Network path (on-prem, cloud, CI/CD runner)

3. **Verify from multiple sources:**
   - Download the tool from a different network
   - Check official security announcements
   - Compare checksums from multiple geographic locations

4. **Report findings:**
   - Create incident ticket with all documentation
   - Notify security team via secure channel
   - Tag @security in GitHub issue #416

## Testing Verification

### Test Successful Verification

```bash
# Run verification tests
./tests/security/test-tool-verification.sh
```

### Test Checksum Failure Detection

```bash
# Simulate a checksum mismatch to ensure builds fail
./tests/security/test-checksum-failure.sh
```

### Test Full Docker Build

```bash
# Build the image to test actual downloads and verification
docker build --no-cache -f docker/code-server/Dockerfile .
```

## Updating Tool Versions

When updating tool versions:

1. **Update the ARG** in Dockerfile (e.g., `ARG KUBECTL_VERSION=1.32.0`)
2. **Verify checksums manually** before committing:
   ```bash
   # Example for kubectl
   curl -fsSL https://dl.k8s.io/release/v1.32.0/bin/linux/amd64/kubectl.sha256
   ```
3. **Update documentation** if checksum URLs change
4. **Test the build** locally before pushing
5. **Update security docs** with new version details

## Continuous Monitoring

### Build Pipeline Integration

The following CI checks should be in place:

- [ ] Docker build runs on every PR
- [ ] Verification test suite runs on every PR
- [ ] Build logs are archived for audit trail
- [ ] Failed builds trigger security team notifications

### Scheduled Audits

- **Weekly:** Review build logs for verification warnings
- **Monthly:** Compare installed versions against CVE databases
- **Quarterly:** Re-validate all checksum URLs and sources

## References

- [Kubernetes Release Process](https://github.com/kubernetes/sig-release)
- [Helm Security](https://helm.sh/docs/topics/security/)
- [Supply Chain Levels for Software Artifacts (SLSA)](https://slsa.dev/)
- [CNCF Security TAG](https://github.com/cncf/tag-security)

## Contact

For questions or to report verification failures:
- GitHub Issue: [#416](https://github.com/ryanmaclean/vibecode-webgui/issues/416)
- Security Team: @security
- Emergency: Create incident ticket with "SECURITY" prefix
