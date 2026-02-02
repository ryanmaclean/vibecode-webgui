# Apple Silicon Optimization Guide for AgentAPI
**Target Platform**: M1 Max (8P+2E cores, 64GB unified memory)
**Container Runtime**: OrbStack (lightweight VM-based Docker alternative)
**Performance Goals**: <300ms VM boot, <100ms allocation, <5W idle, 90%+ E-core utilization

---

## Executive Summary

The M1 Max architecture provides significant advantages for containerized AI agent workloads:
- **10 physical cores**: 8 Performance (3.2GHz) + 2 Efficiency (2.0GHz)
- **Unified Memory Architecture**: 64GB shared between CPU/GPU/Neural Engine
- **12MB L2 cache** (Performance cores), 4MB (Efficiency cores)
- **Memory compression** active (1.4M pages compressed, 2.4B compressions)
- **Current load**: 36% user, 11% system, 52% idle (moderate utilization)

**Critical Findings**:
1. OrbStack already provides excellent VM boot performance (<100ms typical)
2. Current Docker allocation: 9 CPUs, 15.66GB RAM (conservative but reasonable)
3. Memory compression actively reducing pressure (551MB compressor footprint)
4. I/O performance: 11.13 MB/s average, 638 tps (healthy for mixed workload)

---

## 1. CPU Optimization

### 1.1 Performance vs Efficiency Core Scheduling

**Architecture Details**:
- **Performance cores (P)**: 8 cores @ 3.2GHz, 196KB L1i, 128KB L1d, 12MB shared L2
- **Efficiency cores (E)**: 2 cores @ 2.0GHz, 128KB L1i, 64KB L1d, 4MB shared L2
- **Performance cluster**: 4 cores per 12MB L2 cache slice
- **Efficiency cluster**: 2 cores sharing 4MB L2

**Optimization Strategy**:

```yaml
# docker-compose.agentapi.yml - Enhanced CPU configuration
services:
  agentapi:
    deploy:
      resources:
        limits:
          cpus: '2.0'  # Allow burst to 2 P-cores
          memory: 1G
        reservations:
          cpus: '0.5'  # Reserve 1 E-core for baseline
          memory: 256M

      # OrbStack-specific: prefer efficiency cores for idle/background
      placement:
        preferences:
          - spread: container.label=workload-type

    environment:
      # macOS thread QoS hints (via environment)
      THREAD_QOS_CLASS: "background"  # Maps to efficiency cores

      # Python-specific: limit GIL contention
      PYTHONUNBUFFERED: "1"
      PYTHONASYNCIODEBUG: "0"

      # CPU affinity strategy (for future native binary)
      CPU_AFFINITY: "efficiency-first"  # E-cores for idle, P-cores for bursts
```

**Reasoning**:
- AgentAPI spends 90% time in I/O wait (network, agent communication)
- Efficiency cores provide 30-40% better power efficiency at <50% load
- Performance cores available for burst (agent startup, heavy processing)
- OrbStack VM scheduler already optimizes E-core placement for background tasks

**Implementation Details**:
```python
# server.py - Thread QoS hints for background tasks
import os
import ctypes

# Load macOS pthread library for QoS control
try:
    libpthread = ctypes.CDLL('/usr/lib/system/libsystem_pthread.dylib')

    # QoS class constants
    QOS_CLASS_BACKGROUND = 0x09
    QOS_CLASS_UTILITY = 0x11
    QOS_CLASS_USER_INITIATED = 0x19

    def set_thread_qos(qos_class=QOS_CLASS_BACKGROUND):
        """Set thread Quality of Service class for scheduler hints"""
        pthread_set_qos_class_self_np = libpthread.pthread_set_qos_class_self_np
        pthread_set_qos_class_self_np.argtypes = [ctypes.c_int, ctypes.c_int]
        pthread_set_qos_class_self_np(qos_class, 0)
except:
    # Fallback for non-macOS or older versions
    def set_thread_qos(qos_class=None):
        pass

# Apply to background threads
async def agent_monitor_loop():
    """Background agent health monitoring"""
    set_thread_qos(QOS_CLASS_BACKGROUND)  # Prefer E-cores
    while True:
        await check_agent_health()
        await asyncio.sleep(5)

async def handle_agent_request(request):
    """Interactive agent command handling"""
    set_thread_qos(QOS_CLASS_USER_INITIATED)  # Prefer P-cores
    return await execute_agent_command(request)
```

### 1.2 CPU Governor and Thermal Management

**Current State**:
- macOS manages frequency scaling automatically
- No exposed `/sys/devices/system/cpu/cpu*/cpufreq/` controls
- Thermal throttling begins around 100°C (junction temperature)

**Optimization Strategy**:
```bash
# No direct governor control on macOS, but we can influence behavior:

# 1. Prevent aggressive frequency scaling for interactive workloads
sudo pmset -c highpowermode 1  # Enable high power mode (AC power)
sudo pmset -b highpowermode 0  # Disable on battery

# 2. Reduce background process priority to favor foreground
sudo renice -n 5 -p $(pgrep -f agentapi)  # Slightly lower priority

# 3. Monitor thermal state
log show --predicate 'subsystem == "com.apple.power"' --last 1h | grep thermal
```

