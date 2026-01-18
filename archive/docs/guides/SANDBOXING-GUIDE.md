# VibeCode VM - Sandboxing Guide

## Overview

VibeCode VM provides three levels of sandboxing to balance security, isolation, and functionality for different use cases. Each mode offers progressively stronger isolation at the cost of some features or convenience.

## Quick Start

```bash
# Development mode - Full access
./scripts/launch-development.sh [shared-dir]

# Testing mode - Limited resources, no internet
./scripts/launch-testing.sh [shared-dir]

# Isolated mode - Maximum isolation
./scripts/launch-isolated.sh
```

## Sandbox Modes

### Development Mode (Level 1)

**Use Case**: Active development, debugging, prototyping

**Features**:
- Full NAT network access (internet connectivity)
- 4 CPUs, 2048MB RAM
- Host file sharing enabled
- SSH access enabled
- GUI enabled
- All services run as root (no user separation)
- No resource limits

**Security Level**: Low (minimal restrictions)

**Launch**:
```bash
./scripts/launch-development.sh /path/to/shared/directory
```

**Best For**:
- Development workflows
- Full-featured IDE access
- Testing network-dependent features
- Maximum performance and flexibility

---

### Testing Mode (Level 2)

**Use Case**: Integration testing, CI/CD, reproducible environments

**Features**:
- Host-only network (no internet access)
- 2 CPUs, 1024MB RAM
- Host file sharing enabled (for test data)
- SSH access enabled (for automation)
- GUI disabled (headless)
- Services run as separate users (postgres, valkey, vscode)
- Resource limits applied:
  - CPU time: 300 seconds per process
  - Memory: 1GB per process
  - File size: 1GB per file
- Tmpfs mounted with noexec flag

**Security Level**: Medium (enhanced isolation)

**Launch**:
```bash
./scripts/launch-testing.sh /path/to/test/data
```

**Best For**:
- Automated testing
- CI/CD pipelines
- Reproducible test environments
- Isolating tests from internet dependencies
- Resource-constrained testing

**Limitations**:
- No internet access
- Cannot install packages from network
- Limited to host-only communication
- Lower performance due to resource constraints

---

### Isolated Mode (Level 3)

**Use Case**: Running untrusted code, security testing, maximum isolation

**Features**:
- NO network device (complete network isolation)
- 2 CPUs, 512MB RAM
- NO host file sharing
- NO SSH access
- NO GUI
- Services run as separate users
- Read-only host mount (if enabled)
- Strict resource limits:
  - CPU time: 120 seconds per process
  - Memory: 512MB per process
  - File size: 500MB per file
- Tmpfs mounted with noexec and nodev flags

**Security Level**: High (maximum isolation)

**Launch**:
```bash
./scripts/launch-isolated.sh
```

**Monitoring**:
Since SSH and GUI are disabled, monitor via console log:
```bash
tail -f /tmp/vibecode-vm-isolated.log
```

**Best For**:
- Running untrusted or potentially malicious code
- Security testing and analysis
- Demonstrating isolation capabilities
- Training environments for sandboxing concepts

**Limitations**:
- No network connectivity whatsoever
- No way to transfer files in/out (without rebuilding initramfs)
- Limited observability (console log only)
- Minimal resources
- Services may fail to start due to constraints

---

## Technical Details

### Network Isolation

| Mode | Network Device | Internet | Host Access | Service Binding |
|------|---------------|----------|-------------|-----------------|
| Development | virtio-net (NAT) | Yes | Yes | 0.0.0.0 (all interfaces) |
| Testing | virtio-net (Unix socket) | No | Yes | 192.168.64.0/24 |
| Isolated | None | No | No | 127.0.0.1 (localhost) |

### Resource Limits

Resource limits are enforced via ulimit at the system level:

| Resource | Development | Testing | Isolated |
|----------|------------|---------|----------|
| CPUs | 4 | 2 | 2 |
| Memory | 2048MB | 1024MB | 512MB |
| CPU Time (per process) | Unlimited | 300s | 120s |
| Memory (per process) | Unlimited | 1GB | 512MB |
| File Size | Unlimited | 1GB | 500MB |

### Service Isolation

**Development Mode**:
- All services run as root
- No user separation
- Full system access
- No capability restrictions

**Testing Mode**:
- PostgreSQL runs as `postgres` user
- Valkey runs as `valkey` user
- OpenVSCode runs as `vscode` user
- Separate UIDs prevent service cross-contamination
- Each service has independent resource limits

