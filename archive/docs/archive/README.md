# Archive Directory

This directory contains files that were moved from the root directory to reduce clutter while preserving all content.

## Directory Structure

### `root-md-files/` (44 files)
Contains markdown documentation files that were previously in the root directory. These files contain detailed implementation documentation and can be referenced as needed.

**Key archived documentation:**
- AI CLI Tools implementation plans and summaries
- Authentication system documentation
- Azure infrastructure summaries
- Component onboarding checklists
- Comprehensive testing guides and reports
- Container manifests and documentation
- Datadog monitoring configuration
- Development environment setup
- GenAI integration architecture
- Kubernetes troubleshooting guides
- License management documentation
- Mastra integration guides
- VS Code extension configuration
- Production status reports
- Redis/Valkey implementation details
- Temporal integration summaries
- And more...

### `logs/`
Contains application log files that were generated during development and testing.

### `temp-files/`
Contains temporary files like development logs, test cookies, and other ephemeral files.

### `test-results/`
Reserved for test result files and coverage reports.

## Accessing Archived Content

To view archived documentation:
```bash
# List all archived markdown files
ls archive/root-md-files/

# View specific documentation
cat archive/root-md-files/[FILENAME].md

# Search for specific content
grep -r "search term" archive/root-md-files/
```

## Consolidated Access

For a high-level overview of all archived content, see the main `CONSOLIDATED_DOCUMENTATION.md` file in the root directory, which provides a structured table of contents and references to all archived materials.