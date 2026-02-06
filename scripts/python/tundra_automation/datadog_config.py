
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

# Datadog Unified Service Tagging
_dd_service = "tundra-datadog-config"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "tundra", "cluster": "tundra-dome"})
    _dd_patch()
except ImportError:
    pass


"""
Datadog Configuration Manager

Handles secure retrieval, validation, and storage of Datadog API credentials.
Supports environment variables, file-based storage, and interactive prompts.
"""

# Datadog APM tracing - auto-detects local agent
import os

os.environ.setdefault("DD_SERVICE", "tundra-automation")
os.environ.setdefault("DD_ENV", "development")

try:
    from ddtrace import tracer, patch_all

    patch_all()
except ImportError:
    tracer = None

import logging
import re
import stat
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Constants
DD_API_KEY_ENV = "DD_API_KEY"
DD_APP_KEY_ENV = "DD_APP_KEY"
DD_SITE_ENV = "DD_SITE"
DD_CONFIG_DIR = Path.home() / ".datadog"
DD_API_KEY_FILE = DD_CONFIG_DIR / "api_key"
DD_APP_KEY_FILE = DD_CONFIG_DIR / "app_key"

# API key format: 32 hexadecimal characters
API_KEY_PATTERN = re.compile(r"^[a-fA-F0-9]{32}$")
# App key format: 40 hexadecimal characters
APP_KEY_PATTERN = re.compile(r"^[a-fA-F0-9]{40}$")


class DatadogConfigError(Exception):
    """Base exception for Datadog configuration errors."""



class KeyNotFoundError(DatadogConfigError):
    """Raised when an API key cannot be found and prompting is disabled."""



class InvalidKeyFormatError(DatadogConfigError):
    """Raised when an API key has an invalid format."""



@dataclass
class DatadogCredentials:
    """Datadog API credentials."""

    api_key: str
    app_key: Optional[str] = None
    site: str = "datadoghq.com"

    def validate(self) -> bool:
        """Validate that credentials are properly formatted.

        Returns:
            True if credentials appear valid
        """
        if not self.api_key or not API_KEY_PATTERN.match(self.api_key):
            return False
        if self.app_key and not APP_KEY_PATTERN.match(self.app_key):
            return False
        return True


