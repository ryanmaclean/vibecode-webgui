# Issue Triage Tools

This directory contains scripts and data for triaging GitHub issues.

## Quick Start

### Option 1: Automated (Requires GitHub CLI Authentication)

```bash
# Ensure gh CLI is authenticated
gh auth login

# Run the complete triage process
python3 scripts/triage_all_issues.py

# Or use the pre-generated script
bash scripts/apply_triage.sh
```

### Option 2: Manual (Using CSV)

1. Open `docs/triage_labels.csv` in a spreadsheet
2. Review each issue and its suggested labels
3. Apply labels manually through GitHub UI
4. Mark issues with `triage:done` when complete

### Option 3: Review and Approve

Review the comprehensive report at `docs/TRIAGE_REPORT.md` which contains:
- Summary of all 350 open issues
- Label distribution analysis
- Specific recommendations for each issue
- Implementation guidance

## Files

### Scripts

- **`triage_all_issues.py`** - Complete automated triage using GitHub CLI
- **`triage_issues_mcp.py`** - Analyze issues from JSON export
- **`apply_triage_labels.py`** - Generate shell script from recommendations
- **`apply_triage.sh`** - Pre-generated script to apply all labels

### Data Files

- **`docs/TRIAGE_REPORT.md`** - Comprehensive triage analysis report
- **`docs/triage_labels.csv`** - CSV file with all label recommendations

## Triage Summary

**Total Open Issues:** 350
- **Already Triaged:** 38 (11%)
- **Needs Triage:** 312 (89%)

### Labels to Apply

| Label | Count | Description |
|-------|-------|-------------|
| `triage:done` | 312 | Mark as triaged |
| `area:vm` | 281 | VM and virtualization |
| `priority:low` | 220 | Low priority |
| `area:performance` | 104 | Performance optimization |
| `area:ui` | 45 | User interface |

See `docs/TRIAGE_REPORT.md` for complete analysis.

## Usage Examples

### Dry Run (Preview Changes)

```bash
python3 scripts/triage_all_issues.py --dry-run --limit 10
```

### Triage First 50 Issues

```bash
python3 scripts/triage_all_issues.py --limit 50
```

### Generate New Recommendations

```bash
# Export issues from GitHub MCP server
# Save to /tmp/all_issues.json

# Analyze and generate recommendations
python3 scripts/triage_issues_mcp.py /tmp/all_issues.json

# Generate application script
python3 scripts/apply_triage_labels.py /tmp/triage_recommendations.json
```

## Label Definitions

### Area Labels (Technical Domain)

- `area:vm` - Virtual machine and virtualization
- `area:ui` - User interface and UX
- `area:performance` - Performance optimization
- `area:tracing` - Observability and monitoring
- `area:security` - Security features
- `area:build` - Build system and CI/CD
- `area:git` - Git integration
- `area:storage` - Storage and disk management
- `area:networking` - Network configuration
- `area:rag` - RAG and vector database

### Priority Labels

- `priority:high` - Critical issues requiring immediate attention
- `priority: p2` - Medium priority
- `priority:low` - Low priority (most feature audits)

### Other Labels

- `triage:done` - Issue has been reviewed and categorized
- `feature-audit` - Feature documentation/verification task

## Next Steps

After triaging all issues:

1. **Review High-Priority Issues**
   - Focus on `priority:high` labeled issues
   - Address critical performance and security items

2. **Close Completed Feature Audits**
   - Many feature audits document existing features
   - Close or update issues that are no longer relevant

3. **Consolidate Duplicates**
   - Merge similar issues
   - Link related feature requests

4. **Automate Future Triage**
   - Set up GitHub Actions workflow
   - Auto-label new issues based on keywords

## Troubleshooting

### GitHub CLI Not Authenticated

```bash
# Login to GitHub
gh auth login

# Verify authentication
gh auth status
```

### Rate Limiting

The scripts include sleep delays to avoid rate limits. If you hit rate limits:
- Increase sleep time in scripts
- Process issues in smaller batches
- Use `--limit` parameter

### Missing Labels

Ensure all required labels exist:

```bash
gh label create "triage:done" --color 0e8a16 --description "Issue has been triaged"
gh label create "area:vm" --color 0075ca --description "VM and virtualization"
# ... etc (see TRIAGE_REPORT.md for complete list)
```

## Contributing

To improve the triage scripts:

1. Update label keywords in `AREA_LABELS` dict
2. Adjust priority detection in `PRIORITY_KEYWORDS`
3. Test with `--dry-run` flag
4. Submit improvements via pull request

---

**Last Updated:** 2026-02-01  
**Maintainer:** VibeCode Team
