#!/usr/bin/env python3
"""
Comprehensive issue triage script for vibecode-webgui repository.
Automatically categorizes and labels all open issues.
"""

import json
import subprocess
import sys
import time
from typing import Dict, List, Set

# Repository information
REPO_OWNER = "ryanmaclean"
REPO_NAME = "vibecode-webgui"

# Label definitions
AREA_LABELS = {
    'vm': ['vm', 'virtual machine', 'virtualization', 'vfkit', 'lima', 'apple virtualization', 'hypervisor'],
    'ui': ['ui', 'interface', 'frontend', 'theme', 'dark mode', 'monaco', 'editor', 'visual'],
    'tracing': ['tracing', 'telemetry', 'datadog', 'opentelemetry', 'otlp', 'observability', 'monitoring'],
    'performance': ['performance', 'optimization', 'speed', 'fast', 'boot time', 'benchmark'],
    'security': ['security', 'sandbox', 'csp', 'keychain', 'credential', 'encryption', 'secrets'],
    'build': ['build', 'compilation', 'webpack', 'bundler', 'docker', 'dockerfile'],
    'git': ['git', 'version control', 'repository'],
    'rag': ['rag', 'retrieval', 'embedding', 'vector', 'pgvector', 'ai', 'llm'],
    'docs': ['documentation', 'docs', 'readme', 'guide'],
    'audit': ['audit', 'review'],
}

PRIORITY_KEYWORDS = {
    'high': ['critical', 'urgent', 'blocker', 'fast-boot', 'high-priority'],
    'medium': ['important', 'should have'],
    'low': ['nice to have', 'feature audit', 'enhancement'],
}


