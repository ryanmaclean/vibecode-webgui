# VibeCode VM Management - Quick Examples

## One-Liners for Common Tasks

### Start Everything
```bash
# Start all VMs in correct order
./scripts/vfkit/vm-manager.sh start-all

# Or use individual scripts
./scripts/vfkit/start-valkey.sh
./scripts/vfkit/start-postgresql.sh
./scripts/vfkit/start-nodejs-dev.sh
```

### Check Status
```bash
# Quick status check
./scripts/vfkit/vm-manager.sh list

# Health check with service tests
./scripts/vfkit/vm-manager.sh health
```

### Stop Everything
```bash
# Graceful shutdown
./scripts/vfkit/vm-manager.sh stop-all

# Or convenience script
./scripts/vfkit/stop-all-vms.sh
```

### View Logs
```bash
# Last 50 lines (default)
./scripts/vfkit/vm-manager.sh logs valkey

# Last 200 lines
./scripts/vfkit/vm-manager.sh logs postgresql 200

# Follow logs (Ctrl+C to exit)
./scripts/vfkit/vm-manager.sh follow nodejs-dev

# View all VM logs at once
tail -f ~/.vibecode/vm-logs/*.log
```

### Test Everything
```bash
# Comprehensive test suite
./scripts/vfkit/test-all-vms.sh

# Individual VM tests
./scripts/vfkit/test-valkey.sh
./scripts/vfkit/test-postgresql.sh
./scripts/vfkit/test-nodejs-dev.sh
```

## Development Workflows

### Morning Startup
```bash
# Start VMs
./scripts/vfkit/vm-manager.sh start-all

# Wait a moment, then verify
sleep 5
./scripts/vfkit/vm-manager.sh health

# Run quick test
./scripts/vfkit/test-all-vms.sh
```

### End of Day Shutdown
```bash
# Stop all VMs gracefully
./scripts/vfkit/vm-manager.sh stop-all

# Verify everything stopped
./scripts/vfkit/vm-manager.sh list
```

### Restart After Config Changes
```bash
# Restart specific VM
./scripts/vfkit/vm-manager.sh restart valkey

# Or restart all
./scripts/vfkit/vm-manager.sh restart-all

# Test after restart
./scripts/vfkit/test-valkey.sh
```

### Debugging Issues
```bash
# Check status
./scripts/vfkit/vm-manager.sh list

# View recent logs
./scripts/vfkit/vm-manager.sh logs valkey 100

# Follow logs in real-time
./scripts/vfkit/vm-manager.sh follow valkey

# Run health check
./scripts/vfkit/vm-manager.sh health

# Check resource usage
./scripts/vfkit/vm-manager.sh monitor
```

## Service-Specific Examples

### Valkey (Redis)

#### Connect and Test
```bash
# Ping
redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 ping

# Set/Get
redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 SET mykey "hello"
redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 GET mykey

# Info
redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 INFO

# Monitor commands in real-time
redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 MONITOR
```

#### Session Storage Example
```bash
# Store session
redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 \
  SET "session:user123" '{"token":"abc","expires":"2025-12-31"}' EX 3600

# Retrieve session
redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 \
  GET "session:user123"

# Check TTL
redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 \
  TTL "session:user123"
```

### PostgreSQL

#### Connect
```bash
# Interactive psql
psql -h localhost -p 5432 -U vibecode -d vibecode

# One-liner query
PGPASSWORD=vibecode psql -h localhost -U vibecode -d vibecode \
  -c "SELECT version();"

# Connection string
psql postgresql://vibecode:vibecode@localhost:5432/vibecode
```

#### Common Queries
```bash
# List databases
PGPASSWORD=vibecode psql -h localhost -U vibecode -l

# List tables
PGPASSWORD=vibecode psql -h localhost -U vibecode -d vibecode \
  -c "\dt"

# Database size
PGPASSWORD=vibecode psql -h localhost -U vibecode -d vibecode \
  -c "SELECT pg_size_pretty(pg_database_size('vibecode'));"

# Active connections
PGPASSWORD=vibecode psql -h localhost -U vibecode -d vibecode \
  -c "SELECT count(*) FROM pg_stat_activity;"
```

#### Backup and Restore
```bash
# Backup
pg_dump -h localhost -U vibecode vibecode > backup_$(date +%Y%m%d).sql

# Restore
psql -h localhost -U vibecode vibecode < backup_20251028.sql

# Backup specific table
pg_dump -h localhost -U vibecode vibecode -t users > users_backup.sql
```

### Node.js Dev VM

