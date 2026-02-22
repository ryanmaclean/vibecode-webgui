#!/usr/bin/env python3
"""
Regression tests for GitHub Actions workflow configurations.

This script validates all workflow YAML files against best practices identified
during the CI/CD pipeline fix (Task #002). It prevents recurrence of systemic
issues that caused workflow failures.

Validated Patterns:
1. Weak CI Enforcement - No excessive continue-on-error usage
2. Missing Concurrency Controls - All workflows have concurrency configured
3. Hardcoded Values - No hardcoded repository owners or brittle values
4. Tag Collisions - Container tags include unique identifiers
5. YAML Syntax - All files are valid YAML
6. Basic Configuration - Required fields present

Usage:
    python tests/workflows/test_workflow_validation.py

Exit codes:
    0 - All validations passed
    1 - One or more validations failed
"""

import os
import sys
import yaml
import glob
from pathlib import Path
from typing import List, Dict, Tuple, Any

# ANSI color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

class WorkflowValidator:
    """Validates GitHub Actions workflow files against best practices."""

    def __init__(self, workflows_dir: str = '.github/workflows'):
        self.workflows_dir = Path(workflows_dir)
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.passed_checks = 0
        self.failed_checks = 0

    def find_workflow_files(self) -> List[Path]:
        """Find all YAML workflow files."""
        pattern = str(self.workflows_dir / '*.yml')
        files = [Path(f) for f in glob.glob(pattern)]

        # Also check for .yaml extension
        pattern_yaml = str(self.workflows_dir / '*.yaml')
        files.extend([Path(f) for f in glob.glob(pattern_yaml)])

        return sorted(files)

    def load_workflow(self, filepath: Path) -> Tuple[Dict[str, Any], str]:
        """
        Load and parse a workflow YAML file.
        Returns (parsed_content, error_message).
        """
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = yaml.safe_load(f)
                if content is None:
                    return {}, f"Empty YAML file: {filepath.name}"

                # YAML converts 'on' to True (boolean). Fix this by checking both.
                # If True key exists but 'on' doesn't, rename it
                if True in content and 'on' not in content:
                    content['on'] = content.pop(True)

                return content, ""
        except yaml.YAMLError as e:
            return {}, f"YAML parsing error in {filepath.name}: {str(e)}"
        except Exception as e:
            return {}, f"Error reading {filepath.name}: {str(e)}"

    def validate_yaml_syntax(self, filepath: Path, workflow: Dict) -> bool:
        """Validate YAML syntax and basic structure."""
        if not workflow:
            self.errors.append(f"❌ {filepath.name}: Empty or invalid YAML")
            return False

        self.passed_checks += 1
        print(f"  ✅ Valid YAML syntax")
        return True

    def validate_basic_structure(self, filepath: Path, workflow: Dict) -> bool:
        """Validate workflow has required fields."""
        required_fields = ['name', 'on']
        missing_fields = [f for f in required_fields if f not in workflow]

        if missing_fields:
            self.errors.append(
                f"❌ {filepath.name}: Missing required fields: {', '.join(missing_fields)}"
            )
            return False

        # Check if workflow has jobs (unless it's a reusable workflow)
        if 'jobs' not in workflow and workflow.get('on') != 'workflow_call':
            self.warnings.append(
                f"⚠️  {filepath.name}: No 'jobs' defined (might be incomplete)"
            )

        self.passed_checks += 1
        print(f"  ✅ Has required fields (name, on)")
        return True

    def validate_concurrency_control(self, filepath: Path, workflow: Dict) -> bool:
        """
        Validate workflow has concurrency control to prevent resource waste.
        Pattern 3: Missing Concurrency Controls
        """
        # Skip validation for:
        # - workflow_call (reusable workflows don't need concurrency at top level)
        # - schedule-only workflows (they don't compete for resources)
        on_triggers = workflow.get('on', {})

        # Handle both string and dict formats for 'on'
        if isinstance(on_triggers, str):
            if on_triggers == 'workflow_call':
                print(f"  ⏭️  Skipped concurrency check (reusable workflow)")
                return True
        elif isinstance(on_triggers, dict):
            if 'workflow_call' in on_triggers and len(on_triggers) == 1:
                print(f"  ⏭️  Skipped concurrency check (reusable workflow)")
                return True
            # Schedule-only workflows don't need concurrency
            if 'schedule' in on_triggers and len(on_triggers) == 1:
                print(f"  ⏭️  Skipped concurrency check (schedule-only workflow)")
                return True

        if 'concurrency' not in workflow:
            self.warnings.append(
                f"⚠️  {filepath.name}: No concurrency control (may waste resources on duplicate runs)"
            )
            print(f"  ⚠️  No concurrency control configured")
            return True  # Warning, not error

        concurrency = workflow['concurrency']
        if not isinstance(concurrency, dict):
            self.errors.append(
                f"❌ {filepath.name}: Invalid concurrency configuration"
            )
            return False

        if 'group' not in concurrency:
            self.errors.append(
                f"❌ {filepath.name}: Concurrency missing 'group' key"
            )
            return False

        self.passed_checks += 1
        print(f"  ✅ Has concurrency control configured")
        return True

    def validate_continue_on_error(self, filepath: Path, workflow: Dict) -> bool:
        """
        Validate continue-on-error is not excessively used.
        Pattern 1: Weak CI Enforcement
        """
        jobs = workflow.get('jobs', {})
        continue_on_error_count = 0
        total_steps = 0
        problematic_steps = []

        for job_name, job_config in jobs.items():
            if not isinstance(job_config, dict):
                continue

            steps = job_config.get('steps', [])
            for step_idx, step in enumerate(steps):
                if not isinstance(step, dict):
                    continue

                total_steps += 1

                if step.get('continue-on-error') is True:
                    continue_on_error_count += 1
                    step_name = step.get('name', f'step-{step_idx}')

                    # Check if this is a critical step that should fail fast
                    step_name_lower = step_name.lower()
                    run_cmd = str(step.get('run', '')).lower()

                    # Exceptions: Notification/reporting steps can safely continue on error
                    is_notification = any([
                        'notify' in step_name_lower,
                        'notification' in step_name_lower,
                        'slack' in step_name_lower,
                        'comment' in step_name_lower,
                        'report' in step_name_lower,
                        'upload' in step_name_lower and 'artifact' in step_name_lower,
                    ])

                    # Critical steps that must fail fast
                    is_critical = any([
                        'test' in step_name_lower and 'notification' not in step_name_lower,
                        'security' in step_name_lower and 'notification' not in step_name_lower,
                        'audit' in step_name_lower,
                        'lint' in step_name_lower,
                        'sbom' in step_name_lower and 'upload' not in step_name_lower,
                        'npm test' in run_cmd,
                        'npm audit' in run_cmd,
                        'security' in run_cmd and 'notification' not in run_cmd,
                    ])

                    if is_critical and not is_notification:
                        problematic_steps.append(f"{job_name}.{step_name}")

        # Report findings
        if problematic_steps:
            self.errors.append(
                f"❌ {filepath.name}: Critical steps have continue-on-error=true: "
                f"{', '.join(problematic_steps[:3])}"
                + (f" and {len(problematic_steps) - 3} more" if len(problematic_steps) > 3 else "")
            )
            print(f"  ❌ {len(problematic_steps)} critical steps with continue-on-error")
            return False

        if total_steps > 0:
            percentage = (continue_on_error_count / total_steps) * 100

            # Warn if > 30% of steps have continue-on-error
            if percentage > 30:
                self.warnings.append(
                    f"⚠️  {filepath.name}: {percentage:.0f}% of steps ({continue_on_error_count}/{total_steps}) "
                    f"have continue-on-error=true"
                )
                print(f"  ⚠️  {percentage:.0f}% of steps have continue-on-error")
            else:
                self.passed_checks += 1
                if continue_on_error_count > 0:
                    print(f"  ✅ Reasonable use of continue-on-error ({continue_on_error_count}/{total_steps} steps)")
                else:
                    print(f"  ✅ No continue-on-error usage (fail-fast enabled)")

        return True

    def validate_hardcoded_values(self, filepath: Path, workflow: Dict) -> bool:
        """
        Validate workflow doesn't use hardcoded repository-specific values.
        Pattern 5: Hardcoded Values
        """
        workflow_str = yaml.dump(workflow)
        hardcoded_issues = []

        # Check for hardcoded repository owner (should use github.repository_owner)
        hardcoded_patterns = [
            ('ryanmaclean', 'hardcoded repository owner (use ${{ github.repository_owner }})'),
            ('vibecode-webgui', 'hardcoded repository name (use ${{ github.repository }})'),
        ]

        for pattern, message in hardcoded_patterns:
            if pattern in workflow_str and 'github.repository' not in workflow_str:
                # Check if it's in a comment or just in string values
                jobs = workflow.get('jobs', {})
                found_in_code = False

                for job_config in jobs.values():
                    if not isinstance(job_config, dict):
                        continue

                    steps = job_config.get('steps', [])
                    for step in steps:
                        if not isinstance(step, dict):
                            continue

                        # Check in run commands and uses
                        run_cmd = str(step.get('run', ''))
                        uses = str(step.get('uses', ''))
                        with_args = str(step.get('with', {}))

                        if pattern in run_cmd or pattern in uses or pattern in with_args:
                            found_in_code = True
                            break

                    if found_in_code:
                        break

                if found_in_code:
                    hardcoded_issues.append(message)

        if hardcoded_issues:
            self.warnings.append(
                f"⚠️  {filepath.name}: Found hardcoded values: {', '.join(hardcoded_issues)}"
            )
            print(f"  ⚠️  Contains hardcoded repository-specific values")
            return True  # Warning, not error

        self.passed_checks += 1
        print(f"  ✅ No problematic hardcoded values")
        return True

    def validate_container_tags(self, filepath: Path, workflow: Dict) -> bool:
        """
        Validate container image tags include unique identifiers.
        Pattern 6: Tag Collisions
        """
        # Only check workflows that build/push containers
        workflow_str = yaml.dump(workflow).lower()

        is_container_workflow = any([
            'docker/build-push-action' in workflow_str,
            'docker build' in workflow_str,
            'docker push' in workflow_str,
            'docker/metadata-action' in workflow_str,
        ])

        if not is_container_workflow:
            print(f"  ⏭️  Skipped container tag check (not a container workflow)")
            return True

        # Check if tags include unique identifiers
        has_run_id = 'github.run_id' in workflow_str
        has_sha = 'github.sha' in workflow_str

        if not (has_run_id or has_sha):
            self.errors.append(
                f"❌ {filepath.name}: Container tags should include unique identifiers "
                f"(github.run_id or github.sha) to prevent collisions"
            )
            print(f"  ❌ Container tags missing unique identifiers")
            return False

        self.passed_checks += 1
        print(f"  ✅ Container tags include unique identifiers")
        return True

    def validate_timeout_protection(self, filepath: Path, workflow: Dict) -> bool:
        """
        Validate jobs have timeout protection to prevent indefinite hangs.
        Pattern 8: Poor Error Handling
        """
        jobs = workflow.get('jobs', {})
        jobs_without_timeout = []

        for job_name, job_config in jobs.items():
            if not isinstance(job_config, dict):
                continue

            # Skip reusable workflow jobs (they inherit timeout from caller)
            if job_config.get('uses'):
                continue

            if 'timeout-minutes' not in job_config:
                jobs_without_timeout.append(job_name)

        if jobs_without_timeout and len(jobs) > 0:
            # Only warn if there are multiple jobs or long-running jobs
            if len(jobs_without_timeout) > 1:
                self.warnings.append(
                    f"⚠️  {filepath.name}: {len(jobs_without_timeout)} jobs missing timeout protection: "
                    f"{', '.join(jobs_without_timeout[:3])}"
                )
                print(f"  ⚠️  {len(jobs_without_timeout)}/{len(jobs)} jobs missing timeout protection")
            else:
                print(f"  ℹ️  Some jobs missing timeout protection (consider adding)")
            return True

        self.passed_checks += 1
        if jobs:
            print(f"  ✅ All jobs have timeout protection")
        return True

    def validate_workflow(self, filepath: Path) -> bool:
        """Run all validations on a single workflow file."""
        print(f"\n{Colors.BLUE}{Colors.BOLD}Validating: {filepath.name}{Colors.RESET}")

        workflow, error = self.load_workflow(filepath)
        if error:
            self.errors.append(f"❌ {error}")
            self.failed_checks += 1
            print(f"  {Colors.RED}❌ Failed to load workflow{Colors.RESET}")
            return False

        # Run all validation checks
        validations = [
            self.validate_yaml_syntax,
            self.validate_basic_structure,
            self.validate_concurrency_control,
            self.validate_continue_on_error,
            self.validate_hardcoded_values,
            self.validate_container_tags,
            self.validate_timeout_protection,
        ]

        all_passed = True
        for validation in validations:
            try:
                result = validation(filepath, workflow)
                if not result:
                    all_passed = False
                    self.failed_checks += 1
            except Exception as e:
                self.errors.append(f"❌ {filepath.name}: Validation error: {str(e)}")
                self.failed_checks += 1
                all_passed = False
                print(f"  {Colors.RED}❌ Validation error: {str(e)}{Colors.RESET}")

        return all_passed

    def print_summary(self, total_workflows: int):
        """Print validation summary."""
        print(f"\n{Colors.BOLD}{'='*80}{Colors.RESET}")
        print(f"{Colors.BOLD}Validation Summary{Colors.RESET}")
        print(f"{'='*80}")

        print(f"\nWorkflows validated: {total_workflows}")
        print(f"Checks passed: {Colors.GREEN}{self.passed_checks}{Colors.RESET}")
        print(f"Checks failed: {Colors.RED}{self.failed_checks}{Colors.RESET}")
        print(f"Warnings: {Colors.YELLOW}{len(self.warnings)}{Colors.RESET}")

        if self.errors:
            print(f"\n{Colors.RED}{Colors.BOLD}Errors:{Colors.RESET}")
            for error in self.errors:
                print(f"  {error}")

        if self.warnings:
            print(f"\n{Colors.YELLOW}{Colors.BOLD}Warnings:{Colors.RESET}")
            for warning in self.warnings:
                print(f"  {warning}")

        if not self.errors and not self.warnings:
            print(f"\n{Colors.GREEN}{Colors.BOLD}✅ All validations passed!{Colors.RESET}")
        elif not self.errors:
            print(f"\n{Colors.GREEN}{Colors.BOLD}✅ All critical validations passed (with warnings){Colors.RESET}")
        else:
            print(f"\n{Colors.RED}{Colors.BOLD}❌ Validation failed{Colors.RESET}")

    def run(self) -> int:
        """
        Run validation on all workflow files.
        Returns exit code: 0 for success, 1 for failure.
        """
        print(f"{Colors.BOLD}GitHub Actions Workflow Validation{Colors.RESET}")
        print(f"Checking workflows in: {self.workflows_dir}")

        workflow_files = self.find_workflow_files()

        if not workflow_files:
            print(f"\n{Colors.RED}No workflow files found in {self.workflows_dir}{Colors.RESET}")
            return 1

        print(f"Found {len(workflow_files)} workflow file(s)")

        # Validate each workflow
        for filepath in workflow_files:
            self.validate_workflow(filepath)

        # Print summary
        self.print_summary(len(workflow_files))

        # Return exit code
        return 0 if not self.errors else 1


def main():
    """Main entry point."""
    # Determine workflows directory
    # If running from tests/workflows, adjust path
    current_dir = Path.cwd()

    if current_dir.name == 'workflows' and current_dir.parent.name == 'tests':
        workflows_dir = current_dir.parent.parent / '.github' / 'workflows'
    elif current_dir.name == 'tests':
        workflows_dir = current_dir.parent / '.github' / 'workflows'
    else:
        workflows_dir = current_dir / '.github' / 'workflows'

    # Fallback if directory doesn't exist
    if not workflows_dir.exists():
        workflows_dir = Path('.github/workflows')

    validator = WorkflowValidator(str(workflows_dir))
    exit_code = validator.run()
    sys.exit(exit_code)


if __name__ == '__main__':
    main()