def run_command(cmd: List[str]) -> str:
    """Run a command and return its output."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error running command {' '.join(cmd)}: {e}", file=sys.stderr)
        print(f"stderr: {e.stderr}", file=sys.stderr)
        raise


def fetch_all_issues() -> List[Dict]:
    """Fetch all open issues from the repository."""
    print("Fetching all open issues...")
    
    # gh issue list doesn't support pagination, so we use a high limit
    # GitHub API has a max of 1000, but gh CLI might have lower limits
    output = run_command([
        'gh', 'issue', 'list',
        '--repo', f'{REPO_OWNER}/{REPO_NAME}',
        '--state', 'open',
        '--limit', '1000',
        '--json', 'number,title,body,labels'
    ])
    
    if not output:
        return []
    
    issues = json.loads(output)
    print(f"Total issues fetched: {len(issues)}")
    return issues


def analyze_issue(issue: Dict) -> Dict[str, Set[str]]:
    """Analyze an issue and determine appropriate labels."""
    title = issue['title'].lower()
    body = (issue.get('body') or '').lower()
    text = f"{title} {body}"
    
    labels_to_add = {
        'area': set(),
        'priority': set(),
        'other': set()
    }
    
    # Detect area labels
    for area, keywords in AREA_LABELS.items():
        if any(keyword in text for keyword in keywords):
            labels_to_add['area'].add(f'area:{area}')
    
    # Detect priority
    if any(keyword in text for keyword in PRIORITY_KEYWORDS['high']):
        labels_to_add['priority'].add('priority:high')
    elif any(keyword in text for keyword in PRIORITY_KEYWORDS['low']):
        labels_to_add['priority'].add('priority:low')
    else:
        # Default priority for feature audits
        if 'feature audit' in text:
            labels_to_add['priority'].add('priority:low')
        else:
            labels_to_add['priority'].add('priority: p2')
    
    # Ensure feature-audit label for feature audits
    if 'feature audit' in text:
        labels_to_add['other'].add('feature-audit')
    
    return labels_to_add


def get_existing_labels(issue: Dict) -> Set[str]:
    """Get existing label names from an issue."""
    return {label['name'] for label in issue.get('labels', [])}


def apply_labels(issue_number: int, labels: List[str], dry_run: bool = False) -> None:
    """Apply labels to an issue."""
    if not labels:
        return
    
    label_str = ', '.join(labels)
    if dry_run:
        print(f"  [DRY RUN] Would add labels to #{issue_number}: {label_str}")
        return
    
    print(f"  Adding labels to #{issue_number}: {label_str}")
    
    cmd = [
        'gh', 'issue', 'edit', str(issue_number),
        '--repo', f'{REPO_OWNER}/{REPO_NAME}'
    ]
    
    for label in labels:
        cmd.extend(['--add-label', label])
    
    try:
        run_command(cmd)
        time.sleep(0.5)  # Rate limiting
    except Exception as e:
        print(f"  Failed to add labels to #{issue_number}: {e}", file=sys.stderr)


def triage_issue(issue: Dict, dry_run: bool = False) -> bool:
    """Triage a single issue. Returns True if labels were added."""
    issue_number = issue['number']
    title = issue['title']
    existing_labels = get_existing_labels(issue)
    
    # Skip if already triaged
    if 'triage:done' in existing_labels:
        return False
    
    print(f"\nTriaging #{issue_number}: {title[:60]}...")
    
    # Analyze and determine labels
    suggested_labels = analyze_issue(issue)
    
    # Combine all suggested labels
    all_suggested = set()
    for label_type, labels in suggested_labels.items():
        all_suggested.update(labels)
    
    # Filter out labels that already exist
    new_labels = all_suggested - existing_labels
    
    # Always add triage:done
    if 'triage:done' not in existing_labels:
        new_labels.add('triage:done')
    
    if new_labels:
        apply_labels(issue_number, list(new_labels), dry_run)
        return True
    else:
        print(f"  No new labels needed for #{issue_number}")
        return False


def ensure_labels_exist() -> None:
    """Ensure all required labels exist in the repository."""
    print("Ensuring labels exist...")
    
    labels_to_create = [
        ('triage:done', '0e8a16', 'Issue has been triaged'),
        ('area:vm', '0075ca', 'VM and virtualization'),
        ('area:ui', '0075ca', 'User interface'),
        ('area:tracing', '0075ca', 'Tracing and observability'),
        ('area:performance', '0075ca', 'Performance optimization'),
        ('area:security', 'd73a4a', 'Security'),
        ('area:build', '0075ca', 'Build system'),
        ('area:git', '0075ca', 'Git integration'),
        ('area:rag', '0075ca', 'RAG and AI features'),
        ('area:docs', '0075ca', 'Documentation'),
        ('area:audit', '0075ca', 'Audit'),
        ('priority:high', 'd93f0b', 'High priority'),
        ('priority:low', '0e8a16', 'Low priority'),
        ('priority: p2', 'fbca04', 'Medium priority'),
        ('feature-audit', 'c5def5', 'Feature audit'),
    ]
    
    for name, color, description in labels_to_create:
        try:
            subprocess.run(
                [
                    'gh', 'label', 'create', name,
                    '--repo', f'{REPO_OWNER}/{REPO_NAME}',
                    '--color', color,
                    '--description', description,
                    '--force'
                ],
                capture_output=True,
                check=False
            )
        except Exception as e:
            print(f"  Warning: Could not create label '{name}': {e}", file=sys.stderr)
    
    print("  Labels ensured")


def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Triage all open issues')
    parser.add_argument('--dry-run', action='store_true',
                       help='Show what would be done without making changes')
    parser.add_argument('--limit', type=int, default=None,
                       help='Limit number of issues to process')
    args = parser.parse_args()
    
    if args.dry_run:
        print("=" * 60)
        print("DRY RUN MODE - No changes will be made")
        print("=" * 60)
    
    # Ensure labels exist
    if not args.dry_run:
        ensure_labels_exist()
    
    # Fetch all issues
    issues = fetch_all_issues()
    
    if args.limit:
        issues = issues[:args.limit]
        print(f"Limiting to first {args.limit} issues")
    
    # Triage each issue
    triaged_count = 0
    already_triaged = 0
    
    for issue in issues:
        if get_existing_labels(issue).intersection({'triage:done'}):
            already_triaged += 1
        else:
            if triage_issue(issue, dry_run=args.dry_run):
                triaged_count += 1
    
    # Summary
    print("\n" + "=" * 60)
    print("TRIAGE SUMMARY")
    print("=" * 60)
    print(f"Total issues: {len(issues)}")
    print(f"Already triaged: {already_triaged}")
    print(f"Newly triaged: {triaged_count}")
    print(f"Total triaged: {already_triaged + triaged_count}")
    
    if args.dry_run:
        print("\nThis was a dry run. Re-run without --dry-run to apply changes.")
    else:
        print("\nTriage complete!")
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
