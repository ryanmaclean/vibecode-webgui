# Security Scan Options - vibecode-cli

This document provides a comprehensive overview of the security scanning capabilities available through the vibecode-cli Security & Compliance menu.

## Overview

The Security & Compliance menu provides a TUI (Text User Interface) for accessing all security-related operations in the vibecode project, including vulnerability scanning, security auditing, license verification, authentication setup, and compliance reporting.

## Security Scan Options

### 1. Vulnerability Scan

**Script:** `scripts/vulnerability-scan.sh`

**Purpose:** Scans the project for known security vulnerabilities in dependencies and packages.

**Features:**
- Checks npm/yarn dependencies for known CVEs
- Identifies outdated packages with security issues
- Reports severity levels (critical, high, moderate, low)
- Provides remediation guidance

**When to Use:**
- Before deployments
- After dependency updates
- During regular security audits
- CI/CD pipeline integration

**Access Path:** Security & Compliance → Security Scans → Vulnerability Scan

---

### 2. Security Audit (Full)

**Script:** `scripts/security-audit.sh`

**Purpose:** Comprehensive security analysis covering multiple security domains.

**Features:**
- Code security pattern analysis
- Configuration security review
- Secrets detection (API keys, tokens, credentials)
- Dependency security audit
- Security best practices validation
- Compliance checks

**Scope:**
- Source code analysis
- Configuration files
- Environment variables
- Build artifacts
- Container images
- Infrastructure as Code

**When to Use:**
- Pre-release security review
- Compliance auditing
- Security incident investigation
- Quarterly security reviews

**Access Path:** Security & Compliance → Security Scans → Security Audit (Full)

---

### 3. Security Scan (Quick)

**Script:** `scripts/security-scan.sh`

**Purpose:** Fast security check for common security issues and misconfigurations.

**Features:**
- Quick vulnerability check
- Basic configuration validation
- Common security anti-patterns
- High-severity issue detection

**When to Use:**
- During development
- Pre-commit checks
- Fast feedback loops
- Local development validation

**Access Path:** Security & Compliance → Security Scans → Security Scan (Quick)

---

### 4. SAST Analysis

**Status:** Planned (Not Yet Implemented)

**Purpose:** Static Application Security Testing - deep code analysis for security vulnerabilities.

**Planned Features:**
- Source code static analysis
- Security vulnerability pattern matching
- Data flow analysis
- Taint analysis
- CWE (Common Weakness Enumeration) detection
- OWASP Top 10 coverage

**Access Path:** Security & Compliance → Security Scans → SAST Analysis

---

### 5. Security Test Suite

**Script:** `scripts/security-test.sh`

**Purpose:** Automated security test execution and validation.

**Features:**
- Security unit tests
- Authentication/authorization tests
- Input validation tests
- SQL injection prevention tests
- XSS prevention tests
- CSRF protection tests

**When to Use:**
- Continuous testing
- Feature development
- Security regression testing
- CI/CD pipelines

**Access Path:** Security & Compliance → Security Scans → Security Test Suite

---

## License Verification Options

### 1. Verify Extension Licenses

**Script:** `scripts/verify-extension-licenses.sh`

**Purpose:** Verify licenses for all VSCode extensions used in the project.

**Features:**
- Extension license detection
- License compatibility checking
- GPL detection and reporting
- License documentation generation

**Access Path:** Security & Compliance → License Checks → Verify Extension Licenses

---

### 2. Check All Licenses

**Script:** `scripts/check-licenses.sh`

**Purpose:** Comprehensive license compliance check for all project dependencies.

**Features:**
- npm package license verification
- License type categorization
- Incompatible license detection
- License report generation

**Access Path:** Security & Compliance → License Checks → Check All Licenses

---

### 3. Verify GPL-Free Status

**Script:** `scripts/verify-gpl-free.sh`

**Purpose:** Ensure no GPL-licensed code is included in the project.

**Features:**
- GPL license detection
- LGPL detection
- License compatibility verification
- Compliance reporting

**Access Path:** Security & Compliance → License Checks → Verify GPL-Free Status

---

## Authentication & Access Control

### 1. Deploy Authelia

**Script:** `scripts/deploy-authelia.sh`

**Purpose:** Deploy Authelia authentication and authorization service.

**Features:**
- Authelia service deployment
- Authentication configuration
- Multi-factor authentication setup
- Session management

**Access Path:** Security & Compliance → SAML & Authentication → Deploy Authelia

