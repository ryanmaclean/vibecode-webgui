#!/usr/bin/env python3
from __future__ import annotations
"""Level 3 Secret Scanner Agent - Autonomous Plan & Reflect Architecture.

A Level 3 agentic system for detecting exposed secrets and credentials:
- Creates execution plans based on intent
- Reflects on success and modifies plans mid-execution
- Multiple reasoning cycles until goal achieved
- Handles complexity, ambiguity, and variability
- Safety guardrails and compliance monitoring

Reference: Sema4.ai Five Levels of Agentic Automation
https://sema4.ai/blog/the-five-levels-of-agentic-automation/

Usage:
    python scripts/agents/level3_secret_scanner.py "scan for exposed secrets"
    python scripts/agents/level3_secret_scanner.py "check git history for secrets"
    python scripts/agents/level3_secret_scanner.py --quick  # Fast scan, skip git history
"""

import argparse
import json
import math
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

# Datadog Unified Service Tagging (self-instrumented)
try:
    from ddtrace import config, patch_all, tracer
    config.service = os.environ.get("DD_SERVICE", "level3-secret-scanner")
    config.env = os.environ.get("DD_ENV", "development")
    config.version = os.environ.get("DD_VERSION", "1.0.0")
    tracer.set_tags({
        "team": "security",
        "component": "autonomous-agent",
        "agent_level": "3",
    })
    patch_all()
    DDTRACE_AVAILABLE = True
except ImportError:
    DDTRACE_AVAILABLE = False
    tracer = None


class AgentState(Enum):
    """Agent execution states."""
    IDLE = "idle"
    PLANNING = "planning"
    EXECUTING = "executing"
    REFLECTING = "reflecting"
    ADAPTING = "adapting"
    COMPLETED = "completed"
    FAILED = "failed"


class ActionType(Enum):
    """Available agent actions."""
    SCAN_PATTERNS = "scan_patterns"
    SCAN_ENTROPY = "scan_entropy"
    SCAN_GIT_HISTORY = "scan_git_history"
    SCAN_ENV_FILES = "scan_env_files"
    VALIDATE = "validate"
    REPORT = "report"


class Severity(Enum):
    """Secret finding severity levels."""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


@dataclass
class SecretFinding:
    """A detected secret or credential."""
    file_path: str
    line_number: int
    secret_type: str
    severity: Severity
    match: str
    context: str = ""
    is_false_positive: bool = False
    recommendation: str = ""


@dataclass
class Action:
    """A single action in the execution plan."""
    type: ActionType
    description: str
    params: dict = field(default_factory=dict)
    result: Optional[dict] = None
    success: bool = False
    error: Optional[str] = None


@dataclass
class Plan:
    """Execution plan with actions."""
    intent: str
    actions: list[Action] = field(default_factory=list)
    created_at: str = ""
    iteration: int = 1

    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.utcnow().isoformat()


@dataclass
class Reflection:
    """Reflection on execution results."""
    success: bool
    issues: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)
    should_retry: bool = False
    new_actions: list[Action] = field(default_factory=list)


@dataclass
class GovernanceCheck:
    """Safety and compliance check."""
    passed: bool
    violations: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


