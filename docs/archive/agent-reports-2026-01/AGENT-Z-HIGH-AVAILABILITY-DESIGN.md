# Agent Z: High Availability Architecture Design
# Unified Services VM - Enterprise-Grade HA Solution

**Status**: Production-Ready Design
**Version**: 1.0.0
**Date**: 2026-01-05
**Author**: Agent Z (HA and Clustering Specialist)

---

## Executive Summary

This document presents a comprehensive high availability (HA) architecture for the Unified Services VM, transforming it from a single-node deployment into a robust, enterprise-grade 3-node cluster capable of surviving node failures, network partitions, and supporting zero-downtime updates.

### Key Metrics
- **Target Availability**: 99.95% (4.38 hours downtime/year)
- **Failover Time**: <30 seconds (automatic)
- **RPO (Recovery Point Objective)**: <5 minutes
- **RTO (Recovery Time Objective)**: <5 minutes
- **Data Durability**: 99.999999999% (11 nines)

### Architecture Highlights
- 3-node cluster with quorum-based decision making
- Active-active for stateless services (OpenVSCode, SSH)
- Active-passive for stateful services (PostgreSQL, Valkey)
- Automatic failover with no manual intervention
- Zero data loss for committed transactions
- Multi-cloud deployment support

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [HA Architecture Overview](#ha-architecture-overview)
3. [Service-Specific HA Designs](#service-specific-ha-designs)
4. [Distributed Coordination](#distributed-coordination)
5. [Load Balancing Strategy](#load-balancing-strategy)
6. [Data Replication](#data-replication)
7. [Failure Detection & Recovery](#failure-detection--recovery)
8. [Zero-Downtime Updates](#zero-downtime-updates)
9. [Disaster Recovery](#disaster-recovery)
10. [Network Architecture](#network-architecture)
11. [Split-Brain Prevention](#split-brain-prevention)
12. [Monitoring & Alerting](#monitoring--alerting)
13. [Multi-Cloud Support](#multi-cloud-support)
14. [Implementation Roadmap](#implementation-roadmap)

---

## 1. Current State Analysis

### Single-Node Architecture (Current)

```
┌─────────────────────────────────────┐
│      Unified Services VM (Single)   │
│                                      │
│  ┌──────────┐  ┌───────────────┐   │
│  │ Valkey   │  │  PostgreSQL   │   │
│  │ Port 6379│  │  Port 5432    │   │
│  └──────────┘  └───────────────┘   │
│                                      │
│  ┌──────────────────────────────┐  │
│  │     OpenVSCode Server        │  │
│  │        Port 8080             │  │
│  └──────────────────────────────┘  │
│                                      │
│  ┌──────────────────────────────┐  │
│  │      Dropbear SSH            │  │
│  │        Port 22               │  │
│  └──────────────────────────────┘  │
│                                      │
│  VM IP: 192.168.64.10               │
└─────────────────────────────────────┘
```

### Problems with Current Architecture

1. **Single Point of Failure (SPOF)**
   - VM failure = total outage
   - No redundancy for any service
   - Hardware failure causes data loss

2. **No Failover Capability**
   - Manual intervention required for recovery
   - Long recovery times (>30 minutes)
   - Risk of human error during recovery

3. **No Load Distribution**
   - Single VM handles all traffic
   - No horizontal scaling
   - Performance bottlenecks

4. **Downtime During Updates**
   - Maintenance requires full shutdown
   - No rolling update capability
   - Service interruption for patches

5. **Data Loss Risk**
   - No replication
   - Backup-only recovery (RPO: hours)
   - No point-in-time recovery

---

## 2. HA Architecture Overview

### 3-Node Cluster Architecture

```
                         ┌─────────────────────┐
                         │   HAProxy / nginx   │
                         │   Load Balancer     │
                         │   VIP: 192.168.64.10│
                         └──────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
     ┌────────────────┐    ┌────────────────┐    ┌────────────────┐
     │   Node 1       │    │   Node 2       │    │   Node 3       │
     │ (Primary)      │    │ (Replica)      │    │ (Replica)      │
     │                │    │                │    │                │
     │ 192.168.64.11  │    │ 192.168.64.12  │    │ 192.168.64.13  │
     └────────────────┘    └────────────────┘    └────────────────┘
              │                     │                     │
              └─────────────────────┴─────────────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │   etcd Cluster      │
                         │  (Distributed KV)   │
                         │   3-node quorum     │
                         └─────────────────────┘
```

### Node Configuration

Each node runs:
- **Stateless Services**: OpenVSCode, SSH (active on all nodes)
- **Stateful Services**: PostgreSQL, Valkey (active-passive with failover)
- **etcd Client**: For distributed coordination
- **Health Check Agent**: Continuous monitoring
- **Datadog Agent**: Metrics and alerting

### High-Level Design Principles

1. **Quorum-Based Decision Making**
   - 3 nodes ensure majority voting (2 of 3)
   - Prevents split-brain scenarios
   - Automatic leader election

2. **Service Isolation**
   - Each service has independent HA strategy
   - Failure of one service doesn't affect others
   - Service-specific health checks

3. **Layered Redundancy**
   - Application layer: Multiple instances
   - Data layer: Streaming replication
   - Network layer: Multiple paths
   - Infrastructure layer: Multi-AZ deployment

4. **Graceful Degradation**
   - System remains operational with 2 nodes
   - Read-only mode if majority lost
   - Automatic recovery when nodes rejoin

---

## 3. Service-Specific HA Designs

### 3.1 PostgreSQL HA with Patroni

**Architecture**: Active-Passive with Streaming Replication

```
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL HA Cluster                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   │   Node 1     │      │   Node 2     │      │   Node 3     │
│   │              │      │              │      │              │
│   │ PostgreSQL   │──────│ PostgreSQL   │──────│ PostgreSQL   │
│   │  (Primary)   │ WAL  │  (Standby)   │ WAL  │  (Standby)   │
│   │              │ Rep  │              │ Rep  │              │
│   │   Patroni    │      │   Patroni    │      │   Patroni    │
│   │   (Leader)   │      │  (Replica)   │      │  (Replica)   │
│   └──────┬───────┘      └──────┬───────┘      └──────┬───────┘
│          │                     │                     │
│          └─────────────────────┴─────────────────────┘
│                                │
│                    ┌───────────▼───────────┐
│                    │    etcd Cluster       │
│                    │  (DCS - Leader Key)   │
│                    └───────────────────────┘
│                                │
│                    ┌───────────▼───────────┐
│                    │     PgBouncer         │
│                    │  (Connection Pool)    │
│                    │   Port: 5432          │
│                    └───────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

**Key Components**:

1. **Patroni** (HA Orchestrator)
   - Manages PostgreSQL replication
   - Automatic failover (<30s)
   - Health checks and monitoring
   - etcd integration for leader election

2. **Streaming Replication**
   - Synchronous replication to 1 standby (zero data loss)
   - Asynchronous replication to 2nd standby (performance)
   - WAL archiving for point-in-time recovery

3. **PgBouncer** (Connection Pooler)
   - Connection pooling (reduces overhead)
   - Transparent failover to clients
   - Query routing (write to primary, reads to replicas)

**Configuration**:

```yaml
# Patroni Configuration (/etc/patroni/patroni.yml)
scope: unified-postgres-cluster
name: node1  # unique per node

restapi:
  listen: 0.0.0.0:8008
  connect_address: 192.168.64.11:8008

etcd:
  hosts: 192.168.64.11:2379,192.168.64.12:2379,192.168.64.13:2379

bootstrap:
  dcs:
    ttl: 30
    loop_wait: 10
    retry_timeout: 10
    maximum_lag_on_failover: 1048576
    postgresql:
      use_pg_rewind: true
      parameters:
        max_connections: 100
        shared_buffers: 256MB
        effective_cache_size: 1GB
        wal_level: replica
        hot_standby: on
        max_wal_senders: 10
        max_replication_slots: 10
        wal_keep_size: 512MB
        synchronous_commit: on
        synchronous_standby_names: 'node2'  # Zero data loss

postgresql:
  listen: 0.0.0.0:5432
  connect_address: 192.168.64.11:5432
  data_dir: /var/lib/postgresql/data
  bin_dir: /usr/libexec/postgresql16
  authentication:
    replication:
      username: replicator
      password: ${REPLICATION_PASSWORD}
    superuser:
      username: postgres
      password: ${POSTGRES_PASSWORD}

tags:
  nofailover: false
  noloadbalance: false
  clonefrom: false
  nosync: false
```

**Failover Process**:

1. **Detection** (5-10 seconds)
   - Patroni monitors PostgreSQL health every 10s
   - etcd TTL expires if primary becomes unreachable
   - Replica nodes detect leader key absence

2. **Election** (5-10 seconds)
   - Standby nodes race to acquire leader key in etcd
   - Node with most recent WAL position wins
   - New leader updates etcd with its connect_address

3. **Promotion** (5-10 seconds)
   - Winning standby promotes itself to primary
   - Runs pg_rewind to ensure consistency
   - Starts accepting write connections

4. **Reconnection** (<5 seconds)
   - PgBouncer detects new primary via etcd
   - Redirects connections to new primary
   - Old primary rejoins as standby (if recoverable)

**Total Failover Time**: 20-30 seconds

### 3.2 Valkey HA with Sentinel

**Architecture**: Active-Passive with Sentinel Monitoring

```
┌─────────────────────────────────────────────────────────────┐
│                    Valkey HA Cluster                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   │   Node 1     │      │   Node 2     │      │   Node 3     │
│   │              │      │              │      │              │
│   │   Valkey     │──────│   Valkey     │──────│   Valkey     │
│   │  (Master)    │ Rep  │  (Replica)   │ Rep  │  (Replica)   │
│   │ Port: 6379   │      │ Port: 6379   │      │ Port: 6379   │
│   │              │      │              │      │              │
│   │  Sentinel    │──────│  Sentinel    │──────│  Sentinel    │
│   │ Port: 26379  │ Gossip│ Port: 26379 │ Gossip│ Port: 26379  │
│   └──────────────┘      └──────────────┘      └──────────────┘
│                                                             │
│   Sentinel Monitors:                                        │
│   - Master health (PING every 1s)                          │
│   - Replica health (PING every 1s)                         │
│   - Quorum: 2 out of 3 for failover decision              │
└─────────────────────────────────────────────────────────────┘
```

**Key Components**:

1. **Valkey Sentinel**
   - Monitors master and replica health
   - Automatic failover on master failure
   - Notifies clients of topology changes
   - Quorum-based decision making

2. **Master-Replica Replication**
   - Asynchronous replication (performance)
   - Full resync on replica join
   - Partial resync on network hiccups

3. **Client-Side Failover**
   - Clients connect to Sentinel
   - Sentinel provides current master address
   - Automatic reconnection on failover

**Configuration**:

```conf
# Valkey Master Configuration (/etc/valkey/valkey.conf)
bind 0.0.0.0
port 6379
protected-mode no

# Replication
replicaof <master-ip> 6379  # Only on replicas
masterauth ${VALKEY_PASSWORD}
replica-read-only yes

# Persistence
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec

# Memory
maxmemory 1gb
maxmemory-policy allkeys-lru

# Sentinel Configuration (/etc/valkey/sentinel.conf)
port 26379
sentinel monitor unified-valkey 192.168.64.11 6379 2
sentinel down-after-milliseconds unified-valkey 5000
sentinel parallel-syncs unified-valkey 1
sentinel failover-timeout unified-valkey 30000
sentinel auth-pass unified-valkey ${VALKEY_PASSWORD}

# Notification scripts (optional)
sentinel notification-script unified-valkey /etc/valkey/notify.sh
sentinel client-reconfig-script unified-valkey /etc/valkey/reconfig.sh
```

**Failover Process**:

1. **Detection** (5 seconds)
   - Sentinel PINGs master every 1s
   - After 5 failed PINGs, master marked as SDOWN (Subjectively Down)
   - Sentinels exchange opinions via gossip

2. **Quorum** (1-2 seconds)
   - If 2+ Sentinels agree, master marked as ODOWN (Objectively Down)
   - Failover initiated

3. **Election** (1-2 seconds)
   - Sentinels elect a leader to perform failover
   - Leader selects best replica (lowest lag, highest priority)

4. **Promotion** (5-10 seconds)
   - Leader sends SLAVEOF NO ONE to selected replica
   - Replica becomes new master
   - Other replicas reconfigured to replicate from new master

5. **Notification** (1-2 seconds)
   - Sentinels update their configs
   - Clients notified of new master via Pub/Sub

**Total Failover Time**: 15-20 seconds

### 3.3 OpenVSCode HA (Active-Active)

**Architecture**: Active-Active with Shared Workspace

```
┌─────────────────────────────────────────────────────────────┐
│                  OpenVSCode HA Cluster                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   │   Node 1     │      │   Node 2     │      │   Node 3     │
│   │              │      │              │      │              │
│   │ OpenVSCode   │      │ OpenVSCode   │      │ OpenVSCode   │
│   │ Port: 8080   │      │ Port: 8080   │      │ Port: 8080   │
│   │  (Active)    │      │  (Active)    │      │  (Active)    │
│   └──────┬───────┘      └──────┬───────┘      └──────┬───────┘
│          │                     │                     │
│          └─────────────────────┴─────────────────────┘
│                                │
│                    ┌───────────▼───────────┐
│                    │    Shared Filesystem  │
│                    │   (NFS / virtio-fs)   │
│                    │   /mnt/host/workspace │
│                    └───────────────────────┘
│                                │
│                    ┌───────────▼───────────┐
│                    │  Session Storage      │
│                    │  (PostgreSQL)         │
│                    │  sessions table       │
│                    └───────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

**Key Components**:

1. **Stateless OpenVSCode Instances**
   - No local state storage
   - Session data in PostgreSQL
   - Workspace on shared filesystem

2. **Shared Workspace**
   - NFS or virtio-fs for file access
   - Concurrent access from all nodes
   - File locking for consistency

3. **Session Persistence**
   - Store sessions in PostgreSQL
   - Load balancer sticky sessions (optional)
   - WebSocket connection persistence

**Configuration**:

```bash
#!/bin/bash
# OpenVSCode HA Startup Script

# Shared workspace mount
mount -t nfs 192.168.64.10:/workspace /mnt/host/workspace

# Start OpenVSCode with shared data
/opt/openvscode/bin/openvscode-server \
  --host 0.0.0.0 \
  --port 8080 \
  --without-connection-token \
  --accept-server-license-terms \
  --user-data-dir /mnt/host/workspace/.vscode-data \
  --extensions-dir /mnt/host/workspace/.vscode-extensions
```

**Load Balancing**:
- Round-robin distribution
- WebSocket affinity (sticky sessions)
- Health check on `/healthz` endpoint

### 3.4 SSH HA (Active-Active)

**Architecture**: Simple DNS Round-Robin

```
┌─────────────────────────────────────────────────────────────┐
│                      SSH HA Cluster                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   │   Node 1     │      │   Node 2     │      │   Node 3     │
│   │              │      │              │      │              │
│   │ Dropbear SSH │      │ Dropbear SSH │      │ Dropbear SSH │
│   │  Port: 22    │      │  Port: 22    │      │  Port: 22    │
│   │  (Active)    │      │  (Active)    │      │  (Active)    │
│   └──────────────┘      └──────────────┘      └──────────────┘
│                                                             │
│   DNS Round-Robin:                                          │
│   unified-vm.local → 192.168.64.11                         │
│                    → 192.168.64.12                         │
│                    → 192.168.64.13                         │
└─────────────────────────────────────────────────────────────┘
```

**Configuration**:
- Same SSH host keys on all nodes
- Shared `/home` directory (optional)
- Load balancer distributes connections

---

## 4. Distributed Coordination

### etcd Cluster for DCS (Distributed Configuration Store)

**Why etcd?**
- Strong consistency (Raft consensus)
- Built-in leader election
- Watch API for real-time updates
- Proven in production (Kubernetes)
- Low latency (<10ms for operations)

**etcd Architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                    etcd Cluster (3 nodes)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   │   Node 1     │      │   Node 2     │      │   Node 3     │
│   │              │      │              │      │              │
│   │  etcd        │◄────►│  etcd        │◄────►│  etcd        │
│   │  (Leader)    │ Raft │  (Follower)  │ Raft │  (Follower)  │
│   │ Port: 2379   │      │ Port: 2379   │      │ Port: 2379   │
│   │ Peer: 2380   │      │ Peer: 2380   │      │ Peer: 2380   │
│   └──────────────┘      └──────────────┘      └──────────────┘
│                                                             │
│   Stored Data:                                              │
│   - PostgreSQL leader key                                   │
│   - Valkey master address                                   │
│   - Cluster membership                                      │
│   - Configuration                                           │
└─────────────────────────────────────────────────────────────┘
```

**etcd Configuration**:

```yaml
# /etc/etcd/etcd.conf.yml
name: node1
data-dir: /var/lib/etcd
listen-peer-urls: http://192.168.64.11:2380
listen-client-urls: http://192.168.64.11:2379,http://127.0.0.1:2379
initial-advertise-peer-urls: http://192.168.64.11:2380
advertise-client-urls: http://192.168.64.11:2379
initial-cluster: node1=http://192.168.64.11:2380,node2=http://192.168.64.12:2380,node3=http://192.168.64.13:2380
initial-cluster-state: new
initial-cluster-token: unified-cluster
heartbeat-interval: 100
election-timeout: 1000
```

**Data Stored in etcd**:

1. **PostgreSQL Leader Key**
   ```
   /service/unified-postgres-cluster/leader → {"node": "node1", "address": "192.168.64.11:5432"}
   ```

2. **Valkey Master Address**
   ```
   /service/unified-valkey/master → {"node": "node1", "address": "192.168.64.11:6379"}
   ```

3. **Cluster Membership**
   ```
   /cluster/members/node1 → {"status": "healthy", "services": ["postgres", "valkey", "vscode"]}
   /cluster/members/node2 → {"status": "healthy", "services": ["postgres", "valkey", "vscode"]}
   /cluster/members/node3 → {"status": "healthy", "services": ["postgres", "valkey", "vscode"]}
   ```

---

## 5. Load Balancing Strategy

### HAProxy Configuration

**HAProxy** provides:
- Layer 4 (TCP) and Layer 7 (HTTP) load balancing
- Health checks for backend services
- SSL termination
- Session persistence
- High performance (100k+ connections/sec)

**Architecture**:

```
                    ┌─────────────────┐
                    │   HAProxy       │
                    │   VIP: .64.10   │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    PostgreSQL           Valkey             OpenVSCode
    Port: 5432          Port: 6379          Port: 8080
         │                   │                   │
    ┌────┴────┐         ┌────┴────┐         ┌────┴────┐
    │ Node 1  │         │ Node 1  │         │ Node 1  │
    │(Primary)│         │(Master) │         │(Active) │
    ├─────────┤         ├─────────┤         ├─────────┤
    │ Node 2  │         │ Node 2  │         │ Node 2  │
    │(Standby)│         │(Replica)│         │(Active) │
    ├─────────┤         ├─────────┤         ├─────────┤
    │ Node 3  │         │ Node 3  │         │ Node 3  │
    │(Standby)│         │(Replica)│         │(Active) │
    └─────────┘         └─────────┘         └─────────┘
```

**HAProxy Configuration** (`/etc/haproxy/haproxy.cfg`):

```haproxy
global
    log /dev/log local0
    log /dev/log local1 notice
    maxconn 10000
    user haproxy
    group haproxy
    daemon

defaults
    log     global
    mode    tcp
    option  tcplog
    option  dontlognull
    timeout connect 5000
    timeout client  50000
    timeout server  50000

# PostgreSQL Backend (writes to primary only)
listen postgresql_primary
    bind *:5432
    mode tcp
    option httpchk
    http-check expect status 200
    default-server inter 3s fall 3 rise 2
    server node1 192.168.64.11:5432 check port 8008 check-ssl verify none
    server node2 192.168.64.12:5432 check port 8008 check-ssl verify none backup
    server node3 192.168.64.13:5432 check port 8008 check-ssl verify none backup

# PostgreSQL Read Replicas (load balanced reads)
listen postgresql_replicas
    bind *:5433
    mode tcp
    balance roundrobin
    option httpchk
    http-check expect status 200
    default-server inter 3s fall 3 rise 2
    server node2 192.168.64.12:5432 check port 8008
    server node3 192.168.64.13:5432 check port 8008

# Valkey Backend (writes to master only)
listen valkey_master
    bind *:6379
    mode tcp
    balance first
    option tcp-check
    tcp-check send PING\r\n
    tcp-check expect string +PONG
    tcp-check send info\ replication\r\n
    tcp-check expect string role:master
    server node1 192.168.64.11:6379 check inter 1s
    server node2 192.168.64.12:6379 check inter 1s
    server node3 192.168.64.13:6379 check inter 1s

# OpenVSCode Backend (active-active)
listen openvscode
    bind *:8080
    mode http
    balance roundrobin
    option httpchk GET /healthz
    http-check expect status 200
    cookie SERVERID insert indirect nocache
    default-server inter 3s fall 3 rise 2
    server node1 192.168.64.11:8080 check cookie node1
    server node2 192.168.64.12:8080 check cookie node2
    server node3 192.168.64.13:8080 check cookie node3

# SSH Backend (active-active)
listen ssh
    bind *:22
    mode tcp
    balance roundrobin
    option tcp-check
    server node1 192.168.64.11:22 check
    server node2 192.168.64.12:22 check
    server node3 192.168.64.13:22 check

# HAProxy Stats
listen stats
    bind *:8404
    mode http
    stats enable
    stats uri /stats
    stats refresh 10s
    stats auth admin:${HAPROXY_STATS_PASSWORD}
```

**Health Check Strategy**:

1. **PostgreSQL**: Check Patroni REST API (port 8008)
   - `GET /primary` returns 200 if node is primary
   - `GET /replica` returns 200 if node is replica
   - Automatic promotion detection

2. **Valkey**: Redis protocol health check
   - Send `PING`, expect `+PONG`
   - Send `INFO REPLICATION`, check `role:master`
   - Detects master via protocol, not config

3. **OpenVSCode**: HTTP health endpoint
   - `GET /healthz` returns 200 if healthy
   - Checks internal service status
   - Fast response (<100ms)

---

## 6. Data Replication

### PostgreSQL Streaming Replication

**Replication Topology**:

```
                ┌────────────────┐
                │   Primary      │
                │   Node 1       │
                │   WAL Sender   │
                └────────┬───────┘
                         │
         ┌───────────────┴───────────────┐
         │ WAL Stream                    │
         │ (Synchronous to Node 2)       │
         │ (Asynchronous to Node 3)      │
         │                               │
    ┌────▼─────┐                   ┌────▼─────┐
    │ Standby  │                   │ Standby  │
    │ Node 2   │                   │ Node 3   │
    │ Sync Rep │                   │ Async Rep│
    └──────────┘                   └──────────┘
```

**Synchronous vs Asynchronous**:

- **Node 1 → Node 2**: Synchronous (zero data loss)
  - Primary waits for WAL to be flushed to Node 2
  - Transaction not committed until Node 2 acknowledges
  - Latency: +1-5ms per transaction

- **Node 1 → Node 3**: Asynchronous (performance)
  - Primary doesn't wait for Node 3
  - Node 3 may lag behind slightly
  - No impact on transaction latency

**Configuration** (`postgresql.conf`):

```ini
# Replication
wal_level = replica
max_wal_senders = 10
max_replication_slots = 10
wal_keep_size = 1GB
hot_standby = on
hot_standby_feedback = on

# Synchronous Replication (zero data loss)
synchronous_commit = on
synchronous_standby_names = 'node2'  # Wait for Node 2 only

# Streaming
wal_sender_timeout = 60s
wal_receiver_status_interval = 10s
wal_receiver_timeout = 60s

# Standby
hot_standby_feedback = on
max_standby_streaming_delay = 30s
```

**Replication Monitoring**:

```sql
-- On primary: Check replication lag
SELECT
  client_addr,
  state,
  sync_state,
  pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn) AS send_lag_bytes,
  pg_wal_lsn_diff(pg_current_wal_lsn(), write_lsn) AS write_lag_bytes,
  pg_wal_lsn_diff(pg_current_wal_lsn(), flush_lsn) AS flush_lag_bytes,
  pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS replay_lag_bytes
FROM pg_stat_replication;

-- Expected output:
--  client_addr  | state     | sync_state | send_lag | write_lag | flush_lag | replay_lag
-- --------------|-----------|------------|----------|-----------|-----------|------------
-- 192.168.64.12 | streaming | sync       | 0        | 0         | 0         | 16384
-- 192.168.64.13 | streaming | async      | 0        | 0         | 65536     | 131072
```

### Valkey Replication

**Replication Topology**:

```
                ┌────────────────┐
                │   Master       │
                │   Node 1       │
                └────────┬───────┘
                         │
         ┌───────────────┴───────────────┐
         │ Asynchronous Replication      │
         │ (Command stream)              │
         │                               │
    ┌────▼─────┐                   ┌────▼─────┐
    │ Replica  │                   │ Replica  │
    │ Node 2   │                   │ Node 3   │
    └──────────┘                   └──────────┘
```

**Replication Characteristics**:

- **Asynchronous**: No impact on write performance
- **Full Resync**: Complete data transfer on initial connect
- **Partial Resync**: Only missing data on reconnect
- **Read Replicas**: Can serve read-only queries

**Configuration** (`valkey.conf`):

```conf
# On replicas only
replicaof 192.168.64.11 6379
masterauth ${VALKEY_PASSWORD}

# Replica settings
replica-read-only yes
replica-serve-stale-data yes
replica-priority 100

# Replication backlog (for partial resync)
repl-backlog-size 64mb
repl-backlog-ttl 3600

# Disk persistence (for recovery)
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
```

**Replication Monitoring**:

```bash
# On master: Check replication status
redis-cli INFO REPLICATION

# Expected output:
# role:master
# connected_slaves:2
# slave0:ip=192.168.64.12,port=6379,state=online,offset=12345,lag=0
# slave1:ip=192.168.64.13,port=6379,state=online,offset=12340,lag=1
```

---

## 7. Failure Detection & Recovery

### Health Monitoring Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Health Monitoring System                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────────────────────────────────────────┐    │
│   │           Datadog Agent (on each node)           │    │
│   │  - Service health checks (every 10s)             │    │
│   │  - System metrics (CPU, memory, disk)            │    │
│   │  - Network connectivity tests                    │    │
│   │  - Custom metrics from services                  │    │
│   └────────────────────┬─────────────────────────────┘    │
│                        │                                   │
│   ┌────────────────────▼─────────────────────────────┐    │
│   │         Datadog Platform (SaaS)                  │    │
│   │  - Alerting (PagerDuty, Slack, Email)           │    │
│   │  - Dashboards (real-time visualization)         │    │
│   │  - Anomaly detection (ML-based)                  │    │
│   └────────────────────┬─────────────────────────────┘    │
│                        │                                   │
│   ┌────────────────────▼─────────────────────────────┐    │
│   │         Automatic Remediation                    │    │
│   │  - Patroni: Automatic PostgreSQL failover       │    │
│   │  - Sentinel: Automatic Valkey failover          │    │
│   │  - HAProxy: Automatic backend removal           │    │
│   │  - Alerting: Human intervention if needed       │    │
│   └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Failure Scenarios & Response

#### Scenario 1: Primary PostgreSQL Node Failure

**Detection**:
1. Patroni health check fails on Node 1 (10s interval)
2. etcd TTL expires (30s)
3. Standby nodes detect leader key absence

**Response**:
1. Patroni on Node 2 and Node 3 race to acquire leader key
2. Node 2 (sync standby) wins due to lowest lag
3. Node 2 promotes itself to primary (`pg_ctl promote`)
4. Node 3 reconfigures to replicate from Node 2
5. HAProxy detects new primary via Patroni REST API
6. Clients transparently reconnected to Node 2

**Recovery Time**: 20-30 seconds
**Data Loss**: Zero (synchronous replication)

#### Scenario 2: Valkey Master Node Failure

**Detection**:
1. Sentinel PINGs master every 1s
2. After 5 failed PINGs (5s), master marked SDOWN
3. Sentinels exchange opinions, agree on ODOWN

**Response**:
1. Sentinels elect leader (1-2s)
2. Leader selects best replica (Node 2)
3. Leader promotes Node 2 to master
4. Node 3 reconfigured to replicate from Node 2
5. Sentinels notify clients via Pub/Sub
6. HAProxy detects new master via health check

**Recovery Time**: 15-20 seconds
**Data Loss**: Minimal (last few commands in replication buffer)

#### Scenario 3: Network Partition (Split-Brain Risk)

**Detection**:
1. etcd cluster detects partition via Raft heartbeats
2. Majority side (2+ nodes) continues operation
3. Minority side (1 node) becomes read-only

**Response**:
1. Majority side maintains quorum
2. Minority side cannot elect new leaders
3. PostgreSQL on minority side enters read-only mode
4. Valkey on minority side cannot become master
5. When partition heals, minority rejoins cluster
6. Data reconciliation via WAL replay (PostgreSQL) or resync (Valkey)

**Recovery Time**: Automatic when partition heals
**Data Loss**: Zero (quorum prevents split writes)

#### Scenario 4: Complete Node Failure (Hardware)

**Detection**:
1. All services on node become unreachable
2. etcd marks node as down
3. Patroni and Sentinel detect failures

**Response**:
1. PostgreSQL and Valkey failover (as above)
2. OpenVSCode and SSH connections redistributed by HAProxy
3. New node provisioned (manual or auto-scaling)
4. New node joins cluster automatically
5. Data resynced from primaries

**Recovery Time**: 20-30s (failover) + manual provisioning
**Data Loss**: Zero for PostgreSQL, minimal for Valkey

### Alerting Configuration

**Datadog Monitors**:

```yaml
# PostgreSQL Primary Down
- name: "PostgreSQL Primary Unavailable"
  type: service_check
  query: '"postgres.can_connect".over("role:primary").by("host").last(3).count_by_status()'
  message: |
    PostgreSQL primary is down!
    Failover should be automatic via Patroni.
    Check: https://app.datadoghq.com/dash/unified-services
  escalation_message: "PostgreSQL primary still down after 5 minutes!"
  notify:
    - "@pagerduty"
    - "@slack-ops"
  thresholds:
    critical: 3
    warning: 2

# Valkey Master Down
- name: "Valkey Master Unavailable"
  type: service_check
  query: '"valkey.can_connect".over("role:master").by("host").last(2).count_by_status()'
  message: |
    Valkey master is down!
    Failover should be automatic via Sentinel.
  notify:
    - "@pagerduty"
    - "@slack-ops"
  thresholds:
    critical: 2

# Cluster Quorum Lost
- name: "etcd Cluster Quorum Lost"
  type: metric alert
  query: 'sum(last_5m):avg:etcd.server.has_leader{cluster:unified} < 1'
  message: |
    CRITICAL: etcd cluster has lost quorum!
    Cluster cannot perform failovers.
    IMMEDIATE ACTION REQUIRED.
  notify:
    - "@pagerduty-critical"
    - "@slack-oncall"
  thresholds:
    critical: 1

# Replication Lag
- name: "PostgreSQL Replication Lag High"
  type: metric alert
  query: 'avg(last_5m):avg:postgresql.replication_delay{role:standby} > 60'
  message: "PostgreSQL replication lag is high (>60s). Investigate immediately."
  notify:
    - "@slack-ops"
  thresholds:
    critical: 60
    warning: 30
```

---

## 8. Zero-Downtime Updates

### Rolling Update Strategy

**Principle**: Update one node at a time while cluster remains operational

**Process**:

```
Step 1: Update Node 3 (Standby/Replica)
┌────────┐    ┌────────┐    ┌────────┐
│ Node 1 │    │ Node 2 │    │ Node 3 │
│PRIMARY │    │STANDBY │    │STANDBY │
│ MASTER │    │REPLICA │    │REPLICA │
│ ACTIVE │    │ ACTIVE │    │UPDATING│ ← Drain connections
└────────┘    └────────┘    └────────┘
                                ↓
                            Shutdown
                            Update binaries
                            Update configs
                            Restart
                                ↓
┌────────┐    ┌────────┐    ┌────────┐
│ Node 1 │    │ Node 2 │    │ Node 3 │
│PRIMARY │    │STANDBY │    │STANDBY │
│ MASTER │    │REPLICA │    │REPLICA │
│ ACTIVE │    │ ACTIVE │    │ ACTIVE │ ← Rejoin cluster
└────────┘    └────────┘    └────────┘

Step 2: Update Node 2 (Standby/Replica)
┌────────┐    ┌────────┐    ┌────────┐
│ Node 1 │    │ Node 2 │    │ Node 3 │
│PRIMARY │    │STANDBY │    │STANDBY │
│ MASTER │    │REPLICA │    │REPLICA │
│ ACTIVE │    │UPDATING│    │ ACTIVE │ ← Drain connections
└────────┘    └────────┘    └────────┘
                  ↓
              (same process)

Step 3: Failover to Node 2, Update Node 1
┌────────┐    ┌────────┐    ┌────────┐
│ Node 1 │    │ Node 2 │    │ Node 3 │
│STANDBY │    │PRIMARY │    │STANDBY │ ← Promote Node 2
│REPLICA │    │ MASTER │    │REPLICA │
│ ACTIVE │    │ ACTIVE │    │ ACTIVE │
└────────┘    └────────┘    └────────┘
     ↓
┌────────┐    ┌────────┐    ┌────────┐
│ Node 1 │    │ Node 2 │    │ Node 3 │
│STANDBY │    │PRIMARY │    │STANDBY │
│REPLICA │    │ MASTER │    │REPLICA │
│UPDATING│    │ ACTIVE │    │ ACTIVE │ ← Update Node 1
└────────┘    └────────┘    └────────┘
     ↓
┌────────┐    ┌────────┐    ┌────────┐
│ Node 1 │    │ Node 2 │    │ Node 3 │
│STANDBY │    │PRIMARY │    │STANDBY │
│REPLICA │    │ MASTER │    │REPLICA │
│ ACTIVE │    │ ACTIVE │    │ ACTIVE │ ← Complete
└────────┘    └────────┘    └────────┘

Optional: Failback to Node 1 (if desired)
```

**Update Script** (`/usr/local/bin/rolling-update.sh`):

```bash
#!/bin/bash
# Rolling Update Script for Unified Services HA Cluster

set -euo pipefail

NEW_VERSION="$1"
UPDATE_URL="$2"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
error() { echo "[ERROR] $*" >&2; exit 1; }

# Download new version
log "Downloading new version: $NEW_VERSION"
wget "$UPDATE_URL" -O /tmp/unified-services-${NEW_VERSION}.cpio.gz || error "Download failed"

# Verify checksum
log "Verifying checksum..."
# ... checksum verification ...

# Update sequence
NODES=("node3" "node2" "node1")  # Standby nodes first, primary last

for node in "${NODES[@]}"; do
    log "Updating $node..."

    # If this is the primary node, trigger failover first
    if [ "$node" = "node1" ]; then
        log "Triggering controlled failover before updating primary..."
        ssh node2 'sudo patronictl failover unified-postgres-cluster --candidate node2 --force'
        sleep 30  # Wait for failover to complete
    fi

    # Drain connections from HAProxy
    log "Draining connections from $node..."
    echo "set server postgresql_primary/$node state maint" | \
        socat stdio /var/run/haproxy.sock
    echo "set server valkey_master/$node state maint" | \
        socat stdio /var/run/haproxy.sock
    echo "set server openvscode/$node state maint" | \
        socat stdio /var/run/haproxy.sock

    sleep 10  # Allow existing connections to finish

    # Update the node
    log "Updating binaries on $node..."
    ssh "$node" 'sudo systemctl stop unified-services'
    scp /tmp/unified-services-${NEW_VERSION}.cpio.gz ${node}:/boot/
    ssh "$node" 'sudo systemctl start unified-services'

    # Wait for node to become healthy
    log "Waiting for $node to become healthy..."
    for i in {1..60}; do
        if ssh "$node" 'systemctl is-active unified-services' | grep -q active; then
            log "$node is healthy"
            break
        fi
        sleep 5
    done

    # Re-enable in HAProxy
    log "Re-enabling $node in HAProxy..."
    echo "set server postgresql_primary/$node state ready" | \
        socat stdio /var/run/haproxy.sock
    echo "set server valkey_master/$node state ready" | \
        socat stdio /var/run/haproxy.sock
    echo "set server openvscode/$node state ready" | \
        socat stdio /var/run/haproxy.sock

    log "$node update complete"
    sleep 30  # Wait before next node
done

log "Rolling update complete! All nodes running version $NEW_VERSION"
```

**Testing Zero-Downtime**:

```bash
# Run continuous traffic during update
while true; do
    # PostgreSQL
    psql -h 192.168.64.10 -U postgres -c "SELECT now();" || echo "PostgreSQL failed"

    # Valkey
    redis-cli -h 192.168.64.10 PING || echo "Valkey failed"

    # OpenVSCode
    curl -s http://192.168.64.10:8080/healthz || echo "OpenVSCode failed"

    sleep 1
done

# Run rolling update
./rolling-update.sh v2.0.0 https://example.com/unified-services-v2.0.0.cpio.gz

# Expected result: No failures during entire update process
```

---

## 9. Disaster Recovery

### Backup Strategy

**Automated Backups**:

```
┌─────────────────────────────────────────────────────────────┐
│                     Backup Architecture                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌────────────────────────────────────────────────────┐   │
│   │        Primary PostgreSQL (Node 1)                 │   │
│   │                                                    │   │
│   │  Continuous WAL Archiving                          │   │
│   │  └─────────────────────────┐                      │   │
│   │                             ▼                      │   │
│   │                    ┌────────────────┐             │   │
│   │                    │  WAL Archive   │             │   │
│   │                    │  (S3 / Azure)  │             │   │
│   │                    └────────────────┘             │   │
│   └────────────────────────────────────────────────────┘   │
│                                                             │
│   ┌────────────────────────────────────────────────────┐   │
│   │        pgBackRest (Backup Tool)                    │   │
│   │                                                    │   │
│   │  Full Backup:  Daily at 02:00                      │   │
│   │  Diff Backup:  Every 6 hours                       │   │
│   │  Retention:    30 days                             │   │
│   │  Storage:      S3 / Azure Blob                     │   │
│   └────────────────────────────────────────────────────┘   │
│                                                             │
│   ┌────────────────────────────────────────────────────┐   │
│   │        Valkey RDB/AOF Snapshots                    │   │
│   │                                                    │   │
│   │  RDB:          Every 15 minutes                    │   │
│   │  AOF:          Fsync every second                  │   │
│   │  Upload:       Hourly to S3 / Azure                │   │
│   │  Retention:    7 days                              │   │
│   └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**PostgreSQL Backup Configuration**:

```ini
# /etc/pgbackrest/pgbackrest.conf
[global]
repo1-path=/backup/pgbackrest
repo1-retention-full=30
repo1-retention-diff=30
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass=${PGBACKREST_CIPHER_PASS}

# Cloud storage (S3)
repo1-type=s3
repo1-s3-bucket=unified-services-backups
repo1-s3-region=us-east-1
repo1-s3-key=${AWS_ACCESS_KEY_ID}
repo1-s3-key-secret=${AWS_SECRET_ACCESS_KEY}

[unified-postgres]
pg1-path=/var/lib/postgresql/data
pg1-port=5432
pg1-socket-path=/var/run/postgresql
```

**Backup Cron Jobs**:

```cron
# PostgreSQL Full Backup (daily at 2 AM)
0 2 * * * /usr/bin/pgbackrest --stanza=unified-postgres backup --type=full

# PostgreSQL Differential Backup (every 6 hours)
0 */6 * * * /usr/bin/pgbackrest --stanza=unified-postgres backup --type=diff

# Valkey RDB Upload (hourly)
0 * * * * /usr/local/bin/upload-valkey-backup.sh

# Backup verification (daily at 3 AM)
0 3 * * * /usr/local/bin/verify-backups.sh
```

### Point-in-Time Recovery (PITR)

**Restore to specific timestamp**:

```bash
#!/bin/bash
# Restore PostgreSQL to specific point in time

TARGET_TIME="2026-01-05 14:30:00"

# 1. Stop PostgreSQL
systemctl stop postgresql

# 2. Restore latest base backup
pgbackrest --stanza=unified-postgres \
    --delta \
    --type=time \
    --target="$TARGET_TIME" \
    --target-action=promote \
    restore

# 3. Start PostgreSQL (will replay WAL up to target time)
systemctl start postgresql

# 4. Verify data
psql -U postgres -c "SELECT now(), pg_is_in_recovery();"
```

### Multi-Region Disaster Recovery

**Cross-Region Replication**:

```
Primary Region (us-east-1)          Disaster Recovery Region (us-west-2)
┌─────────────────────────┐         ┌─────────────────────────┐
│  3-Node Cluster         │         │  3-Node Cluster         │
│  (Active)               │         │  (Standby)              │
│                         │         │                         │
│  ┌──────────────────┐   │         │  ┌──────────────────┐   │
│  │ PostgreSQL       │───┼─────────┼─►│ PostgreSQL       │   │
│  │ (Primary)        │   │ Logical │  │ (Standby)        │   │
│  └──────────────────┘   │ Rep     │  └──────────────────┘   │
│                         │         │                         │
│  ┌──────────────────┐   │         │  ┌──────────────────┐   │
│  │ Valkey           │───┼─────────┼─►│ Valkey           │   │
│  │ (Master)         │   │ Rep     │  │ (Replica)        │   │
│  └──────────────────┘   │         │  └──────────────────┘   │
│                         │         │                         │
│  Backups → S3           │         │  Backups ← S3           │
└─────────────────────────┘         └─────────────────────────┘
```

**Disaster Recovery Procedure**:

1. **Total Primary Region Failure**
   - Detect region outage (>5 minutes)
   - Promote DR cluster to active
   - Update DNS to point to DR region
   - Notify users of temporary read-only mode
   - When primary region recovers, resync from DR

2. **Recovery Time Objective (RTO)**: 5 minutes
   - Automated detection: 2 minutes
   - Manual approval: 1 minute
   - Promotion: 1 minute
   - DNS propagation: 1 minute

3. **Recovery Point Objective (RPO)**: 5 minutes
   - Logical replication lag: <1 minute typical
   - Worst case: 5 minutes (if replication paused)

---

## 10. Network Architecture

### Network Topology

```
┌─────────────────────────────────────────────────────────────┐
│                     Network Architecture                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    ┌──────────────────┐                     │
│                    │   External LB    │                     │
│                    │   (Cloud-Native) │                     │
│                    │ ELB / Azure LB / │                     │
│                    │  GCP LB          │                     │
│                    └────────┬─────────┘                     │
│                             │                               │
│              ┌──────────────┼──────────────┐               │
│              │              │              │               │
│     ┌────────▼────┐  ┌──────▼─────┐  ┌────▼──────┐       │
│     │  AZ-1       │  │  AZ-2      │  │  AZ-3     │       │
│     │  (us-e-1a)  │  │  (us-e-1b) │  │  (us-e-1c)│       │
│     │             │  │            │  │           │       │
│     │ ┌─────────┐ │  │ ┌────────┐ │  │ ┌────────┐│       │
│     │ │ Node 1  │ │  │ │ Node 2 │ │  │ │ Node 3 ││       │
│     │ │ .64.11  │◄┼──┼─┤ .64.12 │◄┼──┼─┤ .64.13 ││       │
│     │ └─────────┘ │  │ └────────┘ │  │ └────────┘│       │
│     └─────────────┘  └────────────┘  └───────────┘       │
│                                                             │
│   Private Subnet: 192.168.64.0/24                          │
│   Cluster Network: 10.0.0.0/16 (overlay)                   │
│   Service VIP: 192.168.64.10                               │
└─────────────────────────────────────────────────────────────┘
```

### Network Requirements

1. **Latency**:
   - Intra-cluster: <5ms (same region)
   - Cross-region: <100ms (DR replication)

2. **Bandwidth**:
   - PostgreSQL replication: 10-100 Mbps
   - Valkey replication: 1-10 Mbps
   - etcd consensus: <1 Mbps

3. **Ports**:
   - PostgreSQL: 5432 (client), 5433 (replicas)
   - Valkey: 6379 (data), 26379 (sentinel)
   - OpenVSCode: 8080 (HTTP)
   - SSH: 22
   - etcd: 2379 (client), 2380 (peer)
   - Patroni: 8008 (REST API)
   - HAProxy: 8404 (stats)

### Firewall Rules

```hcl
# Security Group / Firewall Rules

# Allow external access to services
ingress {
  from_port   = 5432
  to_port     = 5432
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]  # Restrict in production!
  description = "PostgreSQL"
}

ingress {
  from_port   = 6379
  to_port     = 6379
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]
  description = "Valkey"
}

ingress {
  from_port   = 8080
  to_port     = 8080
  protocol    = "tcp"
  cidr_blocks = ["0.0.0.0/0"]
  description = "OpenVSCode"
}

ingress {
  from_port   = 22
  to_port     = 22
  protocol    = "tcp"
  cidr_blocks = ["10.0.0.0/8"]  # Internal only
  description = "SSH"
}

# Allow inter-node communication
ingress {
  from_port   = 0
  to_port     = 65535
  protocol    = "-1"
  self        = true
  description = "All traffic between cluster nodes"
}

# Allow health checks
ingress {
  from_port   = 8008
  to_port     = 8008
  protocol    = "tcp"
  cidr_blocks = ["10.0.0.0/8"]
  description = "Patroni REST API"
}

ingress {
  from_port   = 8404
  to_port     = 8404
  protocol    = "tcp"
  cidr_blocks = ["10.0.0.0/8"]
  description = "HAProxy Stats"
}
```

---

## 11. Split-Brain Prevention

**Split-brain**: A scenario where two nodes both think they are the primary, leading to data divergence.

### Prevention Mechanisms

#### 1. Quorum-Based Consensus (etcd)

```
Scenario: Network partition
┌──────────────┐        ┌──────────────┐
│  Node 1      │   X    │  Node 2      │
│  Node 3      │   X    │              │
└──────────────┘        └──────────────┘
  Majority (2/3)          Minority (1/3)
  Can elect leader        Cannot elect leader
  Continues operation     Read-only mode
```

**How it works**:
- etcd requires majority (2 of 3 nodes) to elect leader
- Partition with minority cannot make decisions
- Only one side can have a leader at any time

#### 2. PostgreSQL Fencing (Patroni)

**STONITH (Shoot The Other Node In The Head)**:

```python
# Patroni fencing callback (/etc/patroni/fencing.sh)
#!/bin/bash
# Called when Patroni needs to fence old primary

OLD_PRIMARY="$1"
NEW_PRIMARY="$2"

# Option 1: Power off old primary via cloud API
aws ec2 stop-instances --instance-ids "$OLD_PRIMARY_INSTANCE_ID"

# Option 2: Revoke network access via security groups
aws ec2 revoke-security-group-ingress \
    --group-id "$SG_ID" \
    --ip-permissions "IpProtocol=tcp,FromPort=5432,ToPort=5432"

# Option 3: Kernel panic on old primary (if accessible)
ssh "$OLD_PRIMARY" 'echo c > /proc/sysrq-trigger'
```

**Patroni Configuration**:

```yaml
postgresql:
  callbacks:
    on_role_change: /etc/patroni/fencing.sh

  parameters:
    # Ensure old primary cannot accept writes
    synchronous_standby_names: '*'
```

#### 3. Valkey Sentinel Quorum

**Sentinel Configuration**:

```conf
# Require 2 out of 3 Sentinels to agree on failover
sentinel monitor unified-valkey 192.168.64.11 6379 2
```

**How it works**:
- Single Sentinel cannot trigger failover
- Requires majority agreement
- Prevents false positives

#### 4. Application-Level Checks

**Health Check Before Write**:

```python
# Example: Python application
import psycopg2

def safe_write(conn, query):
    # Verify we're connected to actual primary
    cursor = conn.cursor()
    cursor.execute("SELECT pg_is_in_recovery();")
    is_replica = cursor.fetchone()[0]

    if is_replica:
        raise Exception("Cannot write to replica!")

    # Safe to write
    cursor.execute(query)
    conn.commit()
```

### Split-Brain Detection

**Monitoring for split-brain**:

```bash
#!/bin/bash
# Check for split-brain condition

# Count how many PostgreSQL primaries exist
PRIMARY_COUNT=$(psql -h node1 -c "SELECT pg_is_in_recovery();" | grep -c "f" || echo 0)
PRIMARY_COUNT=$((PRIMARY_COUNT + $(psql -h node2 -c "SELECT pg_is_in_recovery();" | grep -c "f" || echo 0)))
PRIMARY_COUNT=$((PRIMARY_COUNT + $(psql -h node3 -c "SELECT pg_is_in_recovery();" | grep -c "f" || echo 0)))

if [ "$PRIMARY_COUNT" -gt 1 ]; then
    echo "CRITICAL: Split-brain detected! $PRIMARY_COUNT primaries found!"
    # Alert immediately
    datadog-cli event post --title "Split-Brain Detected" --text "Multiple PostgreSQL primaries" --priority high
    exit 1
fi

# Count how many Valkey masters exist
MASTER_COUNT=$(redis-cli -h node1 INFO replication | grep -c "role:master" || echo 0)
MASTER_COUNT=$((MASTER_COUNT + $(redis-cli -h node2 INFO replication | grep -c "role:master" || echo 0)))
MASTER_COUNT=$((MASTER_COUNT + $(redis-cli -h node3 INFO replication | grep -c "role:master" || echo 0)))

if [ "$MASTER_COUNT" -gt 1 ]; then
    echo "CRITICAL: Split-brain detected! $MASTER_COUNT Valkey masters found!"
    datadog-cli event post --title "Split-Brain Detected" --text "Multiple Valkey masters" --priority high
    exit 1
fi

echo "OK: No split-brain detected"
```

---

## 12. Monitoring & Alerting

### Comprehensive Monitoring Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    Monitoring Architecture                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌────────────────────────────────────────────────────┐   │
│   │         Datadog Agent (on each node)               │   │
│   │                                                    │   │
│   │  System Metrics:                                   │   │
│   │  - CPU, Memory, Disk, Network                      │   │
│   │  - Process monitoring                              │   │
│   │  - File system usage                               │   │
│   │                                                    │   │
│   │  Service Checks:                                   │   │
│   │  - PostgreSQL (port 5432, Patroni API)            │   │
│   │  - Valkey (port 6379, Sentinel)                   │   │
│   │  - OpenVSCode (port 8080, /healthz)               │   │
│   │  - SSH (port 22)                                   │   │
│   │  - etcd (port 2379)                                │   │
│   │                                                    │   │
│   │  Custom Metrics:                                   │   │
│   │  - Replication lag (PostgreSQL, Valkey)           │   │
│   │  - Query latency                                   │   │
│   │  - Connection pool usage                           │   │
│   │  - Failover count                                  │   │
│   └────────────────────┬───────────────────────────────┘   │
│                        │                                   │
│   ┌────────────────────▼───────────────────────────────┐   │
│   │         Datadog Platform                           │   │
│   │                                                    │   │
│   │  Dashboards:                                       │   │
│   │  - Cluster overview                                │   │
│   │  - Service-specific metrics                        │   │
│   │  - Replication health                              │   │
│   │  - Performance metrics                             │   │
│   │                                                    │   │
│   │  Monitors:                                         │   │
│   │  - Service availability                            │   │
│   │  - Replication lag                                 │   │
│   │  - Error rates                                     │   │
│   │  - Resource utilization                            │   │
│   │                                                    │   │
│   │  Alerting:                                         │   │
│   │  - PagerDuty (critical)                           │   │
│   │  - Slack (warnings)                                │   │
│   │  - Email (info)                                    │   │
│   └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Key Metrics to Monitor

#### PostgreSQL Metrics

```yaml
# Connection metrics
postgresql.connections.active: Current active connections
postgresql.connections.idle: Idle connections
postgresql.max_connections: Max connection limit

# Replication metrics
postgresql.replication_delay: Replication lag in bytes
postgresql.replication_delay_seconds: Replication lag in seconds
postgresql.wal_sender.count: Number of WAL senders

# Performance metrics
postgresql.transactions.committed: Committed transactions/sec
postgresql.transactions.rolled_back: Rolled back transactions/sec
postgresql.queries.duration: Average query duration
postgresql.locks: Number of locks held

# Resource metrics
postgresql.database_size: Database size in bytes
postgresql.cache_hit_ratio: Cache hit percentage
postgresql.checkpoints_timed: Scheduled checkpoints
postgresql.checkpoints_requested: Requested checkpoints

# Health checks
postgresql.can_connect: Can connect to database (0/1)
postgresql.is_primary: Is this node the primary (0/1)
```

#### Valkey Metrics

```yaml
# Connection metrics
valkey.connected_clients: Current client connections
valkey.blocked_clients: Clients blocked on operations
valkey.rejected_connections: Connections rejected (maxclients)

# Replication metrics
valkey.master_link_status: Replication link status (0/1)
valkey.master_last_io_seconds_ago: Seconds since last master IO
valkey.slave_lag: Replication lag in bytes

# Performance metrics
valkey.commands_processed: Commands processed/sec
valkey.keyspace_hits: Keyspace hit ratio
valkey.keyspace_misses: Keyspace miss ratio
valkey.evicted_keys: Keys evicted due to maxmemory

# Resource metrics
valkey.used_memory: Memory usage in bytes
valkey.used_memory_rss: Resident memory in bytes
valkey.keys: Total number of keys
valkey.expired_keys: Expired keys/sec

# Health checks
valkey.can_connect: Can connect to Valkey (0/1)
valkey.is_master: Is this node the master (0/1)
```

#### Cluster Metrics

```yaml
# etcd metrics
etcd.server.has_leader: Cluster has leader (0/1)
etcd.server.leader_changes: Leader change count
etcd.network.peer_roundtrip: Peer roundtrip time

# HAProxy metrics
haproxy.backend.active_servers: Active backend servers
haproxy.backend.connections: Backend connections
haproxy.backend.response_time: Backend response time

# Custom cluster metrics
cluster.nodes.total: Total nodes in cluster
cluster.nodes.healthy: Healthy nodes
cluster.failovers.total: Total failovers
cluster.failovers.last_24h: Failovers in last 24 hours
```

### Sample Datadog Dashboard

```json
{
  "title": "Unified Services HA Cluster",
  "description": "Overview of 3-node HA cluster health and performance",
  "widgets": [
    {
      "definition": {
        "title": "Cluster Health",
        "type": "check_status",
        "check": "postgresql.can_connect",
        "grouping": "cluster",
        "tags": ["cluster:unified"]
      }
    },
    {
      "definition": {
        "title": "PostgreSQL Replication Lag",
        "type": "timeseries",
        "requests": [{
          "q": "avg:postgresql.replication_delay_seconds{cluster:unified} by {host}",
          "display_type": "line"
        }]
      }
    },
    {
      "definition": {
        "title": "Valkey Memory Usage",
        "type": "timeseries",
        "requests": [{
          "q": "avg:valkey.used_memory{cluster:unified} by {host}",
          "display_type": "area"
        }]
      }
    },
    {
      "definition": {
        "title": "Failover History",
        "type": "event_timeline",
        "query": "tags:cluster:unified failover"
      }
    }
  ]
}
```

---

## 13. Multi-Cloud Support

### Cloud Provider Comparison

| Feature | AWS | Azure | GCP |
|---------|-----|-------|-----|
| **VM Type** | EC2 t3.medium | Standard_B2ms | n1-standard-2 |
| **Load Balancer** | ELB (Network LB) | Azure Load Balancer | Cloud Load Balancing |
| **Block Storage** | EBS gp3 | Azure Managed Disks | Persistent Disk |
| **Object Storage** | S3 | Azure Blob | Cloud Storage |
| **Private Network** | VPC | VNet | VPC |
| **Multi-AZ** | 3 AZs | 3 Availability Zones | 3 Zones |
| **Estimated Cost** | $150/month | $140/month | $145/month |

### Deployment Examples

#### AWS Deployment

```bash
# Deploy 3-node cluster across 3 AZs
terraform apply \
  -var="deploy_aws=true" \
  -var="aws_region=us-east-1" \
  -var="aws_instance_type=t3.medium" \
  -var="environment=production"

# Outputs:
# node1_ip = 192.168.64.11 (us-east-1a)
# node2_ip = 192.168.64.12 (us-east-1b)
# node3_ip = 192.168.64.13 (us-east-1c)
# load_balancer = unified-cluster-lb.us-east-1.elb.amazonaws.com
```

#### Azure Deployment

```bash
# Deploy 3-node cluster across 3 AZs
terraform apply \
  -var="deploy_azure=true" \
  -var="azure_location=eastus" \
  -var="azure_vm_size=Standard_B2ms" \
  -var="environment=production"

# Outputs:
# node1_ip = 192.168.64.11 (Zone 1)
# node2_ip = 192.168.64.12 (Zone 2)
# node3_ip = 192.168.64.13 (Zone 3)
# load_balancer = unified-cluster-lb.eastus.cloudapp.azure.com
```

#### GCP Deployment

```bash
# Deploy 3-node cluster across 3 zones
terraform apply \
  -var="deploy_gcp=true" \
  -var="gcp_region=us-central1" \
  -var="gcp_machine_type=n1-standard-2" \
  -var="environment=production"

# Outputs:
# node1_ip = 192.168.64.11 (us-central1-a)
# node2_ip = 192.168.64.12 (us-central1-b)
# node3_ip = 192.168.64.13 (us-central1-c)
# load_balancer = 35.x.x.x
```

### Multi-Cloud Disaster Recovery

**Primary in AWS, DR in Azure**:

```
AWS (us-east-1)                    Azure (eastus)
┌─────────────────────┐            ┌─────────────────────┐
│  Production Cluster │───────────►│  DR Cluster         │
│  3 nodes (active)   │  Async Rep │  3 nodes (standby)  │
└─────────────────────┘            └─────────────────────┘
```

**Benefits**:
- Survive entire cloud provider outage
- Regulatory compliance (data residency)
- Cost optimization (cheaper DR region)
- No vendor lock-in

---

## 14. Implementation Roadmap

### Phase 1: Infrastructure Setup (Week 1)

**Tasks**:
1. Provision 3 VMs (AWS/Azure/GCP)
2. Configure networking (VPC, subnets, security groups)
3. Set up etcd cluster
4. Install Datadog agents
5. Verify inter-node connectivity

**Deliverables**:
- `terraform/ha-cluster/main.tf` (Infrastructure as Code)
- `azure/cluster-setup.sh` (Automated provisioning)
- Network diagram
- Smoke test results

**Success Criteria**:
- All 3 nodes can ping each other
- etcd cluster has quorum
- Datadog receiving metrics from all nodes

### Phase 2: PostgreSQL HA (Week 2)

**Tasks**:
1. Install Patroni on all 3 nodes
2. Configure streaming replication
3. Set up PgBouncer connection pooler
4. Configure HAProxy for PostgreSQL
5. Test failover scenarios

**Deliverables**:
- Patroni configuration files
- HAProxy PostgreSQL backend config
- Failover test script
- Failover time measurements

**Success Criteria**:
- Synchronous replication working (zero lag)
- Automatic failover <30 seconds
- No data loss during failover
- PgBouncer transparent reconnection

### Phase 3: Valkey HA (Week 2)

**Tasks**:
1. Configure Valkey master-replica replication
2. Set up Sentinel on all 3 nodes
3. Configure HAProxy for Valkey
4. Test failover scenarios
5. Verify client reconnection

**Deliverables**:
- Valkey + Sentinel configuration
- HAProxy Valkey backend config
- Client failover test script

**Success Criteria**:
- Replication lag <100ms
- Automatic failover <20 seconds
- Clients reconnect automatically

### Phase 4: Stateless Services HA (Week 3)

**Tasks**:
1. Set up shared filesystem (NFS or virtio-fs)
2. Configure OpenVSCode active-active
3. Configure SSH load balancing
4. Test session persistence

**Deliverables**:
- Shared filesystem configuration
- OpenVSCode HA configuration
- Load balancer health checks

**Success Criteria**:
- OpenVSCode accessible on all 3 nodes
- Workspace shared across nodes
- SSH load balanced

### Phase 5: Monitoring & Alerting (Week 3)

**Tasks**:
1. Configure Datadog monitors for all services
2. Set up PagerDuty integration
3. Create Datadog dashboards
4. Configure alert escalation
5. Test alert notifications

**Deliverables**:
- `datadog/monitors/*.yaml` (Monitor definitions)
- Datadog dashboard JSON
- Runbook for common alerts

**Success Criteria**:
- All critical services monitored
- Alerts fire correctly
- PagerDuty receives critical alerts

### Phase 6: Disaster Recovery (Week 4)

**Tasks**:
1. Set up automated backups (pgBackRest)
2. Configure WAL archiving
3. Test PITR (Point-in-Time Recovery)
4. Set up cross-region replication (optional)
5. Document DR procedures

**Deliverables**:
- `AGENT-Z-DISASTER-RECOVERY.md` (DR playbook)
- Backup verification script
- DR test results

**Success Criteria**:
- Backups running daily
- PITR recovery <5 minutes
- DR cluster can be promoted

### Phase 7: Testing & Validation (Week 4)

**Tasks**:
1. Chaos engineering (kill nodes randomly)
2. Network partition simulation
3. Load testing during failover
4. Rolling update test
5. Full DR drill

**Deliverables**:
- `azure/failover-test.sh` (Chaos test suite)
- Test report with metrics
- Lessons learned document

**Success Criteria**:
- All failover tests pass
- Zero data loss in all scenarios
- RTO <5 minutes, RPO <5 minutes

### Phase 8: Documentation & Handoff (Week 5)

**Tasks**:
1. Write operations runbook
2. Create troubleshooting guide
3. Record demo videos
4. Train operations team
5. Go live!

**Deliverables**:
- `AGENT-Z-RUNBOOK.md` (Operations manual)
- Architecture diagrams
- Training materials
- Go-live checklist

**Success Criteria**:
- Ops team trained
- All documentation complete
- Production deployment successful

---

## Conclusion

This high availability architecture transforms the Unified Services VM from a single-node prototype into an enterprise-grade, production-ready system capable of:

- **99.95% availability** (4.38 hours downtime/year)
- **Automatic failover** in under 30 seconds
- **Zero data loss** for committed transactions
- **Zero-downtime updates** via rolling deployments
- **Multi-cloud support** for flexibility and disaster recovery

The design leverages proven open-source technologies (Patroni, Sentinel, etcd, HAProxy) and industry best practices (quorum-based consensus, split-brain prevention, comprehensive monitoring) to deliver a robust, scalable, and maintainable solution.

**Next Steps**:
1. Review and approve this design
2. Provision infrastructure (Phase 1)
3. Implement PostgreSQL HA (Phase 2)
4. Continue through implementation roadmap

**Estimated Timeline**: 5 weeks to production-ready HA cluster

**Estimated Cost**: $400-500/month (3 nodes + monitoring + backups)

---

**Author**: Agent Z (High Availability Specialist)
**Contact**: For questions or clarifications, refer to `AGENT-Z-RUNBOOK.md`
**Version**: 1.0.0
**Last Updated**: 2026-01-05
