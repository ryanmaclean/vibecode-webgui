#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "test-log-sanitizer"
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
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Tests for log sanitization script."""

import unittest

from scripts.security.log_sanitizer import (
    Color,
    sanitize_string,
    sanitize_log_entry,
    sanitize_task_log_entry,
)


class TestColor(unittest.TestCase):
    """Tests for Color class."""

    def test_color_codes_defined(self):
        """Test that all color codes are defined."""
        self.assertIsNotNone(Color.RED)
        self.assertIsNotNone(Color.GREEN)
        self.assertIsNotNone(Color.YELLOW)
        self.assertIsNotNone(Color.BLUE)
        self.assertIsNotNone(Color.NC)

    def test_color_codes_are_strings(self):
        """Test that color codes are strings."""
        self.assertIsInstance(Color.RED, str)
        self.assertIsInstance(Color.GREEN, str)
        self.assertIsInstance(Color.NC, str)

    def test_color_codes_are_ansi(self):
        """Test that color codes are ANSI escape sequences."""
        self.assertTrue(Color.RED.startswith('\033['))
        self.assertTrue(Color.GREEN.startswith('\033['))


class TestSanitizeStringAPIKeys(unittest.TestCase):
    """Tests for sanitizing API keys."""

    def test_openai_api_key(self):
        """Test OpenAI API key detection."""
        text = "API_KEY=sk-1234567890abcdef1234567890abcdef1234567890ab"
        result = sanitize_string(text)
        self.assertNotIn("sk-1234567890abcdef", result)
        self.assertIn("[REDACTED:API_KEY]", result)

    def test_short_openai_api_key(self):
        """Test short-form OpenAI API key detection."""
        text = "export KEY=sk-123"
        result = sanitize_string(text)
        self.assertNotIn("sk-123", result)
        self.assertIn("[REDACTED:API_KEY]", result)

    def test_anthropic_api_key(self):
        """Test Anthropic API key detection."""
        text = "ANTHROPIC_KEY=sk-ant-api03-1234567890abcdef1234567890abcdef1234567890ab"
        result = sanitize_string(text)
        self.assertNotIn("sk-ant-api03", result)
        self.assertIn("[REDACTED:API_KEY]", result)

    def test_github_personal_access_token(self):
        """Test GitHub personal access token detection."""
        text = "GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz"
        result = sanitize_string(text)
        self.assertNotIn("ghp_1234567890abcdefghijklmnopqrstuvwxyz", result)
        self.assertIn("[REDACTED:API_KEY]", result)

    def test_github_oauth_token(self):
        """Test GitHub OAuth token detection."""
        text = "gho_1234567890abcdefghijklmnopqrstuvwxyz"
        result = sanitize_string(text)
        self.assertNotIn("gho_1234567890abcdefghijklmnopqrstuvwxyz", result)
        self.assertIn("[REDACTED:API_KEY]", result)

    def test_github_user_token(self):
        """Test GitHub user token detection."""
        text = "ghu_1234567890abcdefghijklmnopqrstuvwxyz"
        result = sanitize_string(text)
        self.assertNotIn("ghu_1234567890abcdefghijklmnopqrstuvwxyz", result)
        self.assertIn("[REDACTED:API_KEY]", result)

    def test_github_server_token(self):
        """Test GitHub server token detection."""
        text = "ghs_1234567890abcdefghijklmnopqrstuvwxyz"
        result = sanitize_string(text)
        self.assertNotIn("ghs_1234567890abcdefghijklmnopqrstuvwxyz", result)
        self.assertIn("[REDACTED:API_KEY]", result)

    def test_github_refresh_token(self):
        """Test GitHub refresh token detection."""
        text = "ghr_1234567890abcdefghijklmnopqrstuvwxyz"
        result = sanitize_string(text)
        self.assertNotIn("ghr_1234567890abcdefghijklmnopqrstuvwxyz", result)
        self.assertIn("[REDACTED:API_KEY]", result)

    def test_aws_access_key(self):
        """Test AWS access key detection."""
        text = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE"
        result = sanitize_string(text)
        self.assertNotIn("AKIAIOSFODNN7EXAMPLE", result)
        self.assertIn("[REDACTED:API_KEY]", result)

    def test_google_oauth_token(self):
        """Test Google OAuth access token detection."""
        text = "ACCESS_TOKEN=ya29.a0AfH6SMBxyz123abc456def"
        result = sanitize_string(text)
        self.assertNotIn("ya29.a0AfH6SMBxyz123abc456def", result)
        self.assertIn("[REDACTED:API_KEY]", result)

    def test_datadog_api_key(self):
        """Test Datadog API key detection."""
        text = "dd_api_key=1234567890abcdef1234567890abcdef"
        result = sanitize_string(text)
        self.assertNotIn("1234567890abcdef1234567890abcdef", result)
        self.assertIn("[REDACTED:API_KEY]", result)


class TestSanitizeStringPII(unittest.TestCase):
    """Tests for sanitizing PII data."""

    def test_email_address(self):
        """Test email address detection."""
        text = "Contact: user@example.com for support"
        result = sanitize_string(text)
        self.assertNotIn("user@example.com", result)
        self.assertIn("[REDACTED:EMAIL]", result)

    def test_multiple_emails(self):
        """Test multiple email addresses detection."""
        text = "Send to alice@test.com and bob@example.org"
        result = sanitize_string(text)
        self.assertNotIn("alice@test.com", result)
        self.assertNotIn("bob@example.org", result)
        self.assertEqual(result.count("[REDACTED:EMAIL]"), 2)

    def test_phone_number_standard(self):
        """Test standard US phone number detection."""
        text = "Call me at 555-123-4567"
        result = sanitize_string(text)
        self.assertNotIn("555-123-4567", result)
        self.assertIn("[REDACTED:PHONE]", result)

    def test_phone_number_with_parentheses(self):
        """Test phone number with parentheses detection."""
        text = "Phone: (555) 123-4567"
        result = sanitize_string(text)
        self.assertNotIn("(555) 123-4567", result)
        self.assertIn("[REDACTED:PHONE]", result)

    def test_phone_number_with_plus(self):
        """Test phone number with country code detection."""
        text = "Mobile: +1-555-123-4567"
        result = sanitize_string(text)
        self.assertNotIn("+1-555-123-4567", result)
        self.assertIn("[REDACTED:PHONE]", result)

    def test_ssn(self):
        """Test Social Security Number detection."""
        text = "SSN: 123-45-6789"
        result = sanitize_string(text)
        self.assertNotIn("123-45-6789", result)
        self.assertIn("[REDACTED:SSN]", result)

    def test_credit_card_with_spaces(self):
        """Test credit card number with spaces detection."""
        text = "Card: 4532 1234 5678 9010"
        result = sanitize_string(text)
        self.assertNotIn("4532 1234 5678 9010", result)
        self.assertIn("[REDACTED:CREDIT_CARD]", result)

    def test_credit_card_with_dashes(self):
        """Test credit card number with dashes detection."""
        text = "Card: 4532-1234-5678-9010"
        result = sanitize_string(text)
        self.assertNotIn("4532-1234-5678-9010", result)
        self.assertIn("[REDACTED:CREDIT_CARD]", result)

    def test_credit_card_no_separators(self):
        """Test credit card number without separators detection."""
        text = "Card: 4532123456789010"
        result = sanitize_string(text)
        self.assertNotIn("4532123456789010", result)
        self.assertIn("[REDACTED:CREDIT_CARD]", result)


class TestSanitizeStringPasswords(unittest.TestCase):
    """Tests for sanitizing passwords and credentials."""

    def test_password_in_http_url(self):
        """Test password in HTTP URL detection."""
        text = "http://user:secret123@example.com/path"
        result = sanitize_string(text)
        self.assertNotIn("secret123", result)
        self.assertIn("[REDACTED:PASSWORD]", result)
        self.assertIn("http://user:", result)
        self.assertIn("@example.com", result)

    def test_password_in_https_url(self):
        """Test password in HTTPS URL detection."""
        text = "https://admin:p@ssw0rd@api.example.com"
        result = sanitize_string(text)
        self.assertNotIn("p@ssw0rd", result)
        self.assertIn("[REDACTED:PASSWORD]", result)

    def test_password_assignment_equals(self):
        """Test password assignment with equals detection."""
        text = "password=MySecretPass123"
        result = sanitize_string(text)
        self.assertNotIn("MySecretPass123", result)
        self.assertIn("[REDACTED:PASSWORD]", result)

    def test_password_assignment_colon(self):
        """Test password assignment with colon detection."""
        text = "PASSWORD: AdminPass456"
        result = sanitize_string(text)
        self.assertNotIn("AdminPass456", result)
        self.assertIn("[REDACTED:PASSWORD]", result)

    def test_passwd_assignment(self):
        """Test passwd variant detection."""
        text = "passwd='secret123'"
        result = sanitize_string(text)
        self.assertNotIn("secret123", result)
        self.assertIn("[REDACTED:PASSWORD]", result)

    def test_pwd_assignment(self):
        """Test pwd variant detection."""
        text = 'pwd="pass1234"'
        result = sanitize_string(text)
        self.assertNotIn("pass1234", result)
        self.assertIn("[REDACTED:PASSWORD]", result)

    def test_bearer_token(self):
        """Test Bearer token detection."""
        text = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
        result = sanitize_string(text)
        self.assertNotIn("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", result)
        self.assertIn("[REDACTED:BEARER_TOKEN]", result)

    def test_basic_auth(self):
        """Test Basic auth token detection."""
        text = "Authorization: Basic dXNlcjpwYXNzd29yZA=="
        result = sanitize_string(text)
        self.assertNotIn("Basic dXNlcjpwYXNzd29yZA==", result)
        self.assertIn("[REDACTED:BASIC_AUTH]", result)


class TestSanitizeStringPrivateKeys(unittest.TestCase):
    """Tests for sanitizing private keys."""

    def test_rsa_private_key(self):
        """Test RSA private key detection."""
        text = """-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdef
