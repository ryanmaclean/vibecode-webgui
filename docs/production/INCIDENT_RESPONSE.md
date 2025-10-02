# Incident Response Playbook

**Document Owner**: SRE Team
**Last Updated**: 2025-10-02
**Version**: 1.0.0
**Audience**: On-Call Engineers, Incident Commanders, SREs

## Table of Contents

1. [Incident Severity Levels](#incident-severity-levels)
2. [Incident Detection and Triage](#incident-detection-and-triage)
3. [Response Procedures by Incident Type](#response-procedures-by-incident-type)
4. [Communication Protocols](#communication-protocols)
5. [Post-Incident Review](#post-incident-review)

---

## Incident Severity Levels

### Severity Definitions

| Level | Name | Response Time | Description | Example |
|-------|------|---------------|-------------|---------|
| **P1** | Critical | <15 minutes | Complete service outage, data loss, security breach | Application down, database corrupted |
| **P2** | High | <1 hour | Severe performance degradation, major feature broken | High error rate (>5%), P95 latency >5s |
| **P3** | Medium | <4 hours | Partial feature outage, moderate performance issues | Single endpoint failing, cache invalidation issues |
| **P4** | Low | <24 hours | Minor issues, informational alerts | Upcoming certificate expiration, resource trending up |

### Impact Assessment

**User Impact**:
- **Critical**: All users affected, core functionality unavailable
- **High**: >50% users affected or critical feature unavailable
- **Medium**: <50% users affected or non-critical feature impaired
- **Low**: <10% users affected or cosmetic issues

**Business Impact**:
- **Critical**: Revenue loss, data breach, regulatory violation
- **High**: Significant user dissatisfaction, SLA breach
- **Medium**: User complaints, minor SLA impact
- **Low**: Internal metrics affected, no external impact

---

## Incident Detection and Triage

### Detection Sources

**Automated Alerts** (Datadog):
```
Priority 1: Critical Alerts
├─ Service completely down (5+ consecutive health check failures)
├─ Error rate >10% (sustained for 5 minutes)
├─ Database connection failure
├─ Certificate expired
└─ Security anomaly detected

Priority 2: High Severity Alerts
├─ Error rate 5-10% (sustained for 10 minutes)
├─ P95 latency >2000ms (sustained for 10 minutes)
├─ Pod crash loop (3+ restarts in 5 minutes)
├─ Disk usage >90%
└─ Memory pressure on nodes

Priority 3: Medium Severity Alerts
├─ Error rate 2-5% (sustained for 15 minutes)
├─ P95 latency 1000-2000ms (sustained for 15 minutes)
├─ Database slow queries (>1000ms)
└─ Cache hit rate <70%

Priority 4: Low Severity Alerts
├─ Certificate expiring in <30 days
├─ Resource usage trending up
├─ Deprecated API usage
└─ Configuration drift detected
```

**User Reports**:
- Support ticket system
- Social media monitoring
- Customer success escalations
- Internal team reports

**Proactive Monitoring**:
- Synthetic tests (Datadog Synthetics)
- Real User Monitoring (RUM)
- Log analysis (anomaly detection)
- Performance profiling

### Initial Triage Checklist

**When Alert Fires** (first 5 minutes):

```bash
#!/bin/bash
# initial-triage.sh

echo "=== VibeCode Incident Triage ==="
echo "Time: $(date)"
echo

# 1. Verify alert is genuine
echo "1. Verifying incident..."
curl -f https://vibecode.eastus2.cloudapp.azure.com/api/health || echo "❌ CONFIRMED: Service down"

# 2. Check affected components
echo -e "\n2. Component Status:"
kubectl get pods -n vibecode | grep -v Running

# 3. Check recent changes
echo -e "\n3. Recent Deployments:"
helm history vibecode -n vibecode | tail -5

# 4. Check error logs
echo -e "\n4. Recent Errors:"
kubectl logs -n vibecode -l app=vibecode-webgui --since=10m | grep ERROR | tail -10

# 5. Check resource utilization
echo -e "\n5. Resource Usage:"
kubectl top nodes
kubectl top pods -n vibecode | head -10

# 6. Check external dependencies
echo -e "\n6. External Services:"
curl -f https://status.openai.com/api/v2/status.json | jq '.status.indicator'
curl -f https://www.githubstatus.com/api/v2/status.json | jq '.status.indicator'

echo -e "\n=== Triage Complete ==="
```

**Triage Decision Tree**:
```
Is service responding?
├─ NO → P1 (Critical)
│   └─ Start incident response immediately
│
└─ YES → Check error rate
    ├─ >10% → P1 (Critical)
    ├─ 5-10% → P2 (High)
    ├─ 2-5% → P3 (Medium)
    └─ <2% → P4 (Low) or False Positive

Check recent changes?
├─ Deployment in last 2 hours → Likely deployment issue
├─ Configuration change → Possible misconfiguration
├─ Traffic spike → Possible capacity issue
└─ No recent changes → Investigate external factors
```

---

## Response Procedures by Incident Type

### P1: Complete Service Outage

**Symptoms**:
- Health check endpoint unresponsive
- All users unable to access application
- 100% error rate for 5+ minutes

**Immediate Actions** (first 15 minutes):

1. **Declare Incident** (minute 0-2):
   ```bash
   # Create Datadog incident
   datadog-incident create \
     --title "Production Service Outage" \
     --severity "critical" \
     --customer-impact "All users unable to access VibeCode"

   # Notify team
   slack-notify --channel "#incidents" --urgent \
     "🚨 P1 INCIDENT: Complete service outage. All hands on deck. Join war room: #incident-$(date +%Y%m%d-%H%M)"

   # Update status page
   curl -X POST https://api.statuspage.io/v1/pages/${PAGE_ID}/incidents \
     -H "Authorization: OAuth ${STATUSPAGE_TOKEN}" \
     -d '{
       "incident": {
         "name": "Service Unavailable",
         "status": "investigating",
         "impact": "critical",
         "body": "We are investigating a service outage affecting all users."
       }
     }'
   ```

2. **Quick Diagnostics** (minute 2-5):
   ```bash
   # Check cluster status
   kubectl cluster-info
   kubectl get nodes

   # Check application pods
   kubectl get pods -n vibecode
   kubectl describe pods -n vibecode | grep -A 10 "Events"

   # Check recent deployments
   helm history vibecode -n vibecode

   # Check ingress controller
   kubectl get pods -n ingress-nginx
   kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --tail=100
   ```

3. **Immediate Mitigation** (minute 5-15):

   **Option A: Recent deployment issue**
   ```bash
   # Rollback to previous version
   helm rollback vibecode -n vibecode --wait --timeout 5m

   # Verify rollback
   kubectl rollout status deployment/vibecode-webgui -n vibecode
   curl -f https://vibecode.eastus2.cloudapp.azure.com/api/health
   ```

   **Option B: Infrastructure issue**
   ```bash
   # Scale up if capacity issue
   kubectl scale deployment vibecode-webgui -n vibecode --replicas=15

   # Restart pods if crashlooping
   kubectl rollout restart deployment vibecode-webgui -n vibecode

   # Force recreate if stuck
   kubectl delete pods -n vibecode -l app=vibecode-webgui --force --grace-period=0
   ```

   **Option C: External dependency failure**
   ```bash
   # Enable fallback mode (if implemented)
   kubectl set env deployment vibecode-webgui -n vibecode \
     FALLBACK_MODE=true \
     EXTERNAL_SERVICES_DISABLED=true

   # Route to cached responses
   kubectl patch configmap vibecode-config -n vibecode \
     --type=json -p='[{"op":"replace","path":"/data/cache_ttl","value":"3600"}]'
   ```

4. **Communication** (continuous):
   ```markdown
   # Slack update (every 10 minutes)
   **Incident Update** (10:15)
   - Status: Investigating
   - Impact: All users affected
   - Action: Rolled back deployment to v1.2.2
   - ETA: Verifying service recovery
   - Next update: 10:25
   ```

5. **Verification** (minute 15+):
   ```bash
   # Verify service recovery
   for i in {1..10}; do
     curl -f https://vibecode.eastus2.cloudapp.azure.com/api/health && echo "✅ Health check $i passed" || echo "❌ Health check $i failed"
     sleep 2
   done

   # Run smoke tests
   npm run test:production:smoke

   # Check metrics
   curl -s "https://vibecode.eastus2.cloudapp.azure.com/api/monitoring/metrics" | jq '{error_rate, p95_latency, active_users}'

   # Monitor for 15 minutes before declaring resolved
   ```

---

### P1: Data Loss or Corruption

**Symptoms**:
- Users reporting missing data
- Database integrity check failures
- Replication lag >1GB

**Immediate Actions**:

1. **Isolate Affected System** (minute 0-5):
   ```bash
   # Stop writes to database
   kubectl scale deployment vibecode-webgui -n vibecode --replicas=0

   # Mark database as read-only
   kubectl exec -n vibecode postgres-0 -- psql -U vibecode -c "
   ALTER DATABASE vibecode_db SET default_transaction_read_only = on;
   "

   # Take immediate snapshot
   kubectl exec -n vibecode postgres-0 -- pg_dump -U vibecode vibecode_db > emergency-backup-$(date +%Y%m%d-%H%M%S).sql
   ```

2. **Assess Damage** (minute 5-15):
   ```bash
   # Check for corruption
   kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "
   SELECT datname, age(datfrozenxid) FROM pg_database WHERE datname = 'vibecode_db';
   "

   # Compare row counts with last known good backup
   kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "
   SELECT 'users', count(*) FROM users
   UNION ALL
   SELECT 'workspaces', count(*) FROM workspaces
   UNION ALL
   SELECT 'sessions', count(*) FROM sessions;
   "

   # Check replication status
   kubectl exec -n vibecode postgres-0 -- psql -U vibecode -c "
   SELECT * FROM pg_stat_replication;
   "
   ```

3. **Recovery Plan** (minute 15-60):

   **Option A: Point-in-Time Recovery (PITR)**
   ```bash
   # Restore to last known good state (15 minutes ago)
   target_time=$(date -u -d '15 minutes ago' '+%Y-%m-%d %H:%M:%S')

   kubectl exec -n vibecode postgres-0 -- sh -c "
   # Stop postgres
   pg_ctl stop -D /var/lib/postgresql/data

   # Restore base backup
   rm -rf /var/lib/postgresql/data/*
   pg_basebackup -h postgres-backup -D /var/lib/postgresql/data

   # Create recovery configuration
   cat > /var/lib/postgresql/data/recovery.conf <<EOF
   restore_command = 'cp /archive/%f %p'
   recovery_target_time = '${target_time}'
   EOF

   # Start recovery
   pg_ctl start -D /var/lib/postgresql/data
   "
   ```

   **Option B: Full Restore from Backup**
   ```bash
   # Download latest backup
   latest_backup=$(az storage blob list --container backups --prefix vibecode-db --output json | jq -r 'sort_by(.properties.creationTime) | .[-1].name')
   az storage blob download --container backups --name ${latest_backup} --file restore.sql.gz

   # Restore database
   gunzip restore.sql.gz
   kubectl exec -n vibecode postgres-0 -- psql -U vibecode vibecode_db < restore.sql

   # Verify data integrity
   kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "
   SELECT count(*) FROM workspaces WHERE created_at > '2025-01-01';
   "
   ```

4. **Verification and Resume** (minute 60+):
   ```bash
   # Re-enable writes
   kubectl exec -n vibecode postgres-0 -- psql -U vibecode -c "
   ALTER DATABASE vibecode_db SET default_transaction_read_only = off;
   "

   # Restart application
   kubectl scale deployment vibecode-webgui -n vibecode --replicas=6

   # Monitor for errors
   kubectl logs -n vibecode -l app=vibecode-webgui -f | grep -E "(ERROR|database)"
   ```

---

### P1: Security Breach

**Symptoms**:
- Unauthorized access detected
- Data exfiltration suspected
- Malicious activity in logs

**Immediate Actions**:

1. **Containment** (minute 0-10):
   ```bash
   # Isolate affected systems
   kubectl label pod <compromised-pod> quarantine=true

   # Block all traffic to/from compromised pod
   kubectl apply -f - <<EOF
   apiVersion: networking.k8s.io/v1
   kind: NetworkPolicy
   metadata:
     name: quarantine-pod
     namespace: vibecode
   spec:
     podSelector:
       matchLabels:
         quarantine: "true"
     policyTypes:
     - Ingress
     - Egress
   EOF

   # Revoke all active sessions
   kubectl exec -n vibecode redis-0 -- redis-cli FLUSHDB

   # Rotate all secrets immediately
   kubectl delete secret vibecode-secrets -n vibecode
   kubectl create secret generic vibecode-secrets \
     --from-literal=jwt-secret=$(openssl rand -hex 32) \
     --from-literal=database-password=$(openssl rand -base64 32)
   ```

2. **Evidence Collection** (minute 10-30):
   ```bash
   # Capture logs from affected pods
   kubectl logs -n vibecode <compromised-pod> > incident-logs-$(date +%Y%m%d-%H%M%S).log

   # Take snapshot of pod filesystem
   kubectl debug <compromised-pod> -it --copy-to=forensics-pod --share-processes --image=busybox
   kubectl exec -n vibecode forensics-pod -- tar czf /tmp/forensics.tar.gz /

   # Export network captures
   kubectl exec -n vibecode <compromised-pod> -- tcpdump -w /tmp/capture.pcap

   # Copy evidence to secure location
   kubectl cp vibecode/<compromised-pod>:/tmp/forensics.tar.gz ./evidence/forensics-$(date +%Y%m%d-%H%M%S).tar.gz
   kubectl cp vibecode/<compromised-pod>:/tmp/capture.pcap ./evidence/capture-$(date +%Y%m%d-%H%M%S).pcap
   ```

3. **Impact Assessment** (minute 30-60):
   ```bash
   # Check for data exfiltration
   kubectl logs -n vibecode -l app=vibecode-webgui | grep -E "GET|POST" | awk '$10 > 10000000'

   # Check for unauthorized access
   kubectl logs -n vibecode -l app=vibecode-webgui | grep "authentication" | grep -v "success"

   # Query database for suspicious activity
   kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "
   SELECT user_id, count(*), max(created_at)
   FROM workspaces
   WHERE created_at > now() - interval '1 hour'
   GROUP BY user_id
   HAVING count(*) > 100;
   "
   ```

4. **Notification** (immediate):
   ```bash
   # Notify security team
   security-incident notify \
     --severity "critical" \
     --type "breach" \
     --description "Unauthorized access detected in production environment" \
     --affected-systems "vibecode-webgui" \
     --contact "${INCIDENT_COMMANDER}"

   # Notify compliance team (if PII involved)
   compliance-notify --incident-id "${INCIDENT_ID}" --data-types "user-data"

   # Prepare customer communication (if data breach confirmed)
   ```

5. **Remediation** (hour 1+):
   ```bash
   # Deploy patched version
   helm upgrade vibecode k8s/vibecode-chart \
     --set image.tag=patched-${VERSION} \
     --wait

   # Force password reset for all users
   kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "
   UPDATE users SET password_reset_required = true;
   "

   # Enable additional security controls
   kubectl set env deployment vibecode-webgui -n vibecode \
     RATE_LIMIT_ENABLED=true \
     RATE_LIMIT_MAX_REQUESTS=100 \
     ADDITIONAL_AUTH_REQUIRED=true
   ```

---

### P2: High Error Rate

**Symptoms**:
- Error rate 5-10% (sustained)
- Users experiencing intermittent failures
- P95 latency >2000ms

**Response Procedure**:

1. **Identify Error Pattern** (minute 0-15):
   ```bash
   # Check error distribution
   curl -s "https://app.datadoghq.com/api/v1/query?query=sum:trace.web.request.errors{env:production}by{http.status_code}" \
     -H "DD-API-KEY: ${DD_API_KEY}" | jq '.'

   # Group errors by endpoint
   kubectl logs -n vibecode -l app=vibecode-webgui --since=10m | \
     grep ERROR | \
     awk '{print $5}' | \
     sort | uniq -c | sort -rn

   # Check if specific user-agent or region affected
   kubectl logs -n vibecode -l app=vibecode-webgui --since=10m | \
     grep ERROR | \
     grep -oP 'user_agent:\K[^ ]+' | \
     sort | uniq -c | sort -rn
   ```

2. **Mitigate Impact** (minute 15-30):
   ```bash
   # Scale up if capacity issue
   current_replicas=$(kubectl get deployment vibecode-webgui -n vibecode -o jsonpath='{.spec.replicas}')
   target_replicas=$((current_replicas * 2))
   kubectl scale deployment vibecode-webgui -n vibecode --replicas=${target_replicas}

   # Increase resource limits if hitting constraints
   kubectl set resources deployment vibecode-webgui -n vibecode \
     --limits=cpu=4000m,memory=8Gi

   # Enable circuit breaker for failing external services
   kubectl set env deployment vibecode-webgui -n vibecode \
     CIRCUIT_BREAKER_ENABLED=true \
     CIRCUIT_BREAKER_THRESHOLD=5
   ```

3. **Root Cause Analysis** (minute 30-60):
   ```bash
   # Analyze traces in Datadog
   open "https://app.datadoghq.com/apm/traces?query=service:vibecode status:error"

   # Check for slow database queries
   kubectl exec -n vibecode postgres-0 -- psql -U vibecode -d vibecode_db -c "
   SELECT query, calls, mean_exec_time, max_exec_time
   FROM pg_stat_statements
   WHERE mean_exec_time > 500
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   "

   # Check external API failures
   kubectl logs -n vibecode -l app=vibecode-webgui --since=30m | \
     grep -E "(openai|github|timeout)" | \
     tail -50
   ```

4. **Apply Fix** (hour 1+):
   ```bash
   # If identified issue, deploy fix
   helm upgrade vibecode k8s/vibecode-chart \
     --set image.tag=hotfix-${VERSION} \
     --wait

   # Or apply configuration change
   kubectl set env deployment vibecode-webgui -n vibecode \
     DATABASE_POOL_MAX=100 \
     QUERY_TIMEOUT=5000

   # Restart pods to apply changes
   kubectl rollout restart deployment vibecode-webgui -n vibecode
   ```

---

## Communication Protocols

### Internal Communication

**Slack Channels**:
- `#incidents` - Primary incident coordination
- `#incident-YYYYMMDD-HHMM` - Specific incident war room
- `#deployments` - Deployment-related incidents
- `#on-call` - On-call engineer paging

**Incident Roles**:
- **Incident Commander (IC)**: Overall coordination, decision-making
- **Technical Lead**: Hands-on debugging and mitigation
- **Communications Lead**: Stakeholder updates, status page
- **Scribe**: Document timeline and actions taken

**Update Cadence**:
- P1: Every 10 minutes
- P2: Every 30 minutes
- P3: Every 2 hours
- P4: Daily or on significant progress

### External Communication

**Status Page Updates**:
```bash
# Create incident
curl -X POST https://api.statuspage.io/v1/pages/${PAGE_ID}/incidents \
  -H "Authorization: OAuth ${STATUSPAGE_TOKEN}" \
  -d '{
    "incident": {
      "name": "Performance Degradation",
      "status": "investigating",
      "impact": "major",
      "body": "We are investigating reports of slow performance.",
      "component_ids": ["component-123"],
      "components": {
        "component-123": "degraded_performance"
      }
    }
  }'

# Update incident
curl -X PATCH https://api.statuspage.io/v1/pages/${PAGE_ID}/incidents/${INCIDENT_ID} \
  -H "Authorization: OAuth ${STATUSPAGE_TOKEN}" \
  -d '{
    "incident": {
      "status": "identified",
      "body": "We have identified the root cause and are deploying a fix."
    }
  }'

# Resolve incident
curl -X PATCH https://api.statuspage.io/v1/pages/${PAGE_ID}/incidents/${INCIDENT_ID} \
  -H "Authorization: OAuth ${STATUSPAGE_TOKEN}" \
  -d '{
    "incident": {
      "status": "resolved",
      "body": "The issue has been resolved. All services are operating normally."
    }
  }'
```

**Customer Communication Template**:
```markdown
Subject: [Resolved] Service Disruption - October 2, 2025

Dear VibeCode Users,

We experienced a service disruption today from 14:30 to 15:15 UTC that affected [describe impact].

**What Happened:**
[Brief description of the issue]

**Impact:**
- Duration: 45 minutes
- Affected users: Approximately 30% of active users
- Functionality: [List affected features]

**Resolution:**
[What was done to fix the issue]

**Prevention:**
To prevent this from happening again, we are implementing:
- [Action item 1]
- [Action item 2]
- [Action item 3]

We sincerely apologize for any inconvenience this may have caused. If you continue to experience issues, please contact our support team at support@vibecode.com.

Thank you for your patience and understanding.

VibeCode Team
```

---

## Post-Incident Review

### Timeline Documentation

**Incident Report Template**:
```markdown
# Incident Report: [Brief Title]

**Incident ID**: INC-2025-10-02-001
**Severity**: P1 / P2 / P3 / P4
**Duration**: 45 minutes (14:30 - 15:15 UTC)
**Impact**: 30% of users unable to access workspaces

## Timeline

| Time (UTC) | Event | Action Taken |
|------------|-------|--------------|
| 14:30 | Alert fired: High error rate (15%) | On-call engineer paged |
| 14:32 | Incident declared as P1 | War room created, stakeholders notified |
| 14:35 | Root cause identified: Database connection pool exhausted | Scaled database connections |
| 14:40 | Mitigation deployed: Increased connection pool limit | Helm upgrade executed |
| 14:50 | Service recovery observed | Error rate dropped to 2% |
| 15:00 | Monitoring period | No further errors detected |
| 15:15 | Incident resolved | Post-incident review scheduled |

## Root Cause

The incident was caused by a sudden traffic spike (3x normal load) that exhausted the database connection pool. The application was configured with a maximum of 50 connections, which was insufficient for the increased load.

**Contributing Factors**:
- Connection pool limit too low for traffic spikes
- No auto-scaling for database connections
- Insufficient monitoring of connection pool utilization

## Impact Analysis

**User Impact**:
- 30% of users (approximately 1,500 users) affected
- Unable to create or access workspaces
- Duration: 45 minutes

**Business Impact**:
- Estimated revenue loss: $2,000 (based on average session value)
- Customer support tickets: 47
- SLA breach: No (within 99.9% uptime SLA)

## Resolution

1. Increased database connection pool limit from 50 to 150
2. Enabled connection pool auto-scaling based on load
3. Added Datadog monitor for connection pool utilization

## Action Items

| Action | Owner | Due Date | Priority | Status |
|--------|-------|----------|----------|--------|
| Implement connection pool auto-scaling | @engineer | 2025-10-05 | High | In Progress |
| Add connection pool metrics to dashboard | @sre | 2025-10-03 | High | Done |
| Document connection pool tuning guide | @sre | 2025-10-10 | Medium | To Do |
| Review other resource limits for similar issues | @team | 2025-10-15 | Medium | To Do |
| Conduct load testing with 5x traffic | @qa | 2025-10-20 | Low | To Do |

## Lessons Learned

**What Went Well**:
- Alert fired immediately when error rate exceeded threshold
- Team responded quickly (<5 minutes to incident declaration)
- Root cause identified within 5 minutes
- Mitigation deployed within 10 minutes

**What Could Be Improved**:
- Connection pool monitoring was insufficient
- No automated scaling for database connections
- Documentation for connection pool tuning was lacking
- Load testing scenarios did not cover traffic spikes

**Prevention**:
- Implement predictive auto-scaling based on historical traffic patterns
- Add connection pool utilization to daily health check
- Conduct monthly load testing with realistic traffic spikes
- Create runbook for connection pool tuning

## Follow-Up

- Post-incident review meeting: 2025-10-03 10:00 UTC
- Attendees: Engineering team, SRE team, Product team
- Customer communication: Sent to all affected users
- Status page: Updated with incident summary

---
**Report Author**: [Name]
**Date**: 2025-10-02
**Reviewed By**: [Engineering Manager], [VP Engineering]
```

### Blameless Post-Mortem

**Principles**:
- Focus on systems and processes, not individuals
- Identify contributing factors, not just root cause
- Generate actionable improvements
- Share learnings across organization

**Post-Mortem Meeting Agenda**:
1. **Review Timeline** (10 minutes)
   - Walk through incident timeline
   - Clarify any unclear events

2. **Root Cause Analysis** (20 minutes)
   - Identify technical root cause
   - Identify contributing factors
   - Use "5 Whys" technique

3. **Impact Assessment** (10 minutes)
   - User impact
   - Business impact
   - SLA implications

4. **What Went Well** (10 minutes)
   - Celebrate effective responses
   - Identify process strengths

5. **Action Items** (15 minutes)
   - Generate improvement actions
   - Assign owners and due dates
   - Prioritize by impact

6. **Documentation** (5 minutes)
   - Review incident report
   - Share with organization
   - Update runbooks

### Continuous Improvement

**Track Metrics**:
- Mean Time to Detect (MTTD)
- Mean Time to Respond (MTTR)
- Mean Time to Resolve (MTTR)
- Incident frequency by type
- False positive rate
- Post-incident action completion rate

**Monthly Review**:
```sql
-- Query incidents from Datadog
SELECT
  incident_id,
  severity,
  detected_at,
  resolved_at,
  (resolved_at - detected_at) AS mttr,
  root_cause_category
FROM incidents
WHERE detected_at >= date_trunc('month', CURRENT_DATE - interval '1 month')
  AND detected_at < date_trunc('month', CURRENT_DATE)
ORDER BY severity, detected_at;

-- Calculate MTTR by severity
SELECT
  severity,
  count(*) AS incident_count,
  avg(resolved_at - detected_at) AS avg_mttr,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY (resolved_at - detected_at)) AS p95_mttr
FROM incidents
WHERE detected_at >= date_trunc('month', CURRENT_DATE - interval '1 month')
GROUP BY severity
ORDER BY severity;
```

---

## Appendix: Contact Information

### Escalation Chain

1. **Primary On-Call** (PagerDuty rotation)
   - Response time: <15 minutes for P1

2. **Engineering Manager**
   - Name: [Name]
   - Contact: [Phone], [Slack]
   - Escalate for: P1 incidents, >2 hour P2 incidents

3. **VP Engineering**
   - Name: [Name]
   - Contact: [Phone], [Slack]
   - Escalate for: Multi-hour outages, security breaches

4. **CTO**
   - Name: [Name]
   - Contact: [Phone], [Slack]
   - Escalate for: Extended outages, data breaches, regulatory issues

### External Contacts

**Cloud Provider Support**:
- Azure Support: [Portal URL]
- Priority: High (for P1 incidents)

**Database Vendor**:
- PostgreSQL Enterprise Support: [Contact]

**Observability Vendor**:
- Datadog Support: support@datadoghq.com

**Security Team**:
- Internal: security@vibecode.com
- External Consultant: [Contact]

---

**Document Version**: 1.0.0
**Last Reviewed**: 2025-10-02
**Next Review**: 2025-11-02
**Owner**: SRE Team
