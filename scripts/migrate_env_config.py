#!/usr/bin/env python3
"""VibeCode Configuration Migration Script.

Safely migrate from multiple .env files to consolidated configuration.
Creates backups and validates before making changes.
Run with --dry-run first to see what would happen.
"""

import argparse
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path


class Color:
    """ANSI color codes for terminal output."""

    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"


@dataclass
class MigrationConfig:
    """Configuration for the migration."""

    project_root: Path
    backup_dir: Path
    dry_run: bool = False
    verbose: bool = False

    # Files to preserve (will be consolidated)
    core_env_files: list[str] = field(default_factory=lambda: [
        ".env",
        ".env.local",
        ".env.development.local",
    ])

    # Files to deprecate (move to backup)
    deprecated_env_files: list[str] = field(default_factory=lambda: [
        ".env.azure",
        ".env.demo.example",
        ".env.docker",
        ".env.docker.fixed",
        ".env.local.template",
        ".env.production.test",
        ".env.test-db",
        ".env.test-external-db",
        ".env.valkey",
    ])

    # Template files to keep
    template_files: list[str] = field(default_factory=lambda: [
        ".env.example",
        ".env.local.example",
        ".env.template",
    ])


def log_info(message: str) -> None:
    """Print info message."""
    print(f"{Color.BLUE}[INFO]{Color.NC} {message}")


def log_success(message: str) -> None:
    """Print success message."""
    print(f"{Color.GREEN}[SUCCESS]{Color.NC} {message}")


def log_warning(message: str) -> None:
    """Print warning message."""
    print(f"{Color.YELLOW}[WARNING]{Color.NC} {message}")


def log_error(message: str) -> None:
    """Print error message."""
    print(f"{Color.RED}[ERROR]{Color.NC} {message}")


def print_header(title: str) -> None:
    """Print section header."""
    print()
    print("=" * 77)
    print(title)
    print("=" * 77)
    print()


