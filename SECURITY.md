# Security Policy

## Our Commitment

VibeCode takes the security of our software seriously. We appreciate the security research community's efforts in helping us maintain the security and privacy of our users. This document outlines our security policy, vulnerability reporting process, and coordinated disclosure guidelines.

## Supported Versions

We provide security updates for the following versions of VibeCode:

| Version | Support Status | Notes |
|---------|----------------|-------|
| 1.x.x (Current) | :white_check_mark: Fully Supported | Active development, receives all security updates |
| 0.1.x (Beta) | :warning: Limited Support | Critical security fixes only until 1.0.0 release |
| < 0.1.0 | :x: Not Supported | Please upgrade to latest version |

**Recommendation:** Always use the latest stable release to ensure you have the most recent security patches and improvements.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

We strongly encourage responsible disclosure of security vulnerabilities. Public disclosure before a fix is available puts the entire community at risk.

### How to Report

**Primary Contact:**
- **Email:** security@vibecode.dev
- **Response Time:** We acknowledge receipt within 48 hours (business days)
- **PGP Key:** Available at https://vibecode.dev/security/pgp-key.asc (when available)

**Alternative Contact (if no response within 72 hours):**
- Create a [GitHub Security Advisory](https://github.com/ryanmaclean/vibecode-webgui/security/advisories/new)
- This creates a private discussion with maintainers

### What to Include

Please provide as much information as possible to help us understand and reproduce the issue:

1. **Type of vulnerability** (e.g., XSS, SQL injection, authentication bypass, etc.)
2. **Affected components** (specific files, functions, or endpoints)
3. **Step-by-step reproduction instructions**
4. **Proof of concept or exploit code** (if applicable)
5. **Potential impact** of the vulnerability
6. **Suggested remediation** (if you have ideas)
7. **Your environment** (version, configuration, deployment method)
8. **Any relevant logs or screenshots**

### What to Expect

1. **Acknowledgment** - Within 48 hours, we'll confirm receipt of your report
2. **Initial Assessment** - Within 5 business days, we'll provide an initial assessment
3. **Progress Updates** - We'll keep you informed of our progress at least every 2 weeks
4. **Resolution Timeline** - We aim to resolve critical issues within 30 days
5. **Public Disclosure** - Coordinated disclosure after a fix is released (see below)

## Coordinated Disclosure Process

We follow a coordinated disclosure process to protect our users:

### Timeline

1. **Day 0** - Vulnerability reported to security team
2. **Day 0-5** - Initial triage and confirmation
3. **Day 5-30** - Development, testing, and validation of fix
4. **Day 30-45** - Release of security patch
5. **Day 45-90** - Public disclosure (after users have time to update)

### Disclosure

- **Security Advisory:** Published on GitHub Security Advisories
- **Release Notes:** Included in patch release notes
- **Credit:** Reporter credited (unless anonymity requested)
- **CVE Assignment:** Requested for significant vulnerabilities

### Exceptions

- **Critical/Actively Exploited:** Expedited timeline (7-14 days)
- **Low Severity:** Extended timeline may be negotiated
- **Vendor Coordination:** Additional time if third-party dependencies involved

## Security Best Practices

### For Developers

#### Secure Configuration

```bash
# Always use environment variables for sensitive data
DATABASE_URL="postgresql://user:pass@host:5432/vibecode"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
OPENAI_API_KEY="sk-..."

# Never commit .env files
echo ".env" >> .gitignore
```

#### Dependency Management

```bash
# Regularly audit dependencies
npm audit --audit-level=moderate
npm run deps:audit

# Keep dependencies updated
npm run deps:update:patch
npm run security:audit
```

#### Authentication & Authorization

- Enable 2FA on all accounts (GitHub, cloud providers, etc.)
- Use strong, unique passwords or password managers
- Rotate API keys and secrets regularly (every 90 days minimum)
- Use least-privilege access principles
- Review and revoke unused access tokens

#### Secrets Management

- **Never** commit secrets to version control
- Use environment variables or secret management services (e.g., HashiCorp Vault, AWS Secrets Manager)
- Scan for accidentally committed secrets using tools like `git-secrets` or `truffleHog`
- Rotate any secrets that may have been exposed

### For Deployments

#### Production Checklist

- [ ] All secrets stored in secure secret management system
- [ ] HTTPS/TLS enabled with valid certificates (minimum TLS 1.2)
- [ ] Security headers configured (CSP, HSTS, X-Frame-Options)
- [ ] Rate limiting enabled on API endpoints
- [ ] Input validation and sanitization implemented
- [ ] Database connections encrypted
- [ ] Regular automated backups configured
- [ ] Monitoring and alerting configured
- [ ] Security updates applied within 30 days
- [ ] Access logs retained for audit purposes

#### Container Security

```bash
# Scan Docker images for vulnerabilities
docker scan vibecode/webgui:latest

# Run containers with minimal privileges
docker run --read-only --cap-drop=ALL vibecode/webgui:latest

# Use specific version tags, not 'latest' in production
docker pull vibecode/webgui:1.1.0
```

#### Kubernetes Security

```bash
# Enable RBAC and network policies
kubectl apply -f k8s/security/rbac.yaml
kubectl apply -f k8s/security/network-policy.yaml

# Scan cluster for security issues
kubectl run --rm -it security-scan --image=aquasec/kube-bench --restart=Never
```

### For Users

- Keep VibeCode updated to the latest version
- Use strong, unique passwords for your account
- Enable two-factor authentication (2FA) if available
- Review connected OAuth applications regularly
- Be cautious with third-party extensions
- Monitor your account for suspicious activity
- Subscribe to [security advisories](https://github.com/ryanmaclean/vibecode-webgui/security/advisories)

## Security Features

### Built-in Protections

- **Authentication:** NextAuth.js with multiple provider support
- **Rate Limiting:** Upstash Redis-based rate limiting
- **Input Validation:** Zod schema validation
- **SQL Injection Protection:** Prisma ORM with parameterized queries
- **XSS Protection:** React's built-in XSS protection, DOMPurify sanitization
- **CSRF Protection:** NextAuth CSRF tokens
- **Dependency Scanning:** Automated npm audit in CI/CD
- **Container Scanning:** Docker image vulnerability scanning

### Monitoring & Observability

- **Application Performance Monitoring (APM):** Datadog tracing
- **Security Monitoring:** Datadog security monitoring
- **Audit Logging:** Winston-based structured logging
- **Real User Monitoring (RUM):** Client-side security event tracking

## Known Security Considerations

### AI Model Integration

- API keys for AI providers (OpenAI, Anthropic, etc.) must be secured
- User prompts may contain sensitive information - handle appropriately
- Rate limiting helps prevent API abuse
- Consider data residency requirements for different AI providers

### Vector Database

- pgvector stores code embeddings - ensure database security
- Implement access controls on sensitive code repositories
- Consider data classification for stored code snippets

### Monaco Editor

- Code execution happens client-side by default
- Server-side code execution requires sandboxing (not included)
- Validate and sanitize any code sent to backend services

## Security Advisories

Stay informed about security updates:

- **GitHub Security Advisories:** https://github.com/ryanmaclean/vibecode-webgui/security/advisories
- **Release Notes:** Check release notes for security fixes
- **Watch Repository:** Enable GitHub notifications for security alerts

## Bug Bounty Program

**Status:** Under Consideration

We are evaluating the establishment of a formal bug bounty program. In the meantime, we greatly appreciate responsible disclosure and will acknowledge security researchers in:

- Security advisories
- Release notes
- Public acknowledgments (with permission)

Exceptional contributions may be eligible for discretionary rewards.

## Compliance & Standards

VibeCode follows industry-standard security practices:

- **OWASP Top 10:** Regular assessment against OWASP vulnerabilities
- **CWE/SANS Top 25:** Awareness of most dangerous software weaknesses
- **Dependency Scanning:** Automated scanning for known vulnerabilities
- **Security Updates:** Timely patching of dependencies

## Security Testing

Our security testing includes:

```bash
# Run security-focused tests
npm run test:security

# Security audit of dependencies
npm run security:audit

# Complete test suite including security tests
npm run test
```

### Continuous Security

- Automated dependency scanning via Dependabot
- GitHub Security Advisories monitoring
- Regular penetration testing (internal)
- Code review with security focus
- Static analysis via ESLint security rules

## Third-Party Dependencies

We carefully evaluate third-party dependencies:

- Regular dependency audits
- Automated vulnerability scanning
- Pinned versions in production
- Evaluation of maintainer reputation
- Review of security advisories

Critical dependencies are monitored for:
- Next.js, React, Monaco Editor
- PostgreSQL, Prisma ORM
- AI provider SDKs (OpenAI, Anthropic)
- Authentication libraries (NextAuth.js)

## Contact & Resources

**Security Team Email:** security@vibecode.dev

**Project Resources:**
- Repository: https://github.com/ryanmaclean/vibecode-webgui
- Documentation: https://github.com/ryanmaclean/vibecode-webgui/tree/main/docs
- Security Advisories: https://github.com/ryanmaclean/vibecode-webgui/security/advisories
- Issue Tracker: https://github.com/ryanmaclean/vibecode-webgui/issues

**General Inquiries:** For non-security issues, please use standard GitHub issues.

## Acknowledgments

We thank the security research community for their contributions to VibeCode's security. Security researchers who have helped improve VibeCode will be acknowledged here (with permission):

- *List will be maintained as vulnerabilities are responsibly disclosed and fixed*

---

**Last Updated:** 2025-10-01
**Version:** 1.0
**Next Review:** 2026-04-01

This security policy is subject to change. Please check back regularly for updates.
