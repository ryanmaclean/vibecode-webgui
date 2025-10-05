# Code-Server Dockerfile Security Audit

**Date**: 2025-10-01  
**Issue**: #416  
**Status**: In Progress

## 🔴 Critical Security Issues Found

### 1. Unverified curl|bash Pattern (Line 118)
**Location**: Node.js installation
```dockerfile
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
```

**Risk**: High - Executes remote script without verification  
**Fix Required**: 
- Add GPG key verification
- Use official Node.js Docker image as base, or
- Download script, verify checksum, then execute

**Recommendation**:
```dockerfile
# Option 1: Verify before execution
RUN curl -fsSL https://deb.nodesource.com/setup_18.x -o /tmp/setup_node.sh && \
    echo "EXPECTED_CHECKSUM /tmp/setup_node.sh" | sha256sum -c - && \
    bash /tmp/setup_node.sh && \
    rm /tmp/setup_node.sh

# Option 2: Use GPG verification
RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource.gpg.key | gpg --dearmor -o /usr/share/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/nodesource.gpg] https://deb.nodesource.com/node_18.x $(lsb_release -cs) main" > /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && apt-get install -y nodejs
```

### 2. Unverified wget Download (Line 140)
**Location**: Go installation
```dockerfile
wget "https://go.dev/dl/${GO_TARBALL}";
```

**Risk**: Medium - No checksum verification  
**Fix Required**: Add SHA256 checksum verification

**Recommendation**:
```dockerfile
wget "https://go.dev/dl/${GO_TARBALL}"; \
wget "https://go.dev/dl/${GO_TARBALL}.sha256"; \
echo "$(cat ${GO_TARBALL}.sha256) ${GO_TARBALL}" | sha256sum -c - && \
tar -C /usr/local -xzf "${GO_TARBALL}"; \
rm "${GO_TARBALL}" "${GO_TARBALL}.sha256"
```

### 3. Unverified curl|bash Pattern (Line 218)
**Location**: Eppo agent installation
```dockerfile
(curl -sL https://packagecloud.io/install/repositories/eppo/eppo-server/script.deb.sh | bash && apt-get install -y eppo-agent)
```

**Risk**: High - Executes remote script without verification  
**Fix Required**: 
- Add GPG key verification
- Download and verify script before execution
- Consider if Eppo is actually needed

**Recommendation**:
```dockerfile
# Verify GPG key first
curl -sL https://packagecloud.io/eppo/eppo-server/gpgkey | gpg --dearmor -o /usr/share/keyrings/eppo.gpg && \
curl -sL https://packagecloud.io/install/repositories/eppo/eppo-server/script.deb.sh -o /tmp/eppo.sh && \
bash /tmp/eppo.sh && \
apt-get install -y eppo-agent && \
rm /tmp/eppo.sh
```

## ⚠️ Medium Priority Issues

### 4. CLI Tool Downloads Without Verification

All CLI tools are downloaded from GitHub releases without checksum verification:
- aider
- goose  
- kubectl
- helm
- k9s
- stern
- helmfile
- sops
- glab

**Current Pattern**:
```dockerfile
curl -fsSL "https://github.com/org/tool/releases/download/..." -o /usr/local/bin/tool
```

**Fix Required**: Add checksum or cosign verification for each tool

**Recommendation**:
```dockerfile
# For tools with checksums
curl -fsSL "URL" -o /tmp/tool && \
curl -fsSL "URL.sha256" -o /tmp/tool.sha256 && \
echo "$(cat /tmp/tool.sha256) /tmp/tool" | sha256sum -c - && \
mv /tmp/tool /usr/local/bin/tool && \
chmod 755 /usr/local/bin/tool

# For tools with cosign signatures
curl -fsSL "URL" -o /tmp/tool && \
curl -fsSL "URL.sig" -o /tmp/tool.sig && \
cosign verify-blob --signature /tmp/tool.sig /tmp/tool && \
mv /tmp/tool /usr/local/bin/tool && \
chmod 755 /usr/local/bin/tool
```

## 📋 Action Plan

### Phase 1: Critical Fixes (Due: 2025-10-05)
- [ ] Fix Node.js installation (curl|bash)
- [ ] Add Go tarball checksum verification
- [ ] Fix or remove Eppo agent installation
- [ ] Create docs/SECURITY.md checklist

### Phase 2: CLI Tool Verification (Due: 2025-10-08 to 2025-10-11)
- [ ] kubectl: Add cosign verification (Due: 2025-10-08)
- [ ] helm: Add cosign verification (Due: 2025-10-10)
- [ ] kubectx/kubens: Add verification (Due: 2025-10-11)
- [ ] k9s: Add checksum verification
- [ ] stern: Add checksum verification
- [ ] helmfile: Add checksum verification
- [ ] sops: Add checksum verification
- [ ] glab: Add checksum verification
- [ ] aider: Add checksum verification
- [ ] goose: Add checksum verification

### Phase 3: Documentation
- [ ] Document all verification methods
- [ ] Create supply chain security policy
- [ ] Add SBOM generation to CI
- [ ] Document tool version update process

## 🔧 Implementation Notes

### Cosign Installation
```dockerfile
# Install cosign for signature verification
RUN COSIGN_VERSION="2.2.0" && \
    curl -fsSL "https://github.com/sigstore/cosign/releases/download/v${COSIGN_VERSION}/cosign-linux-${TARGETARCH}" -o /usr/local/bin/cosign && \
    chmod 755 /usr/local/bin/cosign
```

### Verification Helper Function
```bash
# Helper function for verified downloads
verify_and_install() {
  local url=$1
  local checksum_url=$2
  local target=$3
  
  curl -fsSL "$url" -o /tmp/download
  curl -fsSL "$checksum_url" -o /tmp/download.sha256
  echo "$(cat /tmp/download.sha256) /tmp/download" | sha256sum -c -
  mv /tmp/download "$target"
  chmod 755 "$target"
  rm /tmp/download.sha256
}
```

## 📊 Risk Assessment

| Issue | Risk Level | Impact | Likelihood | Priority |
|-------|-----------|--------|------------|----------|
| Node.js curl\|bash | High | High | Medium | P0 |
| Go wget no verify | Medium | Medium | Low | P1 |
| Eppo curl\|bash | High | Medium | Low | P0 |
| CLI tools no verify | Medium | Medium | Medium | P1 |

## 🎯 Success Criteria

- [ ] No curl\|bash or wget\|bash patterns
- [ ] All downloads have checksum or signature verification
- [ ] docs/SECURITY.md published
- [ ] All cosign milestones met
- [ ] CI includes SBOM generation
- [ ] Security policy documented

## 📚 References

- [Sigstore Cosign](https://github.com/sigstore/cosign)
- [SLSA Framework](https://slsa.dev/)
- [Supply Chain Security Best Practices](https://github.com/ossf/wg-best-practices-os-developers)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
