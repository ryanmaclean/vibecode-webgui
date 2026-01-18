# VibeCode Telemetry & Data Collection Guide

Transparency about what data VibeCode collects, why, and how to manage it.

## Core Principle

**VibeCode is privacy-first by design.** We collect minimal data, all locally by default, and provide complete transparency and control.

## What We DON'T Collect

This list is important - we explicitly avoid collecting:

- **Personal Information**: No names, email addresses, or user identifiers
- **File Content**: No source code, configuration, or user data
- **IP Addresses**: Not tracked (unless you explicitly configure cloud monitoring)
- **Keystrokes**: Not logged
- **Browsing History**: Not tracked
- **Location Data**: Not collected
- **Device ID**: Not sent anywhere
- **Credentials**: API keys and passwords never transmitted unless you enable cloud monitoring

## What We DO Collect (Optional)

### Level 0: No Collection (Default)

By default, VibeCode collects **no telemetry data**. The app runs entirely locally.

### Level 1: Local Metrics (Opt-in)

Optional local metrics stored on your machine:

| Metric | Purpose | Example Value |
|--------|---------|----------------|
| `app_launch_timestamp` | Track when app launched | `2026-01-14T10:30:00Z` |
| `vm_boot_time_ms` | Understand performance | `26500` |
| `memory_usage_mb` | Monitor resource usage | `456` |
| `service_startup_times` | Track each service | `ssh:500, postgres:2000, valkey:800, openvscode:3200` |
| `error_count` | Count errors | `0` |
| `services_accessed` | Track which services used | `[postgresql, openvscode]` |

**Storage**: Metrics stored locally at `~/.vibecode/metrics/` - you own this data completely.

**Format**: JSON files, human-readable, encrypted at rest on macOS.

### Level 2: Cloud Metrics (Opt-in)

Only if you explicitly enable Datadog integration:

| Metric | Why | Example |
|--------|-----|---------|
| `vibecode.vm.boot_time` | Understand performance across versions | `25-30 seconds` |
| `vibecode.vm.memory` | Identify memory issues | `400-800 MB` |
| `vibecode.vm.cpu` | Track CPU usage patterns | `15-25%` |
| `vibecode.services.errors` | Catch bugs before users report | `5 errors in last hour` |
| `vibecode.extension.usage` | Understand feature adoption | `datadog_command_executed: 3` |

**Storage**: Sent to Datadog only if you set `DD_API_KEY`.

**Control**: You can disable anytime via `DD_API_KEY=""`.

## Data Collection Mechanisms

### Swift App (macOS)

The native macOS app collects optional metrics using:

```swift
import os

// OSLog - Apple's privacy-respecting logging framework
let logger = Logger(subsystem: "com.vibecode.app", category: "metrics")

// Only collected locally, not sent anywhere
logger.info("App launched")
logger.notice("VM boot completed: \(bootTimeMs)ms")
```

Stored in: `~/Library/Logs/VibeCode/`

### VM Metrics

Inside the VM, services log metrics:

```bash
# Logged locally in VM
echo "service_startup postgres 2100" >> /var/log/vibecode-metrics.log
echo "memory_usage_mb 456" >> /var/log/vibecode-metrics.log
```

Accessible via: `vibecode-vm ssh "cat /var/log/vibecode-metrics.log"`

### OpenVSCode Extension

Datadog extension collects usage only when authenticated:

- Commands executed (metadata only, not results)
- Extension activation time
- Number of searches performed
- UI interactions (clicks on buttons)

**Never collected**: Code content, file names, search queries, or results.

### Third-Party Integrations

#### Datadog VSCode Extension

- **What**: Extension usage statistics
- **When**: Only after user authentication
- **Where**: Datadog servers (if authenticated)
- **Why**: Help Datadog understand feature adoption
- **Control**: Disable in extensions panel

#### OpenTelemetry (Optional)

If you set `OTEL_EXPORTER_OTLP_ENDPOINT`:

