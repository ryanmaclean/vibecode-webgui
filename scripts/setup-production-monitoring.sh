#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


# Production Monitoring and Alerting Setup
# Configures comprehensive monitoring, alerting, and observability
# Staff Engineer Implementation - Enterprise monitoring automation

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MONITORING_LOG="$PROJECT_ROOT/monitoring-setup.log"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$MONITORING_LOG"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$MONITORING_LOG"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$MONITORING_LOG"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$MONITORING_LOG"
}

show_banner() {
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════╗
║              Production Monitoring Setup                    ║
║                                                              ║
║  📊 Datadog integration and dashboards                      ║
║  🚨 Alerting and notification setup                         ║
║  📈 Performance monitoring and SLIs                         ║
║  🔍 Log aggregation and analysis                            ║
║  ⚡ Real-time metrics and observability                     ║
╚══════════════════════════════════════════════════════════════╝
EOF
}

# Create Datadog dashboard configuration
create_datadog_dashboards() {
    log "📊 Creating Datadog dashboard configurations..."
    
    mkdir -p "$PROJECT_ROOT/monitoring/datadog"
    
    # Main application dashboard
    cat << 'EOF' > "$PROJECT_ROOT/monitoring/datadog/application-dashboard.json"
{
  "title": "VibeCode WebGUI - Production Dashboard",
  "description": "Comprehensive monitoring dashboard for VibeCode WebGUI application",
  "widgets": [
    {
      "id": 1,
      "definition": {
        "title": "Application Health Overview",
        "type": "query_value",
        "requests": [
          {
            "q": "avg:vibecode.health.status{env:production}",
            "aggregator": "avg"
          }
        ],
        "precision": 0
      },
      "layout": {
        "x": 0,
        "y": 0,
        "width": 4,
        "height": 2
      }
    },
    {
      "id": 2,
      "definition": {
        "title": "Request Rate (req/min)",
        "type": "timeseries",
        "requests": [
          {
            "q": "sum:vibecode.http.requests{env:production}.as_rate()",
            "display_type": "line"
          }
        ]
      },
      "layout": {
        "x": 4,
        "y": 0,
        "width": 8,
        "height": 4
      }
    },
    {
      "id": 3,
      "definition": {
        "title": "Response Time (p95)",
        "type": "timeseries",
        "requests": [
          {
            "q": "p95:vibecode.http.response_time{env:production}",
            "display_type": "line"
          }
        ]
      },
      "layout": {
        "x": 0,
        "y": 4,
        "width": 6,
        "height": 4
      }
    },
    {
      "id": 4,
      "definition": {
        "title": "Error Rate (%)",
        "type": "timeseries",
        "requests": [
          {
            "q": "sum:vibecode.http.errors{env:production}.as_rate() / sum:vibecode.http.requests{env:production}.as_rate() * 100",
            "display_type": "line"
          }
        ]
      },
      "layout": {
        "x": 6,
        "y": 4,
        "width": 6,
        "height": 4
      }
    },
    {
      "id": 5,
      "definition": {
        "title": "Database Performance",
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:vibecode.db.query.duration{env:production}",
            "display_type": "line"
          }
        ]
      },
      "layout": {
        "x": 0,
        "y": 8,
        "width": 6,
        "height": 4
      }
    },
    {
      "id": 6,
      "definition": {
        "title": "Cache Hit Rate (%)",
        "type": "query_value",
        "requests": [
          {
            "q": "avg:vibecode.cache.hit_rate{env:production} * 100",
            "aggregator": "avg"
          }
        ],
        "precision": 1
      },
      "layout": {
        "x": 6,
        "y": 8,
        "width": 6,
        "height": 4
      }
    }
  ],
  "layout_type": "ordered",
  "is_read_only": false,
  "notify_list": [],
  "reflow_type": "fixed"
}
EOF

    # Infrastructure dashboard
    cat << 'EOF' > "$PROJECT_ROOT/monitoring/datadog/infrastructure-dashboard.json"
{
  "title": "VibeCode WebGUI - Infrastructure Dashboard",
  "description": "Infrastructure and resource monitoring for VibeCode WebGUI",
  "widgets": [
    {
      "id": 1,
      "definition": {
        "title": "CPU Usage (%)",
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:system.cpu.user{service:vibecode-webgui,env:production}",
            "display_type": "line"
          }
        ]
      },
      "layout": {
        "x": 0,
        "y": 0,
        "width": 6,
        "height": 4
      }
    },
    {
      "id": 2,
      "definition": {
        "title": "Memory Usage (MB)",
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:system.mem.used{service:vibecode-webgui,env:production}",
            "display_type": "line"
          }
        ]
      },
      "layout": {
        "x": 6,
        "y": 0,
        "width": 6,
        "height": 4
      }
    },
    {
      "id": 3,
      "definition": {
        "title": "Disk I/O",
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:system.io.r_s{service:vibecode-webgui,env:production}, avg:system.io.w_s{service:vibecode-webgui,env:production}",
            "display_type": "line"
          }
        ]
      },
      "layout": {
        "x": 0,
        "y": 4,
        "width": 12,
        "height": 4
      }
    }
  ],
  "layout_type": "ordered"
}
EOF

    log "✅ Datadog dashboard configurations created"
}

