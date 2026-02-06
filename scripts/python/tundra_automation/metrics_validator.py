#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "tundra-metrics-validator"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "tundra", "cluster": "tundra-dome"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# -- VibeCode Telemetry --
import sys
import os

# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Datadog Metrics Validator for Tundra Infrastructure.

This module provides validation of Datadog metrics for Kubernetes, Kafka,
and Airflow infrastructure components. It queries the Datadog API to verify
that metrics are flowing correctly from monitored clusters.

Usage:
    from tundra_automation.metrics_validator import MetricsValidator, ValidationResult

    validator = MetricsValidator()
    result = validator.wait_for_metrics("my-cluster", timeout_minutes=15)

    if result.all_healthy:
        print("All metrics are flowing!")
    else:
        print(f"Missing metrics: {result.missing}")

Environment Variables:
    DD_API_KEY: Datadog API key (required)
    DD_APP_KEY: Datadog Application key (required)
    DD_SITE: Datadog site (default: datadoghq.com)
"""

# Datadog APM tracing - auto-detects local agent
import os

os.environ.setdefault("DD_SERVICE", "tundra-automation")
os.environ.setdefault("DD_ENV", "development")

try:
    from ddtrace import tracer, patch_all

    patch_all()
except ImportError:
    tracer = None
import time
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@dataclass
class MetricCheckResult:
    """Result of checking a specific metric category."""

    category: str
    healthy: bool
    metrics_found: list[str] = field(default_factory=list)
    metrics_missing: list[str] = field(default_factory=list)
    last_data_point: Optional[datetime] = None
    error: Optional[str] = None

    def __str__(self) -> str:
        status = "HEALTHY" if self.healthy else "UNHEALTHY"
        found_count = len(self.metrics_found)
        missing_count = len(self.metrics_missing)
        return f"{self.category}: {status} (found: {found_count}, missing: {missing_count})"


@dataclass
class ValidationResult:
    """Complete validation result for all metric categories."""

    cluster_name: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    k8s_result: Optional[MetricCheckResult] = None
    kafka_result: Optional[MetricCheckResult] = None
    airflow_result: Optional[MetricCheckResult] = None
    duration_seconds: float = 0.0

    @property
    def all_healthy(self) -> bool:
        """Check if all metric categories are healthy."""
        results = [self.k8s_result, self.kafka_result, self.airflow_result]
        return all(r is not None and r.healthy for r in results)

    @property
    def any_healthy(self) -> bool:
        """Check if at least one metric category is healthy."""
        results = [self.k8s_result, self.kafka_result, self.airflow_result]
        return any(r is not None and r.healthy for r in results)

    @property
    def healthy_categories(self) -> list[str]:
        """Get list of healthy category names."""
        healthy = []
        if self.k8s_result and self.k8s_result.healthy:
            healthy.append("kubernetes")
        if self.kafka_result and self.kafka_result.healthy:
            healthy.append("kafka")
        if self.airflow_result and self.airflow_result.healthy:
            healthy.append("airflow")
        return healthy

    @property
    def missing(self) -> list[str]:
        """Get list of unhealthy/missing category names."""
        missing = []
        if not self.k8s_result or not self.k8s_result.healthy:
            missing.append("kubernetes")
        if not self.kafka_result or not self.kafka_result.healthy:
            missing.append("kafka")
        if not self.airflow_result or not self.airflow_result.healthy:
            missing.append("airflow")
        return missing

    def summary(self) -> str:
        """Generate a human-readable summary of the validation."""
        lines = [
            f"Validation Result for cluster: {self.cluster_name}",
            f"Timestamp: {self.timestamp.isoformat()}",
            f"Duration: {self.duration_seconds:.1f} seconds",
            f"Overall Status: {'HEALTHY' if self.all_healthy else 'UNHEALTHY'}",
            "",
            "Category Results:",
        ]

        for result in [self.k8s_result, self.kafka_result, self.airflow_result]:
            if result:
                lines.append(f"  - {result}")
                if result.metrics_found:
                    lines.append(f"    Found: {', '.join(result.metrics_found[:5])}")
                    if len(result.metrics_found) > 5:
                        lines.append(f"    ... and {len(result.metrics_found) - 5} more")
                if result.metrics_missing:
                    lines.append(f"    Missing: {', '.join(result.metrics_missing)}")
                if result.error:
                    lines.append(f"    Error: {result.error}")

        return "\n".join(lines)


class DatadogAPIError(Exception):
    """Exception raised for Datadog API errors."""


class MetricsValidator:
    """
    Validates that Datadog metrics are flowing for infrastructure components.

    Supports checking metrics for:
    - Kubernetes (kubernetes.pods.running with cluster_name tag)
    - Kafka (kafka.broker.count or data_streams.kafka.*)
    - Airflow (airflow.dag_processing.* or airflow.scheduler.*)

    Args:
        api_key: Datadog API key (defaults to DD_API_KEY env var)
        app_key: Datadog Application key (defaults to DD_APP_KEY env var)
        site: Datadog site (defaults to DD_SITE env var or datadoghq.com)
        max_retries: Maximum number of retry attempts for API calls
        base_backoff_seconds: Initial backoff time for exponential backoff

    Example:
        >>> validator = MetricsValidator()
        >>> result = validator.wait_for_metrics("production-cluster", timeout_minutes=10)
        >>> print(result.summary())
    """

    # Kubernetes metrics to check
    K8S_METRICS = [
        "kubernetes.pods.running",
        "kubernetes.pods.ready",
        "kubernetes.containers.running",
    ]

    # Kafka metrics to check (any of these indicates Kafka is reporting)
    KAFKA_METRICS = [
        "kafka.broker.count",
        "kafka.broker.bytes_in",
        "kafka.broker.bytes_out",
        "data_streams.kafka.lag_seconds",
        "data_streams.kafka.produce.latency",
    ]

    # Airflow metrics to check (any of these indicates Airflow is reporting)
    AIRFLOW_METRICS = [
        "airflow.dag_processing.total_parse_time",
        "airflow.dag_processing.processes",
        "airflow.scheduler.tasks.running",
        "airflow.scheduler.tasks.pending",
        "airflow.executor.open_slots",
    ]

    def __init__(
        self,
        api_key: Optional[str] = None,
        app_key: Optional[str] = None,
        site: Optional[str] = None,
        max_retries: int = 3,
        base_backoff_seconds: float = 1.0,
    ):
        self.api_key = api_key or os.environ.get("DD_API_KEY")
        self.app_key = app_key or os.environ.get("DD_APP_KEY")
        self.site = site or os.environ.get("DD_SITE", "datadoghq.com")
        self.max_retries = max_retries
        self.base_backoff_seconds = base_backoff_seconds

        if not self.api_key:
            raise ValueError(
                "Datadog API key is required. Set DD_API_KEY environment variable "
                "or pass api_key parameter."
            )
        if not self.app_key:
            raise ValueError(
                "Datadog Application key is required. Set DD_APP_KEY environment variable "
                "or pass app_key parameter."
            )

        self.base_url = f"https://api.{self.site}"
        self._session = requests.Session()
        self._session.headers.update({
            "DD-API-KEY": self.api_key,
            "DD-APPLICATION-KEY": self.app_key,
            "Content-Type": "application/json",
        })

    def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[dict] = None,
        json_data: Optional[dict] = None,
    ) -> dict:
        """
        Make an API request with exponential backoff retry.

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            params: Query parameters
            json_data: JSON body data

        Returns:
            Parsed JSON response

        Raises:
            DatadogAPIError: If the request fails after all retries
        """
        url = f"{self.base_url}{endpoint}"
        last_error = None

        for attempt in range(self.max_retries):
            try:
                response = self._session.request(
                    method=method,
                    url=url,
                    params=params,
                    json=json_data,
                    timeout=30,
                )

                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 429:
                    # Rate limited - use longer backoff
                    backoff = self.base_backoff_seconds * (4 ** attempt)
                    logger.warning(
                        f"Rate limited, waiting {backoff:.1f}s before retry "
                        f"(attempt {attempt + 1}/{self.max_retries})"
                    )
                    time.sleep(backoff)
                    continue
                elif response.status_code >= 500:
                    # Server error - retry with backoff
                    backoff = self.base_backoff_seconds * (2 ** attempt)
                    logger.warning(
                        f"Server error {response.status_code}, waiting {backoff:.1f}s "
                        f"before retry (attempt {attempt + 1}/{self.max_retries})"
                    )
                    time.sleep(backoff)
                    continue
                else:
                    # Client error - don't retry
                    raise DatadogAPIError(
                        f"API request failed with status {response.status_code}: "
                        f"{response.text}"
                    )

            except requests.exceptions.RequestException as e:
                last_error = e
                backoff = self.base_backoff_seconds * (2 ** attempt)
                logger.warning(
                    f"Request error: {e}, waiting {backoff:.1f}s before retry "
                    f"(attempt {attempt + 1}/{self.max_retries})"
                )
                time.sleep(backoff)

        raise DatadogAPIError(
            f"Request failed after {self.max_retries} attempts: {last_error}"
        )

    def _query_metric(
        self,
        metric_query: str,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
    ) -> dict:
        """
        Query Datadog metrics API.

        Args:
            metric_query: The metric query string
            from_time: Start time for the query (default: 15 minutes ago)
            to_time: End time for the query (default: now)

        Returns:
            API response with metric data
        """
        import time

        # Use time.time() for correct Unix timestamps
        # Note: datetime.utcnow().timestamp() is buggy - it double-converts to UTC
        if to_time is None:
            to_ts = int(time.time())
        else:
            to_ts = int(to_time.timestamp())

        if from_time is None:
            from_ts = to_ts - (15 * 60)  # 15 minutes ago
        else:
            from_ts = int(from_time.timestamp())

        params = {
            "query": metric_query,
            "from": from_ts,
            "to": to_ts,
        }

        return self._make_request("GET", "/api/v1/query", params=params)

    def _has_data_points(self, response: dict) -> bool:
        """Check if the response contains any data points."""
        series = response.get("series", [])
        for s in series:
            pointlist = s.get("pointlist", [])
            if pointlist:
                return True
        return False

    def _get_last_data_point_time(self, response: dict) -> Optional[datetime]:
        """Get the timestamp of the most recent data point."""
        latest = None
        series = response.get("series", [])
        for s in series:
            pointlist = s.get("pointlist", [])
            for point in pointlist:
                if point and len(point) >= 1:
                    ts = datetime.utcfromtimestamp(point[0] / 1000)
                    if latest is None or ts > latest:
                        latest = ts
        return latest

    def check_k8s_metrics(self, cluster_name: str) -> MetricCheckResult:
        """
        Check if Kubernetes metrics are flowing for a cluster.

        Args:
            cluster_name: The cluster_name tag value to filter on

        Returns:
            MetricCheckResult with details about K8s metrics
        """
        result = MetricCheckResult(category="kubernetes", healthy=False)
        metrics_found = []
        metrics_missing = []
        latest_time = None

        for metric in self.K8S_METRICS:
            query = f"avg:{metric}{{cluster_name:{cluster_name}}}"
            try:
                response = self._query_metric(query)
                if self._has_data_points(response):
                    metrics_found.append(metric)
                    point_time = self._get_last_data_point_time(response)
                    if point_time and (latest_time is None or point_time > latest_time):
                        latest_time = point_time
                else:
                    metrics_missing.append(metric)
            except DatadogAPIError as e:
                logger.error(f"Error checking metric {metric}: {e}")
                result.error = str(e)
                metrics_missing.append(metric)

        result.metrics_found = metrics_found
        result.metrics_missing = metrics_missing
        result.last_data_point = latest_time
        # Consider healthy if we found at least the primary metric
        result.healthy = "kubernetes.pods.running" in metrics_found

        logger.info(f"K8s metrics check: {result}")
        return result

    def check_kafka_metrics(self, cluster_name: str) -> MetricCheckResult:
        """
        Check if Kafka metrics are flowing for a cluster.

        Args:
            cluster_name: The cluster_name tag value to filter on

        Returns:
            MetricCheckResult with details about Kafka metrics
        """
        result = MetricCheckResult(category="kafka", healthy=False)
        metrics_found = []
        metrics_missing = []
        latest_time = None

        for metric in self.KAFKA_METRICS:
            # Kafka metrics may use different tag names
            # DSM metrics use service tags, broker metrics use cluster tags
            queries = [
                f"avg:{metric}{{cluster_name:{cluster_name}}}",
                f"avg:{metric}{{kube_cluster_name:{cluster_name}}}",
                f"avg:{metric}{{env:{cluster_name}}}",
                f"avg:{metric}{{service:*tundra*}}",  # DSM metrics with tundra services
                f"avg:{metric}{{*}}",  # Fallback: any data at all for this metric
            ]

            found = False
            for query in queries:
                try:
                    response = self._query_metric(query)
                    if self._has_data_points(response):
                        found = True
                        metrics_found.append(metric)
                        point_time = self._get_last_data_point_time(response)
                        if point_time and (latest_time is None or point_time > latest_time):
                            latest_time = point_time
                        break
                except DatadogAPIError as e:
                    logger.debug(f"Query {query} failed: {e}")
                    continue

            if not found:
                metrics_missing.append(metric)

        result.metrics_found = metrics_found
        result.metrics_missing = metrics_missing
        result.last_data_point = latest_time
        # Consider healthy if we found at least one Kafka metric
        result.healthy = len(metrics_found) > 0

        logger.info(f"Kafka metrics check: {result}")
        return result

    def check_airflow_metrics(self, cluster_name: str) -> MetricCheckResult:
        """
        Check if Airflow metrics are flowing for a cluster.

        Args:
            cluster_name: The cluster_name tag value to filter on

        Returns:
            MetricCheckResult with details about Airflow metrics
        """
        result = MetricCheckResult(category="airflow", healthy=False)
        metrics_found = []
        metrics_missing = []
        latest_time = None

        for metric in self.AIRFLOW_METRICS:
            # Airflow metrics may use different tag names
            # Airflow integration metrics use host tags, not cluster tags
            queries = [
                f"avg:{metric}{{cluster_name:{cluster_name}}}",
                f"avg:{metric}{{kube_cluster_name:{cluster_name}}}",
                f"avg:{metric}{{env:{cluster_name}}}",
                f"avg:{metric}{{*}}",  # Fallback: any Airflow metrics at all
            ]

            found = False
            for query in queries:
                try:
                    response = self._query_metric(query)
                    if self._has_data_points(response):
                        found = True
                        metrics_found.append(metric)
                        point_time = self._get_last_data_point_time(response)
                        if point_time and (latest_time is None or point_time > latest_time):
                            latest_time = point_time
                        break
                except DatadogAPIError as e:
                    logger.debug(f"Query {query} failed: {e}")
                    continue

            if not found:
                metrics_missing.append(metric)

        result.metrics_found = metrics_found
        result.metrics_missing = metrics_missing
        result.last_data_point = latest_time
        # Consider healthy if we found at least one Airflow metric
        result.healthy = len(metrics_found) > 0

        logger.info(f"Airflow metrics check: {result}")
        return result

    def get_all_clusters(self) -> list[str]:
        """
        Get all cluster names currently reporting Kubernetes metrics.

        Returns:
            List of unique cluster_name tag values
        """
        query = "avg:kubernetes.pods.running{*} by {cluster_name}"

        try:
            response = self._query_metric(query)
            clusters = set()

            for series in response.get("series", []):
                scope = series.get("scope", "")
                # Parse cluster_name from scope like "cluster_name:my-cluster"
                for part in scope.split(","):
                    if part.startswith("cluster_name:"):
                        cluster = part.split(":", 1)[1]
                        clusters.add(cluster)

            cluster_list = sorted(clusters)
            logger.info(f"Found {len(cluster_list)} clusters: {cluster_list}")
            return cluster_list

        except DatadogAPIError as e:
            logger.error(f"Failed to get cluster list: {e}")
            return []

    def wait_for_metrics(
        self,
        cluster_name: str,
        timeout_minutes: int = 15,
        poll_interval_seconds: int = 30,
        require_all: bool = False,
    ) -> ValidationResult:
        """
        Wait for metrics to start flowing, with progress updates.

        This method polls Datadog periodically until either all required
        metrics are found or the timeout is reached.

        Args:
            cluster_name: The cluster_name tag value to filter on
            timeout_minutes: Maximum time to wait in minutes
            poll_interval_seconds: Time between checks in seconds
            require_all: If True, wait until all categories are healthy.
                        If False (default), succeed when K8s metrics are healthy.

        Returns:
            ValidationResult with the final status of all checks
        """
        start_time = datetime.utcnow()
        timeout = timedelta(minutes=timeout_minutes)
        iteration = 0

        logger.info(
            f"Starting metrics validation for cluster '{cluster_name}' "
            f"(timeout: {timeout_minutes}m, poll interval: {poll_interval_seconds}s)"
        )

        result = ValidationResult(cluster_name=cluster_name)

        while datetime.utcnow() - start_time < timeout:
            iteration += 1
            elapsed = (datetime.utcnow() - start_time).total_seconds()
            remaining = timeout.total_seconds() - elapsed

            logger.info(
                f"[{iteration}] Checking metrics... "
                f"(elapsed: {elapsed:.0f}s, remaining: {remaining:.0f}s)"
            )

            # Check all metric categories
            result.k8s_result = self.check_k8s_metrics(cluster_name)
            result.kafka_result = self.check_kafka_metrics(cluster_name)
            result.airflow_result = self.check_airflow_metrics(cluster_name)
            result.duration_seconds = elapsed

            # Progress update
            healthy_count = len(result.healthy_categories)
            logger.info(
                f"[{iteration}] Progress: {healthy_count}/3 categories healthy "
                f"({', '.join(result.healthy_categories) or 'none'})"
            )

            # Check completion condition
            if require_all:
                if result.all_healthy:
                    logger.info("All metrics are healthy!")
                    return result
            else:
                # Default: succeed when K8s is healthy (primary indicator)
                if result.k8s_result and result.k8s_result.healthy:
                    logger.info(
                        f"K8s metrics healthy. Additional: "
                        f"Kafka={'YES' if result.kafka_result.healthy else 'NO'}, "
                        f"Airflow={'YES' if result.airflow_result.healthy else 'NO'}"
                    )
                    return result

            # Wait before next check
            if datetime.utcnow() - start_time + timedelta(seconds=poll_interval_seconds) < timeout:
                logger.info(f"Waiting {poll_interval_seconds}s before next check...")
                time.sleep(poll_interval_seconds)

        # Timeout reached
        result.duration_seconds = (datetime.utcnow() - start_time).total_seconds()
        logger.warning(
            f"Timeout reached after {result.duration_seconds:.0f}s. "
            f"Final status: {result.healthy_categories or 'no healthy categories'}"
        )

        return result

    def close(self):
        """Close the HTTP session."""
        self._session.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, _exc_tb):
        self.close()
        return False


def main():
    """Command-line interface for metrics validation."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Validate Datadog metrics for infrastructure components"
    )
    parser.add_argument(
        "cluster_name",
        help="Cluster name to validate metrics for",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=15,
        help="Timeout in minutes (default: 15)",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=30,
        help="Poll interval in seconds (default: 30)",
    )
    parser.add_argument(
        "--require-all",
        action="store_true",
        help="Require all metric categories to be healthy",
    )
    parser.add_argument(
        "--list-clusters",
        action="store_true",
        help="List all clusters reporting metrics and exit",
    )
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Run a single check without waiting",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    try:
        with MetricsValidator() as validator:
            if args.list_clusters:
                clusters = validator.get_all_clusters()
                if clusters:
                    print("Clusters reporting Kubernetes metrics:")
                    for cluster in clusters:
                        print(f"  - {cluster}")
                else:
                    print("No clusters found reporting metrics.")
                return 0

            if args.check_only:
                # Single check without waiting
                result = ValidationResult(cluster_name=args.cluster_name)
                result.k8s_result = validator.check_k8s_metrics(args.cluster_name)
                result.kafka_result = validator.check_kafka_metrics(args.cluster_name)
                result.airflow_result = validator.check_airflow_metrics(args.cluster_name)
            else:
                # Wait for metrics with timeout
                result = validator.wait_for_metrics(
                    cluster_name=args.cluster_name,
                    timeout_minutes=args.timeout,
                    poll_interval_seconds=args.interval,
                    require_all=args.require_all,
                )

            print("\n" + "=" * 60)
            print(result.summary())
            print("=" * 60)

            if args.require_all:
                return 0 if result.all_healthy else 1
            else:
                return 0 if result.any_healthy else 1

    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        return 2
    except DatadogAPIError as e:
        logger.error(f"API error: {e}")
        return 3


if __name__ == "__main__":
    import sys
    sys.exit(main())