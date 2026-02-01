#!/usr/bin/env python3
"""
Issue triage analysis script for vibecode-webgui repository.
Analyzes issues and generates triage recommendations.
This version works with exported GitHub issue data.
"""

import json
import sys
from typing import Dict, List, Set
from collections import Counter

# Label definitions
AREA_LABELS = {
    'vm': ['virtual machine', 'virtualization', 'vfkit', 'lima', 'apple virtualization', 'hypervisor', 'vz', ' vm ', 'vms'],
    'ui': [' ui ', 'interface', 'frontend', 'theme', 'dark mode', 'monaco', 'visual', 'swiftui', 'tauri', 'editor core', 'command palette'],
    'tracing': ['tracing', 'telemetry', 'datadog', 'opentelemetry', 'otlp', 'observability', 'apm', 'metrics collection', 'distributed'],
    'performance': ['performance', 'optimization', 'speed', 'fast-boot', 'boot time', 'benchmark', 'startup', 'efficient'],
    'security': ['security', 'sandboxing', 'csp headers', 'keychain', 'credential', 'encryption', 'secrets', 'nvram', 'secure storage'],
    'build': ['build', 'compilation', 'webpack', 'bundler', 'docker', 'dockerfile', 'ci', 'pipeline'],
    'git': ['git integration', 'git operations', 'version control', 'commit', 'branch management'],
    'rag': ['pgvector', 'embedding', 'vector database', 'retrieval'],
    'networking': ['networking', 'dhcp', 'nat networking', 'network', 'ip address'],
    'storage': ['storage', 'disk', 'filesystem', 'sparse disk'],
}

PRIORITY_KEYWORDS = {
    'high': ['critical', 'urgent', 'blocker', 'fast-boot', 'high-priority', 'p0', 'p1'],
    'medium': ['important', 'should have', 'p2'],
    'low': ['nice to have', 'feature audit', 'enhancement', 'minor'],
}


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
    elif any(keyword in text for keyword in PRIORITY_KEYWORDS['medium']):
        labels_to_add['priority'].add('priority: p2')
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
    
    # Add size label for small issues
    if 'small' in text or len(body) < 200:
        if 'feature audit' not in text:  # Don't add size to feature audits
            labels_to_add['other'].add('size:small')
    
    return labels_to_add


def get_existing_labels(issue: Dict) -> Set[str]:
    """Get existing label names from an issue."""
    return {label['name'] for label in issue.get('labels', [])}


def triage_issue(issue: Dict) -> Dict:
    """Triage a single issue and return recommendations."""
    issue_number = issue['number']
    title = issue['title']
    existing_labels = get_existing_labels(issue)
    
    # Check if already triaged
    already_triaged = 'triage:done' in existing_labels
    
    # Analyze and determine labels
    suggested_labels = analyze_issue(issue)
    
    # Combine all suggested labels
    all_suggested = set()
    for label_type, labels in suggested_labels.items():
        all_suggested.update(labels)
    
    # Filter out labels that already exist
    new_labels = all_suggested - existing_labels
    
    # Always suggest triage:done if not present
    if not already_triaged:
        new_labels.add('triage:done')
    
    return {
        'number': issue_number,
        'title': title,
        'already_triaged': already_triaged,
        'existing_labels': list(existing_labels),
        'suggested_labels': list(all_suggested),
        'new_labels': list(new_labels),
        'needs_triage': not already_triaged or len(new_labels) > 1
    }


def generate_report(issues: List[Dict]) -> None:
    """Generate a triage report."""
    print("\n" + "=" * 80)
    print("ISSUE TRIAGE ANALYSIS REPORT")
    print("=" * 80)
    
    total_issues = len(issues)
    triage_results = [triage_issue(issue) for issue in issues]
    
    already_triaged = sum(1 for r in triage_results if r['already_triaged'])
    needs_triage = sum(1 for r in triage_results if r['needs_triage'])
    
    print(f"\nTotal Issues: {total_issues}")
    print(f"Already Triaged: {already_triaged}")
    print(f"Needs Triage: {needs_triage}")
    
    # Count labels to be added
    all_new_labels = []
    for result in triage_results:
        all_new_labels.extend(result['new_labels'])
    
    label_counts = Counter(all_new_labels)
    
    print(f"\n{'Label':<30} {'Count':>10}")
    print("-" * 42)
    for label, count in label_counts.most_common():
        print(f"{label:<30} {count:>10}")
    
    # Show issues that need triage
    untriaged = [r for r in triage_results if r['needs_triage']]
    
    if untriaged:
        print(f"\n\nISSUES NEEDING TRIAGE ({len(untriaged)}):")
        print("=" * 80)
        
        for result in untriaged[:50]:  # Show first 50
            print(f"\n#{result['number']}: {result['title'][:70]}")
            if result['new_labels']:
                print(f"  Labels to add: {', '.join(result['new_labels'])}")
        
        if len(untriaged) > 50:
            print(f"\n... and {len(untriaged) - 50} more")
    
    # Export recommendations to JSON
    output_file = '/tmp/triage_recommendations.json'
    with open(output_file, 'w') as f:
        json.dump({
            'summary': {
                'total_issues': total_issues,
                'already_triaged': already_triaged,
                'needs_triage': needs_triage,
            },
            'label_counts': dict(label_counts),
            'recommendations': triage_results
        }, f, indent=2)
    
    print(f"\n\nDetailed recommendations saved to: {output_file}")
    print("=" * 80)


def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Analyze issues and generate triage recommendations')
    parser.add_argument('input_file', help='JSON file containing issue data')
    args = parser.parse_args()
    
    # Load issues from file
    try:
        with open(args.input_file, 'r') as f:
            data = json.load(f)
            issues = data.get('issues', [])
    except Exception as e:
        print(f"Error loading issues from {args.input_file}: {e}", file=sys.stderr)
        return 1
    
    if not issues:
        print("No issues found in input file", file=sys.stderr)
        return 1
    
    # Generate report
    generate_report(issues)
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