- Service request traces (anonymized)
- Performance metrics
- Error rates

**Control**: Leave unset to disable.

## Opt-in Flow

### Enabling Level 1 (Local Metrics)

```bash
# Edit config
vibecode-vm config edit

# Set:
METRICS_ENABLED=true
METRICS_LOCAL_ONLY=true
```

Metrics stored in: `~/.vibecode/metrics/`

### Enabling Level 2 (Cloud Metrics)

```bash
# Set your Datadog API key
export DD_API_KEY="your-api-key-here"
export DD_APP_KEY="your-app-key-here"
export DD_SITE="datadoghq.com"  # or your region

# Start VM
vibecode-vm start
```

Or in config:
```bash
vibecode-vm config edit

# Set:
METRICS_ENABLED=true
METRICS_CLOUD_ENABLED=true
DD_API_KEY="your-key"
DD_APP_KEY="your-app-key"
```

### Disabling Collection

```bash
# Disable all metrics
vibecode-vm config edit

# Set:
METRICS_ENABLED=false
```

Or:
```bash
# Unset cloud keys
export DD_API_KEY=""
export DD_APP_KEY=""
```

## Data Retention

### Local Data

- **Location**: `~/.vibecode/metrics/` and `~/.vibecode/logs/`
- **Retention**: You control (automatic cleanup can be disabled)
- **Default**: Keep 30 days, delete older files
- **Deletion**: `rm -rf ~/.vibecode/metrics/`

### Cloud Data (Datadog)

- **Location**: Datadog servers (varies by region)
- **Retention**: Standard Datadog retention (default 15 days)
- **Deletion**: You can delete via Datadog API or UI
- **GDPR**: Datadog allows GDPR deletion requests

## GDPR & Privacy Compliance

### Your Rights (GDPR)

1. **Right to Access**: See all collected data
   ```bash
   # View local metrics
   cat ~/.vibecode/metrics/*.json

   # Request Datadog export
   # Use Datadog UI: Organization Settings → Data Exports
   ```

2. **Right to Delete**: Request deletion of all data
   ```bash
   # Delete local data
   rm -rf ~/.vibecode/metrics/

   # Request Datadog deletion
   # Submit GDPR request in Datadog UI
   ```

3. **Right to Portability**: Get your data in standard format
   ```bash
   # Export local metrics
   tar -czf vibecode-metrics-backup.tar.gz ~/.vibecode/metrics/
   ```

4. **Right to Opt-out**: Stop collection anytime
   ```bash
   # Disable metrics
   vibecode-vm config edit
   # Set: METRICS_ENABLED=false
   ```

### For EU Users

- **GDPR Article 6(1)(a)**: Collection only on explicit consent (opt-in)
- **GDPR Article 13**: Full transparency (this document)
- **GDPR Article 15**: Right to access your data
- **GDPR Article 17**: Right to deletion
- **GDPR Article 18**: Right to restriction of processing
- **GDPR Article 20**: Right to data portability
- **GDPR Article 21**: Right to object to processing

### For California Users

