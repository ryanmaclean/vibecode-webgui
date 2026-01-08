# Security Hardening Pre-Deployment Checklist

**Agent U - Security Hardening Specialist**
**Date**: 2026-01-05
**Version**: 1.0

---

## Overview

This checklist must be completed before deploying the Unified Services VM to any environment. Use this as a pre-flight check to ensure all security controls are properly configured and tested.

### Checklist Completion Status

- [ ] **PRE-BUILD SECURITY** (Section 1)
- [ ] **BUILD-TIME SECURITY** (Section 2)
- [ ] **RUNTIME SECURITY** (Section 3)
- [ ] **NETWORK SECURITY** (Section 4)
- [ ] **SERVICE AUTHENTICATION** (Section 5)
- [ ] **SECRETS MANAGEMENT** (Section 6)
- [ ] **MONITORING & AUDITING** (Section 7)
- [ ] **TESTING & VALIDATION** (Section 8)
- [ ] **DOCUMENTATION & HANDOFF** (Section 9)

---

## Section 1: Pre-Build Security

### 1.1 Environment Preparation

- [ ] Build system has latest security updates installed
- [ ] Build user has minimal required privileges (not root)
- [ ] Build directory has appropriate permissions (700)
- [ ] No secrets in environment variables or shell history
- [ ] Git repository is clean (no uncommitted secrets)

### 1.2 Dependency Verification

