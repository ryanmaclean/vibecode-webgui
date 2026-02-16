#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "log_sanitizer"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "security"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation

try:
    import os as _os; _c = __import__('ddtrace').config; _s = _os.path.basename(__file__).replace('.py',''); _c.service = _s; _c.requests.service = _s; __import__('ddtrace').patch_all()
except: pass


# -- VibeCode Telemetry --
import sys
import os

# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
Log Sanitization Module

Sanitizes log entries by detecting and redacting sensitive data including:
- API keys (OpenAI, Anthropic, GitHub, AWS, Google, Datadog)
- OAuth tokens and bearer tokens
- Personal Identifiable Information (emails, phone numbers, SSNs, credit cards)
- Passwords in URLs and command outputs
- Private keys (RSA, SSH, PGP)
- JWT tokens
- Database connection strings

Usage:
    from scripts.security.log_sanitizer import sanitize_log_entry

    # Sanitize a simple string
    sanitized = sanitize_log_entry("API key: sk-1234567890")
    # Result: "API key: [REDACTED:API_KEY]"

    # Sanitize nested JSON structure
    data = {"command": "export KEY=sk-123", "output": "Success"}
    sanitized = sanitize_log_entry(data)
"""

import argparse
import json
import re
from typing import Any, Dict, List, Tuple


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


# API key patterns (from scripts/security/scan.py)
API_KEY_PATTERNS = [
    (r"sk-[a-zA-Z0-9]{40,}", "API_KEY", "OpenAI/OpenRouter API key"),
    (r"sk-ant-[a-zA-Z0-9]{40,}", "API_KEY", "Anthropic API key"),
    (r"ghp_[a-zA-Z0-9]{36}", "API_KEY", "GitHub Personal Access Token"),
    (r"gho_[a-zA-Z0-9]{36}", "API_KEY", "GitHub OAuth token"),
    (r"ghu_[a-zA-Z0-9]{36}", "API_KEY", "GitHub user token"),
    (r"ghs_[a-zA-Z0-9]{36}", "API_KEY", "GitHub server token"),
    (r"ghr_[a-zA-Z0-9]{36}", "API_KEY", "GitHub refresh token"),
    (r"AKIA[0-9A-Z]{16}", "API_KEY", "AWS Access Key ID"),
    (r"ya29\.[0-9A-Za-z\-_]+", "API_KEY", "Google OAuth access token"),
    # Catch shorter API key formats (test data, examples, or truncated keys)
    (r"\bsk-[a-zA-Z0-9]{3,39}\b", "API_KEY", "Short-form API key"),
]

# PII patterns
PII_PATTERNS = [
    # Email addresses
    (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "EMAIL", "Email address"),
    # US Phone numbers (various formats)
    (r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b", "PHONE", "Phone number"),
    # Social Security Numbers (US)
    (r"\b\d{3}-\d{2}-\d{4}\b", "SSN", "Social Security Number"),
    # Credit card numbers (basic pattern - 13-19 digits with optional spaces/dashes)
    (r"\b(?:\d{4}[-\s]?){3}\d{1,4}\b", "CREDIT_CARD", "Credit card number"),
]

# Password and credential patterns
PASSWORD_PATTERNS = [
    # Passwords in URLs (http://user:pass@host or https://user:pass@host)
    (r"(https?://[^:@\s]+):([^@\s]+)@", "PASSWORD", "Password in URL"),
    # Common password patterns in environment variables or configs
    (r"(?i)(password|passwd|pwd)\s*[=:]\s*['\"]?([^\s'\"]+)", "PASSWORD", "Password assignment"),
    # Bearer tokens
    (r"Bearer\s+[A-Za-z0-9\-._~+/]+=*", "BEARER_TOKEN", "Bearer token"),
    # Basic auth (base64)
    (r"Basic\s+[A-Za-z0-9+/]+=*", "BASIC_AUTH", "Basic auth token"),
]

# Private key patterns
PRIVATE_KEY_PATTERNS = [
    # RSA private keys
    (r"-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----", "PRIVATE_KEY", "RSA private key"),
    # SSH private keys
    (r"-----BEGIN OPENSSH PRIVATE KEY-----[\s\S]*?-----END OPENSSH PRIVATE KEY-----", "PRIVATE_KEY", "OpenSSH private key"),
    # PGP private keys
    (r"-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]*?-----END PGP PRIVATE KEY BLOCK-----", "PRIVATE_KEY", "PGP private key"),
    # Generic private keys
    (r"-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----", "PRIVATE_KEY", "Private key"),
    # EC private keys
    (r"-----BEGIN EC PRIVATE KEY-----[\s\S]*?-----END EC PRIVATE KEY-----", "PRIVATE_KEY", "EC private key"),
]

# JWT token pattern
JWT_PATTERNS = [
    # JWT tokens (header.payload.signature)
    (r"eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", "JWT_TOKEN", "JWT token"),
]

# Database connection string patterns
DATABASE_PATTERNS = [
    # PostgreSQL connection strings
    (r"postgresql://[^:\s]+:[^@\s]+@[^\s]+", "DB_CONNECTION", "PostgreSQL connection string"),
    (r"postgres://[^:\s]+:[^@\s]+@[^\s]+", "DB_CONNECTION", "PostgreSQL connection string"),
    # MySQL connection strings
    (r"mysql://[^:\s]+:[^@\s]+@[^\s]+", "DB_CONNECTION", "MySQL connection string"),
    # MongoDB connection strings
    (r"mongodb(?:\+srv)?://[^:\s]+:[^@\s]+@[^\s]+", "DB_CONNECTION", "MongoDB connection string"),
    # Redis connection strings
    (r"redis://[^:\s]+:[^@\s]+@[^\s]+", "DB_CONNECTION", "Redis connection string"),
]

# Datadog API key pattern (requires context to avoid false positives)
DATADOG_PATTERNS = [
    (r"(?i)(api[_\s.-]?key|datadog|dd[_\s.-]?api[_\s.-]?key)['\"\s:=]+([a-f0-9]{32})", "API_KEY", "Datadog API key"),
]

# Combine all patterns (order matters - more specific patterns first)
ALL_PATTERNS: List[Tuple[str, str, str]] = (
    PRIVATE_KEY_PATTERNS +  # Process private keys first (they can contain special chars)
    DATABASE_PATTERNS +      # Process database URLs before general password patterns
    PASSWORD_PATTERNS +      # Process password patterns before email (URLs contain @)
    API_KEY_PATTERNS +       # Process API keys
    JWT_PATTERNS +           # Process JWT tokens
    PII_PATTERNS +          # Process PII last (emails are more general)
    DATADOG_PATTERNS
)


def sanitize_string(text: str) -> str:
    """
    Sanitize a string by replacing sensitive data with redaction markers.

    Args:
        text: The string to sanitize

    Returns:
        The sanitized string with sensitive data replaced by [REDACTED:{type}] markers

    Example:
        >>> sanitize_string("My API key is sk-1234567890")
        'My API key is [REDACTED:API_KEY]'
    """
    if not isinstance(text, str):
        return text

    sanitized = text

    # Apply all patterns
    for pattern, redaction_type, description in ALL_PATTERNS:
        # Special handling for password patterns with capture groups
        if redaction_type == "PASSWORD" and "https?://" in pattern:
            # Replace password in URL while keeping structure
            sanitized = re.sub(pattern, r"\1:[REDACTED:PASSWORD]@", sanitized)
        elif redaction_type == "PASSWORD" and "password" in pattern.lower():
            # Replace password assignment value
            sanitized = re.sub(pattern, rf"\1=[REDACTED:PASSWORD]", sanitized, flags=re.IGNORECASE)
        elif redaction_type == "API_KEY" and "datadog" in description.lower():
            # Special handling for Datadog pattern with context
            sanitized = re.sub(pattern, rf"\1=[REDACTED:API_KEY]", sanitized, flags=re.IGNORECASE)
        else:
            # Standard replacement
            sanitized = re.sub(pattern, f"[REDACTED:{redaction_type}]", sanitized)

    return sanitized


def sanitize_log_entry(data: Any) -> Any:
    """
    Recursively sanitize a log entry (string, dict, list, or primitive).

    This function handles nested structures commonly found in JSON logs,
    sanitizing all string values while preserving the overall structure.

    Args:
        data: The data to sanitize (can be str, dict, list, or primitive types)

    Returns:
        The sanitized data with the same structure but sensitive strings redacted

    Example:
        >>> sanitize_log_entry({"cmd": "export KEY=sk-123", "result": "ok"})
        {'cmd': 'export KEY=[REDACTED:API_KEY]', 'result': 'ok'}
    """
    if isinstance(data, str):
        return sanitize_string(data)
    elif isinstance(data, dict):
        return {key: sanitize_log_entry(value) for key, value in data.items()}
    elif isinstance(data, list):
        return [sanitize_log_entry(item) for item in data]
    else:
        # Return primitives (int, float, bool, None) unchanged
        return data


def sanitize_task_log_entry(log_entry: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitize a task_logs.json entry structure.

    This is a specialized function for the task_logs.json structure used by
    the auto-claude orchestrator. It handles the specific fields that may
    contain sensitive data.

    Args:
        log_entry: A task log entry dict with fields like tool_input, detail, content

    Returns:
        The sanitized log entry with the same structure

    Example:
        >>> entry = {"tool_input": "export KEY=sk-123", "detail": "Success"}
        >>> sanitize_task_log_entry(entry)
        {'tool_input': 'export KEY=[REDACTED:API_KEY]', 'detail': 'Success'}
    """
    # Use the recursive sanitizer which handles nested structures
    return sanitize_log_entry(log_entry)


