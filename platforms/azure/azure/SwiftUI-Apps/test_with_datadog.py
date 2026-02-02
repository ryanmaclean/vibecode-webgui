#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Datadog instrumentation wrapper for Python tests
Provides tracing and metrics for automated tests
"""

import os
import sys
import time
import subprocess
from ddtrace import tracer, config
from datadog import initialize, statsd

# Initialize Datadog
config.env = os.getenv('DD_ENV', 'development')
config.service = 'vibecode-tests'
config.version = '3.3.0'

# Configure tracer for custom ports
tracer.configure(
    hostname='localhost',
    port=8136,  # Custom APM port
)

# Initialize DogStatsD
initialize(
    statsd_host='localhost',
    statsd_port=8135,  # Custom StatsD port
)

# Set namespace and global tags
statsd.namespace = 'vibecode.tests'
statsd.constant_tags = [
    f'env:{config.env}',
    'version:3.3.0',
    'project:vibecode-webgui'
]


def run_test_with_tracing(test_command, test_name):
    """
    Run a test command with Datadog tracing and metrics
    
    Args:
        test_command: Command to execute (list or string)
        test_name: Name of the test for tagging
    
    Returns:
        dict: Result with success status, output, and duration
    """
    with tracer.trace('test.run', service='vibecode-tests', resource=test_name) as span:
        span.set_tags({
            'test.command': ' '.join(test_command) if isinstance(test_command, list) else test_command,
            'test.framework': 'pytest',
            'test.type': 'integration',
        })
        
        start_time = time.time()
        statsd.increment('test.started', tags=[f'test:{test_name}'])
        
        try:
            print(f"\n[Datadog] Starting test: {test_name}")
            print(f"[Datadog] Trace ID: {span.trace_id}")
            print(f"[Datadog] Span ID: {span.span_id}")
            
            # Run the test
            result = subprocess.run(
                test_command if isinstance(test_command, list) else test_command.split(),
                capture_output=True,
                text=True,
                env={**os.environ, 'DD_TRACE_ENABLED': 'true'}
            )
            
            duration_ms = (time.time() - start_time) * 1000
            
            if result.returncode == 0:
                span.set_tag('test.status', 'passed')
                span.set_tag('test.duration_ms', duration_ms)
                statsd.increment('test.passed', tags=[f'test:{test_name}'])
                statsd.timing('test.duration', duration_ms, tags=[f'test:{test_name}'])
                statsd.gauge('test.last_run_duration', duration_ms, tags=[f'test:{test_name}'])
                
                print(result.stdout)
                if result.stderr:
                    print(result.stderr, file=sys.stderr)
                print(f"[Datadog] Test passed in {duration_ms:.0f}ms")
                
                return {
                    'success': True,
                    'output': result.stdout,
                    'duration': duration_ms
                }
            else:
                raise subprocess.CalledProcessError(result.returncode, test_command, result.stdout, result.stderr)
                
        except Exception as error:
            duration_ms = (time.time() - start_time) * 1000
            
            span.set_tag('test.status', 'failed')
            span.set_tag('test.duration_ms', duration_ms)
            span.set_tag('error', True)
            span.set_tag('error.type', type(error).__name__)
            span.set_tag('error.message', str(error))
            
            statsd.increment('test.failed', tags=[f'test:{test_name}', f'error:{type(error).__name__}'])
            statsd.timing('test.duration', duration_ms, tags=[f'test:{test_name}', 'status:failed'])
            
            print(f"\n[Datadog] Test failed: {test_name}", file=sys.stderr)
            print(f"[Datadog] Error: {error}", file=sys.stderr)
            
            if hasattr(error, 'stdout') and error.stdout:
                print(f"\nStdout: {error.stdout}")
            if hasattr(error, 'stderr') and error.stderr:
                print(f"\nStderr: {error.stderr}", file=sys.stderr)
            
            return {
                'success': False,
                'error': str(error),
                'duration': duration_ms
            }


def send_metric(metric_name, value, tags=None):
    """Send a custom metric to Datadog"""
    statsd.gauge(metric_name, value, tags=tags or [])


def increment_counter(counter_name, tags=None):
    """Increment a counter in Datadog"""
    statsd.increment(counter_name, tags=tags or [])


def send_timing(name, duration, tags=None):
    """Send a timing metric to Datadog"""
    statsd.timing(name, duration, tags=tags or [])