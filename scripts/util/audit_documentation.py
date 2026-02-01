#!/usr/bin/env python3
"""Documentation Audit Script.

Analyzes all markdown files in the repository for consolidation.
"""

from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class AuditResults:
    """Container for audit result paths."""

    output_dir: Path
    all_files: Path
    by_directory: Path
    root_level: Path
    wiki_analysis: Path
    potential_duplicates: Path
    by_size: Path
    minimal_files: Path
    content_categories: Path
    consolidation_plan: Path


def get_project_root() -> Path:
    """Get project root directory."""
    return Path(__file__).resolve().parent.parent.parent


def create_audit_directories(project_root: Path) -> AuditResults:
    """Create audit output directory structure."""
    output_dir = project_root / "audit-results"
    output_dir.mkdir(exist_ok=True)

    return AuditResults(
        output_dir=output_dir,
        all_files=output_dir / "all-markdown-files.txt",
        by_directory=output_dir / "files-by-directory.txt",
        root_level=output_dir / "root-level-files.txt",
        wiki_analysis=output_dir / "wiki-analysis.txt",
        potential_duplicates=output_dir / "potential-duplicates.txt",
        by_size=output_dir / "files-by-size.txt",
        minimal_files=output_dir / "minimal-files.txt",
        content_categories=output_dir / "content-categories.txt",
        consolidation_plan=output_dir / "consolidation-plan.md",
    )


def find_markdown_files(project_root: Path) -> list[Path]:
    """Find all markdown files, excluding node_modules and .git."""
    files: list[Path] = []
    for pattern in ["**/*.md", "**/*.mdx"]:
        for f in project_root.glob(pattern):
            if "node_modules" not in str(f) and ".git" not in str(f):
                files.append(f)
    return sorted(files)


def categorize_by_directory(files: list[Path]) -> dict[str, int]:
    """Categorize files by parent directory."""
    counts: dict[str, int] = {}
    for f in files:
        parent = str(f.parent)
        counts[parent] = counts.get(parent, 0) + 1
    return dict(sorted(counts.items(), key=lambda x: -x[1]))


def analyze_file_sizes(files: list[Path]) -> list[tuple[int, Path]]:
    """Analyze file sizes, sorted largest first."""
    sizes: list[tuple[int, Path]] = []
    for f in files:
        try:
            sizes.append((f.stat().st_size, f))
        except OSError:
            sizes.append((0, f))
    return sorted(sizes, key=lambda x: -x[0])


def find_minimal_files(files: list[Path], max_lines: int = 10) -> list[tuple[int, Path]]:
    """Find files with fewer than max_lines."""
    minimal: list[tuple[int, Path]] = []
    for f in files:
        try:
            lines = len(f.read_text().splitlines())
            if lines < max_lines:
                minimal.append((lines, f))
        except OSError:
            pass
    return sorted(minimal, key=lambda x: x[0])


def count_files_matching(files: list[Path], keywords: list[str]) -> int:
    """Count files containing any of the keywords."""
    count = 0
    for f in files:
        try:
            content = f.read_text().lower()
            if any(kw.lower() in content for kw in keywords):
                count += 1
        except OSError:
            pass
    return count


