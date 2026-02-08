#!/usr/bin/env python3
"""
Tundra Dome Master Orchestrator

Manages all Tundra Dome KIND clusters from a single script.
Reads cluster definitions from clusters/registry.yaml and
orchestrates bootstrap, deploy, sync, and status operations.

Usage:
    ./tundra-master.py bootstrap --all              # Bootstrap all clusters
    ./tundra-master.py bootstrap --cluster gastown  # Bootstrap specific cluster
    ./tundra-master.py status                       # Status of all clusters
    ./tundra-master.py sync                         # Sync state across clusters
    ./tundra-master.py clean --all                  # Tear down all clusters
"""

import argparse
import concurrent.futures
import json
import os
import subprocess
import sys
import time
import yaml
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

SCRIPT_DIR = Path(__file__).parent.resolve()
CLUSTERS_DIR = SCRIPT_DIR / "clusters"
REGISTRY_FILE = CLUSTERS_DIR / "registry.yaml"


# Colors for output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


def log(msg: str, level: str = "info", cluster: str = None):
    """Print colored log message."""
    colors = {
        "info": Colors.CYAN,
        "success": Colors.GREEN,
        "warning": Colors.WARNING,
        "error": Colors.FAIL,
        "header": Colors.HEADER + Colors.BOLD,
    }
    color = colors.get(level, "")
    prefix = f"[{cluster}] " if cluster else ""
    print(f"{color}{prefix}{msg}{Colors.ENDC}")


@dataclass
class ClusterConfig:
    """Configuration for a single cluster."""
    name: str
    context: str
    description: str
    kind_config: str
    role: str
    workloads: list
    resources: dict
    nodes: dict
    ports: dict
    lanes: dict
    polecats: list
    kafka: dict
    airflow: dict
    gitea: dict
    datadog: dict
    federation: dict


def load_registry() -> dict:
    """Load the cluster registry."""
    if not REGISTRY_FILE.exists():
        log(f"Registry file not found: {REGISTRY_FILE}", "error")
        sys.exit(1)

    with open(REGISTRY_FILE) as f:
        return yaml.safe_load(f)


def get_cluster_config(registry: dict, cluster_name: str) -> ClusterConfig:
    """Get configuration for a specific cluster, merging with defaults."""
    defaults = registry.get("defaults", {})
    cluster = registry["clusters"].get(cluster_name)

    if not cluster:
        raise ValueError(f"Unknown cluster: {cluster_name}")

    # Merge defaults with cluster-specific config
    def merge(default, override):
        if isinstance(default, dict) and isinstance(override, dict):
            result = default.copy()
            result.update(override)
            return result
        return override if override is not None else default

    return ClusterConfig(
        name=cluster_name,
        context=cluster.get("context", f"kind-{cluster_name}"),
        description=cluster.get("description", ""),
        kind_config=cluster.get("kind_config", "kind-config.yaml"),
        role=cluster.get("role", "secondary"),
        workloads=cluster.get("workloads", []),
        resources=cluster.get("resources", {}),
        nodes=cluster.get("nodes", {"control_plane": 1, "workers": 1}),
        ports=cluster.get("ports", {}),
        lanes=cluster.get("lanes", {}),
        polecats=cluster.get("polecats", []),
        kafka=merge(defaults.get("kafka", {}), cluster.get("kafka", {})),
        airflow=merge(defaults.get("airflow", {}), cluster.get("airflow", {})),
        gitea=merge(defaults.get("gitea", {}), cluster.get("gitea", {})),
        datadog=merge(defaults.get("datadog", {}), cluster.get("datadog", {})),
        federation=merge(defaults.get("federation", {}), cluster.get("federation", {})),
    )


def run(cmd: list[str], check: bool = True, capture: bool = True) -> subprocess.CompletedProcess:
    """Run a command."""
    result = subprocess.run(cmd, capture_output=capture, text=True)
    if check and result.returncode != 0:
        raise subprocess.CalledProcessError(result.returncode, cmd, result.stdout, result.stderr)
    return result


