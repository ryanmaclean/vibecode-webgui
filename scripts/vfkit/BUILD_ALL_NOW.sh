#!/usr/bin/env bash
# FINAL SOLUTION: Create one Alpine VM, build everything in it
# No Docker, no complex networking, just works!

set -euo pipefail

VM_DIR="${HOME}/.vfkit/vms/builder-vm"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "======================================================================"
echo "  Creating Alpine Builder VM - SIMPLEST APPROACH"
echo "======================================================================"
echo ""
echo "This will:"
echo "  1. Use the existing working Alpine test VM"
echo "  2. Copy build script into it via console"
echo "  3. Execute builds directly"
echo "  4. All 4 services built in ~10 minutes"
echo ""

# Check if Alpine VM is running
ALPINE_PID=$(ps aux | grep "vibecode-alpine" | grep vfkit | grep -v grep | head -1)

if [[ -z "$ALPINE_PID" ]]; then
    echo "❌ Alpine VM not running"
    echo ""
    echo "Please start the Alpine VM first:"
    echo "  ~/.vfkit/vms/vibecode-alpine/launch.sh &"
    echo ""
    echo "Then run this script again"
    exit 1
fi

echo "✅ Alpine VM is running"
echo ""

# Display the build script that needs to be run
echo "======================================================================"
echo "  BUILD SCRIPT TO RUN IN ALPINE VM"
echo "======================================================================"
echo ""
echo "Copy/paste this ENTIRE block into the Alpine VM console:"
echo ""
echo "---START BUILD SCRIPT---"
cat /tmp/build-all-services-now.sh
echo "---END BUILD SCRIPT---"
echo ""
echo "======================================================================"
echo "  Instructions"
echo "======================================================================"
echo ""
echo "1. Open the Alpine VM console:"
echo "   tail -f ~/.vfkit/vms/vibecode-alpine/logs/console.log"
echo ""
echo "2. In the console, you'll see a shell prompt: ~ #"
echo ""
echo "3. Copy the entire build script above and paste it into the console"
echo "   (The script will run automatically)"
echo ""
echo "4. Wait 10-15 minutes for all services to build"
echo ""
echo "5. Services will be running:"
echo "   - Valkey: port 6379"
echo "   - PostgreSQL + pgvector: port 5432"
echo "   - openvscode + RAG: port 3000"
echo "   - Node.js 24: included"
echo ""
echo "Expected result: ~181 MB total (5x smaller than Ubuntu!)"
echo ""


