#!/usr/bin/env python3
"""
VibeCode Health Check Verification Script

This script verifies the health check endpoints of the VibeCode application.
It supports checking both public endpoints and direct pod access via port-forward.
"""


# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass

import argparse
import json
import subprocess
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any


class HealthChecker:
    """
    Health checker for VibeCode application.
    """

    def __init__(
        self,
        base_url: str = "https://vibecode.eastus2.cloudapp.azure.com",
        namespace: str = "vibecode-platform",
        app_label: str = "app=vibecode-app",
        local_port: int = 8080,
        timeout: int = 5,
        retries: int = 3,
        verbose: bool = True,
        k8s_mode: bool = False,
    ):
        self.base_url = base_url
        self.namespace = namespace
        self.app_label = app_label
        self.local_port = local_port
        self.timeout = timeout
        self.retries = retries
        self.verbose = verbose
        self.k8s_mode = k8s_mode
        self.endpoints = ["/api/health", "/api/healthz", "/api/readyz"]
        self.port_forward_process = None

    def log(self, message: str, level: str = "info", end: str = "\n") -> None:
        """Log a message with color."""
        colors = {
            "info": "\033[0;34m",  # Blue
            "success": "\033[0;32m",  # Green
            "warning": "\033[0;33m",  # Yellow
            "error": "\033[0;31m",  # Red
            "reset": "\033[0m",
        }
        
        prefix = {
            "info": "INFO",
            "success": "✅",
            "warning": "⚠️",
            "error": "❌",
        }
        
        if level in colors:
            sys.stdout.write(
                f"{colors[level]}{prefix.get(level, '')} {message}{colors['reset']}{end}"
            )
            sys.stdout.flush()
        else:
            print(message, end=end)

    def check_k8s_connectivity(self) -> bool:
        """Check if kubectl can connect to the cluster."""
        try:
            result = subprocess.run(
                ["kubectl", "cluster-info"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            return result.returncode == 0
        except Exception:
            return False

    def get_pods(self) -> List[str]:
        """Get a list of pod names matching the app label."""
        try:
            result = subprocess.run(
                [
                    "kubectl",
                    "get",
                    "pods",
                    "-n",
                    self.namespace,
                    "-l",
                    self.app_label,
                    "-o",
                    "jsonpath={.items[*].metadata.name}",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
                text=True,
            )
            return result.stdout.strip().split()
        except subprocess.CalledProcessError as e:
            self.log(f"Error getting pods: {e}", "error")
            return []

    def start_port_forward(self, pod_name: str, container_port: int = 3000) -> bool:
        """Start port-forwarding to a pod."""
        try:
            self.port_forward_process = subprocess.Popen(
                [
                    "kubectl",
                    "port-forward",
                    "-n",
                    self.namespace,
                    pod_name,
                    f"{self.local_port}:{container_port}",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            # Wait for port-forward to establish
            time.sleep(2)
            return True
        except Exception as e:
            self.log(f"Error starting port-forward: {e}", "error")
            return False

    def stop_port_forward(self) -> None:
        """Stop the port-forwarding process."""
        if self.port_forward_process:
            self.port_forward_process.terminate()
            self.port_forward_process = None

    def http_get(self, url: str, timeout: int) -> Tuple[int, Dict[str, Any]]:
        """Make HTTP GET request and return status code and response data."""
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=timeout) as response:
                status_code = response.getcode()
                content = response.read().decode('utf-8')
                try:
                    response_data = json.loads(content)
                except json.JSONDecodeError:
                    response_data = {"text": content}
                return status_code, response_data
        except urllib.error.HTTPError as e:
            try:
                content = e.read().decode('utf-8')
                try:
                    response_data = json.loads(content)
                except json.JSONDecodeError:
                    response_data = {"text": content}
                return e.code, response_data
            except Exception:
                return e.code, {"error": str(e)}
        except urllib.error.URLError as e:
            return 0, {"error": str(e.reason)}
        except Exception as e:
            return 0, {"error": str(e)}

    def check_endpoint(self, endpoint: str, description: str = "Endpoint") -> Tuple[bool, Dict[str, Any]]:
        """Check a health endpoint and return success status and response."""
        url = (
            f"http://localhost:{self.local_port}{endpoint}"
            if self.k8s_mode
            else f"{self.base_url}{endpoint}"
        )
        
        self.log(f"Testing {description}: {endpoint}", "info")
        
        start_time = time.time()
        success = False
        response_data = {}
        status_code = 0
        
        for attempt in range(1, self.retries + 1):
            if attempt > 1:
                self.log(f"Retry {attempt-1} of {self.retries}...", "warning")
            
            status_code, response_data = self.http_get(url, self.timeout)
            
            if 200 <= status_code < 300:
                success = True
                break
        
        end_time = time.time()
        time_taken = int((end_time - start_time) * 1000)
        
        if success:
            self.log(f"Success ({status_code}) - {time_taken}ms", "success")
            
            if self.verbose:
                self.log("Response:", "info")
                print(json.dumps(response_data, indent=2))
                
            # Check health status in response
            if response_data.get("status") in ["healthy", "ready"]:
                self.log("Service reports healthy/ready", "success")
            elif response_data.get("status") in ["unhealthy", "not ready"]:
                self.log("Service reports unhealthy/not ready", "error")
                success = False
        else:
            self.log(f"Failed ({status_code}) - {time_taken}ms", "error")
            if self.verbose and response_data:
                self.log("Response:", "info")
                print(json.dumps(response_data, indent=2))
        
        return success, response_data

    def check_probe_configuration(self, pod_name: str) -> bool:
        """Check if liveness and readiness probes are configured correctly."""
        self.log("Checking configured probes in Kubernetes:", "info")
        
        # Check liveness probe
        try:
            result = subprocess.run(
                [
                    "kubectl",
                    "get",
                    "pod",
                    pod_name,
                    "-n",
                    self.namespace,
                    "-o",
                    "jsonpath={.spec.containers[0].livenessProbe}",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
                text=True,
            )
            if result.stdout:
                self.log("Liveness probe configured", "success")
                if self.verbose:
                    try:
                        probe_config = json.loads(result.stdout)
                        print(json.dumps(probe_config, indent=2))
                    except json.JSONDecodeError:
                        print(result.stdout)
            else:
                self.log("No liveness probe configured", "error")
                return False
        except subprocess.CalledProcessError:
            self.log("Failed to get liveness probe configuration", "error")
            return False
        
        # Check readiness probe
        try:
            result = subprocess.run(
                [
                    "kubectl",
                    "get",
                    "pod",
                    pod_name,
                    "-n",
                    self.namespace,
                    "-o",
                    "jsonpath={.spec.containers[0].readinessProbe}",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
                text=True,
            )
            if result.stdout:
                self.log("Readiness probe configured", "success")
                if self.verbose:
                    try:
                        probe_config = json.loads(result.stdout)
                        print(json.dumps(probe_config, indent=2))
                    except json.JSONDecodeError:
                        print(result.stdout)
            else:
                self.log("No readiness probe configured", "error")
                return False
        except subprocess.CalledProcessError:
            self.log("Failed to get readiness probe configuration", "error")
            return False
        
        return True

    def check_pod(self, pod_name: str) -> bool:
        """Check health endpoints for a specific pod."""
        self.log(f"Testing pod: {pod_name}", "info")
        
        # Check if pod is running
        try:
            result = subprocess.run(
                [
                    "kubectl",
                    "get",
                    "pod",
                    pod_name,
                    "-n",
                    self.namespace,
                    "-o",
                    "jsonpath={.status.phase}",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
                text=True,
            )
            if result.stdout != "Running":
                self.log(f"Pod is not running (Status: {result.stdout}). Skipping...", "error")
                return False
        except subprocess.CalledProcessError:
            self.log("Failed to get pod status", "error")
            return False
        
        # Get container port
        try:
            result = subprocess.run(
                [
                    "kubectl",
                    "get",
                    "pod",
                    pod_name,
                    "-n",
                    self.namespace,
                    "-o",
                    "jsonpath={.spec.containers[0].ports[0].containerPort}",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True,
                text=True,
            )
            container_port = int(result.stdout) if result.stdout else 3000
        except (subprocess.CalledProcessError, ValueError):
            container_port = 3000
        
        # Start port-forward
        self.log(f"Starting port-forward to pod {pod_name} ({container_port} → {self.local_port})...", "info")
        if not self.start_port_forward(pod_name, container_port):
            return False
        
        # Test all endpoints
        pod_success = True
        
        for endpoint in self.endpoints:
            description = "Health Check" if "health" in endpoint else (
                "Liveness Probe" if "healthz" in endpoint else "Readiness Probe"
            )
            success, _ = self.check_endpoint(endpoint, description)
            if not success:
                pod_success = False
        
        # Check probe configuration
        if not self.check_probe_configuration(pod_name):
            pod_success = False
        
        # Stop port-forward
        self.stop_port_forward()
        
        if pod_success:
            self.log(f"All health probes for {pod_name} are working correctly", "success")
        else:
            self.log(f"Some health probes for {pod_name} failed", "error")
        
        return pod_success

    def check_direct_endpoints(self) -> bool:
        """Check health endpoints directly using the base URL."""
        self.log(f"Testing health endpoints at {self.base_url}", "info")
        
        success = True
        for endpoint in self.endpoints:
            description = "Health Check" if "health" in endpoint else (
                "Liveness Probe" if "healthz" in endpoint else "Readiness Probe"
            )
            endpoint_success, _ = self.check_endpoint(endpoint, description)
            if not endpoint_success:
                success = False
        
        return success

    def run(self) -> int:
        """Run the health checks and return exit code."""
        print(f"=== VibeCode Health Check Verification ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')}) ===")
        
        if self.k8s_mode:
            # Kubernetes mode - check pods directly
            if not self.check_k8s_connectivity():
                self.log("Cannot connect to Kubernetes cluster. Make sure kubectl is configured correctly.", "error")
                return 1
            
            pods = self.get_pods()
            if not pods:
                self.log(f"No pods found with label '{self.app_label}' in namespace '{self.namespace}'", "error")
                return 1
            
            success_count = 0
            failure_count = 0
            
            for pod in pods:
                if self.check_pod(pod):
                    success_count += 1
                else:
                    failure_count += 1
                print()
            
            # Summary
            print("=== Test Summary ===")
            print(f"Total pods tested: {len(pods)}")
            self.log(f"Pods with all probes working: {success_count}", "success")
            self.log(f"Pods with failing probes: {failure_count}", "error")
            
            if failure_count == 0:
                self.log("All health probes are working correctly!", "success")
                return 0
            else:
                self.log("Some health probes failed.", "error")
                return 1
        else:
            # Direct mode - check endpoints at base URL
            if self.check_direct_endpoints():
                self.log("All health endpoints are working correctly!", "success")
                return 0
            else:
                self.log("Some health endpoints failed.", "error")
                return 1


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(description="VibeCode Health Check Verification")
    parser.add_argument(
        "--url",
        default="https://vibecode.eastus2.cloudapp.azure.com",
        help="Base URL for health checks",
    )
    parser.add_argument(
        "--namespace", default="vibecode-platform", help="Kubernetes namespace"
    )
    parser.add_argument(
        "--app-label", default="app=vibecode-app", help="Pod selector label"
    )
    parser.add_argument(
        "--local-port", type=int, default=8080, help="Local port for port-forward"
    )
    parser.add_argument(
        "--timeout", type=int, default=5, help="Timeout in seconds"
    )
    parser.add_argument(
        "--retries", type=int, default=3, help="Number of retries"
    )
    parser.add_argument(
        "--quiet", action="store_true", help="Suppress detailed output"
    )
    parser.add_argument(
        "--k8s", action="store_true", help="Kubernetes mode (check pods directly)"
    )
    
    args = parser.parse_args()
    
    checker = HealthChecker(
        base_url=args.url,
        namespace=args.namespace,
        app_label=args.app_label,
        local_port=args.local_port,
        timeout=args.timeout,
        retries=args.retries,
        verbose=not args.quiet,
        k8s_mode=args.k8s,
    )
    
    return checker.run()


if __name__ == "__main__":
    sys.exit(main())