# Workspace RAG Extension - Verification Checklist

## Current Status

### ✅ Completed
- Extension code committed to main
- Python build scripts with Datadog tracing
- Documentation (claudedocs, release notes)
- Git cleanup complete
- Python scripts run and show help

### ⚠️ Not Yet Verified

#### Prerequisites Needed
- Node.js 18+ (NOT INSTALLED)
- ddtrace Python package (NOT INSTALLED)
- PostgreSQL 15+ with pgvector
- Datadog agent (for tracing verification)

#### Tests to Run

**1. Install Prerequisites:**
```bash
brew install node@18
pip3 install ddtrace
```

**2. Test Python Build Scripts:**
```bash
cd scripts/extensions
./package_workspace_rag.py check
./package_workspace_rag.py package --skip-tests
```

**3. Test Extension Build:**
```bash
cd extensions/workspace-rag
npm install
npm run compile
npm run test:unit
```

**4. Verify Datadog Integration:**
```bash
export DD_AGENT_HOST=localhost
export DD_API_KEY=your_key
python3 scripts/extensions/package_workspace_rag.py check
# Check Datadog APM for traces
```

## Quick Start

```bash
# Install dependencies
brew install node@18 postgresql@15
pip3 install ddtrace

# Run verification
cd /Users/studio/vibecode-webgui
scripts/extensions/package_workspace_rag.py check
```

## Current System
- Python: 3.9.6 ✓
- Node.js: NOT INSTALLED ✗
- ddtrace: NOT INSTALLED ✗
- Scripts: Syntax valid ✓

Build verification pending Node.js installation.
