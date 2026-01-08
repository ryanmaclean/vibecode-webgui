# Agent AF: Quick Reference Guide
# Backup & Recovery Automation - Command Quick Reference

**Version**: 2.0.0
**Date**: 2026-01-05

---

## Quick Navigation

| Task | Command | Time |
|------|---------|------|
| Status Check | `backup-status` | 2 min |
| Manual Backup | `backup-scheduler.sh --backup-type daily --force` | 15 min |
| Verify Backups | `backup-verify.sh --check-all` | 10 min |
| Test Restore | `restore-test.sh --test-type full` | 30 min |
| Emergency Restore | `restore-test.sh --test-type full --skip-cleanup` | 60 min |
| View Logs | `tail -f /opt/backup/logs/backup-*.log` | 1 min |
| Check Storage | `du -sh /backup/local/*` | 1 min |

---

## Backup Commands

### Hourly Incremental Backup
```bash
/opt/backup/backup-scheduler.sh --backup-type hourly
```
- **Schedule**: Automatically every hour via systemd timer
- **Duration**: ~2-5 minutes
- **Type**: Incremental (WAL segments + deltas)

### Daily Full Backup
```bash
/opt/backup/backup-scheduler.sh --backup-type daily
```
- **Schedule**: Automatically daily at 02:00 UTC
- **Duration**: ~10-15 minutes
- **Type**: Full PostgreSQL basebackup + Valkey snapshot

### Weekly Full Backup
```bash
/opt/backup/backup-scheduler.sh --backup-type weekly
```
- **Schedule**: Automatically weekly at 03:00 UTC Sunday
- **Duration**: ~15-20 minutes
- **Type**: Full system backup

### Force Backup (Emergency)
```bash
/opt/backup/backup-scheduler.sh --backup-type daily --force
```
- Ignores recent backup checks
- Useful for manual backups between scheduled runs

### Backup with Options
```bash
# With verification
/opt/backup/backup-scheduler.sh --backup-type daily --verify

# To specific destination only
/opt/backup/backup-scheduler.sh --backup-type daily --destinations local

# High priority (more resources)
/opt/backup/backup-scheduler.sh --backup-type daily --priority high

# Parallel jobs
/opt/backup/backup-scheduler.sh --backup-type daily --parallel 8
```

---

## Verification Commands

### Quick Status Check
```bash
/opt/backup/backup-verify.sh --check-age --check-storage
```
- Backup age (should be < 24 hours)
- Storage usage (should be < 80%)

### Full Integrity Check
```bash
/opt/backup/backup-verify.sh --check-all --detailed
```
- Checksum verification
- Archive integrity
- Encryption validity
- Age and storage checks

### Check Specific Backup
```bash
/opt/backup/backup-verify.sh --backup-id backup-daily-20260105-020000-a1b2c3d4
```
- Verify checksums
- Test decryption
- Archive integrity

### Detailed Verification Report
```bash
/opt/backup/backup-verify.sh --check-all --detailed --repair-corrupted
```
- Complete inventory
- Per-file verification
- Automatic repair attempts

---

## Restore & Testing Commands

### Full Restore Test (Weekly)
```bash
/opt/backup/restore-test.sh --test-type full --backup-date 2026-01-04
```
- Restores from specific date backup
- Validates data integrity
- Runs smoke tests
- Measures RTO

### PITR Test (Point-in-Time Recovery)
```bash
/opt/backup/restore-test.sh --test-type pitr \
  --backup-date 2026-01-04 \
  --target-time 14:30:00
```
- Recovers to specific timestamp
- Validates PITR capability
- Tests 7-day recovery window

### DR Drill (Monthly)
```bash
/opt/backup/restore-test.sh --test-type dr
```
- Simulates complete regional failure
- Full infrastructure restore
- Comprehensive testing
- Measures RTO/RPO

### Verify Restore Only (No Actual Restore)
```bash
/opt/backup/restore-test.sh --test-type full --verify-only
```
- Checks backup viability
- Validates restore process would work
- Doesn't consume resources

### Keep Test Environment (Debug)
```bash
/opt/backup/restore-test.sh --test-type full --skip-cleanup
```
- Leaves test environment intact
- Useful for manual investigation
- Remember to cleanup manually

---

## Storage Management

### View Current Usage
```bash
du -sh /backup/local/
du -sh /backup/local/*
```

### View by Backup Type
```bash
ls -lah /backup/local/hourly/ | head -10
ls -lah /backup/local/daily/ | head -10
ls -lah /backup/local/weekly/ | head -10
```