def main() -> int:
    """
    CLI entry point for log sanitization.

    Supports sanitizing text from:
    - Command line argument (--text)
    - File input (--file)
    - Standard input (default)

    Returns:
        0 on success, 1 on error
    """
    parser = argparse.ArgumentParser(
        description="Sanitize log entries by redacting sensitive data (API keys, passwords, PII, etc.)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Sanitize text from command line
  python log_sanitizer.py --text "API key: sk-1234567890"

  # Sanitize from file
  python log_sanitizer.py --file task_logs.json

  # Sanitize from stdin
  echo "Password: secret123" | python log_sanitizer.py

  # Sanitize JSON structure
  python log_sanitizer.py --text '{"key": "sk-123", "data": "ok"}' --json
        """
    )

    input_group = parser.add_mutually_exclusive_group()
    input_group.add_argument(
        "--text",
        type=str,
        help="Text to sanitize (command line argument)"
    )
    input_group.add_argument(
        "--file",
        type=str,
        help="File to sanitize (reads entire file)"
    )

    parser.add_argument(
        "--json",
        action="store_true",
        help="Parse input as JSON and output sanitized JSON"
    )

    parser.add_argument(
        "--output",
        type=str,
        help="Output file (default: stdout)"
    )

    args = parser.parse_args()

    try:
        # Get input data
        if args.text:
            input_data = args.text
        elif args.file:
            try:
                with open(args.file, 'r', encoding='utf-8') as f:
                    input_data = f.read()
            except FileNotFoundError:
                print(f"{Color.RED}❌ File not found: {args.file}{Color.NC}", file=sys.stderr)
                return 1
            except Exception as e:
                print(f"{Color.RED}❌ Error reading file: {e}{Color.NC}", file=sys.stderr)
                return 1
        else:
            # Read from stdin
            input_data = sys.stdin.read()

        # Process based on format
        if args.json:
            try:
                data = json.loads(input_data)
                sanitized = sanitize_log_entry(data)
                output = json.dumps(sanitized, indent=2, ensure_ascii=False)
            except json.JSONDecodeError as e:
                print(f"{Color.RED}❌ Invalid JSON: {e}{Color.NC}", file=sys.stderr)
                return 1
        else:
            # Treat as plain text
            sanitized = sanitize_string(input_data)
            output = sanitized

        # Write output
        if args.output:
            try:
                with open(args.output, 'w', encoding='utf-8') as f:
                    f.write(output)
                print(f"{Color.GREEN}✅ Sanitized output written to: {args.output}{Color.NC}")
            except Exception as e:
                print(f"{Color.RED}❌ Error writing output: {e}{Color.NC}", file=sys.stderr)
                return 1
        else:
            print(output)

        return 0

    except Exception as e:
        print(f"{Color.RED}❌ Error: {e}{Color.NC}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