---

### 2. Test Authelia Automation

**Script:** `scripts/test-authelia-automation.sh`

**Purpose:** Automated testing of Authelia authentication flows.

**Features:**
- Login flow testing
- MFA verification
- Session validation
- Authorization testing

**Access Path:** Security & Compliance → SAML & Authentication → Test Authelia Automation

---

## Security Monitoring

### 1. Setup Security Monitoring

**Script:** `scripts/security-setup.sh`

**Purpose:** Initial security monitoring infrastructure setup.

**Features:**
- Security monitoring configuration
- Alert rule setup
- Integration with monitoring platforms
- Security event logging

**Access Path:** Security & Compliance → Security Monitoring → Setup Security Monitoring

---

### 2. Run Security Monitoring

**Script:** `scripts/security-monitoring.sh`

**Purpose:** Active security monitoring and alerting.

**Features:**
- Real-time security event monitoring
- Anomaly detection
- Security alert generation
- Incident tracking

**Access Path:** Security & Compliance → Security Monitoring → Run Security Monitoring

---

## Common Features Across All Security Scans

### Logging
- All operations log to `${VIBECODE_LOGS}/vibecode-cli.log`
- Timestamp and severity level tracking
- Detailed execution logs
- Error and warning capture

### User Interface
- TUI progress indicators during execution
- Success/failure notifications
- Detailed error messages
- Results displayed in dialog boxes

### Error Handling
- Graceful error handling
- Exit code propagation
- Detailed error reporting
- Rollback capabilities where applicable

### Integration
- Designed for CI/CD pipeline integration
- Scriptable and automatable
- Return codes for automation
- Machine-readable output options

---

## Best Practices

### Development Workflow
1. Run **Quick Scan** during development
2. Execute **Security Test Suite** before commits
3. Run **Vulnerability Scan** after dependency updates
4. Perform **Full Audit** before releases

### Security Review Cycle
1. **Weekly:** Vulnerability scans
2. **Monthly:** License compliance checks
3. **Quarterly:** Full security audits
4. **On-demand:** Incident investigation

### Compliance Requirements
1. Document all security scans
2. Address critical and high-severity findings immediately
3. Track medium and low-severity issues
4. Maintain audit trail

---

## Security Scan Command Reference

| Scan Type | Script | Execution Time | Scope | Output |
|-----------|--------|----------------|-------|--------|
| Vulnerability Scan | vulnerability-scan.sh | ~2-5 min | Dependencies | CVE list, severity |
| Security Audit | security-audit.sh | ~5-15 min | Full project | Comprehensive report |
| Quick Scan | security-scan.sh | ~1-2 min | Common issues | Issue list |
| SAST | TBD | TBD | Source code | Vulnerability list |
| Security Tests | security-test.sh | ~3-10 min | Test suite | Test results |

---

## Getting Started

### Prerequisites
- vibecode-cli installed
- dialog or whiptail installed
- Appropriate permissions for script execution

### Basic Usage

```bash
# Launch vibecode-cli
vibecode-cli

# Navigate to Security & Compliance
Select: Security & Compliance

# Choose a scan type
Select: Security Scans

# Run desired scan
Select: Vulnerability Scan
```

### Command Line Access (if integrated)

```bash
# Quick security scan
vibecode-cli security scan-quick

# Full security audit
vibecode-cli security audit-full

# Vulnerability scan
vibecode-cli security scan-vulnerabilities
```

---

## Support and Documentation

- **Main Documentation:** `scripts/vibecode-cli-lib/README-SECURITY-DB.md`
- **CLI Framework:** `scripts/vibecode-cli-lib/common.sh`
- **Logs:** `${VIBECODE_LOGS}/vibecode-cli.log`
- **Issue Tracking:** GitHub Issues

---

## Roadmap

### Planned Enhancements
- [ ] SAST integration (SonarQube, Semgrep)
- [ ] DAST capabilities
- [ ] Container security scanning
- [ ] Infrastructure security validation
- [ ] Automated remediation suggestions
- [ ] Security metrics dashboard
- [ ] Compliance report generation
- [ ] Security scan scheduling

### Future Integrations
- [ ] GitHub Advanced Security
- [ ] Snyk integration
- [ ] Datadog Security Monitoring
- [ ] AWS Security Hub
- [ ] Azure Security Center

---

*Last Updated: 2025-10-24*
*vibecode-cli Security & Compliance Module*
