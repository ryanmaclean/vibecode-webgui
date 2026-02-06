#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Evaluate all 3 Datadog installation solutions
# Agent: QA Engineer

# Initialize log aggregation
init_log_aggregation


set -e

DATADOG_API_KEY="${DATADOG_API_KEY:-}"
DATADOG_SITE="${DATADOG_SITE:-datadoghq.com}"

if [ -z "$DATADOG_API_KEY" ]; then
    echo "❌ Error: DATADOG_API_KEY environment variable not set"
    echo ""
    echo "Usage: DATADOG_API_KEY=your-key-here ./scripts/evaluate-datadog-solutions.sh"
    exit 1
fi

echo "======================================================================"
echo "  Evaluating Datadog Installation Solutions"
echo "======================================================================"
echo ""
echo "Testing 3 approaches:"
echo "  1. SSH into running VZ VMs (Runtime installation)"
echo "  2. Cloud-init VM build (Pre-installed)"
echo "  3. Lima VMs with provisioning (Hybrid)"
echo ""

# =============================================================================
# Evaluation Criteria
# =============================================================================

RESULTS_FILE="/tmp/datadog-evaluation-results.txt"
cat > "$RESULTS_FILE" <<EOF
# Datadog Installation Solutions - Evaluation Results
Generated: $(date)

EOF

evaluate_solution() {
    local solution_name=$1
    local solution_num=$2
    
    echo "" | tee -a "$RESULTS_FILE"
    echo "======================================================================" | tee -a "$RESULTS_FILE"
    echo "  Solution $solution_num: $solution_name" | tee -a "$RESULTS_FILE"
    echo "======================================================================" | tee -a "$RESULTS_FILE"
    echo "" | tee -a "$RESULTS_FILE"
}

# =============================================================================
# Solution 1: SSH Installation
# =============================================================================

evaluate_solution "SSH into Running VMs" "1"

echo "📋 Evaluation Criteria:" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

echo "✅ Pros:" | tee -a "$RESULTS_FILE"
echo "  - Works with already-running VMs" | tee -a "$RESULTS_FILE"
echo "  - No rebuild required" | tee -a "$RESULTS_FILE"
echo "  - Quick to apply" | tee -a "$RESULTS_FILE"
echo "  - Can update agents on existing VMs" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

echo "❌ Cons:" | tee -a "$RESULTS_FILE"
echo "  - Requires SSH access to VMs" | tee -a "$RESULTS_FILE"
echo "  - VZ VMs currently don't have SSH configured" | tee -a "$RESULTS_FILE"
echo "  - Manual process for each VM" | tee -a "$RESULTS_FILE"
echo "  - Agents not preserved if VM is recreated" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

echo "⏱️  Setup Time: 2-5 minutes per VM" | tee -a "$RESULTS_FILE"
echo "🔧 Complexity: Medium (requires SSH setup first)" | tee -a "$RESULTS_FILE"
echo "🎯 Best For: Lima VMs with SSH already configured" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

echo "📊 Test Status:" | tee -a "$RESULTS_FILE"
if limactl list 2>/dev/null | grep -q "Running"; then
    echo "  ✅ Can test with Lima VMs" | tee -a "$RESULTS_FILE"
    echo "  Run: ./scripts/install-datadog-in-vms.sh" | tee -a "$RESULTS_FILE"
else
    echo "  ⚠️  No Lima VMs running to test" | tee -a "$RESULTS_FILE"
fi

# =============================================================================
# Solution 2: Cloud-init Build
# =============================================================================

evaluate_solution "Cloud-init VM Build Process" "2"

echo "📋 Evaluation Criteria:" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

echo "✅ Pros:" | tee -a "$RESULTS_FILE"
echo "  - Datadog pre-installed in image" | tee -a "$RESULTS_FILE"
echo "  - VM ready immediately on first boot" | tee -a "$RESULTS_FILE"
echo "  - Reproducible and version-controlled" | tee -a "$RESULTS_FILE"
echo "  - Works with VZ VMs natively" | tee -a "$RESULTS_FILE"
echo "  - Can include specific Datadog checks" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

echo "❌ Cons:" | tee -a "$RESULTS_FILE"
echo "  - Requires rebuilding all VM images (~30-45 min)" | tee -a "$RESULTS_FILE"
echo "  - Larger image size" | tee -a "$RESULTS_FILE"
echo "  - Need to rebuild to update Datadog agent" | tee -a "$RESULTS_FILE"
echo "  - API key baked into image (security concern)" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

echo "⏱️  Setup Time: 30-45 minutes (one-time build)" | tee -a "$RESULTS_FILE"
echo "🔧 Complexity: High (requires qemu-img, cloud-init knowledge)" | tee -a "$RESULTS_FILE"
echo "🎯 Best For: Production deployments, golden images" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

echo "📊 Test Status:" | tee -a "$RESULTS_FILE"
if command -v qemu-img &> /dev/null; then
    echo "  ✅ qemu-img available" | tee -a "$RESULTS_FILE"
    echo "  Run: ./scripts/build-vms-with-datadog.sh" | tee -a "$RESULTS_FILE"
