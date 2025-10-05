#!/bin/bash
# Safe Root Directory Cleanup Script
# Moves files in small batches with verification
# Can be safely interrupted and resumed

set -e

echo "🧹 Safe Root Directory Cleanup"
echo "=============================="
echo ""

# Function to move files safely
move_batch() {
    local batch_name="$1"
    local dest="$2"
    shift 2
    local files=("$@")
    
    echo "📦 Batch: $batch_name"
    echo "   Destination: $dest"
    echo "   Files: ${#files[@]}"
    
    # Ensure destination exists
    mkdir -p "$dest"
    
    # Move each file
    local moved=0
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            git mv "$file" "$dest/" 2>/dev/null && moved=$((moved+1)) || echo "   ⚠️  Skipped: $file"
        fi
    done
    
    echo "   ✅ Moved: $moved files"
    echo ""
}

# Batch 1: Shell Scripts (13 files)
echo "=== Batch 1: Shell Scripts ==="
move_batch "Shell Scripts" "scripts" \
    audit-documentation.sh \
    create-release-branch.sh \
    DEMO.sh \
    fix-cognitive-search-adapter.sh \
    fix-database-connections.sh \
    move-md-files.sh \
    optimize-github-actions.sh \
    poll-traces.sh \
    run_perf_tests.sh \
    setup-branch-protection.sh \
    setup-real-testing.sh \
    troubleshoot-database.sh \
    fix-merge-conflicts.sh

# Batch 2: Datadog Service Configs (11 files)
echo "=== Batch 2: Datadog Configs ==="
move_batch "Datadog Configs" "configs/datadog" \
    postgres.datadog.yaml \
    service.datadog.yaml \
    static-analysis.datadog.yml \
    vibecode-ai-gateway.datadog.yaml \
    vibecode-app.datadog.yaml \
    vibecode-ingest.datadog.yaml \
    vibecode-queue.datadog.yaml \
    vibecode-rag-app.datadog.yaml \
    vibecode-webgui.datadog.yaml \
    vibecode-worker.datadog.yaml \
    vibecode.datadog.yaml

# Batch 3: Dockerfiles (12 files)
echo "=== Batch 3: Dockerfiles ==="
move_batch "Dockerfiles" "docker" \
    Dockerfile.aks \
    Dockerfile.dev \
    Dockerfile.fast \
    Dockerfile.ingest \
    Dockerfile.lightningcss-only \
    Dockerfile.local \
    Dockerfile.multiarch \
    Dockerfile.prod \
    Dockerfile.production \
    Dockerfile.simple \
    Dockerfile.tailwind-test \
    Dockerfile.test

# Batch 4: Docker Compose Files (10 files)
echo "=== Batch 4: Docker Compose ==="
move_batch "Docker Compose" "docker" \
    docker-compose.ai-gateway.yml \
    docker-compose.dev.yml \
    docker-compose.litellm.yml \
    docker-compose.multiarch.yml \
    docker-compose.pgvector.yml \
    docker-compose.prod.yml \
    docker-compose.production.yml \
    docker-compose.repo.yml \
    docker-compose.test.yml \
    docker-compose.yml

# Batch 5: K8s Manifests (3 files)
echo "=== Batch 5: K8s Manifests ==="
move_batch "K8s Manifests" "k8s" \
    kind-vibecode-local.yaml \
    simple-kind-cluster.yaml \
    storage-class.yaml

# Batch 6: Datadog Agent Configs (3 files)
echo "=== Batch 6: Datadog Agent ==="
move_batch "Datadog Agent" "k8s/datadog" \
    datadog-agent.yaml \
    datadog-agent-lean.yaml \
    datadog-values.yaml

# Batch 7: Datadog Dashboards (4 files)
echo "=== Batch 7: Datadog Dashboards ==="
move_batch "Datadog Dashboards" "configs/datadog" \
    datadog-agent-patch.json \
    datadog-azure-embedding-dashboard.json \
    datadog-bot-protection-dashboard.json \
    datadog-dashboard-embedding-metrics.json

# Batch 8: Misc Configs (2 files)
echo "=== Batch 8: Misc Configs ==="
move_batch "Misc Configs" "configs/platforms" \
    datadog-synthetics.json \
    dependency-compatibility-report.json

echo "✅ Cleanup Complete!"
echo ""
echo "📊 Summary:"
ls -1 | wc -l | xargs echo "   Files in root:"
ls -d */ | wc -l | xargs echo "   Directories in root:"
echo ""
echo "🔍 Next: Run 'npm run type-check' to verify"