class Level3SecretScanner:
    """
    Level 3 Autonomous Agent for Secret Detection.

    Capabilities:
    - Plan: Analyzes intent and creates action sequence
    - Execute: Runs actions with error handling
    - Reflect: Evaluates results and identifies issues
    - Adapt: Modifies plan based on reflection
    - Govern: Ensures safety and compliance

    This is the first level exhibiting constrained autonomy.
    """

    MAX_ITERATIONS = 3

    # Secret patterns with severity levels
    SECRET_PATTERNS = {
        # AWS Keys - CRITICAL
        r'AKIA[0-9A-Z]{16}': (Severity.CRITICAL, "AWS Access Key ID"),
        r'(?i)aws[_-]?secret[_-]?access[_-]?key\s*[=:]\s*["\']?[A-Za-z0-9/+=]{40}': (Severity.CRITICAL, "AWS Secret Access Key"),

        # GitHub Tokens - CRITICAL
        r'ghp_[A-Za-z0-9]{36}': (Severity.CRITICAL, "GitHub Personal Access Token"),
        r'gho_[A-Za-z0-9]{36}': (Severity.CRITICAL, "GitHub OAuth Token"),
        r'ghu_[A-Za-z0-9]{36}': (Severity.CRITICAL, "GitHub User Token"),
        r'ghs_[A-Za-z0-9]{36}': (Severity.CRITICAL, "GitHub Server Token"),
        r'ghr_[A-Za-z0-9]{36}': (Severity.CRITICAL, "GitHub Refresh Token"),

        # Datadog - HIGH
        r'(?i)dd[_-]?api[_-]?key\s*[=:]\s*["\']?[a-f0-9]{32}': (Severity.HIGH, "Datadog API Key"),
        r'(?i)dd[_-]?app[_-]?key\s*[=:]\s*["\']?[a-f0-9]{40}': (Severity.HIGH, "Datadog APP Key"),

        # Private Keys - CRITICAL
        r'-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----': (Severity.CRITICAL, "Private Key"),
        r'-----BEGIN\s+EC\s+PRIVATE\s+KEY-----': (Severity.CRITICAL, "EC Private Key"),
        r'-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----': (Severity.CRITICAL, "OpenSSH Private Key"),
        r'-----BEGIN\s+PGP\s+PRIVATE\s+KEY\s+BLOCK-----': (Severity.CRITICAL, "PGP Private Key"),

        # JWT Tokens - HIGH (may contain sensitive claims)
        r'eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*': (Severity.HIGH, "JWT Token"),

        # Generic API Keys - MEDIUM
        r'(?i)api[_-]?key\s*[=:]\s*["\']?[A-Za-z0-9]{20,}["\']?': (Severity.MEDIUM, "Generic API Key"),
        r'(?i)apikey\s*[=:]\s*["\']?[A-Za-z0-9]{20,}["\']?': (Severity.MEDIUM, "Generic API Key"),
        r'(?i)api-key\s*[=:]\s*["\']?[A-Za-z0-9]{20,}["\']?': (Severity.MEDIUM, "Generic API Key"),

        # Password patterns - HIGH
        r'(?i)password\s*[=:]\s*["\'][^"\']{8,}["\']': (Severity.HIGH, "Hardcoded Password"),
        r'(?i)passwd\s*[=:]\s*["\'][^"\']{8,}["\']': (Severity.HIGH, "Hardcoded Password"),
        r'(?i)pwd\s*[=:]\s*["\'][^"\']{8,}["\']': (Severity.HIGH, "Hardcoded Password"),

        # Connection Strings - HIGH
        r'(?i)(?:mysql|postgres|postgresql|mongodb|redis)://[^:]+:[^@]+@': (Severity.HIGH, "Database Connection String with Password"),

        # Slack Tokens - HIGH
        r'xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}': (Severity.HIGH, "Slack Token"),

        # Azure - HIGH
        r'(?i)azure[_-]?(?:storage[_-]?)?(?:account[_-]?)?key\s*[=:]\s*["\']?[A-Za-z0-9+/=]{86,}==': (Severity.HIGH, "Azure Storage Key"),

        # Google Cloud - HIGH
        r'(?i)gcp[_-]?(?:api[_-]?)?key\s*[=:]\s*["\']?AIza[A-Za-z0-9_-]{35}': (Severity.HIGH, "Google Cloud API Key"),

        # Generic Secret - MEDIUM
        r'(?i)secret[_-]?key\s*[=:]\s*["\']?[A-Za-z0-9]{20,}["\']?': (Severity.MEDIUM, "Generic Secret Key"),
        r'(?i)client[_-]?secret\s*[=:]\s*["\']?[A-Za-z0-9]{20,}["\']?': (Severity.MEDIUM, "Client Secret"),

        # Bearer Tokens - MEDIUM
        r'(?i)bearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+': (Severity.MEDIUM, "Bearer Token"),
        r'(?i)authorization\s*[=:]\s*["\']?bearer\s+[A-Za-z0-9_-]{20,}': (Severity.MEDIUM, "Authorization Bearer"),
    }

    # Files/directories to exclude
    EXCLUSIONS = {
        "directories": [
            ".git",
            "node_modules",
            "__pycache__",
            ".venv",
            "venv",
            ".env.example",
            "dist",
            "build",
            ".pytest_cache",
            ".next",
            ".turbo",
            "coverage",
        ],
        "file_patterns": [
            r".*\.example$",
            r".*\.sample$",
            r".*\.template$",
            r".*test.*\.py$",
            r".*_test\.py$",
            r".*\.test\.js$",
            r".*\.spec\.js$",
            r".*\.md$",
            r".*\.lock$",
            r"package-lock\.json$",
            r"yarn\.lock$",
        ],
        "content_patterns": [
            r"^#.*example",
            r"^//.*example",
            r"REPLACE_ME",
            r"your[-_]?api[-_]?key",
            r"<your[-_]?.*>",
            r"\$\{.*\}",  # Environment variable placeholders
            r"process\.env\.",  # Node.js env access
            r"os\.environ",  # Python env access
        ]
    }

    def __init__(self, root_dir: Path, verbose: bool = True, quick_mode: bool = False):
        self.root_dir = root_dir
        self.verbose = verbose
        self.quick_mode = quick_mode
        self.state = AgentState.IDLE
        self.execution_log: list[dict] = []
        self.findings: list[SecretFinding] = []

    def log(self, message: str, level: str = "INFO"):
        """Log with tracing."""
        timestamp = datetime.utcnow().isoformat()
        entry = {"timestamp": timestamp, "level": level, "message": message, "state": self.state.value}
        self.execution_log.append(entry)

        if self.verbose:
            print(f"[{level}] [{self.state.value}] {message}")

        if DDTRACE_AVAILABLE and tracer:
            span = tracer.current_span()
            if span:
                span.set_tag(f"agent.log.{len(self.execution_log)}", message[:100])

    def _is_excluded_path(self, path: Path) -> bool:
        """Check if path should be excluded from scanning."""
        path_str = str(path)

        # Check excluded directories
        for excl_dir in self.EXCLUSIONS["directories"]:
            if excl_dir in path_str:
                return True

        # Check excluded file patterns
        for pattern in self.EXCLUSIONS["file_patterns"]:
            if re.search(pattern, path_str, re.IGNORECASE):
                return True

        return False

    def _is_false_positive(self, line: str, match: str) -> bool:
        """Check if a match is likely a false positive."""
        line_lower = line.lower()

        # Check content exclusion patterns
        for pattern in self.EXCLUSIONS["content_patterns"]:
            if re.search(pattern, line, re.IGNORECASE):
                return True

        # Check if it's in a comment
        stripped = line.strip()
        if stripped.startswith('#') or stripped.startswith('//') or stripped.startswith('*'):
            # But still flag if it looks like a real secret
            if not any(hint in line_lower for hint in ['example', 'sample', 'placeholder', 'todo', 'fixme']):
                return False
            return True

        # Check for placeholder values
        placeholder_patterns = [
            r'xxx+',
            r'placeholder',
            r'your[-_]',
            r'fake[-_]',
            r'test[-_]',
            r'dummy[-_]',
            r'sample[-_]',
        ]
        for pattern in placeholder_patterns:
            if re.search(pattern, match, re.IGNORECASE):
                return True

        return False

    def _calculate_entropy(self, text: str) -> float:
        """Calculate Shannon entropy of a string."""
        if not text:
            return 0.0

        # Count character frequencies
        freq = {}
        for char in text:
            freq[char] = freq.get(char, 0) + 1

        # Calculate entropy
        length = len(text)
        entropy = 0.0
        for count in freq.values():
            probability = count / length
            entropy -= probability * math.log2(probability)

        return entropy

    def _is_high_entropy_string(self, text: str, threshold: float = 4.5) -> bool:
        """Check if string has high entropy (likely encoded secret)."""
        # Minimum length for high entropy check
        if len(text) < 20:
            return False

        entropy = self._calculate_entropy(text)
        return entropy >= threshold

    # ==================== PLANNING ====================

    def plan(self, intent: str) -> Plan:
        """
        PLAN PHASE: Analyze intent and create execution plan.

        This is where Level 3 autonomy begins - the agent decides
        what actions to take based on the given intent.
        """
        self.state = AgentState.PLANNING
        self.log(f"Planning for intent: {intent}")

        plan = Plan(intent=intent)

        intent_lower = intent.lower()

        if "git" in intent_lower or "history" in intent_lower or "commit" in intent_lower:
            # Git history focus
            plan.actions = [
                Action(ActionType.SCAN_GIT_HISTORY, "Scan git commit history for secrets"),
                Action(ActionType.VALIDATE, "Validate findings aren't false positives"),
                Action(ActionType.REPORT, "Generate detailed report"),
            ]

        elif "env" in intent_lower or "config" in intent_lower or "environment" in intent_lower:
            # Environment files focus
            plan.actions = [
                Action(ActionType.SCAN_ENV_FILES, "Scan environment and config files"),
                Action(ActionType.VALIDATE, "Validate findings aren't false positives"),
                Action(ActionType.REPORT, "Generate detailed report"),
            ]

        elif "entropy" in intent_lower or "encoded" in intent_lower:
            # Entropy-based detection focus
            plan.actions = [
                Action(ActionType.SCAN_ENTROPY, "Scan for high entropy strings"),
                Action(ActionType.VALIDATE, "Validate findings aren't false positives"),
                Action(ActionType.REPORT, "Generate detailed report"),
            ]

        elif self.quick_mode:
            # Quick scan - skip git history
            plan.actions = [
                Action(ActionType.SCAN_PATTERNS, "Pattern-based secret scan"),
                Action(ActionType.SCAN_ENV_FILES, "Scan environment files"),
                Action(ActionType.VALIDATE, "Validate findings"),
                Action(ActionType.REPORT, "Generate report"),
            ]

        else:
            # Full comprehensive scan
            plan.actions = [
                Action(ActionType.SCAN_PATTERNS, "Pattern-based secret scan"),
                Action(ActionType.SCAN_ENTROPY, "High entropy string detection"),
                Action(ActionType.SCAN_ENV_FILES, "Scan environment and config files"),
                Action(ActionType.SCAN_GIT_HISTORY, "Check git history for leaked secrets"),
                Action(ActionType.VALIDATE, "Validate all findings"),
                Action(ActionType.REPORT, "Generate comprehensive report"),
            ]

        self.log(f"Created plan with {len(plan.actions)} actions")
        return plan

    # ==================== EXECUTION ====================

    def execute(self, plan: Plan) -> Plan:
        """
        EXECUTE PHASE: Run all actions in the plan.

        Each action is executed with error handling and results tracking.
        """
        self.state = AgentState.EXECUTING
        self.log(f"Executing plan iteration {plan.iteration}")

        for i, action in enumerate(plan.actions):
            self.log(f"Action {i+1}/{len(plan.actions)}: {action.type.value} - {action.description}")

            try:
                result = self._execute_action(action)
                action.result = result
                action.success = result.get("success", False)

                if not action.success:
                    action.error = result.get("error", "Unknown error")
                    self.log(f"Action failed: {action.error}", "WARN")

            except Exception as e:
                action.success = False
                action.error = str(e)
                self.log(f"Action exception: {e}", "ERROR")

        return plan

    def _execute_action(self, action: Action) -> dict:
        """Execute a single action and return results."""

        if action.type == ActionType.SCAN_PATTERNS:
            return self._action_scan_patterns()

        elif action.type == ActionType.SCAN_ENTROPY:
            return self._action_scan_entropy()

        elif action.type == ActionType.SCAN_GIT_HISTORY:
            return self._action_scan_git_history()

        elif action.type == ActionType.SCAN_ENV_FILES:
            return self._action_scan_env_files()

        elif action.type == ActionType.VALIDATE:
            return self._action_validate()

        elif action.type == ActionType.REPORT:
            return self._action_report()

        return {"success": False, "error": f"Unknown action type: {action.type}"}

    def _action_scan_patterns(self) -> dict:
        """Scan files using regex patterns for known secret formats."""
        files_scanned = 0
        findings_count = 0

        # Get all text files
        extensions = ['.py', '.js', '.ts', '.jsx', '.tsx', '.json', '.yml', '.yaml',
                     '.xml', '.ini', '.conf', '.cfg', '.sh', '.bash', '.zsh',
                     '.env', '.properties', '.toml']

        for ext in extensions:
            for file_path in self.root_dir.rglob(f"*{ext}"):
                if self._is_excluded_path(file_path):
                    continue

                try:
                    content = file_path.read_text(errors='ignore')
                    files_scanned += 1

                    for line_num, line in enumerate(content.split('\n'), 1):
                        for pattern, (severity, secret_type) in self.SECRET_PATTERNS.items():
                            matches = re.finditer(pattern, line)
                            for match in matches:
                                matched_text = match.group(0)

                                # Skip obvious false positives
                                if self._is_false_positive(line, matched_text):
                                    continue

                                finding = SecretFinding(
                                    file_path=str(file_path.relative_to(self.root_dir)),
                                    line_number=line_num,
                                    secret_type=secret_type,
                                    severity=severity,
                                    match=self._redact_secret(matched_text),
                                    context=line.strip()[:100],
                                    recommendation=self._get_recommendation(secret_type)
                                )
                                self.findings.append(finding)
                                findings_count += 1

                except Exception as e:
                    self.log(f"Error scanning {file_path}: {e}", "WARN")

        return {
            "success": True,
            "files_scanned": files_scanned,
            "findings": findings_count
        }

    def _action_scan_entropy(self) -> dict:
        """Scan for high entropy strings that might be encoded secrets."""
        files_scanned = 0
        findings_count = 0

        # Patterns to extract potential secrets for entropy analysis
        entropy_patterns = [
            r'["\'][A-Za-z0-9+/=]{30,}["\']',  # Base64-like in quotes
            r'["\'][a-f0-9]{32,}["\']',  # Hex strings in quotes
            r'[A-Za-z0-9_-]{40,}',  # Long alphanumeric strings
        ]

        extensions = ['.py', '.js', '.ts', '.json', '.yml', '.yaml', '.env']

        for ext in extensions:
            for file_path in self.root_dir.rglob(f"*{ext}"):
                if self._is_excluded_path(file_path):
                    continue

                try:
                    content = file_path.read_text(errors='ignore')
                    files_scanned += 1

                    for line_num, line in enumerate(content.split('\n'), 1):
                        for pattern in entropy_patterns:
                            matches = re.finditer(pattern, line)
                            for match in matches:
                                matched_text = match.group(0).strip('"\'')

                                if self._is_high_entropy_string(matched_text):
                                    # Avoid duplicates from pattern scan
                                    already_found = any(
                                        f.file_path == str(file_path.relative_to(self.root_dir)) and
                                        f.line_number == line_num
                                        for f in self.findings
                                    )

                                    if not already_found and not self._is_false_positive(line, matched_text):
                                        finding = SecretFinding(
                                            file_path=str(file_path.relative_to(self.root_dir)),
                                            line_number=line_num,
                                            secret_type="High Entropy String",
                                            severity=Severity.MEDIUM,
                                            match=self._redact_secret(matched_text),
                                            context=line.strip()[:100],
                                            recommendation="Review high entropy string - may be an encoded secret"
                                        )
                                        self.findings.append(finding)
                                        findings_count += 1

                except Exception as e:
                    self.log(f"Error entropy scanning {file_path}: {e}", "WARN")

        return {
            "success": True,
            "files_scanned": files_scanned,
            "findings": findings_count
        }

    def _action_scan_git_history(self) -> dict:
        """Scan git commit history for accidentally committed secrets."""
        if not (self.root_dir / ".git").exists():
            return {"success": True, "findings": 0, "message": "Not a git repository"}

        findings_count = 0
        commits_scanned = 0

        try:
            # Get recent commits (last 100)
            result = subprocess.run(
                ["git", "log", "--oneline", "-100", "--format=%H"],
                capture_output=True, text=True, cwd=self.root_dir
            )

            if result.returncode != 0:
                return {"success": False, "error": "Failed to get git log"}

            commits = result.stdout.strip().split('\n')[:50]  # Limit to 50 for performance

            for commit in commits:
                if not commit:
                    continue

                commits_scanned += 1

                # Get diff for this commit
                diff_result = subprocess.run(
                    ["git", "show", "--format=", "--diff-filter=AM", commit],
                    capture_output=True, text=True, cwd=self.root_dir
                )

                if diff_result.returncode != 0:
                    continue

                diff_content = diff_result.stdout
                current_file = None

                for line in diff_content.split('\n'):
                    # Track current file
                    if line.startswith('+++ b/'):
                        current_file = line[6:]
                        continue

                    # Only check added lines
                    if not line.startswith('+') or line.startswith('+++'):
                        continue

                    line_content = line[1:]  # Remove the '+' prefix

                    for pattern, (severity, secret_type) in self.SECRET_PATTERNS.items():
                        if re.search(pattern, line_content):
                            if not self._is_false_positive(line_content, ""):
                                finding = SecretFinding(
                                    file_path=f"git:{commit[:8]}:{current_file or 'unknown'}",
                                    line_number=0,
                                    secret_type=f"[Git History] {secret_type}",
                                    severity=severity,
                                    match=self._redact_secret(line_content[:50]),
                                    context=f"Commit: {commit[:8]}",
                                    recommendation="Secret found in git history - consider rotating and using git-filter-repo to remove"
                                )
                                self.findings.append(finding)
                                findings_count += 1
                                break

        except Exception as e:
            return {"success": False, "error": str(e)}

        return {
            "success": True,
            "commits_scanned": commits_scanned,
            "findings": findings_count
        }

    def _action_scan_env_files(self) -> dict:
        """Scan .env files and config files for exposed values."""
        files_scanned = 0
        findings_count = 0

        # Environment file patterns
        env_patterns = [
            ".env", ".env.local", ".env.development", ".env.production",
            ".env.staging", ".env.test", "*.env"
        ]

        config_patterns = [
            "config/*.json", "config/*.yml", "config/*.yaml",
            "settings/*.json", "settings/*.yml",
            "**/application.properties", "**/application.yml",
            "docker-compose*.yml", "docker-compose*.yaml"
        ]

        # Scan .env files
        for pattern in env_patterns:
            for file_path in self.root_dir.glob(pattern):
                if self._is_excluded_path(file_path) or '.example' in str(file_path):
                    continue

                try:
                    content = file_path.read_text(errors='ignore')
                    files_scanned += 1

                    for line_num, line in enumerate(content.split('\n'), 1):
                        # Skip comments
                        if line.strip().startswith('#'):
                            continue

                        # Check for sensitive variable names with values
                        sensitive_vars = [
                            'PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'CREDENTIAL',
                            'API_KEY', 'APIKEY', 'AUTH', 'PRIVATE'
                        ]

                        for var in sensitive_vars:
                            if var in line.upper() and '=' in line:
                                parts = line.split('=', 1)
                                if len(parts) == 2:
                                    value = parts[1].strip().strip('"\'')

                                    # Skip empty or placeholder values
                                    if not value or value.startswith('${') or value == '':
                                        continue
                                    if any(p in value.lower() for p in ['example', 'placeholder', 'your_', 'xxx']):
                                        continue

                                    finding = SecretFinding(
                                        file_path=str(file_path.relative_to(self.root_dir)),
                                        line_number=line_num,
                                        secret_type=f"Environment Variable ({var})",
                                        severity=Severity.HIGH if 'PASSWORD' in var or 'SECRET' in var else Severity.MEDIUM,
                                        match=self._redact_secret(value),
                                        context=line.strip()[:100],
                                        recommendation="Move sensitive values to a secure vault or use environment injection"
                                    )
                                    self.findings.append(finding)
                                    findings_count += 1
                                    break

                except Exception as e:
                    self.log(f"Error scanning env file {file_path}: {e}", "WARN")

        # Scan config files
        for pattern in config_patterns:
            for file_path in self.root_dir.glob(pattern):
                if self._is_excluded_path(file_path):
                    continue

                try:
                    content = file_path.read_text(errors='ignore')
                    files_scanned += 1

                    for line_num, line in enumerate(content.split('\n'), 1):
                        for pattern_re, (severity, secret_type) in self.SECRET_PATTERNS.items():
                            if re.search(pattern_re, line):
                                if not self._is_false_positive(line, ""):
                                    finding = SecretFinding(
                                        file_path=str(file_path.relative_to(self.root_dir)),
                                        line_number=line_num,
                                        secret_type=f"[Config File] {secret_type}",
                                        severity=severity,
                                        match=self._redact_secret(line[:50]),
                                        context=line.strip()[:100],
                                        recommendation="Use environment variables or secret management for config files"
                                    )
                                    self.findings.append(finding)
                                    findings_count += 1
                                    break

                except Exception as e:
                    self.log(f"Error scanning config {file_path}: {e}", "WARN")

        return {
            "success": True,
            "files_scanned": files_scanned,
            "findings": findings_count
        }

    def _action_validate(self) -> dict:
        """Validate findings to reduce false positives."""
        initial_count = len(self.findings)
        validated_findings = []
        false_positives = 0

        for finding in self.findings:
            # Additional validation checks
            is_fp = False

            # Check if file is an example/template
            if any(ext in finding.file_path.lower() for ext in ['.example', '.sample', '.template']):
                is_fp = True

            # Check if in test directory
            if '/test/' in finding.file_path or '/tests/' in finding.file_path:
                # Lower severity for test files but don't exclude
                if finding.severity == Severity.CRITICAL:
                    finding.severity = Severity.HIGH
                elif finding.severity == Severity.HIGH:
                    finding.severity = Severity.MEDIUM

            # Check for documentation markers
            if finding.context and any(marker in finding.context.lower() for marker in ['example:', 'sample:', 'e.g.', 'for example']):
                is_fp = True

            if is_fp:
                finding.is_false_positive = True
                false_positives += 1
            else:
                validated_findings.append(finding)

        self.findings = validated_findings

        return {
            "success": True,
            "initial_findings": initial_count,
            "validated_findings": len(validated_findings),
            "false_positives_removed": false_positives
        }

    def _action_report(self) -> dict:
        """Generate comprehensive findings report."""
        # Count by severity
        severity_counts = {s: 0 for s in Severity}
        for finding in self.findings:
            severity_counts[finding.severity] += 1

        # Group by file
        files_affected = {}
        for finding in self.findings:
            if finding.file_path not in files_affected:
                files_affected[finding.file_path] = []
            files_affected[finding.file_path].append({
                "line": finding.line_number,
                "type": finding.secret_type,
                "severity": finding.severity.value,
                "match": finding.match,
                "recommendation": finding.recommendation
            })

        report = {
            "scan_time": datetime.utcnow().isoformat(),
            "total_files_scanned": sum(
                action.result.get("files_scanned", 0)
                for action in self.execution_log
                if isinstance(action, dict) and "files_scanned" in action
            ),
            "secrets_found": {
                "total": len(self.findings),
                "by_severity": {s.value: severity_counts[s] for s in Severity}
            },
            "file_locations": files_affected,
            "recommendations": self._generate_recommendations()
        }

        return {
            "success": True,
            "report": report
        }

    def _redact_secret(self, text: str) -> str:
        """Redact sensitive portion of secret for safe logging."""
        if len(text) <= 8:
            return "*" * len(text)
        return text[:4] + "*" * (len(text) - 8) + text[-4:]

    def _get_recommendation(self, secret_type: str) -> str:
        """Get recommendation for a secret type."""
        recommendations = {
            "AWS Access Key ID": "Rotate AWS keys immediately. Use IAM roles or AWS Secrets Manager.",
            "AWS Secret Access Key": "Rotate AWS keys immediately. Never commit AWS secrets.",
            "GitHub Personal Access Token": "Revoke token and create a new one with minimal scope.",
            "GitHub OAuth Token": "Revoke OAuth token in GitHub settings.",
            "Datadog API Key": "Rotate Datadog API key in organization settings.",
            "Datadog APP Key": "Rotate Datadog APP key in user settings.",
            "Private Key": "Replace private key immediately. Never commit private keys.",
            "JWT Token": "Invalidate JWT and issue new tokens. Check token expiration.",
            "Hardcoded Password": "Move password to environment variable or secrets manager.",
            "Database Connection String with Password": "Use environment variables for database credentials.",
            "Generic API Key": "Rotate API key if possible. Store in environment variables.",
            "Slack Token": "Rotate Slack token in workspace settings.",
        }
        return recommendations.get(secret_type, "Review and rotate credential if necessary.")

    def _generate_recommendations(self) -> list[str]:
        """Generate overall recommendations based on findings."""
        recommendations = []

        severity_counts = {s: 0 for s in Severity}
        for finding in self.findings:
            severity_counts[finding.severity] += 1

        if severity_counts[Severity.CRITICAL] > 0:
            recommendations.append(
                f"URGENT: {severity_counts[Severity.CRITICAL]} critical secrets found. "
                "Rotate immediately and consider incident response."
            )

        if severity_counts[Severity.HIGH] > 0:
            recommendations.append(
                f"HIGH PRIORITY: {severity_counts[Severity.HIGH]} high severity findings. "
                "Rotate credentials and implement proper secret management."
            )

        if any(f for f in self.findings if 'Git History' in f.secret_type):
            recommendations.append(
                "Secrets found in git history. Use git-filter-repo or BFG Repo-Cleaner "
                "to remove from history after rotating credentials."
            )

        if any(f for f in self.findings if '.env' in f.file_path):
            recommendations.append(
                "Add .env files to .gitignore. Use .env.example with placeholder values."
            )

        # General recommendations
        recommendations.extend([
            "Implement pre-commit hooks with secret detection (e.g., detect-secrets, gitleaks)",
            "Use a secrets manager (HashiCorp Vault, AWS Secrets Manager, etc.)",
            "Enable GitHub secret scanning on the repository",
            "Conduct regular security audits of codebase"
        ])

        return recommendations

    # ==================== REFLECTION ====================

    def reflect(self, plan: Plan) -> Reflection:
        """
        REFLECT PHASE: Analyze execution results and determine next steps.

        This is the key differentiator for Level 3 - the ability to
        evaluate success and decide whether to adapt the plan.
        """
        self.state = AgentState.REFLECTING
        self.log("Reflecting on execution results")

        reflection = Reflection(success=True)

        # Analyze each action's results
        for action in plan.actions:
            if not action.success:
                reflection.success = False
                reflection.issues.append(f"{action.type.value}: {action.error}")

            if action.result:
                # Check for scan issues
                if action.type == ActionType.SCAN_GIT_HISTORY:
                    if action.result.get("commits_scanned", 0) == 0:
                        reflection.issues.append("Git history scan didn't scan any commits")
                        reflection.suggestions.append("Check git repository access")

        # Check overall findings
        critical_count = sum(1 for f in self.findings if f.severity == Severity.CRITICAL)
        high_count = sum(1 for f in self.findings if f.severity == Severity.HIGH)

        if critical_count > 0:
            reflection.issues.append(f"Found {critical_count} CRITICAL severity secrets!")
            reflection.success = False  # Mark as failed if critical secrets found

        if high_count > 0:
            reflection.issues.append(f"Found {high_count} HIGH severity secrets")

        # Determine if we should retry with different approach
        if not self.findings and plan.iteration < self.MAX_ITERATIONS:
            # No findings - maybe run additional scans
            if not any(a.type == ActionType.SCAN_ENTROPY for a in plan.actions):
                reflection.suggestions.append("Run entropy-based scan for encoded secrets")
                reflection.new_actions.append(
                    Action(ActionType.SCAN_ENTROPY, "Additional entropy-based scanning")
                )
                reflection.should_retry = True

        self.log(f"Reflection: success={reflection.success}, findings={len(self.findings)}")
        return reflection

    # ==================== ADAPTATION ====================

    def adapt(self, plan: Plan, reflection: Reflection) -> Plan:
        """
        ADAPT PHASE: Modify plan based on reflection.

        Creates a new plan iteration with adjusted actions.
        """
        self.state = AgentState.ADAPTING
        self.log(f"Adapting plan (iteration {plan.iteration} -> {plan.iteration + 1})")

        new_plan = Plan(
            intent=plan.intent,
            iteration=plan.iteration + 1
        )

        # Add new actions from reflection
        if reflection.new_actions:
            new_plan.actions.extend(reflection.new_actions)

        # Always validate and report
        new_plan.actions.append(Action(ActionType.VALIDATE, "Re-validate findings"))
        new_plan.actions.append(Action(ActionType.REPORT, "Generate updated report"))

        self.log(f"Adapted plan with {len(new_plan.actions)} actions")
        return new_plan

    # ==================== GOVERNANCE ====================

    def check_governance(self, plan: Plan) -> GovernanceCheck:
        """
        GOVERNANCE: Safety and compliance checks.

        Ensures the agent operates within defined constraints.
        """
        check = GovernanceCheck(passed=True)

        # Check iteration limit
        if plan.iteration > self.MAX_ITERATIONS:
            check.passed = False
            check.violations.append(f"Exceeded max iterations ({self.MAX_ITERATIONS})")

        # Validate all actions are known
        for action in plan.actions:
            if action.type not in ActionType:
                check.passed = False
                check.violations.append(f"Unknown action type: {action.type}")

        # Security check - agent only reads, never modifies files
        check.warnings.append("Agent operates in read-only mode - no file modifications")

        return check

    # ==================== MAIN LOOP ====================

    def run(self, intent: str) -> dict:
        """
        Main autonomous execution loop.

        PLAN -> EXECUTE -> REFLECT -> ADAPT (repeat until success or max iterations)
        """
        self.log(f"Starting Level 3 Secret Scanner with intent: {intent}")
        start_time = time.time()

        # Create initial plan
        plan = self.plan(intent)

        while True:
            # Governance check
            governance = self.check_governance(plan)
            if not governance.passed:
                self.state = AgentState.FAILED
                self.log(f"Governance violation: {governance.violations}", "ERROR")
                return {
                    "success": False,
                    "error": "Governance violation",
                    "violations": governance.violations
                }

            if governance.warnings:
                for warning in governance.warnings:
                    self.log(f"Governance note: {warning}", "INFO")

            # Execute plan
            plan = self.execute(plan)

            # Reflect on results
            reflection = self.reflect(plan)

            # Check if we should continue
            if not reflection.should_retry:
                break

            if plan.iteration >= self.MAX_ITERATIONS:
                self.log(f"Max iterations ({self.MAX_ITERATIONS}) reached", "WARN")
                break

            # Adapt plan and continue
            plan = self.adapt(plan, reflection)

        # Final state - success if no critical findings
        critical_findings = sum(1 for f in self.findings if f.severity == Severity.CRITICAL)
        self.state = AgentState.COMPLETED if critical_findings == 0 else AgentState.FAILED
        duration = time.time() - start_time

        # Get final report
        final_report = self._action_report()

        result = {
            "success": critical_findings == 0,
            "iterations": plan.iteration,
            "duration_seconds": round(duration, 2),
            "final_state": self.state.value,
            "report": final_report.get("report", {}),
            "issues": reflection.issues,
            "execution_log_entries": len(self.execution_log)
        }

        self.log(f"Agent completed: findings={len(self.findings)}, iterations={result['iterations']}")
        return result


