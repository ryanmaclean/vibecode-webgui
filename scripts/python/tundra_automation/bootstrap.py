#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "tundra-bootstrap"
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


# Initialize log aggregation
log_agg = get_log_aggregation()

"""
Tundra Dome KIND Cluster Bootstrap Orchestrator

Python wrapper for kind-tundra-bootstrap.sh providing:
- Real-time output streaming with capture
- Progress stage tracking
- Error handling with actionable diagnostics
- Graceful interrupt handling
- Timeout management

This module provides two main classes:
- BootstrapOrchestrator: Wraps the shell script for full cluster bootstrap
- TundraBootstrap: Direct Helm-based deployment (legacy)
"""

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

# Datadog APM tracing - auto-detects local agent
import os as _os

_os.environ.setdefault("DD_SERVICE", "tundra-automation")
_os.environ.setdefault("DD_ENV", "development")

try:
    from ddtrace import tracer, patch_all

    patch_all()
except ImportError:
    tracer = None

import dataclasses
import datetime
import enum
import logging
import os
import re
import signal
import subprocess
import sys
import threading
import time
from collections.abc import Generator
from pathlib import Path
from typing import Optional, Dict, Any, List, Callable

logger = logging.getLogger(__name__)


# =============================================================================
# BootstrapOrchestrator - Shell Script Wrapper
# =============================================================================


class BootstrapStage(enum.Enum):
    """Stages of the bootstrap process."""

    PREFLIGHT = "preflight"
    CLUSTER_CREATION = "cluster_creation"
    NAMESPACE_SETUP = "namespace_setup"
    DATADOG_INSTALL = "datadog_install"
    KAFKA_INSTALL = "kafka_install"
    CONFIGMAP_CREATION = "configmap_creation"
    SECRET_CREATION = "secret_creation"
    OBSERVER_DEPLOYMENT = "observer_deployment"
    AIRFLOW_DEPLOYMENT = "airflow_deployment"
    VERIFICATION = "verification"
    E2E_TEST = "e2e_test"
    COMPLETE = "complete"
    FAILED = "failed"


@dataclasses.dataclass
class StageProgress:
    """Progress information for a single stage."""

    stage: BootstrapStage
    started_at: Optional[datetime.datetime] = None
    completed_at: Optional[datetime.datetime] = None
    success: bool = False
    error_message: Optional[str] = None

    @property
    def duration_seconds(self) -> Optional[float]:
        """Return duration in seconds if stage has completed."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None


@dataclasses.dataclass
class BootstrapResult:
    """Result of a bootstrap operation."""

    success: bool
    cluster_name: str
    stages: Dict[BootstrapStage, StageProgress]
    logs: List[str]
    start_time: datetime.datetime
    end_time: Optional[datetime.datetime] = None
    exit_code: Optional[int] = None
    error_message: Optional[str] = None
    diagnostics: List[str] = dataclasses.field(default_factory=list)

    @property
    def duration_seconds(self) -> Optional[float]:
        """Total duration in seconds."""
        if self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return None

    @property
    def current_stage(self) -> Optional[BootstrapStage]:
        """Return the current or last stage."""
        for stage in reversed(list(BootstrapStage)):
            if stage in self.stages:
                return stage
        return None

    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary for serialization."""
        return {
            "success": self.success,
            "cluster_name": self.cluster_name,
            "exit_code": self.exit_code,
            "duration_seconds": self.duration_seconds,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "error_message": self.error_message,
            "diagnostics": self.diagnostics,
            "stages": {
                stage.value: {
                    "success": progress.success,
                    "duration_seconds": progress.duration_seconds,
                    "error_message": progress.error_message,
                }
                for stage, progress in self.stages.items()
            },
            "log_line_count": len(self.logs),
        }