**Isolated Mode**:
- Same user separation as Testing mode
- Additional capability dropping (future enhancement)
- Services cannot access each other's data
- Minimal privileges

### Filesystem Isolation

| Mode | Root FS | /dev/shm | /tmp | Host Mount |
|------|---------|----------|------|------------|
| Development | Read-write | Default | Default | Read-write |
| Testing | Read-write | noexec | Default | Read-write |
| Isolated | Read-write* | noexec, nodev | Default | Read-only (if enabled) |

*Note: Root filesystem itself is not read-only in current implementation, but host mounts can be read-only.

---

## Configuration Architecture

### Configuration Files

- **azure/sandbox-config.sh** - Central configuration library
  - Defines settings for each sandbox mode
  - Provides reusable functions for building vfkit commands
  - Generates kernel command line parameters

- **init-sandbox** - Enhanced init script with sandbox support
  - Parses sandbox parameters from kernel command line
  - Applies resource limits
  - Creates service users
  - Launches services with appropriate isolation

- **scripts/launch-{mode}.sh** - Mode-specific launch scripts
  - Wraps vfkit with correct parameters for each mode
  - Validates prerequisites
  - Provides user feedback

### Kernel Command Line Parameters

The init script reads these parameters from the kernel command line:

```
sandbox_mode=development|testing|isolated
SERVICE_ISOLATION=true|false
USER_SEPARATION=true|false
NETWORK_ISOLATION=false|partial|full
READONLY_ROOT=true|false
MOUNT_NOEXEC=true|false
MOUNT_NODEV=true|false
ulimit_cpu=<seconds>
ulimit_mem=<kilobytes>
ulimit_fsize=<bytes>
BIND_HOST=<ip_or_network>
```

---

## Advanced Usage

### Custom Sandbox Configuration

You can create custom sandbox configurations by sourcing the config library:

```bash
#!/bin/bash
source azure/sandbox-config.sh

# Load a base configuration
eval "$(get_testing_config)"

# Customize settings
CPU_COUNT=3
MEMORY_MB=1536
ENABLE_GUI=true

# Build and run
CMDLINE="console=hvc0 sandbox_mode=custom"
CMDLINE="$CMDLINE $(get_resource_limits_cmdline testing)"
CMDLINE="$CMDLINE $(get_network_isolation_settings testing)"
CMDLINE="$CMDLINE $(get_service_isolation_settings testing)"

vfkit \
    --cpus "$CPU_COUNT" \
    --memory "$MEMORY_MB" \
    --kernel "$KERNEL" \
    --initrd "$INITRAMFS" \
    --kernel-cmdline "$CMDLINE" \
    ... # additional options
```

### Mixing Isolation Features

You can selectively enable/disable features by modifying kernel command line:

```bash
# Testing mode but with GUI enabled
./scripts/launch-testing.sh --gui

# Isolated mode but with read-write host mount
# (requires manual vfkit invocation)
```

### Debugging Sandbox Issues

**Check console log**:
```bash
tail -f /tmp/vibecode-vm-{mode}.log
```

**Check sandbox settings detected**:
Look for "=== Sandbox Configuration ===" section in console output

**Verify service isolation**:
```bash
# Inside VM (via SSH in development/testing mode)
ps aux | grep -E "postgres|valkey|openvscode"

# Check which users are running services
```

**Check resource limits**:
```bash
# Inside VM
ulimit -a

# Check per-service limits (if service isolation enabled)
cat /proc/<pid>/limits
```

---

## Security Considerations

### What Sandboxing Provides

1. **Network Isolation**
   - Prevents unauthorized network access
   - Isolates services from internet (testing/isolated modes)
   - Limits attack surface

2. **Resource Limits**
   - Prevents resource exhaustion attacks
   - Limits CPU consumption (fork bombs, crypto mining)
   - Limits memory usage (prevents OOM)
   - Limits file size (prevents disk filling)

3. **Service Isolation**
   - Prevents lateral movement between services
   - Limits impact of compromised service
   - Enforces principle of least privilege

4. **Filesystem Isolation**
   - Prevents execution from tmpfs (noexec)
   - Prevents device creation (nodev)
   - Limits write access (read-only mounts)

### What Sandboxing Does NOT Provide

1. **Perfect Security**
   - Not a replacement for proper security practices
   - Services still run with significant privileges
   - No MAC (SELinux/AppArmor) enforcement yet

2. **Container-Level Isolation**
   - Weaker than Docker/Podman containers
   - Shared kernel namespace
   - No cgroups v2 full enforcement

