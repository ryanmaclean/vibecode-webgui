#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), './')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Azure AKS Deployment Script with Robust Error Handling and Rollback

This script provides a robust deployment mechanism for Azure AKS infrastructure
using OpenTofu with comprehensive error handling, validation, and rollback capabilities.

Features:
- Pre-deployment validation
- Real-time deployment monitoring
- Automatic rollback on failure
- Azure API error detection and retry logic
- State management and cleanup
- Comprehensive logging
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
import logging
import os
import signal
import subprocess
import sys
import tempfile
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import yaml


@dataclass
class DeploymentConfig:
    """Configuration for AKS deployment."""

    environment: str
    location: str
    resource_group: Optional[str] = None
    cluster_name: Optional[str] = None
    project_name: str = 'vibecode'
    tofu_dir: Path = Path('tofu')
    state_file: Path = Path('tofu/terraform.tfstate')
    backup_dir: Path = Path('tofu/backups')
    timeout_minutes: int = 30
    rollback_timeout_minutes: int = 15
    max_retries: int = 3
    retry_delay_seconds: int = 30
    datadog_api_key: Optional[str] = None
    datadog_app_key: Optional[str] = None

    def __post_init__(self) -> None:
        self.project_name = self.project_name or 'vibecode'

        allowed_environments = {'dev', 'staging', 'prod'}
        if self.environment not in allowed_environments:
            raise ValueError(
                f"Environment '{self.environment}' is invalid. Expected one of: dev, staging, prod"
            )

        self.tofu_dir = Path(self.tofu_dir)
        self.state_file = Path(self.state_file)
        self.backup_dir = Path(self.backup_dir)

        if self.resource_group is None:
            self.resource_group = f"{self.project_name}-{self.environment}-rg"

        if self.cluster_name is None:
            self.cluster_name = f"{self.project_name}-{self.environment}-aks"


class AzureAPIError(Exception):
    """Custom exception for Azure API errors."""
    pass


class DeploymentError(Exception):
    """Custom exception for deployment errors."""
    pass


class ValidationError(DeploymentError):
    """Validation related error."""


class RollbackError(Exception):
    """Custom exception for rollback errors."""
    pass


