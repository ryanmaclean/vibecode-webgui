# Security Testing Quick Reference

> **Quick commands for security testing and validation**

## 🚀 Quick Start

```bash
# Run all security validations
./scripts/security-test.sh

# Run infrastructure security tests
python3 tests/tofu/test_security_validation.py

# Run application security tests
npm test -- security-input-validator

# Check for vulnerabilities
npm audit
```

## 📋 Common Security Commands

### Daily Security Checks

```bash
# Quick security scan
./scripts/security-test.sh

# Check for secrets
git secrets --scan

# Vulnerability check
npm audit
```

### Weekly Security Audit

```bash
# Comprehensive audit
./scripts/security-audit.sh

# Run all security tests
python3 tests/tofu/test_security_validation.py -v
npm test -- tests/security/
npm test -- security-input-validator
```

### Before Committing

```bash
# Pre-commit security check
npm audit
git diff --cached | grep -i "password\|api.key\|secret"
```

## 🛡️ Security Test Results

### Current Status (October 1, 2025)

| Test Suite | Status | Count | Notes |
|------------|--------|-------|-------|
| Infrastructure Tests | ✅ | 7/7 | AWS & GCP validation |
| Application Tests | ✅ | All | Input validation |
| Secret Scanning | ✅ | 0 | No secrets detected |
| Vulnerability Scan | ✅ | 0 | No critical issues |
| Security Posture | 🛡️ | 94% | Strong |

## 📚 Documentation

- **[Security Checkout](./SECURITY_CHECKOUT.md)** - Daily security achievements and status (500+ lines)
- **[Security Testing Guide](./SECURITY_TESTING.md)** - Comprehensive testing documentation (400+ lines)
- **[Security Policy](./SECURITY.md)** - Security policy and vulnerability reporting
- **[Testing Strategy](./TESTING_STRATEGY.md)** - Overall testing strategy including security

## 🔍 What to Look For

### ❌ Security Issues

- Hardcoded secrets (API keys, passwords, tokens)
- Missing encryption configurations
- Overly permissive IAM policies
- Missing security headers
- Unvalidated user input
- Missing rate limiting

### ✅ Security Best Practices

- Environment variables for secrets
- Least privilege IAM roles
- Encryption at rest and in transit
- Input validation and sanitization
- Security headers configured
- Rate limiting enabled
- Audit logging active

## 🚨 Emergency Contacts

- **Security Issues**: Follow process in `docs/SECURITY.md`
- **Questions**: GitHub Discussions with `security` tag
- **Urgent**: Contact security team immediately

## 📊 Security Metrics

**Overall Security Posture**: 🛡️ **STRONG** (94% coverage)

- Authentication: 100% ✅
- Authorization: 95% ✅
- Encryption: 100% ✅
- Network Security: 100% ✅
- Secret Management: 100% ✅
- Monitoring: 90% ✅
- Testing: 70% ⚠️ (improving)

---

**Last Updated**: October 1, 2025  
**Next Review**: Weekly  
**Maintained By**: Security Engineering Team
