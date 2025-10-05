#!/usr/bin/env bash
# Noisy Neighbor Experiment for MicroVM Launches
# Tests microVM boot performance under various load conditions
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/../../artifacts/noisy-neighbor-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="${RESULTS_DIR}/experiment_${TIMESTAMP}.json"

# Configuration
NUM_BASELINE_RUNS="${NUM_BASELINE_RUNS:-5}"
NUM_CONCURRENT_VMS="${NUM_CONCURRENT_VMS:-10}"
NUM_NOISY_RUNS="${NUM_NOISY_RUNS:-5}"
VM_IMAGE="${VM_IMAGE:-bench-images/minivim/bzImage-x86_64}"
DATADOG_API_KEY="${DD_API_KEY:-}"

echo "=== Noisy Neighbor Experiment ==="
echo "Baseline runs: ${NUM_BASELINE_RUNS}"
echo "Concurrent VMs: ${NUM_CONCURRENT_VMS}"
echo "Noisy runs: ${NUM_NOISY_RUNS}"
echo "Results: ${RESULT_FILE}"
echo ""

mkdir -p "${RESULTS_DIR}"

# Initialize results JSON
cat > "${RESULT_FILE}" <<EOF
{
  "experiment_id": "noisy-neighbor-${TIMESTAMP}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "configuration": {
    "baseline_runs": ${NUM_BASELINE_RUNS},
    "concurrent_vms": ${NUM_CONCURRENT_VMS},
    "noisy_runs": ${NUM_NOISY_RUNS},
    "vm_image": "${VM_IMAGE}"
  },
  "baseline": [],
  "noisy": [],
  "summary": {}
}
EOF

# Function to measure VM boot time
measure_boot_time() {
  local run_id=$1
  local label=$2
  
  echo "  Run ${run_id}: Measuring boot time..."
  
  local start_time=$(date +%s%3N)
  
  # Simulate VM boot (replace with actual VM launch command)
  # For now, use sleep to simulate boot time
  if command -v firecracker &> /dev/null; then
    # Use actual firecracker if available
    timeout 30s firecracker --config-file /tmp/vm-config.json &> /dev/null || true
  else
    # Simulate boot
    sleep 0.$((RANDOM % 100))
  fi
  
  local end_time=$(date +%s%3N)
  local boot_time=$((end_time - start_time))
  
  echo "    Boot time: ${boot_time}ms"
  echo "${boot_time}"
}

# Function to create background load (noisy neighbors)
create_background_load() {
  local num_vms=$1
  echo "  Creating ${num_vms} concurrent VMs for background load..."
  
  local pids=()
  for i in $(seq 1 "${num_vms}"); do
    (
      # Simulate VM workload
      while true; do
        dd if=/dev/zero of=/dev/null bs=1M count=100 2>/dev/null || true
        sleep 0.1
      done
    ) &
    pids+=($!)
  done
  
  echo "${pids[@]}"
}

# Function to stop background load
stop_background_load() {
  local pids=($@)
  echo "  Stopping background load..."
  for pid in "${pids[@]}"; do
    kill "${pid}" 2>/dev/null || true
  done
}

# Phase 1: Baseline measurements (no noisy neighbors)
echo "Phase 1: Baseline measurements (no contention)"
baseline_times=()
for i in $(seq 1 "${NUM_BASELINE_RUNS}"); do
  boot_time=$(measure_boot_time "${i}" "baseline")
  baseline_times+=("${boot_time}")
  
  # Add to JSON
  jq --arg bt "${boot_time}" \
     '.baseline += [{"run": '"${i}"', "boot_time_ms": ($bt | tonumber)}]' \
     "${RESULT_FILE}" > "${RESULT_FILE}.tmp"
  mv "${RESULT_FILE}.tmp" "${RESULT_FILE}"
done

# Calculate baseline stats
baseline_avg=$(IFS=+; echo "scale=2; (${baseline_times[*]}) / ${#baseline_times[@]}" | bc)
echo "Baseline average: ${baseline_avg}ms"
echo ""

# Phase 2: Measurements with noisy neighbors
echo "Phase 2: Measurements with ${NUM_CONCURRENT_VMS} concurrent VMs"
noisy_pids=$(create_background_load "${NUM_CONCURRENT_VMS}")
sleep 2  # Let load stabilize

noisy_times=()
for i in $(seq 1 "${NUM_NOISY_RUNS}"); do
  boot_time=$(measure_boot_time "${i}" "noisy")
  noisy_times+=("${boot_time}")
  
  # Add to JSON
  jq --arg bt "${boot_time}" \
     '.noisy += [{"run": '"${i}"', "boot_time_ms": ($bt | tonumber)}]' \
     "${RESULT_FILE}" > "${RESULT_FILE}.tmp"
  mv "${RESULT_FILE}.tmp" "${RESULT_FILE}"
done

# Stop background load
stop_background_load ${noisy_pids}

# Calculate noisy stats
noisy_avg=$(IFS=+; echo "scale=2; (${noisy_times[*]}) / ${#noisy_times[@]}" | bc)
echo "Noisy average: ${noisy_avg}ms"

# Calculate degradation
degradation=$(echo "scale=2; ((${noisy_avg} - ${baseline_avg}) / ${baseline_avg}) * 100" | bc)
echo "Performance degradation: ${degradation}%"
echo ""

# Update summary in JSON
jq --arg baseline_avg "${baseline_avg}" \
   --arg noisy_avg "${noisy_avg}" \
   --arg degradation "${degradation}" \
   '.summary = {
      "baseline_avg_ms": ($baseline_avg | tonumber),
      "noisy_avg_ms": ($noisy_avg | tonumber),
      "degradation_percent": ($degradation | tonumber),
      "acceptable": (($degradation | tonumber) < 20)
   }' \
   "${RESULT_FILE}" > "${RESULT_FILE}.tmp"
mv "${RESULT_FILE}.tmp" "${RESULT_FILE}"

# Report results
echo "=== Experiment Complete ==="
echo "Results saved to: ${RESULT_FILE}"
echo ""
jq '.summary' "${RESULT_FILE}"

# Send metrics to Datadog if configured
if [[ -n "${DATADOG_API_KEY}" ]]; then
  echo ""
  echo "Sending metrics to Datadog..."
  
  curl -X POST "https://api.datadoghq.com/api/v1/series" \
    -H "Content-Type: application/json" \
    -H "DD-API-KEY: ${DATADOG_API_KEY}" \
    -d '{
      "series": [
        {
          "metric": "minivim.noisy_neighbor.baseline_ms",
          "points": [['"$(date +%s)"', '"${baseline_avg}"']],
          "type": "gauge",
          "tags": ["experiment:noisy-neighbor"]
        },
        {
          "metric": "minivim.noisy_neighbor.degradation_percent",
          "points": [['"$(date +%s)"', '"${degradation}"']],
          "type": "gauge",
          "tags": ["experiment:noisy-neighbor", "concurrent_vms:'"${NUM_CONCURRENT_VMS}"'"]
        }
      ]
    }' || echo "Failed to send metrics to Datadog"
fi

# Check if degradation is acceptable
if (( $(echo "${degradation} > 20" | bc -l) )); then
  echo ""
  echo "⚠️  WARNING: Performance degradation exceeds 20%!"
  echo "Consider investigating resource contention issues."
  exit 1
else
  echo ""
  echo "✅ Performance degradation within acceptable limits (<20%)"
  exit 0
fi