class AKSDeploymentManager:
    """Manages AKS deployment with error handling and rollback capabilities."""

    def __init__(
        self,
        config: Union[DeploymentConfig, Dict[str, Any]],
        *,
        tofu_dir: Optional[Path] = None,
        dry_run: bool = False,
    ):
        if isinstance(config, DeploymentConfig):
            self.config = config
        else:
            self.config = self._build_config_from_dict(config, tofu_dir, dry_run)

        # Ensure directories exist before logging setup
        self.dry_run = dry_run
        self.config.tofu_dir.mkdir(parents=True, exist_ok=True)
        self.config.backup_dir.mkdir(parents=True, exist_ok=True)
        self.config.state_file.parent.mkdir(parents=True, exist_ok=True)

        self.logger = self._setup_logging()
        self.credential = None
        self.resource_client = None
        self.aks_client = None
        self.deployment_start_time = None
        self.state_backup_path = None
        self.interrupted = False

        # Set up signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _build_config_from_dict(
        self,
        raw_config: Dict[str, Any],
        tofu_dir: Optional[Path],
        dry_run: bool,
    ) -> DeploymentConfig:
        """Create a DeploymentConfig from the legacy dictionary format used in tests."""

        project_name = raw_config.get('project_name', 'vibecode')
        environment = raw_config.get('environment', 'dev')
        base_dir = Path(tofu_dir or raw_config.get('tofu_dir', Path.cwd() / 'tofu'))
        state_file = Path(raw_config.get('state_file', base_dir / 'terraform.tfstate'))
        backup_dir = Path(raw_config.get('backup_dir', base_dir / 'backups'))

        timeout_minutes = raw_config.get('timeout_minutes')
        if timeout_minutes is None:
            timeout_minutes = 0 if dry_run else 30

        return DeploymentConfig(
            environment=environment,
            resource_group=raw_config.get('resource_group', f"{project_name}-{environment}-rg"),
            location=raw_config.get('location', 'East US 2'),
            cluster_name=raw_config.get('cluster_name', f"{project_name}-{environment}-aks"),
            project_name=project_name,
            tofu_dir=base_dir,
            state_file=state_file,
            backup_dir=backup_dir,
            timeout_minutes=timeout_minutes,
            rollback_timeout_minutes=raw_config.get('rollback_timeout_minutes', 15),
            max_retries=raw_config.get('max_retries', 3),
            retry_delay_seconds=raw_config.get('retry_delay_seconds', 30),
        )

    @property
    def state_dir(self) -> Path:
        """Expose the Terraform state directory for legacy tests."""
        return self.config.state_file.parent

    @state_dir.setter
    def state_dir(self, value: Union[str, Path]) -> None:
        path = Path(value)
        path.mkdir(parents=True, exist_ok=True)
        self.config.state_file = path / self.config.state_file.name
        self.config.backup_dir = path / 'backups'
        self.config.backup_dir.mkdir(parents=True, exist_ok=True)

    def _setup_logging(self) -> logging.Logger:
        """Set up comprehensive logging."""
        logger = logging.getLogger('aks_deployment')
        logger.setLevel(logging.INFO)

        # Create logs directory
        log_dir = self.config.tofu_dir / 'logs'
        log_dir.mkdir(exist_ok=True)

        # File handler with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        log_file = log_dir / f'aks_deployment_{timestamp}.log'
        file_handler = logging.FileHandler(log_file)

        # Console handler
        console_handler = logging.StreamHandler()

        # Formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)

        logger.addHandler(file_handler)
        logger.addHandler(console_handler)

        logger.info(f"Logging initialized. Log file: {log_file}")
        return logger

    def _signal_handler(self, signum, frame):
        """Handle interrupt signals gracefully."""
        self.logger.warning(f"Received signal {signum}. Initiating graceful shutdown...")
        self.interrupted = True

    def _init_azure_clients(self):
        """Initialize Azure clients with error handling."""
        try:
            from azure.identity import DefaultAzureCredential
            from azure.mgmt.containerservice import ContainerServiceClient
            from azure.mgmt.resource import ResourceManagementClient
        except ImportError as exc:
            raise AzureAPIError(
                "Missing Azure SDK dependencies. Install with: "
                "pip install azure-identity azure-mgmt-resource azure-mgmt-containerservice"
            ) from exc

        try:
            self.credential = DefaultAzureCredential()

            # Get subscription ID
            result = subprocess.run([
                'az', 'account', 'show', '--query', 'id', '--output', 'tsv'
            ], capture_output=True, text=True, check=True)
            subscription_id = result.stdout.strip()

            self.resource_client = ResourceManagementClient(
                self.credential, subscription_id
            )
            self.aks_client = ContainerServiceClient(
                self.credential, subscription_id
            )

            self.logger.info("Azure clients initialized successfully")

        except Exception as e:
            raise AzureAPIError(f"Failed to initialize Azure clients: {e}")

    def _run_command(self, cmd: List[str], cwd: Optional[Path] = None,
                     timeout: Optional[int] = None) -> Tuple[int, str, str]:
        """Run command with timeout and error handling."""
        cwd = cwd or self.config.tofu_dir
        timeout = timeout or (self.config.timeout_minutes * 60)

        self.logger.info(f"Running command: {' '.join(cmd)}")

        try:
            result = subprocess.run(
                cmd, cwd=cwd, capture_output=True, text=True,
                timeout=timeout, check=False
            )

            if result.stdout:
                self.logger.debug(f"STDOUT: {result.stdout}")
            if result.stderr:
                self.logger.debug(f"STDERR: {result.stderr}")

            return result.returncode, result.stdout, result.stderr

        except subprocess.TimeoutExpired:
            self.logger.error(f"Command timed out after {timeout} seconds")
            raise DeploymentError(f"Command timeout: {' '.join(cmd)}")
        except Exception as e:
            self.logger.error(f"Command execution failed: {e}")
            raise DeploymentError(f"Command failed: {e}")

    def _validate_azure_auth(self) -> bool:
        """Validate Azure CLI authentication."""
        cmd = ['az', 'account', 'show']
        returncode, stdout, stderr = self._run_command(cmd, timeout=60)

        if returncode != 0:
            raise ValidationError(stderr or 'Azure CLI authentication failed')

        self.logger.info("Azure CLI authentication verified")
        return True

    def _validate_azure_permissions(self) -> bool:
        """Validate Azure permissions before deployment."""
        self.logger.info("Validating Azure permissions...")

        try:
            # Check if we can list resource groups
            resource_groups = list(self.resource_client.resource_groups.list())
            self.logger.info(f"Found {len(resource_groups)} resource groups")

            # Check if target resource group exists or can be created
            rg_exists = any(rg.name == self.config.resource_group for rg in resource_groups)

            if not rg_exists:
                self.logger.info(f"Resource group {self.config.resource_group} will be created")
            else:
                self.logger.info(f"Resource group {self.config.resource_group} exists")

            return True

        except Exception as e:
            self.logger.error(f"Permission validation failed: {e}")
            return False

    def _check_azure_quotas(self) -> bool:
        """Check Azure quotas and resource limits."""
        self.logger.info("Checking Azure quotas...")

        try:
            # Check compute quotas in the target location
            cmd = [
                'az', 'vm', 'list-usage',
                '--location', self.config.location,
                '--output', 'json'
            ]

            returncode, stdout, stderr = self._run_command(cmd)
            if returncode != 0:
                self.logger.warning(f"Could not check quotas: {stderr}")
                return True  # Proceed anyway

            usage_data = json.loads(stdout)

            # Check specific quotas we need
            cores_quota = next((item for item in usage_data if 'cores' in item['name']['value'].lower()), None)
            if cores_quota:
                usage_pct = (cores_quota['currentValue'] / cores_quota['limit']) * 100
                self.logger.info(f"vCPU cores usage: {cores_quota['currentValue']}/{cores_quota['limit']} ({usage_pct:.1f}%)")

                if usage_pct > 80:
                    self.logger.warning("vCPU quota usage is high (>80%)")

            return True

        except Exception as e:
            self.logger.warning(f"Quota check failed (continuing anyway): {e}")
            return True

    def _backup_terraform_state(self) -> bool:
        """Backup current Terraform state."""
        if not self.config.state_file.exists():
            self.logger.info("No existing state file to backup")
            return True

        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            self.state_backup_path = self.config.backup_dir / f"terraform.tfstate.backup_{timestamp}"
            self.config.backup_dir.mkdir(exist_ok=True)

            import shutil
            shutil.copy2(self.config.state_file, self.state_backup_path)

            self.logger.info(f"State backed up to: {self.state_backup_path}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to backup state: {e}")
            return False

    def _backup_state(self) -> Path:
        """Legacy helper returning the backup path used in tests."""
        success = self._backup_terraform_state()
        if not success or not self.state_backup_path:
            raise DeploymentError("Failed to backup state")
        return self.state_backup_path

    def _validate_tofu_config(self) -> bool:
        """Legacy alias for OpenTofu validation."""
        return self._validate_tofu_configuration()

    def _validate_tofu_configuration(self) -> bool:
        """Validate OpenTofu configuration."""
        self.logger.info("Validating OpenTofu configuration...")

        try:
            # Check if tofu is installed
            returncode, stdout, stderr = self._run_command(['tofu', 'version'])
            if returncode != 0:
                self.logger.error("OpenTofu is not installed or not in PATH")
                return False

            self.logger.info(f"OpenTofu version: {stdout.strip()}")

            # Initialize if needed
            if not (self.config.tofu_dir / '.terraform').exists():
                self.logger.info("Initializing OpenTofu...")
                returncode, stdout, stderr = self._run_command(['tofu', 'init'])
                if returncode != 0:
                    self.logger.error(f"OpenTofu init failed: {stderr}")
                    return False

            # Validate configuration
            returncode, stdout, stderr = self._run_command(['tofu', 'validate'])
            if returncode != 0:
                self.logger.error(f"OpenTofu validation failed: {stderr}")
                return False

            self.logger.info("OpenTofu configuration is valid")
            return True

        except Exception as e:
            self.logger.error(f"OpenTofu validation failed: {e}")
            return False

    def _plan_deployment(self) -> bool:
        """Generate and analyze deployment plan."""
        self.logger.info("Generating deployment plan...")

        try:
            plan_file = self.config.tofu_dir / 'deployment.tfplan'

            cmd = [
                'tofu', 'plan',
                '-out', str(plan_file),
                '-detailed-exitcode'
            ]

            returncode, stdout, stderr = self._run_command(cmd)

            if returncode == 0:
                self.logger.info("No changes required")
                return True
            elif returncode == 2:
                self.logger.info("Changes detected, deployment plan created")

                # Show plan summary
                returncode, stdout, stderr = self._run_command(['tofu', 'show', str(plan_file)])
                if returncode == 0:
                    # Count resources to be created/modified/destroyed
                    lines = stdout.split('\n')
                    create_count = sum(1 for line in lines if '# will be created' in line)
                    modify_count = sum(1 for line in lines if '# will be updated' in line)
                    destroy_count = sum(1 for line in lines if '# will be destroyed' in line)

                    self.logger.info(f"Plan summary: {create_count} to create, {modify_count} to modify, {destroy_count} to destroy")

                return True
            else:
                self.logger.error(f"Plan generation failed: {stderr}")
                return False

        except Exception as e:
            self.logger.error(f"Plan generation failed: {e}")
            return False

    def _monitor_deployment_progress(self, process: subprocess.Popen) -> bool:
        """Monitor deployment progress and detect issues."""
        self.logger.info("Monitoring deployment progress...")

        last_output_time = time.time()
        output_buffer = []
        error_patterns = [
            'Error:',
            'AlreadyExists',
            'Conflict',
            'Forbidden',
            'Unauthorized',
            'QuotaExceeded',
            'InvalidParameter',
            'BadRequest'
        ]

        while process.poll() is None:
            if self.interrupted:
                self.logger.warning("Deployment interrupted by user")
                process.terminate()
                return False

            # Check for timeout
            if time.time() - last_output_time > (self.config.timeout_minutes * 60):
                self.logger.error("Deployment timeout exceeded")
                process.terminate()
                return False

            # Read output
            try:
                output = process.stdout.readline()
                if output:
                    output = output.strip()
                    output_buffer.append(output)
                    last_output_time = time.time()

                    # Log important messages
                    if any(pattern in output for pattern in ['Creating...', 'Modifying...', 'Destroying...']):
                        self.logger.info(output)

                    # Check for errors
                    if any(pattern in output for pattern in error_patterns):
                        self.logger.error(f"Detected error in deployment: {output}")

                        # Check if it's a retryable error
                        if self._is_retryable_error(output):
                            self.logger.info("Error appears to be retryable")
                        else:
                            self.logger.error("Error is not retryable, stopping deployment")
                            process.terminate()
                            return False

                time.sleep(1)

            except Exception as e:
                self.logger.error(f"Error monitoring deployment: {e}")
                break

        return process.returncode == 0

    def _is_retryable_error(self, error_msg: str) -> bool:
        """Determine if an error is retryable."""
        retryable_patterns = [
            'timeout',
            'temporary',
            'throttling',
            'rate limit',
            'service unavailable',
            'internal server error',
            'network'
        ]

        return any(pattern in error_msg.lower() for pattern in retryable_patterns)

    def _is_name_collision_error(self, error_msg: str) -> bool:
        """Detect Azure resource name collisions."""
        text = error_msg.lower()
        patterns = ['already exists', 'already in use', 'name is in use', 'duplicate resource']
        return any(pattern in text for pattern in patterns)

    def _is_false_success(self, result: Any) -> bool:
        """Detect operations that returned success codes but contain failure signals."""
        payload = f"{getattr(result, 'stdout', '')}{getattr(result, 'stderr', '')}".lower()
        failure_markers = [
            'internalservererror',
            'deploymentfailed',
            'provisioningstate": "failed',
            'validation failed',
            'error":'
        ]

        return getattr(result, 'returncode', 0) == 0 and any(marker in payload for marker in failure_markers)

    def _validate_k8s_connectivity(self) -> bool:
        """Ensure kubectl can reach the cluster."""
        returncode, stdout, stderr = self._run_command(['kubectl', 'cluster-info'])
        if returncode != 0:
            raise ValidationError(stderr or 'Failed to validate Kubernetes connectivity')

        self.logger.info(stdout.strip())
        return True

    def _validate_datadog_deployment(self) -> bool:
        """Validate that the Datadog agent is deployed."""
        cmd = [
            'kubectl', 'get', 'pods',
            '--namespace', 'vibecode-platform',
            '--selector', 'app=datadog-agent',
            '--output', 'json'
        ]
        returncode, stdout, stderr = self._run_command(cmd)
        if returncode != 0:
            raise ValidationError(stderr or 'Failed to query Datadog pods')

        try:
            payload = json.loads(stdout or '{}')
        except json.JSONDecodeError as exc:
            raise ValidationError(f"Invalid Datadog response: {exc}") from exc

        if not payload.get('items'):
            raise ValidationError('Datadog agent pods not found')

        return True

    def _validate_postgres_deployment(self) -> bool:
        """Validate that the PostgreSQL deployment is healthy."""
        cmd = [
            'kubectl', 'get', 'pods',
            '--namespace', 'vibecode-platform',
            '--selector', 'app=postgres',
            '--output', 'json'
        ]
        returncode, stdout, stderr = self._run_command(cmd)
        if returncode != 0:
            raise ValidationError(stderr or 'Failed to query PostgreSQL pods')

        try:
            payload = json.loads(stdout or '{}')
        except json.JSONDecodeError as exc:
            raise ValidationError(f"Invalid PostgreSQL response: {exc}") from exc

        if not payload.get('items'):
            raise ValidationError('PostgreSQL pods not found')

        return True

    def _deploy_with_retry(self) -> bool:
        """Deploy with retry logic."""
        plan_file = self.config.tofu_dir / 'deployment.tfplan'

        for attempt in range(1, self.config.max_retries + 1):
            self.logger.info(f"Deployment attempt {attempt}/{self.config.max_retries}")

            try:
                cmd = ['tofu', 'apply', str(plan_file)]

                process = subprocess.Popen(
                    cmd, cwd=self.config.tofu_dir,
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    text=True, bufsize=1
                )

                success = self._monitor_deployment_progress(process)

                if success:
                    self.logger.info("Deployment completed successfully")
                    return True

                if attempt < self.config.max_retries:
                    self.logger.warning(f"Deployment attempt {attempt} failed, retrying in {self.config.retry_delay_seconds} seconds...")
                    time.sleep(self.config.retry_delay_seconds)
                else:
                    self.logger.error("All deployment attempts failed")
                    return False

            except Exception as e:
                self.logger.error(f"Deployment attempt {attempt} failed: {e}")
                if attempt < self.config.max_retries:
                    time.sleep(self.config.retry_delay_seconds)
                else:
                    return False

        return False

    def _validate_deployment(self) -> bool:
        """Validate deployment success."""
        self.logger.info("Validating deployment...")

        try:
            # Get cluster information
            cluster_info = self.aks_client.managed_clusters.get(
                self.config.resource_group,
                self.config.cluster_name
            )

            if cluster_info.provisioning_state != 'Succeeded':
                self.logger.error(f"Cluster provisioning state: {cluster_info.provisioning_state}")
                return False

            self.logger.info(f"Cluster status: {cluster_info.provisioning_state}")
            self.logger.info(f"Kubernetes version: {cluster_info.kubernetes_version}")
            self.logger.info(f"Node count: {cluster_info.agent_pool_profiles[0].count}")

            # Test kubectl connectivity
            cmd = [
                'az', 'aks', 'get-credentials',
                '--resource-group', self.config.resource_group,
                '--name', self.config.cluster_name,
                '--overwrite-existing'
            ]

            returncode, stdout, stderr = self._run_command(cmd)
            if returncode != 0:
                self.logger.error(f"Failed to get cluster credentials: {stderr}")
                return False

            # Test cluster connectivity
            returncode, stdout, stderr = self._run_command(['kubectl', 'cluster-info'])
            if returncode != 0:
                self.logger.error(f"Failed to connect to cluster: {stderr}")
                return False

            self.logger.info("Deployment validation successful")
            return True

        except Exception as e:
            self.logger.error(f"Deployment validation failed: {e}")
            return False

    def _rollback_deployment(self, backup_path: Optional[Path] = None) -> bool:
        """Rollback deployment to previous state."""
        self.logger.warning("Initiating deployment rollback...")

        try:
            if backup_path:
                self.state_backup_path = Path(backup_path)

            if not self.state_backup_path or not self.state_backup_path.exists():
                self.logger.error("No backup state found for rollback")
                return False

            # Restore backup state
            import shutil
            shutil.copy2(self.state_backup_path, self.config.state_file)
            self.logger.info("Backup state restored")

            # Run destroy for any resources not in backup
            cmd = ['tofu', 'destroy', '-auto-approve']
            returncode, stdout, stderr = self._run_command(
                cmd, timeout=self.config.rollback_timeout_minutes * 60
            )

            if returncode == 0:
                self.logger.info("Rollback completed successfully")
                return True
            else:
                self.logger.error(f"Rollback failed: {stderr}")
                return False

        except Exception as e:
            self.logger.error(f"Rollback failed: {e}")
            return False

    def deploy(self) -> bool:
        """Main deployment method."""
        try:
            self.deployment_start_time = datetime.now()
            self.logger.info(f"Starting AKS deployment at {self.deployment_start_time}")

            # Pre-deployment validation
            self.logger.info("=== Pre-deployment Validation ===")

            if not self._validate_tofu_configuration():
                raise DeploymentError("OpenTofu configuration validation failed")

            self._validate_azure_auth()
            self._init_azure_clients()

            if not self._validate_azure_permissions():
                raise DeploymentError("Azure permissions validation failed")

            if not self._check_azure_quotas():
                self.logger.warning("Quota check failed, but continuing")

            if not self._backup_terraform_state():
                raise DeploymentError("State backup failed")

            if self.dry_run:
                self.logger.info("Dry run enabled - skipping apply phase")
                return True

            # Generate deployment plan
            self.logger.info("=== Deployment Planning ===")
            if not self._plan_deployment():
                raise DeploymentError("Deployment planning failed")

            # Execute deployment
            self.logger.info("=== Deployment Execution ===")
            if not self._deploy_with_retry():
                raise DeploymentError("Deployment execution failed")

            # Post-deployment validation
            self.logger.info("=== Post-deployment Validation ===")
            if not self._validate_deployment():
                raise DeploymentError("Deployment validation failed")

            deployment_time = datetime.now() - self.deployment_start_time
            self.logger.info(f"Deployment completed successfully in {deployment_time}")

            return True

        except (DeploymentError, AzureAPIError) as e:
            self.logger.error(f"Deployment failed: {e}")

            if not self.dry_run and self.config.timeout_minutes > 0:  # Only rollback if not in dry-run mode
                try:
                    self._rollback_deployment()
                except Exception as rollback_error:
                    self.logger.error(f"Rollback also failed: {rollback_error}")

            return False

        except Exception as e:
            self.logger.error(f"Unexpected deployment error: {e}")
            return False

    def destroy(self) -> bool:
        """Destroy the AKS deployment."""
        self.logger.info("Destroying AKS deployment...")

        try:
            cmd = ['tofu', 'destroy', '-auto-approve']
            returncode, stdout, stderr = self._run_command(cmd)

            if returncode == 0:
                self.logger.info("Deployment destroyed successfully")
                return True
            else:
                self.logger.error(f"Destroy failed: {stderr}")
                return False

        except Exception as e:
            self.logger.error(f"Destroy failed: {e}")
            return False


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Deploy AKS infrastructure with OpenTofu')
    parser.add_argument('--environment', '-e', default='dev', help='Environment (dev/staging/prod)')
    parser.add_argument('--resource-group', '-g', required=True, help='Azure resource group name')
    parser.add_argument('--location', '-l', default='East US 2', help='Azure location')
    parser.add_argument('--cluster-name', '-c', help='AKS cluster name (auto-generated if not provided)')
    parser.add_argument('--project-name', '-p', default='vibecode', help='Project name')
    parser.add_argument('--tofu-dir', '-d', help='OpenTofu directory (default: ./tofu)')
    parser.add_argument('--timeout', '-t', type=int, default=30, help='Deployment timeout in minutes')
    parser.add_argument('--dry-run-timeout', type=int, default=5, help='Timeout in minutes when running with --dry-run')
    parser.add_argument('--destroy', action='store_true', help='Destroy instead of deploy')
    parser.add_argument('--dry-run', action='store_true', help='Plan only, do not apply')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose logging')

    args = parser.parse_args()

    # Set up configuration
    script_dir = Path(__file__).parent
    tofu_dir = Path(args.tofu_dir) if args.tofu_dir else script_dir.parent / 'tofu'

    if not tofu_dir.exists():
        print(f"Error: OpenTofu directory does not exist: {tofu_dir}")
        sys.exit(1)

    config = DeploymentConfig(
        environment=args.environment,
        resource_group=args.resource_group,
        location=args.location,
        cluster_name=args.cluster_name or f"vibecode-{args.environment}-aks",
        project_name=args.project_name,
        tofu_dir=tofu_dir,
        state_file=tofu_dir / 'terraform.tfstate',
        backup_dir=tofu_dir / 'backups',
        timeout_minutes=args.dry_run_timeout if args.dry_run else args.timeout
    )

    # Create deployment manager
    manager = AKSDeploymentManager(config, dry_run=args.dry_run)

    if args.verbose:
        manager.logger.setLevel(logging.DEBUG)

    # Execute operation
    try:
        if args.destroy:
            success = manager.destroy()
        else:
            success = manager.deploy()

        sys.exit(0 if success else 1)

    except KeyboardInterrupt:
        manager.logger.warning("Deployment interrupted by user")
        sys.exit(1)
    except Exception as e:
        manager.logger.error(f"Unexpected error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()