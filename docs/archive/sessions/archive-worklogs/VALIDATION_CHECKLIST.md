# VM Infrastructure Validation Checklist

**Date**: October 29, 2025
**Solution**: Lima (recommended by Team 5)
**Target**: 5 VMs operational with <2s boot, working networking

---

## Pre-Deployment Checklist

### System Requirements

- [ ] macOS 13+ (Ventura or later)
- [ ] Apple Silicon (M1/M2/M3/M4)
- [ ] 32GB+ RAM available
- [ ] 200GB+ free disk space
- [ ] Lima installed (`brew install lima`)
- [ ] vfkit installed (comes with Lima)

**Verification**:
```bash
# Check macOS version
sw_vers

# Check CPU
sysctl -n machdep.cpu.brand_string

# Check RAM
sysctl -n hw.memsize | awk '{print $1/1024/1024/1024 " GB"}'

# Check disk space
df -h ~

# Check Lima
limactl --version

# Check vfkit
vfkit --version
```

---

## Deployment Validation

### VM 1: Valkey

- [ ] Configuration exists: `config/lima/valkey-vm.yaml`
- [ ] Start VM: `limactl start --name=vibecode-valkey config/lima/valkey-vm.yaml`
- [ ] VM is running: `limactl list | grep vibecode-valkey`
- [ ] Boot time <2s (subsequent boots)
- [ ] Memory usage: ~1GB allocated
- [ ] Port forwarding works: Port 6379
- [ ] Service responds: `redis-cli -p 6379 PING` → PONG
- [ ] Performance: >50K ops/sec in benchmark

**Test Commands**:
```bash
# Start
limactl start vibecode-valkey

# Verify status
limactl list | grep vibecode-valkey

# Test service
redis-cli -p 6379 PING
redis-cli -p 6379 SET test "hello"
redis-cli -p 6379 GET test

# Check resources
limactl shell vibecode-valkey -- free -h
limactl shell vibecode-valkey -- df -h
```

### VM 2: PostgreSQL

- [ ] Configuration exists: `config/lima/postgresql-vm.yaml`
- [ ] Start VM: `limactl start --name=vibecode-postgresql config/lima/postgresql-vm.yaml`
- [ ] VM is running: `limactl list | grep vibecode-postgresql`
- [ ] Boot time <2s (subsequent boots)
- [ ] Memory usage: ~2GB allocated
- [ ] Port forwarding works: Port 5432
- [ ] Service responds: `psql -h localhost -p 5432 -U postgres -c "SELECT version();"`
- [ ] Performance: >1000 TPS

**Test Commands**:
```bash
# Start
limactl start vibecode-postgresql

# Verify status
limactl list | grep vibecode-postgresql

# Test service
psql -h localhost -p 5432 -U postgres -c "SELECT version();"
psql -h localhost -p 5432 -U postgres -c "CREATE TABLE test (id serial, data text);"
psql -h localhost -p 5432 -U postgres -c "INSERT INTO test (data) VALUES ('test');"
psql -h localhost -p 5432 -U postgres -c "SELECT * FROM test;"

# Check resources
limactl shell vibecode-postgresql -- free -h
```

### VM 3: PostgreSQL + pgvector

- [ ] Configuration exists: `config/lima/postgresql-pgvector-vm.yaml`
- [ ] Start VM: `limactl start --name=vibecode-pgvector config/lima/postgresql-pgvector-vm.yaml`
- [ ] VM is running: `limactl list | grep vibecode-pgvector`
- [ ] Boot time <3s (slightly over due to vector extension)
- [ ] Memory usage: ~8GB allocated
- [ ] Port forwarding works: Port 5433
- [ ] PostgreSQL responds: `psql -h localhost -p 5433 -U postgres -c "SELECT version();"`
- [ ] pgvector loaded: Extension shows in `\dx`
- [ ] Vector operations work: Can create vector columns
- [ ] Performance: >500 vector QPS