def main():
    parser = argparse.ArgumentParser(
        description="Level 3 Secret Scanner Agent - Autonomous Plan & Reflect",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        "intent",
        nargs="?",
        default="scan for exposed secrets",
        help="The intent/goal for the agent to achieve"
    )
    parser.add_argument(
        "--quick", "-Q",
        action="store_true",
        help="Fast scan mode - skip git history analysis"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Suppress verbose output"
    )
    parser.add_argument(
        "--json", "-j",
        action="store_true",
        help="Output as JSON"
    )

    args = parser.parse_args()

    # Find repo root
    root = Path.cwd()
    while root != root.parent:
        if (root / ".git").is_dir() or (root / "scripts").is_dir():
            break
        root = root.parent

    agent = Level3SecretScanner(root, verbose=not args.quiet, quick_mode=args.quick)
    result = agent.run(args.intent)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"\n{'='*60}")
        print("Level 3 Secret Scanner - Execution Complete")
        print(f"{'='*60}")
        print(f"Intent:      {args.intent}")
        print(f"Success:     {result['success']}")
        print(f"Iterations:  {result['iterations']}")
        print(f"Duration:    {result['duration_seconds']}s")

        report = result.get("report", {})
        secrets = report.get("secrets_found", {})

        print(f"\nFindings Summary:")
        print(f"  Total secrets found: {secrets.get('total', 0)}")
        by_severity = secrets.get("by_severity", {})
        for severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
            count = by_severity.get(severity, 0)
            if count > 0:
                print(f"  {severity}: {count}")

        file_locations = report.get("file_locations", {})
        if file_locations:
            print(f"\nAffected Files ({len(file_locations)}):")
            for filepath, findings in list(file_locations.items())[:10]:
                print(f"  - {filepath} ({len(findings)} findings)")
            if len(file_locations) > 10:
                print(f"  ... and {len(file_locations) - 10} more files")

        recommendations = report.get("recommendations", [])
        if recommendations:
            print(f"\nRecommendations:")
            for rec in recommendations[:5]:
                print(f"  - {rec}")

        if result.get("issues"):
            print(f"\nIssues:")
            for issue in result["issues"]:
                print(f"  - {issue}")

    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
