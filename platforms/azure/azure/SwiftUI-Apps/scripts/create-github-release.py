#!/usr/bin/env python3
"""
Create GitHub Release with Build Artifacts

This script creates a GitHub release and uploads build artifacts:
- BasicVibeCode.app (zipped)
- LiquidGlassVibeCode.app (zipped)
- bun-openvscode.cpio.gz initramfs

Usage:
    python scripts/create-github-release.py <version> [--draft] [--prerelease]

Example:
    python scripts/create-github-release.py v1.2.0
    python scripts/create-github-release.py v1.2.0-beta --prerelease
"""

import sys
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import Optional, List, Tuple
import json
import os
import argparse
from datetime import datetime

# Try to import ddtrace for observability
try:
    import ddtrace
    from ddtrace import tracer
    DDTRACE_AVAILABLE = True
except ImportError:
    DDTRACE_AVAILABLE = False
    print("⚠️  ddtrace not available, running without tracing", file=sys.stderr)


class Colors:
    """ANSI color codes for terminal output"""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    CYAN = '\033[0;36m'
    NC = '\033[0m'  # No Color


def log(msg: str, color=Colors.GREEN):
    """Log a message with color"""
    print(f"{color}[RELEASE]{Colors.NC} {msg}")


def error(msg: str):
    """Log an error and exit"""
    print(f"{Colors.RED}[ERROR]{Colors.NC} {msg}", file=sys.stderr)
    sys.exit(1)


def warn(msg: str):
    """Log a warning"""
    print(f"{Colors.YELLOW}[WARN]{Colors.NC} {msg}", file=sys.stderr)


def run(cmd: str, check=True, capture=True) -> subprocess.CompletedProcess:
    """Run a shell command"""
    log(f"Running: {cmd}", Colors.CYAN)
    result = subprocess.run(
        cmd,
        shell=True,
        capture_output=capture,
        text=True
    )
    if check and result.returncode != 0:
        error(f"Command failed: {cmd}\n{result.stderr}")
    return result


