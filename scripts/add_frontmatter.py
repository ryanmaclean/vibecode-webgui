"""Add YAML frontmatter to Markdown docs that are missing it."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DOCS_DIR = REPO_ROOT / "docs" / "src" / "content" / "docs"


@dataclass(frozen=True)
class Frontmatter:
    """Simple representation of the generated frontmatter block."""

    title: str
    description: str

    def render(self) -> str:
        lines = [
            "---",
            f"title: {self.title}",
            f"description: {self.description}",
            "---",
            "",
            "",
        ]
        return "\n".join(lines)


def infer_title(doc_path: Path) -> str:
    """Derive a readable title from a markdown filename."""

    name = doc_path.stem.replace("_", " ").replace("-", " ").strip()
    return name or doc_path.stem


def build_frontmatter(doc_path: Path) -> Frontmatter:
    title = infer_title(doc_path)
    description = f"{title} documentation"
    return Frontmatter(title=title, description=description)


def has_frontmatter(doc_path: Path) -> bool:
    try:
        first_line = doc_path.read_text(encoding="utf-8").splitlines()[0]
    except (IndexError, FileNotFoundError):
        return False
    return first_line.strip() == "---"


def add_frontmatter(doc_path: Path) -> bool:
    """Add a frontmatter block when missing; return True if changes were made."""

    if has_frontmatter(doc_path):
        return False

    contents = doc_path.read_text(encoding="utf-8")
    fm_text = build_frontmatter(doc_path).render()
    doc_path.write_text(fm_text + contents, encoding="utf-8")
    return True


def add_frontmatter_to_directory(doc_dir: Path) -> tuple[list[Path], list[Path]]:
    """Process every ``*.md`` file inside ``doc_dir``.

    Returns a tuple of (updated_files, skipped_files).
    """

    updated: list[Path] = []
    skipped: list[Path] = []
    for doc_path in sorted(doc_dir.glob("*.md")):
        if add_frontmatter(doc_path):
            updated.append(doc_path)
        else:
            skipped.append(doc_path)
    return updated, skipped


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "docs_dir",
        nargs="?",
        default=str(DEFAULT_DOCS_DIR),
        help="Directory containing markdown docs (default: %(default)s)",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    docs_dir = Path(args.docs_dir).expanduser()

    if not docs_dir.is_dir():
        raise SystemExit(f"Docs directory not found: {docs_dir}")

    print("🔧 Adding frontmatter to markdown files")
    updated, skipped = add_frontmatter_to_directory(docs_dir)

    for path in updated:
        print(f"✅ Added frontmatter to {path.name}")
    for path in skipped:
        print(f"✅ {path.name} already has frontmatter")

    total = len(updated) + len(skipped)
    print(f"🎯 Processed {total} markdown files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