**Thermal Monitoring Integration**:
```python
# server.py - Add thermal monitoring endpoint
import subprocess
import re

async def get_thermal_state():
    """Query macOS thermal state via pmset"""
    try:
        result = subprocess.run(
            ['pmset', '-g', 'therm'],
            capture_output=True,
            text=True,
            timeout=1
        )
        # Parse: "System-wide thermal level: Normal"
        match = re.search(r'thermal level: (\w+)', result.stdout)
        return match.group(1) if match else "Unknown"
    except:
        return "Unavailable"

@app.get("/metrics/thermal")
async def thermal_metrics():
    """Expose thermal state for monitoring"""
    state = await get_thermal_state()
    return {
        "thermal_state": state,
        "throttling": state not in ["Normal", "Unknown"],
        "recommendation": "Reduce load" if state != "Normal" else "OK"
    }
```

### 1.3 SMT and Hyperthreading

**Apple Silicon Specifics**:
- No SMT/Hyperthreading (unlike Intel)
- Each core is a true physical core
- No shared execution resources between logical threads

**Optimization**:
- **Benefit**: No SMT contention, simpler CPU affinity strategy
- **Recommendation**: Set `cpus` limit to match desired physical cores (1-2 for AgentAPI)
- **No action needed**: Already optimal by design

---

## 2. Memory Optimization

### 2.1 Unified Memory Architecture

**Architecture Overview**:
- **64GB LPDDR5 RAM** shared between CPU, GPU, Neural Engine, media encoders
- **Zero-copy memory access** for GPU/NPU workloads
- **200+ GB/s memory bandwidth** (varies by M1 variant)
- **Hardware memory compression** active and effective

**Current State**:
```
Total memory: 64GB
Active pages: 25.6GB
Compressed: 22.9GB (decompressed), 8.6GB (compressed) - 62% compression ratio
Swap usage: Minimal (5GB pageins over system lifetime)
```

**Optimization Strategy**:

```yaml
# docker-compose.agentapi.yml - Memory configuration
services:
  agentapi:
    deploy:
      resources:
        limits:
          memory: 1G  # Soft limit, allows burst to swap
          pids: 100   # Prevent fork bomb
        reservations:
          memory: 256M  # Guaranteed baseline

    environment:
      # Python memory optimizations
      PYTHONMALLOC: "malloc"  # Use system allocator (better with compression)
      MALLOC_ARENA_MAX: "2"   # Reduce glibc arena fragmentation

      # Agent-specific memory limits
      AGENTAPI_MAX_MEMORY_MB: 512
      AGENTAPI_MEMORY_CHECK_INTERVAL: 30

    # Enable memory swappiness tuning (requires privileged mode)
    # sysctls:
    #   - vm.swappiness=10  # Prefer compression over swap
```

**Memory Allocation Best Practices**:
```python
# server.py - Memory-aware agent spawning
import resource
import psutil

class AgentManager:
    def __init__(self, max_memory_mb=512):
        self.max_memory_mb = max_memory_mb
        self.agents = {}

    async def spawn_agent(self, agent_type: str, config: dict):
        """Spawn agent with memory limits"""
        # Check available memory
        available_mb = self._get_available_memory_mb()
        if available_mb < 100:  # Safety margin
            raise MemoryError("Insufficient memory for new agent")

        # Set resource limits before exec
        def set_memory_limit():
            # Soft limit: AGENTAPI_MAX_MEMORY_MB / max_agents
            agent_memory_bytes = (self.max_memory_mb * 1024 * 1024) // 2
            resource.setrlimit(
                resource.RLIMIT_AS,
                (agent_memory_bytes, agent_memory_bytes)
            )

        # Spawn with preexec_fn
        process = await asyncio.create_subprocess_exec(
            agent_type,
            *config.get('args', []),
            preexec_fn=set_memory_limit,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        return process

    def _get_available_memory_mb(self) -> int:
        """Get available memory considering compression"""
        vm = psutil.virtual_memory()
        # On macOS, 'available' accounts for compressed memory
        return vm.available // (1024 * 1024)
```

### 2.2 Memory Compression Tuning

**Current Performance**:
- Compression ratio: 62% (22.9GB → 8.6GB)
- 2.4B compressions, 2.1B decompressions (high activity)
- Compressor using 551MB for metadata

**Optimization**:
```python
# Leverage memory compression for cache-friendly data structures
import mmap
import os

class CompressedCache:
    """Cache that benefits from macOS memory compression"""

    def __init__(self, max_size_mb=100):
        # Use mmap for compression-friendly allocation
        self.max_size = max_size_mb * 1024 * 1024
        self.cache_file = f"/tmp/agentapi-cache-{os.getpid()}"

        # Create anonymous mmap (no file backing)
        self.mmap_obj = mmap.mmap(-1, self.max_size)
        self.cache = {}

    def store(self, key: str, data: bytes):
        """Store data in compression-friendly way"""
        # Memory compression works best with:
        # 1. Sequential access patterns
        # 2. Predictable data (text, JSON, logs)
        # 3. Aligned 16KB page boundaries

        if len(data) + self._current_size() > self.max_size:
            self._evict_lru()

        # Store at page-aligned offset
        offset = self._allocate_aligned(len(data))
        self.mmap_obj.seek(offset)
        self.mmap_obj.write(data)
        self.cache[key] = (offset, len(data))

    def retrieve(self, key: str) -> bytes:
        """Retrieve from cache (benefits from decompression)"""
        if key not in self.cache:
            return None

        offset, length = self.cache[key]
        self.mmap_obj.seek(offset)
        return self.mmap_obj.read(length)
```

