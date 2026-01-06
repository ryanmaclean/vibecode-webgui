#!/usr/bin/env python3
"""
Example script showing how to use vibecode_common library.

This demonstrates all the common utilities available to scripts.
"""


# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass

import sys
from pathlib import Path

# Import common utilities
from lib.vibecode_common import (
    init_vibecode_script,
    with_error_handling,
    retry_on_failure,
    tracer,
)

# Initialize script with all components
logger, config, metrics, shutdown = init_vibecode_script(
    script_name='example',
    service_name='vibecode-example',
)


@tracer.wrap(service='vibecode-example', resource='example_function')
@with_error_handling(logger=logger)
def example_function(value: int) -> int:
    """Example function with error handling and tracing."""
    logger.info(f"Processing value: {value}")
    
    # Increment metric
    if metrics:
        metrics.increment('example.calls', tags=['status:success'])
    
    return value * 2


@tracer.wrap(service='vibecode-example', resource='example_with_retry')
@retry_on_failure(max_attempts=3, delay=1.0, logger=logger)
def example_with_retry() -> str:
    """Example function with retry logic."""
    logger.info("Attempting operation...")
    
    # Simulate occasional failure
    import random
    if random.random() < 0.3:
        raise Exception("Random failure for demonstration")
    
    return "Success!"


@tracer.wrap(service='vibecode-example', resource='timed_operation')
def timed_operation() -> None:
    """Example of timing an operation."""
    import time
    
    if metrics:
        with metrics.timed('example.operation.duration', tags=['operation:example']):
            logger.info("Starting timed operation...")
            time.sleep(1)
            logger.info("Operation complete")


def main() -> int:
    """Main entry point."""
    logger.info("Example script started")
    
    try:
        # Example 1: Basic function with error handling
        result = example_function(42)
        logger.info(f"Result: {result}")
        
        # Example 2: Function with retry
        retry_result = example_with_retry()
        logger.info(f"Retry result: {retry_result}")
        
        # Example 3: Timed operation
        timed_operation()
        
        # Example 4: Check for graceful shutdown
        while shutdown.should_continue():
            logger.info("Running... (Ctrl+C to stop)")
            import time
            time.sleep(2)
            break  # Just run once for demo
        
        logger.info("Example script completed successfully")
        return 0
        
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        return 130
    except Exception as e:
        logger.error(f"Script failed: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    with tracer.trace('example-script-session', service='vibecode-example'):
        sys.exit(main())

