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
try:
    from scripts.lib.log_aggregation import get_log_aggregation
except ImportError:
    def get_log_aggregation():
        return None


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

The module provides both a Python API for programmatic use and a CLI for
command-line sanitization of log files and text streams.

Python API Usage:
    from scripts.security.log_sanitizer import sanitize_log_entry, sanitize_string

    # Sanitize a simple string
    sanitized = sanitize_log_entry("API key: sk-1234567890")
    # Result: "API key: [REDACTED:API_KEY]"

    # Sanitize nested JSON structure (preserves structure)
    data = {"command": "export KEY=sk-123", "output": "Success"}
    sanitized = sanitize_log_entry(data)
    # Result: {'command': 'export KEY=[REDACTED:API_KEY]', 'output': 'Success'}

    # Sanitize list of entries
    logs = ["User: john@example.com", "Token: Bearer abc123"]
    sanitized = sanitize_log_entry(logs)
    # Result: ['User: [REDACTED:EMAIL]', 'Token: [REDACTED:BEARER_TOKEN]']

    # Direct string sanitization (no nesting)
    text = "Connect to postgresql://user:pass@localhost/db"
    sanitized = sanitize_string(text)
    # Result: "Connect to [REDACTED:DB_CONNECTION]"

CLI Usage:
    # Sanitize text from command line
    python log_sanitizer.py --text "API key: sk-1234567890"

    # Sanitize a JSON log file
    python log_sanitizer.py --file task_logs.json --json --output sanitized.json

    # Pipe data through sanitizer
    cat logs.txt | python log_sanitizer.py

    # Sanitize JSON structure from command line
    python log_sanitizer.py --text '{"key": "sk-123"}' --json

Redaction Format:
    All sensitive data is replaced with [REDACTED:{TYPE}] markers where TYPE indicates
    the type of sensitive data detected:
    - [REDACTED:API_KEY] - API keys and tokens
    - [REDACTED:PASSWORD] - Passwords in URLs or assignments
    - [REDACTED:EMAIL] - Email addresses
    - [REDACTED:PHONE] - Phone numbers
    - [REDACTED:SSN] - Social Security Numbers
    - [REDACTED:CREDIT_CARD] - Credit card numbers
    - [REDACTED:PRIVATE_KEY] - Private cryptographic keys
    - [REDACTED:JWT_TOKEN] - JWT tokens
    - [REDACTED:DB_CONNECTION] - Database connection strings
    - [REDACTED:BEARER_TOKEN] - Bearer authentication tokens
    - [REDACTED:BASIC_AUTH] - Basic authentication credentials

Integration Example:
    # Sanitize logs before writing to file
    import json
    from scripts.security.log_sanitizer import sanitize_log_entry

    log_entry = {
        "timestamp": "2026-02-15T10:30:00Z",
        "command": "curl -H 'Authorization: Bearer secret-token-123'",
        "output": "Success",
        "user_email": "admin@example.com"
    }

    # Sanitize before writing
    sanitized = sanitize_log_entry(log_entry)
    with open('task_logs.json', 'w') as f:
        json.dump(sanitized, f, indent=2)

    # The logged entry will have sensitive data redacted:
    # {
    #   "timestamp": "2026-02-15T10:30:00Z",
    #   "command": "curl -H 'Authorization: [REDACTED:BEARER_TOKEN]'",
    #   "output": "Success",
    #   "user_email": "[REDACTED:EMAIL]"
    # }
