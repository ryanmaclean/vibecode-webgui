#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Test actual VM boot time to shell prompt

# Initialize log aggregation
init_log_aggregation


echo "⏱️  Real VM Boot Time Test"
echo "========================"
echo "Measuring actual VM boot time to shell prompt"
echo ""

# Function to measure real boot time
measure_real_boot_time() {
    local vm_name=$1
    local vm_dir=$2
    local launch_script=$3
    
    echo "🚀 Testing $vm_name real boot time..."
    
    # Start VM
    cd "$vm_dir"
    $launch_script &
    vm_pid=$!
    
    # Wait for VM to actually boot (check for shell prompt in console)
    start_time=$(date +%s.%N)
    boot_complete=false
    timeout=30
    
    for i in $(seq 1 $timeout); do
        if [ -f "logs/console.log" ]; then
            # Look for shell prompt or system ready message
            if grep -q "System ready\|~ #\|# " logs/console.log 2>/dev/null; then
                boot_complete=true
                break
            fi
        fi
        sleep 1
    done
    
    end_time=$(date +%s.%N)
    boot_time=$(echo "$end_time - $start_time" | bc -l)
    
    if [ "$boot_complete" = true ]; then
        echo "✅ $vm_name booted to shell in ${boot_time}s"
        echo "$boot_time" > "/tmp/${vm_name}_real_boot_time"
    else
        echo "❌ $vm_name failed to boot within ${timeout}s"
        echo "999" > "/tmp/${vm_name}_real_boot_time"
    fi
    
    # Stop VM
    kill $vm_pid 2>/dev/null || true
    sleep 2
    
    return 0
}

# Test both VMs
echo "🔍 Testing Non-Optimized VM..."
measure_real_boot_time "non-optimized" "$HOME/.vfkit/vms/vibecode-working-alpine" "./launch.sh"

echo ""
echo "🚀 Testing Optimized VM..."
measure_real_boot_time "optimized" "$HOME/.vfkit/vms/vibecode-optimized-alpine" "./launch.sh"

# Compare results
echo ""
echo "📊 Real Boot Time Comparison"
echo "==========================="

non_opt_boot=$(cat /tmp/non-optimized_real_boot_time 2>/dev/null || echo "999")
opt_boot=$(cat /tmp/optimized_real_boot_time 2>/dev/null || echo "999")

echo "Real Boot Time to Shell:"
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
    echo "✅ Kernel optimizations provide measurable boot time benefits!"
else
    echo "❌ Kernel optimizations do not provide measurable boot time benefits."
fi

# Cleanup
rm -f /tmp/*_real_boot_time