# Create alerting rules
create_alerting_rules() {
    log "🚨 Creating alerting rules..."
    
    mkdir -p "$PROJECT_ROOT/monitoring/alerts"
    
    # Critical alerts
    cat << 'EOF' > "$PROJECT_ROOT/monitoring/alerts/critical-alerts.yaml"
# Critical Production Alerts for VibeCode WebGUI

alerts:
  - name: "High Error Rate"
    description: "Error rate is above 5% for 5 minutes"
    query: "sum:vibecode.http.errors{env:production}.as_rate() / sum:vibecode.http.requests{env:production}.as_rate() * 100 > 5"
    threshold: 5
    evaluation_delay: 300
    notify:
      - "@slack-critical-alerts"
      - "@pagerduty-oncall"
    tags:
      - "severity:critical"
      - "service:vibecode-webgui"

  - name: "High Response Time"
    description: "95th percentile response time is above 2 seconds"
    query: "p95:vibecode.http.response_time{env:production} > 2000"
    threshold: 2000
    evaluation_delay: 300
    notify:
      - "@slack-performance-alerts"
    tags:
      - "severity:warning"
      - "service:vibecode-webgui"

  - name: "Database Connection Issues"
    description: "Database connection pool exhaustion"
    query: "avg:vibecode.db.connections.active{env:production} / avg:vibecode.db.connections.max{env:production} * 100 > 90"
    threshold: 90
    evaluation_delay: 180
    notify:
      - "@slack-critical-alerts"
      - "@pagerduty-oncall"
    tags:
      - "severity:critical"
      - "service:database"

  - name: "Memory Usage High"
    description: "Memory usage is above 85%"
    query: "avg:system.mem.pct_usable{service:vibecode-webgui,env:production} < 15"
    threshold: 15
    evaluation_delay: 600
    notify:
      - "@slack-infrastructure-alerts"
    tags:
      - "severity:warning"
      - "service:infrastructure"

  - name: "Cache Hit Rate Low"
    description: "Cache hit rate is below 80%"
    query: "avg:vibecode.cache.hit_rate{env:production} < 0.8"
    threshold: 0.8
    evaluation_delay: 900
    notify:
      - "@slack-performance-alerts"
    tags:
      - "severity:warning"
      - "service:cache"
EOF

    log "✅ Alerting rules created"
}

# Create monitoring configuration
create_monitoring_config() {
    log "⚙️ Creating monitoring configuration..."
    
    cat << 'EOF' > "$PROJECT_ROOT/monitoring/monitoring-config.yaml"
# Production Monitoring Configuration

monitoring:
  datadog:
    api_key: "${DD_API_KEY}"
    app_key: "${DD_APP_KEY}"
    site: "datadoghq.com"
    service: "vibecode-webgui"
    environment: "production"
    version: "1.0.0"
    
    # APM Configuration
    apm:
      enabled: true
      sample_rate: 1.0
      
    # Log Configuration
    logs:
      enabled: true
      level: "info"
      format: "json"
      
    # Metrics Configuration
    metrics:
      enabled: true
      histogram_percentiles: [0.5, 0.75, 0.95, 0.99]
      
  # Health Checks
  health_checks:
    - name: "application"
      endpoint: "/api/health"
      interval: 30
      timeout: 5
      
    - name: "database"
      endpoint: "/api/health/database"
      interval: 60
      timeout: 10
      
    - name: "cache"
      endpoint: "/api/health/cache"
      interval: 60
      timeout: 5

  # SLIs (Service Level Indicators)
  slis:
    availability:
      target: 99.9
      measurement: "uptime"
      
    latency:
      target: 500  # milliseconds
      measurement: "p95_response_time"
      
    error_rate:
      target: 1  # percent
      measurement: "error_percentage"

  # Notification Channels
  notifications:
    slack:
      critical_channel: "#alerts-critical"
      warning_channel: "#alerts-warning"
      info_channel: "#monitoring"
      
    email:
      critical_recipients:
        - "oncall@company.com"
        - "engineering-leads@company.com"
      warning_recipients:
        - "engineering@company.com"
EOF

    log "✅ Monitoring configuration created"
}