class BootstrapOrchestrator:
    """
    Orchestrates Tundra Dome KIND cluster bootstrap operations.

    Wraps the kind-tundra-bootstrap.sh script providing Python control over:
    - Cluster creation and teardown
    - Real-time output streaming
    - Progress tracking
    - Error handling and diagnostics

    Example:
        orchestrator = BootstrapOrchestrator()
        result = orchestrator.run(
            cluster_name="tundra-dome",
            teardown_first=True,
            timeout_seconds=900
        )
        if result.success:
            print(f"Bootstrap completed in {result.duration_seconds:.1f}s")
        else:
            print(f"Bootstrap failed: {result.error_message}")
            for diagnostic in result.diagnostics:
                print(f"  Suggestion: {diagnostic}")
    """

    # Patterns to detect stage transitions in output
    STAGE_PATTERNS: Dict[str, BootstrapStage] = {
        r"Running preflight checks": BootstrapStage.PREFLIGHT,
        r"Creating KIND cluster": BootstrapStage.CLUSTER_CREATION,
        r"Setting up namespaces": BootstrapStage.NAMESPACE_SETUP,
        r"Installing Datadog": BootstrapStage.DATADOG_INSTALL,
        r"Installing Kafka": BootstrapStage.KAFKA_INSTALL,
        r"Creating Tundra Dome ConfigMaps": BootstrapStage.CONFIGMAP_CREATION,
        r"Creating secrets": BootstrapStage.SECRET_CREATION,
        r"Deploying Tundra Observer": BootstrapStage.OBSERVER_DEPLOYMENT,
        r"Deploying Airflow": BootstrapStage.AIRFLOW_DEPLOYMENT,
        r"Verifying deployment": BootstrapStage.VERIFICATION,
        r"Running end-to-end validation": BootstrapStage.E2E_TEST,
        r"Bootstrap Complete": BootstrapStage.COMPLETE,
    }

    # Patterns to detect stage completion
    COMPLETION_PATTERNS: Dict[str, BootstrapStage] = {
        r"\[OK\] Preflight checks passed": BootstrapStage.PREFLIGHT,
        r"\[OK\] KIND cluster created": BootstrapStage.CLUSTER_CREATION,
        r"\[OK\] Namespaces configured": BootstrapStage.NAMESPACE_SETUP,
        r"\[OK\] Datadog installed": BootstrapStage.DATADOG_INSTALL,
        r"\[OK\] Kafka installed": BootstrapStage.KAFKA_INSTALL,
        r"\[OK\] ConfigMaps created": BootstrapStage.CONFIGMAP_CREATION,
        r"\[OK\] Secrets created": BootstrapStage.SECRET_CREATION,
        r"\[OK\] Tundra Observer deployed": BootstrapStage.OBSERVER_DEPLOYMENT,
        r"\[OK\] Airflow deployed": BootstrapStage.AIRFLOW_DEPLOYMENT,
        r"\[OK\] Deployment verification complete": BootstrapStage.VERIFICATION,
        r"E2E Tests Passed": BootstrapStage.E2E_TEST,
    }

    # Error patterns with diagnostic suggestions
    ERROR_DIAGNOSTICS: Dict[str, str] = {
        r"Docker is not running": "Start Docker Desktop or docker daemon",
        r"Missing: docker": "Install Docker: brew install --cask docker",
        r"Missing: kind": "Install kind: brew install kind",
        r"Missing: kubectl": "Install kubectl: brew install kubectl",
        r"Missing: helm": "Install helm: brew install helm",
        r"Docker disk space critically low": "Run: docker system prune -a --volumes",
        r"Docker memory too low": "Increase memory in Docker Desktop Settings -> Resources",
        r"DD_API_KEY not set": "Set DD_API_KEY environment variable or save to ~/.datadog/api_key",
        r"Cluster .* already exists": "Use teardown_first=True or manually delete with: kind delete cluster --name <name>",
        r"context deadline exceeded": "Increase timeout or check cluster resources",
        r"connection refused": "Check if Docker and KIND are running properly",
        r"OOMKilled": "Increase Docker memory allocation",
    }

    DEFAULT_TIMEOUT_SECONDS = 900  # 15 minutes

    def __init__(
        self,
        script_path: Optional[Path] = None,
        repo_root: Optional[Path] = None,
        output_callback: Optional[Callable[[str], None]] = None,
    ):
        """
        Initialize the bootstrap orchestrator.

        Args:
            script_path: Path to kind-tundra-bootstrap.sh. Auto-detected if not provided.
            repo_root: Repository root path. Auto-detected if not provided.
            output_callback: Optional callback function for each output line.
        """
        if repo_root is None:
            repo_root = self._detect_repo_root()
        self.repo_root = repo_root

        if script_path is None:
            script_path = repo_root / "scripts" / "kind-tundra-bootstrap.sh"
        self.script_path = script_path

        if not self.script_path.exists():
            raise FileNotFoundError(f"Bootstrap script not found: {self.script_path}")

        self.output_callback = output_callback
        self._interrupt_requested = False
        self._current_process: Optional[subprocess.Popen] = None
        self._original_sigint_handler: Any = None

    @staticmethod
    def _detect_repo_root() -> Path:
        """Detect repository root from current file location."""
        # Navigate from scripts/python/tundra_automation to repo root
        current = Path(__file__).resolve()
        for _ in range(4):  # Go up 4 levels
            current = current.parent
        return current

    def _setup_signal_handler(self) -> None:
        """Set up graceful interrupt handling."""
        self._original_sigint_handler = signal.signal(signal.SIGINT, self._handle_interrupt)

    def _restore_signal_handler(self) -> None:
        """Restore original signal handler."""
        if self._original_sigint_handler is not None:
            signal.signal(signal.SIGINT, self._original_sigint_handler)
            self._original_sigint_handler = None

    def _handle_interrupt(self, signum: int, _frame: Any) -> None:
        """Handle Ctrl+C gracefully."""
        logger.warning("Interrupt received, initiating graceful shutdown...")
        self._interrupt_requested = True
        if self._current_process and self._current_process.poll() is None:
            # Send SIGTERM to process group
            try:
                os.killpg(os.getpgid(self._current_process.pid), signal.SIGTERM)
            except (ProcessLookupError, PermissionError):
                pass

    def _parse_output_line(
        self,
        line: str,
        stages: Dict[BootstrapStage, StageProgress],
        current_stage: Optional[BootstrapStage],
    ) -> Optional[BootstrapStage]:
        """
        Parse an output line to detect stage transitions.

        Returns the new current stage if changed, else None.
        """
        # Check for stage start
        for pattern, stage in self.STAGE_PATTERNS.items():
            if re.search(pattern, line, re.IGNORECASE):
                if stage not in stages:
                    stages[stage] = StageProgress(
                        stage=stage,
                        started_at=datetime.datetime.now(),
                    )
                    logger.debug(f"Stage started: {stage.value}")
                return stage

        # Check for stage completion
        for pattern, stage in self.COMPLETION_PATTERNS.items():
            if re.search(pattern, line, re.IGNORECASE):
                if stage in stages:
                    stages[stage].completed_at = datetime.datetime.now()
                    stages[stage].success = True
                    logger.debug(f"Stage completed: {stage.value}")

        return current_stage

    def _extract_diagnostics(self, logs: List[str], error_message: Optional[str]) -> List[str]:
        """Extract actionable diagnostics from logs and errors."""
        diagnostics = []

        # Check all logs for known error patterns
        all_text = "\n".join(logs)
        if error_message:
            all_text += "\n" + error_message

        for pattern, suggestion in self.ERROR_DIAGNOSTICS.items():
            if re.search(pattern, all_text, re.IGNORECASE):
                diagnostics.append(suggestion)

        # Remove duplicates while preserving order
        seen = set()
        unique_diagnostics = []
        for d in diagnostics:
            if d not in seen:
                seen.add(d)
                unique_diagnostics.append(d)

        return unique_diagnostics

    def run(
        self,
        cluster_name: str = "tundra-dome",
        teardown_first: bool = False,
        timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
        skip_tests: bool = False,
        env_overrides: Optional[Dict[str, str]] = None,
        auto_confirm: bool = True,
    ) -> BootstrapResult:
        """
        Run the bootstrap process.

        Args:
            cluster_name: Name for the KIND cluster.
            teardown_first: If True, delete existing cluster before bootstrap.
            timeout_seconds: Maximum time to wait for bootstrap completion.
            skip_tests: If True, skip end-to-end tests after deployment.
            env_overrides: Additional environment variables to pass.
            auto_confirm: If True, auto-confirm prompts (non-interactive mode).

        Returns:
            BootstrapResult with success status, logs, and diagnostics.
        """
        start_time = datetime.datetime.now()
        logs: List[str] = []
        stages: Dict[BootstrapStage, StageProgress] = {}
        current_stage: Optional[BootstrapStage] = None
        self._interrupt_requested = False

        logger.info(f"Starting bootstrap for cluster: {cluster_name}")

        # Teardown existing cluster if requested
        if teardown_first:
            logger.info(f"Tearing down existing cluster: {cluster_name}")
            if not self.teardown(cluster_name):
                logger.warning("Teardown returned False, but continuing...")

        # Build command
        cmd = [str(self.script_path), cluster_name]
        if auto_confirm:
            cmd.append("-y")
        if skip_tests:
            cmd.append("--skip-tests")

        # Build environment
        env = os.environ.copy()
        if env_overrides:
            env.update(env_overrides)

        # Auto-confirm prompts by providing 'y' to stdin
        stdin_value = "y\n" * 10 if auto_confirm else None

        self._setup_signal_handler()

        try:
            # Start process with pipe for output
            self._current_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                stdin=subprocess.PIPE if auto_confirm else None,
                env=env,
                text=True,
                bufsize=1,  # Line buffered
                start_new_session=True,  # Create new process group for signal handling
            )

            # Send auto-confirm input if needed
            if auto_confirm and self._current_process.stdin:
                try:
                    self._current_process.stdin.write(stdin_value)
                    self._current_process.stdin.flush()
                except BrokenPipeError:
                    pass

            # Stream output with timeout
            deadline = time.time() + timeout_seconds

            def read_output():
                """Read output in a separate thread to allow timeout."""
                nonlocal current_stage
                try:
                    for line in iter(self._current_process.stdout.readline, ""):
                        if not line:
                            break
                        line = line.rstrip("\n")
                        logs.append(line)

                        # Parse for stage detection
                        new_stage = self._parse_output_line(line, stages, current_stage)
                        if new_stage:
                            current_stage = new_stage

                        # Stream to callback and stdout
                        if self.output_callback:
                            self.output_callback(line)
                        else:
                            print(line, flush=True)

                        if self._interrupt_requested:
                            break
                except Exception as e:
                    logger.error(f"Error reading output: {e}")

            # Start output reader thread
            reader_thread = threading.Thread(target=read_output, daemon=True)
            reader_thread.start()

            # Wait for process with timeout
            while self._current_process.poll() is None:
                if time.time() > deadline:
                    logger.error("Bootstrap timed out")
                    os.killpg(os.getpgid(self._current_process.pid), signal.SIGTERM)
                    time.sleep(2)
                    if self._current_process.poll() is None:
                        os.killpg(os.getpgid(self._current_process.pid), signal.SIGKILL)
                    reader_thread.join(timeout=5)
                    return BootstrapResult(
                        success=False,
                        cluster_name=cluster_name,
                        stages=stages,
                        logs=logs,
                        start_time=start_time,
                        end_time=datetime.datetime.now(),
                        exit_code=-1,
                        error_message=f"Bootstrap timed out after {timeout_seconds} seconds",
                        diagnostics=["Increase timeout or check system resources"],
                    )

                if self._interrupt_requested:
                    reader_thread.join(timeout=5)
                    return BootstrapResult(
                        success=False,
                        cluster_name=cluster_name,
                        stages=stages,
                        logs=logs,
                        start_time=start_time,
                        end_time=datetime.datetime.now(),
                        exit_code=-2,
                        error_message="Bootstrap interrupted by user",
                        diagnostics=["Use teardown() to clean up partial deployment"],
                    )

                time.sleep(0.1)

            # Wait for reader to finish
            reader_thread.join(timeout=10)

            exit_code = self._current_process.returncode
            success = exit_code == 0

            # Mark final stage
            if success:
                if BootstrapStage.COMPLETE not in stages:
                    stages[BootstrapStage.COMPLETE] = StageProgress(
                        stage=BootstrapStage.COMPLETE,
                        started_at=datetime.datetime.now(),
                        completed_at=datetime.datetime.now(),
                        success=True,
                    )
            else:
                # Mark current stage as failed
                if current_stage and current_stage in stages:
                    stages[current_stage].error_message = f"Failed with exit code {exit_code}"

            # Extract error message from last few log lines if failed
            error_message = None
            if not success:
                error_lines = [line for line in logs[-20:] if "[ERROR]" in line]
                if error_lines:
                    error_message = error_lines[-1]

            diagnostics = self._extract_diagnostics(logs, error_message)

            return BootstrapResult(
                success=success,
                cluster_name=cluster_name,
                stages=stages,
                logs=logs,
                start_time=start_time,
                end_time=datetime.datetime.now(),
                exit_code=exit_code,
                error_message=error_message,
                diagnostics=diagnostics,
            )

        except Exception as e:
            logger.exception("Bootstrap failed with exception")
            return BootstrapResult(
                success=False,
                cluster_name=cluster_name,
                stages=stages,
                logs=logs,
                start_time=start_time,
                end_time=datetime.datetime.now(),
                exit_code=-1,
                error_message=str(e),
                diagnostics=self._extract_diagnostics(logs, str(e)),
            )
        finally:
            self._restore_signal_handler()
            self._current_process = None

    def teardown(self, cluster_name: str, timeout_seconds: int = 60) -> bool:
        """
        Tear down an existing KIND cluster.

        Args:
            cluster_name: Name of the cluster to delete.
            timeout_seconds: Maximum time to wait for teardown.

        Returns:
            True if teardown succeeded or cluster didn't exist, False otherwise.
        """
        logger.info(f"Tearing down cluster: {cluster_name}")

        try:
            # Check if cluster exists
            result = subprocess.run(
                ["kind", "get", "clusters"],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if cluster_name not in result.stdout.split():
                logger.info(f"Cluster {cluster_name} does not exist, nothing to teardown")
                return True

            # Delete cluster
            result = subprocess.run(
                ["kind", "delete", "cluster", "--name", cluster_name],
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
            )

            if result.returncode == 0:
                logger.info(f"Cluster {cluster_name} deleted successfully")
                return True
            else:
                logger.error(f"Failed to delete cluster: {result.stderr}")
                return False

        except subprocess.TimeoutExpired:
            logger.error(f"Teardown timed out after {timeout_seconds} seconds")
            return False
        except FileNotFoundError:
            logger.error("kind command not found")
            return False
        except Exception as e:
            logger.exception(f"Teardown failed: {e}")
            return False

    def get_cluster_status(self, cluster_name: str) -> Dict[str, Any]:
        """
        Get the current status of a KIND cluster.

        Args:
            cluster_name: Name of the cluster to check.

        Returns:
            Dictionary with cluster status information.
        """
        status: Dict[str, Any] = {
            "cluster_name": cluster_name,
            "exists": False,
            "context": f"kind-{cluster_name}",
            "pods": {},
            "services": {},
            "errors": [],
        }

        try:
            # Check if cluster exists
            result = subprocess.run(
                ["kind", "get", "clusters"],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if cluster_name not in result.stdout.split():
                return status

            status["exists"] = True

            # Get nodes
            result = subprocess.run(
                ["kubectl", "--context", f"kind-{cluster_name}", "get", "nodes", "-o", "wide"],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode == 0:
                status["nodes"] = result.stdout

            # Get pods in tundra-dome namespace
            result = subprocess.run(
                [
                    "kubectl",
                    "--context",
                    f"kind-{cluster_name}",
                    "get",
                    "pods",
                    "-n",
                    "tundra-dome",
                    "-o",
                    "wide",
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode == 0:
                status["pods"]["tundra-dome"] = result.stdout

            # Get pods in datadog namespace
            result = subprocess.run(
                [
                    "kubectl",
                    "--context",
                    f"kind-{cluster_name}",
                    "get",
                    "pods",
                    "-n",
                    "datadog",
                    "-o",
                    "wide",
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode == 0:
                status["pods"]["datadog"] = result.stdout

            # Get services
            result = subprocess.run(
                [
                    "kubectl",
                    "--context",
                    f"kind-{cluster_name}",
                    "get",
                    "services",
                    "--all-namespaces",
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode == 0:
                status["services"] = result.stdout

            # Check cluster health
            result = subprocess.run(
                ["kubectl", "--context", f"kind-{cluster_name}", "cluster-info"],
                capture_output=True,
                text=True,
                timeout=30,
            )
            status["healthy"] = result.returncode == 0
            if result.returncode != 0:
                status["errors"].append(result.stderr)

        except subprocess.TimeoutExpired as e:
            status["errors"].append(f"Timeout checking cluster status: {e}")
        except FileNotFoundError as e:
            status["errors"].append(f"Required command not found: {e}")
        except Exception as e:
            status["errors"].append(f"Error checking cluster status: {e}")

        return status

    def stream_logs(
        self,
        cluster_name: str = "tundra-dome",
        namespace: str = "tundra-dome",
        pod_selector: Optional[str] = None,
        follow: bool = True,
        tail_lines: int = 100,
    ) -> Generator[str, None, None]:
        """
        Stream logs from pods in the cluster.

        Args:
            cluster_name: Name of the KIND cluster.
            namespace: Kubernetes namespace to get logs from.
            pod_selector: Label selector for pods (e.g., "app=tundra-observer").
            follow: If True, follow log output.
            tail_lines: Number of lines to show from end of logs.

        Yields:
            Log lines as they are produced.
        """
        context = f"kind-{cluster_name}"

        cmd = ["kubectl", "--context", context, "logs", "-n", namespace]

        if pod_selector:
            cmd.extend(["-l", pod_selector])
        else:
            cmd.append("--all-containers=true")

        cmd.extend(["--tail", str(tail_lines)])

        if follow:
            cmd.append("-f")

        logger.info(f"Streaming logs with command: {' '.join(cmd)}")

        try:
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )

            try:
                for line in iter(process.stdout.readline, ""):
                    if not line:
                        break
                    yield line.rstrip("\n")
            except GeneratorExit:
                # Consumer stopped iterating
                process.terminate()
                process.wait(timeout=5)
            finally:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        process.kill()

        except FileNotFoundError:
            yield "ERROR: kubectl not found"
        except Exception as e:
            yield f"ERROR: {e}"


# =============================================================================
# TundraBootstrap - Legacy Helm-based Deployment
# =============================================================================


class DeploymentStatus(enum.Enum):
    """Deployment status enumeration."""

    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


@dataclasses.dataclass
class DeploymentResult:
    """Result of a deployment operation."""

    status: DeploymentStatus
    message: str
    details: Optional[Dict[str, Any]] = None
    elapsed_seconds: float = 0.0


class TundraBootstrap:
    """Manages Tundra Dome cluster bootstrap and deployment."""

    DEFAULT_NAMESPACE = "datadog"
    HELM_RELEASE_NAME = "datadog"
    HELM_CHART = "datadog/datadog"

    def __init__(
        self,
        cluster_name: str = "tundra-dome",
        verbose: bool = False,
        progress_callback: Optional[Callable[[str, int], None]] = None,
    ):
        """Initialize the bootstrap manager.

        Args:
            cluster_name: Name of the cluster
            verbose: Enable verbose output
            progress_callback: Optional callback for progress updates (message, percent)
        """
        self.cluster_name = cluster_name
        self.verbose = verbose
        self.progress_callback = progress_callback
        self._status = DeploymentStatus.NOT_STARTED

    def _report_progress(self, message: str, percent: int) -> None:
        """Report progress to callback if available."""
        if self.progress_callback:
            self.progress_callback(message, percent)

    def setup_helm_repos(self) -> bool:
        """Set up required Helm repositories.

        Returns:
            True if repos were set up successfully
        """
        self._report_progress("Adding Datadog Helm repository...", 10)
        try:
            result = subprocess.run(
                ["helm", "repo", "add", "datadog", "https://helm.datadoghq.com"],
                capture_output=True,
                text=True,
                timeout=60,
            )
            if result.returncode != 0 and "already exists" not in result.stderr:
                return False

            self._report_progress("Updating Helm repositories...", 15)
            result = subprocess.run(
                ["helm", "repo", "update"],
                capture_output=True,
                text=True,
                timeout=120,
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            return False

    def create_namespace(self, namespace: str = DEFAULT_NAMESPACE) -> bool:
        """Create the deployment namespace.

        Args:
            namespace: Namespace to create

        Returns:
            True if namespace was created or already exists
        """
        self._report_progress(f"Creating namespace {namespace}...", 20)
        try:
            result = subprocess.run(
                ["kubectl", "create", "namespace", namespace],
                capture_output=True,
                text=True,
                timeout=30,
            )
            return result.returncode == 0 or "already exists" in result.stderr
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            return False

    def deploy_datadog_agent(
        self,
        api_key: str,
        app_key: Optional[str] = None,
        site: str = "datadoghq.com",
        namespace: str = DEFAULT_NAMESPACE,
        _extra_values: Optional[Dict[str, Any]] = None,
    ) -> DeploymentResult:
        """Deploy the Datadog agent using Helm.

        Args:
            api_key: Datadog API key
            app_key: Optional Datadog APP key
            site: Datadog site
            namespace: Target namespace
            _extra_values: Additional Helm values (reserved for future use)

        Returns:
            DeploymentResult with status and details
        """
        start_time = time.time()
        self._status = DeploymentStatus.IN_PROGRESS

        self._report_progress("Preparing Datadog agent deployment...", 25)

        # Build Helm command
        cmd = [
            "helm",
            "upgrade",
            "--install",
            self.HELM_RELEASE_NAME,
            self.HELM_CHART,
            "-n",
            namespace,
            "--set",
            f"datadog.apiKey={api_key}",
            "--set",
            f"datadog.site={site}",
            "--set",
            f"datadog.clusterName={self.cluster_name}",
            "--set",
            "datadog.logs.enabled=true",
            "--set",
            "datadog.apm.enabled=true",
            "--set",
            "datadog.processAgent.enabled=true",
            "--wait",
            "--timeout",
            "10m",
        ]

        if app_key:
            cmd.extend(["--set", f"datadog.appKey={app_key}"])

        self._report_progress("Installing Datadog agent via Helm...", 40)

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600,
            )

            elapsed = time.time() - start_time

            if result.returncode == 0:
                self._status = DeploymentStatus.COMPLETED
                self._report_progress("Datadog agent deployed successfully!", 100)
                return DeploymentResult(
                    status=DeploymentStatus.COMPLETED,
                    message="Datadog agent deployed successfully",
                    details={"output": result.stdout},
                    elapsed_seconds=elapsed,
                )
            else:
                self._status = DeploymentStatus.FAILED
                return DeploymentResult(
                    status=DeploymentStatus.FAILED,
                    message=f"Helm deployment failed: {result.stderr}",
                    details={"stdout": result.stdout, "stderr": result.stderr},
                    elapsed_seconds=elapsed,
                )
        except subprocess.TimeoutExpired:
            self._status = DeploymentStatus.FAILED
            return DeploymentResult(
                status=DeploymentStatus.FAILED,
                message="Deployment timed out after 10 minutes",
                elapsed_seconds=time.time() - start_time,
            )
        except (FileNotFoundError, OSError) as e:
            self._status = DeploymentStatus.FAILED
            return DeploymentResult(
                status=DeploymentStatus.FAILED,
                message=f"Deployment error: {str(e)}",
                elapsed_seconds=time.time() - start_time,
            )

    def teardown(self, namespace: str = DEFAULT_NAMESPACE) -> DeploymentResult:
        """Tear down the Datadog deployment.

        Args:
            namespace: Namespace containing the deployment

        Returns:
            DeploymentResult with status and details
        """
        start_time = time.time()

        self._report_progress("Uninstalling Datadog agent...", 30)

        try:
            result = subprocess.run(
                ["helm", "uninstall", self.HELM_RELEASE_NAME, "-n", namespace],
                capture_output=True,
                text=True,
                timeout=300,
            )

            elapsed = time.time() - start_time

            if result.returncode == 0:
                self._status = DeploymentStatus.ROLLED_BACK
                self._report_progress("Datadog agent uninstalled successfully!", 100)
                return DeploymentResult(
                    status=DeploymentStatus.ROLLED_BACK,
                    message="Datadog agent uninstalled successfully",
                    elapsed_seconds=elapsed,
                )
            else:
                return DeploymentResult(
                    status=DeploymentStatus.FAILED,
                    message=f"Teardown failed: {result.stderr}",
                    details={"stdout": result.stdout, "stderr": result.stderr},
                    elapsed_seconds=elapsed,
                )
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
            return DeploymentResult(
                status=DeploymentStatus.FAILED,
                message=f"Teardown error: {str(e)}",
                elapsed_seconds=time.time() - start_time,
            )

    def get_deployment_status(
        self, namespace: str = DEFAULT_NAMESPACE
    ) -> Dict[str, Any]:
        """Get current deployment status.

        Args:
            namespace: Namespace to check

        Returns:
            Dictionary with deployment status information
        """
        status = {
            "deployed": False,
            "release_name": None,
            "namespace": namespace,
            "pods": [],
            "ready": False,
        }

        try:
            # Check Helm release
            result = subprocess.run(
                ["helm", "list", "-n", namespace, "-o", "json"],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode == 0:
                import json

                releases = json.loads(result.stdout)
                for release in releases:
                    if release.get("name") == self.HELM_RELEASE_NAME:
                        status["deployed"] = True
                        status["release_name"] = release.get("name")
                        status["chart"] = release.get("chart")
                        status["app_version"] = release.get("app_version")
                        status["status"] = release.get("status")
                        break

            # Check pods
            if status["deployed"]:
                pod_result = subprocess.run(
                    [
                        "kubectl",
                        "get",
                        "pods",
                        "-n",
                        namespace,
                        "-l",
                        "app.kubernetes.io/name=datadog",
                        "-o",
                        "json",
                    ],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                if pod_result.returncode == 0:
                    import json

                    pods_data = json.loads(pod_result.stdout)
                    pods = pods_data.get("items", [])
                    status["pods"] = [
                        {
                            "name": p.get("metadata", {}).get("name"),
                            "phase": p.get("status", {}).get("phase"),
                            "ready": all(
                                c.get("ready", False)
                                for c in p.get("status", {}).get(
                                    "containerStatuses", []
                                )
                            ),
                        }
                        for p in pods
                    ]
                    status["ready"] = all(p["ready"] for p in status["pods"]) and len(
                        status["pods"]
                    ) > 0

        except (subprocess.TimeoutExpired, FileNotFoundError, OSError, ValueError):
            pass

        return status

    def wait_for_ready(
        self, namespace: str = DEFAULT_NAMESPACE, timeout_seconds: int = 300
    ) -> bool:
        """Wait for deployment to be ready.

        Args:
            namespace: Namespace to check
            timeout_seconds: Maximum time to wait

        Returns:
            True if deployment became ready within timeout
        """
        start_time = time.time()
        while time.time() - start_time < timeout_seconds:
            status = self.get_deployment_status(namespace)
            if status.get("ready"):
                return True

            elapsed = int(time.time() - start_time)
            self._report_progress(
                f"Waiting for pods to be ready... ({elapsed}s)",
                min(50 + int(elapsed / timeout_seconds * 40), 90),
            )
            time.sleep(10)

        return False


# =============================================================================
# CLI Entry Point
# =============================================================================


def main():
    """CLI entry point for the bootstrap orchestrator."""
    import argparse
    import json as json_module

    parser = argparse.ArgumentParser(
        description="Tundra Dome KIND Cluster Bootstrap Orchestrator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run full bootstrap with default cluster name
  python -m tundra_automation.bootstrap run

  # Run bootstrap with custom cluster name, teardown existing first
  python -m tundra_automation.bootstrap run -n my-cluster -t

  # Check cluster status
  python -m tundra_automation.bootstrap status -n tundra-dome

  # Teardown a cluster
  python -m tundra_automation.bootstrap teardown -n tundra-dome

  # Stream logs from observer
  python -m tundra_automation.bootstrap logs -l app=tundra-observer
""",
    )
    parser.add_argument(
        "command",
        choices=["run", "teardown", "status", "logs"],
        help="Command to execute",
    )
    parser.add_argument(
        "--cluster-name",
        "-n",
        default="tundra-dome",
        help="Cluster name (default: tundra-dome)",
    )
    parser.add_argument(
        "--teardown-first",
        "-t",
        action="store_true",
        help="Teardown existing cluster before bootstrap",
    )
    parser.add_argument(
        "--skip-tests",
        action="store_true",
        help="Skip E2E tests after deployment",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=900,
        help="Timeout in seconds (default: 900 = 15 minutes)",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging",
    )
    parser.add_argument(
        "--pod-selector",
        "-l",
        help="Pod selector for logs command (e.g., app=tundra-observer)",
    )
    parser.add_argument(
        "--no-follow",
        action="store_true",
        help="Don't follow logs (only show existing)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON",
    )

    args = parser.parse_args()

    # Setup logging
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    try:
        orchestrator = BootstrapOrchestrator()
    except FileNotFoundError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    if args.command == "run":
        result = orchestrator.run(
            cluster_name=args.cluster_name,
            teardown_first=args.teardown_first,
            timeout_seconds=args.timeout,
            skip_tests=args.skip_tests,
        )

        if args.json:
            print(json_module.dumps(result.to_dict(), indent=2))
        else:
            print("\n" + "=" * 60)
            print("Bootstrap Result:")
            print(f"  Success: {result.success}")
            if result.duration_seconds:
                print(f"  Duration: {result.duration_seconds:.1f}s")
            print(f"  Exit Code: {result.exit_code}")
            if result.error_message:
                print(f"  Error: {result.error_message}")
            if result.diagnostics:
                print("  Diagnostics:")
                for d in result.diagnostics:
                    print(f"    - {d}")
            print("  Stages:")
            for stage, progress in result.stages.items():
                status_str = "OK" if progress.success else "PENDING"
                duration_str = f" ({progress.duration_seconds:.1f}s)" if progress.duration_seconds else ""
                print(f"    - {stage.value}: {status_str}{duration_str}")
            print("=" * 60)

        sys.exit(0 if result.success else 1)

    elif args.command == "teardown":
        success = orchestrator.teardown(args.cluster_name)
        if args.json:
            print(json_module.dumps({"success": success, "cluster_name": args.cluster_name}))
        else:
            print(f"Teardown {'succeeded' if success else 'failed'}")
        sys.exit(0 if success else 1)

    elif args.command == "status":
        status = orchestrator.get_cluster_status(args.cluster_name)
        if args.json:
            print(json_module.dumps(status, indent=2, default=str))
        else:
            print(f"Cluster: {status['cluster_name']}")
            print(f"Exists: {status['exists']}")
            print(f"Context: {status['context']}")
            if status.get("healthy") is not None:
                print(f"Healthy: {status['healthy']}")
            if status.get("nodes"):
                print("\nNodes:")
                print(status["nodes"])
            if status.get("pods"):
                for ns, pods in status["pods"].items():
                    print(f"\nPods in {ns}:")
                    print(pods)
            if status.get("errors"):
                print("\nErrors:")
                for err in status["errors"]:
                    print(f"  - {err}")

    elif args.command == "logs":
        try:
            for line in orchestrator.stream_logs(
                cluster_name=args.cluster_name,
                pod_selector=args.pod_selector,
                follow=not args.no_follow,
            ):
                print(line)
        except KeyboardInterrupt:
            print("\nStopped log streaming")


if __name__ == "__main__":
    main()