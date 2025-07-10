# VibeCode WebGUI - Production Runbooks
## Staff Engineer Documentation | Datadog | July 2025

This directory contains operational runbooks for incident response, troubleshooting, and maintenance procedures for the VibeCode WebGUI platform.

## 📚 Available Runbooks

### Critical Incidents
- [Service Down](./service-down.md) - Complete service outage response
- [High Error Rate](./high-error-rate.md) - Elevated 5xx error responses
- [Database Issues](./database-issues.md) - PostgreSQL connection and performance problems
- [Security Incident](./security-incident.md) - Security breach or vulnerability response

### Performance Issues
- [High Latency](./high-latency.md) - API response time degradation
- [High Memory Usage](./high-memory.md) - Memory consumption issues
- [CPU Throttling](./cpu-throttling.md) - High CPU utilization
- [Database Connection Pool](./db-connections.md) - Connection pool exhaustion

### Data & AI Issues
- [AI Model Performance](./ai-model-performance.md) - Code suggestion quality degradation
- [Data Pipeline Issues](./data-pipeline-issues.md) - Metaplane data observability alerts
- [Data Quality Failures](./data-quality.md) - Data quality check failures

### Infrastructure Issues
- [Container Issues](./container-issues.md) - Docker/Kubernetes container problems
- [Network Issues](./network-issues.md) - Network connectivity problems
- [Storage Issues](./storage-issues.md) - Persistent volume and storage problems

### Monitoring & Alerting
- [Alert Fatigue](./alert-fatigue.md) - Managing noisy alerts
- [Monitoring System Down](./monitoring-down.md) - Datadog or monitoring issues
- [SLO Breach](./slo-breach.md) - Service level objective violations

## 🚨 Incident Response Process

### Severity Levels

| Severity | Description | Response Time | Escalation |
|----------|-------------|---------------|------------|
| **P0 - Critical** | Complete outage, data loss, security breach | 15 minutes | Immediate PagerDuty |
| **P1 - High** | Major functionality impaired, significant user impact | 1 hour | Slack + Email |
| **P2 - Medium** | Minor functionality impaired, limited user impact | 4 hours | Slack |
| **P3 - Low** | Cosmetic issues, no user impact | 24 hours | JIRA ticket |

### Response Team Contacts

```yaml
# On-Call Rotation
primary_oncall: "@platform-oncall"
secondary_oncall: "@senior-platform-oncall"

# Team Contacts
platform_team: "@platform-team"
data_team: "@data-engineering"
ai_team: "@ai-ml-team"
security_team: "@security-team"

# Escalation Contacts
engineering_manager: "@john.doe"
staff_engineer: "@jane.smith"
director: "@mike.johnson"

# External Contacts
datadog_support: "support@datadoghq.com"
fly_io_support: "support@fly.io"
```

### Incident Communication

1. **Create Incident Channel**: `#incident-YYYY-MM-DD-brief-description`
2. **Initial Update**: Post to `#alerts` within 15 minutes
3. **Status Updates**: Every 30 minutes during active incident
4. **Stakeholder Updates**: Every hour to `#engineering-leadership`
5. **Post-Mortem**: Within 48 hours of resolution

## 🔧 Common Tools & Commands

### Datadog Queries

```bash
# High-level service health
service:vibecode-webgui status:error

# Error rate by endpoint
sum:http.request.errors{service:vibecode-webgui} by {endpoint}

# P95 latency trending
p95:http.request.duration{service:vibecode-webgui}

# Database connection pool
avg:postgres.connections.active{service:vibecode-webgui}

# Memory usage
avg:system.mem.pct_usable{service:vibecode-webgui}
```

### Kubernetes Commands

```bash
# Check pod status
kubectl get pods -n vibecode-webgui

# View pod logs
kubectl logs -f deployment/vibecode-webgui -n vibecode-webgui

# Describe problematic pod
kubectl describe pod <pod-name> -n vibecode-webgui

# Check resource usage
kubectl top pods -n vibecode-webgui

# Scale deployment
kubectl scale deployment vibecode-webgui --replicas=5 -n vibecode-webgui
```

### Docker Commands

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f web

# Restart service
docker-compose restart web

# Check resource usage
docker stats

# Access container shell
docker exec -it vibecode-webgui-web-1 /bin/sh
```

### Database Commands

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Long running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';

-- Database size
SELECT pg_size_pretty(pg_database_size('vibecode_dev'));

-- Kill long-running query
SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '10 minutes';
```

### Application Health Checks

```bash
# Main application health
curl -s http://localhost:3000/api/monitoring/health | jq

# WebSocket server health  
curl -s http://localhost:3001/health | jq

# Database connectivity
curl -s http://localhost:3000/api/monitoring/health | jq '.checks.database'

# Redis connectivity
curl -s http://localhost:3000/api/monitoring/health | jq '.checks.redis'

# Datadog integration
curl -s http://localhost:3000/api/monitoring/health | jq '.checks.datadog'
```

## 📊 Key Metrics & Dashboards

### Primary Dashboards
- [Service Overview](https://app.datadoghq.com/dashboard/vibecode-overview)
- [Infrastructure Metrics](https://app.datadoghq.com/dashboard/vibecode-infrastructure)  
- [Application Performance](https://app.datadoghq.com/dashboard/vibecode-apm)
- [Error Tracking](https://app.datadoghq.com/dashboard/vibecode-errors)
- [Data Observability](https://app.datadoghq.com/dashboard/vibecode-data)

### Key SLIs to Monitor
- **Availability**: > 99.9% (target)
- **Latency P95**: < 300ms (target)
- **Error Rate**: < 0.1% (target)
- **Data Freshness**: < 5 minutes (target)

### Alert Thresholds
- **Critical**: Service down, error rate > 1%, latency > 1s
- **Warning**: Error rate > 0.1%, latency > 500ms, memory > 80%

## 🔐 Security Procedures

### Security Incident Response
1. **Immediate**: Isolate affected systems
2. **Assessment**: Determine scope and impact
3. **Containment**: Stop the attack/breach
4. **Eradication**: Remove threats and vulnerabilities
5. **Recovery**: Restore systems and monitor
6. **Lessons Learned**: Post-incident review

### Emergency Contacts
- **Security Team**: security@vibecode.dev
- **Legal Team**: legal@vibecode.dev  
- **External Security**: security-incident@datadog.com

## 📞 Emergency Procedures

### Complete Service Outage
1. Check Datadog service dashboard
2. Verify Fly.io status page
3. Check database connectivity
4. Scale up infrastructure if needed
5. Activate incident response process

### Data Breach Suspected
1. Immediately notify security team
2. Preserve logs and evidence
3. Isolate affected systems
4. Begin incident response protocol
5. Prepare external communications

### Performance Degradation
1. Check infrastructure metrics
2. Review recent deployments
3. Scale resources if needed
4. Investigate database performance
5. Review application logs

## 📋 Post-Incident Procedures

### Post-Mortem Template
1. **Timeline**: Detailed incident timeline
2. **Impact**: User and business impact
3. **Root Cause**: Technical root cause analysis
4. **Response**: What went well and what didn't
5. **Action Items**: Concrete follow-up tasks
6. **Prevention**: How to prevent recurrence

### Follow-up Actions
- Update runbooks based on lessons learned
- Improve monitoring and alerting
- Enhance testing procedures
- Update documentation
- Share learnings with team

---

**Remember**: When in doubt, escalate early. It's better to involve too many people than to let an incident grow worse.