class GitHubReleaseCreator:
    """Creates GitHub releases with build artifacts"""

    def __init__(self, version: str, draft: bool = False, prerelease: bool = False):
        self.version = version
        self.draft = draft
        self.prerelease = prerelease
        self.repo_root = Path(__file__).parent.parent
        self.artifacts: List[Tuple[Path, str]] = []
        self.temp_dir = Path(tempfile.mkdtemp(prefix=f"release-{version}-"))

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Cleanup temp directory"""
        if self.temp_dir.exists():
            log(f"Cleaning up: {self.temp_dir}")
            shutil.rmtree(self.temp_dir)

    def create_release(self) -> bool:
        """
        Create GitHub release with artifacts

        Returns:
            True if successful, False otherwise
        """
        if DDTRACE_AVAILABLE:
            with tracer.trace("github_release.create", service="vibecode-release") as span:
                span.set_tag("version", self.version)
                span.set_tag("draft", self.draft)
                span.set_tag("prerelease", self.prerelease)
                return self._create_release_internal(span)
        else:
            return self._create_release_internal()

    def _create_release_internal(self, span=None) -> bool:
        """Internal release creation logic"""

        # Step 1: Verify prerequisites
        if span:
            span.set_tag("step", "verify_prerequisites")
        if not self._verify_prerequisites():
            return False

        # Step 2: Prepare artifacts
        if span:
            span.set_tag("step", "prepare_artifacts")
        if not self._prepare_artifacts():
            return False

        # Step 3: Generate release notes
        if span:
            span.set_tag("step", "generate_release_notes")
        release_notes = self._generate_release_notes()

        # Step 4: Create git tag
        if span:
            span.set_tag("step", "create_tag")
        if not self._create_tag():
            return False

        # Step 5: Create GitHub release
        if span:
            span.set_tag("step", "create_github_release")
        if not self._create_github_release(release_notes):
            return False

        # Step 6: Upload artifacts
        if span:
            span.set_tag("step", "upload_artifacts")
            span.set_tag("artifact_count", len(self.artifacts))
        if not self._upload_artifacts():
            return False

        log(f"✅ Release {self.version} created successfully!", Colors.GREEN)
        return True

    def _verify_prerequisites(self) -> bool:
        """Verify gh CLI is installed and authenticated"""
        log("Verifying prerequisites...")

        # Check gh CLI
        result = run("gh --version", check=False)
        if result.returncode != 0:
            error("GitHub CLI (gh) not installed. Install with: brew install gh")
            return False

        # Check authentication
        result = run("gh auth status", check=False)
        if result.returncode != 0:
            error("Not authenticated with GitHub. Run: gh auth login")
            return False

        # Check git repo
        result = run("git rev-parse --git-dir", check=False)
        if result.returncode != 0:
            error("Not in a git repository")
            return False

        log("✅ Prerequisites verified")
        return True

    def _prepare_artifacts(self) -> bool:
        """Prepare artifacts for upload"""
        log("Preparing artifacts...")

        # BasicVibeCode.app
        basic_app = self.repo_root / "BasicVibeCode.app"
        if basic_app.exists():
            log(f"Zipping BasicVibeCode.app...")
            zip_path = self.temp_dir / f"BasicVibeCode-{self.version}.app.zip"
            result = run(f"cd '{self.repo_root}' && zip -r '{zip_path}' BasicVibeCode.app", check=False)
            if result.returncode == 0:
                size = zip_path.stat().st_size / (1024 * 1024)
                log(f"  ✓ BasicVibeCode-{self.version}.app.zip ({size:.1f} MB)")
                self.artifacts.append((zip_path, f"BasicVibeCode-{self.version}.app.zip"))
            else:
                warn("Failed to zip BasicVibeCode.app")
        else:
            warn("BasicVibeCode.app not found")

        # LiquidGlassVibeCode.app
        liquid_app = self.repo_root / "LiquidGlassVibeCode.app"
        if liquid_app.exists():
            log(f"Zipping LiquidGlassVibeCode.app...")
            zip_path = self.temp_dir / f"LiquidGlassVibeCode-{self.version}.app.zip"
            result = run(f"cd '{self.repo_root}' && zip -r '{zip_path}' LiquidGlassVibeCode.app", check=False)
            if result.returncode == 0:
                size = zip_path.stat().st_size / (1024 * 1024)
                log(f"  ✓ LiquidGlassVibeCode-{self.version}.app.zip ({size:.1f} MB)")
                self.artifacts.append((zip_path, f"LiquidGlassVibeCode-{self.version}.app.zip"))
            else:
                warn("Failed to zip LiquidGlassVibeCode.app")
        else:
            warn("LiquidGlassVibeCode.app not found")

        # bun-openvscode.cpio.gz
        initramfs = self.repo_root.parent / "bun-openvscode.cpio.gz"
        if initramfs.exists():
            # Copy with versioned name
            versioned_initramfs = self.temp_dir / f"bun-openvscode-{self.version}.cpio.gz"
            shutil.copy2(initramfs, versioned_initramfs)
            size = versioned_initramfs.stat().st_size / (1024 * 1024)
            log(f"  ✓ bun-openvscode-{self.version}.cpio.gz ({size:.1f} MB)")
            self.artifacts.append((versioned_initramfs, f"bun-openvscode-{self.version}.cpio.gz"))
        else:
            warn("bun-openvscode.cpio.gz not found in parent directory")

        if not self.artifacts:
            error("No artifacts found to upload")
            return False

        total_size = sum(p.stat().st_size for p, _ in self.artifacts) / (1024 * 1024)
        log(f"✅ Prepared {len(self.artifacts)} artifacts ({total_size:.1f} MB total)")
        return True

    def _generate_release_notes(self) -> str:
        """Generate release notes from git history"""
        log("Generating release notes...")

        # Get commits since last tag
        result = run("git describe --tags --abbrev=0 2>/dev/null", check=False)
        last_tag = result.stdout.strip() if result.returncode == 0 else None

        if last_tag:
            log(f"Last tag: {last_tag}")
            result = run(f"git log {last_tag}..HEAD --oneline --no-merges")
        else:
            log("No previous tags found, using all commits")
            result = run("git log --oneline --no-merges -20")

        commits = result.stdout.strip().split('\n') if result.stdout else []

        # Categorize commits
        features = []
        fixes = []
        docs = []
        other = []

        for commit in commits:
            if not commit:
                continue
            if 'feat:' in commit.lower() or 'feature:' in commit.lower():
                features.append(commit)
            elif 'fix:' in commit.lower():
                fixes.append(commit)
            elif 'docs:' in commit.lower() or 'doc:' in commit.lower():
                docs.append(commit)
            else:
                other.append(commit)

        # Build release notes
        notes = [f"# Release {self.version}"]
        notes.append("")
        notes.append(f"**Release Date:** {datetime.now().strftime('%Y-%m-%d')}")
        notes.append("")

        # Artifacts section
        notes.append("## 📦 Artifacts")
        notes.append("")
        for _, filename in self.artifacts:
            notes.append(f"- `{filename}`")
        notes.append("")

        # Changes section
        if features:
            notes.append("## ✨ Features")
            notes.append("")
            for commit in features:
                notes.append(f"- {commit}")
            notes.append("")

        if fixes:
            notes.append("## 🐛 Bug Fixes")
            notes.append("")
            for commit in fixes:
                notes.append(f"- {commit}")
            notes.append("")

        if docs:
            notes.append("## 📝 Documentation")
            notes.append("")
            for commit in docs:
                notes.append(f"- {commit}")
            notes.append("")

        if other:
            notes.append("## 🔧 Other Changes")
            notes.append("")
            for commit in other[:10]:  # Limit to 10
                notes.append(f"- {commit}")
            notes.append("")

        # Installation instructions
        notes.append("## 📥 Installation")
        notes.append("")
        notes.append("### macOS (Apple Silicon)")
        notes.append("")
        notes.append("1. Download `BasicVibeCode-{version}.app.zip` or `LiquidGlassVibeCode-{version}.app.zip`".format(version=self.version))
        notes.append("2. Unzip the downloaded file")
        notes.append("3. Move the `.app` to `/Applications`")
        notes.append("4. Right-click and select 'Open' (first time only)")
        notes.append("")
        notes.append("### Custom Initramfs")
        notes.append("")
        notes.append(f"Download `bun-openvscode-{self.version}.cpio.gz` and place in app bundle:")
        notes.append("```bash")
        notes.append(f"cp bun-openvscode-{self.version}.cpio.gz BasicVibeCode.app/Contents/Resources/bun-openvscode.cpio.gz")
        notes.append("```")
        notes.append("")

        # License info
        notes.append("## 📄 License")
        notes.append("")
        notes.append("- Swift host application: MIT License (permissive)")
        notes.append("- VM guest components: Various open source licenses (see THIRD_PARTY_NOTICES.md)")
        notes.append("")

        return '\n'.join(notes)

    def _create_tag(self) -> bool:
        """Create git tag if it doesn't exist"""
        log(f"Creating git tag {self.version}...")

        # Check if tag exists
        result = run(f"git tag -l {self.version}", check=False)
        if result.stdout.strip():
            warn(f"Tag {self.version} already exists, skipping tag creation")
            return True

        # Create annotated tag
        result = run(f"git tag -a {self.version} -m 'Release {self.version}'", check=False)
        if result.returncode != 0:
            error(f"Failed to create tag: {result.stderr}")
            return False

        # Push tag
        result = run(f"git push origin {self.version}", check=False)
        if result.returncode != 0:
            error(f"Failed to push tag: {result.stderr}")
            return False

        log(f"✅ Tag {self.version} created and pushed")
        return True

    def _create_github_release(self, release_notes: str) -> bool:
        """Create GitHub release"""
        log(f"Creating GitHub release {self.version}...")

        # Write release notes to temp file
        notes_file = self.temp_dir / "RELEASE_NOTES.md"
        notes_file.write_text(release_notes)

        # Build gh release create command
        cmd_parts = [
            "gh release create",
            self.version,
            f"--title 'VibeCode SwiftUI Apps {self.version}'",
            f"--notes-file '{notes_file}'"
        ]

        if self.draft:
            cmd_parts.append("--draft")

        if self.prerelease:
            cmd_parts.append("--prerelease")

        cmd = ' '.join(cmd_parts)
        result = run(cmd, check=False)

        if result.returncode != 0:
            error(f"Failed to create GitHub release: {result.stderr}")
            return False

        log(f"✅ GitHub release {self.version} created")
        return True

    def _upload_artifacts(self) -> bool:
        """Upload artifacts to GitHub release"""
        log(f"Uploading {len(self.artifacts)} artifacts...")

        for artifact_path, artifact_name in self.artifacts:
            log(f"  Uploading {artifact_name}...")
            result = run(
                f"gh release upload {self.version} '{artifact_path}' --clobber",
                check=False
            )
            if result.returncode != 0:
                error(f"Failed to upload {artifact_name}: {result.stderr}")
                return False
            log(f"  ✓ {artifact_name}")

        log(f"✅ All artifacts uploaded")
        return True


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Create GitHub release with build artifacts",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/create-github-release.py v1.2.0
  python scripts/create-github-release.py v1.2.0-beta --prerelease
  python scripts/create-github-release.py v1.2.0-rc1 --draft
        """
    )
    parser.add_argument(
        "version",
        help="Release version (e.g., v1.2.0, v1.2.0-beta)"
    )
    parser.add_argument(
        "--draft",
        action="store_true",
        help="Create as draft release"
    )
    parser.add_argument(
        "--prerelease",
        action="store_true",
        help="Mark as pre-release"
    )

    args = parser.parse_args()

    # Validate version format
    if not args.version.startswith('v'):
        error("Version must start with 'v' (e.g., v1.2.0)")

    log(f"Creating release {args.version}")
    if args.draft:
        log("  Mode: Draft")
    if args.prerelease:
        log("  Mode: Pre-release")

    with GitHubReleaseCreator(args.version, args.draft, args.prerelease) as creator:
        success = creator.create_release()
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