def cluster_exists(cluster_name: str) -> bool:
    """Check if a KIND cluster exists."""
    result = run(["kind", "get", "clusters"], check=False)
    return cluster_name in result.stdout


def create_cluster(config: ClusterConfig) -> bool:
    """Create a KIND cluster."""
    cluster_name = config.name
    log(f"Creating cluster...", "header", cluster_name)

    if cluster_exists(cluster_name):
        log(f"Cluster already exists", "warning", cluster_name)
        return True

    # Find kind config
    kind_config = SCRIPT_DIR / config.kind_config
    if not kind_config.exists():
        # Try cluster-specific directory
        kind_config = CLUSTERS_DIR / config.name / "kind-config.yaml"

    if not kind_config.exists():
        log(f"KIND config not found: {kind_config}", "error", cluster_name)
        return False

    try:
        run(["kind", "create", "cluster", "--config", str(kind_config)], capture=False)
        log(f"Cluster created!", "success", cluster_name)

        # Wait for cluster to be ready
        log("Waiting for cluster to be ready...", "info", cluster_name)
        for _ in range(30):
            result = run(["kubectl", "--context", config.context, "get", "nodes"], check=False)
            if result.returncode == 0 and "Ready" in result.stdout:
                break
            time.sleep(2)

        return True

    except subprocess.CalledProcessError as e:
        log(f"Failed to create cluster: {e}", "error", cluster_name)
        return False


def delete_cluster(config: ClusterConfig) -> bool:
    """Delete a KIND cluster."""
    cluster_name = config.name
    log(f"Deleting cluster...", "header", cluster_name)

    if not cluster_exists(cluster_name):
        log(f"Cluster does not exist", "warning", cluster_name)
        return True

    try:
        run(["kind", "delete", "cluster", "--name", cluster_name], capture=False)
        log(f"Cluster deleted!", "success", cluster_name)
        return True
    except subprocess.CalledProcessError as e:
        log(f"Failed to delete cluster: {e}", "error", cluster_name)
        return False


def deploy_to_cluster(config: ClusterConfig) -> bool:
    """Deploy Tundra Dome stack to a cluster."""
    cluster_name = config.name
    context = config.context

    log(f"Deploying Tundra Dome stack...", "header", cluster_name)

    # Use tundra-cli.py for deployment
    try:
        result = run([
            sys.executable, str(SCRIPT_DIR / "tundra-cli.py"),
            "init", "--cluster", context
        ], capture=False)
        return result.returncode == 0
    except subprocess.CalledProcessError as e:
        log(f"Deployment failed: {e}", "error", cluster_name)
        return False


def get_cluster_status(config: ClusterConfig) -> dict:
    """Get status of a cluster."""
    cluster_name = config.name
    context = config.context

    status = {
        "name": cluster_name,
        "context": context,
        "role": config.role,
        "exists": cluster_exists(cluster_name),
        "healthy": False,
        "components": {},
    }

    if not status["exists"]:
        return status

    # Check namespace
    result = run(["kubectl", "--context", context, "get", "namespace", "tundra-dome"], check=False)
    status["components"]["namespace"] = result.returncode == 0

    # Check CRDs
    result = run(["kubectl", "--context", context, "get", "crd", "beads.tundra.dome"], check=False)
    status["components"]["crds"] = result.returncode == 0

    # Check key deployments
    deployments = ["kafka", "airflow-webserver", "polecat-operator", "bead-controller"]
    for deploy in deployments:
        result = run([
            "kubectl", "--context", context,
            "get", "deployment", deploy, "-n", "tundra-dome",
            "-o", "jsonpath={.status.readyReplicas}"
        ], check=False)
        ready = result.stdout.strip() if result.returncode == 0 else "0"
        status["components"][deploy] = ready != "" and ready != "0"

    # Check lanes
    result = run([
        "kubectl", "--context", context,
        "get", "lanes", "-n", "tundra-dome", "-o", "json"
    ], check=False)
    if result.returncode == 0:
        lanes = json.loads(result.stdout)
        status["lanes"] = len(lanes.get("items", []))
    else:
        status["lanes"] = 0

    # Check polecats
    result = run([
        "kubectl", "--context", context,
        "get", "polecats", "-n", "tundra-dome", "-o", "json"
    ], check=False)
    if result.returncode == 0:
        polecats = json.loads(result.stdout)
        status["polecats"] = len(polecats.get("items", []))
    else:
        status["polecats"] = 0

    # Check beads
    result = run([
        "kubectl", "--context", context,
        "get", "beads", "-n", "tundra-dome", "-o", "json"
    ], check=False)
    if result.returncode == 0:
        beads = json.loads(result.stdout)
        status["beads"] = len(beads.get("items", []))
    else:
        status["beads"] = 0

    # Overall health
    status["healthy"] = all(status["components"].values())

    return status