class EnvConfigMigrator:
    """Migrates environment configuration files."""

    def __init__(self, config: MigrationConfig) -> None:
        """Initialize migrator.

        Args:
            config: Migration configuration.
        """
        self.config = config

    def check_prerequisites(self) -> bool:
        """Check prerequisites for migration.

        Returns:
            True if all prerequisites met.
        """
        print_header("Checking Prerequisites")

        # Check for required tools
        missing_tools = []
        for tool in ["git", "diff", "grep"]:
            if not shutil.which(tool):
                missing_tools.append(tool)

        if missing_tools:
            log_error(f"Missing required tools: {' '.join(missing_tools)}")
            return False

        # Check if we're in a git repository
        result = subprocess.run(
            ["git", "rev-parse", "--git-dir"],
            capture_output=True,
            cwd=self.config.project_root,
        )
        if result.returncode != 0:
            log_error("Not in a git repository")
            return False

        # Check for uncommitted changes
        result = subprocess.run(
            ["git", "diff-index", "--quiet", "HEAD", "--"],
            capture_output=True,
            cwd=self.config.project_root,
        )
        if result.returncode != 0:
            log_warning("You have uncommitted changes. Consider committing or stashing them first.")
            response = input("Continue anyway? (y/N) ").strip().lower()
            if response not in ("y", "yes"):
                return False

        log_success("All prerequisites met")
        return True

    def validate_env_example(self) -> bool:
        """Validate .env.example file.

        Returns:
            True if validation passes.
        """
        print_header("Validating .env.example")

        env_example = self.config.project_root / ".env.example"
        if not env_example.exists():
            log_error(".env.example not found. Cannot proceed with migration.")
            return False

        content = env_example.read_text()

        # Check for critical sections
        required_sections = [
            "# Runtime",
            "# Database & Caching",
            "# Primary AI Provider",
            "# Observability & Datadog",
            "# Authentication Providers",
            "# Security & Rate Limiting",
        ]

        missing_sections = [s for s in required_sections if s not in content]

        if missing_sections:
            log_error("Missing required sections in .env.example:")
            for section in missing_sections:
                print(f"  - {section}")
            return False

        log_success(".env.example validated successfully")
        return True

    def create_backup(self) -> bool:
        """Create backup of all .env files.

        Returns:
            True if backup created successfully.
        """
        print_header("Creating Backup")

        if self.config.dry_run:
            log_info(f"[DRY RUN] Would create backup directory: {self.config.backup_dir}")
            return True

        self.config.backup_dir.mkdir(parents=True, exist_ok=True)
        log_info(f"Backup directory created: {self.config.backup_dir}")

        # Backup all .env files
        backed_up = 0
        env_files = list(self.config.project_root.glob(".env*"))

        for file in env_files:
            if file.is_file():
                shutil.copy2(file, self.config.backup_dir / file.name)
                backed_up += 1
                if self.config.verbose:
                    log_info(f"Backed up: {file.name}")

        # Create backup manifest
        manifest = self.config.backup_dir / "MANIFEST.txt"
        manifest_content = f"""VibeCode Configuration Backup
=============================
Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Location: {self.config.backup_dir}
Files backed up: {backed_up}

To restore from this backup:
  cp {self.config.backup_dir}/.env* {self.config.project_root}/

Original file locations:
"""
        for file in env_files:
            if file.is_file():
                manifest_content += f"  {file.name}\n"

        manifest.write_text(manifest_content)

        log_success(f"Backed up {backed_up} files to {self.config.backup_dir}")
        return True

    def analyze_current_config(self) -> None:
        """Analyze current configuration."""
        print_header("Analyzing Current Configuration")

        # Count files
        all_env_files = list(self.config.project_root.glob(".env*"))
        total = sum(1 for f in all_env_files if f.is_file())

        core_files = sum(
            1 for f in self.config.core_env_files
            if (self.config.project_root / f).exists()
        )
        deprecated_files = sum(
            1 for f in self.config.deprecated_env_files
            if (self.config.project_root / f).exists()
        )
        template_files = sum(
            1 for f in self.config.template_files
            if (self.config.project_root / f).exists()
        )

        log_info(f"Total .env files: {total}")
        log_info(f"Core files (to consolidate): {core_files}")
        log_info(f"Deprecated files (to archive): {deprecated_files}")
        log_info(f"Template files (to keep): {template_files}")

        # List deprecated files that exist
        print()
        log_info("Files to be archived:")
        for filename in self.config.deprecated_env_files:
            filepath = self.config.project_root / filename
            if filepath.exists():
                print(f"  - {filename}")

    def consolidate_configs(self) -> int:
        """Consolidate configuration files.

        Returns:
            Number of files archived.
        """
        print_header("Consolidating Configuration Files")

        if self.config.dry_run:
            log_info("[DRY RUN] Would consolidate configs (no actual changes)")
            return 0

        # Move deprecated files to backup
        archived = 0
        for filename in self.config.deprecated_env_files:
            filepath = self.config.project_root / filename
            if filepath.exists():
                log_info(f"Archiving: {filename}")
                shutil.move(filepath, self.config.backup_dir / filename)
                archived += 1

        log_success(f"Archived {archived} deprecated configuration files")
        return archived

    def update_gitignore(self) -> None:
        """Update .gitignore with deprecated file patterns."""
        print_header("Updating .gitignore")

        gitignore = self.config.project_root / ".gitignore"

        if self.config.dry_run:
            log_info("[DRY RUN] Would update .gitignore")
            return

        if not gitignore.exists():
            log_warning(".gitignore not found, skipping update")
            return

        content = gitignore.read_text()

        # Check if deprecated files are already ignored
        if ".env.azure" in content:
            log_info(".gitignore already up to date")
            return

        # Add deprecated patterns to gitignore
        additional = """
# Deprecated environment files (archived)
.env.azure
.env.demo.example
.env.docker
.env.docker.fixed
.env.local.template
.env.production.test
.env.test-db
.env.test-external-db
.env.valkey
"""
        gitignore.write_text(content + additional)
        log_success(".gitignore updated")

    def generate_migration_report(self) -> None:
        """Generate migration report."""
        print_header("Generating Migration Report")

        report_file = self.config.backup_dir / "MIGRATION_REPORT.md"

        # Count remaining files
        remaining = sum(
            1 for f in self.config.project_root.glob(".env*")
            if f.is_file()
        )

        status = "DRY RUN - No changes made" if self.config.dry_run else "COMPLETED"

        report = f"""# Configuration Migration Report

**Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**Backup Location:** `{self.config.backup_dir}`
**Status:** {status}

## Summary

### Files Consolidated
- **Before:** Multiple .env files
- **After:** 3 core files + templates

### Core Configuration Files (Active)
"""
        for filename in self.config.core_env_files:
            filepath = self.config.project_root / filename
            if filepath.exists():
                lines = len(filepath.read_text().splitlines())
                report += f"- `{filename}` - {lines} lines\n"

        report += "\n### Template Files (Reference)\n"
        for filename in self.config.template_files:
            filepath = self.config.project_root / filename
            if filepath.exists():
                lines = len(filepath.read_text().splitlines())
                report += f"- `{filename}` - {lines} lines\n"

        report += "\n### Archived Files\n"
        for filename in self.config.deprecated_env_files:
            filepath = self.config.backup_dir / filename
            if filepath.exists():
                report += f"- `{filename}` → `{filepath}`\n"

        report += f"""
## Rollback Instructions

To rollback this migration:

```bash
# Restore all files from backup
cp {self.config.backup_dir}/.env* {self.config.project_root}/

# Verify restoration
git status
```

## Next Steps

1. Review consolidated configuration files
2. Update environment-specific values in `.env.local`
3. Test application startup
4. Run health checks: `npm run test:health`
5. Validate all integrations (DB, Redis, AI providers)
6. Commit changes if everything works

## Testing Checklist

- [ ] Application starts successfully
- [ ] Database connection works
- [ ] Redis/Valkey connection works
- [ ] AI provider authentication works
- [ ] Datadog monitoring active (if enabled)
- [ ] Health checks pass
- [ ] Integration tests pass

## Support

If you encounter issues, restore from backup and check:
- `{self.config.backup_dir}/MANIFEST.txt` for original file locations
- This report for rollback instructions
- GitHub issue #447 for migration discussion
"""

        if not self.config.dry_run:
            self.config.backup_dir.mkdir(parents=True, exist_ok=True)
            report_file.write_text(report)

        log_success(f"Migration report generated: {report_file}")

        if not self.config.dry_run:
            print()
            log_info("Review the migration report:")
            print(report)

    def run(self) -> int:
        """Run the migration.

        Returns:
            Exit code (0 for success).
        """
        print_header("VibeCode Configuration Migration Tool")

        if self.config.dry_run:
            log_warning("DRY RUN MODE - No changes will be made")

        # Execute migration steps
        if not self.check_prerequisites():
            return 1

        if not self.validate_env_example():
            return 1

        if not self.create_backup():
            return 1

        self.analyze_current_config()
        self.consolidate_configs()
        self.update_gitignore()
        self.generate_migration_report()

        # Final summary
        print_header(f"Migration {'Preview ' if self.config.dry_run else ''}Complete")

        if self.config.dry_run:
            log_success("Dry run completed successfully. No changes were made.")
            log_info("Run without --dry-run to perform actual migration")
        else:
            log_success("Configuration migration completed successfully!")
            log_info(f"Backup location: {self.config.backup_dir}")
            log_info("Next steps:")
            print(f"  1. Review migration report: {self.config.backup_dir}/MIGRATION_REPORT.md")
            print("  2. Test application: npm run dev")
            print("  3. Run health checks: npm run test:health")
            print("  4. Commit changes if everything works")

        return 0