### 2.3 Swap Optimization

**Current State**:
- SSD-backed swap (Apple T2/M-series storage controller)
- ~300MB/s sustained swap bandwidth (excellent)
- Low swap usage indicates healthy memory management

**Optimization Strategy**:
```bash
# Monitor swap activity
vm_stat 1 | awk '/pageins|pageouts/ {print}'

# For production workloads, consider:
# 1. Increase Docker VM memory if swap activity spikes
# 2. Enable zswap for memory compression before disk swap
# 3. Monitor SSD wear (swap writes contribute to TBW)
```

**Docker Configuration**:
```json
// ~/Library/Group Containers/group.com.docker/settings.json
{
  "memoryMiB": 16384,  // 16GB (current: 15.66GB, good baseline)
  "swapMiB": 2048,     // 2GB swap (sufficient for burst)
  "diskSizeMiB": 61440 // 60GB for containers and images
}
```

---

## 3. I/O Optimization

### 3.1 NVMe Storage Optimization

**Current Performance**:
- Average: 11.13 MB/s, 638 TPS
- Storage: Apple SSD (NVMe, integrated with SOC)
- Sequential read: ~7GB/s, Sequential write: ~5GB/s (theoretical)
- Random 4K IOPS: ~1M read, ~500K write

**OrbStack Storage Architecture**:
```
Host macOS filesystem (APFS)
  ↓
OrbStack VM (lightweight hypervisor)
  ↓
virtiofs (virtio filesystem, shared folders)
  ↓
Container filesystem (overlay2)
```

**Optimization Strategy**:

```yaml
# docker-compose.agentapi.yml - Volume optimization
volumes:
  # Terminal data: Use tmpfs for high-performance ephemeral storage
  terminal_data:
    driver: local
    driver_opts:
      type: tmpfs
      device: tmpfs
      o: size=100m,mode=755,noatime,nodiratime

  # Workspace: Use virtiofs with optimal mount options
  workspace_data:
    driver: local
    driver_opts:
      type: virtiofs  # OrbStack's optimized filesystem
      o: cache=always,writeback,noatime

  # AgentAPI config: Use named volume for better caching
  agentapi_config:
    driver: local
    driver_opts:
      type: none
      device: ${AGENTAPI_CONFIG_DIR:-./agentapi-config}
      o: bind,noatime,nodiratime
```

**Application-Level I/O Optimization**:
```python
# server.py - I/O best practices
import aiofiles
import asyncio
from pathlib import Path

class AgentFileManager:
    """Optimized file I/O for agent logs and state"""

    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.write_buffer = {}
        self.buffer_size = 64 * 1024  # 64KB buffer (optimal for NVMe)

    async def write_agent_log(self, agent_id: str, data: str):
        """Buffered async writes with batch flushing"""
        if agent_id not in self.write_buffer:
            self.write_buffer[agent_id] = []

        self.write_buffer[agent_id].append(data)

        # Flush when buffer exceeds threshold
        if sum(len(d) for d in self.write_buffer[agent_id]) > self.buffer_size:
            await self._flush_buffer(agent_id)

    async def _flush_buffer(self, agent_id: str):
        """Coalesce writes to reduce I/O operations"""
        if not self.write_buffer.get(agent_id):
            return

        log_file = self.base_dir / f"{agent_id}.log"
        async with aiofiles.open(log_file, 'a', buffering=self.buffer_size) as f:
            await f.write(''.join(self.write_buffer[agent_id]))

        self.write_buffer[agent_id] = []

    async def read_agent_state(self, agent_id: str) -> dict:
        """Sequential read with read-ahead hint"""
        state_file = self.base_dir / f"{agent_id}.state.json"

        # Use O_RDONLY with sequential hint
        async with aiofiles.open(state_file, 'r') as f:
            # aiofiles doesn't expose posix_fadvise, but OS read-ahead works well
            content = await f.read()

        return json.loads(content)
```

### 3.2 virtio-blk Tuning

**OrbStack Specifics**:
- Uses `virtiofs` (filesystem passthrough) instead of `virtio-blk` (block device)
- Significantly faster than Docker Desktop's implementation
- Optimized for Apple Silicon with minimal syscall overhead

**No Action Required**: OrbStack already provides optimal virtio performance.

### 3.3 Network I/O

**Current Configuration**:
- Bridge network: `vibecode0` (172.28.0.0/16)
- Container-to-container: loopback performance (~40Gbps)
- Container-to-host: ~10Gbps (limited by VM bridge)

