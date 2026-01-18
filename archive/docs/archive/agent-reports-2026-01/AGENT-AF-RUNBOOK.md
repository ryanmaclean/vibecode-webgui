# Agent AF: Backup Operations Runbook
# Comprehensive Backup & Recovery Automation - Operations Manual

**Status**: Production Ready
**Version**: 2.0.0
**Date**: 2026-01-05
**Agent**: AF (Backup & Recovery Automation)

---

## Quick Links

- Architecture: [AGENT-AF-BACKUP-ARCHITECTURE.md](AGENT-AF-BACKUP-ARCHITECTURE.md)
- Quick Reference: [AGENT-AF-QUICK-REFERENCE.md](AGENT-AF-QUICK-REFERENCE.md)
- Disaster Recovery: [AGENT-Z-DISASTER-RECOVERY.md](AGENT-Z-DISASTER-RECOVERY.md)

---

## Table of Contents

1. [Daily Operations](#1-daily-operations)
2. [Weekly Operations](#2-weekly-operations)
3. [Monthly Operations](#3-monthly-operations)
4. [Emergency Procedures](#4-emergency-procedures)
5. [Troubleshooting](#5-troubleshooting)
6. [Escalation Procedures](#6-escalation-procedures)

---

## 1. Daily Operations

### 1.1 Morning Briefing (08:00 UTC)

**Duration**: 10 minutes
**Owner**: Backup Operations Team

```bash
# Check backup status from previous night
./azure/backup-verify.sh --check-age --check-storage --detailed

# Review any alerts or failures
tail -50 /var/log/backup.log
systemctl status backup-daily.timer
```

**Expected Output**:
- Latest daily backup: < 24 hours old
- Hourly backups: < 60 minutes old
- Storage usage: < 80%
- No critical alerts

**Action Items**:
- [ ] All backups successful
- [ ] Storage within quota
- [ ] No failed jobs
- [ ] Replication on track

### 1.2 Continuous Monitoring

**Automated via**:
- Systemd timers (hourly/daily/weekly)
- Prometheus metrics (real-time dashboard)
- Datadog monitoring (alerting)

**Key Metrics to Monitor**:
- Backup job duration (baseline: ~15 min for daily)
- Storage usage growth (baseline: ~2.5GB/day)
- Replication lag (target: < 5 minutes)
- Oldest backup file (should be < 1 day)

**Alert Thresholds**:
- Backup older than 25 hours → WARNING
- Storage > 80% → WARNING
- Storage > 95% → CRITICAL
- Backup job failure → CRITICAL
- Replication lag > 30 minutes → WARNING

### 1.3 Evening Checklist (18:00 UTC)

```bash
# Verify today's backups are complete
find /backup/local/daily -mtime -1 | wc -l  # Should be >= 1

# Check cloud replication
aws s3 ls s3://vibecode-backups/postgresql/daily/ | tail -3

# Check remote server sync
ssh backup@remote.server "ls -lh /backup/daily | tail -3"

# Review backup logs for errors
grep -i "error\|fail" /var/log/backup.log | tail -10
```

**Actions if Issues**:
- [ ] No new backup? → Contact on-call engineer
- [ ] Replication delayed? → Check network, retry manually
- [ ] Storage full? → Run cleanup, delete old backups
- [ ] Errors in logs? → Investigate and document

---

## 2. Weekly Operations

### 2.1 Weekly Restore Test (Wednesday 10:00 UTC)

**Duration**: 60 minutes
**Owner**: Backup & Database Team

```bash
# Execute automated restore test
./azure/restore-test.sh --test-type full \
  --backup-date 2026-01-03 \
  --measure-rto \
  --validate-data \
  --smoke-test

# Review test report
cat /opt/backup/logs/restore-test-report-*.txt
```

**Success Criteria**:
- ✅ RTO achieved: < 5 minutes
- ✅ Data integrity: 100% match
- ✅ All smoke tests: PASSED
- ✅ No data loss

**If Test Fails**:
1. Review error logs: `/opt/backup/logs/restore-test-*.log`
2. Check backup integrity: `./azure/backup-verify.sh --check-all`
3. Investigate root cause
4. Document issue and resolution
5. Create action item to fix

### 2.2 Backup Integrity Deep Scan

```bash
# Comprehensive backup verification
./azure/backup-verify.sh --check-all --detailed

# Check all backup types
for type in hourly daily weekly monthly; do
  find /backup/local/$type -type f | wc -l
  find /backup/local/$type -type f -exec sha256sum -c {}.sha256 \; | grep FAILED
done
```

### 2.3 Storage Review & Planning

```bash
# Current storage usage
du -sh /backup/local/*

# Storage growth trend (last 7 days)
find /backup/local -type f -mtime -7 -exec du -c {} + | tail -1

# Projected monthly growth
growth_daily=$(... calculate from trend ...)
projected_monthly=$((growth_daily * 30))
echo "Projected monthly growth: $projected_monthly GB"
```

**Action Items**:
- [ ] Verify growth aligns with projections
- [ ] Check for abnormal spikes
- [ ] Plan capacity expansion if needed
- [ ] Optimize retention policies

---

## 3. Monthly Operations

### 3.1 Full DR Drill (First Wednesday 10:00 UTC)

**Duration**: 120 minutes (2 hours)
**Participants**: 5-7 (DB, Infra, App, Security, Network, Ops)

```bash
# Execute DR drill
./azure/restore-test.sh --test-type dr \
  --measure-rto \
  --validate-data \
  --smoke-test

# Document results
cat > /tmp/dr-drill-report.md << EOF
# DR Drill Report - $(date +%Y-%m-%d)

## Participants
- [ ] Database Team
- [ ] Infrastructure Team
- [ ] Application Team
- [ ] Security Team
- [ ] Network Team
- [ ] Operations Team

## Test Objectives
- [ ] Verify complete regional failover
- [ ] Test restore from backup
- [ ] Validate data integrity
- [ ] Measure RTO (target: < 5 min)
- [ ] Confirm RPO (target: < 1 min)

## Results
- RTO Achieved: _____ seconds
- RPO Validated: _____ seconds
- Data Integrity: _____ % match
- Service Downtime: _____ seconds

## Issues Found
1. ___________________________
2. ___________________________
3. ___________________________

## Action Items
- [ ] ___________________________
- [ ] ___________________________
- [ ] ___________________________

## Team Debriefing Notes
_____________________________
_____________________________

Prepared by: _______________
Date: _____________________
EOF
```

### 3.2 Backup Catalog Maintenance

```bash
# Review and maintain backup catalog database
sqlite3 /opt/backup/backup-catalog.db << SQL
-- List all backups by status
SELECT backup_type, COUNT(*) as count,
  SUM(compressed_size_bytes) as total_size
FROM backups
WHERE created_at > datetime('now', '-30 days')
GROUP BY backup_type;

-- Find and archive old backups
SELECT backup_id, backup_type, created_at
FROM backups
WHERE created_at < datetime('now', '-365 days')
ORDER BY created_at DESC;

-- Check verification status
SELECT backup_type, status, COUNT(*) as count
FROM verification_results
GROUP BY backup_type, status;
SQL
```

### 3.3 Retention Policy Review

```bash
# Check if retention policies are being enforced
./azure/backup-verify.sh --check-storage --detailed

# List backups older than retention window
find /backup/local -type f -mtime +30 | wc -l  # Should be empty or minimal

# Review cloud storage retention (S3 Lifecycle)
aws s3api get-bucket-lifecycle-configuration \
  --bucket vibecode-backups | jq .

# Manual cleanup if needed
find /backup/local -type f -mtime +30 -exec rm {} \;
```

### 3.4 Security Audit

```bash
# Check backup encryption
for f in /backup/local/*/*.enc; do
  echo "Testing decryption: $(basename $f)"
  openssl enc -d -aes-256-cbc -in "$f" -pass env:BACKUP_ENCRYPTION_PASSWORD -P
done

# Verify access permissions
ls -la /backup/local/ | head -20
ls -la /opt/backup/config/

# Audit access logs
grep -i backup /var/log/auth.log | tail -50
```

### 3.5 Documentation Update

- [ ] Update RTO/RPO metrics (latest measurements)
- [ ] Review and update runbooks
- [ ] Document new procedures
- [ ] Update contact list
- [ ] Review escalation procedures
- [ ] Update team training materials

---

## 4. Emergency Procedures

### 4.1 Backup Job Failure

**Alert**: Backup job failed to complete
**Duration**: Immediate response

**Steps**:
```bash
# 1. Check backup logs
tail -100 /var/log/backup.log | grep -i error

# 2. Verify PostgreSQL is accessible
psql -h localhost -U postgres -c "SELECT 1"

# 3. Check disk space
df -h /backup/local

# 4. Try manual backup
/opt/backup/backup-scheduler.sh --backup-type daily --force

# 5. If still failing, escalate to senior DBA
```

**If not resolved in 30 minutes**:
1. Escalate to on-call DBA
2. Notify team lead
3. Open incident ticket
4. Begin investigation

### 4.2 Storage Quota Exceeded

**Alert**: Backup storage > 90%
**Duration**: Immediate response

**Steps**:
```bash
# 1. Check current usage
du -sh /backup/local/*

# 2. Identify old backups
find /backup/local -type f -mtime +30 | sort -k 1 -hr | head -20

# 3. Clean up oldest files (if older than retention policy)
find /backup/local -type f -mtime +30 -delete

# 4. Verify space recovered
df -h /backup/local

# 5. Escalate if issue persists
```

### 4.3 Corruption Detected

**Alert**: Backup checksum mismatch
**Duration**: Immediate investigation

**Steps**:
```bash
# 1. Stop further backups to prevent overwriting
systemctl stop backup-*.timer

# 2. Verify checksum failure
sha256sum -c /backup/local/*/backup-*.sha256

# 3. Check backup file integrity
tar -tf /backup/local/daily/backup-*.tar.gz | head -10

# 4. Determine backup is usable
if integrity_check_passed; then
  # Restore from alternative backup
  ./azure/restore-test.sh --verify-only --backup-date 2026-01-04
else
  # Escalate to backup team
fi

# 5. Resume backups once resolved
systemctl start backup-daily.timer
```

### 4.4 Complete Data Center Failure

**Alert**: Primary region unreachable
**Duration**: 5-minute decision window

**Steps**:
```bash
# 1. Activate failover procedures
# See AGENT-Z-DISASTER-RECOVERY.md for complete procedures

# 2. Verify backup in secondary region
aws s3 --region us-west-2 ls s3://vibecode-backups-replica/

# 3. Provision infrastructure in secondary region
# (This is a longer process - see DR documentation)

# 4. Restore databases in secondary
./azure/restore-test.sh --test-type full

# 5. Verify all services operational
./azure/restore-test.sh --smoke-test
```

---

## 5. Troubleshooting

### Common Issues & Solutions

#### Issue: Hourly backup not running

**Symptom**: Latest backup > 2 hours old

**Diagnosis**:
```bash
systemctl list-timers backup-hourly.timer
systemctl status backup-hourly.service --no-pager | head -30
journalctl -u backup-hourly.service --since "2 hours ago"
```

**Solution**:
```bash
# Check configuration
source /opt/backup/config/backup.conf
echo $POSTGRES_HOST $POSTGRES_PORT $POSTGRES_USER

# Test PostgreSQL connection
pg_dump --host=$POSTGRES_HOST -U $POSTGRES_USER --list &>/dev/null

# Restart timer
systemctl restart backup-hourly.timer

# Manually trigger backup
/opt/backup/backup-scheduler.sh --backup-type hourly --force
```

#### Issue: S3 upload failing

**Symptom**: Cloud replication fails, local backup OK

**Diagnosis**:
```bash
aws s3 ls s3://vibecode-backups/
aws s3 cp /tmp/test-file.txt s3://vibecode-backups/ --dry-run
```

**Solution**:
```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify S3 permissions
aws iam list-attached-user-policies --user-name backup-service

# Check network connectivity
nc -zv s3.amazonaws.com 443

# Retry upload manually
aws s3 cp /backup/local/daily/backup-*.tar.gz s3://vibecode-backups/postgresql/daily/
```

#### Issue: Restore test failure

**Symptom**: Test restore fails with error

**Diagnosis**:
```bash
./azure/restore-test.sh --test-type full --verify-only --backup-date 2026-01-04

# Review detailed logs
cat /opt/backup/logs/restore-test-*.log

# Check backup integrity
./azure/backup-verify.sh --backup-id <backup-id> --detailed
```

**Solution**:
```bash
# Verify PostgreSQL binary compatibility
pg_basebackup --version

# Check WAL archive availability
find /backup/local/wal -type f | head -10

# Try restore from different backup
./azure/restore-test.sh --test-type full --backup-date 2026-01-03

# If multiple fails, escalate to DBA
```

---

## 6. Escalation Procedures

### On-Call Escalation

**Level 1** (Backup Operations - 30 minutes):
- Check backup logs
- Verify backup status
- Attempt automatic recovery
- Document findings

**Level 2** (Senior Database Administrator - 60 minutes):
- Deep investigation
- Review PostgreSQL configuration
- Check WAL archiving
- Consider backup restoration

**Level 3** (Chief Infrastructure Officer - 2 hours):
- Strategic decision making
- Approve emergency procedures
- Activate disaster recovery
- Senior management notification

### Contact Information

```
Primary On-Call:        +1-XXX-XXX-XXXX (mobile)
Secondary On-Call:      +1-XXX-XXX-XXXX (mobile)
Backup Team Lead:       +1-XXX-XXX-XXXX (mobile)
DBA Lead:              +1-XXX-XXX-XXXX (mobile)
Ops Manager:           +1-XXX-XXX-XXXX (mobile)

Escalation Email:       ops-escalation@example.com
Incident Channel:       #ops-incidents (Slack)
PagerDuty:             https://example.pagerduty.com

AWS Account ID:        123456789012
AWS Primary Region:    us-east-1
AWS Secondary Region:  us-west-2
```

### Incident Documentation

**Every incident must be documented**:

```bash
cat > /tmp/incident-report-$(date +%Y%m%d-%H%M%S).md << EOF
# Incident Report - $(date)

## Summary
One-line summary of the incident

## Timeline
- HH:MM: Event 1
- HH:MM: Event 2
- HH:MM: Resolution

## Root Cause
Description of root cause

## Actions Taken
1. Action 1
2. Action 2

## Prevention
How to prevent this in future

## Follow-up Items
- [ ] Item 1
- [ ] Item 2

## Assigned To
Name and email

Prepared by: ____________
Date: ___________________
EOF
```

---

## Appendices

### A. Command Reference

**Quick Backup Check**:
```bash
./azure/backup-scheduler.sh --backup-type daily --force
```

**Quick Verification**:
```bash
./azure/backup-verify.sh --check-all --detailed
```

**Quick Restore Test**:
```bash
./azure/restore-test.sh --test-type full --backup-date $(date -d '1 day ago' +%Y-%m-%d)
```

### B. Dashboard Access

**Prometheus**:
```
http://prometheus.internal:9090
Query: backup_job_duration_seconds
```

**Datadog**:
```
https://app.datadoghq.com
Dashboard: "Backup Health Overview"
```

**Local Logs**:
```bash
tail -f /opt/backup/logs/backup-*.log
```

### C. Database Queries

**Recent Backups**:
```sql
SELECT backup_id, backup_type, size_bytes, status, created_at
FROM backups
ORDER BY created_at DESC
LIMIT 10;
```

**Backup by Status**:
```sql
SELECT status, COUNT(*) as count, AVG(duration_seconds) as avg_duration
FROM backups
WHERE created_at > datetime('now', '-7 days')
GROUP BY status;
```

---

**Document Version**: 2.0.0
**Last Updated**: 2026-01-05
**Next Review**: 2026-02-05