#### Health Check
```bash
# HTTP request
curl http://localhost:3000/health

# JSON parsed
curl -s http://localhost:3000/health | jq .

# Check Node version
curl -s http://localhost:3000/health | jq -r '.node_version'

# Check memory
curl -s http://localhost:3000/health | jq '.memory'
```

#### Port Checks
```bash
# Check all forwarded ports
lsof -Pi :3000 -sTCP:LISTEN   # Next.js/API
lsof -Pi :5173 -sTCP:LISTEN   # Vite
lsof -Pi :8080 -sTCP:LISTEN   # code-server
lsof -Pi :9229 -sTCP:LISTEN   # Node debugger
```

## Integration Examples

### Cache-Aside Pattern
```bash
# 1. Try to get from cache
VALUE=$(redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 GET "user:123")

# 2. If not in cache, get from DB
if [ -z "$VALUE" ]; then
  VALUE=$(PGPASSWORD=vibecode psql -h localhost -U vibecode -d vibecode -t -A \
    -c "SELECT data FROM users WHERE id = 123;")

  # 3. Store in cache with TTL
  redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 \
    SET "user:123" "$VALUE" EX 3600
fi

echo "$VALUE"
```

### Session Management
```bash
# Create session in PostgreSQL
PGPASSWORD=vibecode psql -h localhost -U vibecode -d vibecode -c "
  INSERT INTO sessions (user_id, token, expires_at)
  VALUES ('user123', 'token_abc', NOW() + INTERVAL '1 hour')
  RETURNING id;
"

# Cache session in Valkey
redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 \
  HSET "session:user123" \
  token "token_abc" \
  expires "2025-10-28T18:00:00Z" \
  user_id "user123"

redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 \
  EXPIRE "session:user123" 3600
```

### Data Pipeline
```bash
# 1. Generate data
for i in {1..100}; do
  echo "$i,user$i,user$i@example.com"
done > /tmp/users.csv

# 2. Import to PostgreSQL
PGPASSWORD=vibecode psql -h localhost -U vibecode -d vibecode -c "
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255)
  );

  COPY users(id, name, email) FROM STDIN WITH CSV;
" < /tmp/users.csv

# 3. Cache frequently accessed users
PGPASSWORD=vibecode psql -h localhost -U vibecode -d vibecode -t -A \
  -c "SELECT id, name, email FROM users LIMIT 10;" | \
while IFS='|' read -r id name email; do
  redis-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 \
    HMSET "user:$id" name "$name" email "$email"
done
```

## Monitoring and Maintenance

### Resource Usage
```bash
# VM resource usage
./scripts/vfkit/vm-manager.sh monitor

# Detailed process info
ps aux | grep vfkit

# Check disk usage (requires VM data disk paths)
du -sh ~/.vibecode/
```

### Log Rotation
```bash
# Archive old logs
cd ~/.vibecode/vm-logs
for log in *.log; do
  if [ -f "$log" ]; then
    cp "$log" "$log.$(date +%Y%m%d)"
    > "$log"  # Truncate
  fi
done
```

### Cleanup
```bash
# Clean PID files
rm ~/.vibecode/vm-pids/*.pid

# Clean state files (will reset uptime)
rm ~/.vibecode/vm-state/*.state

# Clean logs (keeps VM logs safe)
rm ~/.vibecode/vm-logs/*.log.20*  # Remove archived logs
```

### Performance Tuning
```bash
# Check Valkey performance
redis-benchmark -h localhost -p 6379 -a VibeCodeChangeMe2025 \
  -t set,get -n 10000 -q

# Check PostgreSQL performance
PGPASSWORD=vibecode psql -h localhost -U vibecode -d vibecode -c "
  EXPLAIN ANALYZE SELECT * FROM users WHERE id = 1;
"

# Check cache hit ratio
PGPASSWORD=vibecode psql -h localhost -U vibecode -d vibecode -c "
  SELECT
    sum(heap_blks_read) as heap_read,
    sum(heap_blks_hit) as heap_hit,
    sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 as ratio
  FROM pg_statio_user_tables;
"
```

## Troubleshooting Commands

### Check if VMs are Running
```bash
# Using vm-manager
./scripts/vfkit/vm-manager.sh list

# Using ps
ps aux | grep vfkit

# Check ports
lsof -Pi :6379 -sTCP:LISTEN  # Valkey
lsof -Pi :5432 -sTCP:LISTEN  # PostgreSQL
lsof -Pi :3000 -sTCP:LISTEN  # Node.js
```

