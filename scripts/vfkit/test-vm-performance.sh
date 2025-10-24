#!/bin/bash
# Test VM performance: optimized vs non-optimized

set -e

echo "🧪 VM Performance Test"
echo "===================="
echo "Testing optimized vs non-optimized kernel performance"
echo ""

# Test parameters
BOOT_TIMEOUT=60

# Function to measure boot time
measure_boot_time() {
    local vm_name=$1
    local vm_dir=$2
    local launch_script=$3
    
    echo "🚀 Testing $vm_name boot time..."
    
    # Start VM
    cd "$vm_dir"
    start_time=$(date +%s.%N)
    $launch_script &
    vm_pid=$!
    
    # Wait for VM to boot (check console log)
    boot_complete=false
    timeout=$(( $(date +%s) + BOOT_TIMEOUT ))
    
    while [ $(date +%s) -lt $timeout ]; do
        if [ -f "logs/console.log" ]; then
            if grep -q "System ready" logs/console.log 2>/dev/null; then
                boot_complete=true
                break
            fi
        fi
        sleep 1
    done
    
    end_time=$(date +%s.%N)
    boot_time=$(echo "$end_time - $start_time" | bc -l)
    
    if [ "$boot_complete" = true ]; then
        echo "✅ $vm_name booted in ${boot_time}s"
        echo "$boot_time" > "/tmp/${vm_name}_boot_time"
    else
        echo "❌ $vm_name failed to boot within ${BOOT_TIMEOUT}s"
        echo "999" > "/tmp/${vm_name}_boot_time"
    fi
    
    # Stop VM
    kill $vm_pid 2>/dev/null || true
    sleep 2
    
    return 0
}

echo "📊 Performance Test Results"
echo "=========================="

# Test non-optimized VM
echo ""
echo "🔍 Testing Non-Optimized VM..."
measure_boot_time "non-optimized" "$HOME/.vfkit/vms/vibecode-working-alpine" "./launch.sh"

# Test optimized VM
echo ""
echo "🚀 Testing Optimized VM..."
measure_boot_time "optimized" "$HOME/.vfkit/vms/vibecode-optimized-alpine" "./launch.sh"

# Compare results
echo ""
echo "📈 Performance Comparison"
echo "========================"

non_opt_boot=$(cat /tmp/non-optimized_boot_time 2>/dev/null || echo "999")
opt_boot=$(cat /tmp/optimized_boot_time 2>/dev/null || echo "999")

echo "Boot Time:"
echo "• Non-optimized: ${non_opt_boot}s"
echo "• Optimized: ${opt_boot}s"

if (( $(echo "$opt_boot < $non_opt_boot" | bc -l) )); then
    improvement=$(echo "($non_opt_boot - $opt_boot) / $non_opt_boot * 100" | bc -l)
    echo "✅ Optimized VM is ${improvement}% faster to boot"
else
    echo "❌ Optimized VM is not faster to boot"
fi

echo ""
echo "🎯 Conclusion:"
if (( $(echo "$opt_boot < $non_opt_boot" | bc -l) )); then
    echo "✅ Kernel optimizations provide measurable performance benefits!"
else
    echo "❌ Kernel optimizations do not provide measurable performance benefits."
fi

# Cleanup
rm -f /tmp/*_boot_time