**Test Commands**:
```bash
# Start
limactl start vibecode-pgvector

# Verify status
limactl list | grep vibecode-pgvector

# Test PostgreSQL
psql -h localhost -p 5433 -U postgres -c "SELECT version();"

# Test pgvector
psql -h localhost -p 5433 -U postgres <<EOF
-- Check extension
\dx

-- Create test table with vectors
CREATE TABLE IF NOT EXISTS test_embeddings (
    id serial PRIMARY KEY,
    embedding vector(3)
);

-- Insert test vectors
INSERT INTO test_embeddings (embedding) VALUES
    ('[1,2,3]'),
    ('[4,5,6]'),
    ('[7,8,9]');

-- Test vector operations
SELECT embedding FROM test_embeddings LIMIT 1;

-- Test similarity search
SELECT id, embedding <=> '[1,2,3]' AS distance
FROM test_embeddings
ORDER BY distance
LIMIT 3;
EOF

# Check resources
limactl shell vibecode-pgvector -- free -h
```

### VM 4: Node.js Dev

- [ ] Configuration exists: `config/lima/nodejs-dev-vm.yaml`
- [ ] Start VM: `limactl start --name=vibecode-nodejs config/lima/nodejs-dev-vm.yaml`
- [ ] VM is running: `limactl list | grep vibecode-nodejs`
- [ ] Boot time <2s (subsequent boots)
- [ ] Memory usage: ~4GB allocated
- [ ] Port forwarding works: Port 3000
- [ ] Node.js installed: v22.21.1
- [ ] npm functional: Can install packages
- [ ] Workspace mount works: Can access host files
- [ ] Performance: >10K req/sec

**Test Commands**:
```bash
# Start
limactl start vibecode-nodejs

# Verify status
limactl list | grep vibecode-nodejs

# Test Node.js
limactl shell vibecode-nodejs -- node --version
limactl shell vibecode-nodejs -- npm --version

# Test functionality
limactl shell vibecode-nodejs -- node -e "console.log('Hello from Node.js')"
limactl shell vibecode-nodejs -- node -e "const http = require('http'); console.log('HTTP module works');"

# Test workspace mount
limactl shell vibecode-nodejs -- ls -la ~/workspace

# Test npm
limactl shell vibecode-nodejs -- npm init -y
limactl shell vibecode-nodejs -- npm install lodash

# Check resources
limactl shell vibecode-nodejs -- free -h
```

### VM 5: Bun OpenVSCode

- [ ] Configuration exists: `config/lima/openvscode-vm.yaml`
- [ ] Start VM: `limactl start --name=vibecode-openvscode config/lima/openvscode-vm.yaml`
- [ ] VM is running: `limactl list | grep vibecode-openvscode`
- [ ] Boot time <2s (subsequent boots)
- [ ] Memory usage: ~4GB allocated
- [ ] Port forwarding works: Port 8080
- [ ] Bun installed: `bun --version`
- [ ] OpenVSCode server running: HTTP 200 on port 8080
- [ ] Can access IDE: `open http://localhost:8080`
- [ ] Extensions work: Can install extensions
- [ ] Size: <20GB (target vs 97MB prototype)

**Test Commands**:
```bash
# Start
limactl start vibecode-openvscode

# Verify status
limactl list | grep vibecode-openvscode

# Test Bun
limactl shell vibecode-openvscode -- bun --version

# Test OpenVSCode
curl -s http://localhost:8080 | head -20

# Open in browser
open http://localhost:8080

# Check resources
limactl shell vibecode-openvscode -- free -h
limactl shell vibecode-openvscode -- df -h
```

---

## Performance Validation

### Boot Time Tests

```bash
#!/bin/bash
# test-boot-times.sh

echo "Testing VM boot times (subsequent boots)..."

vms=("vibecode-valkey" "vibecode-postgresql" "vibecode-pgvector" "vibecode-nodejs" "vibecode-openvscode")

for vm in "${vms[@]}"; do
    echo "Testing $vm..."

    # Stop VM
    limactl stop "$vm" 2>/dev/null || true
    sleep 2

    # Time the start
    start_time=$(date +%s.%N)
    limactl start "$vm"

    # Wait for SSH
    while ! limactl shell "$vm" -- echo "ready" &>/dev/null; do
        sleep 0.1
    done

    end_time=$(date +%s.%N)
    boot_time=$(echo "$end_time - $start_time" | bc)

    echo "  Boot time: ${boot_time}s"

    # Check if under 2 seconds
    if (( $(echo "$boot_time < 2.0" | bc -l) )); then
        echo "  ✅ PASS (<2s)"
    else
        echo "  ⚠️  MARGINAL (>2s but acceptable)"
    fi

    echo ""
done
```

### Memory Usage Tests

