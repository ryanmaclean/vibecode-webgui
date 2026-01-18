# Agent Z: Operations Runbook
# Unified Services HA Cluster Operations Manual

**Status**: Production Operations Guide
**Version**: 1.0.0
**Date**: 2026-01-05
**Author**: Agent Z (High Availability Specialist)

---

## Executive Summary

This runbook provides operational procedures for managing and troubleshooting the Unified Services HA cluster. It covers day-to-day operations, common issues, emergency procedures, and maintenance tasks.

### Quick Reference

| Service | Port | Health Check | Management Tool |
|---------|------|--------------|-----------------|
| PostgreSQL | 5432 | `psql -h $VIP -U postgres -c "SELECT 1;"` | `patronictl` |
| Valkey | 6379 | `redis-cli -h $VIP PING` | `redis-cli -p 26379` |
| OpenVSCode | 8080 | `curl http://$VIP:8080/healthz` | Web UI |
| SSH | 22 | `ssh root@$VIP` | Standard SSH |
| etcd | 2379 | `etcdctl endpoint health` | `etcdctl` |
| HAProxy | 8404 | `curl http://$VIP:8404/stats` | Web UI |

---

## Table of Contents

1. [Cluster Overview](#cluster-overview)
2. [Daily Operations](#daily-operations)
3. [Monitoring & Alerting](#monitoring--alerting)
4. [Common Tasks](#common-tasks)
5. [Troubleshooting Guide](#troubleshooting-guide)
6. [Emergency Procedures](#emergency-procedures)
7. [Maintenance Windows](#maintenance-windows)
8. [Performance Tuning](#performance-tuning)
9. [Security Operations](#security-operations)
10. [On-Call Procedures](#on-call-procedures)

---

## 1. Cluster Overview

### Architecture Summary

```
3-Node HA Cluster
├── Node 1 (192.168.64.11) - Primary/Master candidate
├── Node 2 (192.168.64.12) - Replica/Replica
├── Node 3 (192.168.64.13) - Replica/Replica
└── Load Balancer (VIP: 192.168.64.10)
```

### Service Distribution

| Service | Node 1 | Node 2 | Node 3 | Load Balanced |
|---------|--------|--------|--------|---------------|
| PostgreSQL Primary | Active* | Standby | Standby | Yes (writes to primary) |
| PostgreSQL Standby | Standby | Active* | Active* | Yes (reads distributed) |
| Valkey Master | Active* | Replica | Replica | Yes (writes to master) |
| Valkey Replica | Replica | Active* | Active* | No (reads from master) |
| OpenVSCode | Active | Active | Active | Yes (round-robin) |
| SSH | Active | Active | Active | Yes (round-robin) |
| etcd | Member | Member | Member | Yes (quorum-based) |
| HAProxy | Active | - | - | N/A (runs on Node 1) |

*Active = Currently serving requests

### Access Information

**Production Cluster**:
- Load Balancer: 192.168.64.10
- Node 1: 192.168.64.11
- Node 2: 192.168.64.12
- Node 3: 192.168.64.13

**Credentials** (stored in password manager):
- PostgreSQL: `postgres` / `$POSTGRES_PASSWORD`
- Valkey: `$VALKEY_PASSWORD`
- HAProxy Stats: `admin` / `$HAPROXY_STATS_PASSWORD`
- SSH: `root` / SSH key authentication

---

## 2. Daily Operations

### Morning Health Check (10 minutes)

**Checklist**:

```bash
#!/bin/bash
# Daily cluster health check

echo "=== Daily Health Check ==="
echo ""

# 1. Check cluster membership
echo "1. Cluster Membership:"
ssh root@192.168.64.11 'etcdctl member list' | grep -E "name|ID"

# 2. Check PostgreSQL cluster
echo ""
echo "2. PostgreSQL Cluster:"
ssh root@192.168.64.11 'patronictl -c /etc/patroni/patroni.yml list'

# 3. Check Valkey cluster
echo ""
echo "3. Valkey Cluster:"
ssh root@192.168.64.11 'redis-cli -a $VALKEY_PASSWORD -p 26379 SENTINEL masters'

# 4. Check HAProxy backends
echo ""
echo "4. HAProxy Backend Status:"
curl -s http://192.168.64.11:8404/stats\;csv | grep -E "postgresql|valkey|openvscode" | grep -v "BACKEND" | awk -F',' '{print $1 "," $2 ": " $18}'

# 5. Check replication lag
echo ""
echo "5. PostgreSQL Replication Lag:"
ssh root@192.168.64.11 'psql -U postgres -c "SELECT client_addr, state, sync_state, replay_lag FROM pg_stat_replication;"'

# 6. Check system resources
echo ""
echo "6. System Resources:"
for node in 192.168.64.11 192.168.64.12 192.168.64.13; do
    echo "Node $node:"
    ssh root@$node "free -h | grep Mem && df -h / | grep -v Filesystem"
done

# 7. Check for recent errors
echo ""
echo "7. Recent Errors (last 24h):"
ssh root@192.168.64.11 "grep -c ERROR /tmp/*.log 2>/dev/null || echo 'No error logs found'"

echo ""
echo "=== Health Check Complete ==="
```

### Automated Monitoring

**Datadog Dashboards** (check daily):
- https://app.datadoghq.com/dashboard/unified-services-ha
  - Cluster health overview
  - Replication lag
  - Resource utilization
  - Error rates

**Key Metrics** (normal ranges):
- PostgreSQL replication lag: <100ms
- Valkey replication lag: <500ms
- CPU usage: <60%
- Memory usage: <80%
- Disk usage: <75%
- Network errors: 0/min

### Log Review

**Critical logs to monitor**:

```bash
# PostgreSQL
ssh root@$NODE1_IP 'tail -100 /var/log/postgresql/postgresql-16-main.log'

# Valkey
ssh root@$NODE1_IP 'tail -100 /var/log/valkey/valkey-server.log'

# Patroni
ssh root@$NODE1_IP 'journalctl -u patroni -n 100'

# etcd
ssh root@$NODE1_IP 'journalctl -u etcd -n 100'

# HAProxy
ssh root@$NODE1_IP 'tail -100 /var/log/haproxy.log'
```

---

## 3. Monitoring & Alerting

### Critical Alerts (PagerDuty)

These alerts require immediate response (within 15 minutes):

#### 1. PostgreSQL Primary Down

**Symptom**: PostgreSQL primary is unreachable
**Impact**: Write operations may fail briefly during automatic failover
**Response Time**: <15 minutes

**Investigation**:
```bash
# Check cluster status
ssh root@$NODE1_IP 'patronictl -c /etc/patroni/patroni.yml list'

# Check if failover occurred
ssh root@$NODE1_IP 'patronictl -c /etc/patroni/patroni.yml history'

# Verify new primary is accepting writes
PGPASSWORD=$POSTGRES_PASSWORD psql -h $VIP -U postgres -c "CREATE TABLE test_$(date +%s) (id INT);"
```

**Resolution**:
- If automatic failover succeeded: Monitor and investigate original primary
- If automatic failover failed: Manually trigger failover (see Emergency Procedures)

#### 2. Cluster Quorum Lost

**Symptom**: etcd cluster has no leader
**Impact**: Cannot perform automatic failovers
**Response Time**: <10 minutes (CRITICAL)

**Investigation**:
```bash
# Check etcd cluster health
for node in $NODE1_IP $NODE2_IP $NODE3_IP; do
    echo "Checking $node:"
    ssh root@$node 'systemctl status etcd'
done

# Check etcd logs
ssh root@$NODE1_IP 'journalctl -u etcd -n 200'
```

**Resolution**:
1. Restart failed etcd members
2. If >1 member is down, restore from backup (see Disaster Recovery)
3. Escalate to senior engineer if quorum cannot be restored within 15 minutes

#### 3. Multiple Service Failures

**Symptom**: 2+ services down across cluster
**Impact**: Cluster may be unhealthy
**Response Time**: <15 minutes

**Investigation**:
```bash
# Check all services on all nodes
for node in $NODE1_IP $NODE2_IP $NODE3_IP; do
    echo "Checking services on $node:"
    ssh root@$node 'systemctl status patroni valkey valkey-sentinel etcd | grep Active'
done

# Check for system issues
for node in $NODE1_IP $NODE2_IP $NODE3_IP; do
    echo "Checking $node resources:"
    ssh root@$node 'uptime && free -m && df -h /'
done
```

**Resolution**:
- Identify root cause (disk full, memory exhaustion, network issue)
- Remediate based on specific issue (see Troubleshooting Guide)

### Warning Alerts (Slack)

These alerts require attention within 1 hour:

- PostgreSQL replication lag >10 seconds
- Valkey replication lag >5 seconds
- Disk usage >80%
- Memory usage >85%
- High error rate (>10 errors/min)
- Single node down (cluster still operational)

### Info Alerts (Email)

These alerts are informational:

- Backup completion status
- Scheduled maintenance notifications
- Performance metric trends
- Capacity planning warnings

---

## 4. Common Tasks

### 4.1 Check Cluster Status

```bash
# Overall cluster health
./azure/cluster-health-check.sh

# PostgreSQL cluster status
ssh root@$NODE1_IP 'patronictl -c /etc/patroni/patroni.yml list'

# Valkey cluster status
ssh root@$NODE1_IP 'redis-cli -a $VALKEY_PASSWORD -p 26379 SENTINEL masters'

# etcd cluster status
ssh root@$NODE1_IP 'etcdctl --endpoints=http://$NODE1_IP:2379,http://$NODE2_IP:2379,http://$NODE3_IP:2379 endpoint health'

# HAProxy status
curl -u admin:$HAPROXY_STATS_PASSWORD http://$NODE1_IP:8404/stats
```

### 4.2 Trigger Manual Failover

**PostgreSQL**:
```bash
# List current topology
ssh root@$NODE1_IP 'patronictl -c /etc/patroni/patroni.yml list'

# Perform switchover (graceful, zero data loss)
ssh root@$NODE1_IP 'patronictl -c /etc/patroni/patroni.yml switchover --candidate node2'

# Or failover (immediate, may lose data)
ssh root@$NODE1_IP 'patronictl -c /etc/patroni/patroni.yml failover --candidate node2'
```

**Valkey**:
```bash
# Check current master
ssh root@$NODE1_IP 'redis-cli -a $VALKEY_PASSWORD -p 26379 SENTINEL get-master-addr-by-name unified-services-ha-valkey'

# Manual failover (Sentinel will choose best replica)
ssh root@$NODE1_IP 'redis-cli -a $VALKEY_PASSWORD -p 26379 SENTINEL failover unified-services-ha-valkey'
```

### 4.3 Add/Remove Node

**Add Node** (scale from 3 to 5 nodes):
```bash
# 1. Provision new VM
terraform apply -var="cluster_size=5" -target=module.aws_ha_cluster.aws_instance.node[4]

# 2. Bootstrap new node
ssh root@$NEW_NODE_IP bash <<'EOF'
# Join etcd cluster
systemctl start etcd

# Join PostgreSQL cluster (will auto-replicate)
systemctl start patroni

# Join Valkey cluster
redis-cli -a $VALKEY_PASSWORD REPLICAOF $MASTER_IP 6379
systemctl start valkey-sentinel

# Join OpenVSCode cluster
mount -t nfs $NFS_SERVER:/mnt/shared/workspace /mnt/workspace
systemctl start openvscode
EOF

# 3. Add to HAProxy
# Edit /etc/haproxy/haproxy.cfg and add new backend server
ssh root@$NODE1_IP 'systemctl reload haproxy'
```

**Remove Node** (scale from 3 to 2 nodes - NOT RECOMMENDED):
```bash
# WARNING: Cluster size should remain at 3+ for quorum

# 1. Drain connections
ssh root@$NODE_TO_REMOVE 'systemctl stop patroni valkey openvscode'

# 2. Remove from etcd cluster
ssh root@$NODE1_IP 'etcdctl member remove $MEMBER_ID'

# 3. Remove from HAProxy
# Edit /etc/haproxy/haproxy.cfg and remove backend server
ssh root@$NODE1_IP 'systemctl reload haproxy'

# 4. Decommission VM
terraform apply -var="cluster_size=2"
```

### 4.4 Perform Rolling Update

```bash
# Run the rolling update script
./azure/rolling-update.sh v2.0.0 https://releases.vibecode.com/unified-services-v2.0.0.cpio.gz

# Monitor during update
watch -n 5 'patronictl -c /etc/patroni/patroni.yml list'
```

### 4.5 Backup and Restore

**Manual Backup**:
```bash
# PostgreSQL (via pgBackRest)
ssh root@$NODE1_IP 'pgbackrest --stanza=unified-postgres backup --type=full'

# Valkey (manual RDB snapshot)
ssh root@$NODE1_IP 'redis-cli -a $VALKEY_PASSWORD BGSAVE'
ssh root@$NODE1_IP 'aws s3 cp /var/lib/valkey/dump.rdb s3://backups/valkey/dump-$(date +%Y%m%d-%H%M%S).rdb'
```

**Restore from Backup**:
```bash
# PostgreSQL (point-in-time recovery)
ssh root@$NODE1_IP bash <<'EOF'
systemctl stop patroni
pgbackrest --stanza=unified-postgres \
    --delta \
    --type=time \
    --target="2026-01-05 14:30:00" \
    restore
systemctl start patroni
EOF

# Valkey (restore RDB file)
ssh root@$NODE1_IP bash <<'EOF'
systemctl stop valkey
aws s3 cp s3://backups/valkey/dump-20260105-143000.rdb /var/lib/valkey/dump.rdb
chown valkey:valkey /var/lib/valkey/dump.rdb
systemctl start valkey
EOF
```

### 4.6 Restart Services

**Single Service**:
```bash
# Restart PostgreSQL on one node
ssh root@$NODE2_IP 'systemctl restart patroni'

# Restart Valkey on one node
ssh root@$NODE2_IP 'systemctl restart valkey'

# Restart OpenVSCode on one node
ssh root@$NODE2_IP 'systemctl restart openvscode'
```

**All Services on One Node**:
```bash
# Restart all services on node2 (cluster remains operational)
ssh root@$NODE2_IP 'systemctl restart patroni valkey valkey-sentinel etcd openvscode'
```

**Rolling Restart Across Cluster**:
```bash
# Restart all nodes sequentially (zero downtime)
for node in $NODE3_IP $NODE2_IP $NODE1_IP; do
    echo "Restarting $node..."
    ssh root@$node 'systemctl restart patroni valkey valkey-sentinel'
    sleep 30
    # Verify node rejoined cluster
    ssh root@$NODE1_IP 'patronictl -c /etc/patroni/patroni.yml list'
done
```

---

## 5. Troubleshooting Guide

### 5.1 PostgreSQL Issues

#### Issue: High Replication Lag

**Symptoms**:
- Replication lag >10 seconds
- Standby is significantly behind primary

**Diagnosis**:
```bash
# Check replication status on primary
ssh root@$PRIMARY_IP 'psql -U postgres -c "SELECT * FROM pg_stat_replication;"'

# Check replication slots
ssh root@$PRIMARY_IP 'psql -U postgres -c "SELECT * FROM pg_replication_slots;"'

# Check standby status
ssh root@$STANDBY_IP 'psql -U postgres -c "SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;"'
```

**Possible Causes**:
1. **Network latency**: Check network connectivity and latency between nodes
2. **High write load**: Standby cannot keep up with primary write rate
3. **Resource constraints**: Standby running out of CPU/memory/disk I/O
4. **Long-running query on standby**: Query holding up replay

**Resolution**:
```bash
# If due to long-running query on standby
ssh root@$STANDBY_IP 'psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE query_start < now() - interval '10 minutes';"'

# If due to resource constraints, increase standby resources or reduce primary write load

# If due to network issues, investigate network connectivity
```

#### Issue: Primary Promotion Failed

**Symptoms**:
- Patroni reports failed promotion
- No primary in cluster

**Diagnosis**:
```bash
# Check Patroni logs
ssh root@$NODE_IP 'journalctl -u patroni -n 200'

# Check PostgreSQL logs
ssh root@$NODE_IP 'tail -200 /var/log/postgresql/postgresql-16-main.log'

# Check if PostgreSQL is running
ssh root@$NODE_IP 'pg_isready -U postgres'
```

**Resolution**:
```bash
# Manual promotion
ssh root@$NODE_IP bash <<'EOF'
# Stop Patroni to prevent interference
systemctl stop patroni

# Promote PostgreSQL manually
sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl promote -D /var/lib/postgresql/data

# Update DCS (etcd) with new primary
etcdctl put /service/unified-postgres-cluster/leader '{"node":"node2","address":"192.168.64.12:5432"}'

# Restart Patroni
systemctl start patroni
EOF
```

### 5.2 Valkey Issues

#### Issue: Master Not Found

**Symptoms**:
- Sentinel cannot find master
- Clients cannot connect

**Diagnosis**:
```bash
# Check Sentinel status
ssh root@$NODE1_IP 'redis-cli -p 26379 SENTINEL masters'

# Check Valkey instances
for node in $NODE1_IP $NODE2_IP $NODE3_IP; do
    echo "Checking $node:"
    ssh root@$node 'redis-cli -a $VALKEY_PASSWORD INFO replication | grep role'
done
```

**Resolution**:
```bash
# Reset Sentinel and force reconfiguration
ssh root@$NODE1_IP bash <<'EOF'
# Stop all Sentinels
for node in $NODE1_IP $NODE2_IP $NODE3_IP; do
    ssh root@$node 'systemctl stop valkey-sentinel'
done

# Manually configure master on node1
redis-cli -a $VALKEY_PASSWORD SLAVEOF NO ONE

# Configure replicas
ssh root@$NODE2_IP 'redis-cli -a $VALKEY_PASSWORD SLAVEOF $NODE1_IP 6379'
ssh root@$NODE3_IP 'redis-cli -a $VALKEY_PASSWORD SLAVEOF $NODE1_IP 6379'

# Restart Sentinels
for node in $NODE1_IP $NODE2_IP $NODE3_IP; do
    ssh root@$node 'systemctl start valkey-sentinel'
done
EOF
```

### 5.3 etcd Issues

#### Issue: etcd Cluster Lost Quorum

**Symptoms**:
- etcd has no leader
- Patroni cannot connect to DCS
- Automatic failover disabled

**Diagnosis**:
```bash
# Check etcd member health
for node in $NODE1_IP $NODE2_IP $NODE3_IP; do
    echo "Checking $node:"
    ssh root@$node 'etcdctl endpoint health'
done

# Check etcd logs
ssh root@$NODE1_IP 'journalctl -u etcd -n 500'
```

**Resolution**:
```bash
# If 1 member is down, restart it
ssh root@$DOWN_NODE 'systemctl restart etcd'

# If 2+ members are down, restore from backup
ssh root@$HEALTHY_NODE bash <<'EOF'
# Stop all etcd instances
for node in $NODE1_IP $NODE2_IP $NODE3_IP; do
    ssh root@$node 'systemctl stop etcd'
done

# Restore from snapshot on healthy node
etcdctl snapshot restore /var/backups/etcd/snapshot.db \
    --name node1 \
    --initial-cluster node1=http://$NODE1_IP:2380,node2=http://$NODE2_IP:2380,node3=http://$NODE3_IP:2380 \
    --initial-advertise-peer-urls http://$NODE1_IP:2380 \
    --data-dir /var/lib/etcd

# Start all etcd instances
for node in $NODE1_IP $NODE2_IP $NODE3_IP; do
    ssh root@$node 'systemctl start etcd'
done
EOF
```

### 5.4 Network Issues

#### Issue: Split-Brain Detected

**Symptoms**:
- Multiple primaries/masters exist
- Data inconsistency

**Diagnosis**:
```bash
# Check for multiple PostgreSQL primaries
for node in $NODE1_IP $NODE2_IP $NODE3_IP; do
    echo "Checking $node:"
    ssh root@$node 'psql -U postgres -c "SELECT pg_is_in_recovery();"'
done

# Check for multiple Valkey masters
for node in $NODE1_IP $NODE2_IP $NODE3_IP; do
    echo "Checking $node:"
    ssh root@$node 'redis-cli -a $VALKEY_PASSWORD INFO replication | grep role'
done
```

**Resolution**:
```bash
# This is CRITICAL - requires immediate action

# 1. Identify which side has majority (2+ nodes)
# 2. Fence minority side (shut down services)
ssh root@$MINORITY_NODE bash <<'EOF'
systemctl stop patroni valkey
# Optionally: shutdown -h now  # If fencing required
EOF

# 3. Verify majority side is operational
ssh root@$MAJORITY_NODE 'patronictl -c /etc/patroni/patroni.yml list'

# 4. When network partition heals, rejoin minority node
ssh root@$MINORITY_NODE 'systemctl start patroni valkey'
```

### 5.5 Performance Issues

#### Issue: High CPU Usage

**Diagnosis**:
```bash
# Check which service is consuming CPU
ssh root@$NODE_IP 'top -b -n 1 | head -20'

# Check PostgreSQL query performance
ssh root@$NODE_IP 'psql -U postgres -c "SELECT pid, query, state, query_start FROM pg_stat_activity WHERE state = '\''active'\'';"'

# Check Valkey slowlog
ssh root@$NODE_IP 'redis-cli -a $VALKEY_PASSWORD SLOWLOG GET 10'
```

**Resolution**:
- Kill expensive queries
- Add indexes to PostgreSQL
- Optimize application queries
- Scale up VMs if needed

---

## 6. Emergency Procedures

### 6.1 Complete Cluster Failure

**Scenario**: All 3 nodes are down

**Recovery Steps**:
1. **Assess damage** (5 minutes)
   ```bash
   # Check if any node is responsive
   for node in $NODE1_IP $NODE2_IP $NODE3_IP; do
       ping -c 3 $node
   done
   ```

2. **Recover etcd cluster** (10 minutes)
   ```bash
   # Restore etcd from latest snapshot
   # See etcd Issue Resolution above
   ```

3. **Recover PostgreSQL** (10 minutes)
   ```bash
   # Start Patroni on all nodes
   for node in $NODE1_IP $NODE2_IP $NODE3_IP; do
       ssh root@$node 'systemctl start patroni'
   done
   # Patroni will elect leader automatically
   ```

4. **Recover Valkey** (5 minutes)
   ```bash
   # Start Valkey and Sentinel on all nodes
   for node in $NODE1_IP $NODE2_IP $NODE3_IP; do
       ssh root@$node 'systemctl start valkey valkey-sentinel'
   done
   ```

5. **Verify cluster health** (5 minutes)
   ```bash
   ./azure/cluster-health-check.sh
   ```

**Total Recovery Time Objective**: <30 minutes

### 6.2 Data Corruption

**Scenario**: PostgreSQL database is corrupted

**Recovery Steps**:
1. **Stop application traffic** (immediate)
   ```bash
   # Disable load balancer
   ssh root@$NODE1_IP 'systemctl stop haproxy'
   ```

2. **Assess corruption** (10 minutes)
   ```bash
   # Check PostgreSQL logs
   ssh root@$PRIMARY_IP 'tail -500 /var/log/postgresql/postgresql-16-main.log | grep -i corrupt'

   # Run pg_amcheck (if available)
   ssh root@$PRIMARY_IP 'pg_amcheck -U postgres --all'
   ```

3. **Restore from backup** (varies)
   ```bash
   # See Backup and Restore section
   ```

4. **Re-enable traffic** (5 minutes)
   ```bash
   ssh root@$NODE1_IP 'systemctl start haproxy'
   ```

### 6.3 Security Breach

**Scenario**: Unauthorized access detected

**Immediate Actions**:
1. **Isolate cluster** (immediate)
   ```bash
   # Block all external access via firewall
   for node in $NODE1_IP $NODE2_IP $NODE3_IP; do
       ssh root@$node 'iptables -A INPUT -j DROP -s 0.0.0.0/0'
   done
   ```

2. **Rotate credentials** (15 minutes)
   ```bash
   # Rotate PostgreSQL passwords
   ssh root@$NODE1_IP 'psql -U postgres -c "ALTER USER postgres PASSWORD '\''$NEW_PASSWORD'\'';"'

   # Rotate Valkey password
   # Edit /etc/valkey/valkey.conf, update requirepass
   # Restart Valkey on all nodes
   ```

3. **Audit logs** (ongoing)
   ```bash
   # Review PostgreSQL logs
   ssh root@$NODE1_IP 'grep -i "authentication failed" /var/log/postgresql/postgresql-16-main.log'

   # Review SSH logs
   ssh root@$NODE1_IP 'grep -i "Failed password" /var/log/auth.log'
   ```

4. **Engage security team** (immediate)

---

## 7. Maintenance Windows

### Weekly Maintenance (Sunday 2-4 AM UTC)

**Tasks**:
- Review backups
- Clean up old logs
- Update Datadog dashboards
- Review capacity metrics

**Procedure**:
```bash
# Weekly maintenance script
./scripts/weekly-maintenance.sh
```

### Monthly Maintenance (First Sunday 2-6 AM UTC)

**Tasks**:
- OS security patches
- PostgreSQL minor version upgrades
- Valkey minor version upgrades
- Backup verification
- Performance review

**Procedure**:
```bash
# Monthly maintenance script (rolling update)
./scripts/monthly-maintenance.sh
```

### Quarterly Maintenance (Scheduled)

**Tasks**:
- Major version upgrades
- Infrastructure changes
- Capacity planning review
- DR drill

**Procedure**:
- Schedule in advance
- Communicate to stakeholders
- Follow change management process

---

## 8. Performance Tuning

### PostgreSQL Tuning

**Common Tuning Parameters**:
```ini
# /etc/patroni/patroni.yml
shared_buffers = 25% of RAM
effective_cache_size = 75% of RAM
work_mem = RAM / max_connections / 4
maintenance_work_mem = RAM / 16
max_wal_size = 4GB
checkpoint_completion_target = 0.9
random_page_cost = 1.1 (for SSD)
```

**Apply Changes**:
```bash
# Update Patroni config
ssh root@$NODE1_IP 'patronictl -c /etc/patroni/patroni.yml edit-config'

# Changes will propagate to all nodes automatically
```

### Valkey Tuning

**Common Tuning Parameters**:
```conf
# /etc/valkey/valkey.conf
maxmemory 70% of RAM
maxmemory-policy allkeys-lru
tcp-backlog 511
maxclients 10000
```

**Apply Changes**:
```bash
# Update config and restart
ssh root@$NODE_IP 'systemctl restart valkey'
```

---

## 9. Security Operations

### Password Rotation (Quarterly)

```bash
# Rotate all service passwords
./scripts/rotate-passwords.sh
```

### SSL/TLS Certificate Renewal

```bash
# Renew certificates (Let's Encrypt or corporate CA)
./scripts/renew-certificates.sh
```

### Security Audit

```bash
# Run security audit
./scripts/security-audit.sh
```

---

## 10. On-Call Procedures

### On-Call Responsibilities

1. **Respond to PagerDuty alerts** within 15 minutes
2. **Investigate and resolve** critical issues
3. **Escalate** if needed (senior engineer, manager)
4. **Document** all incidents in runbook
5. **Post-mortem** for major incidents

### Escalation Path

1. **Level 1**: On-call engineer
2. **Level 2**: Senior engineer (if unresolved after 30 min)
3. **Level 3**: Engineering manager (if unresolved after 1 hour)
4. **Level 4**: CTO (for catastrophic failure)

### Communication

- **Slack**: #ops-incidents (all incidents)
- **Email**: ops-team@vibecode.com (non-urgent)
- **PagerDuty**: Automatic for critical alerts

---

## Appendix

### A. Useful Commands

```bash
# Quick cluster status
alias cluster-status='ssh root@$NODE1_IP "patronictl -c /etc/patroni/patroni.yml list && redis-cli -a $VALKEY_PASSWORD -p 26379 SENTINEL masters"'

# Tail all logs
alias tail-logs='ssh root@$NODE1_IP "tail -f /tmp/*.log"'

# Watch HAProxy stats
alias watch-haproxy='watch -n 2 "curl -s http://$NODE1_IP:8404/stats\;csv | grep -v BACKEND | column -t -s,"'
```

### B. Contact Information

- **On-Call Phone**: +1-XXX-XXX-XXXX
- **Slack**: #ops-team
- **Email**: ops-team@vibecode.com
- **Datadog**: https://app.datadoghq.com
- **PagerDuty**: https://vibecode.pagerduty.com

### C. Related Documents

- [AGENT-Z-HIGH-AVAILABILITY-DESIGN.md](./AGENT-Z-HIGH-AVAILABILITY-DESIGN.md) - Architecture design
- [AGENT-Z-DISASTER-RECOVERY.md](./AGENT-Z-DISASTER-RECOVERY.md) - DR procedures
- [azure/cluster-setup.sh](./azure/cluster-setup.sh) - Cluster deployment
- [azure/failover-test.sh](./azure/failover-test.sh) - Failover testing

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-05
**Next Review**: 2026-04-05
**Owner**: Agent Z / Operations Team