class DatadogConfig:
    """
    Manages Datadog API credentials with secure handling.

    Retrieval priority:
    1. Environment variable (DD_API_KEY / DD_APP_KEY)
    2. File (~/.datadog/api_key / ~/.datadog/app_key)
    3. Interactive prompt (if enabled)

    Example:
        config = DatadogConfig()
        api_key = config.get_api_key(prompt_if_missing=True)
        if api_key and config.test_api_connectivity():
            print("Connected to Datadog successfully")
    """

    ENV_API_KEY = DD_API_KEY_ENV
    ENV_APP_KEY = DD_APP_KEY_ENV
    ENV_SITE = DD_SITE_ENV

    def __init__(
        self,
        verbose: bool = False,
        config_dir: Optional[Path] = None,
    ):
        """
        Initialize the Datadog configuration manager.

        Args:
            verbose: Enable verbose output
            config_dir: Custom configuration directory (default: ~/.datadog)
        """
        self.verbose = verbose
        self.config_dir = config_dir or DD_CONFIG_DIR
        self.api_key_file = self.config_dir / "api_key"
        self.app_key_file = self.config_dir / "app_key"
        self._credentials: Optional[DatadogCredentials] = None

        # Cache for loaded keys (avoid repeated file reads)
        self._api_key_cache: Optional[str] = None
        self._app_key_cache: Optional[str] = None

    def validate_key_format(self, key: str, key_type: str = "api") -> bool:
        """
        Validate the format of an API or App key.

        Args:
            key: The key string to validate
            key_type: Either "api" (32 hex chars) or "app" (40 hex chars)

        Returns:
            True if the key format is valid, False otherwise
        """
        if not key or not isinstance(key, str):
            return False

        key = key.strip()

        if key_type == "api":
            return bool(API_KEY_PATTERN.match(key))
        elif key_type == "app":
            return bool(APP_KEY_PATTERN.match(key))
        else:
            logger.warning(f"Unknown key type: {key_type}")
            return False

    def _read_key_from_file(self, file_path: Path) -> Optional[str]:
        """
        Securely read a key from a file.

        Args:
            file_path: Path to the key file

        Returns:
            The key string if found and readable, None otherwise
        """
        try:
            if not file_path.exists():
                logger.debug(f"Key file does not exist: {file_path}")
                return None

            # Check file permissions (warn if too permissive)
            file_stat = file_path.stat()
            mode = file_stat.st_mode
            if mode & (stat.S_IRWXG | stat.S_IRWXO):
                logger.warning(
                    f"Key file has insecure permissions: {file_path} "
                    f"(mode: {oct(mode)}). Consider running: chmod 600 {file_path}"
                )

            key = file_path.read_text().strip()
            if key:
                logger.debug(f"Key loaded from file: {file_path}")
                return key
            else:
                logger.debug(f"Key file is empty: {file_path}")
                return None

        except PermissionError:
            logger.error(f"Permission denied reading key file: {file_path}")
            return None
        except Exception as e:
            logger.error(f"Error reading key file {file_path}: {type(e).__name__}")
            return None

    def _prompt_for_key(self, key_type: str = "api") -> Optional[str]:
        """
        Interactively prompt the user for a key.

        Args:
            key_type: Either "api" or "app"

        Returns:
            The entered key if valid, None if cancelled or invalid
        """
        import getpass

        key_name = "API" if key_type == "api" else "Application"
        expected_len = 32 if key_type == "api" else 40

        print(f"\nDatadog {key_name} Key required.")
        print(f"Expected format: {expected_len} hexadecimal characters")
        print("Enter key (input will be hidden), or press Ctrl+C to cancel:")

        try:
            key = getpass.getpass(prompt=f"DD_{key_type.upper()}_KEY: ")
            key = key.strip()

            if not key:
                print("No key entered.")
                return None

            if not self.validate_key_format(key, key_type):
                print(
                    f"Invalid {key_name} key format. Expected {expected_len} hex characters."
                )
                return None

            return key

        except KeyboardInterrupt:
            print("\nCancelled.")
            return None
        except EOFError:
            # Non-interactive environment
            logger.debug("Non-interactive environment detected during prompt")
            return None

    def get_api_key(self, prompt_if_missing: bool = True) -> Optional[str]:
        """
        Retrieve the Datadog API key.

        Checks in order:
        1. Environment variable (DD_API_KEY)
        2. File (~/.datadog/api_key)
        3. Interactive prompt (if enabled)

        Args:
            prompt_if_missing: If True, prompt user when key not found

        Returns:
            The API key string if found and valid, None otherwise

        Raises:
            KeyNotFoundError: If key not found and prompt_if_missing is False
            InvalidKeyFormatError: If found key has invalid format
        """
        # Return cached key if available
        if self._api_key_cache:
            return self._api_key_cache

        key = None
        source = None

        # 1. Check environment variable
        env_key = os.environ.get(self.ENV_API_KEY)
        if env_key:
            key = env_key.strip()
            source = "environment"
            logger.debug(f"API key found in environment variable: {self.ENV_API_KEY}")

        # 2. Check file
        if not key:
            file_key = self._read_key_from_file(self.api_key_file)
            if file_key:
                key = file_key
                source = "file"

        # 3. Prompt if enabled and no key found
        if not key and prompt_if_missing:
            key = self._prompt_for_key("api")
            if key:
                source = "prompt"
                # Offer to save the key
                try:
                    save = (
                        input("Save this API key for future use? [y/N]: ").strip().lower()
                    )
                    if save == "y":
                        if self.save_api_key(key):
                            print(f"API key saved to {self.api_key_file}")
                        else:
                            print("Failed to save API key.")
                except (EOFError, KeyboardInterrupt):
                    pass

        # Handle missing key
        if not key:
            if prompt_if_missing:
                logger.warning("No API key available")
                return None
            else:
                raise KeyNotFoundError(
                    f"Datadog API key not found. Set {self.ENV_API_KEY} environment "
                    f"variable or create {self.api_key_file}"
                )

        # Validate format
        if not self.validate_key_format(key, "api"):
            raise InvalidKeyFormatError(
                f"Invalid API key format (source: {source}). "
                "Expected 32 hexadecimal characters."
            )

        # Cache and return
        self._api_key_cache = key
        logger.info(f"API key loaded from {source}")
        return key

    def get_app_key(self, prompt_if_missing: bool = False) -> Optional[str]:
        """
        Retrieve the Datadog Application key.

        Checks in order:
        1. Environment variable (DD_APP_KEY)
        2. File (~/.datadog/app_key)
        3. Interactive prompt (if enabled)

        Args:
            prompt_if_missing: If True, prompt user when key not found

        Returns:
            The App key string if found and valid, None otherwise

        Raises:
            KeyNotFoundError: If key not found and prompt_if_missing is False
            InvalidKeyFormatError: If found key has invalid format
        """
        # Return cached key if available
        if self._app_key_cache:
            return self._app_key_cache

        key = None
        source = None

        # 1. Check environment variable
        env_key = os.environ.get(self.ENV_APP_KEY)
        if env_key:
            key = env_key.strip()
            source = "environment"
            logger.debug(f"App key found in environment variable: {self.ENV_APP_KEY}")

        # 2. Check file
        if not key:
            file_key = self._read_key_from_file(self.app_key_file)
            if file_key:
                key = file_key
                source = "file"

        # 3. Prompt if enabled and no key found
        if not key and prompt_if_missing:
            key = self._prompt_for_key("app")
            if key:
                source = "prompt"
                # Offer to save the key
                try:
                    save = (
                        input("Save this App key for future use? [y/N]: ").strip().lower()
                    )
                    if save == "y":
                        if self.save_app_key(key):
                            print(f"App key saved to {self.app_key_file}")
                        else:
                            print("Failed to save App key.")
                except (EOFError, KeyboardInterrupt):
                    pass

        # Handle missing key (App key is often optional)
        if not key:
            logger.debug("No App key available")
            return None

        # Validate format
        if not self.validate_key_format(key, "app"):
            raise InvalidKeyFormatError(
                f"Invalid App key format (source: {source}). "
                "Expected 40 hexadecimal characters."
            )

        # Cache and return
        self._app_key_cache = key
        logger.info(f"App key loaded from {source}")
        return key

    def _save_key_to_file(self, key: str, file_path: Path) -> bool:
        """
        Securely save a key to a file with restricted permissions.

        Args:
            key: The key string to save
            file_path: Path to the key file

        Returns:
            True if saved successfully, False otherwise
        """
        try:
            # Create config directory if it doesn't exist
            self.config_dir.mkdir(parents=True, exist_ok=True)

            # Set directory permissions (700)
            self.config_dir.chmod(stat.S_IRWXU)

            # Write key to file
            file_path.write_text(key.strip() + "\n")

            # Set file permissions (600 - owner read/write only)
            file_path.chmod(stat.S_IRUSR | stat.S_IWUSR)

            logger.info(f"Key saved securely to {file_path}")
            return True

        except PermissionError:
            logger.error(f"Permission denied writing to {file_path}")
            return False
        except Exception as e:
            logger.error(f"Error saving key to {file_path}: {type(e).__name__}")
            return False

    def save_api_key(self, key: str) -> bool:
        """
        Save an API key to the configuration file.

        The key is validated before saving and stored with secure
        file permissions (600).

        Args:
            key: The API key to save

        Returns:
            True if saved successfully, False otherwise

        Raises:
            InvalidKeyFormatError: If the key format is invalid
        """
        if not self.validate_key_format(key, "api"):
            raise InvalidKeyFormatError(
                "Cannot save invalid API key. Expected 32 hexadecimal characters."
            )

        success = self._save_key_to_file(key, self.api_key_file)
        if success:
            self._api_key_cache = key.strip()
        return success

    def save_app_key(self, key: str) -> bool:
        """
        Save an Application key to the configuration file.

        The key is validated before saving and stored with secure
        file permissions (600).

        Args:
            key: The App key to save

        Returns:
            True if saved successfully, False otherwise

        Raises:
            InvalidKeyFormatError: If the key format is invalid
        """
        if not self.validate_key_format(key, "app"):
            raise InvalidKeyFormatError(
                "Cannot save invalid App key. Expected 40 hexadecimal characters."
            )

        success = self._save_key_to_file(key, self.app_key_file)
        if success:
            self._app_key_cache = key.strip()
        return success

    def test_api_connectivity(self, timeout: int = 10) -> bool:
        """
        Test API connectivity by making a validation request to Datadog.

        This makes a lightweight API call to verify the API key is valid
        and the Datadog API is reachable.

        Args:
            timeout: Request timeout in seconds

        Returns:
            True if the API key is valid and Datadog is reachable, False otherwise
        """
        try:
            import json
            import urllib.error
            import urllib.request

            api_key = self.get_api_key(prompt_if_missing=False)
            if not api_key:
                logger.error("Cannot test connectivity: No API key available")
                return False

            # Determine site URL
            site = os.environ.get(self.ENV_SITE, "datadoghq.com")
            url = f"https://api.{site}/api/v1/validate"

            request = urllib.request.Request(
                url,
                headers={
                    "DD-API-KEY": api_key,
                    "Content-Type": "application/json",
                },
                method="GET",
            )

            try:
                with urllib.request.urlopen(request, timeout=timeout) as response:
                    data = json.loads(response.read().decode("utf-8"))
                    if data.get("valid", False):
                        logger.info("API connectivity test passed")
                        return True
                    else:
                        logger.warning("API key validation returned invalid")
                        return False

            except urllib.error.HTTPError as e:
                if e.code == 403:
                    logger.error("API key is invalid or unauthorized")
                else:
                    logger.error(f"HTTP error during connectivity test: {e.code}")
                return False

            except urllib.error.URLError as e:
                logger.error(f"Network error during connectivity test: {e.reason}")
                return False

        except KeyNotFoundError:
            logger.error("Cannot test connectivity: No API key configured")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during connectivity test: {type(e).__name__}")
            return False

    def clear_cache(self) -> None:
        """Clear the cached API and App keys."""
        self._api_key_cache = None
        self._app_key_cache = None
        self._credentials = None
        logger.debug("Key cache cleared")

    def get_config_status(self) -> dict:
        """
        Get the current configuration status.

        Returns:
            Dictionary with configuration status information
        """
        api_key_env_set = bool(os.environ.get(self.ENV_API_KEY))
        app_key_env_set = bool(os.environ.get(self.ENV_APP_KEY))
        api_key_file_exists = self.api_key_file.exists()
        app_key_file_exists = self.app_key_file.exists()

        return {
            "api_key": {
                "env_var": self.ENV_API_KEY,
                "env_set": api_key_env_set,
                "file_path": str(self.api_key_file),
                "file_exists": api_key_file_exists,
                "available": api_key_env_set or api_key_file_exists,
            },
            "app_key": {
                "env_var": self.ENV_APP_KEY,
                "env_set": app_key_env_set,
                "file_path": str(self.app_key_file),
                "file_exists": app_key_file_exists,
                "available": app_key_env_set or app_key_file_exists,
            },
            "config_dir": str(self.config_dir),
        }

    # -------------------------------------------------------------------------
    # Legacy methods for backward compatibility
    # -------------------------------------------------------------------------

    def get_credentials_from_env(self) -> Optional[DatadogCredentials]:
        """Get Datadog credentials from environment variables.

        Returns:
            DatadogCredentials if found, None otherwise
        """
        api_key = os.environ.get(self.ENV_API_KEY)
        if not api_key:
            return None

        return DatadogCredentials(
            api_key=api_key,
            app_key=os.environ.get(self.ENV_APP_KEY),
            site=os.environ.get(self.ENV_SITE, "datadoghq.com"),
        )

    def get_credentials_from_secret(
        self, namespace: str = "datadog"
    ) -> Optional[DatadogCredentials]:
        """Get Datadog credentials from Kubernetes secret.

        Args:
            namespace: Kubernetes namespace containing the secret

        Returns:
            DatadogCredentials if found, None otherwise
        """
        try:
            result = subprocess.run(
                [
                    "kubectl",
                    "get",
                    "secret",
                    "datadog-secret",
                    "-n",
                    namespace,
                    "-o",
                    "jsonpath={.data.api-key}",
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode != 0:
                return None

            import base64

            api_key = base64.b64decode(result.stdout).decode("utf-8")

            # Try to get app key as well
            app_result = subprocess.run(
                [
                    "kubectl",
                    "get",
                    "secret",
                    "datadog-secret",
                    "-n",
                    namespace,
                    "-o",
                    "jsonpath={.data.app-key}",
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )
            app_key = None
            if app_result.returncode == 0 and app_result.stdout:
                app_key = base64.b64decode(app_result.stdout).decode("utf-8")

            return DatadogCredentials(api_key=api_key, app_key=app_key)
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError, ValueError):
            return None

    def load_credentials(self, namespace: str = "datadog") -> bool:
        """Load credentials from environment or Kubernetes.

        Args:
            namespace: Kubernetes namespace for secret lookup

        Returns:
            True if credentials were loaded successfully
        """
        # Try environment first
        self._credentials = self.get_credentials_from_env()
        if self._credentials and self._credentials.validate():
            return True

        # Try file-based credentials
        try:
            api_key = self.get_api_key(prompt_if_missing=False)
            app_key = self.get_app_key(prompt_if_missing=False)
            if api_key:
                self._credentials = DatadogCredentials(
                    api_key=api_key,
                    app_key=app_key,
                    site=os.environ.get(self.ENV_SITE, "datadoghq.com"),
                )
                if self._credentials.validate():
                    return True
        except DatadogConfigError:
            pass

        # Try Kubernetes secret
        self._credentials = self.get_credentials_from_secret(namespace)
        if self._credentials and self._credentials.validate():
            return True

        self._credentials = None
        return False

    @property
    def credentials(self) -> Optional[DatadogCredentials]:
        """Get loaded credentials.

        Returns:
            DatadogCredentials if loaded, None otherwise
        """
        return self._credentials

    def create_kubernetes_secret(
        self,
        api_key: str,
        app_key: Optional[str] = None,
        namespace: str = "datadog",
    ) -> bool:
        """Create Datadog Kubernetes secret.

        Args:
            api_key: Datadog API key
            app_key: Optional Datadog APP key
            namespace: Target namespace

        Returns:
            True if secret was created successfully
        """
        try:
            # Ensure namespace exists
            subprocess.run(
                ["kubectl", "create", "namespace", namespace],
                capture_output=True,
                timeout=30,
            )

            # Build secret command
            cmd = [
                "kubectl",
                "create",
                "secret",
                "generic",
                "datadog-secret",
                "-n",
                namespace,
                f"--from-literal=api-key={api_key}",
            ]
            if app_key:
                cmd.append(f"--from-literal=app-key={app_key}")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30,
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            return False

    def get_helm_values(self) -> Dict[str, Any]:
        """Get Helm values for Datadog deployment.

        Returns:
            Dictionary of Helm values
        """
        if not self._credentials:
            return {}

        return {
            "datadog": {
                "apiKey": self._credentials.api_key,
                "appKey": self._credentials.app_key,
                "site": self._credentials.site,
                "clusterName": "tundra-dome",
                "logs": {"enabled": True},
                "apm": {"enabled": True},
                "processAgent": {"enabled": True},
            }
        }


def main():
    """CLI entry point for testing configuration."""
    import argparse

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    parser = argparse.ArgumentParser(description="Datadog Configuration Manager")
    parser.add_argument("--status", action="store_true", help="Show configuration status")
    parser.add_argument("--test", action="store_true", help="Test API connectivity")
    parser.add_argument("--validate", metavar="KEY", help="Validate an API key format")
    parser.add_argument(
        "--save-api-key", metavar="KEY", help="Save an API key to ~/.datadog/api_key"
    )
    parser.add_argument(
        "--no-prompt", action="store_true", help="Disable interactive prompts"
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    config = DatadogConfig(verbose=args.verbose)

    if args.validate:
        is_valid = config.validate_key_format(args.validate, "api")
        print(f"Key format valid: {is_valid}")
        return 0 if is_valid else 1

    if args.save_api_key:
        try:
            if config.save_api_key(args.save_api_key):
                print(f"API key saved to {config.api_key_file}")
                return 0
            else:
                print("Failed to save API key")
                return 1
        except InvalidKeyFormatError as e:
            print(f"Error: {e}")
            return 1

    if args.status:
        import json

        status = config.get_config_status()
        print(json.dumps(status, indent=2))
        return 0

    if args.test:
        try:
            api_key = config.get_api_key(prompt_if_missing=not args.no_prompt)
            if not api_key:
                print("No API key available")
                return 1

            print("Testing API connectivity...")
            if config.test_api_connectivity():
                print("SUCCESS: API key is valid and Datadog is reachable")
                return 0
            else:
                print("FAILED: Could not validate API key")
                return 1

        except DatadogConfigError as e:
            print(f"Error: {e}")
            return 1

    # Default: show status
    status = config.get_config_status()
    print("Datadog Configuration Status:")
    print(f"  API Key: {'Available' if status['api_key']['available'] else 'Not configured'}")
    print(f"  App Key: {'Available' if status['app_key']['available'] else 'Not configured'}")
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(main())