else
    echo "  ⚠️  qemu-img not installed (brew install qemu)" | tee -a "$RESULTS_FILE"
fi

# =============================================================================
# Solution 3: Lima with Provisioning
# =============================================================================

evaluate_solution "Lima VMs with Provisioning Scripts" "3"

echo "📋 Evaluation Criteria:" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

echo "✅ Pros:" | tee -a "$RESULTS_FILE"
echo "  - Automated provisioning on VM creation" | tee -a "$RESULTS_FILE"
echo "  - Uses clean base images" | tee -a "$RESULTS_FILE"
echo "  - API key not in image, passed at runtime" | tee -a "$RESULTS_FILE"
echo "  - Easy to update (just restart VM)" | tee -a "$RESULTS_FILE"
echo "  - Supports port forwarding and mounts" | tee -a "$RESULTS_FILE"
echo "  - Best integration with macOS" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

echo "❌ Cons:" | tee -a "$RESULTS_FILE"
echo "  - Only works with Lima (not native VZ)" | tee -a "$RESULTS_FILE"
echo "  - First boot takes 2-3 minutes (provisioning)" | tee -a "$RESULTS_FILE"
echo "  - Requires Lima CLI installed" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

echo "⏱️  Setup Time: 5-10 minutes (includes provisioning)" | tee -a "$RESULTS_FILE"
echo "🔧 Complexity: Low (Lima handles most details)" | tee -a "$RESULTS_FILE"
echo "🎯 Best For: Development, VibeCode native app alternative" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

echo "📊 Test Status:" | tee -a "$RESULTS_FILE"
if command -v limactl &> /dev/null; then
    echo "  ✅ Lima installed" | tee -a "$RESULTS_FILE"
    echo "  Run: ./scripts/start-lima-vms-with-datadog.sh" | tee -a "$RESULTS_FILE"
else
    echo "  ⚠️  Lima not installed (brew install lima)" | tee -a "$RESULTS_FILE"
fi

# =============================================================================
# Summary and Recommendation
# =============================================================================

echo "" | tee -a "$RESULTS_FILE"
echo "======================================================================" | tee -a "$RESULTS_FILE"
echo "  SUMMARY & RECOMMENDATIONS" | tee -a "$RESULTS_FILE"
echo "======================================================================" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

echo "📊 Comparison Matrix:" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"
echo "| Criteria           | Solution 1 (SSH) | Solution 2 (Cloud-init) | Solution 3 (Lima) |" | tee -a "$RESULTS_FILE"
echo "|--------------------|--------------------|-------------------------|-------------------|" | tee -a "$RESULTS_FILE"
echo "| Setup Time         | 2-5 min/VM         | 30-45 min (one-time)    | 5-10 min          |" | tee -a "$RESULTS_FILE"
echo "| Complexity         | Medium             | High                    | Low               |" | tee -a "$RESULTS_FILE"
echo "| VZ Compatible      | Needs SSH          | ✅ Yes                   | ❌ No              |" | tee -a "$RESULTS_FILE"
echo "| Updates            | Manual             | Rebuild required        | Easy (restart)    |" | tee -a "$RESULTS_FILE"
echo "| Security           | Good               | API key in image        | Best              |" | tee -a "$RESULTS_FILE"
echo "| Automation         | Medium             | High                    | High              |" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

echo "🏆 RECOMMENDATION:" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"
echo "For VibeCode Native App (Current Goal):" | tee -a "$RESULTS_FILE"
echo "  → Use Solution 3 (Lima) for development" | tee -a "$RESULTS_FILE"
echo "  → Use Solution 2 (Cloud-init) for production distribution" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"
echo "Reasoning:" | tee -a "$RESULTS_FILE"
echo "  - Lima VMs work now and are easier to manage" | tee -a "$RESULTS_FILE"
echo "  - Cloud-init images for distribution ensure consistency" | tee -a "$RESULTS_FILE"
echo "  - Hybrid approach: develop with Lima, ship with cloud-init" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

echo "🚀 Next Steps:" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"
echo "1. Test Lima solution immediately:" | tee -a "$RESULTS_FILE"
echo "   DATADOG_API_KEY=\$DD_KEY ./scripts/start-lima-vms-with-datadog.sh" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"
echo "2. Build cloud-init images for distribution:" | tee -a "$RESULTS_FILE"
echo "   DATADOG_API_KEY=\$DD_KEY ./scripts/build-vms-with-datadog.sh" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"
echo "3. Verify Datadog metrics are flowing:" | tee -a "$RESULTS_FILE"
echo "   https://app.${DATADOG_SITE}/infrastructure" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

echo "======================================================================" | tee -a "$RESULTS_FILE"
echo ""
echo "✅ Evaluation complete!"
echo ""
echo "📄 Full results saved to: $RESULTS_FILE"
echo ""
cat "$RESULTS_FILE"