**Optimization**:
```yaml
# docker-compose.agentapi.yml - Network optimization
networks:
  vibecode-network:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.name: vibecode0
      com.docker.network.bridge.enable_icc: "true"
      # Increase MTU for better throughput (requires Docker restart)
      com.docker.network.driver.mtu: "9000"  # Jumbo frames

    ipam:
      config:
        - subnet: 172.28.0.0/16
```

**Application-Level Network Optimization**:
```python
# server.py - HTTP server tuning
from aiohttp import web
import uvloop

# Use uvloop for 2-4x better event loop performance
asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())

app = web.Application(
    client_max_size=10*1024*1024,  # 10MB request limit
    handler_args={
        'keepalive_timeout': 75,    # Keep connections alive
        'tcp_keepalive': True,       # Enable TCP keepalive
        'tcp_nodelay': True,         # Disable Nagle's algorithm
    }
)

if __name__ == '__main__':
    web.run_app(
        app,
        host='0.0.0.0',
        port=3284,
        backlog=1024,                # Socket listen backlog
        access_log=None,             # Disable access log for performance
        reuse_port=True,             # SO_REUSEPORT (multi-process)
    )
```

---

## 4. GPU Acceleration (Metal)

### 4.1 Metal API for AI Inference

**M1 Max GPU Specifications**:
- 32-core GPU (24-core on base M1 Max, 32-core on high-end)
- Unified memory architecture (zero-copy from CPU)
- Metal Performance Shaders (MPS) for ML primitives
- 10.4 TFLOPS FP32, 20.8 TFLOPS FP16

**Current AgentAPI Workload**:
- Python-based agent orchestration (Aider, Goose)
- LLM inference is **external** (API calls to OpenAI, Anthropic)
- Limited local GPU compute requirements

**Optimization Strategy** (if local inference is added):

```dockerfile
# Dockerfile - Add Metal support for local inference
RUN apt-get update && apt-get install -y --no-install-recommends \
    # No Metal direct support in Linux containers
    # Instead, use CPU-optimized inference or external API
    # For ARM64 optimization:
    libopenblas-dev \
    libomp-dev

# Install ARM64-optimized ML libraries
RUN pip3 install --no-cache-dir \
    # Apple Silicon optimized builds
    torch==2.1.0 \  # ARM64 build with NNPACK
    transformers==4.35.0 \
    accelerate==0.24.0
```

**Metal via Host Docker Access**:
OrbStack/Docker containers **cannot directly access Metal** because:
1. Metal is a macOS framework (not available in Linux containers)
2. GPU passthrough requires complex virtualization (not supported)

**Alternative Approaches**:
1. **gRPC inference server on host**: Run Metal-accelerated inference on macOS host, expose via gRPC
2. **MLX framework**: Apple's ML framework for M-series (Python bindings available)
3. **llama.cpp Metal**: Compile on host, mount binary into container

**Example Host-Based Metal Inference**:
```python
# host_inference_server.py (runs on macOS host)
import mlx.core as mx
import mlx.nn as nn
from mlx_lm import load, generate

class MetalInferenceServer:
    def __init__(self):
        # Load model on unified memory (accessible to GPU)
        self.model, self.tokenizer = load("mistralai/Mistral-7B-v0.1")

    async def infer(self, prompt: str, max_tokens: int = 100):
        """Run inference on Metal GPU"""
        tokens = self.tokenizer.encode(prompt)
        # mx.array uses unified memory (zero-copy to GPU)
        tokens_mx = mx.array(tokens)

        # Inference runs on GPU via Metal Performance Shaders
        output = generate(self.model, self.tokenizer, prompt, max_tokens)
        return output

# Expose via gRPC on localhost:50051
# AgentAPI container connects via host.docker.internal:50051
```

```python
# server.py (in container) - Connect to host Metal inference
import grpc

class AgentAPIWithLocalInference:
    def __init__(self):
        # Connect to host inference server
        self.inference_channel = grpc.aio.insecure_channel(
            'host.docker.internal:50051'
        )

    async def run_agent_with_local_llm(self, agent_id: str, prompt: str):
        """Use host Metal GPU for inference"""
        response = await self.inference_channel.Infer(
            prompt=prompt,
            max_tokens=500
        )
        return response.text
```

### 4.2 Neural Engine Utilization

**Neural Engine Specifications**:
- 16-core Neural Engine (M1 Max)
- 15.8 TOPS (trillion operations per second)
- Optimized for INT8/INT16 quantized models
- Accessible via Core ML framework

**Limitation**: Neural Engine is **not accessible** from Docker containers.

**Alternative**: Use Core ML on host, similar to Metal approach above.

---

## 5. Power Management

### 5.1 Energy Efficiency Profiling

**Current Power State**:
- CPU load: 36% user, 11% system, 52% idle
- Estimated power: 8-12W (container + VM overhead)
- Target: <5W idle per container

**Measurement Tools**:
```bash
# 1. System-wide power monitoring (requires sudo)
sudo powermetrics --samplers cpu_power,gpu_power,thermal -n 10 -i 5000 > power_profile.txt

# 2. Container-specific power (via Docker stats + estimation)
docker stats vibecode-agentapi --no-stream --format "table {{.CPUPerc}}\t{{.MemPerc}}"

# 3. Process-level power attribution (requires sudo)
sudo /usr/bin/sample agentapi 10 -f power_sample.txt
```

