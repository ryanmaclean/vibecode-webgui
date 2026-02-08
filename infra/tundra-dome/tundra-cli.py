#!/usr/bin/env python3
"""
Tundra Dome CLI - Manage KIND cluster deployments

Usage:
    tundra-cli.py [command] [options]

Commands:
    init        Full initialization (namespace, CRDs, Kafka, Gitea, controllers, examples)
    deploy      Quick deploy (CRDs + controllers + status)
    crds        Install/delete CRDs
    controllers Deploy/delete controllers
    kafka       Deploy/delete Kafka topics init job
    gitea       Deploy/delete Gitea stack (server + webhook producer)
    examples    Apply/delete example Lane and Polecat CRs
    status      Check cluster status

Examples:
    ./tundra-cli.py init                    # Full stack init
    ./tundra-cli.py init -c kind-tundra-dome
    ./tundra-cli.py crds --install
    ./tundra-cli.py controllers --deploy
    ./tundra-cli.py kafka --deploy
    ./tundra-cli.py gitea --deploy
    ./tundra-cli.py examples --apply
    ./tundra-cli.py status
    ./tundra-cli.py                         # Interactive TUI mode
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Optional

SCRIPT_DIR = Path(__file__).parent.resolve()
CRDS_DIR = SCRIPT_DIR / "crds"
CONTROLLERS_DIR = SCRIPT_DIR / "controllers"
BRIDGES_DIR = SCRIPT_DIR / "bridges"
MANIFESTS_DIR = SCRIPT_DIR / "manifests"
EXAMPLES_DIR = SCRIPT_DIR / "examples"
K8S_DIR = SCRIPT_DIR / "k8s"

# CRD definitions
CRDS = ["bead", "polecat", "lane", "playbook", "station", "errand"]

# Example CRs to apply
EXAMPLE_CRS = ["lanes.yaml", "polecats.yaml"]

# Available clusters
CLUSTERS = ["kind-tundra-dome", "kind-gastown", "kind-vibecode-local"]

# Standard envs: dev, hme, prd, stg
ENVS = {"dev": "Development", "hme": "Home/Local", "prd": "Production", "stg": "Staging"}


def run_kubectl(args: list[str], context: Optional[str] = None, check: bool = True) -> subprocess.CompletedProcess:
    """Run kubectl command with optional context."""
    cmd = ["kubectl"]
    if context:
        cmd.extend(["--context", context])
    cmd.extend(args)
    return subprocess.run(cmd, capture_output=True, text=True, check=check)


def check_cluster_available(cluster: str) -> bool:
    """Check if a cluster is available and running."""
    result = run_kubectl(["get", "nodes"], context=cluster, check=False)
    return result.returncode == 0


def get_available_clusters() -> list[str]:
    """Get list of available clusters."""
    return [c for c in CLUSTERS if check_cluster_available(c)]


# ============================================================================
# CRD Commands
# ============================================================================

def cmd_crds_install(clusters: list[str]) -> int:
    """Install Tundra Dome CRDs."""
    print("Installing Tundra Dome CRDs...")

    for cluster in clusters:
        if not check_cluster_available(cluster):
            print(f"  [SKIP] {cluster} not available")
            continue

        print(f"\n  Cluster: {cluster}")
        for crd in CRDS:
            crd_file = CRDS_DIR / f"{crd}.yaml"
            if not crd_file.exists():
                print(f"    [WARN] {crd}.yaml not found")
                continue
            result = run_kubectl(["apply", "-f", str(crd_file)], context=cluster, check=False)
            status = "OK" if result.returncode == 0 else "FAIL"
            print(f"    [{status}] {crd}")

    print("\nCRDs installed. Available resources:")
    print("  kubectl get beads      (bd)  - Work items")
    print("  kubectl get polecats   (pc)  - Workers")
    print("  kubectl get lanes      (ln)  - Priority queues")
    print("  kubectl get playbooks  (pb)  - Workflows")
    print("  kubectl get stations   (st)  - Services")
    print("  kubectl get errands    (er)  - Tasks/jobs")
    return 0


def cmd_crds_delete(clusters: list[str]) -> int:
    """Delete Tundra Dome CRDs."""
    print("Removing Tundra Dome CRDs...")

    crd_names = [f"{crd}s.tundra.dome" for crd in CRDS]

    for cluster in clusters:
        if not check_cluster_available(cluster):
            print(f"  [SKIP] {cluster} not available")
            continue

        print(f"\n  Cluster: {cluster}")
        for crd_name in crd_names:
            result = run_kubectl(["delete", "crd", crd_name], context=cluster, check=False)
            status = "OK" if result.returncode == 0 else "N/A"
            print(f"    [{status}] {crd_name}")

    print("\nCRDs removed.")
    return 0


def cmd_crds(args: argparse.Namespace) -> int:
    """Handle CRD subcommands."""
    clusters = [args.cluster] if args.cluster else get_available_clusters()

    if args.delete:
        return cmd_crds_delete(clusters)
    else:
        return cmd_crds_install(clusters)


# ============================================================================
# Controller Commands
# ============================================================================

def cmd_controllers_deploy(clusters: list[str]) -> int:
    """Deploy Tundra Dome controllers."""
    print("Deploying Tundra Dome controllers...")

    controllers_yaml = CONTROLLERS_DIR / "controllers.yaml"
    if not controllers_yaml.exists():
        print(f"  [ERROR] controllers.yaml not found at {controllers_yaml}")
        return 1

    for cluster in clusters:
        if not check_cluster_available(cluster):
            print(f"  [SKIP] {cluster} not available")
            continue

        print(f"\n  Cluster: {cluster}")

        # Create ConfigMaps from controller code
        controller_dirs = [
            (CONTROLLERS_DIR / "polecat-operator", "polecat-operator-code"),
            (CONTROLLERS_DIR / "bead-controller", "bead-controller-code"),
            (CONTROLLERS_DIR / "lane-controller", "lane-controller-code"),
            (BRIDGES_DIR / "openlineage-bead", "openlineage-bead-bridge-code"),
        ]

        for code_dir, configmap_name in controller_dirs:
            if code_dir.exists():
                # Create configmap from directory
                result = run_kubectl([
                    "create", "configmap", configmap_name,
                    f"--from-file={code_dir}",
                    "-n", "tundra-dome",
                    "--dry-run=client", "-o", "yaml"
                ], context=cluster, check=False)

                if result.returncode == 0:
                    # Apply the configmap
                    apply_result = subprocess.run(
                        ["kubectl", "--context", cluster, "apply", "-f", "-"],
                        input=result.stdout,
                        capture_output=True,
                        text=True
                    )
                    status = "OK" if apply_result.returncode == 0 else "FAIL"
                    print(f"    [{status}] ConfigMap: {configmap_name}")
            else:
                print(f"    [SKIP] {configmap_name} - code dir not found")

        # Apply controllers manifest
        result = run_kubectl(["apply", "-f", str(controllers_yaml)], context=cluster, check=False)
        status = "OK" if result.returncode == 0 else "FAIL"
        print(f"    [{status}] Controllers deployment")

        # Wait for rollout
        print("    Waiting for rollout...")
        for deployment in ["polecat-operator", "bead-controller", "lane-controller", "openlineage-bead-bridge"]:
            result = run_kubectl([
                "rollout", "status", f"deployment/{deployment}",
                "-n", "tundra-dome", "--timeout=60s"
            ], context=cluster, check=False)
            status = "READY" if result.returncode == 0 else "PENDING"
            print(f"      [{status}] {deployment}")

    return 0


def cmd_controllers_delete(clusters: list[str]) -> int:
    """Delete Tundra Dome controllers."""
    print("Removing Tundra Dome controllers...")

    controllers_yaml = CONTROLLERS_DIR / "controllers.yaml"

    for cluster in clusters:
        if not check_cluster_available(cluster):
            print(f"  [SKIP] {cluster} not available")
            continue

        print(f"\n  Cluster: {cluster}")

        if controllers_yaml.exists():
            result = run_kubectl(["delete", "-f", str(controllers_yaml)], context=cluster, check=False)
            status = "OK" if result.returncode == 0 else "N/A"
            print(f"    [{status}] Controllers deleted")

        # Delete ConfigMaps
        for configmap in ["polecat-operator-code", "bead-controller-code", "lane-controller-code", "openlineage-bead-bridge-code"]:
            run_kubectl([
                "delete", "configmap", configmap,
                "-n", "tundra-dome"
            ], context=cluster, check=False)

    return 0


def cmd_controllers(args: argparse.Namespace) -> int:
    """Handle controller subcommands."""
    clusters = [args.cluster] if args.cluster else get_available_clusters()

    if args.delete:
        return cmd_controllers_delete(clusters)
    else:
        return cmd_controllers_deploy(clusters)


# ============================================================================
# Status Command
# ============================================================================

def cmd_status(args: argparse.Namespace) -> int:
    """Check Tundra Dome status across clusters."""
    clusters = [args.cluster] if args.cluster else CLUSTERS

    print("Tundra Dome Cluster Status")
    print("=" * 60)

    for cluster in clusters:
        print(f"\nCluster: {cluster}")
        available = check_cluster_available(cluster)
        print(f"  Status: {'AVAILABLE' if available else 'UNAVAILABLE'}")

        if not available:
            continue

        # Check CRDs
        print("\n  CRDs:")
        for crd in CRDS:
            result = run_kubectl([
                "get", "crd", f"{crd}s.tundra.dome"
            ], context=cluster, check=False)
            status = "INSTALLED" if result.returncode == 0 else "MISSING"
            print(f"    {crd}: {status}")

        # Check controllers
        print("\n  Controllers:")
        for deployment in ["polecat-operator", "bead-controller", "lane-controller", "openlineage-bead-bridge"]:
            result = run_kubectl([
                "get", "deployment", deployment,
                "-n", "tundra-dome", "-o", "jsonpath={.status.readyReplicas}"
            ], context=cluster, check=False)
            ready = result.stdout.strip() or "0"
            print(f"    {deployment}: {ready}/1 ready")

        # Check pods
        print("\n  Pods:")
        result = run_kubectl([
            "get", "pods", "-n", "tundra-dome",
            "-o", "custom-columns=NAME:.metadata.name,STATUS:.status.phase,RESTARTS:.status.containerStatuses[0].restartCount"
        ], context=cluster, check=False)
        if result.returncode == 0:
            for line in result.stdout.strip().split("\n")[1:]:  # Skip header
                print(f"    {line}")

    return 0


# ============================================================================
# Kafka Commands
# ============================================================================

def cmd_kafka_deploy(clusters: list[str]) -> int:
    """Deploy Kafka topics initialization job."""
    print("Deploying Kafka topics initialization...")

    kafka_init = MANIFESTS_DIR / "kafka-topics-init.yaml"
    if not kafka_init.exists():
        print(f"  [ERROR] kafka-topics-init.yaml not found at {kafka_init}")
        return 1

    for cluster in clusters:
        if not check_cluster_available(cluster):
            print(f"  [SKIP] {cluster} not available")
            continue

        print(f"\n  Cluster: {cluster}")
        result = run_kubectl(["apply", "-f", str(kafka_init)], context=cluster, check=False)
        status = "OK" if result.returncode == 0 else "FAIL"
        print(f"    [{status}] Kafka topics init job")

        if result.returncode == 0:
            # Wait for job to complete
            print("    Waiting for topics to be created...")
            result = run_kubectl([
                "wait", "--for=condition=complete", "job/kafka-topics-init",
                "-n", "tundra-dome", "--timeout=120s"
            ], context=cluster, check=False)
            status = "READY" if result.returncode == 0 else "PENDING"
            print(f"    [{status}] Topics creation")

    return 0


def cmd_kafka_delete(clusters: list[str]) -> int:
    """Delete Kafka topics initialization resources."""
    print("Removing Kafka topics initialization...")

    kafka_init = MANIFESTS_DIR / "kafka-topics-init.yaml"

    for cluster in clusters:
        if not check_cluster_available(cluster):
            print(f"  [SKIP] {cluster} not available")
            continue

        print(f"\n  Cluster: {cluster}")

        if kafka_init.exists():
            result = run_kubectl(["delete", "-f", str(kafka_init)], context=cluster, check=False)
            status = "OK" if result.returncode == 0 else "N/A"
            print(f"    [{status}] Kafka resources deleted")

    return 0


def cmd_kafka(args: argparse.Namespace) -> int:
    """Handle Kafka subcommands."""
    clusters = [args.cluster] if args.cluster else get_available_clusters()

    if args.delete:
        return cmd_kafka_delete(clusters)
    else:
        return cmd_kafka_deploy(clusters)


# ============================================================================
# Gitea Commands
# ============================================================================

def cmd_gitea_deploy(clusters: list[str]) -> int:
    """Deploy Gitea and webhook producer."""
    print("Deploying Gitea stack...")

    gitea_yaml = SCRIPT_DIR / "gitea.yaml"
    webhook_yaml = SCRIPT_DIR / "gitea-webhook-producer.yaml"

    for cluster in clusters:
        if not check_cluster_available(cluster):
            print(f"  [SKIP] {cluster} not available")
            continue

        print(f"\n  Cluster: {cluster}")

        # Deploy Gitea
        if gitea_yaml.exists():
            result = run_kubectl(["apply", "-f", str(gitea_yaml)], context=cluster, check=False)
            status = "OK" if result.returncode == 0 else "FAIL"
            print(f"    [{status}] Gitea deployment")
        else:
            print(f"    [SKIP] gitea.yaml not found")

        # Deploy webhook producer
        if webhook_yaml.exists():
            result = run_kubectl(["apply", "-f", str(webhook_yaml)], context=cluster, check=False)
            status = "OK" if result.returncode == 0 else "FAIL"
            print(f"    [{status}] Gitea webhook producer")
        else:
            print(f"    [SKIP] gitea-webhook-producer.yaml not found")

        # Wait for rollout
        print("    Waiting for rollout...")
        for deployment in ["gitea", "gitea-webhook-producer"]:
            result = run_kubectl([
                "rollout", "status", f"deployment/{deployment}",
                "-n", "tundra-dome", "--timeout=120s"
            ], context=cluster, check=False)
            status = "READY" if result.returncode == 0 else "PENDING"
            print(f"      [{status}] {deployment}")

    return 0


def cmd_gitea_delete(clusters: list[str]) -> int:
    """Delete Gitea stack."""
    print("Removing Gitea stack...")

    gitea_yaml = SCRIPT_DIR / "gitea.yaml"
    webhook_yaml = SCRIPT_DIR / "gitea-webhook-producer.yaml"

    for cluster in clusters:
        if not check_cluster_available(cluster):
            print(f"  [SKIP] {cluster} not available")
            continue

        print(f"\n  Cluster: {cluster}")

        for yaml_file, name in [(webhook_yaml, "webhook producer"), (gitea_yaml, "Gitea")]:
            if yaml_file.exists():
                result = run_kubectl(["delete", "-f", str(yaml_file)], context=cluster, check=False)
                status = "OK" if result.returncode == 0 else "N/A"
                print(f"    [{status}] {name} deleted")

    return 0


def cmd_gitea(args: argparse.Namespace) -> int:
    """Handle Gitea subcommands."""
    clusters = [args.cluster] if args.cluster else get_available_clusters()

    if args.delete:
        return cmd_gitea_delete(clusters)
    else:
        return cmd_gitea_deploy(clusters)


# ============================================================================
# Example CRs Commands
# ============================================================================

def cmd_examples_apply(clusters: list[str]) -> int:
    """Apply example Lane and Polecat CRs."""
    print("Applying example CRs...")

    for cluster in clusters:
        if not check_cluster_available(cluster):
            print(f"  [SKIP] {cluster} not available")
            continue

        print(f"\n  Cluster: {cluster}")

        for cr_file in EXAMPLE_CRS:
            cr_path = EXAMPLES_DIR / cr_file
            if cr_path.exists():
                result = run_kubectl(["apply", "-f", str(cr_path)], context=cluster, check=False)
                status = "OK" if result.returncode == 0 else "FAIL"
                print(f"    [{status}] {cr_file}")
            else:
                print(f"    [SKIP] {cr_file} not found")

    return 0


def cmd_examples_delete(clusters: list[str]) -> int:
    """Delete example CRs."""
    print("Removing example CRs...")

    for cluster in clusters:
        if not check_cluster_available(cluster):
            print(f"  [SKIP] {cluster} not available")
            continue

        print(f"\n  Cluster: {cluster}")

        for cr_file in EXAMPLE_CRS:
            cr_path = EXAMPLES_DIR / cr_file
            if cr_path.exists():
                result = run_kubectl(["delete", "-f", str(cr_path)], context=cluster, check=False)
                status = "OK" if result.returncode == 0 else "N/A"
                print(f"    [{status}] {cr_file} deleted")

    return 0


def cmd_examples(args: argparse.Namespace) -> int:
    """Handle examples subcommands."""
    clusters = [args.cluster] if args.cluster else get_available_clusters()

    if args.delete:
        return cmd_examples_delete(clusters)
    else:
        return cmd_examples_apply(clusters)


# ============================================================================
# Full Init Command (Complete Stack)
# ============================================================================

def cmd_init(args: argparse.Namespace) -> int:
    """Full Tundra Dome initialization - everything in order."""
    clusters = [args.cluster] if args.cluster else get_available_clusters()

    if not clusters:
        print("[ERROR] No clusters available")
        return 1

    print("=" * 60)
    print("  Tundra Dome Full Initialization")
    print("=" * 60)
    print()
    print(f"Target clusters: {', '.join(clusters)}")
    print()

    steps = [
        ("1/7", "Creating namespace", lambda c: create_namespace(c)),
        ("2/7", "Installing CRDs", lambda c: cmd_crds_install([c])),
        ("3/7", "Deploying Kafka topics", lambda c: cmd_kafka_deploy([c])),
        ("4/7", "Deploying Gitea stack", lambda c: cmd_gitea_deploy([c])),
        ("5/7", "Deploying controllers", lambda c: cmd_controllers_deploy([c])),
        ("6/7", "Applying example CRs", lambda c: cmd_examples_apply([c])),
        ("7/7", "Verifying deployment", lambda c: verify_deployment(c)),
    ]

    for cluster in clusters:
        print(f"\n{'=' * 60}")
        print(f"  Initializing: {cluster}")
        print("=" * 60)

        if not check_cluster_available(cluster):
            print(f"  [SKIP] Cluster not available")
            continue

        for step_num, step_name, step_func in steps:
            print(f"\n[{step_num}] {step_name}...")
            try:
                step_func(cluster)
            except Exception as e:
                print(f"  [ERROR] {e}")

    print("\n" + "=" * 60)
    print("  Initialization Complete!")
    print("=" * 60)
    print()
    print("Quick commands:")
    print("  kubectl get lanes -n tundra-dome")
    print("  kubectl get polecats -n tundra-dome")
    print("  kubectl get beads -n tundra-dome")
    print()

    return 0


def create_namespace(cluster: str) -> int:
    """Ensure tundra-dome namespace exists."""
    result = run_kubectl([
        "create", "namespace", "tundra-dome", "--dry-run=client", "-o", "yaml"
    ], context=cluster, check=False)

    if result.returncode == 0:
        apply_result = subprocess.run(
            ["kubectl", "--context", cluster, "apply", "-f", "-"],
            input=result.stdout,
            capture_output=True,
            text=True
        )
        status = "OK" if apply_result.returncode == 0 else "FAIL"
        print(f"  [{status}] Namespace tundra-dome")

    return 0


def verify_deployment(cluster: str) -> int:
    """Verify full Tundra Dome deployment."""
    print(f"\n  Cluster: {cluster}")

    # Check CRDs
    print("\n  CRDs:")
    for crd in CRDS:
        result = run_kubectl([
            "get", "crd", f"{crd}s.tundra.dome"
        ], context=cluster, check=False)
        status = "OK" if result.returncode == 0 else "MISSING"
        print(f"    [{status}] {crd}s.tundra.dome")

    # Check controllers
    print("\n  Controllers:")
    for deployment in ["polecat-operator", "bead-controller", "lane-controller", "openlineage-bead-bridge"]:
        result = run_kubectl([
            "get", "deployment", deployment,
            "-n", "tundra-dome", "-o", "jsonpath={.status.readyReplicas}"
        ], context=cluster, check=False)
        ready = result.stdout.strip() or "0"
        status = "OK" if ready != "0" else "PENDING"
        print(f"    [{status}] {deployment}: {ready}/1 ready")

    # Check Gitea stack
    print("\n  Gitea Stack:")
    for deployment in ["gitea", "gitea-webhook-producer"]:
        result = run_kubectl([
            "get", "deployment", deployment,
            "-n", "tundra-dome", "-o", "jsonpath={.status.readyReplicas}"
        ], context=cluster, check=False)
        ready = result.stdout.strip() or "0"
        status = "OK" if ready != "0" else "PENDING"
        print(f"    [{status}] {deployment}: {ready}/1 ready")

    # Check Lanes
    print("\n  Lanes:")
    result = run_kubectl([
        "get", "lanes", "-n", "tundra-dome",
        "-o", "custom-columns=NAME:.metadata.name,PRIORITY:.spec.priority,TOPIC:.spec.kafkaTopic"
    ], context=cluster, check=False)
    if result.returncode == 0 and result.stdout.strip():
        for line in result.stdout.strip().split("\n")[1:]:
            print(f"    {line}")
    else:
        print("    [NONE]")

    # Check Polecats
    print("\n  Polecats:")
    result = run_kubectl([
        "get", "polecats", "-n", "tundra-dome",
        "-o", "custom-columns=NAME:.metadata.name,ROLE:.spec.role,REPLICAS:.spec.replicas"
    ], context=cluster, check=False)
    if result.returncode == 0 and result.stdout.strip():
        for line in result.stdout.strip().split("\n")[1:]:
            print(f"    {line}")
    else:
        print("    [NONE]")

    return 0


# ============================================================================
# Full Deploy Command
# ============================================================================

def cmd_deploy(args: argparse.Namespace) -> int:
    """Full stack deployment."""
    clusters = [args.cluster] if args.cluster else get_available_clusters()

    print("Tundra Dome Full Stack Deploy")
    print("=" * 60)

    # Install CRDs
    print("\n[1/3] Installing CRDs...")
    cmd_crds_install(clusters)

    # Deploy controllers
    print("\n[2/3] Deploying controllers...")
    cmd_controllers_deploy(clusters)

    # Status check
    print("\n[3/3] Verifying deployment...")
    args.cluster = None  # Reset for status
    cmd_status(args)

    return 0


# ============================================================================
# Interactive TUI Mode
# ============================================================================

def tui_menu() -> int:
    """Interactive TUI menu."""
    print("\n" + "=" * 60)
    print("  Tundra Dome Management")
    print("=" * 60)
    print()
    print("  Stack Setup:")
    print("    1. Full Init (complete stack)")
    print("    2. Full Stack Deploy (CRDs + controllers)")
    print()
    print("  Components:")
    print("    3. Install CRDs")
    print("    4. Deploy Controllers")
    print("    5. Deploy Kafka Topics")
    print("    6. Deploy Gitea Stack")
    print("    7. Apply Example CRs")
    print()
    print("  Cleanup:")
    print("    8. Delete CRDs")
    print("    9. Delete Controllers")
    print()
    print("  Status:")
    print("    s. Check Status")
    print("    q. Exit")
    print()

    while True:
        try:
            choice = input("Select option: ").strip().lower()

            # Create namespace for args
            args = argparse.Namespace(cluster=None, delete=False)
            clusters = get_available_clusters()

            match choice:
                case "1":
                    return cmd_init(args)
                case "2":
                    return cmd_deploy(args)
                case "3":
                    return cmd_crds_install(clusters)
                case "4":
                    return cmd_controllers_deploy(clusters)
                case "5":
                    return cmd_kafka_deploy(clusters)
                case "6":
                    return cmd_gitea_deploy(clusters)
                case "7":
                    return cmd_examples_apply(clusters)
                case "8":
                    return cmd_crds_delete(clusters)
                case "9":
                    return cmd_controllers_delete(clusters)
                case "s" | "status":
                    return cmd_status(args)
                case "q" | "exit" | "quit":
                    print("Goodbye!")
                    return 0
                case _:
                    print("Invalid option. Enter 1-9, s, or q.")
        except KeyboardInterrupt:
            print("\nGoodbye!")
            return 0


# ============================================================================
# Main Entry Point
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Tundra Dome CLI - Manage KIND cluster deployments",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    %(prog)s crds --install
    %(prog)s crds --delete --cluster kind-tundra-dome
    %(prog)s controllers --deploy
    %(prog)s status
    %(prog)s deploy
    %(prog)s  # Interactive TUI mode
        """
    )

    parser.add_argument("--cluster", "-c", help="Target specific cluster")

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # CRDs subcommand
    crds_parser = subparsers.add_parser("crds", help="Manage CRDs")
    crds_parser.add_argument("--install", "-i", action="store_true", default=True, help="Install CRDs (default)")
    crds_parser.add_argument("--delete", "-d", action="store_true", help="Delete CRDs")
    crds_parser.add_argument("--cluster", "-c", help="Target specific cluster")

    # Controllers subcommand
    ctrl_parser = subparsers.add_parser("controllers", help="Manage controllers")
    ctrl_parser.add_argument("--deploy", action="store_true", default=True, help="Deploy controllers (default)")
    ctrl_parser.add_argument("--delete", "-d", action="store_true", help="Delete controllers")
    ctrl_parser.add_argument("--cluster", "-c", help="Target specific cluster")

    # Status subcommand
    status_parser = subparsers.add_parser("status", help="Check cluster status")
    status_parser.add_argument("--cluster", "-c", help="Target specific cluster")

    # Deploy subcommand
    deploy_parser = subparsers.add_parser("deploy", help="Full stack deployment")
    deploy_parser.add_argument("--cluster", "-c", help="Target specific cluster")

    # Init subcommand (complete initialization)
    init_parser = subparsers.add_parser("init", help="Full initialization (namespace, CRDs, Kafka, Gitea, controllers, examples)")
    init_parser.add_argument("--cluster", "-c", help="Target specific cluster")

    # Kafka subcommand
    kafka_parser = subparsers.add_parser("kafka", help="Manage Kafka topics")
    kafka_parser.add_argument("--deploy", action="store_true", default=True, help="Deploy Kafka topics init (default)")
    kafka_parser.add_argument("--delete", "-d", action="store_true", help="Delete Kafka resources")
    kafka_parser.add_argument("--cluster", "-c", help="Target specific cluster")

    # Gitea subcommand
    gitea_parser = subparsers.add_parser("gitea", help="Manage Gitea stack")
    gitea_parser.add_argument("--deploy", action="store_true", default=True, help="Deploy Gitea stack (default)")
    gitea_parser.add_argument("--delete", "-d", action="store_true", help="Delete Gitea stack")
    gitea_parser.add_argument("--cluster", "-c", help="Target specific cluster")

    # Examples subcommand
    examples_parser = subparsers.add_parser("examples", help="Manage example CRs")
    examples_parser.add_argument("--apply", action="store_true", default=True, help="Apply example CRs (default)")
    examples_parser.add_argument("--delete", "-d", action="store_true", help="Delete example CRs")
    examples_parser.add_argument("--cluster", "-c", help="Target specific cluster")

    args = parser.parse_args()

    # If no command, run TUI
    if not args.command:
        return tui_menu()

    # Route to command handler
    match args.command:
        case "crds":
            return cmd_crds(args)
        case "controllers":
            return cmd_controllers(args)
        case "status":
            return cmd_status(args)
        case "deploy":
            return cmd_deploy(args)
        case "init":
            return cmd_init(args)
        case "kafka":
            return cmd_kafka(args)
        case "gitea":
            return cmd_gitea(args)
        case "examples":
            return cmd_examples(args)
        case _:
            parser.print_help()
            return 1


if __name__ == "__main__":
    sys.exit(main())
