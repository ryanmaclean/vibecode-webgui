# VibeCode Privacy Policy

**Effective Date**: 2026-01-14
**Last Updated**: 2026-01-14
**Version**: 1.0

## Executive Summary

VibeCode is a privacy-first development platform. We:
- Collect **zero data by default**
- Never collect personal information
- Never access your code or files
- Never share your data with anyone
- Give you complete control
- Are fully GDPR and CCPA compliant

## 1. What Data We Collect

### Collected by Default: NOTHING

VibeCode collects zero telemetry by default. All data stays on your machine.

### Optionally Collected (With Your Consent)

Only if you explicitly enable it via environment variables.

#### 1a. Local Metrics (Opt-in, Local Storage)

Stored in `~/.vibecode/metrics/` on your machine:

```json
{
  "app_launch_timestamp": "2026-01-14T10:30:00Z",
  "vm_boot_time_ms": 26500,
  "memory_usage_mb": 456,
  "services_accessed": ["postgresql", "openvscode"],
  "error_count": 0
}
```

**What**: Performance and usage metrics
**Where**: Your machine only
**Why**: Understand performance trends
**Control**: Delete anytime with `rm -rf ~/.vibecode/metrics/`

#### 1b. Cloud Metrics (Opt-in, Sent to Datadog)

Only if you set `DD_API_KEY`:

**What**: Boot time, memory, CPU, error counts
**Where**: Datadog servers
**Why**: Aggregate performance across versions
**Control**: `unset DD_API_KEY` to stop

### What We DON'T Collect

- Personal information (names, emails, addresses)
- Source code or file content
- Search queries or results
- Keystrokes
- IP addresses
- API keys or credentials
- Browsing history
- Health or financial information

## 2. How We Use Data

Data is only used to:
1. **Understand Performance**: See how users experience the product
2. **Fix Bugs**: Identify and resolve errors
3. **Improve Features**: Understand what's most valuable
4. **Monitor Reliability**: Ensure services are working

**What We Don't Do**:
- ❌ Never sell to third parties
- ❌ Never share without consent
- ❌ Never use for marketing
- ❌ Never train AI on your data

## 3. Your Privacy Rights (GDPR, CCPA, etc.)

### Access Your Data

```bash
# View local metrics
cat ~/.vibecode/metrics/*.json

# Request Datadog data
# Use Datadog UI: Organization Settings → Data Exports
```

### Delete Your Data

```bash
# Delete local data immediately
rm -rf ~/.vibecode/metrics/

# Request Datadog deletion
# Submit GDPR data deletion request in Datadog UI
```

### Disable Collection

```bash
# Disable all metrics
export METRICS_ENABLED=false
unset DD_API_KEY
unset DD_APP_KEY
```

## 4. Data Retention

**Local Data**: On your machine, auto-delete after 30 days
**Cloud Data**: On Datadog servers, default 15 days
**Logs**: Automatically rotated every 7 days

## 5. Security

- **Encryption**: At rest (Keychain) and in transit (TLS 1.2+)
- **Access**: File permissions (0600, user only)
- **Breach Response**: Notification within 24 hours

## 6. Third-Party Services

- **Datadog**: Only if you provide API key (see their privacy policy)
- **PostgreSQL & Valkey**: Data stays on your VM
- **OpenVSCode**: Source code telemetry disabled by default

## 7. Regional Compliance

- ✓ GDPR (Europe)
- ✓ CCPA (California)  
- ✓ LGPD (Brazil)
- ✓ PIPEDA (Canada)

## 8. Contact

**Privacy Questions**: privacy@vibecode.dev
**Response Time**: Within 48 hours

---

**Last Updated**: 2026-01-14
**Version**: VibeCode v3.2.1
