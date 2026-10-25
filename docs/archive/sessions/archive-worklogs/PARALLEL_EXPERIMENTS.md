# Parallel Experiments While Waiting for VZ VM Validation

## Context
While waiting for manual GUI testing of VZ VMs, we can make progress on independent work streams that don't require VZ VMs to be running.

---

## Experiment 1: Lima VM Validation ✅

**Goal**: Use working Lima VMs to validate service configurations and Datadog integration

**Why**: Lima VMs are already working and can serve as a reference implementation

**Tasks**:
1. Start test-datadog Lima VM
2. Test PostgreSQL connectivity
3. Test Valkey connectivity  
4. Verify Datadog agent working
5. Document baseline performance
6. Compare with expected VZ behavior

**Expected Outcome**: 
- Proof that services work
- Datadog validation complete
- Baseline metrics documented

**Time**: 30-45 minutes

---

## Experiment 2: SSH Infrastructure Setup 🔐

**Goal**: Prepare SSH configuration for VZ VMs

**Why**: Can prepare everything now, apply when VMs boot

**Tasks**:
1. Generate SSH keys for VibeCode
```bash
ssh-keygen -t ed25519 -f ~/.ssh/vibecode_ed25519 -N ""
```

2. Create cloud-init user-data template
```yaml
#cloud-config
users:
  - name: vibecode
    ssh_authorized_keys:
      - <public-key>
    sudo: ALL=(ALL) NOPASSWD:ALL

runcmd:
  - apk add openssh
  - rc-update add sshd
  - rc-service sshd start
```

3. Write VM rebuild script with SSH
4. Document SSH access patterns

**Expected Outcome**:
- SSH keys ready
- Cloud-init configs prepared
- Can apply to VMs when ready

**Time**: 20-30 minutes

---

## Experiment 3: Service Health Check Scripts 🔧

**Goal**: Write comprehensive service validation scripts

**Why**: Can write tests now, run when services available

**Tasks**:
1. PostgreSQL health checks:
```bash
#!/bin/bash
# test-postgresql.sh
psql -h $VM_IP -p 5432 -U postgres -c "SELECT version();"
psql -h $VM_IP -p 5432 -U postgres -c "CREATE DATABASE test;"
psql -h $VM_IP -p 5432 -U postgres -d test -c "CREATE TABLE users (id INT);"
```

2. Valkey health checks:
```bash
#!/bin/bash
# test-valkey.sh
redis-cli -h $VM_IP -p 6379 PING
redis-cli -h $VM_IP -p 6379 INFO
redis-cli -h $VM_IP -p 6379 SET test "hello"
redis-cli -h $VM_IP -p 6379 GET test
```

3. Node.js health checks:
```bash
#!/bin/bash
# test-nodejs.sh
curl http://$VM_IP:3000/health
ssh $VM_IP "node --version"
ssh $VM_IP "npm --version"
```

4. OpenVSCode health checks:
```bash
#!/bin/bash
# test-openvscode.sh
curl http://$VM_IP:8080/
curl http://$VM_IP:8080/healthz
```

**Expected Outcome**:
- Ready-to-run health check suite
- Can execute immediately when VMs boot

**Time**: 30 minutes

---

## Experiment 4: Datadog Dashboard Creation 📊

**Goal**: Pre-create Datadog dashboards and queries

**Why**: Define what we want to see before data arrives

**Tasks**:
1. Create dashboard JSON:
```json
{
  "title": "VibeCode VM Monitoring",
  "widgets": [
    {
      "definition": {
        "title": "VM Start Success Rate",
        "type": "query_value",
        "requests": [{
          "q": "sum:vibecode.vm.start.success{*}.as_count() / sum:vibecode.vm.start.attempt{*}.as_count()"
        }]
      }
    },
    {
      "definition": {
        "title": "VM Boot Duration",
        "type": "timeseries",
        "requests": [{
          "q": "avg:vibecode.vm.start.duration{*}"
        }]
      }
    }
  ]
}
```

2. Define monitors/alerts
3. Create metric queries
4. Document expected values

**Expected Outcome**:
- Dashboard ready to deploy
- Alerts configured
- Know what to look for

**Time**: 30 minutes

---

## Experiment 5: Performance Baselines 📈

**Goal**: Establish baseline performance metrics

**Why**: Need comparison points for optimization

**Tasks**:
1. Measure Lima VM boot time
2. Measure service startup time
3. Measure network latency
4. Document resource usage
5. Create comparison table

**Metrics to Collect**:
- VM boot time (GRUB → login)
- PostgreSQL ready time
- Valkey ready time
- Network latency (ping)
- Disk I/O (fio tests)
- Memory usage
- CPU usage

**Expected Outcome**:
- Baseline metrics documented
- Can compare VZ vs Lima
- Performance optimization targets

**Time**: 45 minutes

---

## Experiment 6: VM Image Optimization 🚀

**Goal**: Optimize VM images for faster boot

**Why**: Improve user experience

**Tasks**:
1. Review Alpine init scripts
2. Disable unnecessary services
3. Optimize kernel parameters
4. Configure services for fast startup
5. Test smaller disk images