### Kill Stuck VMs
```bash
# Get PIDs
ps aux | grep vfkit

# Kill gracefully
kill <PID>

# Force kill if needed
kill -9 <PID>

# Clean up PID files
rm ~/.vibecode/vm-pids/*.pid
```

### Reset Everything
```bash
# Nuclear option
./scripts/vfkit/vm-manager.sh stop-all
killall vfkit 2>/dev/null || true
rm -rf ~/.vibecode/vm-pids/*
rm -rf ~/.vibecode/vm-state/*
./scripts/vfkit/vm-manager.sh start-all
./scripts/vfkit/test-all-vms.sh
```

### Check Logs for Errors
```bash
# Recent errors in all logs
grep -i error ~/.vibecode/vm-logs/*.log | tail -20

# Failed to start messages
grep -i "failed" ~/.vibecode/vm-logs/*.log | tail -10

# Out of memory
grep -i "memory" ~/.vibecode/vm-logs/*.log | tail -10
```

## Automation Examples

### Bash Alias (add to ~/.bashrc or ~/.zshrc)
```bash
alias vm-start='~/vibecode-webgui/scripts/vfkit/vm-manager.sh start-all'
alias vm-stop='~/vibecode-webgui/scripts/vfkit/vm-manager.sh stop-all'
alias vm-status='~/vibecode-webgui/scripts/vfkit/vm-manager.sh list'
alias vm-health='~/vibecode-webgui/scripts/vfkit/vm-manager.sh health'
alias vm-test='~/vibecode-webgui/scripts/vfkit/test-all-vms.sh'
alias vm-logs='~/vibecode-webgui/scripts/vfkit/vm-manager.sh logs'
```

### Cron Job for Monitoring
```bash
# Add to crontab (crontab -e)

# Health check every 5 minutes
*/5 * * * * ~/vibecode-webgui/scripts/vfkit/vm-health-check.sh >> /tmp/vm-health.log 2>&1

# Restart if unhealthy
*/10 * * * * ~/vibecode-webgui/scripts/vfkit/vm-health-check.sh || ~/vibecode-webgui/scripts/vfkit/vm-manager.sh restart-all
```

### Simple Dashboard Script
```bash
#!/bin/bash
# vm-dashboard.sh - Simple VM dashboard

watch -n 5 '
echo "=== VibeCode VM Dashboard ==="
echo ""
echo "Status:"
~/vibecode-webgui/scripts/vfkit/vm-manager.sh list
echo ""
echo "Health:"
~/vibecode-webgui/scripts/vfkit/vm-manager.sh health
echo ""
echo "Resources:"
~/vibecode-webgui/scripts/vfkit/vm-manager.sh monitor
'
```

## Advanced Usage

### Custom VM with Different Port
```bash
# Edit config
vim config/vfkit/valkey-vm.yaml

# Change port
network:
  - mode: nat
    forward:
      - host_port: 6380  # Changed from 6379
        guest_port: 6379

# Restart
./scripts/vfkit/vm-manager.sh restart valkey

# Connect to new port
redis-cli -h localhost -p 6380 -a VibeCodeChangeMe2025 ping
```

### Run Multiple Instances
```bash
# Copy config
cp config/vfkit/valkey-vm.yaml config/vfkit/valkey-test-vm.yaml

# Edit name and ports
sed -i '' 's/vibecode-valkey/vibecode-valkey-test/' config/vfkit/valkey-test-vm.yaml
sed -i '' 's/host_port: 6379/host_port: 6380/' config/vfkit/valkey-test-vm.yaml

# Start both
./scripts/vfkit/vm-manager.sh start valkey
./scripts/vfkit/vm-manager.sh start valkey-test
```

### Environment Variables
```bash
# Custom VibeCode directory
export VIBECODE_HOME=/custom/path
./scripts/vfkit/vm-manager.sh start-all

# Different config directory
export CONFIG_DIR=/custom/configs
./scripts/vfkit/vm-manager.sh start valkey
```

## Quick Reference Card

```
                                                     
         VibeCode VM Management Commands             
                                                     $
 Start All:    ./vm-manager.sh start-all             
 Stop All:     ./vm-manager.sh stop-all              
 Status:       ./vm-manager.sh list                  
 Health:       ./vm-manager.sh health                
 Test:         ./test-all-vms.sh                     
 Logs:         ./vm-manager.sh logs <vm> [lines]     
 Follow:       ./vm-manager.sh follow <vm>           
 Monitor:      ./vm-manager.sh monitor               
                                                     $
 VMs: valkey, postgresql, nodejs-dev                 
 Ports: 6379, 5432, 3000                             
 Logs: ~/.vibecode/vm-logs/                          
                                                     
```