- **CCPA Rights**:
  - Opt-out of sales (we don't sell data)
  - Delete personal information
  - Know what data we collect
  - Know why we collect it

### For All Users

We commit to:
- **Transparency**: Disclose exactly what we collect
- **Minimal Collection**: Collect only necessary data
- **User Control**: You choose what's collected
- **Security**: Encrypt data at rest and in transit
- **No Sharing**: Never sell or share your data

## Security

### Data Protection

- **At Rest**: Encrypted using macOS Keychain when stored locally
- **In Transit**: HTTPS/TLS 1.2+ when sent to Datadog
- **Authentication**: API key protected with TLS
- **Access**: Only you and (optionally) Datadog can access

### Preventing Data Leaks

The app uses:

```swift
// 1. OSLog for secure logging (not accessible by other apps)
let logger = Logger(subsystem: "com.vibecode.app", category: "metrics")

// 2. Keychain for API keys
// Never stored in plaintext

// 3. File permissions for local metrics
// Mode 0600 - readable only by user
```

### Incident Response

If we discover a data breach:
1. We will notify you within 24 hours
2. Provide information about affected data
3. Explain what we're doing to prevent recurrence
4. Offer free credit monitoring if applicable

**Our commitment**: Zero tolerance for data breaches.

## Auditing Your Data

### Check What's Stored Locally

```bash
# List all local metrics
ls -la ~/.vibecode/metrics/

# View content
cat ~/.vibecode/metrics/app-metrics.json

# Search for specific metrics
grep "error" ~/.vibecode/metrics/*.json

# Check file sizes
du -sh ~/.vibecode/metrics/
```

### Request Datadog Data

1. Go to Datadog: Organization Settings
2. Select "Data Exports"
3. Choose date range
4. Download your data

### Check Collection Status

```bash
# View current config
vibecode-vm config show | grep METRICS

# Check if metrics are being sent
vibecode-vm logs | grep "metrics sent"

# Count local metrics files
find ~/.vibecode/metrics -type f | wc -l
```

## Transparency Reports

We commit to publishing:

- **Quarterly**: Data collection statistics
  - How much data collected
  - Retention duration
  - Deletion requests processed

- **Annually**: Third-party audit results
  - SOC 2 compliance verification
  - Security review findings
  - Privacy assessment

These will be available at: [our transparency page](https://vibecode.dev/transparency)

## FAQs

### Q: Is my code analyzed?
**A**: No. We never access file content, source code, or project files.

### Q: Are my searches tracked?
**A**: No. Search queries and results are never logged.

### Q: Can you see what I type?
**A**: No. Keystrokes are never captured or logged.

### Q: Is my IP address logged?
**A**: Only if you explicitly enable cloud metrics with Datadog. Local metrics don't include IP.

### Q: What about crashes?
**A**:
- Swift app crashes are logged locally only (not sent automatically)
- OpenVSCode errors are logged locally only
- Send to Datadog only if you enable it

### Q: Can I delete my data?
**A**: Yes, anytime:
- Delete `~/.vibecode/metrics/` locally
- Request deletion from Datadog (GDPR right)
- Unset `DD_API_KEY` to stop sending data

### Q: Who has access to my data?
**A**: Only you. We never access metrics without your explicit request.

### Q: How long is data kept?
**A**:
- **Local**: Your choice (default 30 days, then auto-delete)
- **Datadog**: Standard Datadog retention (15 days), you can request deletion

### Q: Is this data sold?
**A**: Never. We never sell, share, or rent your data to anyone.

### Q: What if I don't trust you?
**A**: Run with `METRICS_ENABLED=false` - zero telemetry. Monitor locally only.

## How to Stay Informed

Subscribe to updates about our privacy practices:

1. **GitHub Watch**: Watch the repo for privacy policy updates
2. **Email Alerts**: [Sign up for privacy updates](https://vibecode.dev/privacy-alerts)
3. **RSS Feed**: [Privacy & Security RSS](https://vibecode.dev/rss/privacy)

## Questions?

Email us: **privacy@vibecode.dev**

We'll respond within 48 hours with:
- Full transparency about our practices
- Specific answers to your questions
- Options for data deletion
- Custom privacy configurations if needed

---

## Summary

| Aspect | Status |
|--------|--------|
| **Default Telemetry** | Disabled (zero collection) |
| **Opt-in Required** | Yes, for any data collection |
| **PII Collected** | Never |
| **Code Accessed** | Never |
| **Data Sold** | Never |
| **GDPR Compliant** | Yes |
| **CCPA Compliant** | Yes |
| **User Control** | Complete |
| **Transparency** | Full |
| **Local-first** | Yes |

**Bottom line**: VibeCode respects your privacy. We collect minimal data, only with your explicit opt-in, and you control everything.

---

**Last Updated**: 2026-01-14
**Version**: VibeCode v3.2.1