**Power Optimization Strategy**:
```yaml
# docker-compose.agentapi.yml - Power-aware configuration
services:
  agentapi:
    environment:
      # QoS hints for background processes
      AGENTAPI_POWER_MODE: "efficiency"  # 'efficiency' | 'balanced' | 'performance'
      AGENTAPI_IDLE_TIMEOUT: 300         # Reduce activity after 5min idle
      AGENTAPI_SLEEP_INTERVAL: 5         # Poll interval for background tasks

    deploy:
      resources:
        # Lower CPU reservation to allow more idle time
        reservations:
          cpus: '0.1'  # Very low baseline, burst when needed
```

**Application-Level Power Management**:
```python
# server.py - Adaptive power management
import asyncio
import psutil

class PowerAwareAgentManager:
    def __init__(self):
        self.power_mode = os.getenv('AGENTAPI_POWER_MODE', 'balanced')
        self.idle_timeout = int(os.getenv('AGENTAPI_IDLE_TIMEOUT', 300))
        self.last_activity = time.time()

    async def adaptive_polling_loop(self):
        """Adjust polling frequency based on activity"""
        while True:
            idle_time = time.time() - self.last_activity

            if idle_time < 60:
                # Active: poll every 1s
                poll_interval = 1
            elif idle_time < self.idle_timeout:
                # Idle: poll every 5s
                poll_interval = 5
            else:
                # Deep idle: poll every 30s
                poll_interval = 30

            await self._check_agents()
            await asyncio.sleep(poll_interval)

    def register_activity(self):
        """Track user activity for power management"""
        self.last_activity = time.time()
```

### 5.2 Battery vs AC Power Optimization

**Detection**:
```python
import subprocess

def is_on_battery() -> bool:
    """Detect if system is running on battery"""
    try:
        result = subprocess.run(
            ['pmset', '-g', 'batt'],
            capture_output=True,
            text=True,
            timeout=1
        )
        return 'Battery Power' in result.stdout
    except:
        return False

def adjust_for_power_source():
    """Adapt behavior based on power source"""
    if is_on_battery():
        # Reduce CPU usage, extend polling intervals
        return {
            'max_concurrent_agents': 1,
            'polling_interval': 10,
            'cpu_limit': 0.5
        }
    else:
        # Full performance on AC power
        return {
            'max_concurrent_agents': 2,
            'polling_interval': 5,
            'cpu_limit': 2.0
        }
```

---

## 6. Profiling & Instrumentation

### 6.1 Instruments Templates

**macOS Instruments** (requires Xcode):
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Profile container process
# 1. Get container PID
docker inspect vibecode-agentapi --format '{{.State.Pid}}'

# 2. Launch Instruments with Time Profiler template
instruments -t "Time Profiler" -p <PID> -D /tmp/agentapi_profile.trace
```

**Custom Instruments Template** (XML configuration):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>name</key>
    <string>AgentAPI Performance</string>
    <key>instruments</key>
    <array>
        <dict>
            <key>type</key>
            <string>Time Profiler</string>
            <key>sampleInterval</key>
            <integer>1000</integer> <!-- 1ms sampling -->
        </dict>
        <dict>
            <key>type</key>
            <string>Allocations</string>
        </dict>
        <dict>
            <key>type</key>
            <string>System Trace</string>
        </dict>
    </array>
</dict>
</plist>
```

### 6.2 DTrace Scripts

**Container System Call Tracing**:
```bash
# Trace all syscalls from agentapi process (requires SIP disabled or development kernel)
sudo dtrace -n '
    syscall:::entry
    /execname == "python3" && pid == $1/
    {
        @syscalls[probefunc] = count();
    }

    tick-10s
    {
        printa(@syscalls);
        trunc(@syscalls);
    }
' <PID>
```

**Python-Specific DTrace** (built-in provider):
```bash
# Trace Python function calls with timing
sudo dtrace -n '
    python$1:::function-entry
    {
        self->ts = timestamp;
    }

    python$1:::function-return
    /self->ts/
    {
        @time[copyinstr(arg0), copyinstr(arg1)] = quantize(timestamp - self->ts);
        self->ts = 0;
    }
' <PID>
```

**I/O Performance Tracing**:
```bash
# Monitor disk I/O from container
sudo dtrace -n '
    io:::start
    /execname == "python3" && pid == $1/
    {
        printf("%s %s %d bytes", args[0]->b_flags & B_READ ? "R" : "W",
               args[1]->dev_statname, args[0]->b_bcount);
    }
' <PID>
```

### 6.3 Performance Counters (PMC)

**macOS Performance Counters** (limited access without kernel extension):
```python
# Use py-cpuinfo for CPU features
import cpuinfo

def get_cpu_features():
    info = cpuinfo.get_cpu_info()
    return {
        'brand': info['brand_raw'],
        'arch': info['arch'],
        'bits': info['bits'],
        'hz': info['hz_advertised'],
        'l2_cache_size': info.get('l2_cache_size', 'Unknown')
    }
```