3. **Protection from Kernel Exploits**
   - VM kernel is shared by all services
   - Kernel vulnerability affects entire VM
   - Use hypervisor-level isolation for stronger guarantees

4. **Data Encryption**
   - Data at rest is not encrypted
   - Network traffic is not encrypted (unless using TLS in services)
   - Memory is not encrypted

### Best Practices

1. **Choose the Right Mode**
   - Use Development mode only for trusted code
   - Use Testing mode for automated testing
   - Use Isolated mode for untrusted code

2. **Regular Updates**
   - Keep kernel updated
   - Update service binaries
   - Apply security patches

3. **Minimize Host Sharing**
   - Only share directories that are necessary
   - Use read-only mounts when possible
   - Avoid sharing sensitive data

4. **Monitor Activity**
   - Review console logs regularly
   - Monitor resource usage
   - Watch for unusual service behavior

5. **Layer Security**
   - Use sandboxing as one layer
   - Combine with network firewalls
   - Use TLS for service communication
   - Apply principle of least privilege

---

## Troubleshooting

### Services Fail to Start in Isolated Mode

**Symptom**: Services timeout or crash
**Cause**: Insufficient resources (512MB is tight)
**Solution**:
- Check console log for OOM errors
- Consider using Testing mode instead
- Or customize isolated mode with more memory

### No Network Connectivity in Testing Mode

**Symptom**: Services start but cannot reach host
**Cause**: Host-only network requires host-side configuration
**Solution**:
- Verify vfkit Unix socket is created
- Check host firewall settings
- Use Development mode if internet is needed

### Services Run as Root Despite User Separation

**Symptom**: `ps aux` shows root running services
**Cause**: Service isolation not enabled in kernel cmdline
**Solution**:
- Verify `SERVICE_ISOLATION=true` in kernel cmdline
- Check that users (postgres, valkey, vscode) were created
- Review init script user creation section

### Resource Limits Not Applied

**Symptom**: Processes exceed expected limits
**Cause**: ulimit settings not applied correctly
**Solution**:
- Check kernel cmdline has ulimit_* parameters
- Verify init script parsed limits (check console log)
- Note: Some limits (like memory) are soft limits

### Cannot Access Shared Directory

**Symptom**: /mnt/host is empty or not mounted
**Cause**: virtio-fs not configured or shared dir doesn't exist
**Solution**:
- Verify shared directory exists on host
- Check vfkit command includes --device virtio-fs
- In isolated mode, host sharing is disabled by default

---

## Future Enhancements (v1.1.0)

### Planned Features

1. **SELinux/AppArmor Policies**
   - MAC enforcement
   - Fine-grained access control
   - Per-service policy profiles

2. **Seccomp Filters**
   - Syscall filtering
   - Prevent dangerous operations
   - Reduce attack surface

3. **Capability Dropping**
   - Remove unnecessary Linux capabilities
   - Run services with minimal privileges
   - CAP_NET_BIND_SERVICE, CAP_CHOWN, etc.

4. **Cgroups v2 Integration**
   - Better resource enforcement
   - Memory hard limits
   - IO bandwidth limits
   - CPU quota enforcement

5. **Network Policies**
   - Iptables/nftables integration
   - Service-level network rules
   - Prevent service-to-service communication
   - Port-based access control

6. **Audit Logging**
   - Log all service activities
   - Track file access
   - Monitor network connections
   - Security event logging

### Contributing

Sandbox enhancements are welcome! Areas for contribution:
- SELinux policy development
- Seccomp filter profiles
- Additional isolation modes
- Documentation improvements
- Security testing and validation

---

## Appendix: Service Default Ports

| Service | Port | Protocol | Access |
|---------|------|----------|--------|
| SSH | 22 | TCP | Network |
| Valkey | 6379 | TCP | Network |
| PostgreSQL | 5432 | TCP | Network |
| OpenVSCode | 8080 | HTTP | Network |
| Datadog StatsD | 8125 | UDP | Localhost |

All services bind to 0.0.0.0 in Development mode, allowing external connections.
In Testing/Isolated modes, binding depends on network availability.

---

## Support

For issues or questions:
1. Check console logs: `/tmp/vibecode-vm-{mode}.log`
2. Review this guide for troubleshooting steps
3. Examine service logs inside VM: `/tmp/{service}.log`
4. Open an issue with full logs and configuration

---

## License

VibeCode VM sandboxing features are part of the VibeCode project.
See LICENSE file for details.
