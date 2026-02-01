#!/usr/bin/env python3

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional

REPO = 'ryanmaclean/vibecode-webgui'
RIG = 'vibecode_webgui'

LABEL_TO_POLECAT = {
    'area:vm': f'{RIG}/tracer-core',
    'area:git': f'{RIG}/tracer-core',
    'area:tracing': f'{RIG}/tracer-mlx',
    'area:performance': f'{RIG}/tracer-mlx',
    'area:rag': f'{RIG}/tracer-rag',
    'area:security': f'{RIG}/tracer-config',
    'area:build': f'{RIG}/tracer-config',
    'area:ui': f'{RIG}/tracer-ui',
}


def run(cmd: List[str], cwd: Optional[str] = None, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=cwd, check=check, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def detect_town_root(explicit: Optional[str]) -> str:
    if explicit:
        return explicit

    repo_root = Path(__file__).resolve().parents[1]
    candidate = repo_root / 'vibecode_webgui'
    if candidate.exists() and candidate.is_dir():
        return str(candidate)

    return str(repo_root)


def gh_issue_list(label: str, limit: int) -> List[Dict]:
    proc = run(
        [
            'gh',
            'issue',
            'list',
            '--repo',
            REPO,
            '--state',
            'open',
            '--label',
            label,
            '--limit',
            str(limit),
            '--json',
            'number,title,url,labels',
        ]
    )
    return json.loads(proc.stdout)


def bd_find_by_external_ref(external_ref: str, town_root: str) -> Optional[str]:
    # bd list schema in this repo doesn't expose external_ref, so we search by title.
    proc = run(['bd', 'search', external_ref, '--limit', '5', '--json'], cwd=town_root, check=True)
    items = json.loads(proc.stdout)
    if not items:
        return None
    return items[0].get('id')


def bd_create_for_github_issue(issue: Dict, town_root: str) -> str:
    issue_num = issue['number']
    external_ref = f'gh-{issue_num}'
    title = f'[{external_ref}] {issue["title"]}'
    description = f'External: {issue.get("url")}'

    proc = run(
        [
            'bd',
            'create',
            title,
            '--silent',
            '--type',
            'task',
            '--description',
            description,
        ],
        cwd=town_root,
        check=True,
    )

    created_id = proc.stdout.strip()
    if created_id:
        return created_id

    found = bd_find_by_external_ref(external_ref, town_root)
    if not found:
        raise RuntimeError(f'Created issue but could not resolve bead id for {external_ref}')
    return found


def gt_sling(bead_id: str, target: str, message: str, dry_run: bool, town_root: str) -> None:
    cmd = ['gt', 'sling']
    if dry_run:
        cmd.append('--dry-run')
    cmd += [bead_id, target, '-m', message]
    proc = run(cmd, cwd=town_root, check=False)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip())


def main() -> int:
    parser = argparse.ArgumentParser(description='Dispatch labeled GitHub issues to polecats via bd + gt.')
    parser.add_argument('--label', action='append', default=[], help='GitHub label to dispatch (repeatable).')
    parser.add_argument('--limit', type=int, default=50)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--town-root', default=None, help='Path to Gas Town town-root (defaults to ./vibecode_webgui if present).')
    args = parser.parse_args()

    town_root = detect_town_root(args.town_root)

    labels = args.label or list(LABEL_TO_POLECAT.keys())

    dispatched = 0
    for label in labels:
        target = LABEL_TO_POLECAT.get(label)
        if not target:
            print(f'Skipping unknown label mapping: {label}', file=sys.stderr)
            continue

        issues = gh_issue_list(label, args.limit)
        for issue in issues:
            issue_num = issue['number']
            external_ref = f'gh-{issue_num}'

            bead_id = bd_find_by_external_ref(external_ref, town_root)
            if not bead_id and args.dry_run:
                print(f'• {external_ref} -> (would create bd issue) -> {target}')
                continue

            if not bead_id:
                bead_id = bd_create_for_github_issue(issue, town_root)

            msg = f'Dispatch {external_ref}: {issue["title"]}'
            if args.dry_run:
                print(f'• {external_ref} -> {bead_id} -> {target} (dry-run)')
                continue

            gt_sling(bead_id, target, msg, args.dry_run, town_root)
            dispatched += 1
            print(f'✓ {external_ref} -> {bead_id} -> {target}')

    if args.dry_run:
        print('Dry-run complete')
    else:
        print(f'Dispatched {dispatched} issues')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