def print_status_table(statuses: list[dict]):
    """Print a status table for all clusters."""
    print("\n" + "=" * 80)
    print(f"{'Cluster':<20} {'Role':<10} {'Status':<10} {'Lanes':<6} {'Polecats':<9} {'Beads':<6}")
    print("=" * 80)

    for s in statuses:
        if not s["exists"]:
            status = f"{Colors.WARNING}NOT FOUND{Colors.ENDC}"
        elif s["healthy"]:
            status = f"{Colors.GREEN}HEALTHY{Colors.ENDC}"
        else:
            status = f"{Colors.FAIL}DEGRADED{Colors.ENDC}"

        print(f"{s['name']:<20} {s['role']:<10} {status:<19} {s.get('lanes', '-'):<6} {s.get('polecats', '-'):<9} {s.get('beads', '-'):<6}")

    print("=" * 80)


def cmd_bootstrap(args, registry: dict) -> int:
    """Bootstrap clusters."""
    clusters = list(registry["clusters"].keys()) if args.all else [args.cluster]

    log("\n" + "=" * 60, "header")
    log("  Tundra Dome Multi-Cluster Bootstrap", "header")
    log("=" * 60 + "\n", "header")

    success = True

    for cluster_name in clusters:
        try:
            config = get_cluster_config(registry, cluster_name)

            if not create_cluster(config):
                success = False
                continue

            if not deploy_to_cluster(config):
                success = False

        except Exception as e:
            log(f"Error bootstrapping {cluster_name}: {e}", "error")
            success = False

    return 0 if success else 1


def cmd_deploy(args, registry: dict) -> int:
    """Deploy to existing clusters."""
    clusters = list(registry["clusters"].keys()) if args.all else [args.cluster]

    for cluster_name in clusters:
        try:
            config = get_cluster_config(registry, cluster_name)

            if not cluster_exists(cluster_name):
                log(f"Cluster does not exist, skipping", "warning", cluster_name)
                continue

            deploy_to_cluster(config)

        except Exception as e:
            log(f"Error deploying to {cluster_name}: {e}", "error")

    return 0


def cmd_status(args, registry: dict) -> int:
    """Show status of all clusters."""
    clusters = list(registry["clusters"].keys()) if args.all else [args.cluster] if args.cluster else list(registry["clusters"].keys())

    statuses = []
    for cluster_name in clusters:
        try:
            config = get_cluster_config(registry, cluster_name)
            status = get_cluster_status(config)
            statuses.append(status)
        except Exception as e:
            log(f"Error getting status for {cluster_name}: {e}", "error")

    print_status_table(statuses)

    # Detailed component status if requested
    if args.verbose:
        for status in statuses:
            if status["exists"]:
                print(f"\n{status['name']} Components:")
                for comp, ok in status.get("components", {}).items():
                    mark = f"{Colors.GREEN}✓{Colors.ENDC}" if ok else f"{Colors.FAIL}✗{Colors.ENDC}"
                    print(f"  {mark} {comp}")

    return 0


def cmd_clean(args, registry: dict) -> int:
    """Clean up clusters."""
    clusters = list(registry["clusters"].keys()) if args.all else [args.cluster]

    for cluster_name in clusters:
        try:
            config = get_cluster_config(registry, cluster_name)
            delete_cluster(config)
        except Exception as e:
            log(f"Error deleting {cluster_name}: {e}", "error")

    return 0


