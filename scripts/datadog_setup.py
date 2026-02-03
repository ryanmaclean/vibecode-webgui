#!/usr/bin/env python3
"""Datadog installation helper for AKS clusters.

This module wraps the kubectl/helm orchestration required to deploy the
Datadog agents and cluster agent. It is designed to replace the legacy
`aks-datadog-setup.sh` script while remaining easy to invoke from shell
wrappers and tests.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path
from textwrap import dedent

DEFAULT_NAMESPACE = "datadog"
DEFAULT_VALUES_FILE = Path("k8s/datadog-values-aks.yaml")
DEFAULT_WAIT_TIMEOUT = 600


class CommandError(RuntimeError):
    """Raised when an underlying command fails."""


def require_tool(name: str) -> None:
    if shutil.which(name) is None:
        raise CommandError(f"Missing required tool: {name}")


def run(cmd: list[str], *, input_text: str | None = None, dry_run: bool = False) -> subprocess.CompletedProcess[str]:
    if dry_run:
        print(f"[DRY-RUN] {' '.join(cmd)}")
        if input_text:
            snippet = input_text if len(input_text) < 120 else f"{input_text[:117]}..."
            print(f"[DRY-RUN] with stdin:\n{snippet}")
        return subprocess.CompletedProcess(cmd, 0, "", "")

    try:
        return subprocess.run(  # noqa: S603
            cmd,
            input=input_text,
            text=True,
            capture_output=True,
            check=True,
        )
    except subprocess.CalledProcessError as exc:  # pragma: no cover - delegated error
        raise CommandError(
            f"Command failed ({' '.join(cmd)}): {exc.stderr or exc.stdout}"
        ) from exc


def ensure_namespace(namespace: str, *, dry_run: bool) -> None:
    manifest = dedent(
        f"""
        apiVersion: v1
        kind: Namespace
        metadata:
          name: {namespace}
        """
    )
    run(["kubectl", "apply", "-f", "-"], input_text=manifest, dry_run=dry_run)


def apply_secret(namespace: str, api_key: str, app_key: str | None, *, dry_run: bool) -> None:
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
        "--from-literal",
        f"api-key={api_key}",
    ]
    if app_key:
        cmd.extend(["--from-literal", f"app-key={app_key}"])

    rendered = run(cmd, dry_run=dry_run)
    if dry_run:
        return

    run(["kubectl", "apply", "-f", "-"], input_text=rendered.stdout, dry_run=dry_run)


def ensure_values_file(path: Path, site: str | None, *, dry_run: bool) -> None:
    if path.exists() or dry_run:
        return

    site_value = site or "datadoghq.com"
    contents = dedent(
        f"""
        datadog:
          site: "{site_value}"
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
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(contents, encoding="utf-8")


def install_chart(namespace: str, values_path: Path, chart_version: str | None, *, dry_run: bool) -> None:
    run(["helm", "repo", "add", "datadog", "https://helm.datadoghq.com"], dry_run=dry_run)
    run(["helm", "repo", "update"], dry_run=dry_run)

    cmd = [
        "helm",
        "upgrade",
        "--install",
        "datadog",
        "datadog/datadog",
        "--namespace",
        namespace,
        "--create-namespace",
        "--values",
        str(values_path),
    ]
    if chart_version:
        cmd.extend(["--version", chart_version])

    run(cmd, dry_run=dry_run)


def wait_for_agents(namespace: str, timeout: int, *, dry_run: bool) -> None:
    run(
        [
            "kubectl",
            "--namespace",
            namespace,
            "rollout",
            "status",
            "daemonset/datadog",
            f"--timeout={timeout}s",
        ],
        dry_run=dry_run,
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
        ],
        dry_run=dry_run,
    )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Install Datadog agent tooling on AKS")
    parser.add_argument("--namespace", default=DEFAULT_NAMESPACE)
    parser.add_argument("--values", default=str(DEFAULT_VALUES_FILE), help="Helm values file path")
    parser.add_argument("--chart-version", help="Pin Datadog Helm chart version")
    parser.add_argument("--site", help="Datadog site (e.g. datadoghq.com)")
    parser.add_argument("--api-key", help="Datadog API key (overrides DD_API_KEY)")
    parser.add_argument("--app-key", help="Datadog APP key (overrides DD_APP_KEY)")
    parser.add_argument("--wait", action="store_true")
    parser.add_argument("--wait-timeout", type=int, default=DEFAULT_WAIT_TIMEOUT)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

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
        ensure_namespace(args.namespace, dry_run=args.dry_run)
        apply_secret(args.namespace, api_key, app_key, dry_run=args.dry_run)
        ensure_values_file(values_path, args.site, dry_run=args.dry_run)
        install_chart(args.namespace, values_path, args.chart_version, dry_run=args.dry_run)
        if args.wait:
            wait_for_agents(args.namespace, args.wait_timeout, dry_run=args.dry_run)
    except CommandError as err:
        print(err, file=sys.stderr)
        return 1

    print("Datadog deployment complete")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
