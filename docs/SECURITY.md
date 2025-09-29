# Security Policy

## 🔒 Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| main    | ✅ Yes             |
| demo    | ✅ Yes (demo only) |

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability, please follow these steps:

### 1. **Do NOT** create a public GitHub issue

### 2. **Email us directly** at:
- **Primary**: security@vibecode.dev (if available)
- **Fallback**: Create a private security advisory on GitHub

### 3. **Include the following information**:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

### 4. **Response Timeline**:
- **Initial response**: Within 24 hours
- **Status update**: Within 72 hours
- **Resolution**: Depends on severity and complexity

## 🛡️ Security Considerations for Demo

This repository contains a **demonstration environment** for pgvector + PostgreSQL + Datadog DBM. Please note:

### ⚠️ Demo Environment Warnings

- **Default credentials** are used (username: `postgres`, password: `password`)
- **No encryption** is configured by default
- **Local-only** deployment assumed
- **Not production-ready** without additional hardening

### 🔐 Production Security Checklist

If adapting this demo for production use:

- [ ] **Change all default passwords**
- [ ] **Enable TLS/SSL** for all connections
- [ ] **Configure proper RBAC** in Kubernetes
- [ ] **Use secrets management** (not environment variables)
- [ ] **Enable network policies**
- [ ] **Configure proper firewall rules**
- [ ] **Regular security updates**
- [ ] **Audit logging enabled**
- [ ] **Backup encryption**
- [ ] **Compliance requirements** addressed

### 🎯 Demo-Specific Security

The `./DEMO.sh` script:
- ✅ **Runs locally only**
- ✅ **No external data transmission** (except to Datadog if configured)
- ✅ **No persistent sensitive data**
- ⚠️ **Uses default credentials** (acceptable for demo)

## 🔍 Security Features Included

### Kubernetes Security
- **RBAC** configuration examples
- **Network policies** templates
- **Pod security standards** configurations
- **Secrets management** examples

### Database Security
- **Connection encryption** ready
- **User privilege separation**
- **Audit logging** configuration
- **Backup security** considerations

### Monitoring Security
- **Datadog agent** security configuration
- **Metric access control**
- **Dashboard permissions**
- **API key management**

## 🛠️ Security Tools Integration

This repository includes:
- **Dependabot** for dependency updates
- **CodeQL** for static analysis
- **Security scanning** in CI/CD
- **License compliance** checking

## 📋 Security Best Practices

When using this demo:

1. **Isolate the environment** (use KIND/minikube, not production clusters)
2. **Don't expose services** externally unless necessary
3. **Clean up resources** after demo
4. **Monitor for unusual activity**
5. **Keep dependencies updated**

## 🎯 Threat Model

### Assets
- Demo database with sample vector data
- Kubernetes cluster access
- Datadog monitoring data

### Threats
- **Low**: Unauthorized access to demo data
- **Medium**: Kubernetes cluster compromise
- **High**: Production credential exposure

### Mitigations
- Demo runs in isolated environment
- No production credentials used
- Clear documentation about security limitations

## 📞 Contact

For security-related questions:
- **General questions**: Use GitHub Discussions
- **Vulnerabilities**: Follow reporting process above
- **Documentation**: Create GitHub issue with `security` label

## 📄 Compliance

This demo includes examples for:
- **SOC 2** monitoring controls
- **GDPR** data handling (sample data only)
- **HIPAA** considerations (not HIPAA-compliant as-is)
- **PCI DSS** database security patterns

---

**Remember**: This is a demonstration environment. Always harden for production use! 🔒
