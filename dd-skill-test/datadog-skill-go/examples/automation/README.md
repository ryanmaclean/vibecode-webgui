# Automation Examples

Real-world automation examples using Datadog CLI in CI/CD pipelines, monitoring scripts, and deployment workflows.

---

## Table of Contents

- [CI/CD Integration](#cicd-integration)
- [Deployment Safety Checks](#deployment-safety-checks)
- [Incident Response](#incident-response)
- [Health Monitoring](#health-monitoring)
- [Cost Tracking](#cost-tracking)

---

## CI/CD Integration

### GitHub Actions: Pre-Deployment Check

**File**: `.github/workflows/deploy-check.yml`

```yaml
name: Pre-Deployment Check

on:
  pull_request:
    branches: [ main ]

jobs:
  deployment-safety:
    runs-on: ubuntu-latest
    steps:
      - name: Install Datadog CLI
        run: |
          curl -L https://github.com/your-org/datadog-cli/releases/latest/download/datadog-cli-linux-amd64 -o dd
          chmod +x dd
          sudo mv dd /usr/local/bin/

      - name: Check Service Health
        env:
          DD_API_KEY: ${{ secrets.DD_API_KEY }}
          DD_APP_KEY: ${{ secrets.DD_APP_KEY }}
        run: |
          # Check if service is healthy
          HEALTH_STATUS=$(dd health --service my-service --json | jq -r '.status')

          if [ "$HEALTH_STATUS" != "healthy" ]; then
            echo "❌ Service is not healthy. Cannot deploy."
            exit 1
          fi

          echo "✅ Service is healthy"

      - name: Check Deploy Safety
        env:
          DD_API_KEY: ${{ secrets.DD_API_KEY }}
          DD_APP_KEY: ${{ secrets.DD_APP_KEY }}
        run: |
          # Check if safe to deploy
          CAN_DEPLOY=$(dd deploy --service my-service --json | jq -r '.can_deploy')

          if [ "$CAN_DEPLOY" != "true" ]; then
            echo "❌ Not safe to deploy. Check Datadog for issues."
            dd deploy --service my-service
            exit 1
          fi

          echo "✅ Safe to deploy"

      - name: Comment PR
        if: always()
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const health = JSON.parse(fs.readFileSync('health.json', 'utf8'));
            const deploy = JSON.parse(fs.readFileSync('deploy.json', 'utf8'));

            const comment = `## Deployment Safety Check

            **Health Status**: ${health.status === 'healthy' ? '✅' : '❌'} ${health.status}
            **Deploy Safety**: ${deploy.can_deploy ? '✅ Safe' : '❌ Not Safe'}

            ### Details
            - Error Rate: ${health.error_rate}%
            - Response Time: ${health.avg_response_time}ms
            - Active Alerts: ${deploy.active_alerts}
            `;

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.name,
              body: comment
            });
```

### GitLab CI: Automated Monitoring

**File**: `.gitlab-ci.yml`

```yaml
stages:
  - build
  - test
  - deploy
  - monitor

deploy:
  stage: deploy
  script:
    - echo "Deploying application..."
    - ./deploy.sh
  only:
    - main

monitor_deployment:
  stage: monitor
  image: alpine:latest
  before_script:
    - apk add --no-cache curl jq
    - curl -L https://github.com/your-org/datadog-cli/releases/latest/download/datadog-cli-linux-amd64 -o /usr/local/bin/dd
    - chmod +x /usr/local/bin/dd
  script:
    # Wait for deployment to propagate
    - sleep 60

    # Check for errors in last 5 minutes
    - |
      ERROR_COUNT=$(dd logs --service $SERVICE_NAME --status error --from 5m --json | jq '.total_count')
      if [ "$ERROR_COUNT" -gt 10 ]; then
        echo "❌ High error count after deployment: $ERROR_COUNT"
        exit 1
      fi

    # Check APM traces
    - |
      AVG_RESPONSE=$(dd apm --service $SERVICE_NAME --from 5m --json | jq '.avg_duration')
      if (( $(echo "$AVG_RESPONSE > 500" | bc -l) )); then
        echo "❌ High response time after deployment: ${AVG_RESPONSE}ms"
        exit 1
      fi

    - echo "✅ Deployment successful and healthy"
  only:
    - main
```

### Jenkins: Health Check Pipeline

**File**: `Jenkinsfile`

```groovy
pipeline {
    agent any

    environment {
        DD_API_KEY = credentials('datadog-api-key')
        DD_APP_KEY = credentials('datadog-app-key')
        SERVICE_NAME = 'my-service'
    }

    stages {
        stage('Install Datadog CLI') {
            steps {
                sh '''
                    curl -L https://github.com/your-org/datadog-cli/releases/latest/download/datadog-cli-linux-amd64 -o dd
                    chmod +x dd
                    sudo mv dd /usr/local/bin/
                '''
            }
        }

        stage('Pre-Deployment Checks') {
            steps {
                script {
                    // Health check
                    def healthStatus = sh(
                        script: "dd health --service ${SERVICE_NAME} --json | jq -r '.status'",
                        returnStdout: true
                    ).trim()

                    if (healthStatus != 'healthy') {
                        error("Service is not healthy: ${healthStatus}")
                    }

                    // Deploy safety check
                    def canDeploy = sh(
                        script: "dd deploy --service ${SERVICE_NAME} --json | jq -r '.can_deploy'",
                        returnStdout: true
                    ).trim()

                    if (canDeploy != 'true') {
                        error("Not safe to deploy")
                    }
                }
            }
        }

        stage('Deploy') {
            steps {
                sh './deploy.sh'
            }
        }

        stage('Post-Deployment Validation') {
            steps {
                script {
                    // Wait for deployment
                    sleep(time: 60, unit: 'SECONDS')

                    // Check for errors
                    def errorCount = sh(
                        script: "dd logs --service ${SERVICE_NAME} --status error --from 5m --json | jq '.total_count'",
                        returnStdout: true
                    ).trim() as Integer

                    if (errorCount > 10) {
                        error("High error count after deployment: ${errorCount}")
                    }

                    echo "✅ Deployment validated successfully"
                }
            }
        }
    }
}
```

---

## Deployment Safety Checks

### Bash Script: Pre-Deployment Validation

**File**: `scripts/pre-deploy-check.sh`

```bash
#!/bin/bash
set -euo pipefail

SERVICE_NAME="${1:-my-service}"
DURATION="${2:-1h}"

echo "🔍 Checking deployment safety for $SERVICE_NAME..."

# Check service health
echo "Checking service health..."
HEALTH_JSON=$(dd health --service "$SERVICE_NAME" --json)
HEALTH_STATUS=$(echo "$HEALTH_JSON" | jq -r '.status')

if [ "$HEALTH_STATUS" != "healthy" ]; then
    echo "❌ Service is not healthy: $HEALTH_STATUS"
    echo "$HEALTH_JSON" | jq '.'
    exit 1
fi
echo "✅ Service is healthy"

# Check for active incidents
echo "Checking for active incidents..."
INCIDENTS=$(dd incidents list --service "$SERVICE_NAME" --status active --json)
INCIDENT_COUNT=$(echo "$INCIDENTS" | jq '.incidents | length')

if [ "$INCIDENT_COUNT" -gt 0 ]; then
    echo "❌ Active incidents found: $INCIDENT_COUNT"
    echo "$INCIDENTS" | jq '.incidents[] | {title, severity, created}'
    exit 1
fi
echo "✅ No active incidents"

# Check error rate
echo "Checking error rate..."
ERROR_RATE=$(dd apm --service "$SERVICE_NAME" --from "$DURATION" --json | jq '.error_rate')

if (( $(echo "$ERROR_RATE > 5.0" | bc -l) )); then
    echo "❌ Error rate too high: ${ERROR_RATE}%"
    exit 1
fi
echo "✅ Error rate acceptable: ${ERROR_RATE}%"

# Check for recent alerts
echo "Checking for recent alerts..."
ALERTS=$(dd monitors list --service "$SERVICE_NAME" --status alert --json)
ALERT_COUNT=$(echo "$ALERTS" | jq '.monitors | length')

if [ "$ALERT_COUNT" -gt 0 ]; then
    echo "⚠️  Active alerts found: $ALERT_COUNT"
    echo "$ALERTS" | jq '.monitors[] | {name, status, message}'
    echo "Proceed with caution"
else
    echo "✅ No active alerts"
fi

# Final verdict
echo ""
echo "📊 Deployment Safety Summary:"
echo "  Health: $HEALTH_STATUS"
echo "  Error Rate: ${ERROR_RATE}%"
echo "  Incidents: $INCIDENT_COUNT"
echo "  Alerts: $ALERT_COUNT"
echo ""
echo "✅ Safe to deploy!"
```

**Usage**:
```bash
chmod +x scripts/pre-deploy-check.sh
./scripts/pre-deploy-check.sh my-service 2h
```

---

## Incident Response

### Slack Bot: Automated Incident Creation

**File**: `scripts/slack-to-datadog-incident.sh`

```bash
#!/bin/bash
# Triggered by Slack webhook when someone posts "@incident" in #alerts

set -euo pipefail

TITLE="${1}"
SERVICE="${2}"
SEVERITY="${3:-SEV-2}"
DESCRIPTION="${4:-Incident created from Slack}"

# Create incident in Datadog
INCIDENT_JSON=$(dd incidents create \
    --title "$TITLE" \
    --service "$SERVICE" \
    --severity "$SEVERITY" \
    --message "$DESCRIPTION" \
    --json)

INCIDENT_ID=$(echo "$INCIDENT_JSON" | jq -r '.incident_id')
INCIDENT_URL=$(echo "$INCIDENT_JSON" | jq -r '.public_url')

# Post back to Slack
curl -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{
        \"text\": \"🚨 Incident Created\",
        \"attachments\": [{
            \"color\": \"danger\",
            \"fields\": [
                {\"title\": \"ID\", \"value\": \"$INCIDENT_ID\", \"short\": true},
                {\"title\": \"Service\", \"value\": \"$SERVICE\", \"short\": true},
                {\"title\": \"Severity\", \"value\": \"$SEVERITY\", \"short\": true},
                {\"title\": \"URL\", \"value\": \"$INCIDENT_URL\", \"short\": false}
            ]
        }]
    }"

echo "✅ Incident created: $INCIDENT_ID"
echo "📎 URL: $INCIDENT_URL"
```

### Python: Automated Incident Triage

**File**: `scripts/incident-triage.py`

```python
#!/usr/bin/env python3
import subprocess
import json
import sys

def run_dd(command):
    """Run Datadog CLI command and return JSON output"""
    result = subprocess.run(
        f"dd {command} --json",
        shell=True,
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout)

def triage_incident(incident_id):
    """Automatically gather triage information for an incident"""

    # Get incident details
    incident = run_dd(f"incidents get --id {incident_id}")
    service = incident['service']

    print(f"🔍 Triaging incident {incident_id} for {service}")

    # Gather data
    print("\n📊 Gathering observability data...")

    # Recent errors
    errors = run_dd(f"logs --service {service} --status error --from 1h")
    print(f"  - Recent errors: {errors['total_count']}")

    # APM traces
    traces = run_dd(f"apm --service {service} --from 1h")
    print(f"  - Avg response time: {traces['avg_duration']}ms")
    print(f"  - Error rate: {traces['error_rate']}%")

    # Active monitors
    monitors = run_dd(f"monitors list --service {service} --status alert")
    print(f"  - Active alerts: {len(monitors['monitors'])}")

    # Security signals
    security = run_dd(f"security --service {service} --from 1h")
    print(f"  - Security signals: {security['total_count']}")

    # Update incident with findings
    summary = f"""
## Triage Summary

**Service**: {service}
**Recent Errors**: {errors['total_count']}
**Error Rate**: {traces['error_rate']}%
**Avg Response Time**: {traces['avg_duration']}ms
**Active Alerts**: {len(monitors['monitors'])}
**Security Signals**: {security['total_count']}

Generated automatically by incident-triage.py
"""

    subprocess.run(
        f'dd incidents update --id {incident_id} --message "{summary}"',
        shell=True
    )

    print("\n✅ Incident updated with triage data")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: ./incident-triage.py <incident_id>")
        sys.exit(1)

    triage_incident(sys.argv[1])
```

---

## Health Monitoring

### Cron Job: Continuous Health Monitoring

**File**: `scripts/health-monitor.sh`

```bash
#!/bin/bash
# Add to crontab: */5 * * * * /path/to/health-monitor.sh

set -euo pipefail

SERVICES=("api" "web" "worker" "database")
ALERT_THRESHOLD=3  # Alert if health check fails 3 times in a row

for SERVICE in "${SERVICES[@]}"; do
    echo "Checking health for $SERVICE..."

    # Check health
    HEALTH_JSON=$(dd health --service "$SERVICE" --json 2>&1)

    if [ $? -ne 0 ]; then
        echo "❌ Failed to check health for $SERVICE"
        continue
    fi

    STATUS=$(echo "$HEALTH_JSON" | jq -r '.status')

    if [ "$STATUS" != "healthy" ]; then
        # Increment failure counter
        COUNTER_FILE="/tmp/health-${SERVICE}-failures"
        if [ -f "$COUNTER_FILE" ]; then
            FAILURES=$(cat "$COUNTER_FILE")
            FAILURES=$((FAILURES + 1))
        else
            FAILURES=1
        fi
        echo "$FAILURES" > "$COUNTER_FILE"

        echo "⚠️  $SERVICE is $STATUS (failure $FAILURES/$ALERT_THRESHOLD)"

        # Alert if threshold reached
        if [ "$FAILURES" -ge "$ALERT_THRESHOLD" ]; then
            echo "🚨 Creating incident for $SERVICE"
            dd incidents create \
                --title "$SERVICE health degraded" \
                --service "$SERVICE" \
                --severity SEV-2 \
                --message "Health check failed $FAILURES times: $STATUS"

            # Reset counter
            rm "$COUNTER_FILE"
        fi
    else
        # Reset failure counter on success
        rm -f "/tmp/health-${SERVICE}-failures"
        echo "✅ $SERVICE is healthy"
    fi
done
```

---

## Cost Tracking

### Weekly Cost Report

**File**: `scripts/weekly-cost-report.sh`

```bash
#!/bin/bash
# Run weekly to track Datadog usage costs

set -euo pipefail

REPORT_FILE="cost-report-$(date +%Y-%m-%d).json"

echo "📊 Generating weekly cost report..."

# Get cost data
dd cost --duration 7d --breakdown all --json > "$REPORT_FILE"

# Parse and summarize
TOTAL_COST=$(jq '.total_cost' "$REPORT_FILE")
TOP_SERVICE=$(jq -r '.by_service[0].name' "$REPORT_FILE")
TOP_SERVICE_COST=$(jq '.by_service[0].cost' "$REPORT_FILE")

# Generate email report
cat > "cost-report.html" <<EOF
<html>
<body>
<h2>Weekly Datadog Cost Report</h2>
<p><strong>Period:</strong> Last 7 days</p>
<p><strong>Total Cost:</strong> \$$TOTAL_COST</p>
<p><strong>Top Service:</strong> $TOP_SERVICE (\$$TOP_SERVICE_COST)</p>

<h3>Cost Breakdown</h3>
<pre>
$(jq -r '.by_service[] | "\(.name): $\(.cost)"' "$REPORT_FILE")
</pre>

<h3>Recommendations</h3>
$(jq -r '.recommendations[]' "$REPORT_FILE")

</body>
</html>
EOF

# Send email (using sendmail or similar)
echo "✅ Report generated: $REPORT_FILE"
```

---

## Best Practices

### Error Handling

Always check exit codes and parse JSON carefully:

```bash
#!/bin/bash
set -euo pipefail

# Good: Check exit code
if dd health --service my-service --json > health.json; then
    STATUS=$(jq -r '.status' health.json)
    echo "Health: $STATUS"
else
    echo "❌ Failed to check health"
    exit 1
fi

# Good: Validate JSON
if ! jq -e '.status' health.json > /dev/null; then
    echo "❌ Invalid JSON response"
    exit 1
fi
```

### Logging

Log all automation actions for auditing:

```bash
# Log to file
exec > >(tee -a "/var/log/datadog-automation.log")
exec 2>&1

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting deployment check..."
```

### Secrets Management

Never hardcode API keys:

```bash
# Good: Use environment variables
export DD_API_KEY="$( cat /secrets/dd-api-key)"
export DD_APP_KEY="$(cat /secrets/dd-app-key)"

# Good: Use secrets manager
DD_API_KEY=$(aws secretsmanager get-secret-value --secret-id dd-api-key --query SecretString --output text)
```

---

## Resources

- [Datadog CLI Documentation](../../README.md)
- [CI/CD Integration Guide](../../docs/CICD.md)
- [Incident Management Guide](../../docs/INCIDENTS.md)

---

**Created**: January 22, 2026
**Examples**: CI/CD, Deployment, Incidents, Monitoring, Cost
