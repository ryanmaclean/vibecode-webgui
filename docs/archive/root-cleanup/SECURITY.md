# Security Policy

## Responsible Disclosure

VibeCode takes security vulnerabilities seriously. We appreciate the security research community's efforts in identifying and responsibly disclosing security issues.

### Reporting a Vulnerability

**Please DO NOT create public GitHub issues for security vulnerabilities.**

Instead, report security vulnerabilities through one of these channels:

1. **Email**: security@vibecode.dev
2. **GitHub Security Advisory**: [Create a private security advisory](https://github.com/vibecode/webgui/security/advisories/new)

### What to Include in Your Report

To help us triage and fix the vulnerability quickly, please include:

- **Description**: Clear description of the vulnerability
- **Impact**: Potential security impact and affected components
- **Reproduction Steps**: Detailed steps to reproduce the issue
- **Proof of Concept**: Code, screenshots, or videos demonstrating the vulnerability
- **Affected Versions**: Which versions of VibeCode are affected
- **Suggested Fix**: If you have a recommendation for remediation

### Response Timeline

We are committed to addressing security vulnerabilities promptly:

- **Initial Response**: Within 48 hours of report submission
- **Triage Assessment**: Within 5 business days
- **Status Updates**: Weekly progress updates for ongoing investigations
- **Resolution Timeline**:
  - Critical: 7-14 days
  - High: 14-30 days
  - Medium: 30-60 days
  - Low: 60-90 days

### Disclosure Policy

- **Coordinated Disclosure**: We follow a 90-day coordinated disclosure policy
- **Credit**: We will credit researchers in our security advisories (unless you prefer to remain anonymous)
- **CVE Assignment**: We will request CVEs for qualifying vulnerabilities

### Security Measures

VibeCode implements multiple layers of security:

#### Authentication & Authorization
- Multi-factor authentication (MFA) support via TOTP, SMS, and backup codes
- NextAuth.js integration for secure session management
- Role-based access control (RBAC) for API endpoints
- SAML/SSO support for enterprise deployments

#### API Security
- Zod validation schemas for all API routes
- Rate limiting per user and endpoint
- Input sanitization and validation
- SQL injection prevention via parameterized queries
- CORS protection with allowlist-based origins

#### Network Security
- HTTPS-only in production (HSTS enabled)
- Security headers (CSP, X-Frame-Options, X-Content-Type-Options)
- Bot detection and protection
- IP-based access controls

#### Data Protection
- Secrets stored in macOS Keychain (not plaintext files)
- Encrypted database connections (SSL/TLS)
- Winston structured logging (no sensitive data in logs)
- Environment variable validation and sanitization

#### Infrastructure Security
- Kubernetes security policies and RBAC
- Container image scanning (Trivy)
- Dependabot for automated dependency updates
- Regular security audits and penetration testing

### Credential Rotation

For credential rotation procedures, see the authoritative runbook:
- **[Credential Rotation Runbook](docs/security/credential-rotation.md)**

### Security Best Practices for Contributors

When contributing to VibeCode:

1. **Never commit secrets**: Use environment variables or Keychain
2. **Validate all inputs**: Use Zod schemas for API routes
3. **Use Winston logger**: Replace console.log with structured logging
4. **Follow OWASP guidelines**: Reference OWASP Top 10 and ASVS
5. **Write security tests**: Include security test cases for new features
6. **Review dependencies**: Check for known vulnerabilities before adding dependencies

### Supported Versions

| Version | Supported | End of Life |
|---------|-----------|-------------|
| 2.x     | Active | TBD         |
| 1.x     | Security fixes only | 2025-12-31 |
| < 1.0   | Unsupported | Ended |

### Known Security Considerations

#### Current Limitations
- Auth middleware is currently disabled (src/middleware.ts.disabled)
- Some API routes pending Zod validation migration (tracking in GitHub issues)
- Winston logger migration in progress (see console.log cleanup plan)

#### Ongoing Security Work
- Migration to macOS Keychain for secret storage
- Full API validation coverage with Zod
- Console.log to Winston logger migration
- Security header enforcement in middleware

### Security Contacts

- **Security Team**: security@vibecode.dev
- **PGP Key**: Available at https://vibecode.dev/security.asc
- **Security Advisories**: https://github.com/vibecode/webgui/security/advisories

### Hall of Fame

We recognize security researchers who help improve VibeCode's security:

- *Coming soon - be the first contributor!*

---

**Last Updated**: 2025-10-12
**Policy Version**: 1.0