"""

import argparse
import json
import re
from typing import Any, Dict, List, Literal, Tuple


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


# API key patterns (from scripts/security/scan.py)
API_KEY_PATTERNS = [
    (r"sk-ant-[a-zA-Z0-9-]{20,}", "API_KEY", "Anthropic API key"),
    (r"sk-[a-zA-Z0-9-]{40,}", "API_KEY", "OpenAI/OpenRouter API key"),
    (r"ghp_[a-zA-Z0-9]{36}", "API_KEY", "GitHub Personal Access Token"),
    (r"gho_[a-zA-Z0-9]{36}", "API_KEY", "GitHub OAuth token"),
    (r"ghu_[a-zA-Z0-9]{36}", "API_KEY", "GitHub user token"),
    (r"ghs_[a-zA-Z0-9]{36}", "API_KEY", "GitHub server token"),
    (r"ghr_[a-zA-Z0-9]{36}", "API_KEY", "GitHub refresh token"),
    (r"AKIA[0-9A-Z]{16}", "API_KEY", "AWS Access Key ID"),
    (r"ya29\.[0-9A-Za-z\-_]+", "API_KEY", "Google OAuth access token"),
    # Catch shorter API key formats (test data, examples, or truncated keys)
    (r"\bsk-[a-zA-Z0-9-]{3,39}\b", "API_KEY", "Short-form API key"),
]

# PII patterns
PII_PATTERNS = [
    # Email addresses
    (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", "EMAIL", "Email address"),
    # US Phone numbers (various formats)
    (r"(?<!\d)(?:\+?1[-.\s])?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?!\d)", "PHONE", "Phone number"),
    # Social Security Numbers (US)
    (r"\b\d{3}-\d{2}-\d{4}\b", "SSN", "Social Security Number"),
    # Credit card numbers (basic pattern - 13-19 digits with optional spaces/dashes)
    (r"\b(?:\d{4}[-\s]?){3}\d{1,4}\b", "CREDIT_CARD", "Credit card number"),
]

# Password and credential patterns
PASSWORD_PATTERNS = [
    # Passwords in URLs (http://user:pass@host or https://user:pass@host)
    (r"(https?://[^:/@\s]+):(.+?)@([^/\s]+)", "PASSWORD", "Password in URL", "url_password"),
    # Common password patterns in environment variables or configs
    (r"(?i)(password|passwd|pwd)(\s*[=:]\s*)['\"]?([^\s'\"]+)", "PASSWORD", "Password assignment", "password_assignment"),
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
    (r"(?i)(api[_\s.-]?key|datadog|dd[_\s.-]?api[_\s.-]?key)(['\"\s:=]+)([a-f0-9]{32})", "API_KEY", "Datadog API key", "datadog_context"),
]

PatternStrategy = Literal["default", "url_password", "password_assignment", "datadog_context"]
PatternDefinition = Tuple[str, str, str]
PatternDefinitionWithStrategy = Tuple[str, str, str, PatternStrategy]

# Combine all patterns (order matters - more specific patterns first)
ALL_PATTERNS: List[PatternDefinition | PatternDefinitionWithStrategy] = (
    PRIVATE_KEY_PATTERNS +  # Process private keys first (they can contain special chars)
    DATABASE_PATTERNS +      # Process database URLs before general password patterns
    PASSWORD_PATTERNS +      # Process password patterns before email (URLs contain @)
    API_KEY_PATTERNS +       # Process API keys
    DATADOG_PATTERNS +       # Process Datadog context before general PII matching
    JWT_PATTERNS +           # Process JWT tokens
    PII_PATTERNS            # Process PII last (emails are more general)
)


def sanitize_string(text: str) -> str:
    """
    Sanitize a string by replacing sensitive data with redaction markers.

    This function applies pattern matching to detect and redact various types of
    sensitive data. It handles multiple redaction types including API keys,
    passwords, PII, private keys, and database credentials.

    Args:
        text: The string to sanitize. Can contain any text including command
              outputs, log messages, or configuration values.

    Returns:
        The sanitized string with sensitive data replaced by [REDACTED:{type}]
        markers. If the input is not a string, it is returned unchanged.

    Examples:
        >>> sanitize_string("My API key is sk-1234567890")
        'My API key is [REDACTED:API_KEY]'

        >>> sanitize_string("Email: user@example.com, Phone: 555-123-4567")
        'Email: [REDACTED:EMAIL], Phone: [REDACTED:PHONE]'

        >>> sanitize_string("https://user:password@api.example.com")
        'https://user:[REDACTED:PASSWORD]@api.example.com'

        >>> sanitize_string("Connect: postgresql://admin:secret@localhost/db")
        'Connect: [REDACTED:DB_CONNECTION]'

        >>> sanitize_string("Authorization: Bearer eyJhbGc...")
        'Authorization: [REDACTED:BEARER_TOKEN]'

    Note:
        This function processes the entire string and may redact multiple
        instances of sensitive data. Pattern matching is case-insensitive
        where appropriate (e.g., password assignments).
    """
    if not isinstance(text, str):
        return text

    sanitized = text

    # Apply all patterns
    for pattern_entry in ALL_PATTERNS:
        if len(pattern_entry) == 4:
            pattern, redaction_type, _description, strategy = pattern_entry
        else:
            pattern, redaction_type, _description = pattern_entry
            strategy = "default"

        # Special handling for patterns with capture groups
        if strategy == "url_password":
            # Preserve username/host while redacting the password segment.
            sanitized = re.sub(pattern, r"\1:[REDACTED:PASSWORD]@\3", sanitized)
        elif strategy == "password_assignment":
            # Preserve original separator formatting (: or =) and spacing.
            sanitized = re.sub(pattern, r"\1\2[REDACTED:PASSWORD]", sanitized, flags=re.IGNORECASE)
        elif strategy == "datadog_context":
            # Preserve contextual key text and separator while redacting value.
            sanitized = re.sub(pattern, r"\1\2[REDACTED:API_KEY]", sanitized, flags=re.IGNORECASE)
        else:
            # Standard replacement
            sanitized = re.sub(pattern, f"[REDACTED:{redaction_type}]", sanitized)

    return sanitized


def sanitize_log_entry(data: Any, _depth: int = 0, _max_depth: int = 25) -> Any:
    """
    Recursively sanitize a log entry (string, dict, list, or primitive).

    This is the main entry point for sanitizing complex log structures. It
    handles nested dictionaries, lists, and mixed structures commonly found
    in JSON logs, sanitizing all string values while preserving the overall
    data structure and non-string values.

    The function recursively traverses the data structure:
    - Strings are sanitized using sanitize_string()
    - Dictionaries have all values sanitized (keys are preserved)
    - Lists have all elements sanitized
    - Primitives (int, float, bool, None) are returned unchanged

    Args:
        data: The data to sanitize. Can be:
              - str: Direct string sanitization
              - dict: Recursive sanitization of all values
              - list: Recursive sanitization of all elements
              - Primitives (int, float, bool, None): Returned unchanged

    Returns:
        The sanitized data with the same structure but sensitive strings
        redacted. The return type matches the input type.

    Examples:
        >>> sanitize_log_entry({"cmd": "export KEY=sk-123", "result": "ok"})
        {'cmd': 'export KEY=[REDACTED:API_KEY]', 'result': 'ok'}

        >>> sanitize_log_entry(["user@example.com", "success", 42, True])
        ['[REDACTED:EMAIL]', 'success', 42, True]

        >>> log = {
        ...     "user": {"email": "admin@example.com", "id": 123},
        ...     "action": "login",
        ...     "token": "Bearer abc123xyz"
        ... }
        >>> sanitize_log_entry(log)
        {'user': {'email': '[REDACTED:EMAIL]', 'id': 123}, 'action': 'login', 'token': '[REDACTED:BEARER_TOKEN]'}

        >>> sanitize_log_entry("Simple string with sk-abc123")
        'Simple string with [REDACTED:API_KEY]'

        >>> sanitize_log_entry(42)
        42

    Note:
        This function is designed to be safe for use with any JSON-serializable
        data structure. It preserves types and structure, only modifying string
        values that contain sensitive data.
    """
    if _depth >= _max_depth:
        return data

    if isinstance(data, str):
        return sanitize_string(data)
    elif isinstance(data, dict):
        return {key: sanitize_log_entry(value, _depth=_depth + 1, _max_depth=_max_depth) for key, value in data.items()}
    elif isinstance(data, list):
        return [sanitize_log_entry(item, _depth=_depth + 1, _max_depth=_max_depth) for item in data]
    else:
        # Return primitives (int, float, bool, None) unchanged
        return data


def sanitize_task_log_entry(log_entry: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitize a task_logs.json entry structure.

    This is a specialized function for the task_logs.json structure used by
    the auto-claude orchestrator. It handles the specific fields that may
    contain sensitive data such as tool_input, detail, content, and nested
    structures.

    This function is a convenience wrapper around sanitize_log_entry() that
    provides type hints specific to the task logging use case. It handles
    common task log fields including:
    - tool_input: Command inputs that may contain credentials
    - detail: Detailed output that may contain API responses
    - content: Log content with potential sensitive data
    - error: Error messages that may leak sensitive information
    - result: Tool execution results

    Args:
        log_entry: A task log entry dict with fields like tool_input, detail,
                   content, result, etc. The exact structure can vary but
                   typically includes metadata and execution details.

    Returns:
        The sanitized log entry with the same structure. All string fields
        that contain sensitive data will have it redacted, while preserving
        the overall log structure and non-sensitive data.

    Examples:
        >>> entry = {"tool_input": "export KEY=sk-123", "detail": "Success"}
        >>> sanitize_task_log_entry(entry)
        {'tool_input': 'export KEY=[REDACTED:API_KEY]', 'detail': 'Success'}

        >>> log = {
        ...     "timestamp": "2026-02-15T10:30:00Z",
        ...     "tool": "Bash",
        ...     "tool_input": "curl -H 'Authorization: Bearer token123'",
        ...     "result": {"status": "ok", "user": "admin@example.com"}
        ... }
        >>> sanitize_task_log_entry(log)
        {'timestamp': '2026-02-15T10:30:00Z', 'tool': 'Bash', 'tool_input': "curl -H 'Authorization: [REDACTED:BEARER_TOKEN]'", 'result': {'status': 'ok', 'user': '[REDACTED:EMAIL]'}}

        >>> error_log = {
        ...     "error": "Authentication failed for user john@example.com",
        ...     "credentials": "password=secret123"
        ... }
        >>> sanitize_task_log_entry(error_log)
        {'error': 'Authentication failed for user [REDACTED:EMAIL]', 'credentials': '[REDACTED:PASSWORD]'}

    Note:
        This function is specifically designed for task_logs.json entries but
        can be used with any dictionary structure. It delegates to
        sanitize_log_entry() for the actual sanitization work.
    """
    # Use the recursive sanitizer which handles nested structures
    return sanitize_log_entry(log_entry)


