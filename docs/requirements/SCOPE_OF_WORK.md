# Scope of Work (SOW): OpenClaw Tiny VM v1.0

## 1. Objective
Deliver a minimal, secure, and network-capable macOS Virtual Machine solution to host the OpenClaw Gateway using Apple's Virtualization Framework (VZ) on Apple Silicon (ARM64).

## 2. Feature Requirements Matrix

### 🔴 Required (Must-Have for v1.0)
| ID | Feature | Description | Acceptance Criteria |
|----|---------|-------------|---------------------|
| **REQ-01** | **Tiny Footprint** | VM must utilize minimal resources. | < 4GB RAM, < 25GB Disk, < 2 CPU Cores. |
| **REQ-02** | **Reliable Networking** | Connectivity to host and internet. | eth0 carrier=1, DHCP acquires IP, Outbound HTTP works. |
| **REQ-03** | **OpenClaw Gateway** | AI Agent Gateway functionality. | Service installs, starts, responds to Health Check API. |
| **REQ-04** | **Tailscale Integration** | Secure mesh networking access. | Tailscale installs, auths, and exposes Gateway IP to host. |
| **REQ-05** | **Data Persistence** | Configs/Data survive reboot. | `/root/.openclaw` and `/var/lib/tailscale` persist. |
| **REQ-06** | **Security Hardening** | App Store compliant sandbox. | `com.apple.security.virtualization` entitlement signed & active. |
| **REQ-07** | **Headless Operation** | Run without GUI interference. | Serial console access works, no GUI login required. |

### 🟡 Nice-to-Have (v1.1 / Future)
| ID | Feature | Description | Status |
|----|---------|-------------|--------|
| **NICE-01** | **Apple Containers** | Lightweight alternative to VM. | Prototype only (Research complete). |
| **NICE-02** | **Auto-SSL** | Automated Let's Encrypt renewal. | Scripts ready, Self-signed fallback acceptable for v1. |
| **NICE-03** | **Adv. Observability** | Datadog/APM Tracing. | Basic logs required, full APM optional. |
| **NICE-04** | **GUI Access** | VNC/Screen Sharing. | Not required for Gateway operation. |

## 3. Exclusion Criteria
- Intel (x86_64) support is **Out of Scope**.
- Windows/Linux Guest OS support is **Secondary** (Linux used for network validation only).
- GUI automation is **Out of Scope**.

## 4. Definition of Done (DoD)
1. All **Required** features passed acceptance tests.
2. Critical bugs (Networking, Boot) resolved.
3. Documentation for Installation & Troubleshooting complete.
