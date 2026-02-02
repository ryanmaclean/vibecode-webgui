#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Quick 5-minute intensive monitoring with 15-second intervals
"""

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import subprocess
import time
import csv
from datetime import datetime
import sys

def get_metrics(pid):
    """Get all metrics in one call"""
    try:
        # App metrics
        result = subprocess.run(
            ['ps', '-p', str(pid), '-o', '%cpu,%mem,rss,vsz'],
            capture_output=True, text=True, timeout=3
        )
        stats = result.stdout.strip().split('\n')[1].split()
        app = {
            'cpu': float(stats[0]),
            'mem': float(stats[1]),
            'rss': int(stats[2]),
            'vsz': int(stats[3])
        }

        # Threads
        result = subprocess.run(
            ['ps', '-M', '-p', str(pid)],
            capture_output=True, text=True, timeout=3
        )
        app['threads'] = len(result.stdout.strip().split('\n')) - 1

        # File descriptors
        result = subprocess.run(
            ['sh', '-c', f'lsof -p {pid} 2>/dev/null | wc -l'],
            capture_output=True, text=True, timeout=3
        )
        app['fds'] = int(result.stdout.strip()) - 1 if result.stdout.strip() else 0

        # System CPU
        result = subprocess.run(
            ['sh', '-c', 'top -l 1 -n 0 | grep "CPU usage"'],
            capture_output=True, text=True, timeout=3
        )
        sys_metrics = {}
        if 'CPU usage' in result.stdout:
            parts = result.stdout.split()
            sys_metrics['user'] = float(parts[2].rstrip('%'))
            sys_metrics['sys'] = float(parts[4].rstrip('%'))
            sys_metrics['idle'] = float(parts[6].rstrip('%'))
        else:
            sys_metrics = {'user': 0, 'sys': 0, 'idle': 0}

        return {**app, **sys_metrics}
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return None

def main():
    app_pid = 91895
    duration = 300  # 5 minutes
    interval = 15   # 15 seconds
    max_samples = duration // interval
    output = '/Users/ryan.maclean/vibecode-webgui/resource-usage-data.csv'

    print(f"Quick Intensive Monitoring")
    print(f"=========================")
    print(f"PID: {app_pid}")
    print(f"Duration: {duration}s ({duration//60} minutes)")
    print(f"Interval: {interval}s")
    print(f"Expected samples: {max_samples}")
    print(f"Start: {datetime.now()}")
    print()

    # Verify process exists
    result = subprocess.run(['ps', '-p', str(app_pid)], capture_output=True)
    if result.returncode != 0:
        print(f"ERROR: Process {app_pid} not found!")
        return

    # Initialize CSV
    with open(output, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'timestamp', 'elapsed_sec', 'app_cpu_percent', 'app_mem_percent',
            'app_rss_kb', 'app_vsz_kb', 'app_threads', 'app_fds',
            'system_cpu_user', 'system_cpu_sys', 'system_cpu_idle'
        ])

    start_time = time.time()
    sample_count = 0

    try:
        while sample_count < max_samples:
            current_time = time.time()
            elapsed = int(current_time - start_time)

            # Check if process still exists
            result = subprocess.run(['ps', '-p', str(app_pid)], capture_output=True)
            if result.returncode != 0:
                print(f"ERROR: Process {app_pid} terminated!")
                break

            # Get metrics
            metrics = get_metrics(app_pid)
            if metrics:
                sample_count += 1
                timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

                row = [
                    timestamp, elapsed,
                    metrics['cpu'], metrics['mem'],
                    metrics['rss'], metrics['vsz'],
                    metrics['threads'], metrics['fds'],
                    metrics['user'], metrics['sys'], metrics['idle']
                ]

                with open(output, 'a', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerow(row)

                print(f"[{sample_count:2d}/{max_samples}] {elapsed:3d}s | CPU: {metrics['cpu']:5.1f}% | MEM: {metrics['rss']:7d}KB | Threads: {metrics['threads']} | FDs: {metrics['fds']:2d}")

            # Calculate next sample time
            next_sample_time = start_time + (sample_count * interval)
            sleep_duration = next_sample_time - time.time()

            if sleep_duration > 0:
                time.sleep(sleep_duration)
            elif sample_count < max_samples:
                print(f"Warning: Running behind schedule by {-sleep_duration:.1f}s")

    except KeyboardInterrupt:
        print("\nMonitoring interrupted by user")

    end_time = time.time()
    total_duration = end_time - start_time

    print()
    print(f"Monitoring Complete")
    print(f"==================")
    print(f"End: {datetime.now()}")
    print(f"Samples collected: {sample_count}")
    print(f"Total duration: {total_duration:.1f}s ({total_duration/60:.1f} minutes)")
    print(f"Data saved to: {output}")

if __name__ == '__main__':
    main()