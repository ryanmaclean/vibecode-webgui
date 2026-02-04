# Apple Container Runtime Integration Research

> Research document for GitHub Issue #1134

**Date:** February 2026
**Status:** Research Complete
**Current Version:** 0.9.0 (February 3, 2026)

---

## 1. Overview

### What apple/container Provides

[apple/container](https://github.com/apple/container) is Apple's official Swift-based CLI tool for running Linux containers as lightweight virtual machines on macOS. Released at WWDC 2025 and open-sourced under Apache 2.0 license, it represents Apple's first entry into the container ecosystem.

**Key Characteristics:**
- **Language:** Written in Swift, optimized for Apple Silicon
- **Architecture:** VM-per-container model (unlike Docker's shared VM approach)
- **Isolation:** Each container runs in its own lightweight VM via Virtualization.framework
- **Performance:** Sub-second container startup (~100ms)
- **Image Format:** Full OCI compatibility (works with Docker Hub, ghcr.io, any OCI registry)

### Relationship to Containerization Package

Apple provides two complementary repositories:

| Repository | Purpose | Usage |
|------------|---------|-------|
| [apple/container](https://github.com/apple/container) | CLI tool for end users | `container run`, `container build`, etc. |
| [apple/containerization](https://github.com/apple/containerization) | Swift framework/library | Programmatic container management |

The `containerization` Swift package provides:
- **ContainerizationOCI:** OCI image management and registry interaction
- **ContainerizationEXT4:** ext4 filesystem creation
- **ContainerizationNetlink:** Linux netlink socket interaction
- **vminitd:** Minimal init system with gRPC API over vsock

### OCI Compatibility

Apple Container has **full OCI compatibility**:

```bash
# Pull from any OCI registry
container images pull docker.io/nginx:latest
container images pull ghcr.io/codercom/code-server:latest

# Push to any OCI registry
container push myimage:latest registry.example.com/myimage:latest

# Build OCI-compliant images
container build -t myapp:latest .
```

**Verified compatible registries:**
- Docker Hub
- GitHub Container Registry (ghcr.io)
- Amazon ECR
- Google Container Registry
- Azure Container Registry
- Any OCI-compliant registry

---

## 2. Integration Opportunities

### 2.1 Native Container Execution on macOS

**Current State:**
Our existing infrastructure uses vfkit-based VMs with manual container orchestration.

**Apple Container Benefits:**

| Capability | Current Approach | Apple Container |
|------------|------------------|-----------------|
| Container startup | ~5 seconds | ~100ms |
| Isolation model | Shared VM | VM-per-container |
| Network config | Port forwarding required | Dedicated IP per container |
| macOS integration | External tool (vfkit) | Native Virtualization.framework |
| Memory when idle | 2-4GB reserved | Near-zero per container |

**POC Results (October 2025):**
Successfully ran code-server in Apple Container on macOS 15.6.1:

```bash
# Verified working
container run -d -p 8080:8080 \
  -e PASSWORD=test123 \
  --name vibecode-test \
  codercom/code-server:latest

# Result: code-server running in <3 seconds total
```

### 2.2 Replace Docker Desktop Dependency

**Current Docker Desktop Issues:**
1. Commercial licensing required for organizations >250 employees or >$10M revenue
2. Resource overhead (~2-4GB RAM idle)
3. Not optimized for Apple Silicon
4. Complex setup for volume mounts on macOS

**Apple Container Advantages:**
- Apache 2.0 license (no commercial restrictions)
- Native Apple Silicon optimization
- Minimal resource footprint
- No virtualization layer overhead
- Direct Virtualization.framework integration

**Migration Considerations:**

| Feature | Docker Desktop | Apple Container | Migration Risk |
|---------|---------------|-----------------|----------------|
| `docker run` | Yes | `container run` | Low - similar syntax |
| `docker build` | Yes | `container build` | Low - Dockerfile compatible |
| Docker Compose | Yes | **No** | High - manual orchestration |
| Kubernetes | Yes | **No** | High - no support |
| Volume mounts | Yes | Yes | Low |
| Port forwarding | Required | Optional (dedicated IPs) | Medium |
| GPU passthrough | Yes | **No** | High - not supported |

### 2.3 CI/CD Local Testing

**Use Cases:**

1. **Local Build Verification:**
   ```bash
   # Build and test locally before pushing
   container build -t myapp:latest .
   container run --rm myapp:latest npm test
   ```

2. **Integration Testing:**
   ```bash
   # Each container gets isolated VM - no interference
   container run -d --name db postgres:15
   container run -d --name app -e DB_HOST=$(container inspect db --format '{{.NetworkSettings.IPAddress}}') myapp:latest
   ```

3. **CI Parity:**
   - OCI images work identically in Apple Container and Linux CI
   - Build once, run anywhere (OCI compliance)

---

## 3. Implementation Considerations

### 3.1 Installation and Setup

**System Requirements:**

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| macOS | 26 (Tahoe) | 26+ |
| Hardware | Apple Silicon (M1+) | M3/M4 for best performance |
| Disk | 10GB free | 50GB+ for images |
| RAM | 8GB | 16GB+ |

**Note:** macOS 15 (Sequoia) has limited support - networking isolation unavailable.

**Installation:**

```bash
# Download latest signed installer
curl -L -o container.pkg \
  "https://github.com/apple/container/releases/download/0.9.0/container-0.9.0-installer-signed.pkg"

# Install (places binaries in /usr/local)
sudo installer -pkg container.pkg -target /

# Start the system service
container system start

# Verify installation
container system version
```

**Uninstallation:**

```bash
# Remove with data
/usr/local/bin/uninstall-container.sh -d

# Remove but keep data (images, containers)
/usr/local/bin/uninstall-container.sh -k
```

### 3.2 CLI Usage

**Command Comparison:**

| Operation | Docker | Apple Container |
|-----------|--------|-----------------|
| Run container | `docker run -it alpine sh` | `container run -it alpine sh` |
| List running | `docker ps` | `container ls` |
| List all | `docker ps -a` | `container ls -a` |
| Build image | `docker build -t img .` | `container build -t img .` |
| Pull image | `docker pull nginx` | `container images pull nginx` |
| Push image | `docker push img` | `container push img` |
| Exec into | `docker exec -it name sh` | `container exec --tty --interactive name sh` |
| View logs | `docker logs -f name` | `container logs --follow name` |
| Stop | `docker stop name` | `container stop name` |
| Remove | `docker rm name` | `container rm name` |
| Stats | `docker stats` | `container stats --no-stream` |

**Key Differences:**
- No `container ps` - use `container ls`
- Images use `container images pull` (not `container pull`)
- Port mapping often unnecessary (dedicated IP per container)
- No compose equivalent

**Common Operations:**

```bash
# Run with environment variables and ports
container run -d \
  --name myapp \
  -e DATABASE_URL=postgres://localhost/db \
  -p 3000:3000 \
  myapp:latest

# Run with volume mount
container run -v /host/path:/container/path myapp:latest

# Run with read-only filesystem (v0.8.0+)
container run --read-only myapp:latest

# Configure resource limits (v0.9.0+)
container run --memory 2g --cpus 2 myapp:latest

# Access container by IP (no port forwarding needed)
container inspect myapp --format '{{.NetworkSettings.IPAddress}}'
# Returns: 192.168.64.2

# Create isolated network
container network create mynetwork
container run --network mynetwork myapp:latest
```

### 3.3 Limitations vs Docker

**Hard Limitations:**

| Feature | Status | Impact |
|---------|--------|--------|
| Docker Compose | Not available | Multi-container orchestration requires scripting |
| Kubernetes | Not supported | Cannot run local k8s clusters |
| GPU passthrough | Not supported | ML/AI workloads limited |
| Intel Mac | Not supported | Apple Silicon only |
| macOS 15 and earlier | Partial | No network isolation |
| Swarm mode | Not available | No clustering |
| Buildx | Not available | No multi-platform builds |

**Operational Differences:**

| Aspect | Docker Desktop | Apple Container |
|--------|---------------|-----------------|
| Memory model | Shared VM pool | VM per container |
| Startup cold | ~5s first container | ~100ms per container |
| Startup warm | <1s | ~100ms |
| Idle memory | 2-4GB | Near zero |
| Network | NAT + port forward | Dedicated IP |
| Volume sync | Two-way sync | Direct mount |

**Missing Features (as of v0.9.0):**
- Docker Compose / multi-container orchestration
- Kubernetes support
- GUI management (third-party "Crane" app available)
- Volume plugins
- Network plugins
- Secrets management
- Health checks (basic support only)

---

## 4. Recommendation

### 4.1 Development Adoption

**Recommendation: Adopt for Development (Conditional)**

**When to Use Apple Container:**
- macOS 26+ with Apple Silicon
- Single-container workflows
- Need Docker Desktop licensing alternative
- Want native macOS performance
- Security isolation is priority (VM per container)

**When to Keep Docker Desktop:**
- Need Docker Compose for multi-container apps
- Need local Kubernetes (minikube, kind)
- Team has Intel Macs or older macOS
- GPU-accelerated workloads
- Complex networking requirements

**Adoption Timeline:**

| Phase | Timeframe | Action |
|-------|-----------|--------|
| **Now** | Q1 2026 | Monitor development, test with non-critical workloads |
| **Short-term** | Q2 2026 | Adopt for single-container dev workflows on macOS 26 |
| **Medium-term** | 2026 H2 | Consider as primary runtime when 1.0 released |
| **Long-term** | 2027+ | Evaluate full migration as ecosystem matures |

**Implementation Strategy:**

```
Phase 1: Optional Backend (Now)
- Add Apple Container as optional runtime in VibeCode
- Keep Docker/vfkit as default
- Test with code-server workloads

Phase 2: Parallel Support (Post macOS 26 adoption)
- Support both Docker and Apple Container
- Auto-detect available runtime
- Migrate single-container workloads

Phase 3: Primary Runtime (Post 1.0)
- Apple Container as default on supported systems
- Docker fallback for unsupported features
- Full integration with workspace provisioning
```

### 4.2 Production Considerations

**NOT RECOMMENDED for Production (Currently)**

**Reasons:**
1. **Pre-1.0 Stability:** Breaking changes expected between minor versions
2. **Limited Orchestration:** No compose, no Kubernetes
3. **Platform Lock-in:** Apple Silicon + macOS 26 only
4. **Ecosystem Immaturity:** Limited tooling, documentation, community support
5. **No HA/Clustering:** Single-node only

**Production Readiness Checklist:**

| Requirement | Status | Notes |
|-------------|--------|-------|
| Stable API (1.0+) | Pending | Expected 2026-2027 |
| Orchestration | Missing | No compose/k8s |
| Monitoring | Basic | `container stats` only |
| Logging | Basic | stdout/stderr only |
| Secrets | Missing | Environment variables only |
| Health checks | Basic | Limited support |
| Rolling updates | Missing | Manual restart required |
| Backup/restore | Manual | Image push/pull only |

**When Production-Ready:**
- Version 1.0+ released
- Compose-like orchestration available
- Monitoring/observability integrations
- Enterprise support available
- 12+ months of stability track record

### 4.3 Summary Matrix

| Use Case | Recommendation | Confidence |
|----------|---------------|------------|
| Local development (single container) | Adopt on macOS 26 | High |
| Local development (multi-container) | Stay with Docker | High |
| CI/CD (build images) | Partial adoption | Medium |
| CI/CD (run tests) | Partial adoption | Medium |
| Production workloads | Do not adopt yet | High |
| Kubernetes workflows | Do not adopt | High |
| ML/AI workloads | Do not adopt | High |

---

## 5. References

### Official Sources
- [apple/container GitHub](https://github.com/apple/container)
- [apple/containerization GitHub](https://github.com/apple/containerization)
- [WWDC 2025 - Meet Containerization](https://developer.apple.com/videos/play/wwdc2025/346/)
- [Apple Open Source - Container](https://opensource.apple.com/projects/container/)

### Release Notes
- [v0.9.0 Release](https://github.com/apple/container/releases/tag/0.9.0) - February 3, 2026
- [v0.8.0 Release](https://github.com/apple/container/releases/tag/0.8.0) - January 22, 2026

### Community Resources
- [InfoQ - Apple Container Linux Support](https://www.infoq.com/news/2025/06/apple-container-linux/)
- [Crane - macOS Desktop App for Apple Container](https://github.com/topics/apple-container)
- [Getting Started Tutorial](https://spaquet.medium.com/how-to-set-up-apple-containerization-on-macos-26-f870cc8c26cd)

### Internal Documentation
- [APPLE_CONTAINER_SUCCESS.md](/docs/APPLE_CONTAINER_SUCCESS.md) - POC results
- [APPLE_CONTAINERIZATION_POC.md](/docs/APPLE_CONTAINERIZATION_POC.md) - Framework evaluation
- [TAHOE_VIRTUALIZATION_STRATEGY.md](/docs/TAHOE_VIRTUALIZATION_STRATEGY.md) - macOS 26 planning

---

## Appendix A: Version History

| Version | Date | Key Features |
|---------|------|--------------|
| 0.9.0 | Feb 3, 2026 | Resource limits, Kata 3.26.0 kernel, host.docker.internal support, zstd compression |
| 0.8.0 | Jan 22, 2026 | IPv6 support, read-only mounts, CVE-2026-20613 fix, network prune |
| 0.7.0 | Dec 2025 | Container stats, disk usage reporting |
| 0.4.1 | Oct 2025 | Initial stable release tested in our POC |

## Appendix B: Quick Reference

```bash
# Installation
curl -L -o container.pkg "https://github.com/apple/container/releases/download/0.9.0/container-0.9.0-installer-signed.pkg"
sudo installer -pkg container.pkg -target /
container system start

# Basic usage
container run -d --name web nginx:latest
container ls
container logs --follow web
container stop web
container rm web

# Build and push
container build -t myapp:latest .
container push myapp:latest ghcr.io/org/myapp:latest

# Networking
container network create mynet
container run --network mynet --name app myapp:latest
container inspect app --format '{{.NetworkSettings.IPAddress}}'

# Cleanup
container system prune
container images prune
```

---

*Research conducted for GitHub Issue #1134*
*Last updated: February 4, 2026*