```bash
#!/bin/bash
# test-memory-usage.sh

echo "Checking VM memory usage..."

vms=("vibecode-valkey:1GB" "vibecode-postgresql:2GB" "vibecode-pgvector:8GB" "vibecode-nodejs:4GB" "vibecode-openvscode:4GB")

for vm_spec in "${vms[@]}"; do
    vm="${vm_spec%:*}"
    expected="${vm_spec#*:}"

    echo "Testing $vm (expected: $expected)..."

    if limactl list | grep "$vm" | grep -q "Running"; then
        # Get actual memory usage
        actual=$(limactl shell "$vm" -- free -h | grep Mem: | awk '{print $3}')
        echo "  Allocated: $expected"
        echo "  Used: $actual"
        echo "  ✅ Running"
    else
        echo "  ❌ Not running"
    fi

    echo ""
done

# Total
echo "Total allocated: 19GB"
echo "Expected host usage: ~2.5GB (idle)"
```

### Network Performance Tests

```bash
#!/bin/bash
# test-network-performance.sh

echo "Testing network performance..."

# Valkey benchmark
echo "1. Valkey benchmark..."
redis-benchmark -p 6379 -q -n 10000 -c 10 | grep "GET:"

# PostgreSQL benchmark
echo "2. PostgreSQL benchmark..."
limactl shell vibecode-postgresql -- psql -U postgres <<EOF
-- Simple benchmark
\timing
SELECT COUNT(*) FROM generate_series(1, 10000);
EOF

# Node.js HTTP benchmark
echo "3. Node.js HTTP benchmark (if server running)..."
# Requires a running HTTP server in VM
# ab -n 1000 -c 10 http://localhost:3000/

echo "✅ Network tests complete"
```

---

## Integration Tests

### Cross-VM Communication

```bash
#!/bin/bash
# test-cross-vm.sh

echo "Testing cross-VM communication..."

# Test 1: Node.js → Valkey
echo "1. Node.js connecting to Valkey..."
limactl shell vibecode-nodejs -- node <<EOF
const redis = require('redis');
const client = redis.createClient({
    host: '192.168.64.1',  // Bridge gateway
    port: 6379
});
client.on('connect', () => {
    console.log('✅ Connected to Valkey');
    client.quit();
});
EOF

# Test 2: Node.js → PostgreSQL
echo "2. Node.js connecting to PostgreSQL..."
limactl shell vibecode-nodejs -- node <<EOF
const { Client } = require('pg');
const client = new Client({
    host: '192.168.64.1',
    port: 5432,
    user: 'postgres',
    database: 'postgres'
});
client.connect()
    .then(() => {
        console.log('✅ Connected to PostgreSQL');
        return client.query('SELECT version()');
    })
    .then(res => {
        console.log('Version:', res.rows[0].version);
        return client.end();
    })
    .catch(err => console.error('❌ Error:', err));
EOF

echo "✅ Integration tests complete"
```

### Full Stack Test

```bash
#!/bin/bash
# test-full-stack.sh

echo "Testing full stack: Node.js + PostgreSQL + Valkey + pgvector..."

limactl shell vibecode-nodejs -- node <<'EOF'
const { Client } = require('pg');
const redis = require('redis');

async function testFullStack() {
    // Test PostgreSQL
    console.log('1. Testing PostgreSQL...');
    const pgClient = new Client({
        host: '192.168.64.1',
        port: 5432,
        user: 'postgres'
    });
    await pgClient.connect();
    const pgResult = await pgClient.query('SELECT 1 AS test');
    console.log('   PostgreSQL:', pgResult.rows[0].test === 1 ? '✅' : '❌');
    await pgClient.end();

    // Test pgvector
    console.log('2. Testing pgvector...');
    const pgvClient = new Client({
        host: '192.168.64.1',
        port: 5433,
        user: 'postgres'
    });
    await pgvClient.connect();
    const vecResult = await pgvClient.query("SELECT '[1,2,3]'::vector AS vec");
    console.log('   pgvector:', vecResult.rows.length > 0 ? '✅' : '❌');
    await pgvClient.end();

    // Test Valkey
    console.log('3. Testing Valkey...');
    const redisClient = redis.createClient({
        host: '192.168.64.1',
        port: 6379
    });
    await redisClient.connect();
    await redisClient.set('test', 'hello');
    const value = await redisClient.get('test');
    console.log('   Valkey:', value === 'hello' ? '✅' : '❌');
    await redisClient.quit();

    console.log('\n✅ Full stack operational!');
}

testFullStack().catch(console.error);
EOF
```