def generate_consolidation_plan(
    results: AuditResults,
    total_files: int,
    root_count: int,
    wiki_count: int,
    content_wiki_count: int,
    sizes: list[tuple[int, Path]],
    minimal: list[tuple[int, Path]],
) -> None:
    """Generate the consolidation plan markdown file."""
    content = f"""# Documentation Consolidation Plan

## Current State Analysis
- Total markdown files: {total_files}
- Root-level files: {root_count}
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
    for size, path in sizes[:10]:
        kb = size // 1024
        content += f"- {path} ({kb}KB)\n"

    content += "\n### Minimal files (<10 lines):\n"
    for lines, path in minimal[:10]:
        content += f"- {path} ({lines} lines)\n"

    results.consolidation_plan.write_text(content)


def main() -> int:
    """Main entry point."""
    print("\U0001f4cb Starting comprehensive documentation audit...")

    project_root = get_project_root()
    results = create_audit_directories(project_root)

    # Find all markdown files
    print("\U0001f50d Scanning for markdown files...")
    files = find_markdown_files(project_root)
    total_files = len(files)
    print(f"\U0001f4ca Found {total_files} markdown files")

    # Save all files list
    results.all_files.write_text("\n".join(str(f) for f in files))

    # Categorize by directory
    print("\U0001f4c1 Categorizing by directory...")
    by_dir = categorize_by_directory(files)
    results.by_directory.write_text(
        "\n".join(f"{count:6d} {path}" for path, count in by_dir.items())
    )
    print("\U0001f4c8 Top directories with markdown files:")
    for path, count in list(by_dir.items())[:20]:
        print(f"  {count:4d} {path}")

    # Root-level files
    print("\U0001f50d Root-level markdown files:")
    root_files = list(project_root.glob("*.md"))
    root_count = len(root_files)
    results.root_level.write_text("\n".join(str(f) for f in root_files))
    for f in root_files:
        print(f"  {f.name}")

    # Wiki analysis
    wiki_dir = project_root / "wiki"
    content_wiki_dir = project_root / "content" / "wiki"
    wiki_count = len(list(wiki_dir.glob("**/*.md"))) if wiki_dir.exists() else 0
    content_wiki_count = len(list(content_wiki_dir.glob("**/*.md")) + list(content_wiki_dir.glob("**/*.mdx"))) if content_wiki_dir.exists() else 0

    results.wiki_analysis.write_text(
        f"Files in /wiki/:\nCount: {wiki_count}\n\n"
        f"Files in /content/wiki/:\nCount: {content_wiki_count}\n"
    )
    print(f"\U0001f4da Wiki directory analysis:")
    print(f"  /wiki/: {wiki_count} files")
    print(f"  /content/wiki/: {content_wiki_count} files")

    # File sizes
    print("\U0001f4cf Analyzing file sizes...")
    sizes = analyze_file_sizes(files)
    results.by_size.write_text("\n".join(f"{size:10d} {path}" for size, path in sizes))
    print("\U0001f4ca Largest markdown files:")
    for size, path in sizes[:10]:
        print(f"  {size:8d} {path}")

    # Minimal files
    print("\U0001f5d1\ufe0f  Finding minimal/empty files...")
    minimal = find_minimal_files(files)
    results.minimal_files.write_text("\n".join(f"{lines:4d} {path}" for lines, path in minimal))
    print(f"\U0001f4cb Files with less than 10 lines ({len(minimal)} total):")
    for lines, path in minimal[:20]:
        print(f"  {lines:4d} {path}")

    # Content categories
    print("\U0001f3f7\ufe0f  Categorizing by content type...")
    categories = {
        "Testing docs": count_files_matching(files, ["test", "spec", "jest", "playwright"]),
        "API docs": count_files_matching(files, ["api", "endpoint", "route"]),
        "Infrastructure docs": count_files_matching(files, ["deploy", "k8s", "kubernetes", "docker", "helm"]),
        "Architecture docs": count_files_matching(files, ["architecture", "design", "diagram"]),
    }
    results.content_categories.write_text(
        "=== Documentation Categories ===\n" +
        "\n".join(f"{name}: {count}" for name, count in categories.items())
    )
    for name, count in categories.items():
        print(f"  {name}: {count}")

    # Generate consolidation plan
    print("\U0001f4a1 Generating consolidation recommendations...")
    generate_consolidation_plan(
        results, total_files, root_count, wiki_count, content_wiki_count, sizes, minimal
    )

    # Summary
    print()
    print("\u2705 Documentation audit complete!")
    print()
    print("\U0001f4ca Summary:")
    print(f"  Total files: {total_files}")
    print(f"  Root-level: {root_count}")
    print(f"  Minimal files: {len(minimal)}")
    print()
    print(f"\U0001f4c1 Results saved to {results.output_dir}/")
    print("  \U0001f4cb consolidation-plan.md - Detailed recommendations")
    print("  \U0001f4ca files-by-directory.txt - Directory breakdown")
    print("  \U0001f50d potential-duplicates.txt - Duplicate analysis")
    print()
    print("\U0001f680 Next steps:")
    print("  1. Review audit-results/consolidation-plan.md")
    print("  2. Execute consolidation in phases")
    print("  3. Update Astro documentation site structure")

    return 0


if __name__ == "__main__":
    sys.exit(main())
