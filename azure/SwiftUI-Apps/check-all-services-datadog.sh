#!/bin/bash

# Datadog statsd host
DD_AGENT_HOST=${DD_AGENT_HOST:-localhost}
DD_DOGSTATSD_PORT=${DD_DOGSTATSD_PORT:-8125}

# Function to send metric
send_metric() {
  local metric=$1
  local value=$2
  local type=$3
  local tags=$4
  echo "${metric}:${value}|${type}|${tags}" | nc -u -w0 $DD_AGENT_HOST $DD_DOGSTATSD_PORT
}

# Function to get milliseconds (portable way)
get_ms() {
  python3 -c 'import time; print(int(time.time() * 1000))'
}

echo "=== VibeCode Service Health Check with Datadog Telemetry ==="

SERVICES_UP=0
SERVICES_DOWN=0

# Test SSH (port 2222)
echo -n "Testing SSH (port 2222)... "
START=$(get_ms)
if nc -zv -w 2 localhost 2222 2>&1 | grep -q succeeded; then
  END=$(get_ms)
  DURATION=$((END - START))
  echo "✓ UP (${DURATION}ms)"
  send_metric "vibecode.service.health" "1" "g" "#service:ssh,status:up"
  send_metric "vibecode.service.response_time" "$DURATION" "ms" "#service:ssh"
  SERVICES_UP=$((SERVICES_UP + 1))
else
  END=$(get_ms)
  DURATION=$((END - START))
  echo "✗ DOWN"
  send_metric "vibecode.service.health" "0" "g" "#service:ssh,status:down"
  send_metric "vibecode.service.response_time" "$DURATION" "ms" "#service:ssh"
  SERVICES_DOWN=$((SERVICES_DOWN + 1))
fi

# Test Valkey (port 6379)
echo -n "Testing Valkey (port 6379)... "
START=$(get_ms)
if nc -zv -w 2 localhost 6379 2>&1 | grep -q succeeded; then
  END=$(get_ms)
  DURATION=$((END - START))
  echo "✓ UP (${DURATION}ms)"
  send_metric "vibecode.service.health" "1" "g" "#service:valkey,status:up"
  send_metric "vibecode.service.response_time" "$DURATION" "ms" "#service:valkey"
  SERVICES_UP=$((SERVICES_UP + 1))
else
  END=$(get_ms)
  DURATION=$((END - START))
  echo "✗ DOWN"
  send_metric "vibecode.service.health" "0" "g" "#service:valkey,status:down"
  send_metric "vibecode.service.response_time" "$DURATION" "ms" "#service:valkey"
  SERVICES_DOWN=$((SERVICES_DOWN + 1))
fi

# Test PostgreSQL (port 5432)
echo -n "Testing PostgreSQL (port 5432)... "
START=$(get_ms)
if nc -zv -w 2 localhost 5432 2>&1 | grep -q succeeded; then
  END=$(get_ms)
  DURATION=$((END - START))
  echo "✓ UP (${DURATION}ms)"
  send_metric "vibecode.service.health" "1" "g" "#service:postgresql,status:up"
  send_metric "vibecode.service.response_time" "$DURATION" "ms" "#service:postgresql"
  SERVICES_UP=$((SERVICES_UP + 1))
else
  END=$(get_ms)
  DURATION=$((END - START))
  echo "✗ DOWN"
  send_metric "vibecode.service.health" "0" "g" "#service:postgresql,status:down"
  send_metric "vibecode.service.response_time" "$DURATION" "ms" "#service:postgresql"
  SERVICES_DOWN=$((SERVICES_DOWN + 1))
fi

# Test OpenVSCode (port 8080)
echo -n "Testing OpenVSCode (port 8080)... "
START=$(get_ms)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080)
END=$(get_ms)
DURATION=$((END - START))
if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ UP (HTTP $HTTP_CODE, ${DURATION}ms)"
  send_metric "vibecode.service.health" "1" "g" "#service:openvscode,status:up"
  send_metric "vibecode.service.response_time" "$DURATION" "ms" "#service:openvscode"
  send_metric "vibecode.service.http_status" "$HTTP_CODE" "g" "#service:openvscode"
  SERVICES_UP=$((SERVICES_UP + 1))
else
  echo "✗ DOWN (HTTP $HTTP_CODE)"
  send_metric "vibecode.service.health" "0" "g" "#service:openvscode,status:down"
  send_metric "vibecode.service.response_time" "$DURATION" "ms" "#service:openvscode"
  send_metric "vibecode.service.http_status" "$HTTP_CODE" "g" "#service:openvscode"
  SERVICES_DOWN=$((SERVICES_DOWN + 1))
fi

# Test Terminal Commands (the actual fix we're testing)
echo -n "Testing terminal commands via SSH... "
START=$(get_ms)
TEST_OUTPUT=$(sshpass -p vibecode ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p 2222 root@localhost "ls / 2>&1" 2>/dev/null)
END=$(get_ms)
DURATION=$((END - START))
if echo "$TEST_OUTPUT" | grep -q "bin"; then
  echo "✓ ls command works (${DURATION}ms)"
  send_metric "vibecode.terminal.commands" "1" "g" "#command:ls,status:working"
  send_metric "vibecode.terminal.response_time" "$DURATION" "ms" "#command:ls"
else
  echo "✗ ls command failed"
  send_metric "vibecode.terminal.commands" "0" "g" "#command:ls,status:failed"
  send_metric "vibecode.terminal.response_time" "$DURATION" "ms" "#command:ls"
fi

# Overall health
echo ""
echo "=== Summary ==="
echo "Services UP: $SERVICES_UP"
echo "Services DOWN: $SERVICES_DOWN"

send_metric "vibecode.services.up" "$SERVICES_UP" "g" "#env:dev"
send_metric "vibecode.services.down" "$SERVICES_DOWN" "g" "#env:dev"
send_metric "vibecode.health_check" "1" "c" "#env:dev"

if [ $SERVICES_DOWN -eq 0 ]; then
  echo "✓ All services operational"
  exit 0
else
  echo "✗ Some services are down"
  exit 1
fi