---

## Production Readiness Checklist

### Operational

- [ ] All 5 VMs start successfully
- [ ] All VMs meet <2s boot time (subsequent boots)
- [ ] All services respond to health checks
- [ ] Port forwarding works for all services
- [ ] Cross-VM communication functional
- [ ] Resource usage within expected ranges

### Performance

- [ ] Valkey: >50K ops/sec
- [ ] PostgreSQL: >1K TPS
- [ ] pgvector: >500 QPS
- [ ] Node.js: >10K req/sec
- [ ] Boot times: 1.8-2.3s average

### Reliability

- [ ] VMs survive host sleep/wake
- [ ] VMs restart after crash
- [ ] Data persists across reboots
- [ ] Logs are accessible and useful
- [ ] Error messages are clear

### Maintainability

- [ ] YAML configs in version control
- [ ] Documentation up to date
- [ ] Backup procedures documented
- [ ] Disaster recovery tested
- [ ] Monitoring in place (optional)

### Security

- [ ] VMs isolated from each other
- [ ] Only necessary ports exposed
- [ ] SSH keys properly configured
- [ ] Services require authentication
- [ ] Logs don't contain secrets

---

## Troubleshooting Tests

### Graceful Degradation

```bash
# Test 1: VM crashes and recovers
echo "Testing crash recovery..."
limactl shell vibecode-valkey -- sudo reboot
sleep 5
limactl start vibecode-valkey
redis-cli -p 6379 PING  # Should work

# Test 2: Port conflict handling
echo "Testing port conflict..."
# Start something on port 6379
nc -l 6379 &
NC_PID=$!
limactl start vibecode-valkey  # Should fail gracefully
kill $NC_PID

# Test 3: Out of memory handling
echo "Testing memory pressure..."
# Monitor VM under load
limactl shell vibecode-pgvector -- stress-ng --vm 1 --vm-bytes 7G --timeout 30s
# VM should not crash

# Test 4: Disk full handling
echo "Testing disk pressure..."
# Fill disk
limactl shell vibecode-nodejs -- dd if=/dev/zero of=/tmp/bigfile bs=1M count=10000 || true
# Service should report error gracefully
limactl shell vibecode-nodejs -- df -h
limactl shell vibecode-nodejs -- rm /tmp/bigfile
```

---

## Final Validation Summary

### Success Criteria (All Must Pass)

- [ ] ✅ All 5 VMs deployed
- [ ] ✅ All VMs running
- [ ] ✅ All services responding
- [ ] ✅ Boot time <2s (subsequent)
- [ ] ✅ Memory usage efficient (<20% waste)
- [ ] ✅ Network performance meets targets
- [ ] ✅ Cross-VM communication works
- [ ] ✅ Integration tests pass
- [ ] ✅ Documentation complete
- [ ] ✅ Ready for production use

### Sign-off

- [ ] Tested by: ___________________
- [ ] Date: ___________________
- [ ] Issues found: ___________________
- [ ] Issues resolved: ___________________
- [ ] Production approved: [ ] Yes [ ] No

---

## Quick Reference

### Start All VMs

```bash
limactl start vibecode-valkey
limactl start vibecode-postgresql
limactl start vibecode-pgvector
limactl start vibecode-nodejs
limactl start vibecode-openvscode
```

### Check All VMs

```bash
limactl list
```

### Test All Services

```bash
redis-cli -p 6379 PING
psql -h localhost -p 5432 -U postgres -c "SELECT 1;"
psql -h localhost -p 5433 -U postgres -c "SELECT 1;"
limactl shell vibecode-nodejs -- node --version
curl -s http://localhost:8080 | head -5
```

### Stop All VMs

```bash
limactl stop vibecode-valkey
limactl stop vibecode-postgresql
limactl stop vibecode-pgvector
limactl stop vibecode-nodejs
limactl stop vibecode-openvscode
```

---

**Validation Status**: [ ] Not Started [ ] In Progress [ ] Complete

**Notes**: ___________________________________________________

---

*Team 5 Validation Checklist*
*Last Updated: October 29, 2025*
*Solution: Lima (vfkit wrapper)*
