# Production Operations Documentation

**Document Owner**: SRE Team
**Last Updated**: 2025-10-02
**Version**: 1.0.0

## Overview

This directory contains comprehensive production deployment and operations documentation for the VibeCode platform. These documents are designed for SREs, on-call engineers, and platform operators managing production infrastructure.

## Document Index

### Core Operations Guides

1. **[DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md)**
   - Pre-deployment checklists (security, testing, backups)
   - Standard rolling deployment procedures
   - Blue-green deployment strategy (zero-downtime)
   - Canary release procedures (progressive rollout)
   - Rollback procedures (automated and manual)
   - Post-deployment validation and smoke tests

2. **[OPERATIONS_GUIDE.md](./OPERATIONS_GUIDE.md)**
   - Daily operations and health checks
   - Weekly maintenance windows
   - Monthly capacity and security reviews
   - Monitoring dashboard usage (Datadog, Prometheus, Grafana)
   - Backup and restore procedures
   - Certificate management
   - Access control and RBAC

3. **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**
   - Common issues by component (WebGUI, Agent API, Database, Redis)
   - Log analysis and structured queries
   - Performance debugging (CPU, memory, database)
   - Network troubleshooting (connectivity, DNS, TLS)
   - Container debugging (startup failures, resource constraints)
   - Database issues (connections, replication, corruption)
   - Security incident response

4. **[ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)**
   - System architecture diagrams
   - Component responsibilities and deployment specs
   - Data flow diagrams (request flow, WebSocket, agent execution)
   - Integration points (external APIs, internal services)
   - Security architecture (authentication, secrets management)
   - Scalability and reliability (HA, autoscaling, disaster recovery)

5. **[INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)**
   - Incident severity levels (P1-P4)
   - Detection and triage procedures
   - Response procedures by incident type
   - Communication protocols (internal and external)
   - Post-incident review and blameless post-mortems
   - Continuous improvement tracking

## Quick Start Guide

### For New On-Call Engineers

