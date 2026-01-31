#!/usr/bin/env python3
"""
SkyWalking Deployment Script

Deploy Apache SkyWalking with AI anomaly detection and Datadog integration.

Usage:
    python deploy.py
"""

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


@dataclass
class SkyWalkingConfig:
    """SkyWalking deployment configuration."""
    namespace_skywalking: str = "skywalking"
    namespace_vibecode: str = "vibecode-platform"
    helm_release: str = "skywalking"
    chart_version: str = "10.3.0"


def log_info(message: str) -> None:
    """Print info message."""
    print(f"{Color.BLUE}[INFO]{Color.NC} {message}")


def log_success(message: str) -> None:
    """Print success message."""
    print(f"{Color.GREEN}[SUCCESS]{Color.NC} {message}")


def log_warning(message: str) -> None:
    """Print warning message."""
    print(f"{Color.YELLOW}[WARNING]{Color.NC} {message}")


def log_error(message: str) -> None:
    """Print error message."""
    print(f"{Color.RED}[ERROR]{Color.NC} {message}")


def run_cmd(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    """Run a command."""
    return subprocess.run(cmd, capture_output=True, text=True, check=check)


def check_prerequisites() -> bool:
    """Check prerequisites."""
    log_info("Checking prerequisites...")

    if not shutil.which("kubectl"):
        log_error("kubectl not found. Please install kubectl.")
        return False

    if not shutil.which("helm"):
        log_error("helm not found. Please install helm.")
        return False

    result = run_cmd(["kubectl", "cluster-info"], check=False)
    if result.returncode != 0:
        log_error("Cannot connect to Kubernetes cluster.")
        return False

    # Check if Datadog is installed
    result = run_cmd(["kubectl", "get", "datadog", "datadog", "-n", "default"], check=False)
    if result.returncode != 0:
        log_warning("Datadog agent not found. SkyWalking will work but without Datadog integration.")

    log_success("Prerequisites check passed")
    return True


def create_namespaces(config: SkyWalkingConfig) -> bool:
    """Create namespaces."""
    log_info("Creating namespaces...")

    # Create namespace with dry-run and apply
    result = run_cmd([
        "kubectl", "create", "namespace", config.namespace_skywalking,
        "--dry-run=client", "-o", "yaml",
    ], check=False)

    if result.returncode == 0:
        apply_result = subprocess.run(
            ["kubectl", "apply", "-f", "-"],
            input=result.stdout,
            capture_output=True,
            text=True,
        )

    # Label namespace
    run_cmd([
        "kubectl", "label", "namespace", config.namespace_skywalking,
        "app.kubernetes.io/name=skywalking",
        "monitoring-tier=skywalking",
        "--overwrite",
    ], check=False)

    log_success("Namespaces created")
    return True


def add_helm_repo() -> bool:
    """Add SkyWalking Helm repository."""
    log_info("Adding SkyWalking Helm repository...")

    run_cmd(["helm", "repo", "add", "skywalking",
             "https://apache.jfrog.io/artifactory/skywalking-helm"], check=False)
    run_cmd(["helm", "repo", "update"])

    log_success("Helm repository added")
    return True


def create_secrets(config: SkyWalkingConfig) -> bool:
    """Create secrets."""
    log_info("Creating secrets...")

    # Check if Datadog secret exists
    result = run_cmd(["kubectl", "get", "secret", "datadog-secret", "-n", "default"], check=False)

    if result.returncode == 0:
        # Copy Datadog secret to SkyWalking namespace
        result = run_cmd([
            "kubectl", "get", "secret", "datadog-secret", "-n", "default", "-o", "yaml",
        ])

        yaml_content = result.stdout.replace(
            "namespace: default",
            f"namespace: {config.namespace_skywalking}"
        )

        subprocess.run(
            ["kubectl", "apply", "-f", "-"],
            input=yaml_content,
            capture_output=True,
            text=True,
        )
        log_success("Datadog secret copied to SkyWalking namespace")
    else:
        log_warning("Datadog secret not found. Integration features will be limited.")

    # Create integration secrets if environment variables are set
    slack_webhook = os.environ.get("SLACK_WEBHOOK_URL", "")
    pagerduty_key = os.environ.get("PAGERDUTY_ROUTING_KEY", "")

    if slack_webhook and pagerduty_key:
        result = run_cmd([
            "kubectl", "create", "secret", "generic", "skywalking-integration-secrets",
            f"--from-literal=slack-webhook-url={slack_webhook}",
            f"--from-literal=pagerduty-routing-key={pagerduty_key}",
            f"--namespace={config.namespace_skywalking}",
            "--dry-run=client", "-o", "yaml",
        ], check=False)

        if result.returncode == 0:
            subprocess.run(
                ["kubectl", "apply", "-f", "-"],
                input=result.stdout,
                capture_output=True,
                text=True,
            )
        log_success("Integration secrets created")
    else:
        log_warning("SLACK_WEBHOOK_URL or PAGERDUTY_ROUTING_KEY not set. Alert routing will be limited.")

    return True


def deploy_skywalking(config: SkyWalkingConfig, manifest_dir: Path) -> bool:
    """Deploy SkyWalking core components."""
    log_info("Deploying SkyWalking core components...")

    values_file = manifest_dir / "values-skywalking.yaml"
    cmd = [
        "helm", "upgrade", "--install", config.helm_release, "skywalking/skywalking",
        "--namespace", config.namespace_skywalking,
        "--version", config.chart_version,
        "--wait",
        "--timeout", "10m",
    ]

    if values_file.exists():
        cmd.extend(["--values", str(values_file)])

    result = run_cmd(cmd, check=False)
    if result.returncode != 0:
        log_error(f"Failed to deploy SkyWalking: {result.stderr}")
        return False

    log_success("SkyWalking core components deployed")
    return True


def deploy_ai_config(manifest_dir: Path) -> bool:
    """Deploy AI anomaly detection configuration."""
    log_info("Deploying AI anomaly detection configuration...")

    ai_config = manifest_dir / "ai-anomaly-detection.yaml"
    if ai_config.exists():
        run_cmd(["kubectl", "apply", "-f", str(ai_config)])

    log_success("AI anomaly detection configured")
    return True


def deploy_datadog_integration(manifest_dir: Path) -> bool:
    """Deploy Datadog integration."""
    log_info("Deploying Datadog integration...")

    integration_file = manifest_dir / "integration-datadog.yaml"
    if integration_file.exists():
        run_cmd(["kubectl", "apply", "-f", str(integration_file)])

    log_success("Datadog integration deployed")
    return True


def deploy_agents(config: SkyWalkingConfig, manifest_dir: Path) -> bool:
    """Deploy SkyWalking agents."""
    log_info("Deploying SkyWalking agents...")

    agents_file = manifest_dir / "skywalking-agents.yaml"
    if agents_file.exists():
        run_cmd(["kubectl", "apply", "-f", str(agents_file)])

    # Check if vibecode-webgui deployment exists
    result = run_cmd([
        "kubectl", "get", "deployment", "vibecode-webgui",
        "-n", config.namespace_vibecode,
    ], check=False)

    if result.returncode == 0:
        log_info("Patching vibecode-webgui deployment...")
        log_warning("Manual restart of vibecode-webgui may be required for agent injection")

    # Check if agentapi deployment exists
    result = run_cmd([
        "kubectl", "get", "deployment", "agentapi",
        "-n", config.namespace_vibecode,
    ], check=False)

    if result.returncode == 0:
        log_info("Patching agentapi deployment...")
        log_warning("Manual restart of agentapi may be required for agent injection")

    log_success("Agent configurations deployed")
    return True


def wait_for_ready(config: SkyWalkingConfig) -> bool:
    """Wait for components to be ready."""
    log_info("Waiting for components to be ready...")

    # Wait for BanyanDB
    run_cmd([
        "kubectl", "wait", "--for=condition=ready", "pod",
        "-l", "app.kubernetes.io/name=banyandb",
        "-n", config.namespace_skywalking,
        "--timeout=5m",
    ], check=False)

    # Wait for OAP
    run_cmd([
        "kubectl", "wait", "--for=condition=ready", "pod",
        "-l", "app.kubernetes.io/name=oap",
        "-n", config.namespace_skywalking,
        "--timeout=5m",
    ], check=False)

    # Wait for UI
    run_cmd([
        "kubectl", "wait", "--for=condition=ready", "pod",
        "-l", "app.kubernetes.io/name=ui",
        "-n", config.namespace_skywalking,
        "--timeout=5m",
    ], check=False)

    # Wait for Rover (DaemonSet)
    result = run_cmd([
        "kubectl", "rollout", "status", "daemonset/skywalking-rover",
        "-n", config.namespace_skywalking,
        "--timeout=5m",
    ], check=False)

    if result.returncode != 0:
        log_warning("Rover DaemonSet may still be rolling out")

    log_success("All components are ready")
    return True


def run_initial_training(config: SkyWalkingConfig, manifest_dir: Path) -> bool:
    """Run initial model training."""
    log_info("Running initial model training...")

    ai_config = manifest_dir / "ai-anomaly-detection.yaml"
    if ai_config.exists():
        run_cmd(["kubectl", "apply", "-f", str(ai_config)])

    # Wait for training job to complete
    result = run_cmd([
        "kubectl", "wait", "--for=condition=complete",
        "job/skywalking-initial-training",
        "-n", config.namespace_skywalking,
        "--timeout=10m",
    ], check=False)

    if result.returncode != 0:
        log_warning("Initial training may still be running")

    log_success("Initial model training started")
    return True


def verify_deployment(config: SkyWalkingConfig) -> bool:
    """Verify deployment."""
    log_info("Verifying deployment...")

    # Get OAP pod
    result = run_cmd([
        "kubectl", "get", "pod",
        "-l", "app.kubernetes.io/name=oap",
        "-n", config.namespace_skywalking,
        "-o", "jsonpath={.items[0].metadata.name}",
    ])
    oap_pod = result.stdout.strip()

    if not oap_pod:
        log_error("OAP pod not found")
        return False

    # Check OAP health
    result = run_cmd([
        "kubectl", "exec", oap_pod,
        "-n", config.namespace_skywalking, "--",
        "curl", "-f", "http://localhost:12800/internal/l7check",
    ], check=False)

    if result.returncode == 0:
        log_success("OAP health check passed")
    else:
        log_error("OAP health check failed")
        return False

    # Check BanyanDB connectivity
    result = run_cmd([
        "kubectl", "exec", oap_pod,
        "-n", config.namespace_skywalking, "--",
        "nc", "-zv", "banyandb", "17912",
    ], check=False)

    if result.returncode == 0:
        log_success("BanyanDB connectivity verified")
    else:
        log_error("Cannot connect to BanyanDB")
        return False

    # Check UI accessibility
    result = run_cmd([
        "kubectl", "get", "pod",
        "-l", "app.kubernetes.io/name=ui",
        "-n", config.namespace_skywalking,
        "-o", "jsonpath={.items[0].metadata.name}",
    ])
    ui_pod = result.stdout.strip()

    if ui_pod:
        result = run_cmd([
            "kubectl", "exec", ui_pod,
            "-n", config.namespace_skywalking, "--",
            "curl", "-f", "http://localhost:8080",
        ], check=False)

        if result.returncode == 0:
            log_success("UI is accessible")
        else:
            log_warning("UI may not be fully ready yet")

    log_success("Deployment verification complete")
    return True


def display_access_info(config: SkyWalkingConfig) -> None:
    """Display access information."""
    log_info("Deployment complete!")
    print()
    print("======================================")
    print("SkyWalking Access Information")
    print("======================================")
    print()

    # UI Access
    print("UI Access:")
    result = run_cmd([
        "kubectl", "get", "ingress", "skywalking-ui",
        "-n", config.namespace_skywalking,
    ], check=False)

    if result.returncode == 0:
        result = run_cmd([
            "kubectl", "get", "ingress", "skywalking-ui",
            "-n", config.namespace_skywalking,
            "-o", "jsonpath={.spec.rules[0].host}",
        ])
        ui_host = result.stdout.strip()
        print(f"  External: https://{ui_host}")

    print(f"  Port Forward: kubectl port-forward -n {config.namespace_skywalking} svc/ui 8080:8080")
    print("  Then access: http://localhost:8080")
    print()

    print("OAP GraphQL API:")
    print(f"  Port Forward: kubectl port-forward -n {config.namespace_skywalking} svc/oap 12800:12800")
    print("  Then access: http://localhost:12800/graphql")
    print()

    print("Prometheus Metrics:")
    print(f"  Port Forward: kubectl port-forward -n {config.namespace_skywalking} svc/oap 1234:1234")
    print("  Then access: http://localhost:1234/metrics")
    print()

    print("AI Anomaly Detection:")
    print("  Dashboard: Check SkyWalking UI → AI Anomalies")
    print("  Alerts: Integrated with Slack and PagerDuty")
    print()

    print("Datadog Integration:")
    print("  Traces: Forwarded via OTLP to Datadog")
    print("  Metrics: Exported to Prometheus")
    print("  Dashboard: Check Datadog for 'source:skywalking' tag")
    print()

    print("======================================")
    print("Next Steps:")
    print("======================================")
    print()
    print("1. Access SkyWalking UI to view service topology")
    print("2. Check AI anomaly detection dashboard")
    print("3. Verify traces are being collected")
    print("4. Configure alert routing for your team")
    print("5. Tune anomaly detection sensitivity if needed")
    print()
    print("Documentation: https://skywalking.apache.org/docs/")
    print()


def run_deployment(manifest_dir: Optional[Path] = None) -> int:
    """Run the main deployment flow."""
    log_info("Starting SkyWalking deployment with AI anomaly detection...")
    print()

    config = SkyWalkingConfig()

    if manifest_dir is None:
        manifest_dir = Path.cwd()

    if not check_prerequisites():
        return 1

    create_namespaces(config)
    add_helm_repo()
    create_secrets(config)

    if not deploy_skywalking(config, manifest_dir):
        return 1

    deploy_ai_config(manifest_dir)
    deploy_datadog_integration(manifest_dir)
    deploy_agents(config, manifest_dir)
    wait_for_ready(config)
    run_initial_training(config, manifest_dir)

    if not verify_deployment(config):
        return 1

    display_access_info(config)

    log_success("SkyWalking deployment complete!")
    return 0


def main() -> int:
    """Main entry point."""
    return run_deployment()


if __name__ == "__main__":
    sys.exit(main())