def cmd_sync(args, registry: dict) -> int:
    """Sync state across clusters."""
    log("Syncing state across clusters...", "header")

    # Get status of all clusters
    statuses = []
    for cluster_name in registry["clusters"].keys():
        config = get_cluster_config(registry, cluster_name)
        status = get_cluster_status(config)
        if status["exists"] and status["healthy"]:
            statuses.append((cluster_name, config, status))

    log(f"Found {len(statuses)} healthy clusters", "info")

    # Get beads from each cluster
    all_beads = {}
    for cluster_name, config, status in statuses:
        result = run([
            "kubectl", "--context", config.context,
            "get", "beads", "-n", "tundra-dome", "-o", "json"
        ], check=False)

        if result.returncode == 0:
            beads = json.loads(result.stdout)
            for bead in beads.get("items", []):
                bead_id = bead["metadata"]["name"]
                all_beads[bead_id] = {
                    "cluster": cluster_name,
                    "bead": bead,
                }

    log(f"Found {len(all_beads)} beads across all clusters", "info")

    # TODO: Implement actual sync logic based on federation config
    # For now, just report what would be synced

    federation_config = registry.get("federation", {})
    routing_rules = federation_config.get("routing", [])

    for bead_id, bead_info in all_beads.items():
        source_cluster = bead_info["cluster"]
        bead = bead_info["bead"]
        labels = bead.get("metadata", {}).get("labels", {})

        # Find target cluster based on routing rules
        target_cluster = None
        for rule in routing_rules:
            match = rule.get("match", {})
            match_labels = match.get("labels", {})

            if all(labels.get(k) == v for k, v in match_labels.items()):
                target_clusters = rule.get("target_clusters", [])
                if target_clusters:
                    target_cluster = target_clusters[0]
                    break

        if target_cluster and target_cluster != source_cluster:
            log(f"Bead {bead_id}: {source_cluster} -> {target_cluster}", "info")

    return 0


def main():
    parser = argparse.ArgumentParser(
        description="Tundra Dome Master Orchestrator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Bootstrap command
    bootstrap_parser = subparsers.add_parser("bootstrap", help="Bootstrap clusters")
    bootstrap_parser.add_argument("--all", "-a", action="store_true", help="Bootstrap all clusters")
    bootstrap_parser.add_argument("--cluster", "-c", help="Bootstrap specific cluster")
    bootstrap_parser.add_argument("--parallel", "-p", action="store_true", help="Run in parallel")

    # Deploy command
    deploy_parser = subparsers.add_parser("deploy", help="Deploy to existing clusters")
    deploy_parser.add_argument("--all", "-a", action="store_true", help="Deploy to all clusters")
    deploy_parser.add_argument("--cluster", "-c", help="Deploy to specific cluster")

    # Status command
    status_parser = subparsers.add_parser("status", help="Show cluster status")
    status_parser.add_argument("--all", "-a", action="store_true", default=True, help="Show all clusters")
    status_parser.add_argument("--cluster", "-c", help="Show specific cluster")
    status_parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed status")

    # Clean command
    clean_parser = subparsers.add_parser("clean", help="Clean up clusters")
    clean_parser.add_argument("--all", "-a", action="store_true", help="Clean all clusters")
    clean_parser.add_argument("--cluster", "-c", help="Clean specific cluster")

    # Sync command
    sync_parser = subparsers.add_parser("sync", help="Sync state across clusters")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    # Load registry
    registry = load_registry()

    # Route to command handler
    if args.command == "bootstrap":
        if not args.all and not args.cluster:
            log("Specify --all or --cluster", "error")
            return 1
        return cmd_bootstrap(args, registry)

    elif args.command == "deploy":
        if not args.all and not args.cluster:
            log("Specify --all or --cluster", "error")
            return 1
        return cmd_deploy(args, registry)

    elif args.command == "status":
        return cmd_status(args, registry)

    elif args.command == "clean":
        if not args.all and not args.cluster:
            log("Specify --all or --cluster", "error")
            return 1
        return cmd_clean(args, registry)

    elif args.command == "sync":
        return cmd_sync(args, registry)

    return 0


if __name__ == "__main__":
    sys.exit(main())
