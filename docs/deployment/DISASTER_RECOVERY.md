# Disaster Recovery Guide

Comprehensive disaster recovery, backup, and business continuity procedures for VibeCode.

## Recovery Objectives

```
┌────────────────────────────────────────────────────┐
│          Disaster Recovery Objectives              │
├────────────────────────────────────────────────────┤
│                                                     │
│  RTO (Recovery Time Objective):      4 hours       │
│  RPO (Recovery Point Objective):     1 hour        │
│  MTTR (Mean Time To Recover):        2 hours       │
│  Backup Frequency:                   Hourly        │
│  Backup Retention:                   30 days       │
│                                                     │
└────────────────────────────────────────────────────┘
```

## Backup Strategy

### Tiered Backup Approach

```
┌─────────────────────────────────────────────────────┐
│              Backup Tier Structure                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Tier 1: Continuous (Every 15 minutes)              │
│  ├─ Transaction logs                                │
│  ├─ Write-ahead logs (WAL)                          │
│  └─ Critical state data                             │
│                                                      │
│  Tier 2: Frequent (Every hour)                      │
│  ├─ Database snapshots                              │
│  ├─ Application state                               │
│  └─ User data                                       │
│                                                      │
│  Tier 3: Daily (00:00 UTC)                          │
│  ├─ Full database backup                            │
│  ├─ Configuration backups                           │
│  └─ Volume snapshots                                │
│                                                      │
│  Tier 4: Weekly (Sunday 00:00 UTC)                  │
│  ├─ Complete system backup                          │
│  ├─ Off-site replication                            │
│  └─ Long-term archival                              │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Database Backup & Recovery

### PostgreSQL Continuous Archiving

```yaml
# postgres-backup-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres-primary
  namespace: vibecode-production
spec:
  serviceName: postgres-primary
  replicas: 1
  selector:
    matchLabels:
      app: postgres
      role: primary
  template:
    metadata:
      labels:
        app: postgres
        role: primary
    spec:
      containers:
      - name: postgres
        image: pgvector/pgvector:pg16
        env:
        - name: POSTGRES_DB
          value: vibecode
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-secrets
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secrets
              key: password
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata

        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
        - name: postgres-backup
          mountPath: /backup
        - name: postgres-wal
          mountPath: /wal-archive
        - name: postgres-config
          mountPath: /etc/postgresql/postgresql.conf
          subPath: postgresql.conf

        resources:
          requests:
            memory: "8Gi"
            cpu: "2000m"
          limits:
            memory: "16Gi"
            cpu: "4000m"

      # Backup sidecar container
      - name: backup-agent
        image: postgres:16-alpine
        command:
        - /bin/sh
        - -c
        - |
          while true; do
            # Continuous WAL archiving (every 15 min)
            sleep 900
            pg_receivewal -h localhost -U replication -D /wal-archive --slot=backup_slot
          done
        env:
        - name: PGPASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secrets
              key: replication-password

        volumeMounts:
        - name: postgres-wal
          mountPath: /wal-archive

      volumes:
      - name: postgres-config
        configMap:
          name: postgres-config

  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 500Gi

  - metadata:
      name: postgres-backup
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: standard
      resources:
        requests:
          storage: 1Ti

  - metadata:
      name: postgres-wal
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: standard
      resources:
        requests:
          storage: 500Gi
```

### Automated Backup CronJob

```yaml
# backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup-hourly
  namespace: vibecode-production
