#!/usr/bin/env python3
"""
Example environment configuration for bootstrap validation scripts.

This module provides default configuration values for testing and can be used
to set environment variables or as a configuration source.

Usage:
    # As a module
    from test_env_example import TestConfig
    config = TestConfig()
    print(config.cluster_name)

    # As a script to export environment variables
    python test_env_example.py --export
    eval $(python test_env_example.py --export)
"""

import argparse
import os
import sys
from dataclasses import dataclass
from typing import Optional


@dataclass
class TestConfig:
    """Configuration for bootstrap validation tests."""

    cluster_name: str = "vibecode-test"
    resource_group: str = "vibecode-rg"
    acr_name: str = "vibecodeacr"
    namespace: str = "vibecode"
    location: str = "eastus2"
    storage_class: str = "default"
    dd_api_key: str = "test_datadog_api_key"  # placeholder for local validation
    dd_site: str = "datadoghq.com"

    @classmethod
    def from_environment(cls) -> "TestConfig":
        """
        Create configuration from environment variables with defaults.

        Environment variables:
            CLUSTER_NAME: Kubernetes cluster name
            RESOURCE_GROUP: Azure resource group name
            ACR_NAME: Azure Container Registry name
            NAMESPACE: Kubernetes namespace
            LOCATION: Azure region
            STORAGE_CLASS: Kubernetes storage class
            DD_API_KEY: Datadog API key
            DD_SITE: Datadog site URL
        """
        return cls(
            cluster_name=os.environ.get("CLUSTER_NAME", cls.cluster_name),
            resource_group=os.environ.get("RESOURCE_GROUP", cls.resource_group),
            acr_name=os.environ.get("ACR_NAME", cls.acr_name),
            namespace=os.environ.get("NAMESPACE", cls.namespace),
            location=os.environ.get("LOCATION", cls.location),
            storage_class=os.environ.get("STORAGE_CLASS", cls.storage_class),
            dd_api_key=os.environ.get("DD_API_KEY", cls.dd_api_key),
            dd_site=os.environ.get("DD_SITE", cls.dd_site),
        )

    def to_env_dict(self) -> dict[str, str]:
        """Convert configuration to environment variable dictionary."""
        return {
            "CLUSTER_NAME": self.cluster_name,
            "RESOURCE_GROUP": self.resource_group,
            "ACR_NAME": self.acr_name,
            "NAMESPACE": self.namespace,
            "LOCATION": self.location,
            "STORAGE_CLASS": self.storage_class,
            "DD_API_KEY": self.dd_api_key,
            "DD_SITE": self.dd_site,
        }

    def apply_to_environment(self) -> None:
        """Apply configuration to current process environment."""
        for key, value in self.to_env_dict().items():
            os.environ[key] = value

    def export_shell(self) -> str:
        """Generate shell export statements."""
        lines = []
        for key, value in self.to_env_dict().items():
            lines.append(f'export {key}="{value}"')
        return "\n".join(lines)

    def export_env_file(self) -> str:
        """Generate .env file format."""
        lines = []
        for key, value in self.to_env_dict().items():
            lines.append(f'{key}="{value}"')
        return "\n".join(lines)


# Default configuration instance
DEFAULT_CONFIG = TestConfig()


def get_config(
    cluster_name: Optional[str] = None,
    resource_group: Optional[str] = None,
    acr_name: Optional[str] = None,
    namespace: Optional[str] = None,
    location: Optional[str] = None,
    storage_class: Optional[str] = None,
    dd_api_key: Optional[str] = None,
    dd_site: Optional[str] = None,
) -> TestConfig:
    """
    Get configuration with optional overrides.

    Values are resolved in order:
    1. Explicitly provided arguments
    2. Environment variables
    3. Default values
    """
    base = TestConfig.from_environment()

    return TestConfig(
        cluster_name=cluster_name or base.cluster_name,
        resource_group=resource_group or base.resource_group,
        acr_name=acr_name or base.acr_name,
        namespace=namespace or base.namespace,
        location=location or base.location,
        storage_class=storage_class or base.storage_class,
        dd_api_key=dd_api_key or base.dd_api_key,
        dd_site=dd_site or base.dd_site,
    )


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Example environment configuration for bootstrap validation scripts"
    )
    parser.add_argument(
        "--export",
        action="store_true",
        help="Output shell export statements (for eval)",
    )
    parser.add_argument(
        "--env-file",
        action="store_true",
        help="Output in .env file format",
    )
    parser.add_argument(
        "--show",
        action="store_true",
        help="Show current configuration values",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply configuration to environment and print confirmation",
    )
    args = parser.parse_args()

    config = TestConfig.from_environment()

    if args.export:
        print(config.export_shell())
    elif args.env_file:
        print(config.export_env_file())
    elif args.show:
        print("Bootstrap Test Configuration:")
        print("=" * 40)
        for key, value in config.to_env_dict().items():
            # Mask sensitive values
            display_value = value
            if "KEY" in key and value != "test_datadog_api_key":
                display_value = value[:4] + "..." + value[-4:] if len(value) > 8 else "****"
            print(f"  {key}: {display_value}")
    elif args.apply:
        config.apply_to_environment()
        print("Configuration applied to environment.")
        print("Variables set:")
        for key in config.to_env_dict():
            print(f"  {key}")
    else:
        # Default: show help
        parser.print_help()

    return 0


if __name__ == "__main__":
    sys.exit(main())
