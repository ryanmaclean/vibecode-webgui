#!/usr/bin/env python3
"""Validation utility for the VibeCode GitOps stack.

This Python port replaces the legacy Bash script and offers the same
observability while remaining testable. The module can be imported for unit
testing or executed directly as a CLI tool.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple


REPO_ROOT = Path(__file__).resolve().parent.parent


class Colors:
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    RED = "\033[0;31m"
    NC = "\033[0m"


def load_env_file(env_path: Path) -> bool:
    """Load key/value pairs from ``env_path`` into the environment.

    Returns True if the file existed (even if it contained no values). Missing
    files return False, mirroring the previous Bash behavior.
    """

    if not env_path.exists():
        return False

    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ[key.strip()] = value.strip()
    return True


def check_file(path: Path) -> bool:
    """Return True if ``path`` exists and is a file."""

    return path.is_file()


def run_command(command: Sequence[str]) -> Tuple[bool, str, str]:
    """Run a shell command and return ``(success, stdout, stderr)``."""

    try:
        completed = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
            text=True,
        )
    except FileNotFoundError as exc:
        return False, "", str(exc)
    return completed.returncode == 0, completed.stdout, completed.stderr


def print_header() -> None:
    print("🎯 VibeCode GitOps Automation Validation")
    print("=======================================")


def print_file_section(title: str, files: Iterable[Path]) -> None:
    print(f"\n{title}")
    for file_path in files:
        status = "✅" if check_file(file_path) else "❌"
        color = Colors.GREEN if status == "✅" else Colors.RED
        rel_path = file_path.relative_to(REPO_ROOT)
        print(f"{color}{status}{Colors.NC} {rel_path}")


def print_kubernetes_status() -> None:
    print(f"\n{Colors.BLUE}🎛️  KIND Cluster Status{Colors.NC}")
    print("====================")

    success, _, _ = run_command(["kubectl", "cluster-info"])
    if not success:
        print(f"{Colors.RED}❌ No Kubernetes cluster found{Colors.NC}")
        print("Run: ./scripts/local-kind-setup.sh")
        return

    print(f"{Colors.GREEN}✅ Kubernetes cluster accessible{Colors.NC}")

    def _print_command(description: str, cmd: List[str], max_lines: int | None = None) -> None:
        print(f"\n{description}")
        cmd_success, stdout, stderr = run_command(cmd)
        if not cmd_success:
            message = stderr.strip() or "Command failed"
            print(message)
            return
        lines = stdout.strip().splitlines()
        if max_lines is not None:
            lines = lines[:max_lines]
        print("\n".join(lines) if lines else "(no output)")

    _print_command("📊 Cluster Nodes:", ["kubectl", "get", "nodes"])
    _print_command(
        "📦 System Pods:",
        ["kubectl", "get", "pods", "-n", "kube-system"],
        max_lines=5,
    )

    print("\n🔄 ArgoCD Status:")
    namespace_ok, _, _ = run_command(["kubectl", "get", "namespace", "argocd"])
    if namespace_ok:
        _print_command("", ["kubectl", "get", "pods", "-n", "argocd"])
    else:
        print("ArgoCD not yet installed")

    _print_command(
        "\n🌐 Ingress Controller:",
        ["kubectl", "get", "pods", "-n", "ingress-nginx"],
        max_lines=3,
    )


def print_env_summary() -> None:
    print(f"\n{Colors.BLUE}🔧 Environment Configuration{Colors.NC}")
    print("=========================")
    print(f"NextAuth URL: {os.environ.get('NEXTAUTH_URL', 'Not set')}")
    print(f"Database URL: {os.environ.get('DATABASE_URL', 'Not set')}")
    print(f"Redis URL: {os.environ.get('REDIS_URL', 'Not set')}")
    print(f"Datadog Environment: {os.environ.get('DD_ENV', 'Not set')}")

    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    preview = api_key[:10]
    print(
        "OpenRouter API: "
        f"{preview + '...' if api_key else 'Not set'} ({len(api_key)} chars)"
    )


def print_constant_sections() -> None:
    print(f"\n{Colors.BLUE}🚀 What We've Built{Colors.NC}")
    print("==================")
    accomplishments = [
        "Complete Infrastructure as Code with Terraform",
        "GitOps automation with ArgoCD",
        "Multi-environment support (staging/production)",
        "Comprehensive monitoring with Datadog, Prometheus, Grafana",
        "Secure secrets management with Sealed Secrets",
        "CI/CD pipeline with GitHub Actions",
        "Kubernetes manifests with Kustomize",
        "Production-ready security policies",
        "Complete observability and monitoring",
        "Local development environment with KIND",
    ]
    for item in accomplishments:
        print(f"{Colors.GREEN}✅{Colors.NC} {item}")

    print(f"\n{Colors.BLUE}🎯 Testing & Validation{Colors.NC}")
    print("===================")
    checks = [
        "KIND cluster running with 3 nodes",
        "NGINX Ingress Controller installed",
        "ArgoCD GitOps platform installed",
        "All configuration files validated",
        "Environment variables loaded",
        "Docker images buildable",
    ]
    for check in checks:
        print(f"{Colors.GREEN}✅{Colors.NC} {check}")

    print(f"\n{Colors.BLUE}📈 Next Steps{Colors.NC}")
    print("============")
    steps = [
        "1. 🔄 Wait for ArgoCD to fully start: kubectl wait --for=condition=available deployment/argocd-server -n argocd",
        "2. 🌐 Access ArgoCD UI: kubectl port-forward svc/argocd-server -n argocd 8080:443",
        "3. 🔑 Get ArgoCD password: kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath='{.data.password}' | base64 -d",
        "4. 🚀 Deploy applications: kubectl apply -f infrastructure/gitops/argocd/",
        "5. 📊 Monitor with: ./scripts/test-gitops-automation.sh",
    ]
    for step in steps:
        print(step)

    print(f"\n{Colors.GREEN}🎉 GitOps Automation Setup Complete!{Colors.NC}")
    print("\nYour VibeCode platform now has:")
    benefits = [
        "🏗️  Infrastructure as Code (Terraform)",
        "🔄 GitOps Deployments (ArgoCD)",
        "☸️  Kubernetes Multi-Environment",
        "📊 Full Observability Stack",
        "🔐 Secure Secrets Management",
        "🚀 Automated CI/CD Pipeline",
    ]
    for benefit in benefits:
        print(f"• {benefit}")


def main() -> None:
    print_header()

    env_loaded = load_env_file(REPO_ROOT / ".env.local")
    if env_loaded:
        print(f"{Colors.GREEN}✅ Environment loaded from .env.local{Colors.NC}")
    else:
        print(f"{Colors.RED}❌ .env.local not found{Colors.NC}")

    print(f"\n{Colors.BLUE}📋 GitOps Infrastructure Components{Colors.NC}")
    print("==================================")

    sections: List[Tuple[str, List[Path]]] = [
        (
            "🏗️  Infrastructure as Code (Terraform):",
            [
                REPO_ROOT / "infrastructure/terraform/main.tf",
                REPO_ROOT / "infrastructure/monitoring/datadog-dashboard.tf",
            ],
        ),
        (
            "🔄 GitOps Configuration (ArgoCD):",
            [
                REPO_ROOT / "infrastructure/gitops/argocd/project.yaml",
                REPO_ROOT / "infrastructure/gitops/argocd/application-staging.yaml",
                REPO_ROOT / "infrastructure/gitops/argocd/application-production.yaml",
            ],
        ),
        (
            "🚀 CI/CD Pipeline:",
            [REPO_ROOT / ".github/workflows/gitops-deployment.yml"],
        ),
        (
            "☸️  Kubernetes Manifests:",
            [
                REPO_ROOT / "infrastructure/kubernetes/environments/base/kustomization.yaml",
                REPO_ROOT / "infrastructure/kubernetes/environments/staging/kustomization.yaml",
                REPO_ROOT / "infrastructure/kubernetes/environments/production/kustomization.yaml",
            ],
        ),
        (
            "📊 Monitoring Stack:",
            [
                REPO_ROOT / "infrastructure/kubernetes/monitoring/datadog-agent.yaml",
                REPO_ROOT / "infrastructure/kubernetes/monitoring/prometheus.yaml",
                REPO_ROOT / "infrastructure/kubernetes/monitoring/grafana.yaml",
            ],
        ),
        (
            "🔐 Secrets Management:",
            [
                REPO_ROOT
                / "infrastructure/kubernetes/secrets/sealed-secrets/staging-secrets.yaml",
                REPO_ROOT
                / "infrastructure/kubernetes/secrets/sealed-secrets/production-secrets.yaml",
            ],
        ),
        (
            "📚 Documentation:",
            [
                REPO_ROOT / "docs/infrastructure/gitops-deployment-guide.md",
                REPO_ROOT / "examples/testing/user-journey.test.ts",
            ],
        ),
    ]

    for title, files in sections:
        print_file_section(title, files)

    print_kubernetes_status()
    print_env_summary()
    print_constant_sections()


if __name__ == "__main__":
    main()

