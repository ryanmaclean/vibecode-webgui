#!/usr/bin/env python3
"""
Apple Silicon Performance Optimizations for AgentAPI
Provides macOS-specific performance tuning for M-series processors

Target: <300ms VM boot, <100ms allocation, <5W idle, 90%+ E-core utilization
Platform: M1/M2/M3 (ARM64)
"""

import asyncio
import ctypes
import os
import platform
import subprocess
import time
from dataclasses import dataclass
from enum import Enum
from typing import Optional, Dict, Any

import psutil


# ============================================================================
# 1. CPU Optimization: QoS and Core Affinity
# ============================================================================

class QoSClass(Enum):
    """macOS Quality of Service classes for thread scheduling"""
    USER_INTERACTIVE = 0x21    # Performance cores, UI responsiveness
    USER_INITIATED = 0x19       # Performance cores, user-triggered actions
    DEFAULT = 0x15              # Balanced P/E-core scheduling
    UTILITY = 0x11              # Efficiency cores preferred, background tasks
    BACKGROUND = 0x09           # Efficiency cores only, lowest priority


class AppleSiliconCPU:
    """Apple Silicon CPU optimization utilities"""

    def __init__(self):
        self.is_apple_silicon = platform.machine() == 'arm64'
        self.perf_cores = 0
        self.efficiency_cores = 0
        self._load_libpthread()
        self._detect_core_topology()

    def _load_libpthread(self):
        """Load macOS pthread library for QoS control"""
        try:
            self.libpthread = ctypes.CDLL('/usr/lib/system/libsystem_pthread.dylib')
            self.pthread_set_qos_class_self_np = self.libpthread.pthread_set_qos_class_self_np
            self.pthread_set_qos_class_self_np.argtypes = [ctypes.c_int, ctypes.c_int]
            self.pthread_set_qos_class_self_np.restype = ctypes.c_int
        except Exception as e:
            print(f"Warning: Could not load pthread library: {e}")
            self.libpthread = None

    def _detect_core_topology(self):
        """Detect P-core and E-core counts via sysctl"""
        try:
            # M1/M2/M3 all expose performance levels via sysctl
            result = subprocess.run(
                ['sysctl', '-n', 'hw.perflevel0.physicalcpu'],
                capture_output=True,
                text=True,
                timeout=1
            )
            self.perf_cores = int(result.stdout.strip())

            result = subprocess.run(
                ['sysctl', '-n', 'hw.perflevel1.physicalcpu'],
                capture_output=True,
                text=True,
                timeout=1
            )
            self.efficiency_cores = int(result.stdout.strip())

            print(f"Detected: {self.perf_cores}P + {self.efficiency_cores}E cores")
        except Exception as e:
            print(f"Warning: Could not detect core topology: {e}")
            # Fallback to total cores
            self.perf_cores = psutil.cpu_count(logical=False) or 4
            self.efficiency_cores = 0

    def set_thread_qos(self, qos_class: QoSClass) -> bool:
        """
        Set current thread Quality of Service class
        Influences macOS scheduler to prefer P-cores or E-cores

        Args:
            qos_class: Target QoS class

        Returns:
            True if successfully set, False otherwise
        """
        if not self.libpthread:
            return False

        try:
            ret = self.pthread_set_qos_class_self_np(qos_class.value, 0)
            return ret == 0
        except Exception as e:
            print(f"Warning: Could not set QoS class: {e}")
            return False

    def get_core_info(self) -> Dict[str, Any]:
        """Get CPU core information"""
        return {
            'platform': platform.machine(),
            'is_apple_silicon': self.is_apple_silicon,
            'performance_cores': self.perf_cores,
            'efficiency_cores': self.efficiency_cores,
            'total_cores': self.perf_cores + self.efficiency_cores,
            'logical_cores': psutil.cpu_count(logical=True),
        }


# Global CPU manager instance
cpu_manager = AppleSiliconCPU()


def optimize_for_background():
    """Optimize current thread for background execution (E-cores)"""
    if cpu_manager.set_thread_qos(QoSClass.BACKGROUND):
        print("Thread optimized for efficiency cores (background)")


def optimize_for_interactive():
    """Optimize current thread for interactive execution (P-cores)"""
    if cpu_manager.set_thread_qos(QoSClass.USER_INITIATED):
        print("Thread optimized for performance cores (interactive)")


# ============================================================================
# 2. Memory Optimization: Compression-Aware Caching
# ============================================================================

