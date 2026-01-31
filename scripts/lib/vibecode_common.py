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
VibeCode Common Utilities
Shared functionality for all Python scripts with Datadog integration.

Provides:
- Structured logging with DD trace correlation
- Error handling decorators
- Configuration management
- Retry logic
- Metrics helpers
- Signal handling
"""

import os
import sys
import signal
import logging
import functools
import time
from pathlib import Path
from typing import Callable, Any, Optional, Dict, TypeVar
from contextlib import contextmanager

# Datadog
from ddtrace import tracer
try:
    from datadog import statsd
    STATSD_AVAILABLE = True
except ImportError:
    STATSD_AVAILABLE = False

# Type hints
F = TypeVar('F', bound=Callable[..., Any])


# ============================================================================
# Logging Configuration
# ============================================================================

def setup_logging(
    name: str,
    level: int = logging.INFO,
    log_file: Optional[Path] = None,
    json_format: bool = False
) -> logging.Logger:
    """
    Setup structured logging with Datadog correlation.
    
    Args:
        name: Logger name (usually __name__)
        level: Logging level
        log_file: Optional file path for logs
        json_format: Use JSON formatting for structured logs
    
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Clear existing handlers
    logger.handlers.clear()
    
    # Create formatter with DD correlation
    if json_format:
        import json
        
        class JSONFormatter(logging.Formatter):
            def format(self, record):
                # Get DD trace context
                span = tracer.current_span()
                trace_id = span.trace_id if span else 0
                span_id = span.span_id if span else 0
                
                log_dict = {
                    'timestamp': self.formatTime(record),
                    'level': record.levelname,
                    'logger': record.name,
                    'message': record.getMessage(),
                    'dd.trace_id': str(trace_id),
                    'dd.span_id': str(span_id),
                    'dd.service': os.getenv('DD_SERVICE', 'vibecode'),
                    'dd.env': os.getenv('DD_ENV', 'development'),
                }
                
                if record.exc_info:
                    log_dict['exception'] = self.formatException(record.exc_info)
                
                return json.dumps(log_dict)
        
        formatter = JSONFormatter()
    else:
        # Standard format with DD correlation
        formatter = logging.Formatter(
            '[%(asctime)s] [%(levelname)s] [dd.trace_id=%(dd_trace_id)s dd.span_id=%(dd_span_id)s] '
            '%(name)s - %(message)s'
        )
        
        # Add filter to inject DD IDs
        class DDContextFilter(logging.Filter):
            def filter(self, record):
                span = tracer.current_span()
                record.dd_trace_id = span.trace_id if span else 0
                record.dd_span_id = span.span_id if span else 0
                return True
        
        logger.addFilter(DDContextFilter())
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File handler (optional)
    if log_file:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger


# ============================================================================
# Error Handling Decorators
# ============================================================================

def with_error_handling(
    logger: Optional[logging.Logger] = None,
    default_return: Any = None,
    raise_on_error: bool = True
) -> Callable[[F], F]:
    """
    Decorator for consistent error handling with DD tagging.
    
    Args:
        logger: Logger instance for error messages
        default_return: Value to return on error (if not raising)
        raise_on_error: Whether to re-raise exceptions
    
    Returns:
        Decorated function
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                # Tag current span with error
                span = tracer.current_span()
                if span:
                    span.set_tag('error', True)
                    span.set_tag('error.message', str(e))
                    span.set_tag('error.type', type(e).__name__)
                
                # Log error
                if logger:
                    logger.error(f"{func.__name__} failed: {e}", exc_info=True)
                
                # Raise or return default
                if raise_on_error:
                    raise
                return default_return
        
        return wrapper
    return decorator


def retry_on_failure(
    max_attempts: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    logger: Optional[logging.Logger] = None
) -> Callable[[F], F]:
    """
    Decorator for retrying failed operations with exponential backoff.
    
    Args:
        max_attempts: Maximum retry attempts
        delay: Initial delay between retries (seconds)
        backoff: Backoff multiplier for delay
        logger: Logger for retry messages
    
    Returns:
        Decorated function
    """
    def decorator(func: F) -> F:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            current_delay = delay
            last_exception = None
            
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    
                    if logger:
                        logger.warning(
                            f"{func.__name__} failed (attempt {attempt}/{max_attempts}): {e}"
                        )
                    
                    if attempt < max_attempts:
                        time.sleep(current_delay)
                        current_delay *= backoff
                    else:
                        # Tag final failure
                        span = tracer.current_span()
                        if span:
                            span.set_tag('error', True)
                            span.set_tag('error.message', str(e))
                            span.set_tag('retry.attempts', attempt)
            
            # Re-raise last exception
            raise last_exception
        
        return wrapper
    return decorator


# ============================================================================
# Configuration Management
# ============================================================================

class Config:
    """Configuration manager with environment variable support."""
    
    def __init__(self, env_prefix: str = "VIBECODE_"):
        self.env_prefix = env_prefix
        self._config: Dict[str, Any] = {}
    
    def load_env(self) -> None:
        """Load configuration from environment variables."""
        for key, value in os.environ.items():
            if key.startswith(self.env_prefix):
                config_key = key[len(self.env_prefix):].lower()
                self._config[config_key] = value
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value."""
        return self._config.get(key, default)
    
    def set(self, key: str, value: Any) -> None:
        """Set configuration value."""
        self._config[key] = value
    
    def __getitem__(self, key: str) -> Any:
        return self._config[key]
    
    def __setitem__(self, key: str, value: Any) -> None:
        self._config[key] = value