**Optimizations**:
```bash
# rc.conf optimizations
rc_parallel="YES"
rc_logger="YES"

# Disable unnecessary services
rc-update del hwdrivers boot
rc-update del modules boot
```

**Expected Outcome**:
- Faster boot times
- Smaller memory footprint
- Optimized configs

**Time**: 1 hour

---

## Experiment 7: Documentation Enhancement 📝

**Goal**: Complete comprehensive documentation

**Why**: Ready for release

**Tasks**:
1. User quick start guide
2. Service connection examples
3. Troubleshooting guide
4. Architecture diagrams
5. API reference
6. Developer guide
7. FAQ

**Expected Outcome**:
- Production-ready docs
- User onboarding materials
- Support documentation

**Time**: 1-2 hours

---

## Experiment 8: Network Diagnostics Toolkit 🌐

**Goal**: Build tools to diagnose VM network issues

**Why**: Essential for troubleshooting

**Tasks**:
1. VM IP discovery script
2. Port scan utility
3. Network trace tool
4. Connection test suite
5. Bandwidth test

**Tools to Create**:
```bash
#!/bin/bash
# find-vm-ips.sh
# Scan bridge100 network for VMs
nmap -sn 192.168.64.0/24

# find-vm-ports.sh  
# Scan VM for open ports
nmap -p- $VM_IP

# test-vm-network.sh
# Comprehensive network test
ping -c 4 $VM_IP
nc -zv $VM_IP 5432  # PostgreSQL
nc -zv $VM_IP 6379  # Valkey
traceroute $VM_IP
```

**Expected Outcome**:
- Network debugging tools
- Can diagnose connectivity issues
- Quick problem resolution

**Time**: 30 minutes

---

## Experiment 9: CI/CD Enhancement ⚙️

**Goal**: Improve GitHub Actions workflow

**Why**: Better automation and validation

**Tasks**:
1. Add matrix testing (multiple macOS versions)
2. Add artifact upload (build outputs)
3. Add performance benchmarks
4. Add code coverage
5. Add security scanning

**Expected Outcome**:
- Robust CI/CD pipeline
- Automated quality checks
- Release automation

**Time**: 45 minutes

---

## Experiment 10: OpenTelemetry Integration 📡

**Goal**: Add OpenTelemetry as alternative to Datadog

**Why**: Vendor-neutral observability

**Tasks**:
1. Add OpenTelemetry Swift SDK
2. Create OTLP exporter configuration
3. Set up local otel-collector
4. Configure Datadog backend
5. Compare with native Datadog SDK

**Configuration**:
```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
      http:

processors:
  batch:

exporters:
  datadog:
    api:
      key: ${DD_API_KEY}

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [datadog]
```

**Expected Outcome**:
- OpenTelemetry integration
- Vendor flexibility
- Better standards compliance

**Time**: 1-2 hours

---

## Priority Order

### High Priority (Do First):
1. **Experiment 1: Lima VM Validation** (30-45 min)
   - Immediate value
   - Validates approach
   - Unblocks Agent 5 (Datadog)

2. **Experiment 3: Service Health Checks** (30 min)
   - Needed for Agent 3
   - Quick to implement
   - High value

3. **Experiment 8: Network Diagnostics** (30 min)
   - Will help debug VZ VMs
   - Essential troubleshooting
   - Quick wins

### Medium Priority:
4. **Experiment 2: SSH Infrastructure** (30 min)
5. **Experiment 4: Datadog Dashboard** (30 min)
6. **Experiment 5: Performance Baselines** (45 min)

### Low Priority (Nice to Have):
7. **Experiment 7: Documentation** (1-2 hrs)
8. **Experiment 6: VM Optimization** (1 hr)
9. **Experiment 9: CI/CD Enhancement** (45 min)
10. **Experiment 10: OpenTelemetry** (1-2 hrs)

---

## Execution Plan

**Next 2 Hours** (While Waiting for Manual VZ Test):

1. **Lima VM Validation** (45 min)
   - Start test-datadog VM
   - Test all services
   - Validate Datadog
   - Document results

2. **Service Health Scripts** (30 min)
   - Write all health check scripts
   - Make them generic (work with any IP)
   - Ready to run on VZ VMs

3. **Network Diagnostics** (30 min)
   - Build IP discovery
   - Build port scanning
   - Build connection tests

4. **Datadog Dashboard** (15 min)
   - Create basic dashboard
   - Define key metrics
   - Document queries

**Total**: ~2 hours of productive work

**Result**: When VZ VMs boot, we'll be ready to:
- Immediately test services
- Diagnose any network issues
- Validate with working Lima baseline
- View metrics in prepared dashboard

---

## Success Metrics

**For Each Experiment**:
- ✅ Deliverable created
- ✅ Documented and committed
- ✅ Ready to use
- ✅ Adds value to project

**Overall Success**:
- All experiments contribute to feature completion
- No wasted time while waiting
- Faster completion when VZ VMs boot
- Better overall project quality