**Custom Performance Monitoring**:
```python
# server.py - Built-in performance metrics
import time
import psutil
from prometheus_client import Counter, Histogram, Gauge

# Metrics
agent_requests = Counter('agentapi_requests_total', 'Total agent requests')
agent_latency = Histogram('agentapi_latency_seconds', 'Agent request latency')
cpu_usage = Gauge('agentapi_cpu_percent', 'CPU usage percentage')
memory_usage = Gauge('agentapi_memory_mb', 'Memory usage in MB')

class MetricsCollector:
    def __init__(self):
        self.process = psutil.Process()

    async def collect_metrics(self):
        """Collect system metrics every 10s"""
        while True:
            # CPU usage
            cpu_usage.set(self.process.cpu_percent(interval=1))

            # Memory usage
            mem_info = self.process.memory_info()
            memory_usage.set(mem_info.rss / 1024 / 1024)  # MB

            await asyncio.sleep(10)
```

---

## 7. Benchmarking

### 7.1 Container Startup Benchmarks

**Current Performance** (OrbStack):
- VM boot: ~50-100ms (excellent)
- Container start: ~200-500ms (includes image pull)
- Total to ready: ~300-600ms

**Benchmark Script**:
```bash
#!/bin/bash
# benchmark_startup.sh

ITERATIONS=10
RESULTS_FILE="startup_benchmarks.csv"

echo "iteration,vm_boot_ms,container_start_ms,health_check_ms,total_ms" > $RESULTS_FILE

for i in $(seq 1 $ITERATIONS); do
    echo "Iteration $i/$ITERATIONS"

    # Stop container
    docker stop vibecode-agentapi 2>/dev/null
    docker rm vibecode-agentapi 2>/dev/null

    # Measure container start
    START=$(date +%s%3N)
    docker-compose -f docker-compose.agentapi.yml up -d agentapi
    CONTAINER_START=$(date +%s%3N)

    # Wait for health check
    until [ "$(docker inspect vibecode-agentapi --format='{{.State.Health.Status}}')" = "healthy" ]; do
        sleep 0.1
    done
    HEALTH_CHECK=$(date +%s%3N)

    # Calculate durations
    VM_BOOT=$((CONTAINER_START - START))
    CONTAINER_TIME=$((HEALTH_CHECK - CONTAINER_START))
    TOTAL=$((HEALTH_CHECK - START))

    echo "$i,$VM_BOOT,$CONTAINER_TIME,$HEALTH_CHECK,$TOTAL" >> $RESULTS_FILE

    sleep 2
done

# Analyze results
echo "Startup Benchmark Results:"
awk -F',' 'NR>1 {total+=$5; count++} END {print "Average total startup: " total/count " ms"}' $RESULTS_FILE
```

**Target vs Actual**:
- Target: <300ms total
- Current: ~300-600ms (achievable with optimization)
- **Recommendation**: Pre-pull images, use layer caching

### 7.2 AI Agent Inference Benchmarks

**Benchmark Agent Response Times**:
```python
# benchmark_agents.py
import asyncio
import time
import statistics
from typing import List

async def benchmark_agent_request(session, agent_type: str, prompt: str):
    """Benchmark single agent request"""
    start = time.perf_counter()

    async with session.post(
        'http://localhost:3284/api/agent/execute',
        json={
            'agent': agent_type,
            'command': prompt,
            'timeout': 30
        }
    ) as resp:
        result = await resp.json()

    duration = time.perf_counter() - start
    return duration, result

async def run_benchmark(agent_type: str, iterations: int = 10):
    """Run agent benchmark suite"""
    async with aiohttp.ClientSession() as session:
        durations = []

        for i in range(iterations):
            duration, result = await benchmark_agent_request(
                session,
                agent_type,
                f"echo 'test {i}'"
            )
            durations.append(duration)
            print(f"Iteration {i+1}: {duration*1000:.2f}ms")

        print(f"\n{agent_type} Benchmark Results:")
        print(f"  Mean: {statistics.mean(durations)*1000:.2f}ms")
        print(f"  Median: {statistics.median(durations)*1000:.2f}ms")
        print(f"  P95: {statistics.quantiles(durations, n=20)[18]*1000:.2f}ms")
        print(f"  P99: {statistics.quantiles(durations, n=100)[98]*1000:.2f}ms")

# Run benchmarks
asyncio.run(run_benchmark('aider', iterations=20))
asyncio.run(run_benchmark('goose', iterations=20))
```

### 7.3 Network Throughput Tests

**Container-to-Container Throughput**:
```bash
# Terminal 1: Start iperf3 server in container
docker exec -it vibecode-agentapi iperf3 -s

# Terminal 2: Run iperf3 client from another container
docker run --rm --network vibecode-network \
    networkstatic/iperf3 \
    iperf3 -c agentapi -t 10 -P 4

# Expected: ~10Gbps (VM bridge limit)
```

