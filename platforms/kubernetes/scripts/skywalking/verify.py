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
SkyWalking Deployment Verification Script

Comprehensive testing of all components and integrations.

Usage:
    python verify.py
"""

import subprocess
import sys
from dataclasses import dataclass


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


@dataclass
class VerifyConfig:
    """Verification configuration."""
    namespace_skywalking: str = "skywalking"
    namespace_vibecode: str = "vibecode-platform"


class SkyWalkingVerifier:
    """SkyWalking deployment verifier."""

    def __init__(self, config: VerifyConfig):
        self.config = config
        self.passed = 0
        self.failed = 0
        self.warnings = 0

    def log_test(self, message: str) -> None:
        """Print test message."""
        print(f"{Color.BLUE}[TEST]{Color.NC} {message}")

    def log_pass(self, message: str) -> None:
        """Record passed test."""
        print(f"{Color.GREEN}[PASS]{Color.NC} {message}")
        self.passed += 1

    def log_fail(self, message: str) -> None:
        """Record failed test."""
        print(f"{Color.RED}[FAIL]{Color.NC} {message}")
        self.failed += 1

    def log_warn(self, message: str) -> None:
        """Record warning."""
        print(f"{Color.YELLOW}[WARN]{Color.NC} {message}")
        self.warnings += 1

    def run_kubectl(self, args: list[str]) -> subprocess.CompletedProcess:
        """Run kubectl command."""
        return subprocess.run(
            ["kubectl"] + args,
            capture_output=True,
            text=True,
        )

    def test_component_health(self) -> None:
        """Test component health."""
        self.log_test("Testing component health...")

        # OAP health
        result = self.run_kubectl([
            "get", "pods", "-n", self.config.namespace_skywalking,
            "-l", "app.kubernetes.io/name=oap",
        ])

        if "Running" in result.stdout:
            result = self.run_kubectl([
                "get", "pod", "-l", "app.kubernetes.io/name=oap",
                "-n", self.config.namespace_skywalking,
                "-o", "jsonpath={.items[0].metadata.name}",
            ])
            oap_pod = result.stdout.strip()

            result = self.run_kubectl([
                "exec", oap_pod, "-n", self.config.namespace_skywalking, "--",
                "curl", "-sf", "http://localhost:12800/internal/l7check",
            ])
            if result.returncode == 0:
                self.log_pass("OAP is healthy")
            else:
                self.log_fail("OAP health check failed")
        else:
            self.log_fail("OAP pods not running")

        # BanyanDB health
        result = self.run_kubectl([
            "get", "pods", "-n", self.config.namespace_skywalking,
            "-l", "app.kubernetes.io/name=banyandb",
        ])
        if "Running" in result.stdout:
            self.log_pass("BanyanDB is running")
        else:
            self.log_fail("BanyanDB pods not running")

        # UI health
        result = self.run_kubectl([
            "get", "pods", "-n", self.config.namespace_skywalking,
            "-l", "app.kubernetes.io/name=ui",
        ])
        if "Running" in result.stdout:
            self.log_pass("UI is running")
        else:
            self.log_fail("UI pods not running")

    def test_storage_connectivity(self) -> None:
        """Test storage connectivity."""
        self.log_test("Testing storage connectivity...")

        result = self.run_kubectl([
            "get", "pod", "-l", "app.kubernetes.io/name=oap",
            "-n", self.config.namespace_skywalking,
            "-o", "jsonpath={.items[0].metadata.name}",
        ])
        oap_pod = result.stdout.strip()

        if oap_pod:
            result = self.run_kubectl([
                "exec", oap_pod, "-n", self.config.namespace_skywalking, "--",
                "nc", "-zv", "banyandb", "17912",
            ])
            if result.returncode == 0:
                self.log_pass("OAP can connect to BanyanDB")
            else:
                self.log_fail("OAP cannot connect to BanyanDB")

    def test_agent_instrumentation(self) -> None:
        """Test agent instrumentation."""
        self.log_test("Testing agent instrumentation...")

        # Check Node.js agent config
        result = self.run_kubectl([
            "get", "configmap", "skywalking-nodejs-agent-config",
            "-n", self.config.namespace_vibecode,
        ])
        if result.returncode == 0:
            self.log_pass("Node.js agent configuration exists")
        else:
            self.log_fail("Node.js agent configuration missing")

        # Check Python agent config
        result = self.run_kubectl([
            "get", "configmap", "skywalking-python-agent-config",
            "-n", self.config.namespace_vibecode,
        ])
        if result.returncode == 0:
            self.log_pass("Python agent configuration exists")
        else:
            self.log_fail("Python agent configuration missing")

    def test_anomaly_detection(self) -> None:
        """Test AI anomaly detection."""
        self.log_test("Testing AI anomaly detection...")

        # Check if AI config exists
        result = self.run_kubectl([
            "get", "configmap", "skywalking-ai-config",
            "-n", self.config.namespace_skywalking,
        ])
        if result.returncode == 0:
            self.log_pass("AI anomaly detection configuration exists")
        else:
            self.log_fail("AI anomaly detection configuration missing")

        # Check baseline training job
        result = self.run_kubectl([
            "get", "job", "skywalking-initial-training",
            "-n", self.config.namespace_skywalking,
        ])
        if result.returncode == 0:
            result = self.run_kubectl([
                "get", "job", "skywalking-initial-training",
                "-n", self.config.namespace_skywalking,
                "-o", "jsonpath={.status.conditions[0].type}",
            ])
            job_status = result.stdout.strip()

            if job_status == "Complete":
                self.log_pass("Initial model training completed")
            elif job_status == "Failed":
                self.log_fail("Initial model training failed")
            else:
                self.log_warn("Initial model training still in progress")
        else:
            self.log_warn("Initial training job not found")

        # Check CronJob for baseline updates
        result = self.run_kubectl([
            "get", "cronjob", "skywalking-baseline-training",
            "-n", self.config.namespace_skywalking,
        ])
        if result.returncode == 0:
            self.log_pass("Baseline training CronJob configured")
        else:
            self.log_fail("Baseline training CronJob missing")

    def test_datadog_integration(self) -> None:
        """Test Datadog integration."""
        self.log_test("Testing Datadog integration...")

        # Check OTLP collector
        result = self.run_kubectl([
            "get", "deployment", "skywalking-otel-collector",
            "-n", self.config.namespace_skywalking,
        ])
        if result.returncode == 0:
            result = self.run_kubectl([
                "get", "deployment", "skywalking-otel-collector",
                "-n", self.config.namespace_skywalking,
                "-o", "jsonpath={.status.readyReplicas}",
            ])
            ready = result.stdout.strip() or "0"
            if int(ready) > 0:
                self.log_pass("OTLP collector is running")
            else:
                self.log_fail("OTLP collector not ready")
        else:
            self.log_fail("OTLP collector not deployed")

        # Check Datadog secret
        result = self.run_kubectl([
            "get", "secret", "datadog-secret",
            "-n", self.config.namespace_skywalking,
        ])
        if result.returncode == 0:
            self.log_pass("Datadog secret exists")
        else:
            self.log_warn("Datadog secret not found (integration disabled)")

        # Check integration config
        result = self.run_kubectl([
            "get", "configmap", "skywalking-datadog-integration",
            "-n", self.config.namespace_skywalking,
        ])
        if result.returncode == 0:
            self.log_pass("Datadog integration configuration exists")
        else:
            self.log_fail("Datadog integration configuration missing")

    def test_metrics_export(self) -> None:
        """Test metrics export."""
        self.log_test("Testing metrics export...")

        result = self.run_kubectl([
            "get", "pod", "-l", "app.kubernetes.io/name=oap",
            "-n", self.config.namespace_skywalking,
            "-o", "jsonpath={.items[0].metadata.name}",
        ])
        oap_pod = result.stdout.strip()

        if oap_pod:
            result = self.run_kubectl([
                "exec", oap_pod, "-n", self.config.namespace_skywalking, "--",
                "curl", "-sf", "http://localhost:1234/metrics",
            ])
            if result.returncode == 0 and "skywalking" in result.stdout:
                self.log_pass("Prometheus metrics are being exported")
            else:
                self.log_fail("Prometheus metrics not available")

        # Check ServiceMonitor
        result = self.run_kubectl([
            "get", "servicemonitor", "skywalking-otel-collector",
            "-n", self.config.namespace_skywalking,
        ])
        if result.returncode == 0:
            self.log_pass("ServiceMonitor configured for Prometheus scraping")
        else:
            self.log_warn("ServiceMonitor not found (manual Prometheus config needed)")

    def test_ui_accessibility(self) -> None:
        """Test UI accessibility."""
        self.log_test("Testing UI accessibility...")

        result = self.run_kubectl([
            "get", "pod", "-l", "app.kubernetes.io/name=ui",
            "-n", self.config.namespace_skywalking,
            "-o", "jsonpath={.items[0].metadata.name}",
        ])
        ui_pod = result.stdout.strip()

        if ui_pod:
            result = self.run_kubectl([
                "exec", ui_pod, "-n", self.config.namespace_skywalking, "--",
                "curl", "-sf", "http://localhost:8080",
            ])
            if result.returncode == 0:
                self.log_pass("UI is accessible")
            else:
                self.log_fail("UI is not accessible")

        # Check ingress
        result = self.run_kubectl([
            "get", "ingress", "skywalking-ui",
            "-n", self.config.namespace_skywalking,
        ])
        if result.returncode == 0:
            self.log_pass("Ingress configured for external access")
        else:
            self.log_warn("Ingress not found (UI only accessible via port-forward)")

    def test_network_policies(self) -> None:
        """Test network policies."""
        self.log_test("Testing network policies...")

        result = self.run_kubectl([
            "get", "networkpolicy",
            "-n", self.config.namespace_skywalking,
            "-o", "json",
        ])

        if result.returncode == 0:
            import json
            try:
                data = json.loads(result.stdout)
                policy_count = len(data.get("items", []))
                if policy_count > 0:
                    self.log_pass(f"Network policies configured ({policy_count} policies)")
                else:
                    self.log_warn("No network policies found")
            except json.JSONDecodeError:
                self.log_warn("Could not parse network policies")
        else:
            self.log_warn("Network policies not configured")

    def print_summary(self) -> int:
        """Print verification summary."""
        print()
        print("======================================")
        print("Verification Summary")
        print("======================================")
        print()
        print(f"{Color.GREEN}Passed:{Color.NC}   {self.passed}")
        print(f"{Color.RED}Failed:{Color.NC}   {self.failed}")
        print(f"{Color.YELLOW}Warnings:{Color.NC} {self.warnings}")
        print()

        if self.failed == 0:
            print(f"{Color.GREEN}All critical tests passed!{Color.NC}")
            print()
            print("SkyWalking deployment is healthy and ready for use.")
            print()
            print("Next steps:")
            print(f"1. Access UI: kubectl port-forward -n {self.config.namespace_skywalking} svc/ui 8080:8080")
            print("2. View traces and service topology")
            print("3. Check AI anomaly detection dashboard")
            print("4. Configure alert routing if not already done")
            return 0
        else:
            print(f"{Color.RED}Some tests failed. Please review the output above.{Color.NC}")
            print()
            print("Common fixes:")
            print("1. Wait a few more minutes for components to stabilize")
            print(f"2. Check pod logs: kubectl logs -n {self.config.namespace_skywalking} <pod-name>")
            print("3. Verify secrets are configured correctly")
            print("4. Ensure Datadog agent is running (if integration enabled)")
            return 1

    def run_verification(self) -> int:
        """Run all verification tests."""
        print("======================================")
        print("SkyWalking Deployment Verification")
        print("======================================")
        print()

        self.test_component_health()
        self.test_storage_connectivity()
        self.test_agent_instrumentation()
        self.test_anomaly_detection()
        self.test_datadog_integration()
        self.test_metrics_export()
        self.test_ui_accessibility()
        self.test_network_policies()

        return self.print_summary()


def main() -> int:
    """Main entry point."""
    config = VerifyConfig()
    verifier = SkyWalkingVerifier(config)
    return verifier.run_verification()


if __name__ == "__main__":
    sys.exit(main())