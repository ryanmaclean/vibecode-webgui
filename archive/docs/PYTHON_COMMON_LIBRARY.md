# VibeCode Common Python Library

## Overview

The `scripts/lib/vibecode_common.py` module provides shared functionality for all Python scripts, ensuring consistency and best practices across the codebase.

## Features

### 1. **Structured Logging with DD Correlation**

```python
from lib.vibecode_common import setup_logging

logger = setup_logging(__name__, level=logging.INFO)
logger.info("Message appears with DD trace_id and span_id")
```

Features:
- Automatic Datadog trace correlation
- JSON formatting option for log aggregation
- Console and file output
- Consistent format across all scripts

### 2. **Error Handling Decorators**

```python
from lib.vibecode_common import with_error_handling

@with_error_handling(logger=logger, raise_on_error=True)
def my_function():
    # Errors automatically tagged in DD and logged
    pass
```

Features:
- Automatic span error tagging
- Consistent error logging
- Optional default return values
- Exception re-raising control

### 3. **Retry Logic**

```python
from lib.vibecode_common import retry_on_failure

@retry_on_failure(max_attempts=3, delay=1.0, backoff=2.0, logger=logger)
def flaky_operation():
    # Automatically retried with exponential backoff
    pass
```

Features:
- Configurable max attempts
- Exponential backoff
- Logging of retry attempts
- DD span tagging with retry count

### 4. **Configuration Management**

```python
from lib.vibecode_common import Config

config = Config(env_prefix="VIBECODE_")
config.load_env()
value = config.get('api_key', default='none')
```

Features:
- Environment variable loading
- Prefix-based filtering
- Dict-like interface
- Type-safe access

### 5. **Datadog Configuration**

```python
from lib.vibecode_common import setup_datadog_config

setup_datadog_config(
    service_name='my-service',
    env='production',
    version='2.0.0'
)
```

Features:
- Consistent DD env vars
- Runtime metrics enabled
- Optional profiling
- Service/env/version tagging

### 6. **Metrics Helpers (DogStatsD)**

```python
from lib.vibecode_common import Metrics

metrics = Metrics(prefix='vibecode')
metrics.increment('api.calls', tags=['endpoint:health'])
metrics.gauge('queue.size', 42)
metrics.histogram('response.time', 0.123)

# Context manager for timing
with metrics.timed('operation.duration'):
    do_work()
```

Features:
- Counters, gauges, histograms
- Tag support
- Timing context manager
- Graceful degradation if DogStatsD unavailable

### 7. **Graceful Shutdown**

```python
from lib.vibecode_common import GracefulShutdown

shutdown = GracefulShutdown(logger)

while shutdown.should_continue():
    do_work()
```

Features:
- SIGTERM/SIGINT handling
- Clean shutdown coordination
- Logging of shutdown events
- Loop-friendly API

### 8. **Path Helpers**

```python
from lib.vibecode_common import get_project_root, get_script_dir, ensure_dir

project_root = get_project_root()
scripts = get_script_dir()
output_dir = ensure_dir(project_root / 'output')
```

Features:
- Consistent path resolution
- Directory creation helpers
- Cross-platform compatibility

### 9. **One-Line Initialization**

```python
from lib.vibecode_common import init_vibecode_script

logger, config, metrics, shutdown = init_vibecode_script(
    script_name='my_script',
    service_name='my-service',  # Optional, defaults to script_name
    log_level=logging.INFO,
    enable_metrics=True
)

# Now you have everything configured!
```

This single function:
- Sets up Datadog config
- Initializes logging with DD correlation
- Loads configuration from env vars
- Creates metrics client
- Sets up signal handlers

## Complete Example

```python
#!/usr/bin/env python3
"""My VibeCode script with common utilities."""

import sys
from lib.vibecode_common import (
    init_vibecode_script,
    with_error_handling,
    retry_on_failure,
    tracer,
)

# One-line initialization
logger, config, metrics, shutdown = init_vibecode_script('my_script')


@tracer.wrap(service='my-script', resource='process_data')
@with_error_handling(logger=logger)
@retry_on_failure(max_attempts=3, logger=logger)
def process_data(data: str) -> str:
    """Process data with error handling, retries, and tracing."""
    logger.info(f"Processing: {data}")
    
    if metrics:
        with metrics.timed('processing.duration'):
            result = data.upper()
            metrics.increment('processing.success')
    
    return result


def main() -> int:
    """Main entry point."""
    try:
        result = process_data("hello")
        logger.info(f"Result: {result}")
        return 0
    except Exception as e:
        logger.error(f"Failed: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    with tracer.trace('my-script-session', service='my-script'):
        sys.exit(main())
```

## Migration Guide

### Updating Existing Scripts

1. **Add import:**
```python
from lib.vibecode_common import init_vibecode_script, tracer
```

2. **Replace manual setup:**
```python
# Old way
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
os.environ.setdefault('DD_SERVICE', 'my-service')

# New way
logger, config, metrics, shutdown = init_vibecode_script('my_script')
```

3. **Add decorators:**
```python
@tracer.wrap(service='my-service', resource='my_function')
@with_error_handling(logger=logger)
def my_function():
    pass
```

4. **Use metrics:**
```python
if metrics:
    metrics.increment('my.counter')
```

## Benefits

1. **Consistency** - All scripts use the same patterns
2. **Less boilerplate** - One-line initialization
3. **Better observability** - Automatic DD correlation
4. **Resilience** - Built-in retry logic
5. **Graceful shutdown** - Proper signal handling
6. **Type safety** - Type hints throughout
7. **Testability** - Mockable components
8. **Documentation** - Comprehensive docstrings

## Requirements

Add to `requirements.txt`:
```
ddtrace>=2.0.0
datadog>=0.49.0  # For DogStatsD metrics
```

## Testing

Run the example:
```bash
python3 scripts/example_using_common.py
```

Check Datadog APM for traces with service: `vibecode-example`

## Next Steps

1. Migrate all existing scripts to use `init_vibecode_script()`
2. Add metrics to key operations
3. Implement retry logic where appropriate
4. Add graceful shutdown to long-running scripts
5. Use JSON logging in production for log aggregation

## Author

Created as part of the Python migration with ddtrace initiative (2025-12-01).