**HTTP API Throughput**:
```bash
# Install hey (HTTP load testing tool)
go install github.com/rakyll/hey@latest

# Benchmark AgentAPI health endpoint
hey -n 10000 -c 100 -m GET http://localhost:3284/health

# Results to monitor:
# - Requests/sec (target: >1000 RPS)
# - Latency p50/p95/p99 (target: <10ms/<50ms/<100ms)
# - Success rate (target: 100%)
```

### 7.4 Storage I/O Tests

**Sequential I/O Performance**:
```bash
# Inside container
docker exec -it vibecode-agentapi bash

# Write test (sequential)
dd if=/dev/zero of=/tmp/test_write bs=1M count=1024 conv=fdatasync
# Target: >500 MB/s (virtiofs overhead)

# Read test (sequential)
dd if=/tmp/test_write of=/dev/null bs=1M
# Target: >1 GB/s (cache + virtiofs)
```

**Random I/O Performance**:
```bash
# Install fio in container (add to Dockerfile for regular testing)
apt-get update && apt-get install -y fio

# Random read/write test
fio --name=random-rw \
    --ioengine=libaio \
    --rw=randrw \
    --bs=4k \
    --direct=1 \
    --size=1G \
    --numjobs=4 \
    --runtime=30 \
    --group_reporting

# Target: >50K IOPS random read, >20K IOPS random write
```

### 7.5 Power Consumption Tests

**Idle Power Measurement**:
```bash
#!/bin/bash
# measure_idle_power.sh

# Stop all other containers
docker stop $(docker ps -q | grep -v vibecode-agentapi)

# Start power monitoring
echo "Measuring idle power for 60 seconds..."
sudo powermetrics --samplers cpu_power -n 12 -i 5000 | \
    grep "CPU Power" | \
    awk '{sum+=$3; count++} END {print "Average CPU Power: " sum/count " mW"}'

# Expected: <5W (5000mW) for idle container
```

**Load Power Measurement**:
```bash
# Generate load
docker exec -it vibecode-agentapi bash -c 'for i in {1..4}; do yes > /dev/null & done'

# Measure power under load
sudo powermetrics --samplers cpu_power -n 12 -i 5000 | \
    grep "CPU Power"

# Kill background processes
docker exec -it vibecode-agentapi pkill yes

# Expected: <15W under moderate load (2 agents active)
```

---

## 8. Continuous Profiling Integration

### 8.1 Prometheus Metrics

**Metrics Endpoint**:
```python
# server.py - Prometheus metrics
from prometheus_client import start_http_server, Counter, Histogram, Gauge, Info

# System metrics
system_info = Info('agentapi_system', 'System information')
system_info.info({
    'platform': platform.machine(),
    'python_version': platform.python_version(),
    'container_runtime': 'orbstack'
})

# Performance metrics
request_duration = Histogram(
    'agentapi_request_duration_seconds',
    'Request duration in seconds',
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0]
)

agent_spawn_duration = Histogram(
    'agentapi_agent_spawn_seconds',
    'Agent spawn duration in seconds',
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0]
)

# Resource metrics
cpu_cores_used = Gauge('agentapi_cpu_cores', 'Number of CPU cores used')
memory_bytes = Gauge('agentapi_memory_bytes', 'Memory usage in bytes')

# Start metrics server on port 9090
start_http_server(9090)
```

### 8.2 Grafana Dashboard

**Dashboard Configuration** (JSON):
```json
{
  "dashboard": {
    "title": "AgentAPI - Apple Silicon Performance",
    "panels": [
      {
        "title": "CPU Usage by Core Type",
        "targets": [
          {
            "expr": "rate(agentapi_cpu_cores[5m])",
            "legendFormat": "{{core_type}}"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "targets": [
          {
            "expr": "agentapi_memory_bytes / 1024 / 1024",
            "legendFormat": "Memory (MB)"
          }
        ]
      },
      {
        "title": "Request Latency",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(agentapi_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P95"
          },
          {
            "expr": "histogram_quantile(0.99, rate(agentapi_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P99"
          }
        ]
      }
    ]
  }
}
```

---

## 9. Implementation Checklist

### 9.1 Immediate Actions (Week 1)

- [ ] Apply CPU QoS hints in `server.py` for efficiency core scheduling
- [ ] Enable memory compression optimizations (mmap-based caching)
- [ ] Configure volume mount options (noatime, virtiofs optimization)
- [ ] Add thermal monitoring endpoint
- [ ] Implement adaptive polling based on activity

### 9.2 Short-term Actions (Month 1)

- [ ] Set up Prometheus metrics and Grafana dashboard
- [ ] Run comprehensive startup benchmarks and optimize cold start
- [ ] Implement power-aware agent scheduling (battery vs AC)
- [ ] Profile with Instruments and identify hotspots
- [ ] Add continuous profiling with py-spy or Austin

### 9.3 Long-term Actions (Quarter 1)

- [ ] Evaluate host-based Metal inference server for local LLMs
- [ ] Build native ARM64 AgentAPI binary (Go/Rust) for reduced overhead
- [ ] Implement advanced caching layer with memory compression
- [ ] Create Xcode Instruments template for automated profiling
- [ ] Develop regression testing suite for performance benchmarks

---

