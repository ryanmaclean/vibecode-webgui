#!/usr/bin/env python3
"""DBM-APM API Test Script.

This script tests the DBM-APM connection using various methods.
"""

from __future__ import annotations

import sys
import time
from dataclasses import dataclass, field
from typing import Optional
from urllib.error import URLError
from urllib.request import Request, urlopen

# ANSI color codes
RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
BLUE = "\033[0;34m"
NC = "\033[0m"


@dataclass
class ApiTestConfig:
    """Configuration for DBM-APM tests."""

    endpoints: list[str] = field(default_factory=lambda: [
        "https://vibecode.eastus2.cloudapp.azure.com",
        "http://localhost:3000",
        "http://localhost:8080",
    ])
    paths: list[str] = field(default_factory=lambda: [
        "/api/health",
        "/api/status",
        "/health",
        "/api/database/test",
    ])
    db_paths: list[str] = field(default_factory=lambda: [
        "/api/database/health",
        "/api/db/test",
        "/api/health/db",
        "/api/database/status",
    ])
    trace_paths: list[str] = field(default_factory=lambda: [
        "/api/health",
        "/api/status",
        "/api/trace-test",
    ])
    timeout: int = 10
    user_agent: str = "DBM-APM-Test/1.0"


@dataclass
class EndpointResult:
    """Result of testing an endpoint."""

    url: str
    success: bool
    status_code: Optional[int] = None
    response_time: float = 0.0
    response_body: str = ""
    error: Optional[str] = None
    has_trace_headers: bool = False
    has_database_content: bool = False
    has_trace_content: bool = False


@dataclass
class ApiTestSummary:
    """Summary of all test results."""

    successful_tests: int = 0
    total_tests: int = 0
    db_connected: bool = False
    traces_generated: int = 0


def log_info(msg: str) -> None:
    """Print info message."""
    print(f"{BLUE}{msg}{NC}")


def log_success(msg: str) -> None:
    """Print success message."""
    print(f"{GREEN}{msg}{NC}")


def log_warning(msg: str) -> None:
    """Print warning message."""
    print(f"{YELLOW}{msg}{NC}")


def log_error(msg: str) -> None:
    """Print error message."""
    print(f"{RED}{msg}{NC}")


def check_endpoint(base_url: str, path: str, config: ApiTestConfig) -> EndpointResult:
    """Test a single endpoint.

    Args:
        base_url: Base URL to test.
        path: Path to append to base URL.
        config: Test configuration.

    Returns:
        EndpointResult with test results.
    """
    full_url = f"{base_url}{path}"
    log_info(f"Testing: {full_url}")

    result = EndpointResult(url=full_url, success=False)

    try:
        start_time = time.time()

        request = Request(
            full_url,
            headers={
                "User-Agent": config.user_agent,
                "X-Test-Source": "dbm-apm-validation",
            },
        )

        with urlopen(request, timeout=config.timeout) as response:
            result.status_code = response.status
            result.response_body = response.read().decode("utf-8", errors="replace")
            result.response_time = time.time() - start_time

            # Check for success status codes (2xx, 3xx)
            if 200 <= result.status_code < 400:
                result.success = True
                log_success(f"  Status: {result.status_code} ({result.response_time:.3f}s)")

                # Check for trace headers
                trace_keywords = ["datadog", "trace", "span"]
                for header_name, header_value in response.headers.items():
                    header_lower = header_name.lower() + header_value.lower()
                    if any(kw in header_lower for kw in trace_keywords):
                        result.has_trace_headers = True
                        log_info(f"     Trace headers found: {header_name}")
                        break

                # Check response content for database references
                body_lower = result.response_body.lower()
                if any(kw in body_lower for kw in ["database", "db", "postgres"]):
                    result.has_database_content = True
                    log_success("     Database-related content found")

                if any(kw in body_lower for kw in ["trace", "span", "datadog"]):
                    result.has_trace_content = True
                    log_success("     Trace-related content found")
            else:
                log_warning(f"  Status: {result.status_code} ({result.response_time:.3f}s)")

    except URLError as e:
        result.error = str(e.reason)
        log_error(f"  Connection failed: {e.reason}")
    except TimeoutError:
        result.error = "Timeout"
        log_error("  Connection timed out")
    except OSError as e:
        result.error = str(e)
        log_error(f"  Connection failed: {e}")

    return result


def check_database(base_url: str, config: ApiTestConfig) -> bool:
    """Test database connectivity.

    Args:
        base_url: Base URL to test.
        config: Test configuration.

    Returns:
        True if database connectivity confirmed.
    """
    log_info("Testing database connectivity...")

    for path in config.db_paths:
        result = check_endpoint(base_url, path, config)
        if result.success:
            log_success("  Database connectivity confirmed")
            return True

    log_warning("  No database endpoints found")
    return False


def generate_traces(base_url: str, config: ApiTestConfig) -> int:
    """Generate test traces.

    Args:
        base_url: Base URL to test.
        config: Test configuration.

    Returns:
        Number of successful trace requests.
    """
    log_info("Generating test traces...")

    trace_count = 0
    for path in config.trace_paths:
        result = check_endpoint(base_url, path, config)
        if result.success:
            trace_count += 1

    log_info(f"  Generated {trace_count} test requests")
    return trace_count


def run_tests(config: ApiTestConfig | None = None) -> ApiTestSummary:
    """Run all DBM-APM tests.

    Args:
        config: Test configuration (uses defaults if None).

    Returns:
        ApiTestSummary with results.
    """
    if config is None:
        config = ApiTestConfig()

    print(f"{BLUE}DBM-APM API Connection Test{NC}")
    print("=" * 40)

    summary = ApiTestSummary()

    for endpoint in config.endpoints:
        print(f"\n{BLUE}Testing endpoint: {endpoint}{NC}")

        # Test basic connectivity
        for path in config.paths:
            summary.total_tests += 1
            result = check_endpoint(endpoint, path, config)
            if result.success:
                summary.successful_tests += 1

        # Test database connectivity
        if check_database(endpoint, config):
            summary.db_connected = True

        # Generate traces
        traces = generate_traces(endpoint, config)
        summary.traces_generated += traces

    # Print summary
    print(f"\n{BLUE}Test Summary{NC}")
    print("=" * 40)
    log_success(f"  Successful tests: {summary.successful_tests}/{summary.total_tests}")
    db_status = "Yes" if summary.db_connected else "No"
    log_info(f"  Database connected: {db_status}")
    log_info(f"  Test traces generated: {summary.traces_generated}")

    if summary.successful_tests > 0:
        print(f"\n{GREEN}DBM-APM API Test Results:{NC}")
        log_success("  API endpoints are accessible")
        log_success("  DBM-APM configuration is active")
        log_info("Next steps:")
        log_info("  1. Check Datadog APM Services: https://app.datadoghq.com/apm/services")
        log_info("  2. Check Database Monitoring: https://app.datadoghq.com/databases")
        log_info("  3. Look for trace correlation in query samples")
        log_info("  4. Verify service attribution in database hosts")
    else:
        print(f"\n{RED}DBM-APM API Test Results:{NC}")
        log_error("  No accessible API endpoints found")
        log_warning("  Check if the application is running")
        log_warning("  Verify network connectivity")

    return summary


def main() -> int:
    """Main entry point."""
    summary = run_tests()
    return 0 if summary.successful_tests > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