- [ ] Alpine Linux mirror URL is official (https://dl-cdn.alpinelinux.org)
- [ ] BusyBox binary checksum verified
- [ ] OpenVSCode package checksum verified
- [ ] PostgreSQL package checksum verified
- [ ] Valkey package checksum verified
- [ ] All APK packages downloaded from official Alpine repository
- [ ] Node.js binary is musl-compatible version

### 1.3 Security Configuration Selection

- [ ] Deployment mode selected (development/staging/production)
- [ ] Security requirements documented
- [ ] Compliance requirements identified
- [ ] Network architecture documented
- [ ] Access control requirements defined

---

## Section 2: Build-Time Security

### 2.1 Credential Generation

- [ ] SSH password is randomly generated (32+ characters)
- [ ] SSH password uses cryptographically secure random source
- [ ] PostgreSQL password is randomly generated (32+ characters)
- [ ] Valkey password is randomly generated (32+ characters)
- [ ] OpenVSCode connection token is randomly generated (64+ hex chars)
- [ ] All passwords use unique random salts
- [ ] Passwords are NOT hardcoded in scripts
- [ ] Passwords are NOT logged to console during build

### 2.2 Configuration Hardening

- [ ] `/etc/shadow` uses SHA-512 password hashing
- [ ] PostgreSQL configured for `scram-sha-256` authentication
- [ ] Valkey configured with `requirepass` and `protected-mode yes`
- [ ] OpenVSCode configured WITHOUT `--without-connection-token`
- [ ] SSH configured for key-based authentication support
- [ ] No default/example passwords in configuration files
- [ ] No trust authentication in `pg_hba.conf`

### 2.3 Service Configuration

- [ ] Services bind to 127.0.0.1 by default (not 0.0.0.0)
- [ ] PostgreSQL SSL certificates generated
- [ ] Valkey dangerous commands disabled (FLUSHALL, CONFIG, EVAL)
- [ ] Dropbear SSH host keys generated
- [ ] Service users created (postgres, valkey, vscode)
- [ ] File permissions set correctly (shadow: 600, configs: 644)

### 2.4 Build Artifact Security

- [ ] Initramfs package created successfully
- [ ] Initramfs size is reasonable (250-350MB)
- [ ] Initramfs extraction test passed
- [ ] Critical binaries present and executable
- [ ] No hardcoded credentials in initramfs
- [ ] Build log does NOT contain passwords or tokens
- [ ] Build artifacts stored securely (not in public repository)

---

## Section 3: Runtime Security

### 3.1 Boot-Time Security

- [ ] Kernel command line does NOT expose secrets in plaintext
- [ ] Datadog API key retrieved securely (not from environment)
- [ ] SSH authorized_keys loaded from secure source
- [ ] Service passwords loaded from secure storage
- [ ] Connection tokens generated at boot (not hardcoded)
- [ ] Random number generator seeded properly

### 3.2 Service Startup

- [ ] Services start with minimal privileges
- [ ] PostgreSQL runs as `postgres` user
- [ ] Valkey runs as `valkey` user
- [ ] OpenVSCode runs as `vscode` user
- [ ] Services do NOT run as root
- [ ] Service log files have correct permissions
- [ ] Service configuration files are read-only

### 3.3 Resource Limits

- [ ] Memory limits set for each service
- [ ] CPU limits set for each service
- [ ] Disk usage limits configured
- [ ] Network bandwidth limits considered
- [ ] Open file limits appropriate
- [ ] Process limits configured

---

## Section 4: Network Security

### 4.1 Firewall Configuration

- [ ] iptables default policy is DROP for INPUT
- [ ] iptables default policy is DROP for FORWARD
- [ ] Loopback interface allowed
- [ ] SSH rate limiting configured (4 connections/min per IP)
- [ ] PostgreSQL port blocked by default (5432)
- [ ] Valkey port blocked by default (6379)
- [ ] OpenVSCode port blocked by default (8080)
- [ ] ICMP rate limiting configured
- [ ] Dropped packets logged
- [ ] Firewall rules saved and persistent

### 4.2 Service Network Bindings

- [ ] SSH listening on all interfaces (required)
- [ ] PostgreSQL listening on 127.0.0.1 only
- [ ] Valkey listening on 127.0.0.1 only
- [ ] OpenVSCode listening on 127.0.0.1 only
- [ ] Datadog StatsD listening on 127.0.0.1:8125 only
- [ ] No unnecessary ports open
- [ ] Port scan performed to verify

### 4.3 Network Isolation

- [ ] Services use Unix sockets where possible
- [ ] Network namespaces configured (if applicable)
- [ ] Service-to-service communication secured
- [ ] External network access restricted
- [ ] DNS resolution working correctly

---

## Section 5: Service Authentication

### 5.1 SSH Authentication

- [ ] Root password is NOT "vibecode"
- [ ] Root password is randomly generated
- [ ] SSH key-based authentication supported
- [ ] SSH host keys generated and verified
- [ ] Password authentication can be disabled for production
- [ ] No password displayed in console output
- [ ] SSH login tested successfully

### 5.2 PostgreSQL Authentication

- [ ] Trust authentication is DISABLED
- [ ] `scram-sha-256` authentication configured
- [ ] Password set for `postgres` user
- [ ] `pg_hba.conf` requires authentication
- [ ] SSL/TLS configured for remote connections
- [ ] Connection tested with password
- [ ] Connection tested with SSL
- [ ] Superuser access restricted

### 5.3 Valkey Authentication

- [ ] `requirepass` configured with strong password
- [ ] `protected-mode yes` enabled
- [ ] ACL rules configured (if needed)
- [ ] Dangerous commands disabled
- [ ] Authentication tested
- [ ] Anonymous access blocked
- [ ] TLS configured (optional)

### 5.4 OpenVSCode Authentication

- [ ] Connection token required (NOT `--without-connection-token`)
- [ ] Connection token is random and unique
- [ ] Token displayed securely at boot
- [ ] Token NOT logged in plaintext
- [ ] Access tested with correct token
- [ ] Access blocked without token
- [ ] Token rotation mechanism documented

---

## Section 6: Secrets Management

### 6.1 Datadog API Key

- [ ] API key NOT in environment variables
- [ ] API key NOT in kernel command line (or masked)
- [ ] API key stored in kernel keyring (preferred)
- [ ] API key stored in secure file (fallback)
- [ ] API key file permissions: 600
- [ ] API key NOT visible in process listings
- [ ] API key format validated (32+ hex chars)
- [ ] API key tested and working

### 6.2 Service Passwords

- [ ] Passwords stored in secure files (not environment)
- [ ] Password files have 600 permissions
- [ ] Passwords NOT in process listings
- [ ] Passwords NOT in logs
- [ ] Passwords backed up securely
- [ ] Password rotation procedure documented

### 6.3 SSL/TLS Certificates

- [ ] Self-signed certificates generated for development
- [ ] CA-signed certificates for production
- [ ] Private keys have 600 permissions
- [ ] Private keys stored securely
- [ ] Certificate expiration monitoring configured
- [ ] Certificate rotation procedure documented

---

## Section 7: Monitoring & Auditing

### 7.1 Audit Logging

- [ ] Audit logging enabled
- [ ] Authentication attempts logged
- [ ] File modifications logged
- [ ] Privileged command execution logged
- [ ] Network connections logged
- [ ] Log directory has correct permissions (700)
- [ ] Log rotation configured
- [ ] Logs forwarded to SIEM/Datadog

### 7.2 Security Monitoring

- [ ] Failed authentication attempts monitored
- [ ] Unusual network connections detected
- [ ] File integrity monitoring enabled (AIDE)
- [ ] Process monitoring configured
- [ ] Resource usage monitored
- [ ] Security alerts configured
- [ ] Incident response plan documented

### 7.3 Datadog Integration

- [ ] Datadog agent/bridge running
- [ ] Metrics being sent successfully
- [ ] Logs being forwarded
- [ ] Security events tagged correctly
- [ ] Dashboards configured
- [ ] Alerts configured for security events
- [ ] API key permissions scoped correctly

---

## Section 8: Testing & Validation

### 8.1 Authentication Testing

- [ ] **SSH**: Login with correct password succeeds
- [ ] **SSH**: Login with incorrect password fails
- [ ] **SSH**: Login with correct SSH key succeeds
- [ ] **SSH**: Rate limiting works (4+ connections/min blocked)
- [ ] **PostgreSQL**: Connection with correct password succeeds
- [ ] **PostgreSQL**: Connection without password fails
- [ ] **PostgreSQL**: SSL connection succeeds
- [ ] **Valkey**: AUTH with correct password succeeds
- [ ] **Valkey**: Commands without AUTH fail
- [ ] **OpenVSCode**: Access with correct token succeeds
- [ ] **OpenVSCode**: Access without token fails

### 8.2 Network Security Testing

- [ ] Port scan shows only SSH port open
- [ ] PostgreSQL not accessible from external network
- [ ] Valkey not accessible from external network
- [ ] OpenVSCode not accessible from external network
- [ ] Firewall rules blocking unauthorized access
- [ ] SSH rate limiting tested and working
- [ ] ICMP rate limiting tested
- [ ] No open ports discovered beyond expected

### 8.3 Service Security Testing

- [ ] PostgreSQL dangerous SQL commands tested (CREATE EXTENSION, etc.)
- [ ] Valkey dangerous commands blocked (FLUSHALL, CONFIG, EVAL)
- [ ] OpenVSCode cannot access restricted files
- [ ] Services running with correct user privileges
- [ ] Services cannot escalate privileges
- [ ] No shell access from web interfaces

### 8.4 Vulnerability Testing

- [ ] Common vulnerabilities scanned (nmap, nikto, etc.)
- [ ] SQL injection tested (PostgreSQL)
- [ ] Command injection tested (all services)
- [ ] Authentication bypass attempts failed
- [ ] Brute force protection tested
- [ ] DDoS protection tested (basic)

### 8.5 Secrets Validation

- [ ] No hardcoded passwords in `/etc/shadow`
- [ ] No passwords in environment variables (check `env`)
- [ ] No passwords in process listings (check `ps aux`)
- [ ] No passwords in `/proc/<pid>/environ`
- [ ] No passwords in log files
- [ ] No passwords in kernel command line
- [ ] API keys not visible with `grep -r` on filesystem

---

## Section 9: Documentation & Handoff

### 9.1 Security Documentation

- [ ] Security architecture diagram created
- [ ] Credential management procedures documented
- [ ] Password rotation procedures documented
- [ ] Certificate rotation procedures documented
- [ ] Firewall rule change procedures documented
- [ ] Incident response plan documented
- [ ] Security contact information documented

### 9.2 Operational Documentation

- [ ] Service startup procedures documented
- [ ] Service shutdown procedures documented
- [ ] Backup and restore procedures documented
- [ ] Update and patch procedures documented
- [ ] Monitoring and alerting procedures documented
- [ ] Troubleshooting guide created
- [ ] Known issues documented

### 9.3 Credential Handoff

- [ ] All credentials recorded in password manager
- [ ] Credentials file deleted from build system
- [ ] Credentials shared securely with operations team
- [ ] Credential access audit trail created
- [ ] Emergency credential access procedure documented
- [ ] Credential rotation schedule created

### 9.4 Compliance Documentation

- [ ] Security controls mapped to compliance requirements
- [ ] Audit logs retention policy documented
- [ ] Data classification documented
- [ ] Access control matrix created
- [ ] Security testing results documented
- [ ] Penetration testing report archived
- [ ] Risk assessment completed

---

## Section 10: Production Readiness

### 10.1 Pre-Production Checklist

- [ ] All previous sections completed and verified
- [ ] Security sign-off obtained from security team
- [ ] Operations team trained on secure procedures
- [ ] Monitoring and alerting validated
- [ ] Backup and restore tested
- [ ] Disaster recovery plan validated
- [ ] Security incident response plan tested

### 10.2 Production Deployment

- [ ] Production environment prepared
- [ ] Network security controls in place
- [ ] Firewall rules configured and tested
- [ ] SSL/TLS certificates installed
- [ ] Monitoring agents deployed
- [ ] Log forwarding configured
- [ ] Backup system operational

### 10.3 Post-Deployment Validation

- [ ] All services started successfully
- [ ] Authentication working correctly
- [ ] Network connectivity verified
- [ ] Monitoring data flowing correctly
- [ ] Logs being collected
- [ ] Alerts functioning
- [ ] Security scan performed on production

### 10.4 Ongoing Security

- [ ] Security update schedule created
- [ ] Vulnerability scanning scheduled
- [ ] Penetration testing scheduled
- [ ] Security review meetings scheduled
- [ ] Credential rotation schedule active
- [ ] Audit log review process active
- [ ] Security metrics being tracked

---

## Severity Levels

Each checklist item is classified by severity:

- **CRITICAL**: Must be completed before deployment to any environment
- **HIGH**: Should be completed before production deployment
- **MEDIUM**: Should be completed within 30 days of deployment
- **LOW**: Nice to have, can be completed within 90 days

### Critical Items (Must Complete)

All items in these sections are CRITICAL:
- Section 2.1: Credential Generation
- Section 2.2: Configuration Hardening
- Section 5: Service Authentication (all subsections)
- Section 6.1: Datadog API Key
- Section 8.1: Authentication Testing
- Section 8.5: Secrets Validation

### High Priority Items

All items in these sections are HIGH:
- Section 4.1: Firewall Configuration
- Section 4.2: Service Network Bindings
- Section 7.1: Audit Logging
- Section 8.2: Network Security Testing
- Section 9.3: Credential Handoff

---

## Sign-Off

### Build Engineer
- Name: ____________________
- Date: ____________________
- Signature: ____________________

### Security Engineer
- Name: ____________________
- Date: ____________________
- Signature: ____________________

### Operations Lead
- Name: ____________________
- Date: ____________________
- Signature: ____________________

### Product Owner
- Name: ____________________
- Date: ____________________
- Signature: ____________________

---

## Appendix: Quick Reference Commands

### Verify No Hardcoded Passwords
```bash
# Check /etc/shadow
grep -E 'vibecode|SALT' /etc/shadow

# Should return nothing
```

### Verify Firewall Rules
```bash
# List all INPUT rules
iptables -L INPUT -n -v

# Should show DROP policy and rate limiting
```

### Verify Services Binding
```bash
# Show listening ports
netstat -tlnp

# PostgreSQL should show 127.0.0.1:5432, not 0.0.0.0:5432
```

### Verify No Secrets in Environment
```bash
# Check environment
env | grep -iE 'password|secret|token|key'

# Should return nothing sensitive
```

### Verify Authentication
```bash
# Test PostgreSQL
psql -h localhost -U postgres  # Should prompt for password

# Test Valkey
redis-cli -h 127.0.0.1         # Should require AUTH

# Test OpenVSCode
curl http://localhost:8080     # Should redirect to token page
```

### Verify Audit Logging
```bash
# Check if audit logs exist
ls -la /var/log/audit/

# View recent logs
tail -f /var/log/audit/security.log
```

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-05 | Agent U | Initial security checklist created |

---

**Document Classification**: Internal - Security Sensitive
**Next Review Date**: 2026-04-05 (Quarterly)
**Checklist Owner**: Security Engineering Team
