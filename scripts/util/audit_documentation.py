#!/usr/bin/env python3
"""Documentation audit script.

Analyzes all markdown files in the repository for consolidation.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import os
import subprocess
import sys
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""

    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        """Disable colors for non-TTY output."""
        cls.RED = cls.GREEN = cls.YELLOW = cls.BLUE = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


def log(message: str, prefix: str = "") -> None:
    """Print log message."""
    print(f"{prefix}{message}")


def run_cmd(
    cmd: list[str],
    capture: bool = True,
    check: bool = False,
    cwd: str | Path | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(cmd, capture_output=capture, text=True, check=check, cwd=cwd)


def find_markdown_files(root: Path) -> list[Path]:
    """Find all markdown files, excluding node_modules and .git."""
    files = []
    for ext in ("*.md", "*.mdx"):
        for f in root.rglob(ext):
            if "node_modules" not in f.parts and ".git" not in f.parts:
                files.append(f)
    return sorted(files)


def get_file_size(path: Path) -> int:
    """Get file size in bytes."""
    try:
        return path.stat().st_size
    except OSError:
        return 0


def get_line_count(path: Path) -> int:
    """Get number of lines in file."""
    try:
        return len(path.read_text(errors="replace").splitlines())
    except OSError:
        return 0


def extract_title(path: Path) -> str | None:
    """Extract first H1 title from markdown file."""
    try:
        for line in path.read_text(errors="replace").splitlines():
            if line.startswith("# "):
                return line[2:].strip()
    except OSError:
        pass
    return None


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("audit-results"),
        help="Output directory for audit results (default: audit-results)",
    )

    args = parser.parse_args(argv)
    repo_root = Path.cwd()
    output_dir: Path = args.output_dir

    print("Starting comprehensive documentation audit...")

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    # Find all markdown files
    print("Scanning for markdown files...")
    md_files = find_markdown_files(repo_root)
    total_files = len(md_files)
    print(f"Found {total_files} markdown files")

    # Save file list
    (output_dir / "all-markdown-files.txt").write_text(
        "\n".join(str(f.relative_to(repo_root)) for f in md_files) + "\n"
    )

    # Categorize by directory
    print("Categorizing by directory...")
    dir_counts: dict[str, int] = {}
    for f in md_files:
        parent = str(f.parent.relative_to(repo_root))
        dir_counts[parent] = dir_counts.get(parent, 0) + 1

    sorted_dirs = sorted(dir_counts.items(), key=lambda x: x[1], reverse=True)
    (output_dir / "files-by-directory.txt").write_text(
        "\n".join(f"{count:6} {d}" for d, count in sorted_dirs) + "\n"
    )

    print("Top directories with markdown files:")
    for d, count in sorted_dirs[:20]:
        print(f"  {count:4} {d}")

    # Root-level files
    print("\nRoot-level markdown files:")
    root_files = [f for f in md_files if f.parent == repo_root]
    root_info = "\n".join(f.name for f in root_files) if root_files else "No root-level .md files"
    print(f"  {root_info}")
    (output_dir / "root-level-files.txt").write_text(root_info + "\n")

    # Wiki analysis
    print("\nWiki directory analysis:")
    wiki_dir = repo_root / "wiki"
    content_wiki_dir = repo_root / "content" / "wiki"

    wiki_count = len(list(wiki_dir.rglob("*.md"))) if wiki_dir.exists() else 0
    content_wiki_count = sum(
        len(list(content_wiki_dir.rglob(f"*.{ext}")))
        for ext in ("md", "mdx")
    ) if content_wiki_dir.exists() else 0

    wiki_analysis = f"Files in /wiki/: {wiki_count}\nFiles in /content/wiki/: {content_wiki_count}\n"
    print(f"  {wiki_analysis}")
    (output_dir / "wiki-analysis.txt").write_text(wiki_analysis)

    # Find potential duplicates by title
    print("Analyzing potential duplicates...")
    titles: dict[str, int] = {}
    for f in md_files:
        title = extract_title(f)
        if title:
            titles[title] = titles.get(title, 0) + 1

    dup_titles = [(t, c) for t, c in titles.items() if c > 1]
    dup_titles.sort(key=lambda x: x[1], reverse=True)
    (output_dir / "potential-duplicates.txt").write_text(
        "Files with similar titles:\n" +
        "\n".join(f"{count:4} {title}" for title, count in dup_titles[:20]) + "\n"
    )

    # File sizes
    print("Analyzing file sizes...")
    file_sizes = [(get_file_size(f), f) for f in md_files]
    file_sizes.sort(key=lambda x: x[0], reverse=True)
    (output_dir / "files-by-size.txt").write_text(
        "\n".join(f"{size:8} {f.relative_to(repo_root)}" for size, f in file_sizes) + "\n"
    )

    print("Largest markdown files:")
    for size, f in file_sizes[:10]:
        print(f"  {size:8} {f.relative_to(repo_root)}")

    # Minimal files
    print("\nFinding minimal/empty files...")
    minimal_files = [(get_line_count(f), f) for f in md_files]
    minimal_files = [(lines, f) for lines, f in minimal_files if lines < 10]
    minimal_files.sort(key=lambda x: x[0])
    (output_dir / "minimal-files.txt").write_text(
        "\n".join(f"{lines:4} {f.relative_to(repo_root)}" for lines, f in minimal_files) + "\n"
    )

    print(f"Files with less than 10 lines ({len(minimal_files)} total):")
    for lines, f in minimal_files[:20]:
        print(f"  {lines:4} {f.relative_to(repo_root)}")

    # Content categories
    print("\nCategorizing by content type...")
    categories: dict[str, int] = {
        "Testing docs": 0,
        "API docs": 0,
        "Infrastructure docs": 0,
        "Architecture docs": 0,
    }

    patterns = {
        "Testing docs": ["test", "spec", "jest", "playwright"],
        "API docs": ["api", "endpoint", "route"],
        "Infrastructure docs": ["deploy", "k8s", "kubernetes", "docker", "helm"],
        "Architecture docs": ["architecture", "design", "diagram"],
    }

    for f in md_files:
        try:
            content = f.read_text(errors="replace").lower()
            for cat, keywords in patterns.items():
                if any(kw in content for kw in keywords):
                    categories[cat] += 1
        except OSError:
            pass

    cat_text = "=== Documentation Categories ===\n"
    for cat, count in categories.items():
        cat_text += f"{cat}: {count}\n"
        print(f"  {cat}: {count}")
    (output_dir / "content-categories.txt").write_text(cat_text)

    # Generate consolidation plan
    print("\nGenerating consolidation recommendations...")
    plan = f"""# Documentation Consolidation Plan