spec:
  schedule: "0 * * * *"  # Every hour
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 24
  failedJobsHistoryLimit: 3

  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure

          containers:
          - name: backup
            image: postgres:16-alpine
            command:
            - /bin/sh
            - -c
            - |
              set -euo pipefail

              TIMESTAMP=$(date +%Y%m%d_%H%M%S)
              BACKUP_FILE="/backup/vibecode_${TIMESTAMP}.dump"

              echo "Starting backup at ${TIMESTAMP}"

              # Create backup with pg_dump
              PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
                -h postgres-primary \
                -U "${POSTGRES_USER}" \
                -d vibecode \
                -Fc \
                -Z 9 \
                -f "${BACKUP_FILE}"

              # Verify backup
              if [ ! -f "${BACKUP_FILE}" ] || [ ! -s "${BACKUP_FILE}" ]; then
                echo "ERROR: Backup file is empty or missing"
                exit 1
              fi

              BACKUP_SIZE=$(stat -f%z "${BACKUP_FILE}" 2>/dev/null || stat -c%s "${BACKUP_FILE}")
              echo "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE} bytes)"

              # Upload to S3/GCS/Azure Blob
              if [ -n "${BACKUP_BUCKET:-}" ]; then
                echo "Uploading to ${BACKUP_BUCKET}"
                aws s3 cp "${BACKUP_FILE}" "s3://${BACKUP_BUCKET}/hourly/" || true
              fi

              # Cleanup old backups (keep last 24 hours locally)
              find /backup -name "vibecode_*.dump" -mtime +1 -delete

              echo "Backup completed successfully"

            env:
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: postgres-secrets
                  key: username
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secrets
                  key: password
            - name: BACKUP_BUCKET
              valueFrom:
                configMapKeyRef:
                  name: backup-config
                  key: bucket-name
            - name: AWS_ACCESS_KEY_ID
              valueFrom:
                secretKeyRef:
                  name: backup-secrets
                  key: aws-access-key
            - name: AWS_SECRET_ACCESS_KEY
              valueFrom:
                secretKeyRef:
                  name: backup-secrets
                  key: aws-secret-key

            volumeMounts:
            - name: backup-volume
              mountPath: /backup

          volumes:
          - name: backup-volume
            persistentVolumeClaim:
              claimName: postgres-backup

---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup-daily
  namespace: vibecode-production
spec:
  schedule: "0 0 * * *"  # Daily at midnight UTC
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 30

  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure

          containers:
          - name: full-backup
            image: postgres:16-alpine
            command:
            - /bin/sh
            - -c
            - |
              set -euo pipefail

              TIMESTAMP=$(date +%Y%m%d)
              BACKUP_FILE="/backup/full/vibecode_full_${TIMESTAMP}.dump"

              echo "Starting full backup at ${TIMESTAMP}"

              # Full database backup
              PGPASSWORD="${POSTGRES_PASSWORD}" pg_dumpall \
                -h postgres-primary \
                -U "${POSTGRES_USER}" \
                -f "${BACKUP_FILE}"

              # Compress
              gzip -9 "${BACKUP_FILE}"

              # Upload to S3 with lifecycle policy
              aws s3 cp "${BACKUP_FILE}.gz" \
                "s3://${BACKUP_BUCKET}/daily/${TIMESTAMP}/" \
                --storage-class STANDARD_IA

              # Cleanup local backups (keep 7 days)
              find /backup/full -name "vibecode_full_*.dump.gz" -mtime +7 -delete

              echo "Full backup completed"

            env:
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: postgres-secrets
                  key: username
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secrets
                  key: password
            - name: BACKUP_BUCKET
              valueFrom:
                configMapKeyRef:
                  name: backup-config
                  key: bucket-name
            - name: AWS_ACCESS_KEY_ID
              valueFrom:
                secretKeyRef:
                  name: backup-secrets
                  key: aws-access-key
            - name: AWS_SECRET_ACCESS_KEY
              valueFrom:
                secretKeyRef:
                  name: backup-secrets
                  key: aws-secret-key

            volumeMounts:
            - name: backup-volume
              mountPath: /backup

          volumes:
          - name: backup-volume
            persistentVolumeClaim:
              claimName: postgres-backup