def parse_args() -> argparse.Namespace:
    """Parse command line arguments.

    Returns:
        Parsed arguments.
    """
    parser = argparse.ArgumentParser(
        description="Migrate VibeCode configuration from multiple .env files to consolidated structure.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
    # Preview migration without making changes
    %(prog)s --dry-run

    # Perform actual migration
    %(prog)s

    # Verbose migration
    %(prog)s --verbose

Migration Process:
    1. Check prerequisites
    2. Validate .env.example
    3. Create backup of all .env files
    4. Analyze current configuration
    5. Archive deprecated files
    6. Update .gitignore
    7. Generate migration report

Rollback:
    All original files are backed up. To restore:
    cp <backup_dir>/.env* <project_root>/
""",
    )
    parser.add_argument(
        "-d", "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Show detailed output",
    )

    return parser.parse_args()


def main() -> int:
    """Main entry point.

    Returns:
        Exit code.
    """
    args = parse_args()

    # Determine paths
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = project_root / f".env-backup-{timestamp}"

    config = MigrationConfig(
        project_root=project_root,
        backup_dir=backup_dir,
        dry_run=args.dry_run,
        verbose=args.verbose,
    )

    migrator = EnvConfigMigrator(config)
    return migrator.run()


if __name__ == "__main__":
    sys.exit(main())
