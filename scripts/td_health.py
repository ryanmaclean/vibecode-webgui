#!/usr/bin/env python3
import subprocess
import sys

DEFAULT_CONTEXTS = ["kind-tundra-dome", "kind-vibecode-local"]


def run(cmd: list[str]) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return result.stderr.strip() or result.stdout.strip()
    return result.stdout.strip()


def print_header(title: str):
    print(title)
    print("-" * len(title))


def main():
    contexts = sys.argv[1:] or DEFAULT_CONTEXTS
    for ctx in contexts:
        print_header(f"Cluster: {ctx}")

        # Pods
        print("Pods (all namespaces):")
        pods = run(["kubectl", "--context", ctx, "get", "pods", "-A"])
        print(pods if pods else "(none)")
        print()

        # Kafka topics
        print("Kafka topics:")
        kafka_cmd = [
            "kubectl",
            "--context",
            ctx,
            "-n",
            "tundra-dome",
            "exec",
            "deploy/kafka",
            "--",
            "/opt/kafka/bin/kafka-topics.sh",
            "--bootstrap-server",
            "localhost:9092",
            "--list",
        ]
        topics = run(kafka_cmd)
        print(topics if topics else "(none)")
        print("\n")


if __name__ == "__main__":
    main()
