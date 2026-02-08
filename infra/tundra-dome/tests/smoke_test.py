#!/usr/bin/env python3
"""
Tundra Dome Smoke Tests

Verifies that the basic deployment is working correctly.
"""

import argparse
import json
import subprocess
import sys
import time


def run_kubectl(cmd: str, context: str, check: bool = True) -> tuple[int, str, str]:
    """Run a kubectl command and return (returncode, stdout, stderr)."""
    full_cmd = f"kubectl --context {context} {cmd}"
    result = subprocess.run(
        full_cmd.split(),
        capture_output=True,
        text=True
    )
    return result.returncode, result.stdout, result.stderr


def test_namespace(context: str) -> bool:
    """Test that namespace exists."""
    code, out, _ = run_kubectl("get namespace tundra-dome", context)
    return code == 0


def test_crds(context: str) -> bool:
    """Test that CRDs are installed."""
    crds = ["beads", "polecats", "lanes", "playbooks", "stations", "errands"]
    for crd in crds:
        code, _, _ = run_kubectl(f"get crd {crd}.tundra.dome", context)
        if code != 0:
            print(f"  [FAIL] CRD {crd} not found")
            return False
    return True


def test_kafka(context: str) -> bool:
    """Test that Kafka is running."""
    code, out, _ = run_kubectl(
        "get pods -n tundra-dome -l app=kafka -o jsonpath={.items[0].status.phase}",
        context
    )
    return code == 0 and "Running" in out


def test_controllers(context: str) -> bool:
    """Test that controllers are running."""
    controllers = ["polecat-operator", "bead-controller", "lane-controller"]
    for ctrl in controllers:
        code, out, _ = run_kubectl(
            f"get deployment {ctrl} -n tundra-dome -o jsonpath={{.status.readyReplicas}}",
            context
        )
        if code != 0 or not out.strip() or out.strip() == "0":
            print(f"  [FAIL] Controller {ctrl} not ready")
            return False
    return True


def test_lanes(context: str) -> bool:
    """Test that lanes are created."""
    code, out, _ = run_kubectl("get lanes -n tundra-dome -o json", context)
    if code != 0:
        return False

    lanes = json.loads(out)
    if not lanes.get("items"):
        print("  [FAIL] No lanes found")
        return False

    expected = {"critical", "standard", "experimental"}
    found = {lane["metadata"]["name"] for lane in lanes["items"]}

    if not expected.issubset(found):
        print(f"  [FAIL] Missing lanes: {expected - found}")
        return False

    return True


def test_polecats(context: str) -> bool:
    """Test that polecats are created."""
    code, out, _ = run_kubectl("get polecats -n tundra-dome -o json", context)
    if code != 0:
        return False

    polecats = json.loads(out)
    if not polecats.get("items"):
        print("  [FAIL] No polecats found")
        return False

    return True


def test_create_bead(context: str) -> bool:
    """Test creating a bead."""
    bead_yaml = """
apiVersion: tundra.dome/v1
kind: Bead
metadata:
  name: smoke-test-bead
  namespace: tundra-dome
spec:
  lane: standard
  source: smoke-test
  type: test
  payload:
    message: "Smoke test bead"
"""
    # Create bead
    result = subprocess.run(
        ["kubectl", "--context", context, "apply", "-f", "-"],
        input=bead_yaml,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print(f"  [FAIL] Could not create bead: {result.stderr}")
        return False

    # Verify it exists
    code, out, _ = run_kubectl(
        "get bead smoke-test-bead -n tundra-dome",
        context
    )

    if code != 0:
        print("  [FAIL] Bead not found after creation")
        return False

    # Clean up
    run_kubectl("delete bead smoke-test-bead -n tundra-dome", context, check=False)

    return True


def test_airflow(context: str) -> bool:
    """Test that Airflow is running."""
    code, out, _ = run_kubectl(
        "get deployment airflow-webserver -n tundra-dome -o jsonpath={.status.readyReplicas}",
        context
    )
    return code == 0 and out.strip() and out.strip() != "0"


def test_gitea(context: str) -> bool:
    """Test that Gitea is running."""
    code, out, _ = run_kubectl(
        "get deployment gitea -n tundra-dome -o jsonpath={.status.readyReplicas}",
        context
    )
    return code == 0 and out.strip() and out.strip() != "0"


def run_tests(context: str) -> int:
    """Run all smoke tests."""
    tests = [
        ("Namespace exists", test_namespace),
        ("CRDs installed", test_crds),
        ("Kafka running", test_kafka),
        ("Controllers running", test_controllers),
        ("Lanes created", test_lanes),
        ("Polecats created", test_polecats),
        ("Bead creation", test_create_bead),
        ("Airflow running", test_airflow),
        ("Gitea running", test_gitea),
    ]

    print("=" * 60)
    print("  Tundra Dome Smoke Tests")
    print("=" * 60)
    print(f"\nCluster: {context}\n")

    passed = 0
    failed = 0

    for name, test_func in tests:
        try:
            result = test_func(context)
            status = "PASS" if result else "FAIL"
            color = "\033[92m" if result else "\033[91m"
            print(f"  [{color}{status}\033[0m] {name}")

            if result:
                passed += 1
            else:
                failed += 1

        except Exception as e:
            print(f"  [\033[91mFAIL\033[0m] {name}: {e}")
            failed += 1

    print("\n" + "=" * 60)
    print(f"  Results: {passed} passed, {failed} failed")
    print("=" * 60)

    return 0 if failed == 0 else 1


def main():
    parser = argparse.ArgumentParser(description="Tundra Dome Smoke Tests")
    parser.add_argument(
        "--context", "-c",
        default="kind-tundra-dome",
        help="Kubernetes context to use"
    )

    args = parser.parse_args()
    return run_tests(args.context)


if __name__ == "__main__":
    sys.exit(main())
