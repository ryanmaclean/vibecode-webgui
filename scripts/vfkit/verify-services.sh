#!/usr/bin/env bash
# Verify that services are installed and working in Alpine VM
# Run this script inside the Alpine VM after setup

set -e

echo "======================================================================"
echo "  Alpine ARM64 Services Verification"
echo "======================================================================"
echo ""

PASS=0
FAIL=0

check_service() {
    local name=$1
    local cmd=$2
    
    if eval "$cmd" &>/dev/null; then
        echo "✅ $name"
        ((PASS++))
    else
        echo "❌ $name"
        ((FAIL++))
    fi
}

echo "System Information:"
echo "  Alpine version: $(cat /etc/alpine-release)"
echo "  Architecture: $(uname -m)"
echo "  Kernel: $(uname -r)"
echo ""

echo "Checking installed services..."
echo ""

# Check Valkey
echo "Valkey:"
check_service "  Valkey binary installed" "test -x /usr/local/bin/valkey-server"
check_service "  Valkey CLI installed" "test -x /usr/local/bin/valkey-cli"
check_service "  Valkey config exists" "test -f /etc/valkey/valkey.conf"
check_service "  Valkey user exists" "id valkey"

if command -v valkey-server &>/dev/null; then
    VERSION=$(valkey-server --version | awk '{print $3}')
    echo "  Version: $VERSION"
    SIZE=$(ls -lh /usr/local/bin/valkey-server | awk '{print $5}')
    echo "  Binary size: $SIZE"
fi
echo ""

# Check PostgreSQL
echo "PostgreSQL:"
check_service "  PostgreSQL binary installed" "command -v postgres"
check_service "  psql client installed" "command -v psql"
check_service "  PostgreSQL data dir exists" "test -d /var/lib/postgresql/data"
check_service "  PostgreSQL user exists" "id postgres"

if command -v postgres &>/dev/null; then
    VERSION=$(postgres --version | awk '{print $3}')
    echo "  Version: $VERSION"
fi

# Check pgvector
if command -v psql &>/dev/null && rc-service postgresql status | grep -q started; then
    if su - postgres -c "psql -d postgres -tAc \"SELECT 1 FROM pg_available_extensions WHERE name='vector'\"" | grep -q 1; then
        echo "✅   pgvector extension available"
        ((PASS++))
        PGVECTOR_VER=$(su - postgres -c "psql -d postgres -tAc \"SELECT extversion FROM pg_available_extensions WHERE name='vector'\"")
        echo "  pgvector version: $PGVECTOR_VER"
    else
        echo "❌   pgvector extension not available"
        ((FAIL++))
    fi
else
    echo "⚠️    pgvector check skipped (PostgreSQL not running)"
fi
echo ""

# Check Node.js
echo "Node.js:"
check_service "  Node.js binary installed" "command -v node"
check_service "  npm binary installed" "command -v npm"

if command -v node &>/dev/null; then
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    echo "  Node.js version: $NODE_VERSION"
    echo "  npm version: $NPM_VERSION"
    
    # Test core modules
    if node -e "require('crypto'); require('fs'); require('http');" &>/dev/null; then
        echo "✅   Core modules working"
        ((PASS++))
    else
        echo "❌   Core modules failing"
        ((FAIL++))
    fi
fi
echo ""

# Service Status
echo "Service Status:"
for service in valkey postgresql; do
    if rc-service $service status &>/dev/null; then
        STATUS=$(rc-service $service status 2>&1 | head -1)
        if echo "$STATUS" | grep -q "started"; then
            echo "✅ $service: running"
            ((PASS++))
        else
            echo "⚠️  $service: $STATUS"
        fi
    else
        echo "⚠️  $service: not configured"
    fi
done
echo ""

# Connection Tests
echo "Connection Tests:"

# Test Valkey connection
if rc-service valkey status 2>&1 | grep -q "started"; then
    if valkey-cli ping &>/dev/null; then
        echo "✅ Valkey: responding to PING"
        ((PASS++))
    else
        echo "❌ Valkey: not responding"
        ((FAIL++))
    fi
else
    echo "⚠️  Valkey: not running, skipping connection test"
fi

# Test PostgreSQL connection
if rc-service postgresql status 2>&1 | grep -q "started"; then
    if su - postgres -c "psql -c 'SELECT 1'" &>/dev/null; then
        echo "✅ PostgreSQL: accepting connections"
        ((PASS++))
    else
        echo "❌ PostgreSQL: not accepting connections"
        ((FAIL++))
    fi
else
    echo "⚠️  PostgreSQL: not running, skipping connection test"
fi

echo ""

# Summary
echo "======================================================================"
echo "  Verification Summary"
echo "======================================================================"
echo ""
echo "Results: $PASS passed, $FAIL failed"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "✅ All services are installed and working!"
    echo ""
    echo "To start services:"
    echo "  rc-service valkey start"
    echo "  rc-service postgresql start"
    echo ""
    echo "To enable services at boot:"
    echo "  rc-update add valkey"
    echo "  rc-update add postgresql"
    exit 0
else
    echo "❌ Some services are not working properly."
    echo ""
    echo "Check the logs:"
    echo "  /var/log/valkey/valkey.log"
    echo "  /var/log/postgresql/postgresql.log"
    exit 1
fi