**First Week Checklist**:
- [ ] Read [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md) to understand system design
- [ ] Review [OPERATIONS_GUIDE.md](./OPERATIONS_GUIDE.md) for daily procedures
- [ ] Familiarize with [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues
- [ ] Shadow existing on-call engineer for 2-3 incidents
- [ ] Complete [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) training
- [ ] Set up Datadog, PagerDuty, and Slack notifications
- [ ] Verify access to Kubernetes clusters and Azure portal
- [ ] Practice deployment rollback in staging environment

**Essential Tools**:
```bash
# Install required tools
brew install kubectl helm azure-cli

# Configure kubectl context
kubectl config use-context vibecode-production

# Verify access
kubectl get pods -n vibecode
helm list -n vibecode

# Test monitoring access
open "https://app.datadoghq.com/dashboard/production-overview"
```

### For Deployment Engineers

**Pre-Deployment**:
1. Review [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) - Pre-Deployment Checklist
2. Run security scans and tests
3. Create backup of production database
4. Notify stakeholders in #deployments channel

**During Deployment**:
1. Follow [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) - Deployment Procedures
2. Monitor Datadog dashboard for metrics
3. Provide status updates every 10 minutes
4. Execute smoke tests post-deployment

**Post-Deployment**:
1. Complete [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) - Post-Deployment Validation
2. Monitor for 30 minutes before closing
3. Document deployment summary
4. Update version in status page

## Emergency Response

### P1 Incident (Complete Outage)

**Immediate Actions** (first 5 minutes):
```bash
# 1. Verify outage
curl -f https://vibecode.eastus2.cloudapp.azure.com/api/health

# 2. Check cluster status
kubectl get nodes
kubectl get pods -n vibecode

# 3. Check recent changes
helm history vibecode -n vibecode

# 4. Declare incident
slack-notify --channel "#incidents" --urgent "🚨 P1 INCIDENT: Service down"

# 5. Rollback if recent deployment
helm rollback vibecode -n vibecode --wait

# 6. Follow INCIDENT_RESPONSE.md for detailed procedures
```

**Full Procedure**: See [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) - P1: Complete Service Outage

### P1 Incident (Data Loss)

**Immediate Actions**:
```bash
# 1. Stop writes
kubectl scale deployment vibecode-webgui -n vibecode --replicas=0

# 2. Take snapshot
kubectl exec -n vibecode postgres-0 -- pg_dump -U vibecode vibecode_db > emergency-backup.sql

# 3. Follow INCIDENT_RESPONSE.md for data recovery procedures
```

## Common Operations

### Scaling Application

**Manual Scaling**:
```bash
# Scale up for traffic spike
kubectl scale deployment vibecode-webgui -n vibecode --replicas=15

# Verify scaling
kubectl get pods -n vibecode -w
```

**Autoscaling Configuration**:
See [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md) - Horizontal Pod Autoscaler

### Database Maintenance

**Weekly Maintenance** (Sunday 2:00 AM UTC):
```bash
# Run maintenance tasks
kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "VACUUM ANALYZE;"

# Check database health
kubectl exec -n vibecode postgres-0 -- pg_isready
```

**Full Procedure**: See [OPERATIONS_GUIDE.md](./OPERATIONS_GUIDE.md) - Weekly Maintenance

### Certificate Renewal

**Check Certificate Status**:
```bash
# List all certificates
kubectl get certificate -n vibecode

# Check expiration
echo | openssl s_client -connect vibecode.eastus2.cloudapp.azure.com:443 2>/dev/null | openssl x509 -noout -dates
```

**Manual Renewal**:
See [OPERATIONS_GUIDE.md](./OPERATIONS_GUIDE.md) - Certificate Management

## Monitoring Dashboards

### Datadog Dashboards

1. **Production Overview**
   - URL: https://app.datadoghq.com/dashboard/production-overview
   - Metrics: Request rate, error rate, latency, pod health
   - Use for: Daily health checks, incident triage

2. **Database Performance**
   - URL: https://app.datadoghq.com/dashboard/database-performance
   - Metrics: Query latency, connection pool, slow queries
   - Use for: Database troubleshooting, performance tuning

3. **Infrastructure Health**
   - URL: https://app.datadoghq.com/dashboard/infrastructure-health
   - Metrics: Node resources, disk usage, network throughput
   - Use for: Capacity planning, infrastructure issues

4. **User Experience**
   - URL: https://app.datadoghq.com/dashboard/user-experience
   - Metrics: Core Web Vitals, page load times, errors
   - Use for: Performance optimization, user impact analysis

### Alert Thresholds

| Alert | Threshold | Severity | Response Time |
|-------|-----------|----------|---------------|
| Service Down | 5 consecutive failures | P1 | <15 minutes |
| High Error Rate | >10% for 5 minutes | P1 | <15 minutes |
| Error Rate | 5-10% for 10 minutes | P2 | <1 hour |
| High Latency | P95 >2000ms for 10 minutes | P2 | <1 hour |
| Certificate Expiring | <30 days | P3 | <4 hours |

## Key Metrics and SLIs

### Service Level Indicators (SLIs)

**Availability**:
- Target: 99.9% uptime
- Measurement: Percentage of successful health checks
- Acceptable downtime: 43.8 minutes per month

**Performance**:
- Target: P95 latency <1000ms
- Measurement: 95th percentile response time
- Acceptable: <5% requests exceed threshold

**Error Rate**:
- Target: <0.5% error rate
- Measurement: Percentage of 5xx responses
- Acceptable: <100 errors per 10,000 requests

### Error Budget

**Monthly Error Budget**:
- Total requests: ~100M/month
- Allowed errors: 500K (0.5%)
- Current usage: Track in Datadog SLO dashboard

**Policy**:
- <50% consumed: Normal deployment cadence
- 50-75% consumed: Slow down deployments, focus on reliability
- >75% consumed: Deployment freeze, fix reliability issues
- 100% consumed: Post-mortem required, leadership approval for deploys

## Contact Information

### On-Call Rotation

**Primary On-Call**: PagerDuty rotation
- Slack: #on-call
- Phone: Auto-paged via PagerDuty

**Backup On-Call**: PagerDuty rotation
- Escalation after 15 minutes

### Escalation

1. **Engineering Manager**: [Name] - [Contact]
2. **VP Engineering**: [Name] - [Contact]
3. **CTO**: [Name] - [Contact]

### External Support

- **Azure Support**: [Portal URL]
- **Datadog Support**: support@datadoghq.com
- **PostgreSQL Support**: [Contact]

## Related Documentation

### Infrastructure as Code
- Kubernetes manifests: `/k8s/`
- Helm charts: `/k8s/vibecode-chart/`
- Terraform (Azure): `/terraform/azure/`

### Application Documentation
- API documentation: `/docs/api/`
- Architecture diagrams: `/docs/architecture/`
- Development setup: `/docs/development/`

### Monitoring Configuration
- Datadog monitors: `/monitoring/datadog/`
- Prometheus recording rules: `/monitoring/prometheus/`
- Grafana dashboards: `/monitoring/grafana/`

## Change Log

### Version 1.0.0 (2025-10-02)
- Initial release of production operations documentation
- Added comprehensive deployment runbook
- Added operations guide with daily, weekly, monthly procedures
- Added troubleshooting guide for common issues
- Added architecture overview with diagrams
- Added incident response playbook with post-mortem templates

### Future Enhancements
- [ ] Add automated deployment scripts
- [ ] Create interactive troubleshooting decision trees
- [ ] Integrate runbooks with Datadog notebooks
- [ ] Add video walkthroughs for critical procedures
- [ ] Create SRE onboarding training materials

## Feedback and Contributions

This documentation is maintained by the SRE team and updated based on real-world operational experience.

**Submit feedback**:
- Create issue in GitHub: [Link]
- Slack channel: #sre-docs
- Email: sre-team@vibecode.com

**Review cycle**: Monthly
**Next review**: 2025-11-02

---

**Document Owner**: SRE Team
**Last Updated**: 2025-10-02
**Version**: 1.0.0