# Create log aggregation setup
create_log_aggregation() {
    log "📝 Setting up log aggregation..."
    
    mkdir -p "$PROJECT_ROOT/monitoring/logs"
    
    cat << 'EOF' > "$PROJECT_ROOT/monitoring/logs/logstash.conf"
# Logstash configuration for VibeCode WebGUI logs

input {
  beats {
    port => 5044
  }
  
  file {
    path => "/app/logs/*.log"
    start_position => "beginning"
    codec => "json"
  }
}

filter {
  if [service] == "vibecode-webgui" {
    # Parse application logs
    json {
      source => "message"
    }
    
    # Add environment information
    mutate {
      add_field => { "environment" => "production" }
      add_field => { "application" => "vibecode-webgui" }
    }
    
    # Parse timestamp
    date {
      match => [ "timestamp", "ISO8601" ]
    }
    
    # Classify log levels
    if [level] == "error" {
      mutate {
        add_tag => [ "error", "alert" ]
      }
    }
  }
}

output {
  # Send to Datadog
  datadog_logs {
    api_key => "${DD_API_KEY}"
    host => "http-intake.logs.datadoghq.com"
  }
  
  # Send to Elasticsearch for local analysis
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "vibecode-logs-%{+YYYY.MM.dd}"
  }
  
  # Debug output
  stdout {
    codec => rubydebug
  }
}
EOF

    log "✅ Log aggregation configuration created"
}

# Create performance monitoring scripts
create_performance_monitoring() {
    log "📈 Creating performance monitoring scripts..."
    
    mkdir -p "$PROJECT_ROOT/monitoring/scripts"
    
    cat << 'EOF' > "$PROJECT_ROOT/monitoring/scripts/performance-check.sh"
#!/bin/bash

# Performance monitoring script
# Runs performance checks and reports metrics

set -euo pipefail

ENDPOINT="${1:-http://localhost:3000}"
RESULTS_FILE="/tmp/performance-results.json"

echo "Running performance checks against $ENDPOINT..."

# Check response time
response_time=$(curl -w "%{time_total}" -s -o /dev/null "$ENDPOINT/api/health")
echo "Response time: ${response_time}s"

# Check database performance
db_response_time=$(curl -w "%{time_total}" -s -o /dev/null "$ENDPOINT/api/health/database")
echo "Database response time: ${db_response_time}s"

# Check cache performance
cache_response_time=$(curl -w "%{time_total}" -s -o /dev/null "$ENDPOINT/api/health/cache")
echo "Cache response time: ${cache_response_time}s"

# Generate JSON report
cat << EOJ > "$RESULTS_FILE"
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "endpoint": "$ENDPOINT",
  "metrics": {
    "response_time": $response_time,
    "database_response_time": $db_response_time,
    "cache_response_time": $cache_response_time
  }
}
EOJ

echo "Performance results saved to $RESULTS_FILE"
EOF

    chmod +x "$PROJECT_ROOT/monitoring/scripts/performance-check.sh"
    
    log "✅ Performance monitoring scripts created"
}