### Find Large Backups
```bash
find /backup/local -type f -size +1G -exec ls -lh {} \;
```

### Manual Cleanup (Old Backups)
```bash
# Delete backups older than 30 days
find /backup/local -type f -mtime +30 -delete

# Delete specific backup type
find /backup/local/hourly -type f -mtime +1 -delete
find /backup/local/daily -type f -mtime +7 -delete
```

### Check Cloud Storage
```bash
# List S3 backups
aws s3 ls s3://vibecode-backups/postgresql/daily/

# Count backups by type
aws s3 ls s3://vibecode-backups/postgresql/daily/ --recursive | wc -l

# Download backup from cloud
aws s3 cp s3://vibecode-backups/postgresql/daily/backup-20260105.tar.gz.enc /tmp/
```

---

## Monitoring & Logs

### View Recent Backup Logs
```bash
tail -50 /opt/backup/logs/backup-daily-*.log
tail -50 /opt/backup/logs/backup-verify-*.log
tail -50 /opt/backup/logs/restore-test-*.log
```

### Monitor Active Backup
```bash
# Watch backup progress
watch -n 5 'tail -20 /opt/backup/logs/backup-daily-*.log'

# Monitor systemd timer
systemctl list-timers backup-*.timer
systemctl status backup-daily.service --no-pager
```

### Check Backup Job Status
```bash
# Is backup running now?
ps aux | grep backup-scheduler

# When was last backup?
ls -lt /backup/local/daily | head -1

# How many backups exist?
find /backup/local -type f | wc -l
```

### View Backup Catalog
```bash
# List recent backups
sqlite3 /opt/backup/backup-catalog.db "SELECT backup_id, backup_type, status, created_at FROM backups ORDER BY created_at DESC LIMIT 10;"

# Backup statistics
sqlite3 /opt/backup/backup-catalog.db "SELECT backup_type, COUNT(*) as count, ROUND(SUM(compressed_size_bytes)/1024/1024/1024, 2) as size_gb FROM backups GROUP BY backup_type;"

# Failed backups
sqlite3 /opt/backup/backup-catalog.db "SELECT backup_id, backup_type, error_message FROM backups WHERE status='failed' ORDER BY created_at DESC LIMIT 10;"
```

---

## PostgreSQL Specific

### Verify WAL Archiving
```bash
# Check WAL segments
ls -lh /backup/local/wal/ | tail -10

# Count WAL files
find /backup/local/wal -type f | wc -l

# Verify WAL archiving is working
psql -U postgres -c "SHOW archive_command;"
psql -U postgres -c "SHOW archive_mode;"
```

### Manual PostgreSQL Backup
```bash
# Full backup
pg_basebackup -D /backup/manual-backup -Ft -z

# Specific database
pg_dump -U postgres -d vibecode > /backup/manual-vibecode-$(date +%Y%m%d).sql

# With compression
pg_dump -U postgres -d vibecode | gzip > /backup/manual-vibecode-$(date +%Y%m%d).sql.gz
```

### Test PostgreSQL Restore
```bash
# Check backup validity
pg_basebackup --version
tar -tzf /backup/local/daily/backup-*.tar.gz | head -20

# Dry run restore
pg_basebackup --help | grep -i format
```

---

## Valkey Specific

### Check Valkey Backup Status
```bash
# Check RDB file
ls -lh /var/lib/valkey/dump.rdb

# Check AOF file
ls -lh /var/lib/valkey/appendonly.aof

# Last backup time
stat /var/lib/valkey/dump.rdb
```

### Manual Valkey Backup
```bash
# Create RDB snapshot
redis-cli BGSAVE

# Check backup completion
redis-cli LASTSAVE

# Create backup archive
tar czf /backup/manual-valkey-$(date +%Y%m%d).tar.gz /var/lib/valkey/
```

---

## Emergency Recovery

### Immediate Restore (Critical)
```bash
# 1. Stop current services
systemctl stop postgresql valkey openvscode-server

# 2. Restore from latest backup
tar -xf /backup/local/daily/backup-*.tar.gz -C /

# 3. Start services
systemctl start postgresql valkey openvscode-server

# 4. Verify operation
psql -c "SELECT 1"
redis-cli PING
```

### Restore from Cloud
```bash
# 1. Download backup from S3
aws s3 cp s3://vibecode-backups/postgresql/daily/backup-20260105.tar.gz.enc /tmp/

# 2. Decrypt
openssl enc -d -aes-256-cbc -in backup.tar.gz.enc -out backup.tar.gz \
  -pass env:BACKUP_ENCRYPTION_PASSWORD

# 3. Extract and restore
tar -xf backup.tar.gz -C /

# 4. Start services
systemctl start postgresql
```

