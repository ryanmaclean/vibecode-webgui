#!/usr/bin/env python3
"""Documentation Audit Script.

Analyzes all markdown files in the repository for consolidation opportunities.
Generates reports on file distribution, sizes, duplicates, and recommendations.
"""
from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from pathlib import Path


EXCLUDED_DIRS = {"node_modules", ".git", ".next", "dist", "build", "__pycache__"}

CONTENT_CATEGORIES = {
    "Testing": ["test", "spec", "jest", "playwright", "pytest"],
    "API": ["api", "endpoint", "route", "graphql", "rest"],
    "Infrastructure": ["deploy", "k8s", "kubernetes", "docker", "helm", "terraform"],
    "Architecture": ["architecture", "design", "diagram", "adr"],
}


def find_markdown_files(root: Path) -> list[Path]:
    """Find all markdown files, excluding common non-source directories.

    Args:
        root: Root directory to search

    Returns:
        Sorted list of markdown file paths
    """
    files = []
    for pattern in ["**/*.md", "**/*.mdx"]:
        for f in root.glob(pattern):
            # Skip excluded directories
            if any(excluded in f.parts for excluded in EXCLUDED_DIRS):
                continue
            if f.is_file():
                files.append(f)
    return sorted(files)


def categorize_by_directory(files: list[Path]) -> Counter:
    """Count files by parent directory.

    Args:
        files: List of file paths

    Returns:
        Counter of directory -> file count
    """
    return Counter(str(f.parent) for f in files)


def analyze_file_sizes(files: list[Path]) -> list[tuple[int, Path]]:
    """Get file sizes sorted by size descending.

    Args:
        files: List of file paths

    Returns:
        List of (size_bytes, path) tuples, sorted by size descending
    """
    sizes = []
    for f in files:
        try:
            size = f.stat().st_size
            sizes.append((size, f))
        except OSError:
            continue
    return sorted(sizes, reverse=True)


def find_minimal_files(files: list[Path], threshold: int = 10) -> list[tuple[int, Path]]:
    """Find files with fewer than threshold lines.

    Args:
        files: List of file paths
        threshold: Minimum line count

    Returns:
        List of (line_count, path) tuples for minimal files
    """
    minimal = []
    for f in files:
        try:
            lines = len(f.read_text(encoding="utf-8", errors="ignore").splitlines())
            if lines < threshold:
                minimal.append((lines, f))
        except OSError:
            continue
    return sorted(minimal)


def extract_titles(files: list[Path]) -> Counter:
    """Extract H1 titles from markdown files.

    Args:
        files: List of file paths

    Returns:
        Counter of title -> occurrence count
    """
    titles = []
    for f in files:
        try:
            content = f.read_text(encoding="utf-8", errors="ignore")
            for line in content.splitlines():
                if line.startswith("# "):
                    titles.append(line[2:].strip())
                    break
        except OSError:
            continue
    return Counter(titles)


def categorize_by_content(files: list[Path]) -> dict[str, int]:
    """Categorize files by content keywords.

    Args:
        files: List of file paths

    Returns:
        Dictionary of category -> file count
    """
    results = {cat: 0 for cat in CONTENT_CATEGORIES}

    for f in files:
        try:
            content = f.read_text(encoding="utf-8", errors="ignore").lower()
            for category, keywords in CONTENT_CATEGORIES.items():
                if any(kw in content for kw in keywords):
                    results[category] += 1
                    break
        except OSError:
            continue

    return results