class CompressedCache:
    """
    Memory cache optimized for macOS memory compression
    Uses mmap for compression-friendly memory allocation
    """

    def __init__(self, max_size_mb: int = 100):
        self.max_size = max_size_mb * 1024 * 1024
        self.cache: Dict[str, tuple[int, int]] = {}
        self.current_offset = 0
        self.page_size = 16384  # macOS ARM64 page size

        # Use anonymous mmap for compression-friendly memory
        import mmap
        try:
            self.mmap_obj = mmap.mmap(-1, self.max_size)
            print(f"Initialized compressed cache: {max_size_mb}MB")
        except Exception as e:
            print(f"Warning: Could not create mmap cache: {e}")
            self.mmap_obj = None

    def _align_to_page(self, size: int) -> int:
        """Align size to page boundary for optimal compression"""
        return ((size + self.page_size - 1) // self.page_size) * self.page_size

    def store(self, key: str, data: bytes) -> bool:
        """Store data in compression-friendly cache"""
        if not self.mmap_obj:
            return False

        aligned_size = self._align_to_page(len(data))

        if self.current_offset + aligned_size > self.max_size:
            print("Cache full, evicting oldest entries")
            self._evict_oldest()

        try:
            offset = self.current_offset
            self.mmap_obj.seek(offset)
            self.mmap_obj.write(data)
            self.cache[key] = (offset, len(data))
            self.current_offset += aligned_size
            return True
        except Exception as e:
            print(f"Cache store error: {e}")
            return False

    def retrieve(self, key: str) -> Optional[bytes]:
        """Retrieve data from cache"""
        if not self.mmap_obj or key not in self.cache:
            return None

        try:
            offset, length = self.cache[key]
            self.mmap_obj.seek(offset)
            return self.mmap_obj.read(length)
        except Exception as e:
            print(f"Cache retrieve error: {e}")
            return None

    def _evict_oldest(self):
        """Simple FIFO eviction (replace with LRU for production)"""
        if self.cache:
            oldest_key = next(iter(self.cache))
            del self.cache[oldest_key]

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        return {
            'size_bytes': self.current_offset,
            'size_mb': self.current_offset / (1024 * 1024),
            'entries': len(self.cache),
            'utilization': (self.current_offset / self.max_size) * 100,
        }


# ============================================================================
# 3. Power Management: Adaptive Throttling
# ============================================================================

class PowerMode(Enum):
    """Power management modes"""
    PERFORMANCE = "performance"
    BALANCED = "balanced"
    EFFICIENCY = "efficiency"


@dataclass
class PowerState:
    """Current system power state"""
    on_battery: bool
    thermal_level: str
    cpu_percent: float
    power_mode: PowerMode


class PowerManager:
    """Adaptive power management for M-series processors"""

    def __init__(self):
        self.current_mode = PowerMode.BALANCED
        self.last_activity = time.time()

    def get_power_state(self) -> PowerState:
        """Query current power state"""
        on_battery = self._is_on_battery()
        thermal = self._get_thermal_level()
        cpu_percent = psutil.cpu_percent(interval=0.1)

        return PowerState(
            on_battery=on_battery,
            thermal_level=thermal,
            cpu_percent=cpu_percent,
            power_mode=self.current_mode
        )

    def _is_on_battery(self) -> bool:
        """Check if system is running on battery power"""
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

    def _get_thermal_level(self) -> str:
        """Get thermal state from pmset"""
        try:
            result = subprocess.run(
                ['pmset', '-g', 'therm'],
                capture_output=True,
                text=True,
                timeout=1
            )
            import re
            match = re.search(r'thermal level: (\w+)', result.stdout)
            return match.group(1) if match else "Unknown"
        except:
            return "Unknown"

    def select_power_mode(self, state: PowerState) -> PowerMode:
        """
        Automatically select power mode based on system state

        Rules:
        - Battery + thermal warning -> Efficiency
        - AC power + low CPU -> Efficiency
        - AC power + high CPU -> Performance
        """
        if state.on_battery or state.thermal_level not in ["Normal", "Unknown"]:
            return PowerMode.EFFICIENCY

        if state.cpu_percent > 70:
            return PowerMode.PERFORMANCE

        return PowerMode.BALANCED

    def get_power_config(self, mode: PowerMode) -> Dict[str, Any]:
        """Get configuration for power mode"""
        configs = {
            PowerMode.EFFICIENCY: {
                'max_concurrent_agents': 1,
                'polling_interval': 10,
                'cpu_limit': 0.5,
                'qos_class': QoSClass.BACKGROUND,
            },
            PowerMode.BALANCED: {
                'max_concurrent_agents': 2,
                'polling_interval': 5,
                'cpu_limit': 1.5,
                'qos_class': QoSClass.UTILITY,
            },
            PowerMode.PERFORMANCE: {
                'max_concurrent_agents': 4,
                'polling_interval': 1,
                'cpu_limit': 2.0,
                'qos_class': QoSClass.USER_INITIATED,
            },
        }
        return configs[mode]

    async def adaptive_power_loop(self):
        """Background loop for adaptive power management"""
        while True:
            state = self.get_power_state()
            recommended_mode = self.select_power_mode(state)

            if recommended_mode != self.current_mode:
                print(f"Power mode changed: {self.current_mode} -> {recommended_mode}")
                self.current_mode = recommended_mode

                # Apply new configuration
                config = self.get_power_config(recommended_mode)
                cpu_manager.set_thread_qos(config['qos_class'])

            # Check every 30 seconds
            await asyncio.sleep(30)


# ============================================================================
# 4. I/O Optimization: Async File Operations
# ============================================================================

class OptimizedFileManager:
    """
    Optimized file I/O for Apple Silicon NVMe storage
    Features:
    - Async I/O with buffering
    - Write coalescing
    - Sequential access hints
    """

    def __init__(self, base_dir: str, buffer_size: int = 64 * 1024):
        self.base_dir = base_dir
        self.buffer_size = buffer_size  # 64KB optimal for NVMe
        self.write_buffers: Dict[str, list[str]] = {}

    async def write_buffered(self, filename: str, data: str):
        """Buffered async write with coalescing"""
        if filename not in self.write_buffers:
            self.write_buffers[filename] = []

        self.write_buffers[filename].append(data)

        # Flush if buffer exceeds threshold
        total_size = sum(len(d) for d in self.write_buffers[filename])
        if total_size >= self.buffer_size:
            await self._flush_buffer(filename)

    async def _flush_buffer(self, filename: str):
        """Flush write buffer to disk"""
        if not self.write_buffers.get(filename):
            return

        import aiofiles
        filepath = os.path.join(self.base_dir, filename)

        try:
            async with aiofiles.open(filepath, 'a', buffering=self.buffer_size) as f:
                await f.write(''.join(self.write_buffers[filename]))
            self.write_buffers[filename] = []
        except Exception as e:
            print(f"Flush error for {filename}: {e}")

    async def read_sequential(self, filename: str) -> str:
        """Sequential read optimized for prefetching"""
        import aiofiles
        filepath = os.path.join(self.base_dir, filename)

        try:
            # Read entire file (OS does sequential prefetch)
            async with aiofiles.open(filepath, 'r') as f:
                return await f.read()
        except Exception as e:
            print(f"Read error for {filename}: {e}")
            return ""

    async def flush_all(self):
        """Flush all pending writes"""
        for filename in list(self.write_buffers.keys()):
            await self._flush_buffer(filename)


# ============================================================================
# 5. Performance Monitoring
# ============================================================================

class PerformanceMonitor:
    """Real-time performance monitoring for Apple Silicon"""

    def __init__(self):
        self.process = psutil.Process()
        self.start_time = time.time()

    def get_cpu_metrics(self) -> Dict[str, Any]:
        """Get CPU usage metrics"""
        return {
            'cpu_percent': self.process.cpu_percent(interval=0.1),
            'num_threads': self.process.num_threads(),
            'cpu_times': self.process.cpu_times()._asdict(),
        }

    def get_memory_metrics(self) -> Dict[str, Any]:
        """Get memory usage metrics"""
        mem_info = self.process.memory_info()
        return {
            'rss_mb': mem_info.rss / (1024 * 1024),
            'vms_mb': mem_info.vms / (1024 * 1024),
            'percent': self.process.memory_percent(),
        }

    def get_io_metrics(self) -> Dict[str, Any]:
        """Get I/O metrics"""
        try:
            io_counters = self.process.io_counters()
            return {
                'read_mb': io_counters.read_bytes / (1024 * 1024),
                'write_mb': io_counters.write_bytes / (1024 * 1024),
                'read_count': io_counters.read_count,
                'write_count': io_counters.write_count,
            }
        except:
            return {}

    def get_all_metrics(self) -> Dict[str, Any]:
        """Get comprehensive performance metrics"""
        return {
            'uptime_seconds': time.time() - self.start_time,
            'cpu': self.get_cpu_metrics(),
            'memory': self.get_memory_metrics(),
            'io': self.get_io_metrics(),
            'system': {
                'cpu_count': cpu_manager.perf_cores + cpu_manager.efficiency_cores,
                'perf_cores': cpu_manager.perf_cores,
                'efficiency_cores': cpu_manager.efficiency_cores,
            }
        }


# ============================================================================
# 6. Integration Helpers
# ============================================================================

async def initialize_optimizations(power_mode: str = "balanced"):
    """
    Initialize all Apple Silicon optimizations

    Args:
        power_mode: Initial power mode ('efficiency', 'balanced', 'performance')

    Returns:
        Dictionary of initialized managers
    """
    print("=== Initializing Apple Silicon Optimizations ===")

    # CPU optimization
    cpu_info = cpu_manager.get_core_info()
    print(f"CPU: {cpu_info['performance_cores']}P + {cpu_info['efficiency_cores']}E cores")

    # Set initial QoS based on power mode
    mode_map = {
        'efficiency': QoSClass.BACKGROUND,
        'balanced': QoSClass.UTILITY,
        'performance': QoSClass.USER_INITIATED,
    }
    qos = mode_map.get(power_mode, QoSClass.UTILITY)
    cpu_manager.set_thread_qos(qos)

    # Initialize managers
    power_mgr = PowerManager()
    power_mgr.current_mode = PowerMode(power_mode)

    perf_monitor = PerformanceMonitor()
    cache = CompressedCache(max_size_mb=100)

    print(f"Power mode: {power_mode}")
    print(f"QoS class: {qos.name}")
    print("=== Optimization initialization complete ===\n")

    return {
        'cpu': cpu_manager,
        'power': power_mgr,
        'monitor': perf_monitor,
        'cache': cache,
    }


async def run_optimization_benchmark():
    """Run quick benchmark to validate optimizations"""
    print("\n=== Running Optimization Benchmark ===")

    managers = await initialize_optimizations('balanced')
    monitor = managers['monitor']

    # CPU test: background thread
    print("Testing background thread (E-core scheduling)...")
    optimize_for_background()
    start = time.perf_counter()
    await asyncio.sleep(0.1)  # Simulate I/O wait
    duration = time.perf_counter() - start
    print(f"Background task: {duration*1000:.2f}ms")

    # CPU test: interactive thread
    print("Testing interactive thread (P-core scheduling)...")
    optimize_for_interactive()
    start = time.perf_counter()
    for _ in range(1000000):
        pass  # CPU-bound work
    duration = time.perf_counter() - start
    print(f"Interactive task: {duration*1000:.2f}ms")

    # Memory test: cache performance
    print("Testing compressed cache...")
    cache = managers['cache']
    test_data = b"test data " * 1000  # 10KB
    start = time.perf_counter()
    for i in range(100):
        cache.store(f"key{i}", test_data)
    duration = time.perf_counter() - start
    print(f"Cache write (100 x 10KB): {duration*1000:.2f}ms")

    # Performance metrics
    metrics = monitor.get_all_metrics()
    print(f"\nCurrent metrics:")
    print(f"  CPU: {metrics['cpu']['cpu_percent']:.1f}%")
    print(f"  Memory: {metrics['memory']['rss_mb']:.1f}MB")
    print(f"  Threads: {metrics['cpu']['num_threads']}")

    print("=== Benchmark complete ===\n")


# ============================================================================
# 7. Main Entry Point
# ============================================================================

if __name__ == "__main__":
    print("Apple Silicon Optimization Library")
    print(f"Platform: {platform.machine()}")
    print(f"Python: {platform.python_version()}")
    print()

    # Run benchmark
    asyncio.run(run_optimization_benchmark())

    # Display CPU info
    print("\nCPU Information:")
    cpu_info = cpu_manager.get_core_info()
    for key, value in cpu_info.items():
        print(f"  {key}: {value}")

    # Display power state
    print("\nPower State:")
    power_mgr = PowerManager()
    state = power_mgr.get_power_state()
    print(f"  Battery: {state.on_battery}")
    print(f"  Thermal: {state.thermal_level}")
    print(f"  CPU: {state.cpu_percent:.1f}%")
    print(f"  Mode: {state.power_mode.value}")
