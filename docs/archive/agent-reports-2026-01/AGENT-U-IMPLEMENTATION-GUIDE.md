# Security Hardening Implementation Guide

**Agent U - Security Hardening Specialist**
**Date**: 2026-01-05
**Version**: 1.0
**Target**: Unified Services VM (Valkey + PostgreSQL + OpenVSCode + Datadog)

---

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Implementation Scenarios](#implementation-scenarios)
5. [Step-by-Step Implementation](#step-by-step-implementation)
6. [Integration with Build Script](#integration-with-build-script)
7. [Testing & Validation](#testing--validation)
8. [Troubleshooting](#troubleshooting)
9. [Migration Path](#migration-path)
10. [Production Deployment](#production-deployment)

---

## Introduction

This guide provides step-by-step instructions for implementing security hardening for the Unified Services VM. The security enhancements are designed to be **backward compatible** and **opt-in**, allowing gradual adoption without breaking existing workflows.

### What This Guide Covers

- **Credential Management**: Random password generation, SSH keys, secure storage
- **Service Authentication**: PostgreSQL, Valkey, OpenVSCode authentication
- **Network Security**: Firewall rules, service isolation, rate limiting
- **Secrets Management**: Secure API key storage and handling
- **Audit Logging**: Security event monitoring and logging
- **Testing**: Validation and security testing procedures

### Security Modes

| Mode | Use Case | Security Level | Complexity |
|------|----------|----------------|------------|
| **Default** | Local development | LOW (insecure) | Simple |
| **Dev Mode** | Team development | MEDIUM | Moderate |
| **Staging** | Pre-production testing | HIGH | Moderate |
| **Production** | Production deployment | MAXIMUM | Complex |

---

## Prerequisites

### Required Tools

```bash
# On macOS (build system)
brew install openssl coreutils

# Verify tools are available
command -v openssl || echo "Install OpenSSL"
command -v base64 || echo "Install base64"
```

### Required Knowledge

- Basic Linux system administration
- Understanding of SSH authentication
- Basic database concepts (PostgreSQL)
- Understanding of firewall rules (iptables)
- Password manager usage (1Password, LastPass, etc.)

### Environment Setup

```bash
# Set working directory
cd /Users/ryan.maclean/vibecode-webgui

# Make security script executable
chmod +x azure/security-hardening.sh

# Verify script
./azure/security-hardening.sh --help
```

---

## Quick Start

### For Development (Secure Basics)

```bash
# Build with secure development mode
./azure/build-unified-services-with-datadog.sh --dev-mode

# Or apply security to existing build
./azure/security-hardening.sh --dev-mode --show-credentials

# Credentials will be saved to /tmp/security-<pid>/credentials.txt
```

### For Production (Maximum Security)

```bash
# Build with production security
./azure/build-unified-services-with-datadog.sh --production

# Store credentials in password manager
cat /tmp/security-*/credentials.txt

# Delete credentials file
rm -rf /tmp/security-*
```

---

## Implementation Scenarios

### Scenario 1: Local Development (Current State)

**Use Case**: Developer working alone on local machine

**Current Behavior**:
- Hardcoded password "vibecode"
- No authentication for services
- Services on 0.0.0.0
- No firewall

**Recommendation**: Keep default for local-only development, BUT:
- Use `--dev-mode` for shared development environments
- NEVER deploy default to any network-accessible environment

**Implementation**:
```bash
# Continue using default (insecure but simple)
./azure/build-unified-services-with-datadog.sh

# SSH with known password
ssh root@192.168.64.10
Password: vibecode
```

---

### Scenario 2: Team Development (Secure Development)

**Use Case**: Multiple developers sharing VMs on local network

**Required Security**:
- Random passwords for SSH
- Authentication for all services
- Services on 127.0.0.1 by default
- Basic monitoring

**Implementation**:

```bash
# Step 1: Build with dev mode security
./azure/build-unified-services-with-datadog.sh

# Step 2: Apply security hardening
./azure/security-hardening.sh --dev-mode --show-credentials

# Step 3: Save credentials
# Credentials displayed on screen - copy to 1Password/LastPass

# Step 4: Boot VM
vfkit \
  --cpus 4 \
  --memory 2048 \
  --kernel ~/.vfkit/vms/vibecode-valkey/kernel/vmlinux \
  --initrd azure/unified-services-static.cpio.gz \
  --kernel-cmdline "console=hvc0 DD_API_KEY=$DD_API_KEY" \
  --device virtio-net,nat,mac=52:54:00:12:34:70

# Step 5: Test access
ssh root@192.168.64.10
# Use password from credentials file
```

---

### Scenario 3: Staging Environment (High Security)

**Use Case**: Pre-production testing with real-world conditions

**Required Security**:
- SSH key-based authentication
- All services require authentication
- Firewall with rate limiting
- Audit logging enabled

**Implementation**:

```bash
# Step 1: Generate SSH key pair (if needed)
ssh-keygen -t ed25519 -C "staging@vibecode.com" -f ~/.ssh/vibecode_staging

# Step 2: Encode public key for kernel cmdline
PUBLIC_KEY=$(cat ~/.ssh/vibecode_staging.pub | base64)

# Step 3: Build with security
./azure/build-unified-services-with-datadog.sh

# Step 4: Apply staging security
./azure/security-hardening.sh \
  --ssh-keys \
  --service-auth \
  --firewall \
  --audit-logging \
  --show-credentials

# Step 5: Boot with SSH key
vfkit \
  --cpus 4 \
  --memory 2048 \
  --kernel ~/.vfkit/vms/vibecode-valkey/kernel/vmlinux \
  --initrd azure/unified-services-static.cpio.gz \
  --kernel-cmdline "console=hvc0 DD_API_KEY=$DD_API_KEY authorized_keys=$PUBLIC_KEY" \
  --device virtio-net,nat,mac=52:54:00:12:34:70

# Step 6: Connect with SSH key
ssh -i ~/.ssh/vibecode_staging root@192.168.64.10
```

---

### Scenario 4: Production Deployment (Maximum Security)

**Use Case**: Production systems handling real user data

**Required Security**:
- SSH key-only authentication (no passwords)
- All services require strong authentication
- Full firewall with strict rules
- Comprehensive audit logging
- Security monitoring and alerting

**Implementation**:

```bash
# Step 1: Generate production SSH key
ssh-keygen -t ed25519 -C "production@vibecode.com" -f ~/.ssh/vibecode_production
chmod 600 ~/.ssh/vibecode_production

# Step 2: Build for production
./azure/build-unified-services-with-datadog.sh

# Step 3: Apply production security
./azure/security-hardening.sh --production

# Step 4: Store credentials securely
# DO NOT use --show-credentials in production
cat /tmp/security-*/credentials.txt | pbcopy  # Copy to clipboard
# Paste into 1Password/LastPass immediately

# Step 5: Delete credentials file
rm -rf /tmp/security-*

# Step 6: Verify credentials are stored
# Check password manager for:
# - PostgreSQL password
# - Valkey password
# - OpenVSCode connection token

# Step 7: Boot with maximum security
PUBLIC_KEY=$(cat ~/.ssh/vibecode_production.pub | base64)

vfkit \
  --cpus 8 \
  --memory 4096 \
  --kernel ~/.vfkit/vms/vibecode-valkey/kernel/vmlinux \
  --initrd azure/unified-services-static.cpio.gz \
  --kernel-cmdline "console=hvc0 DD_API_KEY=$DD_API_KEY authorized_keys=$PUBLIC_KEY production_mode=1" \
  --device virtio-net,nat,mac=52:54:00:12:34:70 \
  --device virtio-rng

# Step 8: Connect with SSH key (password auth disabled)
ssh -i ~/.ssh/vibecode_production root@192.168.64.10

# Step 9: Verify security
# Run security audit inside VM
/usr/local/bin/security-audit.sh
```

---

## Step-by-Step Implementation

### Phase 1: SSH Authentication Hardening

#### Option A: Random Password Authentication

**When to use**: Development and staging environments

```bash
# Step 1: Run security hardening
./azure/security-hardening.sh --ssh-password-random --show-credentials

# Step 2: Note the generated password
# Output: SSH_PASSWORD=<32_character_random_password>

# Step 3: Save to password manager
# 1Password: Create new Login item
#   - Title: VibeCode VM - SSH
#   - Username: root
#   - Password: <paste_generated_password>
#   - Website: ssh://192.168.64.10
#   - Notes: Generated by security-hardening.sh on <date>

# Step 4: Test SSH access
ssh root@192.168.64.10
# Enter password from password manager

# Step 5: Verify password changed
ssh root@192.168.64.10
# OLD password "vibecode" should NOT work
```

#### Option B: SSH Key-Based Authentication

**When to use**: Staging and production environments

```bash
# Step 1: Generate SSH key pair
ssh-keygen -t ed25519 -C "your_email@example.com" -f ~/.ssh/vibecode_vm
# Enter passphrase (recommended)

# Step 2: Verify key created
ls -la ~/.ssh/vibecode_vm*
# Should show:
#   ~/.ssh/vibecode_vm (private key)
#   ~/.ssh/vibecode_vm.pub (public key)

# Step 3: Set correct permissions
chmod 600 ~/.ssh/vibecode_vm
chmod 644 ~/.ssh/vibecode_vm.pub

# Step 4: Encode public key for kernel cmdline
PUBLIC_KEY=$(cat ~/.ssh/vibecode_vm.pub | base64)
echo $PUBLIC_KEY

# Step 5: Boot VM with public key
vfkit \
  --kernel-cmdline "console=hvc0 authorized_keys=$PUBLIC_KEY" \
  [other vfkit options...]

# Step 6: Connect with key
ssh -i ~/.ssh/vibecode_vm root@192.168.64.10
# Should connect without password

# Step 7: Disable password authentication (production only)
# Inside VM:
# echo "PasswordAuthentication no" >> /etc/ssh/sshd_config
# dropbear -s  # -s disables password logins
```

---

### Phase 2: Service Authentication

#### PostgreSQL Authentication

```bash
# Step 1: Run security hardening
./azure/security-hardening.sh --service-auth --show-credentials

# Step 2: Note PostgreSQL password
# Output: PostgreSQL Password: <32_character_password>

# Step 3: Save to password manager
# 1Password: Create new Database item
#   - Title: VibeCode VM - PostgreSQL
#   - Type: PostgreSQL
#   - Server: 192.168.64.10
#   - Port: 5432
#   - Database: postgres
#   - Username: postgres
#   - Password: <paste_generated_password>

# Step 4: Boot VM
# [Boot VM as normal]

# Step 5: Set PostgreSQL password inside VM
ssh root@192.168.64.10

# Inside VM:
PG_PASSWORD="<paste_from_password_manager>"
su postgres -c "psql -c \"ALTER USER postgres PASSWORD '$PG_PASSWORD';\""

# Step 6: Test connection from host
PGPASSWORD='<password_from_password_manager>' \
  psql -h 192.168.64.10 -U postgres -d postgres

# Should connect successfully

# Step 7: Test connection without password
psql -h 192.168.64.10 -U postgres -d postgres
# Should FAIL with authentication error
```

#### Valkey Authentication

```bash
# Step 1: Run security hardening (if not already done)
./azure/security-hardening.sh --service-auth --show-credentials

# Step 2: Note Valkey password
# Output: Valkey Password: <32_character_password>

# Step 3: Save to password manager
# 1Password: Create new Server item
#   - Title: VibeCode VM - Valkey
#   - Type: Redis/Valkey
#   - Server: 192.168.64.10
#   - Port: 6379
#   - Password: <paste_generated_password>

# Step 4: Boot VM
# Valkey config is already updated during hardening

# Step 5: Test authentication from host
redis-cli -h 192.168.64.10

# Inside redis-cli:
AUTH <password_from_password_manager>
# Should return: OK

PING
# Should return: PONG

# Step 6: Test without authentication
redis-cli -h 192.168.64.10 PING
# Should FAIL with NOAUTH error

# Step 7: Test with password
redis-cli -h 192.168.64.10 -a '<password_from_password_manager>' PING
# Should return: PONG
```

#### OpenVSCode Authentication

```bash
# Step 1: Run security hardening (if not already done)
./azure/security-hardening.sh --service-auth --show-credentials

# Step 2: Note OpenVSCode connection token
# Output: OpenVSCode Connection Token: <64_hex_character_token>

# Step 3: Save to password manager
# 1Password: Create new Login item
#   - Title: VibeCode VM - OpenVSCode
#   - Username: (leave blank)
#   - Password: <paste_token>
#   - Website: http://192.168.64.10:8080

# Step 4: Boot VM
# OpenVSCode will start with token requirement

# Step 5: Access OpenVSCode
# Open browser:
open "http://192.168.64.10:8080/?tkn=<token_from_password_manager>"

# Should connect successfully

# Step 6: Test without token
open "http://192.168.64.10:8080"
# Should show token entry page or access denied
```

---

### Phase 3: Network Security

#### Firewall Configuration

```bash
# Step 1: Run security hardening
./azure/security-hardening.sh --firewall

# Step 2: Boot VM and verify firewall rules
ssh root@192.168.64.10

# Inside VM:
iptables -L INPUT -n -v

# Expected output:
# Chain INPUT (policy DROP)
# ... (loopback rules)
# ... (established/related rules)
# ... (SSH with rate limiting)
# ... (log dropped packets)

# Step 3: Test SSH rate limiting
# From host, run 5 SSH connections rapidly:
for i in {1..5}; do
  ssh root@192.168.64.10 "echo Connection $i" &
done

# 5th connection should be dropped/slow

# Step 4: Verify service isolation
# PostgreSQL should NOT be accessible from network
telnet 192.168.64.10 5432
# Should timeout or connection refused

# Valkey should NOT be accessible from network
telnet 192.168.64.10 6379
# Should timeout or connection refused

# OpenVSCode should NOT be accessible from network
curl http://192.168.64.10:8080
# Should timeout or connection refused
```

#### Enable Network Access (When Needed)

```bash
# If you need to allow network access to services:

# Inside VM:
# Allow PostgreSQL from specific IP
iptables -I INPUT -p tcp --dport 5432 -s <trusted_ip> -j ACCEPT

# Allow Valkey from specific IP
iptables -I INPUT -p tcp --dport 6379 -s <trusted_ip> -j ACCEPT

# Allow OpenVSCode from specific IP
iptables -I INPUT -p tcp --dport 8080 -s <trusted_ip> -j ACCEPT

# Save rules
iptables-save > /etc/iptables.rules

# Verify
iptables -L INPUT -n -v
```

---

### Phase 4: Secrets Management

#### Datadog API Key Secure Storage

```bash
# Step 1: Run security hardening
./azure/security-hardening.sh --secure-api-keys

# Step 2: Verify API key is stored securely
ssh root@192.168.64.10

# Inside VM:
# API key should NOT be in environment
env | grep DD_API_KEY
# Should return nothing

# API key should NOT be visible in process list
ps aux | grep DD_API_KEY
# Should return nothing

# API key should be in kernel keyring
keyctl show @s
# Should show: user: dd_api_key

# Step 3: Retrieve API key when needed
DD_API_KEY=$(keyctl print $(keyctl search @s user dd_api_key))
echo $DD_API_KEY
# Should show API key

# Step 4: Verify Datadog bridge is working
tail -f /tmp/datadog-bridge.log
# Should show metrics being sent
```

---

### Phase 5: Audit Logging

#### Enable and Configure Audit Logging

```bash
# Step 1: Run security hardening
./azure/security-hardening.sh --audit-logging

# Step 2: Boot VM and start security logger
ssh root@192.168.64.10

# Inside VM:
# Start security logger
/usr/local/bin/security-logger.sh &

# Step 3: Verify logging is working
# Generate some events:
ssh root@192.168.64.10  # Trigger auth event
touch /etc/test_file    # Trigger file event
rm /etc/test_file       # Trigger file event

# Step 4: Check logs
tail -f /var/log/audit/security.log

# Expected output:
# [2026-01-05 10:30:00] AUTH: Accepted password for root from 192.168.64.1
# [2026-01-05 10:30:15] FILE: Action: CREATE, Path: /etc/test_file
# [2026-01-05 10:30:20] FILE: Action: DELETE, Path: /etc/test_file

# Step 5: Configure log forwarding to Datadog
# Edit /usr/local/bin/security-logger.sh to forward events
```

---

## Integration with Build Script

### Modify Build Script for Security

Create a new build script that integrates security:

```bash
# Create: azure/build-unified-services-with-datadog-secure.sh

#!/bin/bash
# Build Unified Services VM with Integrated Security

set -euo pipefail

# Import existing build script
source "$(dirname $0)/build-unified-services-with-datadog.sh"

# Security enhancement function
apply_security_hardening() {
    local mode=${1:-development}

    log "Applying security hardening (mode: $mode)"

    # Generate random passwords
    SSH_PASSWORD=$(openssl rand -base64 32)
    PG_PASSWORD=$(openssl rand -base64 32)
    VALKEY_PASSWORD=$(openssl rand -base64 32)
    VSCODE_TOKEN=$(openssl rand -hex 32)

    # Update SSH shadow file
    SSH_SALT=$(openssl rand -hex 16)
    SSH_HASH=$(openssl passwd -6 -salt "$SSH_SALT" "$SSH_PASSWORD")

    sed -i.bak "s|^root:[^:]*:|root:${SSH_HASH}:|" \
        "$WORK_DIR/initramfs/etc/shadow"

    # Update PostgreSQL config
    sed -i.bak 's/trust/scram-sha-256/g' \
        "$WORK_DIR/initramfs/etc/pg_hba.conf"

    # Update Valkey config
    echo "requirepass ${VALKEY_PASSWORD}" >> \
        "$WORK_DIR/initramfs/etc/valkey.conf"
    echo "protected-mode yes" >> \
        "$WORK_DIR/initramfs/etc/valkey.conf"

    # Update init script for OpenVSCode token
    sed -i.bak 's/--without-connection-token/--connection-token-file \/tmp\/vscode-token/' \
        "$WORK_DIR/initramfs/init"

    # Store credentials
    CRED_FILE="/tmp/vibecode-credentials-$(date +%Y%m%d-%H%M%S).txt"
    cat > "$CRED_FILE" << EOF
VibeCode VM Credentials
Generated: $(date)

SSH:
  Host: <VM_IP>
  User: root
  Password: ${SSH_PASSWORD}

PostgreSQL:
  Host: <VM_IP>:5432
  User: postgres
  Password: ${PG_PASSWORD}

Valkey:
  Host: <VM_IP>:6379
  Password: ${VALKEY_PASSWORD}

OpenVSCode:
  URL: http://<VM_IP>:8080/?tkn=${VSCODE_TOKEN}
  Token: ${VSCODE_TOKEN}
EOF

    chmod 600 "$CRED_FILE"

    log "✓ Security hardening applied"
    log "✓ Credentials saved to: $CRED_FILE"
    warn "  IMPORTANT: Save credentials to password manager and delete file!"
}

# Run build with security
main_secure() {
    # Run original build
    check_dependencies
    download_busybox
    download_valkey
    download_postgresql
    download_openvscode
    download_musl_libc
    download_dropbear_ssh
    create_datadog_bridge

    create_initramfs_structure
    copy_binaries
    copy_libraries
    create_configuration_files

    # Apply security BEFORE creating init script
    apply_security_hardening "$SECURITY_MODE"

    create_init_script
    package_initramfs
    verify_initramfs

    show_usage_instructions
}

# Parse security mode
SECURITY_MODE="${1:-development}"

# Run
main_secure
```

---

## Testing & Validation

### Comprehensive Security Test Suite

```bash
#!/bin/bash
# Security Testing Script
# azure/test-security.sh

set -euo pipefail

TESTS_PASSED=0
TESTS_FAILED=0
VM_IP="192.168.64.10"

# Test SSH authentication
test_ssh_auth() {
    echo "Testing SSH authentication..."

    # Test with correct password
    if sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no root@$VM_IP "echo 'SSH OK'"; then
        echo "✓ SSH with correct password: PASS"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "✗ SSH with correct password: FAIL"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    # Test with wrong password
    if sshpass -p "wrongpassword" ssh -o StrictHostKeyChecking=no root@$VM_IP "echo 'SSH OK'" 2>/dev/null; then
        echo "✗ SSH with wrong password should fail: FAIL"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    else
        echo "✓ SSH with wrong password rejected: PASS"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    fi
}

# Test PostgreSQL authentication
test_postgresql_auth() {
    echo "Testing PostgreSQL authentication..."

    # Test with correct password
    if PGPASSWORD="$PG_PASSWORD" psql -h $VM_IP -U postgres -d postgres -c "SELECT 1" &>/dev/null; then
        echo "✓ PostgreSQL with correct password: PASS"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "✗ PostgreSQL with correct password: FAIL"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    # Test without password
    if psql -h $VM_IP -U postgres -d postgres -c "SELECT 1" 2>/dev/null; then
        echo "✗ PostgreSQL without password should fail: FAIL"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    else
        echo "✓ PostgreSQL without password rejected: PASS"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    fi
}

# Test Valkey authentication
test_valkey_auth() {
    echo "Testing Valkey authentication..."

    # Test with correct password
    if redis-cli -h $VM_IP -a "$VALKEY_PASSWORD" PING | grep -q "PONG"; then
        echo "✓ Valkey with correct password: PASS"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "✗ Valkey with correct password: FAIL"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    # Test without password
    if redis-cli -h $VM_IP PING 2>&1 | grep -q "NOAUTH"; then
        echo "✓ Valkey without password rejected: PASS"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "✗ Valkey without password should require AUTH: FAIL"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Test OpenVSCode authentication
test_openvscode_auth() {
    echo "Testing OpenVSCode authentication..."

    # Test with correct token
    if curl -s "http://$VM_IP:8080/?tkn=$VSCODE_TOKEN" | grep -q "<!DOCTYPE html>"; then
        echo "✓ OpenVSCode with correct token: PASS"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "✗ OpenVSCode with correct token: FAIL"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    # Test without token
    if curl -s "http://$VM_IP:8080" | grep -q "connection token"; then
        echo "✓ OpenVSCode without token shows token page: PASS"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "✗ OpenVSCode without token should require token: FAIL"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Test firewall rules
test_firewall() {
    echo "Testing firewall rules..."

    # SSH should be accessible
    if nc -z -w5 $VM_IP 22; then
        echo "✓ SSH port 22 accessible: PASS"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "✗ SSH port 22 should be accessible: FAIL"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi

    # PostgreSQL should be blocked by default
    if ! nc -z -w2 $VM_IP 5432; then
        echo "✓ PostgreSQL port 5432 blocked: PASS"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "✗ PostgreSQL port 5432 should be blocked: FAIL"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Run all tests
main() {
    echo "================================================"
    echo "  Security Testing Suite"
    echo "  VM IP: $VM_IP"
    echo "================================================"
    echo ""

    test_ssh_auth
    echo ""
    test_postgresql_auth
    echo ""
    test_valkey_auth
    echo ""
    test_openvscode_auth
    echo ""
    test_firewall
    echo ""

    echo "================================================"
    echo "  Test Results"
    echo "================================================"
    echo "Passed: $TESTS_PASSED"
    echo "Failed: $TESTS_FAILED"
    echo ""

    if [ $TESTS_FAILED -eq 0 ]; then
        echo "✓ ALL TESTS PASSED"
        exit 0
    else
        echo "✗ SOME TESTS FAILED"
        exit 1
    fi
}

main
```

---

## Troubleshooting

### Common Issues

#### Issue 1: SSH Connection Refused

**Symptom**:
```
ssh root@192.168.64.10
ssh: connect to host 192.168.64.10 port 22: Connection refused
```

**Diagnosis**:
```bash
# Check if VM is running
pgrep vfkit

# Check SSH service in VM
ssh root@192.168.64.10 "ps aux | grep dropbear"

# Check firewall
ssh root@192.168.64.10 "iptables -L INPUT -n | grep 22"
```

**Solution**:
```bash
# Restart Dropbear SSH
ssh root@192.168.64.10 "killall dropbear && dropbear -R -B -E -p 22"

# Check firewall allows SSH
ssh root@192.168.64.10 "iptables -I INPUT -p tcp --dport 22 -j ACCEPT"
```

#### Issue 2: PostgreSQL Authentication Fails

**Symptom**:
```
psql: FATAL: password authentication failed for user "postgres"
```

**Diagnosis**:
```bash
# Check pg_hba.conf
ssh root@192.168.64.10 "cat /etc/pg_hba.conf"

# Check if password is set
ssh root@192.168.64.10 "su postgres -c 'psql -c \"SELECT * FROM pg_authid\"'"
```

**Solution**:
```bash
# Set PostgreSQL password
ssh root@192.168.64.10 "su postgres -c 'psql -c \"ALTER USER postgres PASSWORD '\\''$PG_PASSWORD'\\''\"'"

# Reload PostgreSQL
ssh root@192.168.64.10 "su postgres -c 'pg_ctl reload -D /var/lib/postgresql/data'"
```

#### Issue 3: Valkey NOAUTH Error

**Symptom**:
```
redis-cli PING
(error) NOAUTH Authentication required
```

**Diagnosis**:
```bash
# Check Valkey config
ssh root@192.168.64.10 "cat /etc/valkey.conf | grep requirepass"
```

**Solution**:
```bash
# Connect with password
redis-cli -h 192.168.64.10 -a "$VALKEY_PASSWORD" PING

# Or authenticate after connection
redis-cli -h 192.168.64.10
AUTH <password>
PING
```

#### Issue 4: Credentials File Not Found

**Symptom**:
```
cat: /tmp/security-*/credentials.txt: No such file or directory
```

**Diagnosis**:
```bash
# Check if security script ran
ls -la /tmp/security-*

# Check script output
echo $?
```

**Solution**:
```bash
# Re-run security hardening
./azure/security-hardening.sh --dev-mode --show-credentials

# Credentials will be displayed on screen
```

---

## Migration Path

### Migrating from Insecure (Default) to Secure

**Timeline**: 2-4 hours

```bash
# PHASE 1: Preparation (30 minutes)
# 1. Document current setup
# 2. Export any data from services
# 3. Take VM snapshot (if possible)

# PHASE 2: Apply Security (30 minutes)
# 1. Run security hardening
./azure/security-hardening.sh --dev-mode --show-credentials

# 2. Save credentials
cat /tmp/security-*/credentials.txt > ~/vibecode-credentials.txt
# 3. Store in password manager

# PHASE 3: Rebuild VM (30 minutes)
# 1. Stop current VM
# 2. Rebuild with security
./azure/build-unified-services-with-datadog.sh

# 3. Boot new VM
vfkit [options...]

# PHASE 4: Migration (1 hour)
# 1. Restore data to new VM
# 2. Update application configurations
# 3. Update connection strings

# PHASE 5: Validation (30 minutes)
# 1. Test all services
# 2. Verify authentication
# 3. Run security tests

# PHASE 6: Cleanup
# 1. Delete old credentials
rm ~/vibecode-credentials.txt
# 2. Delete security temp files
rm -rf /tmp/security-*
```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Security hardening script tested in staging
- [ ] All credentials stored in password manager
- [ ] SSH keys generated and tested
- [ ] Firewall rules validated
- [ ] Audit logging configured
- [ ] Monitoring and alerting set up
- [ ] Incident response plan documented
- [ ] Backup and restore tested
- [ ] Security scan completed
- [ ] Compliance requirements met

### Deployment Steps

```bash
# Step 1: Generate production SSH key
ssh-keygen -t ed25519 -C "production@vibecode.com" -f ~/.ssh/vibecode_production
chmod 600 ~/.ssh/vibecode_production

# Step 2: Build production VM
./azure/build-unified-services-with-datadog.sh

# Step 3: Apply production security
./azure/security-hardening.sh --production

# Step 4: Store credentials (NO --show-credentials!)
cat /tmp/security-*/credentials.txt | pbcopy
# Paste into password manager immediately

# Step 5: Delete credentials file
rm -rf /tmp/security-*

# Step 6: Deploy VM
PUBLIC_KEY=$(cat ~/.ssh/vibecode_production.pub | base64)

vfkit \
  --cpus 8 \
  --memory 4096 \
  --kernel ~/.vfkit/vms/vibecode-valkey/kernel/vmlinux \
  --initrd azure/unified-services-static.cpio.gz \
  --kernel-cmdline "console=hvc0 DD_API_KEY=$DD_API_KEY authorized_keys=$PUBLIC_KEY production_mode=1" \
  --device virtio-net,nat,mac=52:54:00:12:34:70 \
  --device virtio-rng

# Step 7: Verify deployment
./azure/test-security.sh

# Step 8: Monitor
# Check Datadog dashboard
# Check audit logs
# Review security alerts
```

### Post-Deployment Validation

```bash
# Run comprehensive security tests
./azure/test-security.sh

# Check all services are running
ssh -i ~/.ssh/vibecode_production root@192.168.64.10 "ps aux | grep -E 'postgres|valkey|openvscode'"

# Verify firewall rules
ssh -i ~/.ssh/vibecode_production root@192.168.64.10 "iptables -L -n -v"

# Check audit logs
ssh -i ~/.ssh/vibecode_production root@192.168.64.10 "tail -100 /var/log/audit/security.log"

# Verify monitoring
# Check Datadog for metrics and logs
```

---

## Appendix: Command Reference

### Security Hardening Commands

```bash
# Show help
./azure/security-hardening.sh --help

# Development mode (secure basics)
./azure/security-hardening.sh --dev-mode --show-credentials

# Production mode (maximum security)
./azure/security-hardening.sh --production

# Selective hardening
./azure/security-hardening.sh --ssh-keys --service-auth --firewall

# Show all credentials (INSECURE - only for development)
./azure/security-hardening.sh --enable-all --show-credentials
```

### Testing Commands

```bash
# Test SSH authentication
sshpass -p "$PASSWORD" ssh root@192.168.64.10 "echo OK"

# Test PostgreSQL authentication
PGPASSWORD="$PG_PASSWORD" psql -h 192.168.64.10 -U postgres -c "SELECT 1"

# Test Valkey authentication
redis-cli -h 192.168.64.10 -a "$VALKEY_PASSWORD" PING

# Test OpenVSCode token
curl "http://192.168.64.10:8080/?tkn=$VSCODE_TOKEN"

# Test firewall
nmap -p 22,5432,6379,8080 192.168.64.10
```

### Credential Retrieval Commands

```bash
# From password manager (example: 1Password CLI)
op get item "VibeCode VM - SSH" --fields password

# From kernel keyring
ssh root@192.168.64.10 "keyctl print \$(keyctl search @s user dd_api_key)"

# From secure file
ssh root@192.168.64.10 "cat /tmp/.dd_api_key"
```

---

## Support & Resources

### Documentation

- **Security Report**: `/Users/ryan.maclean/vibecode-webgui/AGENT-U-SECURITY-HARDENING.md`
- **Security Checklist**: `/Users/ryan.maclean/vibecode-webgui/AGENT-U-SECURITY-CHECKLIST.md`
- **Security Script**: `/Users/ryan.maclean/vibecode-webgui/azure/security-hardening.sh`

### Getting Help

1. **Check documentation** (this guide)
2. **Review security report** (AGENT-U-SECURITY-HARDENING.md)
3. **Check troubleshooting section** (above)
4. **Review build logs** (/tmp/unified-services-dd-*/build.log)
5. **Check security logs** (/var/log/audit/security.log)

### Best Practices

1. **Always use password manager** for credential storage
2. **Never commit credentials** to version control
3. **Rotate credentials** regularly (every 90 days)
4. **Use SSH keys** for production
5. **Enable audit logging** in all environments
6. **Monitor security alerts** in Datadog
7. **Run security tests** before deployment
8. **Document all changes** to security configuration

---

**Document Version**: 1.0
**Last Updated**: 2026-01-05
**Maintained By**: Security Engineering Team
**Next Review**: 2026-04-05