### PITR - Restore to Specific Time
```bash
# 1. Restore from base backup
pg_basebackup -D /backup/restore-point

# 2. Configure recovery.conf
cat > /backup/restore-point/recovery.conf << EOF
recovery_target_time = '2026-01-04 14:30:00'
restore_command = '/opt/backup/restore-wal.sh %f %p'
EOF

# 3. Start PostgreSQL (will replay WAL)
pg_ctl -D /backup/restore-point start
```

---

## Troubleshooting Quick Fix

### Backup Not Running
```bash
# Check timer is enabled
systemctl status backup-daily.timer

# Check PostgreSQL access
psql -U postgres -c "SELECT 1"

# Manually trigger
/opt/backup/backup-scheduler.sh --backup-type daily --force
```

### Storage Full
```bash
# Check usage
df -h /backup

# Clean old backups
find /backup/local -type f -mtime +30 -delete

# Verify space recovered
df -h /backup
```

### Restore Test Fails
```bash
# Verify backup integrity
/opt/backup/backup-verify.sh --backup-id <id>

# Try different backup
/opt/backup/restore-test.sh --test-type full --backup-date 2026-01-03

# Check PostgreSQL version match
pg_basebackup --version
```

### Encryption Issues
```bash
# Test encryption password
echo -n "test" | openssl enc -aes-256-cbc -salt -pass env:BACKUP_ENCRYPTION_PASSWORD | \
  openssl enc -d -aes-256-cbc -pass env:BACKUP_ENCRYPTION_PASSWORD

# Check encryption key availability
echo $BACKUP_ENCRYPTION_PASSWORD

# Re-encrypt backup if corrupted
openssl enc -aes-256-cbc -salt -in backup.tar -out backup.tar.enc \
  -pass env:BACKUP_ENCRYPTION_PASSWORD
```

---

## Configuration Files

### Main Configuration
```bash
cat /opt/backup/config/backup.conf
```

### PostgreSQL WAL Archiving
```bash
# Check current settings
psql -U postgres -c "SHOW wal_level; SHOW archive_mode; SHOW archive_command;"

# Modify if needed (requires restart)
sudo -u postgres psql -c "ALTER SYSTEM SET archive_command = '...';"
sudo systemctl restart postgresql
```

### Systemd Timers
```bash
# View all backup timers
systemctl list-timers backup-*.timer

# Enable/disable specific timer
systemctl enable backup-daily.timer
systemctl disable backup-weekly.timer

# View timer status
systemctl status backup-daily.timer

# Manually trigger timer
systemctl start backup-daily.service
```

---

## Useful One-Liners

```bash
# Find latest backup
find /backup/local -type f | sort -r | head -1

# List all backups by date
find /backup/local -type f -printf '%T@ %p\n' | sort -rn | cut -d' ' -f2- | head -20

# Get backup file sizes human-readable
find /backup/local -type f -exec du -h {} + | sort -h

# Count backups by type
find /backup/local -type d -maxdepth 1 -exec sh -c 'echo -n "{}:"; find {} -type f | wc -l' \;

# Check backup age in minutes
find /backup/local/daily -type f | head -1 | while read f; do
  echo "Age (minutes): $(($(date +%s) - $(stat -c%Y "$f")) / 60))"
done

# Verify all checksums
find /backup/local -name "*.sha256" -exec sh -c 'echo "Checking {}"; sha256sum -c "{}"' \;

# Export backup manifest
tar -tzf /backup/local/daily/backup-*.tar.gz | head -100 > /tmp/backup-manifest.txt

# Calculate total backup size
du -cb /backup/local/daily | tail -1

# Monitor backup progress
watch -n 2 'ls -lht /backup/local/daily | head -5'

# Stream test restore (minimal disk space)
tar -xzf /backup/local/daily/backup-*.tar.gz -O | tar -t | head -100
```

---

## Environment Variables

```bash
# Set backup home directory
export BACKUP_HOME=/opt/backup

# Set encryption password
export BACKUP_ENCRYPTION_PASSWORD='your-secure-password'

# AWS credentials
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_DEFAULT_REGION="us-east-1"

# PostgreSQL credentials
export PGPASSWORD="postgres-password"
export PGHOST="localhost"
export PGUSER="postgres"
```

---

## Contact & Escalation

**Backup Team**: ops-backup@example.com
**On-Call**: Check PagerDuty rotation
**Emergency**: #ops-incidents on Slack

---

**Last Updated**: 2026-01-05
**Version**: 2.0.0