```

### Backup Verification

```yaml
# backup-verify-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup-verification
  namespace: vibecode-production
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  concurrencyPolicy: Forbid

  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure

          containers:
          - name: verify
            image: postgres:16-alpine
            command:
            - /bin/sh
            - -c
            - |
              set -euo pipefail

              # Get latest backup
              LATEST_BACKUP=$(ls -t /backup/vibecode_*.dump | head -1)

              if [ -z "${LATEST_BACKUP}" ]; then
                echo "ERROR: No backup found"
                exit 1
              fi

              echo "Verifying backup: ${LATEST_BACKUP}"

              # Create temporary database
              TEMP_DB="verify_$(date +%s)"

              PGPASSWORD="${POSTGRES_PASSWORD}" createdb \
                -h postgres-primary \
                -U "${POSTGRES_USER}" \
                "${TEMP_DB}"

              # Restore backup to temp database
              PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
                -h postgres-primary \
                -U "${POSTGRES_USER}" \
                -d "${TEMP_DB}" \
                -v \
                "${LATEST_BACKUP}"

              # Run validation queries
              PGPASSWORD="${POSTGRES_PASSWORD}" psql \
                -h postgres-primary \
                -U "${POSTGRES_USER}" \
                -d "${TEMP_DB}" \
                -c "SELECT COUNT(*) FROM users;" \
                -c "SELECT COUNT(*) FROM workspaces;"

              # Cleanup
              PGPASSWORD="${POSTGRES_PASSWORD}" dropdb \
                -h postgres-primary \
                -U "${POSTGRES_USER}" \
                "${TEMP_DB}"

              echo "Backup verification completed successfully"

            env:
            - name: POSTGRES_USER
              valueFrom:
                secretKeyRef:
                  name: postgres-secrets
                  key: username
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secrets
                  key: password

            volumeMounts:
            - name: backup-volume
              mountPath: /backup

          volumes:
          - name: backup-volume
            persistentVolumeClaim:
              claimName: postgres-backup
```

## Disaster Recovery Procedures

### Database Recovery

#### Point-in-Time Recovery (PITR)

```bash
#!/bin/bash
# scripts/pitr-restore.sh - Point-in-time recovery

set -euo pipefail

TARGET_TIME="${1:-}"
BACKUP_FILE="${2:-}"

if [ -z "${TARGET_TIME}" ]; then
  echo "Usage: $0 <target-time> [backup-file]"
  echo "Example: $0 '2025-10-01 14:30:00'"
  exit 1
fi

echo "Starting point-in-time recovery to: ${TARGET_TIME}"

# Stop application
kubectl scale deployment vibecode-webgui -n vibecode-production --replicas=0

# Stop PostgreSQL
kubectl scale statefulset postgres-primary -n vibecode-production --replicas=0

# Find base backup
if [ -z "${BACKUP_FILE}" ]; then
  BACKUP_FILE=$(find /backup -name "vibecode_*.dump" -type f | sort -r | head -1)
fi

echo "Using base backup: ${BACKUP_FILE}"

# Restore base backup
PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
  -h localhost \
  -U postgres \
  -d vibecode \
  -c \
  --if-exists \
  "${BACKUP_FILE}"

# Apply WAL logs up to target time
cat > /tmp/recovery.conf <<EOF
restore_command = 'cp /wal-archive/%f %p'
recovery_target_time = '${TARGET_TIME}'
recovery_target_action = 'promote'
EOF

# Copy recovery config
kubectl cp /tmp/recovery.conf \
  vibecode-production/postgres-primary-0:/var/lib/postgresql/data/postgresql.auto.conf

# Start PostgreSQL in recovery mode
kubectl scale statefulset postgres-primary -n vibecode-production --replicas=1

# Wait for recovery
echo "Waiting for recovery to complete..."
sleep 60

# Verify recovery
kubectl exec -n vibecode-production postgres-primary-0 -- \
  psql -U postgres -d vibecode -c "SELECT pg_is_in_recovery();"

# Start application
kubectl scale deployment vibecode-webgui -n vibecode-production --replicas=3

echo "Point-in-time recovery completed"
```

#### Full System Recovery

```bash
#!/bin/bash
# scripts/full-recovery.sh - Complete system recovery

set -euo pipefail

BACKUP_DATE="${1:-latest}"

echo "Starting full system recovery from: ${BACKUP_DATE}"

# 1. Restore configuration
echo "Restoring Kubernetes configuration..."
kubectl apply -f /backup/k8s-config/${BACKUP_DATE}/