def generate_consolidation_plan(
    total_files: int,
    root_files: int,
    wiki_files: int,
    content_wiki_files: int,
    large_files: list[tuple[int, Path]],
    minimal_files: list[tuple[int, Path]],
) -> str:
    """Generate markdown consolidation plan.

    Args:
        total_files: Total markdown file count
        root_files: Root-level file count
        wiki_files: Wiki directory file count
        content_wiki_files: Content/wiki file count
        large_files: List of large files
        minimal_files: List of minimal files

    Returns:
        Markdown content for consolidation plan
    """
    plan = f"""# Documentation Consolidation Plan

## Current State Analysis
- Total markdown files: {total_files}
- Root-level files: {root_files}
- Wiki directory files: {wiki_files}
- Content/wiki files: {content_wiki_files}

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
    for size, path in large_files[:10]:
        kb = size // 1024
        if kb >= 10:
            plan += f"- {path} ({kb}KB)\n"

    plan += "\n### Minimal files (<10 lines):\n"
    for lines, path in minimal_files[:10]:
        plan += f"- {path} ({lines} lines)\n"

    return plan


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "directory",
        type=Path,
        nargs="?",
        default=Path.cwd(),
        help="Repository root directory (default: current directory)",
    )
    parser.add_argument(
        "-o", "--output-dir",
        type=Path,
        default=Path("audit-results"),
        help="Output directory for results (default: audit-results)",
    )
    parser.add_argument(
        "-q", "--quiet",
        action="store_true",
        help="Minimal output",
    )

    args = parser.parse_args(argv)
    root = args.directory.resolve()
    output_dir = args.output_dir

    if not args.quiet:
        print("Starting comprehensive documentation audit...")

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    # Find all markdown files
    if not args.quiet:
        print("Scanning for markdown files...")
    files = find_markdown_files(root)
    total_files = len(files)

    # Save all files list
    (output_dir / "all-markdown-files.txt").write_text(
        "\n".join(str(f.relative_to(root)) for f in files) + "\n"
    )

    if not args.quiet:
        print(f"Found {total_files} markdown files")

    # Categorize by directory
    if not args.quiet:
        print("Categorizing by directory...")
    dir_counts = categorize_by_directory(files)
    dir_report = "\n".join(
        f"{count:6d} {dir_path}"
        for dir_path, count in dir_counts.most_common()
    )
    (output_dir / "files-by-directory.txt").write_text(dir_report + "\n")

    if not args.quiet:
        print("Top directories with markdown files:")
        for dir_path, count in dir_counts.most_common(10):
            print(f"  {count:4d} {dir_path}")

    # Analyze root-level files
    root_files = [f for f in files if f.parent == root]
    (output_dir / "root-level-files.txt").write_text(
        "\n".join(str(f.name) for f in root_files) + "\n"
    )

    # Analyze wiki directories
    wiki_files = [f for f in files if "wiki" in f.parts and "content" not in f.parts]
    content_wiki_files = [f for f in files if "content" in f.parts and "wiki" in f.parts]

    wiki_analysis = f"""Files in /wiki/: {len(wiki_files)}
Files in /content/wiki/: {len(content_wiki_files)}
"""
    (output_dir / "wiki-analysis.txt").write_text(wiki_analysis)

    if not args.quiet:
        print(f"Wiki directory: {len(wiki_files)} files")
        print(f"Content/wiki: {len(content_wiki_files)} files")

    # Find potential duplicates by title
    if not args.quiet:
        print("Analyzing potential duplicates...")
    titles = extract_titles(files)
    duplicates = [(title, count) for title, count in titles.most_common() if count > 1]
    dup_report = "Files with duplicate titles:\n" + "\n".join(
        f"{count:4d} {title}" for title, count in duplicates[:20]
    )
    (output_dir / "potential-duplicates.txt").write_text(dup_report + "\n")

    # Analyze file sizes
    if not args.quiet:
        print("Analyzing file sizes...")
    sizes = analyze_file_sizes(files)
    size_report = "\n".join(f"{size:10d} {path}" for size, path in sizes)
    (output_dir / "files-by-size.txt").write_text(size_report + "\n")

    if not args.quiet:
        print("Largest markdown files:")
        for size, path in sizes[:5]:
            print(f"  {size // 1024:4d}KB {path.relative_to(root)}")

    # Find minimal files
    if not args.quiet:
        print("Finding minimal/empty files...")
    minimal = find_minimal_files(files)
    minimal_report = "\n".join(f"{lines:4d} {path}" for lines, path in minimal)
    (output_dir / "minimal-files.txt").write_text(minimal_report + "\n")

    if not args.quiet:
        print(f"Files with <10 lines: {len(minimal)}")

    # Categorize by content
    if not args.quiet:
        print("Categorizing by content type...")
    categories = categorize_by_content(files)
    cat_report = "=== Documentation Categories ===\n" + "\n".join(
        f"{cat}: {count}" for cat, count in categories.items()
    )
    (output_dir / "content-categories.txt").write_text(cat_report + "\n")

    if not args.quiet:
        for cat, count in categories.items():
            print(f"  {cat}: {count}")

    # Generate consolidation plan
    if not args.quiet:
        print("Generating consolidation recommendations...")
    plan = generate_consolidation_plan(
        total_files=total_files,
        root_files=len(root_files),
        wiki_files=len(wiki_files),
        content_wiki_files=len(content_wiki_files),
        large_files=sizes,
        minimal_files=minimal,
    )
    (output_dir / "consolidation-plan.md").write_text(plan)

    # Summary
    print()
    print("Documentation audit complete!")
    print()
    print("Summary:")
    print(f"  Total files: {total_files}")
    print(f"  Root-level: {len(root_files)}")
    print(f"  Minimal files: {len(minimal)}")
    print()
    print(f"Results saved to {output_dir}/")
    print("  consolidation-plan.md - Detailed recommendations")
    print("  files-by-directory.txt - Directory breakdown")
    print("  potential-duplicates.txt - Duplicate analysis")
    print()
    print("Next steps:")
    print("  1. Review audit-results/consolidation-plan.md")
    print("  2. Execute consolidation in phases")
    print("  3. Update documentation site structure")

    return 0


if __name__ == "__main__":
    sys.exit(main())