-----END RSA PRIVATE KEY-----"""
        result = sanitize_string(text)
        self.assertNotIn("MIIEpAIBAAKCAQEA1234567890abcdef", result)
        self.assertIn("[REDACTED:PRIVATE_KEY]", result)

    def test_openssh_private_key(self):
        """Test OpenSSH private key detection."""
        text = """-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUA
-----END OPENSSH PRIVATE KEY-----"""
        result = sanitize_string(text)
        self.assertNotIn("b3BlbnNzaC1rZXktdjEAAAAABG5vbmUA", result)
        self.assertIn("[REDACTED:PRIVATE_KEY]", result)

    def test_pgp_private_key(self):
        """Test PGP private key detection."""
        text = """-----BEGIN PGP PRIVATE KEY BLOCK-----
Version: GnuPG v2
lQOYBFxyz123
-----END PGP PRIVATE KEY BLOCK-----"""
        result = sanitize_string(text)
        self.assertNotIn("lQOYBFxyz123", result)
        self.assertIn("[REDACTED:PRIVATE_KEY]", result)

    def test_generic_private_key(self):
        """Test generic private key detection."""
        text = """-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC1234
-----END PRIVATE KEY-----"""
        result = sanitize_string(text)
        self.assertNotIn("MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC1234", result)
        self.assertIn("[REDACTED:PRIVATE_KEY]", result)

    def test_ec_private_key(self):
        """Test EC private key detection."""
        text = """-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIAbcdef1234567890
