#!/usr/bin/env python3
"""Datadog installation helper for AKS clusters.

This tool replaces the legacy `aks-datadog-setup.sh` script and wraps the
kubectl/helm orchestration in a test-friendly Python module.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from textwrap import dedent

DEFAULT_VALUES = "k8s/datadog-values-aks.yaml"


class CommandError(RuntimeError):
    """Raised when a shell command fails."""


def require_tool(name: str) -> None:
    if shutil.which(name) is None:
        raise CommandError(f"Missing required tool: {name}")


def run(cmd: list[str], *, input_text: str | None = None) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(  # noqa: S603
            cmd,
            input=input_text,
            text=True,
            capture_output=True,
            check=True,
        )
    except subprocess.CalledProcessError as exc:  # pragma: no cover - passthrough
        raise CommandError(
            f"Command failed ({' '.join(cmd)}): {exc.stderr or exc.stdout}"
        ) from exc


def ensure_namespace(namespace: str) -> None:
    manifest = dedent(
        f"""
        apiVersion: v1
        kind: Namespace
        metadata:
          name: {namespace}
        """
    )
    run(["kubectl", "apply", "-f", "-"], input_text=manifest)


def apply_secret(namespace: str, api_key: str, app_key: str | None) -> None:
    literals = [f"api-key={api_key}"]
    if app_key:
        literals.append(f"app-key={app_key}")

    cmd = [
        "kubectl",
        "--namespace",
        namespace,
        "create",
        "secret",
        "generic",
        "datadog-secret",
        "--dry-run=client",
        "-o",
        "yaml",
    ]
    for literal in literals:
        cmd.extend(["--from-literal", literal])

    render = run(cmd)
    run(["kubectl", "apply", "-f", "-"], input_text=render.stdout)


def ensure_values_file(values_path: Path, site: str | None) -> None:
    if values_path.exists():
        return

    site_str = site or "datadoghq.com"
    values = dedent(
        f"""
        datadog:
          site: "{site_str}"
          logs:
            enabled: true
            containerCollectAll: true
          apm:
            enabled: true
          processAgent:
            enabled: true
          networkMonitoring:
            enabled: true

        agents:
          tolerations:
            - key: "CriticalAddonsOnly"
              operator: "Exists"

        clusterAgent:
          enabled: true
          replicas: 2
        """
    )
    values_path.parent.mkdir(parents=True, exist_ok=True)
    values_path.write_text(values, encoding="utf-8")


def install_chart(namespace: str, values_path: Path, chart_version: str | None) -> None:
    repo_name = "datadog"
    run(["helm", "repo", "add", repo_name, "https://helm.datadoghq.com"])
    run(["helm", "repo", "update"])

    cmd = [
        "helm",
        "upgrade",
        "--install",
        "datadog",
        f"{repo_name}/datadog",
        "--namespace",
        namespace,
        "--values",
        str(values_path),
        "--create-namespace",
    ]
    if chart_version:
        cmd.extend(["--version", chart_version])

    run(cmd)


def wait_for_agents(namespace: str, timeout: int) -> None:
    run(
        [
            "kubectl",
            "--namespace",
            namespace,
            "rollout",
            "status",
            "daemonset/datadog",
            f"--timeout={timeout}s",
        ]
    )
    run(
        [
            "kubectl",
            "--namespace",
            namespace,
            "rollout",
            "status",
            "deployment/datadog-cluster-agent",
            f"--timeout={timeout}s",
        ]
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Install Datadog on AKS")
    parser.add_argument("--namespace", default="datadog", help="Kubernetes namespace")
    parser.add_argument("--values", default=DEFAULT_VALUES, help="Helm values file path")
    parser.add_argument("--chart-version", help="Pin Datadog Helm chart version")
    parser.add_argument("--site", help="Datadog site (e.g. datadoghq.com)")
    parser.add_argument("--wait", action="store_true", help="Wait for rollout to complete")
    parser.add_argument(
        "--wait-timeout",
        type=int,
        default=600,
        help="Rollout wait timeout in seconds",
    )
    parser.add_argument("--api-key", default=None, help="Datadog API key (fallback to DD_API_KEY)")
    parser.add_argument("--app-key", default=None, help="Datadog APP key (fallback to DD_APP_KEY)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        require_tool("kubectl")
        require_tool("helm")
    except CommandError as err:
        print(err, file=sys.stderr)
        return 1

    api_key = args.api_key or os.getenv("DD_API_KEY")
    app_key = args.app_key or os.getenv("DD_APP_KEY")

    if not api_key:
        print("Datadog API key missing (set --api-key or DD_API_KEY)", file=sys.stderr)
        return 1

    values_path = Path(args.values)

    try:
        ensure_namespace(args.namespace)
        apply_secret(args.namespace, api_key, app_key)
        ensure_values_file(values_path, args.site)
        install_chart(args.namespace, values_path, args.chart_version)
        if args.wait:
            wait_for_agents(args.namespace, args.wait_timeout)
    except CommandError as err:
        print(err, file=sys.stderr)
        return 1

    print("Datadog installation complete")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
