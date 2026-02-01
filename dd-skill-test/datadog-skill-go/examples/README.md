# Datadog CLI - Practical Examples

Real-world scripts and integrations demonstrating how to use the Datadog CLI in production environments.

---

## Table of Contents

1. [Pre-Deployment Check](#pre-deployment-check) - Safety validation before deploying
2. [Health Monitor](#health-monitor) - Continuous service monitoring
3. [GitHub Actions Integration](#github-actions-integration) - CI/CD pipeline integration
4. [Daily Health Report](#daily-health-report) - Automated reporting
5. [Incident Response Helper](#incident-response-helper) - Rapid incident diagnosis
6. [Pre-Commit Hook](#pre-commit-hook) - Git hook for health validation

---

## Scripts Overview

### 1. Pre-Deployment Check
**File:** `pre-deploy-check.sh`

Comprehensive safety check before deploying a service. Validates health, incidents, error rates, monitors, and SLOs.

**Use Case:** Run before every deployment to catch issues early.

**Usage:**
```bash
# Check current service
./pre-deploy-check.sh

# Check specific service
./pre-deploy-check.sh api-service production
```

**Exit Codes:**
- `0` - Safe to deploy
- `1` - Unsafe (critical issues)
- `2` - Warning (non-critical issues)

**What It Checks:**
- ✅ Service health status
- ✅ Active incidents
- ✅ Error rate (last 30 minutes)
- ✅ Critical logs (last 15 minutes)
- ✅ Monitor alerts
- ✅ SLO compliance
- ✅ Deployment safety (CLI-specific check)

**Integration Example:**
```bash
# In your deployment script
if ./pre-deploy-check.sh api-service production; then
    echo "✅ Safe to deploy"
    deploy-script.sh
else
    echo "❌ Deployment blocked - fix issues first"
    exit 1
fi
```

---

### 2. Health Monitor
**File:** `health-monitor.sh`

Continuously monitors service health and alerts on issues. Tracks status changes, error rates, latency, and anomalies.

**Use Case:** Real-time service monitoring, on-call rotations, post-deployment monitoring.

**Usage:**
```bash
# Monitor with auto-detection (60s interval)
./health-monitor.sh

# Monitor specific service
./health-monitor.sh api-service

# Custom interval (30 seconds)
./health-monitor.sh api-service 30
```

**Features:**
- 🔄 Continuous monitoring loop
- 📊 Real-time metrics (health, error rate, latency)
- 🚨 Alerts on status changes
- 🔍 Automatic anomaly detection
- 📈 Tracks incident count
- ⏰ Configurable check interval

**Example Output:**
```
[2026-01-22 10:30:00] Checking health...
  Status: healthy
  Error Rate: 0.12%
  Latency P50: 85ms
  Latency P95: 210ms
  Request Rate: 1250 req/s
```

**When to Use:**
- During deployments (monitor for 10-15 minutes post-deploy)
- On-call monitoring (run in tmux/screen)
- Performance testing (track metrics during load tests)
- Incident response (monitor recovery)

---

### 3. GitHub Actions Integration
**File:** `github-actions-deploy.yml`

Complete GitHub Actions workflow demonstrating Datadog CLI integration for automated deployments.

**Use Case:** Production-grade CI/CD pipeline with automated safety checks.

**Features:**
- ✅ Pre-deployment safety validation
- ✅ Service health checks
- ✅ Incident detection
- ✅ SLO compliance validation
- ✅ Post-deployment verification
- ✅ Automatic rollback on failure
- ✅ Incident creation for failures

**Workflow Steps:**
1. **Pre-Deployment Check** - Validates service is healthy
2. **Build** - Builds application
3. **Deploy** - Deploys to environment
4. **Post-Deployment Validation** - Verifies deployment success
5. **Rollback** - Auto-rollback if validation fails

**Installation:**
```bash
# Copy to your repository
cp github-actions-deploy.yml .github/workflows/deploy.yml

# Configure secrets in GitHub
# Settings → Secrets → Actions:
#   - DD_API_KEY
#   - DD_APP_KEY
#   - DD_SITE (optional)
```

**Customization:**
```yaml
env:
  SERVICE_NAME: your-service-name  # Change this
```

**Trigger:**
```bash
# Automatic on push to main
git push origin main

# Manual dispatch
gh workflow run deploy.yml -f environment=production
```

---

### 4. Daily Health Report
**File:** `daily-report.sh`

Generates comprehensive daily health reports in Markdown format with metrics, incidents, SLOs, and recommendations.

**Use Case:** Daily standup reports, executive summaries, compliance documentation.

**Usage:**
```bash
# Generate report for current service
./daily-report.sh

# Specific service and output file
./daily-report.sh api-service daily-report-2026-01-22.md
```

**Report Includes:**
- 📊 Executive summary
- 🏥 Service health (24h)
- 🐛 Error analysis
- 🚨 Active and resolved incidents
- 🎯 SLO compliance
- 📡 Monitor status
- 🔍 Watchdog anomalies
- 🚀 Deployment activity (7d)
- 💰 Cost analysis (30d)
- 💡 Recommendations

**Automation:**
```bash
# Daily cron job (9 AM)
0 9 * * * /path/to/daily-report.sh api-service /reports/daily-$(date +\%Y-\%m-\%d).md

# Weekly summary (Monday 9 AM)
0 9 * * 1 /path/to/daily-report.sh api-service /reports/weekly-$(date +\%Y-\%W).md
```

**Example Report Structure:**
```markdown
# Daily Health Report

**Generated:** 2026-01-22 09:00:00
**Service:** api-service

## Executive Summary
**Overall Status:** healthy
**Error Rate:** 0.12%
...

## Service Health
...

## Recommendations
- ✅ All Good: Service is healthy with no issues detected
```

---

### 5. Incident Response Helper
**File:** `incident-response.sh`

Rapid incident response tool that creates incidents and gathers comprehensive diagnostic data automatically.

**Use Case:** On-call incident response, troubleshooting, root cause analysis.

**Usage:**
```bash
# List active incidents
./incident-response.sh list

# Create new incident (interactive)
./incident-response.sh create

# Gather diagnostics for existing incident
./incident-response.sh 12345
```

**What It Collects:**
1. Service health status
2. Recent error traces (30m)
3. Error logs (30m)
4. Critical logs (1h)
5. Watchdog anomalies
6. Monitor alerts
7. Recent deployments (24h)
8. Incident metadata

**Output Structure:**
```
incident-12345-20260122-103000/
├── INCIDENT-SUMMARY.md          # Markdown summary
├── health.json                   # Current health
├── error-traces.json             # APM errors
├── error-logs.json               # Recent error logs
├── critical-logs.json            # Critical logs
├── watchdog-anomalies.json       # Anomalies
├── monitor-alerts.json           # Firing monitors
├── recent-deployments.json       # Recent deploys
└── incident-details.json         # Incident metadata
```

**Workflow:**
```bash
# 1. Create incident
./incident-response.sh create
# Enter: title, severity, service, impact

# 2. Diagnostics auto-collected
# Output: incident-12345-20260122-103000/

# 3. Review data
cd incident-12345-20260122-103000
cat INCIDENT-SUMMARY.md
jq '.' error-logs.json | less

# 4. Update incident
dd incidents update 12345 --status investigating

# 5. Resolve when done
dd incidents close 12345
```

---

### 6. Pre-Commit Hook
**File:** `pre-commit-hook`

Git pre-commit hook that prevents commits if the service is unhealthy or has high error rates.

**Use Case:** Prevent commits during incidents, enforce healthy deployments.

**Installation:**
```bash
# Copy to git hooks directory
cp pre-commit-hook .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Or use pre-commit framework
# Add to .pre-commit-config.yaml:
repos:
  - repo: local
    hooks:
      - id: datadog-health-check
        name: Datadog Health Check
        entry: examples/pre-commit-hook
        language: script
        always_run: true
```

**Configuration:**
Edit the script to configure:
```bash
SERVICE_NAME=""                  # Service name or empty for auto-detect
CHECK_HEALTH=true                # Check service health
CHECK_ERROR_RATE=true            # Check error rate
ERROR_RATE_THRESHOLD=5.0         # Error rate threshold (%)
SKIP_ON_ERROR=false              # Skip checks if CLI fails
```

**What It Blocks:**
- ❌ Commits when service is unhealthy
- ❌ Commits when error rate > threshold
- ⚠️ Warns when service is degraded (but allows commit)

**Bypass Hook:**
```bash
# When necessary (not recommended)
git commit --no-verify -m "Emergency hotfix"
```

**Example Output:**
```
🐶 Running Datadog pre-commit checks...

Checking service health... PASS (healthy)
Checking error rate... PASS (0.12%)

✅ All pre-commit checks passed
```

---

## Common Patterns

### Pattern 1: Pre-Deployment Workflow

```bash
#!/bin/bash
# complete-deploy.sh

echo "1. Running pre-deployment checks..."
if ! ./pre-deploy-check.sh api-service production; then
    echo "❌ Pre-deployment checks failed"
    exit 1
fi

echo "2. Deploying application..."
kubectl apply -f k8s/

echo "3. Monitoring deployment..."
./health-monitor.sh api-service 10 &
MONITOR_PID=$!
sleep 300  # Monitor for 5 minutes

kill $MONITOR_PID

echo "4. Generating post-deployment report..."
./daily-report.sh api-service post-deploy-$(date +%Y%m%d).md

echo "✅ Deployment complete"
```

### Pattern 2: Incident Response Workflow

```bash
#!/bin/bash
# incident-workflow.sh

# 1. Create incident
./incident-response.sh create

# Get incident ID (from output or prompt)
read -p "Enter incident ID: " INCIDENT_ID

# 2. Start monitoring
./health-monitor.sh api-service 30 > incident-$INCIDENT_ID-monitor.log &
MONITOR_PID=$!

# 3. Investigate (manual step)
echo "Review diagnostics in incident-$INCIDENT_ID-*/"
read -p "Press Enter when investigation is complete..."

# 4. Update incident
dd incidents update $INCIDENT_ID --status resolved

# 5. Stop monitoring
kill $MONITOR_PID

# 6. Generate final report
./daily-report.sh api-service incident-$INCIDENT_ID-final-report.md

echo "✅ Incident workflow complete"
```

### Pattern 3: Continuous Monitoring

```bash
#!/bin/bash
# monitoring-dashboard.sh

# Start multiple monitors in background
./health-monitor.sh api-service 60 > logs/api-monitor.log &
./health-monitor.sh payment-service 60 > logs/payment-monitor.log &
./health-monitor.sh checkout-service 60 > logs/checkout-monitor.log &

echo "Monitoring services..."
echo "Logs: logs/*-monitor.log"
echo "Press Ctrl+C to stop all monitors"

# Wait for interrupt
trap "kill 0" INT
wait
```

---

## Integration with CI/CD

### Jenkins Pipeline

```groovy
pipeline {
    agent any

    environment {
        DD_API_KEY = credentials('datadog-api-key')
        DD_APP_KEY = credentials('datadog-app-key')
    }

    stages {
        stage('Pre-Deploy Check') {
            steps {
                sh './examples/pre-deploy-check.sh api-service production'
            }
        }

        stage('Deploy') {
            steps {
                sh './deploy-script.sh'
            }
        }

        stage('Post-Deploy Validation') {
            steps {
                sh '''
                    # Monitor for 5 minutes
                    timeout 300 ./examples/health-monitor.sh api-service 30
                '''
            }
        }
    }

    post {
        always {
            sh './examples/daily-report.sh api-service deploy-report.md'
            archiveArtifacts artifacts: 'deploy-report.md'
        }

        failure {
            sh './examples/incident-response.sh create'
        }
    }
}
```

### GitLab CI

```yaml
pre-deploy-check:
  stage: validate
  script:
    - ./examples/pre-deploy-check.sh $SERVICE_NAME $CI_ENVIRONMENT_NAME
  only:
    - main

post-deploy-monitor:
  stage: verify
  script:
    - timeout 300 ./examples/health-monitor.sh $SERVICE_NAME 30
  only:
    - main

generate-report:
  stage: report
  script:
    - ./examples/daily-report.sh $SERVICE_NAME deploy-report.md
  artifacts:
    paths:
      - deploy-report.md
  only:
    - main
```

---

## Requirements

All scripts require:
- **Datadog CLI** (`dd`) installed and in PATH
- **Environment Variables:**
  - `DD_API_KEY` - Datadog API key
  - `DD_APP_KEY` - Datadog Application key
  - `DD_SITE` - Datadog site (optional, defaults to datadoghq.com)
- **Dependencies:**
  - `jq` - JSON parsing
  - `bc` - Float arithmetic (for thresholds)
  - `curl` - HTTP requests (for some scripts)

**Installation:**
```bash
# macOS
brew install jq bc

# Ubuntu/Debian
apt-get install jq bc

# RHEL/CentOS
yum install jq bc
```

---

## Customization

### Adjust Thresholds

Edit scripts to change thresholds:

```bash
# pre-deploy-check.sh
ERROR_RATE_THRESHOLD=5.0
LATENCY_P95_THRESHOLD=500
CRITICAL_LOGS_THRESHOLD=10

# health-monitor.sh
ERROR_RATE_THRESHOLD=5.0
LATENCY_P95_THRESHOLD=500

# pre-commit-hook
ERROR_RATE_THRESHOLD=5.0
```

### Add Custom Checks

Add your own checks to `pre-deploy-check.sh`:

```bash
# Check 8: Custom validation
echo "8. Running custom checks..."
if my-custom-check; then
    print_status "PASS" "Custom checks passed"
else
    print_status "FAIL" "Custom checks failed"
fi
```

---

## Troubleshooting

### Scripts Fail with "Command not found: dd"

**Solution:**
```bash
# Check if CLI is installed
which dd

# If not, install it or use full path
/usr/local/bin/dd health
```

### Authentication Errors

**Solution:**
```bash
# Verify credentials are set
echo $DD_API_KEY
echo $DD_APP_KEY

# Re-export if needed
export DD_API_KEY="your-key"
export DD_APP_KEY="your-key"
```

### "Permission denied" Errors

**Solution:**
```bash
# Make scripts executable
chmod +x examples/*.sh
chmod +x examples/pre-commit-hook
```

### jq Errors

**Solution:**
```bash
# Install jq
# macOS: brew install jq
# Linux: apt-get install jq

# Verify installation
jq --version
```

---

## Contributing

Have a useful script? Add it to this collection!

1. Create your script in `examples/`
2. Add documentation to this README
3. Include usage examples
4. Test with real Datadog data
5. Submit a pull request

---

## License

These examples are provided as-is for demonstration purposes. Adapt them to your specific needs and test thoroughly before using in production.

---

## Resources

- **CLI Documentation:** [../README.md](../README.md)
- **Quickstart Guide:** [../CLAUDE-CODE-QUICKSTART.md](../CLAUDE-CODE-QUICKSTART.md)
- **Testing Guide:** [../TESTING-GUIDE.md](../TESTING-GUIDE.md)
- **Troubleshooting:** [../TROUBLESHOOTING.md](../TROUBLESHOOTING.md)

---

**Ready to use?** Start with `pre-deploy-check.sh` or `health-monitor.sh`!