def setup_datadog_config(
    service_name: str,
    env: str = 'development',
    version: str = '1.0.0'
) -> None:
    """
    Configure Datadog environment variables.
    
    Args:
        service_name: DD_SERVICE value
        env: DD_ENV value
        version: DD_VERSION value
    """
    os.environ.setdefault('DD_AGENT_HOST', 'localhost')
    os.environ.setdefault('DD_TRACE_AGENT_PORT', '8126')
    os.environ.setdefault('DD_SERVICE', service_name)
    os.environ.setdefault('DD_ENV', env)
    os.environ.setdefault('DD_VERSION', version)
    
    # Enable runtime metrics
    os.environ.setdefault('DD_RUNTIME_METRICS_ENABLED', 'true')
    
    # Configure profiling (optional)
    os.environ.setdefault('DD_PROFILING_ENABLED', 'false')


# ============================================================================
# Metrics Helpers
# ============================================================================

class Metrics:
    """Helper for DogStatsD metrics."""
    
    def __init__(self, prefix: str = 'vibecode'):
        self.prefix = prefix
        self.enabled = STATSD_AVAILABLE
        
        if not self.enabled:
            logging.warning("DogStatsD not available - metrics disabled")
    
    def increment(self, metric: str, value: int = 1, tags: Optional[list] = None) -> None:
        """Increment a counter."""
        if self.enabled:
            statsd.increment(f"{self.prefix}.{metric}", value=value, tags=tags or [])
    
    def gauge(self, metric: str, value: float, tags: Optional[list] = None) -> None:
        """Set a gauge value."""
        if self.enabled:
            statsd.gauge(f"{self.prefix}.{metric}", value, tags=tags or [])
    
    def histogram(self, metric: str, value: float, tags: Optional[list] = None) -> None:
        """Record histogram value."""
        if self.enabled:
            statsd.histogram(f"{self.prefix}.{metric}", value, tags=tags or [])
    
    @contextmanager
    def timed(self, metric: str, tags: Optional[list] = None):
        """Context manager for timing operations."""
        start = time.time()
        try:
            yield
        finally:
            duration = time.time() - start
            self.histogram(metric, duration, tags=tags)


# ============================================================================
# Signal Handling
# ============================================================================

class GracefulShutdown:
    """Handler for graceful shutdown on signals."""
    
    def __init__(self, logger: Optional[logging.Logger] = None):
        self.logger = logger or logging.getLogger(__name__)
        self.shutdown_requested = False
        
        # Register signal handlers
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals."""
        sig_name = signal.Signals(signum).name
        self.logger.info(f"Received {sig_name}, shutting down gracefully...")
        self.shutdown_requested = True
    
    def should_continue(self) -> bool:
        """Check if process should continue running."""
        return not self.shutdown_requested


# ============================================================================
# Path Helpers
# ============================================================================

def get_project_root() -> Path:
    """Get project root directory."""
    return Path(__file__).parent.parent.parent


def get_script_dir() -> Path:
    """Get scripts directory."""
    return Path(__file__).parent.parent


def ensure_dir(path: Path) -> Path:
    """Ensure directory exists, create if needed."""
    path.mkdir(parents=True, exist_ok=True)
    return path


# ============================================================================
# Initialization Helper
# ============================================================================

def init_vibecode_script(
    script_name: str,
    service_name: Optional[str] = None,
    log_level: int = logging.INFO,
    enable_metrics: bool = True
) -> tuple[logging.Logger, Config, Optional[Metrics], GracefulShutdown]:
    """
    Initialize a VibeCode script with all standard components.
    
    Args:
        script_name: Name of the script (for logging)
        service_name: DD_SERVICE name (defaults to script_name)
        log_level: Logging level
        enable_metrics: Whether to enable metrics
    
    Returns:
        Tuple of (logger, config, metrics, shutdown_handler)
    """
    # Setup Datadog config
    service = service_name or script_name.replace('_', '-')
    setup_datadog_config(service)
    
    # Setup logging
    logger = setup_logging(script_name, level=log_level)
    
    # Load config
    config = Config()
    config.load_env()
    
    # Setup metrics
    metrics = Metrics(prefix='vibecode') if enable_metrics else None
    
    # Setup graceful shutdown
    shutdown = GracefulShutdown(logger)
    
    logger.info(f"Initialized {script_name} with DD tracing")
    
    return logger, config, metrics, shutdown


# ============================================================================
# Export all
# ============================================================================

__all__ = [
    'setup_logging',
    'with_error_handling',
    'retry_on_failure',
    'Config',
    'setup_datadog_config',
    'Metrics',
    'GracefulShutdown',
    'get_project_root',
    'get_script_dir',
    'ensure_dir',
    'init_vibecode_script',
]