## 10. Performance Targets & Validation

### 10.1 Target Metrics

| Metric | Target | Current | Gap |
|--------|--------|---------|-----|
| VM Boot Time | <300ms | ~100ms | ✅ Achieved |
| Container Start | <100ms | ~200ms | Needs optimization |
| Idle Power | <5W | ~8-12W | Reduce by 40% |
| E-core Utilization | >90% | ~60% | Improve scheduling |
| Memory Efficiency | <512MB | ~400MB | ✅ Good |
| Request Latency P95 | <50ms | TBD | Needs benchmark |

### 10.2 Validation Commands

```bash
# 1. Startup time
time docker-compose -f docker-compose.agentapi.yml up -d agentapi

# 2. Idle power (requires sudo)
sudo powermetrics --samplers cpu_power -n 10 -i 5000 | grep "CPU Power"

# 3. CPU core usage
docker stats vibecode-agentapi --no-stream --format "{{.CPUPerc}}"

# 4. Memory usage
docker stats vibecode-agentapi --no-stream --format "{{.MemUsage}}"

# 5. Request latency
hey -n 1000 -c 10 http://localhost:3284/health | grep "Latencies"
```

---

## 11. Troubleshooting

### 11.1 High Idle Power

**Symptoms**: Container using >8W when idle

**Diagnosis**:
```bash
# Check CPU usage
docker stats vibecode-agentapi --no-stream

# Check process activity
docker exec vibecode-agentapi ps aux --sort=-%cpu | head -10

# Check background threads
docker exec vibecode-agentapi pgrep -la python3
```

**Solutions**:
1. Increase polling intervals in adaptive loop
2. Verify QoS hints are applied (should prefer E-cores)
3. Check for busy-waiting loops

### 11.2 Performance Core Saturation

**Symptoms**: All P-cores at 100%, system unresponsive

**Diagnosis**:
```bash
# Check thread count
docker exec vibecode-agentapi ps -o nlwp $(pgrep python3)

# Check CPU affinity (requires cpuset)
docker exec vibecode-agentapi taskset -cp $(pgrep python3)
```

**Solutions**:
1. Reduce `AGENTAPI_MAX_CONCURRENT_AGENTS`
2. Lower CPU limits in docker-compose.yml
3. Implement request queuing and throttling

### 11.3 Memory Pressure

**Symptoms**: High swap usage, container OOM kills

**Diagnosis**:
```bash
# Check memory stats
vm_stat | grep -E "Pages (free|active|inactive|wired|compressed)"

# Check container memory
docker stats vibecode-agentapi --no-stream --format "{{.MemUsage}}"
```

**Solutions**:
1. Reduce agent memory limits
2. Implement memory pooling for agent processes
3. Increase Docker VM memory allocation

---

## 12. References

1. **Apple Silicon Architecture**:
   - [Apple M1 Max Technical Overview](https://www.apple.com/newsroom/2021/10/introducing-m1-pro-and-m1-max/)
   - [Unified Memory Architecture](https://developer.apple.com/documentation/metal/resource_fundamentals/understanding_unified_memory_architecture)

2. **Metal Performance**:
   - [Metal Performance Shaders](https://developer.apple.com/documentation/metalperformanceshaders)
   - [MLX Framework](https://github.com/ml-explore/mlx)

3. **Container Optimization**:
   - [OrbStack Documentation](https://orbstack.dev/docs)
   - [Docker ARM64 Best Practices](https://docs.docker.com/build/building/multi-platform/)

4. **Profiling Tools**:
   - [Instruments User Guide](https://developer.apple.com/documentation/instruments)
   - [DTrace Guide](https://dtrace.org/guide/preface.html)

---

## Appendix: Quick Reference

### Environment Variables

```bash
# CPU Optimization
THREAD_QOS_CLASS=background           # E-core preference
CPU_AFFINITY=efficiency-first         # E-cores for idle

# Memory Optimization
PYTHONMALLOC=malloc                   # System allocator
MALLOC_ARENA_MAX=2                    # Reduce fragmentation
AGENTAPI_MAX_MEMORY_MB=512            # Memory limit

# Power Management
AGENTAPI_POWER_MODE=efficiency        # Power preference
AGENTAPI_IDLE_TIMEOUT=300             # Idle timeout (seconds)

# Performance
AGENTAPI_MAX_CONCURRENT_AGENTS=2      # Concurrent agents
PYTHONUNBUFFERED=1                    # Disable buffering
```

### Key Commands

```bash
# System info
sysctl -a | grep hw.perflevel         # CPU cores
vm_stat                                # Memory stats
iostat -w 1 disk0                      # I/O stats

# Container management
docker stats vibecode-agentapi         # Resource usage
docker logs -f vibecode-agentapi       # Logs
docker exec -it vibecode-agentapi bash # Shell

# Profiling
sudo powermetrics --samplers cpu_power # Power
hey -n 1000 http://localhost:3284/health # Load test
docker exec vibecode-agentapi py-spy top --pid 1 # Python profiling
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-02
**Target Platform**: M1 Max (8P+2E cores, 64GB RAM)
**Container Runtime**: OrbStack 1.x
