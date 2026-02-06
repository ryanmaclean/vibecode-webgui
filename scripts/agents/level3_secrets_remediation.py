#!/usr/bin/env python3
from __future__ import annotations
"""Level 3 Secrets Remediation Agent - Autonomous Plan & Reflect Architecture.

A Level 3 agentic system for automatically fixing exposed secrets by moving
them to environment variables:
- Creates execution plans based on intent
- Reflects on success and modifies plans mid-execution
- Multiple reasoning cycles until goal achieved
- Handles complexity, ambiguity, and variability
- Safety guardrails and compliance monitoring

Reference: Sema4.ai Five Levels of Agentic Automation
https://sema4.ai/blog/the-five-levels-of-agentic-automation/

Usage:
    # Remediate from scanner report
    python scripts/agents/level3_secrets_remediation.py --from-report secrets_report.json

    # Full scan and remediate
    python scripts/agents/level3_secrets_remediation.py "scan and fix all exposed secrets"

    # Dry run
    python scripts/agents/level3_secrets_remediation.py --dry-run

    # Specific files only
    python scripts/agents/level3_secrets_remediation.py --files scripts/start_dev.py,scripts/homebrew/start_all.py
"""

import argparse
import json
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
    config.service = os.environ.get("DD_SERVICE", "level3-secrets-remediation")
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
    SCAN = "scan"
    ANALYZE = "analyze"
    CREATE_ENV_TEMPLATE = "create_env_template"
    UPDATE_GITIGNORE = "update_gitignore"
    REFACTOR_CODE = "refactor_code"
    ADD_ENV_LOADING = "add_env_loading"
    VALIDATE = "validate"
    CREATE_BRANCH = "create_branch"
    COMMIT = "commit"
    REPORT = "report"


class SecretType(Enum):
    """Types of secrets for categorization."""
    DATABASE_CONNECTION = "database_connection"
    DATABASE_PASSWORD = "database_password"
    DATABASE_USER = "database_user"
    API_KEY = "api_key"
    SECRET_KEY = "secret_key"
    ACCESS_TOKEN = "access_token"
    PRIVATE_KEY = "private_key"
    PASSWORD = "password"
    BEARER_TOKEN = "bearer_token"
    JWT_TOKEN = "jwt_token"
    WEBHOOK_SECRET = "webhook_secret"
    ENCRYPTION_KEY = "encryption_key"
    UNKNOWN = "unknown"


@dataclass
class SecretFinding:
    """A detected secret that needs remediation."""
    file_path: str
    line_number: int
    secret_type: str
    original_code: str
    env_var_name: str = ""
    remediated_code: str = ""
    remediation_strategy: str = ""


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