def main() -> int:
    """
    CLI entry point for log sanitization.

    Provides a command-line interface for sanitizing logs and text. Supports
    multiple input methods and output formats for flexible integration into
    scripts and pipelines.

    Input Methods (mutually exclusive):
        --text TEXT     Sanitize text provided as command line argument
        --file FILE     Sanitize contents of a file
        (default)       Read from standard input (stdin)

    Output Options:
        --json          Parse input as JSON and output sanitized JSON
                        (preserves structure, useful for log files)
        --output FILE   Write output to file instead of stdout

    The CLI supports both plain text and JSON modes:
    - Plain text mode: Treats input as a single string
    - JSON mode: Parses input as JSON, sanitizes recursively, outputs JSON

    Returns:
        0 on success (sanitization completed)
        1 on error (file not found, invalid JSON, write error, etc.)

    Exit Codes:
        0: Success - sanitization completed
        1: Error - see stderr for details

    Examples:
        # Sanitize text from command line
        $ python log_sanitizer.py --text "API key: sk-1234567890"
        API key: [REDACTED:API_KEY]

        # Sanitize a JSON log file
        $ python log_sanitizer.py --file task_logs.json --json --output clean.json
        ✅ Sanitized output written to: clean.json

        # Pipe logs through sanitizer
        $ cat application.log | python log_sanitizer.py
        [REDACTED:EMAIL] logged in at 10:30 AM

        # Sanitize JSON from command line
        $ python log_sanitizer.py --text '{"key":"sk-123","user":"john@example.com"}' --json
        {
          "key": "[REDACTED:API_KEY]",
          "user": "[REDACTED:EMAIL]"
        }

        # Chain with other commands
        $ tail -f logs.txt | python log_sanitizer.py | tee sanitized.log

    Error Handling:
        - File not found: Prints error to stderr, exits with code 1
        - Invalid JSON: Prints parse error to stderr, exits with code 1
        - Write errors: Prints error to stderr, exits with code 1
        - All errors are colored red for visibility

    Notes:
        - Input is read as UTF-8
        - Output preserves UTF-8 characters (ensure_ascii=False)
        - JSON output is pretty-printed with 2-space indentation
        - Success messages are colored green when writing to files
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
        if args.text is not None:
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
