# Datadog Application Security Monitoring (ASM) - VibeCode

Complete guide for Datadog Application Security Monitoring implementation in the VibeCode platform.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Setup](#setup)
- [Configuration](#configuration)
- [Security Rules](#security-rules)
- [IP Blocking](#ip-blocking)
- [Dashboard](#dashboard)
- [Alerts](#alerts)
- [Usage](#usage)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)
- [Compliance](#compliance)

## Overview

Datadog Application Security Monitoring (ASM) provides runtime application security, threat detection, and vulnerability management for the VibeCode platform. ASM detects and blocks attacks in real-time, including SQL injection, XSS, RCE, and more.

### What is ASM?

ASM is a runtime application security solution that:
- Detects attacks as they happen
- Blocks malicious requests automatically
- Identifies vulnerabilities in your code
- Provides security insights and analytics
- Enables compliance reporting

### Why ASM for VibeCode?

1. **Real-time Protection**: Block attacks before they reach your application
2. **Zero Code Changes**: Works with existing APM instrumentation
3. **Vulnerability Context**: Prioritize fixes based on exploitability
4. **Attack Attribution**: Trace attacks to specific IPs and users
5. **Compliance**: Meet security requirements (PCI-DSS, SOC 2, HIPAA)

## Features

### Runtime Threat Detection

- **SQL Injection**: Detects and blocks SQL injection attempts
- **Cross-Site Scripting (XSS)**: Prevents XSS attacks
- **Remote Code Execution (RCE)**: Blocks command injection
- **Path Traversal**: Prevents directory traversal attacks
- **NoSQL Injection**: Detects MongoDB injection attempts
- **LDAP Injection**: Blocks LDAP injection attacks
- **SSRF**: Prevents Server-Side Request Forgery
- **XXE**: Detects XML External Entity attacks

### Vulnerability Management

- **Software Composition Analysis (SCA)**: Identifies vulnerable dependencies
- **Code-level Vulnerabilities**: Detects security issues in your code
- **Exploitability Prioritization**: Focus on vulnerabilities being exploited
- **Remediation Guidance**: Get actionable fix recommendations

### IP & User Blocking

- **Automatic IP Blocking**: Block IPs after threshold violations
- **Manual IP Blocking**: Add known malicious IPs to blocklist
- **User Blocking**: Block authenticated users exhibiting malicious behavior
- **Rate Limiting**: Prevent abuse and DDoS attacks

### Compliance & Reporting

- **PCI-DSS**: Payment card security compliance
- **SOC 2**: Security controls audit
- **HIPAA**: Healthcare data protection
- **Custom Reports**: Export security data for audits

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VibeCode Application                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Next.js App + dd-trace + instrumentation-asm.ts      │ │
│  │  - Automatic request analysis                          │ │
│  │  - Security event tracking                             │ │
│  │  - User attribution                                    │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Datadog Agent (ASM)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ASM Engine (WAF)                                       │ │
│  │  - Rule matching (20ms timeout)                        │ │
│  │  - Custom rules (rules.json)                           │ │
│  │  - IP blocking (ip-blocklist.json)                     │ │
│  │  - Rate limiting                                       │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Datadog Backend                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  - Security signals                                     │ │
│  │  - Attack analytics                                     │ │
│  │  - Vulnerability tracking                               │ │
│  │  - Compliance reports                                   │ │
│  │  - Dashboards & Alerts                                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Setup

### Prerequisites

1. **Datadog Account**: ASM requires a Datadog account with ASM enabled
2. **APM Enabled**: ASM builds on top of APM tracing
3. **dd-trace**: Version 2.0+ with ASM support
4. **Kubernetes**: For DaemonSet deployment (or alternative deployment method)

### 1. Enable ASM in Datadog

```bash
# Contact Datadog support to enable ASM for your organization
# Or enable it in the Datadog UI: Security > Application Security
```

### 2. Deploy Datadog Agent with ASM

#### Kubernetes Deployment

```bash
# Create namespace
kubectl create namespace datadog

# Create Datadog API key secret
kubectl create secret generic datadog-secret \
  --from-literal=api-key='YOUR_DD_API_KEY' \
  -n datadog

# Deploy the agent with ASM configuration
kubectl apply -f monitoring/datadog/agent-daemonset.yaml

# Verify deployment
kubectl get pods -n datadog
kubectl logs -n datadog -l app=datadog-agent
```

#### Docker Deployment

```bash
docker run -d \
  --name datadog-agent \
  -e DD_API_KEY=YOUR_DD_API_KEY \
  -e DD_SITE=datadoghq.com \
  -e DD_APM_ENABLED=true \
  -e DD_APPSEC_ENABLED=true \
  -e DD_APPSEC_SCA_ENABLED=true \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /proc/:/host/proc/:ro \
  -v /sys/fs/cgroup/:/host/sys/fs/cgroup:ro \
  gcr.io/datadoghq/agent:7
```

### 3. Enable ASM in Application

#### Add to instrumentation.ts

```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./src/instrument');

    // Initialize ASM
    if (process.env.DD_APPSEC_ENABLED === 'true') {
      const { initializeASM } = await import('./monitoring/datadog/instrumentation-asm');
      initializeASM();
    }
  }
}
```

#### Set Environment Variables

```bash
# .env.production
DD_APPSEC_ENABLED=true
DD_APPSEC_SCA_ENABLED=true
DD_APPSEC_RULES=/etc/datadog/asm/rules.json
DD_APPSEC_BLOCKING_ENABLED=true
DD_APPSEC_IP_BLOCKING_ENABLED=true
DD_APPSEC_USER_BLOCKING_ENABLED=true
DD_APPSEC_TRACE_RATE_LIMIT=100
DD_APPSEC_WAF_TIMEOUT=20000
```

### 4. Deploy Custom Rules and Configuration

```bash
# Create ASM configuration ConfigMap
kubectl create configmap datadog-asm-config \
  --from-file=rules.json=monitoring/datadog/asm/rules.json \
  --from-file=ip-blocklist.json=monitoring/datadog/asm/ip-blocklist.json \
  -n datadog

# Update the ConfigMap reference in agent-daemonset.yaml
# Then redeploy the agent
kubectl rollout restart daemonset/datadog-agent -n datadog
```

### 5. Import Dashboard

```bash
# Using Datadog API
curl -X POST "https://api.datadoghq.com/api/v1/dashboard" \
  -H "DD-API-KEY: YOUR_API_KEY" \
  -H "DD-APPLICATION-KEY: YOUR_APP_KEY" \
  -H "Content-Type: application/json" \
  -d @monitoring/datadog/dashboards/asm-security.json

# Or import manually in Datadog UI:
# Dashboards > New Dashboard > Import Dashboard JSON
```

### 6. Create Monitors

```bash
# Deploy monitors using Terraform
cd infrastructure/monitoring/terraform
terraform apply

# Or create manually using the monitor definitions in:
# monitoring/datadog/monitors/asm-high-severity.yaml
```

## Configuration

### Agent Configuration

The agent configuration is in `monitoring/datadog/agent-daemonset.yaml`:

```yaml
env:
  # Enable ASM
  - name: DD_APPSEC_ENABLED
    value: "true"

  # Enable SCA (vulnerability detection)
  - name: DD_APPSEC_SCA_ENABLED
    value: "true"

  # Custom rules file
  - name: DD_APPSEC_RULES
    value: "/etc/datadog/asm/rules.json"

  # Enable blocking mode
  - name: DD_APPSEC_BLOCKING_ENABLED
    value: "true"
```

### Application Configuration

Application-level ASM configuration is in `monitoring/datadog/instrumentation-asm.ts`:

```typescript
const asmConfig = {
  enabled: process.env.DD_APPSEC_ENABLED === 'true',
  rateLimit: 100, // traces per second
  waf: {
    timeout: 20000, // microseconds
  },
  blocking: {
    enabled: true,
    ipBlocking: true,
    userBlocking: true,
  },
};
```

## Security Rules

Custom security rules are defined in `monitoring/datadog/asm/rules.json`.

### Rule Structure

```json
{
  "id": "vibecode-sql-injection-001",
  "name": "SQL Injection Detection - Query Parameters",
  "enabled": true,
  "tags": ["type:sqli", "severity:high"],
  "conditions": [
    {
      "operator": "match_regex",
      "parameters": {
        "inputs": [{"address": "server.request.query"}],
        "regex": "(?i)(union|select|insert)\\s+"
      }
    }
  ],
  "on_match": ["block"]
}
```

### Available Rules

1. **SQL Injection** (2 rules)
   - Query parameter injection
   - Request body injection

2. **Cross-Site Scripting** (2 rules)
   - Script tag injection
   - Event handler injection

3. **Remote Code Execution** (1 rule)
   - Command injection

4. **API Key Leakage** (2 rules)
   - Response body leakage
   - JWT token leakage

5. **Path Traversal** (1 rule)
   - Directory traversal

6. **NoSQL Injection** (1 rule)
   - MongoDB injection

7. **LDAP Injection** (1 rule)
   - LDAP query injection

8. **SSRF** (1 rule)
   - Server-side request forgery

9. **XXE** (1 rule)
   - XML external entity injection

### Adding Custom Rules

1. Edit `monitoring/datadog/asm/rules.json`
2. Add your rule following the structure above
3. Update the ConfigMap:
   ```bash
   kubectl create configmap datadog-asm-config \
     --from-file=rules.json=monitoring/datadog/asm/rules.json \
     --from-file=ip-blocklist.json=monitoring/datadog/asm/ip-blocklist.json \
     -n datadog \
     --dry-run=client -o yaml | kubectl apply -f -
   ```
4. Restart the Datadog agent:
   ```bash
   kubectl rollout restart daemonset/datadog-agent -n datadog
   ```

## IP Blocking

IP blocking configuration is in `monitoring/datadog/asm/ip-blocklist.json`.

### Automatic Blocking

```json
{
  "automatic_blocking": {
    "enabled": true,
    "config": {
      "threshold": 10,
      "window_seconds": 300,
      "duration_seconds": 3600
    }
  }
}
```

This configuration blocks an IP for 1 hour after 10 attacks in 5 minutes.

### Manual Blocking

Add IPs to the blocklist:

```json
{
  "blocklist": {
    "enabled": true,
    "ips": [
      "192.0.2.1",
      "198.51.100.0/24"
    ]
  }
}
```

### Rate Limiting

```json
{
  "rate_limiting": {
    "rules": [
      {
        "name": "API Rate Limit",
        "paths": ["/api/*"],
        "limit": 100,
        "window_seconds": 60,
        "action": "block"
      }
    ]
  }
}
```

## Dashboard

The ASM security dashboard (`monitoring/datadog/dashboards/asm-security.json`) provides:

1. **Security Overview**
   - Total security events
   - Active attacks
   - Blocked requests
   - Critical vulnerabilities

2. **Attack Analysis**
   - Attack timeline
   - Attack types distribution
   - Top attacked endpoints
   - Attack sources (IPs)

3. **Threat Intelligence**
   - Blocked vs monitored threats
   - SQL injection attempts
   - XSS attempts
   - RCE attempts

4. **Vulnerability Management**
   - Severity breakdown
   - Exploitability analysis

5. **Compliance Status**
   - PCI-DSS status
   - SOC 2 status
   - HIPAA status

## Alerts

ASM monitors are configured in `monitoring/datadog/monitors/asm-high-severity.yaml`.

### Alert Types

1. **High Severity Attack** - Immediate notification for critical attacks
2. **Critical Vulnerability Exploitation** - CVE exploitation attempts
3. **Mass Attack Campaign** - Coordinated attack detection
4. **Suspicious User Activity** - Insider threat detection
5. **Automatic IP Blocking** - IP block notifications
6. **Rate Limit Exceeded** - Potential DDoS
7. **API Key Leakage** - Credential leak detection
8. **No Data Warning** - ASM health check
9. **Compliance Violation** - Compliance breach alerts
10. **Scanner Activity** - Bot/scanner detection

### Notification Channels

Configure notification channels in each monitor:

```yaml
message: |
  Alert details...

  **Notify:** @slack-security-alerts @pagerduty-security @security-team
```

## Usage

### Track Security Events

```typescript
import { trackSecurityEvent } from '@/monitoring/datadog/instrumentation-asm';

// Track a custom security event
trackSecurityEvent('authentication_failure', {
  username: 'user@example.com',
  reason: 'invalid_password',
  attempt_count: 3,
});
```

### Track Users

```typescript
import { trackUser } from '@/monitoring/datadog/instrumentation-asm';

// Associate trace with user
trackUser('user-123', {
  email: 'user@example.com',
  name: 'John Doe',
  role: 'admin',
});
```

### Report Suspicious Activity

```typescript
import { reportSuspiciousActivity } from '@/monitoring/datadog/instrumentation-asm';

// Report suspicious behavior
reportSuspiciousActivity(
  'Multiple failed authentication attempts',
  'high',
  {
    ip: req.ip,
    username: 'admin',
    attempts: 5,
  }
);
```

### Use ASM Middleware

```typescript
// middleware.ts
import { asmMiddleware } from '@/monitoring/datadog/instrumentation-asm';
import { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Add security context
  asmMiddleware(request);

  // ... rest of middleware logic
}
```

## Testing

### Test Attack Detection

```bash
# Test SQL injection detection
curl -X POST "http://localhost:3000/api/users" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password OR 1=1"}'

# Expected: 403 Forbidden (blocked by ASM)

# Test XSS detection
curl "http://localhost:3000/api/search?q=<script>alert('xss')</script>"

# Expected: 403 Forbidden (blocked by ASM)

# Test rate limiting
for i in {1..150}; do
  curl "http://localhost:3000/api/data"
done

# Expected: 429 Too Many Requests (after 100 requests)
```

### Verify ASM is Working

```bash
# Check agent status
kubectl exec -it -n datadog $(kubectl get pod -n datadog -l app=datadog-agent -o jsonpath='{.items[0].metadata.name}') -- agent status

# Look for:
# ==================
# Application Security
# ==================
# Status: Running
```

### Test Dashboard

1. Go to Datadog UI
2. Navigate to Dashboards > ASM Security
3. Verify data is flowing
4. Check for recent security events

### Test Alerts

1. Trigger a test attack (see above)
2. Check Slack/email for alerts
3. Verify alert contains correct information

## Troubleshooting

### ASM Not Detecting Attacks

1. **Check ASM is enabled**:
   ```bash
   kubectl exec -n datadog POD_NAME -- agent status | grep -A 10 "Application Security"
   ```

2. **Verify environment variables**:
   ```bash
   echo $DD_APPSEC_ENABLED
   echo $DD_APPSEC_RULES
   ```

3. **Check agent logs**:
   ```bash
   kubectl logs -n datadog -l app=datadog-agent | grep -i appsec
   ```

4. **Verify application instrumentation**:
   ```bash
   # Check that dd-trace is initialized with ASM
   grep -r "DD_APPSEC" /path/to/app
   ```

### Attacks Not Being Blocked

1. **Check blocking mode is enabled**:
   ```bash
   echo $DD_APPSEC_BLOCKING_ENABLED
   ```

2. **Verify rules are loaded**:
   ```bash
   kubectl describe configmap datadog-asm-config -n datadog
   ```

3. **Check rule conditions**:
   - Review `rules.json` for correct regex patterns
   - Test regex patterns independently

4. **Review ASM traces in Datadog**:
   - Security > Application Security > Traces
   - Check if attacks are detected but not blocked

### High False Positive Rate

1. **Review triggered rules**:
   ```bash
   # Check which rules are triggering most frequently
   # In Datadog: Security > ASM > Rules
   ```

2. **Adjust rule sensitivity**:
   - Update regex patterns in `rules.json`
   - Add exclusion paths

3. **Add allowlist IPs**:
   ```json
   {
     "allowlist": {
       "ips": ["10.0.0.0/8"]
     }
   }
   ```

### Performance Impact

1. **Check WAF timeout**:
   ```bash
   echo $DD_APPSEC_WAF_TIMEOUT
   ```

2. **Monitor ASM performance**:
   - Dashboard: ASM Performance Impact widget
   - Metric: `trace.appsec.waf.duration`

3. **Adjust rate limiting**:
   ```bash
   DD_APPSEC_TRACE_RATE_LIMIT=50  # Reduce from 100
   ```

## Best Practices

### Security

1. **Start in Monitor Mode**: Test rules before enabling blocking
2. **Review Regularly**: Check security events daily
3. **Update Rules**: Keep custom rules up-to-date
4. **Rotate Secrets**: Rotate API keys regularly
5. **Audit Access**: Review who has access to ASM data

### Performance

1. **Optimize Rules**: Remove unnecessary rules
2. **Set Timeouts**: Keep WAF timeout under 20ms
3. **Rate Limiting**: Set appropriate rate limits
4. **Sample Traces**: Use sampling for high-traffic apps

### Operations

1. **Alert Tuning**: Reduce noise, focus on critical alerts
2. **Documentation**: Document custom rules and exceptions
3. **Incident Response**: Have a runbook for security incidents
4. **Testing**: Test ASM in staging before production
5. **Monitoring**: Monitor ASM health and performance

## Compliance

### PCI-DSS

ASM helps meet PCI-DSS requirements:

- **Requirement 6.6**: Web application firewall (ASM blocks attacks)
- **Requirement 10**: Logging and monitoring (ASM traces all security events)
- **Requirement 11**: Vulnerability scanning (SCA detects vulnerabilities)

### SOC 2

ASM supports SOC 2 Type II compliance:

- **CC6.1**: Security monitoring and alerting
- **CC6.6**: Vulnerability management
- **CC7.2**: Continuous monitoring

### HIPAA

ASM helps with HIPAA compliance:

- **164.308(a)(1)**: Security management process
- **164.308(a)(5)**: Security awareness and training
- **164.312(b)**: Audit controls

### Generating Compliance Reports

```bash
# Export security data for audits
datadog-ci api query --from 30d \
  --query "source:appsec service:vibecode-webgui" \
  --output compliance-report.json
```

## Support

### Resources

- [Datadog ASM Documentation](https://docs.datadoghq.com/security/application_security/)
- [VibeCode Security Wiki](https://github.com/vibecode/vibecode-webgui/wiki/Security)
- Internal Slack: `#security-team`

### Contact

- Security Team: security@vibecode.com
- DevOps Team: devops@vibecode.com
- On-Call: PagerDuty escalation policy

---

**Last Updated**: 2026-01-18
**Maintained By**: AGENT-08: datadog-asm-implementer
**Version**: 1.0.0