# Create deployment verification script
create_deployment_verification() {
    log "✅ Creating deployment verification script..."
    
    cat << 'EOF' > "$PROJECT_ROOT/scripts/verify-deployment.sh"
#!/bin/bash

# Deployment Verification Script
# Verifies that deployment is healthy and functioning

set -euo pipefail

ENDPOINT="${1:-http://localhost:3000}"
MAX_RETRIES=30
RETRY_INTERVAL=10

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Wait for application to be ready
wait_for_app() {
    local retries=0
    
    log "Waiting for application to be ready at $ENDPOINT..."
    
    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -f -s "$ENDPOINT/api/health" > /dev/null; then
            log "✅ Application is ready!"
            return 0
        fi
        
        retries=$((retries + 1))
        log "Attempt $retries/$MAX_RETRIES failed, retrying in ${RETRY_INTERVAL}s..."
        sleep $RETRY_INTERVAL
    done
    
    log "❌ Application failed to become ready after $MAX_RETRIES attempts"
    return 1
}

# Run health checks
run_health_checks() {
    log "Running comprehensive health checks..."
    
    # Basic health check
    if ! curl -f -s "$ENDPOINT/api/health" | grep -q '"status":"ok"'; then
        log "❌ Basic health check failed"
        return 1
    fi
    log "✅ Basic health check passed"
    
    # Database health check
    if ! curl -f -s "$ENDPOINT/api/health/database" | grep -q '"status":"ok"'; then
        log "❌ Database health check failed"
        return 1
    fi
    log "✅ Database health check passed"
    
    # Cache health check
    if ! curl -f -s "$ENDPOINT/api/health/cache" | grep -q '"status":"ok"'; then
        log "❌ Cache health check failed"
        return 1
    fi
    log "✅ Cache health check passed"
    
    log "✅ All health checks passed!"
    return 0
}

# Main verification
main() {
    log "🚀 Starting deployment verification for $ENDPOINT"
    
    if wait_for_app && run_health_checks; then
        log "🎉 Deployment verification successful!"
        return 0
    else
        log "💥 Deployment verification failed!"
        return 1
    fi
}

main "$@"
EOF

    chmod +x "$PROJECT_ROOT/scripts/verify-deployment.sh"
    
    log "✅ Deployment verification script created"
}

# Generate monitoring setup report
generate_monitoring_report() {
    log "📊 Generating monitoring setup report..."
    
    cat << EOF > "$PROJECT_ROOT/monitoring-setup-report.md"
# Production Monitoring Setup Report

Generated on: $(date)

## Components Configured

### ✅ Datadog Integration
- Application dashboard configuration
- Infrastructure dashboard configuration
- APM (Application Performance Monitoring) setup
- Log aggregation and analysis

### ✅ Alerting System
- Critical alerts for error rates and response times
- Infrastructure alerts for resource usage
- Database performance monitoring
- Cache performance tracking

### ✅ Health Checks
- Application health endpoint monitoring
- Database connectivity checks
- Cache availability verification
- Automated deployment verification

### ✅ Performance Monitoring
- Response time tracking
- Database query performance
- Cache hit rate monitoring
- Resource utilization metrics

## Configuration Files Created

### Datadog Dashboards
- \`monitoring/datadog/application-dashboard.json\`
- \`monitoring/datadog/infrastructure-dashboard.json\`

### Alerting Configuration
- \`monitoring/alerts/critical-alerts.yaml\`

### Monitoring Configuration
- \`monitoring/monitoring-config.yaml\`
- \`monitoring/logs/logstash.conf\`

### Scripts
- \`monitoring/scripts/performance-check.sh\`
- \`scripts/verify-deployment.sh\`

## Next Steps

1. **Configure Datadog Account**
   - Set up DD_API_KEY and DD_APP_KEY environment variables
   - Import dashboard configurations
   - Set up notification channels

2. **Deploy Monitoring Infrastructure**
   - Deploy log aggregation stack
   - Configure alerting rules
   - Set up notification integrations

3. **Test Monitoring**
   - Run performance checks
   - Verify alert functionality
   - Test deployment verification

4. **Set Up SLOs (Service Level Objectives)**
   - Define availability targets (99.9%)
   - Set latency targets (p95 < 500ms)
   - Establish error rate thresholds (<1%)

## Monitoring URLs
- Application Dashboard: https://app.datadoghq.com/dashboard/[dashboard-id]
- Infrastructure Dashboard: https://app.datadoghq.com/dashboard/[dashboard-id]
- Log Explorer: https://app.datadoghq.com/logs
- APM Traces: https://app.datadoghq.com/apm/traces

## Support Contacts
- On-call Engineer: oncall@company.com
- Engineering Team: engineering@company.com
- Monitoring Issues: monitoring@company.com

EOF
    
    log "✅ Monitoring setup report saved to monitoring-setup-report.md"
}

# Main execution
main() {
    show_banner
    
    log "🚀 Setting up production monitoring..."
    
    create_datadog_dashboards
    create_alerting_rules
    create_monitoring_config
    create_log_aggregation
    create_performance_monitoring
    create_deployment_verification
    generate_monitoring_report
    
    log "✅ Production monitoring setup completed!"
    log "📄 Check monitoring-setup-report.md for detailed configuration"
    log "🔧 Configure Datadog credentials and deploy monitoring stack"
}

# Run main function
main "$@"
