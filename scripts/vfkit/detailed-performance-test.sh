#!/bin/bash
# Detailed VM performance test

echo "🔬 Detailed VM Performance Test"
echo "=============================="
echo ""

# Function to test multiple times
test_multiple_times() {
    local vm_name=$1
    local vm_dir=$2
    local launch_script=$3
    local iterations=$4
    
    echo "🧪 Testing $vm_name ($iterations iterations)..."
    
    total_time=0
    successful_tests=0
    
    for i in $(seq 1 $iterations); do
        echo "  Test $i/$iterations..."
        
        # Start VM
        cd "$vm_dir"
        start_time=$(date +%s.%N)
        $launch_script &
        vm_pid=$!
        
        # Wait for boot
        sleep 3
        
        end_time=$(date +%s.%N)
        boot_time=$(echo "$end_time - $start_time" | bc -l)
        
        total_time=$(echo "$total_time + $boot_time" | bc -l)
        successful_tests=$((successful_tests + 1))
        
        # Stop VM
        kill $vm_pid 2>/dev/null || true
        sleep 1
    done
    
    avg_time=$(echo "$total_time / $successful_tests" | bc -l)
    echo "  Average boot time: ${avg_time}s"
    echo "$avg_time" > "/tmp/${vm_name}_avg_time"
}

# Test both VMs multiple times
test_multiple_times "non-optimized" "$HOME/.vfkit/vms/vibecode-working-alpine" "./launch.sh" 3
test_multiple_times "optimized" "$HOME/.vfkit/vms/vibecode-optimized-alpine" "./launch.sh" 3

# Compare results
echo ""
echo "📊 Final Performance Comparison"
echo "=============================="

non_opt_avg=$(cat /tmp/non-optimized_avg_time 2>/dev/null || echo "999")
opt_avg=$(cat /tmp/optimized_avg_time 2>/dev/null || echo "999")

echo "Average Boot Time:"
echo "• Non-optimized: ${non_opt_avg}s"
echo "• Optimized: ${opt_avg}s"

if (( $(echo "$opt_avg < $non_opt_avg" | bc -l) )); then
    improvement=$(echo "($non_opt_avg - $opt_avg) / $non_opt_avg * 100" | bc -l)
    echo "✅ Optimized VM is ${improvement}% faster on average"
else
    echo "❌ Optimized VM is not faster on average"
fi

# Cleanup
rm -f /tmp/*_avg_time