class Level3SecretsRemediation:
    """
    Level 3 Autonomous Agent for Secrets Remediation.

    Capabilities:
    - Plan: Analyzes intent and creates action sequence
    - Execute: Runs actions with error handling
    - Reflect: Evaluates results and identifies issues
    - Adapt: Modifies plan based on reflection
    - Govern: Ensures safety and compliance

    This is the first level exhibiting constrained autonomy.
    """

    MAX_ITERATIONS = 5
    BRANCH_PREFIX = "fix/secrets-"

    # Environment variable naming conventions
    ENV_VAR_MAPPINGS = {
        # Database
        "database_connection": {
            "user": "DB_USER",
            "password": "DB_PASSWORD",
            "host": "DB_HOST",
            "port": "DB_PORT",
            "name": "DB_NAME",
            "url": "DATABASE_URL",
        },
        # API Keys by service
        "api_keys": {
            "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "datadog": "DATADOG_API_KEY",
            "github": "GITHUB_TOKEN",
            "gitlab": "GITLAB_TOKEN",
            "aws": "AWS_ACCESS_KEY_ID",
            "aws_secret": "AWS_SECRET_ACCESS_KEY",
            "azure": "AZURE_CLIENT_SECRET",
            "gcp": "GOOGLE_APPLICATION_CREDENTIALS",
            "slack": "SLACK_TOKEN",
            "stripe": "STRIPE_API_KEY",
            "twilio": "TWILIO_AUTH_TOKEN",
            "sendgrid": "SENDGRID_API_KEY",
            "default": "API_KEY",
        },
        # Secrets
        "secrets": {
            "secret_key": "SECRET_KEY",
            "app_secret": "APP_SECRET",
            "jwt_secret": "JWT_SECRET",
            "encryption_key": "ENCRYPTION_KEY",
            "webhook_secret": "WEBHOOK_SECRET",
        },
        # Auth
        "auth": {
            "password": "APP_PASSWORD",
            "access_token": "ACCESS_TOKEN",
            "bearer_token": "BEARER_TOKEN",
            "auth_token": "AUTH_TOKEN",
        },
    }

    # Patterns for detecting secret types
    SECRET_TYPE_PATTERNS = {
        SecretType.DATABASE_CONNECTION: [
            r'(?:mysql|postgres|postgresql|mongodb|redis)://[^:]+:[^@]+@',
            r'(?:jdbc|odbc):',
        ],
        SecretType.API_KEY: [
            r'(?i)api[_-]?key\s*[=:]\s*["\']?[A-Za-z0-9]{20,}',
            r'sk-[a-zA-Z0-9]{20,}',  # OpenAI
            r'xox[baprs]-[0-9]{10,13}',  # Slack
            r'ghp_[A-Za-z0-9]{36}',  # GitHub
        ],
        SecretType.SECRET_KEY: [
            r'(?i)secret[_-]?key\s*[=:]\s*["\']?[A-Za-z0-9]{20,}',
            r'(?i)client[_-]?secret\s*[=:]\s*',
        ],
        SecretType.PASSWORD: [
            r'(?i)password\s*[=:]\s*["\'][^"\']{8,}["\']',
            r'(?i)passwd\s*[=:]\s*["\'][^"\']{8,}["\']',
            r'(?i)pwd\s*[=:]\s*["\'][^"\']{8,}["\']',
        ],
        SecretType.JWT_TOKEN: [
            r'eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*',
        ],
        SecretType.BEARER_TOKEN: [
            r'(?i)bearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',
            r'(?i)authorization\s*[=:]\s*["\']?bearer\s+',
        ],
        SecretType.ACCESS_TOKEN: [
            r'(?i)access[_-]?token\s*[=:]\s*["\']?[A-Za-z0-9]{20,}',
        ],
        SecretType.PRIVATE_KEY: [
            r'-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----',
        ],
    }

    def __init__(
        self,
        root_dir: Path,
        verbose: bool = True,
        dry_run: bool = False,
        create_branch: bool = True,
        target_files: Optional[list[str]] = None,
        from_report: Optional[str] = None,
    ):
        self.root_dir = root_dir
        self.verbose = verbose
        self.dry_run = dry_run
        self.create_branch = create_branch
        self.target_files = target_files
        self.from_report = from_report
        self.state = AgentState.IDLE
        self.execution_log: list[dict] = []
        self.findings: list[SecretFinding] = []
        self.env_vars_created: dict[str, str] = {}
        self.files_modified: list[str] = []
        self.branch_name: Optional[str] = None
        self.commit_sha: Optional[str] = None

    def log(self, message: str, level: str = "INFO"):
        """Log with tracing."""
        timestamp = datetime.utcnow().isoformat()
        entry = {"timestamp": timestamp, "level": level, "message": message, "state": self.state.value}
        self.execution_log.append(entry)

        if self.verbose:
            prefix = "[DRY-RUN] " if self.dry_run else ""
            print(f"{prefix}[{level}] [{self.state.value}] {message}")

        if DDTRACE_AVAILABLE and tracer:
            span = tracer.current_span()
            if span:
                span.set_tag(f"agent.log.{len(self.execution_log)}", message[:100])

    def _detect_secret_type(self, code: str, context: str = "") -> SecretType:
        """Detect the type of secret from code pattern."""
        combined = f"{code} {context}".lower()

        for secret_type, patterns in self.SECRET_TYPE_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, code, re.IGNORECASE):
                    return secret_type

        # Fallback detection by keywords
        if any(kw in combined for kw in ['database', 'db_', 'postgres', 'mysql', 'mongodb']):
            if 'password' in combined or 'pwd' in combined:
                return SecretType.DATABASE_PASSWORD
            if 'user' in combined:
                return SecretType.DATABASE_USER
            return SecretType.DATABASE_CONNECTION

        if 'api' in combined and 'key' in combined:
            return SecretType.API_KEY

        if 'password' in combined or 'passwd' in combined:
            return SecretType.PASSWORD

        if 'secret' in combined:
            return SecretType.SECRET_KEY

        if 'token' in combined:
            return SecretType.ACCESS_TOKEN

        return SecretType.UNKNOWN

    def _generate_env_var_name(self, secret_type: SecretType, context: str = "") -> str:
        """Generate appropriate environment variable name."""
        context_lower = context.lower()

        # Service-specific naming
        service_keywords = {
            'openai': 'OPENAI_API_KEY',
            'anthropic': 'ANTHROPIC_API_KEY',
            'datadog': 'DATADOG_API_KEY',
            'github': 'GITHUB_TOKEN',
            'gitlab': 'GITLAB_TOKEN',
            'aws': 'AWS_ACCESS_KEY_ID',
            'azure': 'AZURE_CLIENT_SECRET',
            'gcp': 'GCP_API_KEY',
            'google': 'GOOGLE_API_KEY',
            'slack': 'SLACK_TOKEN',
            'stripe': 'STRIPE_API_KEY',
            'twilio': 'TWILIO_AUTH_TOKEN',
            'sendgrid': 'SENDGRID_API_KEY',
            'redis': 'REDIS_PASSWORD',
            'postgres': 'DB_PASSWORD',
            'mysql': 'DB_PASSWORD',
            'mongodb': 'MONGODB_PASSWORD',
        }

        for keyword, env_var in service_keywords.items():
            if keyword in context_lower:
                return env_var

        # Default by type
        type_defaults = {
            SecretType.DATABASE_CONNECTION: 'DATABASE_URL',
            SecretType.DATABASE_PASSWORD: 'DB_PASSWORD',
            SecretType.DATABASE_USER: 'DB_USER',
            SecretType.API_KEY: 'API_KEY',
            SecretType.SECRET_KEY: 'SECRET_KEY',
            SecretType.ACCESS_TOKEN: 'ACCESS_TOKEN',
            SecretType.PRIVATE_KEY: 'PRIVATE_KEY_PATH',
            SecretType.PASSWORD: 'APP_PASSWORD',
            SecretType.BEARER_TOKEN: 'BEARER_TOKEN',
            SecretType.JWT_TOKEN: 'JWT_SECRET',
            SecretType.WEBHOOK_SECRET: 'WEBHOOK_SECRET',
            SecretType.ENCRYPTION_KEY: 'ENCRYPTION_KEY',
            SecretType.UNKNOWN: 'SECRET_VALUE',
        }

        return type_defaults.get(secret_type, 'SECRET_VALUE')

    def _generate_remediation_code(self, finding: SecretFinding) -> str:
        """Generate remediated code for a secret finding."""
        original = finding.original_code
        env_var = finding.env_var_name
        secret_type = self._detect_secret_type(original)

        # Database connection string remediation
        if secret_type == SecretType.DATABASE_CONNECTION:
            # Parse connection string and replace with env vars
            match = re.search(
                r'(mysql|postgres|postgresql|mongodb|redis)://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(\w+)',
                original
            )
            if match:
                proto, user, password, host, port, dbname = match.groups()
                port = port or ('5432' if 'postgres' in proto else '3306')

                # Add all components to env vars
                self.env_vars_created['DB_USER'] = user
                self.env_vars_created['DB_PASSWORD'] = '***REDACTED***'
                self.env_vars_created['DB_HOST'] = host
                self.env_vars_created['DB_PORT'] = port
                self.env_vars_created['DB_NAME'] = dbname

                return f'f"{proto}://{{os.environ.get(\'DB_USER\')}}:{{os.environ.get(\'DB_PASSWORD\')}}@{{os.environ.get(\'DB_HOST\', \'localhost\')}}:{{os.environ.get(\'DB_PORT\', \'{port}\')}}/{{os.environ.get(\'DB_NAME\')}}"'

        # Simple variable assignment remediation
        # Pattern: VAR = "secret_value"
        match = re.match(r'^(\s*)(\w+)\s*=\s*["\']([^"\']+)["\'](.*)$', original)
        if match:
            indent, var_name, secret_value, trailing = match.groups()
            self.env_vars_created[env_var] = '***REDACTED***'
            return f'{indent}{var_name} = os.environ.get(\'{env_var}\'){trailing}'

        # Pattern: "key": "secret_value" (dict/json)
        match = re.match(r'^(\s*)["\'](\w+)["\']\s*:\s*["\']([^"\']+)["\'](.*)$', original)
        if match:
            indent, key, secret_value, trailing = match.groups()
            self.env_vars_created[env_var] = '***REDACTED***'
            return f'{indent}"{key}": os.environ.get(\'{env_var}\'){trailing}'

        # Fallback: wrap in os.environ.get
        self.env_vars_created[env_var] = '***REDACTED***'
        return f'os.environ.get(\'{env_var}\')'

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

        if self.from_report:
            # Start from existing scanner report
            plan.actions = [
                Action(ActionType.ANALYZE, "Load and analyze scanner report",
                       params={"report_path": self.from_report}),
                Action(ActionType.CREATE_ENV_TEMPLATE, "Generate .env.example with placeholders"),
                Action(ActionType.UPDATE_GITIGNORE, "Ensure .env files are gitignored"),
                Action(ActionType.REFACTOR_CODE, "Replace hardcoded secrets with os.environ.get()"),
                Action(ActionType.ADD_ENV_LOADING, "Add python-dotenv loading code"),
                Action(ActionType.VALIDATE, "Verify refactored code syntax"),
            ]
        elif any(word in intent_lower for word in ["scan", "full", "all"]):
            # Full scan and remediate
            plan.actions = [
                Action(ActionType.SCAN, "Run secret scanner to get findings"),
                Action(ActionType.ANALYZE, "Categorize secrets by type and strategy"),
                Action(ActionType.CREATE_ENV_TEMPLATE, "Generate .env.example with placeholders"),
                Action(ActionType.UPDATE_GITIGNORE, "Ensure .env files are gitignored"),
                Action(ActionType.REFACTOR_CODE, "Replace hardcoded secrets with os.environ.get()"),
                Action(ActionType.ADD_ENV_LOADING, "Add python-dotenv loading code"),
                Action(ActionType.VALIDATE, "Verify refactored code syntax"),
            ]
        elif any(word in intent_lower for word in ["fix", "remediate", "move", "refactor"]):
            # Remediation focused
            plan.actions = [
                Action(ActionType.SCAN, "Quick scan for secrets"),
                Action(ActionType.ANALYZE, "Analyze remediation strategy"),
                Action(ActionType.REFACTOR_CODE, "Apply remediation"),
                Action(ActionType.VALIDATE, "Validate changes"),
            ]
        else:
            # Default: full remediation workflow
            plan.actions = [
                Action(ActionType.SCAN, "Scan for exposed secrets"),
                Action(ActionType.ANALYZE, "Categorize and plan remediation"),
                Action(ActionType.CREATE_ENV_TEMPLATE, "Create .env.example"),
                Action(ActionType.UPDATE_GITIGNORE, "Update .gitignore"),
                Action(ActionType.REFACTOR_CODE, "Refactor code"),
                Action(ActionType.ADD_ENV_LOADING, "Add env loading"),
                Action(ActionType.VALIDATE, "Validate syntax"),
            ]

        # Add git actions if enabled and not dry run
        if self.create_branch and not self.dry_run:
            plan.actions.extend([
                Action(ActionType.CREATE_BRANCH, "Create git branch for changes"),
                Action(ActionType.COMMIT, "Commit changes with descriptive message"),
            ])

        # Always add report at the end
        plan.actions.append(Action(ActionType.REPORT, "Generate remediation report"))

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

        if action.type == ActionType.SCAN:
            return self._action_scan()

        elif action.type == ActionType.ANALYZE:
            return self._action_analyze(action.params.get("report_path"))

        elif action.type == ActionType.CREATE_ENV_TEMPLATE:
            return self._action_create_env_template()

        elif action.type == ActionType.UPDATE_GITIGNORE:
            return self._action_update_gitignore()

        elif action.type == ActionType.REFACTOR_CODE:
            return self._action_refactor_code()

        elif action.type == ActionType.ADD_ENV_LOADING:
            return self._action_add_env_loading()

        elif action.type == ActionType.VALIDATE:
            return self._action_validate()

        elif action.type == ActionType.CREATE_BRANCH:
            return self._action_create_branch()

        elif action.type == ActionType.COMMIT:
            return self._action_commit()

        elif action.type == ActionType.REPORT:
            return self._action_report()

        return {"success": False, "error": f"Unknown action type: {action.type}"}

    def _action_scan(self) -> dict:
        """Run level3_secret_scanner to get findings."""
        scanner_path = self.root_dir / "scripts/agents/level3_secret_scanner.py"

        if not scanner_path.exists():
            return {"success": False, "error": "Secret scanner not found"}

        try:
            cmd = [sys.executable, str(scanner_path), "--quick", "--json"]
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=self.root_dir,
                timeout=120
            )

            if result.returncode != 0 and not result.stdout:
                return {"success": False, "error": result.stderr or "Scanner failed"}

            try:
                data = json.loads(result.stdout)
                report = data.get("report", {})
                file_locations = report.get("file_locations", {})

                # Convert to SecretFinding objects
                for file_path, findings in file_locations.items():
                    # Skip git history findings
                    if file_path.startswith("git:"):
                        continue

                    # Apply target files filter if specified
                    if self.target_files:
                        if not any(target in file_path for target in self.target_files):
                            continue

                    for f in findings:
                        secret_type = self._detect_secret_type(
                            f.get("match", ""),
                            f.get("type", "")
                        )
                        env_var = self._generate_env_var_name(
                            secret_type,
                            f"{file_path} {f.get('type', '')}"
                        )

                        finding = SecretFinding(
                            file_path=file_path,
                            line_number=f.get("line", 0),
                            secret_type=f.get("type", "unknown"),
                            original_code=f.get("match", ""),
                            env_var_name=env_var,
                        )
                        self.findings.append(finding)

                return {
                    "success": True,
                    "findings_count": len(self.findings),
                    "files_affected": len(file_locations)
                }

            except json.JSONDecodeError:
                return {"success": False, "error": "Failed to parse scanner output"}

        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Scanner timed out"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _action_analyze(self, report_path: Optional[str] = None) -> dict:
        """Categorize secrets by type and remediation strategy."""
        if report_path:
            # Load from existing report
            try:
                report_file = Path(report_path)
                if not report_file.is_absolute():
                    report_file = self.root_dir / report_path

                with open(report_file) as f:
                    data = json.load(f)

                report = data.get("report", data)
                file_locations = report.get("file_locations", {})

                for file_path, findings in file_locations.items():
                    if file_path.startswith("git:"):
                        continue

                    if self.target_files:
                        if not any(target in file_path for target in self.target_files):
                            continue

                    for f in findings:
                        secret_type = self._detect_secret_type(
                            f.get("match", ""),
                            f.get("type", "")
                        )
                        env_var = self._generate_env_var_name(
                            secret_type,
                            f"{file_path} {f.get('type', '')}"
                        )

                        finding = SecretFinding(
                            file_path=file_path,
                            line_number=f.get("line", 0),
                            secret_type=f.get("type", "unknown"),
                            original_code=f.get("match", ""),
                            env_var_name=env_var,
                        )
                        self.findings.append(finding)

            except Exception as e:
                return {"success": False, "error": f"Failed to load report: {e}"}

        # Analyze and assign remediation strategies
        strategies = {}
        for finding in self.findings:
            secret_type = self._detect_secret_type(finding.original_code)

            if secret_type == SecretType.DATABASE_CONNECTION:
                finding.remediation_strategy = "decompose_connection_string"
            elif secret_type in [SecretType.API_KEY, SecretType.SECRET_KEY]:
                finding.remediation_strategy = "simple_env_replacement"
            elif secret_type == SecretType.PASSWORD:
                finding.remediation_strategy = "simple_env_replacement"
            elif secret_type == SecretType.PRIVATE_KEY:
                finding.remediation_strategy = "file_reference"
            else:
                finding.remediation_strategy = "simple_env_replacement"

            strategies[finding.remediation_strategy] = strategies.get(
                finding.remediation_strategy, 0
            ) + 1

        return {
            "success": True,
            "findings_analyzed": len(self.findings),
            "strategies": strategies
        }

    def _action_create_env_template(self) -> dict:
        """Generate .env.example with placeholders."""
        env_example_path = self.root_dir / ".env.example"

        # Collect all env vars needed
        env_vars = {}
        for finding in self.findings:
            if finding.env_var_name:
                env_vars[finding.env_var_name] = self._get_placeholder(finding.env_var_name)

        # Add any vars from remediation
        for var_name in self.env_vars_created:
            if var_name not in env_vars:
                env_vars[var_name] = self._get_placeholder(var_name)

        if not env_vars:
            return {"success": True, "message": "No environment variables to add"}

        # Read existing .env.example if present
        existing_vars = {}
        if env_example_path.exists():
            try:
                content = env_example_path.read_text()
                for line in content.split('\n'):
                    if '=' in line and not line.strip().startswith('#'):
                        key = line.split('=')[0].strip()
                        existing_vars[key] = line.split('=', 1)[1].strip() if '=' in line else ''
            except Exception:
                pass

        # Merge with existing
        all_vars = {**existing_vars, **env_vars}

        # Generate content
        lines = [
            "# Environment Variables",
            "# Generated by level3_secrets_remediation agent",
            f"# Last updated: {datetime.utcnow().isoformat()}",
            "",
            "# Database Configuration",
        ]

        db_vars = {k: v for k, v in all_vars.items() if k.startswith('DB_') or 'DATABASE' in k}
        for var, placeholder in sorted(db_vars.items()):
            lines.append(f"{var}={placeholder}")

        lines.append("")
        lines.append("# API Keys")
        api_vars = {k: v for k, v in all_vars.items() if 'API' in k or 'KEY' in k}
        api_vars = {k: v for k, v in api_vars.items() if k not in db_vars}
        for var, placeholder in sorted(api_vars.items()):
            lines.append(f"{var}={placeholder}")

        lines.append("")
        lines.append("# Secrets and Tokens")
        secret_vars = {k: v for k, v in all_vars.items() if k not in db_vars and k not in api_vars}
        for var, placeholder in sorted(secret_vars.items()):
            lines.append(f"{var}={placeholder}")

        lines.append("")

        content = '\n'.join(lines)

        if self.dry_run:
            self.log(f"Would create .env.example with {len(all_vars)} variables")
            return {
                "success": True,
                "env_vars": list(all_vars.keys()),
                "content": content,
                "dry_run": True
            }

        try:
            env_example_path.write_text(content)
            self.files_modified.append(str(env_example_path.relative_to(self.root_dir)))
            return {
                "success": True,
                "env_vars": list(all_vars.keys()),
                "path": str(env_example_path)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _get_placeholder(self, var_name: str) -> str:
        """Get appropriate placeholder value for env var."""
        placeholders = {
            'DB_HOST': 'localhost',
            'DB_PORT': '5432',
            'DB_NAME': 'your_database',
            'DB_USER': 'your_username',
            'DB_PASSWORD': 'your_password_here',
            'DATABASE_URL': 'postgresql://user:password@localhost:5432/database',
            'API_KEY': 'your_api_key_here',
            'SECRET_KEY': 'your_secret_key_here',
            'ACCESS_TOKEN': 'your_access_token_here',
            'BEARER_TOKEN': 'your_bearer_token_here',
            'JWT_SECRET': 'your_jwt_secret_here',
            'ENCRYPTION_KEY': 'your_encryption_key_here',
            'WEBHOOK_SECRET': 'your_webhook_secret_here',
            'APP_PASSWORD': 'your_password_here',
        }

        for pattern, placeholder in placeholders.items():
            if pattern in var_name:
                return placeholder

        return 'your_value_here'

    def _action_update_gitignore(self) -> dict:
        """Ensure .env files are gitignored."""
        gitignore_path = self.root_dir / ".gitignore"

        env_patterns = [
            ".env",
            ".env.local",
            ".env.*.local",
            ".env.development",
            ".env.production",
            ".env.staging",
            "*.env",
            "!.env.example",
            "!.env.*.example",
        ]

        existing_patterns = set()
        existing_content = ""

        if gitignore_path.exists():
            try:
                existing_content = gitignore_path.read_text()
                existing_patterns = set(
                    line.strip() for line in existing_content.split('\n')
                    if line.strip() and not line.strip().startswith('#')
                )
            except Exception:
                pass

        patterns_to_add = [p for p in env_patterns if p not in existing_patterns]

        if not patterns_to_add:
            return {"success": True, "message": "All .env patterns already in .gitignore"}

        if self.dry_run:
            self.log(f"Would add {len(patterns_to_add)} patterns to .gitignore")
            return {
                "success": True,
                "patterns_to_add": patterns_to_add,
                "dry_run": True
            }

        try:
            new_section = "\n# Environment files (auto-added by secrets remediation)\n"
            new_section += '\n'.join(patterns_to_add)
            new_section += '\n'

            if existing_content and not existing_content.endswith('\n'):
                new_section = '\n' + new_section

            with open(gitignore_path, 'a') as f:
                f.write(new_section)

            self.files_modified.append(str(gitignore_path.relative_to(self.root_dir)))
            return {
                "success": True,
                "patterns_added": patterns_to_add
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _action_refactor_code(self) -> dict:
        """Replace hardcoded secrets with os.environ.get()."""
        files_modified = 0
        secrets_remediated = 0

        # Group findings by file
        by_file: dict[str, list[SecretFinding]] = {}
        for finding in self.findings:
            if finding.file_path not in by_file:
                by_file[finding.file_path] = []
            by_file[finding.file_path].append(finding)

        for file_path, file_findings in by_file.items():
            full_path = self.root_dir / file_path

            if not full_path.exists():
                self.log(f"File not found: {file_path}", "WARN")
                continue

            try:
                content = full_path.read_text()
                original_content = content
                lines = content.split('\n')

                # Sort findings by line number (descending) to avoid offset issues
                sorted_findings = sorted(file_findings, key=lambda f: f.line_number, reverse=True)

                for finding in sorted_findings:
                    line_idx = finding.line_number - 1
                    if 0 <= line_idx < len(lines):
                        original_line = lines[line_idx]

                        # Generate remediation
                        finding.remediated_code = self._remediate_line(
                            original_line,
                            finding.env_var_name,
                            finding.secret_type
                        )

                        if finding.remediated_code and finding.remediated_code != original_line:
                            lines[line_idx] = finding.remediated_code
                            secrets_remediated += 1
                            self.env_vars_created[finding.env_var_name] = '***REDACTED***'

                new_content = '\n'.join(lines)

                if new_content != original_content:
                    if self.dry_run:
                        self.log(f"Would modify {file_path}")
                    else:
                        full_path.write_text(new_content)
                        self.files_modified.append(file_path)
                    files_modified += 1

            except Exception as e:
                self.log(f"Error processing {file_path}: {e}", "ERROR")

        return {
            "success": True,
            "files_modified": files_modified,
            "secrets_remediated": secrets_remediated,
            "dry_run": self.dry_run
        }

    def _remediate_line(self, line: str, env_var: str, secret_type: str) -> str:
        """Remediate a single line containing a secret."""
        # Database connection string
        db_match = re.search(
            r'["\']?(mysql|postgres|postgresql|mongodb|redis)://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(\w+)["\']?',
            line
        )
        if db_match:
            proto = db_match.group(1)
            port = db_match.group(5) or ('5432' if 'postgres' in proto else '3306')

            # Store components
            self.env_vars_created['DB_USER'] = '***REDACTED***'
            self.env_vars_created['DB_PASSWORD'] = '***REDACTED***'
            self.env_vars_created['DB_HOST'] = db_match.group(4)
            self.env_vars_created['DB_PORT'] = port
            self.env_vars_created['DB_NAME'] = db_match.group(6)

            replacement = f'f"{proto}://{{os.environ.get(\'DB_USER\')}}:{{os.environ.get(\'DB_PASSWORD\')}}@{{os.environ.get(\'DB_HOST\', \'localhost\')}}:{{os.environ.get(\'DB_PORT\', \'{port}\')}}/{{os.environ.get(\'DB_NAME\')}}"'
            return re.sub(
                r'["\']?(mysql|postgres|postgresql|mongodb|redis)://[^"\']+["\']?',
                replacement,
                line
            )

        # Simple variable assignment: VAR = "secret"
        var_match = re.match(r'^(\s*)(\w+)\s*=\s*["\']([^"\']+)["\'](.*)$', line)
        if var_match:
            indent, var_name, secret_value, trailing = var_match.groups()
            return f'{indent}{var_name} = os.environ.get(\'{env_var}\'){trailing}'

        # API key patterns: api_key = "sk-..."
        api_match = re.search(r'(["\'])([A-Za-z0-9_-]{20,})\1', line)
        if api_match:
            quote = api_match.group(1)
            return line.replace(
                f'{quote}{api_match.group(2)}{quote}',
                f'os.environ.get(\'{env_var}\')'
            )

        # Password in keyword arg: password="secret"
        pwd_match = re.search(r'(\w*password\w*)\s*=\s*["\']([^"\']+)["\']', line, re.IGNORECASE)
        if pwd_match:
            param_name = pwd_match.group(1)
            return re.sub(
                r'(\w*password\w*)\s*=\s*["\'][^"\']+["\']',
                f'{param_name}=os.environ.get(\'{env_var}\')',
                line,
                flags=re.IGNORECASE
            )

        return line

    def _action_add_env_loading(self) -> dict:
        """Add python-dotenv or similar loading code."""
        files_updated = 0

        # Find Python files that were modified
        py_files = [f for f in self.files_modified if f.endswith('.py')]

        dotenv_import = "from dotenv import load_dotenv"
        dotenv_call = "load_dotenv()"
        os_import = "import os"

        for file_path in py_files:
            full_path = self.root_dir / file_path

            if not full_path.exists():
                continue

            try:
                content = full_path.read_text()

                # Check if already has dotenv
                if 'load_dotenv' in content:
                    continue

                lines = content.split('\n')
                new_lines = []
                added_imports = False
                has_os_import = 'import os' in content

                for i, line in enumerate(lines):
                    # Add after shebang and docstring, before other imports
                    if not added_imports:
                        # Skip shebang
                        if line.startswith('#!'):
                            new_lines.append(line)
                            continue

                        # Skip from __future__ imports
                        if line.strip().startswith('from __future__'):
                            new_lines.append(line)
                            continue

                        # Skip docstrings
                        if line.strip().startswith('"""') or line.strip().startswith("'''"):
                            new_lines.append(line)
                            # Handle multi-line docstring
                            if line.count('"""') == 1 or line.count("'''") == 1:
                                # Find end of docstring
                                for j in range(i + 1, len(lines)):
                                    new_lines.append(lines[j])
                                    if '"""' in lines[j] or "'''" in lines[j]:
                                        break
                            continue

                        # Add imports after docstring/shebang
                        if line.strip().startswith('import ') or line.strip().startswith('from ') or line.strip() == '':
                            if not has_os_import:
                                new_lines.append(os_import)
                            new_lines.append(dotenv_import)
                            new_lines.append("")
                            new_lines.append(dotenv_call)
                            new_lines.append("")
                            added_imports = True

                    new_lines.append(line)

                if not added_imports:
                    # Add at the beginning if no good insertion point found
                    insert_lines = []
                    if not has_os_import:
                        insert_lines.append(os_import)
                    insert_lines.extend([dotenv_import, "", dotenv_call, ""])
                    new_lines = insert_lines + lines

                new_content = '\n'.join(new_lines)

                if self.dry_run:
                    self.log(f"Would add dotenv loading to {file_path}")
                else:
                    full_path.write_text(new_content)
                    files_updated += 1

            except Exception as e:
                self.log(f"Error adding env loading to {file_path}: {e}", "WARN")

        return {
            "success": True,
            "files_updated": files_updated,
            "dry_run": self.dry_run
        }

    def _action_validate(self) -> dict:
        """Verify refactored code still works (syntax check)."""
        errors = []
        validated = 0

        for file_path in self.files_modified:
            if not file_path.endswith('.py'):
                continue

            full_path = self.root_dir / file_path

            if not full_path.exists():
                continue

            result = subprocess.run(
                [sys.executable, "-m", "py_compile", str(full_path)],
                capture_output=True,
                text=True
            )

            if result.returncode != 0:
                errors.append({
                    "file": file_path,
                    "error": result.stderr
                })
            else:
                validated += 1

        return {
            "success": len(errors) == 0,
            "validated": validated,
            "errors": errors
        }

    def _action_create_branch(self) -> dict:
        """Create git branch for changes."""
        if self.dry_run:
            return {"success": True, "dry_run": True}

        if not (self.root_dir / ".git").exists():
            return {"success": False, "error": "Not a git repository"}

        timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        self.branch_name = f"{self.BRANCH_PREFIX}{timestamp}"

        try:
            # Create and checkout branch
            result = subprocess.run(
                ["git", "checkout", "-b", self.branch_name],
                capture_output=True,
                text=True,
                cwd=self.root_dir
            )

            if result.returncode != 0:
                return {"success": False, "error": result.stderr}

            return {
                "success": True,
                "branch_name": self.branch_name
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _action_commit(self) -> dict:
        """Commit changes with descriptive message."""
        if self.dry_run:
            return {"success": True, "dry_run": True}

        if not self.files_modified:
            return {"success": True, "message": "No files to commit"}

        try:
            # Stage files
            for file_path in self.files_modified:
                subprocess.run(
                    ["git", "add", file_path],
                    capture_output=True,
                    cwd=self.root_dir
                )

            # Create commit message
            commit_msg = f"""fix(security): Move exposed secrets to environment variables

Remediated {len(self.findings)} exposed secrets across {len(self.files_modified)} files.

Changes:
- Replaced hardcoded secrets with os.environ.get() calls
- Created/updated .env.example with placeholder values
- Updated .gitignore to exclude .env files
- Added python-dotenv loading where needed

Environment variables created:
{chr(10).join(f'- {var}' for var in sorted(self.env_vars_created.keys()))}

Generated by: level3_secrets_remediation agent
"""

            result = subprocess.run(
                ["git", "commit", "-m", commit_msg],
                capture_output=True,
                text=True,
                cwd=self.root_dir
            )

            if result.returncode != 0:
                return {"success": False, "error": result.stderr}

            # Get commit SHA
            sha_result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                capture_output=True,
                text=True,
                cwd=self.root_dir
            )
            self.commit_sha = sha_result.stdout.strip()[:8]

            return {
                "success": True,
                "commit_sha": self.commit_sha,
                "files_committed": len(self.files_modified)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _action_report(self) -> dict:
        """Generate remediation report."""
        env_example_path = self.root_dir / ".env.example"
        env_example_content = ""

        if env_example_path.exists():
            try:
                env_example_content = env_example_path.read_text()
            except Exception:
                pass

        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "dry_run": self.dry_run,
            "files_modified": self.files_modified,
            "secrets_remediated": len([f for f in self.findings if f.remediated_code]),
            "env_vars_created": list(self.env_vars_created.keys()),
            "env_example_content": env_example_content,
            "branch_name": self.branch_name,
            "commit_sha": self.commit_sha,
            "findings": [
                {
                    "file": f.file_path,
                    "line": f.line_number,
                    "type": f.secret_type,
                    "env_var": f.env_var_name,
                    "strategy": f.remediation_strategy,
                    "remediated": bool(f.remediated_code)
                }
                for f in self.findings
            ]
        }

        return {
            "success": True,
            "report": report
        }

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
                # Check validation errors
                if action.type == ActionType.VALIDATE:
                    errors = action.result.get("errors", [])
                    if errors:
                        reflection.issues.append(f"Validation found {len(errors)} syntax errors")
                        reflection.should_retry = True
                        reflection.suggestions.append("Review and fix syntax errors in modified files")

                # Check if no findings
                if action.type == ActionType.SCAN:
                    if action.result.get("findings_count", 0) == 0:
                        reflection.issues.append("No secrets found to remediate")

                # Check refactoring results
                if action.type == ActionType.REFACTOR_CODE:
                    if action.result.get("secrets_remediated", 0) == 0:
                        reflection.issues.append("No secrets were successfully remediated")

        # Overall success check
        if not self.findings:
            reflection.success = True  # No findings is actually success
        elif not any(f.remediated_code for f in self.findings):
            reflection.success = False
            reflection.issues.append("Failed to remediate any secrets")

        self.log(f"Reflection: success={reflection.success}, issues={len(reflection.issues)}")
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

        # If validation failed, retry refactoring with fixes
        if any("syntax error" in issue.lower() for issue in reflection.issues):
            new_plan.actions.append(Action(ActionType.REFACTOR_CODE, "Retry code refactoring"))
            new_plan.actions.append(Action(ActionType.VALIDATE, "Re-validate changes"))

        # Always end with report
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

        # Warn about file modifications
        if any(action.type in [ActionType.REFACTOR_CODE, ActionType.ADD_ENV_LOADING] for action in plan.actions):
            if self.dry_run:
                check.warnings.append("Dry run mode - no files will be modified")
            else:
                check.warnings.append("Agent will modify source files")

        # Warn about git operations
        if any(action.type in [ActionType.CREATE_BRANCH, ActionType.COMMIT] for action in plan.actions):
            if not self.dry_run:
                check.warnings.append("Agent will create git branch and commit changes")

        return check

    # ==================== MAIN LOOP ====================

    def run(self, intent: str) -> dict:
        """
        Main autonomous execution loop.

        PLAN -> EXECUTE -> REFLECT -> ADAPT (repeat until success or max iterations)
        """
        self.log(f"Starting Level 3 Secrets Remediation with intent: {intent}")
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

        # Final state
        self.state = AgentState.COMPLETED if reflection.success else AgentState.FAILED
        duration = time.time() - start_time

        # Get final report
        final_report = self._action_report()

        result = {
            "success": reflection.success,
            "iterations": plan.iteration,
            "duration_seconds": round(duration, 2),
            "final_state": self.state.value,
            "report": final_report.get("report", {}),
            "issues": reflection.issues,
            "execution_log_entries": len(self.execution_log)
        }

        self.log(f"Agent completed: success={result['success']}, iterations={result['iterations']}")
        return result


def main():
    parser = argparse.ArgumentParser(
        description="Level 3 Secrets Remediation Agent - Autonomous Plan & Reflect",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        "intent",
        nargs="?",
        default="scan and fix all exposed secrets",
        help="The intent/goal for the agent to achieve"
    )
    parser.add_argument(
        "--from-report", "-r",
        type=str,
        help="Load findings from existing scanner report JSON"
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Preview changes without modifying files"
    )
    parser.add_argument(
        "--files", "-f",
        type=str,
        help="Comma-separated list of specific files to process"
    )
    parser.add_argument(
        "--no-branch",
        action="store_true",
        help="Don't create a git branch for changes"
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

    # Parse target files
    target_files = None
    if args.files:
        target_files = [f.strip() for f in args.files.split(',')]

    # Find repo root
    root = Path.cwd()
    while root != root.parent:
        if (root / ".git").is_dir() or (root / "scripts").is_dir():
            break
        root = root.parent

    agent = Level3SecretsRemediation(
        root,
        verbose=not args.quiet,
        dry_run=args.dry_run,
        create_branch=not args.no_branch,
        target_files=target_files,
        from_report=args.from_report
    )
    result = agent.run(args.intent)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"\n{'='*60}")
        print("Level 3 Secrets Remediation Agent - Execution Complete")
        print(f"{'='*60}")
        print(f"Intent:      {args.intent}")
        print(f"Success:     {result['success']}")
        print(f"Iterations:  {result['iterations']}")
        print(f"Duration:    {result['duration_seconds']}s")
        print(f"Dry Run:     {args.dry_run}")

        report = result.get("report", {})

        print(f"\nRemediation Summary:")
        print(f"  Files modified:      {len(report.get('files_modified', []))}")
        print(f"  Secrets remediated:  {report.get('secrets_remediated', 0)}")
        print(f"  Env vars created:    {len(report.get('env_vars_created', []))}")

        if report.get('branch_name'):
            print(f"\nGit:")
            print(f"  Branch: {report.get('branch_name')}")
            print(f"  Commit: {report.get('commit_sha', 'N/A')}")

        if report.get('files_modified'):
            print(f"\nModified Files:")
            for f in report['files_modified'][:10]:
                print(f"  - {f}")
            if len(report['files_modified']) > 10:
                print(f"  ... and {len(report['files_modified']) - 10} more")

        if report.get('env_vars_created'):
            print(f"\nEnvironment Variables:")
            for var in sorted(report['env_vars_created'])[:15]:
                print(f"  - {var}")
            if len(report['env_vars_created']) > 15:
                print(f"  ... and {len(report['env_vars_created']) - 15} more")

        if result.get("issues"):
            print(f"\nIssues:")
            for issue in result["issues"]:
                print(f"  - {issue}")

    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
