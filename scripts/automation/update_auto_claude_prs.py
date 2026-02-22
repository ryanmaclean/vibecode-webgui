#!/usr/bin/env python3
"""
Keep auto-claude PR branches updated with main.

Behavior:
- Calls `gh pr update-branch` for open auto-claude PRs.
- If update fails due to conflicts, attempts local merge.
- Auto-resolves metadata-only conflicts by taking main's side:
  - .auto-claude-status
  - .claude_settings.json
  - node_modules/.package-lock.json
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from typing import Iterable

ALLOWED_METADATA_CONFLICTS = {
    ".auto-claude-status",
    ".claude_settings.json",
    "node_modules/.package-lock.json",
}


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, check=check, text=True, capture_output=True)


def run_json(cmd: list[str]) -> object:
    cp = run(cmd)
    return json.loads(cp.stdout)


def log(msg: str) -> None:
    print(msg, flush=True)


@dataclass
class PR:
    number: int
    head: str
    is_draft: bool


def list_auto_claude_prs(repo: str) -> list[PR]:
    data = run_json(
        [
            "gh",
            "pr",
            "list",
            "--repo",
            repo,
            "--state",
            "open",
            "--limit",
            "100",
            "--json",
            "number,headRefName,isDraft",
        ]
    )
    prs: list[PR] = []
    for item in data:
        head = item.get("headRefName", "")
        if head.startswith("auto-claude/"):
            prs.append(PR(number=int(item["number"]), head=head, is_draft=bool(item.get("isDraft"))))
    return prs


def current_conflicts() -> list[str]:
    cp = run(["git", "diff", "--name-only", "--diff-filter=U"], check=False)
    return [x.strip() for x in cp.stdout.splitlines() if x.strip()]


def resolve_metadata_conflicts(conflicts: Iterable[str]) -> bool:
    conflict_set = set(conflicts)
    if not conflict_set or not conflict_set.issubset(ALLOWED_METADATA_CONFLICTS):
        return False

    for path in sorted(conflict_set):
        run(["git", "checkout", "--theirs", "--", path])
        # `-f` is required for ignored paths like node_modules/.package-lock.json
        run(["git", "add", "-f", "--", path])
    return True


def refresh_branch(branch: str) -> tuple[bool, str]:
    run(["git", "fetch", "origin", "--prune"])
    run(["git", "reset", "--hard"])
    run(["git", "checkout", "-B", "tmp-auto-claude-refresh", f"origin/{branch}"])

    merge = run(["git", "merge", "--no-edit", "origin/main"], check=False)
    if merge.returncode == 0:
        push = run(["git", "push", "origin", f"HEAD:{branch}"], check=False)
        if push.returncode == 0:
            return True, "updated via local merge"
        return False, f"push failed: {push.stderr.strip() or push.stdout.strip()}"

    conflicts = current_conflicts()
    if resolve_metadata_conflicts(conflicts):
        run(["git", "commit", "-m", f"Merge latest origin/main into {branch} (resolve metadata conflicts)"])
        push = run(["git", "push", "origin", f"HEAD:{branch}"], check=False)
        if push.returncode == 0:
            return True, "updated via metadata conflict resolution"
        return False, f"push failed: {push.stderr.strip() or push.stdout.strip()}"

    run(["git", "merge", "--abort"], check=False)
    return False, f"manual conflicts: {', '.join(conflicts) if conflicts else 'unknown'}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True, help="owner/repo (example: ryanmaclean/vibecode-webgui)")
    args = parser.parse_args()

    prs = list_auto_claude_prs(args.repo)
    if not prs:
        log("No open auto-claude PRs.")
        return 0

    failed: list[str] = []
    for pr in prs:
        if pr.is_draft:
            log(f"skip #{pr.number} ({pr.head}) draft")
            continue

        log(f"update #{pr.number} ({pr.head})")
        upd = run(["gh", "pr", "update-branch", str(pr.number), "--repo", args.repo], check=False)
        if upd.returncode == 0:
            log(f"ok #{pr.number}: updated via gh")
            continue

        err = (upd.stderr or upd.stdout).strip()
        if "Cannot update PR branch due to conflicts" not in err:
            failed.append(f"#{pr.number}: update-branch failed: {err}")
            continue

        ok, detail = refresh_branch(pr.head)
        if ok:
            log(f"ok #{pr.number}: {detail}")
        else:
            failed.append(f"#{pr.number}: {detail}")

    if failed:
        log("Failures:")
        for item in failed:
            log(f"- {item}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