# 2. Restore secrets
echo "Restoring secrets from Vault..."
vault kv get -format=json secret/vibecode/production | \
  jq -r '.data.data | to_entries[] | "\(.key)=\(.value)"' > /tmp/secrets.env

# 3. Create namespace if not exists
kubectl create namespace vibecode-production --dry-run=client -o yaml | kubectl apply -f -

# 4. Restore database
echo "Restoring database..."

# Download backup from S3
if [ "${BACKUP_DATE}" = "latest" ]; then
  BACKUP_FILE=$(aws s3 ls s3://${BACKUP_BUCKET}/daily/ | sort -r | head -1 | awk '{print $4}')
else
  BACKUP_FILE="vibecode_full_${BACKUP_DATE}.dump.gz"
fi

aws s3 cp "s3://${BACKUP_BUCKET}/daily/${BACKUP_FILE}" /tmp/

gunzip /tmp/${BACKUP_FILE}

# Restore to temporary database
TEMP_DB="restore_$(date +%s)"
kubectl exec -n vibecode-production postgres-primary-0 -- \
  createdb -U postgres "${TEMP_DB}"

kubectl exec -n vibecode-production postgres-primary-0 -- \
  pg_restore -U postgres -d "${TEMP_DB}" -v "/tmp/${BACKUP_FILE%.gz}"

# Verify restore
RECORD_COUNT=$(kubectl exec -n vibecode-production postgres-primary-0 -- \
  psql -U postgres -d "${TEMP_DB}" -t -c "SELECT COUNT(*) FROM users;")

echo "Restored ${RECORD_COUNT} user records"

# Swap databases
kubectl exec -n vibecode-production postgres-primary-0 -- \
  psql -U postgres -c "ALTER DATABASE vibecode RENAME TO vibecode_old;"

kubectl exec -n vibecode-production postgres-primary-0 -- \
  psql -U postgres -c "ALTER DATABASE ${TEMP_DB} RENAME TO vibecode;"

# 5. Restore volumes
echo "Restoring persistent volumes..."
kubectl get pvc -n vibecode-production -o json | \
  jq '.items[] | select(.metadata.name | startswith("postgres-data"))' | \
  kubectl apply -f -

# 6. Deploy application
echo "Deploying application..."
kubectl apply -f /backup/k8s-manifests/${BACKUP_DATE}/

# 7. Verify deployment
echo "Verifying deployment..."
kubectl wait --for=condition=ready pod -l app=vibecode -n vibecode-production --timeout=300s

# 8. Run smoke tests
echo "Running smoke tests..."
HEALTH_CHECK=$(curl -s http://localhost:3000/api/health)
if [ "${HEALTH_CHECK}" != "ok" ]; then
  echo "ERROR: Health check failed"
  exit 1
fi

echo "Full system recovery completed successfully"
```

## High Availability Setup

### Multi-Region Deployment

```yaml
# multi-region-deployment.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: region-config
  namespace: vibecode-production
data:
  PRIMARY_REGION: "us-east-1"
  SECONDARY_REGION: "us-west-2"
  TERTIARY_REGION: "eu-central-1"

---
# Primary region deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode-primary
  namespace: vibecode-production
  labels:
    region: us-east-1
spec:
  replicas: 5
  selector:
    matchLabels:
      app: vibecode
      region: primary
  template:
    metadata:
      labels:
        app: vibecode
        region: primary
    spec:
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: topology.kubernetes.io/region
                operator: In
                values:
                - us-east-1

      containers:
      - name: vibecode
        image: vibecode/webgui:1.0.0
        env:
        - name: REGION
          value: "primary"
        - name: DATABASE_URL
          value: "postgresql://primary.db.vibecode.com:5432/vibecode"

---
# Secondary region deployment (standby)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vibecode-secondary
  namespace: vibecode-production
  labels:
    region: us-west-2
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vibecode
      region: secondary
  template:
    metadata:
      labels:
        app: vibecode
        region: secondary
    spec:
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: topology.kubernetes.io/region
                operator: In
                values:
                - us-west-2

      containers:
      - name: vibecode
        image: vibecode/webgui:1.0.0
        env:
        - name: REGION
          value: "secondary"
        - name: DATABASE_URL
          value: "postgresql://replica-west.db.vibecode.com:5432/vibecode?readonly=true"
```

### Failover Automation

```yaml
# failover-controller.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: failover-script
  namespace: vibecode-production
data:
  failover.sh: |
    #!/bin/bash
    set -euo pipefail

    PRIMARY_REGION="us-east-1"
    SECONDARY_REGION="us-west-2"

    echo "Initiating failover to ${SECONDARY_REGION}"

    # 1. Promote secondary database to primary
    kubectl exec -n vibecode-production postgres-secondary-0 -- \
      pg_ctl promote -D /var/lib/postgresql/data

    # 2. Update DNS to point to secondary region
    aws route53 change-resource-record-sets \
      --hosted-zone-id ${HOSTED_ZONE_ID} \
      --change-batch '{
        "Changes": [{
          "Action": "UPSERT",
          "ResourceRecordSet": {
            "Name": "vibecode.example.com",
            "Type": "A",
            "AliasTarget": {
              "HostedZoneId": "'${SECONDARY_LB_ZONE}'",
              "DNSName": "'${SECONDARY_LB_DNS}'",
              "EvaluateTargetHealth": true
            }
          }
        }]
      }'

    # 3. Scale up secondary region
    kubectl scale deployment vibecode-secondary \
      -n vibecode-production --replicas=5

    # 4. Update application config
    kubectl set env deployment/vibecode-secondary \
      -n vibecode-production \
      DATABASE_URL="postgresql://secondary.db.vibecode.com:5432/vibecode"

    # 5. Verify failover
    sleep 30
    HEALTH_CHECK=$(curl -s https://vibecode.example.com/api/health)

    if [ "${HEALTH_CHECK}" = "ok" ]; then
      echo "Failover completed successfully"
      # Send notification
      curl -X POST ${SLACK_WEBHOOK} \
        -d '{"text":"✅ Failover to '${SECONDARY_REGION}' completed successfully"}'
    else
      echo "ERROR: Failover verification failed"
      exit 1
    fi
```

## Backup Testing Schedule

```yaml
# backup-test-schedule.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: backup-test-schedule
  namespace: vibecode-production
data:
  schedule.txt: |
    # Weekly backup verification (Every Monday 3 AM)
    # - Restore latest hourly backup to test environment
    # - Verify data integrity
    # - Run application smoke tests
    # - Document restore time (RTO validation)

    # Monthly disaster recovery drill (First Sunday of month)
    # - Full system recovery test
    # - Multi-region failover test
    # - Team coordination exercise
    # - Update runbooks based on findings

    # Quarterly business continuity test
    # - Complete infrastructure rebuild
    # - Cross-region recovery
    # - Simulate major outage scenarios
    # - Executive briefing on findings
```

## Monitoring & Alerting

### Backup Monitoring

```yaml
# backup-monitoring-alerts.yaml
alerts:
  - name: "Backup Failed"
    query: "sum(last_1h):sum:cronjob.failed{job:postgres-backup-hourly} > 0"
    message: |
      CRITICAL: Backup job failed

      Check logs: kubectl logs -n vibecode-production -l job-name=postgres-backup-hourly

      Runbook: /runbooks/backup-failure.md
    priority: 1

  - name: "Backup Size Anomaly"
    query: "anomaly(avg(last_4h):avg:backup.size{*})"
    message: |
      WARNING: Backup size deviation detected

      May indicate data corruption or backup process issue
    priority: 2

  - name: "Backup Verification Failed"
    query: "sum(last_1h):sum:backup.verification.failed{*} > 0"
    message: |
      CRITICAL: Backup verification failed

      Backup may be corrupted. Investigate immediately.
    priority: 1

  - name: "No Backup in 2 Hours"
    query: "max(last_2h):max:backup.last_successful{*} < now() - 7200"
    message: |
      CRITICAL: No successful backup in 2 hours

      Check backup CronJob status
    priority: 1
```

## Recovery Time Tracking

```typescript
// lib/recovery-metrics.ts
import { metrics } from './metrics';

export class RecoveryMetrics {
  private startTime: number;

  startRecovery(incidentType: string) {
    this.startTime = Date.now();
    metrics.increment('recovery.started', 1, { type: incidentType });
  }

  completeRecovery(incidentType: string, success: boolean) {
    const duration = Date.now() - this.startTime;

    metrics.histogram('recovery.duration', duration, {
      type: incidentType,
      success: success.toString(),
    });

    metrics.increment('recovery.completed', 1, {
      type: incidentType,
      success: success.toString(),
    });

    // Alert if RTO exceeded (4 hours = 14400000ms)
    if (duration > 14400000) {
      metrics.increment('recovery.rto_exceeded', 1, { type: incidentType });
    }
  }

  trackDataLoss(recordsLost: number) {
    metrics.gauge('recovery.data_loss', recordsLost);
  }
}
```

## Runbook: Emergency Recovery

```markdown
# Emergency Recovery Runbook

## Scenario: Complete Database Failure

### Immediate Actions (0-15 minutes)
1. Confirm database is unrecoverable
   ```bash
   kubectl logs -n vibecode-production postgres-primary-0
   kubectl describe pod -n vibecode-production postgres-primary-0
   ```

2. Enable maintenance mode
   ```bash
   kubectl set env deployment/vibecode-webgui MAINTENANCE_MODE=true
   ```

3. Alert stakeholders
   - Post to status page
   - Notify on-call team
   - Start incident channel

### Recovery Process (15-120 minutes)
4. Identify latest valid backup
   ```bash
   aws s3 ls s3://vibecode-backups/hourly/ | sort -r | head -5
   ```

5. Create new database instance
   ```bash
   kubectl apply -f k8s/postgres-new.yaml
   ```

6. Restore from backup
   ```bash
   ./scripts/pitr-restore.sh "$(date -u -d '1 hour ago' '+%Y-%m-%d %H:%M:%S')"
   ```

7. Verify data integrity
   ```bash
   kubectl exec postgres-primary-0 -- psql -U postgres -d vibecode \
     -c "SELECT COUNT(*) FROM users;" \
     -c "SELECT MAX(created_at) FROM workspaces;"
   ```

8. Update application connection
   ```bash
   kubectl set env deployment/vibecode-webgui \
     DATABASE_URL=new-database-connection-string
   ```

9. Disable maintenance mode
   ```bash
   kubectl set env deployment/vibecode-webgui MAINTENANCE_MODE=false
   ```

### Verification (120-180 minutes)
10. Run smoke tests
11. Monitor error rates
12. Check data consistency
13. Verify all services operational

### Post-Incident (180+ minutes)
14. Document incident timeline
15. Calculate RPO/RTO metrics
16. Schedule post-mortem
17. Update runbooks
```

## Compliance & Audit

### Backup Audit Trail

```typescript
// lib/backup-audit.ts
interface BackupAuditLog {
  timestamp: Date;
  type: 'full' | 'incremental' | 'wal';
  size: number;
  duration: number;
  success: boolean;
  location: string;
  verification: {
    verified: boolean;
    verifiedAt?: Date;
    recordCount?: number;
  };
  retention: {
    expiresAt: Date;
    archived: boolean;
  };
}

export async function logBackupAudit(log: BackupAuditLog) {
  await prisma.backupAudit.create({
    data: log,
  });

  // Send to compliance system
  await sendToComplianceSystem(log);

  // Alert if verification failed
  if (!log.verification.verified) {
    await alertBackupVerificationFailure(log);
  }
}
```

## Next Steps

- [Production Checklist](./PRODUCTION_CHECKLIST.md)
- [Security Hardening](./SECURITY_HARDENING.md)
- [Monitoring Configuration](./MONITORING.md)
- [Kubernetes Production](./KUBERNETES_PRODUCTION.md)