## Current State Analysis
- Total markdown files: {total_files}
- Root-level files: {len(root_files)}
- Wiki directory files: {wiki_count}
- Content/wiki files: {content_wiki_count}

## Recommended Actions

### Phase 1: Immediate Cleanup
1. **Root-level consolidation**: Move root .md files to docs/src/content/docs/
2. **Wiki merge**: Consolidate /wiki/ and /content/wiki/ directories
3. **Remove empty files**: Delete files with <10 lines of content
4. **Archive old files**: Move outdated documentation to archive/

### Phase 2: Content Organization
1. **Category-based structure**: Organize by testing, API, infrastructure, etc.
2. **Remove duplicates**: Merge similar content
3. **Update navigation**: Reflect new structure in Astro site
4. **Link validation**: Ensure all internal links work

### Phase 3: Maintenance
1. **Documentation standards**: Create contribution guidelines
2. **Automated checks**: Prevent future scatter
3. **Regular audits**: Monthly documentation health checks

## Priority Files for Review

### Large files (>10KB):
"""
    for size, f in file_sizes[:10]:
        kb = size // 1024
        plan += f"- {f.relative_to(repo_root)} ({kb}KB)\n"

    plan += "\n### Minimal files (<10 lines):\n"
    for lines, f in minimal_files[:10]:
        plan += f"- {f.relative_to(repo_root)} ({lines} lines)\n"

    (output_dir / "consolidation-plan.md").write_text(plan)

    # Summary
    print()
    print(f"{Colors.GREEN}Documentation audit complete!{Colors.NC}")
    print()
    print("Summary:")
    print(f"  Total files: {total_files}")
    print(f"  Root-level: {len(root_files)}")
    print(f"  Minimal files: {len(minimal_files)}")
    print()
    print(f"Results saved to {output_dir}/")
    print("  consolidation-plan.md - Detailed recommendations")
    print("  files-by-directory.txt - Directory breakdown")
    print("  potential-duplicates.txt - Duplicate analysis")
    print()
    print("Next steps:")
    print(f"  1. Review {output_dir}/consolidation-plan.md")
    print("  2. Execute consolidation in phases")
    print("  3. Update Astro documentation site structure")

    return 0


if __name__ == "__main__":
    sys.exit(main())