-----END EC PRIVATE KEY-----"""
        result = sanitize_string(text)
        self.assertNotIn("MHcCAQEEIAbcdef1234567890", result)
        self.assertIn("[REDACTED:PRIVATE_KEY]", result)


class TestSanitizeStringJWT(unittest.TestCase):
    """Tests for sanitizing JWT tokens."""

    def test_jwt_token(self):
        """Test JWT token detection."""
        text = "Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        result = sanitize_string(text)
        self.assertNotIn("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", result)
        self.assertIn("[REDACTED:JWT_TOKEN]", result)

    def test_jwt_in_authorization_header(self):
        """Test JWT in authorization header."""
        text = "Authorization: eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJodHRwczovL2V4YW1wbGUuY29tIn0.abcdef123456"
        result = sanitize_string(text)
        self.assertNotIn("eyJhbGciOiJSUzI1NiJ9", result)
        self.assertIn("[REDACTED:JWT_TOKEN]", result)


class TestSanitizeStringDatabaseConnections(unittest.TestCase):
    """Tests for sanitizing database connection strings."""

    def test_postgresql_connection(self):
        """Test PostgreSQL connection string detection."""
        text = "DB_URL=postgresql://user:password123@localhost:5432/mydb"
        result = sanitize_string(text)
        self.assertNotIn("password123", result)
        self.assertIn("[REDACTED:DB_CONNECTION]", result)

    def test_postgres_connection(self):
        """Test Postgres connection string detection."""
        text = "postgres://admin:secret@db.example.com/prod"
        result = sanitize_string(text)
        self.assertNotIn("secret", result)
        self.assertIn("[REDACTED:DB_CONNECTION]", result)

    def test_mysql_connection(self):
        """Test MySQL connection string detection."""
        text = "mysql://root:rootpass@localhost:3306/app"
        result = sanitize_string(text)
        self.assertNotIn("rootpass", result)
        self.assertIn("[REDACTED:DB_CONNECTION]", result)

    def test_mongodb_connection(self):
        """Test MongoDB connection string detection."""
        text = "mongodb://user:pass123@mongo.example.com:27017/db"
        result = sanitize_string(text)
        self.assertNotIn("pass123", result)
        self.assertIn("[REDACTED:DB_CONNECTION]", result)

    def test_mongodb_srv_connection(self):
        """Test MongoDB SRV connection string detection."""
        text = "mongodb+srv://admin:adminpass@cluster.mongodb.net/mydb"
        result = sanitize_string(text)
        self.assertNotIn("adminpass", result)
        self.assertIn("[REDACTED:DB_CONNECTION]", result)

    def test_redis_connection(self):
        """Test Redis connection string detection."""
        text = "redis://user:redispass@redis.example.com:6379"
        result = sanitize_string(text)
        self.assertNotIn("redispass", result)
        self.assertIn("[REDACTED:DB_CONNECTION]", result)


class TestSanitizeLogEntry(unittest.TestCase):
    """Tests for sanitize_log_entry function."""

    def test_sanitize_string_input(self):
        """Test sanitizing a plain string."""
        text = "API key: sk-1234567890abcdef1234567890abcdef1234567890ab"
        result = sanitize_log_entry(text)
        self.assertNotIn("sk-1234567890", result)
        self.assertIn("[REDACTED:API_KEY]", result)

    def test_sanitize_dict_input(self):
        """Test sanitizing a dictionary."""
        data = {
            "command": "export API_KEY=sk-1234567890abcdef1234567890abcdef1234567890ab",
            "output": "Success"
        }
        result = sanitize_log_entry(data)
        self.assertNotIn("sk-1234567890", str(result))
        self.assertIn("[REDACTED:API_KEY]", result["command"])
        self.assertEqual(result["output"], "Success")

    def test_sanitize_list_input(self):
        """Test sanitizing a list."""
        data = [
            "user@example.com",
            "Clean text",
            "password=secret123"
        ]
        result = sanitize_log_entry(data)
        self.assertIn("[REDACTED:EMAIL]", result[0])
        self.assertEqual(result[1], "Clean text")
        self.assertIn("[REDACTED:PASSWORD]", result[2])

    def test_sanitize_nested_structure(self):
        """Test sanitizing nested dictionaries and lists."""
        data = {
            "config": {
                "api_key": "sk-1234567890abcdef1234567890abcdef1234567890ab",
                "users": [
                    {"email": "alice@example.com", "role": "admin"},
                    {"email": "bob@example.com", "role": "user"}
                ]
            },
            "status": "active"
        }
        result = sanitize_log_entry(data)
        self.assertNotIn("sk-1234567890", str(result))
        self.assertNotIn("alice@example.com", str(result))
        self.assertNotIn("bob@example.com", str(result))
        self.assertIn("[REDACTED:API_KEY]", result["config"]["api_key"])
        self.assertIn("[REDACTED:EMAIL]", result["config"]["users"][0]["email"])
        self.assertIn("[REDACTED:EMAIL]", result["config"]["users"][1]["email"])
        self.assertEqual(result["config"]["users"][0]["role"], "admin")
        self.assertEqual(result["status"], "active")

    def test_sanitize_primitives(self):
        """Test that primitive types are preserved."""
        self.assertEqual(sanitize_log_entry(42), 42)
        self.assertEqual(sanitize_log_entry(3.14), 3.14)
        self.assertEqual(sanitize_log_entry(True), True)
        self.assertEqual(sanitize_log_entry(False), False)
        self.assertEqual(sanitize_log_entry(None), None)

    def test_sanitize_empty_string(self):
        """Test sanitizing empty string."""
        result = sanitize_log_entry("")
        self.assertEqual(result, "")

    def test_sanitize_empty_dict(self):
        """Test sanitizing empty dictionary."""
        result = sanitize_log_entry({})
        self.assertEqual(result, {})

    def test_sanitize_empty_list(self):
        """Test sanitizing empty list."""
        result = sanitize_log_entry([])
        self.assertEqual(result, [])

    def test_non_string_values_unchanged(self):
        """Test that non-string values in structures are unchanged."""
        data = {
            "count": 100,
            "ratio": 0.75,
            "enabled": True,
            "value": None,
            "items": [1, 2, 3]
        }
        result = sanitize_log_entry(data)
        self.assertEqual(result["count"], 100)
        self.assertEqual(result["ratio"], 0.75)
        self.assertEqual(result["enabled"], True)
        self.assertEqual(result["value"], None)
        self.assertEqual(result["items"], [1, 2, 3])


class TestSanitizeTaskLogEntry(unittest.TestCase):
    """Tests for sanitize_task_log_entry function."""

    def test_sanitize_basic_log_entry(self):
        """Test sanitizing a basic task log entry."""
        entry = {
            "tool_input": "export API_KEY=sk-1234567890abcdef1234567890abcdef1234567890ab",
            "detail": "Command executed successfully"
        }
        result = sanitize_task_log_entry(entry)
        self.assertNotIn("sk-1234567890", str(result))
        self.assertIn("[REDACTED:API_KEY]", result["tool_input"])
        self.assertEqual(result["detail"], "Command executed successfully")

    def test_sanitize_log_entry_with_content(self):
        """Test sanitizing log entry with content field."""
        entry = {
            "tool_input": "cat config.json",
            "content": '{"db": "postgresql://user:pass@localhost/db"}',
            "detail": "File read"
        }
        result = sanitize_task_log_entry(entry)
        self.assertNotIn("pass", result["content"])
        self.assertIn("[REDACTED:DB_CONNECTION]", result["content"])

    def test_sanitize_log_entry_with_nested_data(self):
        """Test sanitizing log entry with nested data structures."""
        entry = {
            "tool_input": "process_data",
            "detail": {
                "status": "success",
                "user_info": {
                    "email": "admin@example.com",
                    "phone": "555-123-4567"
                },
                "credentials": {
                    "api_key": "sk-1234567890abcdef1234567890abcdef1234567890ab"
                }
            }
        }
        result = sanitize_task_log_entry(entry)
        self.assertNotIn("admin@example.com", str(result))
        self.assertNotIn("555-123-4567", str(result))
        self.assertNotIn("sk-1234567890", str(result))
        self.assertIn("[REDACTED:EMAIL]", result["detail"]["user_info"]["email"])
        self.assertIn("[REDACTED:PHONE]", result["detail"]["user_info"]["phone"])
        self.assertIn("[REDACTED:API_KEY]", result["detail"]["credentials"]["api_key"])
        self.assertEqual(result["detail"]["status"], "success")

    def test_preserve_log_structure(self):
        """Test that log entry structure is preserved."""
        entry = {
            "timestamp": "2026-02-15T10:30:00Z",
            "tool": "bash",
            "tool_input": "echo 'password=secret123'",
            "detail": "ok",
            "metadata": {
                "duration": 0.05,
                "exit_code": 0
            }
        }
        result = sanitize_task_log_entry(entry)
        self.assertEqual(result["timestamp"], entry["timestamp"])
        self.assertEqual(result["tool"], entry["tool"])
        self.assertIn("[REDACTED:PASSWORD]", result["tool_input"])
        self.assertEqual(result["detail"], entry["detail"])
        self.assertEqual(result["metadata"]["duration"], entry["metadata"]["duration"])
        self.assertEqual(result["metadata"]["exit_code"], entry["metadata"]["exit_code"])


class TestEdgeCases(unittest.TestCase):
    """Tests for edge cases and data preservation."""

    def test_very_long_string(self):
        """Test handling of very long strings."""
        # Create a long string with a secret in the middle
        long_text = "x" * 10000 + " sk-1234567890abcdef1234567890abcdef1234567890ab " + "y" * 10000
        result = sanitize_string(long_text)
        self.assertNotIn("sk-1234567890", result)
        self.assertIn("[REDACTED:API_KEY]", result)
        # Verify the rest of the string is preserved
        self.assertIn("x" * 100, result)
        self.assertIn("y" * 100, result)

    def test_multiple_secrets_in_one_string(self):
        """Test handling multiple different secrets in one string."""
        text = "User: admin@example.com, API: sk-1234567890abcdef1234567890abcdef1234567890ab, Phone: 555-123-4567"
        result = sanitize_string(text)
        self.assertNotIn("admin@example.com", result)
        self.assertNotIn("sk-1234567890", result)
        self.assertNotIn("555-123-4567", result)
        self.assertIn("[REDACTED:EMAIL]", result)
        self.assertIn("[REDACTED:API_KEY]", result)
        self.assertIn("[REDACTED:PHONE]", result)

    def test_legitimate_text_preserved(self):
        """Test that legitimate text is not modified."""
        text = "This is a normal log message without any secrets. Count: 123, Status: ok"
        result = sanitize_string(text)
        self.assertEqual(result, text)

    def test_code_patterns_preserved(self):
        """Test that legitimate code patterns are preserved."""
        text = "function authenticate() { return true; }"
        result = sanitize_string(text)
        self.assertEqual(result, text)

    def test_urls_without_credentials_preserved(self):
        """Test that URLs without credentials are preserved."""
        text = "Visit https://example.com/api/docs for more info"
        result = sanitize_string(text)
        self.assertEqual(result, text)

    def test_mixed_content(self):
        """Test mixed content with secrets and normal text."""
        data = {
            "logs": [
                "Starting application...",
                "Connecting to database: postgresql://user:secret@localhost/db",
                "Connection successful",
                "API key loaded: sk-1234567890abcdef1234567890abcdef1234567890ab",
                "Server listening on port 3000"
            ],
            "count": 5
        }
        result = sanitize_log_entry(data)
        self.assertEqual(result["logs"][0], "Starting application...")
        self.assertIn("[REDACTED:DB_CONNECTION]", result["logs"][1])
        self.assertEqual(result["logs"][2], "Connection successful")
        self.assertIn("[REDACTED:API_KEY]", result["logs"][3])
        self.assertEqual(result["logs"][4], "Server listening on port 3000")
        self.assertEqual(result["count"], 5)

    def test_null_and_undefined_handling(self):
        """Test handling of null and None values."""
        data = {
            "key1": None,
            "key2": "sk-1234567890abcdef1234567890abcdef1234567890ab",
            "key3": None
        }
        result = sanitize_log_entry(data)
        self.assertIsNone(result["key1"])
        self.assertIn("[REDACTED:API_KEY]", result["key2"])
        self.assertIsNone(result["key3"])

    def test_unicode_text_preserved(self):
        """Test that Unicode text is preserved."""
        text = "Message: Hello 世界 🌍 with sk-1234567890abcdef1234567890abcdef1234567890ab"
        result = sanitize_string(text)
        self.assertIn("Hello 世界 🌍", result)
        self.assertIn("[REDACTED:API_KEY]", result)

    def test_special_characters_in_context(self):
        """Test special characters around secrets."""
        text = "Key: 'sk-1234567890abcdef1234567890abcdef1234567890ab' (production)"
        result = sanitize_string(text)
        self.assertNotIn("sk-1234567890", result)
        self.assertIn("[REDACTED:API_KEY]", result)
        self.assertIn("(production)", result)


if __name__ == '__main__':
    unittest.main()
